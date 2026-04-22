# Story 11.4: Extract Logs & Observability Domain

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want log event processing and session detail construction extracted into `scripts/server/logs/` with collocated types,
so that the Copilot CLI log interpretation logic — the core of the observability layer — is navigable and evolvable independently.

## Acceptance Criteria

1. **Given** the runtime domain from Story 11.1, **When** the logs domain is extracted, **Then** a `scripts/server/logs/` folder exists with:
   - `events.ts` — event log processing: `findAllCliEventsJsonl`, `buildLogFromEvents`, `describeToolCall`, `stripAnsi`, `escapeRegExp`, and associated regex constants (`PS_LINE_REGEX`)
   - `session-detail.ts` — `ExternalProcess`, `SessionDetailResponse` types, `SUMMARY_LINE_REGEX`, and functions: `buildCleanLogContent`, `buildSessionDetailPayload`, `getExternalCliProcesses`, `getCompletedSessionSummary`, `extractGeneratedSummary`, `extractLastAssistantBlock`, `fallbackSummary`, `readOptionalTextFile`
   - `index.ts` — re-exports the public API

2. **Given** the extraction is complete, **When** `pnpm check` is run, **Then** lint, types, tests, and build all pass with zero regressions

3. **Given** the original `agent-server.ts` behaviour, **When** compared before and after, **Then** all behaviour is identical — this is a pure refactoring with no functional changes

## Tasks / Subtasks

- [ ] Create `scripts/server/logs/events.ts` (AC: 1)
  - [ ] Move constant: `PS_LINE_REGEX = /^(\d+)\s+([^\s]+)\s+(.+)$/` (agent-server.ts line 349)
  - [ ] Move function: `describeToolCall` (lines 1416–1438) — no external dependencies
  - [ ] Move function: `stripAnsi` (lines 2722–2742) — no external dependencies
  - [ ] Move function: `escapeRegExp` (lines 2640–2642) — no external dependencies
  - [ ] Move function: `findAllCliEventsJsonl` (lines 1440–1525) — needs `SESSION_TIMESTAMP_REGEX`, `SESSION_MATCH_WINDOW_MS`, `copilotSessionStateDir` from runtime domain (import from `../runtime` once 11.1 is done, or from `agent-server.ts` temporarily)
  - [ ] Move function: `buildLogFromEvents` (lines 1527–1628) — calls `describeToolCall` (same file), uses `path` built-in

- [ ] Create `scripts/server/logs/session-detail.ts` (AC: 1)
  - [ ] Move types: `ExternalProcess` (lines 104–108), `SessionDetailResponse` (lines 110–119)
  - [ ] Move constant: `SUMMARY_LINE_REGEX = /(?:^|\n)(?:summary|resumen)\s*:\s*(.+)$/im` (line 362)
  - [ ] Move function: `readOptionalTextFile` (lines 2921–2937) — uses `readFile`, `existsSync`
  - [ ] Move function: `extractGeneratedSummary` (lines 2744–2768) — calls `stripAnsi` (import from `./events`)
  - [ ] Move function: `extractLastAssistantBlock` (lines 2770–2818) — calls `stripAnsi` (import from `./events`)
  - [ ] Move function: `fallbackSummary` (lines 2847–2869) — uses `StoryWorkflowStepSkill`, `WorkflowStepState` types (import from sprint domain `../sprint` if Story 11.2 done, else from `agent-server.ts`)
  - [ ] Move function: `buildCleanLogContent` (lines 1630–1654) — calls `findAllCliEventsJsonl` (import from `./events`)
  - [ ] Move function: `getExternalCliProcesses` (lines 1974–2009) — calls `execFileAsync` (declare locally via `promisify(execFile)`), uses `PS_LINE_REGEX` (import from `./events`), uses `buildMode` (import from runtime domain `../runtime`)
  - [ ] Move function: `getCompletedSessionSummary` (lines 2820–2845) — uses `SessionAnalyticsData` type (import from analytics domain `../analytics` if Story 11.5 done, else from `agent-server.ts`), calls `extractGeneratedSummary`
  - [ ] Move function: `buildSessionDetailPayload` (lines 1926–1959) — calls `readAnalyticsStore`, `markZombieAnalyticsSessionsFailed`, `analyticsToRuntimeSession` (import from analytics/runtime when ready), calls `stripAnsi` (import from `./events`), `buildCleanLogContent`, `readOptionalTextFile`, `extractLastAssistantBlock`; reads `runningSessionProcesses` (import from runtime domain)

- [ ] Create `scripts/server/logs/index.ts` (AC: 1)
  - [ ] Re-export everything public from `./events` and `./session-detail`
  - [ ] Add `// biome-ignore lint/performance/noBarrelFile: domain public API boundary`

- [ ] Update `agent-server.ts` to import from domain module (AC: 2, 3)
  - [ ] Replace all inline type/function definitions with imports from `./server/logs`
  - [ ] Ensure all existing named exports (`buildSessionDetailPayload`, `fallbackSummary`, `getCompletedSessionSummary`) remain exported from `agent-server.ts` (they appear in the export block at line 5394)
  - [ ] Remove the now-dead definitions from `agent-server.ts`

- [ ] Run quality gate (AC: 2)
  - [ ] `cd _bmad-custom/bmad-ui && pnpm check` — lint + types + tests + build must pass

## Dev Notes

### This is a Pure Refactoring Story

**Zero functional changes.** Every function extracted must behave identically. No new logic, no changed signatures, no renamed variables.

### Project Root

The project lives at `_bmad-custom/bmad-ui/`. All commands must be run from there:
- `scripts/agent-server.ts` — the monolith (~5,420 lines at story creation)
- `scripts/server/` — target folder for all extracted domain modules (created by Story 11.1)

New files to create:
```
scripts/server/
└── logs/
    ├── events.ts           — findAllCliEventsJsonl, buildLogFromEvents, describeToolCall, stripAnsi, escapeRegExp, PS_LINE_REGEX
    ├── session-detail.ts   — ExternalProcess, SessionDetailResponse, buildSessionDetailPayload, + helpers
    └── index.ts            — re-exports
```

### Dependency Order Constraint

Story 11.4 depends on Story 11.1 (runtime domain) being complete. The logs domain imports from `../runtime`:
- `SESSION_TIMESTAMP_REGEX`, `SESSION_MATCH_WINDOW_MS` — used in `findAllCliEventsJsonl`
- `copilotSessionStateDir` — used in `findAllCliEventsJsonl`
- `buildMode` — used in `getExternalCliProcesses`
- `runningSessionProcesses` — used in `buildSessionDetailPayload`
- `markZombieAnalyticsSessionsFailed` — used in `buildSessionDetailPayload`

If Stories 11.2 and 11.3 are also done before this, import from their domains. If not, import the types temporarily from `agent-server.ts`. **Never re-define** types or functions that already live in a completed domain module.

### Cross-Domain Imports for Story 11.4

At the time Story 11.4 is implemented, the cross-domain import plan:

| Symbol | Origin domain | Import from |
|--------|--------------|-------------|
| `SESSION_TIMESTAMP_REGEX` | runtime (11.1) | `../runtime` |
| `SESSION_MATCH_WINDOW_MS` | runtime (11.1) | `../runtime` |
| `copilotSessionStateDir` | runtime (11.1) | `../runtime` |
| `buildMode` | runtime (11.1) | `../runtime` |
| `runningSessionProcesses` | runtime (11.1) | `../runtime` |
| `markZombieAnalyticsSessionsFailed` | runtime (11.1) | `../runtime` |
| `analyticsToRuntimeSession` | analytics (11.5) | `../../scripts/agent-server` (until 11.5) |
| `readAnalyticsStore` | analytics (11.5) | `../../scripts/agent-server` (until 11.5) |
| `SessionAnalyticsData` | analytics (11.5) | `../../scripts/agent-server` (until 11.5) |
| `StoryWorkflowStepSkill` | sprint (11.2) | `../sprint` if done, else `../../scripts/agent-server` |
| `WorkflowStepState` | sprint (11.2) | `../sprint` if done, else `../../scripts/agent-server` |

**Critical:** Use relative imports from `./server/logs/` to `./server/runtime/` as `../runtime`. Never import from `../../agent-server` for symbols that are already in a completed domain module.

### `noBarrelFile` Biome Rule

`noBarrelFile` is enforced (`biome.json` line 19: `"noBarrelFile": "error"`). All `index.ts` files in domain folders must suppress it:

```ts
// biome-ignore lint/performance/noBarrelFile: domain public API boundary
export * from "./events"
export * from "./session-detail"
```

### `stripAnsi` Is Shared

`stripAnsi` lives in `events.ts` per the spec, but is **also used by the analytics domain** (`parseTokenUsageFromLog`, line 3187). When Story 11.5 (analytics) is implemented, it must import `stripAnsi` from `../logs/events` (or `../logs`). Do not duplicate the function.

### `escapeRegExp` Is Shared

`escapeRegExp` lives in `events.ts` per the spec, but is also used in:
- `updateSprintStoryStatus` (epics domain, Story 11.3)  
- The `attachApi` route handler directly (line 4520)

When those stories are implemented, they import from `../logs/events`. This story only moves the definition — do not change any call sites beyond the ones in the functions being extracted here.

### Key Function Details

**`findAllCliEventsJsonl` (events.ts):**
- Matches BMAD session timestamps to CLI session `workspace.yaml` files
- Uses `SESSION_MATCH_WINDOW_MS = 30_000` (30-second match window)
- Directory scanned: `copilotSessionStateDir` = `~/.copilot/session-state/`
- Returns array of `events.jsonl` paths sorted chronologically

**`buildLogFromEvents` (events.ts):**
- Parses JSONL from CLI session events files
- Handles event types: `user.message`, `assistant.message`, `tool.execution_complete`
- Formats tool calls with `describeToolCall` lookup map
- Returns formatted log string (no ANSI — CLI events are already plain text)

**`getExternalCliProcesses` (session-detail.ts):**
- Runs `ps -ax -o pid=,etime=,command=` via `execFileAsync`
- Guards with `buildMode` check (returns `[]` in build mode)
- Filters for copilot/orchestrator/bmad processes (max 12 results)
- `execFileAsync` must be declared locally: `const execFileAsync = promisify(execFile)` — do not import it from agent-server

**`buildSessionDetailPayload` (session-detail.ts):**
- Reads analytics store to get session data
- Calls `markZombieAnalyticsSessionsFailed` to ensure fresh state
- Builds clean log from events or falls back to raw stripped log
- Checks `runningSessionProcesses` to determine `isRunning` and `canSendInput`

**`fallbackSummary` (session-detail.ts):**
- Uses `StoryWorkflowStepSkill` and `WorkflowStepState` types
- Pure function — no I/O

### ESM Import Style

The `scripts/` folder uses ES Modules (`"type": "module"` in package.json). All imports must use explicit file extensions or directory index resolution. When importing Node built-ins, use `node:` prefix:

```ts
import { existsSync } from "node:fs"
import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
```

### Named Exports From `agent-server.ts` That Must Stay Working

The `vite-plugin-static-data.ts` imports these from `agent-server.ts` — they must remain re-exported after this story:

```ts
buildSessionDetailPayload, fallbackSummary, getCompletedSessionSummary
```

After moving to the logs domain, add them back to the `export { ... }` block at the bottom of `agent-server.ts` via re-import from `./server/logs`.

### TypeScript Strict Mode Gotchas

- `noUnusedLocals: true` and `noUnusedParameters: true` — every import must be used
- `useImportType` Biome rule — use `import type { ... }` for all type-only imports
- `useNumberNamespace` — use `Number.isNaN`, `Number.isFinite` (already correct in source)
- Line width: 100 chars (Biome formatter)

### Source Line Reference (agent-server.ts at story creation, 5,420 lines)

| Symbol | Lines |
|--------|-------|
| `ExternalProcess` type | 104–108 |
| `SessionDetailResponse` type | 110–119 |
| `PS_LINE_REGEX` | 349 |
| `SUMMARY_LINE_REGEX` | 362 |
| `describeToolCall` | 1416–1438 |
| `findAllCliEventsJsonl` | 1440–1525 |
| `buildLogFromEvents` | 1527–1628 |
| `buildCleanLogContent` | 1630–1654 |
| `buildSessionDetailPayload` | 1926–1959 |
| `getExternalCliProcesses` | 1974–2009 |
| `escapeRegExp` | 2640–2642 |
| `stripAnsi` | 2722–2742 |
| `extractGeneratedSummary` | 2744–2768 |
| `extractLastAssistantBlock` | 2770–2818 |
| `getCompletedSessionSummary` | 2820–2845 |
| `fallbackSummary` | 2847–2869 |
| `readOptionalTextFile` | 2921–2937 |
| Export block | 5394–5420 |

### References

- Story requirements: [Source: _bmad-output/planning-artifacts/epics.md#Story 11.4]
- Epic decomposition principles: [Source: _bmad-output/planning-artifacts/epics.md#Epic 11]
- Three-boundary architecture: [Source: _bmad-output/planning-artifacts/architecture.md]
- Source monolith: `_bmad-custom/bmad-ui/scripts/agent-server.ts` (5,420 lines)
- Previous story pattern: `_bmad-output/implementation-artifacts/11-1-extract-runtime-domain.md`
- Consumer: `_bmad-custom/bmad-ui/scripts/vite-plugin-static-data.ts`
- Consumer: `_bmad-custom/bmad-ui/vite.config.ts`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
