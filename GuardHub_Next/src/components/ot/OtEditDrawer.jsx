import { useEffect, useState } from "react";
import Drawer from "../ui/Drawer";
import Button from "../ui/Button";
import DateField from "../forms/DateField";
import { Field, Input, Select } from "../ui/Field";
import { useUpdateOt } from "../../hooks/useOts";
import { OT_SHIFTS, OT_DURATIONS, OT_STATUSES } from "../../utils/constants";
import { toYmd } from "../../utils/date";

// Edit an existing OT record in place. Editable: Current/Additional Shift,
// Duration, Location, From/To dates, Status. Reuses the same validation rules as
// Apply OT. Reason/remarks are left untouched (partial update). Employee fixed.
//
// props: { ot: record | null, onClose }
export default function OtEditDrawer({ ot, onClose }) {
  const open = !!ot;
  const update = useUpdateOt();
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (ot) {
      setForm({
        currentShift: ot.currentShift || "",
        additionalShift: ot.additionalShift || "",
        workingDuration: ot.workingDuration || "",
        location: ot.location || "",
        fromDate: toYmd(ot.fromDate),
        toDate: toYmd(ot.toDate),
        status: ot.status || "Pending",
      });
      setErrors({});
    }
  }, [ot]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.currentShift) errs.currentShift = "Required";
    if (!form.additionalShift) errs.additionalShift = "Required";
    if (!form.workingDuration) errs.workingDuration = "Required";
    if (!form.location.trim()) errs.location = "Enter the location.";
    if (!form.fromDate) errs.fromDate = "Required";
    if (!form.toDate) errs.toDate = "Required";
    else if (form.toDate < form.fromDate) errs.toDate = "To date must be after from date.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSave = async () => {
    if (!validate()) return;
    try {
      await update.mutateAsync({
        id: ot._id,
        payload: {
          currentShift: form.currentShift,
          additionalShift: form.additionalShift,
          workingDuration: form.workingDuration,
          location: form.location.trim(),
          fromDate: form.fromDate,
          toDate: form.toDate,
          status: form.status,
        },
      });
      onClose();
    } catch { /* toast in hook */ }
  };

  return (
    <Drawer
      open={open}
      title="Edit OT"
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={update.isPending} onClick={onSave}>Save changes</Button>
        </>
      }
    >
      {ot && (
        <>
          <div className="text-sm muted" style={{ marginBottom: 12 }}>
            {ot.employeeName || `Employee ID ${ot.employeeId}`}
          </div>
          <div className="field-grid-2">
            <Field label="Current Shift" required error={errors.currentShift}>
              <Select value={form.currentShift} onChange={set("currentShift")} options={OT_SHIFTS} placeholder="Select shift" />
            </Field>
            <Field label="Additional Shift" required error={errors.additionalShift}>
              <Select value={form.additionalShift} onChange={set("additionalShift")} options={OT_SHIFTS} placeholder="Select shift" />
            </Field>
            <Field label="Duration" required error={errors.workingDuration}>
              <Select value={form.workingDuration} onChange={set("workingDuration")} options={OT_DURATIONS} placeholder="Select duration" />
            </Field>
            <Field label="Status" required error={errors.status}>
              <Select value={form.status} onChange={set("status")} options={OT_STATUSES} placeholder="Select status" />
            </Field>
            <DateField label="From Date" required value={form.fromDate} onChange={set("fromDate")} error={errors.fromDate} />
            <DateField label="To Date" required value={form.toDate} min={form.fromDate} onChange={set("toDate")} error={errors.toDate} />
          </div>
          <Field label="Location" required error={errors.location}>
            <Input value={form.location} onChange={set("location")} maxLength={120} placeholder="e.g. Main Gate" />
          </Field>
        </>
      )}
    </Drawer>
  );
}
