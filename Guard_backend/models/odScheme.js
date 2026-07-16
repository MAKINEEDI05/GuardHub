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
    // Current shift the employee is rostered for on the OD date (an OD moves them
    // off it). Free string — a roster value can be General / A Shift / WEEK OFF /
    // Summer Vacation, so it is NOT constrained to an enum.
    empShiftType: {
      type: String,
      required: true,
    },
    // Shift the employee is deputed to at the OD location, and how long the OD
    // runs. Mirrors the OT form. Kept as free strings (the UI constrains them).
    additionalShift: {
      type: String,
      default: "",
    },
    workingDuration: {
      type: String,
      default: "",
    },
    // Legacy half-day/full-day marker (FULL DAY / FIRST HALF / SECOND HALF).
    // Superseded by workingDuration; kept optional so old records still read.
    empOdType: {
      type: String,
      default: "",
    },
    empPurpose: {
      type: String,
      required: true,
    },
    // Applicable OD days = calendar days in the range MINUS the employee's weekly
    // off days (computed via utils/workingDays, the same engine Leave uses). This
    // is the authoritative count stored for reporting.
    days: {
      type: Number,
      default: 0,
    },
    // Actual location where the OD is performed (replaces the old emergency
    // flag). Older records are backfilled with "Not Specified".
    odLocation: {
      type: String,
      required: true,
      default: "Not Specified",
    },
  },
  { versionKey: false, timestamps: true } // ignore __v id
);

// Create Model
const od_mgmt = mongoose.model("odForm", od_scheme, "od_mgmt");

module.exports = od_mgmt;
