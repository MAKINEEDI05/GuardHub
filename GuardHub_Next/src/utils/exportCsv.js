import { downloadCsv } from "./csv";
import { toast } from "../store/toastStore";

// Standard filtered-aware CSV export used across every list/report screen.
// Pass the SAME rows the table is rendering (already filtered) — never re-filter
// here. The file name and the confirmation toast both reflect whether any filter
// is currently active:
//   no filter  -> "<baseName>-all.csv"       + "Exported N <noun>"
//   filtered   -> "<baseName>-filtered.csv"  + "Exported N filtered <noun>"
export function exportFilteredCsv({ baseName, columns, rows, isFiltered, noun = "records" }) {
  const name = `${baseName}-${isFiltered ? "filtered" : "all"}.csv`;
  downloadCsv(name, columns, rows);
  toast.success(`Exported ${rows.length} ${isFiltered ? "filtered " : ""}${noun}`);
}

// Derive the CSV columns from a DataTable `columns` model so the export always
// stays in sync with the table (same order, same headers, new columns included
// automatically). A table column declares how it serializes to CSV via:
//   - exportCols: [{ label, value(row) }]   one table column -> many CSV columns
//     (e.g. the composite "Employee" cell -> ID / Name / Department / Designation)
//   - exportValue(row) (+ optional exportLabel) for a column with a custom render
//   - nothing, for a plain data column -> { header, row[key] } is used
// A render-only column with no export descriptor (e.g. "Actions") is omitted.
export function columnsToExport(columns) {
  const out = [];
  columns.forEach((c) => {
    if (Array.isArray(c.exportCols)) {
      c.exportCols.forEach((ec) => out.push(ec));
    } else if (typeof c.exportValue === "function") {
      out.push({ label: c.exportLabel || c.header, value: c.exportValue });
    } else if (!c.render) {
      out.push({ label: c.exportLabel || c.header, value: (r) => r[c.key] });
    }
  });
  return out;
}

// Filtered-aware export driven by the table column model. Pass the SAME rows the
// table is showing (already filtered/sorted). Empty values become blank cells.
export function exportTableCsv({ baseName, columns, rows, isFiltered, noun = "records" }) {
  const cols = columnsToExport(columns);
  const data = rows.map((row) => {
    const o = {};
    cols.forEach((c) => {
      const v = c.value(row);
      o[c.label] = v == null ? "" : v;
    });
    return o;
  });
  const name = `${baseName}-${isFiltered ? "filtered" : "all"}.csv`;
  downloadCsv(name, cols.map((c) => ({ key: c.label, label: c.label })), data);
  toast.success(`Exported ${rows.length} ${isFiltered ? "filtered " : ""}${noun}`);
}
