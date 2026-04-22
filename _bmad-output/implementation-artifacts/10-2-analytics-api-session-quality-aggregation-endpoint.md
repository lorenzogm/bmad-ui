# Story 10.2: Analytics API — Session Quality Aggregation Endpoint

Status: ready-for-dev

## Story

As a maintainer,
I want the API to serve pre-aggregated session quality metrics grouped by skill and model,
So that the frontend can render effectiveness charts without client-side data crunching across hundreds of sessions.

## Acceptance Criteria

1. **Given** the API server reads agent-sessions.json,
   **When** a GET request hits `/api/analytics`,
   **Then** the response includes a new `quality` object with:
   - `bySkill` — for each skill: `{ sessions, delivered, oneShot, corrected, aborted, avgDurationMin, avgAgentTurns, avgHumanTurns }`
   - `byModel` — for each model: same shape as bySkill
   - `bySkillModel` — for each skill×model combo: same shape, plus `oneShotRate` (0–1)
   - `overall` — same shape across all sessions

2. **Given** a session with `outcome` in `["pushed", "committed", "delivered"]` AND `human_turns === 1`,
   **When** aggregated,
   **Then** it counts as `oneShot`

3. **Given** a session with `outcome` in `["pushed", "committed", "delivered"]` AND `human_turns > 1`,
   **When** aggregated,
   **Then** it counts as `corrected`

4. **Given** a session with `outcome` in `["pushed", "committed", "delivered"]`,
   **When** aggregated,
   **Then** it counts as `delivered`

5. **Given** the analytics endpoint is called with 500+ sessions in agent-sessions.json,
   **When** the response is generated,
   **Then** it completes within 200ms (NFR25)

6. **Given** sessions where the new quality fields (`outcome`, `human_turns`, `aborted`) are absent (pre-story-10-1 data),
   **When** aggregated,
   **Then** they are treated as unknowns and excluded from quality counts (not counted as delivered, oneShot, etc.) — they still count toward the total `sessions` bucket

## Tasks / Subtasks

- [ ] Add `SessionOutcome` type and quality field types to `src/types.ts` (AC: 1)
  - [ ] Add `SessionOutcome = "pushed" | "committed" | "delivered" | "aborted" | "error" | "no-output"` union type
  - [ ] Add `QualityMetrics` type (sessions, delivered, oneShot, corrected, aborted, avgDurationMin, avgAgentTurns, avgHumanTurns)
  - [ ] Add `QualityBySkillModel` extending `QualityMetrics` with `oneShotRate: number`
  - [ ] Add `AnalyticsQuality` type: `{ bySkill: Record<string, QualityMetrics>; byModel: Record<string, QualityMetrics>; bySkillModel: Record<string, QualityBySkillModel>; overall: QualityMetrics }`
  - [ ] Extend `AnalyticsResponse` with `quality: AnalyticsQuality`

- [ ] Extend `SessionAnalyticsData` type in `scripts/agent-server.ts` with optional quality fields (AC: 2, 3, 4, 6)
  - [ ] Add optional fields: `human_turns?: number | null`, `agent_turns?: number | null`, `outcome?: string | null`, `aborted?: boolean | null`, `duration_minutes?: number | null`
  - [ ] These fields are populated by story 10-1 sync daemon; they are optional here so pre-10-1 data is handled gracefully

- [ ] Implement `buildQualityAggregation()` pure function in `scripts/agent-server.ts` (AC: 1–6)
  - [ ] Define `DELIVERED_OUTCOMES` const: `["pushed", "committed", "delivered"]`
  - [ ] For each session: determine `isDelivered`, `isOneShot`, `isCorrected`, `isAborted` using optional chaining
  - [ ] Accumulate counts per skill key, model key, and `${skill}::${model}` combo key
  - [ ] Accumulate totals for `duration_minutes`, `agent_turns`, `human_turns` for averaging (only count sessions where the value is present)
  - [ ] Compute averages only where denominator > 0 (avoid division by zero)
  - [ ] Compute `oneShotRate = oneShot / sessions` per bySkillModel entry
  - [ ] Build `overall` bucket across all sessions

- [ ] Call `buildQualityAggregation()` inside `buildAnalyticsPayload()` and include `quality` in return (AC: 1)
  - [ ] Pass `sessionAnalytics` (the validated, deduplicated array) to `buildQualityAggregation()`
  - [ ] Add `quality` to the return object of `buildAnalyticsPayload()`
  - [ ] **Important:** The function is `buildAnalyticsPayload()` — NOT `buildAnalyticsResponse()` as stated in the epics (the epics contain a naming error)

- [ ] Run quality gate (AC: all)
  - [ ] `cd _bmad-ui && pnpm check` must pass with zero errors

## Dev Notes

### Dependency on Story 10-1

**Story 10-2 depends on story 10-1 being completed first.** Story 10-1 adds the following fields to each session entry in `agent-sessions.json` (extracted from events.jsonl):
- `human_turns`, `agent_turns`, `git_commits`, `git_pushes`, `aborted`, `context_compactions`, `subagent_count`, `subagent_tokens`, `error_count`, `duration_minutes`, `outcome`

If implementing before story 10-1 is done, all these fields will be `undefined`/absent in existing sessions. The aggregation MUST handle absent fields gracefully (see AC 6): sessions without `outcome` should be counted in `sessions` total but NOT counted in `delivered`, `oneShot`, `corrected`, or `aborted` buckets.

### Critical File Name Correction

The epics file mentions `buildAnalyticsResponse()` but the **actual function name in `scripts/agent-server.ts` is `buildAnalyticsPayload()`** (line ~3732). Always modify `buildAnalyticsPayload()`.

### Key Files to Modify

1. **`_bmad-ui/src/types.ts`** — add frontend quality types (legacy file, explicitly referenced in story)
2. **`_bmad-ui/scripts/agent-server.ts`** — extend `SessionAnalyticsData` type + implement `buildQualityAggregation()` + update `buildAnalyticsPayload()` return

### Do NOT Touch

- `vite-plugin-static-data.ts` — it already calls `buildAnalyticsPayload()` and emits the result; no changes needed there
- `src/routes/` files — no frontend UI changes in this story (that's story 10-3)
- `scripts/sync-sessions.mjs` — that's story 10-1's responsibility

### Existing `buildAnalyticsPayload()` Structure

Located at line ~3732 in `scripts/agent-server.ts`. Currently returns:

```ts
{
  sessions: sessionAnalytics,    // SessionAnalyticsData[] — validated, deduplicated
  stories: storyAnalytics,
  epics: epicAnalytics,
  project: projectUsage,
  costing,
}
```

Add `quality` as a new field:

```ts
{
  sessions: sessionAnalytics,
  stories: storyAnalytics,
  epics: epicAnalytics,
  project: projectUsage,
  costing,
  quality: buildQualityAggregation(sessionAnalytics),  // NEW
}
```

### Aggregation Logic Reference

```ts
const DELIVERED_OUTCOMES = ["pushed", "committed", "delivered"] as const

function isDelivered(session: SessionAnalyticsData): boolean {
  return session.outcome != null && (DELIVERED_OUTCOMES as readonly string[]).includes(session.outcome)
}

// oneShot: delivered + exactly 1 human turn (no corrections needed) + not aborted
function isOneShot(session: SessionAnalyticsData): boolean {
  return isDelivered(session) && session.human_turns === 1 && session.aborted !== true
}

// corrected: delivered + more than 1 human turn
function isCorrected(session: SessionAnalyticsData): boolean {
  return isDelivered(session) && typeof session.human_turns === "number" && session.human_turns > 1
}

// aborted: outcome === "aborted"
function isAbortedOutcome(session: SessionAnalyticsData): boolean {
  return session.outcome === "aborted"
}
```

### QualityMetrics Type Shape

```ts
type QualityMetrics = {
  sessions: number         // all sessions in this bucket
  delivered: number        // outcome in DELIVERED_OUTCOMES
  oneShot: number          // delivered && human_turns === 1 && !aborted
  corrected: number        // delivered && human_turns > 1
  aborted: number          // outcome === "aborted"
  avgDurationMin: number   // average duration_minutes (0 if no data)
  avgAgentTurns: number    // average agent_turns (0 if no data)
  avgHumanTurns: number    // average human_turns (0 if no data)
}

type QualityBySkillModel = QualityMetrics & {
  oneShotRate: number      // oneShot / sessions (0 if sessions === 0)
}

type AnalyticsQuality = {
  bySkill: Record<string, QualityMetrics>
  byModel: Record<string, QualityMetrics>
  bySkillModel: Record<string, QualityBySkillModel>  // key: "${skill}::${model}"
  overall: QualityMetrics
}
```

### Performance Note (NFR25: 200ms for 500+ sessions)

The aggregation is a single O(n) pass. No async I/O is needed — `buildQualityAggregation()` should be synchronous. The `sessionAnalytics` array is already in memory at call time inside `buildAnalyticsPayload()`.

### Biome / TypeScript Constraints

- Use `Number.isNaN()` not `isNaN()` — Biome enforces `useNumberNamespace`
- Use `import type { ... }` for type-only imports
- Named `const` for magic values: define `DELIVERED_OUTCOMES` as a const
- No default exports — export the function if it's exported
- `noUnusedLocals` is enabled — don't declare variables that aren't used
- 2-space indent, double quotes, no semicolons, 100-char line width

### AnalyticsResponse Update in `src/types.ts`

The `AnalyticsResponse` type (at end of `src/types.ts`) must gain a `quality` field:

```ts
export type AnalyticsResponse = {
  sessions: SessionAnalytics[]
  stories: StoryAnalytics[]
  epics: EpicAnalytics[]
  project: TokenUsage
  costing: AnalyticsCosting
  quality: AnalyticsQuality  // NEW
}
```

Note: `SessionAnalytics` in `src/types.ts` is the **frontend** type (a subset of `SessionAnalyticsData` from `agent-server.ts`). The new `outcome`, `human_turns` etc. fields are NOT part of `SessionAnalytics` in the frontend — they are only read server-side for aggregation. The only frontend-visible output is the `quality` aggregate object.

### Project Structure Notes

- `scripts/agent-server.ts` — single large file (~5400 lines), all server logic; no separate modules
- `src/types.ts` — legacy global types file; the story explicitly targets it for quality types
- No new files required for this story

### References

- Story 10-2 acceptance criteria: [Source: `_bmad-output/planning-artifacts/epics.md`#Story 10.2]
- Story 10-1 fields reference: [Source: `_bmad-output/planning-artifacts/epics.md`#Story 10.1]
- `buildAnalyticsPayload()`: [Source: `scripts/agent-server.ts` line ~3732]
- `SessionAnalyticsData` type: [Source: `scripts/agent-server.ts` line ~2947]
- `AnalyticsResponse` frontend type: [Source: `src/types.ts`]
- Project context rules: [Source: `_bmad-output/project-context.md`]
- NFR25 (200ms for 500+ sessions): [Source: `_bmad-output/planning-artifacts/epics.md`#Story 10.2]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
