const LeaveTransaction = require("../models/leaveTransactionScheme");
const LeaveBalance = require("../models/leaveBalanceScheme");
const LeaveType = require("../models/leaveTypeScheme");
const employe = require("../models/profileScheme");
const { ACTIVE_FILTER } = require("../utils/employeeRef");
const { buildYearRows } = require("./leaveBalanceController");

// Active-employee filter with optional department / designation narrowing.
// Values are matched case-insensitively against the (curated) master values so
// the report can restrict rows to a department/designation on the SERVER — the
// report only ever emits rows for employees this query returns.
function employeeScopeFilter(query) {
  const f = { ...ACTIVE_FILTER };
  const exactCI = (v) => new RegExp(`^${String(v).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  if (query.department && String(query.department).trim())
    f.empDepartment = exactCI(query.department);
  if (query.designation && String(query.designation).trim())
    f.empDesignation = exactCI(query.designation);
  return f;
}

// Build the transaction filter shared by the report + stats endpoints.
function txnFilter(query) {
  const f = {};
  if (query.empId) f.empId = parseInt(query.empId, 10);
  if (query.year) f.year = parseInt(query.year, 10);
  if (query.month) f.month = parseInt(query.month, 10);
  if (query.leaveTypeCode) f.leaveTypeCode = String(query.leaveTypeCode).toUpperCase();
  return f;
}

// GET /leave/reports/summary?empId&month&year&leaveTypeCode&department&designation
// One row per (employee, leave type): Leave Taken (over the filtered period) +
// the year's Allocated / Used / Remaining. Department/Designation narrow the
// employee scope server-side. Powers the CSV export.
const getLeaveReport = async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const filter = { ...txnFilter(req.query), year };

    const [employees, txns, balances, types] = await Promise.all([
      employe.find(employeeScopeFilter(req.query), { empId: 1, empName: 1, empDesignation: 1, empDepartment: 1 }).lean(),
      LeaveTransaction.aggregate([
        { $match: filter },
        { $group: { _id: { empId: "$empId", code: "$leaveTypeCode" }, taken: { $sum: "$days" } } },
      ]),
      LeaveBalance.find(
        req.query.empId ? { year, empId: parseInt(req.query.empId, 10) } : { year }
      ).lean(),
      LeaveType.find().lean(),
    ]);

    const empMap = new Map(employees.map((e) => [e.empId, e]));
    const activeIds = new Set(employees.map((e) => e.empId));
    const nameByCode = new Map(types.map((t) => [t.code, t.name]));
    const balByKey = new Map(
      balances.map((b) => [`${b.empId}|${b.leaveTypeCode}`, b])
    );

    const rows = txns
      .filter((t) => activeIds.has(t._id.empId))
      .map((t) => {
        const emp = empMap.get(t._id.empId) || {};
        const bal = balByKey.get(`${t._id.empId}|${t._id.code}`) || { allocated: 0, used: 0 };
        return {
          empId: t._id.empId,
          empName: emp.empName || `ID ${t._id.empId}`,
          empDepartment: emp.empDepartment || "",
          empDesignation: emp.empDesignation || "",
          leaveTypeCode: t._id.code,
          leaveTypeName: nameByCode.get(t._id.code) || t._id.code,
          leaveTaken: t.taken,
          allocated: bal.allocated || 0,
          used: bal.used || 0,
          remaining: (bal.allocated || 0) - (bal.used || 0),
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

// GET /leave/summary/monthly?year&empId&month
// Salary-facing roll-up: leave days per employee per month, split paid vs unpaid
// (unpaidDays is the LOP basis a future salary engine deducts against). Also a
// per-type breakdown. No pay is computed here — only the inputs a salary module
// needs, so wiring salary later requires no schema/API change.
const getMonthlySummary = async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const match = { ...txnFilter(req.query), year };

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
        // Collapse byType pushes into totals per code.
        const perType = {};
        r.byType.forEach((x) => {
          perType[x.code] = perType[x.code] || { code: x.code, name: x.name, days: 0 };
          perType[x.code].days += x.days;
        });
        return {
          empId: r._id.empId,
          empName: nameById.get(r._id.empId) || `ID ${r._id.empId}`,
          year,
          month: r._id.month,
          totalDays: r.totalDays,
          paidDays: r.paidDays,
          unpaidDays: r.unpaidDays,
          byType: Object.values(perType),
        };
      });

    return res.status(200).json({ message: "Monthly leave summary", year, data });
  } catch (error) {
    console.error("Error building monthly summary:", error);
    return res.status(500).json({ message: "Failed to build monthly summary" });
  }
};

// GET /leave/summary/yearly?year&empId
// Per-employee yearly totals (paid/unpaid) — the annual counterpart of the
// monthly roll-up.
const getYearlySummary = async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const match = { ...txnFilter(req.query), year };

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
        year,
        totalDays: r.totalDays,
        paidDays: r.paidDays,
        unpaidDays: r.unpaidDays,
      }));

    return res.status(200).json({ message: "Yearly leave summary", year, data });
  } catch (error) {
    console.error("Error building yearly summary:", error);
    return res.status(500).json({ message: "Failed to build yearly summary" });
  }
};

// GET /leave/dashboard-overview?year&threshold
// Powers the two dashboard widgets in one round-trip, reusing existing calcs:
//   onLeaveToday – transactions whose [fromDate,toDate] covers today, joined to
//                  the active employee master (+ expected return = day after).
//   lowBalance   – flattened from buildYearRows() (the SAME balance calculation
//                  the Balances screen uses) where remaining <= threshold.
// `threshold` is supplied by the caller (frontend constant); defaults to 2.
const getDashboardOverview = async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const threshold = req.query.threshold !== undefined ? Number(req.query.threshold) : 2;

    // Today's UTC day window (dates are stored at UTC midnight).
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    const [employees, covering, yearRows] = await Promise.all([
      employe.find(ACTIVE_FILTER, { empId: 1, empName: 1, empDepartment: 1, empDesignation: 1 }).lean(),
      LeaveTransaction.find({
        fromDate: { $lte: todayEnd },
        toDate: { $gte: todayStart },
      }).sort({ fromDate: -1 }).lean(),
      buildYearRows(year), // reuse the balance ledger builder
    ]);

    const empMap = new Map(employees.map((e) => [e.empId, e]));
    const activeIds = new Set(employees.map((e) => e.empId));

    const onLeaveToday = covering
      .filter((t) => activeIds.has(t.empId))
      .map((t) => {
        const emp = empMap.get(t.empId) || {};
        const ret = new Date(new Date(t.toDate).getTime() + 24 * 60 * 60 * 1000);
        return {
          empId: t.empId,
          empName: emp.empName || `ID ${t.empId}`,
          empDepartment: emp.empDepartment || "",
          leaveTypeName: t.leaveTypeName || t.leaveTypeCode,
          duration: t.dayType || "FULL DAY",
          days: t.days,
          fromDate: t.fromDate,
          toDate: t.toDate,
          expectedReturn: ret,
        };
      });

    // Flatten buildYearRows -> one entry per (employee, type) below threshold.
    const lowBalance = [];
    yearRows.forEach((r) => {
      r.byType.forEach((b) => {
        if (b.allocated > 0 && b.remaining <= threshold) {
          lowBalance.push({
            empId: r.empId,
            empName: r.empName,
            empDepartment: r.empDepartment || "",
            leaveTypeCode: b.leaveTypeCode,
            leaveTypeName: b.leaveTypeName,
            remaining: b.remaining,
          });
        }
      });
    });
    lowBalance.sort((a, b) => a.remaining - b.remaining || a.empId - b.empId);

    return res.status(200).json({
      year,
      threshold,
      onLeaveToday,
      onLeaveTodayCount: onLeaveToday.length,
      lowBalance,
      lowBalanceCount: lowBalance.length,
    });
  } catch (error) {
    console.error("Error building dashboard overview:", error);
    return res.status(500).json({ message: "Failed to build dashboard overview" });
  }
};

module.exports = {
  getLeaveReport,
  getMonthlySummary,
  getYearlySummary,
  getDashboardOverview,
};
