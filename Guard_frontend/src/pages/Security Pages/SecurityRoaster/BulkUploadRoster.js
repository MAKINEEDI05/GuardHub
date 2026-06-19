import React, { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import Papa from "papaparse";
import {
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Table,
  Spinner,
} from "reactstrap";
import { toast } from "react-toastify";

// CSV columns (order matches the downloadable template).
const TEMPLATE_COLUMNS = [
  "empId",
  "empName",
  "designation",
  "mobileNo",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "shiftFromDate",
  "shiftToDate",
];
const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

// Same canonical mapping as the backend (kept in sync) for an accurate preview.
const SHIFT_CANON = {
  general: "General",
  "1-general": "General",
  gen: "General",
  "a shift": "A Shift",
  "shift a": "A Shift",
  "a-shift": "A Shift",
  ashift: "A Shift",
  "b shift": "B Shift",
  "shift b": "B Shift",
  "b-shift": "B Shift",
  bshift: "B Shift",
  "c shift": "C Shift",
  "shift c": "C Shift",
  "c-shift": "C Shift",
  cshift: "C Shift",
  "week off": "WEEK OFF",
  weekoff: "WEEK OFF",
  "week-off": "WEEK OFF",
  wo: "WEEK OFF",
  off: "WEEK OFF",
};
const normShift = (v) => {
  const s = String(v == null ? "" : v).trim().toLowerCase();
  if (!s) return "";
  return SHIFT_CANON[s] || null;
};
const parseDate = (v) => {
  if (v === undefined || v === null || String(v).trim() === "") return { ok: true };
  const d = new Date(String(v).trim());
  return Number.isNaN(d.getTime()) ? { ok: false } : { ok: true, date: d };
};

const STATUS_BADGE = {
  New: "bg-success",
  Updated: "bg-primary",
  Invalid: "bg-danger",
};

const BulkUploadRoster = ({ apiUrl, existingEmpIds, onUploaded, disabled }) => {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]); // [{ raw, empId, status, errors }]
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [validEmpIds, setValidEmpIds] = useState([]);
  const fileRef = useRef(null);

  // Fetch the employee master list (securitydetails) when the modal opens so
  // the preview can flag "employee not found" — backend remains authoritative.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    axios
      .get(`${apiUrl}/emp/get-emp-details`)
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setValidEmpIds(list.map((e) => String(e.empId)));
      })
      .catch(() => {
        /* preview falls back to backend validation */
      });
    return () => {
      cancelled = true;
    };
  }, [open, apiUrl]);

  const rosterSet = new Set((existingEmpIds || []).map(String));
  const employeeSet = new Set((validEmpIds || []).map(String));

  const reset = useCallback(() => {
    setFileName("");
    setRows([]);
    setSummary(null);
    setParsing(false);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    reset();
  }, [reset]);

  const downloadCsv = (filename, csv) => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTemplate = () => {
    const sample = {
      empId: "1001",
      empName: "John Doe",
      designation: "Security Guard",
      mobileNo: "9999999999",
      monday: "General",
      tuesday: "A Shift",
      wednesday: "B Shift",
      thursday: "C Shift",
      friday: "General",
      saturday: "General",
      sunday: "Week Off",
      shiftFromDate: "2026-06-01",
      shiftToDate: "2026-06-30",
    };
    downloadCsv(
      "roster_bulk_template.csv",
      Papa.unparse({ fields: TEMPLATE_COLUMNS, data: [sample] })
    );
  };

  // Validate + classify a parsed row for the preview (backend re-validates).
  const classify = (raw, dupSet) => {
    const empId = String(raw.empId == null ? "" : raw.empId).trim();
    const errors = [];
    // empId is the matching key: in roster -> Updated, otherwise New (insert).
    const isNew = !rosterSet.has(empId);
    const hasName =
      !!(raw.empName && String(raw.empName).trim()) || employeeSet.has(empId);
    if (!empId) errors.push("empId is required");
    if (empId && dupSet.has(empId)) errors.push("duplicate empId in file");
    // A new roster record needs a name (from the CSV, since the employee is not
    // in securitydetails); updates keep their existing name.
    if (empId && isNew && !hasName)
      errors.push("empName is required for a new record");
    WEEKDAYS.forEach((d) => {
      if (normShift(raw[d]) === null) errors.push(`invalid shift "${raw[d]}" (${d})`);
    });
    const f = parseDate(raw.shiftFromDate);
    const t = parseDate(raw.shiftToDate);
    if (!f.ok) errors.push("invalid shiftFromDate");
    if (!t.ok) errors.push("invalid shiftToDate");
    if (f.ok && t.ok && f.date && t.date && f.date > t.date)
      errors.push("from > to");

    let status;
    if (errors.length) status = "Invalid";
    else status = isNew ? "New" : "Updated";
    return { raw, empId, status, errors };
  };

  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setParsing(true);
    setSummary(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const data = res.data || [];
        // Duplicate detection across the file.
        const counts = {};
        data.forEach((r) => {
          const id = String(r.empId == null ? "" : r.empId).trim();
          if (id) counts[id] = (counts[id] || 0) + 1;
        });
        const dupSet = new Set(Object.keys(counts).filter((k) => counts[k] > 1));
        setRows(data.map((r) => classify(r, dupSet)));
        setParsing(false);
      },
      error: (err) => {
        setParsing(false);
        toast.error(`Could not parse CSV: ${err.message}`);
      },
    });
  };

  const counts = rows.reduce(
    (a, r) => {
      a[r.status] = (a[r.status] || 0) + 1;
      return a;
    },
    { New: 0, Updated: 0, Invalid: 0 }
  );
  const uploadableCount = counts.New + counts.Updated;

  const confirmUpload = async () => {
    setUploading(true);
    try {
      const payload = {
        uploadedBy: localStorage.getItem("authUser") || "admin",
        rows: rows.map((r) => r.raw),
      };
      const res = await axios.post(`${apiUrl}/roster/bulk-upload`, payload, {
        headers: { "Content-Type": "application/json" },
      });
      setSummary(res.data);
      toast.success(
        `Upload complete — ${res.data.addedCount} added, ${res.data.updatedCount} updated`
      );
      if (typeof onUploaded === "function") onUploaded();
    } catch (err) {
      toast.error(
        `Bulk upload failed: ${err.response?.data?.message || err.message}`
      );
    } finally {
      setUploading(false);
    }
  };

  const downloadErrorCsv = () => {
    if (!summary) return;
    const records = [
      ...(summary.invalidRecords || []).map((r) => ({
        empId: r.empId,
        status: "Invalid",
        reason: (r.errors || []).join("; "),
      })),
      ...(summary.failedRecords || []).map((r) => ({
        empId: r.empId,
        status: "Failed",
        reason: r.error,
      })),
    ];
    if (!records.length) return;
    downloadCsv(
      "roster_upload_errors.csv",
      Papa.unparse({ fields: ["empId", "status", "reason"], data: records })
    );
  };

  return (
    <>
      <Button
        color="info"
        outline
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-label="Bulk upload roster"
      >
        <i className="mdi mdi-upload me-1" />
        Bulk Upload Roster
      </Button>

      <Modal isOpen={open} toggle={close} size="xl" scrollable>
        <ModalHeader toggle={close}>Bulk Upload Roster</ModalHeader>
        <ModalBody>
          {!summary ? (
            <>
              <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                <Button color="link" className="p-0" onClick={downloadTemplate}>
                  <i className="mdi mdi-download me-1" />
                  Download CSV template
                </Button>
                <div className="ms-auto d-flex align-items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="form-control form-control-sm"
                    style={{ maxWidth: 260 }}
                    onChange={handleFile}
                    aria-label="Choose roster CSV file"
                  />
                </div>
              </div>

              {parsing && (
                <div className="text-center py-4">
                  <Spinner size="sm" /> Parsing {fileName}…
                </div>
              )}

              {!parsing && rows.length > 0 && (
                <>
                  <div className="d-flex flex-wrap gap-2 mb-2">
                    <span className="badge bg-success">New: {counts.New}</span>
                    <span className="badge bg-primary">Updated: {counts.Updated}</span>
                    <span className="badge bg-danger">Invalid: {counts.Invalid}</span>
                    <span className="badge bg-secondary">Total: {rows.length}</span>
                  </div>
                  <div style={{ maxHeight: 360, overflow: "auto" }}>
                    <Table size="sm" bordered hover responsive className="mb-0">
                      <thead style={{ position: "sticky", top: 0, background: "var(--gh-card, #fff)" }}>
                        <tr>
                          <th>#</th>
                          <th>Status</th>
                          <th>Emp ID</th>
                          <th>Mon</th>
                          <th>Tue</th>
                          <th>Wed</th>
                          <th>Thu</th>
                          <th>Fri</th>
                          <th>Sat</th>
                          <th>Sun</th>
                          <th>Issues</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i}>
                            <td>{i + 1}</td>
                            <td>
                              <span className={`badge ${STATUS_BADGE[r.status]}`}>
                                {r.status}
                              </span>
                            </td>
                            <td>{r.empId || "—"}</td>
                            {WEEKDAYS.map((d) => (
                              <td key={d}>{r.raw[d] || "—"}</td>
                            ))}
                            <td className="text-danger" style={{ fontSize: ".75rem" }}>
                              {r.errors.join("; ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </>
              )}

              {!parsing && rows.length === 0 && fileName && (
                <p className="text-muted mb-0">No data rows found in the file.</p>
              )}
            </>
          ) : (
            // Summary view
            <div className="text-center py-2">
              <h5 className="mb-3">Upload Completed</h5>
              <div className="d-flex justify-content-center flex-wrap gap-3 mb-3">
                <div><div className="h4 mb-0">{summary.totalRows}</div><small className="text-muted">Total Rows</small></div>
                <div><div className="h4 mb-0 text-success">{summary.addedCount}</div><small className="text-muted">Added</small></div>
                <div><div className="h4 mb-0 text-primary">{summary.updatedCount}</div><small className="text-muted">Updated</small></div>
                <div><div className="h4 mb-0 text-danger">{summary.invalidCount}</div><small className="text-muted">Invalid</small></div>
                <div><div className="h4 mb-0 text-warning">{summary.failedCount}</div><small className="text-muted">Failed</small></div>
              </div>
              {(summary.invalidCount > 0 || summary.failedCount > 0) && (
                <Button color="outline-danger" size="sm" onClick={downloadErrorCsv}>
                  <i className="mdi mdi-download me-1" />
                  Download error report (CSV)
                </Button>
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          {!summary ? (
            <>
              <Button color="light" onClick={close} disabled={uploading}>
                Cancel
              </Button>
              <Button
                color="primary"
                onClick={confirmUpload}
                disabled={uploading || uploadableCount === 0}
              >
                {uploading ? (
                  <>
                    <Spinner size="sm" className="me-2" />
                    Uploading…
                  </>
                ) : (
                  `Confirm Upload (${uploadableCount})`
                )}
              </Button>
            </>
          ) : (
            <Button color="primary" onClick={close}>
              Done
            </Button>
          )}
        </ModalFooter>
      </Modal>
    </>
  );
};

BulkUploadRoster.propTypes = {
  apiUrl: PropTypes.string.isRequired,
  existingEmpIds: PropTypes.array, // roster empIds (for New vs Updated)
  onUploaded: PropTypes.func,
  disabled: PropTypes.bool,
};

export default BulkUploadRoster;
