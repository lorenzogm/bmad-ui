import { Link, Outlet, createRootRoute, useLocation } from "@tanstack/react-router"

const TRAILING_SLASH_REGEX = /\/+$/

const NAV_LINKS = [
  { label: "Home", to: "/" },
  { label: "Epics", to: "/epics" },
] as const

const ANALYTICS_SUBMENU = [
  { label: "Overview", to: "/analytics" },
  { label: "Epics", to: "/analytics/epics" },
  { label: "Stories", to: "/analytics/stories" },
  { label: "Sessions", to: "/analytics/sessions" },
  { label: "Models", to: "/analytics/models" },
] as const

function RootLayout() {
  const location = useLocation()
  const currentPath = location.pathname.replace(TRAILING_SLASH_REGEX, "") || "/"
  const isAnalyticsSection = currentPath.startsWith("/analytics")

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <h1 className="sidebar-title">BMAD UI</h1>
        </div>
        <nav aria-label="Main navigation" className="sidebar-nav">
          {NAV_LINKS.map((link) => (
            <Link
              aria-current={currentPath === link.to ? "page" : undefined}
              className="sidebar-link"
              key={link.to}
              to={link.to}
            >
              {link.label}
            </Link>
          ))}

          <Link
            aria-current={currentPath === "/analytics" ? "page" : undefined}
            aria-expanded={isAnalyticsSection}
            className={`sidebar-link ${isAnalyticsSection ? "is-section-active" : ""}`}
            to="/analytics"
          >
            Analytics
          </Link>

          {isAnalyticsSection && (
            <div className="sidebar-submenu">
              {ANALYTICS_SUBMENU.map((link) => (
                <Link
                  aria-current={currentPath === link.to ? "page" : undefined}
                  className="sidebar-sublink"
                  key={link.to}
                  to={link.to}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </nav>
      </aside>

      <div className="app-content">
        <Outlet />
      </div>
    </div>
  )
}

export const rootRoute = createRootRoute({
  component: RootLayout,
})
