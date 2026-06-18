// const CoutAdding = async (attendanceLogs) => {
//   const today = new Date("2025-05-18");
//   const yesterday = new Date(today);
//   yesterday.setDate(yesterday.getDate() - 1);

//   const targetDate = moment(yesterday).startOf('day').toDate();

//   const cShiftInData = await EmpAttendance.find({
//     empDate: targetDate,
//     empShift: "C Shift"
//   }).lean();

//   console.log("ShiftC Data : ", cShiftInData);

//   const attendanceOutMap = new Map();
//   attendanceLogs.forEach(log => {
//     if (log.EmployeeCode) {
//       attendanceOutMap.set(log.EmployeeCode.toString(), log);
//     }
//   });
//   console.log("attendancelogss : ", attendanceOutMap);
//   const updates = cShiftInData
//     .filter(att => attendanceOutMap.has(att.empId))
//     .map(att => {
//       const logMatch = attendanceOutMap.get(att.empId);
//       const outTime = new Date(logMatch.LogDateTime).toTimeString().split(' ')[0];
//       console.log("outTime : ", outTime);
//       console.log(typeof att.empId, typeof logMatch.EmployeeCode); // Should both be strings
//       // console.log("empDate type:", typeof att.empDate, att.empDate instanceof Date);
//       const startOfDay = new Date(att.empDate);
//       startOfDay.setHours(0, 0, 0, 0);

//       const endOfDay = new Date(att.empDate);
//       endOfDay.setHours(23, 59, 59, 999);
//       return {
//         updateOne: {
//           filter: {
//             empId: att.empId,
//             empDate: targetDate
//           },
//           update: { $set: { empOutTime: outTime } }
//         }
//       };
//     });

//   console.log("Prepared updates:", JSON.stringify(updates, null, 2));


//   // if (updates.length === 0) {
//   //   console.log("No matching records to update");
//   //   console.log("cShiftInData length:", cShiftInData.length);
//   //   console.log("attendanceOutMap keys:", Array.from(attendanceOutMap.keys()));
//   // }

//   if (updates.length > 0) {
//     console.log(updates[0]);
//     return await EmpAttendance.bulkWrite(updates, { ordered: false });
//   }
//   console.log("updateddd");

//   return { acknowledged: true, modifiedCount: 0 };
// };

const getAttendanceMainLog = async (fromTime, toTime, shifts) => {
  console.log(fromTime, toTime);
  try {
    await client.connect();
    console.log("Connected to the database");
    const database = client.db("technicalhub");
    const collection = database.collection("attendancelogs");

    // const mydata = await collection.aggregate([
    //     {
    //       $match: {
    //         "after.Serialnumber": "0426141300425"
    //       }
    //     },
    //     {
    //       $replaceRoot: {
    //         newRoot: "$after"
    //       }
    //     }
    //   ]).toArray();
    // console.log(mydata);
    // await SecAttLog.insertMany(mydata)
    // const { startDateTime, endDateTime } = getStartEndTimestamps("06:00", "08:30");

    // const date = "2025-04-15";
    // const fromTime = "06:00AM";
    // const toTime = "08:30AM";
    const today = new Date();
    const todayDate = today.toISOString().split('T')[0];
    const startTime = buildDateTime(todayDate, fromTime);
    const endTime = buildDateTime(todayDate, toTime);
    console.log("date", todayDate);
    console.log("Start Time:", startTime);
    console.log("End Time:", endTime);

    // const mydata = await collection.aggregate([
    //   {
    //     $match: {
    //       "after.Serialnumber": "0426141300425",
    //     },
    //   },
    //   {
    //     $addFields: {
    //       logDate: {
    //         $toDate: { $toLong: "$after.LogDateTime" },
    //       },
    //     },
    //   },
    //   {
    //     $match: {
    //       logDate: {
    //         $gte: startTime,
    //         $lte: endTime,
    //       },
    //     },
    //   },
    //   {
    //     $project: {
    //       _id: 0,
    //       EmployeeCode: "$after.EmployeeCode",
    //       LogDateTime: "$logDate",
    //       // timestamp: "$after.timestamp"
    //     },
    //   },
    // ])
    //   .toArray();
    // console.log("Data fetched successfully");

    // console.log(mydata);
    // await SecLogSchema.insertMany(mydata);


    // Shift Adding

    const mydata = await SecLogSchema.aggregate([
      {
        $match: {
          $expr: {
            $and: [
              {
                // Match the date only
                $eq: [
                  { $dateToString: { format: "%Y-%m-%d", date: "$LogDateTime" } },
                  "2025-05-02"
                ]
              },
              {
                // Extract the time in HH:mm format
                $gte: [
                  { $dateToString: { format: "%H:%M", date: "$LogDateTime" } },
                  "08:00"
                ]
              },
              {
                $lte: [
                  { $dateToString: { format: "%H:%M", date: "$LogDateTime" } },
                  "09:30"
                ]
              }
            ]
          }
        }
      }
    ])
    const uniqueAttendanceLoags = Array.from(
      new Map(mydata.map(emp => [emp.EmployeeCode, emp])).values()
    );
    console.log(uniqueAttendanceLoags);

    const dayOfWeek = new Date()
      .toLocaleString("en-US", { weekday: "long" })
      .toLowerCase();

    if (fromTime === "8:00") {

      const allRosters = await roster_mgmt.aggregate([
        {
          $match: {
            [`weeklyShifts.${weekday}`]: "General"
          }
        },
        {
          $addFields: {
            todayShift: `$weeklyShifts.${weekday}`
          }
        },
        {
          $project: {
            _id: 0,
            empId: 1,
            empName: 1,
            todayShift: 1
          }
        }
      ]);

      AddingShiftsAndTimingsForGenerals(todayDate, allRosters, uniqueAttendanceLoags);

    }

    // const attendanceMap = new Map();
    // uniqueAttendanceLoags.forEach((log) => {
    //   attendanceMap.set(String(log.EmployeeCode), log);
    // });

    // const getInShiftData = async (timeFrom, timeTO, empId, todayDate) => {
    //   try {
    //     const startTime = timeFrom;
    //     const endTime = timeTO;

    //     const dt = await EmpAttendance.aggregate([
    //       {
    //         $match: {
    //           empId: empId,
    //           empInTime: { $gte: startTime, $lte: endTime },
    //         },
    //       },
    //       {
    //         $addFields: {
    //           empDateStr: {
    //             $dateToString: { format: "%Y-%m-%d", date: "$empDate" },
    //           },
    //         },
    //       },
    //       {
    //         $match: {
    //           empDateStr: todayDate,
    //         },
    //       },
    //     ]);

    //     console.log(dt);
    //   } catch (err) {
    //     console.error("Error fetching attendance:", err);
    //   }
    // };

    // console.log("getting");
    // console.log(getInShiftData("15:00:00", "15:30:00", 5798, "2025-05-03"));


    // const result = [];
    // let timeIn;
    // let timeOut;
    // let lateIs;
    // for (const roster of allRosters) {
    //   const empIdStr = String(roster.empId);
    //   console.log("employeee idd:  ", empIdStr);
    //   const log = uniqueAttendanceLoags.find(log => log.EmployeeCode === empIdStr);
    //   console.log("loggggggggggg");
    //   console.log(log);
    //   if (log) {
    //     // Present
    //     // const [date, time] = log.LogDateTime.split("T");
    //     const inTime = log.LogDateTime.toISOString().split("T")[1].split(".")[0];
    //     const shiftResult = determineShift(inTime, roster.todayShift);

    //     if (fromTime === "8:00") {
    //       timeIn = inTime;
    //       timeOut = "NA";
    //       lateIs = shiftResult;
    //       result.push({
    //         empId: roster.empId,
    //         empName: roster.empName || "Unknown",
    //         empDate: todayDate,
    //         empShift: roster.todayShift || "NA",
    //         empInTime: timeIn,
    //         empOutTime: "NA",
    //         empAction: "present",
    //       });
    //     } else if (fromTime === "17:30") {
    //       let shiftsData = await getInShiftData("17:30:00", "18:30:00", empIdStr, "2025-05-06");
    //       console.log(shiftsData);
    //       shiftsData[0].empOutTime = inTime;
    //       let gaurd_id = shiftsData[0]._id;
    //       console.log("gud_idd :", gaurd_id);
    //       try {
    //         await EmpAttendance.findByIdAndUpdate(gaurd_id, { $set: shiftsData[0] });
    //         console.log("out time updated successfully...")
    //       } catch (er) {
    //         console.log({ error: er.message });
    //       }
    //       console.log(shiftsData);
    //       timeOut = inTime;
    //       lateIs = shiftResult;
    //     } else if (fromTime === "05:00") {
    //       timeIn = inTime;
    //       timeOut = "NA";
    //       lateIs = shiftResult;
    //     } else if (fromTime === "12:10") {
    //       timeIn = inTime;
    //       timeOut = "NA";
    //       lateIs = shiftResult;
    //     } else {
    //       timeIn = inTime;
    //       timeOut = "NA";
    //       lateIs = shiftResult;
    //     }
    //     // result.push({
    //     //   empId: log.EmployeeCode,
    //     //   empName: roster.empName || "Unknown",
    //     //   empDate: date,
    //     //   empInTime: inTime,
    //     //   empShift: roster.todayShift || "NA",
    //     //   empOutTime: "NA",
    //     //   isLate: shiftResult.isLate,
    //     //   empAction: "Present",
    //     // });
    //   } else {
    //     // Not present – check leave
    //     const leaveExists = await leave_mgmt.findOne({
    //       empId: roster.empId,
    //       empFromDate: { $lte: new Date(todayDate) },
    //       empToDate: { $gte: new Date(todayDate) },
    //     });

    //     result.push({
    //       empId: roster.empId,
    //       empName: roster.empName || "Unknown",
    //       empDate: todayDate,
    //       empInTime: "NA",
    //       empShift: roster.todayShift || "NA",
    //       empOutTime: "NA",
    //       empAction: leaveExists ? "Leave" : "Absent",
    //     });
    //   }

    // }
    // await EmpAttendance.insertMany(result);

    console.log("Data inserted successfully");
    // return res.status(200).json("Data inserted");
  } catch (error) {
    console.error("Error connecting to the database:", error);
  } finally {
    await client.close();
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

//checking
// cron.schedule(
//   "0 45 20 * * *",
//   () => getAttendanceMainLog("12:10", "13:50", "abcShifts"),
//   {
//     timezone: "Asia/Kolkata",
//   }
// );

// const myfun = async() => {
//   const mydata = await SecLogSchema.aggregate([
//     {
//       $match: {
//         $expr: {
//           $and: [
//             {
//               // Match the date only
//               $eq: [
//                 { $dateToString: { format: "%Y-%m-%d", date: "$LogDateTime" } },
//                 "2025-05-02"
//               ]
//             },
//             {
//               // Extract the time in HH:mm format
//               $gte: [
//                 { $dateToString: { format: "%H:%M", date: "$LogDateTime" } },
//                 "05:00"
//               ]
//             },
//             {
//               $lte: [
//                 { $dateToString: { format: "%H:%M", date: "$LogDateTime" } },
//                 "06:50"
//               ]
//             }
//           ]
//         }
//       }
//     }
//   ])
//   console.log(mydata);
// }

// console.log("hello")
// setTimeout(() => {
// console.log("heyyyyyyyyyy")
//   myfun();
// }, 4000);


// const getInShiftData = async (timeFrom, timeTO, empId, todayDate) => {
//   try {
//     const startTime = timeFrom;
//     const endTime = timeTO;

//     const dt = await EmpAttendance.aggregate([
//       {
//         $match: {
//           empId: empId,
//           empInTime: { $gte: startTime, $lte: endTime },
//         },
//       },
//       {
//         $addFields: {
//           empDateStr: {
//             $dateToString: { format: "%Y-%m-%d", date: "$empDate" },
//           },
//         },
//       },
//       {
//         $match: {
//           empDateStr: todayDate,
//         },
//       },
//     ]);

//     console.log(dt);
//   } catch (err) {
//     console.error("Error fetching attendance:", err);
//   }
// };
// getInShiftData("17:30:00", "18:30:00", '5433', "2025-05-06");

setTimeout(() => {
}, 4000);



const cron = require("node-cron");
const axios = require("axios");
const SecLogSchema = require("../models/secMainAttendaceScheme");
const EmpAttendance = require("../models/attendanceScheme");
const roster_mgmt = require("../models/rosterScheme");
const leave_mgmt = require("../models/leaveScheme");
const moment = require("moment");
require("dotenv").config();

const { MongoClient } = require("mongodb");
// const { totalmem } = require("os");

const MDB_URl1 = process.env.MONGO_URI1;
console.log("MDB_URl1 : ", MDB_URl1);
const client = new MongoClient(MDB_URl1);


function buildDateTime(dateStr, timeStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hoursStr, minutesStr] = timeStr.split(":").map(Number);

  // Construct the UTC date (Z suffix implies UTC)
  return new Date(Date.UTC(year, month - 1, day, hoursStr, minutesStr));
}

// GENERAL SHIF IN AND OUT LOGIC
const AddingShiftsAndTimingsForGenerals = async (shiftType, attendanceData) => {
  const today = new Date("2025-05-02");
  const targetDate = moment(today).startOf("day");
  console.log("attendancelogs : ", attendanceData);

  // Get day of week for roster matching
  const dayOfWeek = today
    .toLocaleString("en-US", { weekday: "long" })
    .toLowerCase();

  if (shiftType === "generalIn") {
    // OPTIMIZATION 1: Run both queries concurrently with Promise.all
    const [allRosters, leavesData] = await Promise.all([
      // Get all employees with "General" shift today
      roster_mgmt.aggregate([
        {
          $match: { [`weeklyShifts.${dayOfWeek}`]: "General" },
        },
        {
          $addFields: { todayShift: `$weeklyShifts.${dayOfWeek}` },
        },
        {
          $project: {
            _id: 0,
            empId: 1,
            empName: 1,
            todayShift: 1,
          },
        },
      ]),

      // Get all active leaves for today
      leave_mgmt.aggregate([
        {
          $match: {
            empFromDate: { $lte: today },
            empToDate: { $gte: today },
          },
        },
      ]),
    ]);

    // OPTIMIZATION 2: Create lookup maps for faster access
    const empAttendanceMap = new Map();
    attendanceData.forEach((record) => {
      const empId = record.EmployeeCode;
      if (!empAttendanceMap.has(empId)) {
        empAttendanceMap.set(empId, []);
      }
      empAttendanceMap.get(empId).push(record);
    });

    // Create a map for leaves data
    const leavesMap = new Map();
    leavesData.forEach((leave) => {
      leavesMap.set(leave.empId.toString(), leave);
    });

    // OPTIMIZATION 3: Create all records in a single pass
    const result = allRosters.map((employee) => {
      const empIdStr = employee.empId.toString();
      const attendanceRecords = empAttendanceMap.get(empIdStr) || [];

      // Sort if we have attendance records
      let empInTime = "";
      let empAction = "";

      if (attendanceRecords.length > 0) {
        // Sort by date
        attendanceRecords.sort(
          (a, b) => new Date(a.LogDateTime) - new Date(b.LogDateTime)
        );
        empInTime = moment(attendanceRecords[0].LogDateTime).format("HH:mm:ss");
        empAction = "present";
      } else {
        // Check if employee is on leave
        const isOnLeave =
          leavesMap.has(empIdStr) &&
          moment(targetDate).isBetween(
            moment(leavesMap.get(empIdStr).empFromDate).startOf("day"),
            moment(leavesMap.get(empIdStr).empToDate).endOf("day"),
            null,
            "[]"
          );

        empAction = isOnLeave ? "On Leave" : "N/A";
      }

      return {
        empId: parseInt(employee.empId),
        empShift: employee.todayShift,
        empInTime,
        empOutTime: "",
        empAction,
        empDate: today, // OPTIMIZATION 4: Use date object directly
      };
    });

    console.log("result : ", result);
    // OPTIMIZATION 5: Use insertMany with ordered: false for better performance
    return await EmpAttendance.insertMany(result, { ordered: false });
  } else {
    // OPTIMIZATION 6: Simplify the general out processing
    const nowDate = new Date("2025-05-02");

    // Get all general attendance records for today
    const generalInData = await EmpAttendance.find({
      empDate: nowDate,
      empShift: "General",
      empInTime: {
        $gte: "08:00:00",
        $lte: "09:30:00",
      },
    }).lean();

    // console.log("generalInData : ", generalInData);

    // OPTIMIZATION 7: Create a map for faster attendance lookup
    const attendanceOutMap = new Map();
    attendanceData.forEach((log) => {
      attendanceOutMap.set(log.EmployeeCode, log);
    });

    // OPTIMIZATION 8: Prepare bulk operations in one pass
    const updates = generalInData
      .filter((att) => attendanceOutMap.has(att.empId.toString()))
      .map((att) => {
        const logMatch = attendanceOutMap.get(att.empId.toString());
        const outTime = new Date(logMatch.LogDateTime)
          .toTimeString()
          .split(" ")[0];

        return {
          updateOne: {
            filter: { empId: att.empId, empDate: att.empDate },
            update: { $set: { empOutTime: outTime } },
          },
        };
      });

    console.log("updates : ", updates);
    // Only perform bulk write if we have updates
    if (updates.length > 0) {
      return await EmpAttendance.bulkWrite(updates, { ordered: false });
    }

    return { acknowledged: true, modifiedCount: 0 };
  }
};

// C OUT ADDING
const CoutAdding = async (attendanceLogs) => {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Using moment to get start of day for yesterday
    const targetDate = moment(yesterday).startOf("day").toDate();

    // Find all C Shift employees who clocked in yesterday
    const cShiftInData = await EmpAttendance.find({
      empDate: targetDate,
      empShift: "C Shift",
      empInTime: {
        $gte: "20:10:00",
        $lte: "21:50:00",
      },
    }).lean();

    console.log("ShiftC Data found:", cShiftInData.length);

    // Create a map of employee codes to their log data for quick lookup
    const attendanceOutMap = new Map();
    attendanceLogs.forEach((log) => {
      if (log.EmployeeCode) {
        attendanceOutMap.set(log.EmployeeCode.toString(), log);
      }
    });

    console.log(
      "Attendance logs map created with",
      attendanceOutMap.size,
      "entries"
    );

    // Alternative approach: Update one document at a time
    const updatePromises = cShiftInData
      .filter((att) => attendanceOutMap.has(att.empId))
      .map(async (att) => {
        const logMatch = attendanceOutMap.get(att.empId);
        const outTime = new Date(logMatch.LogDateTime)
          .toTimeString()
          .split(" ")[0];

        // console.log(`Updating document for empId: ${att.empId}, setting outTime to: ${outTime}`);

        // Direct update without using bulkWrite
        return EmpAttendance.findByIdAndUpdate(
          att._id,
          { $set: { empOutTime: outTime } },
          { new: true }
        );
      });

    // Execute all updates and collect results
    const results = await Promise.all(updatePromises);
    console.log(`Updated ${results.filter((r) => r).length} documents`);

    return {
      acknowledged: true,
      modifiedCount: results.filter((r) => r).length,
      results: results,
    };
  } catch (error) {
    console.error("Error in CoutAdding:", error);
    throw error;
  }
};

// A, B, SHIFTS OUT ADDING (attendanceLogs, fromTime, toTime, "B Shift", "A Shift")
const OutShiftAdding = async (
  attendanceLogs,
  fromTime,
  toTime,
  inShift,
  outShift
) => {
  try {
    const today = new Date();
    // Using moment to get start of day for yesterday
    const targetDate = moment(today).startOf("day").toDate();

    // Find all C Shift employees who clocked in yesterday
    const cShiftInData = await EmpAttendance.find({
      empDate: targetDate,
      empShift: outShift,
      empInTime: {
        $gte: fromTime,
        $lte: toTime,
      },
    }).lean();

    console.log("Shift Data found:", cShiftInData.length);

    // Create a map of employee codes to their log data for quick lookup
    const attendanceOutMap = new Map();
    attendanceLogs.forEach((log) => {
      if (log.EmployeeCode) {
        attendanceOutMap.set(log.EmployeeCode.toString(), log);
      }
    });

    console.log(
      "Attendance logs map created with",
      attendanceOutMap.size,
      "entries"
    );

    // Alternative approach: Update one document at a time
    const updatePromises = cShiftInData
      .filter((att) => attendanceOutMap.has(att.empId))
      .map(async (att) => {
        const logMatch = attendanceOutMap.get(att.empId);
        console.log("logmatch : ", logMatch);
        const outTime = new Date(logMatch.LogDateTime)
          .toTimeString()
          .split(" ")[0];
        console.log(outTime);
        // console.log(`Updating document for empId: ${att.empId}, setting outTime to: ${outTime}`);

        // Direct update without using bulkWrite
        return EmpAttendance.findByIdAndUpdate(
          att._id,
          { $set: { empOutTime: outTime } },
          { new: true }
        );
      });

    // Execute all updates and collect results
    const results = await Promise.all(updatePromises);
    console.log(`Updated ${results.filter((r) => r).length} documents`);

    return {
      acknowledged: true,
      modifiedCount: results.filter((r) => r).length,
      results: results,
    };
  } catch (error) {
    console.error("Error in CoutAdding:", error);
    throw error;
  }
};

// A, B, C SHITS IN ADDING  attendanceLogs, fromTime, toTime, "B Shift", "A Shift"
const InShiftAdding = async (
  attendanceLogs,
  fromTime,
  toTime,
  inShift,
  outShift
) => {
  const today = new Date();
  const targetDate = moment(today).startOf("day");

  // console.log("attendancelogs : ", attendanceLogs);

  // Get day of week for roster matching
  const dayOfWeek = today
    .toLocaleString("en-US", { weekday: "long" })
    .toLowerCase();

  // OPTIMIZATION 1: Run both queries concurrently with Promise.all
  const [allRosters, leavesData] = await Promise.all([
    // Get all employees with "General" shift today
    roster_mgmt.aggregate([
      {
        $match: { [`weeklyShifts.${dayOfWeek}`]: inShift },
      },
      {
        $addFields: { todayShift: `$weeklyShifts.${dayOfWeek}` },
      },
      {
        $project: {
          _id: 0,
          empId: 1,
          empName: 1,
          todayShift: 1,
        },
      },
    ]),

    // Get all active leaves for today
    leave_mgmt.aggregate([
      {
        $match: {
          empFromDate: { $lte: today },
          empToDate: { $gte: today },
        },
      },
    ]),
  ]);

  console.log("allRosters : ", allRosters);
  console.log("leavesData : ", leavesData);

  // OPTIMIZATION 2: Create lookup maps for faster access
  const empAttendanceMap = new Map();
  attendanceLogs.forEach((record) => {
    const empId = record.EmployeeCode;
    if (!empAttendanceMap.has(empId)) {
      empAttendanceMap.set(empId, []);
    }
    empAttendanceMap.get(empId).push(record);
  });

  console.log("empAttendanceMap : ", empAttendanceMap);

  // // Create a map for leaves data
  const leavesMap = new Map();
  leavesData.forEach((leave) => {
    leavesMap.set(leave.empId.toString(), leave);
  });

  console.log("leavesMap : ", leavesMap);

  // // OPTIMIZATION 3: Create all records in a single pass
  const result = allRosters.map((employee) => {
    const empIdStr = employee.empId.toString();
    const attendanceRecords = empAttendanceMap.get(empIdStr) || [];

    // Sort if we have attendance records
    let empInTime = "";
    let empAction = "";

    if (attendanceRecords.length > 0) {
      // Sort by date
      attendanceRecords.sort(
        (a, b) => new Date(a.LogDateTime) - new Date(b.LogDateTime)
      );
      empInTime = moment(attendanceRecords[0].LogDateTime).format("HH:mm:ss");
      empAction = "present";
    } else {
      // Check if employee is on leave
      const isOnLeave =
        leavesMap.has(empIdStr) &&
        moment(targetDate).isBetween(
          moment(leavesMap.get(empIdStr).empFromDate).startOf("day"),
          moment(leavesMap.get(empIdStr).empToDate).endOf("day"),
          null,
          "[]"
        );

      empAction = isOnLeave ? "On Leave" : "N/A";
    }

    return {
      empId: employee.empId,
      empShift: employee.todayShift,
      empInTime,
      empOutTime: "",
      empAction,
      empDate: today, // OPTIMIZATION 4: Use date object directly
    };
  });

  console.log("result : ", result);
  // // OPTIMIZATION 5: Use insertMany with ordered: false for better performance
  return await EmpAttendance.insertMany(result, { ordered: false });
};

const AddingShiftsAndTimingsForShifts = async (
  shiftType,
  attendanceLogs,
  fromTime,
  toTime
) => {
  if (shiftType == "C-Out_A-In") {
    await CoutAdding(attendanceLogs);
    await InShiftAdding(attendanceLogs, fromTime, toTime, "A Shift", "C Shift");
  } else if (shiftType == "A-Out_B-In") {
    await InShiftAdding(attendanceLogs, fromTime, toTime, "B Shift", "A Shift");
    await OutShiftAdding(
      attendanceLogs,
      "05:00",
      "06:50",
      "B Shift",
      "A Shift"
    );
  } else {
    await InShiftAdding(attendanceLogs, fromTime, toTime, "C Shift", "B Shift");
    await OutShiftAdding(
      attendanceLogs,
      "12:10:00",
      "13:50:00",
      "C Shift",
      "B Shift"
    );
  }
};

const attendanceAdding = async (fromTime, toTime) => {
  await client.connect();
  console.log("Connected to the database");
  const database = client.db("technicalhub");
  const collection = database.collection("attendancelogs");
  // console.log("Collection accessed:", database);

  // today date
  const today = new Date(); // Example: 2025-10-24T...
  const dateStr = today.toISOString().split("T")[0]; // "2025-10-24"

  console.log("fromTime : ", fromTime);
  console.log("toTime : ", toTime);

  const [hoursF, minutesF, secondsF] = fromTime.split(":").map(Number);
  const [hoursT, minutesT, secondsT] = toTime.split(":").map(Number);

  const FTime = new Date();
  FTime.setHours(hoursF, minutesF, secondsF, 0);

  const TTime = new Date();
  TTime.setHours(hoursT, minutesT, secondsT, 0);
  console.log("FTime : ", FTime);
  console.log("TTime : ", TTime);

  // const targetDate = moment(today).startOf("day").toDate();

  try {
    // const mydata = await SecLogSchema.aggregate([
    //   {
    //     $match: {
    //       $expr: {
    //         $and: [
    //           {
    //             // Match the date only
    //             $eq: [
    //               {
    //                 $dateToString: { format: "%Y-%m-%d", date: "$LogDateTime" },
    //               },
    //               targetDate,
    //             ],
    //           },
    //           {
    //             // Extract the time in HH:mm format
    //             $gte: [
    //               { $dateToString: { format: "%H:%M", date: "$LogDateTime" } },
    //               fromTime,
    //             ],
    //           },
    //           {
    //             $lte: [
    //               { $dateToString: { format: "%H:%M", date: "$LogDateTime" } },
    //               toTime,
    //             ],
    //           },
    //         ],
    //       },
    //     },
    //   },
    // ]);

    // const mydata = await collection.aggregate([
    //   {
    //     $match: {
    //       $expr: {
    //         $and: [
    //           // Match today's date
    //           {
    //             $eq: [
    //               {
    //                 $dateToString: {
    //                   format: "%Y-%m-%d",
    //                   date: { $toDate: "$after.LogDateTime" },
    //                 },
    //               },
    //               { $dateToString: { format: "%Y-%m-%d", date: "$$NOW" } },
    //             ],
    //           },
    //           // Between fromTime and endTime
    //           {
    //             $gte: [
    //               { $toDate: "$after.LogDateTime" },
    //               // ISODate("2025-09-19T09:00:00Z"), // <-- fromTime
    //               fromTime
    //             ],
    //           },
    //           {
    //             $lte: [
    //               { $toDate: "$after.LogDateTime" },
    //               // ISODate("2025-09-19T18:00:00Z"), // <-- endTime
    //               toTime
    //             ],
    //           },
    //         ],
    //       },
    //     },
    //   },
    //   {
    //     $project: {
    //       _id: 0,
    //       EmployeeCode: "$after.EmployeeCode",
    //       LogDateTime: "$after.LogDateTime",
    //     },
    //   },
    // ]).toArray();

    // Example input times
    // let fromTime = "09:00:00"; // 9 AM
    // let endTime = "18:00:00"; // 6 PM

    // const mydata = await collection.aggregate([
    //   {
    //     $addFields: {
    //       logDate: { $toDate: "$after.LogDateTime" }, // convert to ISODate
    //       today: { $dateTrunc: { date: "$$NOW", unit: "day" } }, // today's midnight
    //     },
    //   },
    //   {
    //     $addFields: {
    //       fromDateTime: {
    //         $dateFromString: {
    //           dateString: {
    //             $concat: [
    //               { $dateToString: { format: "%Y-%m-%d", date: "$today" } },
    //               "T",
    //               fromTime,
    //               "Z",
    //             ],
    //           },
    //         },
    //       },
    //       endDateTime: {
    //         $dateFromString: {
    //           dateString: {
    //             $concat: [
    //               { $dateToString: { format: "%Y-%m-%d", date: "$today" } },
    //               "T",
    //               toTime,
    //               "Z",
    //             ],
    //           },
    //         },
    //       },
    //     },
    //   },
    //   {
    //     $match: {
    //       $expr: {
    //         $and: [
    //           { $gte: ["$logDate", "$fromDateTime"] },
    //           { $lte: ["$logDate", "$endDateTime"] },
    //         ],
    //       },
    //     },
    //   },
    //   {
    //     $project: {
    //       _id: 0,
    //       EmployeeCode: "$after.EmployeeCode",
    //       LogDateTime: "$after.LogDateTime",
    //     },
    //   },
    // ]);

    const mydata = await collection.aggregate([
      {
        $match: { "after.Serialnumber": "0426141300425" },
      },
      {
        $addFields: {
          logDate: { $toDate: { $toLong: "$after.LogDateTime" } },
        },
      },
      {
        $match: {
          logDate: { $gte: FTime, $lte: TTime },
        },
      },
      {
        $project: {
          _id: 0,
          EmployeeCode: "$after.EmployeeCode",
          LogDateTime: "$logDate",
        },
      },
    ]).toArray();

    // console.log("Matched Data:", mydata);


    console.log("Data fetched successfully");

    // console.log(mydata);
      await SecLogSchema.insertMany(mydata);
      const uniqueAttendanceLoags = Array.from(
        new Map(mydata.map((emp) => [emp.EmployeeCode, emp])).values()
      );
      console.log("uniqueValues : ", uniqueAttendanceLoags);

      if (fromTime === "8:00:00") {
        AddingShiftsAndTimingsForGenerals("generalIn", uniqueAttendanceLoags);
      } else if (fromTime == "17:40:00") {
        AddingShiftsAndTimingsForGenerals("generalOut", uniqueAttendanceLoags);
      } else if (fromTime == "05:00:00") {
        AddingShiftsAndTimingsForShifts(
          "C-Out_A-In",
          uniqueAttendanceLoags,
          fromTime,
          toTime
        );
      } else if (fromTime == "12:00:00") {
        AddingShiftsAndTimingsForShifts(
          "A-Out_B-In",
          uniqueAttendanceLoags,
          fromTime,
          toTime
        );
      } else {
        AddingShiftsAndTimingsForShifts(
          "B-Out_C-In",
          uniqueAttendanceLoags,
          fromTime,
          toTime
        );
      }
  } catch (error) {
    console.log(error);
  }
};

// setTimeout(() => {
//   // attendanceAdding("20:10:00", "21:50:00");
//   console.log("calling shiftA out and shiftB in");
//   attendanceAdding("12:00:00", "13:50:00");
// }, 4000);

// General-In
cron.schedule("0 35 9 * * *", () => attendanceAdding("8:00:00", "9:30:00"), {
  timezone: "Asia/Kolkata",
});

// //general-Out
cron.schedule("0 35 18 * * *", () => attendanceAdding("17:40:00", "18:30:00"), {
  timezone: "Asia/Kolkata",
});

// //Shift-A in and Shift-C Out
cron.schedule("0 00 7 * * *", () => attendanceAdding("05:00:00", "06:50:00"), {
  timezone: "Asia/Kolkata",
});

// //shift-A out And Shift-B In
cron.schedule("0 02 14 * * *", () => attendanceAdding("12:00:00", "13:50:00"), {
  timezone: "Asia/Kolkata",
});

// //Shift-B out and Shift-C In
cron.schedule("0 00 22 * * *", () => attendanceAdding("20:00:00", "21:50:00",), {
  timezone: "Asia/Kolkata",
});

module.exports = { attendanceAdding };
