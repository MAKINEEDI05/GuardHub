import { useMemo, useRef, useState } from "react";
import Drawer from "../ui/Drawer";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { useEmployees, useBulkUploadEmployees } from "../../hooks/useEmployees";
import { parseCsvFile, downloadCsv, downloadTemplate } from "../../utils/csv";
import { toast } from "../../store/toastStore";

// CSV template columns. Only empId + empName are required.
const TEMPLATE_HEADERS = [
  "empId",
  "empName",
  "empDesignation",
  "empDepartment",
  "empMobileNo",
  "empAadharNo",
  "empPanNo",
  "empDob",
  "empDoj",
  "bankAccountNo",
  "epfNo",
  "esiNo",
  "address",
  "emergencyContactName",
  "emergencyContactNumber",
  "emergencyContactRelation",
];

const CHUNK_SIZE = 50; // rows per request, for upload progress
const STATUS_CLASS = {
  Create: "status--present",
  Update: "status--ot",
  Duplicate: "status--leave",
  Invalid: "status--absent",
};

// Validate a row the same way the backend does (backend re-validates).
function validateRow(raw) {
  const empId = String(raw.empId ?? "").trim();
  const empName = String(raw.empName ?? "").trim();
  const errors = [];
  if (!empId) errors.push("Employee ID missing");
  else if (!/^[0-9]+$/.test(empId)) errors.push("Invalid Employee ID");
  if (!empName) errors.push("Employee Name missing");
  const mobile = raw.empMobileNo && String(raw.empMobileNo).trim();
  if (mobile && !/^[0-9]{10}$/.test(mobile)) errors.push("Invalid mobile number");
  const aadhar = raw.empAadharNo && String(raw.empAadharNo).trim();
  if (aadhar && !/^[0-9]{12}$/.test(aadhar)) errors.push("Invalid Aadhaar number");
  const pan = raw.empPanNo && String(raw.empPanNo).trim().toUpperCase();
  if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) errors.push("Invalid PAN");
  const bank = raw.bankAccountNo && String(raw.bankAccountNo).trim();
  if (bank && !/^[0-9]{9,18}$/.test(bank)) errors.push("Invalid bank account");
  return { empId, empName, errors };
}

export default function EmployeeBulkUploadDrawer({ open, onClose }) {
  const fileRef = useRef(null);
  const { data: employees = [] } = useEmployees();
  const bulk = useBulkUploadEmployees();

  const [rows, setRows] = useState([]); // [{ raw, empId, name, status, errors }]
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState(null);

  const existingIds = useMemo(
    () => new Set(employees.map((e) => String(e.empId))),
    [employees]
  );

  const counts = rows.reduce(
    (a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }),
    { Create: 0, Update: 0, Duplicate: 0, Invalid: 0 }
  );
  const uploadable = rows.filter(
    (r) => r.status === "Create" || r.status === "Update"
  );

  const reset = () => {
    setRows([]);
    setFileName("");
    setUploading(false);
    setProgress({ done: 0, total: 0 });
    setSummary(null);
  };
  const close = () => {
    reset();
    onClose?.();
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSummary(null);
    try {
      const { rows: parsed } = await parseCsvFile(file);
      const seen = new Set(); // first occurrence wins (matches backend)
      const classified = parsed.map((raw) => {
        const { empId, empName, errors } = validateRow(raw);
        let status;
        if (errors.length) status = "Invalid";
        else if (seen.has(empId)) status = "Duplicate";
        else {
          seen.add(empId);
          status = existingIds.has(empId) ? "Update" : "Create";
        }
        return { raw, empId, name: empName, status, errors };
      });
      setRows(classified);
      setFileName(file.name);
    } catch {
      toast.error("Could not read the CSV file.");
    }
  };

  const onUpload = async () => {
    const payload = uploadable.map((r) => r.raw);
    if (!payload.length) return;
    setUploading(true);
    setProgress({ done: 0, total: payload.length });
    const agg = { added: 0, updated: 0, failed: 0, failedRecords: [] };
    try {
      for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
        const chunk = payload.slice(i, i + CHUNK_SIZE);
        // eslint-disable-next-line no-await-in-loop
        const data = await bulk.mutateAsync(chunk);
        agg.added += data.added || 0;
        agg.updated += data.updated || 0;
        agg.failed += data.failed || 0;
        if (Array.isArray(data.failedRecords))
          agg.failedRecords.push(...data.failedRecords);
        setProgress({
          done: Math.min(i + chunk.length, payload.length),
          total: payload.length,
        });
      }
      const invalidRecords = rows
        .filter((r) => r.status === "Invalid")
        .map((r) => ({ empId: r.empId, reason: r.errors.join("; ") }));
      const duplicateRecords = rows
        .filter((r) => r.status === "Duplicate")
        .map((r) => ({ empId: r.empId, reason: "Duplicate Employee ID in CSV" }));
      setSummary({
        totalRows: rows.length,
        added: agg.added,
        updated: agg.updated,
        skipped: invalidRecords.length + duplicateRecords.length,
        failed: agg.failed,
        invalidRecords,
        duplicateRecords,
        failedRecords: agg.failedRecords,
      });
      toast.success(`Employees: ${agg.added} created, ${agg.updated} updated.`);
    } catch (e) {
      toast.error(e.friendlyMessage || "Bulk upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const downloadErrors = () => {
    if (!summary) return;
    const errRows = [
      ...summary.invalidRecords.map((r) => ({ ...r, status: "Skipped (invalid)" })),
      ...summary.duplicateRecords.map((r) => ({ ...r, status: "Skipped (duplicate)" })),
      ...summary.failedRecords.map((r) => ({ empId: r.empId, status: "Failed", reason: r.error })),
    ];
    if (!errRows.length) return;
    downloadCsv(
      "employee-upload-errors.csv",
      [
        { key: "empId", label: "empId" },
        { key: "status", label: "status" },
        { key: "reason", label: "reason" },
      ],
      errRows
    );
  };

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Drawer
      open={open}
      title="Bulk Upload Employees"
      onClose={close}
      width={680}
      footer={
        summary ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="outline" onClick={close} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={onUpload} loading={uploading} disabled={!uploadable.length}>
              {uploading
                ? `Uploading ${progress.done}/${progress.total}`
                : `Confirm Upload (${uploadable.length})`}
            </Button>
          </>
        )
      }
    >
      {!summary ? (
        <>
          <p className="muted text-sm">
            Matching is by <strong>Employee ID</strong>: existing employees are
            updated, new IDs are created — duplicates are never inserted. Only
            Employee ID &amp; Name are required.
          </p>

          <div className="row mt-4 mb-4">
            <Button
              variant="outline"
              onClick={() => downloadTemplate("employee-template.csv", TEMPLATE_HEADERS)}
            >
              <Icon name="download" size={16} /> Download Template
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Icon name="upload" size={16} /> Choose CSV
            </Button>
            <input ref={fileRef} type="file" accept=".csv" hidden onChange={onFile} />
          </div>

          {fileName && rows.length > 0 && (
            <>
              {counts.Duplicate > 0 && (
                <div
                  className="card mb-4"
                  style={{ borderColor: "var(--status-leave)", background: "rgba(208,108,56,0.06)" }}
                >
                  <div className="card__body text-sm">
                    <Icon name="alert" size={16} /> <strong>Duplicate Employee IDs found in CSV.</strong>{" "}
                    Only the first occurrence of each is imported — cancel to fix the file if needed.
                  </div>
                </div>
              )}

              <div className="row mb-4" style={{ gap: 6, flexWrap: "wrap" }}>
                <span className="badge status--present">Create {counts.Create}</span>
                <span className="badge status--ot">Update {counts.Update}</span>
                <span className="badge status--leave">Duplicate {counts.Duplicate}</span>
                <span className="badge status--absent">Invalid {counts.Invalid}</span>
                <span className="badge status--neutral">Total {rows.length}</span>
              </div>

              {uploading && (
                <div className="mb-4">
                  <div
                    style={{ height: 8, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}
                  >
                    <div
                      style={{ width: `${pct}%`, height: "100%", background: "var(--primary)", transition: "width .2s" }}
                    />
                  </div>
                  <small className="muted">Processing employees… {progress.done} / {progress.total}</small>
                </div>
              )}

              <div className="table-wrap" style={{ maxHeight: 320, overflowY: "auto" }}>
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Action</th>
                      <th>Employee ID</th>
                      <th>Employee Name</th>
                      <th>Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>
                          <span className={`badge ${STATUS_CLASS[r.status]}`}>{r.status}</span>
                        </td>
                        <td>{r.empId || "—"}</td>
                        <td>{r.name || "—"}</td>
                        <td style={{ whiteSpace: "normal", color: "var(--status-absent)", fontSize: 12 }}>
                          {r.errors.join("; ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {fileName && rows.length === 0 && (
            <p className="muted">No data rows found in the file.</p>
          )}
        </>
      ) : (
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">Upload Completed</h3>
          </div>
          <div className="card__body">
            <div className="summary-grid">
              <div className="summary-tile">
                <div className="summary-tile__value">{summary.totalRows}</div>
                <div className="summary-tile__label">Total Rows</div>
              </div>
              <div className="summary-tile">
                <div className="summary-tile__value" style={{ color: "var(--status-present)" }}>{summary.added}</div>
                <div className="summary-tile__label">New Added</div>
              </div>
              <div className="summary-tile">
                <div className="summary-tile__value" style={{ color: "var(--status-ot)" }}>{summary.updated}</div>
                <div className="summary-tile__label">Updated</div>
              </div>
              <div className="summary-tile">
                <div className="summary-tile__value" style={{ color: "var(--status-leave)" }}>{summary.skipped}</div>
                <div className="summary-tile__label">Skipped</div>
              </div>
              <div className="summary-tile">
                <div className="summary-tile__value" style={{ color: "var(--status-absent)" }}>{summary.failed}</div>
                <div className="summary-tile__label">Failed</div>
              </div>
            </div>
            {(summary.skipped > 0 || summary.failed > 0) && (
              <div className="mt-4">
                <Button variant="outline" size="sm" onClick={downloadErrors}>
                  <Icon name="download" size={16} /> Download error report (CSV)
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
