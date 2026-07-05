// Leave-day math, kept in one place so the transaction controller, reports and
// (later) the salary engine all count leave the same way.
//
// Current policy: inclusive calendar days between fromDate and toDate. A single
// day marked FIRST HALF / SECOND HALF counts as 0.5. This is intentionally
// simple and self-contained; when a holidays/week-off master is introduced,
// only this function changes (nothing downstream computes days itself).

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Parse a yyyy-mm-dd string (or Date) to a UTC-midnight Date, matching how the
// backend stores dates everywhere else. Returns null if unparseable.
function toUtcMidnight(value) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
    );
  }
  const s = String(value).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Inclusive whole-day span. Returns null on bad/reversed input.
function inclusiveDaySpan(fromDate, toDate) {
  const f = toUtcMidnight(fromDate);
  const t = toUtcMidnight(toDate);
  if (!f || !t) return null;
  if (t < f) return null;
  return Math.round((t - f) / MS_PER_DAY) + 1;
}

// Number of leave days a request consumes.
//   dayType FIRST HALF / SECOND HALF on a single-day request => 0.5
//   otherwise => inclusive calendar-day count.
function computeLeaveDays(fromDate, toDate, dayType) {
  const span = inclusiveDaySpan(fromDate, toDate);
  if (span === null) return null;
  const half = /HALF/i.test(String(dayType || ""));
  if (half && span === 1) return 0.5;
  return span;
}

module.exports = { computeLeaveDays, inclusiveDaySpan, toUtcMidnight };
