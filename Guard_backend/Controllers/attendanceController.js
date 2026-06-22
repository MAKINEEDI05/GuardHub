const EmpAttendance = require("../models/attendanceScheme");
const axios = require("axios");
const roster_mgmt = require("../models/rosterScheme");
const leave_mgmt = require("../models/leaveScheme");
const SecAttendanceLogs = require("../models/secMainAttendaceScheme");
const employe = require("../models/profileScheme");

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

// Format a Date's wall-clock (UTC components) as HH:mm:ss.
const fmtTime = (d) => {
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(x.getUTCHours())}:${p(x.getUTCMinutes())}:${p(x.getUTCSeconds())}`;
};

// Attendance only exists up to today; reject future dates everywhere. Keep this
// wording in sync with the frontend (GuardHub_Next utils/date.js).
const FUTURE_DATE_MESSAGE = "Attendance data is not available for future dates.";

// True when `day` (a Date at UTC midnight) is after the current UTC day.
const isFutureUtcDay = (day) => {
  const now = new Date();
  const todayMid = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  return day.getTime() > todayMid;
};

// const todayAttendanceData = async (req, res) => {
//   try {
//     const empData = await axios.get(
//       "http://210.212.210.89:9001/api/get-attendance-main-log"
//     );
//     const data = empData.data;

//     const todayDate = new Date().toISOString().split("T")[0];

//     // Filter only today's logs
//     const todayLogs = data.filter(
//       (record) => record.LogDateTime.split("T")[0] === todayDate
//     );

//     // Create a Set of unique EmployeeCodes who logged in today
//     const uniqueEmpIds = [...new Set(todayLogs.map((log) => log.EmployeeCode))];

//     // Determine today's day name (e.g., "monday")
//     const dayOfWeek = new Date()
//       .toLocaleString("en-US", { weekday: "long" })
//       .toLowerCase();

//     // Fetch all matching employees from the roster in one go
//     const rosterData = await roster_mgmt.aggregate([
//       {
//         $match: {
//           empId: { $in: uniqueEmpIds.map(String) },
//         },
//       },
//       {
//         $addFields: {
//           todayShift: { $ifNull: [`$weeklyShifts.${dayOfWeek}`, "1-General"] },
//         },
//       },
//       {
//         $project: {
//           empId: 1,
//           empName: 1,
//           todayShift: 1,
//         },
//       },
//     ]);

//     // Create a map of empId to roster info for quick lookup
//     const rosterMap = new Map();




const todayAttendanceData = async (req, res) => {
  try {
    const empData = await axios.get(
      process.env.ATTENDANCE_LOG_API ||
        "http://210.212.210.89:9001/api/get-attendance-main-log"
    );
    const data = empData.data;
    const todayDate = new Date().toISOString().split("T")[0];

    // Filter today's logs
    const todayLogs = data.filter(
      (record) => record.LogDateTime.split("T")[0] === todayDate
    );

    const uniqueEmpIds = [...new Set(todayLogs.map((log) => log.EmployeeCode))];

    const dayOfWeek = new Date()
      .toLocaleString("en-US", { weekday: "long" })
      .toLowerCase();

    // Get ALL rostered employees (not just present ones)
    const allRosters = await roster_mgmt.aggregate([
      {
        $addFields: {
          todayShift: { $ifNull: [`$weeklyShifts.${dayOfWeek}`, "1-General"] },
        },
      },
      {
        $project: {
          empId: 1,
          empName: 1,
          todayShift: 1,
        },
      },
    ]);

    const attendanceMap = new Map();
    todayLogs.forEach((log) => {
      attendanceMap.set(String(log.EmployeeCode), log);
    });

    const result = [];

    for (const roster of allRosters) {
      const empIdStr = String(roster.empId);
      const log = attendanceMap.get(empIdStr);

      if (log) {
        // Present
        const [date, time] = log.LogDateTime.split("T");
        const inTime = log.LogDateTime.split("T")[1].split(".")[0];
        const shiftResult = determineShift(inTime, roster.todayShift);

        result.push({
          empId: log.EmployeeCode,
          empName: roster.empName || "Unknown",
          empDate: date,
          empInTime: inTime,
          empShift: roster.todayShift || "NA",
          empOutTime: "NA",
          isLate: shiftResult.isLate,
          empAction: "Present",
        });
      } else {
        // Not present – check leave
        const leaveExists = await leave_mgmt.findOne({
          empId: roster.empId,
          empFromDate: { $lte: new Date(todayDate) },
          empToDate: { $gte: new Date(todayDate) },
        });

        result.push({
          empId: roster.empId,
          empName: roster.empName || "Unknown",
          empDate: todayDate,
          empInTime: "NA",
          empShift: roster.todayShift || "NA",
          empOutTime: "NA",
          empAction: leaveExists ? "Leave" : "Absent",
        });
      }
    }
    await EmpAttendance.insertMany(result);
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to get data", err });
  }
};

function determineShift(inTime, shift) {
  if (shift === "1-General") {
    return inTime >= "08:45" ? { shift, isLate: true } : { shift };
  } else if (shift === "A Shift") {
    return inTime >= "05:30" ? { shift, isLate: true } : { shift };
  } else if (shift === "B Shift") {
    return inTime >= "12:30" ? { shift, isLate: true } : { shift };
  } else if (shift === "C Shift") {
    return inTime >= "20:30" ? { shift, isLate: true } : { shift };
  } else {
    return { shift: "Unknown" };
  }
}

// Add attendance
const addAttendance = async (req, res) => {
  try {
    const {
      empId,
      empShift,
      empInTime,
      empOutTime,
      empAction,
      empDate,
      empLate,
    } = req.body;

    const todayAttendace = new EmpAttendance({
      empId,
      empShift,
      empInTime,
      empOutTime,
      empAction,
      empDate,
      empLate,
    });

    await todayAttendace.save();
    res.status(201).json({ message: "Attendance added successfully" });
  } catch (error) {
    console.error("Error adding attendance:", error);
    res.status(500).json({ message: "Error adding attendance", error });
  }
};

// Get all attendance records
// const getAllAttendance = async (req, res) => {
//   try {
//     const records = await EmpAttendance.find().sort({ date: -1 });
//     res.json(records);
//   } catch (error) {
//     res.status(500).json({ message: "Error fetching attendance", error });
//   }
// };

// Get attendance by empId
const getAttendanceByEmpId = async (req, res) => {
  try {
    const { empId } = req.params;
    const records = await EmpAttendance.find({ empId });

    if (!records || records.length === 0) {
      return res
        .status(404)
        .json({ message: "No attendance records found for this empId" });
    }

    res.status(200).json(records);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching attendance by empId", error });
  }
};
// Get attendance by date — sourced from the REAL biometric collection
// (secattendancelogs), since empattendances is empty.
// For the selected date: group logs by EmployeeCode, take first/last punch,
// join securitydetails (EmployeeCode == empId) + roster for the day's shift.
const getAttendanceByDate = async (req, res) => {
  try {
    const { empDate } = req.params; // expecting format: yyyy-mm-dd

    if (!empDate) {
      return res.status(400).json({ message: "Date is required in query" });
    }

    // UTC day boundaries so matching/formatting stay timezone-consistent.
    const startOfDay = new Date(`${empDate}T00:00:00.000Z`);
    if (Number.isNaN(startOfDay.getTime())) {
      return res
        .status(400)
        .json({ message: "Invalid date format (expected yyyy-mm-dd)" });
    }
    if (isFutureUtcDay(startOfDay)) {
      return res.status(400).json({ message: FUTURE_DATE_MESSAGE });
    }
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    // Group biometric logs by employee -> first punch (min), last punch (max).
    const grouped = await SecAttendanceLogs.aggregate([
      { $match: { LogDateTime: { $gte: startOfDay, $lt: endOfDay } } },
      {
        $group: {
          _id: "$EmployeeCode",
          firstPunch: { $min: "$LogDateTime" },
          lastPunch: { $max: "$LogDateTime" },
          punches: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    if (!grouped.length) {
      return res
        .status(200)
        .json({ message: `Attendance records for ${empDate}`, data: [] });
    }

    // Join employee + roster details (EmployeeCode is String, empId may be
    // Number, so key both maps by String).
    const [employees, rosters] = await Promise.all([
      employe.find(),
      roster_mgmt.find(),
    ]);
    const empMap = new Map(employees.map((e) => [String(e.empId), e]));
    const rosterMap = new Map(rosters.map((r) => [String(r.empId), r]));
    const weekday = WEEKDAYS[startOfDay.getUTCDay()];

    const data = grouped.map((g) => {
      const code = String(g._id);
      const emp = empMap.get(code);
      const roster = rosterMap.get(code);
      return {
        empId: code,
        empName: emp ? emp.empName : "Unknown",
        empDesignation: emp ? emp.empDesignation : "",
        empDepartment: emp ? emp.empDepartment : "",
        empInTime: fmtTime(g.firstPunch),
        empOutTime: fmtTime(g.lastPunch),
        empShift: roster && roster.weeklyShifts ? roster.weeklyShifts[weekday] || "" : "",
        empWeekOff: "",
        empAction: "Present",
        empDate,
        punches: g.punches,
      };
    });

    res.status(200).json({
      message: `Attendance records for ${empDate}`,
      data,
    });
  } catch (error) {
    console.error("Error fetching attendance by date:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// Get attendance records by shift name using aggregation
const getAttendanceByShift = async (req, res) => {
  try {
    const { empShift } = req.params;

    if (!empShift) {
      return res
        .status(400)
        .json({ message: "Shift is required in parameters" });
    }

    const records = await EmpAttendance.aggregate([
      {
        $match: {
          empShift: empShift,
        },
      },

      {
        $sort: {
          empId: 1,
        },
      },
    ]);

    // Check if records found
    if (!records || records.length === 0) {
      return res
        .status(404)
        .json({ message: `No attendance found for shift ${empShift}` });
    }

    res.status(200).json({
      message: `Attendance records for shift ${empShift}`,
      data: records,
    });
  } catch (error) {
    console.error("Error fetching attendance by shift:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error,
    });
  }
};

//get details and update
const getMonthwiseReport = async (req, res) => {
  const { empId } = req.params;
  try {
    const monthwiseData = await EmpAttendance.aggregate([
      {
        // empId is stored as String in the attendance collection, so match the
        // string form (parseInt produced a Number and matched nothing).
        $match: {
          empId: String(empId),
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$empDate" },
            month: { $month: "$empDate" },
          },
          // Normalise casing/synonyms: attendance is written as "Present"
          // (manual path) or "present" (biometric/cron path); absentees are
          // written as "Absent" or "N/A".
          present: {
            $sum: {
              $cond: [
                {
                  $eq: [
                    { $toLower: { $ifNull: ["$empAction", ""] } },
                    "present",
                  ],
                },
                1,
                0,
              ],
            },
          },
          absent: {
            $sum: {
              $cond: [
                {
                  $in: [
                    { $toLower: { $ifNull: ["$empAction", ""] } },
                    ["absent", "n/a"],
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $sort: {
          "_id.year": -1,
          "_id.month": -1,
        },
      },
    ]);

    res.status(200).json({ message: "Monthwise report", data: monthwiseData });
  } catch (error) {
    console.error("Error fetching monthwise report:", error);
    res.status(500).json({ message: "Failed to get monthwise report", error });
  }
};

// update Attendance by EmpId
const updateAttendanceByEmpId = async (req, res) => {
  try {
    const updatedAttendance = await EmpAttendance.findOneAndUpdate(
      { empId: req.params.empId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedAttendance) {
      return res
        .status(404)
        .json({ message: "Attendance record not found for given empId" });
    }
    return res.status(200).json({
      message: "Attendance record updated successfully",
      data: updatedAttendance,
    });
  } catch (error) {
    console.error("Error updating attendance:", error);
    res.status(500).json({
      message: "Failed to update attendance",
      error: error.message,
    });
  }
};

module.exports = {
  addAttendance,
  // getAllAttendance,
  getAttendanceByEmpId,
  getMonthwiseReport,
  getAttendanceByDate,
  getAttendanceByShift,
  todayAttendanceData,
  updateAttendanceByEmpId,
};