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
