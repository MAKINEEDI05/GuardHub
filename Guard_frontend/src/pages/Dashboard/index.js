import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Row, Col } from "reactstrap";
import axios from "axios";
import ReactApexChart from "react-apexcharts";

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

// A very wide range so the date-filtered list endpoints return everything;
// we then sort by createdAt to find the latest records.
const WIDE_RANGE = "fromDate=2000-01-01&toDate=2100-01-01";

const MODULES = [
  { title: "Employee Profiles", desc: "Manage security personnel", icon: "mdi-account-group", to: "/profilepage", color: "primary" },
  { title: "Day Wise Report", desc: "Daily attendance by date", icon: "mdi-calendar-today", to: "/day-wise-report", color: "info" },
  { title: "Month Wise Report", desc: "Monthly attendance summary", icon: "mdi-calendar-month", to: "/month-wise-report", color: "success" },
  { title: "Leave & OD", desc: "View leave and OD records", icon: "mdi-file-document-edit-outline", to: "/LeaveOdManagement", color: "warning" },
  { title: "Security Roster", desc: "Weekly shift assignments", icon: "mdi-shield-account-outline", to: "/security-roaster", color: "danger" },
];

// --- pure helpers (no fabricated data; only classification of real values) ---

const DESIGNATION_BUCKETS = [
  { key: "Assistant Security Officer", test: (d) => d.includes("assistant") && d.includes("security officer") },
  { key: "Head Guard", test: (d) => d.includes("head") && d.includes("guard") },
  { key: "Security Officer", test: (d) => d.includes("security officer") },
  { key: "Security Guard", test: (d) => d.includes("security guard") },
];

const bucketDesignation = (designation) => {
  const d = String(designation || "").trim().toLowerCase();
  const found = DESIGNATION_BUCKETS.find((b) => b.test(d));
  return found ? found.key : "Others";
};

const classifyShift = (value) => {
  const s = String(value || "").trim().toLowerCase();
  if (!s) return null;
  if (s.includes("week") && s.includes("off")) return "Week Off";
  if (s.includes("general")) return "General";
  if (/\bshift\s*a\b/.test(s) || /\ba\s*shift\b/.test(s) || /\ba\b/.test(s)) return "Shift A";
  if (/\bshift\s*b\b/.test(s) || /\bb\s*shift\b/.test(s) || /\bb\b/.test(s)) return "Shift B";
  if (/\bshift\s*c\b/.test(s) || /\bc\s*shift\b/.test(s) || /\bc\b/.test(s)) return "Shift C";
  return "Other";
};

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ guards: 0, roster: 0, leaves: 0, ods: 0 });
  const [distribution, setDistribution] = useState([]); // [{label,count,pct}]
  const [rosterInsights, setRosterInsights] = useState({ total: 0, General: 0, "Shift A": 0, "Shift B": 0, "Shift C": 0, "Week Off": 0 });
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [recentOds, setRecentOds] = useState([]);
  const [health, setHealth] = useState({
    Employee: "Pending",
    Roster: "Pending",
    Leave: "Pending",
    OD: "Pending",
  });

  // Real API health probe: time each request; classify by outcome + latency.
  const probe = useCallback(async (url) => {
    const start = performance.now();
    try {
      const res = await axios.get(url, { timeout: 8000 });
      const ms = performance.now() - start;
      const ok = res.status >= 200 && res.status < 300;
      if (!ok) return { status: "Warning", res };
      return { status: ms > 2000 ? "Warning" : "Healthy", res };
    } catch (e) {
      // 4xx means the service is reachable but responded with an error.
      if (e.response) return { status: "Warning", res: e.response };
      return { status: "Offline", res: null };
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      const [emp, roster, leave, od] = await Promise.all([
        probe(`${API_URL}/emp/get-emp-details`),
        probe(`${API_URL}/roster/get-emp-data`),
        probe(`${API_URL}/leave/get-month-wise-leaves?${WIDE_RANGE}`),
        probe(`${API_URL}/od/get-ods?${WIDE_RANGE}`),
      ]);
      if (cancelled) return;

      setHealth({
        Employee: emp.status,
        Roster: roster.status,
        Leave: leave.status,
        OD: od.status,
      });

      const empList = Array.isArray(emp.res?.data) ? emp.res.data : [];
      const rosterList = Array.isArray(roster.res?.data) ? roster.res.data : [];
      const leaveList = Array.isArray(leave.res?.data?.data) ? leave.res.data.data : [];
      const odList = Array.isArray(od.res?.data?.data) ? od.res.data.data : [];

      setStats({
        guards: empList.length,
        roster: rosterList.length,
        leaves: leaveList.length,
        ods: odList.length,
      });

      // Employee distribution by designation (count + percentage).
      const counts = {};
      empList.forEach((e) => {
        const b = bucketDesignation(e.empDesignation);
        counts[b] = (counts[b] || 0) + 1;
      });
      const total = empList.length || 1;
      const order = ["Security Officer", "Head Guard", "Security Guard", "Assistant Security Officer", "Others"];
      setDistribution(
        order
          .filter((k) => counts[k])
          .map((label) => ({ label, count: counts[label], pct: Math.round((counts[label] / total) * 100) }))
      );

      // Roster insights — tally every day-slot assignment across all rosters.
      const ri = { total: rosterList.length, General: 0, "Shift A": 0, "Shift B": 0, "Shift C": 0, "Week Off": 0 };
      rosterList.forEach((r) => {
        const ws = r.weeklyShifts || {};
        DAYS.forEach((d) => {
          const cls = classifyShift(ws[d]);
          if (cls && ri[cls] !== undefined) ri[cls] += 1;
        });
      });
      setRosterInsights(ri);

      // Recent leave / OD with employee names joined from securitydetails.
      const nameById = new Map(empList.map((e) => [String(e.empId), e.empName]));
      const byCreated = (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0);

      setRecentLeaves(
        [...leaveList].sort(byCreated).slice(0, 5).map((l) => ({
          empId: l.empId,
          name: nameById.get(String(l.empId)) || "—",
          type: l.empLeaveType || "Leave",
          from: l.empFromDate,
          to: l.empToDate,
        }))
      );
      setRecentOds(
        [...odList].sort(byCreated).slice(0, 5).map((o) => ({
          empId: o.empId,
          name: nameById.get(String(o.empId)) || "—",
          type: o.empOdType || "OD",
          from: o.empFromDate,
          to: o.empToDate,
        }))
      );

      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [probe]);

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

  const leaveColumns = useMemo(
    () => [
      { key: "empId", header: "Emp ID", width: "80px" },
      { key: "name", header: "Name" },
      { key: "type", header: "Leave Type" },
      { key: "from", header: "From", render: (r) => fmtDate(r.from) },
      { key: "to", header: "To", render: (r) => fmtDate(r.to) },
    ],
    []
  );
  const odColumns = useMemo(
    () => [
      { key: "empId", header: "Emp ID", width: "80px" },
      { key: "name", header: "Name" },
      { key: "type", header: "OD Type" },
      { key: "from", header: "From", render: (r) => fmtDate(r.from) },
      { key: "to", header: "To", render: (r) => fmtDate(r.to) },
    ],
    []
  );

  // Donut chart config derived from real distribution.
  const donut = useMemo(() => {
    const series = distribution.map((d) => d.count);
    const labels = distribution.map((d) => d.label);
    return {
      series,
      options: {
        labels,
        chart: { type: "donut", fontFamily: "var(--gh-font)" },
        legend: { position: "bottom" },
        dataLabels: { enabled: true, formatter: (val) => `${Math.round(val)}%` },
        colors: ["#4f46e5", "#0ea5e9", "#16a34a", "#d97706", "#64748b"],
        plotOptions: { pie: { donut: { size: "68%", labels: { show: true, total: { show: true, label: "Total", formatter: () => String(stats.guards) } } } } },
        stroke: { width: 2 },
        tooltip: { y: { formatter: (v) => `${v} personnel` } },
        responsive: [{ breakpoint: 480, options: { legend: { position: "bottom" } } }],
      },
    };
  }, [distribution, stats.guards]);

  const rosterRows = [
    { label: "Total Roster Records", value: rosterInsights.total, icon: "mdi-clipboard-text-outline", color: "primary" },
    { label: "General Shift", value: rosterInsights.General, icon: "mdi-white-balance-sunny", color: "info" },
    { label: "Shift A", value: rosterInsights["Shift A"], icon: "mdi-alpha-a-circle-outline", color: "success" },
    { label: "Shift B", value: rosterInsights["Shift B"], icon: "mdi-alpha-b-circle-outline", color: "warning" },
    { label: "Shift C", value: rosterInsights["Shift C"], icon: "mdi-alpha-c-circle-outline", color: "danger" },
    { label: "Week Off", value: rosterInsights["Week Off"], icon: "mdi-calendar-remove-outline", color: "secondary" },
  ];

  return (
    <div className="page-content">
      <PageContainer>
        <PageHeader
          title="Guards Hub Overview"
          subtitle="Security personnel management — live snapshot"
          breadcrumb={[{ label: "Home", link: "/dashboard" }, { label: "Dashboard" }]}
        />

        <Row>
          <Col xl={3} md={6}>
            <KpiCard label="Total Security Personnel" value={stats.guards} icon="mdi-account-group" color="primary" loading={loading} />
          </Col>
          <Col xl={3} md={6}>
            <KpiCard label="Active Rosters" value={stats.roster} icon="mdi-shield-account-outline" color="success" loading={loading} />
          </Col>
          <Col xl={3} md={6}>
            <KpiCard label="Leave Requests" value={stats.leaves} icon="mdi-airplane-takeoff" color="warning" loading={loading} />
          </Col>
          <Col xl={3} md={6}>
            <KpiCard label="OD Requests" value={stats.ods} icon="mdi-briefcase-outline" color="info" loading={loading} />
          </Col>
        </Row>

        <Row>
          {/* Employee distribution */}
          <Col xl={5}>
            <SectionCard title="Employee Distribution" subtitle="By designation">
              {distribution.length === 0 ? (
                <EmptyState title="No employees" message="No personnel records to chart yet." icon="mdi-chart-donut" />
              ) : (
                <>
                  <ReactApexChart options={donut.options} series={donut.series} type="donut" height={280} />
                  <div className="gh-dist-legend">
                    {distribution.map((d) => (
                      <div className="gh-dist-legend__row" key={d.label}>
                        <span className="gh-dist-legend__label">{d.label}</span>
                        <span className="gh-dist-legend__val">{d.count} <small className="text-muted">({d.pct}%)</small></span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </SectionCard>
          </Col>

          {/* Roster insights */}
          <Col xl={4}>
            <SectionCard title="Roster Insights" subtitle="Weekly shift assignments">
              <ul className="gh-stat-list">
                {rosterRows.map((r) => (
                  <li key={r.label}>
                    <span className="gh-stat-list__left">
                      <span className={`gh-stat-list__icon gh-stat-list__icon--${r.color}`}>
                        <i className={`mdi ${r.icon}`} />
                      </span>
                      {r.label}
                    </span>
                    <span className="gh-stat-list__value">{r.value}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </Col>

          {/* Real API health */}
          <Col xl={3}>
            <SectionCard title="System Status" subtitle="Live API health">
              <ul className="gh-status-list">
                {["Employee", "Roster", "Leave", "OD"].map((svc) => (
                  <li key={svc}>
                    <span>{svc} Service</span>
                    <StatusBadge status={health[svc]} />
                  </li>
                ))}
              </ul>
              <p className="text-muted mt-3 mb-0" style={{ fontSize: "var(--gh-fs-caption)" }}>
                Healthy = 2xx &lt; 2s · Warning = slow / error response · Offline = unreachable.
              </p>
            </SectionCard>
          </Col>
        </Row>

        <Row>
          <Col xl={6}>
            <SectionCard title="Recent Leave Activity" subtitle="Latest 5 requests" noPadding>
              {recentLeaves.length === 0 && !loading ? (
                <EmptyState title="No leave requests" message="No leave records found." icon="mdi-calendar-blank-outline" />
              ) : (
                <DataTable columns={leaveColumns} data={recentLeaves} loading={loading} pageSize={5} />
              )}
            </SectionCard>
          </Col>
          <Col xl={6}>
            <SectionCard title="Recent OD Activity" subtitle="Latest 5 requests" noPadding>
              {recentOds.length === 0 && !loading ? (
                <EmptyState title="No OD requests" message="No OD records found." icon="mdi-calendar-blank-outline" />
              ) : (
                <DataTable columns={odColumns} data={recentOds} loading={loading} pageSize={5} />
              )}
            </SectionCard>
          </Col>
        </Row>

        <Row>
          <Col xs={12}>
            <SectionCard title="Modules" subtitle="Quick navigation">
              <Row>
                {MODULES.map((m) => (
                  <Col lg={4} md={6} key={m.to} className="mb-3">
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
        </Row>
      </PageContainer>
    </div>
  );
};

export default React.memo(Dashboard);
