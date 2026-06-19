const EmpAttendance = require("../models/attendanceScheme");
const leave_mgmt = require("../models/leaveScheme");
const od_mgmt = require("../models/odScheme");

// Build a match stage for a single employee, optionally constrained to a date
// range on the given date field.
const buildMatch = (empId, dateField, startDate, endDate) => {
  const match = { empId };
  if (startDate || endDate) {
    match[dateField] = {};
    if (startDate) match[dateField].$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      match[dateField].$lte = end;
    }
  }
  return match;
};

// Aggregate attendance / leave / OD counts grouped by {year, month} for one
// employee. Returns the exact shape the frontend already consumes:
//   combinedReport.attendance = [{ _id:{year,month}, present, absent }]
//   combinedReport.leaves     = [{ _id:{year,month}, totalLeaves }]
//   combinedReport.ods        = [{ _id:{year,month}, totalOds }]
const getMonthwiseReport = async (req, res) => {
  const empId = req.params.empId;
  const { startDate, endDate } = req.query;

  try {
    // empId is stored as String in attendance but as Number in leave/od.
    const empIdNum = parseInt(empId, 10);

    const [attendance, leaves, ods] = await Promise.all([
      EmpAttendance.aggregate([
        { $match: buildMatch(String(empId), "empDate", startDate, endDate) },
        {
          $group: {
            _id: { year: { $year: "$empDate" }, month: { $month: "$empDate" } },
            // Normalise casing/synonyms: "Present"/"present" => present;
            // "Absent"/"N/A" => absent (the biometric/cron path writes the
            // lowercase / "N/A" variants).
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
        { $sort: { "_id.year": -1, "_id.month": -1 } },
      ]),
      leave_mgmt.aggregate([
        { $match: buildMatch(empIdNum, "empFromDate", startDate, endDate) },
        {
          $group: {
            _id: {
              year: { $year: "$empFromDate" },
              month: { $month: "$empFromDate" },
            },
            totalLeaves: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": -1, "_id.month": -1 } },
      ]),
      od_mgmt.aggregate([
        { $match: buildMatch(empIdNum, "empFromDate", startDate, endDate) },
        {
          $group: {
            _id: {
              year: { $year: "$empFromDate" },
              month: { $month: "$empFromDate" },
            },
            totalOds: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": -1, "_id.month": -1 } },
      ]),
    ]);

    const combinedReport = { attendance, leaves, ods };
    res.status(200).json({ message: "Monthwise report", combinedReport });
  } catch (err) {
    console.error("Error building monthwise report:", err);
    res.status(500).json({ error: "Failed to get data", message: err.message });
  }
};

module.exports = { getMonthwiseReport };
