import { useEffect, useState } from "react";
import Drawer from "../ui/Drawer";
import Button from "../ui/Button";
import { Field, Input } from "../ui/Field";
import MasterSelect from "../ui/MasterSelect";
import Avatar from "../ui/Avatar";
import { toast } from "../../store/toastStore";
import { useAddEmployee, useUpdateEmployee } from "../../hooks/useEmployees";
import { toYmd } from "../../utils/date";
import { DESIGNATIONS, DEPARTMENTS } from "../../utils/constants";

// Add/Edit employee in a slide-over drawer. Only empId + empName are required
// (matches the backend schema). Image upload is optional; the field MUST be
// named empImage and empId must be set for the backend to name the file.
const EMPTY = {
  empId: "",
  empName: "",
  empDesignation: "",
  empDepartment: "",
  empMobileNo: "",
  empDob: "",
  empDoj: "",
  empAadharNo: "",
  empPanNo: "",
  bankAccountNo: "",
  epfNo: "",
  esiNo: "",
  address: "",
  emergencyContactName: "",
  emergencyContactNumber: "",
  emergencyContactRelation: "",
};

export default function EmployeeFormDrawer({ open, employee, onClose }) {
  const isEdit = !!employee;
  const [form, setForm] = useState(EMPTY);
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState({});

  const add = useAddEmployee();
  const update = useUpdateEmployee();
  const saving = add.isPending || update.isPending;

  useEffect(() => {
    if (open) {
      setForm(
        employee
          ? {
              ...EMPTY,
              ...Object.fromEntries(
                Object.keys(EMPTY).map((k) => [k, employee[k] ?? ""])
              ),
              empDob: employee.empDob ? toYmd(employee.empDob) : "",
            }
          : EMPTY
      );
      setImageFile(null);
      setPreview(null);
      setErrors({});
    }
  }, [open, employee]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  // For controls that emit a raw value (MasterSelect) rather than an event.
  const setValue = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const onImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const validate = () => {
    const errs = {};
    if (!String(form.empId).trim()) errs.empId = "Employee ID is required.";
    if (!form.empName.trim()) errs.empName = "Employee name is required.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    // Strip empty strings so we never overwrite stored values with blanks.
    const values = Object.fromEntries(
      Object.entries(form).filter(([, v]) => v !== "" && v != null)
    );
    try {
      if (isEdit) {
        await update.mutateAsync({ empId: employee.empId, values, imageFile });
      } else {
        await add.mutateAsync({ values, imageFile });
      }
      onClose();
    } catch {
      // toast handled in hook
    }
  };

  const previewEmp = preview ? { empImage: null } : employee;

  return (
    <Drawer
      open={open}
      title={isEdit ? `Edit Employee · ${employee?.empName}` : "Add Employee"}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={saving}>
            {isEdit ? "Save Changes" : "Add Employee"}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit}>
        <div className="row mb-4" style={{ gap: 16 }}>
          {preview ? (
            <img className="avatar avatar--lg" src={preview} alt="preview" />
          ) : (
            <Avatar emp={previewEmp} size="lg" />
          )}
          <div className="grow">
            <label className="field__label">Employee Photo</label>
            <input type="file" accept="image/jpeg,image/jpg,image/png" onChange={onImage} />
            <div className="text-sm muted mt-2">JPG / PNG, max 1 MB.</div>
          </div>
        </div>

        <div className="form-grid">
          <Field label="Employee ID" required error={errors.empId}>
            <Input value={form.empId} onChange={set("empId")} disabled={isEdit} type="number" />
          </Field>
          <Field label="Employee Name" required error={errors.empName}>
            <Input value={form.empName} onChange={set("empName")} />
          </Field>
          <Field label="Designation" hint="Pick from the list, or choose Other to type a custom value">
            <MasterSelect
              id="emp-designation"
              value={form.empDesignation}
              onChange={setValue("empDesignation")}
              options={DESIGNATIONS}
              placeholder="Select designation"
            />
          </Field>
          <Field label="Department" hint="Pick from the list, or choose Other to type a custom value">
            <MasterSelect
              id="emp-department"
              value={form.empDepartment}
              onChange={setValue("empDepartment")}
              options={DEPARTMENTS}
              placeholder="Select department"
            />
          </Field>
          <Field label="Mobile No">
            <Input value={form.empMobileNo} onChange={set("empMobileNo")} type="number" />
          </Field>
          <Field label="Date of Birth">
            <Input value={form.empDob} onChange={set("empDob")} type="date" />
          </Field>
          <Field label="Date of Joining">
            <Input value={form.empDoj} onChange={set("empDoj")} placeholder="e.g. 2024-01-15" />
          </Field>
          <Field label="Aadhar No">
            <Input value={form.empAadharNo} onChange={set("empAadharNo")} type="number" />
          </Field>
          <Field label="PAN No">
            <Input value={form.empPanNo} onChange={set("empPanNo")} />
          </Field>
          <Field label="Bank Account No">
            <Input value={form.bankAccountNo} onChange={set("bankAccountNo")} type="number" />
          </Field>
          <Field label="EPF No">
            <Input value={form.epfNo} onChange={set("epfNo")} />
          </Field>
          <Field label="ESI No">
            <Input value={form.esiNo} onChange={set("esiNo")} />
          </Field>
        </div>

        <Field label="Address">
          <Input value={form.address} onChange={set("address")} />
        </Field>

        <h4 className="card__title mt-4 mb-4">Emergency Contact</h4>
        <div className="form-grid">
          <Field label="Contact Name">
            <Input value={form.emergencyContactName} onChange={set("emergencyContactName")} />
          </Field>
          <Field label="Contact Number">
            <Input value={form.emergencyContactNumber} onChange={set("emergencyContactNumber")} />
          </Field>
          <Field label="Relation">
            <Input value={form.emergencyContactRelation} onChange={set("emergencyContactRelation")} />
          </Field>
        </div>
      </form>
    </Drawer>
  );
}
