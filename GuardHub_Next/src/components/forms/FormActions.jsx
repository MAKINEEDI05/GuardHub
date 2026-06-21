import Button from "../ui/Button";

// Consistent bottom-right action bar: Cancel · Reset · Submit. Shared by all
// three Apply workflows so the submit area looks the same everywhere.
export default function FormActions({
  onCancel,
  onReset,
  submitLabel = "Submit",
  loading,
  disabled,
}) {
  return (
    <div className="form-actions">
      {onCancel && (
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
      )}
      {onReset && (
        <Button type="button" variant="ghost" onClick={onReset} disabled={loading}>
          Reset
        </Button>
      )}
      <Button type="submit" loading={loading} disabled={disabled}>
        {submitLabel}
      </Button>
    </div>
  );
}
