const LeaveTransaction = require("../models/leaveTransactionScheme");
const LeaveType = require("../models/leaveTypeScheme");
const employe = require("../models/profileScheme");
const { ACTIVE_FILTER } = require("../utils/employeeRef");
const { buildYearRows, getBalanceMap, bucket, compOffEarnedMap, CL_CODE, COMP_CODE } = require("./leaveBalanceController");
const { employeeScopeFilter } = require("../utils/employeeQuery");

// Transaction match shared by the report + manage endpoints. `empIds` scopes to
// the filtered employee set; the rest mirror the current filters.
function txnMatch(query, empIds) {
  const m = {};
  if (Array.isArray(empIds)) m.empId = { $in: empIds };
  if (query.empId) m.empId = parseInt(query.empId, 10);
  if (query.year) m.year = parseInt(query.year, 10);
  if (query.month) m.month = parseInt(query.month, 10);
  if (query.leaveTypeCode) m.leaveTypeCode = String(query.leaveTypeCode).toUpperCase();
  if (query.fromDate || query.toDate) {
    m.fromDate = {};
    if (query.fromDate) m.fromDate.$gte = new Date(`${String(query.fromDate).slice(0, 10)}T00:00:00.000Z`);
    if (query.toDate) m.fromDate.$lte = new Date(`${String(query.toDate).slice(0, 10)}T23:59:59.999Z`);
  }
  return m;
}

// GET /leave/manage — the unified Employee Leave Management dataset.
// Employee scoping (search / dept / designation) is applied on the SERVER. The
// per-employee summary + per-type breakdown are the CL + Comp Off BALANCE (the
// only deductible buckets, req 4/7) read from the same source as every other
// balance view — so the table, the details drawer and the CSV export always show
// identical numbers.
//
//   CL  allocated = the year's CL allocation (default quota until allocated)
//   COMP allocated = Comp Off EARNED from OT (all entries, derived — req 3)
//   used      = the CL / Comp Off actually deducted by this employee's leaves
//   remaining = allocated - used   (may be negative — req 6)
const getLeaveManagement = async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();

    const [employees, dbTypes] = await Promise.all([
      employe
        .find(employeeScopeFilter(req.query), {
          empId: 1, empName: 1, empDepartment: 1, empDesignation: 1,
        })
        .lean(),
      LeaveType.find({ active: true, code: { $in: [CL_CODE, COMP_CODE] } }).lean(),
    ]);

    // Stable CL + Comp Off columns (canonical names/quota fallback).
    const byCode = new Map(dbTypes.map((t) => [t.code, t]));
    const cols = [
      { code: CL_CODE, name: byCode.get(CL_CODE)?.name || "Casual Leave" },
      { code: COMP_CODE, name: byCode.get(COMP_CODE)?.name || "Comp Off" },
    ];
    const clQuota = byCode.get(CL_CODE)?.defaultAnnualQuota || 0;

    const empIds = employees.map((e) => e.empId);
    if (!empIds.length) {
      return res.status(200).json({
        year, types: cols, data: [],
        totals: { employees: 0, allocated: 0, taken: 0, remaining: 0 },
      });
    }

    const [balMap, compMap] = await Promise.all([
      getBalanceMap(year, empIds),
      compOffEarnedMap(year, empIds),
    ]);

    const data = employees
      .map((e) => {
        const typesObj = balMap.get(e.empId) || {};
        const byType = cols.map((t) => {
          const b = bucket(typesObj, t.code);
          const hasBucket = Object.prototype.hasOwnProperty.call(typesObj, t.code);
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
        const allocated = byType.reduce((s, r) => s + r.allocated, 0);
        const taken = byType.reduce((s, r) => s + r.used, 0);
        return {
          empId: e.empId,
          empName: e.empName || `ID ${e.empId}`,
          empDepartment: e.empDepartment || "",
          empDesignation: e.empDesignation || "",
          allocated,
          taken,
          remaining: allocated - taken,
          byType,
        };
      })
      .sort((a, b) => a.empId - b.empId);

    const totals = data.reduce(
      (acc, r) => ({
        employees: acc.employees + 1,
        allocated: acc.allocated + r.allocated,
        taken: acc.taken + r.taken,
        remaining: acc.remaining + r.remaining,
      }),
      { employees: 0, allocated: 0, taken: 0, remaining: 0 }
    );

    return res.status(200).json({ year, types: cols, data, totals });
  } catch (error) {
    console.error("Error building leave management view:", error);
    return res.status(500).json({ message: "Failed to build leave management view" });
  }
};

// GET /leave/reports/summary?empId&month&year&leaveTypeCode&department&designation
// One row per (employee, leave type) — retained for backward compatibility.
const getLeaveReport = async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();

    const [employees, txns, types] = await Promise.all([
      employe
        .find(employeeScopeFilter(req.query), { empId: 1, empName: 1, empDesignation: 1, empDepartment: 1 })
        .lean(),
      LeaveTransaction.aggregate([
        { $match: { ...txnMatch(req.query), year } },
        { $group: { _id: { empId: "$empId", code: "$leaveTypeCode" }, taken: { $sum: "$days" } } },
      ]),
      LeaveType.find().lean(),
    ]);

    const empMap = new Map(employees.map((e) => [e.empId, e]));
    const activeIds = employees.map((e) => e.empId);
    const nameByCode = new Map(types.map((t) => [t.code, t.name]));
    const balMap = await getBalanceMap(year, activeIds);
    const activeIdSet = new Set(activeIds);

    const rows = txns
      .filter((t) => activeIdSet.has(t._id.empId))
      .map((t) => {
        const emp = empMap.get(t._id.empId) || {};
        const b = bucket(balMap.get(t._id.empId), t._id.code);
        const allocated = b.allocated || 0;
        const used = b.used || 0;
        return {
          empId: t._id.empId,
          empName: emp.empName || `ID ${t._id.empId}`,
          empDepartment: emp.empDepartment || "",
          empDesignation: emp.empDesignation || "",
          leaveTypeCode: t._id.code,
          leaveTypeName: nameByCode.get(t._id.code) || t._id.code,
          leaveTaken: t.taken,
          allocated,
          used,
          remaining: allocated - used,
        };
      })
      .sort((a, b) => a.empId - b.empId || a.leaveTypeCode.localeCompare(b.leaveTypeCode));

    const summary = rows.reduce(
      (s, r) => ({
        leaveTaken: s.leaveTaken + r.leaveTaken,
        allocated: s.allocated + r.allocated,
        used: s.used + r.used,
        remaining: s.remaining + r.remaining,
      }),
      { leaveTaken: 0, allocated: 0, used: 0, remaining: 0 }
    );

    return res.status(200).json({ message: "Leave report", year, data: rows, summary });
  } catch (error) {
    console.error("Error building leave report:", error);
    return res.status(500).json({ message: "Failed to build leave report" });
  }
};

// GET /leave/summary/monthly?year&empId&month — salary-facing roll-up (unchanged).
const getMonthlySummary = async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const match = { ...txnMatch(req.query), year };

    const agg = await LeaveTransaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: { empId: "$empId", month: "$month" },
          totalDays: { $sum: "$days" },
          paidDays: { $sum: { $cond: ["$isPaid", "$days", 0] } },
          unpaidDays: { $sum: { $cond: ["$isPaid", 0, "$days"] } },
          byType: { $push: { code: "$leaveTypeCode", name: "$leaveTypeName", days: "$days" } },
        },
      },
      { $sort: { "_id.empId": 1, "_id.month": 1 } },
    ]);

    const employees = await employe.find(ACTIVE_FILTER, { empId: 1, empName: 1 }).lean();
    const nameById = new Map(employees.map((e) => [e.empId, e.empName]));
    const activeIds = new Set(employees.map((e) => e.empId));

    const data = agg
      .filter((r) => activeIds.has(r._id.empId))
      .map((r) => {
        const perType = {};
        r.byType.forEach((x) => {
          perType[x.code] = perType[x.code] || { code: x.code, name: x.name, days: 0 };
          perType[x.code].days += x.days;
        });
        return {
          empId: r._id.empId,
          empName: nameById.get(r._id.empId) || `ID ${r._id.empId}`,
          year, month: r._id.month,
          totalDays: r.totalDays, paidDays: r.paidDays, unpaidDays: r.unpaidDays,
          byType: Object.values(perType),
        };
      });

    return res.status(200).json({ message: "Monthly leave summary", year, data });
  } catch (error) {
    console.error("Error building monthly summary:", error);
    return res.status(500).json({ message: "Failed to build monthly summary" });
  }
};

// GET /leave/summary/yearly?year&empId — per-employee yearly totals (unchanged).
const getYearlySummary = async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const match = { ...txnMatch(req.query), year };

    const agg = await LeaveTransaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$empId",
          totalDays: { $sum: "$days" },
          paidDays: { $sum: { $cond: ["$isPaid", "$days", 0] } },
          unpaidDays: { $sum: { $cond: ["$isPaid", 0, "$days"] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const employees = await employe.find(ACTIVE_FILTER, { empId: 1, empName: 1 }).lean();
    const nameById = new Map(employees.map((e) => [e.empId, e.empName]));
    const activeIds = new Set(employees.map((e) => e.empId));

    const data = agg
      .filter((r) => activeIds.has(r._id))
      .map((r) => ({
        empId: r._id,
        empName: nameById.get(r._id) || `ID ${r._id}`,
        year, totalDays: r.totalDays, paidDays: r.paidDays, unpaidDays: r.unpaidDays,
      }));

    return res.status(200).json({ message: "Yearly leave summary", year, data });
  } catch (error) {
    console.error("Error building yearly summary:", error);
    return res.status(500).json({ message: "Failed to build yearly summary" });
  }
};

// GET /leave/dashboard-overview?year&threshold — on-leave-today + low-balance.
// Reuses buildYearRows (the balance calc) — unchanged by the schema refactor.
const getDashboardOverview = async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const threshold = req.query.threshold !== undefined ? Number(req.query.threshold) : 2;

    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    const [employees, covering, yearRows] = await Promise.all([
      employe.find(ACTIVE_FILTER, { empId: 1, empName: 1, empDepartment: 1, empDesignation: 1 }).lean(),
      LeaveTransaction.find({ fromDate: { $lte: todayEnd }, toDate: { $gte: todayStart } })
        .sort({ fromDate: -1 }).lean(),
      buildYearRows(year),
    ]);

    const empMap = new Map(employees.map((e) => [e.empId, e]));
    const activeIds = new Set(employees.map((e) => e.empId));

    const onLeaveToday = covering
      .filter((t) => activeIds.has(t.empId))
      .map((t) => {
        const emp = empMap.get(t.empId) || {};
        const ret = new Date(new Date(t.toDate).getTime() + 24 * 60 * 60 * 1000);
        return {
          empId: t.empId, empName: emp.empName || `ID ${t.empId}`,
          empDepartment: emp.empDepartment || "", leaveTypeName: t.leaveTypeName || t.leaveTypeCode,
          duration: t.dayType || "FULL DAY", days: t.days,
          fromDate: t.fromDate, toDate: t.toDate, expectedReturn: ret,
        };
      });

    const lowBalance = [];
    yearRows.forEach((r) => {
      r.byType.forEach((b) => {
        if (b.allocated > 0 && b.remaining <= threshold) {
          lowBalance.push({
            empId: r.empId, empName: r.empName, empDepartment: r.empDepartment || "",
            leaveTypeCode: b.leaveTypeCode, leaveTypeName: b.leaveTypeName, remaining: b.remaining,
          });
        }
      });
    });
    lowBalance.sort((a, b) => a.remaining - b.remaining || a.empId - b.empId);

    return res.status(200).json({
      year, threshold,
      onLeaveToday, onLeaveTodayCount: onLeaveToday.length,
      lowBalance, lowBalanceCount: lowBalance.length,
    });
  } catch (error) {
    console.error("Error building dashboard overview:", error);
    return res.status(500).json({ message: "Failed to build dashboard overview" });
  }
};

module.exports = {
  getLeaveManagement,
  getLeaveReport,
  getMonthlySummary,
  getYearlySummary,
  getDashboardOverview,
};
