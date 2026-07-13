// Shared Attendance engine.
//
// The single source of truth for turning the raw attendance signals into a
// per-day status grid + monthly summary. It reuses the SAME data sources the
// Month-Wise report uses:
//   Present  -> biometric secattendancelogs (>=1 punch that day)
//   Leave    -> leave_transactions (carries the leave-type code; kept in lock-
//               step with the legacy leave_mgmts the Month-Wise report reads)
//   OD       -> od_mgmt
//   OT       -> APPROVED ot_mgmt
//   Week Off -> roster_mgmt weekly week-off weekdays
//
// The Attendance Muster Roll report and the (future) Salary module both consume
// this — there is no separate attendance calculation anywhere else.
//
// Efficiency: a fixed, small number of queries regardless of headcount
// (1 aggregation + 4 finds) — never one query per employee.

const SecAttendanceLogs = require("../models/secMainAttendaceScheme");
const LeaveTransaction = require("../models/leaveTransactionScheme");
const od_mgmt = require("../models/odScheme");
const ot_mgmt = require("../models/otScheme");
const roster_mgmt = require("../models/rosterScheme");

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const daysInMonth = (year, month /* 1-12 */) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const isWeekOffValue = (v) => {
  const s = String(v || "").trim().toLowerCase();
  return s.includes("week") && s.includes("off");
};
const todayUtcMid = () => {
  const n = new Date();
  return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
};

// Day-of-month numbers a [from,to] record covers WITHIN the given month.
function coveredDayNums(from, to, year, month, dim) {
  const out = [];
  if (!from || !to) return out;
  const f = new Date(from);
  const t = new Date(to);
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return out;
  const monthStart = Date.UTC(year, month - 1, 1);
  const monthEnd = Date.UTC(year, month - 1, dim);
  let cur = Math.max(Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate()), monthStart);
  const end = Math.min(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()), monthEnd);
  for (let x = cur; x <= end; x += DAY_MS) out.push(new Date(x).getUTCDate());
  return out;
}

/**
 * Build the muster-roll grid + summary for a set of employees in one month.
 *
 * @param {number} year
 * @param {number} month  1-12
 * @param {Array<{empId:number, code:string}>} employees  code = String(empId)
 * @returns {{ dim:number, byEmp: Map<number, { days: Object, summary: Object }> }}
 *
 * cell value examples: "P", "A", "CL", "WO", "P/OT", "CL/OT", "OD/OT", ""(future)
 */
async function buildMonthlyGrid(year, month, employees) {
  const dim = daysInMonth(year, month);
  const idList = employees.map((e) => e.empId); // Number keys (leave/od/ot)
  const codeList = employees.map((e) => e.code); // String keys (logs/roster)

  const startBoundary = new Date(Date.UTC(year, month - 1, 1));
  const endBoundary = new Date(Date.UTC(year, month - 1, dim) + DAY_MS - 1);
  const today = todayUtcMid();

  const [presentAgg, leaves, ods, ots, rosters] = await Promise.all([
    // Present: unique day-of-month per employee code (>=1 biometric punch).
    SecAttendanceLogs.aggregate([
      { $match: { EmployeeCode: { $in: codeList }, LogDateTime: { $gte: startBoundary, $lte: endBoundary } } },
      { $group: { _id: { code: "$EmployeeCode", day: { $dayOfMonth: { date: "$LogDateTime", timezone: "UTC" } } } } },
      { $group: { _id: "$_id.code", days: { $addToSet: "$_id.day" } } },
    ]),
    LeaveTransaction.find({
      empId: { $in: idList },
      fromDate: { $lte: endBoundary },
      toDate: { $gte: startBoundary },
    }).lean(),
    od_mgmt.find({
      empId: { $in: idList },
      empFromDate: { $lte: endBoundary },
      empToDate: { $gte: startBoundary },
    }).lean(),
    ot_mgmt.find({
      employeeId: { $in: idList },
      status: "Approved",
      fromDate: { $lte: endBoundary },
      toDate: { $gte: startBoundary },
    }).lean(),
    roster_mgmt.find({ empId: { $in: codeList } }, { empId: 1, weeklyShifts: 1 }).lean(),
  ]);

  // ---- Lookup maps (all O(records), no per-employee queries) ----
  const presentByCode = new Map(presentAgg.map((p) => [String(p._id), new Set(p.days)]));

  const leaveByEmp = new Map(); // empId -> Map(day -> code)
  for (const l of leaves) {
    if (!leaveByEmp.has(l.empId)) leaveByEmp.set(l.empId, new Map());
    const m = leaveByEmp.get(l.empId);
    for (const d of coveredDayNums(l.fromDate, l.toDate, year, month, dim)) {
      m.set(d, String(l.leaveTypeCode || "L").toUpperCase());
    }
  }

  const odByEmp = new Map(); // empId -> Set(day)
  for (const o of ods) {
    if (!odByEmp.has(o.empId)) odByEmp.set(o.empId, new Set());
    const s = odByEmp.get(o.empId);
    for (const d of coveredDayNums(o.empFromDate, o.empToDate, year, month, dim)) s.add(d);
  }

  const otByEmp = new Map(); // empId -> Set(day)
  for (const o of ots) {
    if (!otByEmp.has(o.employeeId)) otByEmp.set(o.employeeId, new Set());
    const s = otByEmp.get(o.employeeId);
    for (const d of coveredDayNums(o.fromDate, o.toDate, year, month, dim)) s.add(d);
  }

  const weekOffByCode = new Map(); // code -> Set(weekdayIdx 0..6)
  for (const r of rosters) {
    const off = new Set();
    WEEKDAYS.forEach((wd, i) => {
      if (r.weeklyShifts && isWeekOffValue(r.weeklyShifts[wd])) off.add(i);
    });
    if (off.size) weekOffByCode.set(String(r.empId), off);
  }

  // ---- Assemble per-employee grid + summary ----
  const byEmp = new Map();
  for (const e of employees) {
    const presentDays = presentByCode.get(e.code) || new Set();
    const leaveDays = leaveByEmp.get(e.empId) || new Map();
    const odDays = odByEmp.get(e.empId) || new Set();
    const otDays = otByEmp.get(e.empId) || new Set();
    const weekOffIdx = weekOffByCode.get(e.code) || new Set();

    const days = {};
    const summary = { present: 0, absent: 0, leave: 0, od: 0, ot: 0, weekOff: 0, holiday: 0 };

    for (let d = 1; d <= dim; d++) {
      const dateMid = Date.UTC(year, month - 1, d);
      const weekday = new Date(dateMid).getUTCDay();
      const isFuture = dateMid > today;

      const statuses = [];
      const present = presentDays.has(d);
      const leaveCode = leaveDays.get(d);
      const od = odDays.has(d);
      const ot = otDays.has(d);
      const wo = weekOffIdx.has(weekday);

      if (present) statuses.push("P");
      if (leaveCode) statuses.push(leaveCode);
      if (od) statuses.push("OD");
      if (ot) statuses.push("OT");

      if (statuses.length === 0) {
        if (wo) statuses.push("WO");
        else if (!isFuture) statuses.push("A");
        // future day with nothing -> blank
      }

      days[d] = statuses.join("/");

      // Tally (a combined day counts toward each of its components)
      if (present) summary.present += 1;
      if (leaveCode) summary.leave += 1;
      if (od) summary.od += 1;
      if (ot) summary.ot += 1;
      if (statuses.length === 1 && statuses[0] === "WO") summary.weekOff += 1;
      if (statuses.length === 1 && statuses[0] === "A") summary.absent += 1;
    }

    // Working Days = expected working days (month minus week-offs/holidays).
    // Net Payable Days = every accounted, non-absent day that counts for pay
    // (present + leave + OD + week-off + holiday). OT is extra (earns comp-off),
    // not a base payable day. The Salary module can refine these on top of the
    // same grid without recomputing attendance.
    summary.workingDays = dim - summary.weekOff - summary.holiday;
    summary.netPayable =
      summary.present + summary.leave + summary.od + summary.weekOff + summary.holiday;

    byEmp.set(e.empId, { days, summary });
  }

  return { dim, byEmp };
}

module.exports = { buildMonthlyGrid, daysInMonth };
