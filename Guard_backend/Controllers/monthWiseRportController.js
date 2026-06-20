const SecAttendanceLogs = require("../models/secMainAttendaceScheme");
const leave_mgmt = require("../models/leaveScheme");
const od_mgmt = require("../models/odScheme");
const roster_mgmt = require("../models/rosterScheme");

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

// 'yyyy-mm-dd' -> Date at UTC midnight (null if invalid)
const toUtcDay = (s) => {
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
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
    let start = startDate
      ? toUtcDay(startDate)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    let end = endDate
      ? toUtcDay(endDate)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

    if (!start || !end) {
      return res
        .status(400)
        .json({ error: "Invalid startDate/endDate (expected yyyy-mm-dd)" });
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

module.exports = { getMonthwiseReport };
