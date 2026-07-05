import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import SearchBar from "../components/ui/SearchBar";
import DataTable from "../components/ui/DataTable";
import Badge from "../components/ui/Badge";
import Icon from "../components/ui/Icon";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import EmployeeTableCell from "../components/EmployeeTableCell";
import { useLeaveTransactions, useDeleteLeaveTxn } from "../hooks/useLeaveV2";
import { useEmployees } from "../hooks/useEmployees";
import { formatDate } from "../utils/date";
import { exportFilteredCsv } from "../utils/exportCsv";

// Leave history — reads the redesigned leave_transactions (day counts, balance-
// linked). Deleting reverses the balance debit and removes the mirrored legacy
// row. Links to the balance & report screens for the full picture.
export default function ViewLeaves() {
  const { data: leaves = [], isLoading } = useLeaveTransactions();
  const { data: employees = [] } = useEmployees();
  const del = useDeleteLeaveTxn();
  const [term, setTerm] = useState("");
  const [confirm, setConfirm] = useState(null);

  const empMap = useMemo(() => {
    const m = new Map();
    employees.forEach((e) => m.set(String(e.empId), e));
    return m;
  }, [employees]);
  const nameOf = (id) => empMap.get(String(id))?.empName || `ID ${id}`;

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    const withName = leaves.map((l) => ({ ...l, _name: nameOf(l.empId) }));
    if (!q) return withName;
    return withName.filter((l) =>
      [l.empId, l._name, l.leaveTypeName, l.reason]
        .map((v) => String(v ?? "").toLowerCase())
        .some((v) => v.includes(q))
    );
  }, [leaves, term, empMap]);

  const columns = [
    { key: "_name", header: "Employee", sortable: true, render: (l) => (
      <EmployeeTableCell emp={empMap.get(String(l.empId))} name={l._name} empId={l.empId} />
    ) },
    { key: "leaveTypeName", header: "Type", render: (l) => <Badge status="leave">{l.leaveTypeName}{l.isPaid ? "" : " (LOP)"}</Badge> },
    { key: "fromDate", header: "From", sortable: true, sortValue: (l) => new Date(l.fromDate).getTime(), render: (l) => formatDate(l.fromDate) },
    { key: "toDate", header: "To", render: (l) => formatDate(l.toDate) },
    { key: "days", header: "Days", className: "num", sortable: true, render: (l) => <strong>{l.days}</strong> },
    { key: "dayType", header: "Duration", render: (l) => l.dayType || "—" },
    { key: "reason", header: "Reason", render: (l) => <span title={l.reason}>{(l.reason || "—").slice(0, 30)}</span> },
    { key: "_actions", header: "", className: "num", render: (l) => (
      <button className="btn btn--ghost btn--icon" title="Delete" aria-label="Delete leave" onClick={() => setConfirm(l)}>
        <Icon name="trash" size={16} />
      </button>
    ) },
  ];

  const exportRows = rows.map((l) => ({
    empId: l.empId, name: l._name, type: l.leaveTypeName, from: formatDate(l.fromDate),
    to: formatDate(l.toDate), days: l.days, duration: l.dayType, reason: l.reason,
  }));

  return (
    <>
      <PageHeader
        title="Leave Records"
        subtitle={`${leaves.length} leave transactions`}
        actions={
          <>
            <Link className="btn btn--outline" to="/leaves/balances"><Icon name="calendar-month" size={16} /> Balances</Link>
            <Link className="btn btn--outline" to="/leaves/report"><Icon name="download" size={16} /> Report</Link>
            <Button variant="outline" disabled={!rows.length} onClick={() => exportFilteredCsv({
              baseName: "leave-records",
              columns: [
                { key: "empId", label: "Employee ID" }, { key: "name", label: "Name" }, { key: "type", label: "Type" },
                { key: "from", label: "From" }, { key: "to", label: "To" }, { key: "days", label: "Days" },
                { key: "duration", label: "Duration" }, { key: "reason", label: "Reason" },
              ],
              rows: exportRows, isFiltered: !!term.trim(), noun: "leave records",
            })}>
              <Icon name="download" size={16} /> Export
            </Button>
            <Link className="btn btn--primary" to="/apply/leave"><Icon name="plus" size={16} /> Apply Leave</Link>
          </>
        }
      />
      <div className="toolbar">
        <SearchBar value={term} onChange={setTerm} placeholder="Search by employee, type, reason..." />
      </div>
      <DataTable columns={columns} rows={rows} loading={isLoading} pageSize={15}
        emptyTitle="No leave records found" emptyIcon="🌴" />
      <ConfirmDialog
        open={!!confirm}
        title="Delete leave record?"
        message={confirm ? `Delete ${confirm._name}'s ${confirm.leaveTypeName} (${confirm.days} day(s))? This restores the balance.` : ""}
        confirmLabel="Delete"
        loading={del.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => { await del.mutateAsync(confirm._id); setConfirm(null); }}
      />
    </>
  );
}
