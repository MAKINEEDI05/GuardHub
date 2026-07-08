import { useEffect, useState } from "react";
import Drawer from "../ui/Drawer";
import Button from "../ui/Button";
import DateField from "../forms/DateField";
import { Field, Select, Textarea } from "../ui/Field";
import { useLeaveTypes, useUpdateLeaveTxn } from "../../hooks/useLeaveV2";
import { SHIFT_TYPES, DAY_TYPES } from "../../utils/constants";
import { toYmd } from "../../utils/date";

// Edit a finalized leave transaction (single-admin, no approval). Editable:
// Leave Type, Shift, From/To dates, Duration, Reason. Reuses the same validation
// rules as Apply Leave. The employee is fixed.
//
// props: { txn: transaction | null, onClose }
export default function LeaveEditDrawer({ txn, onClose }) {
  const open = !!txn;
  const { data: types = [] } = useLeaveTypes(true);
  const update = useUpdateLeaveTxn();
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (txn) {
      setForm({
        leaveTypeCode: txn.leaveTypeCode || "",
        shiftType: txn.shiftType || "General",
        dayType: txn.dayType || "FULL DAY",
        fromDate: toYmd(txn.fromDate),
        toDate: toYmd(txn.toDate),
        reason: txn.reason || "",
      });
      setErrors({});
    }
  }, [txn]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.leaveTypeCode) errs.leaveTypeCode = "Required";
    if (!form.shiftType) errs.shiftType = "Required";
    if (!form.dayType) errs.dayType = "Required";
    if (!form.fromDate) errs.fromDate = "Required";
    if (!form.toDate) errs.toDate = "Required";
    else if (form.toDate < form.fromDate) errs.toDate = "To date must be on/after from date.";
    if (!form.reason || form.reason.trim().length < 5) errs.reason = "Enter a reason (min 5 chars).";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSave = async () => {
    if (!validate()) return;
    try {
      await update.mutateAsync({
        id: txn._id,
        payload: {
          leaveTypeCode: form.leaveTypeCode,
          shiftType: form.shiftType,
          dayType: form.dayType,
          fromDate: form.fromDate,
          toDate: form.toDate,
          reason: form.reason.trim(),
        },
      });
      onClose();
    } catch { /* toast in hook */ }
  };

  return (
    <Drawer
      open={open}
      title="Edit Leave"
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={update.isPending} onClick={onSave}>Save changes</Button>
        </>
      }
    >
      {txn && (
        <>
          <div className="text-sm muted" style={{ marginBottom: 12 }}>
            {txn.leaveTypeName} · Employee ID {txn.empId}
          </div>
          <div className="field-grid-2">
            <Field label="Leave Type" required error={errors.leaveTypeCode}>
              <Select value={form.leaveTypeCode} onChange={set("leaveTypeCode")} placeholder="Select type"
                options={types.map((t) => ({ value: t.code, label: `${t.name}${t.isPaid ? "" : " (LOP)"}` }))} />
            </Field>
            <Field label="Shift" required error={errors.shiftType}>
              <Select value={form.shiftType} onChange={set("shiftType")} options={SHIFT_TYPES} placeholder="Select shift" />
            </Field>
            <Field label="Duration" required error={errors.dayType}>
              <Select value={form.dayType} onChange={set("dayType")} options={DAY_TYPES} placeholder="Select duration" />
            </Field>
            <div />
            <DateField label="From Date" required value={form.fromDate} onChange={set("fromDate")} error={errors.fromDate} />
            <DateField label="To Date" required value={form.toDate} min={form.fromDate} onChange={set("toDate")} error={errors.toDate} />
          </div>
          <Field label="Reason" required error={errors.reason}>
            <Textarea rows={3} maxLength={225} value={form.reason} onChange={set("reason")} placeholder="Reason for leave" />
          </Field>
        </>
      )}
    </Drawer>
  );
}
