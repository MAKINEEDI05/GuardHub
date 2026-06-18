const mongo = require("mongoose");

const roster_scheme = new mongo.Schema(
  {
    empId: { type: String, required: true },
    empName: { type: String, required: true },
    mobileNo: { type: String },
    department: { type: String },
    designation: { type: String },

    weeklyShifts: {
      sunday: { type: String, default: "1-General" },
      monday: { type: String, default: "1-General" },
      tuesday: { type: String, default: "1-General" },
      wednesday: { type: String, default: "1-General" },
      thursday: { type: String, default: "1-General" },
      friday: { type: String, default: "1-General" },
      saturday: { type: String, default: "1-General" },
    },
    shiftFromDate: { type: Date },
    shiftToDate: { type: Date },
  },
  { timestamps: true },
  { versionKey: false }
);
const roster_mgmt = mongo.model("roster", roster_scheme, "roster_mgmt");
module.exports = roster_mgmt;
