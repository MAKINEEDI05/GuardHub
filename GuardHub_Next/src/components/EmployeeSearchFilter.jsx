import EmployeePicker from "./EmployeePicker";

// Employee search-as-filter for list pages (View Leaves / OD / OT). Reuses the
// shared EmployeePicker autocomplete (search by ID / name / mobile / designation,
// with avatar suggestions) and shows the selected employee with a Clear action —
// the same pattern as the Leave Management filter. Controlled: the parent holds
// the selected employee and narrows its table to emp.empId; passing null clears.
//
// props: { selected, onSelect, label?, placeholder?, width? }
export default function EmployeeSearchFilter({
  selected,
  onSelect,
  label = "Employee (ID / Name / Mobile)",
  placeholder = "Search by ID, name, mobile...",
  width = 420,
}) {
  return (
    <div style={{ width: "100%", maxWidth: width }}>
      <EmployeePicker
        selected={selected}
        showCard={false}
        label={label}
        placeholder={placeholder}
        required={false}
        onSelect={onSelect}
      />
      {selected && (
        <div className="text-sm" style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span>
            Selected: <strong>{selected.empName}</strong> (ID {selected.empId})
            {selected.empDepartment ? ` · ${selected.empDepartment}` : ""}
            {selected.empDesignation ? ` · ${selected.empDesignation}` : ""}
          </span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onSelect(null)}>Clear</button>
        </div>
      )}
    </div>
  );
}
