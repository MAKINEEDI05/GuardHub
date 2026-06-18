const employe = require("../models/profileScheme");

// Add new Security
const addEmpData = async (req, res) => {
  try {
    const {
      empName,
      empId,
      empDesignation,
      empAadharNo,
      empPanNo,
      empDob,
      empDoj,
      empMobileNo,
      empDepartment,
      bankAccountNo,
      epfNo,
      esiNo,
      address,
    } = req.body;
    const empImage = req.file ? req.file.filename : null;
    // const empImage = req.file.filename;
    // if (!req.file) {
    //   return res.status(400).json({ message: "Image file is required" });
    // }
    const newEmployee = new employe({
      empName,
      empDesignation,
      empId,
      empMobileNo,
      empAadharNo,
      empPanNo,
      empDepartment,
      bankAccountNo,
      epfNo,
      esiNo,
      address,
      empDob,
      empDoj,
      empImage,
    });
    console.log("New Employee Data:", newEmployee);
    await newEmployee.save();
    res.status(201).json({ message: "Employee added successfully" });
  } catch (error) {
    console.error("Error adding employee:", error);

    res.status(500).json({ message: "Error adding employee", error });
  }
};

// getdetails from db
const getAllEmpData = async (req, res) => {
  try {
    const employees = await employe.find();
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: "Error fetching products", error });
  }
};

// getByempId

const getEmpById = async (req, res) => {
  try {
    const { empId } = req.params;
    const employee = await employe.findOne({ empId: empId });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    return res.json(employee);
  } catch (error) {
    console.error("Error fetching employee:", error);
    res.status(500).json({ message: "Error fetching employee", error });
  }
};

// update by empId

const updateEmp = async (req, res) => {
  try {
    const update = await employe.findOneAndUpdate(
      { empId: req.params.empId }, // make sure empId is a number if your DB stores it as Number
      req.body,
      { new: true, runValidators: true }
    );
    if (!update) {
      return res.status(404).json({ message: "Employee not found" });
    }
    return res.json({
      message: "Employee details updated successfully",
      update,
    });
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({
      message: "Failed to update employee details",
      error: error.message,
    });
  }
};

// Delete by empId
const deleteEmpById = async (req, res) => {
  try {
    const { empId } = req.params;
    const DeleteEmployee = await employe.findOneAndDelete({ empId: empId });
    if (!DeleteEmployee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json(`emp delete successfully${DeleteEmployee}`);
  } catch (error) {
    console.error("Error deleting employee:", error);
    res.status(500).json({ message: "Error deleting employee", error });
  }
};

module.exports = {
  getAllEmpData,
  addEmpData,
  getEmpById,
  deleteEmpById,
  updateEmp,
};
