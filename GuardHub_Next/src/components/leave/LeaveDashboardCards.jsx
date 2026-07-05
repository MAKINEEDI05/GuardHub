import { useState } from "react";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Icon from "../ui/Icon";
import Drawer from "../ui/Drawer";
import { BlockSkeleton, EmptyState } from "../ui/States";
import { useLeaveDashboardOverview } from "../../hooks/useLeaveV2";
import { LOW_LEAVE_BALANCE_THRESHOLD } from "../../utils/constants";
import { formatDate } from "../../utils/date";

// Two operational widgets for the dashboard, powered by ONE reused endpoint
// (/leave/dashboard-overview): "Employees On Leave Today" (click -> drawer of
// who's out) and "Low Leave Balance" (remaining <= configurable threshold).
export default function LeaveDashboardCards() {
  const year = new Date().getFullYear();
  const threshold = LOW_LEAVE_BALANCE_THRESHOLD; // configurable in constants.js
  const { data, isLoading } = useLeaveDashboardOverview(year, threshold);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const onLeave = data?.onLeaveToday || [];
  const low = data?.lowBalance || [];

  return (
    <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
      {/* Card 1 — Employees On Leave Today (clickable) */}
      <Card
        title="Employees On Leave Today"
        actions={<Badge tone="status--leave">{isLoading ? "…" : onLeave.length}</Badge>}
      >
        {isLoading ? (
          <BlockSkeleton height={90} />
        ) : (
          <button
            type="button"
            onClick={() => onLeave.length && setDrawerOpen(true)}
            disabled={!onLeave.length}
            className="row row--between"
            style={{
              width: "100%", textAlign: "left", background: "transparent",
              border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px",
              cursor: onLeave.length ? "pointer" : "default",
            }}
          >
            <div className="row" style={{ gap: 12, alignItems: "center" }}>
              <div className="kpi__icon" style={{ background: "rgba(245, 158, 11, 0.12)", color: "#d97706" }}>
                <Icon name="leave" size={22} />
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{onLeave.length}</div>
                <div className="kpi__label">on leave right now</div>
              </div>
            </div>
            {!!onLeave.length && <span className="text-sm muted">View <Icon name="chevron-right" size={14} /></span>}
          </button>
        )}
        {!isLoading && onLeave.length === 0 && (
          <div className="text-sm muted" style={{ marginTop: 10 }}>No employees are on leave today.</div>
        )}
      </Card>

      {/* Card 2 — Low Leave Balance */}
      <Card
        title={`Low Leave Balance (≤ ${threshold})`}
        actions={<Badge tone="status--absent">{isLoading ? "…" : low.length}</Badge>}
      >
        {isLoading ? (
          <BlockSkeleton height={120} />
        ) : low.length === 0 ? (
          <EmptyState icon="✅" title="All balances healthy" message={`No employee is at or below ${threshold} remaining.`} />
        ) : (
          <div className="stack" style={{ gap: 8, maxHeight: 220, overflowY: "auto" }}>
            {low.map((r) => (
              <div key={`${r.empId}-${r.leaveTypeCode}`} className="row row--between">
                <div>
                  <div className="emp-cell__name">{r.empName}</div>
                  <div className="emp-cell__sub">
                    {r.empDepartment || "—"} · {r.leaveTypeName}
                  </div>
                </div>
                <Badge status="absent">{r.remaining} left</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* On-leave-today drawer */}
      <Drawer open={drawerOpen} title="Employees On Leave Today" onClose={() => setDrawerOpen(false)} width={640}>
        {onLeave.length === 0 ? (
          <EmptyState icon="🌴" title="Nobody on leave today" />
        ) : (
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>ID</th>
                  <th>Department</th>
                  <th>Leave Type</th>
                  <th>Duration</th>
                  <th>Expected Return</th>
                </tr>
              </thead>
              <tbody>
                {onLeave.map((r) => (
                  <tr key={`${r.empId}-${r.fromDate}`}>
                    <td style={{ fontWeight: 600 }}>{r.empName}</td>
                    <td>{r.empId}</td>
                    <td>{r.empDepartment || "—"}</td>
                    <td><Badge status="leave">{r.leaveTypeName}</Badge></td>
                    <td>{r.duration || "—"}</td>
                    <td className="nowrap">{formatDate(r.expectedReturn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Drawer>
    </div>
  );
}
