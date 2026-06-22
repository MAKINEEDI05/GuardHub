import { parseCsvFile } from "./csv";

// Parse an uploaded roster file into row objects, accepting both CSV and Excel.
// SheetJS (xlsx) is ~400 KB, so it's loaded ON DEMAND — only when an .xlsx/.xls
// file is actually chosen. CSV uploads never pay for it. Both paths resolve to
// the same { rows } shape (header row → object keys, trimmed).
async function parseXlsxFile(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { rows: [], errors: [] };
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  const rows = raw.map((r) => {
    const o = {};
    Object.entries(r).forEach(([k, v]) => {
      o[String(k).trim()] = typeof v === "string" ? v.trim() : v;
    });
    return o;
  });
  return { rows, errors: [] };
}

export function parseSpreadsheetFile(file) {
  const name = (file?.name || "").toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return parseXlsxFile(file);
  return parseCsvFile(file);
}

export const ACCEPTED_EXTENSIONS = [".csv", ".xlsx", ".xls"];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

// Return required columns the file is missing (case-insensitive header match).
// "weekday" is satisfied if ANY of monday..sunday is present.
const WEEKDAY_COLS = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];
export function missingRequiredColumns(rows) {
  const headers = new Set();
  rows.forEach((r) => Object.keys(r).forEach((k) => headers.add(k.toLowerCase())));
  const missing = [];
  if (!headers.has("empid")) missing.push("empId");
  if (!WEEKDAY_COLS.some((d) => headers.has(d))) missing.push("weekday shifts (monday…sunday)");
  return missing;
}
