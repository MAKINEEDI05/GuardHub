import EmployeePhotoHover from "./EmployeePhotoHover";

// Shared "Employee" table cell: photo (with hover preview) + name + ID +
// designation. Used by View Leaves / OD / OT so an admin can identify who
// submitted a request without leaving the table. Compact 40px photo keeps row
// height tight; the larger preview appears on hover (same component as Employee
// Management & Security Roster).
//
// `emp` is the matched employee-master record (for photo + department fallback);
// name/empId/designation can be passed explicitly when the record already
// carries them (e.g. OT denormalises employeeName/designation).
export default function EmployeeTableCell({ emp, name, empId, designation }) {
  const displayName = name || emp?.empName || `ID ${empId}`;
  const desig = designation || emp?.empDesignation;
  const photoEmp = emp || { empId };
  return (
    <div className="emp-cell">
      <EmployeePhotoHover
        emp={photoEmp}
        px={40}
        name={displayName}
        empId={empId}
        designation={desig}
        department={emp?.empDepartment}
      />
      <div>
        <div className="emp-cell__name">{displayName}</div>
        <div className="emp-cell__sub">ID {empId}</div>
        {desig && <div className="emp-cell__sub">{desig}</div>}
      </div>
    </div>
  );
}
