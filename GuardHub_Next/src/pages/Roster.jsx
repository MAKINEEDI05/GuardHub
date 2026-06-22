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
import { useRostersPaged, useDeleteRoster } from "../hooks/useRoster";
import { useEmployees } from "../hooks/useEmployees";
import { rosterService } from "../services/rosterService";
import { toast } from "../store/toastStore";
import {
  WEEKDAYS,
  WEEKDAY_LABEL,
  ROSTER_SHIFTS,
  rosterShiftClass,
  shiftShort,
} from "../utils/constants";
import { formatDate } from "../utils/date";
import { downloadCsv } from "../utils/csv";

const PAGE_SIZES = [20, 50, 100];

// Security Roster — scannable weekly grid with server-side pagination so the
// page stays fast as the roster grows. Search/shift/department filtering and
// paging all happen on the backend; only one page of rows is fetched at a time.
export default function Roster() {
  // Filter + paging state.
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [shiftFilter, setShiftFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [drawer, setDrawer] = useState({ open: false, roster: null });
  const [viewing, setViewing] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Debounce the search box, and reset to page 1 whenever the query changes.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(term.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [term]);

  const params = useMemo(
    () => ({ page, limit: pageSize, search, shift: shiftFilter, department: deptFilter }),
    [page, pageSize, search, shiftFilter, deptFilter]
  );
  const { data, isLoading, isFetching } = useRostersPaged(params);
  const records = data?.records ?? [];
  const total = data?.totalRecords ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const del = useDeleteRoster();

  // Employee master (cached) for photos, designation/department fallback, and
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

  // Filter-change handlers reset to page 1.
  const onShift = (v) => { setShiftFilter(v); setPage(1); };
  const onDept = (v) => { setDeptFilter(v); setPage(1); };
  const onPageSize = (n) => { setPageSize(n); setPage(1); };
  const clearAll = () => { setTerm(""); setSearch(""); setShiftFilter(""); setDeptFilter(""); setPage(1); };

  // Export pulls the FULL roster (all pages) so the CSV is complete.
  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = await rosterService.list();
      const cols = [
        { key: "empId", label: "Employee ID" }, { key: "empName", label: "Name" },
        { key: "mobileNo", label: "Mobile No" }, { key: "department", label: "Department" },
        { key: "designation", label: "Designation" },
        ...WEEKDAYS.map((d) => ({ key: d, label: WEEKDAY_LABEL[d] })),
        { key: "from", label: "Shift From Date" }, { key: "to", label: "Shift To Date" },
      ];
      const rows = all.map((r) => ({
        ...r,
        ...WEEKDAYS.reduce((acc, d) => ({ ...acc, [d]: r.weeklyShifts?.[d] || "" }), {}),
        from: r.shiftFromDate ? formatDate(r.shiftFromDate) : "",
        to: r.shiftToDate ? formatDate(r.shiftToDate) : "",
      }));
      downloadCsv("roster.csv", cols, rows);
    } catch {
      toast.error("Could not export the roster.");
    } finally {
      setExporting(false);
    }
  };

  const hasFilters = term || shiftFilter || deptFilter;

  return (
    <>
      <PageHeader
        title="Security Roster"
        subtitle={`${total} rostered employee${total === 1 ? "" : "s"}`}
        actions={
          <>
            <Button variant="outline" loading={exporting} onClick={exportCsv}>
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
        <Select value={shiftFilter} onChange={(e) => onShift(e.target.value)} placeholder="All Shifts" options={ROSTER_SHIFTS} style={{ width: 160 }} />
        <Select value={deptFilter} onChange={(e) => onDept(e.target.value)} placeholder="All Departments" options={departments} style={{ width: 180 }} />
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll}>Clear</Button>
        )}
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <div className="table-wrap" style={{ opacity: !isLoading && isFetching ? 0.6 : 1, transition: "opacity .15s" }}>
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
                {records.map((r) => {
                  const emp = empMap.get(String(r.empId));
                  const designation = r.designation || emp?.empDesignation;
                  return (
                    <tr key={r._id || r.empId}>
                      <td>
                        <div className="emp-cell">
                          <EmployeePhotoHover
                            emp={{ empId: r.empId, empImage: emp?.empImage }}
                            px={60}
                            name={r.empName}
                            empId={r.empId}
                            designation={designation}
                            department={r.department || emp?.empDepartment}
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
                            {r.shiftFromDate ? formatDate(r.shiftFromDate) : "—"}
                            {" - "}
                            {r.shiftToDate ? formatDate(r.shiftToDate) : "—"}
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

        {!isLoading && records.length === 0 && (
          <EmptyState
            icon="🛡️"
            title="No roster entries"
            message={hasFilters ? "No records match your search/filters." : "Add an entry or bulk upload a roster CSV."}
          />
        )}

        {!isLoading && total > 0 && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={onPageSize}
            pageSizes={PAGE_SIZES}
            busy={isFetching}
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
