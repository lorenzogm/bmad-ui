// Re-export domain module APIs for consumers (vite-plugin-static-data.ts, vite.config.ts)
export {
	analyticsToRuntimeSession,
	buildAnalyticsPayload,
	readAnalyticsStore,
	upsertAnalyticsSession,
} from "./server/analytics/index.js";
export { artifactsRoot } from "./server/paths.js";
export {
	attachApi,
	buildDocDetailPayload,
	buildDocsListPayload,
	buildOverviewPayload,
	buildWorkflowStepDetailPayload,
} from "./server/routes/index.js";
export {
	buildSessionDetailPayload,
	fallbackSummary,
	getCompletedSessionSummary,
} from "./server/logs/index.js";
export {
	deriveStoryStepStateFromStatus,
	loadSprintOverview,
	STORY_WORKFLOW_STEPS,
} from "./server/sprint/index.js";
export {
	epicsFile,
	findStoryMarkdown,
	getEpicMetadataFromMarkdown,
	getPlannedStoriesFromEpics,
	getStoryContentFromEpics,
} from "./server/epics/index.js";
export {
	loadOrCreateRuntimeState,
	markZombieAnalyticsSessionsFailed,
	markZombieSessionsAsFailed,
	readRuntimeStateFile,
	setBuildMode,
} from "./server/runtime/index.js";
export {
	linksFile,
	parseSimpleYamlList,
} from "./server/links-notes/links.js";
