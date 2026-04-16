import { rootRoute } from "./__root"
import { analyticsLayoutRoute } from "./analytics"
import { analyticsDashboardRoute } from "./analytics-dashboard"
import { analyticsEpicDetailRoute } from "./analytics-epic-detail"
import { analyticsEpicsRoute } from "./analytics-epics"
import { analyticsModelDetailRoute } from "./analytics-model-detail"
import { analyticsModelsRoute } from "./analytics-models"
import { analyticsSessionsRoute } from "./analytics-sessions"
import { analyticsStoriesRoute } from "./analytics-stories"
import { analyticsStoryDetailRoute } from "./analytics-story-detail"
import { epicDetailRoute } from "./epic.$epicId"
import { improvementWorkflowRoute } from "./improvement-workflow"
import { indexRoute } from "./index"
import { prepareStoryRoute } from "./prepare-story.$storyId"
import { sessionDetailRoute } from "./session.$sessionId"
import { sessionsRoute } from "./sessions"
import { storyDetailRoute } from "./story.$storyId"

export const routeTree = rootRoute.addChildren([
  indexRoute,
  sessionsRoute,
  epicDetailRoute,
  improvementWorkflowRoute,
  prepareStoryRoute,
  storyDetailRoute,
  sessionDetailRoute,
  analyticsLayoutRoute.addChildren([
    analyticsDashboardRoute,
    analyticsEpicsRoute,
    analyticsEpicDetailRoute,
    analyticsStoriesRoute,
    analyticsStoryDetailRoute,
    analyticsSessionsRoute,
    analyticsModelsRoute,
    analyticsModelDetailRoute,
  ]),
])
