import { useRef, useState } from "react";
import Drawer from "../ui/Drawer";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { useBulkUploadRoster } from "../../hooks/useRoster";
import { useAuthStore } from "../../store/authStore";
import { parseCsvFile, downloadTemplate } from "../../utils/csv";
import { toast } from "../../store/toastStore";

// Bulk add/update roster from CSV. The backend upserts on empId (exists →
// update, else create) and returns an added/updated/invalid/failed summary,
// which we surface so the user sees exactly what happened.
//
// Simple template: empId + the 7 weekday columns + date range. We accept
// fromDate/toDate (friendly names) and map them to the shiftFromDate/
// shiftToDate fields the backend actually reads. empName/department/etc. are
// optional and auto-enriched server-side from the employee master.
const TEMPLATE_HEADERS = [
  "empId",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "fromDate", "toDate",
];

// Normalise a parsed CSV row so the backend gets the field names it expects.
function normalizeRow(row) {
  const out = { ...row };
  if (out.fromDate != null && out.shiftFromDate == null) out.shiftFromDate = out.fromDate;
  if (out.toDate != null && out.shiftToDate == null) out.shiftToDate = out.toDate;
  return out;
}

export default function BulkUploadDrawer({ open, onClose }) {
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState(null);
  const bulk = useBulkUploadRoster();
  const user = useAuthStore((s) => s.user);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setResult(null);
    try {
      const { rows: parsed } = await parseCsvFile(file);
      setRows(parsed.filter((r) => String(r.empId || "").trim()));
      setFileName(file.name);
    } catch {
      toast.error("Could not read the CSV file.");
    }
  };

  const onUpload = async () => {
    if (!rows.length) return;
    const data = await bulk.mutateAsync({
      rows: rows.map(normalizeRow),
      uploadedBy: user?.userName || "admin",
    });
    setResult(data);
    const ok = (data.addedCount || 0) + (data.updatedCount || 0);
    toast.success(`Roster: ${data.addedCount || 0} created, ${data.updatedCount || 0} updated.`);
    if (!data.invalidCount && !data.failedCount && ok) {
      // clean upload — clear staged rows
      setRows([]);
      setFileName("");
    }
  };

  const close = () => {
    setRows([]); setFileName(""); setResult(null); onClose();
  };

  return (
    <Drawer
      open={open}
      title="Bulk Upload Roster"
      onClose={close}
      footer={
        <>
          <Button variant="outline" onClick={close}>Close</Button>
          <Button onClick={onUpload} loading={bulk.isPending} disabled={!rows.length}>
            Upload {rows.length ? `${rows.length} rows` : ""}
          </Button>
        </>
      }
    >
      <p className="muted text-sm">
        Upload a CSV to add or update roster entries. Matching is by <strong>empId</strong>:
        existing entries are updated, new ones are created. Shift synonyms
        (e.g. "shift a", "week off") are normalised automatically.
      </p>

      <div className="row mt-4 mb-4">
        <Button variant="outline" onClick={() => downloadTemplate("roster-template.csv", TEMPLATE_HEADERS)}>
          <Icon name="download" size={16} /> Download Template
        </Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={16} /> Choose CSV
        </Button>
        <input ref={fileRef} type="file" accept=".csv" hidden onChange={onFile} />
      </div>

      {fileName && (
        <div className="card mb-4">
          <div className="card__body row row--between">
            <span><strong>{fileName}</strong></span>
            <span className="badge status--neutral">{rows.length} rows</span>
          </div>
        </div>
      )}

      {result && (
        <div className="card">
          <div className="card__header"><h3 className="card__title">Upload Result</h3></div>
          <div className="card__body">
            <div className="summary-grid">
              <div className="summary-tile"><div className="summary-tile__value" style={{ color: "var(--status-present)" }}>{result.addedCount || 0}</div><div className="summary-tile__label">Created</div></div>
              <div className="summary-tile"><div className="summary-tile__value" style={{ color: "var(--status-ot)" }}>{result.updatedCount || 0}</div><div className="summary-tile__label">Updated</div></div>
              <div className="summary-tile"><div className="summary-tile__value" style={{ color: "var(--status-absent)" }}>{(result.invalidCount || 0) + (result.failedCount || 0)}</div><div className="summary-tile__label">Failed</div></div>
            </div>
            {Array.isArray(result.invalidRecords) && result.invalidRecords.length > 0 && (
              <div className="mt-4">
                <h4 className="card__title mb-4">Invalid rows</h4>
                <div className="table-wrap" style={{ maxHeight: 200, overflowY: "auto" }}>
                  <table className="table table--compact">
                    <thead><tr><th>Row</th><th>empId</th><th>Errors</th></tr></thead>
                    <tbody>
                      {result.invalidRecords.map((r, i) => (
                        <tr key={i}><td>{r.row}</td><td>{r.empId}</td><td style={{ whiteSpace: "normal" }}>{(r.errors || []).join("; ")}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
