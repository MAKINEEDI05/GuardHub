import Button from "../ui/Button";
import Avatar from "../ui/Avatar";
import { formatDate } from "../../utils/date";

// Simple employee details popup (matches the old GuardHub "View Details" modal):
// photo + name at top, details in two columns, close button at bottom.
// Reuses the employee object already loaded in the table — no extra API call.
const val = (v) => (v === undefined || v === null || v === "" ? "N/A" : v);

function Item({ label, children, full }) {
  return (
    <div className={`detail-item ${full ? "detail-item--full" : ""}`}>
      <span className="detail-label">{label}</span>
      <span className="detail-value">{children}</span>
    </div>
  );
}

export default function EmployeeViewModal({ employee, onClose }) {
  if (!employee) return null;
  const e = employee;
  return (
    <div className="overlay overlay--center" onMouseDown={onClose}>
      <div className="modal modal--lg" onMouseDown={(ev) => ev.stopPropagation()}>
        <div className="modal__body">
          <div className="detail-head">
            <Avatar emp={e} size="lg" />
            <div className="detail-head__name">{val(e.empName)}</div>
            <div className="detail-head__sub">
              {e.empDesignation ? e.empDesignation : "—"} · ID {val(e.empId)}
            </div>
          </div>

          <div className="detail-grid">
            <Item label="Employee ID">{val(e.empId)}</Item>
            <Item label="Designation">{val(e.empDesignation)}</Item>
            <Item label="Department">{val(e.empDepartment)}</Item>
            <Item label="Mobile Number">{val(e.empMobileNo)}</Item>
            <Item label="Aadhaar Number">{val(e.empAadharNo)}</Item>
            <Item label="PAN Number">{val(e.empPanNo)}</Item>
            <Item label="Date of Birth">{e.empDob ? formatDate(e.empDob) : "N/A"}</Item>
            <Item label="Date of Joining">{val(e.empDoj)}</Item>
            <Item label="Bank Account Number">{val(e.bankAccountNo)}</Item>
            <Item label="EPF Number">{val(e.epfNo)}</Item>
            <Item label="ESI Number">{val(e.esiNo)}</Item>
            <Item label="Address" full>{val(e.address)}</Item>
            <Item label="Emergency Contact Name">{val(e.emergencyContactName)}</Item>
            <Item label="Emergency Contact Number">{val(e.emergencyContactNumber)}</Item>
            <Item label="Emergency Contact Relation">{val(e.emergencyContactRelation)}</Item>
          </div>
        </div>
        <div className="modal__footer">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
