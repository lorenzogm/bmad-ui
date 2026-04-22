# Story 11.5: Extract Analytics Domain

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want all analytics computation, token usage parsing, costing models, and session deduplication extracted into `scripts/server/analytics/` with collocated types and Zod schemas,
so that the analytics engine — the data processing pipeline for session metrics — can evolve independently.

## Acceptance Criteria

1. **Given** the runtime and logs domains from prior stories (11.1–11.4), **When** the analytics domain is extracted, **Then** a `scripts/server/analytics/` folder exists with:
   - `store.ts` — `AgentSession`, `AnalyticsStore` types, Zod schemas for agent-sessions.json entry validation (replacing `as` assertions), `analyticsStorePath`, and functions: `readAnalyticsStore`, `persistAnalyticsStore`, `upsertAnalyticsSession`, `backfillAnalyticsStore`, `persistSessionAnalytics`
   - `costing.ts` — `TokenUsageData`, `SessionAnalyticsData`, `AnalyticsRatesUsdData`, `AnalyticsEstimatedCostUsdData`, `AnalyticsCostingData` types, costing constants (`DEFAULT_STAGE_MODELS`, `DEFAULT_WORKFLOW_MODEL`, `SKILL_MODEL_OVERRIDES`), and functions: `zeroUsage`, `addUsage`, `normalizeAnalyticsCosting`, `parseTokenUsageFromLog`, `parseTokenCount`, `toNullableNumber`
   - `aggregation.ts` — dedup/validation constants (`SESSION_DEDUP_WINDOW_MS`, `STALE_SESSION_THRESHOLD_MS`), `ANALYTICS_*` regex patterns, and functions: `deduplicateSessions`, `validateRunningStatus`, `buildAnalyticsPayload`, `getEpicIdFromStoryId`, `inferSkillFromLogFilename`, `inferStoryIdFromLogFilename`, `parseRuntimeStateRobust`, `analyticsToRuntimeSession`, `sessionToAnalyticsUpdate`
   - `index.ts` — re-exports the public API of all three files

2. **Given** the extraction is complete, **When** `pnpm check` is run, **Then** lint, types, tests, and build all pass with zero regressions

3. **Given** the original `agent-server.ts` behavior, **When** compared before and after, **Then** all behavior is identical — this is a pure refactoring with no functional changes

4. **Given** consumers (`vite-plugin-static-data.ts`, `vite.config.ts`) that import from `agent-server.ts`, **When** they import named exports, **Then** all imports continue to work — `agent-server.ts` re-exports from domain modules

## Tasks / Subtasks

- [ ] Create `scripts/server/analytics/costing.ts` (AC: 1)
  - [ ] Move types: `TokenUsageData`, `SessionAnalyticsData`, `AnalyticsRatesUsdData`, `AnalyticsEstimatedCostUsdData`, `AnalyticsCostingData`
  - [ ] Move constants: `DEFAULT_STAGE_MODELS`, `DEFAULT_WORKFLOW_MODEL`, `SKILL_MODEL_OVERRIDES`
  - [ ] Move functions: `zeroUsage`, `addUsage`, `toNullableNumber`, `normalizeAnalyticsCosting`, `parseTokenCount`, `parseTokenUsageFromLog`
  - [ ] Add `AgentSession` type here (it is defined at line 143 and belongs with analytics types)

- [ ] Create `scripts/server/analytics/store.ts` (AC: 1)
  - [ ] Import `TokenUsageData`, `SessionAnalyticsData`, `AgentSession`, `AnalyticsCostingData` from `./costing`
  - [ ] Move `analyticsStorePath` constant (derived from `agentsDir` which comes from `paths.ts`)
  - [ ] Move `legacyAnalyticsStorePaths` and `agentSessionsPath` constants
  - [ ] Define `AnalyticsStore` type
  - [ ] Define Zod schema `agentSessionSchema` (replaces `as AgentSession` assertions in `readAnalyticsStore`)
  - [ ] Define Zod schema `analyticsStoreSchema` (validates top-level shape of agent-sessions.json)
  - [ ] Move functions: `readAnalyticsStore`, `persistAnalyticsStore`, `upsertAnalyticsSession`, `backfillAnalyticsStore`, `persistSessionAnalytics`
  - [ ] `backfillAnalyticsStore` depends on `parseRuntimeStateRobust` (moves to `aggregation.ts`) — import from `./aggregation` after both files exist, or use a lazy import to avoid circular deps

- [ ] Create `scripts/server/analytics/aggregation.ts` (AC: 1)
  - [ ] Move regex constants: `ANALYTICS_REQUESTS_LINE_REGEX`, `ANALYTICS_TOKENS_LINE_REGEX`, `ANALYTICS_OLD_STYLE_SESSION_REGEX`, `ANALYTICS_EPIC_SESSION_REGEX`
  - [ ] Move dedup/validation constants: `SESSION_DEDUP_WINDOW_MS`, `STALE_SESSION_THRESHOLD_MS`
  - [ ] Move functions: `getEpicIdFromStoryId`, `inferSkillFromLogFilename`, `inferStoryIdFromLogFilename`, `parseRuntimeStateRobust`, `deduplicateSessions`, `validateRunningStatus`, `analyticsToRuntimeSession`, `sessionToAnalyticsUpdate`, `buildAnalyticsPayload`
  - [ ] `validateRunningStatus` reads `runningSessionProcesses` (mutable state in `runtime/sessions.ts`) — import `runningSessionProcesses` from the runtime domain
  - [ ] `buildAnalyticsPayload` calls `backfillAnalyticsStore` (in `store.ts`) and `normalizeAnalyticsCosting` (in `costing.ts`) — import both
  - [ ] `parseRuntimeStateRobust` reads `runtimeStatePath` — import from `runtime/state.ts` (established in 11.1)

- [ ] Create `scripts/server/analytics/index.ts` (AC: 1)
  - [ ] Re-export all public API from `store.ts`, `costing.ts`, `aggregation.ts`
  - [ ] Suppress `noBarrelFile` Biome rule: `// biome-ignore lint/performance/noBarrelFile: domain public API boundary`

- [ ] Update `agent-server.ts` to import from analytics domain (AC: 2, 4)
  - [ ] Replace inline type/function definitions with `import { ... } from "./server/analytics"`
  - [ ] Keep all named exports in the `export { ... }` block at the bottom intact — they still re-export from `agent-server.ts`
  - [ ] Also update `runtime/sessions.ts` (from Story 11.1) if it references `upsertAnalyticsSession` or `sessionToAnalyticsUpdate` — replace those references with imports from `./server/analytics`
  - [ ] Verify `markZombieAnalyticsSessionsFailed` (moved to `runtime/sessions.ts` in Story 11.1) can now import `SessionAnalyticsData` and `upsertAnalyticsSession` from the analytics domain

- [ ] Run quality gate (AC: 2)
  - [ ] `cd _bmad-ui && pnpm check` — lint + types + tests + build must pass

## Dev Notes

### This is a Pure Refactoring Story

**Zero functional changes.** Every function and type extracted must behave identically. The only semantic addition is Zod validation replacing `as AgentSession` type assertions in `readAnalyticsStore`.

### Project Root

The project lives at `_bmad-ui/`. All paths are relative to there:
- `scripts/agent-server.ts` — the monolith (5,420 lines as of story creation)
- `scripts/server/` — domain folder created in Story 11.1
- `scripts/server/paths.ts` — `projectRoot`, `artifactsRoot` (created in Story 11.1)
- `scripts/server/runtime/` — runtime domain (created in Story 11.1)
- `scripts/server/analytics/` — **new folder, this story**

Target structure after this story:
```
scripts/server/
├── paths.ts
├── runtime/
│   ├── index.ts
│   ├── state.ts
│   └── sessions.ts
└── analytics/              ← NEW (this story)
    ├── index.ts
    ├── costing.ts
    ├── store.ts
    └── aggregation.ts
```

### Dependency Order Within the Analytics Domain

Internal dependency graph (must import in this order to avoid circular deps):

```
costing.ts      ← no internal deps (defines base types + pure functions)
     ↓
store.ts        ← imports from costing.ts
                ← imports from paths.ts (analyticsStorePath via agentsDir)
     ↓
aggregation.ts  ← imports from costing.ts, store.ts
                ← imports from runtime/state.ts (runtimeStatePath for parseRuntimeStateRobust)
                ← imports runningSessionProcesses from runtime/sessions.ts (for validateRunningStatus)
```

`backfillAnalyticsStore` in `store.ts` calls `parseRuntimeStateRobust` which is in `aggregation.ts`. This is a circular dependency risk. **Resolution:** Move `parseRuntimeStateRobust` to `store.ts` instead (it only reads a file path, not a circular concern), OR pass `runtimeState` as a parameter to `backfillAnalyticsStore`. The cleanest approach: move `parseRuntimeStateRobust` to `store.ts` since `backfillAnalyticsStore` is the only caller that needs it as an internal detail.

Alternatively: split `backfillAnalyticsStore` to call `parseRuntimeStateRobust` as an injected parameter. Check the actual call site:
```ts
// agent-server.ts line 3476:
async function backfillAnalyticsStore(): Promise<void> {
  const runtimeState = await parseRuntimeStateRobust();
  ...
}
```
**Simplest fix:** Place `parseRuntimeStateRobust` in `store.ts` (it doesn't depend on `aggregation.ts` at all — it only needs `runtimeStatePath` from `runtime/state.ts`). Then `aggregation.ts` can import it from `store.ts`.

### Types Being Extracted

**From `agent-server.ts` lines 143–159 and 2939–3002:**

```ts
// costing.ts — all these types move here
type AgentSession = { ... }                    // line 143
type TokenUsageData = { ... }                  // line 2939
type SessionAnalyticsData = { ... }            // line 2947
type AnalyticsRatesUsdData = { ... }           // line 2967
type AnalyticsEstimatedCostUsdData = { ... }   // line 2974
type AnalyticsCostingData = { ... }            // line 2981

// store.ts — this type moves here
type AnalyticsStore = { ... }                  // line 3327
```

### Zod Schemas to Add

**In `store.ts`** — replace `as AgentSession` / `as SessionAnalyticsData` type assertions in `readAnalyticsStore`:

The current code (line 3342–3376) uses:
```ts
const parsed = JSON.parse(raw) as {
  sessions: Record<string, Record<string, unknown>>;
  costing?: AnalyticsCostingData;
};
```
And then manually checks shape with `if ("sessionId" in entry && "usage" in entry)`.

Replace with Zod:
```ts
import { z } from "zod"

const tokenUsageSchema = z.object({
  requests: z.number(),
  tokensIn: z.number(),
  tokensOut: z.number(),
  tokensCached: z.number(),
  totalTokens: z.number(),
}).passthrough()

const sessionAnalyticsSchema = z.object({
  sessionId: z.string(),
  usage: tokenUsageSchema,
}).passthrough()  // allow extra fields (status, storyId, etc.)

const agentSessionSchema = z.object({
  session_id: z.string().optional(),
  model: z.string().optional(),
  status: z.enum(["running", "completed"]).optional(),
}).passthrough()

const analyticsStoreSchema = z.object({
  sessions: z.record(z.unknown()),
}).passthrough()  // allow top-level costing field
```

Use `.safeParse()` so malformed entries are skipped rather than throwing:
```ts
const result = analyticsStoreSchema.safeParse(JSON.parse(raw))
if (!result.success) return { sessions: {} }
```

### Constants Being Extracted

**From `agent-server.ts`:**

```ts
// costing.ts (lines 202–209):
const DEFAULT_STAGE_MODELS = { planning: "claude-sonnet-4.6", retrospective: "claude-sonnet-4.6" } as const
const DEFAULT_WORKFLOW_MODEL = "claude-sonnet-4.6"
const SKILL_MODEL_OVERRIDES: Record<string, string> = { "bmad-code-review": "gpt-5.3-codex" }

// aggregation.ts (lines 3615, 3621):
const SESSION_DEDUP_WINDOW_MS = 5 * 60 * 1000
const STALE_SESSION_THRESHOLD_MS = 35 * 60 * 1000

// aggregation.ts (lines 379–383):
const ANALYTICS_REQUESTS_LINE_REGEX = /^Requests\s+([\d.]+)/m
const ANALYTICS_TOKENS_LINE_REGEX = /^Tokens\s+↑\s*([\d.]+)([kmb]?)\s*•\s*↓\s*([\d.]+)([kmb]?)\s*•\s*([\d.]+)([kmb]?)\s*\(cached\)/m
const ANALYTICS_OLD_STYLE_SESSION_REGEX = /^(\d+)-(\d+)-(.+)$/
const ANALYTICS_EPIC_SESSION_REGEX = /^epic-(\d+)-(.+)$/
```

Note: `ANALYTICS_REQUESTS_LINE_REGEX` and `ANALYTICS_TOKENS_LINE_REGEX` are defined at the **top level** of `agent-server.ts` (lines 379–383) alongside other regex constants, not near the analytics functions. They still belong in `aggregation.ts`.

### Key Functions and Their Source Lines

**costing.ts:**
| Function | Line | Notes |
|---|---|---|
| `zeroUsage()` | 3004 | Returns empty `TokenUsageData` |
| `addUsage(a, b)` | 3014 | Sums two `TokenUsageData` objects |
| `toNullableNumber(v)` | 3024 | Returns `number \| null` (pure) |
| `normalizeAnalyticsCosting(raw, usage)` | 3032 | Complex costing normalization — move whole block |
| `parseTokenCount(value, unit)` | 3168 | Converts "1.5k" → 1500 |
| `parseTokenUsageFromLog(content)` | 3186 | Parses log file for token/request counts |

**store.ts:**
| Function | Line | Notes |
|---|---|---|
| `readAnalyticsStore()` | 3332 | Reads + normalizes agent-sessions.json; add Zod here |
| `persistAnalyticsStore(store)` | 3383 | Writes agent-sessions.json |
| `upsertAnalyticsSession(update)` | 3392 | Merges update into store and persists |
| `persistSessionAnalytics(session)` | 3452 | Reads log file → token usage → upserts |
| `backfillAnalyticsStore()` | 3472 | Reconciles runtime-state + log files with store |
| `parseRuntimeStateRobust()` | 3267 | Put here to break circular dep (see above) |

**aggregation.ts:**
| Function | Line | Notes |
|---|---|---|
| `getEpicIdFromStoryId(id)` | 3212 | Pure string transform |
| `inferSkillFromLogFilename(f)` | 3226 | Pure string transform |
| `inferStoryIdFromLogFilename(f, ids)` | 3248 | Matches regex patterns |
| `deduplicateSessions(sessions)` | 3633 | Merges workflow+UUID session pairs |
| `validateRunningStatus(sessions)` | 3703 | Cross-checks vs `runningSessionProcesses` |
| `analyticsToRuntimeSession(s)` | 3411 | Converts `SessionAnalyticsData` → `RuntimeSession` |
| `sessionToAnalyticsUpdate(session)` | 3430 | Converts `RuntimeSession` → partial analytics update |
| `buildAnalyticsPayload()` | 3732 | Full pipeline: backfill → dedup → validate → aggregate |

### Critical Cross-Domain Dependency: `markZombieAnalyticsSessionsFailed`

This function was moved to `runtime/sessions.ts` in Story 11.1. It has signature:
```ts
async function markZombieAnalyticsSessionsFailed(
  sessions: SessionAnalyticsData[],
): Promise<boolean>
```

It calls `upsertAnalyticsSession` (moving to `store.ts` in this story). Story 11.1's instruction was: "keep cross-domain calls as imports from the original `agent-server.ts`". After this story, `upsertAnalyticsSession` moves to the analytics domain.

**Action required:** After creating `store.ts`, update `scripts/server/runtime/sessions.ts` to import `upsertAnalyticsSession` and `SessionAnalyticsData` from `"../analytics"` instead of from the monolith. This is the intended cross-domain wiring.

Similarly, `startRuntimeSession` in `sessions.ts` calls `persistSessionAnalytics` and `sessionToAnalyticsUpdate` — update those imports too.

### `validateRunningStatus` Reads `runningSessionProcesses`

This mutable `Map<string, ChildProcess>` lives in `runtime/sessions.ts` (moved there in Story 11.1). `validateRunningStatus` reads it to check live processes:

```ts
// aggregation.ts needs this import:
import { runningSessionProcesses } from "../runtime/sessions"
```

Export `runningSessionProcesses` from `runtime/sessions.ts` if it's not already exported.

### `noBarrelFile` Biome Rule

All `index.ts` files in domain folders must suppress the barrel file lint rule:
```ts
// biome-ignore lint/performance/noBarrelFile: domain public API boundary
export * from "./costing"
export * from "./store"
export * from "./aggregation"
```

### Consumer Exports That Must Remain Accessible from `agent-server.ts`

The `export { ... }` block at the bottom of `agent-server.ts` (lines 5394–5420) currently exports:
```ts
analyticsToRuntimeSession,
buildAnalyticsPayload,
readAnalyticsStore,
upsertAnalyticsSession,
```

After this story, these are imported from `./server/analytics` and re-exported from `agent-server.ts`. The export surface stays identical for `vite-plugin-static-data.ts`.

### Path Constant for Analytics Store

```ts
// scripts/server/analytics/store.ts
import { projectRoot } from "../paths"
import path from "node:path"

const agentsDir = path.join(projectRoot, "_bmad-ui", "agents")
export const analyticsStorePath = path.join(agentsDir, "agent-sessions.json")
const legacyAnalyticsStorePaths: string[] = []
const agentSessionsPath = analyticsStorePath
```

`agentsDir` is used in `agent-server.ts` lines 163–168. Move the analytics-relevant paths to `store.ts`; the `runtimeLogsDir` path stays in `runtime/state.ts` (or moves with `backfillAnalyticsStore` if needed).

### TypeScript Strict Mode Considerations

- `"strict": true`, `"noUnusedLocals": true`, `"noUnusedParameters": true` are enforced
- `scripts/` is not covered by `tsconfig.json` include patterns — errors surface at `vite build` time via Vite's TypeScript plugin, not `tsc --noEmit` alone
- When moving `let` mutable state, ensure its mutators live in the same file
- `AnalyticsCostingData` has optional nested union types — copy the entire type definition intact

### Build System Note

The quality gate command is:
```bash
cd _bmad-ui && pnpm check
```
This runs: Biome lint → TypeScript type-check → Vitest → Vite build. All four must pass. Type errors in `scripts/` are caught during `vite build`.

### Project Structure Notes

- All new files go under `_bmad-ui/scripts/server/analytics/`
- No changes to `src/` — this is a server-side refactoring only
- No new CSS, no UI changes
- Stories 11.1–11.4 are prerequisite; if not yet completed, implement them in sequence before this story (or verify which domains have been extracted and adapt imports accordingly)

### References

- Story 11.5 definition: [Source: _bmad-output/planning-artifacts/epics.md#Story 11.5: Extract Analytics Domain]
- Epic decomposition principles: [Source: _bmad-output/planning-artifacts/epics.md#Epic 11: Agent Server Modularization]
- Story 11.1 (runtime domain, paths.ts, Zod pattern): [Source: _bmad-output/implementation-artifacts/11-1-extract-runtime-domain.md]
- Source monolith: `_bmad-ui/scripts/agent-server.ts` (5,420 lines)
  - `AgentSession` type: line 143
  - `DEFAULT_STAGE_MODELS` / `DEFAULT_WORKFLOW_MODEL` / `SKILL_MODEL_OVERRIDES`: lines 202–209
  - `markZombieAnalyticsSessionsFailed`: lines 304–347
  - Analytics regex constants: lines 379–383
  - `TokenUsageData` type: line 2939
  - `SessionAnalyticsData` type: line 2947
  - `AnalyticsRatesUsdData` / `AnalyticsEstimatedCostUsdData` / `AnalyticsCostingData`: lines 2967–3002
  - `zeroUsage` through `parseTokenUsageFromLog`: lines 3004–3210
  - `getEpicIdFromStoryId` through `parseRuntimeStateRobust`: lines 3212–3321
  - `AnalyticsStore` type + `readAnalyticsStore` through `backfillAnalyticsStore`: lines 3323–3609
  - `SESSION_DEDUP_WINDOW_MS`, `STALE_SESSION_THRESHOLD_MS`: lines 3615, 3621
  - `deduplicateSessions` through `buildAnalyticsPayload`: lines 3633–3846
  - Export block: lines 5394–5420
- Consumer: `_bmad-ui/scripts/vite-plugin-static-data.ts`
- Consumer: `_bmad-ui/vite.config.ts`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
