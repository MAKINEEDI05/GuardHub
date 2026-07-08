const LeaveBalance = require("../models/leaveBalanceScheme");
const LeaveType = require("../models/leaveTypeScheme");
const employe = require("../models/profileScheme");
const { ACTIVE_FILTER, getActiveEmployeeIds } = require("../utils/employeeRef");

// One balance document per (empId, year) now holds every type under `types`.
// These helpers are the ONLY place that shape is read/written, so the rest of
// the app keeps seeing the same { allocated, used, remaining } view it always did.

// Safe read of a single type bucket from a balance doc's `types` object.
const bucket = (types, code) => (types && types[code]) || { allocated: 0, used: 0 };

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

// Build per-employee balance rows for a year (byType + totals). Output shape is
// unchanged from the pre-refactor version so existing consumers keep working.
async function buildYearRows(year, empIdFilter) {
  const [employees, types] = await Promise.all([
    employe.find(ACTIVE_FILTER).lean(),
    LeaveType.find({ active: true }).sort({ sortOrder: 1, name: 1 }).lean(),
  ]);

  const list =
    empIdFilter != null ? employees.filter((e) => e.empId === empIdFilter) : employees;

  const balMap = await getBalanceMap(
    year,
    empIdFilter != null ? [empIdFilter] : list.map((e) => e.empId)
  );

  return list
    .map((e) => {
      const typesObj = balMap.get(e.empId) || {};
      // Include EVERY active leave type (even with 0 allocation) so the UI shows
      // "0" rather than "—"/blank for a type the employee hasn't been allocated
      // yet. Consumers that only care about real allocations (e.g. the dashboard
      // low-balance widget) filter on allocated > 0 themselves.
      const byType = types.map((t) => {
        const b = bucket(typesObj, t.code);
        const allocated = b.allocated || 0;
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

module.exports = {
  getBalances,
  allocateBalances,
  adjustBalanceUsed,
  buildYearRows,
  getBalanceMap,
  bucket,
};
