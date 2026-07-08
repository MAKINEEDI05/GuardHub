import { useState } from "react";
import Drawer from "../ui/Drawer";
import Badge from "../ui/Badge";
import Icon from "../ui/Icon";
import ConfirmDialog from "../ui/ConfirmDialog";
import { EmptyState } from "../ui/States";
import LeaveEditDrawer from "./LeaveEditDrawer";
import { useLeaveTransactions, useDeleteLeaveTxn } from "../../hooks/useLeaveV2";
import { formatDate, formatDateTime } from "../../utils/date";
import { buildLeaveDetail } from "../../utils/leaveDetail";

// Unified Employee Leave details drawer. EVERYTHING here respects the currently
// applied filters: the summary + balance-by-type come from the (already filtered)
// summary row, and the history is fetched with the SAME filters — so the drawer
// and the CSV export always agree. Inline edit/delete let the admin manage the
// employee's leaves without leaving the page.
//
// props: { emp: summaryRow | null, filters, onClose }
export default function LeaveDetailsDrawer({ emp, filters = {}, onClose }) {
  const open = !!emp;
  const empId = emp?.empId;
  const del = useDeleteLeaveTxn();
  const [editTxn, setEditTxn] = useState(null);
  const [delTxn, setDelTxn] = useState(null);

  const { data: history = [], isLoading } = useLeaveTransactions(
    { ...filters, empId },
    { enabled: open }
  );
  // Shape via the shared formatter so the drawer and the CSV export render the
  // exact same summary / balance-by-type / history.
  const detail = buildLeaveDetail(emp, history, filters?.year);
  const rows = detail.history;

  return (
    <>
      <Drawer open={open} title="Employee Leave Details" onClose={onClose} width={720}>
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

            {/* Overall Summary (filtered) */}
            <section style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
              <Tile label="Allocated" value={detail.summary.allocated} />
              <Tile label="Used" value={detail.summary.used} />
              <Tile label="Remaining" value={detail.summary.remaining} strong />
            </section>

            {/* Leave Balance by Type (filtered) */}
            <div className="text-sm muted" style={{ margin: "4px 0 6px", fontWeight: 600 }}>Leave Balance by Type</div>
            <div className="table-wrap" style={{ marginBottom: 18 }}>
              <table className="table table--compact">
                <thead><tr><th>Type</th><th className="num">Allocated</th><th className="num">Used</th><th className="num">Remaining</th></tr></thead>
                <tbody>
                  {detail.byType.length === 0 && <tr><td colSpan={4} className="muted">No leave types.</td></tr>}
                  {detail.byType.map((b) => (
                    <tr key={b.leaveTypeCode}>
                      <td>{b.leaveTypeName}</td>
                      <td className="num">{b.allocated}</td>
                      <td className="num">{b.used}</td>
                      <td className="num"><strong>{b.remaining}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Leave History (filtered, newest first) */}
            <div className="text-sm muted" style={{ margin: "4px 0 6px", fontWeight: 600 }}>Leave History</div>
            {isLoading ? (
              <div className="skeleton" style={{ height: 120 }} />
            ) : rows.length === 0 ? (
              <EmptyState icon="🌴" title="No leave records" message="No leaves match the current filters." />
            ) : (
              <div className="table-wrap">
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th>Type</th><th>From</th><th>To</th><th className="num">Days</th>
                      <th>Duration</th><th>Reason</th><th>Created</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((l) => (
                      <tr key={l._id}>
                        <td><Badge status="leave">{l.leaveTypeName}</Badge></td>
                        <td className="nowrap">{formatDate(l.fromDate)}</td>
                        <td className="nowrap">{formatDate(l.toDate)}</td>
                        <td className="num"><strong>{l.days}</strong></td>
                        <td>{l.dayType || "—"}</td>
                        <td><span title={l.reason}>{(l.reason || "—").slice(0, 24)}</span></td>
                        <td className="nowrap text-sm muted">{formatDateTime(l.createdAt)}</td>
                        <td className="num">
                          <div style={{ display: "inline-flex", gap: 2 }}>
                            <button className="btn btn--ghost btn--icon" title="Edit" aria-label="Edit leave" onClick={() => setEditTxn(l)}>
                              <Icon name="edit" size={15} />
                            </button>
                            <button className="btn btn--ghost btn--icon" title="Delete" aria-label="Delete leave" onClick={() => setDelTxn(l)}>
                              <Icon name="trash" size={15} />
                            </button>
                          </div>
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

      <LeaveEditDrawer txn={editTxn} onClose={() => setEditTxn(null)} />
      <ConfirmDialog
        open={!!delTxn}
        title="Delete leave record?"
        message={delTxn ? `Delete this ${delTxn.leaveTypeName} (${delTxn.days} day(s))? This restores the balance.` : ""}
        confirmLabel="Delete"
        loading={del.isPending}
        onCancel={() => setDelTxn(null)}
        onConfirm={async () => { await del.mutateAsync(delTxn._id); setDelTxn(null); }}
      />
    </>
  );
}

function Tile({ label, value, strong }) {
  return (
    <div className="card" style={{ padding: "12px 14px" }}>
      <div className="text-sm muted">{label}</div>
      <div style={{ fontSize: 22, fontWeight: strong ? 800 : 600 }}>{value}</div>
    </div>
  );
}
