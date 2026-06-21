import Avatar from "./ui/Avatar";

// Reusable employee verification card — photo + identity details. Shown after
// selection so users can confirm they picked the right guard. Used both inside
// EmployeePicker and standalone in the Apply workflows.
function Row({ label, children }) {
  if (children === undefined || children === null || children === "") return null;
  return (
    <div className="emp-info-row">
      <span className="emp-info-row__label">{label}</span>
      <span className="emp-info-row__value">{children}</span>
    </div>
  );
}

export default function EmployeeCard({ emp, onClear }) {
  if (!emp) return null;
  return (
    <div className="emp-info-card">
      <Avatar emp={emp} size="lg" alt={emp.empName} />
      <div className="grow">
        <div className="row row--between" style={{ alignItems: "flex-start" }}>
          <div className="emp-info-card__name">{emp.empName}</div>
          {onClear && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={onClear}>
              Change
            </button>
          )}
        </div>
        <div className="emp-info-card__rows">
          <Row label="ID">{emp.empId}</Row>
          <Row label="Designation">{emp.empDesignation}</Row>
          <Row label="Department">{emp.empDepartment}</Row>
          <Row label="Mobile">{emp.empMobileNo}</Row>
        </div>
      </div>
    </div>
  );
}
