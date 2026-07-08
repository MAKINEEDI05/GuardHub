import { formatDate, formatDateTime } from "./date";
import { downloadCsvMatrix } from "./csv";
import { toast } from "../store/toastStore";

// Single source of truth for the Employee Leave "detail" view. Both the
// Employee Details Drawer and the detailed CSV export shape their data through
// here, so the drawer and the export can never disagree.

// Leave history, newest first (by From Date).
export function sortLeaveHistory(history) {
  return [...(history || [])].sort((a, b) => new Date(b.fromDate) - new Date(a.fromDate));
}

// Normalize a summary row (already filtered, already carries byType) + its
// filtered leave history into the four drawer sections. `history` entries stay
// as the raw transaction objects (the drawer still needs them for edit/delete).
export function buildLeaveDetail(row, history, year) {
  return {
    info: {
      empName: row?.empName ?? "",
      empId: row?.empId ?? "",
      department: row?.empDepartment ?? "",
      designation: row?.empDesignation ?? "",
      year: year ?? "",
    },
    summary: {
      allocated: row?.allocated ?? 0,
      used: row?.taken ?? 0,
      remaining: row?.remaining ?? 0,
    },
    byType: (row?.byType ?? []).map((b) => ({
      leaveTypeCode: b.leaveTypeCode,
      leaveTypeName: b.leaveTypeName,
      allocated: b.allocated,
      used: b.used,
      remaining: b.remaining,
    })),
    history: sortLeaveHistory(history),
  };
}

// Build the multi-section CSV matrix (array of rows). Empty rows ([]) become the
// blank lines that separate sections.
export function leaveDetailToCsvMatrix(detail) {
  const m = [];

  m.push(["EMPLOYEE INFORMATION"]);
  m.push(["Employee Name", detail.info.empName]);
  m.push(["Employee ID", detail.info.empId]);
  m.push(["Department", detail.info.department || "-"]);
  m.push(["Designation", detail.info.designation || "-"]);
  m.push(["Year", detail.info.year]);
  m.push([]);

  m.push(["OVERALL LEAVE SUMMARY"]);
  m.push(["Allocated", detail.summary.allocated]);
  m.push(["Used", detail.summary.used]);
  m.push(["Remaining", detail.summary.remaining]);
  m.push([]);

  m.push(["LEAVE BALANCE BY TYPE"]);
  m.push(["Leave Type", "Allocated", "Used", "Remaining"]);
  detail.byType.forEach((b) => m.push([b.leaveTypeName, b.allocated, b.used, b.remaining]));
  m.push([]);

  m.push(["LEAVE HISTORY"]);
  m.push(["Leave Type", "From Date", "To Date", "Number of Days", "Duration", "Shift", "Reason", "Created Date"]);
  if (detail.history.length === 0) {
    m.push(["No leave records for the current filters"]);
  } else {
    detail.history.forEach((l) =>
      m.push([
        l.leaveTypeName,
        formatDate(l.fromDate),
        formatDate(l.toDate),
        l.days,
        l.dayType || "",
        l.shiftType || "",
        l.reason || "",
        formatDateTime(l.createdAt),
      ])
    );
  }

  return m;
}

// Download the detailed single-employee report and toast. Consumes the same
// `detail` object the drawer renders.
export function exportLeaveDetailCsv(detail) {
  downloadCsvMatrix(`leave-${detail.info.empId}-${detail.info.year}.csv`, leaveDetailToCsvMatrix(detail));
  const n = detail.history.length;
  toast.success(`Exported ${detail.info.empName}'s leave detail (${n} record${n === 1 ? "" : "s"}).`);
}
