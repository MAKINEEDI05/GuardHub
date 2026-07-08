import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import SearchBar from "../components/ui/SearchBar";
import DataTable from "../components/ui/DataTable";
import Badge from "../components/ui/Badge";
import Icon from "../components/ui/Icon";
import Drawer from "../components/ui/Drawer";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import LeaveEditDrawer from "../components/leave/LeaveEditDrawer";
import { useLeaveTransactions, useDeleteLeaveTxn } from "../hooks/useLeaveV2";
import { useEmployees } from "../hooks/useEmployees";
import { formatDate, formatDateTime } from "../utils/date";
import { exportFilteredCsv } from "../utils/exportCsv";

// View Leaves — leave transaction management (like View OT / View OD). Every
// leave is a finalized record (single-admin, no approval), so there is no status
// column. View / Edit / Delete per row.
export default function ViewLeaves() {
  const { data: leaves = [], isLoading } = useLeaveTransactions();
  const { data: employees = [] } = useEmployees();
  const del = useDeleteLeaveTxn();
  const [term, setTerm] = useState("");
  const [viewTxn, setViewTxn] = useState(null);
  const [editTxn, setEditTxn] = useState(null);
  const [delTxn, setDelTxn] = useState(null);

  const empMap = useMemo(() => {
    const m = new Map();
    employees.forEach((e) => m.set(String(e.empId), e));
    return m;
  }, [employees]);

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    const withEmp = leaves.map((l) => {
      const e = empMap.get(String(l.empId)) || {};
      return { ...l, _name: e.empName || `ID ${l.empId}`, _dept: e.empDepartment || "", _desig: e.empDesignation || "" };
    });
    if (!q) return withEmp;
    return withEmp.filter((l) =>
      [l.empId, l._name, l._dept, l._desig, l.leaveTypeName, l.reason]
        .map((v) => String(v ?? "").toLowerCase()).some((v) => v.includes(q))
    );
  }, [leaves, term, empMap]);

  const columns = [
    { key: "empId", header: "Emp ID", sortable: true, render: (l) => l.empId },
    { key: "_name", header: "Employee", sortable: true, render: (l) => <span style={{ fontWeight: 600 }}>{l._name}</span> },
    { key: "_dept", header: "Department", render: (l) => l._dept || "—" },
    { key: "_desig", header: "Designation", render: (l) => l._desig || "—" },
    { key: "leaveTypeName", header: "Leave Type", render: (l) => <Badge status="leave">{l.leaveTypeName}</Badge> },
    { key: "shiftType", header: "Shift", render: (l) => l.shiftType || "—" },
    { key: "fromDate", header: "From", sortable: true, sortValue: (l) => new Date(l.fromDate).getTime(), render: (l) => formatDate(l.fromDate) },
    { key: "toDate", header: "To", render: (l) => formatDate(l.toDate) },
    { key: "dayType", header: "Duration", render: (l) => l.dayType || "—" },
    { key: "days", header: "Days", className: "num", sortable: true, render: (l) => <strong>{l.days}</strong> },
    { key: "_actions", header: "Actions", className: "num", render: (l) => (
      <div style={{ display: "inline-flex", gap: 2 }}>
        <button className="btn btn--ghost btn--icon" title="View" aria-label="View leave" onClick={() => setViewTxn(l)}><Icon name="eye" size={16} /></button>
        <button className="btn btn--ghost btn--icon" title="Edit" aria-label="Edit leave" onClick={() => setEditTxn(l)}><Icon name="edit" size={16} /></button>
        <button className="btn btn--ghost btn--icon" title="Delete" aria-label="Delete leave" onClick={() => setDelTxn(l)}><Icon name="trash" size={16} /></button>
      </div>
    ) },
  ];

  const exportRows = rows.map((l) => ({
    empId: l.empId, name: l._name, dept: l._dept, desig: l._desig, type: l.leaveTypeName,
    shift: l.shiftType, from: formatDate(l.fromDate), to: formatDate(l.toDate), duration: l.dayType, days: l.days,
  }));

  return (
    <>
      <PageHeader
        title="View Leaves"
        subtitle={`${leaves.length} leave records`}
        actions={
          <>
            <Link className="btn btn--outline" to="/leaves"><Icon name="calendar-month" size={16} /> Leave Management</Link>
            <Button variant="outline" disabled={!rows.length} onClick={() => exportFilteredCsv({
              baseName: "leave-transactions",
              columns: [
                { key: "empId", label: "Employee ID" }, { key: "name", label: "Employee Name" },
                { key: "dept", label: "Department" }, { key: "desig", label: "Designation" },
                { key: "type", label: "Leave Type" }, { key: "shift", label: "Shift" },
                { key: "from", label: "From" }, { key: "to", label: "To" },
                { key: "duration", label: "Duration" }, { key: "days", label: "Days" },
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
        <SearchBar value={term} onChange={setTerm} placeholder="Search employee, department, type, reason..." />
      </div>
      <DataTable columns={columns} rows={rows} loading={isLoading} pageSize={15}
        emptyTitle="No leave records found" emptyIcon="🌴" pageSizeOptions={[15, 30, 50]} />

      {/* View (read-only) */}
      <Drawer open={!!viewTxn} title="Leave Details" onClose={() => setViewTxn(null)} width={520}>
        {viewTxn && (
          <div className="stack" style={{ gap: 16 }}>
            <section>
              <div className="text-sm muted" style={{ fontWeight: 600, marginBottom: 6 }}>Employee Information</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{viewTxn._name}</div>
              <div className="text-sm muted">ID {viewTxn.empId}{viewTxn._dept ? ` · ${viewTxn._dept}` : ""}{viewTxn._desig ? ` · ${viewTxn._desig}` : ""}</div>
            </section>
            <section>
              <div className="text-sm muted" style={{ fontWeight: 600, marginBottom: 6 }}>Leave Information</div>
              <dl className="detail-grid">
                <Row k="Leave Type" v={viewTxn.leaveTypeName} />
                <Row k="Shift" v={viewTxn.shiftType || "—"} />
                <Row k="From Date" v={formatDate(viewTxn.fromDate)} />
                <Row k="To Date" v={formatDate(viewTxn.toDate)} />
                <Row k="Days" v={viewTxn.days} />
                <Row k="Duration" v={viewTxn.dayType || "—"} />
                <Row k="Pay" v={viewTxn.isPaid ? "Paid" : "Unpaid (LOP)"} />
                <Row k="Reason" v={viewTxn.reason || "—"} />
                <Row k="Created Date" v={formatDateTime(viewTxn.createdAt)} />
              </dl>
            </section>
          </div>
        )}
      </Drawer>

      <LeaveEditDrawer txn={editTxn} onClose={() => setEditTxn(null)} />

      <ConfirmDialog
        open={!!delTxn}
        title="Delete leave record?"
        message={delTxn ? `Delete ${delTxn._name}'s ${delTxn.leaveTypeName} (${delTxn.days} day(s))? Balance is restored.` : ""}
        confirmLabel="Delete"
        loading={del.isPending}
        onCancel={() => setDelTxn(null)}
        onConfirm={async () => { await del.mutateAsync(delTxn._id); setDelTxn(null); }}
      />
    </>
  );
}

function Row({ k, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
      <span className="text-sm muted">{k}</span>
      <span style={{ textAlign: "right" }}>{v}</span>
    </div>
  );
}
