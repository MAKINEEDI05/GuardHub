// Date helpers. The backend stores dates as UTC midnight and the report/
// attendance endpoints expect plain `yyyy-mm-dd` strings, so we always work in
// that format to stay timezone-consistent with the server.

export function toYmd(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  // Use local components so the picker value the user sees is the value sent.
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function todayYmd() {
  return toYmd(new Date());
}

// First and last day of the current month as yyyy-mm-dd.
export function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: toYmd(start), end: toYmd(end) };
}

// Human-friendly date for tables, e.g. "12 Jun 2026". Accepts ISO strings.
export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Relative-ish timestamp for activity feeds, e.g. "12 Jun, 14:30".
export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
