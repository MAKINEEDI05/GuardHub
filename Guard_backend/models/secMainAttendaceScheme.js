const mongoose = require("mongoose");

const SecLogSchema = new mongoose.Schema(
  {
    EmployeeCode: {
      type: String,
      required: true,
    },
    LogDateTime: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Present-day detection (Month-Wise report + Attendance Muster Roll) matches by
// EmployeeCode within a date range on this, the highest-volume collection. A
// compound index makes those aggregations index-backed instead of full scans.
SecLogSchema.index({ EmployeeCode: 1, LogDateTime: 1 });

module.exports = mongoose.model("SecAttendanceLogs", SecLogSchema);
