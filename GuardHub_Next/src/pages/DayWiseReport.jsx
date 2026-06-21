import { useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import SearchBar from "../components/ui/SearchBar";
import DataTable from "../components/ui/DataTable";
import Badge from "../components/ui/Badge";
import { Field, Input } from "../components/ui/Field";
import Icon from "../components/ui/Icon";
import { ErrorState } from "../components/ui/States";
import { useAttendanceByDate } from "../hooks/useReports";
import { todayYmd } from "../utils/date";
import { downloadCsv } from "../utils/csv";

// Day Wise attendance. Sourced from /attendance/get-attendace-bydate/:date,
// which reads the REAL biometric collection (secattendancelogs) and joins
// employee + roster data. Each row already carries the resolved name/shift.
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

export default function DayWiseReport() {
  const [date, setDate] = useState(todayYmd());
  const [term, setTerm] = useState("");
  const { data: rows = [], isLoading, isError, refetch } = useAttendanceByDate(date);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.empId, r.empName, r.empShift]
        .map((v) => String(v ?? "").toLowerCase())
        .some((v) => v.includes(q))
    );
  }, [rows, term]);

  const present = rows.filter((r) => String(r.empAction).toLowerCase() === "present").length;

  const columns = [
    { key: "empId", header: "ID", sortable: true, className: "num" },
    {
      key: "empName",
      header: "Name",
      sortable: true,
      render: (r) => (
        <div>
          <div className="emp-cell__name">{r.empName}</div>
          {r.empDesignation && <div className="emp-cell__sub">{r.empDesignation}</div>}
        </div>
      ),
    },
    { key: "empShift", header: "Shift", render: (r) => r.empShift || "—" },
    { key: "empInTime", header: "In Time", render: (r) => r.empInTime || "—" },
    { key: "empOutTime", header: "Out Time", render: (r) => r.empOutTime || "—" },
    { key: "punches", header: "Punches", className: "num", render: (r) => r.punches ?? "—" },
    {
      key: "empAction",
      header: "Status",
      render: (r) => <Badge status={r.empAction}>{r.empAction}</Badge>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Day Wise Report"
        subtitle="Attendance from the biometric log (secattendancelogs)"
        actions={
          <Button
            variant="outline"
            disabled={!rows.length}
            onClick={() => downloadCsv(`attendance-${date}.csv`, CSV_COLUMNS, rows)}
          >
            <Icon name="download" size={16} /> Export CSV
          </Button>
        }
      />

      <Card className="mb-4">
        <div className="row" style={{ alignItems: "flex-end", gap: 16 }}>
          <Field label="Date">
            <Input type="date" value={date} max={todayYmd()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <div className="grow">
            <label className="field__label">Search</label>
            <SearchBar value={term} onChange={setTerm} placeholder="Filter by name, ID, shift..." />
          </div>
          <div className="summary-tile" style={{ minWidth: 120 }}>
            <div className="summary-tile__value">{present}</div>
            <div className="summary-tile__label">Present</div>
          </div>
        </div>
      </Card>

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
          pageSize={15}
          emptyTitle="No attendance records available"
          emptyMessage="No biometric punches were found for the selected date."
          emptyIcon="🗓️"
        />
      )}
    </>
  );
}
