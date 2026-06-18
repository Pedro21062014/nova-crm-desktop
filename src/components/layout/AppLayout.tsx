import { Outlet } from "react-router-dom";
import { useState, useRef } from "react";
import { Sidebar } from "./Sidebar";
import { OfflineBanner } from "./OfflineBanner";
import { UpdateBanner } from "./UpdateBanner";

export function AppLayout() {
  // Persisted collapsed state (user clicks the chevron to pin/unpin)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem("nova-crm-sidebar-collapsed") === "true";
  });

  // Transient hover-expanded state — only active when collapsed.
  // When the user hovers near the left edge OR over the sidebar itself,
  // we temporarily expand it. Moving away collapses it again.
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem("nova-crm-sidebar-collapsed", String(next));
    // Cancel any pending hover-hide when user manually pins
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setHoverExpanded(false);
  };

  // Effective expanded = either pinned open OR hover-expanded
  const isExpanded = !sidebarCollapsed || hoverExpanded;

  // ── Hover handlers ──
  // We expand immediately on enter; we delay collapse on leave (250ms) to
  // avoid flicker when the mouse briefly transits between the hover zone
  // and the sidebar.
  const handleEnterHover = () => {
    if (!sidebarCollapsed) return; // already pinned open
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setHoverExpanded(true);
  };

  const handleLeaveHover = () => {
    if (!sidebarCollapsed) return;
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setHoverExpanded(false);
      hideTimerRef.current = null;
    }, 250);
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <OfflineBanner />
      <UpdateBanner />
      <div className="flex flex-1 overflow-hidden relative">
        {/* Hover trigger zone — thin invisible strip on the left edge.
            Only active when the sidebar is collapsed (pinned closed). */}
        {sidebarCollapsed && (
          <div
            onMouseEnter={handleEnterHover}
            onMouseLeave={handleLeaveHover}
            className="absolute left-0 top-0 bottom-0 z-30"
            style={{ width: 12 }}
            aria-hidden="true"
          />
        )}

        {/* Sidebar wrapper — also listens to mouse enter/leave so that
            once expanded by hover, the user can move into the sidebar
            without it collapsing under them. */}
        <div
          onMouseEnter={handleEnterHover}
          onMouseLeave={handleLeaveHover}
          className={hoverExpanded ? "relative z-40" : "relative z-20"}
          style={{
            // When hover-expanded, overlay the main content instead of pushing it.
            // This prevents layout shift/jitter while the user is browsing.
            position: hoverExpanded ? "absolute" : "relative",
            top: 0,
            bottom: 0,
            left: 0,
          }}
        >
          <Sidebar collapsed={!isExpanded} onToggle={toggleSidebar} />
        </div>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
