// Single source of truth for the company logo (sidebar header + login screen).
// Loads from the frontend public/ folder so it ships with the build and works
// on Vercel; override with VITE_LOGO_URL to host it elsewhere. Falls back to the
// original shield icon (once, no reload loop) with a console warning if missing.
const LOGO_URL = import.meta.env.VITE_LOGO_URL || "/auslogo.png";
const FALLBACK_LOGO = "/shield.svg";

export default function BrandLogo({ className = "", alt = "GuardHub logo", style }) {
  return (
    <img
      className={className}
      src={LOGO_URL}
      alt={alt}
      style={style}
      onError={(e) => {
        const img = e.currentTarget;
        if (img.dataset.fallback) return;
        img.dataset.fallback = "1";
        img.onerror = null;
        img.src = FALLBACK_LOGO;
        console.warn("Logo not found. Falling back to default icon.");
      }}
    />
  );
}
