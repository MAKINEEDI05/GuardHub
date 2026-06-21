import { useMemo, useState } from "react";
import { EmptyState, TableSkeleton } from "./States";

// Lightweight, dependency-free data table with optional client-side sorting
// and pagination. Suited to the <500-row datasets in this app — no
// virtualization needed, but rows are memoized to avoid needless re-renders.
//
// columns: [{ key, header, render?(row), sortable?, className?, sortValue?(row) }]
export default function DataTable({
  columns,
  rows,
  loading,
  rowKey = (r, i) => r._id || r.empId || i,
  pageSize = 12,
  paginate = true,
  emptyTitle = "No records found",
  emptyMessage,
  emptyIcon,
  compact,
}) {
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    if (!sort.key) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const getVal = col.sortValue || ((r) => r[sort.key]);
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number")
        return sort.dir === "asc" ? av - bv : bv - av;
      return sort.dir === "asc"
        ? String(av).localeCompare(String(bv), undefined, { numeric: true })
        : String(bv).localeCompare(String(av), undefined, { numeric: true });
    });
    return copy;
  }, [rows, sort, columns]);

  const totalPages = paginate ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const currentPage = Math.min(page, totalPages);
  const pageRows = paginate
    ? sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : sorted;

  const toggleSort = (key) => {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  };

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="table-wrap">
        <table className={`table ${compact ? "table--compact" : ""}`}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`${c.className || ""} ${c.sortable ? "sortable" : ""}`}
                  onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                >
                  {c.header}
                  {c.sortable && sort.key === c.key && (
                    <span> {sort.dir === "asc" ? "▲" : "▼"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          {loading ? (
            <TableSkeleton rows={6} cols={columns.length} />
          ) : (
            <tbody>
              {pageRows.map((row, i) => (
                <tr key={rowKey(row, i)}>
                  {columns.map((c) => (
                    <td key={c.key} className={c.className || ""}>
                      {c.render ? c.render(row) : row[c.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>

      {!loading && sorted.length === 0 && (
        <EmptyState title={emptyTitle} message={emptyMessage} icon={emptyIcon} />
      )}

      {!loading && paginate && sorted.length > pageSize && (
        <div className="pagination">
          <span>
            {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="pagination__pages">
            <button
              className="btn btn--outline btn--sm"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Prev
            </button>
            <span className="nowrap">
              Page {currentPage} / {totalPages}
            </span>
            <button
              className="btn btn--outline btn--sm"
              disabled={currentPage === totalPages}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
