const roster = require("../models/rosterScheme");
const employe = require("../models/profileScheme");
const RosterUploadAudit = require("../models/rosterUploadAuditScheme");
const {
  ACTIVE_FILTER,
  resolveActiveEmployee,
  getActiveEmployeeIds,
} = require("../utils/employeeRef");

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

    // A roster assignment must belong to a valid, active employee (req 7/10).
    const check = await resolveActiveEmployee(empId);
    if (!check.ok) {
      return res.status(check.status).json({ message: check.message });
    }

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

// Get roster records, with optional server-side pagination + filtering.
// - No `page`/`limit` query params  -> returns the full array (legacy/back-compat
//   behaviour used by exports and older consumers).
// - With `page`/`limit`             -> returns { records, totalRecords,
//   totalPages, currentPage }.
// Filters (apply in both modes): search (empName/empId/designation/department/
// mobileNo), department (exact), shift (any weekday equals the value).
const WEEK_DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const getAllgurds = async (req, res) => {
  try {
    const { page, limit, search, shift, department } = req.query;

    const filter = {};
    const andClauses = [];

    // Integrity guard: never return roster rows for a deleted/inactive employee,
    // even if a stale roster document still exists for them (req 10).
    const { strings: activeIds } = await getActiveEmployeeIds();
    filter.empId = { $in: activeIds };

    if (search && String(search).trim()) {
      const escaped = String(search)
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(escaped, "i");
      andClauses.push({
        $or: [
          { empName: rx },
          { empId: rx },
          { designation: rx },
          { department: rx },
          { mobileNo: rx },
        ],
      });
    }

    if (department && String(department).trim()) {
      filter.department = department;
    }

    if (shift && String(shift).trim()) {
      andClauses.push({
        $or: WEEK_DAYS.map((d) => ({ [`weeklyShifts.${d}`]: shift })),
      });
    }

    if (andClauses.length) filter.$and = andClauses;

    // Legacy mode — full array (exports, backward compatibility).
    if (page === undefined && limit === undefined) {
      const all = await roster.find(filter).sort({ empName: 1 });
      return res.json(all);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(500, Math.max(1, parseInt(limit, 10) || 20));
    const totalRecords = await roster.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    const records = await roster
      .find(filter)
      .sort({ empName: 1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize);

    return res.json({ records, totalRecords, totalPages, currentPage: pageNum });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching roster", error: error.message });
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

// Map a validation reason to a plain-English fix shown in the error report.
const suggestRosterFix = (reason) => {
  const r = String(reason || "").toLowerCase();
  if (r.includes("does not exist"))
    return "Add the employee in Employee Management first.";
  if (r.includes("invalid shift"))
    return "Use General / A Shift / B Shift / C Shift / WEEK OFF (or GEN/A/B/C/OFF).";
  if (r.includes("empid is required")) return "Provide a numeric Employee ID.";
  if (r.includes("duplicate"))
    return "Remove duplicate rows; keep one per Employee ID.";
  if (r.includes("empname is required"))
    return "Add an Employee Name for new roster records.";
  if (r.includes("must be <=")) return "Ensure From Date is on or before To Date.";
  if (r.includes("invalid shiftfromdate") || r.includes("invalid shiftto"))
    return "Use a valid date (YYYY-MM-DD).";
  return "Review the row and re-upload.";
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
    const errors = []; // every failed/skipped row, with guidance (req: errors[])

    // Master data (active employees only) + existing roster for validation /
    // enrichment. A roster row for an unknown or deleted employee is rejected.
    const [employees, existingRosters] = await Promise.all([
      employe.find(ACTIVE_FILTER, { empId: 1, empName: 1, empDepartment: 1, empDesignation: 1, empMobileNo: 1 }),
      roster.find({}, { empId: 1 }),
    ]);
    const empMap = new Map(employees.map((e) => [String(e.empId), e]));
    const existingRosterIds = new Set(existingRosters.map((r) => String(r.empId)));

    // Record a failed/skipped row in the unified errors[] with a fix hint.
    const flag = ({ rowNo, empId, empName, reasons, action }) => {
      const list = Array.isArray(reasons) ? reasons : [reasons];
      const fixes = [...new Set(list.map(suggestRosterFix))];
      errors.push({
        row: rowNo,
        empId: empId || "",
        empName: empName || "",
        reason: list.join("; "),
        suggestedFix: fixes.join(" "),
        action, // "failed" | "skipped"
      });
    };

    const ops = [];
    const opMeta = []; // op index -> { rowNo, empId, empName } for write-error mapping
    const seen = new Set(); // first occurrence of an empId wins; rest are skipped

    rows.forEach((row, index) => {
      const rowNo = index + 1;
      const empIdStr = String(row.empId == null ? "" : row.empId).trim();
      const emp = empMap.get(empIdStr);
      const isNew = !existingRosterIds.has(empIdStr);
      const resolvedName =
        (row.empName && String(row.empName).trim()) || (emp && emp.empName) || "";

      // Silently ignore the shipped template example row so an unmodified
      // template upload never produces validation errors.
      if (empIdStr === "123" && resolvedName.toLowerCase() === "user testing") return;

      // In-file duplicate empId: keep the first row, skip the rest (req: skipped).
      if (empIdStr && seen.has(empIdStr)) {
        flag({
          rowNo,
          empId: empIdStr,
          empName: resolvedName,
          reasons: "Duplicate Employee ID in file",
          action: "skipped",
        });
        return;
      }
      if (empIdStr) seen.add(empIdStr);

      const rowErrors = [];
      // empId is the matching key: exists in roster -> update, else insert. The
      // employee MUST exist (and be active) in securitydetails — Employee
      // Management is the source of truth, so no roster can reference a guard who
      // isn't there.
      if (!empIdStr) rowErrors.push("empId is required");
      if (empIdStr && !emp)
        rowErrors.push("employee does not exist in Employee Management");
      // A brand-new roster record must have a name (roster requires empName);
      // updates keep their existing name when the CSV omits it.
      if (empIdStr && isNew && !resolvedName)
        rowErrors.push("empName is required for a new roster record");

      // Shift validation/normalization per weekday.
      const shiftFields = {};
      WEEKDAYS.forEach((day) => {
        const norm = normalizeShiftValue(row[day]);
        if (norm === null) rowErrors.push(`invalid shift value "${row[day]}" for ${day}`);
        else shiftFields[`weeklyShifts.${day}`] = norm || "General"; // blank -> General
      });

      // Date validation.
      const from = parseDateCell(row.shiftFromDate);
      const to = parseDateCell(row.shiftToDate);
      if (!from.ok) rowErrors.push("invalid shiftFromDate");
      if (!to.ok) rowErrors.push("invalid shiftToDate");
      if (from.ok && to.ok && from.date && to.date && from.date > to.date)
        rowErrors.push("shiftFromDate must be <= shiftToDate");

      if (rowErrors.length) {
        flag({
          rowNo,
          empId: empIdStr,
          empName: resolvedName,
          reasons: rowErrors,
          action: "failed",
        });
        return;
      }

      // Only $set fields we can actually resolve, so an update never wipes an
      // existing value when the CSV omits it. Department defaults to "Security".
      const setFields = { empId: empIdStr, ...shiftFields };
      if (resolvedName) setFields.empName = resolvedName;

      const designation =
        (row.designation && String(row.designation).trim()) ||
        (emp && emp.empDesignation) ||
        "";
      if (designation) setFields.designation = designation;

      const mobileNo =
        (row.mobileNo && String(row.mobileNo).trim()) ||
        (emp && emp.empMobileNo != null ? String(emp.empMobileNo) : "");
      if (mobileNo) setFields.mobileNo = mobileNo;

      setFields.department =
        (row.department && String(row.department).trim()) ||
        (emp && emp.empDepartment) ||
        "Security";

      if (from.date) setFields.shiftFromDate = from.date;
      if (to.date) setFields.shiftToDate = to.date;

      opMeta.push({ rowNo, empId: empIdStr, empName: resolvedName });
      ops.push({
        updateOne: {
          filter: { empId: empIdStr },
          update: { $set: setFields },
          upsert: true,
        },
      });
    });

    let created = 0;
    let updated = 0;
    if (ops.length) {
      try {
        const result = await roster.bulkWrite(ops, { ordered: false });
        created = result.upsertedCount || 0;
        updated = result.matchedCount || 0;
      } catch (bulkErr) {
        // ordered:false still applies successful ops; capture the rest.
        const r = bulkErr.result || {};
        created = (r.nUpserted ?? r.upsertedCount) || 0;
        updated = (r.nMatched ?? r.matchedCount) || 0;
        const writeErrors = (r.getWriteErrors && r.getWriteErrors()) || bulkErr.writeErrors || [];
        writeErrors.forEach((we) => {
          const meta = opMeta[we.index] || {};
          flag({
            rowNo: meta.rowNo,
            empId: meta.empId,
            empName: meta.empName,
            reasons: we.errmsg || we.err?.errmsg || "database write failed",
            action: "failed",
          });
        });
      }
    }

    const skipped = errors.filter((e) => e.action === "skipped").length;
    const failed = errors.filter((e) => e.action === "failed").length;
    const successRate =
      totalRows > 0
        ? Math.round(((created + updated) / totalRows) * 1000) / 10
        : 0;

    // Server-side action log (req: log every create/update/skip/failure).
    console.log(
      `[roster bulk] by=${uploadedBy} total=${totalRows} created=${created} ` +
        `updated=${updated} skipped=${skipped} failed=${failed} rate=${successRate}%`
    );

    // Audit trail (best-effort; never blocks the response).
    try {
      await RosterUploadAudit.create({
        uploadedBy,
        uploadedAt: new Date(),
        totalRows,
        recordsAdded: created,
        recordsUpdated: updated,
        invalidCount: failed,
        failedCount: failed,
      });
    } catch (auditErr) {
      console.error("Roster upload audit failed:", auditErr.message);
    }

    return res.status(200).json({
      totalRows,
      created,
      updated,
      skipped,
      failed,
      successRate,
      errors,
      // Back-compat aliases for any older consumer.
      addedCount: created,
      updatedCount: updated,
      invalidCount: failed,
      failedCount: failed,
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
