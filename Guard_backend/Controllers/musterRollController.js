const employe = require("../models/profileScheme");
const roster_mgmt = require("../models/rosterScheme");
const { employeeScopeFilter } = require("../utils/employeeQuery");
const { buildMonthlyGrid } = require("../services/attendanceSummaryService");

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// GET /attendance/muster-roll?year&month&department&designation&shift&search
// Attendance Muster Roll: one row per employee, one cell per day of the month,
// plus the monthly summary. Filtering is server-side; the heavy lifting (the
// per-day status grid) is done by the shared attendanceSummaryService — the same
// engine the Salary module will consume.
const getMusterRoll = async (req, res) => {
  try {
    const now = new Date();
    const year = parseInt(req.query.year, 10) || now.getUTCFullYear();
    const month = parseInt(req.query.month, 10) || now.getUTCMonth() + 1;
    if (month < 1 || month > 12) {
      return res.status(400).json({ message: "month must be 1-12" });
    }

    // WHO: active employees matching dept / designation / search / empId.
    let employees = await employe
      .find(employeeScopeFilter(req.query), {
        empId: 1, empName: 1, empDepartment: 1, empDesignation: 1,
      })
      .lean();

    // Shift filter (roster-based): keep employees rostered to that shift on any
    // weekday. One roster query — not per employee.
    const shift = req.query.shift && String(req.query.shift).trim();
    if (shift) {
      const rosters = await roster_mgmt
        .find({ $or: WEEKDAYS.map((d) => ({ [`weeklyShifts.${d}`]: shift })) }, { empId: 1 })
        .lean();
      const shiftIds = new Set(rosters.map((r) => String(r.empId)));
      employees = employees.filter((e) => shiftIds.has(String(e.empId)));
    }

    employees.sort((a, b) => a.empId - b.empId);

    const list = employees.map((e) => ({ empId: e.empId, code: String(e.empId) }));
    const { dim, byEmp } = list.length
      ? await buildMonthlyGrid(year, month, list)
      : { dim: new Date(Date.UTC(year, month, 0)).getUTCDate(), byEmp: new Map() };

    const data = employees.map((e, i) => {
      const g = byEmp.get(e.empId) || { days: {}, summary: {} };
      return {
        sno: i + 1,
        empId: e.empId,
        empName: e.empName || `ID ${e.empId}`,
        empDepartment: e.empDepartment || "",
        empDesignation: e.empDesignation || "",
        days: g.days,
        summary: g.summary,
      };
    });

    return res.status(200).json({
      message: "Attendance muster roll",
      year,
      month,
      monthName: MONTH_NAMES[month - 1],
      dim,
      dayColumns: Array.from({ length: dim }, (_, i) => i + 1),
      filters: {
        department: req.query.department || "",
        designation: req.query.designation || "",
        shift: shift || "",
        search: req.query.search || "",
      },
      total: data.length,
      data,
    });
  } catch (error) {
    console.error("Error building muster roll:", error);
    return res.status(500).json({ message: "Failed to build muster roll", error: error.message });
  }
};

module.exports = { getMusterRoll };
