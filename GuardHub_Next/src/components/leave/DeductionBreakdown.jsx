// Deduction Breakdown (req 5) — shows how a leave's days are funded: Casual Leave
// first, then Comp Off, with any unfunded remainder as a negative balance. Pure
// presentation over a `deduction` object from utils/leaveDeduction.computeDeduction;
// it updates instantly as the parent recomputes on type/duration/date changes.
//
// props: { days, deduction, clRemaining, compRemaining }
export default function DeductionBreakdown({ days, deduction, clRemaining, compRemaining }) {
  if (!deduction) return null;
  const { clUsed, compUsed, lopDays, remainingCl, remainingComp } = deduction;

  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="row row--between" style={{ marginBottom: 8 }}>
        <span className="text-sm muted" style={{ fontWeight: 600 }}>Requested Leave</span>
        <strong>{days} day(s)</strong>
      </div>

      <div className="table-wrap">
        <table className="table table--compact">
          <thead>
            <tr><th>Bucket</th><th className="num">Available</th><th className="num">Used</th><th className="num">Remaining</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Casual Leave (CL)</td>
              <td className="num">{Math.max(0, clRemaining)}</td>
              <td className="num"><strong>{clUsed}</strong></td>
              <td className="num">{remainingCl}</td>
            </tr>
            <tr>
              <td>Comp Off</td>
              <td className="num">{Math.max(0, compRemaining)}</td>
              <td className="num"><strong>{compUsed}</strong></td>
              <td className="num">{remainingComp}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {lopDays > 0 && (
        <div
          className="text-sm"
          style={{
            marginTop: 8,
            padding: "8px 10px",
            borderRadius: 8,
            fontWeight: 600,
            color: "var(--danger, #dc2626)",
            background: "var(--danger-soft, rgba(220,38,38,0.08))",
          }}
        >
          Insufficient balance — {lopDays} day(s) exceed CL + Comp Off.
          Negative balance: <strong>-{lopDays}</strong>. The leave will still be recorded.
        </div>
      )}
    </div>
  );
}
