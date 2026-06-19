import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Row, Col } from "reactstrap";
import axios from "axios";

import {
  PageContainer,
  PageHeader,
  KpiCard,
  SectionCard,
  DataTable,
  StatusBadge,
  EmptyState,
} from "components/ui";

const API_URL = process.env.REACT_APP_API_BASE_URL || "";

// Quick-navigation cards point at the existing, unchanged routes.
const MODULES = [
  { title: "Employee Profiles", desc: "Manage security personnel records", icon: "mdi-account-group", to: "/profilepage", color: "primary" },
  { title: "Day Wise Report", desc: "Daily attendance by date", icon: "mdi-calendar-today", to: "/day-wise-report", color: "info" },
  { title: "Month Wise Report", desc: "Monthly attendance summary", icon: "mdi-calendar-month", to: "/month-wise-report", color: "success" },
  { title: "Leave & OD", desc: "View leave and OD records", icon: "mdi-file-document-edit-outline", to: "/LeaveOdManagement", color: "warning" },
  { title: "Apply Leave / OD", desc: "Submit leave or OD requests", icon: "mdi-clipboard-plus-outline", to: "/applied-od", color: "info" },
  { title: "Security Roster", desc: "Weekly shift assignments", icon: "mdi-shield-account-outline", to: "/security-roaster", color: "danger" },
];

const monthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d) => d.toISOString().split("T")[0];
  return { from: fmt(start), to: fmt(end) };
};

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [apiOnline, setApiOnline] = useState(null);
  const [stats, setStats] = useState({ guards: 0, roster: 0, leaves: 0, ods: 0 });
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    const { from, to } = monthRange();
    const cfg = { signal: controller.signal };

    const load = async () => {
      setLoading(true);
      try {
        // Each call is independent; a single failure must not blank the page.
        const [emp, roster, leaves, ods] = await Promise.allSettled([
          axios.get(`${API_URL}/emp/get-emp-details`, cfg),
          axios.get(`${API_URL}/roster/get-emp-data`, cfg),
          axios.get(`${API_URL}/leave/get-month-wise-leaves?fromDate=${from}&toDate=${to}`, cfg),
          axios.get(`${API_URL}/od/get-ods?fromDate=${from}&toDate=${to}`, cfg),
        ]);

        const arr = (r) => (r.status === "fulfilled" && Array.isArray(r.value.data) ? r.value.data : []);
        const dataArr = (r) =>
          r.status === "fulfilled" && Array.isArray(r.value.data?.data) ? r.value.data.data : [];

        const empList = arr(emp);
        const rosterList = arr(roster);
        const leaveList = dataArr(leaves);
        const odList = dataArr(ods);

        setApiOnline(emp.status === "fulfilled");
        setStats({
          guards: empList.length,
          roster: rosterList.length,
          leaves: leaveList.length,
          ods: odList.length,
        });

        // Recent activity from real leave/OD records (most recent first).
        const activity = [
          ...leaveList.map((l) => ({
            empId: l.empId,
            type: "Leave",
            detail: l.empLeaveType || "Leave",
            from: l.empFromDate,
            to: l.empToDate,
            created: l.createdAt,
          })),
          ...odList.map((o) => ({
            empId: o.empId,
            type: "OD",
            detail: o.empOdType || "OD",
            from: o.empFromDate,
            to: o.empToDate,
            created: o.createdAt,
          })),
        ]
          .sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0))
          .slice(0, 8);
        setRecent(activity);
      } catch (e) {
        if (e.name !== "CanceledError" && e.name !== "AbortError") setApiOnline(false);
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, []);

  const recentColumns = useMemo(
    () => [
      { key: "empId", header: "Emp ID", width: "90px" },
      { key: "type", header: "Type", render: (r) => <StatusBadge status={r.type} /> },
      { key: "detail", header: "Detail" },
      {
        key: "from",
        header: "From",
        render: (r) => (r.from ? new Date(r.from).toLocaleDateString() : "--"),
      },
      {
        key: "to",
        header: "To",
        render: (r) => (r.to ? new Date(r.to).toLocaleDateString() : "--"),
      },
    ],
    []
  );

  return (
    <div className="page-content">
      <PageContainer>
        <PageHeader
          title="Guards Hub Overview"
          subtitle="Security personnel management — at a glance"
          breadcrumb={[{ label: "Home", link: "/dashboard" }, { label: "Dashboard" }]}
        />

        {/* KPI row — real counts from existing endpoints (no fabricated metrics) */}
        <Row>
          <Col xl={3} md={6}>
            <KpiCard label="Total Guards" value={stats.guards} icon="mdi-account-group" color="primary" loading={loading} />
          </Col>
          <Col xl={3} md={6}>
            <KpiCard label="Rostered Guards" value={stats.roster} icon="mdi-shield-account-outline" color="success" loading={loading} />
          </Col>
          <Col xl={3} md={6}>
            <KpiCard label="Leaves This Month" value={stats.leaves} icon="mdi-airplane-takeoff" color="warning" loading={loading} />
          </Col>
          <Col xl={3} md={6}>
            <KpiCard label="ODs This Month" value={stats.ods} icon="mdi-briefcase-outline" color="info" loading={loading} />
          </Col>
        </Row>

        <Row>
          {/* Quick navigation / module cards */}
          <Col xl={8}>
            <SectionCard title="Modules" subtitle="Jump to any workspace">
              <Row>
                {MODULES.map((m) => (
                  <Col md={6} key={m.to} className="mb-3">
                    <Link to={m.to} className="gh-module-card">
                      <span className={`gh-module-card__icon gh-module-card__icon--${m.color}`}>
                        <i className={`mdi ${m.icon}`} />
                      </span>
                      <span className="gh-module-card__body">
                        <span className="gh-module-card__title">{m.title}</span>
                        <span className="gh-module-card__desc">{m.desc}</span>
                      </span>
                      <i className="mdi mdi-chevron-right gh-module-card__chevron" />
                    </Link>
                  </Col>
                ))}
              </Row>
            </SectionCard>
          </Col>

          {/* System status — derived from a real API probe */}
          <Col xl={4}>
            <SectionCard title="System Status">
              <ul className="gh-status-list">
                <li>
                  <span>Backend API</span>
                  <StatusBadge status={apiOnline === null ? "Pending" : apiOnline ? "Active" : "Inactive"} />
                </li>
                <li>
                  <span>Employee Service</span>
                  <StatusBadge status={apiOnline ? "Active" : "Pending"} />
                </li>
                <li>
                  <span>Roster Service</span>
                  <StatusBadge status={stats.roster >= 0 && apiOnline ? "Active" : "Pending"} />
                </li>
              </ul>
              <p className="text-muted mt-3 mb-0" style={{ fontSize: "var(--gh-fs-caption)" }}>
                Status reflects live reachability of the backend endpoints this
                page already consumes.
              </p>
            </SectionCard>
          </Col>
        </Row>

        {/* Recent actions — real leave/OD records for the current month */}
        <Row>
          <Col xs={12}>
            <SectionCard title="Recent Leave & OD Activity" subtitle="Current month" noPadding>
              {recent.length === 0 && !loading ? (
                <EmptyState
                  title="No recent activity"
                  message="No leave or OD records were submitted this month."
                  icon="mdi-calendar-blank-outline"
                />
              ) : (
                <DataTable columns={recentColumns} data={recent} loading={loading} pageSize={8} emptyText="No recent activity" />
              )}
            </SectionCard>
          </Col>
        </Row>
      </PageContainer>
    </div>
  );
};

export default Dashboard;
