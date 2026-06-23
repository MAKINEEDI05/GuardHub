import { useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import SearchBar from "../components/ui/SearchBar";
import DataTable from "../components/ui/DataTable";
import EmployeePhotoHover from "../components/EmployeePhotoHover";
import Icon from "../components/ui/Icon";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import EmployeeFormDrawer from "../components/employees/EmployeeFormDrawer";
import EmployeeViewModal from "../components/employees/EmployeeViewModal";
import EmployeeBulkUploadDrawer from "../components/employees/EmployeeBulkUploadDrawer";
import { Select } from "../components/ui/Field";
import { useEmployees, useDeleteEmployee } from "../hooks/useEmployees";
import { exportFilteredCsv } from "../utils/exportCsv";
import { downloadTemplate, EMPLOYEE_TEMPLATE } from "../utils/templates";

// CSV columns for export + bulk-upload template. Mirrors the legacy app so
// existing spreadsheets keep working.
const CSV_COLUMNS = [
  { key: "empId", label: "empId" },
  { key: "empName", label: "empName" },
  { key: "empDesignation", label: "empDesignation" },
  { key: "empDepartment", label: "empDepartment" },
  { key: "empMobileNo", label: "empMobileNo" },
  { key: "empAadharNo", label: "empAadharNo" },
  { key: "empPanNo", label: "empPanNo" },
  { key: "empDob", label: "empDob" },
  { key: "empDoj", label: "empDoj" },
  { key: "bankAccountNo", label: "bankAccountNo" },
  { key: "epfNo", label: "epfNo" },
  { key: "esiNo", label: "esiNo" },
  { key: "address", label: "address" },
  { key: "emergencyContactName", label: "emergencyContactName" },
  { key: "emergencyContactNumber", label: "emergencyContactNumber" },
  { key: "emergencyContactRelation", label: "emergencyContactRelation" },
];

export default function Employees() {
  const { data: employees = [], isLoading } = useEmployees();
  const del = useDeleteEmployee();

  // Filter dropdown values are derived LIVE from the loaded employee list —
  // distinct, trimmed, case-insensitively de-duplicated and sorted. Done on the
  // client (the list is already fetched) so it works for existing data with no
  // extra API call/backend endpoint, and refreshes automatically after add/
  // edit/bulk upload (useEmployees is invalidated by those mutations).
  const { designations, departments } = useMemo(() => {
    const distinct = (vals) => {
      const byKey = new Map(); // lowercase key -> first-seen display form
      vals.forEach((v) => {
        const t = String(v ?? "").trim();
        if (!t) return;
        const k = t.toLowerCase();
        if (!byKey.has(k)) byKey.set(k, t);
      });
      return [...byKey.values()].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      );
    };
    return {
      designations: distinct(employees.map((e) => e.empDesignation)),
      departments: distinct(employees.map((e) => e.empDepartment)),
    };
  }, [employees]);

  const [term, setTerm] = useState("");
  const [desigFilter, setDesigFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [drawer, setDrawer] = useState({ open: false, employee: null });
  const [viewing, setViewing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    return employees.filter((e) => {
      if (q) {
        const hay = [e.empId, e.empName, e.empDesignation, e.empDepartment, e.empMobileNo]
          .map((v) => String(v ?? "").toLowerCase());
        if (!hay.some((v) => v.includes(q))) return false;
      }
      if (desigFilter && e.empDesignation !== desigFilter) return false;
      if (deptFilter && e.empDepartment !== deptFilter) return false;
      return true;
    });
  }, [employees, term, desigFilter, deptFilter]);

  const columns = [
    {
      key: "empName",
      header: "Employee",
      sortable: true,
      render: (e) => (
        <div className="emp-cell">
          <EmployeePhotoHover
            emp={e}
            px={64}
            name={e.empName}
            empId={e.empId}
            designation={e.empDesignation}
            department={e.empDepartment}
          />
          <div>
            <div className="emp-cell__name">{e.empName}</div>
            <div className="emp-cell__sub">ID {e.empId}</div>
          </div>
        </div>
      ),
    },
    { key: "empDesignation", header: "Designation", sortable: true, render: (e) => e.empDesignation || "—" },
    { key: "empDepartment", header: "Department", sortable: true, render: (e) => e.empDepartment || "—" },
    { key: "empMobileNo", header: "Mobile", render: (e) => e.empMobileNo || "—" },
    {
      key: "emergencyContactNumber",
      header: "Emergency",
      render: (e) =>
        e.emergencyContactNumber ? (
          <span title={`${e.emergencyContactName || ""} (${e.emergencyContactRelation || ""})`}>
            {e.emergencyContactNumber}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "_actions",
      header: "",
      className: "num",
      render: (e) => (
        <div className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
          <button className="btn btn--ghost btn--icon" title="View" onClick={() => setViewing(e)}>
            <Icon name="eye" size={16} />
          </button>
          <button className="btn btn--ghost btn--icon" title="Edit" onClick={() => setDrawer({ open: true, employee: e })}>
            <Icon name="edit" size={16} />
          </button>
          <button className="btn btn--ghost btn--icon" title="Delete" onClick={() => setConfirm(e)}>
            <Icon name="trash" size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Employee Management"
        subtitle={`${employees.length} employees`}
        actions={
          <>
            <Button variant="outline" onClick={() => downloadTemplate(EMPLOYEE_TEMPLATE)}>
              <Icon name="download" size={16} /> Template
            </Button>
            <Button
              variant="outline"
              disabled={!filtered.length}
              onClick={() =>
                exportFilteredCsv({
                  baseName: "employee-management",
                  columns: CSV_COLUMNS,
                  rows: filtered,
                  isFiltered: !!(term || desigFilter || deptFilter),
                  noun: "employees",
                })
              }
            >
              <Icon name="download" size={16} /> Export CSV
            </Button>
            <Button variant="outline" onClick={() => setBulkOpen(true)}>
              <Icon name="upload" size={16} /> Bulk Upload
            </Button>
            <Button onClick={() => setDrawer({ open: true, employee: null })}>
              <Icon name="plus" size={16} /> Add Employee
            </Button>
          </>
        }
      />

      <div className="toolbar">
        <SearchBar value={term} onChange={setTerm} placeholder="Search by name, ID, designation, mobile..." />
        <Select
          value={desigFilter}
          onChange={(e) => setDesigFilter(e.target.value)}
          placeholder="All Designations"
          options={designations}
          style={{ width: 200 }}
        />
        <Select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          placeholder="All Departments"
          options={departments}
          style={{ width: 180 }}
        />
        {(term || desigFilter || deptFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setTerm(""); setDesigFilter(""); setDeptFilter(""); }}>
            Clear
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        loading={isLoading}
        rowKey={(e) => e._id || e.empId}
        emptyTitle="No employees found"
        emptyMessage="Add your first employee or adjust your search."
        emptyIcon="👮"
      />

      {viewing && (
        <EmployeeViewModal employee={viewing} onClose={() => setViewing(null)} />
      )}

      <EmployeeFormDrawer
        open={drawer.open}
        employee={drawer.employee}
        onClose={() => setDrawer({ open: false, employee: null })}
      />

      <EmployeeBulkUploadDrawer open={bulkOpen} onClose={() => setBulkOpen(false)} />

      <ConfirmDialog
        open={!!confirm}
        title="Delete employee?"
        message={
          confirm
            ? `${confirm.empName} (ID ${confirm.empId}) will be removed from all active lists, roster and reports. Their past leave/OD/OT and attendance records are kept for audit.`
            : ""
        }
        confirmLabel="Delete"
        loading={del.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          await del.mutateAsync(confirm.empId);
          setConfirm(null);
        }}
      />
    </>
  );
}
