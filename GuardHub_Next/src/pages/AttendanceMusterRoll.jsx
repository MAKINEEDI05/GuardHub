import { useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { Field, Input, Select } from "../components/ui/Field";
import { TableSkeleton, EmptyState, ErrorState } from "../components/ui/States";
import { useMusterRoll } from "../hooks/useReports";
import { MONTHS, recentYears, DEPARTMENTS, DESIGNATIONS, ROSTER_SHIFTS } from "../utils/constants";
import { downloadCsvMatrix } from "../utils/csv";
import { toast } from "../store/toastStore";

// Attendance Muster Roll — traditional register: one row per employee, one cell
// per day of the month, plus the monthly summary. All filtering + the per-day
// grid come from the backend (shared attendanceSummaryService). Supports CSV +
// print. Day columns are generated dynamically from the month length.
const SUMMARY_COLS = [
  { key: "present", label: "Present" },
  { key: "absent", label: "Absent" },
  { key: "leave", label: "Leave" },
  { key: "od", label: "OD" },
  { key: "ot", label: "OT" },
  { key: "workingDays", label: "Working Days" },
  { key: "netPayable", label: "Net Payable" },
];
const SUM_W = 78; // px per summary column (used for right-sticky offsets)
const LEGEND = "P=Present  A=Absent  CL/SPL/SUM/HOL=Leave  OD=On Duty  OT=Overtime  WO=Week Off  H=Holiday  ( / = combined)";

const emptyDraft = () => {
  const n = new Date();
  return { month: n.getMonth() + 1, year: n.getFullYear(), department: "", designation: "", shift: "", search: "" };
};

// Tint a cell by its (possibly combined) status.
function cellClass(v) {
  if (!v) return "";
  const s = v.toUpperCase();
  if (s.includes("WO")) return "mr--wo";
  if (s === "A") return "mr--a";
  if (s.includes("OT")) return "mr--ot";
  if (s.includes("OD")) return "mr--od";
  if (/CL|SPL|SUM|HOL|COMP/.test(s)) return "mr--leave";
  if (s.includes("P")) return "mr--p";
  return "";
}

export default function AttendanceMusterRoll() {
  const years = recentYears(5);
  const [draft, setDraft] = useState(emptyDraft);
  const [applied, setApplied] = useState(emptyDraft);
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  const filters = useMemo(() => {
    const f = { year: applied.year, month: applied.month };
    ["department", "designation", "shift", "search"].forEach((k) => { if (applied[k]) f[k] = applied[k]; });
    return f;
  }, [applied]);

  const { data, isLoading, isError } = useMusterRoll(filters);
  const rows = data?.data || [];
  const dayColumns = data?.dayColumns || [];
  const monthName = data?.monthName || MONTHS.find((m) => m.value === applied.month)?.label || "";

  const onGenerate = () => setApplied(draft);
  const onReset = () => { const d = emptyDraft(); setDraft(d); setApplied(d); };

  const exportCsv = () => {
    if (!rows.length) return;
    const header = [
      "S.No", "Employee ID", "Employee Name",
      ...dayColumns.map(String),
      ...SUMMARY_COLS.map((c) => c.label),
    ];
    const body = rows.map((r) => [
      r.sno, r.empId, r.empName,
      ...dayColumns.map((d) => r.days?.[d] || ""),
      ...SUMMARY_COLS.map((c) => r.summary?.[c.key] ?? 0),
    ]);
    downloadCsvMatrix(`muster-roll-${applied.year}-${String(applied.month).padStart(2, "0")}.csv`, [header, ...body]);
    toast.success(`Exported ${rows.length} employees`);
  };

  // Sticky-right offset for a summary column (rightmost = 0).
  const rightOffset = (i) => (SUMMARY_COLS.length - 1 - i) * SUM_W;

  return (
    <>
      <style>{MUSTER_CSS}</style>
      <PageHeader
        title="Attendance Muster Roll"
        subtitle={`${monthName} ${applied.year}${applied.department ? ` · ${applied.department}` : ""}${applied.designation ? ` · ${applied.designation}` : ""}`}
        actions={
          <>
            <Button variant="outline" disabled={!rows.length} onClick={exportCsv}><Icon name="download" size={16} /> Export CSV</Button>
            <Button variant="outline" disabled={!rows.length} onClick={() => window.print()}><Icon name="calendar-day" size={16} /> Print</Button>
          </>
        }
      />

      {/* Filters */}
      <div className="card no-print" style={{ padding: 16, marginBottom: 16 }}>
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
          <Field label="Month">
            <Select value={draft.month} onChange={(e) => setDraft((d) => ({ ...d, month: Number(e.target.value) }))} options={MONTHS} />
          </Field>
          <Field label="Year">
            <Select value={draft.year} onChange={(e) => setDraft((d) => ({ ...d, year: Number(e.target.value) }))}
              options={years.map((y) => ({ value: y, label: String(y) }))} />
          </Field>
          <Field label="Department">
            <Select value={draft.department} onChange={set("department")} placeholder="All departments" options={DEPARTMENTS} />
          </Field>
          <Field label="Designation">
            <Select value={draft.designation} onChange={set("designation")} placeholder="All designations" options={DESIGNATIONS} />
          </Field>
          <Field label="Shift">
            <Select value={draft.shift} onChange={set("shift")} placeholder="All shifts" options={ROSTER_SHIFTS} />
          </Field>
          <Field label="Employee (ID / Name / Mobile)">
            <Input value={draft.search} onChange={set("search")} placeholder="Search employee..."
              onKeyDown={(e) => e.key === "Enter" && onGenerate()} />
          </Field>
        </div>
        <div className="row" style={{ marginTop: 12, gap: 8 }}>
          <Button variant="primary" onClick={onGenerate}><Icon name="search" size={16} /> Generate Report</Button>
          <Button variant="outline" onClick={onReset}>Reset</Button>
        </div>
      </div>

      {/* Print-only header */}
      <div className="print-only muster-print-head">
        <h2>Attendance Muster Roll</h2>
        <div>{monthName} {applied.year}
          {applied.department ? ` · Department: ${applied.department}` : ""}
          {applied.designation ? ` · Designation: ${applied.designation}` : ""}
          {applied.shift ? ` · Shift: ${applied.shift}` : ""}
        </div>
        <div className="muster-print-ts">Printed: {new Date().toLocaleString()}</div>
      </div>

      <div className="text-sm muted no-print" style={{ marginBottom: 8 }}>{LEGEND}</div>

      {isError ? (
        <div className="card"><ErrorState message="Failed to load the muster roll." /></div>
      ) : (
        <div className="card muster-print-area" style={{ padding: 0, overflow: "hidden" }}>
          <div className="mr-scroll">
            <table className="mr-table">
              <thead>
                <tr>
                  <th className="mr-sticky-left mr-sno" style={{ left: 0 }}>S.No</th>
                  <th className="mr-sticky-left mr-eid" style={{ left: 44 }}>Emp ID</th>
                  <th className="mr-sticky-left mr-ename" style={{ left: 44 + 70 }}>Employee Name</th>
                  {dayColumns.map((d) => <th key={d} className="mr-day">{d}</th>)}
                  {SUMMARY_COLS.map((c, i) => (
                    <th key={c.key} className="mr-sticky-right mr-sum" style={{ right: rightOffset(i), width: SUM_W, minWidth: SUM_W }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              {isLoading ? (
                <TableSkeleton rows={8} cols={3 + dayColumns.length + SUMMARY_COLS.length} />
              ) : (
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.empId}>
                      <td className="mr-sticky-left mr-sno" style={{ left: 0 }}>{r.sno}</td>
                      <td className="mr-sticky-left mr-eid" style={{ left: 44 }}>{r.empId}</td>
                      <td className="mr-sticky-left mr-ename" style={{ left: 44 + 70 }} title={r.empName}>{r.empName}</td>
                      {dayColumns.map((d) => {
                        const v = r.days?.[d] || "";
                        return <td key={d} className={`mr-day ${cellClass(v)}`}>{v}</td>;
                      })}
                      {SUMMARY_COLS.map((c, i) => (
                        <td key={c.key} className="mr-sticky-right mr-sum" style={{ right: rightOffset(i), width: SUM_W, minWidth: SUM_W, fontWeight: c.key === "netPayable" ? 700 : 500 }}>
                          {r.summary?.[c.key] ?? 0}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
          {!isLoading && rows.length === 0 && (
            <EmptyState icon="🗓️" title="No employees match these filters" />
          )}
        </div>
      )}
    </>
  );
}

// Scoped styles: sticky employee (left) + summary (right) columns, compact grid,
// status tints, and a print-friendly landscape layout.
const MUSTER_CSS = `
.mr-scroll { overflow-x: auto; }
.mr-table { border-collapse: separate; border-spacing: 0; font-size: 12px; width: max-content; min-width: 100%; }
.mr-table th, .mr-table td { border-bottom: 1px solid var(--border); border-right: 1px solid var(--border); padding: 4px 6px; text-align: center; white-space: nowrap; }
.mr-table thead th { position: sticky; top: 0; z-index: 3; background: var(--surface-2, #eef1f4); font-weight: 700; }
.mr-day { width: 34px; min-width: 34px; }
.mr-sticky-left { position: sticky; z-index: 4; background: var(--surface, #fff); text-align: left; }
.mr-table thead .mr-sticky-left { z-index: 6; background: var(--surface-2, #eef1f4); }
.mr-sticky-right { position: sticky; z-index: 4; background: var(--surface, #fff); }
.mr-table thead .mr-sticky-right { z-index: 6; background: var(--surface-2, #eef1f4); }
.mr-sno { width: 44px; min-width: 44px; }
.mr-eid { width: 70px; min-width: 70px; }
.mr-ename { width: 190px; min-width: 190px; max-width: 190px; overflow: hidden; text-overflow: ellipsis; }
.mr--p { background: rgba(34,197,94,.14); }
.mr--a { background: rgba(239,68,68,.16); font-weight: 700; }
.mr--wo { background: rgba(100,116,139,.16); color: var(--muted, #64748b); }
.mr--leave { background: rgba(245,158,11,.16); }
.mr--od { background: rgba(59,130,246,.16); }
.mr--ot { background: rgba(139,92,246,.16); }
.print-only { display: none; }
@media print {
  @page { size: landscape; margin: 8mm; }
  body * { visibility: hidden; }
  .muster-print-area, .muster-print-area *, .muster-print-head, .muster-print-head * { visibility: visible; }
  .muster-print-head { display: block; position: absolute; top: 0; left: 0; }
  .muster-print-area { position: absolute; left: 0; top: 46px; width: 100%; box-shadow: none; }
  .no-print { display: none !important; }
  .mr-scroll { overflow: visible; }
  .mr-table { font-size: 8px; width: 100%; }
  .mr-table th, .mr-table td { padding: 1px 2px; }
  .mr-sticky-left, .mr-sticky-right, .mr-table thead th { position: static; }
  .mr-ename { width: auto; max-width: none; }
  .muster-print-ts { font-size: 9px; color: #555; }
}
`;
