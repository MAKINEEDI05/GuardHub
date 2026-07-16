import { useLeaveBalances, useLeaveTransactions } from "../../hooks/useLeaveV2";
import { useOtByEmp } from "../../hooks/useOts";
import { useOdByEmp } from "../../hooks/useOds";
import { BlockSkeleton } from "../ui/States";
import { formatDate } from "../../utils/date";
import { computeOtSummary, computeOdSummary, mostRecent } from "../../utils/leaveSummary";

// Complete leave position for one employee, shown on Apply Leave once an
// employee is selected. Reuses existing endpoints (leave balances, OT-by-emp,
// OD-by-emp) — no new APIs, no duplicated calculations. Compact cards in the
// existing GuardHub design system.
//
// props: { emp, year, selectedTypeCode?, projectedDays? }
export default function EmployeeLeaveSummary({ emp, year, selectedTypeCode, projectedDays }) {
  const empId = emp?.empId;
  const { data: bal, isLoading: balLoading } = useLeaveBalances(year, empId, { enabled: !!empId });
  const { data: otRecords = [] } = useOtByEmp(empId);
  const { data: odRecords = [] } = useOdByEmp(empId);
  const { data: leaveTxns = [] } = useLeaveTransactions({ empId, year }, { enabled: !!empId });

  const row = bal?.data?.[0];
  const totals = row?.totals || { allocated: 0, used: 0, remaining: 0 };
  const byType = row?.byType || [];

  const ot = computeOtSummary(otRecords);
  const od = computeOdSummary(odRecords);

  // Comp Off comes through the balance as the COMP type: allocated = earned from
  // OT (every entry, derived server-side), used = Comp Off portion of leaves taken.
  const comp = byType.find((b) => b.leaveTypeCode === "COMP");
  const compAvail = comp ? comp.remaining : ot.compOff;
  const compSelected = selectedTypeCode === "COMP";

  const lastLeave = mostRecent(leaveTxns, "fromDate");
  const lastOt = mostRecent(otRecords, "fromDate");
  const lastOd = mostRecent(odRecords, "empFromDate");

  if (balLoading) {
    return <div style={{ marginTop: 12 }}><BlockSkeleton height={220} /></div>;
  }

  return (
    <div className="stack" style={{ gap: 12, marginTop: 12 }}>
      {/* Overall Summary */}
      <div className="card" style={{ padding: 12 }}>
        <div className="text-sm muted" style={{ fontWeight: 600, marginBottom: 8 }}>Leave Summary · {year}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          <Stat label="Allocated" value={totals.allocated} />
          <Stat label="Used" value={totals.used} />
          <Stat label="Remaining" value={totals.remaining} strong />
        </div>
      </div>

      {/* Leave Balance by Type */}
      <div className="card" style={{ padding: 12 }}>
        <div className="text-sm muted" style={{ fontWeight: 600, marginBottom: 6 }}>Leave Balance by Type</div>
        <div className="table-wrap">
          <table className="table table--compact">
            <thead><tr><th>Type</th><th className="num">Alloc</th><th className="num">Used</th><th className="num">Rem</th></tr></thead>
            <tbody>
              {byType.length === 0 && <tr><td colSpan={4} className="muted text-sm">No allocation yet.</td></tr>}
              {byType.map((b) => {
                const sel = selectedTypeCode && b.leaveTypeCode === selectedTypeCode;
                return (
                  <tr key={b.leaveTypeCode} style={sel ? { background: "var(--surface-2, rgba(0,0,0,0.04))" } : undefined}>
                    <td>{b.leaveTypeName}{sel ? " •" : ""}</td>
                    <td className="num">{b.allocated}</td>
                    <td className="num">{b.used}</td>
                    <td className="num">
                      <strong>{b.remaining}</strong>
                      {sel && projectedDays != null && (
                        <span className="text-sm muted" style={{ fontWeight: 400 }}> → {b.remaining - projectedDays}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* OT + OD Summary (side by side) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div className="text-sm muted" style={{ fontWeight: 600, marginBottom: 8 }}>OT / Comp Off</div>
          <MiniRow label="OT Entries" value={ot.entries} />
          <MiniRow label="OT Days" value={ot.totalDays} />
          <MiniRow label="Earned" value={comp ? comp.allocated : ot.compOff} hint="from OT" />
          <MiniRow label="Used" value={comp ? comp.used : 0} />
          <MiniRow
            label="Comp Off Avail"
            strong
            value={
              compSelected && projectedDays != null
                ? `${compAvail} → ${compAvail - projectedDays}`
                : compAvail
            }
          />
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div className="text-sm muted" style={{ fontWeight: 600, marginBottom: 8 }}>OD Summary</div>
          <MiniRow label="Entries" value={od.entries} />
          <MiniRow label="OD Days" value={od.totalDays} />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card" style={{ padding: 12 }}>
        <div className="text-sm muted" style={{ fontWeight: 600, marginBottom: 8 }}>Recent Activity</div>
        <MiniRow label="Last Leave" value={lastLeave ? `${lastLeave.leaveTypeName} · ${formatDate(lastLeave.fromDate)}` : "—"} />
        <MiniRow label="Last OT" value={lastOt ? `${lastOt.workingDuration || "OT"} · ${formatDate(lastOt.fromDate)}` : "—"} />
        <MiniRow label="Last OD" value={lastOd ? formatDate(lastOd.empFromDate) : "—"} />
      </div>
    </div>
  );
}

function Stat({ label, value, strong }) {
  return (
    <div>
      <div className="text-sm muted">{label}</div>
      <div style={{ fontSize: 20, fontWeight: strong ? 800 : 600 }}>{value}</div>
    </div>
  );
}

function MiniRow({ label, value, hint, strong }) {
  return (
    <div className="row row--between" style={{ padding: "3px 0" }}>
      <span className="text-sm muted">{label}{hint ? <span style={{ opacity: 0.7 }}> ({hint})</span> : ""}</span>
      <span style={{ fontWeight: strong ? 700 : 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}
