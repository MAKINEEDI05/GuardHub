// Centralised employee-image URL helpers.
//
// Why this exists: the backend stores the *exact* uploaded filename in the
// `empImage` field (e.g. "5297.JPG" or "1402.jpg") and serves it statically at
// `/emp/uploads/<filename>`. The pages used to guess the extension
// (`<empId>.JPG` -> `.jpg` -> `.png`), which produced 404s, broken-image
// flicker and, on re-render, infinite onError loops. Resolving straight from
// `empImage` fixes loading; resetting `onerror` in the error handler stops the
// flicker loop.

const API_BASE = process.env.REACT_APP_API_BASE_URL || "";

// Default avatar that is guaranteed to exist in the backend uploads folder.
export const FALLBACK_EMP_IMAGE = `${API_BASE}/emp/uploads/0000.jpg`;

// Build a stable, correct image URL for an employee/roster/attendance record.
// Accepts any object that may carry `empImage` (preferred) and/or `empId`.
export function getEmpImageUrl(emp) {
  if (!emp) return FALLBACK_EMP_IMAGE;

  const file = emp.empImage || emp.image;
  if (file && typeof file === "string") {
    const trimmed = file.trim();
    if (trimmed && trimmed !== "N/A") {
      // Already an absolute URL (e.g. backend returned a full path).
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      return `${API_BASE}/emp/uploads/${trimmed}`;
    }
  }

  // Legacy fallback: records created before empImage was populated relied on
  // the "<empId>.jpg" convention.
  if (emp.empId !== undefined && emp.empId !== null && emp.empId !== "") {
    return `${API_BASE}/emp/uploads/${emp.empId}.jpg`;
  }

  return FALLBACK_EMP_IMAGE;
}

// onError handler that loads the fallback avatar exactly once. Clearing
// `onerror` is the critical bit: it prevents the handler from firing again if
// the fallback itself errors, which is what caused the continuous reload /
// flicker / layout shake.
export function handleEmpImageError(e, fallback = FALLBACK_EMP_IMAGE) {
  if (e && e.target) {
    e.target.onerror = null;
    if (e.target.src !== fallback) {
      e.target.src = fallback;
    }
  }
}
