import { createRoute } from "@tanstack/react-router";
import { DashboardPage } from "../app";
import { rootRoute } from "./__root";

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
});
