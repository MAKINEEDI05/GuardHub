import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Avatar from "./ui/Avatar";

// Wraps a row avatar and shows a floating preview card on hover — so a
// supervisor can identify a guard by face without opening the View modal.
//
// Implementation notes:
// - The card is rendered to document.body via a portal and positioned with
//   `position: fixed` from the avatar's bounding rect, so it floats ABOVE the
//   table and is never clipped by the horizontal scroll container.
// - It is only mounted while hovering (one card at a time), and the large image
//   loads on demand — nothing is preloaded, so scrolling 100–200 rows stays fast.
// - The card is pointer-events:none and hides on mouse-leave / scroll, so it
//   never affects row height or table layout.
const CARD_W = 220;
const CARD_H = 268;

export default function EmployeePhotoHover({
  emp,
  px = 64,
  name,
  empId,
  designation,
  department,
}) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  const show = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Prefer the right of the image; flip left if there isn't room.
    const left =
      window.innerWidth - r.right > CARD_W + 24
        ? r.right + 12
        : Math.max(12, r.left - CARD_W - 12);
    const top = Math.max(
      12,
      Math.min(r.top + r.height / 2 - CARD_H / 2, window.innerHeight - CARD_H - 12)
    );
    setPos({ left, top });
  };

  const hide = () => setPos(null);

  // Any scroll detaches the fixed card from the moving avatar — just hide it.
  useEffect(() => {
    if (!pos) return undefined;
    const onScroll = () => hide();
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [pos]);

  return (
    <span
      ref={ref}
      className="emp-hover"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <Avatar emp={emp} px={px} alt={name} className="emp-hover__thumb" />
      {pos &&
        createPortal(
          <div className="emp-hover-card" style={{ left: pos.left, top: pos.top }}>
            <Avatar emp={emp} px={170} alt={name} />
            <div className="emp-hover-card__name">{name || "—"}</div>
            <div className="emp-hover-card__meta">ID: {empId ?? "—"}</div>
            <div className="emp-hover-card__meta">
              Designation: {designation || "—"}
            </div>
            <div className="emp-hover-card__meta">
              Department: {department || "—"}
            </div>
          </div>,
          document.body
        )}
    </span>
  );
}
