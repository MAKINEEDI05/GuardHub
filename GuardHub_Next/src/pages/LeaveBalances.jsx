import { useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import SearchBar from "../components/ui/SearchBar";
import DataTable from "../components/ui/DataTable";
import Icon from "../components/ui/Icon";
import Drawer from "../components/ui/Drawer";
import { Field, Input, Select } from "../components/ui/Field";
import { useLeaveBalances, useLeaveTypes, useAllocateLeave } from "../hooks/useLeaveV2";
import { recentYears } from "../utils/constants";
import { exportFilteredCsv } from "../utils/exportCsv";

// Leave Balances — per employee, per year: Allocated / Used / Remaining, with a
// per-type breakdown and a yearly allocation action. Balances are maintained
// automatically as leaves are recorded/deleted; this screen reads + allocates.
export default function LeaveBalances() {
  const years = recentYears();
  const [year, setYear] = useState(years[0]);
  const [term, setTerm] = useState("");
  const { data = { types: [], data: [] }, isLoading } = useLeaveBalances(year);
  const { data: types = [] } = useLeaveTypes(true);
  const allocate = useAllocateLeave();

  const [breakdown, setBreakdown] = useState(null); // employee row
  const [allocOpen, setAllocOpen] = useState(false);
  const [alloc, setAlloc] = useState({}); // code -> days

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return data.data;
    return data.data.filter((r) =>
      [r.empId, r.empName, r.empDepartment].some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [data.data, term]);

  const columns = [
    { key: "empName", header: "Employee", sortable: true, render: (r) => (
      <div><div style={{ fontWeight: 600 }}>{r.empName}</div><div className="text-sm muted">ID {r.empId}</div></div>
    ) },
    { key: "empDepartment", header: "Department", render: (r) => r.empDepartment || "—" },
    { key: "allocated", header: "Allocated", className: "num", sortable: true, sortValue: (r) => r.totals.allocated, render: (r) => r.totals.allocated },
    { key: "used", header: "Used", className: "num", sortable: true, sortValue: (r) => r.totals.used, render: (r) => r.totals.used },
    { key: "remaining", header: "Remaining", className: "num", sortable: true, sortValue: (r) => r.totals.remaining, render: (r) => <strong>{r.totals.remaining}</strong> },
    { key: "_actions", header: "", className: "num", render: (r) => (
      <button className="btn btn--ghost btn--icon" title="View breakdown" aria-label="View breakdown" onClick={() => setBreakdown(r)}>
        <Icon name="eye" size={16} />
      </button>
    ) },
  ];

  const openAllocate = () => {
    const seed = {};
    types.forEach((t) => { seed[t.code] = t.defaultAnnualQuota ?? 0; });
    setAlloc(seed);
    setAllocOpen(true);
  };

  const submitAllocate = async () => {
    const allocations = Object.entries(alloc)
      .map(([leaveTypeCode, v]) => ({ leaveTypeCode, allocated: Number(v) || 0 }))
      .filter((a) => a.allocated >= 0);
    try {
      await allocate.mutateAsync({ year, allocations });
      setAllocOpen(false);
    } catch { /* toast in hook */ }
  };

  const exportRows = rows.map((r) => ({
    empId: r.empId, name: r.empName, department: r.empDepartment,
    allocated: r.totals.allocated, used: r.totals.used, remaining: r.totals.remaining,
  }));

  return (
    <>
      <PageHeader
        title="Leave Balances"
        subtitle={`Allocation & remaining leave for ${year}`}
        actions={
          <>
            <Button variant="outline" disabled={!rows.length} onClick={() => exportFilteredCsv({
              baseName: `leave-balances-${year}`,
              columns: [
                { key: "empId", label: "Employee ID" }, { key: "name", label: "Name" }, { key: "department", label: "Department" },
                { key: "allocated", label: "Allocated" }, { key: "used", label: "Used" }, { key: "remaining", label: "Remaining" },
              ],
              rows: exportRows, isFiltered: !!term.trim(), noun: "balances",
            })}>
              <Icon name="download" size={16} /> Export
            </Button>
            <Button variant="primary" onClick={openAllocate}><Icon name="plus" size={16} /> Allocate {year}</Button>
          </>
        }
      />

      <div className="toolbar" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <SearchBar value={term} onChange={setTerm} placeholder="Search employee, department..." />
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))}
          options={years.map((y) => ({ value: y, label: String(y) }))} style={{ width: "auto" }} />
      </div>

      <DataTable columns={columns} rows={rows} loading={isLoading} pageSize={15}
        emptyTitle="No balances yet" emptyMessage="Run an allocation to grant leave for this year." emptyIcon="📊"
        rowKey={(r) => r.empId} />

      {/* Per-type breakdown */}
      <Drawer open={!!breakdown} title={breakdown ? `${breakdown.empName} — ${year}` : ""} onClose={() => setBreakdown(null)}>
        {breakdown && (
          <table className="table">
            <thead><tr><th>Type</th><th className="num">Allocated</th><th className="num">Used</th><th className="num">Remaining</th></tr></thead>
            <tbody>
              {breakdown.byType.length === 0 && <tr><td colSpan={4} className="muted">No allocation for this year.</td></tr>}
              {breakdown.byType.map((b) => (
                <tr key={b.leaveTypeCode}>
                  <td>{b.leaveTypeName}</td>
                  <td className="num">{b.allocated}</td>
                  <td className="num">{b.used}</td>
                  <td className="num"><strong>{b.remaining}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Drawer>

      {/* Yearly allocation */}
      <Drawer
        open={allocOpen}
        title={`Allocate leave for ${year}`}
        onClose={() => setAllocOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setAllocOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={allocate.isPending} onClick={submitAllocate}>Apply to all active employees</Button>
          </>
        }
      >
        <p className="text-sm muted" style={{ marginTop: 0 }}>
          Sets each type's yearly allocation for every active employee. Used days are not affected.
        </p>
        {types.length === 0 && <p className="muted">No active leave types. Add one under Leave Types first.</p>}
        {types.map((t) => (
          <Field key={t.code} label={`${t.name} (${t.code})`} hint={t.isPaid ? "Paid" : "Unpaid (LOP)"}>
            <Input type="number" min="0" value={alloc[t.code] ?? 0}
              onChange={(e) => setAlloc((a) => ({ ...a, [t.code]: e.target.value }))} />
          </Field>
        ))}
      </Drawer>
    </>
  );
}
