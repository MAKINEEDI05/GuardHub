import { useMemo } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import { BlockSkeleton, EmptyState } from "../components/ui/States";
import Icon from "../components/ui/Icon";
import { useEmployees } from "../hooks/useEmployees";
import { useRosters } from "../hooks/useRoster";
import { useLeaves } from "../hooks/useLeaves";
import { useOds } from "../hooks/useOds";
import { useOts } from "../hooks/useOts";
import { formatDate, formatDateTime } from "../utils/date";

// All KPIs come from real backend collections — no fabricated metrics.
const KPI_META = [
  { key: "employees", label: "Total Employees", icon: "users", color: "var(--brand-green)" },
  { key: "rosters", label: "Active Rosters", icon: "shield", color: "var(--brand-navy)" },
  { key: "leaves", label: "Leave Requests", icon: "leave", color: "var(--brand-orange)" },
  { key: "ods", label: "OD Requests", icon: "od", color: "var(--brand-gold)" },
  { key: "ots", label: "OT Requests", icon: "ot", color: "var(--status-ot)" },
];

function Kpi({ meta, value, loading }) {
  return (
    <div className="kpi">
      <div className="kpi__icon" style={{ background: meta.color + "1a", color: meta.color }}>
        <Icon name={meta.icon} size={22} />
      </div>
      <div>
        {loading ? (
          <BlockSkeleton height={28} />
        ) : (
          <div className="kpi__value">{value}</div>
        )}
        <div className="kpi__label">{meta.label}</div>
      </div>
    </div>
  );
}

function recent(list, n = 5) {
  return [...(list || [])]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, n);
}

export default function Dashboard() {
  const employees = useEmployees();
  const rosters = useRosters();
  const leaves = useLeaves();
  const ods = useOds();
  const ots = useOts();

  // empId -> name for records that only store the id.
  const nameMap = useMemo(() => {
    const m = new Map();
    (employees.data || []).forEach((e) => m.set(String(e.empId), e.empName));
    return m;
  }, [employees.data]);
  const nameOf = (id) => nameMap.get(String(id)) || `ID ${id}`;

  const counts = {
    employees: employees.data?.length ?? 0,
    rosters: rosters.data?.length ?? 0,
    leaves: leaves.data?.length ?? 0,
    ods: ods.data?.length ?? 0,
    ots: ots.data?.length ?? 0,
  };
  const loading = {
    employees: employees.isLoading,
    rosters: rosters.isLoading,
    leaves: leaves.isLoading,
    ods: ods.isLoading,
    ots: ots.isLoading,
  };

  const recentLeaves = recent(leaves.data);
  const recentOds = recent(ods.data);
  const recentOts = recent(ots.data);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Live overview of your security workforce"
      />

      <div className="kpi-grid mb-4">
        {KPI_META.map((m) => (
          <Kpi key={m.key} meta={m} value={counts[m.key]} loading={loading[m.key]} />
        ))}
      </div>

      <div className="stack" style={{ gap: 16 }}>
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          <Card title="Recent Leaves" actions={<Link className="btn btn--ghost btn--sm" to="/leaves">View all</Link>} bodyClass="">
            {leaves.isLoading ? (
              <BlockSkeleton height={120} />
            ) : recentLeaves.length === 0 ? (
              <EmptyState icon="🌴" title="No leave requests" />
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {recentLeaves.map((l) => (
                  <div key={l._id} className="row row--between">
                    <div>
                      <div className="emp-cell__name">{nameOf(l.empId)}</div>
                      <div className="emp-cell__sub">
                        {formatDate(l.empFromDate)} → {formatDate(l.empToDate)}
                      </div>
                    </div>
                    <Badge status="leave">{l.empLeaveType || "Leave"}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Recent OD" actions={<Link className="btn btn--ghost btn--sm" to="/od">View all</Link>}>
            {ods.isLoading ? (
              <BlockSkeleton height={120} />
            ) : recentOds.length === 0 ? (
              <EmptyState icon="📋" title="No OD records" />
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {recentOds.map((o) => (
                  <div key={o._id} className="row row--between">
                    <div>
                      <div className="emp-cell__name">{nameOf(o.empId)}</div>
                      <div className="emp-cell__sub">
                        {formatDate(o.empFromDate)} → {formatDate(o.empToDate)}
                      </div>
                    </div>
                    <Badge status="od">{o.odLocation || o.empOdType || "OD"}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Recent OT" actions={<Link className="btn btn--ghost btn--sm" to="/ot">View all</Link>}>
            {ots.isLoading ? (
              <BlockSkeleton height={120} />
            ) : recentOts.length === 0 ? (
              <EmptyState icon="⏰" title="No OT records" />
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {recentOts.map((o) => (
                  <div key={o._id} className="row row--between">
                    <div>
                      <div className="emp-cell__name">{o.employeeName || nameOf(o.employeeId)}</div>
                      <div className="emp-cell__sub">
                        {o.workingDuration} · {formatDate(o.fromDate)}
                      </div>
                    </div>
                    <Badge status={String(o.status).toLowerCase() === "approved" ? "present" : "ot"}>
                      {o.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card title="Quick Actions">
          <div className="row">
            <Link className="btn btn--primary" to="/apply/leave"><Icon name="plus" size={16} /> Apply Leave</Link>
            <Link className="btn btn--secondary" to="/apply/od"><Icon name="plus" size={16} /> Apply OD</Link>
            <Link className="btn btn--outline" to="/apply/ot"><Icon name="plus" size={16} /> Apply OT</Link>
            <Link className="btn btn--outline" to="/employees"><Icon name="users" size={16} /> Manage Employees</Link>
            <Link className="btn btn--outline" to="/roster"><Icon name="shield" size={16} /> Security Roster</Link>
          </div>
        </Card>
      </div>
    </>
  );
}
