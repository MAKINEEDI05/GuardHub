const mongoose = require("mongoose");

const SHIFTS = ["General", "A Shift", "B Shift", "C Shift"];
const DURATIONS = ["4 Hours (Half Day)", "8 Hours (Full Day)", "Double Shift"];
const STATUSES = ["Pending", "Approved", "Rejected"];

// OT (Overtime / Double Shift) records. Every record is linked to an employee
// via employeeId (matches securitydetails.empId). Employee name/designation/
// department are denormalised here, auto-filled from the employee master at
// creation time, so OT history stays readable even if it is queried alone.
const ot_scheme = new mongoose.Schema(
  {
    employeeId: {
      type: Number,
      required: true,
      index: true, // fast "all OT for this employee" lookups
    },
    employeeName: { type: String },
    designation: { type: String },
    department: { type: String },

    currentShift: {
      type: String,
      enum: SHIFTS,
      required: true,
    },
    additionalShift: {
      type: String,
      enum: SHIFTS,
      required: true,
    },
    workingDuration: {
      type: String,
      enum: DURATIONS,
      required: true,
    },

    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },

    location: { type: String, required: true },
    reason: { type: String, required: true },
    remarks: { type: String, required: false },

    status: {
      type: String,
      enum: STATUSES,
      default: "Pending",
    },
  },
  { versionKey: false, timestamps: true } // createdAt + updatedAt
);

const ot_mgmt = mongoose.model("ot", ot_scheme, "ot_mgmt");

// Export the option lists too so the controller can validate against them.
module.exports = ot_mgmt;
module.exports.SHIFTS = SHIFTS;
module.exports.DURATIONS = DURATIONS;
module.exports.STATUSES = STATUSES;
