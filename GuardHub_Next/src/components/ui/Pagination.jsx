import Icon from "./Icon";

// Server-side pagination footer: range summary, page-size select, prev/next,
// and current-page indicator. Purely presentational — parent owns the state.
export default function Pagination({
  page,
  pageSize,
  total = 0,
  totalPages = 1,
  onPageChange,
  onPageSizeChange,
  pageSizes = [20, 50, 100],
  busy = false,
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="pagination">
      <div className="pagination__info muted text-sm">
        {total === 0
          ? "No records"
          : `Showing ${from}–${to} of ${total} employee${total === 1 ? "" : "s"}`}
      </div>

      <div className="pagination__controls">
        {onPageSizeChange && (
          <label className="pagination__size text-sm muted">
            Rows
            <select
              className="select"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              disabled={busy}
              style={{ width: "auto" }}
            >
              {pageSizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="pagination__nav">
          <button
            className="btn btn--outline btn--sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || busy}
            aria-label="Previous page"
          >
            <Icon name="chevron-left" size={16} /> Prev
          </button>
          <span className="pagination__page text-sm">
            Page <strong>{page}</strong> of {totalPages}
          </span>
          <button
            className="btn btn--outline btn--sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || busy}
            aria-label="Next page"
          >
            Next <Icon name="chevron-right" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
