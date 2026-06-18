const mongoose = require("mongoose");

const employeAttendanceSchema = new mongoose.Schema(
  {
    empId: {
      type: String,
      required: true,
    },
    empShift: {
      type: String,
    },
    empWeekOff: {
      type: String,
    },
    empInTime: {
      type: String,
    },
    empOutTime: {
      type: String,
    },
    empAction: {
      type: String,
    },
    empDate: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false, timestamps: true }
);

// function determineShift(inTime, outTime) {
//   if (
//     inTime >= "08:00" &&
//     inTime <= "09:00" &&
//     outTime >= "17:00" &&
//     outTime <= "18:00"
//   ) {
//     return "General";
//   } else if (
//     inTime >= "05:30" &&
//     inTime <= "06:30" &&
//     outTime >= "12:30" &&
//     outTime <= "13:30"
//   ) {
//     return "Shift - A";
//   } else if (
//     inTime >= "12:30" &&
//     inTime <= "13:30" &&
//     outTime >= "20:30" &&
//     outTime <= "21:30"
//   ) {
//     return "Shift - B";
//   } else if (
//     (inTime >= "20:30" && inTime <= "22:00") ||
//     (inTime >= "00:00" && inTime <= "01:00")
//   ) {
//     return "Shift - C";
//   } else {
//     return "Unknown Shift";
//   }
// }

// employeAttendanceSchema.pre("save", function (next) {
//   if (!this.empShift) {
//     this.empShift = determineShift(this.empInTime, this.empOutTime);
//   }
//   next();
// });

module.exports = mongoose.model("empAttendance", employeAttendanceSchema);
