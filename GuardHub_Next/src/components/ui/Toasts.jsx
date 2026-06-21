import { useToastStore } from "../../store/toastStore";

// Global toast outlet — mounted once at the app root.
export default function Toasts() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.type}`} onClick={() => dismiss(t.id)}>
          <span className="grow">{t.message}</span>
          <span style={{ opacity: 0.8 }}>✕</span>
        </div>
      ))}
    </div>
  );
}
