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

// Shared message for any attendance screen that is asked for a future date.
// Keep this in sync with the backend (Guard_backend uses the same wording).
export const FUTURE_DATE_MESSAGE =
  "Attendance data is not available for future dates.";

// True when `value` (a yyyy-mm-dd string or Date) is strictly after today.
// Attendance only exists up to and including today, so future dates are invalid.
export function isFutureYmd(value) {
  const ymd = typeof value === "string" ? value : toYmd(value);
  if (!ymd) return false;
  return ymd > todayYmd();
}

// Never let a yyyy-mm-dd value point past today.
export function clampToToday(value) {
  return isFutureYmd(value) ? todayYmd() : value;
}

// Current month range as yyyy-mm-dd, with the end clamped to today so the
// default never selects future dates (attendance has no data for them).
export function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: toYmd(start), end: clampToToday(toYmd(end)) };
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

// Like formatDate but using the LOCAL calendar day (no forced UTC), so it
// matches the value the date-picker shows via toYmd(). Use this for dates that
// were stored as local-midnight timestamps (e.g. roster effective dates parsed
// from a CSV by the server's `new Date(...)`): formatting those in UTC renders
// the previous day for any timezone ahead of UTC, which made the roster table
// disagree with the Edit modal. Building from the same local components keeps
// every surface consistent.
export function formatDateLocal(value) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
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
