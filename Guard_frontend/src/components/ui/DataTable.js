import React from "react";
import PropTypes from "prop-types";
import SearchInput from "./SearchInput";
import LoadingState from "./LoadingState";
import EmptyState from "./EmptyState";

// Compare helper that handles numbers, strings and null/undefined.
const compareValues = (a, b) => {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
};

// Flagship client-side table: sorting, search and pagination.
const DataTable = ({
  columns,
  data,
  loading,
  emptyText,
  pageSize,
  searchable,
  searchKeys,
  stickyHeader,
  className,
  ...rest
}) => {
  const [sort, setSort] = React.useState({ key: null, dir: "asc" });
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(0);

  const handleSort = (col) => {
    if (!col.sortable) return;
    setSort((prev) => {
      if (prev.key === col.key) {
        return { key: col.key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key: col.key, dir: "asc" };
    });
    setPage(0);
  };

  // Filtering by searchKeys (or every column key when none specified).
  const filtered = React.useMemo(() => {
    const rows = Array.isArray(data) ? data : [];
    if (!searchable || !query.trim()) return rows;
    const keys =
      searchKeys && searchKeys.length
        ? searchKeys
        : columns.map((c) => c.key);
    const q = query.trim().toLowerCase();
    return rows.filter((row) =>
      keys.some((k) => {
        const val = row[k];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, searchable, query, searchKeys, columns]);

  const sorted = React.useMemo(() => {
    if (!sort.key) return filtered;
    const copy = [...filtered];
    copy.sort((ra, rb) => {
      const res = compareValues(ra[sort.key], rb[sort.key]);
      return sort.dir === "asc" ? res : -res;
    });
    return copy;
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const paged = React.useMemo(() => {
    const start = safePage * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, safePage, pageSize]);

  const colCount = columns.length || 1;

  return (
    <div className={`gh-data-table${className ? ` ${className}` : ""}`} {...rest}>
      {searchable && (
        <div className="gh-data-table__toolbar">
          <SearchInput
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            onClear={() => {
              setQuery("");
              setPage(0);
            }}
          />
        </div>
      )}

      <div className="gh-data-table__scroll">
        <table
          className={`gh-data-table__table${
            stickyHeader ? " gh-data-table__table--sticky" : ""
          }`}
        >
          <thead>
            <tr>
              {columns.map((col) => {
                const active = sort.key === col.key;
                return (
                  <th
                    key={col.key}
                    style={{
                      width: col.width,
                      textAlign: col.align || "left",
                    }}
                    className={`${col.sortable ? "gh-th--sortable" : ""}${
                      active ? " gh-th--active" : ""
                    }`}
                    onClick={() => handleSort(col)}
                  >
                    <span className="gh-th__label">
                      {col.header}
                      {col.sortable && (
                        <span className="gh-th__caret" aria-hidden="true">
                          {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colCount} className="gh-data-table__state">
                  <LoadingState rows={pageSize} />
                </td>
              </tr>
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="gh-data-table__state">
                  <EmptyState title={emptyText} />
                </td>
              </tr>
            ) : (
              paged.map((row, ri) => (
                <tr key={row.id != null ? row.id : ri}>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={{ textAlign: col.align || "left" }}
                    >
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && sorted.length > 0 && (
        <div className="gh-pagination">
          <span className="gh-pagination__info">
            {safePage * pageSize + 1}–
            {Math.min((safePage + 1) * pageSize, sorted.length)} of{" "}
            {sorted.length}
          </span>
          <div className="gh-pagination__controls">
            <button
              type="button"
              className="gh-pagination__btn"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
            >
              <i className="mdi mdi-chevron-left" /> Prev
            </button>
            <span className="gh-pagination__indicator">
              Page {safePage + 1} of {pageCount}
            </span>
            <button
              type="button"
              className="gh-pagination__btn"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
            >
              Next <i className="mdi mdi-chevron-right" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

DataTable.propTypes = {
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      header: PropTypes.node,
      sortable: PropTypes.bool,
      render: PropTypes.func,
      width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      align: PropTypes.oneOf(["left", "center", "right"]),
    })
  ),
  data: PropTypes.array,
  loading: PropTypes.bool,
  emptyText: PropTypes.string,
  pageSize: PropTypes.number,
  searchable: PropTypes.bool,
  searchKeys: PropTypes.arrayOf(PropTypes.string),
  stickyHeader: PropTypes.bool,
  className: PropTypes.string,
};

DataTable.defaultProps = {
  columns: [],
  data: [],
  loading: false,
  emptyText: "No records found",
  pageSize: 10,
  searchable: false,
  searchKeys: [],
  stickyHeader: true,
};

export default DataTable;
