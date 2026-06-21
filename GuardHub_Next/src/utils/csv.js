import Papa from "papaparse";

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
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Download a simple header-only template CSV.
export function downloadTemplate(filename, headers) {
  const csv = Papa.unparse([headers]);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
