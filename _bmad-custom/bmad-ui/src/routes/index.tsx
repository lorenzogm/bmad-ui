import { createRoute } from "@tanstack/react-router"
import { HomePage } from "../app"
import { rootRoute } from "./__root"

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
})
