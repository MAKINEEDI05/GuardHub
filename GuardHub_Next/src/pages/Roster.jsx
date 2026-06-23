import { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import SearchBar from "../components/ui/SearchBar";
import EmployeePhotoHover from "../components/EmployeePhotoHover";
import Icon from "../components/ui/Icon";
import { Select } from "../components/ui/Field";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import Pagination from "../components/ui/Pagination";
import { EmptyState, TableSkeleton } from "../components/ui/States";
import RosterEditDrawer from "../components/roster/RosterEditDrawer";
import RosterViewModal from "../components/roster/RosterViewModal";
import BulkUploadDrawer from "../components/roster/BulkUploadDrawer";
import { useRosters, useDeleteRoster } from "../hooks/useRoster";
import { useEmployees } from "../hooks/useEmployees";
import {
  WEEKDAYS,
  WEEKDAY_LABEL,
  ROSTER_SHIFTS,
  rosterShiftClass,
  shiftShort,
} from "../utils/constants";
import { formatDateLocal } from "../utils/date";
import { exportFilteredCsv } from "../utils/exportCsv";

const PAGE_SIZES = [20, 50, 100];

// Security Roster — scannable weekly grid. The full roster (small dataset) is
// loaded once and filtered/paginated CLIENT-SIDE, so a single `filtered` array
// drives BOTH the table and Export. That guarantees "what you see is what you
// export" with no separate query.
export default function Roster() {
  const [term, setTerm] = useState("");
  const [shiftFilter, setShiftFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [drawer, setDrawer] = useState({ open: false, roster: null });
  const [viewing, setViewing] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const { data: rosters = [], isLoading } = useRosters();
  const del = useDeleteRoster();

  // Employee master (cached) for photos + designation/department fallback and
  // the department filter options.
  const { data: employees = [] } = useEmployees();
  const empMap = useMemo(() => {
    const m = new Map();
    employees.forEach((e) => m.set(String(e.empId), e));
    return m;
  }, [employees]);
  const departments = useMemo(
    () => [...new Set(employees.map((e) => e.empDepartment).filter(Boolean))].sort(),
    [employees]
  );

  // Each roster row enriched with resolved designation/department (roster value,
  // falling back to the employee master) — used for both display and filtering.
  const resolved = useMemo(
    () =>
      rosters.map((r) => {
        const emp = empMap.get(String(r.empId));
        return {
          ...r,
          _emp: emp,
          _designation: r.designation || emp?.empDesignation || "",
          _department: r.department || emp?.empDepartment || "",
        };
      }),
    [rosters, empMap]
  );

  const isFiltered = !!(term.trim() || shiftFilter || deptFilter);

  // THE single filtered dataset — used by the table AND Export.
  // - search: Employee Name / ID / Designation / Department (substring)
  // - shift:  any weekday equals the selected shift
  // - dept:   exact department match
  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    return resolved.filter((r) => {
      if (q) {
        const hay = [r.empId, r.empName, r._designation, r._department].map((v) =>
          String(v ?? "").toLowerCase()
        );
        if (!hay.some((v) => v.includes(q))) return false;
      }
      if (shiftFilter && !WEEKDAYS.some((d) => r.weeklyShifts?.[d] === shiftFilter)) {
        return false;
      }
      if (deptFilter && r._department !== deptFilter) return false;
      return true;
    });
  }, [resolved, term, shiftFilter, deptFilter]);

  // Reset to page 1 whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [term, shiftFilter, deptFilter]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const onPageSize = (n) => {
    setPageSize(n);
    setPage(1);
  };
  const clearAll = () => {
    setTerm("");
    setShiftFilter("");
    setDeptFilter("");
    setPage(1);
  };

  // Export the EXACT filtered dataset (all matching rows across pages). No
  // filters -> the complete roster. Reuses `filtered`; no separate query.
  const exportCsv = () => {
    const cols = [
      { key: "empId", label: "Employee ID" },
      { key: "empName", label: "Employee Name" },
      { key: "designation", label: "Designation" },
      { key: "department", label: "Department" },
      ...WEEKDAYS.map((d) => ({ key: d, label: `${WEEKDAY_LABEL[d]} Shift` })),
      { key: "from", label: "Effective From Date" },
      { key: "to", label: "Effective To Date" },
    ];
    const rows = filtered.map((r) => ({
      empId: r.empId,
      empName: r.empName,
      designation: r._designation,
      department: r._department,
      ...WEEKDAYS.reduce((acc, d) => ({ ...acc, [d]: r.weeklyShifts?.[d] || "" }), {}),
      from: r.shiftFromDate ? formatDateLocal(r.shiftFromDate) : "",
      to: r.shiftToDate ? formatDateLocal(r.shiftToDate) : "",
    }));
    exportFilteredCsv({
      baseName: "security-roster",
      columns: cols,
      rows,
      isFiltered,
      noun: "roster records",
    });
  };

  return (
    <>
      <PageHeader
        title="Security Roster"
        subtitle={`${total} rostered employee${total === 1 ? "" : "s"}`}
        actions={
          <>
            <Button variant="outline" disabled={!filtered.length} onClick={exportCsv}>
              <Icon name="download" size={16} /> Export
            </Button>
            <Button variant="outline" onClick={() => setBulkOpen(true)}>
              <Icon name="upload" size={16} /> Bulk Upload
            </Button>
            <Button onClick={() => setDrawer({ open: true, roster: null })}>
              <Icon name="plus" size={16} /> Add Roster
            </Button>
          </>
        }
      />

      <div className="toolbar">
        <SearchBar value={term} onChange={setTerm} placeholder="Search by name, ID, designation, department..." />
        <Select value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)} placeholder="All Shifts" options={ROSTER_SHIFTS} style={{ width: 160 }} />
        <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} placeholder="All Departments" options={departments} style={{ width: 180 }} />
        {isFiltered && (
          <Button variant="ghost" size="sm" onClick={clearAll}>Clear</Button>
        )}
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <div className="table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>Employee</th>
                {WEEKDAYS.map((d) => (
                  <th key={d} style={{ textAlign: "center" }}>{WEEKDAY_LABEL[d]}</th>
                ))}
                <th>Effective</th>
                <th className="num"></th>
              </tr>
            </thead>
            {isLoading ? (
              <TableSkeleton rows={pageSize > 10 ? 10 : pageSize} cols={WEEKDAYS.length + 3} />
            ) : (
              <tbody>
                {pageRows.map((r) => {
                  const designation = r._designation;
                  return (
                    <tr key={r._id || r.empId}>
                      <td>
                        <div className="emp-cell">
                          <EmployeePhotoHover
                            emp={{ empId: r.empId, empImage: r._emp?.empImage }}
                            px={60}
                            name={r.empName}
                            empId={r.empId}
                            designation={designation}
                            department={r._department}
                          />
                          <div>
                            <div className="emp-cell__name">{r.empName}</div>
                            <div className="emp-cell__sub">ID: {r.empId}</div>
                            <div className="emp-cell__sub">{designation || "—"}</div>
                          </div>
                        </div>
                      </td>
                      {WEEKDAYS.map((d) => {
                        const val = r.weeklyShifts?.[d] || "—";
                        return (
                          <td key={d} style={{ textAlign: "center" }}>
                            <span className={`badge shift ${rosterShiftClass(val)}`} title={val}>
                              {shiftShort(val)}
                            </span>
                          </td>
                        );
                      })}
                      <td className="text-sm muted nowrap">
                        {r.shiftFromDate || r.shiftToDate ? (
                          <>
                            <div className="detail-label" style={{ textTransform: "none" }}>Effective:</div>
                            {r.shiftFromDate ? formatDateLocal(r.shiftFromDate) : "—"}
                            {" - "}
                            {r.shiftToDate ? formatDateLocal(r.shiftToDate) : "—"}
                          </>
                        ) : (
                          "Permanent Schedule"
                        )}
                      </td>
                      <td className="num">
                        <div className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                          <button className="btn btn--ghost btn--icon" title="View" onClick={() => setViewing(r)}>
                            <Icon name="eye" size={16} />
                          </button>
                          <button className="btn btn--ghost btn--icon" title="Edit" onClick={() => setDrawer({ open: true, roster: r })}>
                            <Icon name="edit" size={16} />
                          </button>
                          <button className="btn btn--ghost btn--icon" title="Delete" onClick={() => setConfirm(r)}>
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </div>

        {!isLoading && total === 0 && (
          <EmptyState
            icon="🛡️"
            title="No roster entries"
            message={isFiltered ? "No records match your search/filters." : "Add an entry or bulk upload a roster CSV."}
          />
        )}

        {!isLoading && total > 0 && (
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={onPageSize}
            pageSizes={PAGE_SIZES}
          />
        )}
      </div>

      {viewing && (
        <RosterViewModal
          roster={viewing}
          emp={empMap.get(String(viewing.empId))}
          onClose={() => setViewing(null)}
        />
      )}

      <RosterEditDrawer
        open={drawer.open}
        roster={drawer.roster}
        onClose={() => setDrawer({ open: false, roster: null })}
      />
      <BulkUploadDrawer open={bulkOpen} onClose={() => setBulkOpen(false)} />
      <ConfirmDialog
        open={!!confirm}
        title="Delete roster entry?"
        message={confirm ? `Remove ${confirm.empName} (ID ${confirm.empId}) from the roster?` : ""}
        confirmLabel="Delete"
        loading={del.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => { await del.mutateAsync(confirm.empId); setConfirm(null); }}
      />
    </>
  );
}
