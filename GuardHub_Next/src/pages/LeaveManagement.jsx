import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import DataTable from "../components/ui/DataTable";
import Icon from "../components/ui/Icon";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { Field, Select } from "../components/ui/Field";
import { ErrorState } from "../components/ui/States";
import DateField from "../components/forms/DateField";
import EmployeePicker from "../components/EmployeePicker";
import LeaveDetailsDrawer from "../components/leave/LeaveDetailsDrawer";
import { useLeaveManage, useLeaveTypes, useLeaveTransactions } from "../hooks/useLeaveV2";
import { leaveTxnService } from "../services/leaveV2Service";
import { toast } from "../store/toastStore";
import { MONTHS, recentYears, DEPARTMENTS, DESIGNATIONS } from "../utils/constants";
import { exportFilteredCsv } from "../utils/exportCsv";
import { buildLeaveDetail, exportLeaveDetailCsv } from "../utils/leaveDetail";

// Unified Employee Leave Management — the single place to search, review and
// manage every employee's leave. Filters are applied on the SERVER; the summary
// table, the details drawer and the CSV export all reflect exactly the same
// filtered dataset.
const emptyDraft = (year) => ({
  searchEmp: null, empId: "", fromDate: "", toDate: "", department: "", designation: "",
  year, month: "", leaveTypeCode: "",
});

export default function LeaveManagement() {
  const years = recentYears();
  const qc = useQueryClient();
  const { data: types = [] } = useLeaveTypes(false);

  const [draft, setDraft] = useState(() => emptyDraft(years[0]));
  const [applied, setApplied] = useState(() => emptyDraft(years[0]));
  const [viewEmp, setViewEmp] = useState(null);
  const [delTarget, setDelTarget] = useState(null); // { row, txns }
  const [deleting, setDeleting] = useState(false);

  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  // Only send the filters that are set (year always). `searchEmp` is UI-only;
  // the picked employee is sent as `empId`.
  const activeFilters = useMemo(() => {
    const f = { year: applied.year };
    ["empId", "fromDate", "toDate", "department", "designation", "month", "leaveTypeCode"].forEach((k) => {
      if (applied[k]) f[k] = applied[k];
    });
    return f;
  }, [applied]);

  const { data = { data: [], totals: {} }, isLoading, isError } = useLeaveManage(activeFilters);
  const rows = data.data;
  const totals = data.totals || {};

  const isFiltered = !!(applied.empId || applied.fromDate || applied.toDate ||
    applied.department || applied.designation || applied.month || applied.leaveTypeCode);

  // Detailed export applies to exactly ONE employee: the open drawer's employee,
  // or the single row a filter narrowed to. Its history is fetched with the SAME
  // hook the drawer uses (same query key => shared cache, no extra query).
  const detailEmp = viewEmp || (rows.length === 1 ? rows[0] : null);
  const { data: detailHistory = [] } = useLeaveTransactions(
    { ...activeFilters, empId: detailEmp?.empId },
    { enabled: !!detailEmp }
  );

  const onExport = () => {
    if (detailEmp) {
      // Single employee -> full drawer report (info + summary + by-type + history).
      exportLeaveDetailCsv(buildLeaveDetail(detailEmp, detailHistory, applied.year));
      return;
    }
    // 0 or many employees -> the filtered summary table, exactly as shown.
    exportFilteredCsv({
      baseName: `leave-management-${applied.year}`,
      columns: [
        { key: "name", label: "Employee Name" }, { key: "empId", label: "Employee ID" },
        { key: "department", label: "Department" }, { key: "designation", label: "Designation" },
        { key: "allocated", label: "Allocated Leave" }, { key: "taken", label: "Leave Taken" },
        { key: "remaining", label: "Remaining Leave" },
      ],
      rows: exportRows, isFiltered, noun: "employees",
    });
  };

  const onSearch = () => setApplied(draft);
  const onReset = () => { const d = emptyDraft(years[0]); setDraft(d); setApplied(d); };

  // Delete every leave for an employee within the current filter (guarded).
  const askDelete = async (row) => {
    try {
      const txns = await leaveTxnService.list({ ...activeFilters, empId: row.empId });
      if (!txns.length) { toast.warning(`${row.empName} has no leaves in this filter.`); return; }
      setDelTarget({ row, txns });
    } catch { toast.error("Could not load the employee's leaves."); }
  };
  const confirmDelete = async () => {
    setDeleting(true);
    try {
      for (const t of delTarget.txns) await leaveTxnService.remove(t._id);
      toast.success(`Deleted ${delTarget.txns.length} leave record(s) for ${delTarget.row.empName}.`);
      ["leave-manage", "leave-transactions", "leave-balances", "leaves"].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k] }));
      setDelTarget(null);
    } catch { toast.error("Failed to delete some records."); }
    setDeleting(false);
  };

  const columns = [
    { key: "empName", header: "Employee", sortable: true, render: (r) => (
      <div><div style={{ fontWeight: 600 }}>{r.empName}</div><div className="text-sm muted">ID {r.empId}</div></div>
    ) },
    { key: "empDepartment", header: "Department", render: (r) => r.empDepartment || "—" },
    { key: "empDesignation", header: "Designation", render: (r) => r.empDesignation || "—" },
    { key: "allocated", header: "Allocated", className: "num", sortable: true, render: (r) => r.allocated },
    { key: "taken", header: "Leave Taken", className: "num", sortable: true, render: (r) => r.taken },
    { key: "remaining", header: "Remaining", className: "num", sortable: true, render: (r) => <strong>{r.remaining}</strong> },
    { key: "_actions", header: "Actions", className: "num", render: (r) => (
      <div style={{ display: "inline-flex", gap: 2 }}>
        <button className="btn btn--ghost btn--icon" title="View details" aria-label={`View ${r.empName}`} onClick={() => setViewEmp(r)}>
          <Icon name="eye" size={16} />
        </button>
        <button className="btn btn--ghost btn--icon" title="Manage / edit leaves" aria-label={`Edit ${r.empName}`} onClick={() => setViewEmp(r)}>
          <Icon name="edit" size={16} />
        </button>
        <button className="btn btn--ghost btn--icon" title="Delete filtered leaves" aria-label={`Delete ${r.empName}'s filtered leaves`} onClick={() => askDelete(r)}>
          <Icon name="trash" size={16} />
        </button>
      </div>
    ) },
  ];

  const exportRows = rows.map((r) => ({
    name: r.empName, empId: r.empId, department: r.empDepartment, designation: r.empDesignation,
    allocated: r.allocated, taken: r.taken, remaining: r.remaining,
  }));

  return (
    <>
      <PageHeader
        title="Leave Management"
        subtitle={`${totals.employees ?? 0} employees · ${totals.taken ?? 0} days taken · ${applied.year}`}
        actions={
          <Button variant="outline" disabled={!rows.length} onClick={onExport}>
            <Icon name="download" size={16} /> Export CSV
          </Button>
        }
      />

      {/* Filter panel */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div>
            <EmployeePicker
              selected={draft.searchEmp}
              showCard={false}
              label="Employee (ID / Name / Mobile)"
              required={false}
              onSelect={(emp) => setDraft((d) => ({ ...d, searchEmp: emp, empId: emp?.empId || "" }))}
            />
            {draft.searchEmp && (
              <div className="text-sm" style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span>Selected: <strong>{draft.searchEmp.empName}</strong> (ID {draft.searchEmp.empId})</span>
                <button type="button" className="btn btn--ghost btn--sm"
                  onClick={() => setDraft((d) => ({ ...d, searchEmp: null, empId: "" }))}>Clear</button>
              </div>
            )}
          </div>
          <Field label="Department">
            <Select value={draft.department} onChange={set("department")} placeholder="All departments" options={DEPARTMENTS} />
          </Field>
          <Field label="Designation">
            <Select value={draft.designation} onChange={set("designation")} placeholder="All designations" options={DESIGNATIONS} />
          </Field>
          <Field label="Leave Type">
            <Select value={draft.leaveTypeCode} onChange={set("leaveTypeCode")} placeholder="All types"
              options={types.map((t) => ({ value: t.code, label: t.name }))} />
          </Field>
          <Field label="Year">
            <Select value={draft.year} onChange={(e) => setDraft((d) => ({ ...d, year: Number(e.target.value) }))}
              options={years.map((y) => ({ value: y, label: String(y) }))} />
          </Field>
          <Field label="Month">
            <Select value={draft.month} onChange={set("month")} placeholder="All months" options={MONTHS} />
          </Field>
          <DateField label="From Date" value={draft.fromDate} onChange={set("fromDate")} />
          <DateField label="To Date" value={draft.toDate} min={draft.fromDate} onChange={set("toDate")} />
        </div>
        <div className="row" style={{ marginTop: 12, gap: 8 }}>
          <Button variant="primary" onClick={onSearch}><Icon name="search" size={16} /> Search</Button>
          <Button variant="outline" onClick={onReset}>Reset</Button>
        </div>
      </div>

      {isError ? (
        <div className="card"><ErrorState message="Couldn't load Leave Management. Ensure the backend is running the latest build (it must expose GET /leave/manage)." /></div>
      ) : (
        <DataTable columns={columns} rows={rows} loading={isLoading} pageSize={15}
          rowKey={(r) => r.empId} emptyTitle="No employees match these filters" emptyIcon="🌴"
          pageSizeOptions={[15, 30, 50]} />
      )}

      <LeaveDetailsDrawer emp={viewEmp} filters={activeFilters} onClose={() => setViewEmp(null)} />

      <ConfirmDialog
        open={!!delTarget}
        title="Delete leaves?"
        message={delTarget
          ? `Delete ${delTarget.txns.length} leave record(s) for ${delTarget.row.empName} matching the current filters? Balances are restored. This cannot be undone.`
          : ""}
        confirmLabel="Delete"
        loading={deleting}
        onCancel={() => setDelTarget(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
