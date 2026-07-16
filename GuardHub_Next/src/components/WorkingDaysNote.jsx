// Shows the applicable-day breakdown for a leave/OD date range: total calendar
// days, weekly-off days excluded, and the actual chargeable days — the same
// figure stored on submit. Used by Apply Leave and Apply OD so both present the
// calculation identically. Pure presentation over a computeApplicableDays result.
//
// props: { calc: {totalDays,excludedDays,actualDays,excludedDates} | null,
//          noun: "leave" | "OD", error?: string }
export default function WorkingDaysNote({ calc, noun = "leave", error }) {
  if (!calc) return null;

  // Entire range is weekly off -> nothing to apply (submission is blocked).
  if (calc.actualDays <= 0) {
    return (
      <div
        className="text-sm"
        style={{
          margin: "6px 0 0",
          padding: "8px 10px",
          borderRadius: 8,
          fontWeight: 600,
          color: "var(--danger, #dc2626)",
          background: "var(--danger-soft, rgba(220,38,38,0.08))",
        }}
      >
        {error ||
          `All selected dates are weekly off days for this employee — no ${noun} days to apply.`}
      </div>
    );
  }

  return (
    <p className="text-sm muted" style={{ margin: "6px 0 0" }}>
      This {noun} counts as <strong>{calc.actualDays}</strong> day(s)
      {" — "}
      {calc.totalDays} calendar day(s)
      {calc.excludedDays > 0
        ? `, minus ${calc.excludedDays} weekly off day(s)`
        : ", no weekly off days in range"}
      .
    </p>
  );
}
