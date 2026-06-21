// Option sets used across forms. These mirror exactly what the backend
// validates/accepts — do not change casing without checking the controllers.

// Leave types (free strings on the backend; these are the app's canonical set).
export const LEAVE_TYPES = ["Casual Leave", "Sick Leave", "Earned Leave"];

// Shift types used by Leave/OD forms (empShiftType).
export const SHIFT_TYPES = [
  "General",
  "Shift A",
  "Shift B",
  "Shift C",
  "Summer Vacation",
];

// Duration / half-day selector for Leave & OD (empOdType).
export const DAY_TYPES = ["FULL DAY", "FIRST HALF", "SECOND HALF"];

// OT shifts — MUST match otScheme enum exactly.
export const OT_SHIFTS = ["General", "A Shift", "B Shift", "C Shift"];

// OT durations — MUST match otScheme enum exactly.
export const OT_DURATIONS = [
  "4 Hours (Half Day)",
  "8 Hours (Full Day)",
  "Double Shift",
];

// OT statuses — MUST match otScheme enum exactly.
export const OT_STATUSES = ["Pending", "Approved", "Rejected"];

// Roster shift values. The backend bulk-upload normalises many synonyms, but
// these are the canonical values stored and shown in the grid.
export const ROSTER_SHIFTS = [
  "General",
  "A Shift",
  "B Shift",
  "C Shift",
  "WEEK OFF",
];

// Curated DESIGNATION / DEPARTMENT master lists. These are the single source of
// truth for the selectable options everywhere (Add/Edit employee, filters,
// etc.). We deliberately do NOT generate options from raw MongoDB values —
// that pulled in typos, test entries, duplicates and legacy names. Admins may
// still save a custom value via the "Other" path, but it is NOT added to these
// lists. Existing records carrying off-list values still display correctly.
export const DESIGNATIONS = [
  "Security Officer",
  "Asst. Security Officer",
  "Head Guard",
  "Security Guard",
  "Shift Incharge",
  "AVT Supervisor",
  "AVT Head Guard",
  "AVT Guard",
  "Lady Head Guard",
  "Lady Guard",
];

export const DEPARTMENTS = ["Security", "AVT Security", "Lady Security"];

// Weekday keys exactly as stored in roster.weeklyShifts (lowercase).
export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export const WEEKDAY_LABEL = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

// Map a shift/status string to a status-color token (see tokens.css).
export function shiftStatusClass(value) {
  const v = String(value || "").toLowerCase();
  if (v.includes("week") && v.includes("off")) return "status--weekoff";
  if (v.includes("present")) return "status--present";
  if (v.includes("leave")) return "status--leave";
  if (v.includes("absent")) return "status--absent";
  if (v.includes("od")) return "status--od";
  return "status--neutral";
}

// Roster grid shift colors (soft): GEN green, A blue, B orange, C purple, OFF gray.
export function rosterShiftClass(value) {
  const v = String(value || "").toLowerCase();
  if (v.includes("week") && v.includes("off")) return "shift--off";
  if (v.includes("general")) return "shift--gen";
  if (/^a\s*shift|shift\s*a/.test(v)) return "shift--a";
  if (/^b\s*shift|shift\s*b/.test(v)) return "shift--b";
  if (/^c\s*shift|shift\s*c/.test(v)) return "shift--c";
  return "shift--neutral";
}

// Short label for a roster shift cell: GEN / A / B / C / OFF.
export function shiftShort(value) {
  const s = String(value || "");
  if (/week\s*off/i.test(s)) return "OFF";
  if (/general/i.test(s)) return "GEN";
  const m = s.match(/^([abc])\s*shift|shift\s*([abc])/i);
  if (m) return (m[1] || m[2]).toUpperCase();
  return s.slice(0, 4) || "—";
}
