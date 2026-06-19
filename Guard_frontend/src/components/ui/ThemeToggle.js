import React from "react";
import PropTypes from "prop-types";
import { useTheme, THEMES } from "helpers/theme";

// Self-contained floating light/dark toggle. Rendered once (App) so it works on
// every page without modifying the template header.
const ThemeToggle = ({ floating = true }) => {
  const [theme, toggleTheme] = useTheme();
  const isDark = theme === THEMES.DARK;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={`gh-theme-toggle${floating ? " gh-theme-toggle--floating" : ""}`}
    >
      <i className={isDark ? "mdi mdi-weather-sunny" : "mdi mdi-weather-night"} />
    </button>
  );
};

ThemeToggle.propTypes = {
  floating: PropTypes.bool,
};

export default ThemeToggle;
