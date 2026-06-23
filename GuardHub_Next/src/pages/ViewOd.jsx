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
import { useOds, useDeleteOd } from "../hooks/useOds";
import { useEmployees } from "../hooks/useEmployees";
import { formatDate } from "../utils/date";
import { exportFilteredCsv } from "../utils/exportCsv";

export default function ViewOd() {
  const { data: ods = [], isLoading } = useOds();
  const { data: employees = [] } = useEmployees();
  const del = useDeleteOd();
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
      key: "_actions", header: "", className: "num",
      render: (o) => (
        <button className="btn btn--ghost btn--icon" title="Delete" onClick={() => setConfirm(o)}>
          <Icon name="trash" size={16} />
        </button>
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
