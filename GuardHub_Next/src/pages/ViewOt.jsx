import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import SearchBar from "../components/ui/SearchBar";
import DataTable from "../components/ui/DataTable";
import Badge from "../components/ui/Badge";
import Icon from "../components/ui/Icon";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { Select } from "../components/ui/Field";
import EmployeeTableCell from "../components/EmployeeTableCell";
import { useOts, useDeleteOt, useUpdateOt } from "../hooks/useOts";
import { useEmployees } from "../hooks/useEmployees";
import { OT_STATUSES } from "../utils/constants";
import { formatDate } from "../utils/date";
import { exportFilteredCsv } from "../utils/exportCsv";

function statusTone(s) {
  const v = String(s).toLowerCase();
  if (v === "approved") return "status--present";
  if (v === "rejected") return "status--absent";
  return "status--ot";
}

export default function ViewOt() {
  const { data: ots = [], isLoading } = useOts();
  const { data: employees = [] } = useEmployees();
  const del = useDeleteOt();
  const update = useUpdateOt();
  const [term, setTerm] = useState("");
  const [confirm, setConfirm] = useState(null);

  // empId -> employee master record, only to resolve the photo (OT already
  // denormalises employeeName/designation).
  const empMap = useMemo(() => {
    const m = new Map();
    employees.forEach((e) => m.set(String(e.empId), e));
    return m;
  }, [employees]);

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return ots;
    return ots.filter((o) =>
      [o.employeeId, o.employeeName, o.location, o.reason, o.status]
        .map((v) => String(v ?? "").toLowerCase())
        .some((v) => v.includes(q))
    );
  }, [ots, term]);

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
      key: "status", header: "Status",
      render: (o) => (
        <Select
          className="select"
          style={{ width: 130, padding: "4px 8px" }}
          value={o.status}
          options={OT_STATUSES}
          onChange={(e) => update.mutate({ id: o._id, payload: { status: e.target.value } })}
        >
          <span />
        </Select>
      ),
    },
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
    employeeId: o.employeeId, employeeName: o.employeeName, currentShift: o.currentShift,
    additionalShift: o.additionalShift, workingDuration: o.workingDuration,
    from: formatDate(o.fromDate), to: formatDate(o.toDate), location: o.location,
    reason: o.reason, status: o.status,
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
                { key: "location", label: "Location" }, { key: "reason", label: "Reason" }, { key: "status", label: "Status" },
              ],
              rows: exportRows,
              isFiltered: !!term.trim(),
              noun: "OT records",
            })}>
              <Icon name="download" size={16} /> Export
            </Button>
            <Link className="btn btn--primary" to="/apply/ot"><Icon name="plus" size={16} /> Apply OT</Link>
          </>
        }
      />
      <div className="toolbar">
        <SearchBar value={term} onChange={setTerm} placeholder="Search by employee, location, status..." />
      </div>
      <DataTable columns={columns} rows={rows} loading={isLoading} pageSize={15} emptyTitle="No OT records found" emptyIcon="⏰" />
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
