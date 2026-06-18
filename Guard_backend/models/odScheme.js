const mongoose = require("mongoose");

// Security Schema
const od_scheme = new mongoose.Schema(
  {
    empId: {
      type: Number,
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
    empPurpose: {
      type: String,
      required: true,
    },
  },
  { versionKey: false, timestamps: true } // ignore __v id
);

// Create Model
const od_mgmt = mongoose.model("odForm", od_scheme, "od_mgmt");

module.exports = od_mgmt;
