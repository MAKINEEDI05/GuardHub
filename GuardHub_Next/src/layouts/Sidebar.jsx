import { NavLink } from "react-router-dom";
import { NAV_SECTIONS } from "./navItems";
import { useUiStore } from "../store/uiStore";
import { useAuthStore } from "../store/authStore";
import Icon from "../components/ui/Icon";

export default function Sidebar() {
  const collapsed = useUiStore((s) => s.collapsed);
  const mobileOpen = useUiStore((s) => s.mobileOpen);
  const setMobileOpen = useUiStore((s) => s.setMobileOpen);
  const logout = useAuthStore((s) => s.logout);

  const cls = [
    "sidebar",
    collapsed ? "is-collapsed" : "",
    mobileOpen ? "is-mobile-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside className={cls}>
      <div className="sidebar__brand">
        <img src="/shield.svg" alt="" />
        {!collapsed && <span>GuardHub</span>}
      </div>

      <nav className="sidebar__nav">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <div className="sidebar__section">{section.title}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `nav-item ${isActive ? "is-active" : ""}`
                }
                onClick={() => setMobileOpen(false)}
                title={item.label}
              >
                <span className="nav-item__icon">
                  <Icon name={item.icon} size={18} />
                </span>
                <span className="nav-item__label">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar__footer">
        <button className="nav-item" style={{ width: "100%", border: "none", cursor: "pointer", background: "transparent" }} onClick={logout}>
          <span className="nav-item__icon"><Icon name="logout" size={18} /></span>
          <span className="nav-item__label">Logout</span>
        </button>
      </div>
    </aside>
  );
}
