# Story 11.6: Decompose API Routes by Domain with Zod Validation

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want the monolithic `attachApi` function decomposed into domain-grouped route handler modules with Zod request body validation, and the links-notes domain extracted,
so that adding or debugging any API endpoint no longer requires navigating a 1,500-line conditional chain, and request payloads are validated at the boundary.

## Acceptance Criteria

1. **Given** the domain modules from Stories 11.1–11.5, **When** the links-notes domain is extracted, **Then** a `scripts/server/links-notes/` folder is created with:
   - `links.ts` containing link types, `linksFile` path, `serializeLinksYaml`, `parseSimpleYamlList`, `stripYamlQuotes`, and YAML constants (`YAML_COMMENT_REGEX`, `LAST_UPDATED_COMMENT_REGEX`)
   - `notes.ts` containing note types, `notesFile` path, and notes CRUD helpers
   - No `index.ts` barrel file — callers import directly from `links.ts` or `notes.ts`

2. **Given** all domain modules exist, **When** the API routes are decomposed, **Then** a `scripts/server/routes/` folder is created with:
   - `overview.ts` handling `/api/overview` and `/api/events/overview`
   - `sessions.ts` handling `/api/session/:id`, `/api/events/session/:id`, `/api/session/:id/input`, `/api/session/:id/start`, `/api/session/:id/abort`
   - `orchestrator.ts` handling `/api/orchestrator/run`, `/api/orchestrator/input`, `/api/orchestrator/run-stage`, `/api/orchestrator/stop`
   - `stories.ts` handling `/api/story/:id`, `/api/story-preview/:id`, `/api/story/:id/mark-review`
   - `epics.ts` handling `/api/epic/:id`
   - `analytics.ts` handling `/api/analytics`, `/api/sessions/regenerate-logs`
   - `workflow.ts` handling `/api/workflow/skip-step`, `/api/workflow/unskip-step`, `/api/workflow/run-skill`, `/api/artifacts/files`
   - `links.ts` handling `/api/links` GET/POST/PUT/DELETE
   - `notes.ts` handling `/api/notes` GET/POST/PUT/DELETE
   - `index.ts` containing the `attachApi` coordinator (~50 lines) that delegates to domain route handlers — **this one file may use a biome-ignore suppression for `noBarrelFile`** since it's an orchestrator, not a pure re-export barrel

3. **Given** route handlers that parse request bodies, **When** JSON bodies are received, **Then** Zod schemas validate request payloads at the route boundary, replacing `parseJsonBody<T>` type assertions with `z.parse()` calls

4. **Given** the final `agent-server.ts`, **When** reviewed, **Then** it contains only imports from `scripts/server/*` modules and the public export block — under 100 lines

5. **Given** the decomposition is complete, **When** `pnpm check` is run, **Then** all quality gates pass with zero regressions

## Tasks / Subtasks

- [ ] Confirm Stories 11.1–11.5 are done (AC: 1, 2, 3, 4)
  - [ ] Check sprint-status.yaml: `11-1` through `11-5` must all be `done` before starting
  - [ ] If any prior story is not done, implement them in order first (or ask maintainer)

- [ ] Extract links-notes domain into `scripts/server/links-notes/` (AC: 1)
  - [ ] Create `scripts/server/links-notes/links.ts`:
    - Move `LinkItem` type (or inline the `{ title; subtitle; url; icon }` shape), `linksFile` path const
    - Move constants: `YAML_COMMENT_REGEX`, `LAST_UPDATED_COMMENT_REGEX` (currently at line ~375–376)
    - Move functions: `parseSimpleYamlList`, `stripYamlQuotes`, `serializeLinksYaml`
    - Export each individually (no barrel `index.ts`)
  - [ ] Create `scripts/server/links-notes/notes.ts`:
    - Move `NoteItem` type (inline shape used in notes handlers), `notesFile` path const
    - Move all notes CRUD helpers (no `index.ts`)

- [ ] Create route handler modules in `scripts/server/routes/` (AC: 2)
  - [ ] `routes/overview.ts` — extract GET `/api/overview` and SSE `/api/events/overview` from `attachApi`; import from `scripts/server/sprint/` domain
  - [ ] `routes/sessions.ts` — extract session GET, SSE events, POST input/start/abort; import from `scripts/server/runtime/` and `scripts/server/logs/`
  - [ ] `routes/orchestrator.ts` — extract `/api/orchestrator/*` handlers; import from `scripts/server/runtime/`
  - [ ] `routes/stories.ts` — extract `/api/story/:id`, `/api/story-preview/:id`, `/api/story/:id/mark-review`; import from `scripts/server/epics/`
  - [ ] `routes/epics.ts` — extract `/api/epic/:id`; import from `scripts/server/epics/`
  - [ ] `routes/analytics.ts` — extract `/api/analytics` and `/api/sessions/regenerate-logs`; import from `scripts/server/analytics/`
  - [ ] `routes/workflow.ts` — extract `/api/workflow/skip-step`, `/api/workflow/unskip-step`, `/api/workflow/run-skill`, `/api/artifacts/files`; import from `scripts/server/runtime/` and `scripts/server/epics/`
  - [ ] `routes/links.ts` — extract all `/api/links` CRUD; import from `scripts/server/links-notes/links.ts`
  - [ ] `routes/notes.ts` — extract all `/api/notes` CRUD; import from `scripts/server/links-notes/notes.ts`
  - [ ] `routes/index.ts` — create `attachApi` coordinator that delegates to all route modules; add `// biome-ignore lint/performance/noBarrelFile: attachApi coordinator — not a pure re-export barrel`

- [ ] Add Zod validation to request body parsing (AC: 3)
  - [ ] Confirm `zod` is installed (added in Story 11.1 via `pnpm add zod`); if not, run `pnpm add zod` in `_bmad-custom/bmad-ui/`
  - [ ] In each route handler with POST/PUT/DELETE body, define a `z.object(...)` schema and call `.parse()` instead of `parseJsonBody<T>()` assertions
  - [ ] Key bodies to validate (see agent-server.ts lines ~4050, ~4345, ~4791, ~4821, ~4902, ~5116, ~5155–5161):
    - Session input: `z.object({ message: z.string().optional() })`
    - Orchestrator run: `z.object({ skill: z.string().optional(), storyId: z.string().optional(), epicId: z.string().optional(), prompt: z.string().optional(), autoResolve: z.boolean().optional() })`
    - Workflow skip/unskip: `z.object({ stepId: z.string().optional() })`
    - Links POST: `z.object({ title: z.string(), subtitle: z.string().optional(), url: z.string(), icon: z.string().optional() })`
    - Links PUT: `z.object({ index: z.number(), title: z.string().optional(), subtitle: z.string().optional(), url: z.string().optional(), icon: z.string().optional() })`
    - Links DELETE: `z.object({ index: z.number() })`
    - Notes POST/PUT/DELETE: define appropriate schemas based on notes shape

- [ ] Reduce `agent-server.ts` to under 100 lines (AC: 4)
  - [ ] Remove all inlined logic from `agent-server.ts` — only import + re-export block should remain
  - [ ] Preserve the existing `export { ... }` block (consumed by `vite.config.ts` and `vite-plugin-static-data.ts`)
  - [ ] Verify all exports still exist via the new domain modules

- [ ] Run full quality gate (AC: 5)
  - [ ] `cd _bmad-custom/bmad-ui && pnpm check` — lint + types + tests + build must all pass

## Dev Notes

### ⚠️ Critical: Story 11.6 Depends on Stories 11.1–11.5

This story is the final step in a sequential decomposition. All of the following must be `done` in sprint-status.yaml before this story can start:

| Story | Domain Extracted |
|-------|-----------------|
| 11.1 | `scripts/server/runtime/` (RuntimeState, RuntimeSession, paths.ts, Zod added) |
| 11.2 | `scripts/server/sprint/` (SprintOverview, sprint summarization) |
| 11.3 | `scripts/server/epics/` (epic markdown parser, dependencies) |
| 11.4 | `scripts/server/logs/` (log events, session detail) |
| 11.5 | `scripts/server/analytics/` (AnalyticsStore, costing, aggregation) |

If any prior stories are in `backlog` or `ready-for-dev` status, implement them first in order. This story's `attachApi` decomposition depends on all domain modules existing.

### ⚠️ Critical: `noBarrelFile` Biome Rule

`biome.json` enforces `"noBarrelFile": "error"` across all files. The epic's target structure specifies `index.ts` re-export files in each domain folder — **these are forbidden** and will fail `pnpm check`.

**Resolution:**
- Do NOT create `index.ts` files in domain folders (`runtime/`, `sprint/`, `epics/`, `logs/`, `analytics/`, `links-notes/`)
- Domain module consumers must import directly: e.g., `import { buildOverviewPayload } from "../sprint/overview"` not `from "../sprint"`
- The **one exception** is `routes/index.ts` which is an orchestrator/coordinator (not a pure re-export), but it still needs a suppression comment:
  ```ts
  // biome-ignore lint/performance/noBarrelFile: routes coordinator — not a pure re-export barrel
  ```
- Check previous story implementations (11.1–11.5) to confirm this was handled correctly before starting 11.6

### Key Files in Current `agent-server.ts`

All source material is in `_bmad-custom/bmad-ui/scripts/agent-server.ts` (5,420 lines):

| Content | Lines (approx) |
|---------|----------------|
| Imports | 1–16 |
| Path constants (`projectRoot`, `artifactsRoot`, `sprintStatusFile`, `epicsFile`, `storyDependenciesFile`, `linksFile`, `notesFile`) | 11–182 |
| Types (StoryStatus, EpicStatus, RuntimeSession, etc.) | 26–200 |
| `YAML_COMMENT_REGEX`, `LAST_UPDATED_COMMENT_REGEX` | ~375–376 |
| `parseSimpleYamlList`, `stripYamlQuotes` | ~3859–3898 |
| `serializeLinksYaml` | ~3900–3912 |
| `attachApi` function (entire routing logic) | ~3914–5392 |
| Export block | 5394–5420 |

### Links-Notes Domain: Exact Functions to Move

**`scripts/server/links-notes/links.ts`** extracts:
```ts
// Constants (lines ~375–376):
const YAML_COMMENT_REGEX = /#.*$/
const LAST_UPDATED_COMMENT_REGEX = /^#\s*last_updated:\s*.*$/m

// Path (line ~181):
const linksFile = path.join(projectRoot, "_bmad-custom", "links.yaml")

// Type:
type LinkItem = { title: string; subtitle: string; url: string; icon: string }

// Functions (lines ~3859–3912):
function parseSimpleYamlList(raw: string, key: string): Array<Record<string, string>>
function stripYamlQuotes(val: string): string
function serializeLinksYaml(links: LinkItem[]): string
```

**`scripts/server/links-notes/notes.ts`** extracts:
```ts
// Path (line ~182):
const notesFile = path.join(projectRoot, "_bmad-custom", "notes.json")

// Type (from inline usage in notes handlers ~5235–5371):
type NoteItem = { id: string; text: string; color: string; createdAt: string }
```

Both files need `import path from "node:path"` and must import `projectRoot` from `scripts/server/paths.ts` (created in Story 11.1).

### Route Handler Module Pattern

Each `routes/*.ts` file should follow this pattern:

```ts
import type { IncomingMessage, ServerResponse } from "node:http"
import { URL } from "node:url"
import { z } from "zod"
// Domain imports (no index.ts — import directly from domain files)
import { buildOverviewPayload } from "../sprint/overview"

// Zod schema for body (defined per-handler, not globally)
const SessionInputBodySchema = z.object({
  message: z.string().optional(),
})

export function registerOverviewRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  requestUrl: URL,
  next: () => void,
): Promise<boolean> {
  // returns true if handled, false to fall through
}
```

The `routes/index.ts` coordinator:
```ts
// biome-ignore lint/performance/noBarrelFile: routes coordinator — not a pure re-export barrel
import type { ViteDevServer } from "vite"
import { registerOverviewRoutes } from "./overview"
// ... all domain route imports

export function attachApi(server: ViteDevServer): void {
  server.middlewares.use((req, res, next) => {
    const requestPromise = (async () => {
      if (!req.url?.startsWith("/api/")) { next(); return }
      const requestUrl = new URL(req.url, "http://localhost")
      // Delegate to domain handlers in priority order
      // ...
    })()
    requestPromise.catch((error) => { /* error handler */ })
  })
}
```

### Zod Validation Pattern (Replacing `parseJsonBody<T>`)

The existing `parseJsonBody<T>` is unsafe — it uses `as T` with no runtime validation. Replace with:

```ts
// Before (unsafe):
const body = await parseJsonBody<{ message?: string }>(req)
const message = body.message?.trim() || ""

// After (safe with Zod):
const rawBody = await readRequestBody(req)  // or keep parseRawBody helper
const body = SessionInputBodySchema.parse(JSON.parse(rawBody))
// Now body.message is type-safe at runtime too
```

For `ZodError`, return 400:
```ts
import { ZodError } from "zod"
// in catch block:
if (error instanceof ZodError) {
  res.writeHead(400, { "Content-Type": "application/json" })
  res.end(JSON.stringify({ error: "Invalid request body", details: error.errors }))
  return
}
```

Note: `parseJsonBody<T>` is defined at line ~1961. It can be kept as an internal utility for routes that don't need Zod validation yet (SSE, GET routes), but all POST/PUT/DELETE body parsing should use Zod schemas.

### Consumers of `agent-server.ts` Exports

These files import from `agent-server.ts` and must NOT break:

| Consumer | Imported symbols |
|----------|-----------------|
| `scripts/vite.config.ts` (or vite config) | `attachApi` |
| `scripts/vite-plugin-static-data.ts` | Various — check imports |

Run `grep -n "from.*agent-server" _bmad-custom/bmad-ui/scripts/*.ts` to confirm all consumers and ensure the export block in the trimmed `agent-server.ts` still exports all required symbols (re-exporting from domain modules).

Current export block (lines 5394–5420) exports:
```
analyticsToRuntimeSession, artifactsRoot, attachApi, buildAnalyticsPayload,
buildOverviewPayload, buildSessionDetailPayload, buildWorkflowStepDetailPayload,
deriveStoryStepStateFromStatus, epicsFile, fallbackSummary, findStoryMarkdown,
getCompletedSessionSummary, getEpicMetadataFromMarkdown, getPlannedStoriesFromEpics,
getStoryContentFromEpics, linksFile, loadOrCreateRuntimeState, loadSprintOverview,
markZombieSessionsAsFailed, parseSimpleYamlList, readAnalyticsStore,
readRuntimeStateFile, STORY_WORKFLOW_STEPS, setBuildMode, upsertAnalyticsSession
```

After decomposition, `agent-server.ts` should look like:
```ts
// ~10–30 import lines from domain modules
import { attachApi } from "./server/routes/index"
import { artifactsRoot, epicsFile, linksFile } from "./server/paths"
import { analyticsToRuntimeSession, buildAnalyticsPayload, ... } from "./server/analytics/aggregation"
// etc.

// ~20 export lines (same as current export block, just re-exporting from domains)
export { attachApi, artifactsRoot, attachApi, buildAnalyticsPayload, ... }
```

### `scripts/server/paths.ts` (from Story 11.1)

Story 11.1 creates `scripts/server/paths.ts` exporting `projectRoot` and `artifactsRoot`. The links-notes domain uses `projectRoot` for `linksFile` and `notesFile`. Import as:

```ts
import { projectRoot } from "../paths"
```

### Biome Config Reference

Key enforced rules (`biome.json`):
- `"noBarrelFile": "error"` — no pure re-export `index.ts` files
- `"noUnusedVariables": "error"` — all vars must be used
- `"noUnusedImports": "error"` — clean up after extraction
- `"useImportType": "error"` — use `import type` for type-only imports
- `"useNumberNamespace": "error"` — `Number.parseInt`, `Number.parseFloat`, etc.
- Formatter: 2-space indent, 100-char line width, double quotes, no semicolons

### Project Structure Notes

- Target location for new files: `_bmad-custom/bmad-ui/scripts/server/links-notes/` and `_bmad-custom/bmad-ui/scripts/server/routes/`
- `agent-server.ts` stays at `_bmad-custom/bmad-ui/scripts/agent-server.ts` — it's the public surface imported by vite config
- No changes to any `src/` files — this is purely a server-side refactor
- No `index.ts` files in domain folders — direct imports only
- The only exception is `routes/index.ts` (coordinator) with biome-ignore comment

### Testing / Verification

After implementation, verify manually (if dev server is available):
1. `pnpm check` passes — this is the primary gate
2. Dev server starts: `pnpm dev` starts without errors
3. At minimum, `/api/overview` and `/api/links` return valid JSON (smoke test)

### References

- Story 11.6 definition: `_bmad-output/planning-artifacts/epics.md` §"Story 11.6" (~lines 1598–1638)
- Epic 11 target structure: `_bmad-output/planning-artifacts/epics.md` §"Epic 11: Agent Server Modularization" (~lines 1435–1476)
- `agent-server.ts` (source of all logic to decompose): `_bmad-custom/bmad-ui/scripts/agent-server.ts`
- `biome.json` (linting rules): `_bmad-custom/bmad-ui/biome.json`
- Project rules: `_bmad-output/project-context.md` §"Critical Don't-Miss Rules"
- Previous story patterns: `_bmad-output/implementation-artifacts/10-4-skill-model-effectiveness-matrix.md` (example of well-formed story)
- `scripts/server/paths.ts` (created in Story 11.1 — import `projectRoot` from here)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
