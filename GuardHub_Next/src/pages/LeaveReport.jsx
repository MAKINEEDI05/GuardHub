import { useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import DataTable from "../components/ui/DataTable";
import Badge from "../components/ui/Badge";
import Icon from "../components/ui/Icon";
import EmployeePicker from "../components/EmployeePicker";
import LeaveHistoryDrawer from "../components/leave/LeaveHistoryDrawer";
import { Field, Select } from "../components/ui/Field";
import { useLeaveReport, useLeaveTypes } from "../hooks/useLeaveV2";
import { MONTHS, recentYears, DEPARTMENTS, DESIGNATIONS } from "../utils/constants";
import { exportFilteredCsv } from "../utils/exportCsv";

// Leave Report — filter by employee / department / designation / month / year /
// type (all applied server-side), view Allocated / Used / Remaining alongside
// Leave Taken, drill into any employee's full history, and export exactly the
// filtered rows to CSV.
export default function LeaveReport() {
  const years = recentYears();
  const { data: types = [] } = useLeaveTypes(false);

  const [emp, setEmp] = useState(null);
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState(years[0]);
  const [typeCode, setTypeCode] = useState("");
  const [viewEmp, setViewEmp] = useState(null); // drill-down target

  const filters = useMemo(() => ({
    year,
    ...(emp ? { empId: emp.empId } : {}),
    ...(department ? { department } : {}),
    ...(designation ? { designation } : {}),
    ...(month ? { month } : {}),
    ...(typeCode ? { leaveTypeCode: typeCode } : {}),
  }), [emp, department, designation, month, year, typeCode]);

  const { data = { data: [], summary: {} }, isLoading } = useLeaveReport(filters);
  const rows = data.data;
  const s = data.summary || {};

  const isFiltered = !!(emp || department || designation || month || typeCode);

  const columns = [
    { key: "empName", header: "Employee", sortable: true, render: (r) => (
      <div><div style={{ fontWeight: 600 }}>{r.empName}</div><div className="text-sm muted">ID {r.empId}</div></div>
    ) },
    { key: "empDepartment", header: "Department", render: (r) => r.empDepartment || "—" },
    { key: "leaveTypeName", header: "Leave Type", render: (r) => <Badge status="leave">{r.leaveTypeName}</Badge> },
    { key: "leaveTaken", header: "Leave Taken", className: "num", sortable: true, render: (r) => r.leaveTaken },
    { key: "allocated", header: "Allocated", className: "num", render: (r) => r.allocated },
    { key: "used", header: "Used", className: "num", render: (r) => r.used },
    { key: "remaining", header: "Remaining", className: "num", render: (r) => <strong>{r.remaining}</strong> },
    { key: "_view", header: "", className: "num", render: (r) => (
      <button className="btn btn--ghost btn--icon" title="View leave history" aria-label={`View ${r.empName}'s leave history`}
        onClick={() => setViewEmp({ empId: r.empId, empName: r.empName, empDepartment: r.empDepartment, empDesignation: r.empDesignation })}>
        <Icon name="eye" size={16} />
      </button>
    ) },
  ];

  const exportRows = rows.map((r) => ({
    name: r.empName, empId: r.empId, department: r.empDepartment, taken: r.leaveTaken,
    type: r.leaveTypeName, allocated: r.allocated, used: r.used, remaining: r.remaining,
  }));

  const monthLabel = month ? MONTHS.find((m) => m.value === Number(month))?.label : "All months";

  return (
    <>
      <PageHeader
        title="Leave Report"
        subtitle={`${monthLabel} · ${year}${emp ? ` · ${emp.empName}` : ""}${department ? ` · ${department}` : ""}${designation ? ` · ${designation}` : ""}`}
        actions={
          <Button variant="outline" disabled={!rows.length} onClick={() => exportFilteredCsv({
            baseName: `leave-report-${year}${month ? `-${month}` : ""}`,
            columns: [
              { key: "name", label: "Employee Name" }, { key: "empId", label: "Employee ID" },
              { key: "department", label: "Department" },
              { key: "taken", label: "Leave Taken" }, { key: "type", label: "Leave Type" },
              { key: "allocated", label: "Allocated Leave" }, { key: "used", label: "Used Leave" },
              { key: "remaining", label: "Remaining Leave" },
            ],
            rows: exportRows, isFiltered, noun: "leave report rows",
          })}>
            <Icon name="download" size={16} /> Export CSV
          </Button>
        }
      />

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div className="field-grid-2" style={{ gap: 16 }}>
          <Field label="Employee" hint="Leave blank for all employees">
            <EmployeePicker selected={emp} onSelect={setEmp} />
            {emp && <button className="btn btn--ghost btn--sm" style={{ marginTop: 6 }} onClick={() => setEmp(null)}>Clear employee</button>}
          </Field>
          <div className="field-grid-2" style={{ gap: 12 }}>
            <Field label="Department">
              <Select value={department} onChange={(e) => setDepartment(e.target.value)}
                placeholder="All departments" options={DEPARTMENTS} />
            </Field>
            <Field label="Designation">
              <Select value={designation} onChange={(e) => setDesignation(e.target.value)}
                placeholder="All designations" options={DESIGNATIONS} />
            </Field>
            <Field label="Year">
              <Select value={year} onChange={(e) => setYear(Number(e.target.value))}
                options={years.map((y) => ({ value: y, label: String(y) }))} />
            </Field>
            <Field label="Month">
              <Select value={month} onChange={(e) => setMonth(e.target.value)}
                placeholder="All months" options={MONTHS} />
            </Field>
            <Field label="Leave Type">
              <Select value={typeCode} onChange={(e) => setTypeCode(e.target.value)}
                placeholder="All types" options={types.map((t) => ({ value: t.code, label: t.name }))} />
            </Field>
          </div>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="kpi-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 16 }}>
        <SummaryTile label="Leave Taken" value={s.leaveTaken ?? 0} />
        <SummaryTile label="Allocated" value={s.allocated ?? 0} />
        <SummaryTile label="Used" value={s.used ?? 0} />
        <SummaryTile label="Remaining" value={s.remaining ?? 0} />
      </div>

      <DataTable columns={columns} rows={rows} loading={isLoading} pageSize={15}
        emptyTitle="No leave in this period" emptyIcon="🌴" rowKey={(r) => `${r.empId}-${r.leaveTypeCode}`} />

      <LeaveHistoryDrawer emp={viewEmp} year={year} onClose={() => setViewEmp(null)} />
    </>
  );
}

function SummaryTile({ label, value }) {
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div className="text-sm muted">{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
