import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import type { ViteDevServer } from "vite";
import {
	buildDependencyTree,
	epicsFile,
	escapeRegExp,
	findStoryMarkdown,
	getEpicMetadataFromMarkdown,
	getPlannedStoriesFromEpics,
	getStoryContentFromEpics,
	loadStoryDependencies,
	parseEpicMarkdownRows,
	summarizeEpicConsistency,
	syncEpicStatusInSprintContent,
} from "./server/epics";
import type { RuntimeState } from "./server/runtime";
import {
	activeWorkflowSkill,
	buildAgentCommand,
	buildAutoResolveInstructions,
	createRuntimeSession,
	ensureRunningProcessStateIsFresh,
	incrementSessionIdCounter,
	loadOrCreateRuntimeState,
	markZombieAnalyticsSessionsFailed,
	markZombieSessionsAsFailed,
	readRuntimeStateFile,
	resetRunningProcessState,
	runningProcess,
	runningProcessCanAcceptInput,
	runningProcessKind,
	runningSessionProcesses,
	setBuildMode,
	setActiveWorkflowSkill,
	setRunningProcess,
	setRunningProcessCanAcceptInput,
	setRunningProcessKind,
	startRuntimeSession,
} from "./server/runtime";
import {
	STORY_WORKFLOW_STEPS,
	deriveStoryStepStateFromStatus,
	loadSprintOverview,
	summarizeEpicSteps,
} from "./server/sprint";
import {
	buildLogFromEvents,
	buildSessionDetailPayload,
	fallbackSummary,
	findAllCliEventsJsonl,
	getCompletedSessionSummary,
	getExternalCliProcesses,
	readOptionalTextFile,
} from "./server/logs";
import {
	DEFAULT_STAGE_MODELS,
	DEFAULT_WORKFLOW_MODEL,
	SKILL_MODEL_OVERRIDES,
	analyticsToRuntimeSession,
	buildAnalyticsPayload,
	getEpicIdFromStoryId,
	persistSessionAnalytics,
	readAgentSessionsFile,
	readAnalyticsStore,
	sessionToAnalyticsUpdate,
	upsertAnalyticsSession,
	zeroUsage,
} from "./server/analytics";

const __agentServerDirname =
	typeof __dirname !== "undefined"
		? __dirname
		: fileURLToPath(new URL(".", import.meta.url));



const projectRoot = path.resolve(__agentServerDirname, "..", "..", "..");
const artifactsRoot = path.join(projectRoot, "_bmad-output");
const agentsDir = path.join(projectRoot, "_bmad-custom", "agents");
const runtimeLogsDir = path.join(agentsDir, "logs");

const sprintStatusFile = path.join(
	artifactsRoot,
	"implementation-artifacts",
	"sprint-status.yaml",
);
const linksFile = path.join(projectRoot, "_bmad-custom", "links.yaml");
const notesFile = path.join(projectRoot, "_bmad-custom", "notes.json");


const SESSION_DETAIL_PATH_REGEX = /^\/api\/session\/([^/]+)$/;
const SESSION_EVENTS_PATH_REGEX = /^\/api\/events\/session\/([^/]+)$/;
const SESSION_INPUT_PATH_REGEX = /^\/api\/session\/([^/]+)\/input$/;
const SESSION_START_PATH_REGEX = /^\/api\/session\/([^/]+)\/start$/;
const SESSION_ABORT_PATH_REGEX = /^\/api\/session\/([^/]+)\/abort$/;
const ORCHESTRATOR_INPUT_PATH_REGEX = /^\/api\/orchestrator\/input$/;
const MARK_REVIEW_PATH_REGEX = /^\/api\/story\/([^/]+)\/mark-review$/;
const STORY_DETAIL_PATH_REGEX = /^\/api\/story\/([^/]+)$/;
const STORY_PREVIEW_PATH_REGEX = /^\/api\/story-preview\/([^/]+)$/;
const EPIC_DETAIL_PATH_REGEX = /^\/api\/epic\/epic-(\d+)$/;
const WORKFLOW_STEP_DETAIL_PATH_REGEX =
	/^\/api\/workflow-step\/(planning|solutioning)\/(prd|ux|architecture)$/;
const LAST_UPDATED_COMMENT_REGEX = /^#\s*last_updated:\s*.*$/m;
async function buildOverviewPayload() {
	ensureRunningProcessStateIsFresh();
	const store = await readAnalyticsStore();
	const analyticsSessions = Object.values(store.sessions);
	await markZombieAnalyticsSessionsFailed(analyticsSessions, upsertAnalyticsSession);
	const sprintOverview = await loadSprintOverview(analyticsSessions);
	const externalProcesses = await getExternalCliProcesses();
	const epicsContent = existsSync(epicsFile)
		? await readFile(epicsFile, "utf8")
		: "";
	const parsedEpicRows = parseEpicMarkdownRows(epicsContent);
	const dependencyTree = {
		nodes: buildDependencyTree(parsedEpicRows, sprintOverview),
	};
	const epicConsistency = summarizeEpicConsistency(
		parsedEpicRows,
		sprintOverview,
	);
	const storyDependencies = loadStoryDependencies();

	const listArtifactDir = async (dir: string): Promise<string[]> => {
		const dirPath = path.join(artifactsRoot, dir);
		try {
			const entries = await readdir(dirPath, { withFileTypes: true });
			return entries.filter((e) => e.isFile()).map((e) => e.name);
		} catch {
			return [];
		}
	};

	const [planningArtifactFiles, implementationArtifactFiles, agentSessions] =
		await Promise.all([
			listArtifactDir("planning-artifacts"),
			listArtifactDir("implementation-artifacts"),
			readAgentSessionsFile(),
		]);

	// Derive activeWorkflowSkill from analytics sessions — the in-memory
	// variable is the canonical source while a session is starting; once the
	// session is persisted as "running" we use that, and clear the in-memory
	// value so there is no stale data after the process exits.
	const runningSession = analyticsSessions.find((s) => s.status === "running");
	if (runningSession) {
		setActiveWorkflowSkill(runningSession.skill);
	} else if (activeWorkflowSkill && !runningSessionProcesses.size) {
		setActiveWorkflowSkill(null);
	}

	const runtimeSessions = analyticsSessions.map(analyticsToRuntimeSession);
	const pseudoRuntimeState: RuntimeState = {
		status: "idle",
		startedAt: "",
		updatedAt: "",
		currentStage: "",
		dryRun: false,
		execute: true,
		nonInteractive: true,
		targetStory: null,
		parallelCandidate: null,
		sessions: runtimeSessions,
		notes: [],
	};

	return {
		steps: STORY_WORKFLOW_STEPS,
		epicSteps: summarizeEpicSteps(analyticsSessions),
		sprintOverview,
		runtimeState: pseudoRuntimeState,
		agentRunner: {
			isRunning: runningProcess !== null,
			canSendInput: runningProcessCanAcceptInput,
			isNonInteractive: true,
		},
		externalProcesses,
		dependencyTree,
		epicConsistency,
		storyDependencies,
		planningArtifactFiles,
		implementationArtifactFiles,
		activeWorkflowSkill,
		agentSessions,
	};
}




type WorkflowStepDetailKey =
	| "planning/prd"
	| "planning/ux"
	| "solutioning/architecture";

type WorkflowStepDetailResponse = {
	phase: { id: string; name: string; number: number };
	step: {
		id: string;
		name: string;
		description: string;
		skill: string;
		isOptional: boolean;
		isCompleted: boolean;
		isSkipped: boolean;
	};
	artifact: {
		status: "present" | "skipped" | "missing";
		filePath: string | null;
		markdownContent: string | null;
	};
	skillSummary: {
		overview: string;
		questionThemes: Array<{ theme: string; questions: string[] }>;
		sourceFiles: string[];
	};
};

const WORKFLOW_STEP_DETAIL_METADATA: Record<
	WorkflowStepDetailKey,
	{
		phase: { id: string; name: string; number: number };
		step: {
			id: string;
			name: string;
			description: string;
			skill: string;
			isOptional: boolean;
		};
		artifactPattern: (files: string[]) => string | null;
		skippedPattern: (files: string[]) => boolean;
		skillSummary: WorkflowStepDetailResponse["skillSummary"];
	}
> = {
	"planning/prd": {
		phase: { id: "planning", name: "Planning", number: 2 },
		step: {
			id: "prd",
			name: "Product Requirements (PRD)",
			description:
				"Expert-led facilitation to produce your Product Requirements Document — the single source of truth for scope and goals.",
			skill: "bmad-create-prd",
			isOptional: false,
		},
		artifactPattern: (files) =>
			files.find((f) => f.toLowerCase() === "prd.md") ?? null,
		skippedPattern: (files) => files.some((f) => f === "prd.skipped"),
		skillSummary: {
			overview:
				"bmad-create-prd facilitates a structured product-discovery session to produce a complete PRD. The skill walks through classification, vision, success criteria, and scoping to anchor all downstream decisions.",
			questionThemes: [
				{
					theme: "Classification & Discovery",
					questions: [
						"What type of product is this — web app, API, CLI, mobile, or other?",
						"What domain or industry does it serve?",
						"How complex is this initiative — greenfield prototype, feature extension, or full platform?",
						"Is this a greenfield project or does it extend an existing codebase?",
					],
				},
				{
					theme: "Vision & Differentiation",
					questions: [
						"What is the core insight that makes this product valuable?",
						"How is this differentiated from existing solutions?",
						"What deeper problem does this solve beyond the surface request?",
						"Why is now the right time to build this?",
						"What does future-state success look like in 12–18 months?",
					],
				},
				{
					theme: "Success Criteria",
					questions: [
						"What does a successful user experience look like after first use?",
						"What are the measurable business outcomes?",
						"What defines technical success — reliability, latency, scale?",
						"What quantitative targets should the product hit?",
					],
				},
				{
					theme: "Scope & MVP",
					questions: [
						"What must be in the MVP?",
						"What features are intentionally deferred to later phases?",
						"What are the key technical, market, or resource risks?",
					],
				},
			],
			sourceFiles: [
				".github/skills/bmad-create-prd/steps-c/step-02-discovery.md",
				".github/skills/bmad-create-prd/steps-c/step-02b-vision.md",
				".github/skills/bmad-create-prd/steps-c/step-03-success.md",
				".github/skills/bmad-create-prd/steps-c/step-08-scoping.md",
			],
		},
	},
	"planning/ux": {
		phase: { id: "planning", name: "Planning", number: 2 },
		step: {
			id: "ux",
			name: "UX Design",
			description:
				"Plan UX patterns, user flows, and design specifications. Recommended if a UI is a primary piece of the project.",
			skill: "bmad-create-ux-design",
			isOptional: true,
		},
		artifactPattern: (files) =>
			files.find((f) => f.toLowerCase().includes("ux") && f.endsWith(".md")) ??
			null,
		skippedPattern: (files) => files.some((f) => f === "ux.skipped"),
		skillSummary: {
			overview:
				"bmad-create-ux-design guides a UX discovery session to document user experience patterns, flows, and emotional design intent. The skill surfaces what users need, how they interact with the product, and the emotional quality the interface should convey.",
			questionThemes: [
				{
					theme: "Project & User Understanding",
					questions: [
						"What is being built, and who is the primary user?",
						"What frustrations do users have with existing solutions?",
						"What is the main job the user needs to accomplish?",
						"What context do users operate in — desktop, mobile, high-stress, casual?",
					],
				},
				{
					theme: "Core Experience",
					questions: [
						"What is the single most important action the UI must make effortless?",
						"What platform or device context shapes the interaction model?",
						"What are the two or three interactions that define success for a new user?",
						"What critical moments must never feel frustrating or confusing?",
					],
				},
				{
					theme: "Emotional Response",
					questions: [
						"How should users feel after completing their primary task?",
						"What emotional journey should the product create from first use to mastery?",
						"What micro-interactions or feedback moments build trust and delight?",
						"What design choices communicate clarity, reliability, or playfulness?",
					],
				},
			],
			sourceFiles: [
				".github/skills/bmad-create-ux-design/steps/step-02-discovery.md",
				".github/skills/bmad-create-ux-design/steps/step-03-core-experience.md",
				".github/skills/bmad-create-ux-design/steps/step-04-emotional-response.md",
			],
		},
	},
	"solutioning/architecture": {
		phase: { id: "solutioning", name: "Solutioning", number: 3 },
		step: {
			id: "architecture",
			name: "Architecture",
			description:
				"Document technical design decisions — stack, data models, APIs, and infrastructure — so AI agents stay consistent.",
			skill: "bmad-create-architecture",
			isOptional: false,
		},
		artifactPattern: (files) =>
			files.find(
				(f) => f.toLowerCase().includes("architecture") && f.endsWith(".md"),
			) ?? null,
		skippedPattern: (files) => files.some((f) => f === "architecture.skipped"),
		skillSummary: {
			overview:
				"bmad-create-architecture produces a complete technical architecture document covering stack decisions, data models, API design, and infrastructure. It ensures AI implementation agents stay consistent with the intended technical direction throughout development.",
			questionThemes: [
				{
					theme: "Context Analysis",
					questions: [
						"What functional and non-functional requirements have architectural implications?",
						"What are the cross-cutting concerns — auth, logging, error handling, observability?",
						"What scale and concurrency expectations should the design accommodate?",
						"What technical constraints exist from the team, budget, or existing systems?",
						"What UX decisions directly drive technical requirements?",
					],
				},
				{
					theme: "Starter & Technical Preferences",
					questions: [
						"What language and framework should be used for each service or layer?",
						"What database and storage solutions fit the data model?",
						"How should the system be deployed — serverless, containers, PaaS?",
						"What third-party integrations or APIs must be accounted for?",
						"Is there a starter template or boilerplate to build from?",
					],
				},
				{
					theme: "Core Architecture Decisions",
					questions: [
						"What is the data model and how is state managed across the system?",
						"How is authentication and authorization handled?",
						"What API style is used — REST, GraphQL, tRPC, or other?",
						"What frontend architecture patterns govern component structure and data flow?",
						"What are the infrastructure and deployment decisions that constrain implementation?",
					],
				},
			],
			sourceFiles: [
				".github/skills/bmad-create-architecture/steps/step-02-context.md",
				".github/skills/bmad-create-architecture/steps/step-03-starter.md",
				".github/skills/bmad-create-architecture/steps/step-04-decisions.md",
			],
		},
	},
};

async function buildWorkflowStepDetailPayload(
	phaseId: string,
	stepId: string,
): Promise<WorkflowStepDetailResponse | null> {
	const key = `${phaseId}/${stepId}` as WorkflowStepDetailKey;
	const meta = WORKFLOW_STEP_DETAIL_METADATA[key];
	if (!meta) {
		return null;
	}

	const planningDir = path.join(artifactsRoot, "planning-artifacts");
	const files = existsSync(planningDir)
		? (await readdir(planningDir)).filter((f) => !f.startsWith("."))
		: [];

	const isSkipped = meta.skippedPattern(files);
	const artifactFileName = meta.artifactPattern(files);

	let markdownContent: string | null = null;
	let artifactStatus: "present" | "skipped" | "missing" = "missing";
	let filePath: string | null = null;

	if (isSkipped) {
		artifactStatus = "skipped";
	} else if (artifactFileName) {
		artifactStatus = "present";
		const fullPath = path.join(planningDir, artifactFileName);
		filePath = path.relative(path.join(artifactsRoot, ".."), fullPath);
		try {
			markdownContent = await readFile(fullPath, "utf8");
		} catch {
			markdownContent = null;
		}
	}

	const isCompleted = artifactStatus === "present";
	return {
		phase: meta.phase,
		step: {
			...meta.step,
			isCompleted,
			isSkipped,
		},
		artifact: {
			status: artifactStatus,
			filePath,
			markdownContent,
		},
		skillSummary: meta.skillSummary,
	};
}

async function parseJsonBody<T>(
	req: AsyncIterable<Buffer | string>,
): Promise<T> {
	const chunks: Buffer[] = [];

	for await (const chunk of req) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}

	const rawBody = Buffer.concat(chunks).toString("utf8");
	return (rawBody.length > 0 ? JSON.parse(rawBody) : {}) as T;
}



function readRequestBody(
	req: import("node:http").IncomingMessage,
): Promise<string> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		req.on("data", (chunk: Buffer) => chunks.push(chunk));
		req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
		req.on("error", reject);
	});
}

function parseSimpleYamlList(
	raw: string,
	key: string,
): Array<Record<string, string>> {
	const items: Array<Record<string, string>> = [];
	const lines = raw.split("\n");
	let inList = false;
	let current: Record<string, string> | null = null;

	for (const line of lines) {
		if (line.trim() === `${key}:` || line.trim() === `${key}: []`) {
			inList = true;
			continue;
		}
		if (!inList) continue;

		const itemMatch = line.match(/^\s+-\s+(\w+):\s*(.*)$/);
		const propMatch = line.match(/^\s+(\w+):\s*(.*)$/);

		if (itemMatch) {
			current = { [itemMatch[1]]: stripYamlQuotes(itemMatch[2]) };
			items.push(current);
		} else if (propMatch && current && !line.trim().startsWith("-")) {
			current[propMatch[1]] = stripYamlQuotes(propMatch[2]);
		}
	}

	return items;
}

function stripYamlQuotes(val: string): string {
	const trimmed = val.trim();
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

function serializeLinksYaml(
	links: Array<{ title: string; subtitle: string; url: string; icon: string }>,
): string {
	if (links.length === 0) return "links: []\n";
	const lines = ["links:"];
	for (const link of links) {
		lines.push(`  - title: "${link.title}"`);
		lines.push(`    subtitle: "${link.subtitle}"`);
		lines.push(`    url: ${link.url}`);
		lines.push(`    icon: ${link.icon}`);
	}
	return `${lines.join("\n")}\n`;
}

function attachApi(server: ViteDevServer): void {
	server.middlewares.use((req, res, next) => {
		const requestPromise = (async () => {
			if (!req.url?.startsWith("/api/")) {
				next();
				return;
			}

			const requestUrl = new URL(req.url, "http://localhost");

			if (requestUrl.pathname === "/api/overview" && req.method === "GET") {
				try {
					const payload = await buildOverviewPayload();

					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify(payload));
				} catch (error) {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: String(error) }));
				}
				return;
			}

			if (
				requestUrl.pathname === "/api/events/overview" &&
				req.method === "GET"
			) {
				res.writeHead(200, {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache, no-transform",
					Connection: "keep-alive",
				});

				let lastPayload = "";

				const push = async () => {
					try {
						const payload = await buildOverviewPayload();
						const nextPayload = JSON.stringify(payload);
						if (nextPayload !== lastPayload) {
							lastPayload = nextPayload;
							res.write(`data: ${nextPayload}\n\n`);
						}
					} catch (error) {
						res.write(
							`event: error\ndata: ${JSON.stringify({ error: String(error) })}\n\n`,
						);
					}
				};

				await push();
				const interval = setInterval(push, 1000);

				req.on("close", () => {
					clearInterval(interval);
				});

				return;
			}

			const sessionDetailMatch = requestUrl.pathname.match(
				SESSION_DETAIL_PATH_REGEX,
			);
			if (sessionDetailMatch && req.method === "GET") {
				try {
					const sessionId = decodeURIComponent(sessionDetailMatch[1]);
					const payload = await buildSessionDetailPayload(sessionId, { readAnalyticsStore, markZombiesFailed: markZombieAnalyticsSessionsFailed, upsertSession: upsertAnalyticsSession, analyticsToRuntimeSession });
					if (!payload) {
						res.writeHead(404, { "Content-Type": "application/json" });
						res.end(
							JSON.stringify({ error: `session not found: ${sessionId}` }),
						);
						return;
					}

					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify(payload));
				} catch (sessionError) {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: String(sessionError) }));
				}
				return;
			}

			const sessionEventsMatch = requestUrl.pathname.match(
				SESSION_EVENTS_PATH_REGEX,
			);
			if (sessionEventsMatch && req.method === "GET") {
				const sessionId = decodeURIComponent(sessionEventsMatch[1]);

				res.writeHead(200, {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache, no-transform",
					Connection: "keep-alive",
				});

				let lastPayload = "";

				const push = async () => {
					try {
						const payload = await buildSessionDetailPayload(sessionId, { readAnalyticsStore, markZombiesFailed: markZombieAnalyticsSessionsFailed, upsertSession: upsertAnalyticsSession, analyticsToRuntimeSession });
						if (!payload) {
							res.write(
								`event: missing\ndata: ${JSON.stringify({ error: `session not found: ${sessionId}` })}\n\n`,
							);
							return;
						}

						const nextPayload = JSON.stringify(payload);
						if (nextPayload !== lastPayload) {
							lastPayload = nextPayload;
							res.write(`data: ${nextPayload}\n\n`);
						}
					} catch (error) {
						res.write(
							`event: error\ndata: ${JSON.stringify({ error: String(error) })}\n\n`,
						);
					}
				};

				await push();
				const interval = setInterval(push, 1000);

				req.on("close", () => {
					clearInterval(interval);
				});

				return;
			}

			const sessionInputMatch = requestUrl.pathname.match(
				SESSION_INPUT_PATH_REGEX,
			);
			if (sessionInputMatch && req.method === "POST") {
				try {
					const sessionId = decodeURIComponent(sessionInputMatch[1]);
					const body = await parseJsonBody<{ message?: string }>(req);
					const message = body.message?.trim() || "";

					if (!message) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "message is required" }));
						return;
					}

					const inputStore = await readAnalyticsStore();
					const inputAnalyticsSession = inputStore.sessions[sessionId];

					if (!inputAnalyticsSession) {
						res.writeHead(404, { "Content-Type": "application/json" });
						res.end(
							JSON.stringify({ error: `session not found: ${sessionId}` }),
						);
						return;
					}

					const session = analyticsToRuntimeSession(inputAnalyticsSession);

					const processForSession = runningSessionProcesses.get(sessionId);
					if (!processForSession?.stdin || processForSession.stdin.destroyed) {
						// Session process is not running — restart the session with the
						// new message as a follow-up prompt.
						const followUpPromptPath = (session.promptPath || "").replace(
							/\.md$/,
							`-followup-${Date.now()}.md`,
						);
						const originalPrompt = await readOptionalTextFile(
							session.promptPath,
						);
						const followUpContent = [
							originalPrompt
								? `Previous prompt context:\n${originalPrompt}\n\n---\n`
								: "",
							`Follow-up instruction:\n${message}`,
						].join("");
						await mkdir(path.dirname(followUpPromptPath || runtimeLogsDir), {
							recursive: true,
						});
						await writeFile(followUpPromptPath, followUpContent, "utf8");

						const userMessage = {
							id: `msg-${Date.now()}`,
							text: message,
							sentAt: new Date().toISOString(),
						};
						session.userMessages = session.userMessages || [];
						session.userMessages.push(userMessage);

						// Reset session for re-run
						session.promptPath = followUpPromptPath;
						session.command = buildAgentCommand(
							session.model,
							followUpPromptPath,
						);
						session.status = "planned";
						session.exitCode = null;
						session.error = null;
						session.endedAt = null;
						await upsertAnalyticsSession(sessionToAnalyticsUpdate(session));

						try {
							await startRuntimeSession(session, { upsertSession: upsertAnalyticsSession, toAnalyticsUpdate: sessionToAnalyticsUpdate, persistSessionAnalytics });
						} catch (restartError) {
							session.status = "failed";
							session.error = `Failed to restart session: ${String(restartError)}`;
							session.endedAt = new Date().toISOString();
							await upsertAnalyticsSession(sessionToAnalyticsUpdate(session));
							res.writeHead(500, { "Content-Type": "application/json" });
							res.end(JSON.stringify({ error: session.error }));
							return;
						}

						res.writeHead(202, { "Content-Type": "application/json" });
						res.end(
							JSON.stringify({ status: "restarted", message: userMessage }),
						);
						return;
					}

					const userMessage = {
						id: `msg-${Date.now()}`,
						text: message,
						sentAt: new Date().toISOString(),
					};

					session.userMessages = session.userMessages || [];
					session.userMessages.push(userMessage);
					await upsertAnalyticsSession(sessionToAnalyticsUpdate(session));

					await writeFile(session.logPath, `\n[user] ${message}\n`, {
						encoding: "utf8",
						flag: "a",
					});

					processForSession.stdin.write(`${message}\n`);

					res.writeHead(202, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ status: "sent", message: userMessage }));
				} catch (sessionInputError) {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: String(sessionInputError) }));
				}

				return;
			}

			const sessionStartMatch = requestUrl.pathname.match(
				SESSION_START_PATH_REGEX,
			);
			if (sessionStartMatch && req.method === "POST") {
				try {
					ensureRunningProcessStateIsFresh();

					const sessionId = decodeURIComponent(sessionStartMatch[1]);
					const startStore = await readAnalyticsStore();
					const startAnalyticsSession = startStore.sessions[sessionId];

					if (!startAnalyticsSession) {
						res.writeHead(404, { "Content-Type": "application/json" });
						res.end(
							JSON.stringify({ error: `session not found: ${sessionId}` }),
						);
						return;
					}

					const session = analyticsToRuntimeSession(startAnalyticsSession);

					// Block if there is already a running session whose story conflicts
					// with the requested session's story. Two stories conflict when one
					// depends on the other. Independent stories can run in parallel.
					if (runningSessionProcesses.size > 0) {
						const deps = loadStoryDependencies();
						const newStoryId = session.storyId ?? null;

						// Collect story IDs that are currently running
						const runningStoryIds = new Set<string>();
						for (const [runId, runSess] of Object.entries(
							startStore.sessions,
						)) {
							if (runningSessionProcesses.has(runId) && runSess.storyId) {
								runningStoryIds.add(runSess.storyId);
							}
						}

						// Check for dependency conflict: new story depends on a running
						// story, or a running story depends on the new story.
						const hasConflict =
							newStoryId !== null &&
							[...runningStoryIds].some((runningId) => {
								const newDeps = deps[newStoryId] ?? [];
								const runningDeps = deps[runningId] ?? [];
								return (
									newDeps.includes(runningId) ||
									runningDeps.includes(newStoryId)
								);
							});

						if (hasConflict) {
							res.writeHead(409, { "Content-Type": "application/json" });
							res.end(
								JSON.stringify({
									error: "another orchestrator task is running",
								}),
							);
							return;
						}
					}

					if (session.status !== "planned") {
						res.writeHead(409, { "Content-Type": "application/json" });
						res.end(
							JSON.stringify({
								error: `session cannot be started from status ${session.status}`,
							}),
						);
						return;
					}

					try {
						await startRuntimeSession(session, { upsertSession: upsertAnalyticsSession, toAnalyticsUpdate: sessionToAnalyticsUpdate, persistSessionAnalytics });
					} catch (worktreeError) {
						session.status = "failed";
						session.error = `Failed to start session: ${String(worktreeError)}`;
						session.endedAt = new Date().toISOString();
						await upsertAnalyticsSession(sessionToAnalyticsUpdate(session));
						res.writeHead(500, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: session.error }));
						return;
					}

					res.writeHead(202, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ status: "started", sessionId }));
				} catch (sessionStartError) {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: String(sessionStartError) }));
				}

				return;
			}

			const sessionAbortMatch = requestUrl.pathname.match(
				SESSION_ABORT_PATH_REGEX,
			);
			if (sessionAbortMatch && req.method === "POST") {
				try {
					const sessionId = decodeURIComponent(sessionAbortMatch[1]);
					const abortStore = await readAnalyticsStore();
					const abortAnalyticsSession = abortStore.sessions[sessionId];

					if (!abortAnalyticsSession) {
						res.writeHead(404, { "Content-Type": "application/json" });
						res.end(
							JSON.stringify({ error: `session not found: ${sessionId}` }),
						);
						return;
					}

					const session = analyticsToRuntimeSession(abortAnalyticsSession);

					const processForSession = runningSessionProcesses.get(sessionId);
					if (processForSession) {
						runningSessionProcesses.delete(sessionId);
						if (runningProcess === processForSession) {
							resetRunningProcessState();
						}
						processForSession.kill();
					}

					session.status = "cancelled";
					session.error = "Cancelled by user";
					session.endedAt = new Date().toISOString();
					session.exitCode = session.exitCode ?? -1;
					await upsertAnalyticsSession(sessionToAnalyticsUpdate(session));
					await persistSessionAnalytics(session);

					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ status: "aborted", sessionId }));
				} catch (sessionAbortError) {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: String(sessionAbortError) }));
				}

				return;
			}

			if (
				requestUrl.pathname === "/api/orchestrator/run" &&
				req.method === "POST"
			) {
				ensureRunningProcessStateIsFresh();

				if (runningProcess) {
					res.writeHead(409, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: "orchestrator already running" }));
					return;
				}

				const commandArgs = ["bmad:orchestrate", "--"];

				const orchestratorProcess = spawn("pnpm", commandArgs, {
					cwd: projectRoot,
					shell: true,
					env: process.env,
					stdio: ["pipe", "ignore", "ignore"],
				});
				setRunningProcess(orchestratorProcess);
				setRunningProcessCanAcceptInput(false);
				setRunningProcessKind("orchestrator");

				orchestratorProcess.on("close", () => {
					setRunningProcess(null);
					setRunningProcessCanAcceptInput(false);
					setRunningProcessKind(null);
				});

				orchestratorProcess.on("error", () => {
					setRunningProcess(null);
					setRunningProcessCanAcceptInput(false);
					setRunningProcessKind(null);
				});

				res.writeHead(202, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ status: "planned" }));
				return;
			}

			if (
				ORCHESTRATOR_INPUT_PATH_REGEX.test(requestUrl.pathname) &&
				req.method === "POST"
			) {
				try {
					ensureRunningProcessStateIsFresh();
					const body = await parseJsonBody<{ message?: string }>(req);
					const message = body.message?.trim() || "";

					if (!message) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "message is required" }));
						return;
					}

					if (
						runningProcessKind !== "orchestrator" ||
						!runningProcessCanAcceptInput ||
						!runningProcess?.stdin ||
						runningProcess.stdin.destroyed
					) {
						res.writeHead(409, { "Content-Type": "application/json" });
						res.end(
							JSON.stringify({ error: "orchestrator is not accepting input" }),
						);
						return;
					}

					runningProcess.stdin.write(`${message}\n`);
					res.writeHead(202, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ status: "sent" }));
				} catch (orchestratorInputError) {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: String(orchestratorInputError) }));
				}

				return;
			}

			if (
				requestUrl.pathname === "/api/orchestrator/run-stage" &&
				req.method === "POST"
			) {
				try {
					const chunks: Buffer[] = [];
					for await (const chunk of req) {
						chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
					}

					const rawBody = Buffer.concat(chunks).toString("utf8");
					const parsed =
						rawBody.length > 0
							? (JSON.parse(rawBody) as {
									stage?: string;
									epicId?: string;
									epicNumber?: number;
								})
							: {};

					const stage =
						parsed.stage === "planning" || parsed.stage === "retrospective"
							? parsed.stage
							: null;
					if (!stage) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "invalid stage" }));
						return;
					}

					const skillName =
						stage === "planning" ? "gds-sprint-planning" : "gds-retrospective";
					const model = DEFAULT_STAGE_MODELS[stage];
					const epicLabel =
						parsed.epicId ||
						(Number.isFinite(parsed.epicNumber)
							? `epic-${parsed.epicNumber}`
							: "unknown-epic");

					await mkdir(runtimeLogsDir, { recursive: true });

					const timestamp = Date.now();
					const sessionId = `${stage}-${timestamp}-${incrementSessionIdCounter()}`;
					const promptPath = path.join(
						runtimeLogsDir,
						`${sessionId}.prompt.txt`,
					);
					const logPath = path.join(runtimeLogsDir, `${sessionId}.log`);

					const prompt = [
						`/${skillName} ${epicLabel}`,
						"Follow GDS strictly.",
						"Start this in a brand new agent session.",
						"This run is non-interactive: never wait for user input.",
						"If a workflow asks for approval/checkpoint, assume approval and continue automatically.",
						"Do not end your output with a question for the user.",
						"Run only the requested skill in this session.",
						`Skill: ${skillName}`,
						`Model: ${model}`,
						`Epic: ${epicLabel}`,
					].join("\n");

					await writeFile(promptPath, `${prompt}\n`, "utf8");
					await writeFile(logPath, "", "utf8");

					const command = buildAgentCommand(model, promptPath);
					const session = createRuntimeSession({
						id: sessionId,
						skill: skillName,
						model,
						storyId: epicLabel,
						command,
						promptPath,
						logPath,
					});

					await upsertAnalyticsSession({
						sessionId: session.id,
						storyId: session.storyId,
						epicId: getEpicIdFromStoryId(session.storyId),
						skill: session.skill,
						model: session.model,
						status: "planned",
						startedAt: session.startedAt,
						endedAt: null,
						usage: zeroUsage(),
						logPath: session.logPath,
						promptPath: session.promptPath,
						command: session.command,
						worktreePath: session.worktreePath,
					});

					res.writeHead(202, { "Content-Type": "application/json" });
					res.end(
						JSON.stringify({
							status: "queued",
							stage,
							skillName,
							sessionId,
						}),
					);
				} catch (stageRunError) {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: String(stageRunError) }));
				}

				return;
			}

			if (
				requestUrl.pathname === "/api/orchestrator/stop" &&
				req.method === "POST"
			) {
				ensureRunningProcessStateIsFresh();

				if (!runningProcess) {
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ status: "idle" }));
					return;
				}

				runningProcess.kill();
				setRunningProcess(null);
				setRunningProcessCanAcceptInput(false);
				setRunningProcessKind(null);
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ status: "stopped" }));
				return;
			}

			const markReviewMatch = requestUrl.pathname.match(MARK_REVIEW_PATH_REGEX);
			if (markReviewMatch && req.method === "POST") {
				const storyId = decodeURIComponent(markReviewMatch[1]);

				if (!existsSync(sprintStatusFile)) {
					res.writeHead(404, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: "sprint status file not found" }));
					return;
				}

				const sprintContent = await readFile(sprintStatusFile, "utf8");
				const linePattern = new RegExp(
					`^(${escapeRegExp(storyId)}:\\s*)(backlog|ready-for-dev|in-progress|review|done)$`,
					"m",
				);

				if (!linePattern.test(sprintContent)) {
					res.writeHead(404, { "Content-Type": "application/json" });
					res.end(
						JSON.stringify({ error: "story not found in sprint status" }),
					);
					return;
				}

				let nextContent = sprintContent.replace(linePattern, "$1review");
				const epicNumber = Number(storyId.split("-")[0]);
				if (Number.isFinite(epicNumber)) {
					nextContent = syncEpicStatusInSprintContent(nextContent, epicNumber);
				}
				const today = new Date().toISOString().slice(0, 10);
				nextContent = nextContent.replace(
					LAST_UPDATED_COMMENT_REGEX,
					`# last_updated: ${today}`,
				);
				await writeFile(sprintStatusFile, nextContent, "utf8");

				const orchestratorStarted = false;

				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(
					JSON.stringify({ status: "updated", storyId, orchestratorStarted }),
				);
				return;
			}

			const storyDetailMatch = requestUrl.pathname.match(
				STORY_DETAIL_PATH_REGEX,
			);
			if (storyDetailMatch && req.method === "GET") {
				const storyId = decodeURIComponent(storyDetailMatch[1]);
				const storyDetailStore = await readAnalyticsStore();
				const storyDetailSessions = Object.values(storyDetailStore.sessions);

				const overview = await loadSprintOverview(storyDetailSessions);
				const story = overview.stories.find((item) => item.id === storyId);

				if (!story) {
					res.writeHead(404, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: "story not found" }));
					return;
				}

				const markdown = await findStoryMarkdown(storyId);
				const sessions = storyDetailSessions
					.filter((session) => session.storyId === storyId)
					.filter((session) => session.status !== "planned")
					.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
					.map(analyticsToRuntimeSession);
				const externalProcesses = await getExternalCliProcesses();

				const payload = {
					story: {
						id: story.id,
						status: story.status,
						markdownPath: markdown?.path || null,
						markdownContent: markdown?.content || null,
					},
					steps: await Promise.all(
						STORY_WORKFLOW_STEPS.map(async (step) => {
							const state = deriveStoryStepStateFromStatus(
								story.status,
								step.skill,
							);
							const generatedSummary = await getCompletedSessionSummary(
								storyDetailSessions,
								story.id,
								step.skill,
							);

							return {
								skill: step.skill,
								label: step.label,
								state,
								summary:
									generatedSummary ||
									fallbackSummary(step.skill, state, markdown?.path || null),
							};
						}),
					),
					sessions,
					externalProcesses,
				};

				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify(payload));
				return;
			}

			const storyPreviewMatch = requestUrl.pathname.match(
				STORY_PREVIEW_PATH_REGEX,
			);
			if (storyPreviewMatch && req.method === "GET") {
				const storyId = decodeURIComponent(storyPreviewMatch[1]);

				let planningContent: { title: string; content: string } | null = null;
				if (existsSync(epicsFile)) {
					try {
						const epicsContent = await readFile(epicsFile, "utf8");
						planningContent = getStoryContentFromEpics(epicsContent, storyId);
					} catch {
						// ignore parse errors
					}
				}

				const implMarkdown = await findStoryMarkdown(storyId);

				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(
					JSON.stringify({
						storyId,
						planning: planningContent
							? {
									title: planningContent.title,
									content: planningContent.content,
								}
							: null,
						implementation: implMarkdown
							? {
									path: implMarkdown.path,
									content: implMarkdown.content,
								}
							: null,
					}),
				);
				return;
			}

			const epicDetailMatch = requestUrl.pathname.match(EPIC_DETAIL_PATH_REGEX);
			if (epicDetailMatch && req.method === "GET") {
				const epicNumber = Number(epicDetailMatch[1]);
				if (!Number.isFinite(epicNumber)) {
					res.writeHead(400, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: "invalid epic id" }));
					return;
				}

				const epicDetailStore = await readAnalyticsStore();
				const epicDetailSessions = Object.values(epicDetailStore.sessions);

				const overview = await loadSprintOverview(epicDetailSessions);
				const epic = overview.epics.find((item) => item.number === epicNumber);

				if (!epic) {
					res.writeHead(404, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: "epic not found" }));
					return;
				}

				const stories = overview.stories
					.filter((story) => Number(story.id.split("-")[0]) === epicNumber)
					.sort((a, b) => (a.id > b.id ? 1 : -1));

				let epicMeta = { name: "", description: "" };
				let plannedStories: string[] = [];
				let parseWarning: string | null = null;
				if (existsSync(epicsFile)) {
					try {
						const epicsContent = await readFile(epicsFile, "utf8");
						epicMeta = getEpicMetadataFromMarkdown(epicsContent, epicNumber);
						plannedStories = getPlannedStoriesFromEpics(
							epicsContent,
							epicNumber,
							overview.stories,
						);
					} catch (parseErr) {
						parseWarning = `Could not read epics.md: ${String(parseErr)}`;
					}
				}

				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(
					JSON.stringify({
						epic: {
							id: epic.id,
							number: epic.number,
							name: epicMeta.name,
							description: epicMeta.description,
							status: epic.status,
							storyCount: epic.storyCount,
							plannedStoryCount: epic.plannedStoryCount,
							storiesToCreate: epic.storiesToCreate,
							byStoryStatus: epic.byStoryStatus,
						},
						stories,
						plannedStories,
						parseWarning,
					}),
				);
				return;
			}

			if (requestUrl.pathname === "/api/analytics" && req.method === "GET") {
				try {
					const payload = await buildAnalyticsPayload();
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify(payload));
				} catch (analyticsError) {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: String(analyticsError) }));
				}
				return;
			}

			if (
				requestUrl.pathname === "/api/sessions/regenerate-logs" &&
				req.method === "POST"
			) {
				try {
					const regenStore = await readAnalyticsStore();
					const sessions = Object.values(regenStore.sessions).filter(
						(s) => s.logPath,
					);
					let regenerated = 0;
					let skipped = 0;

					for (const session of sessions) {
						const eventsPaths = await findAllCliEventsJsonl(
							session.sessionId,
							session.userMessages || [],
						);
						if (eventsPaths.length === 0) {
							skipped += 1;
							continue;
						}

						const parts: string[] = [];
						for (const ep of eventsPaths) {
							try {
								const eventsContent = await readFile(ep, "utf8");
								const built = buildLogFromEvents(eventsContent);
								if (built.trim().length > 0) {
									parts.push(built);
								}
							} catch {
								// skip unreadable event files
							}
						}

						if (parts.length > 0 && session.logPath) {
							await mkdir(path.dirname(session.logPath), { recursive: true });
							await writeFile(session.logPath, parts.join("\n\n"), "utf8");
							regenerated += 1;
						} else {
							skipped += 1;
						}
					}

					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(
						JSON.stringify({ regenerated, skipped, total: sessions.length }),
					);
				} catch (regenError) {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: String(regenError) }));
				}
				return;
			}

			if (
				requestUrl.pathname === "/api/workflow/skip-step" &&
				req.method === "POST"
			) {
				try {
					const body = await parseJsonBody<{ stepId?: string }>(req);
					const stepId = body.stepId?.trim();
					if (!stepId || !/^[a-z0-9-]+$/.test(stepId)) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "valid stepId is required" }));
						return;
					}
					const skipFilePath = path.join(
						artifactsRoot,
						"planning-artifacts",
						`${stepId}.skipped`,
					);
					await mkdir(path.join(artifactsRoot, "planning-artifacts"), {
						recursive: true,
					});
					await writeFile(skipFilePath, "", "utf8");
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ status: "skipped", stepId }));
				} catch (skipError) {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: String(skipError) }));
				}
				return;
			}

			if (
				requestUrl.pathname === "/api/workflow/unskip-step" &&
				req.method === "POST"
			) {
				try {
					const body = await parseJsonBody<{ stepId?: string }>(req);
					const stepId = body.stepId?.trim();
					if (!stepId || !/^[a-z0-9-]+$/.test(stepId)) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "valid stepId is required" }));
						return;
					}
					const skipFilePath = path.join(
						artifactsRoot,
						"planning-artifacts",
						`${stepId}.skipped`,
					);
					if (existsSync(skipFilePath)) {
						await unlink(skipFilePath);
					}
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ status: "unskipped", stepId }));
				} catch (unskipError) {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: String(unskipError) }));
				}
				return;
			}

			if (
				requestUrl.pathname === "/api/artifacts/files" &&
				req.method === "GET"
			) {
				const dir = requestUrl.searchParams.get("dir") ?? "planning";
				const dirPath = path.join(
					artifactsRoot,
					dir === "implementation"
						? "implementation-artifacts"
						: "planning-artifacts",
				);
				try {
					const files = existsSync(dirPath)
						? (await readdir(dirPath)).filter((f) => !f.startsWith("."))
						: [];
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify(files));
				} catch (filesError) {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: String(filesError) }));
				}
				return;
			}

			const workflowStepDetailMatch = requestUrl.pathname.match(
				WORKFLOW_STEP_DETAIL_PATH_REGEX,
			);
			if (workflowStepDetailMatch && req.method === "GET") {
				try {
					const phaseId = workflowStepDetailMatch[1];
					const stepId = workflowStepDetailMatch[2];
					const payload = await buildWorkflowStepDetailPayload(phaseId, stepId);
					if (!payload) {
						res.writeHead(404, { "Content-Type": "application/json" });
						res.end(
							JSON.stringify({
								error: `workflow step not found: ${phaseId}/${stepId}`,
							}),
						);
						return;
					}
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify(payload));
				} catch (stepError) {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: String(stepError) }));
				}
				return;
			}

			if (
				requestUrl.pathname === "/api/workflow/run-skill" &&
				req.method === "POST"
			) {
				try {
					ensureRunningProcessStateIsFresh();

					const body = await parseJsonBody<{
						skill?: string;
						storyId?: string;
						epicId?: string;
						prompt?: string;
						autoResolve?: boolean;
					}>(req);
					const skill = body.skill?.trim();
					const storyId = body.storyId?.trim() || null;
					const epicId = body.epicId?.trim() || null;
					const rawPrompt = body.prompt?.trim() || null;
					const autoResolve = body.autoResolve === true;
					if (!skill) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "skill is required" }));
						return;
					}

					if (rawPrompt && (storyId || epicId)) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(
							JSON.stringify({
								error: "prompt cannot be combined with storyId or epicId",
							}),
						);
						return;
					}

					const MAX_CUSTOM_PROMPT_LENGTH = 10_000;
					const customPrompt = rawPrompt
						? rawPrompt
								.slice(0, MAX_CUSTOM_PROMPT_LENGTH)
								// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control char strip
								.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
						: null;

					const isValidSkill = /^[a-z0-9-]+$/.test(skill);
					if (!isValidSkill) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "invalid skill" }));
						return;
					}

					// Prevent duplicate sessions: if the same skill is already running
					// for the same story, return 409 Conflict.
					if (storyId && runningSessionProcesses.size > 0) {
						const storeForDupCheck = await readAnalyticsStore();
						const duplicateSession = Object.entries(
							storeForDupCheck.sessions,
						).find(
							([id, s]) =>
								runningSessionProcesses.has(id) &&
								s.storyId === storyId &&
								s.skill === skill,
						);
						if (duplicateSession) {
							res.writeHead(409, { "Content-Type": "application/json" });
							res.end(
								JSON.stringify({
									error: `${skill} is already running for story ${storyId}`,
								}),
							);
							return;
						}
					}

					// Skills that run preparation work (not code execution) can run in
					// parallel with a running dev-story. Only exclusive skills are blocked
					// when there is a story dependency conflict with a running session.
					const exclusiveSkills = new Set([
						"bmad-dev-story",
						"bmad-code-review",
					]);
					if (exclusiveSkills.has(skill) && runningSessionProcesses.size > 0) {
						const storeForConflictCheck = await readAnalyticsStore();
						const deps = loadStoryDependencies();

						// Collect story IDs that are currently running
						const runningStoryIds = new Set<string>();
						for (const [runId, runSess] of Object.entries(
							storeForConflictCheck.sessions,
						)) {
							if (runningSessionProcesses.has(runId) && runSess.storyId) {
								runningStoryIds.add(runSess.storyId);
							}
						}

						// Check for dependency conflict: new story depends on a running
						// story, or a running story depends on the new story.
						const hasConflict =
							storyId !== null &&
							[...runningStoryIds].some((runningId) => {
								const newDeps = deps[storyId] ?? [];
								const runningDeps = deps[runningId] ?? [];
								return (
									newDeps.includes(runningId) || runningDeps.includes(storyId)
								);
							});

						// Also block if an exclusive skill is running for the same story
						const sameStoryRunning =
							storyId !== null && runningStoryIds.has(storyId);

						if (hasConflict || sameStoryRunning) {
							res.writeHead(409, { "Content-Type": "application/json" });
							res.end(
								JSON.stringify({
									error: "another orchestrator task is running",
								}),
							);
							return;
						}
					}

					await mkdir(runtimeLogsDir, { recursive: true });

					const timestamp = Date.now();
					const sessionId = `workflow-${skill}-${timestamp}-${incrementSessionIdCounter()}`;
					const promptPath = path.join(
						runtimeLogsDir,
						`${sessionId}.prompt.txt`,
					);
					const logPath = path.join(runtimeLogsDir, `${sessionId}.log`);

					const skillModel =
						SKILL_MODEL_OVERRIDES[skill] ?? DEFAULT_WORKFLOW_MODEL;

					const autoResolveInstructions = autoResolve
						? buildAutoResolveInstructions(skill)
						: null;

					const prompt = customPrompt
						? customPrompt
						: [
								storyId
									? `/${skill} ${storyId}`
									: epicId
										? `/${skill} ${epicId}`
										: `/${skill}`,
								`Model: ${skillModel}`,
								...(storyId ? [`Story: ${storyId}`] : []),
								...(autoResolveInstructions
									? ["", autoResolveInstructions]
									: []),
							].join("\n");

					await writeFile(promptPath, `${prompt}\n`, "utf8");
					await writeFile(logPath, "", "utf8");

					const command = buildAgentCommand(skillModel, promptPath);
					const session = createRuntimeSession({
						id: sessionId,
						skill,
						model: skillModel,
						storyId,
						command,
						promptPath,
						logPath,
					});

					await upsertAnalyticsSession({
						sessionId: session.id,
						storyId: session.storyId,
						epicId: getEpicIdFromStoryId(session.storyId),
						skill: session.skill,
						model: session.model,
						status: "planned",
						startedAt: session.startedAt,
						endedAt: null,
						usage: zeroUsage(),
						logPath: session.logPath,
						promptPath: session.promptPath,
						command: session.command,
						worktreePath: session.worktreePath,
					});

					await startRuntimeSession(session, { upsertSession: upsertAnalyticsSession, toAnalyticsUpdate: sessionToAnalyticsUpdate, persistSessionAnalytics });
					setActiveWorkflowSkill(skill);

					res.writeHead(202, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ status: "started", sessionId }));
				} catch (runSkillError) {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: String(runSkillError) }));
				}
				return;
			}

			// --- Links CRUD ---
			if (requestUrl.pathname === "/api/links" && req.method === "GET") {
				try {
					let links: Array<{
						title: string;
						subtitle: string;
						url: string;
						icon: string;
					}> = [];
					if (existsSync(linksFile)) {
						const raw = readFileSync(linksFile, "utf8");
						const parsed = parseSimpleYamlList(raw, "links");
						links = parsed as typeof links;
					}
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ links }));
				} catch (linksError) {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: String(linksError) }));
				}
				return;
			}

			if (requestUrl.pathname === "/api/links" && req.method === "POST") {
				try {
					const body = await readRequestBody(req);
					const { title, subtitle, url, icon } = JSON.parse(body) as {
						title: string;
						subtitle: string;
						url: string;
						icon: string;
					};
					if (!title || !url) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "title and url are required" }));
						return;
					}
					let links: Array<{
						title: string;
						subtitle: string;
						url: string;
						icon: string;
					}> = [];
					if (existsSync(linksFile)) {
						const raw = readFileSync(linksFile, "utf8");
						links = parseSimpleYamlList(raw, "links") as typeof links;
					}
					links.push({
						title,
						subtitle: subtitle || "",
						url,
						icon: icon || "link",
					});
					await writeFile(linksFile, serializeLinksYaml(links), "utf8");
					res.writeHead(201, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ links }));
				} catch (addLinkError) {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: String(addLinkError) }));
				}
				return;
			}

			if (requestUrl.pathname === "/api/links" && req.method === "PUT") {
				try {
					const body = await readRequestBody(req);
					const { index, title, subtitle, url, icon } = JSON.parse(body) as {
						index: number;
						title?: string;
						subtitle?: string;
						url?: string;
						icon?: string;
					};
					if (index === undefined || index === null) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "index is required" }));
						return;
					}
					let links: Array<{
						title: string;
						subtitle: string;
						url: string;
						icon: string;
					}> = [];
					if (existsSync(linksFile)) {
						const raw = readFileSync(linksFile, "utf8");
						links = parseSimpleYamlList(raw, "links") as typeof links;
					}
					if (index < 0 || index >= links.length) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "invalid index" }));
						return;
					}
					if (title !== undefined) links[index].title = title;
					if (subtitle !== undefined) links[index].subtitle = subtitle;
					if (url !== undefined) links[index].url = url;
					if (icon !== undefined) links[index].icon = icon;
					await writeFile(linksFile, serializeLinksYaml(links), "utf8");
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ links }));
				} catch (updateLinkError) {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: String(updateLinkError) }));
				}
				return;
			}

			if (requestUrl.pathname === "/api/links" && req.method === "DELETE") {
				try {
					const indexParam = requestUrl.searchParams.get("index");
					if (indexParam === null) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "index query param required" }));
						return;
					}
					const index = Number.parseInt(indexParam, 10);
					let links: Array<{
						title: string;
						subtitle: string;
						url: string;
						icon: string;
					}> = [];
					if (existsSync(linksFile)) {
						const raw = readFileSync(linksFile, "utf8");
						links = parseSimpleYamlList(raw, "links") as typeof links;
					}
					if (index < 0 || index >= links.length) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "invalid index" }));
						return;
					}
					links.splice(index, 1);
					await writeFile(linksFile, serializeLinksYaml(links), "utf8");
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ links }));
				} catch (deleteLinkError) {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: String(deleteLinkError) }));
				}
				return;
			}

			// --- Notes CRUD ---
			if (requestUrl.pathname === "/api/notes" && req.method === "GET") {
				try {
					let notes: Array<{
						id: string;
						text: string;
						color: string;
						createdAt: string;
					}> = [];
					if (existsSync(notesFile)) {
						const raw = readFileSync(notesFile, "utf8");
						const parsed = JSON.parse(raw) as { notes: typeof notes };
						notes = parsed.notes ?? [];
					}
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ notes }));
				} catch (notesError) {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: String(notesError) }));
				}
				return;
			}

			if (requestUrl.pathname === "/api/notes" && req.method === "POST") {
				try {
					const body = await readRequestBody(req);
					const { text, color } = JSON.parse(body) as {
						text: string;
						color?: string;
					};
					if (!text) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "text is required" }));
						return;
					}
					let notes: Array<{
						id: string;
						text: string;
						color: string;
						createdAt: string;
					}> = [];
					if (existsSync(notesFile)) {
						const raw = readFileSync(notesFile, "utf8");
						const parsed = JSON.parse(raw) as { notes: typeof notes };
						notes = parsed.notes ?? [];
					}
					const id = `note-${Date.now()}`;
					notes.push({
						id,
						text,
						color: color || "teal",
						createdAt: new Date().toISOString(),
					});
					await writeFile(
						notesFile,
						JSON.stringify({ notes }, null, 2),
						"utf8",
					);
					res.writeHead(201, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ notes }));
				} catch (addNoteError) {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: String(addNoteError) }));
				}
				return;
			}

			if (requestUrl.pathname === "/api/notes" && req.method === "PUT") {
				try {
					const body = await readRequestBody(req);
					const { id, text, color } = JSON.parse(body) as {
						id: string;
						text?: string;
						color?: string;
					};
					if (!id) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "id is required" }));
						return;
					}
					let notes: Array<{
						id: string;
						text: string;
						color: string;
						createdAt: string;
					}> = [];
					if (existsSync(notesFile)) {
						const raw = readFileSync(notesFile, "utf8");
						const parsed = JSON.parse(raw) as { notes: typeof notes };
						notes = parsed.notes ?? [];
					}
					const idx = notes.findIndex((n) => n.id === id);
					if (idx === -1) {
						res.writeHead(404, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "note not found" }));
						return;
					}
					if (text !== undefined) notes[idx].text = text;
					if (color !== undefined) notes[idx].color = color;
					await writeFile(
						notesFile,
						JSON.stringify({ notes }, null, 2),
						"utf8",
					);
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ notes }));
				} catch (updateNoteError) {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: String(updateNoteError) }));
				}
				return;
			}

			if (requestUrl.pathname === "/api/notes" && req.method === "DELETE") {
				try {
					const noteId = requestUrl.searchParams.get("id");
					if (!noteId) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "id query param required" }));
						return;
					}
					let notes: Array<{
						id: string;
						text: string;
						color: string;
						createdAt: string;
					}> = [];
					if (existsSync(notesFile)) {
						const raw = readFileSync(notesFile, "utf8");
						const parsed = JSON.parse(raw) as { notes: typeof notes };
						notes = parsed.notes ?? [];
					}
					notes = notes.filter((n) => n.id !== noteId);
					await writeFile(
						notesFile,
						JSON.stringify({ notes }, null, 2),
						"utf8",
					);
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ notes }));
				} catch (deleteNoteError) {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: String(deleteNoteError) }));
				}
				return;
			}

			res.writeHead(404, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: "not found" }));
		})();

		requestPromise.catch((error) => {
			if (res.headersSent) {
				return;
			}

			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: String(error) }));
		});
	});
}

export {
	analyticsToRuntimeSession,
	artifactsRoot,
	attachApi,
	buildAnalyticsPayload,
	buildOverviewPayload,
	buildSessionDetailPayload,
	buildWorkflowStepDetailPayload,
	deriveStoryStepStateFromStatus,
	epicsFile,
	fallbackSummary,
	findStoryMarkdown,
	getCompletedSessionSummary,
	getEpicMetadataFromMarkdown,
	getPlannedStoriesFromEpics,
	getStoryContentFromEpics,
	linksFile,
	loadOrCreateRuntimeState,
	loadSprintOverview,
	markZombieAnalyticsSessionsFailed,
	markZombieSessionsAsFailed,
	parseSimpleYamlList,
	readAnalyticsStore,
	readRuntimeStateFile,
	STORY_WORKFLOW_STEPS,
	setBuildMode,
	upsertAnalyticsSession,
};
