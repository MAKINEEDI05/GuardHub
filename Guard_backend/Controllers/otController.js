const ot = require("../models/otScheme");
const employe = require("../models/profileScheme");
const {
  resolveActiveEmployee,
  getActiveEmployeeIds,
} = require("../utils/employeeRef");

const { SHIFTS, DURATIONS, STATUSES } = ot;

const REQUIRED_FIELDS = [
  "employeeId",
  "currentShift",
  "additionalShift",
  "workingDuration",
  "fromDate",
  "toDate",
  "location",
  "reason",
];

// Validate a payload for create. Returns an array of error strings (empty = ok).
const validateOt = (body) => {
  const errors = [];

  REQUIRED_FIELDS.forEach((f) => {
    const v = body[f];
    if (v === undefined || v === null || String(v).trim() === "") {
      errors.push(`${f} is required`);
    }
  });

  if (body.currentShift && !SHIFTS.includes(body.currentShift))
    errors.push(`currentShift must be one of: ${SHIFTS.join(", ")}`);
  if (body.additionalShift && !SHIFTS.includes(body.additionalShift))
    errors.push(`additionalShift must be one of: ${SHIFTS.join(", ")}`);
  if (body.workingDuration && !DURATIONS.includes(body.workingDuration))
    errors.push(`workingDuration must be one of: ${DURATIONS.join(", ")}`);
  if (body.status && !STATUSES.includes(body.status))
    errors.push(`status must be one of: ${STATUSES.join(", ")}`);

  if (body.fromDate && body.toDate) {
    const f = new Date(body.fromDate);
    const t = new Date(body.toDate);
    if (!Number.isNaN(f.getTime()) && !Number.isNaN(t.getTime()) && t < f)
      errors.push("toDate must be on or after fromDate");
  }

  return errors;
};

// Apply (create) an OT record. Employee name/designation/department are pulled
// from the employee master — never trusted from the client.
const applyOt = async (req, res) => {
  try {
    const errors = validateOt(req.body);
    if (errors.length) {
      return res.status(400).json({ message: "Validation failed", errors });
    }

    const employeeId = parseInt(req.body.employeeId, 10);
    const check = await resolveActiveEmployee(employeeId);
    if (!check.ok) {
      return res.status(check.status).json({ message: check.message });
    }
    const employee = check.employee;

    const newOt = new ot({
      employeeId,
      employeeName: employee.empName,
      designation: employee.empDesignation,
      department: employee.empDepartment,
      currentShift: req.body.currentShift,
      additionalShift: req.body.additionalShift,
      workingDuration: req.body.workingDuration,
      fromDate: req.body.fromDate,
      toDate: req.body.toDate,
      location: req.body.location,
      reason: req.body.reason,
      remarks: req.body.remarks || "",
      status: req.body.status || "Pending",
    });

    const saved = await newOt.save();
    return res
      .status(201)
      .json({ message: "OT applied successfully", data: saved });
  } catch (error) {
    console.error("Error applying OT:", error);
    return res
      .status(500)
      .json({ message: "Error applying OT", error: error.message });
  }
};

// Get all OT records (newest first) — only for active employees.
const getAllOt = async (req, res) => {
  try {
    const { numbers: activeIds } = await getActiveEmployeeIds();
    const records = await ot
      .find({ employeeId: { $in: activeIds } })
      .sort({ createdAt: -1 });
    return res.status(200).json({ message: "OT records", data: records });
  } catch (error) {
    console.error("Error fetching OT:", error);
    return res
      .status(500)
      .json({ message: "Error fetching OT", error: error.message });
  }
};

// Get all OT records for a single employee (linkage via employeeId).
const getOtByEmpId = async (req, res) => {
  try {
    const employeeId = parseInt(req.params.empId, 10);
    if (Number.isNaN(employeeId)) {
      return res.status(400).json({ message: "Invalid employee id" });
    }
    const records = await ot.find({ employeeId }).sort({ createdAt: -1 });
    return res.status(200).json({ message: "OT records", data: records });
  } catch (error) {
    console.error("Error fetching OT by empId:", error);
    return res
      .status(500)
      .json({ message: "Error fetching OT by empId", error: error.message });
  }
};

// Update an OT record by _id. Re-enriches the denormalised employee fields if
// employeeId is changed; otherwise leaves them intact.
const updateOt = async (req, res) => {
  try {
    const update = { ...req.body };

    if (update.currentShift && !SHIFTS.includes(update.currentShift))
      return res.status(400).json({ message: "Invalid currentShift" });
    if (update.additionalShift && !SHIFTS.includes(update.additionalShift))
      return res.status(400).json({ message: "Invalid additionalShift" });
    if (update.workingDuration && !DURATIONS.includes(update.workingDuration))
      return res.status(400).json({ message: "Invalid workingDuration" });
    if (update.status && !STATUSES.includes(update.status))
      return res.status(400).json({ message: "Invalid status" });

    // Employee identity is derived, not client-supplied; refresh it if the
    // linked employee changes.
    if (update.employeeId !== undefined) {
      const check = await resolveActiveEmployee(update.employeeId);
      if (!check.ok) {
        return res.status(check.status).json({ message: check.message });
      }
      const employee = check.employee;
      update.employeeId = employee.empId;
      update.employeeName = employee.empName;
      update.designation = employee.empDesignation;
      update.department = employee.empDepartment;
    }

    const updated = await ot.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      return res.status(404).json({ message: "OT record not found" });
    }
    return res
      .status(200)
      .json({ message: "OT updated successfully", data: updated });
  } catch (error) {
    console.error("Error updating OT:", error);
    return res
      .status(500)
      .json({ message: "Failed to update OT", error: error.message });
  }
};

// Delete an OT record by _id.
const deleteOt = async (req, res) => {
  try {
    const deleted = await ot.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "OT record not found" });
    }
    return res.status(200).json({ message: "OT deleted successfully" });
  } catch (error) {
    console.error("Error deleting OT:", error);
    return res
      .status(500)
      .json({ message: "Error deleting OT", error: error.message });
  }
};

module.exports = {
  applyOt,
  getAllOt,
  getOtByEmpId,
  updateOt,
  deleteOt,
};
