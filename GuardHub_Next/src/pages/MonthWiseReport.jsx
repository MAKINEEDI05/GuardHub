import { useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import EmployeePicker from "../components/EmployeePicker";
import { Field, Input } from "../components/ui/Field";
import { BlockSkeleton, EmptyState, ErrorState } from "../components/ui/States";
import { useMonthwise } from "../hooks/useReports";
import { currentMonthRange } from "../utils/date";
import { downloadCsv } from "../utils/csv";

// Month Wise summary from /month/monthwise-report/:empId. The backend computes
// Present/Leave/OD/WeekOff/Absent over the date range from the biometric logs +
// leave/od/roster collections. (The legacy /leaves/remaining-cl route does not
// exist in the backend, so it is intentionally not shown here.)
const TILES = [
  { key: "presentDays", label: "Present", color: "var(--status-present)" },
  { key: "absentDays", label: "Absent", color: "var(--status-absent)" },
  { key: "leaveDays", label: "Leave", color: "var(--status-leave)" },
  { key: "odDays", label: "OD", color: "var(--status-od)" },
  { key: "weekOffDays", label: "Week Off", color: "var(--status-weekoff)" },
  { key: "totalDays", label: "Total Days", color: "var(--text)" },
];

export default function MonthWiseReport() {
  const month = currentMonthRange();
  const [emp, setEmp] = useState(null);
  const [range, setRange] = useState({ start: month.start, end: month.end });

  const { data: summary, isLoading, isError, refetch, isFetching } = useMonthwise(
    emp?.empId,
    range.start,
    range.end,
    !!emp
  );

  const exportCsv = () => {
    if (!summary) return;
    downloadCsv(`monthwise-${emp.empId}.csv`, [
      { key: "empId", label: "Employee ID" },
      { key: "empName", label: "Name" },
      { key: "presentDays", label: "Present Days" },
      { key: "absentDays", label: "Absent Days" },
      { key: "leaveDays", label: "Leave Days" },
      { key: "odDays", label: "OD Days" },
      { key: "weekOffDays", label: "Week Off Days" },
      { key: "totalDays", label: "Total Days" },
      { key: "startDate", label: "From" },
      { key: "endDate", label: "To" },
    ], [{ ...summary, empName: emp.empName }]);
  };

  return (
    <>
      <PageHeader
        title="Month Wise Report"
        subtitle="Per-employee attendance summary over a date range"
        actions={
          <Button variant="outline" disabled={!summary} onClick={exportCsv}>
            <Icon name="download" size={16} /> Export CSV
          </Button>
        }
      />

      <Card className="mb-4">
        <EmployeePicker selected={emp} onSelect={setEmp} />
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <Field label="From Date">
            <Input type="date" value={range.start} onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))} />
          </Field>
          <Field label="To Date">
            <Input type="date" value={range.end} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} />
          </Field>
        </div>
      </Card>

      {!emp ? (
        <Card>
          <EmptyState icon="🔎" title="Select an employee" message="Search and pick an employee to view their monthly summary." />
        </Card>
      ) : isError ? (
        <Card>
          <ErrorState message="Could not load the monthly report." onRetry={refetch} />
        </Card>
      ) : isLoading || isFetching ? (
        <Card>
          <div className="summary-grid">
            {TILES.map((t) => <BlockSkeleton key={t.key} height={84} />)}
          </div>
        </Card>
      ) : summary ? (
        <Card title={`${emp.empName} · ${summary.startDate} → ${summary.endDate}`}>
          <div className="summary-grid">
            {TILES.map((t) => (
              <div className="summary-tile" key={t.key}>
                <div className="summary-tile__value" style={{ color: t.color }}>
                  {summary[t.key] ?? 0}
                </div>
                <div className="summary-tile__label">{t.label}</div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card>
          <EmptyState icon="📊" title="No data" message="No summary available for this range." />
        </Card>
      )}
    </>
  );
}
