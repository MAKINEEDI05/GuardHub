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
      required: true,
    },
    empDepartment: {
      type: String,
      required: true,
    },
    bankAccountNo: {
      type: Number,
      required: true,
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
      required: true,
    },

    empMobileNo: {
      type: Number,
      required: true,
    },
    empAadharNo: {
      type: Number,
      required: true,
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
      required: false,
    },
  },
  { versionKey: false, timestamps: true } // ignore __v id
);

// Create Model
const employe = mongoose.model("emp", EmpDetails, "securitydetails");

module.exports = employe;
