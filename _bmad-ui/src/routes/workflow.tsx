import { createRoute, Outlet } from "@tanstack/react-router"
import { rootRoute } from "./__root"

function WorkflowLayout() {
  return <Outlet />
}

export const workflowLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "workflow",
  component: WorkflowLayout,
})
