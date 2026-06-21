import Button from "./Button";

// Small centered confirm modal — used for destructive actions (delete).
export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  danger = true,
  loading,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;
  return (
    <div className="overlay overlay--center" onMouseDown={onCancel}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__body">
          <h3 className="drawer__title mb-4">{title}</h3>
          <p className="muted" style={{ margin: 0 }}>{message}</p>
        </div>
        <div className="modal__footer">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
