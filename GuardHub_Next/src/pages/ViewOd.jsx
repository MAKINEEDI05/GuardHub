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
import EmployeeTableCell from "../components/EmployeeTableCell";
import OdEditDrawer from "../components/od/OdEditDrawer";
import { useOds, useDeleteOd } from "../hooks/useOds";
import { useEmployees } from "../hooks/useEmployees";
import { formatDate, formatDateTime } from "../utils/date";
import { exportFilteredCsv } from "../utils/exportCsv";

// Inclusive day count for an OD span; a single-day half counts as 0.5.
function odDays(from, to, type) {
  if (!from || !to) return null;
  const d = Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
  if (d < 1) return null;
  if (d === 1 && /HALF/i.test(type || "")) return 0.5;
  return d;
}

export default function ViewOd() {
  const { data: ods = [], isLoading } = useOds();
  const { data: employees = [] } = useEmployees();
  const del = useDeleteOd();
  const [term, setTerm] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [viewOd, setViewOd] = useState(null);
  const [editOd, setEditOd] = useState(null);

  const empMap = useMemo(() => {
    const m = new Map();
    employees.forEach((e) => m.set(String(e.empId), e));
    return m;
  }, [employees]);
  const nameOf = (id) => empMap.get(String(id))?.empName || `ID ${id}`;

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    const withName = ods.map((o) => ({ ...o, _name: nameOf(o.empId) }));
    if (!q) return withName;
    return withName.filter((o) =>
      [o.empId, o._name, o.odLocation, o.empPurpose]
        .map((v) => String(v ?? "").toLowerCase())
        .some((v) => v.includes(q))
    );
  }, [ods, term, empMap]);

  const columns = [
    {
      key: "_name",
      header: "Employee",
      sortable: true,
      render: (o) => (
        <EmployeeTableCell emp={empMap.get(String(o.empId))} name={o._name} empId={o.empId} />
      ),
    },
    { key: "odLocation", header: "Location", render: (o) => <Badge status="od">{o.odLocation || "Not Specified"}</Badge> },
    { key: "empFromDate", header: "From", sortable: true, sortValue: (o) => new Date(o.empFromDate).getTime(), render: (o) => formatDate(o.empFromDate) },
    { key: "empToDate", header: "To", render: (o) => formatDate(o.empToDate) },
    { key: "empOdType", header: "Duration", render: (o) => o.empOdType || "—" },
    { key: "empShiftType", header: "Shift", render: (o) => o.empShiftType || "—" },
    { key: "empPurpose", header: "Purpose", render: (o) => <span title={o.empPurpose}>{(o.empPurpose || "—").slice(0, 30)}</span> },
    {
      key: "_actions", header: "Actions", className: "num",
      render: (o) => (
        <div style={{ display: "inline-flex", gap: 2 }}>
          <button className="btn btn--ghost btn--icon" title="View" aria-label="View OD" onClick={() => setViewOd(o)}><Icon name="eye" size={16} /></button>
          <button className="btn btn--ghost btn--icon" title="Edit" aria-label="Edit OD" onClick={() => setEditOd(o)}><Icon name="edit" size={16} /></button>
          <button className="btn btn--ghost btn--icon" title="Delete" aria-label="Delete OD" onClick={() => setConfirm(o)}><Icon name="trash" size={16} /></button>
        </div>
      ),
    },
  ];

  const exportRows = rows.map((o) => ({
    empId: o.empId, name: o._name, location: o.odLocation,
    from: formatDate(o.empFromDate), to: formatDate(o.empToDate),
    duration: o.empOdType, shift: o.empShiftType, purpose: o.empPurpose,
  }));

  return (
    <>
      <PageHeader
        title="OD Records"
        subtitle={`${ods.length} on-duty requests`}
        actions={
          <>
            <Button variant="outline" disabled={!rows.length} onClick={() => exportFilteredCsv({
              baseName: "od-records",
              columns: [
                { key: "empId", label: "Employee ID" }, { key: "name", label: "Name" }, { key: "location", label: "Location" },
                { key: "from", label: "From" }, { key: "to", label: "To" }, { key: "duration", label: "Duration" },
                { key: "shift", label: "Shift" }, { key: "purpose", label: "Purpose" },
              ],
              rows: exportRows,
              isFiltered: !!term.trim(),
              noun: "OD records",
            })}>
              <Icon name="download" size={16} /> Export
            </Button>
            <Link className="btn btn--primary" to="/apply/od"><Icon name="plus" size={16} /> Apply OD</Link>
          </>
        }
      />
      <div className="toolbar">
        <SearchBar value={term} onChange={setTerm} placeholder="Search by employee, location, purpose..." />
      </div>
      <DataTable columns={columns} rows={rows} loading={isLoading} pageSize={15} emptyTitle="No OD records found" emptyIcon="📋" />

      {/* View (read-only) */}
      <Drawer open={!!viewOd} title="OD Details" onClose={() => setViewOd(null)} width={520}>
        {viewOd && (() => {
          const e = empMap.get(String(viewOd.empId)) || {};
          const days = odDays(viewOd.empFromDate, viewOd.empToDate, viewOd.empOdType);
          return (
            <div className="stack" style={{ gap: 16 }}>
              <section>
                <div className="text-sm muted" style={{ fontWeight: 600, marginBottom: 6 }}>Employee Information</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{e.empName || `ID ${viewOd.empId}`}</div>
                <div className="text-sm muted">ID {viewOd.empId}{e.empDepartment ? ` · ${e.empDepartment}` : ""}{e.empDesignation ? ` · ${e.empDesignation}` : ""}</div>
              </section>
              <section>
                <div className="text-sm muted" style={{ fontWeight: 600, marginBottom: 6 }}>OD Information</div>
                <dl className="detail-grid">
                  <Row k="Location" v={viewOd.odLocation || "Not Specified"} />
                  <Row k="Shift" v={viewOd.empShiftType || "—"} />
                  <Row k="From Date" v={formatDate(viewOd.empFromDate)} />
                  <Row k="To Date" v={formatDate(viewOd.empToDate)} />
                  <Row k="Duration" v={viewOd.empOdType || "—"} />
                  <Row k="Number of Days" v={days ?? "—"} />
                  <Row k="Created Date" v={formatDateTime(viewOd.createdAt)} />
                </dl>
              </section>
              <section>
                <div className="text-sm muted" style={{ fontWeight: 600, marginBottom: 6 }}>Purpose</div>
                <div>{viewOd.empPurpose || "—"}</div>
              </section>
            </div>
          );
        })()}
      </Drawer>

      <OdEditDrawer od={editOd} onClose={() => setEditOd(null)} />

      <ConfirmDialog
        open={!!confirm}
        title="Delete OD record?"
        message={confirm ? `Delete ${confirm._name}'s OD at ${confirm.odLocation || "Not Specified"}?` : ""}
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
