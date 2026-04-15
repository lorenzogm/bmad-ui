import { createRoute, Outlet } from "@tanstack/react-router";
import { rootRoute } from "./__root";

function AnalyticsLayout() {
  return <Outlet />;
}

export const analyticsLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "analytics",
  component: AnalyticsLayout,
});
