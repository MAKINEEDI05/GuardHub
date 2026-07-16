// Working-days calculator — the SINGLE source of truth for turning a leave/OD
// date range into an applicable-day count by excluding the employee's configured
// weekly off day(s). Both the Leave and OD modules call this (never their own
// copy), and the frontend mirrors it in GuardHub_Next/src/utils/workingDays.js
// for the live pre-submit preview.
//
// It is deliberately exclusion-agnostic: weekly offs come from the roster today,
// but public/company holidays or shutdown days can be added later by passing a
// `holidays` set of yyyy-mm-dd strings — no caller changes needed.

const { toUtcMidnight } = require("./leaveDays");

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// A roster cell is a weekly off when it reads like "WEEK OFF" (any casing/spacing).
const isWeekOffValue = (v) => {
  const s = String(v || "").trim().toLowerCase();
  return s.includes("week") && s.includes("off");
};

// Weekday indexes (0=Sun..6=Sat) that are the employee's weekly offs, derived
// from a roster's weeklyShifts object. No weekday is ever hardcoded — it comes
// entirely from the roster, so Sunday / Sat-Sun / Friday / etc. all just work.
function weeklyOffIndexesFromRoster(weeklyShifts) {
  const set = new Set();
  if (!weeklyShifts) return set;
  WEEKDAYS.forEach((wd, i) => {
    if (isWeekOffValue(weeklyShifts[wd])) set.add(i);
  });
  return set;
}

const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * Applicable-day breakdown for an inclusive date range.
 *
 * @param {string|Date} fromDate
 * @param {string|Date} toDate
 * @param {object} [options]
 * @param {Set<number>} [options.weeklyOff]  weekday indexes (0=Sun..6=Sat) to exclude
 * @param {Set<string>} [options.holidays]   yyyy-mm-dd dates to exclude (future use)
 * @param {boolean}     [options.halfDay]    a single applicable day counts as 0.5
 * @returns {null | {
 *   totalDays: number,        // calendar days in the range
 *   excludedDays: number,     // weekly-off (+ holiday) days excluded
 *   workingDays: number,      // days that count
 *   actualDays: number,       // workingDays, with the half-day adjustment applied
 *   excludedDates: string[],  // yyyy-mm-dd list of the excluded days
 * }}
 * Returns null for an invalid/reversed range.
 */
function computeApplicableDays(fromDate, toDate, options = {}) {
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
    const key = ymd(ms);
    if (weeklyOff.has(dow) || holidays.has(key)) {
      excludedDays += 1;
      excludedDates.push(key);
    } else {
      workingDays += 1;
    }
  }

  // A half-day request only makes sense on a single applicable day.
  const actualDays = half && workingDays === 1 ? 0.5 : workingDays;

  return { totalDays, excludedDays, workingDays, actualDays, excludedDates };
}

module.exports = {
  computeApplicableDays,
  weeklyOffIndexesFromRoster,
  isWeekOffValue,
  WEEKDAYS,
};
