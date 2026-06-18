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

module.exports = mongoose.model("SecAttendanceLogs", SecLogSchema);
