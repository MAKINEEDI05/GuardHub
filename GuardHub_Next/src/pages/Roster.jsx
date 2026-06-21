import { useMemo, useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import SearchBar from "../components/ui/SearchBar";
import EmployeePhotoHover from "../components/EmployeePhotoHover";
import Icon from "../components/ui/Icon";
import { Select } from "../components/ui/Field";
import ConfirmDialog from "../components/ui/ConfirmDialog";
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
import { formatDate } from "../utils/date";
import { downloadCsv } from "../utils/csv";

// Security Roster — the operational core. A scannable weekly grid: one row per
// employee (photo + name + ID + designation), one column per weekday with
// soft-colored shift badges. View / Edit / Add via modal & drawers; bulk
// add/update via CSV upsert.
export default function Roster() {
  const { data: rosters = [], isLoading } = useRosters();
  // Employee master is reused (cached) purely to resolve photos + fallbacks.
  const { data: employees = [] } = useEmployees();
  const del = useDeleteRoster();

  const [term, setTerm] = useState("");
  const [shiftFilter, setShiftFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [drawer, setDrawer] = useState({ open: false, roster: null });
  const [viewing, setViewing] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);

  // empId -> employee master record (for photo + designation/department fallback).
  const empMap = useMemo(() => {
    const m = new Map();
    employees.forEach((e) => m.set(String(e.empId), e));
    return m;
  }, [employees]);

  // Distinct departments for the filter (roster value, falling back to master).
  const departments = useMemo(() => {
    const set = new Set();
    rosters.forEach((r) => {
      const d = r.department || empMap.get(String(r.empId))?.empDepartment;
      if (d) set.add(d);
    });
    return [...set].sort();
  }, [rosters, empMap]);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    return rosters.filter((r) => {
      const emp = empMap.get(String(r.empId));
      const designation = r.designation || emp?.empDesignation || "";
      const department = r.department || emp?.empDepartment || "";

      if (q) {
        const hay = [r.empId, r.empName, designation, department]
          .map((v) => String(v ?? "").toLowerCase());
        if (!hay.some((v) => v.includes(q))) return false;
      }
      if (deptFilter && department !== deptFilter) return false;
      if (shiftFilter) {
        const days = WEEKDAYS.map((d) => r.weeklyShifts?.[d]);
        if (!days.some((s) => String(s || "") === shiftFilter)) return false;
      }
      return true;
    });
  }, [rosters, term, shiftFilter, deptFilter, empMap]);

  const exportCsv = () => {
    const cols = [
      { key: "empId", label: "Employee ID" }, { key: "empName", label: "Name" },
      { key: "mobileNo", label: "Mobile No" }, { key: "department", label: "Department" },
      { key: "designation", label: "Designation" },
      ...WEEKDAYS.map((d) => ({ key: d, label: WEEKDAY_LABEL[d] })),
      { key: "from", label: "Shift From Date" }, { key: "to", label: "Shift To Date" },
    ];
    const rows = rosters.map((r) => ({
      ...r,
      ...WEEKDAYS.reduce((acc, d) => ({ ...acc, [d]: r.weeklyShifts?.[d] || "" }), {}),
      from: r.shiftFromDate ? formatDate(r.shiftFromDate) : "",
      to: r.shiftToDate ? formatDate(r.shiftToDate) : "",
    }));
    downloadCsv("roster.csv", cols, rows);
  };

  return (
    <>
      <PageHeader
        title="Security Roster"
        subtitle={`${rosters.length} rostered employees`}
        actions={
          <>
            <Button variant="outline" disabled={!rosters.length} onClick={exportCsv}>
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
        <Select
          value={shiftFilter}
          onChange={(e) => setShiftFilter(e.target.value)}
          placeholder="All Shifts"
          options={ROSTER_SHIFTS}
          style={{ width: 160 }}
        />
        <Select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          placeholder="All Departments"
          options={departments}
          style={{ width: 180 }}
        />
        {(shiftFilter || deptFilter || term) && (
          <Button variant="ghost" size="sm" onClick={() => { setTerm(""); setShiftFilter(""); setDeptFilter(""); }}>
            Clear
          </Button>
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
              <TableSkeleton rows={8} cols={WEEKDAYS.length + 3} />
            ) : (
              <tbody>
                {filtered.map((r) => {
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
        {!isLoading && filtered.length === 0 && (
          <EmptyState icon="🛡️" title="No roster entries" message="Add an entry, adjust filters, or bulk upload a roster CSV." />
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
