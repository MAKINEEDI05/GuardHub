// Client mirror of the backend working-days calculator
// (Guard_backend/utils/workingDays.js) — used for the live pre-submit preview on
// Apply Leave / Apply OD. The backend is authoritative on save; keep the two in
// lock-step. Exclusions are weekly offs today; a `holidays` set (yyyy-mm-dd) can
// be added later without changing callers.

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// A roster cell is a weekly off when it reads like "WEEK OFF" (any casing).
export const isWeekOffValue = (v) => {
  const s = String(v || "").trim().toLowerCase();
  return s.includes("week") && s.includes("off");
};

// Weekday indexes (0=Sun..6=Sat) that are the employee's weekly offs, from their
// roster's weeklyShifts. No weekday is hardcoded — it comes from the roster.
export function weeklyOffIndexesFromRoster(weeklyShifts) {
  const set = new Set();
  if (!weeklyShifts) return set;
  WEEKDAYS.forEach((wd, i) => {
    if (isWeekOffValue(weeklyShifts[wd])) set.add(i);
  });
  return set;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// yyyy-mm-dd -> UTC midnight (null if invalid), matching the backend.
function toUtcMidnight(ymd) {
  if (!ymd) return null;
  const d = new Date(`${String(ymd).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
const keyOf = (ms) => new Date(ms).toISOString().slice(0, 10);

// Applicable-day breakdown for an inclusive range. Returns null for a bad range.
//   { totalDays, excludedDays, workingDays, actualDays, excludedDates }
export function computeApplicableDays(fromDate, toDate, options = {}) {
  const weeklyOff = options.weeklyOff instanceof Set ? options.weeklyOff : new Set();
  const holidays = options.holidays instanceof Set ? options.holidays : new Set();
  const half = !!options.halfDay;

  const f = toUtcMidnight(fromDate);
  const t = toUtcMidnight(toDate);
  if (!f || !t || t < f) return null;

  let totalDays = 0;
  let excludedDays = 0;
  let workingDays = 0;
  const excludedDates = [];

  for (let ms = f.getTime(); ms <= t.getTime(); ms += MS_PER_DAY) {
    totalDays += 1;
    const dow = new Date(ms).getUTCDay();
    const key = keyOf(ms);
    if (weeklyOff.has(dow) || holidays.has(key)) {
      excludedDays += 1;
      excludedDates.push(key);
    } else {
      workingDays += 1;
    }
  }

  const actualDays = half && workingDays === 1 ? 0.5 : workingDays;
  return { totalDays, excludedDays, workingDays, actualDays, excludedDates };
}
