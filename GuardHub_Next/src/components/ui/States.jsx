// Loading / empty / error presentational helpers, kept together.

export function Spinner({ dark }) {
  return <span className={`spinner ${dark ? "spinner--dark" : ""}`} />;
}

export function EmptyState({ icon = "📭", title = "Nothing here yet", message }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">{icon}</div>
      <div className="empty-state__title">{title}</div>
      {message && <div className="text-sm">{message}</div>}
    </div>
  );
}

export function ErrorState({ message = "Failed to load data.", onRetry }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">⚠️</div>
      <div className="empty-state__title">Something went wrong</div>
      <div className="text-sm">{message}</div>
      {onRetry && (
        <button className="btn btn--outline btn--sm mt-4" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

// Skeleton table body — n rows x cols shimmering placeholders.
export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c}>
              <div className="skeleton skeleton-row" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

// Block skeleton for cards/KPIs.
export function BlockSkeleton({ height = 80 }) {
  return <div className="skeleton" style={{ height }} />;
}
