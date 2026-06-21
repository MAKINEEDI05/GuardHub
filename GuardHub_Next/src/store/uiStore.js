import { create } from "zustand";

const THEME_KEY = "guardhub.theme";
const SIDEBAR_KEY = "guardhub.sidebar";

function initialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark" || saved === "light") return saved;
  return "light";
}

// Apply theme to <html data-theme> so tokens.css can switch variables.
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}
applyTheme(initialTheme());

export const useUiStore = create((set, get) => ({
  theme: initialTheme(),
  // Desktop sidebar collapse (icon-only). Persisted.
  collapsed: localStorage.getItem(SIDEBAR_KEY) === "1",
  // Mobile slide-in sidebar open state (not persisted).
  mobileOpen: false,

  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
    set({ theme: next });
  },

  toggleCollapsed: () => {
    const next = !get().collapsed;
    localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
    set({ collapsed: next });
  },

  setMobileOpen: (open) => set({ mobileOpen: open }),
}));
