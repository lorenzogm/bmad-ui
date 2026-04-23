import { rootRoute } from "./__root"
import { agentsRoute } from "./agents"
import { analyticsLayoutRoute } from "./analytics"
import { analyticsDashboardRoute } from "./analytics-dashboard"
import { analyticsEpicDetailRoute } from "./analytics-epic-detail"
import { analyticsEpicsRoute } from "./analytics-epics"
import { analyticsModelDetailRoute } from "./analytics-model-detail"
import { analyticsModelsRoute } from "./analytics-models"
import { analyticsQualityRoute } from "./analytics-quality"
import { analyticsSessionsRoute } from "./analytics-sessions"
import { analyticsStoriesRoute } from "./analytics-stories"
import { analyticsStoryDetailRoute } from "./analytics-story-detail"
import { developDeliverRoute } from "./develop-deliver"
import { discoverDefineRoute } from "./discover-define"
import { docsRoute } from "./docs"
import { docDetailRoute } from "./docs.$docId"
import { epicDetailRoute } from "./epic.$epicId"
import { homeRoute } from "./home"
import { improvementWorkflowRoute } from "./improvement-workflow"
import { prepareStoryRoute } from "./prepare-story.$storyId"
import { sessionDetailRoute } from "./session.$sessionId"
import { sessionsRoute } from "./sessions"
import { storyDetailRoute } from "./story.$storyId"
import { workflowLayoutRoute } from "./workflow"
import { workflowPhaseRoute } from "./workflow.$phaseId"
import { workflowStepDetailRoute } from "./workflow.$phaseId.$stepId"
import { workflowIndexRoute } from "./workflow-index"

export const routeTree = rootRoute.addChildren([
  homeRoute,
  sessionsRoute,
  epicDetailRoute,
  improvementWorkflowRoute,
  prepareStoryRoute,
  storyDetailRoute,
  sessionDetailRoute,
  discoverDefineRoute,
  developDeliverRoute,
  docsRoute,
  docDetailRoute,
  agentsRoute,
  workflowLayoutRoute.addChildren([
    workflowIndexRoute,
    workflowPhaseRoute,
    workflowStepDetailRoute,
  ]),
  analyticsLayoutRoute.addChildren([
    analyticsDashboardRoute,
    analyticsEpicsRoute,
    analyticsEpicDetailRoute,
    analyticsStoriesRoute,
    analyticsStoryDetailRoute,
    analyticsSessionsRoute,
    analyticsModelsRoute,
    analyticsModelDetailRoute,
    analyticsQualityRoute,
  ]),
])
