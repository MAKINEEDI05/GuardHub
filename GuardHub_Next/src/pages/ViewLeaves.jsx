import { useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import SearchBar from "../components/ui/SearchBar";
import DataTable from "../components/ui/DataTable";
import Badge from "../components/ui/Badge";
import Icon from "../components/ui/Icon";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import EmployeeTableCell from "../components/EmployeeTableCell";
import { Link } from "react-router-dom";
import { useLeaves, useDeleteLeave } from "../hooks/useLeaves";
import { useEmployees } from "../hooks/useEmployees";
import { formatDate } from "../utils/date";
import { exportFilteredCsv } from "../utils/exportCsv";

export default function ViewLeaves() {
  const { data: leaves = [], isLoading } = useLeaves();
  const { data: employees = [] } = useEmployees();
  const del = useDeleteLeave();
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
      [l.empId, l._name, l.empLeaveType, l.empReason]
        .map((v) => String(v ?? "").toLowerCase())
        .some((v) => v.includes(q))
    );
  }, [leaves, term, empMap]);

  const columns = [
    {
      key: "_name",
      header: "Employee",
      sortable: true,
      render: (l) => (
        <EmployeeTableCell emp={empMap.get(String(l.empId))} name={l._name} empId={l.empId} />
      ),
    },
    { key: "empLeaveType", header: "Type", render: (l) => <Badge status="leave">{l.empLeaveType}</Badge> },
    { key: "empFromDate", header: "From", sortable: true, sortValue: (l) => new Date(l.empFromDate).getTime(), render: (l) => formatDate(l.empFromDate) },
    { key: "empToDate", header: "To", render: (l) => formatDate(l.empToDate) },
    { key: "empOdType", header: "Duration", render: (l) => l.empOdType || "—" },
    { key: "empShiftType", header: "Shift", render: (l) => l.empShiftType || "—" },
    { key: "empReason", header: "Reason", render: (l) => <span title={l.empReason}>{(l.empReason || "—").slice(0, 30)}</span> },
    {
      key: "_actions",
      header: "",
      className: "num",
      render: (l) => (
        <button className="btn btn--ghost btn--icon" title="Delete" onClick={() => setConfirm(l)}>
          <Icon name="trash" size={16} />
        </button>
      ),
    },
  ];

  const exportRows = rows.map((l) => ({
    empId: l.empId, name: l._name, type: l.empLeaveType,
    from: formatDate(l.empFromDate), to: formatDate(l.empToDate),
    duration: l.empOdType, shift: l.empShiftType, reason: l.empReason,
  }));

  return (
    <>
      <PageHeader
        title="Leave Records"
        subtitle={`${leaves.length} leave requests`}
        actions={
          <>
            <Button variant="outline" disabled={!rows.length} onClick={() => exportFilteredCsv({
              baseName: "leave-records",
              columns: [
                { key: "empId", label: "Employee ID" }, { key: "name", label: "Name" }, { key: "type", label: "Type" },
                { key: "from", label: "From" }, { key: "to", label: "To" }, { key: "duration", label: "Duration" },
                { key: "shift", label: "Shift" }, { key: "reason", label: "Reason" },
              ],
              rows: exportRows,
              isFiltered: !!term.trim(),
              noun: "leave records",
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
      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        pageSize={15}
        emptyTitle="No leave requests found"
        emptyIcon="🌴"
      />
      <ConfirmDialog
        open={!!confirm}
        title="Delete leave record?"
        message={confirm ? `Delete ${confirm._name}'s ${confirm.empLeaveType}?` : ""}
        confirmLabel="Delete"
        loading={del.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => { await del.mutateAsync(confirm._id); setConfirm(null); }}
      />
    </>
  );
}
