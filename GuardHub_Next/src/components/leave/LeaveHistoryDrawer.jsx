import Drawer from "../ui/Drawer";
import Badge from "../ui/Badge";
import { EmptyState } from "../ui/States";
import { useLeaveTransactions, useLeaveBalances } from "../../hooks/useLeaveV2";
import { formatDate } from "../../utils/date";

// Leave Report drill-down. Opens over the report (no navigation): employee info
// + yearly summary + full leave history for the selected employee/year. Reuses
// the existing Leave Transaction + Balance APIs — no new business logic.
//
// props: { emp: {empId, empName, empDepartment, empDesignation} | null, year, onClose }
export default function LeaveHistoryDrawer({ emp, year, onClose }) {
  const open = !!emp;
  const empId = emp?.empId;

  // Only fetch when open (enabled avoids background calls for a closed drawer).
  const { data: history = [], isLoading: histLoading } = useLeaveTransactions(
    { empId, year },
    { enabled: open }
  );
  const { data: bal } = useLeaveBalances(year, empId, { enabled: open });
  const totals = bal?.data?.[0]?.totals || { allocated: 0, used: 0, remaining: 0 };

  // API already returns newest-first; guard anyway.
  const rows = [...history].sort(
    (a, b) => new Date(b.fromDate) - new Date(a.fromDate)
  );

  return (
    <Drawer open={open} title="Leave Details" onClose={onClose} width={640}>
      {emp && (
        <>
          {/* Employee Information */}
          <section className="stack" style={{ gap: 4, marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{emp.empName}</div>
            <div className="text-sm muted">
              ID {emp.empId}
              {emp.empDepartment ? ` · ${emp.empDepartment}` : ""}
              {emp.empDesignation ? ` · ${emp.empDesignation}` : ""}
            </div>
          </section>

          {/* Leave Summary */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
              marginBottom: 20,
            }}
          >
            <SummaryTile label="Allocated" value={totals.allocated} />
            <SummaryTile label="Used" value={totals.used} />
            <SummaryTile label="Remaining" value={totals.remaining} strong />
          </section>

          {/* Leave History */}
          <div className="text-sm muted" style={{ marginBottom: 8, fontWeight: 600 }}>
            Leave History · {year}
          </div>
          {histLoading ? (
            <div className="skeleton" style={{ height: 120 }} />
          ) : rows.length === 0 ? (
            <EmptyState icon="🌴" title="No leave records" message="This employee has no leave in the selected year." />
          ) : (
            <div className="table-wrap">
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th>From – To</th>
                    <th>Type</th>
                    <th className="num">Days</th>
                    <th>Duration</th>
                    <th>Reason</th>
                    <th>Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l) => (
                    <tr key={l._id}>
                      <td className="nowrap">
                        {formatDate(l.fromDate)} – {formatDate(l.toDate)}
                      </td>
                      <td><Badge status="leave">{l.leaveTypeName}</Badge></td>
                      <td className="num"><strong>{l.days}</strong></td>
                      <td>{l.dayType || "—"}</td>
                      <td><span title={l.reason}>{(l.reason || "—").slice(0, 28)}</span></td>
                      <td>
                        <Badge status={l.isPaid ? "present" : "absent"}>
                          {l.isPaid ? "Paid" : "Unpaid"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}

function SummaryTile({ label, value, strong }) {
  return (
    <div className="card" style={{ padding: "12px 14px" }}>
      <div className="text-sm muted">{label}</div>
      <div style={{ fontSize: 22, fontWeight: strong ? 800 : 600 }}>{value}</div>
    </div>
  );
}
