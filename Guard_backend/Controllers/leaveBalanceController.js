const LeaveBalance = require("../models/leaveBalanceScheme");
const LeaveType = require("../models/leaveTypeScheme");
const employe = require("../models/profileScheme");
const { ACTIVE_FILTER, getActiveEmployeeIds } = require("../utils/employeeRef");

// --- Shared ledger mutation ---------------------------------------------------
// Adjust an employee's `used` for a (year, type) by +days (record) or -days
// (delete). Creates the balance row on first use, seeding `allocated` from the
// leave type's default quota so `remaining` is meaningful even before a formal
// yearly allocation has been run. `used` is floored at 0 so a delete can never
// drive it negative. This is the single place `used` is ever changed.
async function adjustBalanceUsed({ empId, year, leaveTypeCode, days, defaultQuota = 0 }) {
  const code = String(leaveTypeCode).toUpperCase();
  await LeaveBalance.updateOne(
    { empId, year, leaveTypeCode: code },
    {
      $inc: { used: days },
      $setOnInsert: { allocated: defaultQuota },
    },
    { upsert: true }
  );
  // Floor used at 0 (guards against deleting more than was recorded).
  await LeaveBalance.updateOne(
    { empId, year, leaveTypeCode: code, used: { $lt: 0 } },
    { $set: { used: 0 } }
  );
}

// Build per-employee balance rows for a year (used by the Balances page). Names
// come from the master — nothing is duplicated into leave_balances.
async function buildYearRows(year, empIdFilter) {
  const [employees, balances, types] = await Promise.all([
    employe.find(ACTIVE_FILTER).lean(),
    LeaveBalance.find(
      empIdFilter != null ? { year, empId: empIdFilter } : { year }
    ).lean(),
    LeaveType.find({ active: true }).sort({ sortOrder: 1, name: 1 }).lean(),
  ]);

  const nameByCode = new Map(types.map((t) => [t.code, t.name]));
  const balByEmp = new Map();
  balances.forEach((b) => {
    if (!balByEmp.has(b.empId)) balByEmp.set(b.empId, []);
    balByEmp.get(b.empId).push(b);
  });

  const list = empIdFilter != null
    ? employees.filter((e) => e.empId === empIdFilter)
    : employees;

  return list
    .map((e) => {
      const rows = balByEmp.get(e.empId) || [];
      const byType = rows.map((b) => ({
        leaveTypeCode: b.leaveTypeCode,
        leaveTypeName: nameByCode.get(b.leaveTypeCode) || b.leaveTypeCode,
        allocated: b.allocated || 0,
        used: b.used || 0,
        remaining: (b.allocated || 0) - (b.used || 0),
      }));
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

// GET /leave/balances?year=2026&empId=1234
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
// active employees when empIds is omitted). Never touches `used`.
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

    const ops = [];
    for (const empId of targets) {
      for (const a of allocations) {
        const code = String(a.leaveTypeCode).toUpperCase();
        const allocated = Math.max(0, Number(a.allocated) || 0);
        ops.push({
          updateOne: {
            filter: { empId, year, leaveTypeCode: code },
            update: { $set: { allocated }, $setOnInsert: { used: 0 } },
            upsert: true,
          },
        });
      }
    }
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
};
