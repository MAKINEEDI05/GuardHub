import { API_BASE_URL } from "../api/client";
import { ENDPOINTS } from "../api/endpoints";

// Employee photo URL builder. The backend stores the EXACT uploaded filename
// (e.g. "5297.JPG" or "1402.jpg") in `empImage`, with mixed extension casing in
// production data — so always build from empImage, never guess the extension.
// 0000.jpg is the guaranteed fallback that exists in the backend uploads dir.
export const FALLBACK_EMP_IMAGE = `${API_BASE_URL}${ENDPOINTS.empImageBase}/0000.jpg`;

export function getEmpImageUrl(emp) {
  if (!emp) return FALLBACK_EMP_IMAGE;
  // Cache-buster: when a photo is replaced with the SAME filename (e.g. a new
  // 123.jpg over the old 123.jpg) the URL is unchanged, so the browser would
  // keep showing the cached old image. Appending the record's updatedAt forces
  // a refetch whenever the employee is updated.
  const ver = emp.updatedAt ? `?v=${encodeURIComponent(emp.updatedAt)}` : "";
  const file = emp.empImage || emp.image;
  if (file && typeof file === "string") {
    const trimmed = file.trim();
    if (trimmed && trimmed !== "N/A") {
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      return `${API_BASE_URL}${ENDPOINTS.empImageBase}/${trimmed}${ver}`;
    }
  }
  // Legacy records may have no empImage but a matching <empId>.jpg on disk.
  if (emp.empId !== undefined && emp.empId !== null && emp.empId !== "") {
    return `${API_BASE_URL}${ENDPOINTS.empImageBase}/${emp.empId}.jpg${ver}`;
  }
  return FALLBACK_EMP_IMAGE;
}

// onError handler that swaps to the fallback exactly once — clearing onerror
// first prevents the infinite flicker/reload loop when the fallback also 404s.
export function handleEmpImageError(e, fallback = FALLBACK_EMP_IMAGE) {
  if (e?.target) {
    e.target.onerror = null;
    if (e.target.src !== fallback) e.target.src = fallback;
  }
}
