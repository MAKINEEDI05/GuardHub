const mongoose = require("mongoose");

// Security (employee) schema.
// Only empId and empName are mandatory; every other detail is optional and can
// be filled in later from the employee profile. Existing documents already
// carry these values, so relaxing the constraints does not affect stored data.
const EmpDetails = new mongoose.Schema(
  {
    empId: {
      type: Number,
      required: true,
    },
    empName: {
      type: String,
      required: true,
    },

    empDesignation: {
      type: String,
      required: false,
    },
    empDepartment: {
      type: String,
      required: false,
    },
    bankAccountNo: {
      type: Number,
      required: false,
    },
    epfNo: {
      type: String,
      required: false,
    },
    esiNo: {
      type: String,
      required: false,
    },
    address: {
      type: String,
      required: false,
    },

    empMobileNo: {
      type: Number,
      required: false,
    },
    empAadharNo: {
      type: Number,
      required: false,
    },
    empPanNo: {
      type: String,
      required: false,
    },
    empDob: {
      type: Date,
      required: false,
    },
    empDoj: {
      type: String,
      required: false,
    },
    // Emergency contact (all optional; can be filled in later).
    emergencyContactName: {
      type: String,
      required: false,
    },
    emergencyContactNumber: {
      type: String,
      required: false,
    },
    emergencyContactRelation: {
      type: String,
      required: false,
    },
    empImage: {
      type: String,
      required: false,
    },
  },
  { versionKey: false, timestamps: true } // ignore __v id
);

// Create Model
const employe = mongoose.model("emp", EmpDetails, "securitydetails");

module.exports = employe;
