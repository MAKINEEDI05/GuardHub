import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useUiStore } from "../store/uiStore";
import { Spinner } from "../components/ui/States";

// Authenticated app shell: fixed sidebar + sticky topbar + scrolling content.
export default function AppLayout() {
  const collapsed = useUiStore((s) => s.collapsed);
  const mobileOpen = useUiStore((s) => s.mobileOpen);
  const setMobileOpen = useUiStore((s) => s.setMobileOpen);

  return (
    <div className="app-shell">
      <Sidebar />
      {mobileOpen && (
        <div
          className="overlay"
          style={{ background: "rgba(13,35,56,0.4)", zIndex: 35 }}
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div className={`app-main ${collapsed ? "is-collapsed" : ""}`}>
        <Topbar />
        <main className="app-content">
          <Suspense
            fallback={
              <div className="center-screen" style={{ minHeight: "50vh" }}>
                <Spinner dark />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
