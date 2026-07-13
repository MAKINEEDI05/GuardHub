import { useEffect, useState } from "react";
import Drawer from "../ui/Drawer";
import Button from "../ui/Button";
import DateField from "../forms/DateField";
import { Field, Input, Select, Textarea } from "../ui/Field";
import { useUpdateOd } from "../../hooks/useOds";
import { SHIFT_TYPES, DAY_TYPES } from "../../utils/constants";
import { toYmd } from "../../utils/date";

// Edit an existing OD record in place (no new record). Editable: Location,
// Shift, Duration, From/To dates, Purpose. Reuses the same validation rules as
// Apply OD. The employee is fixed.
//
// props: { od: record | null, onClose }
export default function OdEditDrawer({ od, onClose }) {
  const open = !!od;
  const update = useUpdateOd();
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (od) {
      setForm({
        odLocation: od.odLocation || "",
        empShiftType: od.empShiftType || "",
        empOdType: od.empOdType || "",
        empFromDate: toYmd(od.empFromDate),
        empToDate: toYmd(od.empToDate),
        empPurpose: od.empPurpose || "",
      });
      setErrors({});
    }
  }, [od]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.empShiftType) errs.empShiftType = "Required";
    if (!form.empOdType) errs.empOdType = "Required";
    if (!form.empFromDate) errs.empFromDate = "Required";
    if (!form.empToDate) errs.empToDate = "Required";
    else if (form.empToDate < form.empFromDate) errs.empToDate = "To date must be after from date.";
    if (!form.odLocation.trim()) errs.odLocation = "Enter the OD location.";
    if (!form.empPurpose.trim() || form.empPurpose.trim().length < 5) errs.empPurpose = "Enter a purpose (min 5 chars).";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSave = async () => {
    if (!validate()) return;
    try {
      await update.mutateAsync({
        id: od._id,
        payload: {
          odLocation: form.odLocation.trim(),
          empShiftType: form.empShiftType,
          empOdType: form.empOdType,
          empFromDate: form.empFromDate,
          empToDate: form.empToDate,
          empPurpose: form.empPurpose.trim(),
        },
      });
      onClose();
    } catch { /* toast in hook */ }
  };

  return (
    <Drawer
      open={open}
      title="Edit OD"
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={update.isPending} onClick={onSave}>Save changes</Button>
        </>
      }
    >
      {od && (
        <>
          <div className="text-sm muted" style={{ marginBottom: 12 }}>
            Employee ID {od.empId}
          </div>
          <Field label="OD Location" required error={errors.odLocation}>
            <Input value={form.odLocation} onChange={set("odLocation")} maxLength={120} placeholder="e.g. Main Gate, Admin Building" />
          </Field>
          <div className="field-grid-2">
            <Field label="Shift" required error={errors.empShiftType}>
              <Select value={form.empShiftType} onChange={set("empShiftType")} options={SHIFT_TYPES} placeholder="Select shift" />
            </Field>
            <Field label="Duration" required error={errors.empOdType}>
              <Select value={form.empOdType} onChange={set("empOdType")} options={DAY_TYPES} placeholder="Select duration" />
            </Field>
            <DateField label="From Date" required value={form.empFromDate} onChange={set("empFromDate")} error={errors.empFromDate} />
            <DateField label="To Date" required value={form.empToDate} min={form.empFromDate} onChange={set("empToDate")} error={errors.empToDate} />
          </div>
          <Field label="Purpose" required error={errors.empPurpose}>
            <Textarea rows={3} maxLength={225} value={form.empPurpose} onChange={set("empPurpose")} placeholder="Purpose of the on-duty assignment" />
          </Field>
        </>
      )}
    </Drawer>
  );
}
