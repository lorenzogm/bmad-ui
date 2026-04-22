# Story 10.4: Skill × Model Effectiveness Matrix

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want a heatmap matrix showing one-shot success rate for every skill×model combination that has been used,
so that I can identify the best model for each skill and make data-driven decisions for autonomous workflows.

## Acceptance Criteria

1. **Given** the quality analytics data with `bySkillModel` entries, **When** the effectiveness matrix is rendered, **Then** it shows a grid where rows are skills, columns are models, and each cell is color-coded by one-shot rate (green=high, red=low, gray=no data).

2. **Given** a cell in the matrix, **When** hovered, **Then** a tooltip shows: skill name, model name, total sessions, one-shot count, one-shot rate, avg duration, avg human turns.

3. **Given** a skill×model combo with fewer than 3 sessions, **When** displayed in the matrix, **Then** the cell has a "low confidence" visual indicator (dashed border or reduced opacity) to signal insufficient sample size.

4. **Given** the matrix data, **When** a "Best Model" column exists at the end, **Then** it highlights the model with the highest one-shot rate for each skill (minimum 3 sessions), or "Insufficient data" if no model has ≥3 sessions.

5. **Given** no sessions have quality/outcome data yet, **When** the matrix section loads, **Then** a friendly empty state message is shown: "Run sync-sessions to populate session quality metrics".

## Tasks / Subtasks

- [ ] Add `SkillModelQuality` types to `src/types.ts` (AC: 1, 2, 3, 4)
  - [ ] Add `SkillModelQualityCell` type with: `skill`, `model`, `sessions`, `delivered`, `oneShot`, `corrected`, `aborted`, `avgDurationMin`, `avgAgentTurns`, `avgHumanTurns`, `oneShotRate`
  - [ ] Extend `AnalyticsResponse` in `src/types.ts` to include `quality?: AnalyticsQuality`
  - [ ] Add `AnalyticsQuality` type with `bySkill`, `byModel`, `bySkillModel`, `overall` fields (matching shape from Story 10.2)

- [ ] Add `buildSkillModelMatrixOption()` chart builder to `src/routes/analytics-utils.tsx` (AC: 1, 2, 3)
  - [ ] Implement ECharts heatmap option builder following the pattern of `buildActivityHeatmapOption()`
  - [ ] Rows = skill names (y-axis), columns = model names (x-axis)
  - [ ] Cell value = `oneShotRate` (0–1 float); color scale green→amber→gray using CSS variable values
  - [ ] Tooltip formatter shows: skill, model, sessions, one-shot count, one-shot rate %, avg duration, avg human turns
  - [ ] Low confidence cells (< 3 sessions): reduced value opacity via `itemStyle.opacity`

- [ ] Add Best Model summary table (AC: 4, 5)
  - [ ] Implement as a simple HTML table (not ECharts) with Tailwind classes
  - [ ] One row per skill; columns: Skill, Best Model, One-Shot Rate, Sessions
  - [ ] Best Model = model with highest `oneShotRate` and `sessions >= MIN_CONFIDENCE_SESSIONS`
  - [ ] Show "Insufficient data" when no model meets the threshold

- [ ] Create `src/routes/analytics-quality.tsx` route (AC: 1–5)
  - [ ] New route file: `analytics-quality.tsx` under `_bmad-custom/bmad-ui/src/routes/`
  - [ ] Use `useAnalyticsData()` from `analytics-utils.tsx` (already fetches `/api/analytics`)
  - [ ] Render effectiveness matrix section and best-model table below existing quality charts (Story 10.3)
  - [ ] Guard with empty state when `data.quality?.bySkillModel` is empty or absent
  - [ ] Export `analyticsQualityRoute` using `createRoute({ getParentRoute: () => analyticsLayoutRoute, path: "quality" })`

- [ ] Register route in `src/routes/route-tree.ts` (AC: 1)
  - [ ] Import `analyticsQualityRoute` from `./analytics-quality`
  - [ ] Add to `analyticsLayoutRoute.addChildren([...])` array

- [ ] Run quality gate (AC: all)
  - [ ] `cd _bmad-custom/bmad-ui && pnpm check` must pass (lint + types + tests + build)

## Dev Notes

### Prerequisites & Dependencies

**Stories 10.1, 10.2, and 10.3 are prerequisite stories** that are currently in `backlog` status. Before implementing this story, those three stories must be implemented first (or co-implemented in sequence):

- **Story 10.1** — Enriches `sync-sessions.mjs` to add `outcome`, `human_turns`, `git_commits`, `aborted`, etc. fields to `agent-sessions.json`
- **Story 10.2** — Adds `quality` aggregation to the `/api/analytics` endpoint in `scripts/agent-server.ts` and TypeScript types for quality metrics in `src/types.ts`
- **Story 10.3** — Creates `src/routes/analytics-quality.tsx` with summary stat row and bar charts (one-shot rate per skill, per model, stacked sessions per skill)

This story (10.4) adds the **heatmap matrix section** to the same `/analytics/quality` page that Story 10.3 creates. If 10.3 has not been completed, the dev agent must implement both 10.3 and 10.4 together, or implement 10.3 first.

### Key Files to Touch

| File | Change |
|------|--------|
| `src/types.ts` | Add `SkillModelQualityCell`, `AnalyticsQuality`, extend `AnalyticsResponse` with `quality?` |
| `src/routes/analytics-utils.tsx` | Add `buildSkillModelMatrixOption()` ECharts heatmap builder |
| `src/routes/analytics-quality.tsx` | New route (or extend from 10.3) — add matrix + best-model table |
| `src/routes/route-tree.ts` | Import and register `analyticsQualityRoute` |

### ECharts Heatmap Pattern (Critical Reference)

An ECharts heatmap already exists in `buildActivityHeatmapOption()` in `analytics-utils.tsx` (lines ~394–471). Follow that exact pattern. Key points:
- `series[0].type = "heatmap"`, data format is `[xIndex, yIndex, value]`
- Use `visualMap` for color scale
- `grid.containLabel: true` to avoid label clipping
- ECharts instance lifecycle is managed by the `EChart` component via `useCallback` ref — **do not add `useEffect` for chart setup**
- The `<div ref={containerRef} className="chart-container" />` gives the chart its size via CSS

```ts
// Color scale for one-shot rate: no-data → low → high
// var(--status-backlog) = #6b7280 (gray, no data)
// var(--highlight-2)    = #ff9f1c (amber, low rate)
// var(--status-done)    = #2ec4b6 (teal, high rate)
const MATRIX_COLOR_NO_DATA = "#6b7280"
const MATRIX_COLOR_LOW     = "#ff9f1c"
const MATRIX_COLOR_HIGH    = "#2ec4b6"
```

For the `visualMap`, use `inRange.color: [MATRIX_COLOR_LOW, MATRIX_COLOR_HIGH]` and handle `null`/missing cells by setting their value to `-1` and handling them separately (or use a dedicated "no data" color via `pieces`).

**Alternative approach**: Use a custom HTML `<table>` with inline CSS variable backgrounds. This is simpler, gives full tooltip control, and avoids ECharts heatmap data-massaging complexity. Prefer the HTML table approach if ECharts heatmap handling of missing values becomes complex:

```tsx
// Cell background using inline style (allowed for dynamic data-driven values — not hardcoded colors)
const rate = cell.oneShotRate  // 0–1
const bg = rate === null
  ? "var(--status-backlog)"
  : `color-mix(in srgb, var(--status-done) ${Math.round(rate * 100)}%, var(--highlight-2))`
```

### Confidence Threshold Constant

```ts
const MIN_CONFIDENCE_SESSIONS = 3  // minimum sessions to show confident Best Model
```

Declare at the top of the file as a named const — Biome enforces no magic numbers.

### Type Additions to `src/types.ts`

These types should be added (Story 10.2 may add them first — check before adding):

```ts
export type SkillModelQualityCell = {
  skill: string
  model: string
  sessions: number
  delivered: number
  oneShot: number
  corrected: number
  aborted: number
  avgDurationMin: number
  avgAgentTurns: number
  avgHumanTurns: number
  oneShotRate: number  // 0–1
}

export type AnalyticsQualitySummary = {
  sessions: number
  delivered: number
  oneShot: number
  corrected: number
  aborted: number
  avgDurationMin: number
  avgAgentTurns: number
  avgHumanTurns: number
}

export type AnalyticsQuality = {
  bySkill: Record<string, AnalyticsQualitySummary>
  byModel: Record<string, AnalyticsQualitySummary>
  bySkillModel: Record<string, SkillModelQualityCell>  // key format: "skill::model"
  overall: AnalyticsQualitySummary
}
```

Then extend `AnalyticsResponse`:

```ts
export type AnalyticsResponse = {
  sessions: SessionAnalytics[]
  stories: StoryAnalytics[]
  epics: EpicAnalytics[]
  project: TokenUsage
  costing: AnalyticsCosting
  quality?: AnalyticsQuality  // added in story 10.2
}
```

**Do not add types to a global file pattern** — EXCEPT `src/types.ts` already exists as a legacy file and analytics types are colocated there. This is the correct place for these types.

### Route Registration Pattern

After creating `analytics-quality.tsx`, register it in `route-tree.ts` exactly like other analytics routes:

```ts
// In route-tree.ts imports:
import { analyticsQualityRoute } from "./analytics-quality"

// In routeTree:
analyticsLayoutRoute.addChildren([
  analyticsDashboardRoute,
  analyticsEpicsRoute,
  // ...existing routes...
  analyticsQualityRoute,   // add here
])
```

### Analytics Sub-Navigation

Story 10.3 adds a "Quality" link to the analytics sub-navigation. This story renders on the same `/analytics/quality` page. If 10.3 already added the navigation, no nav changes are needed here.

If implementing both 10.3 and 10.4 together, the `analyticsQualityRoute` path must be `"quality"` under `analyticsLayoutRoute` (path: `"analytics"`), resolving to `/analytics/quality`.

### Data Access Pattern

`useAnalyticsData()` in `analytics-utils.tsx` already fetches `/api/analytics` using `useEffect` (the one exception to the no-useEffect rule — it's an SSE-style loader, not TanStack Query; it was already there before the strict rule). Do not refactor it. Access `quality` via:

```ts
const { data, loading, error } = useAnalyticsData()
const qualityData = data?.quality
const matrixCells = qualityData
  ? Object.values(qualityData.bySkillModel)
  : []
```

**Note**: `useAnalyticsData` uses `useEffect` for data fetching — this is legacy code that predates the TanStack Query rule. Do NOT migrate it in this story. Use it as-is.

### Best Model Table Rendering

Extract unique skills (rows of matrix) from `bySkillModel` keys. For each skill, find the model with the highest `oneShotRate` where `sessions >= MIN_CONFIDENCE_SESSIONS`:

```ts
function getBestModel(cells: SkillModelQualityCell[], skill: string) {
  const skillCells = cells
    .filter(c => c.skill === skill && c.sessions >= MIN_CONFIDENCE_SESSIONS)
    .sort((a, b) => b.oneShotRate - a.oneShotRate)
  return skillCells[0] ?? null
}
```

### Styling Rules

- Use CSS variables via Tailwind bracket syntax: `text-[var(--muted)]`, `bg-[var(--panel)]`
- For the matrix table, use `border: 1px solid rgba(151, 177, 205, 0.22)` for cell borders
- Low confidence cells: `opacity-60` Tailwind class + dashed border
- Section heading: `<h3>` inside `.panel` div — consistent with other analytics sections
- Empty state: use the same pattern as Story 10.3's empty state text

### Project Structure Notes

- All new code goes in `_bmad-custom/bmad-ui/src/routes/analytics-quality.tsx` (or extending it if 10.3 created it)
- No new CSS classes — use Tailwind utility classes
- No `src/ui/` directory yet (Phase 2 planned) — collocate everything in `src/routes/`
- Named functions for components (not arrow function consts): `function EffectivenessMatrix(...)` not `const EffectivenessMatrix = ...`

### References

- Story 10.4 definition: `_bmad-output/planning-artifacts/epics.md` §"Story 10.4: Skill × Model Effectiveness Matrix" (lines ~1344–1371)
- Story 10.2 definition (API contract): `_bmad-output/planning-artifacts/epics.md` §"Story 10.2" (lines ~1273–1308)
- ECharts heatmap reference: `_bmad-custom/bmad-ui/src/routes/analytics-utils.tsx` `buildActivityHeatmapOption()` (lines ~394–471)
- Route registration: `_bmad-custom/bmad-ui/src/routes/route-tree.ts`
- CSS variables: `_bmad-output/project-context.md` §"CSS Variables"
- `AnalyticsResponse` type: `_bmad-custom/bmad-ui/src/types.ts` line ~303
- `SessionAnalyticsData` (server-side): `_bmad-custom/bmad-ui/scripts/agent-server.ts` line ~2947

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
