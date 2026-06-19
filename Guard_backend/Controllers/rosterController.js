const roster = require("../models/rosterScheme");
const employe = require("../models/profileScheme");
const RosterUploadAudit = require("../models/rosterUploadAuditScheme");

// add employee shifts
const addEmployeShift = async (req, res) => {
  try {
    const {
      empId,
      empName,
      mobileNo,
      department,
      designation,
      weeklyShifts: {
        sunday,
        monday,
        tuesday,
        wednesday,
        thursday,
        friday,
        saturday,
      },
    } = req.body;
    const newEmployeeShift = new roster({
      empId,
      empName,
      mobileNo,
      department,
      designation,
      weeklyShifts: {
        sunday,
        monday,
        tuesday,
        wednesday,
        thursday,
        friday,
        saturday,
      },
    });

    await newEmployeeShift.save();
    res
      .status(201)
      .json({ message: "Employee shift added successfully", newEmployeeShift });
  } catch (error) {
    res.status(500).json({ message: "Failed to add employee shift", error });
  }
};

// update
const updateRoster = async (req, res) => {
  try {
    const updated = await roster.findOneAndUpdate(
      { empId: req.params.empId },
      req.body,
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ message: "Roster not found" });
    }
    res.json({ message: "Roster updated successfully", updated });
  } catch (error) {
    res.status(500).json({ message: "Failed to update roster", error });
  }
};

// Get all od records
const getAllgurds = async (req, res) => {
  try {
    const gurds = await roster.find();
    res.json(gurds);
  } catch (error) {
    res.status(500).json({ message: "Error fetching leaves", error });
  }
};

// Get od by empId
const getGurdByEmpId = async (req, res) => {
  try {
    const { empId } = req.params;
    const gurd = await roster.find({ empId: empId });

    if (!gurd || gurd.length === 0) {
      return res
        .status(404)
        .json({ message: "Gurd not found for this employeID" });
    }

    res.json(gurd);
  } catch (error) {
    console.error("Error fetching Gurd:", error);
    res.status(500).json({ message: "Error fetching Gurd", error });
  }
};

const deleteGurd = async (req, res) => {
  try {
    const result = await roster.deleteOne({ empId: req.params.empId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Roster not found" });
    }
    res.json({ message: "Roster deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete roster", error });
  }
};

// ---------------------------------------------------------------------------
// Bulk Add / Bulk Update roster via CSV-derived rows.
// empId is the matching key: existing -> update, new -> insert (upsert).
// Never creates duplicates (one updateOne+upsert per empId).
// ---------------------------------------------------------------------------

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

// Canonical shift set used across the existing app (the roster table coerces
// anything outside this set to "General"), normalized case-insensitively.
const SHIFT_CANON = {
  general: "General",
  "1-general": "General",
  gen: "General",
  "a shift": "A Shift",
  "shift a": "A Shift",
  "a-shift": "A Shift",
  ashift: "A Shift",
  "b shift": "B Shift",
  "shift b": "B Shift",
  "b-shift": "B Shift",
  bshift: "B Shift",
  "c shift": "C Shift",
  "shift c": "C Shift",
  "c-shift": "C Shift",
  cshift: "C Shift",
  "week off": "WEEK OFF",
  weekoff: "WEEK OFF",
  "week-off": "WEEK OFF",
  wo: "WEEK OFF",
  off: "WEEK OFF",
};

// Returns a canonical shift, "" for blank (caller defaults), or null if invalid.
const normalizeShiftValue = (v) => {
  const s = String(v == null ? "" : v).trim().toLowerCase();
  if (!s) return "";
  return SHIFT_CANON[s] || null;
};

// Parse a date cell; returns { ok, date } where date is undefined for blank.
const parseDateCell = (v) => {
  if (v === undefined || v === null || String(v).trim() === "") {
    return { ok: true, date: undefined };
  }
  const d = new Date(String(v).trim());
  return Number.isNaN(d.getTime()) ? { ok: false } : { ok: true, date: d };
};

const bulkUpsertRoster = async (req, res) => {
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : null;
    const uploadedBy = (req.body.uploadedBy || "admin").toString();

    if (!rows) {
      return res
        .status(400)
        .json({ message: "Request body must include a 'rows' array" });
    }

    const totalRows = rows.length;
    const invalidRecords = [];
    const failedRecords = [];

    // Master data + existing roster for validation / enrichment.
    const [employees, existingRosters] = await Promise.all([
      employe.find({}, { empId: 1, empName: 1, empDepartment: 1, empDesignation: 1, empMobileNo: 1 }),
      roster.find({}, { empId: 1 }),
    ]);
    const empMap = new Map(employees.map((e) => [String(e.empId), e]));
    const existingRosterIds = new Set(existingRosters.map((r) => String(r.empId)));

    // Detect duplicate empIds within the uploaded rows.
    const idOccurrences = new Map();
    rows.forEach((r) => {
      const id = String(r.empId == null ? "" : r.empId).trim();
      if (id) idOccurrences.set(id, (idOccurrences.get(id) || 0) + 1);
    });

    const ops = [];
    rows.forEach((row, index) => {
      const rowNo = index + 1;
      const empIdStr = String(row.empId == null ? "" : row.empId).trim();
      const errors = [];

      if (!empIdStr) errors.push("empId is required");
      if (empIdStr && !empMap.has(empIdStr))
        errors.push("employee not found in securitydetails");
      if (empIdStr && idOccurrences.get(empIdStr) > 1)
        errors.push("duplicate empId in file");

      // Shift validation/normalization per weekday.
      const shiftFields = {};
      WEEKDAYS.forEach((day) => {
        const norm = normalizeShiftValue(row[day]);
        if (norm === null) errors.push(`invalid shift value "${row[day]}" for ${day}`);
        else shiftFields[`weeklyShifts.${day}`] = norm || "General"; // blank -> General
      });

      // Date validation.
      const from = parseDateCell(row.shiftFromDate);
      const to = parseDateCell(row.shiftToDate);
      if (!from.ok) errors.push("invalid shiftFromDate");
      if (!to.ok) errors.push("invalid shiftToDate");
      if (from.ok && to.ok && from.date && to.date && from.date > to.date)
        errors.push("shiftFromDate must be <= shiftToDate");

      if (errors.length) {
        invalidRecords.push({ row: rowNo, empId: empIdStr, errors });
        return;
      }

      const emp = empMap.get(empIdStr);
      const setFields = {
        empId: empIdStr,
        empName: (row.empName && String(row.empName).trim()) || emp.empName,
        department:
          (row.department && String(row.department).trim()) || emp.empDepartment || "",
        designation:
          (row.designation && String(row.designation).trim()) ||
          emp.empDesignation ||
          "",
        mobileNo:
          (row.mobileNo && String(row.mobileNo).trim()) ||
          (emp.empMobileNo != null ? String(emp.empMobileNo) : ""),
        ...shiftFields,
      };
      if (from.date) setFields.shiftFromDate = from.date;
      if (to.date) setFields.shiftToDate = to.date;

      ops.push({
        updateOne: {
          filter: { empId: empIdStr },
          update: { $set: setFields },
          upsert: true,
        },
      });
    });

    let addedCount = 0;
    let updatedCount = 0;
    if (ops.length) {
      try {
        const result = await roster.bulkWrite(ops, { ordered: false });
        addedCount = result.upsertedCount || 0;
        updatedCount = result.matchedCount || 0;
      } catch (bulkErr) {
        // ordered:false still applies successful ops; capture the rest.
        const r = bulkErr.result || {};
        addedCount = (r.nUpserted ?? r.upsertedCount) || 0;
        updatedCount = (r.nMatched ?? r.matchedCount) || 0;
        const writeErrors = (r.getWriteErrors && r.getWriteErrors()) || bulkErr.writeErrors || [];
        writeErrors.forEach((we) => {
          const op = ops[we.index];
          failedRecords.push({
            empId: op?.updateOne?.filter?.empId,
            error: we.errmsg || we.err?.errmsg || "write failed",
          });
        });
      }
    }

    // Audit trail (best-effort; never blocks the response).
    try {
      await RosterUploadAudit.create({
        uploadedBy,
        uploadedAt: new Date(),
        totalRows,
        recordsAdded: addedCount,
        recordsUpdated: updatedCount,
        invalidCount: invalidRecords.length,
        failedCount: failedRecords.length,
      });
    } catch (auditErr) {
      console.error("Roster upload audit failed:", auditErr.message);
    }

    return res.status(200).json({
      totalRows,
      addedCount,
      updatedCount,
      invalidCount: invalidRecords.length,
      failedCount: failedRecords.length,
      invalidRecords,
      failedRecords,
    });
  } catch (error) {
    console.error("Error in bulk roster upload:", error);
    return res
      .status(500)
      .json({ message: "Bulk roster upload failed", error: error.message });
  }
};

// export the functions
module.exports = {
  addEmployeShift,
  updateRoster,
  getAllgurds,
  getGurdByEmpId,
  deleteGurd,
  bulkUpsertRoster,
};
