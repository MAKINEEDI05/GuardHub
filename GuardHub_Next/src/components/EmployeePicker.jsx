import { useMemo, useState, useRef, useEffect } from "react";
import { useEmployees } from "../hooks/useEmployees";
import Avatar from "./ui/Avatar";
import EmployeeCard from "./EmployeeCard";

// Searchable employee selector used by the Apply Leave/OD/OT workflows.
// Search by ID, name, designation or mobile; selecting an employee calls
// onSelect(emp) so the parent can auto-fill the info card. Caches the employee
// master via React Query so re-opening forms is instant. Set `showCard={false}`
// to render only the search box (the parent then renders its own EmployeeCard).
export default function EmployeePicker({
  selected,
  onSelect,
  placeholder = "Search by ID, name, mobile...",
  showCard = true,
}) {
  const { data: employees = [], isLoading, isError, refetch } = useEmployees();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const matches = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return employees.slice(0, 25);
    return employees
      .filter((e) =>
        [e.empId, e.empName, e.empDesignation, e.empMobileNo]
          .map((v) => String(v ?? "").toLowerCase())
          .some((v) => v.includes(q))
      )
      .slice(0, 25);
  }, [term, employees]);

  const pick = (emp) => {
    onSelect(emp);
    setTerm("");
    setOpen(false);
  };

  return (
    <div className="field" ref={boxRef} style={{ position: "relative" }}>
      <label className="field__label">
        Search Employee <span className="req">*</span>
      </label>
      <input
        className="input"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={isLoading ? "Loading employees..." : placeholder}
        disabled={isLoading}
        autoComplete="off"
      />
      {open && (
        <div
          className="card"
          style={{
            position: "absolute",
            zIndex: 20,
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {matches.length === 0 ? (
            <div className="card__body text-sm muted">No matching employees.</div>
          ) : (
            matches.map((emp) => (
              <button
                key={emp._id || emp.empId}
                type="button"
                className="emp-cell"
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 12px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  borderBottom: "1px solid var(--border)",
                }}
                onClick={() => pick(emp)}
              >
                <Avatar emp={emp} size="sm" />
                <div>
                  <div className="emp-cell__name">{emp.empName}</div>
                  <div className="emp-cell__sub">
                    ID {emp.empId}
                    {emp.empDesignation ? ` · ${emp.empDesignation}` : ""}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {isError && (
        <div className="field__error mt-2">
          Could not load employees.{" "}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      )}

      {showCard && selected && (
        <div className="card mt-4">
          <div className="card__body">
            <EmployeeCard emp={selected} onClear={() => onSelect(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
