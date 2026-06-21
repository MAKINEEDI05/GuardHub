import { getEmpImageUrl, handleEmpImageError } from "../../utils/empImage";

// Employee avatar. Always routes through the image helper so broken/missing
// photos fall back cleanly without flicker loops. Pass `px` for a custom pixel
// size (overrides the named size class).
export default function Avatar({ emp, size = "md", px, alt, className = "" }) {
  return (
    <img
      className={`avatar avatar--${size} ${className}`}
      style={px ? { width: px, height: px } : undefined}
      src={getEmpImageUrl(emp)}
      onError={handleEmpImageError}
      alt={alt || emp?.empName || "employee"}
      loading="lazy"
    />
  );
}
