import { Field, Input } from "../ui/Field";

// Reusable labelled date input used across all Apply forms. Keeps date markup
// (and min/required wiring) consistent and DRY.
export default function DateField({ label, value, onChange, min, max, required, error }) {
  return (
    <Field label={label} required={required} error={error}>
      <Input type="date" value={value} min={min} max={max} onChange={onChange} />
    </Field>
  );
}
