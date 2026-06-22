import Button from "./ui/Button";
import Avatar from "./ui/Avatar";

// Month-wise details popup: employee photo + identity, then the attendance
// breakdown for the selected range. `row` is one summary row from
// /month/monthwise-summary (it already carries the photo + counts), so no extra
// API call is made.
const val = (v) => (v === undefined || v === null || v === "" ? "N/A" : v);

const TILES = [
  { key: "presentDays", label: "Present", color: "var(--status-present)" },
  { key: "absentDays", label: "Absent", color: "var(--status-absent)" },
  { key: "leaveDays", label: "Leave", color: "var(--status-leave)" },
  { key: "odDays", label: "OD", color: "var(--status-od)" },
  { key: "otDays", label: "OT", color: "var(--status-weekoff)" },
  { key: "weekOffDays", label: "Week Off", color: "var(--text-muted)" },
  { key: "totalDays", label: "Total Days", color: "var(--text)" },
];

function Item({ label, children }) {
  return (
    <div className="detail-item">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{children}</span>
    </div>
  );
}

export default function MonthWiseDetailModal({ row, range, onClose }) {
  if (!row) return null;

  return (
    <div className="overlay overlay--center" onMouseDown={onClose}>
      <div className="modal modal--lg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__body">
          <div className="detail-head">
            <Avatar emp={row} size="lg" alt={row.empName} />
            <div className="detail-head__name">{val(row.empName)}</div>
            <div className="detail-head__sub">
              {row.empDesignation || "—"} · ID {val(row.empId)}
            </div>
          </div>

          <div className="detail-grid">
            <Item label="Employee ID">{val(row.empId)}</Item>
            <Item label="Designation">{val(row.empDesignation)}</Item>
            <Item label="Department">{val(row.empDepartment)}</Item>
            {range && (
              <Item label="Period">
                {range.start} → {range.end}
              </Item>
            )}
          </div>

          <h4 className="card__title" style={{ margin: "20px 0 10px" }}>
            Attendance Breakdown
          </h4>
          <div className="summary-grid">
            {TILES.map((t) => (
              <div className="summary-tile" key={t.key}>
                <div className="summary-tile__value" style={{ color: t.color }}>
                  {row[t.key] ?? 0}
                </div>
                <div className="summary-tile__label">{t.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="modal__footer">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
