const mongoose = require("mongoose");

// Security Schema
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
      required: true,
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
      required: true,
    },
    empDoj: {
      type: String,
      required: true,
    },
    empImage: {
      type: String,
      required: true,
    },
  },
  { versionKey: false, timestamps: true } // ignore __v id
);

// Create Model
const employe = mongoose.model("emp", EmpDetails, "securitydetails");

module.exports = employe;
