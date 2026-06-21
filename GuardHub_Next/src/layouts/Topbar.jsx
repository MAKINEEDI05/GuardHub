import { useLocation } from "react-router-dom";
import { useUiStore } from "../store/uiStore";
import { useAuthStore } from "../store/authStore";
import Icon from "../components/ui/Icon";

// Page title derived from the route — keeps the topbar in sync without each
// page having to set it.
const TITLES = [
  [/^\/dashboard/, "Dashboard"],
  [/^\/employees/, "Employee Management"],
  [/^\/roster/, "Security Roster"],
  [/^\/reports\/day/, "Day Wise Report"],
  [/^\/reports\/month/, "Month Wise Report"],
  [/^\/leaves/, "Leave Records"],
  [/^\/od/, "OD Records"],
  [/^\/ot/, "OT Records"],
  [/^\/apply\/leave/, "Apply Leave"],
  [/^\/apply\/od/, "Apply OD"],
  [/^\/apply\/ot/, "Apply OT"],
];

function titleFor(path) {
  const found = TITLES.find(([re]) => re.test(path));
  return found ? found[1] : "GuardHub";
}

export default function Topbar() {
  const { pathname } = useLocation();
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const toggleCollapsed = useUiStore((s) => s.toggleCollapsed);
  const setMobileOpen = useUiStore((s) => s.setMobileOpen);
  const mobileOpen = useUiStore((s) => s.mobileOpen);
  const user = useAuthStore((s) => s.user);

  const name = user?.userName || user?.email || "Admin";
  const initials = String(name).slice(0, 2).toUpperCase();

  return (
    <header className="topbar">
      <button
        className="topbar__icon-btn hamburger"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        <Icon name="menu" />
      </button>
      <button
        className="topbar__icon-btn hide-mobile"
        onClick={toggleCollapsed}
        aria-label="Collapse sidebar"
        style={{ display: "" }}
      >
        <Icon name="menu" />
      </button>

      <h1 className="topbar__title">{titleFor(pathname)}</h1>
      <div className="topbar__spacer" />

      <button className="topbar__icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
        <Icon name={theme === "dark" ? "sun" : "moon"} />
      </button>

      <div className="topbar__user">
        <span className="topbar__avatar">{initials}</span>
        <span className="hide-mobile">{name}</span>
      </div>
    </header>
  );
}
