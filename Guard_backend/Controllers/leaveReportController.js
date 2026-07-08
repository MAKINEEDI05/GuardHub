const LeaveTransaction = require("../models/leaveTransactionScheme");
const LeaveType = require("../models/leaveTypeScheme");
const employe = require("../models/profileScheme");
const { ACTIVE_FILTER } = require("../utils/employeeRef");
const { buildYearRows, getBalanceMap, bucket, compOffEarnedMap, COMP_CODE } = require("./leaveBalanceController");

const escapeRx = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Active-employee filter with optional search (ID / Name / Mobile) + department
// / designation narrowing. Everything the report/manage screens filter on that
// concerns WHO the employee is lives here, so it's applied on the server.
function employeeScopeFilter(query) {
  const f = { ...ACTIVE_FILTER };
  const exactCI = (v) => new RegExp(`^${escapeRx(String(v).trim())}$`, "i");
  // A specific employee (picked from the autocomplete) scopes the whole summary
  // to that one employee — the table, drawer and CSV all narrow together.
  if (query.empId !== undefined && query.empId !== "" && !Number.isNaN(parseInt(query.empId, 10)))
    f.empId = parseInt(query.empId, 10);
  if (query.department && String(query.department).trim())
    f.empDepartment = exactCI(query.department);
  if (query.designation && String(query.designation).trim())
    f.empDesignation = exactCI(query.designation);

  const search = query.search && String(query.search).trim();
  if (search) {
    const rx = new RegExp(escapeRx(search), "i");
    const asNum = parseInt(search, 10);
    const or = [
      { empName: rx },
      // mobile is stored as a Number — match on its string form for partials
      { $expr: { $regexMatch: { input: { $toString: "$empMobileNo" }, regex: search, options: "i" } } },
    ];
    if (!Number.isNaN(asNum)) or.push({ empId: asNum });
    f.$and = [{ $or: or }];
  }
  return f;
}

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
// Every filter (search / dept / designation / year / month / date-range / type)
// is applied on the SERVER, and the per-employee summary + per-type breakdown
// are computed over the FILTERED transaction set — so the table, the details
// drawer and the CSV export all show exactly the same filtered numbers.
//
//   allocated = the year's allocation for the selected type(s)
//   taken     = days in the filtered set (respects date/month/type filters)
//   remaining = allocated - taken
const getLeaveManagement = async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();

    const [employees, activeTypes] = await Promise.all([
      employe
        .find(employeeScopeFilter(req.query), {
          empId: 1, empName: 1, empDepartment: 1, empDesignation: 1,
        })
        .lean(),
      LeaveType.find({ active: true }).sort({ sortOrder: 1, name: 1 }).lean(),
    ]);

    const empIds = employees.map((e) => e.empId);
    if (!empIds.length) {
      return res.status(200).json({
        year, types: activeTypes, data: [],
        totals: { employees: 0, allocated: 0, taken: 0, remaining: 0 },
      });
    }

    // Filtered "taken" days per (employee, type).
    const takenAgg = await LeaveTransaction.aggregate([
      { $match: { ...txnMatch(req.query, empIds), year } },
      { $group: { _id: { empId: "$empId", code: "$leaveTypeCode" }, taken: { $sum: "$days" } } },
    ]);
    const takenMap = new Map(takenAgg.map((t) => [`${t._id.empId}|${t._id.code}`, t.taken]));

    // Which type columns to include (all, or just the filtered one).
    const typeFilter = req.query.leaveTypeCode ? String(req.query.leaveTypeCode).toUpperCase() : null;
    const cols = typeFilter ? activeTypes.filter((t) => t.code === typeFilter) : activeTypes;

    const hasComp = cols.some((t) => t.code === COMP_CODE);
    const [balMap, compMap] = await Promise.all([
      getBalanceMap(year, empIds),
      hasComp ? compOffEarnedMap(year, empIds) : Promise.resolve(new Map()),
    ]);

    const data = employees
      .map((e) => {
        const typesObj = balMap.get(e.empId) || {};
        const byType = cols.map((t) => {
          // Comp Off allocated is EARNED from approved OT (derived), not stored.
          const allocated = t.code === COMP_CODE ? compMap.get(e.empId) || 0 : bucket(typesObj, t.code).allocated || 0;
          const used = takenMap.get(`${e.empId}|${t.code}`) || 0;
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

    return res.status(200).json({ year, types: activeTypes, data, totals });
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
