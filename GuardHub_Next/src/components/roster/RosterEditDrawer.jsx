import { useEffect, useState } from "react";
import Drawer from "../ui/Drawer";
import Button from "../ui/Button";
import { Field, Input, Select } from "../ui/Field";
import EmployeePicker from "../EmployeePicker";
import { useAddRoster, useUpdateRoster } from "../../hooks/useRoster";
import { ROSTER_SHIFTS, WEEKDAYS, WEEKDAY_LABEL } from "../../utils/constants";
import { toYmd } from "../../utils/date";

// Add or edit one employee's weekly roster. Add searches the employee master
// (POST /roster/add-emp-shift with denormalised details); edit updates the
// existing record (PUT /roster/update-emp-roster/:empId).
function defaultShifts() {
  return WEEKDAYS.reduce((acc, d) => ({ ...acc, [d]: "General" }), {});
}

export default function RosterEditDrawer({ open, roster, onClose }) {
  const isEdit = !!roster;
  const [emp, setEmp] = useState(null);
  const [shifts, setShifts] = useState(defaultShifts());
  const [dates, setDates] = useState({ shiftFromDate: "", shiftToDate: "" });
  const [error, setError] = useState("");

  const add = useAddRoster();
  const update = useUpdateRoster();
  const saving = add.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    setError("");
    setEmp(null);
    if (roster) {
      const ws = roster.weeklyShifts || {};
      setShifts(WEEKDAYS.reduce((acc, d) => ({ ...acc, [d]: ws[d] || "General" }), {}));
      setDates({
        shiftFromDate: roster.shiftFromDate ? toYmd(roster.shiftFromDate) : "",
        shiftToDate: roster.shiftToDate ? toYmd(roster.shiftToDate) : "",
      });
    } else {
      setShifts(defaultShifts());
      setDates({ shiftFromDate: "", shiftToDate: "" });
    }
  }, [open, roster]);

  const setDay = (day) => (e) => setShifts((s) => ({ ...s, [day]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const payloadShifts = { ...shifts };
    const datePart = {};
    if (dates.shiftFromDate) datePart.shiftFromDate = dates.shiftFromDate;
    if (dates.shiftToDate) datePart.shiftToDate = dates.shiftToDate;

    try {
      if (isEdit) {
        await update.mutateAsync({
          empId: roster.empId,
          payload: { empId: String(roster.empId), weeklyShifts: payloadShifts, ...datePart },
        });
      } else {
        if (!emp) {
          setError("Select an employee.");
          return;
        }
        await add.mutateAsync({
          empId: String(emp.empId),
          empName: emp.empName,
          mobileNo: emp.empMobileNo != null ? String(emp.empMobileNo) : "",
          department: emp.empDepartment || "Security",
          designation: emp.empDesignation || "",
          weeklyShifts: payloadShifts,
          ...datePart,
        });
      }
      onClose();
    } catch { /* toast in hook */ }
  };

  return (
    <Drawer
      open={open}
      title={isEdit ? `Edit Roster · ${roster?.empName}` : "Add Roster Entry"}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={onSubmit} loading={saving}>{isEdit ? "Save Changes" : "Add Entry"}</Button>
        </>
      }
    >
      <form onSubmit={onSubmit}>
        {isEdit ? (
          <div className="card mb-4">
            <div className="card__body">
              <div className="emp-cell__name">{roster.empName}</div>
              <div className="emp-cell__sub">Employee ID: {roster.empId}</div>
            </div>
          </div>
        ) : (
          <>
            <EmployeePicker selected={emp} onSelect={setEmp} />
            {error && <div className="field__error mb-4">{error}</div>}
          </>
        )}

        <h4 className="card__title mb-4">Weekly Shifts</h4>
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          {WEEKDAYS.map((day) => (
            <Field key={day} label={WEEKDAY_LABEL[day]}>
              <Select value={shifts[day]} onChange={setDay(day)} options={ROSTER_SHIFTS} />
            </Field>
          ))}
        </div>

        <h4 className="card__title mt-4 mb-4">Effective Dates (optional)</h4>
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <Field label="From Date">
            <Input type="date" value={dates.shiftFromDate} onChange={(e) => setDates((d) => ({ ...d, shiftFromDate: e.target.value }))} />
          </Field>
          <Field label="To Date">
            <Input type="date" value={dates.shiftToDate} min={dates.shiftFromDate} onChange={(e) => setDates((d) => ({ ...d, shiftToDate: e.target.value }))} />
          </Field>
        </div>
      </form>
    </Drawer>
  );
}
