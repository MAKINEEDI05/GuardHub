// Lightweight theme controller for the Guards Hub design system.
// Toggles [data-theme] on <html> and persists the choice. No external deps,
// no redux coupling — safe to mount anywhere.
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "guardshub-theme";
export const THEMES = { LIGHT: "light", DARK: "dark" };

export function getStoredTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === THEMES.LIGHT || saved === THEMES.DARK) return saved;
  } catch (e) {
    /* localStorage unavailable */
  }
  return THEMES.LIGHT; // light is the primary/enterprise default
}

export function applyTheme(theme) {
  const t = theme === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
  document.documentElement.setAttribute("data-theme", t);
  try {
    localStorage.setItem(STORAGE_KEY, t);
  } catch (e) {
    /* ignore */
  }
  return t;
}

// React hook: returns [theme, toggleTheme, setTheme].
export function useTheme() {
  const [theme, setThemeState] = useState(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((t) => setThemeState(t), []);
  const toggleTheme = useCallback(
    () => setThemeState((t) => (t === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK)),
    []
  );

  return [theme, toggleTheme, setTheme];
}
