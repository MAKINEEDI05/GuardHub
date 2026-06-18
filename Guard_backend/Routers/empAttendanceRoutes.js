const express = require("express");
const router = express.Router();

const {
  addAttendance,
  getAttendanceByEmpId,
  getMonthwiseReport,
  getAttendanceByDate,
  getAttendanceByShift,
  todayAttendanceData,
  updateAttendanceByEmpId,
} = require("../Controllers/attendanceController");

router.post("/add-attendace", addAttendance);

router.get("/get-attendace-byid/:empId", getAttendanceByEmpId);
router.get("/today-attendance-data", todayAttendanceData);
router.put("/update-attendace-byid/:empId", updateAttendanceByEmpId);
router.get("/get-attendace-bydate/:empDate", getAttendanceByDate); // aggregations
router.get("/get-attendace-byshiftname/:empShift", getAttendanceByShift); // aggregations

router.get("/monthwise-attendace-report/:empId", getMonthwiseReport); // aggregations

module.exports = router;
