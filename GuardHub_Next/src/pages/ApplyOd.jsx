import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import EmployeePicker from "../components/EmployeePicker";
import ApplyLayout from "../components/forms/ApplyLayout";
import FormSection from "../components/forms/FormSection";
import FormActions from "../components/forms/FormActions";
import DateField from "../components/forms/DateField";
import { Field, Input, Select, Textarea } from "../components/ui/Field";
import { useApplyOd } from "../hooks/useOds";
import { useRosterByEmp } from "../hooks/useRoster";
import { SHIFT_TYPES, OT_SHIFTS, OT_DURATIONS } from "../utils/constants";
import { todayYmd } from "../utils/date";
import { shiftForDate } from "../utils/roster";
import { computeApplicableDays, weeklyOffIndexesFromRoster } from "../utils/workingDays";
import WorkingDaysNote from "../components/WorkingDaysNote";

// Apply OD: Search Employee → verify → shift/duration/location/dates → purpose →
// submit. Mirrors the OT form: the current shift is auto-filled from the
// employee's roster for the OD date (an OD moves them off that shift), plus the
// additional shift they are deputed to, working duration and location.
const INIT = {
  empShiftType: "", additionalShift: "", workingDuration: "",
  empFromDate: "", empToDate: "", odLocation: "", empPurpose: "",
};

export default function ApplyOd() {
  const navigate = useNavigate();
  const [emp, setEmp] = useState(null);
  const [form, setForm] = useState(INIT);
  const [errors, setErrors] = useState({});
  const apply = useApplyOd();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // The employee's weekly roster → their current shift on the OD date. The OD
  // "From Date" (falling back to today) decides which day's shift applies.
  const { data: roster, isFetching: rosterLoading } = useRosterByEmp(emp?.empId);
  const refDate = form.empFromDate || todayYmd();
  const rosteredShift = shiftForDate(roster?.weeklyShifts, refDate);

  // Auto-fill the current shift from the roster whenever it resolves/changes.
  useEffect(() => {
    if (rosteredShift) setForm((f) => ({ ...f, empShiftType: rosteredShift }));
  }, [rosteredShift]);

  // Applicable OD days: calendar days in the range minus the employee's weekly
  // offs (same engine Leave uses). Half-day durations count a single day as 0.5.
  const weeklyOff = weeklyOffIndexesFromRoster(roster?.weeklyShifts);
  const odCalc = computeApplicableDays(form.empFromDate, form.empToDate, {
    weeklyOff,
    halfDay: /half/i.test(form.workingDuration || ""),
  });

  const reset = () => { setForm(INIT); setEmp(null); setErrors({}); };
  const onSelectEmp = (x) => { setEmp(x); setForm((f) => ({ ...f, empShiftType: "" })); };

  const validate = () => {
    const errs = {};
    if (!emp) errs.emp = "Select an employee.";
    if (!form.empShiftType) errs.empShiftType = "Required";
    if (!form.additionalShift) errs.additionalShift = "Required";
    if (!form.workingDuration) errs.workingDuration = "Required";
    if (!form.empFromDate) errs.empFromDate = "Required";
    if (!form.empToDate) errs.empToDate = "Required";
    else if (form.empToDate < form.empFromDate) errs.empToDate = "To date must be after from date.";
    if (!form.odLocation.trim()) errs.odLocation = "Enter the location.";
    if (!form.empPurpose.trim() || form.empPurpose.trim().length < 5) errs.empPurpose = "Enter a purpose (min 5 chars).";
    // Block a range that is entirely the employee's weekly off day(s).
    if (odCalc && odCalc.actualDays <= 0) {
      errs.dateRange = "All selected dates are weekly off days for this employee — no OD days to apply.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await apply.mutateAsync({
        empId: parseInt(emp.empId, 10),
        empShiftType: form.empShiftType,
        additionalShift: form.additionalShift,
        workingDuration: form.workingDuration,
        empFromDate: form.empFromDate,
        empToDate: form.empToDate,
        odLocation: form.odLocation.trim(),
        empPurpose: form.empPurpose.trim(),
      });
      reset();
      navigate("/od");
    } catch { /* toast in hook */ }
  };

  return (
    <>
      <PageHeader title="Apply OD" subtitle="Submit an on-duty request for an employee" />
      <ApplyLayout
        onSubmit={onSubmit}
        aside={
          <FormSection title="Employee Information" description="Search and verify the employee">
            <EmployeePicker selected={emp} onSelect={onSelectEmp} />
            {errors.emp && <div className="field__error">{errors.emp}</div>}
            {!emp && <p className="muted text-sm" style={{ margin: "8px 0 0" }}>Select an employee to begin.</p>}
            {emp && (
              <p className="muted text-sm" style={{ margin: "8px 0 0" }}>
                {rosterLoading
                  ? "Loading roster…"
                  : rosteredShift
                  ? `Rostered shift on ${refDate}: ${rosteredShift}`
                  : "No roster found — set the current shift manually."}
              </p>
            )}
          </FormSection>
        }
      >
        <FormSection title="OD Details">
          <div className="field-grid-2">
            <Field
              label="Current Shift"
              required
              error={errors.empShiftType}
              hint={rosteredShift ? "Auto-filled from the employee's roster for the OD date" : undefined}
            >
              {rosteredShift ? (
                <Input value={rosteredShift} readOnly disabled />
              ) : (
                <Select
                  value={form.empShiftType}
                  onChange={set("empShiftType")}
                  options={SHIFT_TYPES}
                  placeholder={rosterLoading ? "Loading roster…" : "Select shift"}
                />
              )}
            </Field>
            <Field label="Additional Shift" required error={errors.additionalShift}>
              <Select value={form.additionalShift} onChange={set("additionalShift")} options={OT_SHIFTS} placeholder="Select shift" />
            </Field>
            <Field label="Working Duration" required error={errors.workingDuration}>
              <Select value={form.workingDuration} onChange={set("workingDuration")} options={OT_DURATIONS} placeholder="Select duration" />
            </Field>
            <Field label="Location" required error={errors.odLocation}>
              <Input value={form.odLocation} onChange={set("odLocation")} maxLength={120} placeholder="e.g. Main Gate" />
            </Field>
            <DateField label="From Date" required value={form.empFromDate} onChange={set("empFromDate")} error={errors.empFromDate} />
            <DateField label="To Date" required value={form.empToDate} min={form.empFromDate} onChange={set("empToDate")} error={errors.empToDate} />
          </div>
          <WorkingDaysNote calc={odCalc} noun="OD" error={errors.dateRange} />
        </FormSection>

        <FormSection title="Purpose">
          <Field required error={errors.empPurpose}>
            <Textarea maxLength={225} value={form.empPurpose} onChange={set("empPurpose")} placeholder="Purpose of the on-duty assignment" rows={4} />
          </Field>
        </FormSection>

        <FormSection title="Review & Submit">
          <FormActions
            onCancel={() => navigate("/od")}
            onReset={reset}
            submitLabel="Submit OD"
            loading={apply.isPending}
          />
        </FormSection>
      </ApplyLayout>
    </>
  );
}
