const LeaveTransaction = require("../models/leaveTransactionScheme");
const LeaveBalance = require("../models/leaveBalanceScheme");
const LeaveType = require("../models/leaveTypeScheme");
const employe = require("../models/profileScheme");
const { ACTIVE_FILTER } = require("../utils/employeeRef");

// Build the transaction filter shared by the report + stats endpoints.
function txnFilter(query) {
  const f = {};
  if (query.empId) f.empId = parseInt(query.empId, 10);
  if (query.year) f.year = parseInt(query.year, 10);
  if (query.month) f.month = parseInt(query.month, 10);
  if (query.leaveTypeCode) f.leaveTypeCode = String(query.leaveTypeCode).toUpperCase();
  return f;
}

// GET /leave/reports/summary?empId&month&year&leaveTypeCode
// One row per (employee, leave type): Leave Taken (over the filtered period) +
// the year's Allocated / Used / Remaining. Powers the CSV export.
const getLeaveReport = async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const filter = { ...txnFilter(req.query), year };

    const [employees, txns, balances, types] = await Promise.all([
      employe.find(ACTIVE_FILTER, { empId: 1, empName: 1, empDesignation: 1, empDepartment: 1 }).lean(),
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

module.exports = { getLeaveReport, getMonthlySummary, getYearlySummary };
