import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import SearchBar from "../components/ui/SearchBar";
import DataTable from "../components/ui/DataTable";
import Badge from "../components/ui/Badge";
import { Input } from "../components/ui/Field";
import Icon from "../components/ui/Icon";
import { ErrorState, EmptyState } from "../components/ui/States";
import EmployeeTableCell from "../components/EmployeeTableCell";
import { useAttendanceByDate } from "../hooks/useReports";
import { useEmployees } from "../hooks/useEmployees";
import { useRosters } from "../hooks/useRoster";
import { shiftForDate } from "../utils/roster";
import { todayYmd, isFutureYmd, FUTURE_DATE_MESSAGE } from "../utils/date";
import { shiftBucket } from "../utils/constants";
import { exportFilteredCsv } from "../utils/exportCsv";

// Day Wise attendance, sourced from /attendance/get-attendace-bydate/:date —
// the PROCESSED `empAttendance` collection (one row per employee per day),
// joined to the employee master for name/designation/department/photo.
const CSV_COLUMNS = [
  { key: "empId", label: "Employee ID" },
  { key: "empName", label: "Name" },
  { key: "empDesignation", label: "Designation" },
  { key: "empDepartment", label: "Department" },
  { key: "empShift", label: "Shift" },
  { key: "empInTime", label: "In Time" },
  { key: "empOutTime", label: "Out Time" },
  { key: "empAction", label: "Status" },
  { key: "empDate", label: "Date" },
];

// Summary cards shown above the table, in one row.
//   Total     = active employees (the employee master, NOT the attendance rows)
//   Week Off  = employees whose ROSTER marks that weekday as a week off
//   A/B/C/Gen = "present / rostered" for that shift on the date (e.g. 1/2) — the
//               denominator comes from the roster, so it is meaningful even
//               before the day's attendance has been processed
//   the rest  = statuses from the processed attendance rows
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
// Employees with no roster (or no shift for that weekday) — surfaced so the
// cards always add up to Total instead of quietly losing people.
const NOT_ROSTERED = "Not Rostered";

export default function DayWiseReport() {
  // `?q=` pre-fills the search — used by the Month Wise Report "View daily
  // attendance" action to jump straight to one employee's punches for today.
  const [searchParams] = useSearchParams();
  const [date, setDate] = useState(todayYmd());
  const [term, setTerm] = useState(searchParams.get("q") || "");
  // Block future dates: the picker's `max` stops most selections, but a manual
  // type can still slip a future value through, so we guard the query too.
  const futureDate = isFutureYmd(date);
  const { data: rows = [], isLoading, isError, refetch } = useAttendanceByDate(
    date,
    !futureDate
  );

  // Employee master (cached) so the Employee column can show the real photo from
  // the same `empImage` source used by Employee Management & Security Roster.
  const { data: employees = [] } = useEmployees();
  const empMap = useMemo(
    () => new Map(employees.map((e) => [String(e.empId), e])),
    [employees]
  );

  // Rosters drive the Week Off count and the shift denominators (empId is a
  // String in roster_mgmt).
  const { data: rosters = [] } = useRosters();
  const rosterMap = useMemo(
    () => new Map(rosters.map((r) => [String(r.empId), r])),
    [rosters]
  );

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.empId, r.empName, r.empDesignation, r.empShift]
        .map((v) => String(v ?? "").toLowerCase())
        .some((v) => v.includes(q))
    );
  }, [rows, term]);

  // Status counts + shift-wise headcount for the day. Shifts are bucketed via
  // shiftBucket so roster variants ("A Shift" / "1-General" / ...) all land right.
  const { counts, shiftStats, extraShifts } = useMemo(() => {
    const out = Object.fromEntries(SUMMARY.map((s) => [s.key, 0]));
    // shift key -> { present, total } headcount for the day
    const stats = Object.fromEntries(Object.values(SHIFT_KEY).map((k) => [k, { present: 0, total: 0 }]));
    const other = new Map(); // unrecognised roster labels -> their own cards

    // 1. Statuses come from the processed attendance rows; remember WHO was present.
    const presentIds = new Set();
    rows.forEach((r) => {
      const v = String(r.empAction ?? "").toLowerCase();
      if (v.includes("present")) { out.present += 1; presentIds.add(String(r.empId)); }
      if (v.includes("leave")) out.leave += 1;
      if (v === "od" || v.includes(" od")) out.od += 1;
      if (v === "ot" || v.includes("overtime")) out.ot += 1;
    });

    // 2. Headcount + shift split come from the employee master and the roster for
    //    this date, so they hold up even if attendance isn't processed yet.
    out.total = employees.length;
    employees.forEach((e) => {
      const roster = rosterMap.get(String(e.empId));
      const bucket = shiftBucket(shiftForDate(roster?.weeklyShifts, date));
      if (bucket === "WEEK OFF") { out.weekoff += 1; return; }
      // No roster (or no shift set for that weekday) gets its own bucket rather
      // than being dropped — so the cards always reconcile with Total.
      const label = bucket || NOT_ROSTERED;
      const key = SHIFT_KEY[label];
      const target = key ? stats[key] : other.get(label) || { present: 0, total: 0 };
      target.total += 1;
      if (presentIds.has(String(e.empId))) target.present += 1;
      if (!key) other.set(label, target);
    });

    // 3. Absent is DERIVED, exactly like the Month-Wise report
    //    (absent = total - present - leave - od - weekOff), so the two reports
    //    can never disagree. Anyone not accounted for on a working day is absent.
    out.absent = Math.max(0, out.total - out.present - out.leave - out.od - out.weekoff);

    return {
      counts: out,
      shiftStats: stats,
      extraShifts: [...other.entries()].sort((a, b) => b[1].total - a[1].total),
    };
  }, [rows, employees, rosterMap, date]);

  const columns = [
    {
      key: "empName",
      header: "Employee",
      sortable: true,
      width: "30%",
      render: (r) => (
        <EmployeeTableCell
          emp={empMap.get(String(r.empId))}
          name={r.empName}
          empId={r.empId}
          designation={r.empDesignation}
        />
      ),
    },
    { key: "empDepartment", header: "Department", width: "14%", sortable: true, render: (r) => r.empDepartment || "—" },
    { key: "empShift", header: "Shift", width: "14%", render: (r) => r.empShift || "—" },
    { key: "empInTime", header: "In Time", width: "12%", render: (r) => r.empInTime || "—" },
    { key: "empOutTime", header: "Out Time", width: "12%", render: (r) => r.empOutTime || "—" },
    {
      key: "empAction",
      header: "Status",
      width: "14%",
      render: (r) => <Badge status={r.empAction}>{r.empAction || "—"}</Badge>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Day Wise Report"
        subtitle="Processed daily attendance (empAttendance), joined to Employee Management"
      />

      {/* Toolbar — date, search and export as one aligned, responsive row */}
      <Card className="mb-4">
        <div className="dw-toolbar">
          <div className="dw-toolbar__date">
            <label className="field__label">Date</label>
            <Input type="date" value={date} max={todayYmd()} onChange={(e) => setDate(e.target.value)} />
            {futureDate && <div className="field__error">{FUTURE_DATE_MESSAGE}</div>}
          </div>
          <div className="dw-toolbar__search">
            <label className="field__label">Search</label>
            <SearchBar value={term} onChange={setTerm} placeholder="Filter by name, ID, designation, shift..." />
          </div>
          <div className="dw-toolbar__action">
            <Button
              variant="outline"
              disabled={!filtered.length}
              onClick={() =>
                exportFilteredCsv({
                  baseName: `day-wise-${date}`,
                  columns: CSV_COLUMNS,
                  rows: filtered,
                  isFiltered: !!term.trim(),
                  noun: "records",
                })
              }
            >
              <Icon name="download" size={16} /> Export CSV
            </Button>
          </div>
        </div>
      </Card>

      {/* Summary cards — single row (scrolls horizontally if space is tight) */}
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
        {/* Shift labels outside General/A/B/C — surfaced, never dropped */}
        {extraShifts.map(([label, v]) => (
          <div className="summary-tile" key={label}>
            <div className="summary-tile__value">{`${v.present}/${v.total}`}</div>
            <div className="summary-tile__label">{label}</div>
          </div>
        ))}
      </div>

      {futureDate ? (
        <Card>
          <EmptyState icon="🗓️" title="Future date selected" message={FUTURE_DATE_MESSAGE} />
        </Card>
      ) : isError ? (
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
          emptyMessage="No processed attendance records were found for the selected date."
          emptyIcon="🗓️"
        />
      )}
    </>
  );
}
