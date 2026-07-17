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
import { shiftBucket } from "../utils/constants";
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

// Summary cards above the table. Total = employees; Present/Absent/Leave/OD/OT/
// Week Off are day totals over the range. The shift cards are a RATIO —
// "present / rostered" shift-days (e.g. 1/2) — i.e. attendance for that shift.
const SUMMARY = [
  { key: "total", label: "Total" },
  { key: "present", label: "Present" },
  { key: "absent", label: "Absent" },
  { key: "weekoff", label: "Week Off" },
  { key: "shiftA", label: "A Shift", ratio: true },
  { key: "shiftB", label: "B Shift", ratio: true },
  { key: "shiftC", label: "C Shift", ratio: true },
  { key: "general", label: "General", ratio: true },
  { key: "leave", label: "Leave" },
  { key: "od", label: "OD" },
  { key: "ot", label: "OT" },
];
// shift bucket -> summary key
const SHIFT_KEY = { "A Shift": "shiftA", "B Shift": "shiftB", "C Shift": "shiftC", General: "general" };

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

  // Cards over the FILTERED rows: Total = employees; attendance figures are day
  // totals; shift figures are days rostered to each shift (rosters rotate by
  // weekday, so one employee contributes days to several shifts).
  const { counts, shiftStats, extraShifts } = useMemo(() => {
    const out = Object.fromEntries(SUMMARY.map((s) => [s.key, 0]));
    // shift key -> { present, total } rostered shift-days across the range
    const stats = Object.fromEntries(Object.values(SHIFT_KEY).map((k) => [k, { present: 0, total: 0 }]));
    const other = new Map(); // unrecognised roster labels -> their own cards
    out.total = filtered.length;

    // Accumulate a shift map (rostered or present) into stats / other.
    const addShifts = (map, field) => {
      Object.entries(map || {}).forEach(([shift, n]) => {
        const bucket = shiftBucket(shift);
        if (bucket === "WEEK OFF" || bucket === "") return; // Week Off has its own card
        const key = SHIFT_KEY[bucket];
        if (key) { stats[key][field] += n; return; }
        const cur = other.get(shift) || { present: 0, total: 0 };
        cur[field] += n;
        other.set(shift, cur);
      });
    };

    filtered.forEach((r) => {
      out.present += r.presentDays || 0;
      out.absent += r.absentDays || 0;
      out.weekoff += r.weekOffDays || 0;
      out.leave += r.leaveDays || 0;
      out.od += r.odDays || 0;
      out.ot += r.otDays || 0;
      addShifts(r.shiftDays, "total");
      addShifts(r.presentShiftDays, "present");
    });

    return {
      counts: out,
      shiftStats: stats,
      extraShifts: [...other.entries()].sort((a, b) => b[1].total - a[1].total),
    };
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

      {/* Summary cards — single row (scrolls horizontally if space is tight) */}
      {!dateError && (
        <div className="summary-grid summary-grid--row mb-4">
          {SUMMARY.map((s) => (
            <div className="summary-tile" key={s.key}>
              <div className="summary-tile__value">
                {s.ratio
                  ? `${shiftStats[s.key].present}/${shiftStats[s.key].total}`
                  : counts[s.key] ?? 0}
              </div>
              <div className="summary-tile__label">{s.label}</div>
            </div>
          ))}
          {/* Roster shift labels outside General/A/B/C — surfaced, never dropped */}
          {extraShifts.map(([label, v]) => (
            <div className="summary-tile" key={label}>
              <div className="summary-tile__value">{`${v.present}/${v.total}`}</div>
              <div className="summary-tile__label">{label}</div>
            </div>
          ))}
        </div>
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
