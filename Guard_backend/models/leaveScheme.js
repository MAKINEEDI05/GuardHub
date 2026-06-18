const mongoose = require("mongoose");

// leave Scheme
const leave_scheme = new mongoose.Schema(
  {
    empId: {
      type: Number,
      required: true,
    },

    empLeaveType: {
      type: String,
      required: true,
    },

    empFromDate: {
      type: Date,
      required: true,
    },
    empToDate: {
      type: Date,
      required: true,
    },
    empShiftType: {
      type: String,
      required: true,
    },
    empOdType: {
      type: String,
      required: true,
    },
    empReason: {
      type: String,
      required: true,
    },
  },
  { versionKey: false, timestamps: true } // ignore __v id
);

// Create Model
const employe = mongoose.model("leave_mgmt", leave_scheme);

module.exports = employe;
