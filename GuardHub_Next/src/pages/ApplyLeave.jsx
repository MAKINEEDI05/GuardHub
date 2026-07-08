import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import EmployeePicker from "../components/EmployeePicker";
import ApplyLayout from "../components/forms/ApplyLayout";
import FormSection from "../components/forms/FormSection";
import FormActions from "../components/forms/FormActions";
import DateField from "../components/forms/DateField";
import { Field, Select, Textarea } from "../components/ui/Field";
import EmployeeLeaveSummary from "../components/leave/EmployeeLeaveSummary";
import { useRecordLeave, useLeaveTypes, useLeaveBalances } from "../hooks/useLeaveV2";
import { SHIFT_TYPES, DAY_TYPES } from "../utils/constants";
import { compOffRemaining } from "../utils/leaveSummary";
import { toast } from "../store/toastStore";

// Apply Leave (v2): pick employee → choose type/shift/duration/dates → reason →
// submit. This records a leave TRANSACTION which auto-debits the balance and
// mirrors a legacy leave_mgmt row (so attendance/reports keep working). The
// panel shows the employee's remaining balance for the chosen type.
const INIT = { leaveTypeCode: "", shiftType: "", dayType: "", fromDate: "", toDate: "", reason: "" };

// Client mirror of utils/leaveDays.computeLeaveDays for a live preview only.
function previewDays(from, to, dayType) {
  if (!from || !to || to < from) return null;
  const days = Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
  if (days === 1 && /HALF/i.test(dayType)) return 0.5;
  return days;
}

export default function ApplyLeave() {
  const navigate = useNavigate();
  const [emp, setEmp] = useState(null);
  const [form, setForm] = useState(INIT);
  const [errors, setErrors] = useState({});
  const [compShort, setCompShort] = useState(false); // highlight balance on shortfall
  const record = useRecordLeave();
  const { data: types = [] } = useLeaveTypes(true);

  const year = new Date().getFullYear();

  // Employee's live Comp Off balance (same source as the summary panel), used to
  // block a Comp Off leave that would overdraw it.
  const { data: bal } = useLeaveBalances(year, emp?.empId, { enabled: !!emp });
  const compAvailable = compOffRemaining(bal);
  const isCompOff = form.leaveTypeCode === "COMP";

  // Clearing the shortfall highlight whenever the inputs that affect it change.
  const set = (k) => (e) => {
    setCompShort(false);
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };
  const reset = () => { setForm(INIT); setEmp(null); setErrors({}); setCompShort(false); };

  const days = previewDays(form.fromDate, form.toDate, form.dayType);

  const validate = () => {
    const errs = {};
    if (!emp) errs.emp = "Select an employee.";
    if (!form.leaveTypeCode) errs.leaveTypeCode = "Required";
    if (!form.shiftType) errs.shiftType = "Required";
    if (!form.dayType) errs.dayType = "Required";
    if (!form.fromDate) errs.fromDate = "Required";
    if (!form.toDate) errs.toDate = "Required";
    else if (form.toDate < form.fromDate) errs.toDate = "To date must be on/after from date.";
    if (!form.reason.trim() || form.reason.trim().length < 5) errs.reason = "Enter a reason (min 5 chars).";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    // Comp Off can never go negative: block before the API call if the request
    // exceeds the available (earned − used) balance. Backend enforces this too.
    if (isCompOff && days != null && days > compAvailable) {
      setCompShort(true);
      toast.error(
        `Insufficient Comp Off balance — Available: ${compAvailable} day(s), Requested: ${days} day(s). ` +
        `Please reduce the requested duration or earn additional Comp Off before applying.`
      );
      return;
    }

    try {
      await record.mutateAsync({
        empId: parseInt(emp.empId, 10),
        leaveTypeCode: form.leaveTypeCode,
        shiftType: form.shiftType,
        dayType: form.dayType,
        fromDate: form.fromDate,
        toDate: form.toDate,
        reason: form.reason.trim(),
      });
      reset();
      navigate("/leaves");
    } catch { /* toast in hook */ }
  };

  return (
    <>
      <PageHeader title="Apply Leave" subtitle="Record a leave for an employee (updates their balance)" />
      <ApplyLayout
        onSubmit={onSubmit}
        aside={
          <FormSection title="Employee Information" description="Search and verify the employee">
            <EmployeePicker selected={emp} onSelect={(x) => { setCompShort(false); setEmp(x); }} />
            {errors.emp && <div className="field__error">{errors.emp}</div>}
            {!emp && <p className="muted text-sm" style={{ margin: "8px 0 0" }}>Select an employee to begin.</p>}
            {emp && (
              <EmployeeLeaveSummary
                emp={emp}
                year={year}
                selectedTypeCode={form.leaveTypeCode}
                projectedDays={days}
                highlightComp={compShort}
              />
            )}
          </FormSection>
        }
      >
        <FormSection title="Leave Details">
          <div className="field-grid-2">
            <Field label="Leave Type" required error={errors.leaveTypeCode}>
              <Select value={form.leaveTypeCode} onChange={set("leaveTypeCode")}
                placeholder="Select type"
                options={types.map((t) => ({ value: t.code, label: `${t.name}${t.isPaid ? "" : " (LOP)"}` }))} />
            </Field>
            <Field label="Shift Type" required error={errors.shiftType}>
              <Select value={form.shiftType} onChange={set("shiftType")} options={SHIFT_TYPES} placeholder="Select shift" />
            </Field>
            <Field label="Duration" required error={errors.dayType}>
              <Select value={form.dayType} onChange={set("dayType")} options={DAY_TYPES} placeholder="Select duration" />
            </Field>
            <div />
            <DateField label="From Date" required value={form.fromDate} onChange={set("fromDate")} error={errors.fromDate} />
            <DateField label="To Date" required value={form.toDate} min={form.fromDate} onChange={set("toDate")} error={errors.toDate} />
          </div>
          {days != null && <p className="text-sm muted" style={{ margin: "4px 0 0" }}>This leave counts as <strong>{days}</strong> day(s).</p>}
        </FormSection>

        <FormSection title="Reason">
          <Field required error={errors.reason}>
            <Textarea maxLength={225} value={form.reason} onChange={set("reason")} placeholder="Reason for leave" rows={4} />
          </Field>
        </FormSection>

        <FormSection title="Review & Submit">
          <FormActions onCancel={() => navigate("/leaves")} onReset={reset} submitLabel="Record Leave" loading={record.isPending} />
        </FormSection>
      </ApplyLayout>
    </>
  );
}
