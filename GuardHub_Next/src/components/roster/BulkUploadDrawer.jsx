import { useEffect, useMemo, useRef, useState } from "react";
import Drawer from "../ui/Drawer";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { EmptyState } from "../ui/States";
import { useBulkUploadRoster, useRosters } from "../../hooks/useRoster";
import { useEmployees } from "../../hooks/useEmployees";
import { useAuthStore } from "../../store/authStore";
import { downloadCsv } from "../../utils/csv";
import { downloadTemplate, ROSTER_TEMPLATE } from "../../utils/templates";
import {
  parseSpreadsheetFile,
  missingRequiredColumns,
  ACCEPTED_EXTENSIONS,
  MAX_UPLOAD_BYTES,
} from "../../utils/spreadsheet";
import {
  analyzeRosterRows,
  ACTION_BADGE,
  formatFileSize,
} from "../../utils/rosterImport";
import { WEEKDAYS, WEEKDAY_LABEL } from "../../utils/constants";
import { toast } from "../../store/toastStore";

// Friendly roster import for non-technical staff. The setup screen is laid out
// as four plain sections — Instructions, Template, File Selection, Validation —
// so a first-time user sees what to upload, what's required, what's wrong, and
// exactly what will be created/updated before clicking Upload. The backend
// re-validates and is the authority. The downloadable template (with a sample
// row + Instructions sheet) lives in utils/templates.js.

// A couple of filled-in rows so users can see what "good" data looks like
// without downloading anything.
const SAMPLE_ROWS = [
  { empId: "1001", empName: "Ramesh Kumar", monday: "GEN", tuesday: "GEN", wednesday: "A", thursday: "A", friday: "B", saturday: "OFF", sunday: "OFF" },
  { empId: "1002", empName: "Suresh Rao", monday: "A", tuesday: "A", wednesday: "OFF", thursday: "B", friday: "B", saturday: "GEN", sunday: "GEN" },
];

function normalizeRow(row) {
  const out = { ...row };
  if (out.fromDate != null && out.shiftFromDate == null) out.shiftFromDate = out.fromDate;
  if (out.toDate != null && out.shiftToDate == null) out.shiftToDate = out.toDate;
  return out;
}

function phaseFor(progress) {
  if (progress >= 100) return "Completed";
  if (progress < 30) return "Validating...";
  if (progress < 70) return "Uploading...";
  return "Saving...";
}

export default function BulkUploadDrawer({ open, onClose }) {
  const fileRef = useRef(null);
  const timerRef = useRef(null);

  const [stage, setStage] = useState("setup"); // setup | upload | done
  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [result, setResult] = useState(null);
  const [uploadTime, setUploadTime] = useState("");
  const [progress, setProgress] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [showSample, setShowSample] = useState(false);

  const bulk = useBulkUploadRoster();
  const user = useAuthStore((s) => s.user);
  const { data: employees = [], isLoading: empLoading } = useEmployees();
  const { data: rosters = [] } = useRosters();

  const empMap = useMemo(
    () => new Map(employees.map((e) => [String(e.empId), e])),
    [employees]
  );
  const rosterMap = useMemo(
    () => new Map(rosters.map((r) => [String(r.empId), r])),
    [rosters]
  );

  const { analyzed, counts, warnings } = useMemo(
    () => analyzeRosterRows(parsedRows, empMap, rosterMap),
    [parsedRows, empMap, rosterMap]
  );
  const missingCols = useMemo(
    () => (parsedRows.length ? missingRequiredColumns(parsedRows) : []),
    [parsedRows]
  );

  useEffect(() => () => clearInterval(timerRef.current), []);

  const reset = () => {
    clearInterval(timerRef.current);
    setStage("setup");
    setFile(null);
    setParsedRows([]);
    setResult(null);
    setUploadTime("");
    setProgress(0);
    setProcessed(0);
    setDetailsOpen(true);
    setShowSample(false);
  };
  const close = () => {
    reset();
    onClose();
  };

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const name = f.name.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      toast.error("Please choose a .csv or .xlsx file.");
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      toast.error("That file is larger than 10 MB.");
      return;
    }
    setResult(null);
    try {
      const { rows } = await parseSpreadsheetFile(f);
      const cleaned = rows.filter((r) =>
        Object.values(r).some((v) => String(v ?? "").trim() !== "")
      );
      if (!cleaned.length) {
        toast.error("That file has no data rows.");
        return;
      }
      setFile(f);
      setParsedRows(cleaned);
    } catch {
      toast.error("Could not read the file.");
    }
  };

  const onUpload = async () => {
    if (!parsedRows.length || !counts.valid) return;
    setStage("upload");
    setProgress(0);
    setProcessed(0);

    const total = parsedRows.length;
    timerRef.current = setInterval(() => {
      setProgress((p) => (p >= 92 ? p : p + Math.max(1, Math.round((92 - p) / 8))));
      setProcessed((n) => (n >= total ? total : Math.min(total, n + Math.ceil(total / 12))));
    }, 180);

    try {
      const data = await bulk.mutateAsync({
        rows: parsedRows.map(normalizeRow),
        uploadedBy: user?.userName || "admin",
      });
      clearInterval(timerRef.current);
      setProgress(100);
      setProcessed(total);
      setResult(data);
      setUploadTime(new Date().toLocaleString());
      setStage("done");
      const ok = (data.created || 0) + (data.updated || 0);
      if (ok && !data.failed && !data.skipped) {
        toast.success(`Roster upload complete — ${ok} records saved.`);
      } else {
        toast.success(`Roster upload finished — ${data.successRate ?? 0}% success.`);
      }
    } catch {
      clearInterval(timerRef.current);
      setStage("setup");
      setProgress(0);
      setProcessed(0);
    }
  };

  const downloadErrorReport = () => {
    const errs = result?.errors || [];
    if (!errs.length) return;
    const rows = errs.map((e) => {
      const raw = parsedRows[(e.row || 0) - 1] || {};
      const originalData = Object.entries(raw)
        .map(([k, v]) => `${k}=${String(v ?? "").trim()}`)
        .filter((s) => !s.endsWith("="))
        .join(" | ");
      return {
        rowNumber: e.row,
        empId: e.empId,
        empName: e.empName,
        originalData,
        reason: e.reason,
        suggestedFix: e.suggestedFix,
      };
    });
    downloadCsv(
      `roster-upload-errors-${Date.now()}.csv`,
      [
        { key: "rowNumber", label: "Row Number" },
        { key: "empId", label: "Employee ID" },
        { key: "empName", label: "Employee Name" },
        { key: "originalData", label: "Original Data" },
        { key: "reason", label: "Error Reason" },
        { key: "suggestedFix", label: "Suggested Fix" },
      ],
      rows
    );
  };

  const footer = (() => {
    if (stage === "setup") {
      return (
        <>
          <Button variant="outline" onClick={close}>Close</Button>
          <Button onClick={onUpload} disabled={!file || !counts.valid}>
            Upload Valid Records
          </Button>
        </>
      );
    }
    if (stage === "done") {
      return (
        <>
          <Button variant="outline" onClick={reset}>Upload another</Button>
          <Button onClick={close}>Done</Button>
        </>
      );
    }
    return <Button variant="outline" onClick={close} disabled>Close</Button>;
  })();

  return (
    <Drawer
      open={open}
      title="Bulk Upload Roster"
      onClose={close}
      width="min(860px, 100%)"
      footer={footer}
    >
      {stage === "setup" && (
        <SetupStage
          file={file}
          empLoading={empLoading}
          counts={counts}
          warnings={warnings}
          missingCols={missingCols}
          analyzed={analyzed}
          showSample={showSample}
          onToggleSample={() => setShowSample((v) => !v)}
          onChoose={() => fileRef.current?.click()}
          onTemplate={() => downloadTemplate(ROSTER_TEMPLATE)}
        />
      )}

      {stage === "upload" && (
        <UploadStage progress={progress} processed={processed} total={parsedRows.length} />
      )}

      {stage === "done" && result && (
        <ResultStage
          result={result}
          file={file}
          uploadTime={uploadTime}
          detailsOpen={detailsOpen}
          onToggleDetails={() => setDetailsOpen((v) => !v)}
          onDownloadReport={downloadErrorReport}
        />
      )}

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(",")}
        hidden
        onChange={onFile}
      />
    </Drawer>
  );
}

/* ------------------------------ setup ---------------------------------- */

function Section({ step, title, children }) {
  return (
    <section className="mb-4">
      <div className="row" style={{ gap: 8, marginBottom: 10, alignItems: "center" }}>
        <span className="step-badge">{step}</span>
        <h4 className="card__title" style={{ margin: 0 }}>{title}</h4>
      </div>
      {children}
    </section>
  );
}

function SampleTable({ rows }) {
  return (
    <div className="table-wrap mt-4">
      <table className="table table--compact">
        <thead>
          <tr>
            <th>Employee ID</th>
            <th>Employee Name</th>
            {WEEKDAYS.map((d) => <th key={d}>{WEEKDAY_LABEL[d]}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.empId}>
              <td>{r.empId}</td>
              <td>{r.empName}</td>
              {WEEKDAYS.map((d) => <td key={d}>{r[d]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatTile({ value, label, color }) {
  return (
    <div className="summary-tile">
      <div className="summary-tile__value" style={color ? { color } : undefined}>{value}</div>
      <div className="summary-tile__label">{label}</div>
    </div>
  );
}

function WarnCard({ tone = "warn", children }) {
  return (
    <div className={`banner banner--${tone} mb-4`}>
      <Icon name="alert" size={16} />
      <span>{children}</span>
    </div>
  );
}

function SetupStage({
  file, empLoading, counts, warnings, missingCols, analyzed,
  showSample, onToggleSample, onChoose, onTemplate,
}) {
  const hasFile = !!file;
  const preview = analyzed.slice(0, 10);

  return (
    <div>
      {/* 1 — Instructions */}
      <Section step="1" title="How it works">
        <div className="card">
          <div className="card__body text-sm">
            <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
              <li>Download the template and fill in each guard's weekly shifts.</li>
              <li>Use shift codes <strong>GEN</strong>, <strong>A</strong>, <strong>B</strong>, <strong>C</strong> or <strong>OFF</strong>.</li>
              <li>Save as CSV or Excel, then choose the file below.</li>
              <li>We check everything and show you what will change — nothing is saved until you click Upload.</li>
            </ol>
          </div>
        </div>
      </Section>

      {/* 2 — Template */}
      <Section step="2" title="Template File">
        <div className="card">
          <div className="card__body">
            <p className="muted text-sm" style={{ marginTop: 0 }}>
              Use this template to prepare roster data. Employee ID must already
              exist in Employee Management.
            </p>
            <div className="row" style={{ flexWrap: "wrap" }}>
              <Button variant="outline" onClick={onTemplate}>
                <Icon name="download" size={16} /> Download Template
              </Button>
              <Button variant="ghost" onClick={onToggleSample}>
                <Icon name="eye" size={16} /> {showSample ? "Hide" : "View"} Sample Data
              </Button>
            </div>
            {showSample && <SampleTable rows={SAMPLE_ROWS} />}
          </div>
        </div>
      </Section>

      {/* 3 — File Selection */}
      <Section step="3" title="Choose File">
        <div className="card">
          <div className="card__body">
            <div className="row row--between" style={{ flexWrap: "wrap", gap: 12 }}>
              <div className="text-sm muted">
                Supported: <strong>.csv, .xlsx</strong> · Maximum size: <strong>10 MB</strong>
              </div>
              <Button variant="outline" onClick={onChoose}>
                <Icon name="upload" size={16} /> {hasFile ? "Choose Different File" : "Choose File"}
              </Button>
            </div>
            {hasFile && (
              <div className="filemeta mt-4">
                <span>✓ <strong>{file.name}</strong></span>
                <span>✓ {formatFileSize(file.size)}</span>
                <span>✓ {counts.total} rows detected</span>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* 4 — Validation Summary */}
      <Section step="4" title="Validation Summary">
        {!hasFile ? (
          <div className="card">
            <EmptyState
              icon="🗓️"
              title="Upload a roster file to update employee schedules"
              message="Download the template to get started, then choose your file above."
            />
          </div>
        ) : empLoading ? (
          <div className="card"><div className="card__body muted text-sm">Loading employee list to validate against…</div></div>
        ) : (
          <>
            <div className="summary-grid mb-4">
              <StatTile value={counts.total} label="Total Rows" />
              <StatTile value={counts.valid} label="Valid Rows" color="var(--status-present)" />
              <StatTile value={counts.update} label="Potential Updates" color="var(--status-ot)" />
              <StatTile value={counts.create} label="Potential Creates" color="var(--status-present)" />
              <StatTile value={counts.invalid} label="Invalid Rows" color="var(--status-absent)" />
            </div>

            {/* Warning cards */}
            {missingCols.length > 0 && (
              <WarnCard tone="error">
                Missing columns: <strong>{missingCols.join(", ")}</strong>. Download the template and try again.
              </WarnCard>
            )}
            {warnings.missingEmployees > 0 && (
              <WarnCard>
                {warnings.missingEmployees} Employee {warnings.missingEmployees === 1 ? "ID does" : "IDs do"} not exist in Employee Management.
              </WarnCard>
            )}
            {warnings.invalidShifts > 0 && (
              <WarnCard>
                {warnings.invalidShifts} {warnings.invalidShifts === 1 ? "row has" : "rows have"} an invalid shift value. Use A / B / C / GEN / OFF.
              </WarnCard>
            )}
            {warnings.duplicates > 0 && (
              <WarnCard>
                {warnings.duplicates} duplicate Employee {warnings.duplicates === 1 ? "ID" : "IDs"} in the file — only the first of each is uploaded.
              </WarnCard>
            )}

            <div className="row row--between mb-4" style={{ flexWrap: "wrap", gap: 8 }}>
              <h4 className="card__title" style={{ margin: 0 }}>Preview (first {preview.length} of {counts.total})</h4>
              <span className="badge status--present">{counts.valid} rows ready for upload</span>
            </div>
            <div className="table-wrap" style={{ overflowX: "auto" }}>
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th>Emp ID</th>
                    <th>Name</th>
                    {WEEKDAYS.map((d) => <th key={d} className="num">{WEEKDAY_LABEL[d]}</th>)}
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r) => {
                    const badge = ACTION_BADGE[r.action];
                    return (
                      <tr key={r.rowNo} title={r.reason || undefined}>
                        <td>{r.empId || "—"}</td>
                        <td className="nowrap">{r.empName || "—"}</td>
                        {r.dayCodes.map((c, i) => (
                          <td key={i} className="num" style={c === "!" ? { color: "var(--status-absent)" } : undefined}>
                            {c === "!" ? "✗" : c}
                          </td>
                        ))}
                        <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {counts.total > preview.length && (
              <p className="muted text-sm mt-4">
                Showing first {preview.length} rows. All {counts.total} are validated; the full breakdown appears after upload.
              </p>
            )}
          </>
        )}
      </Section>
    </div>
  );
}

/* ------------------------------ upload --------------------------------- */

function UploadStage({ progress, processed, total }) {
  return (
    <div style={{ padding: "24px 4px" }}>
      <div className="row row--between mb-4">
        <strong>{phaseFor(progress)}</strong>
        <span className="muted text-sm">{progress}%</span>
      </div>
      <div className="progress">
        <div className="progress__bar" style={{ width: `${progress}%` }} />
      </div>
      <p className="muted text-sm mt-4">Processed {processed} of {total} rows</p>
    </div>
  );
}

/* ------------------------------- done ---------------------------------- */

function ResultStage({ result, file, uploadTime, detailsOpen, onToggleDetails, onDownloadReport }) {
  const { totalRows = 0, created = 0, updated = 0, skipped = 0, failed = 0, successRate = 0 } = result;
  const errors = result.errors || [];
  const clean = !failed && !skipped;

  return (
    <div>
      <div className={`banner ${failed ? "banner--warn" : "banner--ok"} mb-4`} style={{ display: "block" }}>
        <div className="row" style={{ gap: 8, marginBottom: 8 }}>
          <Icon name={clean ? "leave" : "alert"} size={18} />
          <strong>Roster Upload {clean ? "Completed" : "Finished"}</strong>
        </div>
        <div className="text-sm">
          <div>✓ {updated} {updated === 1 ? "record" : "records"} updated</div>
          <div>✓ {created} new {created === 1 ? "record" : "records"} created</div>
          {skipped > 0 && <div>⚠ {skipped} duplicate {skipped === 1 ? "row" : "rows"} skipped</div>}
          {failed > 0 && <div>✗ {failed} {failed === 1 ? "record" : "records"} failed — error report available</div>}
        </div>
      </div>

      <div className="card mb-4">
        <div className="card__body text-sm" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
          <div><span className="muted">File</span><br /><strong>{file?.name || "—"}</strong></div>
          <div><span className="muted">Size</span><br />{formatFileSize(file?.size)}</div>
          <div><span className="muted">Uploaded</span><br />{uploadTime}</div>
          <div><span className="muted">Rows</span><br />{totalRows}</div>
        </div>
      </div>

      <div className="summary-grid mb-4">
        <StatTile value={totalRows} label="Total Rows" />
        <StatTile value={created} label="Created" color="var(--status-present)" />
        <StatTile value={updated} label="Updated" color="var(--status-ot)" />
        <StatTile value={skipped} label="Skipped" color="var(--status-leave)" />
        <StatTile value={failed} label="Failed" color="var(--status-absent)" />
        <StatTile value={`${successRate}%`} label="Success Rate" />
      </div>

      {errors.length > 0 && (
        <div className="card">
          <button
            className="card__header row row--between"
            style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer" }}
            onClick={onToggleDetails}
          >
            <h3 className="card__title">Failed &amp; skipped records ({errors.length})</h3>
            <Icon name={detailsOpen ? "chevron-left" : "chevron-right"} size={16} />
          </button>
          {detailsOpen && (
            <div className="card__body">
              <div className="row row--between mb-4" style={{ flexWrap: "wrap", gap: 8 }}>
                <span className="muted text-sm">Fix the rows below and re-upload, or export the report.</span>
                <Button variant="outline" size="sm" onClick={onDownloadReport}>
                  <Icon name="download" size={16} /> Download Error Report
                </Button>
              </div>
              <div className="table-wrap" style={{ maxHeight: 280, overflowY: "auto" }}>
                <table className="table table--compact">
                  <thead>
                    <tr><th style={{ width: 56 }}>Row</th><th>Emp ID</th><th>Name</th><th>Reason</th><th>Suggested Fix</th></tr>
                  </thead>
                  <tbody>
                    {errors.map((e, i) => (
                      <tr key={i}>
                        <td className="muted">{e.row}</td>
                        <td>{e.empId || "—"}</td>
                        <td>{e.empName || "—"}</td>
                        <td style={{ whiteSpace: "normal", color: "var(--status-absent)" }}>{e.reason}</td>
                        <td style={{ whiteSpace: "normal" }}>{e.suggestedFix}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
