import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import EmployeePicker from "../components/EmployeePicker";
import ApplyLayout from "../components/forms/ApplyLayout";
import FormSection from "../components/forms/FormSection";
import FormActions from "../components/forms/FormActions";
import DateField from "../components/forms/DateField";
import { Field, Input, Select, Textarea } from "../components/ui/Field";
import EmployeeLeaveSummary from "../components/leave/EmployeeLeaveSummary";
import DeductionBreakdown from "../components/leave/DeductionBreakdown";
import { useRecordLeave, useLeaveTypes, useLeaveBalances } from "../hooks/useLeaveV2";
import { useRosterByEmp } from "../hooks/useRoster";
import { SHIFT_TYPES, DAY_TYPES } from "../utils/constants";
import {
  computeDeduction,
  validateCustomLeaveName,
  balanceRemaining,
  OTHERS_CODE,
} from "../utils/leaveDeduction";
import { computeApplicableDays, weeklyOffIndexesFromRoster } from "../utils/workingDays";
import { shiftForDate } from "../utils/roster";
import { todayYmd } from "../utils/date";
import WorkingDaysNote from "../components/WorkingDaysNote";
import { toast } from "../store/toastStore";

// Apply Leave (v2): pick employee → choose type/shift/duration/dates → reason →
// submit. A leave is funded from Casual Leave first, then Comp Off (the split is
// shown live in the Deduction Breakdown and stored on the record). "Others" is a
// per-record custom leave (name + day count) with NO balance impact. Negative
// balances are allowed — an over-draw is recorded, never blocked.
const INIT = {
  leaveTypeCode: "",
  shiftType: "",
  dayType: "",
  fromDate: "",
  toDate: "",
  reason: "",
  customLeaveName: "",
  customDays: "",
};

export default function ApplyLeave() {
  const navigate = useNavigate();
  const [emp, setEmp] = useState(null);
  const [form, setForm] = useState(INIT);
  const [errors, setErrors] = useState({});
  const record = useRecordLeave();
  const { data: types = [] } = useLeaveTypes(true);

  const year = new Date().getFullYear();
  const { data: bal } = useLeaveBalances(year, emp?.empId, { enabled: !!emp });
  const { data: roster } = useRosterByEmp(emp?.empId);

  const isOthers = form.leaveTypeCode === OTHERS_CODE;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const reset = () => { setForm(INIT); setEmp(null); setErrors({}); };

  // Shift is the employee's rostered shift for the leave date — derived, not
  // chosen (same rule as Apply OD / Apply OT).
  const rosteredShift = shiftForDate(roster?.weeklyShifts, form.fromDate || todayYmd());
  useEffect(() => {
    if (rosteredShift) setForm((f) => ({ ...f, shiftType: rosteredShift }));
  }, [rosteredShift]);

  // Applicable-day breakdown: calendar days minus the employee's weekly offs
  // (from their roster). Others uses the explicit count and is not date-derived.
  const weeklyOff = weeklyOffIndexesFromRoster(roster?.weeklyShifts);
  const leaveCalc = isOthers
    ? null
    : computeApplicableDays(form.fromDate, form.toDate, {
        weeklyOff,
        halfDay: /HALF/i.test(form.dayType),
      });

  // Days this leave counts as: the explicit count for Others, else applicable days.
  const days = isOthers
    ? (form.customDays === "" ? null : Number(form.customDays))
    : (leaveCalc ? leaveCalc.actualDays : null);

  // Live CL → Comp Off split against the employee's current balance (non-Others).
  const clRem = balanceRemaining(bal, "CL");
  const compRem = balanceRemaining(bal, "COMP");
  const deduction =
    !isOthers && days != null && days > 0 ? computeDeduction(days, clRem, compRem) : null;

  const validate = () => {
    const errs = {};
    if (!emp) errs.emp = "Select an employee.";
    if (!form.leaveTypeCode) errs.leaveTypeCode = "Required";
    if (!form.shiftType) errs.shiftType = "Required";
    if (!form.fromDate) errs.fromDate = "Required";
    if (!form.toDate) errs.toDate = "Required";
    else if (form.toDate < form.fromDate) errs.toDate = "To date must be on/after from date.";
    if (!form.reason.trim() || form.reason.trim().length < 5) errs.reason = "Enter a reason (min 5 chars).";

    if (isOthers) {
      const nameCheck = validateCustomLeaveName(form.customLeaveName);
      if (!nameCheck.ok) errs.customLeaveName = nameCheck.message;
      const d = Number(form.customDays);
      if (!form.customDays || Number.isNaN(d) || d <= 0) errs.customDays = "Enter days greater than 0.";
    } else {
      if (!form.dayType) errs.dayType = "Required";
      // Block a range that is entirely the employee's weekly off day(s).
      if (leaveCalc && leaveCalc.actualDays <= 0) {
        errs.dateRange = "All selected dates are weekly off days for this employee — no leave days to apply.";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      empId: parseInt(emp.empId, 10),
      leaveTypeCode: form.leaveTypeCode,
      shiftType: form.shiftType,
      dayType: isOthers ? "FULL DAY" : form.dayType,
      fromDate: form.fromDate,
      toDate: form.toDate,
      reason: form.reason.trim(),
    };
    if (isOthers) {
      payload.customLeaveName = form.customLeaveName;
      payload.days = Number(form.customDays);
    }

    try {
      await record.mutateAsync(payload);
      reset();
      navigate("/leaves");
    } catch { /* toast in hook */ }
  };

  // Predefined categories + the per-record "Others" option (req 2). "Others" is
  // NOT a stored leave type — it only ever exists on this one leave.
  const typeOptions = [
    ...types.map((t) => ({ value: t.code, label: `${t.name}${t.isPaid ? "" : " (LOP)"}` })),
    { value: OTHERS_CODE, label: "Others" },
  ];

  return (
    <>
      <PageHeader title="Apply Leave" subtitle="Record a leave for an employee (updates their balance)" />
      <ApplyLayout
        onSubmit={onSubmit}
        aside={
          <FormSection title="Employee Information" description="Search and verify the employee">
            <EmployeePicker selected={emp} onSelect={(x) => { setEmp(x); setForm((f) => ({ ...f, shiftType: "" })); }} />
            {errors.emp && <div className="field__error">{errors.emp}</div>}
            {!emp && <p className="muted text-sm" style={{ margin: "8px 0 0" }}>Select an employee to begin.</p>}
            {emp && (
              <EmployeeLeaveSummary
                emp={emp}
                year={year}
                selectedTypeCode={isOthers ? "" : form.leaveTypeCode}
                projectedDays={isOthers ? null : days}
              />
            )}
          </FormSection>
        }
      >
        <FormSection title="Leave Details">
          <div className="field-grid-2">
            <Field label="Leave Type" required error={errors.leaveTypeCode}>
              <Select value={form.leaveTypeCode} onChange={set("leaveTypeCode")}
                placeholder="Select type" options={typeOptions} />
            </Field>
            <Field
              label="Shift Type"
              required
              error={errors.shiftType}
              hint={rosteredShift ? "Auto-filled from the employee's roster for the leave date" : undefined}
            >
              {rosteredShift ? (
                <Input value={rosteredShift} readOnly disabled />
              ) : (
                <Select value={form.shiftType} onChange={set("shiftType")} options={SHIFT_TYPES} placeholder="Select shift" />
              )}
            </Field>

            {/* Others: hide the predefined-duration behaviour; capture a custom
                leave name + explicit day count instead (req 2). */}
            {isOthers ? (
              <>
                <Field label="Leave Name" required error={errors.customLeaveName}>
                  <Input value={form.customLeaveName} onChange={set("customLeaveName")}
                    maxLength={100} placeholder="e.g. Marriage Leave" />
                </Field>
                <Field label="Number of Days" required error={errors.customDays}>
                  <Input type="number" min="0.5" step="0.5" value={form.customDays}
                    onChange={set("customDays")} placeholder="e.g. 1.5" />
                </Field>
              </>
            ) : (
              <>
                <Field label="Duration" required error={errors.dayType}>
                  <Select value={form.dayType} onChange={set("dayType")} options={DAY_TYPES} placeholder="Select duration" />
                </Field>
                <div />
              </>
            )}

            <DateField label="From Date" required value={form.fromDate} onChange={set("fromDate")} error={errors.fromDate} />
            <DateField label="To Date" required value={form.toDate} min={form.fromDate} onChange={set("toDate")} error={errors.toDate} />
          </div>
          {isOthers
            ? days != null && days > 0 && (
                <p className="text-sm muted" style={{ margin: "4px 0 0" }}>
                  This leave counts as <strong>{days}</strong> day(s). Others leaves do not affect any leave balance.
                </p>
              )
            : (
                <WorkingDaysNote calc={leaveCalc} noun="leave" error={errors.dateRange} />
              )}
        </FormSection>

        {/* Deduction Breakdown — how the days are funded (CL → Comp Off). Updates
            instantly with type / duration / dates. Hidden for Others. */}
        {deduction && (
          <FormSection title="Deduction Breakdown">
            <DeductionBreakdown days={days} deduction={deduction} clRemaining={clRem} compRemaining={compRem} />
          </FormSection>
        )}

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
