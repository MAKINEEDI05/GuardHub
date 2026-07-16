import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import EmployeeSearchFilter from "../components/EmployeeSearchFilter";
import DataTable from "../components/ui/DataTable";
import Badge from "../components/ui/Badge";
import Icon from "../components/ui/Icon";
import Drawer from "../components/ui/Drawer";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import EmployeeTableCell from "../components/EmployeeTableCell";
import OtEditDrawer from "../components/ot/OtEditDrawer";
import { useOts, useDeleteOt } from "../hooks/useOts";
import { useEmployees } from "../hooks/useEmployees";
import { formatDate, formatDateTime } from "../utils/date";
import { exportFilteredCsv } from "../utils/exportCsv";

// OT records are final once recorded — an admin-entered OT is already worked, so
// there is no approval workflow (no Pending/Approved/Rejected status).
export default function ViewOt() {
  const { data: ots = [], isLoading } = useOts();
  const { data: employees = [] } = useEmployees();
  const del = useDeleteOt();
  const [selEmp, setSelEmp] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [viewOt, setViewOt] = useState(null);
  const [editOt, setEditOt] = useState(null);

  // empId -> employee master record, only to resolve the photo (OT already
  // denormalises employeeName/designation).
  const empMap = useMemo(() => {
    const m = new Map();
    employees.forEach((e) => m.set(String(e.empId), e));
    return m;
  }, [employees]);

  const rows = useMemo(() => {
    if (!selEmp) return ots;
    return ots.filter((o) => String(o.employeeId) === String(selEmp.empId));
  }, [ots, selEmp]);

  const columns = [
    {
      key: "employeeName", header: "Employee", sortable: true,
      render: (o) => (
        <EmployeeTableCell
          emp={empMap.get(String(o.employeeId))}
          name={o.employeeName}
          empId={o.employeeId}
          designation={o.designation}
        />
      ),
    },
    { key: "currentShift", header: "Current", render: (o) => o.currentShift },
    { key: "additionalShift", header: "Additional", render: (o) => o.additionalShift },
    { key: "workingDuration", header: "Duration", render: (o) => o.workingDuration },
    { key: "fromDate", header: "From", sortable: true, sortValue: (o) => new Date(o.fromDate).getTime(), render: (o) => formatDate(o.fromDate) },
    { key: "location", header: "Location", render: (o) => o.location || "—" },
    {
      key: "_actions", header: "Actions", className: "num",
      render: (o) => (
        <div style={{ display: "inline-flex", gap: 2 }}>
          <button className="btn btn--ghost btn--icon" title="View" aria-label="View OT" onClick={() => setViewOt(o)}><Icon name="eye" size={16} /></button>
          <button className="btn btn--ghost btn--icon" title="Edit" aria-label="Edit OT" onClick={() => setEditOt(o)}><Icon name="edit" size={16} /></button>
          <button className="btn btn--ghost btn--icon" title="Delete" aria-label="Delete OT" onClick={() => setConfirm(o)}><Icon name="trash" size={16} /></button>
        </div>
      ),
    },
  ];

  const exportRows = rows.map((o) => ({
    employeeId: o.employeeId, employeeName: o.employeeName, currentShift: o.currentShift,
    additionalShift: o.additionalShift, workingDuration: o.workingDuration,
    from: formatDate(o.fromDate), to: formatDate(o.toDate), location: o.location,
    reason: o.reason,
  }));

  return (
    <>
      <PageHeader
        title="OT Records"
        subtitle={`${ots.length} overtime requests`}
        actions={
          <>
            <Button variant="outline" disabled={!rows.length} onClick={() => exportFilteredCsv({
              baseName: "ot-records",
              columns: [
                { key: "employeeId", label: "Employee ID" }, { key: "employeeName", label: "Name" },
                { key: "currentShift", label: "Current Shift" }, { key: "additionalShift", label: "Additional Shift" },
                { key: "workingDuration", label: "Duration" }, { key: "from", label: "From" }, { key: "to", label: "To" },
                { key: "location", label: "Location" }, { key: "reason", label: "Reason" },
              ],
              rows: exportRows,
              isFiltered: !!selEmp,
              noun: "OT records",
            })}>
              <Icon name="download" size={16} /> Export
            </Button>
            <Link className="btn btn--primary" to="/apply/ot"><Icon name="plus" size={16} /> Apply OT</Link>
          </>
        }
      />
      <div className="toolbar">
        <EmployeeSearchFilter selected={selEmp} onSelect={setSelEmp} />
      </div>
      <DataTable columns={columns} rows={rows} loading={isLoading} pageSize={15} emptyTitle="No OT records found" emptyIcon="⏰" />

      {/* View (read-only) */}
      <Drawer open={!!viewOt} title="OT Details" onClose={() => setViewOt(null)} width={520}>
        {viewOt && (() => {
          const e = empMap.get(String(viewOt.employeeId)) || {};
          const dept = viewOt.department || e.empDepartment;
          const desig = viewOt.designation || e.empDesignation;
          return (
            <div className="stack" style={{ gap: 16 }}>
              <section>
                <div className="text-sm muted" style={{ fontWeight: 600, marginBottom: 6 }}>Employee Information</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{viewOt.employeeName || e.empName || `ID ${viewOt.employeeId}`}</div>
                <div className="text-sm muted">ID {viewOt.employeeId}{dept ? ` · ${dept}` : ""}{desig ? ` · ${desig}` : ""}</div>
              </section>
              <section>
                <div className="text-sm muted" style={{ fontWeight: 600, marginBottom: 6 }}>OT Information</div>
                <dl className="detail-grid">
                  <Row k="Current Shift" v={viewOt.currentShift || "—"} />
                  <Row k="Additional Shift" v={viewOt.additionalShift || "—"} />
                  <Row k="Duration" v={viewOt.workingDuration || "—"} />
                  <Row k="Location" v={viewOt.location || "—"} />
                  <Row k="From Date" v={formatDate(viewOt.fromDate)} />
                  <Row k="To Date" v={formatDate(viewOt.toDate)} />
                  <Row k="Created Date" v={formatDateTime(viewOt.createdAt)} />
                </dl>
              </section>
              {(viewOt.reason || viewOt.remarks) && (
                <section>
                  <div className="text-sm muted" style={{ fontWeight: 600, marginBottom: 6 }}>Reason & Remarks</div>
                  <div>{viewOt.reason || "—"}</div>
                  {viewOt.remarks && <div className="text-sm muted" style={{ marginTop: 4 }}>{viewOt.remarks}</div>}
                </section>
              )}
            </div>
          );
        })()}
      </Drawer>

      <OtEditDrawer ot={editOt} onClose={() => setEditOt(null)} />

      <ConfirmDialog
        open={!!confirm}
        title="Delete OT record?"
        message={confirm ? `Delete ${confirm.employeeName || `ID ${confirm.employeeId}`}'s OT request?` : ""}
        confirmLabel="Delete"
        loading={del.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => { await del.mutateAsync(confirm._id); setConfirm(null); }}
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
