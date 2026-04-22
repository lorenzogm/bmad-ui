import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import {
  DEFAULT_WORKFLOW_MODEL,
  getEpicIdFromStoryId,
  persistSessionAnalytics,
  readAnalyticsStore,
  sessionToAnalyticsUpdate,
  SKILL_MODEL_OVERRIDES,
  upsertAnalyticsSession,
  zeroUsage,
} from "../analytics/index.js";
import {
  buildAgentCommand,
  buildAutoResolveInstructions,
  createRuntimeSession,
  ensureRunningProcessStateIsFresh,
  incrementSessionIdCounter,
  runningSessionProcesses,
  setActiveWorkflowSkill,
  startRuntimeSession,
} from "../runtime/index.js";
import { loadStoryDependencies } from "../epics/index.js";
import { agentsDir, artifactsRoot } from "../paths.js";
import { parseJsonBody } from "./utils.js";

const WORKFLOW_STEP_DETAIL_PATH_REGEX =
  /^\/api\/workflow-step\/(planning|solutioning)\/(prd|ux|architecture)$/;

const runtimeLogsDir = path.join(agentsDir, "logs");

const workflowSkipSchema = z.object({ stepId: z.string().optional() });
const workflowRunSkillSchema = z.object({
  skill: z.string().optional(),
  storyId: z.string().optional(),
  epicId: z.string().optional(),
  prompt: z.string().optional(),
  autoResolve: z.boolean().optional(),
});

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
        (f) =>
          f.toLowerCase().includes("architecture") && f.endsWith(".md"),
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

export async function buildWorkflowStepDetailPayload(
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

const MAX_CUSTOM_PROMPT_LENGTH = 10_000;
const EXCLUSIVE_SKILLS = new Set(["bmad-dev-story", "bmad-code-review"]);

export async function handleWorkflowRoutes(
  requestUrl: URL,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  if (requestUrl.pathname === "/api/workflow/skip-step" && req.method === "POST") {
    try {
      const rawBody = await parseJsonBody<unknown>(req);
      const body = workflowSkipSchema.parse(rawBody);
      const stepId = body.stepId?.trim();
      if (!stepId || !/^[a-z0-9-]+$/.test(stepId)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "valid stepId is required" }));
        return true;
      }
      const skipFilePath = path.join(
        artifactsRoot,
        "planning-artifacts",
        `${stepId}.skipped`,
      );
      await mkdir(path.join(artifactsRoot, "planning-artifacts"), { recursive: true });
      await writeFile(skipFilePath, "", "utf8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "skipped", stepId }));
    } catch (skipError) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(skipError) }));
    }
    return true;
  }

  if (requestUrl.pathname === "/api/workflow/unskip-step" && req.method === "POST") {
    try {
      const rawBody = await parseJsonBody<unknown>(req);
      const body = workflowSkipSchema.parse(rawBody);
      const stepId = body.stepId?.trim();
      if (!stepId || !/^[a-z0-9-]+$/.test(stepId)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "valid stepId is required" }));
        return true;
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
    return true;
  }

  if (requestUrl.pathname === "/api/artifacts/files" && req.method === "GET") {
    const dir = requestUrl.searchParams.get("dir") ?? "planning";
    const dirPath = path.join(
      artifactsRoot,
      dir === "implementation" ? "implementation-artifacts" : "planning-artifacts",
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
    return true;
  }

  const workflowStepDetailMatch = WORKFLOW_STEP_DETAIL_PATH_REGEX.exec(requestUrl.pathname);
  if (workflowStepDetailMatch && req.method === "GET") {
    try {
      const phaseId = workflowStepDetailMatch[1];
      const stepId = workflowStepDetailMatch[2];
      const payload = await buildWorkflowStepDetailPayload(phaseId, stepId);
      if (!payload) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ error: `workflow step not found: ${phaseId}/${stepId}` }),
        );
        return true;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
    } catch (stepError) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(stepError) }));
    }
    return true;
  }

  if (requestUrl.pathname === "/api/workflow/run-skill" && req.method === "POST") {
    try {
      ensureRunningProcessStateIsFresh();

      const rawBody = await parseJsonBody<unknown>(req);
      const body = workflowRunSkillSchema.parse(rawBody);
      const skill = body.skill?.trim();
      const storyId = body.storyId?.trim() || null;
      const epicId = body.epicId?.trim() || null;
      const rawPrompt = body.prompt?.trim() || null;
      const autoResolve = body.autoResolve === true;

      if (!skill) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "skill is required" }));
        return true;
      }

      if (rawPrompt && (storyId || epicId)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ error: "prompt cannot be combined with storyId or epicId" }),
        );
        return true;
      }

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
        return true;
      }

      if (storyId && runningSessionProcesses.size > 0) {
        const storeForDupCheck = await readAnalyticsStore();
        const duplicateSession = Object.entries(storeForDupCheck.sessions).find(
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
          return true;
        }
      }

      if (EXCLUSIVE_SKILLS.has(skill) && runningSessionProcesses.size > 0) {
        const storeForConflictCheck = await readAnalyticsStore();
        const deps = loadStoryDependencies();

        const runningStoryIds = new Set<string>();
        for (const [runId, runSess] of Object.entries(storeForConflictCheck.sessions)) {
          if (runningSessionProcesses.has(runId) && runSess.storyId) {
            runningStoryIds.add(runSess.storyId);
          }
        }

        const hasConflict =
          storyId !== null &&
          [...runningStoryIds].some((runningId) => {
            const newDeps = deps[storyId] ?? [];
            const runningDeps = deps[runningId] ?? [];
            return (
              newDeps.includes(runningId) || runningDeps.includes(storyId)
            );
          });

        const sameStoryRunning = storyId !== null && runningStoryIds.has(storyId);

        if (hasConflict || sameStoryRunning) {
          res.writeHead(409, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "another orchestrator task is running" }));
          return true;
        }
      }

      await mkdir(runtimeLogsDir, { recursive: true });

      const timestamp = Date.now();
      const sessionId = `workflow-${skill}-${timestamp}-${incrementSessionIdCounter()}`;
      const promptPath = path.join(runtimeLogsDir, `${sessionId}.prompt.txt`);
      const logPath = path.join(runtimeLogsDir, `${sessionId}.log`);

      const skillModel = SKILL_MODEL_OVERRIDES[skill] ?? DEFAULT_WORKFLOW_MODEL;

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
            ...(autoResolveInstructions ? ["", autoResolveInstructions] : []),
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

      await startRuntimeSession(session, {
        upsertSession: upsertAnalyticsSession,
        toAnalyticsUpdate: sessionToAnalyticsUpdate,
        persistSessionAnalytics,
      });
      setActiveWorkflowSkill(skill);

      res.writeHead(202, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "started", sessionId }));
    } catch (runSkillError) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(runSkillError) }));
    }
    return true;
  }

  return false;
}
