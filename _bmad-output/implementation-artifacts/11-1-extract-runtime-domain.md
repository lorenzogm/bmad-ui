# Story 11.1: Extract Runtime Domain

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want the runtime state management and session lifecycle domain extracted into `scripts/server/runtime/` with collocated types, constants, and Zod schemas,
so that the orchestrator runtime contract — how sessions are created, started, monitored, and cleaned up — lives in one focused domain folder.

## Acceptance Criteria

1. **Given** `agent-server.ts`, **When** the runtime domain is extracted, **Then** a `scripts/server/runtime/` folder exists with:
   - `state.ts` — `RuntimeState` type, Zod schema for runtime-state.json reads (replacing `as RuntimeState` assertions), and functions: `persistRuntimeState`, `readRuntimeStateFile`, `createEmptyRuntimeState`, `loadOrCreateRuntimeState`, `createRuntimeSession`
   - `sessions.ts` — `RuntimeSession` type and functions: `startRuntimeSession`, `isChildProcessAlive`, `resetRunningProcessState`, `ensureRunningProcessStateIsFresh`, `markZombieSessionsAsFailed`, `markZombieAnalyticsSessionsFailed`, `buildAutoResolveInstructions`, `buildAgentCommand`, plus `runningSessionProcesses` state
   - `index.ts` — re-exports the public API of both files

2. **Given** Zod is not yet a project dependency, **When** this story begins, **Then** Zod is added via `pnpm add zod`

3. **Given** `scripts/server/paths.ts` does not yet exist, **When** this story is implemented, **Then** a minimal `scripts/server/paths.ts` is created exporting only `projectRoot` and `artifactsRoot` (derived from `__dirname`/`import.meta.url`), used by all domain modules that need base path resolution

4. **Given** the extraction is complete, **When** `pnpm check` is run, **Then** lint, types, tests, and build all pass with zero regressions

5. **Given** existing consumers of `agent-server.ts` (`vite.config.ts`, `vite-plugin-static-data.ts`), **When** they import from `agent-server.ts`, **Then** all imports continue to work without changes — `agent-server.ts` re-exports everything from domain modules

## Tasks / Subtasks

- [ ] Add Zod dependency (AC: 2)
  - [ ] `cd _bmad-ui && pnpm add zod`
  - [ ] Verify Zod is listed in `package.json` dependencies

- [ ] Create `scripts/server/paths.ts` (AC: 3)
  - [ ] Export `projectRoot` — `path.resolve(__dirname, "..", "..", "..")` (ESM-safe: derive from `import.meta.url` via `fileURLToPath`)
  - [ ] Export `artifactsRoot` — `path.join(projectRoot, "_bmad-output")`
  - [ ] Keep the file ≤10 lines; no other exports

- [ ] Create `scripts/server/runtime/state.ts` (AC: 1)
  - [ ] Move `RuntimeState` type and `RuntimeSession` type (they are mutually referenced — `RuntimeState` has a `sessions: RuntimeSession[]` field, keep both types together in `state.ts`)
  - [ ] Define Zod schema `runtimeStateSchema` that mirrors `RuntimeState`; use it in `readRuntimeStateFile` instead of `JSON.parse(...) as RuntimeState`
  - [ ] Move `runtimeStatePath` constant (derived from `paths.ts` → `agentsDir`)
  - [ ] Move functions: `persistRuntimeState`, `readRuntimeStateFile`, `createEmptyRuntimeState`, `loadOrCreateRuntimeState`, `createRuntimeSession`

- [ ] Create `scripts/server/runtime/sessions.ts` (AC: 1)
  - [ ] Move module-level mutable state: `runningProcess`, `runningSessionProcesses`, `runningProcessCanAcceptInput`, `runningProcessKind`, `activeWorkflowSkill`, `sessionIdCounter`
  - [ ] Move functions: `isChildProcessAlive`, `resetRunningProcessState`, `ensureRunningProcessStateIsFresh`, `markZombieSessionsAsFailed`, `markZombieAnalyticsSessionsFailed`, `buildAutoResolveInstructions`, `buildAgentCommand`, `startRuntimeSession`
  - [ ] `startRuntimeSession` depends on `persistRuntimeState` and `upsertAnalyticsSession` — import from `state.ts` and analytics domain respectively (at this stage analytics functions remain in `agent-server.ts`; import from there)
  - [ ] `setBuildMode` getter/setter must also move here (it guards zombie detection)

- [ ] Create `scripts/server/runtime/index.ts` (AC: 1)
  - [ ] Re-export everything public from `state.ts` and `sessions.ts`
  - [ ] **IMPORTANT:** `noBarrelFile` Biome rule is enforced — however, this `index.ts` is a domain public API boundary, not a convenience barrel. Use `// biome-ignore lint/performance/noBarrelFile: domain public API` to suppress if needed

- [ ] Update `agent-server.ts` to import from domain modules (AC: 4, 5)
  - [ ] Replace inline type/function definitions with imports from `./server/runtime`
  - [ ] Replace inline `projectRoot`/`artifactsRoot` constants with imports from `./server/paths`
  - [ ] Ensure all existing named exports (`attachApi`, `setBuildMode`, all functions imported by `vite-plugin-static-data.ts`) remain exported from `agent-server.ts`
  - [ ] The file should shrink by ~400 lines but retain full re-export surface

- [ ] Run quality gate (AC: 4)
  - [ ] `cd _bmad-ui && pnpm check` — lint + types + tests + build must pass

## Dev Notes

### This is a Pure Refactoring Story

**Zero functional changes.** Every function extracted must behave identically. The only observable change is file organization and the addition of Zod validation replacing `as RuntimeState` type assertions for safer JSON reads.

### Project Root

The project lives at `_bmad-ui/`. All script paths are relative to there:
- `scripts/agent-server.ts` — the 5,420-line monolith being modularized
- `scripts/vite-plugin-static-data.ts` — also imports from `agent-server.ts`
- `vite.config.ts` — imports `attachApi` from `./scripts/agent-server`

The new target structure for this story:
```
scripts/server/
├── paths.ts                 — projectRoot + artifactsRoot (~8 lines)
└── runtime/
    ├── index.ts             — re-exports
    ├── state.ts             — RuntimeState, Zod schema, persistence, creation
    └── sessions.ts          — RuntimeSession lifecycle, process mgmt, zombie detection
```

### ESM-Safe `__dirname` Pattern

`agent-server.ts` currently uses:
```ts
const __agentServerDirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : fileURLToPath(new URL(".", import.meta.url));
```

`paths.ts` must use the same ESM-safe pattern since `tsconfig.json` uses `"module": "ESNext"`. The `scripts/` folder is not bundled by Vite — it runs in Node.js directly as ES modules.

### Zod Schema for RuntimeState

The existing `readRuntimeStateFile` uses:
```ts
return JSON.parse(await readFile(runtimeStatePath, "utf8")) as RuntimeState;
```

Replace with a Zod parse to validate at runtime:
```ts
import { z } from "zod";

const runtimeSessionSchema = z.object({ ... });
const runtimeStateSchema = z.object({ ... });

async function readRuntimeStateFile(): Promise<RuntimeState | null> {
  if (!existsSync(runtimeStatePath)) return null;
  const raw = await readFile(runtimeStatePath, "utf8");
  return runtimeStateSchema.parse(JSON.parse(raw));
}
```

Use `.passthrough()` on any nested object that may have extra fields (the schema should validate the critical fields and pass through unknown ones to avoid breaking on state file evolution).

### `noBarrelFile` Biome Rule

The project enforces `noBarrelFile`. The `index.ts` files in domain folders serve as explicit public API boundaries, not convenience re-exports. Suppress with:
```ts
// biome-ignore lint/performance/noBarrelFile: domain public API boundary
export * from "./state"
export * from "./sessions"
```

### Key Functions Being Extracted

**`state.ts` extractions (lines ~432–566):**
- `persistRuntimeState` — writes runtime-state.json with updated `updatedAt`
- `readRuntimeStateFile` — reads + parses JSON (add Zod here)
- `createEmptyRuntimeState` — returns a fresh `RuntimeState` object
- `loadOrCreateRuntimeState` — reads or creates state, persists if new
- `createRuntimeSession` — factory for `RuntimeSession` objects

**`sessions.ts` extractions (lines ~211–876):**
- Module-level mutable state: `runningProcess`, `runningSessionProcesses` (Map), `runningProcessCanAcceptInput`, `runningProcessKind`, `activeWorkflowSkill`, `sessionIdCounter`, `buildMode`/`setBuildMode`
- `isChildProcessAlive` — checks `exitCode`, `killed`, and `process.kill(pid, 0)`
- `resetRunningProcessState` — resets `runningProcess`, `runningProcessCanAcceptInput`, `runningProcessKind`
- `ensureRunningProcessStateIsFresh` — calls `isChildProcessAlive`, resets if dead
- `markZombieSessionsAsFailed` — RuntimeState zombie detection (checks log file presence)
- `markZombieAnalyticsSessionsFailed` — SessionAnalyticsData[] zombie detection
- `buildAutoResolveInstructions` — returns skill-specific orchestration instructions
- `buildAgentCommand` — builds copilot CLI command string from model + prompt path
- `startRuntimeSession` — spawns child process, sets up stdout/stderr piping, handles `close`/`error` events, handles worktree merge/cleanup

### Dependency Chain Warning

`startRuntimeSession` has deep internal dependencies on functions that belong to **other domains** (analytics, sprint). These will be extracted in later stories. For Story 11.1, keep these cross-domain calls as imports **from the original `agent-server.ts`** to avoid a circular dependency disaster:
- `upsertAnalyticsSession` — stays in `agent-server.ts` until Story 11.5
- `sessionToAnalyticsUpdate` — stays in `agent-server.ts` until Story 11.5
- `persistSessionAnalytics` — stays in `agent-server.ts` until Story 11.5
- `updateSprintStoryStatus` — stays in `agent-server.ts` until Story 11.3

**Do not try to extract analytics or sprint functions in this story.** Scope is strictly the runtime domain.

### Consumer Imports That Must Keep Working

`vite-plugin-static-data.ts` imports these names from `agent-server.ts`:
```ts
STORY_WORKFLOW_STEPS, analyticsToRuntimeSession, buildAnalyticsPayload,
buildOverviewPayload, buildSessionDetailPayload, buildWorkflowStepDetailPayload,
deriveStoryStepStateFromStatus, epicsFile, fallbackSummary, findStoryMarkdown,
getCompletedSessionSummary, getEpicMetadataFromMarkdown, getPlannedStoriesFromEpics,
getStoryContentFromEpics, linksFile, parseSimpleYamlList, readAnalyticsStore,
setBuildMode
```

`vite.config.ts` imports: `attachApi`

All of these must remain importable from `agent-server.ts` after this story. The ones moved to the runtime domain (`setBuildMode` and any runtime types) must be re-exported from `agent-server.ts`.

### Path Constants That Live in `paths.ts`

```ts
// agent-server.ts currently (lines ~161–182):
const projectRoot = path.resolve(__agentServerDirname, "..", "..", "..");
const artifactsRoot = path.join(projectRoot, "_bmad-output");
```

These two constants move to `scripts/server/paths.ts`. The other path constants (`agentsDir`, `runtimeStatePath`, `runtimeLogsDir`, `analyticsStorePath`, etc.) stay in `agent-server.ts` or move to their respective domain files (runtime domain gets `runtimeStatePath`/`runtimeLogsDir`).

### TypeScript Strict Mode Considerations

- `tsconfig.json` has `"strict": true`, `"noUnusedLocals": true`, `"noUnusedParameters": true`
- When moving mutable module-level `let` variables, ensure they remain in the same module scope they're mutated in — don't move a variable without also moving its mutators
- `SessionAnalyticsData` type is referenced in `sessions.ts` (`markZombieAnalyticsSessionsFailed`) — it stays defined in `agent-server.ts` for now; import it from there

### Build System Note

`tsconfig.json` `include` only covers `src`, `vite.config.ts`, and `src/vite-env.d.ts`. The `scripts/` folder is **not** covered by the project `tsconfig.json` — it's run directly by Vite/Node via `tsx` or similar. Type errors in `scripts/` are caught by Vite at dev-server startup, not by `tsc --noEmit`. However, `pnpm check` includes a build step (`tsc --noEmit && vite build`) which will catch any import errors.

### References

- Story requirements: [Source: _bmad-output/planning-artifacts/epics.md#Story 11.1]
- Epic decomposition principles: [Source: _bmad-output/planning-artifacts/epics.md#Epic 11]
- Three-boundary architecture: [Source: _bmad-output/planning-artifacts/architecture.md#Adapter/API Layer]
- Source monolith: `_bmad-ui/scripts/agent-server.ts` (5,420 lines as of story creation)
- Consumer: `_bmad-ui/scripts/vite-plugin-static-data.ts`
- Consumer: `_bmad-ui/vite.config.ts`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
