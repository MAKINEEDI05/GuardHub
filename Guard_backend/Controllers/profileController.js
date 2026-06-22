const employe = require("../models/profileScheme");
const roster = require("../models/rosterScheme");
const { ACTIVE_FILTER } = require("../utils/employeeRef");

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
      emergencyContactName,
      emergencyContactNumber,
      emergencyContactRelation,
    } = req.body;
    const empImage = req.file ? req.file.filename : null;
    // const empImage = req.file.filename;
    // if (!req.file) {
    //   return res.status(400).json({ message: "Image file is required" });
    // }

    // empId is the foreign key used by every other module, so it must stay
    // unique. If a record already exists for this empId, reject when it's active
    // (duplicate) or REACTIVATE it when it was soft-deleted (re-hire) instead of
    // creating a second document.
    const existing =
      empId !== undefined && empId !== null && String(empId).trim() !== ""
        ? await employe.findOne({ empId: Number(empId) })
        : null;
    if (existing) {
      if (existing.isActive === false) {
        existing.set({
          empName,
          empDesignation,
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
          emergencyContactName,
          emergencyContactNumber,
          emergencyContactRelation,
          isActive: true,
          deletedAt: null,
        });
        if (empImage) existing.empImage = empImage;
        await existing.save();
        return res
          .status(200)
          .json({ message: "Employee reactivated successfully" });
      }
      return res
        .status(409)
        .json({ message: `Employee ${empId} already exists` });
    }

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
      emergencyContactName,
      emergencyContactNumber,
      emergencyContactRelation,
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

// getdetails from db — active employees only (the single source of truth for
// every other module). Pass ?includeInactive=true for an admin/audit view.
const getAllEmpData = async (req, res) => {
  try {
    const includeInactive = String(req.query.includeInactive) === "true";
    const filter = includeInactive ? {} : ACTIVE_FILTER;
    const employees = await employe.find(filter);
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: "Error fetching products", error });
  }
};

// getByempId — a soft-deleted employee is reported distinctly (req 14).
const getEmpById = async (req, res) => {
  try {
    const { empId } = req.params;
    const employee = await employe.findOne({ empId: empId });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }
    if (employee.isActive === false) {
      return res.status(404).json({ message: "Employee has been deleted." });
    }
    return res.json(employee);
  } catch (error) {
    console.error("Error fetching employee:", error);
    res.status(500).json({ message: "Error fetching employee", error });
  }
};

// update by empId — only an active employee can be edited.
const updateEmp = async (req, res) => {
  try {
    // Never let a client flip soft-delete state through the generic update path.
    const { isActive, deletedAt, ...rest } = req.body;
    const update = await employe.findOneAndUpdate(
      { empId: req.params.empId, ...ACTIVE_FILTER },
      rest,
      { new: true, runValidators: true }
    );
    if (!update) {
      return res
        .status(404)
        .json({ message: "Employee not found or has been deleted." });
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

// Delete by empId — SOFT delete. The employee is marked inactive (so it leaves
// every active list/search/report/apply form) and its current roster assignment
// is removed (a roster entry must always belong to a valid employee), while
// historical leave/OD/OT/attendance records are retained for audit.
const deleteEmpById = async (req, res) => {
  try {
    const { empId } = req.params;
    const employee = await employe.findOne({ empId: empId });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }
    if (employee.isActive === false) {
      return res
        .status(409)
        .json({ message: "Employee has already been deleted." });
    }

    employee.isActive = false;
    employee.deletedAt = new Date();
    await employee.save();

    // Roster is a current assignment, not audit history — drop it so the guard
    // never shows up in roster views again.
    await roster.deleteOne({ empId: String(empId) });

    res.json({
      message:
        "Employee deleted successfully. Historical records are retained for audit.",
    });
  } catch (error) {
    console.error("Error deleting employee:", error);
    res.status(500).json({ message: "Error deleting employee", error });
  }
};

// Restore a soft-deleted employee (re-activate).
const restoreEmpById = async (req, res) => {
  try {
    const { empId } = req.params;
    const employee = await employe.findOne({ empId: empId });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }
    if (employee.isActive !== false) {
      return res.status(409).json({ message: "Employee is already active." });
    }
    employee.isActive = true;
    employee.deletedAt = null;
    await employee.save();
    res.json({ message: "Employee restored successfully" });
  } catch (error) {
    console.error("Error restoring employee:", error);
    res.status(500).json({ message: "Error restoring employee", error });
  }
};

// ---------------------------------------------------------------------------
// Bulk add / update employees via CSV-derived rows.
// empId is the unique key: exists -> UPDATE, otherwise CREATE (true upsert via
// bulkWrite). Never creates duplicates for the same empId.
// Only empId + empName are mandatory; other fields are optional but validated
// when present.
// ---------------------------------------------------------------------------

// Parse a date cell (dd-mm-yyyy, yyyy-mm-dd or mm-dd-yyyy). Returns Date or null.
const parseEmpDate = (v) => {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  const s = String(v).trim();
  const iso = new Date(s);
  if (!Number.isNaN(iso.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(s)) return iso;
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    let [, a, b, y] = m;
    a = parseInt(a, 10);
    b = parseInt(b, 10);
    // dd-mm-yyyy if first part > 12, else assume dd-mm-yyyy (common in India)
    const day = a > 12 ? a : a;
    const month = b;
    const d = new Date(Date.UTC(parseInt(y, 10), month - 1, day));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return Number.isNaN(iso.getTime()) ? null : iso;
};

const setIf = (obj, key, val) => {
  if (val !== undefined && val !== null && String(val).trim() !== "") {
    obj[key] = val;
  }
};

const bulkUpsertEmployees = async (req, res) => {
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : null;
    if (!rows) {
      return res
        .status(400)
        .json({ message: "Request body must include a 'rows' array" });
    }

    const totalRows = rows.length;
    const invalidRecords = []; // validation failures
    const duplicateRecords = []; // duplicate empId within this request
    const failedRecords = []; // DB write failures
    const ops = [];
    const seen = new Set();

    rows.forEach((row, index) => {
      const rowNo = index + 1;
      const empIdStr = String(row.empId == null ? "" : row.empId).trim();
      const empName = String(row.empName == null ? "" : row.empName).trim();
      const errors = [];

      if (!empIdStr) errors.push("Employee ID missing");
      else if (!/^[0-9]+$/.test(empIdStr)) errors.push("Invalid Employee ID");
      if (!empName) errors.push("Employee Name missing");

      const mobile = row.empMobileNo && String(row.empMobileNo).trim();
      if (mobile && !/^[0-9]{10}$/.test(mobile))
        errors.push("Invalid mobile number");
      const aadhar = row.empAadharNo && String(row.empAadharNo).trim();
      if (aadhar && !/^[0-9]{12}$/.test(aadhar))
        errors.push("Invalid Aadhaar number");
      const pan = row.empPanNo && String(row.empPanNo).trim().toUpperCase();
      if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan))
        errors.push("Invalid PAN number");
      const bank = row.bankAccountNo && String(row.bankAccountNo).trim();
      if (bank && !/^[0-9]{9,18}$/.test(bank))
        errors.push("Invalid bank account number");
      let dob;
      if (row.empDob && String(row.empDob).trim() !== "") {
        dob = parseEmpDate(row.empDob);
        if (!dob) errors.push("Invalid date of birth");
      }

      if (errors.length) {
        invalidRecords.push({ row: rowNo, empId: empIdStr, errors });
        return;
      }

      // In-request duplicate empId -> keep first, skip the rest.
      if (seen.has(empIdStr)) {
        duplicateRecords.push({ row: rowNo, empId: empIdStr });
        return;
      }
      seen.add(empIdStr);

      // Re-uploading an employee re-activates them if they were soft-deleted,
      // keeping Employee Management the source of truth.
      const set = {
        empId: Number(empIdStr),
        empName,
        isActive: true,
        deletedAt: null,
      };
      setIf(set, "empDesignation", row.empDesignation);
      setIf(set, "empDepartment", row.empDepartment);
      if (mobile) set.empMobileNo = Number(mobile);
      if (aadhar) set.empAadharNo = Number(aadhar);
      if (pan) set.empPanNo = pan;
      if (bank) set.bankAccountNo = Number(bank);
      setIf(set, "epfNo", row.epfNo);
      setIf(set, "esiNo", row.esiNo);
      setIf(set, "address", row.address);
      if (dob) set.empDob = dob;
      setIf(set, "empDoj", row.empDoj);
      setIf(set, "emergencyContactName", row.emergencyContactName);
      setIf(set, "emergencyContactNumber", row.emergencyContactNumber);
      setIf(set, "emergencyContactRelation", row.emergencyContactRelation);

      ops.push({
        updateOne: {
          filter: { empId: Number(empIdStr) },
          update: { $set: set },
          upsert: true,
        },
      });
    });

    let added = 0;
    let updated = 0;
    if (ops.length) {
      try {
        const result = await employe.bulkWrite(ops, { ordered: false });
        added = result.upsertedCount || 0;
        updated = result.matchedCount || 0;
      } catch (bulkErr) {
        const r = bulkErr.result || {};
        added = (r.nUpserted ?? r.upsertedCount) || 0;
        updated = (r.nMatched ?? r.matchedCount) || 0;
        const writeErrors =
          (r.getWriteErrors && r.getWriteErrors()) || bulkErr.writeErrors || [];
        writeErrors.forEach((we) => {
          const op = ops[we.index];
          failedRecords.push({
            empId: op && op.updateOne.filter.empId,
            error: we.errmsg || (we.err && we.err.errmsg) || "write failed",
          });
        });
      }
    }

    const skipped = invalidRecords.length + duplicateRecords.length;
    return res.status(200).json({
      totalRows,
      added,
      updated,
      skipped,
      failed: failedRecords.length,
      invalidRecords,
      duplicateRecords,
      failedRecords,
    });
  } catch (error) {
    console.error("Error in bulk employee upload:", error);
    return res
      .status(500)
      .json({ message: "Bulk employee upload failed", error: error.message });
  }
};

module.exports = {
  getAllEmpData,
  addEmpData,
  getEmpById,
  deleteEmpById,
  restoreEmpById,
  updateEmp,
  bulkUpsertEmployees,
};
