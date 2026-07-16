// Roster helpers shared by the Apply OD / Apply OT "current shift" auto-fill.
// A roster's weeklyShifts is keyed by lowercase weekday (sunday..saturday); the
// value is a shift label like "General" / "A Shift" / "WEEK OFF".

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// The employee's rostered shift for a yyyy-mm-dd date ("" when unknown). Dates
// are read at UTC midnight to match how the backend stores/compares them.
export function shiftForDate(weeklyShifts, ymd) {
  if (!weeklyShifts || !ymd) return "";
  const d = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return weeklyShifts[WEEKDAYS[d.getUTCDay()]] || "";
}
