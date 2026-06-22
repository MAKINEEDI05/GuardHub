const SecAttendanceLogs = require("../models/secMainAttendaceScheme");
const leave_mgmt = require("../models/leaveScheme");
const od_mgmt = require("../models/odScheme");
const ot_mgmt = require("../models/otScheme");
const roster_mgmt = require("../models/rosterScheme");
const employe = require("../models/profileScheme");
const { ACTIVE_FILTER } = require("../utils/employeeRef");

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

// Attendance only exists up to today; reject future dates everywhere. Keep this
// wording in sync with the frontend (GuardHub_Next utils/date.js).
const FUTURE_DATE_MESSAGE = "Attendance data is not available for future dates.";

// 'yyyy-mm-dd' -> Date at UTC midnight (null if invalid)
const toUtcDay = (s) => {
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};
// Today at UTC midnight — the latest day attendance can exist for.
const todayUtcDay = () => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
};
const dayKey = (ms) => new Date(ms).toISOString().split("T")[0];
const normMid = (d) => {
  const x = new Date(d);
  return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
};
const isWeekOffValue = (v) => {
  const s = String(v || "").trim().toLowerCase();
  return s.includes("week") && s.includes("off");
};

// Add every yyyy-mm-dd between [from,to] clamped to [rangeStart,rangeEnd] to acc.
const addCoveredDates = (from, to, rangeStart, rangeEnd, acc) => {
  if (!from || !to) return;
  const s = Math.max(normMid(from), rangeStart.getTime());
  const e = Math.min(normMid(to), rangeEnd.getTime());
  for (let t = s; t <= e; t += DAY_MS) acc.add(dayKey(t));
};

// How many times each weekday (0=Sunday..6=Saturday) occurs in [start,end].
// Lets us count an employee's week-off days in O(7) instead of scanning the
// whole range per employee.
const weekdayCounts = (start, end) => {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    counts[new Date(t).getUTCDay()] += 1;
  }
  return counts;
};

/**
 * Month-wise attendance summary sourced from the REAL biometric collection
 * (secattendancelogs), since empattendances is empty.
 *
 *   Present Days = unique calendar dates with >=1 biometric log
 *   Leave Days   = days in range covered by leave_mgmts records
 *   OD Days      = days in range covered by od_mgmt records
 *   Week Off     = days in range whose weekday is a roster week-off
 *   Absent Days  = totalDaysInRange - present - leave - od - weekOff  (>= 0)
 *
 * Route: GET /month/monthwise-report/:empId?startDate=&endDate=
 */
const getMonthwiseReport = async (req, res) => {
  const empId = req.params.empId;
  const { startDate, endDate } = req.query;

  try {
    const now = new Date();
    const today = todayUtcDay();
    let start = startDate
      ? toUtcDay(startDate)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    // Default the end to today (not month-end) so the range never runs past the
    // last day attendance can exist for.
    let end = endDate ? toUtcDay(endDate) : today;

    if (!start || !end) {
      return res
        .status(400)
        .json({ error: "Invalid startDate/endDate (expected yyyy-mm-dd)" });
    }
    // Re-validate on the server: a future date passed via URL/state is rejected.
    if (start.getTime() > today.getTime() || end.getTime() > today.getTime()) {
      return res.status(400).json({ error: FUTURE_DATE_MESSAGE });
    }
    if (end < start) [start, end] = [end, start];

    const empIdStr = String(empId);
    const empIdNum = parseInt(empId, 10);
    const startBoundary = start; // UTC midnight of first day
    const endBoundary = new Date(end.getTime() + DAY_MS - 1); // end of last day
    const totalDays = Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;

    // --- Present: unique dates with at least one biometric log ---
    // EmployeeCode is a String in secattendancelogs.
    const presentAgg = await SecAttendanceLogs.aggregate([
      {
        $match: {
          EmployeeCode: empIdStr,
          LogDateTime: { $gte: startBoundary, $lte: endBoundary },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$LogDateTime",
              timezone: "UTC",
            },
          },
        },
      },
    ]);
    const presentDays = presentAgg.length;

    // --- Leave days (leave_mgmts; empId stored as Number) ---
    const leaveSet = new Set();
    const leaves = await leave_mgmt.find({
      empId: empIdNum,
      empFromDate: { $lte: endBoundary },
      empToDate: { $gte: startBoundary },
    });
    leaves.forEach((l) =>
      addCoveredDates(l.empFromDate, l.empToDate, start, end, leaveSet)
    );
    const leaveDays = leaveSet.size;

    // --- OD days (od_mgmt; empId stored as Number) ---
    const odSet = new Set();
    const ods = await od_mgmt.find({
      empId: empIdNum,
      empFromDate: { $lte: endBoundary },
      empToDate: { $gte: startBoundary },
    });
    ods.forEach((o) =>
      addCoveredDates(o.empFromDate, o.empToDate, start, end, odSet)
    );
    const odDays = odSet.size;

    // --- Week off (roster_mgmt; empId stored as String) ---
    let weekOffDays = 0;
    const roster = await roster_mgmt.findOne({ empId: empIdStr });
    if (roster && roster.weeklyShifts) {
      const offIdx = new Set();
      WEEKDAYS.forEach((d, i) => {
        if (isWeekOffValue(roster.weeklyShifts[d])) offIdx.add(i);
      });
      if (offIdx.size) {
        for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
          if (offIdx.has(new Date(t).getUTCDay())) weekOffDays += 1;
        }
      }
    }

    const absentDays = Math.max(
      0,
      totalDays - presentDays - leaveDays - odDays - weekOffDays
    );

    return res.status(200).json({
      message: "Monthwise report",
      summary: {
        empId: empIdStr,
        startDate: dayKey(start.getTime()),
        endDate: dayKey(end.getTime()),
        totalDays,
        presentDays,
        absentDays,
        leaveDays,
        odDays,
        weekOffDays,
      },
    });
  } catch (err) {
    console.error("Error building monthwise report:", err);
    return res
      .status(500)
      .json({ error: "Failed to get data", message: err.message });
  }
};

/**
 * All-employees month-wise attendance summary in ONE request.
 *
 * Replaces the legacy N×2 per-employee fan-out: the whole employee list is
 * summarised with a constant number of DB round-trips (1 aggregation + 4 finds)
 * regardless of headcount, so it scales to large datasets.
 *
 *   Present Days = unique calendar dates with >=1 biometric log (secattendancelogs)
 *   Leave Days   = days in range covered by leave_mgmts records
 *   OD Days      = days in range covered by od_mgmt records
 *   OT Days      = days in range covered by APPROVED ot_mgmt records
 *   Week Off     = days in range whose weekday is a roster week-off
 *   Absent Days  = totalDaysInRange - present - leave - od - weekOff  (>= 0)
 *
 * Route: GET /month/monthwise-summary?startDate=&endDate=&empId=&search=&page=&limit=
 *   - empId / search are optional filters (no employee selection required).
 *   - page & limit are optional; when omitted the full filtered list is returned.
 *   - `totals` is always computed over the FULL filtered set (so the UI summary
 *     cards stay correct even when a page slice is returned).
 *
 * NOTE on empId types (they differ by collection — a known data quirk):
 *   securitydetails.empId  -> Number      secattendancelogs.EmployeeCode -> String
 *   leave/od.empId         -> Number      ot.employeeId                  -> Number
 *   roster.empId           -> String
 */
const getMonthwiseSummary = async (req, res) => {
  const { startDate, endDate, empId, search } = req.query;
  const page = parseInt(req.query.page, 10);
  const limit = parseInt(req.query.limit, 10);

  try {
    const now = new Date();
    const today = todayUtcDay();
    let start = startDate
      ? toUtcDay(startDate)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    let end = endDate ? toUtcDay(endDate) : today;

    if (!start || !end) {
      return res
        .status(400)
        .json({ error: "Invalid startDate/endDate (expected yyyy-mm-dd)" });
    }
    if (start.getTime() > today.getTime() || end.getTime() > today.getTime()) {
      return res.status(400).json({ error: FUTURE_DATE_MESSAGE });
    }
    if (end < start) [start, end] = [end, start];

    const startBoundary = start;
    const endBoundary = new Date(end.getTime() + DAY_MS - 1);
    const totalDays = Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;

    // ---- Employee master (optional empId / search filter, applied in-query) --
    const empFilter = {};
    const empIdNum = parseInt(empId, 10);
    if (empId !== undefined && empId !== "" && !Number.isNaN(empIdNum)) {
      empFilter.empId = empIdNum;
    }
    if (search && String(search).trim()) {
      const q = String(search).trim();
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const asNum = parseInt(q, 10);
      empFilter.$or = [
        { empName: rx },
        ...(Number.isNaN(asNum) ? [] : [{ empId: asNum }]),
      ];
    }

    // Reports only ever cover active employees — deleted guards drop out of every
    // summary automatically (req 11).
    const employees = await employe.find({ ...empFilter, ...ACTIVE_FILTER }).lean();

    const zeroTotals = {
      totalEmployees: 0,
      presentDays: 0,
      absentDays: 0,
      leaveDays: 0,
      odDays: 0,
      otDays: 0,
      weekOffDays: 0,
    };

    if (!employees.length) {
      return res.status(200).json({
        message: "Monthwise summary",
        startDate: dayKey(start.getTime()),
        endDate: dayKey(end.getTime()),
        totalDays,
        total: 0,
        page: 1,
        limit: 0,
        totals: zeroTotals,
        data: [],
      });
    }

    const codeList = employees.map((e) => String(e.empId)); // String in logs/roster
    const idList = employees.map((e) => e.empId); // Number in leave/od/ot

    // ---- Present days: one aggregation (group by code+day, then by code) -----
    const presentAgg = await SecAttendanceLogs.aggregate([
      {
        $match: {
          EmployeeCode: { $in: codeList },
          LogDateTime: { $gte: startBoundary, $lte: endBoundary },
        },
      },
      {
        $group: {
          _id: {
            code: "$EmployeeCode",
            day: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$LogDateTime",
                timezone: "UTC",
              },
            },
          },
        },
      },
      { $group: { _id: "$_id.code", presentDays: { $sum: 1 } } },
    ]);
    const presentMap = new Map(
      presentAgg.map((p) => [String(p._id), p.presentDays])
    );

    // ---- Leave / OD / OT: covered-day Set per employee, one find each --------
    const buildCovered = async (Model, idField, fromField, toField, extra = {}) => {
      const map = new Map(); // empId (Number) -> Set(yyyy-mm-dd)
      const docs = await Model.find({
        [idField]: { $in: idList },
        [fromField]: { $lte: endBoundary },
        [toField]: { $gte: startBoundary },
        ...extra,
      }).lean();
      docs.forEach((d) => {
        const key = d[idField];
        if (!map.has(key)) map.set(key, new Set());
        addCoveredDates(d[fromField], d[toField], start, end, map.get(key));
      });
      return map;
    };

    const [leaveMap, odMap, otMap] = await Promise.all([
      buildCovered(leave_mgmt, "empId", "empFromDate", "empToDate"),
      buildCovered(od_mgmt, "empId", "empFromDate", "empToDate"),
      buildCovered(ot_mgmt, "employeeId", "fromDate", "toDate", {
        status: "Approved",
      }),
    ]);

    // ---- Week off: per-employee from roster, counted via weekday occurrences -
    const rosters = await roster_mgmt
      .find({ empId: { $in: codeList } })
      .lean();
    const rosterMap = new Map(rosters.map((r) => [String(r.empId), r]));
    const dowCounts = weekdayCounts(start, end);
    const weekOffFor = (code) => {
      const roster = rosterMap.get(code);
      if (!roster || !roster.weeklyShifts) return 0;
      let off = 0;
      WEEKDAYS.forEach((d, i) => {
        if (isWeekOffValue(roster.weeklyShifts[d])) off += dowCounts[i];
      });
      return off;
    };

    // ---- Assemble per-employee rows ------------------------------------------
    let rows = employees.map((e) => {
      const code = String(e.empId);
      const presentDays = presentMap.get(code) || 0;
      const leaveDays = leaveMap.get(e.empId)?.size || 0;
      const odDays = odMap.get(e.empId)?.size || 0;
      const otDays = otMap.get(e.empId)?.size || 0;
      const weekOffDays = weekOffFor(code);
      const absentDays = Math.max(
        0,
        totalDays - presentDays - leaveDays - odDays - weekOffDays
      );
      return {
        empId: e.empId,
        empName: e.empName || "Unknown",
        empDesignation: e.empDesignation || "",
        empDepartment: e.empDepartment || "",
        empImage: e.empImage || "",
        presentDays,
        absentDays,
        leaveDays,
        odDays,
        otDays,
        weekOffDays,
        totalDays,
      };
    });

    rows.sort((a, b) => Number(a.empId) - Number(b.empId));

    // Totals over the FULL filtered set — drives the UI summary cards.
    const totals = rows.reduce(
      (acc, r) => {
        acc.totalEmployees += 1;
        acc.presentDays += r.presentDays;
        acc.absentDays += r.absentDays;
        acc.leaveDays += r.leaveDays;
        acc.odDays += r.odDays;
        acc.otDays += r.otDays;
        acc.weekOffDays += r.weekOffDays;
        return acc;
      },
      { ...zeroTotals }
    );

    const total = rows.length;
    let pageOut = 1;
    let limitOut = total;
    if (Number.isInteger(page) && Number.isInteger(limit) && page > 0 && limit > 0) {
      pageOut = page;
      limitOut = limit;
      rows = rows.slice((page - 1) * limit, page * limit);
    }

    return res.status(200).json({
      message: "Monthwise summary",
      startDate: dayKey(start.getTime()),
      endDate: dayKey(end.getTime()),
      totalDays,
      total,
      page: pageOut,
      limit: limitOut,
      totals,
      data: rows,
    });
  } catch (err) {
    console.error("Error building monthwise summary:", err);
    return res
      .status(500)
      .json({ error: "Failed to get data", message: err.message });
  }
};

module.exports = { getMonthwiseReport, getMonthwiseSummary };
