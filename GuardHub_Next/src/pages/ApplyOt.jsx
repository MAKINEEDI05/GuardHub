import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import EmployeePicker from "../components/EmployeePicker";
import ApplyLayout from "../components/forms/ApplyLayout";
import FormSection from "../components/forms/FormSection";
import FormActions from "../components/forms/FormActions";
import DateField from "../components/forms/DateField";
import { Field, Input, Select, Textarea } from "../components/ui/Field";
import { useApplyOt } from "../hooks/useOts";
import { OT_SHIFTS, OT_DURATIONS } from "../utils/constants";

// Apply OT: Search Employee → verify → current/additional shift, duration,
// location → dates → reason/remarks → submit. Payload matches the OT schema
// (employeeId Number; name/designation/department derived server-side).
const INIT = {
  currentShift: "", additionalShift: "", workingDuration: "",
  fromDate: "", toDate: "", location: "", reason: "", remarks: "",
};

export default function ApplyOt() {
  const navigate = useNavigate();
  const [emp, setEmp] = useState(null);
  const [form, setForm] = useState(INIT);
  const [errors, setErrors] = useState({});
  const apply = useApplyOt();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const reset = () => { setForm(INIT); setEmp(null); setErrors({}); };

  const validate = () => {
    const errs = {};
    if (!emp) errs.emp = "Select an employee.";
    if (!form.currentShift) errs.currentShift = "Required";
    if (!form.additionalShift) errs.additionalShift = "Required";
    if (!form.workingDuration) errs.workingDuration = "Required";
    if (!form.fromDate) errs.fromDate = "Required";
    if (!form.toDate) errs.toDate = "Required";
    else if (form.toDate < form.fromDate) errs.toDate = "To date must be after from date.";
    if (!form.location.trim()) errs.location = "Enter the location.";
    if (!form.reason.trim()) errs.reason = "Enter a reason.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await apply.mutateAsync({
        employeeId: parseInt(emp.empId, 10),
        currentShift: form.currentShift,
        additionalShift: form.additionalShift,
        workingDuration: form.workingDuration,
        fromDate: form.fromDate,
        toDate: form.toDate,
        location: form.location.trim(),
        reason: form.reason.trim(),
        remarks: form.remarks.trim(),
      });
      reset();
      navigate("/ot");
    } catch { /* toast in hook */ }
  };

  return (
    <>
      <PageHeader title="Apply OT" subtitle="Submit an overtime / double-shift request" />
      <ApplyLayout
        onSubmit={onSubmit}
        aside={
          <FormSection title="Employee Information" description="Search and verify the employee">
            <EmployeePicker selected={emp} onSelect={setEmp} />
            {errors.emp && <div className="field__error">{errors.emp}</div>}
            {!emp && <p className="muted text-sm" style={{ margin: "8px 0 0" }}>Select an employee to begin.</p>}
          </FormSection>
        }
      >
        <FormSection title="Overtime Details">
          <div className="field-grid-2">
            <Field label="Current Shift" required error={errors.currentShift}>
              <Select value={form.currentShift} onChange={set("currentShift")} options={OT_SHIFTS} placeholder="Select shift" />
            </Field>
            <Field label="Additional Shift" required error={errors.additionalShift}>
              <Select value={form.additionalShift} onChange={set("additionalShift")} options={OT_SHIFTS} placeholder="Select shift" />
            </Field>
            <Field label="Working Duration" required error={errors.workingDuration}>
              <Select value={form.workingDuration} onChange={set("workingDuration")} options={OT_DURATIONS} placeholder="Select duration" />
            </Field>
            <Field label="Location" required error={errors.location}>
              <Input value={form.location} onChange={set("location")} maxLength={120} placeholder="e.g. Main Gate" />
            </Field>
            <DateField label="From Date" required value={form.fromDate} onChange={set("fromDate")} error={errors.fromDate} />
            <DateField label="To Date" required value={form.toDate} min={form.fromDate} onChange={set("toDate")} error={errors.toDate} />
          </div>
        </FormSection>

        <FormSection title="Reason & Remarks">
          <Field label="Reason" required error={errors.reason}>
            <Textarea maxLength={225} value={form.reason} onChange={set("reason")} placeholder="Reason for overtime / double shift" rows={3} />
          </Field>
          <Field label="Remarks" hint="Optional">
            <Textarea maxLength={225} value={form.remarks} onChange={set("remarks")} placeholder="Any additional remarks" rows={3} />
          </Field>
        </FormSection>

        <FormSection title="Review & Submit">
          <FormActions
            onCancel={() => navigate("/ot")}
            onReset={reset}
            submitLabel="Submit OT"
            loading={apply.isPending}
          />
        </FormSection>
      </ApplyLayout>
    </>
  );
}
