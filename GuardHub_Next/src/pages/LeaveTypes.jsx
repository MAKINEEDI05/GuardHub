import { useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import DataTable from "../components/ui/DataTable";
import Badge from "../components/ui/Badge";
import Icon from "../components/ui/Icon";
import Drawer from "../components/ui/Drawer";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { Field, Input, Textarea, Select } from "../components/ui/Field";
import { useLeaveTypes, useSaveLeaveType, useDeleteLeaveType } from "../hooks/useLeaveV2";

const INIT = { code: "", name: "", defaultAnnualQuota: 0, isPaid: "true", sortOrder: 0, description: "" };

// Leave Types master — the configurable categories that everything else keys
// off. Adding a type here is all that's needed to make it available in Apply
// Leave and Allocation; no code change (the requirement).
export default function LeaveTypes() {
  const { data: types = [], isLoading } = useLeaveTypes(false);
  const save = useSaveLeaveType();
  const del = useDeleteLeaveType();

  const [editing, setEditing] = useState(null); // null | {} (new) | type (edit)
  const [form, setForm] = useState(INIT);
  const [errors, setErrors] = useState({});
  const [confirm, setConfirm] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openNew = () => { setForm(INIT); setErrors({}); setEditing({}); };
  const openEdit = (t) => {
    setForm({
      code: t.code, name: t.name, defaultAnnualQuota: t.defaultAnnualQuota ?? 0,
      isPaid: t.isPaid ? "true" : "false", sortOrder: t.sortOrder ?? 0,
      description: t.description || "",
    });
    setErrors({});
    setEditing(t);
  };

  const validate = () => {
    const e = {};
    if (!form.code.trim()) e.code = "Required";
    if (!form.name.trim()) e.name = "Required";
    if (Number(form.defaultAnnualQuota) < 0) e.defaultAnnualQuota = "Must be ≥ 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSave = async () => {
    if (!validate()) return;
    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      defaultAnnualQuota: Number(form.defaultAnnualQuota) || 0,
      isPaid: form.isPaid === "true",
      sortOrder: Number(form.sortOrder) || 0,
      description: form.description.trim(),
    };
    try {
      await save.mutateAsync({ id: editing?._id, payload });
      setEditing(null);
    } catch { /* toast in hook */ }
  };

  const columns = [
    { key: "code", header: "Code", sortable: true, render: (t) => <strong>{t.code}</strong> },
    { key: "name", header: "Name", sortable: true },
    { key: "defaultAnnualQuota", header: "Default Quota", className: "num", render: (t) => t.defaultAnnualQuota ?? 0 },
    { key: "isPaid", header: "Pay", render: (t) => <Badge status={t.isPaid ? "present" : "absent"}>{t.isPaid ? "Paid" : "Unpaid (LOP)"}</Badge> },
    { key: "active", header: "Status", render: (t) => <Badge status={t.active ? "present" : "neutral"}>{t.active ? "Active" : "Inactive"}</Badge> },
    {
      key: "_actions", header: "", className: "num",
      render: (t) => (
        <div style={{ display: "inline-flex", gap: 4 }}>
          <button className="btn btn--ghost btn--icon" title="Edit" aria-label="Edit leave type" onClick={() => openEdit(t)}>
            <Icon name="edit" size={16} />
          </button>
          {t.active && (
            <button className="btn btn--ghost btn--icon" title="Deactivate" aria-label="Deactivate leave type" onClick={() => setConfirm(t)}>
              <Icon name="trash" size={16} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Leave Types"
        subtitle="Configurable leave categories used across allocation, apply and reports"
        actions={<Button variant="primary" onClick={openNew}><Icon name="plus" size={16} /> New Type</Button>}
      />

      <DataTable columns={columns} rows={types} loading={isLoading} pageSize={15} emptyTitle="No leave types" emptyIcon="🗂️" rowKey={(t) => t._id} />

      <Drawer
        open={!!editing}
        title={editing?._id ? "Edit Leave Type" : "New Leave Type"}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="primary" loading={save.isPending} onClick={onSave}>Save</Button>
          </>
        }
      >
        <Field label="Code" required error={errors.code} hint={editing?._id ? "Code is fixed once created." : "Short key, e.g. CL"}>
          <Input value={form.code} onChange={set("code")} disabled={!!editing?._id} placeholder="CL" style={{ textTransform: "uppercase" }} />
        </Field>
        <Field label="Name" required error={errors.name}>
          <Input value={form.name} onChange={set("name")} placeholder="Casual Leave" />
        </Field>
        <div className="field-grid-2">
          <Field label="Default Annual Quota" error={errors.defaultAnnualQuota} hint="Days granted when a yearly allocation runs">
            <Input type="number" min="0" value={form.defaultAnnualQuota} onChange={set("defaultAnnualQuota")} />
          </Field>
          <Field label="Pay Treatment" hint="Unpaid = LOP for future salary">
            <Select value={form.isPaid} onChange={set("isPaid")} options={[{ value: "true", label: "Paid" }, { value: "false", label: "Unpaid (LOP)" }]} />
          </Field>
        </div>
        <Field label="Sort Order" hint="Lower shows first">
          <Input type="number" value={form.sortOrder} onChange={set("sortOrder")} />
        </Field>
        <Field label="Description">
          <Textarea rows={2} value={form.description} onChange={set("description")} />
        </Field>
      </Drawer>

      <ConfirmDialog
        open={!!confirm}
        title="Deactivate leave type?"
        message={confirm ? `"${confirm.name}" will be hidden from new leave entries. Existing records are kept.` : ""}
        confirmLabel="Deactivate"
        loading={del.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => { await del.mutateAsync(confirm._id); setConfirm(null); }}
      />
    </>
  );
}
