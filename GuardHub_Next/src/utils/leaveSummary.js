// Reusable aggregation helpers for the employee summary shown on Apply Leave.
// Pure functions over the records the existing OT/OD endpoints already return —
// no duplicated business logic, no extra endpoints.

// OT working-duration -> days (the OT schema stores a coarse enum, not a number).
export const OT_DURATION_DAYS = {
  "4 Hours (Half Day)": 0.5,
  "8 Hours (Full Day)": 1,
  "Double Shift": 2,
};
export const otRecordDays = (r) => OT_DURATION_DAYS[r?.workingDuration] ?? 1;

// Inclusive whole-day span between two dates (UTC), 0 if invalid/reversed.
export function inclusiveDays(from, to) {
  if (!from || !to) return 0;
  const f = new Date(from);
  const t = new Date(to);
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return 0;
  const fu = Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate());
  const tu = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  if (tu < fu) return 0;
  return Math.round((tu - fu) / 86400000) + 1;
}

// OT summary. `compOff` = days earned from OT. There is no approval workflow —
// recording an OT entry means the overtime was worked, so EVERY entry earns Comp
// Off (req 3). Derived, read-only figure from existing data.
export function computeOtSummary(records = []) {
  let totalDays = 0;
  for (const r of records) totalDays += otRecordDays(r);
  return { entries: records.length, totalDays, compOff: totalDays };
}

// OD summary (entries + total inclusive OD days).
export function computeOdSummary(records = []) {
  let totalDays = 0;
  for (const r of records) totalDays += inclusiveDays(r?.empFromDate, r?.empToDate);
  return { entries: records.length, totalDays };
}

// Most-recent item by a date field (createdAt first, then a fallback field).
export function mostRecent(records = [], fallbackField) {
  if (!records.length) return null;
  return [...records].sort((a, b) => {
    const da = new Date(a.createdAt || a[fallbackField] || 0);
    const db = new Date(b.createdAt || b[fallbackField] || 0);
    return db - da;
  })[0];
}
