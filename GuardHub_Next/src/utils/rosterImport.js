// Client-side roster CSV analysis. Mirrors the backend bulk-upload rules
// (Guard_backend/Controllers/rosterController.js) so the user sees an accurate
// pre-upload validation + preview of exactly what will happen — Create / Update
// / Skip / Invalid — before any data is committed. The backend remains the
// authority and re-validates on submit; this is the "explain first" layer.
import { WEEKDAYS, shiftShort } from "./constants";
import { isTemplateSampleRow } from "./templates";

// Shift synonyms accepted on upload — must match the backend SHIFT_CANON map.
const SHIFT_CANON = {
  general: "General",
  "1-general": "General",
  gen: "General",
  "a shift": "A Shift",
  "shift a": "A Shift",
  "a-shift": "A Shift",
  ashift: "A Shift",
  a: "A Shift",
  "b shift": "B Shift",
  "shift b": "B Shift",
  "b-shift": "B Shift",
  bshift: "B Shift",
  b: "B Shift",
  "c shift": "C Shift",
  "shift c": "C Shift",
  "c-shift": "C Shift",
  cshift: "C Shift",
  c: "C Shift",
  "week off": "WEEK OFF",
  weekoff: "WEEK OFF",
  "week-off": "WEEK OFF",
  wo: "WEEK OFF",
  off: "WEEK OFF",
};

// "" = blank (caller defaults to General), null = invalid value.
export function normalizeShift(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "";
  return SHIFT_CANON[s] ?? null;
}

// Plain-English fix for a validation reason (mirrors the backend suggestions).
export function suggestFix(reason) {
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
  if (r.includes("must be")) return "Ensure From Date is on or before To Date.";
  if (r.includes("invalid shiftfromdate") || r.includes("invalid shiftto"))
    return "Use a valid date (YYYY-MM-DD).";
  return "Review the row and re-upload.";
}

const isBadDate = (v) =>
  v != null && String(v).trim() !== "" && Number.isNaN(new Date(v).getTime());

// Analyse parsed CSV rows against the employee master + existing roster.
// Returns { analyzed, counts }. `empMap`/`rosterMap` are keyed by String(empId).
export function analyzeRosterRows(rawRows, empMap, rosterMap) {
  const seen = new Set();

  // Drop the shipped template example row so an unmodified template upload shows
  // no rows / errors (matches the backend guard). Original row numbers are kept.
  const analyzed = rawRows
    .map((raw, i) => ({ raw, rowNo: i + 1 }))
    .filter(({ raw }) => !isTemplateSampleRow(raw))
    .map(({ raw, rowNo }) => {
    const empId = String(raw.empId ?? "").trim();
    const emp = empMap.get(empId);
    const existing = rosterMap.get(empId);
    const isNew = !existing;
    const name =
      (raw.empName && String(raw.empName).trim()) || emp?.empName || "";

    // In-file duplicate empId: first occurrence wins, the rest are skipped.
    const duplicate = !!empId && seen.has(empId);
    if (empId) seen.add(empId);

    const reasons = [];
    if (!duplicate) {
      if (!empId) reasons.push("empId is required");
      if (empId && !emp)
        reasons.push("employee does not exist in Employee Management");
      if (empId && isNew && !name)
        reasons.push("empName is required for a new roster record");
    }

    // Weekly shift codes (GEN/A/B/C/OFF) for the New Roster Status preview.
    const dayCodes = WEEKDAYS.map((d) => {
      const norm = normalizeShift(raw[d]);
      if (norm === null) {
        if (!duplicate) reasons.push(`invalid shift value "${raw[d]}" for ${d}`);
        return "!";
      }
      return shiftShort(norm || "General");
    });

    const from = raw.shiftFromDate ?? raw.fromDate;
    const to = raw.shiftToDate ?? raw.toDate;
    if (!duplicate) {
      if (isBadDate(from)) reasons.push("invalid shiftFromDate");
      if (isBadDate(to)) reasons.push("invalid shiftToDate");
      if (
        !isBadDate(from) &&
        !isBadDate(to) &&
        from &&
        to &&
        new Date(from) > new Date(to)
      )
        reasons.push("shiftFromDate must be <= shiftToDate");
    }

    let action;
    if (duplicate) action = "skip";
    else if (reasons.length) action = "invalid";
    else action = isNew ? "create" : "update";

    const reason = duplicate
      ? "Duplicate Employee ID in file"
      : reasons.join("; ");

    return {
      rowNo,
      empId,
      empName: name,
      dayCodes, // 7 short codes (GEN/A/B/C/OFF or "!") for the weekday columns
      currentStatus: existing ? "Rostered" : "Not rostered",
      newStatus: action === "invalid" ? "—" : dayCodes.join("/"),
      action, // create | update | skip | invalid
      reason,
      suggestedFix: reason ? suggestFix(reason) : "",
      raw,
    };
  });

  const counts = {
    total: analyzed.length,
    create: analyzed.filter((r) => r.action === "create").length,
    update: analyzed.filter((r) => r.action === "update").length,
    invalid: analyzed.filter((r) => r.action === "invalid").length,
    duplicate: analyzed.filter((r) => r.action === "skip").length,
  };
  counts.valid = counts.create + counts.update;

  // Aggregated warnings for the friendly warning cards.
  const reasonHas = (needle) =>
    analyzed.filter((r) => r.reason && r.reason.toLowerCase().includes(needle))
      .length;
  const warnings = {
    missingEmployees: reasonHas("does not exist"),
    invalidShifts: reasonHas("invalid shift"),
    duplicates: counts.duplicate,
  };

  return { analyzed, counts, warnings };
}

// Badge color token + label for an action.
export const ACTION_BADGE = {
  create: { cls: "status--present", label: "Create" },
  update: { cls: "status--ot", label: "Update" },
  skip: { cls: "status--leave", label: "Skip" },
  invalid: { cls: "status--absent", label: "Invalid" },
};

// Human file size, e.g. 12.4 KB / 1.2 MB.
export function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
