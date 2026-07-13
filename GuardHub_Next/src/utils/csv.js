import Papa from "papaparse";

// Trigger a browser download of a CSV string (shared blob plumbing).
function saveCsv(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Trigger a browser download of a CSV built from an array of row objects.
// `columns` is [{ key, label }] controlling order and headers.
export function downloadCsv(filename, columns, rows) {
  const data = rows.map((row) => {
    const out = {};
    columns.forEach((c) => {
      out[c.label] = row[c.key] ?? "";
    });
    return out;
  });
  saveCsv(filename, Papa.unparse(data));
}

// Download a CSV built from an array-of-arrays (a "matrix"). Rows may be ragged
// and an empty row ([]) becomes a blank line — used for multi-section reports
// (section headers + blank-line separators).
export function downloadCsvMatrix(filename, matrix) {
  saveCsv(filename, Papa.unparse(matrix));
}

// Download a simple header-only template CSV.
export function downloadTemplate(filename, headers) {
  saveCsv(filename, Papa.unparse([headers]));
}

// Parse an uploaded CSV File into an array of row objects (header row used as
// keys). Resolves with { rows, errors }.
export function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (res) => resolve({ rows: res.data, errors: res.errors }),
      error: reject,
    });
  });
}
