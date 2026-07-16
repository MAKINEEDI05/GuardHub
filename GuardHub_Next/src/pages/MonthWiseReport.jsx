import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import SearchBar from "../components/ui/SearchBar";
import DataTable from "../components/ui/DataTable";
import { Input } from "../components/ui/Field";
import { ErrorState } from "../components/ui/States";
import EmployeeTableCell from "../components/EmployeeTableCell";
import MonthWiseDetailModal from "../components/MonthWiseDetailModal";
import { useMonthwiseSummary } from "../hooks/useReports";
import {
  currentMonthRange,
  todayYmd,
  isFutureYmd,
  FUTURE_DATE_MESSAGE,
} from "../utils/date";
import { ROSTER_SHIFTS } from "../utils/constants";
import { exportFilteredCsv } from "../utils/exportCsv";

// Month Wise Report — all employees by default, search just filters the table.
// Attendance is computed server-side in ONE call (/month/monthwise-summary):
// Present from biometric logs, Leave/OD/OT from their collections, Week Off from
// the roster, Absent = total − present − leave − od − weekOff.
const CSV_COLUMNS = [
  { key: "empId", label: "Employee ID" },
  { key: "empName", label: "Name" },
  { key: "empDesignation", label: "Designation" },
  { key: "empDepartment", label: "Department" },
  { key: "presentDays", label: "Present Days" },
  { key: "absentDays", label: "Absent Days" },
  { key: "leaveDays", label: "Leave Days" },
  { key: "odDays", label: "OD Days" },
  { key: "otDays", label: "OT Days" },
  { key: "weekOffDays", label: "Week Off Days" },
  { key: "totalDays", label: "Total Days" },
];

// Numeric attendance columns rendered as right-aligned, sortable cells.
const COUNT_COLS = [
  { key: "presentDays", header: "Present" },
  { key: "absentDays", header: "Absent" },
  { key: "leaveDays", header: "Leave" },
  { key: "odDays", header: "OD" },
  { key: "otDays", header: "OT" },
  { key: "weekOffDays", header: "Week Off" },
];

export default function MonthWiseReport() {
  const navigate = useNavigate();
  const month = currentMonthRange();
  const [range, setRange] = useState({ start: month.start, end: month.end });
  const [term, setTerm] = useState("");
  const [detail, setDetail] = useState(null);

  // Date validation: no future dates, and From must not be after To.
  const futureRange = isFutureYmd(range.start) || isFutureYmd(range.end);
  const invalidOrder =
    !!range.start && !!range.end && range.start > range.end;
  const dateError = futureRange
    ? FUTURE_DATE_MESSAGE
    : invalidOrder
    ? "'From Date' cannot be after 'To Date'."
    : null;

  const { data, isLoading, isError, refetch, isFetching } = useMonthwiseSummary(
    range.start,
    range.end,
    !dateError
  );
  const rows = data?.rows ?? [];

  // Client-side search — instant filter over the already-loaded set.
  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.empId, r.empName, r.empDesignation, r.empDepartment]
        .map((v) => String(v ?? "").toLowerCase())
        .some((v) => v.includes(q))
    );
  }, [rows, term]);

  // Shift-wise totals = days rostered to each shift, summed over the FILTERED
  // rows (rosters rotate by weekday, so one employee contributes to several).
  const shiftCounts = useMemo(() => {
    const map = new Map();
    filtered.forEach((r) => {
      Object.entries(r.shiftDays || {}).forEach(([shift, n]) => {
        map.set(shift, (map.get(shift) || 0) + n);
      });
    });
    const order = ROSTER_SHIFTS;
    return [...map.entries()].sort((a, b) => {
      const ia = order.indexOf(a[0]); const ib = order.indexOf(b[0]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a[0].localeCompare(b[0]);
    });
  }, [filtered]);

  const exportCsv = () => {
    if (!filtered.length) return;
    exportFilteredCsv({
      baseName: `month-wise-${range.start}_to_${range.end}`,
      columns: CSV_COLUMNS,
      rows: filtered,
      isFiltered: !!term.trim(),
      noun: "employees",
    });
  };

  const columns = [
    {
      key: "empName",
      header: "Employee",
      sortable: true,
      width: "24%",
      render: (r) => (
        <EmployeeTableCell emp={r} name={r.empName} empId={r.empId} designation={r.empDesignation} />
      ),
    },
    {
      key: "empDepartment",
      header: "Department",
      width: "12%",
      sortable: true,
      render: (r) => r.empDepartment || "—",
    },
    ...COUNT_COLS.map((c) => ({
      key: c.key,
      header: c.header,
      className: "num",
      sortable: true,
      render: (r) => r[c.key] ?? 0,
    })),
    {
      key: "actions",
      header: "Actions",
      width: "12%",
      render: (r) => (
        <div className="row" style={{ gap: 4 }}>
          <button className="btn btn--ghost btn--icon" title="View details" onClick={() => setDetail(r)}>
            <Icon name="eye" size={16} />
          </button>
          <button
            className="btn btn--ghost btn--icon"
            title="View daily attendance"
            onClick={() => navigate(`/reports/day?q=${encodeURIComponent(r.empId)}`)}
          >
            <Icon name="calendar-day" size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Month Wise Report"
        subtitle="Attendance summary for all employees over a date range"
      />

      {/* Toolbar — search, date range and export in one aligned, responsive row */}
      <Card className="mb-4">
        <div className="mw-toolbar">
          <div className="mw-toolbar__search">
            <label className="field__label">Search</label>
            <SearchBar value={term} onChange={setTerm} placeholder="Filter by name, ID, designation, department..." />
          </div>
          <div className="mw-toolbar__date">
            <label className="field__label">From Date</label>
            <Input
              type="date"
              value={range.start}
              max={todayYmd()}
              onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
            />
          </div>
          <div className="mw-toolbar__date">
            <label className="field__label">To Date</label>
            <Input
              type="date"
              value={range.end}
              max={todayYmd()}
              onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
            />
          </div>
          <div className="mw-toolbar__action">
            <Button variant="outline" disabled={!filtered.length} onClick={exportCsv}>
              <Icon name="download" size={16} /> Export CSV
            </Button>
          </div>
        </div>
        {dateError && <div className="field__error mt-2">{dateError}</div>}
      </Card>

      {/* Shift-wise cards — days rostered to each shift over the selected range */}
      {!dateError && shiftCounts.length > 0 && (
        <>
          <div className="text-sm muted" style={{ fontWeight: 600, margin: "0 0 8px" }}>
            Shift Wise (days in range)
          </div>
          <div className="summary-grid mb-4">
            {shiftCounts.map(([shift, n]) => (
              <div className="summary-tile" key={shift}>
                <div className="summary-tile__value">{n}</div>
                <div className="summary-tile__label">{shift}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {dateError ? (
        <Card>
          <ErrorState message={dateError} onRetry={undefined} />
        </Card>
      ) : isError ? (
        <Card>
          <ErrorState message="Could not load the monthly report." onRetry={refetch} />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          loading={isLoading || isFetching}
          rowKey={(r) => r.empId}
          pageSize={20}
          pageSizeOptions={[20, 50, 100]}
          emptyTitle="No employees found"
          emptyMessage="No attendance summary is available for this range or filter."
          emptyIcon="📊"
        />
      )}

      {detail && (
        <MonthWiseDetailModal
          row={detail}
          range={{ start: data?.startDate || range.start, end: data?.endDate || range.end }}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}
