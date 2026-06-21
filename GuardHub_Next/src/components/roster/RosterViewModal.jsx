import Button from "../ui/Button";
import Avatar from "../ui/Avatar";
import { WEEKDAYS, WEEKDAY_LABEL, rosterShiftClass, shiftShort } from "../../utils/constants";
import { formatDate } from "../../utils/date";

// Simple roster details popup (old-app style): photo + name at top, identity
// details, the full weekly shift pattern, and effective dates. `emp` (optional)
// is the matched employee master record used only for the photo / fallbacks —
// no extra API call is made.
const val = (v) => (v === undefined || v === null || v === "" ? "N/A" : v);

function Item({ label, children, full }) {
  return (
    <div className={`detail-item ${full ? "detail-item--full" : ""}`}>
      <span className="detail-label">{label}</span>
      <span className="detail-value">{children}</span>
    </div>
  );
}

export default function RosterViewModal({ roster, emp, onClose }) {
  if (!roster) return null;
  const r = roster;
  const photoEmp = { empId: r.empId, empImage: emp?.empImage };
  const designation = r.designation || emp?.empDesignation;
  const department = r.department || emp?.empDepartment;
  const mobile = r.mobileNo || emp?.empMobileNo;
  const hasDates = r.shiftFromDate || r.shiftToDate;

  return (
    <div className="overlay overlay--center" onMouseDown={onClose}>
      <div className="modal modal--lg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__body">
          <div className="detail-head">
            <Avatar emp={photoEmp} size="lg" />
            <div className="detail-head__name">{val(r.empName)}</div>
            <div className="detail-head__sub">
              {designation || "—"} · ID {val(r.empId)}
            </div>
          </div>

          <div className="detail-grid">
            <Item label="Employee ID">{val(r.empId)}</Item>
            <Item label="Designation">{val(designation)}</Item>
            <Item label="Department">{val(department)}</Item>
            <Item label="Mobile Number">{val(mobile)}</Item>
          </div>

          <h4 className="card__title" style={{ margin: "20px 0 10px" }}>Weekly Shift Pattern</h4>
          <div className="roster-week">
            {WEEKDAYS.map((d) => {
              const shift = r.weeklyShifts?.[d] || "—";
              return (
                <div className="roster-week__day" key={d}>
                  <div className="roster-week__label">{WEEKDAY_LABEL[d]}</div>
                  <span className={`badge shift ${rosterShiftClass(shift)}`} title={shift}>
                    {shiftShort(shift)}
                  </span>
                </div>
              );
            })}
          </div>

          <h4 className="card__title" style={{ margin: "20px 0 10px" }}>Effective Dates</h4>
          {hasDates ? (
            <div className="detail-grid">
              <Item label="Effective From">{r.shiftFromDate ? formatDate(r.shiftFromDate) : "N/A"}</Item>
              <Item label="Effective To">{r.shiftToDate ? formatDate(r.shiftToDate) : "N/A"}</Item>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Permanent Schedule</p>
          )}
        </div>
        <div className="modal__footer">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
