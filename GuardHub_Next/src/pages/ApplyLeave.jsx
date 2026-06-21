import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import EmployeePicker from "../components/EmployeePicker";
import ApplyLayout from "../components/forms/ApplyLayout";
import FormSection from "../components/forms/FormSection";
import FormActions from "../components/forms/FormActions";
import DateField from "../components/forms/DateField";
import { Field, Select, Textarea } from "../components/ui/Field";
import { useApplyLeave } from "../hooks/useLeaves";
import { LEAVE_TYPES, SHIFT_TYPES, DAY_TYPES } from "../utils/constants";

// Apply Leave: Search Employee → verify (left panel) → request details → reason
// → submit. Payload exactly matches the backend leave schema (empId is Number).
const INIT = { empLeaveType: "", empShiftType: "", empOdType: "", empFromDate: "", empToDate: "", empReason: "" };

export default function ApplyLeave() {
  const navigate = useNavigate();
  const [emp, setEmp] = useState(null);
  const [form, setForm] = useState(INIT);
  const [errors, setErrors] = useState({});
  const apply = useApplyLeave();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const reset = () => { setForm(INIT); setEmp(null); setErrors({}); };

  const validate = () => {
    const errs = {};
    if (!emp) errs.emp = "Select an employee.";
    if (!form.empLeaveType) errs.empLeaveType = "Required";
    if (!form.empShiftType) errs.empShiftType = "Required";
    if (!form.empOdType) errs.empOdType = "Required";
    if (!form.empFromDate) errs.empFromDate = "Required";
    if (!form.empToDate) errs.empToDate = "Required";
    else if (form.empToDate < form.empFromDate) errs.empToDate = "To date must be after from date.";
    if (!form.empReason.trim() || form.empReason.trim().length < 5) errs.empReason = "Enter a reason (min 5 chars).";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await apply.mutateAsync({
        empId: parseInt(emp.empId, 10),
        empLeaveType: form.empLeaveType,
        empShiftType: form.empShiftType,
        empOdType: form.empOdType,
        empFromDate: form.empFromDate,
        empToDate: form.empToDate,
        empReason: form.empReason.trim(),
      });
      reset();
      navigate("/leaves");
    } catch { /* toast in hook */ }
  };

  return (
    <>
      <PageHeader title="Apply Leave" subtitle="Submit a leave request for an employee" />
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
        <FormSection title="Leave Details">
          <div className="field-grid-2">
            <Field label="Leave Type" required error={errors.empLeaveType}>
              <Select value={form.empLeaveType} onChange={set("empLeaveType")} options={LEAVE_TYPES} placeholder="Select type" />
            </Field>
            <Field label="Shift Type" required error={errors.empShiftType}>
              <Select value={form.empShiftType} onChange={set("empShiftType")} options={SHIFT_TYPES} placeholder="Select shift" />
            </Field>
            <Field label="Duration" required error={errors.empOdType}>
              <Select value={form.empOdType} onChange={set("empOdType")} options={DAY_TYPES} placeholder="Select duration" />
            </Field>
            <div />
            <DateField label="From Date" required value={form.empFromDate} onChange={set("empFromDate")} error={errors.empFromDate} />
            <DateField label="To Date" required value={form.empToDate} min={form.empFromDate} onChange={set("empToDate")} error={errors.empToDate} />
          </div>
        </FormSection>

        <FormSection title="Reason">
          <Field required error={errors.empReason}>
            <Textarea maxLength={225} value={form.empReason} onChange={set("empReason")} placeholder="Reason for leave" rows={4} />
          </Field>
        </FormSection>

        <FormSection title="Review & Submit">
          <FormActions
            onCancel={() => navigate("/leaves")}
            onReset={reset}
            submitLabel="Submit Leave"
            loading={apply.isPending}
          />
        </FormSection>
      </ApplyLayout>
    </>
  );
}
