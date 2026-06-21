import { useEffect } from "react";

// Slide-over panel used for add/edit forms (preferred over big modals).
export default function Drawer({ open, title, onClose, children, footer, width }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div
        className="drawer"
        style={width ? { width } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="drawer__header">
          <h3 className="drawer__title">{title}</h3>
          <button className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="drawer__body">{children}</div>
        {footer && <div className="drawer__footer">{footer}</div>}
      </div>
    </div>
  );
}
