import { downloadXlsxTemplate } from "./spreadsheet";

// Single source of truth for the bulk-upload templates: headers, the example
// row, and the Instructions sheet. Both the download buttons and the
// "ignore the example row on upload" logic key off the same constants.
export const SAMPLE_EMPID = "123";
export const SAMPLE_EMPNAME = "User Testing";
const EXAMPLE_NOTE = "Example Row – Replace with your data before upload";

// True for the shipped example row, so an unmodified template upload is ignored
// (no validation errors) rather than treated as real data. Matches the backend
// guard in the bulk controllers.
export function isTemplateSampleRow(row) {
  if (!row) return false;
  return (
    String(row.empId ?? "").trim() === SAMPLE_EMPID &&
    String(row.empName ?? "").trim().toLowerCase() ===
      SAMPLE_EMPNAME.toLowerCase()
  );
}

const EMPLOYEE_HEADERS = [
  "empId", "empName", "empDesignation", "empDepartment", "empMobileNo",
  "empAadharNo", "empPanNo", "empDob", "empDoj", "bankAccountNo", "epfNo",
  "esiNo", "address", "emergencyContactName", "emergencyContactNumber",
  "emergencyContactRelation",
];
const EMPLOYEE_SAMPLE = [
  SAMPLE_EMPID, SAMPLE_EMPNAME, "Security Guard", "Security", "9876543210",
  "123456789012", "ABCDE1234F", "15-01-1995", "01-01-2026", "1234567890",
  "EPF123", "ESI123", "Vijayawada", "Ramesh", "9876543211", "Brother",
];

const ROSTER_HEADERS = [
  "empId", "empName", "monday", "tuesday", "wednesday", "thursday", "friday",
  "saturday", "sunday", "fromDate", "toDate",
];
const ROSTER_SAMPLE = [
  SAMPLE_EMPID, SAMPLE_EMPNAME, "GEN", "GEN", "GEN", "GEN", "GEN", "GEN", "OFF",
  "06-06-2026", "06-07-2026",
];

export const EMPLOYEE_TEMPLATE = {
  filename: "employee-template.xlsx",
  sheetName: "Employees",
  headers: EMPLOYEE_HEADERS,
  sampleRow: EMPLOYEE_SAMPLE,
  note: EXAMPLE_NOTE,
  instructions: [
    "EMPLOYEE UPLOAD",
    "- empId must be unique",
    "- empName is required",
    "- Mobile number must contain only digits",
    "- Date format: DD-MM-YYYY",
    "",
    EXAMPLE_NOTE,
  ],
};

export const ROSTER_TEMPLATE = {
  filename: "roster-template.xlsx",
  sheetName: "Roster",
  headers: ROSTER_HEADERS,
  sampleRow: ROSTER_SAMPLE,
  note: EXAMPLE_NOTE,
  instructions: [
    "ROSTER UPLOAD",
    "- Employee must already exist in Employee Management",
    "- empId must match Employee Management empId",
    "- Allowed shifts: GEN, A, B, C, OFF",
    "- Date format: DD-MM-YYYY",
    "",
    EXAMPLE_NOTE,
  ],
};

// Download a template spec as a two-sheet .xlsx file.
export function downloadTemplate(spec) {
  return downloadXlsxTemplate(spec);
}
