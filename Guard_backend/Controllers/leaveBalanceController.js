const LeaveBalance = require("../models/leaveBalanceScheme");
const LeaveType = require("../models/leaveTypeScheme");
const employe = require("../models/profileScheme");
const Ot = require("../models/otScheme");
const { ACTIVE_FILTER, getActiveEmployeeIds } = require("../utils/employeeRef");

// One balance document per (empId, year) now holds every type under `types`.
// These helpers are the ONLY place that shape is read/written, so the rest of
// the app keeps seeing the same { allocated, used, remaining } view it always did.

// Safe read of a single type bucket from a balance doc's `types` object.
const bucket = (types, code) => (types && types[code]) || { allocated: 0, used: 0 };

// Comp Off: leave earned from OT. Its "allocated" is NOT a fixed quota — it is
// derived from OT — so it is computed on the balance read path (never stored),
// and `used` is the Comp Off portion of the CL→Comp Off deduction that
// recordLeave writes. remaining = earned - used.
//
// Policy (req 3): there is NO OT approval workflow — recording an OT entry means
// the overtime was already worked, so EVERY OT entry immediately earns Comp Off.
const CL_CODE = "CL";
const COMP_CODE = "COMP";

// The only two balance-bearing (deductible) buckets. Every leave is funded from
// CL then Comp Off (req 4); the predefined leave TYPES (Special/Summer/Holiday…)
// remain selectable category labels on a leave record but do not carry their own
// balance. This keeps one clean, consistent balance everywhere (req 7).
const DEDUCTIBLE_TYPES = [
  { code: CL_CODE, name: "Casual Leave" },
  { code: COMP_CODE, name: "Comp Off" },
];

// OT working-duration -> days (the OT schema stores a coarse enum, not a number).
const OT_DURATION_DAYS_STAGE = {
  $switch: {
    branches: [
      { case: { $eq: ["$workingDuration", "4 Hours (Half Day)"] }, then: 0.5 },
      { case: { $eq: ["$workingDuration", "8 Hours (Full Day)"] }, then: 1 },
      { case: { $eq: ["$workingDuration", "Double Shift"] }, then: 2 },
    ],
    default: 1,
  },
};

// empId -> Comp Off days EARNED in `year` (sum of ALL OT days — no approval
// gate, req 3). One aggregation, reused by every balance read so Comp Off stays
// identical across Apply Leave, Leave Management, reports, etc. (single source).
async function compOffEarnedMap(year, empIds) {
  const match = {};
  if (Array.isArray(empIds) && empIds.length) match.employeeId = { $in: empIds };
  const agg = await Ot.aggregate([
    { $match: match },
    { $addFields: { _yr: { $year: "$fromDate" } } },
    { $match: { _yr: year } },
    { $group: { _id: "$employeeId", days: { $sum: OT_DURATION_DAYS_STAGE } } },
  ]);
  return new Map(agg.map((a) => [a._id, a.days]));
}

// --- Shared ledger mutation ---------------------------------------------------
// Adjust an employee's `used` for a (year, type) by +days (record) or -days
// (delete/edit). Upserts the single per-year document and the type bucket inside
// it, seeding `allocated` from the type's default quota on first touch. `used` is
// floored at 0. This is the single place `used` is ever changed.
async function adjustBalanceUsed({ empId, year, leaveTypeCode, days, defaultQuota = 0 }) {
  const code = String(leaveTypeCode).toUpperCase();
  await LeaveBalance.updateOne(
    { empId, year },
    {
      $inc: { [`types.${code}.used`]: days },
      $setOnInsert: { [`types.${code}.allocated`]: defaultQuota },
    },
    { upsert: true }
  );
  // Floor used at 0 (guards against removing more than was recorded).
  await LeaveBalance.updateOne(
    { empId, year, [`types.${code}.used`]: { $lt: 0 } },
    { $set: { [`types.${code}.used`]: 0 } }
  );
}

// Propagate a leave type's default quota to EVERY employee balance for that
// type. Sets only `types.<CODE>.allocated` — `used` (historical), leave history
// and transactions are never touched, so `remaining` (allocated - used) just
// re-derives. Reusable across every entry point that changes a quota. Returns
// the number of balance documents updated.
async function syncLeaveTypeQuota(leaveTypeCode, allocated) {
  const code = String(leaveTypeCode).toUpperCase();
  const value = Math.max(0, Number(allocated) || 0);
  const res = await LeaveBalance.updateMany(
    {},
    { $set: { [`types.${code}.allocated`]: value } }
  );
  return res.modifiedCount || 0;
}

// empId -> types object ({ CODE: { allocated, used } }) for a year. Optionally
// restricted to a set of employee ids. Reused by buildYearRows, the report and
// the unified manage endpoint so balance access lives in one place.
async function getBalanceMap(year, empIds) {
  const q = { year };
  if (Array.isArray(empIds) && empIds.length) q.empId = { $in: empIds };
  const docs = await LeaveBalance.find(q).lean();
  const map = new Map();
  docs.forEach((d) => map.set(d.empId, d.types || {}));
  return map;
}

// Build per-employee balance rows for a year (byType + totals). The balance is
// the two deductible buckets only — CL and Comp Off (req 4/7); other predefined
// types are category labels on leave records, not balances. Output shape (byType
// + totals) is unchanged so existing consumers keep working.
async function buildYearRows(year, empIdFilter) {
  const [employees, dbTypes] = await Promise.all([
    employe.find(ACTIVE_FILTER).lean(),
    LeaveType.find({ active: true, code: { $in: [CL_CODE, COMP_CODE] } }).lean(),
  ]);

  // Always expose CL + Comp Off (fall back to canonical names/quota if a type
  // row is missing) so the balance view is stable even on a fresh install.
  const byCode = new Map(dbTypes.map((t) => [t.code, t]));
  const types = DEDUCTIBLE_TYPES.map((d) => byCode.get(d.code) || d);
  // CL's default quota seeds a brand-new employee's allocation until a formal
  // allocation (or first debit) stores it — so their real CL entitlement is
  // available to the deduction even before any allocation run.
  const clQuota = byCode.get(CL_CODE)?.defaultAnnualQuota || 0;

  const list =
    empIdFilter != null ? employees.filter((e) => e.empId === empIdFilter) : employees;

  const ids = empIdFilter != null ? [empIdFilter] : list.map((e) => e.empId);
  const [balMap, compMap] = await Promise.all([
    getBalanceMap(year, ids),
    compOffEarnedMap(year, ids),
  ]);

  return list
    .map((e) => {
      const typesObj = balMap.get(e.empId) || {};
      const byType = types.map((t) => {
        const b = bucket(typesObj, t.code);
        const hasBucket =
          typesObj && Object.prototype.hasOwnProperty.call(typesObj, t.code);
        // Comp Off "allocated" is EARNED from OT (derived, not stored). CL
        // "allocated" is the stored allocation, falling back to the default
        // quota until one is written.
        const allocated =
          t.code === COMP_CODE
            ? compMap.get(e.empId) || 0
            : hasBucket
            ? b.allocated || 0
            : clQuota;
        const used = b.used || 0;
        return {
          leaveTypeCode: t.code,
          leaveTypeName: t.name,
          allocated,
          used,
          remaining: allocated - used,
        };
      });
      const totals = byType.reduce(
        (a, r) => ({
          allocated: a.allocated + r.allocated,
          used: a.used + r.used,
          remaining: a.remaining + r.remaining,
        }),
        { allocated: 0, used: 0, remaining: 0 }
      );
      return {
        empId: e.empId,
        empName: e.empName,
        empDesignation: e.empDesignation || "",
        empDepartment: e.empDepartment || "",
        byType,
        totals,
      };
    })
    .sort((a, b) => a.empId - b.empId);
}

// Remaining balance for ONE employee/year/type, using the exact same derivation
// as every balance read (buildYearRows) — so Comp Off here == Comp Off shown on
// Apply Leave / Leave Management. This is the single source used to guard
// balance-limited leave (e.g. Comp Off can never go negative). Returns 0 if the
// employee/type is not found.
async function getRemainingForType(empId, year, leaveTypeCode) {
  const code = String(leaveTypeCode).toUpperCase();
  const rows = await buildYearRows(year, empId);
  const row = rows[0];
  if (!row) return 0;
  const t = row.byType.find((b) => b.leaveTypeCode === code);
  return t ? t.remaining : 0;
}

// CL + Comp Off remaining for ONE employee/year in a single balance read. This
// is the exact input the CL→Comp Off deduction runs against, so the split shown
// (and stored) matches every other balance view. Returns { cl, comp }.
async function getClCompRemaining(empId, year) {
  const rows = await buildYearRows(year, empId);
  const row = rows[0];
  const pick = (code) => row?.byType.find((b) => b.leaveTypeCode === code)?.remaining || 0;
  return { cl: pick(CL_CODE), comp: pick(COMP_CODE) };
}

// GET /leave/balances?year=2026&empId=1234  (output shape unchanged)
const getBalances = async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const empId = req.query.empId ? parseInt(req.query.empId, 10) : null;
    const [data, types] = await Promise.all([
      buildYearRows(year, empId),
      LeaveType.find({ active: true }).sort({ sortOrder: 1, name: 1 }).lean(),
    ]);
    return res.status(200).json({ message: "Leave balances", year, types, data });
  } catch (error) {
    console.error("Error fetching balances:", error);
    return res.status(500).json({ message: "Failed to fetch balances" });
  }
};

// POST /leave/balances/allocate
// { year, allocations:[{leaveTypeCode, allocated}], empIds?:[...] }
// Upserts `allocated` for the given types across the target employees (all
// active employees when empIds is omitted). Never touches `used`. Writes ONE
// document per employee (all types set in a single update).
const allocateBalances = async (req, res) => {
  try {
    const year = parseInt(req.body.year, 10);
    const allocations = Array.isArray(req.body.allocations) ? req.body.allocations : [];
    if (!year || !allocations.length) {
      return res.status(400).json({ message: "year and allocations[] are required" });
    }

    // Resolve targets: explicit list (kept to active ids) or every active emp.
    const { numbers: activeIds } = await getActiveEmployeeIds();
    let targets = activeIds;
    if (Array.isArray(req.body.empIds) && req.body.empIds.length) {
      const requested = new Set(req.body.empIds.map((n) => parseInt(n, 10)));
      targets = activeIds.filter((id) => requested.has(id));
    }
    if (!targets.length) {
      return res.status(400).json({ message: "No active employees to allocate to" });
    }

    // Validate the type codes exist.
    const codes = [...new Set(allocations.map((a) => String(a.leaveTypeCode).toUpperCase()))];
    const knownTypes = await LeaveType.find({ code: { $in: codes } }).lean();
    const known = new Set(knownTypes.map((t) => t.code));
    const bad = codes.filter((c) => !known.has(c));
    if (bad.length) {
      return res.status(400).json({ message: `Unknown leave type code(s): ${bad.join(", ")}` });
    }

    // One update per employee sets every allocated type at once.
    const setObj0 = {};
    allocations.forEach((a) => {
      const code = String(a.leaveTypeCode).toUpperCase();
      setObj0[`types.${code}.allocated`] = Math.max(0, Number(a.allocated) || 0);
    });
    const ops = targets.map((empId) => ({
      updateOne: {
        filter: { empId, year },
        update: { $set: { ...setObj0 } },
        upsert: true,
      },
    }));
    const result = await LeaveBalance.bulkWrite(ops, { ordered: false });
    return res.status(200).json({
      message: "Allocation applied",
      employees: targets.length,
      types: codes.length,
      upserted: result.upsertedCount || 0,
      modified: result.modifiedCount || 0,
    });
  } catch (error) {
    console.error("Error allocating balances:", error);
    return res.status(500).json({ message: "Failed to allocate balances" });
  }
};

// POST /leave/balances/reset  { year? }
// ACADEMIC RESET — start a fresh leave cycle for every active employee:
// each leave type goes back to its full default quota with `used` cleared.
//
// Comp Off is deliberately NOT touched. Its allocation is DERIVED from the
// employee's OT (earned = sum of OT days), so remaining = earned - used.
// Clearing its `used` would hand back Comp Off the employee has already spent;
// leaving it alone means the UNUSED balance carries forward exactly (earned 10,
// used 6 -> 4 still available after the reset).
//
// Leave history (transactions) is never deleted — only the balances reset.
const resetBalances = async (req, res) => {
  try {
    const year = parseInt(req.body.year, 10) || new Date().getFullYear();
    const [{ numbers: activeIds }, types] = await Promise.all([
      getActiveEmployeeIds(),
      LeaveType.find({ active: true }).lean(),
    ]);
    if (!activeIds.length) {
      return res.status(400).json({ message: "No active employees to reset" });
    }

    // Fresh quota + zero usage for every type EXCEPT Comp Off (carried forward).
    const set = {};
    types.forEach((t) => {
      if (t.code === COMP_CODE) return;
      set[`types.${t.code}.allocated`] = Math.max(0, Number(t.defaultAnnualQuota) || 0);
      set[`types.${t.code}.used`] = 0;
    });
    if (!Object.keys(set).length) {
      return res.status(400).json({ message: "No resettable leave types found" });
    }

    // Comp Off carried forward, reported back so the UI can confirm what was kept.
    const compMap = await compOffEarnedMap(year, activeIds);
    const balMap = await getBalanceMap(year, activeIds);
    let compCarried = 0;
    activeIds.forEach((empId) => {
      const earned = compMap.get(empId) || 0;
      const used = bucket(balMap.get(empId), COMP_CODE).used || 0;
      compCarried += Math.max(0, earned - used);
    });

    const ops = activeIds.map((empId) => ({
      updateOne: { filter: { empId, year }, update: { $set: set }, upsert: true },
    }));
    await LeaveBalance.bulkWrite(ops, { ordered: false });

    return res.status(200).json({
      message: "Academic reset complete",
      year,
      employees: activeIds.length,
      typesReset: Object.keys(set).length / 2,
      compOffCarriedForward: Math.round(compCarried * 100) / 100,
    });
  } catch (error) {
    console.error("Error resetting balances:", error);
    return res.status(500).json({ message: "Failed to reset leave balances" });
  }
};

module.exports = {
  getBalances,
  allocateBalances,
  resetBalances,
  adjustBalanceUsed,
  buildYearRows,
  getBalanceMap,
  getRemainingForType,
  getClCompRemaining,
  bucket,
  syncLeaveTypeQuota,
  compOffEarnedMap,
  CL_CODE,
  COMP_CODE,
};
