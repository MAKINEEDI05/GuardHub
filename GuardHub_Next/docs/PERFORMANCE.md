# Performance Report — GuardHub_Next

## Summary

GuardHub_Next is built around the constraint that the system serves **< 500 employees**. The goal was a fast, maintainable app — not a chart-heavy dashboard. Every dependency was chosen for size and every page is code-split.

## Bundle size (production build, gzipped)

| Chunk                        | Raw      | Gzip    |
| ---------------------------- | -------- | ------- |
| react (react/dom/router)     | 165 KB   | 54 KB   |
| @tanstack/react-query        | 40 KB    | 12 KB   |
| vendor (axios/papaparse/zustand) | 66 KB | 25 KB   |
| app entry + CSS              | ~30 KB   | ~9 KB   |
| **Initial load**             |          | **≈ 91 KB** |
| Each page chunk (lazy)       | 1–11 KB  | 0.4–3.8 KB |

For comparison the legacy `Guard_frontend` shipped Bootstrap, Reactstrap, Redux + Saga, ApexCharts, MDBReact, Firebase, two date-picker libraries, jsPDF, xlsx, i18next, styled-components and more — a multi-megabyte bundle. GuardHub_Next ships none of those.

## Techniques applied

### Loading & bundle
- **Route-level code splitting** — every page is `React.lazy`; the router only loads the chunk you navigate to.
- **Manual vendor chunking** (`vite.config.js`) keeps `react`, `query` and `vendor` cacheable across deploys.
- **No icon font** — icons are inline SVG (`components/ui/Icon.jsx`), saving a ~100 KB font request.
- **No UI framework** — styling is plain CSS with design tokens (`styles/tokens.css`).

### Network / data
- **TanStack Query caching** — the employee master list (used by every Apply form, report and roster screen) is fetched once and reused; `staleTime` of 1–5 min prevents refetch storms.
- **Request dedup** — concurrent components requesting the same query key share one in-flight request.
- **`refetchOnWindowFocus: false`** — no surprise refetches when the user tabs back.
- **Targeted cache invalidation** — mutations invalidate only the affected query keys (e.g. applying a leave invalidates `["leaves"]`, not the world).
- **Single axios instance** with a 20 s timeout and a response interceptor that converts errors into friendly messages.

### Rendering
- **Memoized derived data** — search filtering, name lookups (`empId → name` maps) and table sorting use `useMemo`, so typing in a search box doesn't recompute everything or re-fetch.
- **Client-side pagination** in `DataTable` (default 12–15 rows/page) keeps the DOM small without needing virtualization at this data scale.
- **Lazy `<img loading="lazy">`** on every avatar.

### UX while loading
- **Skeleton loaders** for tables, cards and KPIs (no white screens).
- **Empty states** with meaningful copy on every list.
- **Compact toasts** (custom, no library) — success/warning/error, auto-dismiss, no spam.

## Why not virtualization?
With < 500 rows and pagination, a virtualized list adds complexity and a dependency for no measurable gain. The `DataTable` is structured so a virtualized body could be dropped in later if the dataset grows, but it is intentionally not used now.

## Measured
- Production build: **~2.4 s**.
- Vite dev server cold start: **~340 ms**.
- Initial JS parse/eval is dominated by React itself; app code is < 10 KB gz on first paint.
