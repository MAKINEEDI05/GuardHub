import { useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import SearchBar from "../components/ui/SearchBar";
import DataTable from "../components/ui/DataTable";
import Badge from "../components/ui/Badge";
import { Input } from "../components/ui/Field";
import Icon from "../components/ui/Icon";
import { ErrorState } from "../components/ui/States";
import { useAttendanceByDate } from "../hooks/useReports";
import { todayYmd } from "../utils/date";
import { downloadCsv } from "../utils/csv";

// Day Wise attendance, sourced from /attendance/get-attendace-bydate/:date
// (the REAL biometric collection secattendancelogs, joined to employee + roster).
const CSV_COLUMNS = [
  { key: "empId", label: "Employee ID" },
  { key: "empName", label: "Name" },
  { key: "empDesignation", label: "Designation" },
  { key: "empDepartment", label: "Department" },
  { key: "empShift", label: "Shift" },
  { key: "empInTime", label: "In Time" },
  { key: "empOutTime", label: "Out Time" },
  { key: "punches", label: "Punches" },
  { key: "empAction", label: "Status" },
  { key: "empDate", label: "Date" },
];

// Summary cards shown above the table (counts derived from the day's records).
const SUMMARY = [
  { key: "total", label: "Total", match: () => true },
  { key: "present", label: "Present", match: (v) => v.includes("present") },
  { key: "absent", label: "Absent", match: (v) => v.includes("absent") },
  { key: "weekoff", label: "Week Off", match: (v) => v.includes("week") && v.includes("off") },
  { key: "leave", label: "Leave", match: (v) => v.includes("leave") },
  { key: "od", label: "OD", match: (v) => v === "od" || v.includes(" od") },
  { key: "ot", label: "OT", match: (v) => v === "ot" || v.includes("overtime") },
];

export default function DayWiseReport() {
  const [date, setDate] = useState(todayYmd());
  const [term, setTerm] = useState("");
  const { data: rows = [], isLoading, isError, refetch } = useAttendanceByDate(date);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.empId, r.empName, r.empDesignation, r.empShift]
        .map((v) => String(v ?? "").toLowerCase())
        .some((v) => v.includes(q))
    );
  }, [rows, term]);

  const counts = useMemo(() => {
    const out = {};
    SUMMARY.forEach((s) => (out[s.key] = 0));
    rows.forEach((r) => {
      const v = String(r.empAction ?? "").toLowerCase();
      SUMMARY.forEach((s) => {
        if (s.key === "total" || s.match(v)) out[s.key] += 1;
      });
    });
    return out;
  }, [rows]);

  const columns = [
    {
      key: "empName",
      header: "Employee",
      sortable: true,
      width: "34%",
      render: (r) => (
        <div>
          <div className="emp-cell__name">{r.empName || "—"}</div>
          <div className="emp-cell__sub">
            ID: {r.empId}
            {r.empDesignation ? ` · ${r.empDesignation}` : ""}
          </div>
        </div>
      ),
    },
    { key: "empShift", header: "Shift", width: "16%", render: (r) => r.empShift || "—" },
    { key: "empInTime", header: "In Time", width: "13%", render: (r) => r.empInTime || "—" },
    { key: "empOutTime", header: "Out Time", width: "13%", render: (r) => r.empOutTime || "—" },
    { key: "punches", header: "Punches", className: "num", width: "9%", sortable: true, render: (r) => r.punches ?? "—" },
    {
      key: "empAction",
      header: "Status",
      width: "15%",
      render: (r) => <Badge status={r.empAction}>{r.empAction || "—"}</Badge>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Day Wise Report"
        subtitle="Attendance from the biometric log (secattendancelogs)"
      />

      {/* Toolbar — date, search and export as one aligned, responsive row */}
      <Card className="mb-4">
        <div className="dw-toolbar">
          <div className="dw-toolbar__date">
            <label className="field__label">Date</label>
            <Input type="date" value={date} max={todayYmd()} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="dw-toolbar__search">
            <label className="field__label">Search</label>
            <SearchBar value={term} onChange={setTerm} placeholder="Filter by name, ID, designation, shift..." />
          </div>
          <div className="dw-toolbar__action">
            <Button
              variant="outline"
              disabled={!rows.length}
              onClick={() => downloadCsv(`attendance-${date}.csv`, CSV_COLUMNS, rows)}
            >
              <Icon name="download" size={16} /> Export CSV
            </Button>
          </div>
        </div>
      </Card>

      {/* Summary cards */}
      <div className="summary-grid mb-4">
        {SUMMARY.map((s) => (
          <div className="summary-tile" key={s.key}>
            <div className="summary-tile__value">{counts[s.key] ?? 0}</div>
            <div className="summary-tile__label">{s.label}</div>
          </div>
        ))}
      </div>

      {isError ? (
        <Card>
          <ErrorState message="Could not load attendance for this date." onRetry={refetch} />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          loading={isLoading}
          rowKey={(r) => r.empId}
          pageSize={20}
          pageSizeOptions={[20, 50, 100]}
          emptyTitle="No attendance records available"
          emptyMessage="No biometric punches were found for the selected date."
          emptyIcon="🗓️"
        />
      )}
    </>
  );
}
