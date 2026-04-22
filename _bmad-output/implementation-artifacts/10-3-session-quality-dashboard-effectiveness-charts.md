# Story 10.3: Session Quality Dashboard — Effectiveness Charts

Status: ready-for-dev

## Story

As a maintainer,
I want a new analytics sub-page showing session quality charts broken down by skill and model,
so that I can visually identify which workflows succeed autonomously and which require human intervention.

## Acceptance Criteria

1. **Given** the analytics quality data is available, **When** the user navigates to `/analytics/quality`, **Then** the page shows:
   - A summary stat row: total sessions, overall delivery rate (%), overall one-shot rate (%), overall abort rate (%)
   - A horizontal bar chart: one-shot rate per skill (sorted descending)
   - A horizontal bar chart: one-shot rate per model (sorted descending)
   - A stacked bar chart: sessions per skill broken into one-shot / corrected / aborted / no-output segments

2. **Given** the charts, **When** rendered, **Then** they use the design system colors:
   - `var(--status-done)` (`#2ec4b6`) for one-shot
   - `var(--status-progress)` (`#22c55e`) for corrected
   - `var(--highlight-2)` (`#ff9f1c`) for aborted
   - `var(--status-backlog)` (`#6b7280`) for no-output

3. **Given** the analytics layout navigation, **When** the quality page exists, **Then** a "Quality" link appears in the analytics sub-navigation between "Models" and the last item.

4. **Given** no sessions have outcome data yet (quality data missing or all zeroes), **When** the quality page loads, **Then** a friendly empty state is shown: "Run sync-sessions to populate session quality metrics"

## Tasks / Subtasks

- [ ] Task 1: Add quality metric types to `src/types.ts` (AC: #1, #4)
  - [ ] Add `QualityMetric` type
  - [ ] Add `AnalyticsQuality` type
  - [ ] Add optional `quality?: AnalyticsQuality` to `AnalyticsResponse`

- [ ] Task 2: Add chart builders to `analytics-utils.tsx` (AC: #1, #2)
  - [ ] Add quality color constants as named `const` (QUALITY_COLOR_ONESHOT, QUALITY_COLOR_CORRECTED, QUALITY_COLOR_ABORTED, QUALITY_COLOR_NOOUTPUT)
  - [ ] Add `buildOneShotRateBySkillOption()` — horizontal bar chart, sorted descending
  - [ ] Add `buildOneShotRateByModelOption()` — horizontal bar chart, sorted descending
  - [ ] Add `buildSessionsBySkillStackedOption()` — stacked bar chart with 4 segments

- [ ] Task 3: Create `src/routes/analytics-quality.tsx` (AC: #1, #2, #4)
  - [ ] Named function `AnalyticsQualityPage`
  - [ ] Use existing `useAnalyticsData()` hook
  - [ ] Summary stat row (4 stat cards)
  - [ ] Render the 3 charts using `EChart` component
  - [ ] Empty state when quality data is absent or has no sessions
  - [ ] Export `analyticsQualityRoute` (createRoute with path "quality")

- [ ] Task 4: Register route in `src/routes/route-tree.ts` (AC: #3)
  - [ ] Import `analyticsQualityRoute`
  - [ ] Add to `analyticsLayoutRoute.addChildren([...])`

- [ ] Task 5: Add "Quality" link to analytics sub-navigation in `src/routes/__root.tsx` (AC: #3)
  - [ ] Add `{ label: "Quality", to: "/analytics/quality" }` to `ANALYTICS_SUBMENU` after "Models"

- [ ] Task 6: Run quality gate (AC: all)
  - [ ] `cd _bmad-custom/bmad-ui && pnpm check` passes with zero errors

## Dev Notes

### Dependency Warning

**Story 10-3 depends on Story 10-2** (Analytics API — Session Quality Aggregation Endpoint), which adds the `quality` field to the `/api/analytics` response. Story 10-2 is still `backlog`. If implementing 10-3 before 10-2:
- Add the types optimistically (they match the planned API shape)
- The page must gracefully handle `data.quality` being `undefined` (show empty state)
- The empty state text "Run sync-sessions to populate session quality metrics" covers both "daemon not enriched" and "API not yet serving quality" scenarios

### Files to Create / Modify

| File | Action |
|------|--------|
| `src/types.ts` | Add `QualityMetric`, `AnalyticsQuality`, extend `AnalyticsResponse` |
| `src/routes/analytics-utils.tsx` | Add 3 chart builders + 4 color constants |
| `src/routes/analytics-quality.tsx` | **Create new** — full page component + route export |
| `src/routes/route-tree.ts` | Import and register `analyticsQualityRoute` |
| `src/routes/__root.tsx` | Add Quality entry to `ANALYTICS_SUBMENU` |

### Type Definitions (add to `src/types.ts`)

```ts
export type QualityMetric = {
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

export type AnalyticsQuality = {
  bySkill: Record<string, QualityMetric>
  byModel: Record<string, QualityMetric>
  bySkillModel: Record<string, QualityMetric>  // key: "<skill>|||<model>"
  overall: QualityMetric
}
```

Then add to `AnalyticsResponse`:
```ts
quality?: AnalyticsQuality
```

### Chart Builder Signatures (add to `analytics-utils.tsx`)

```ts
export function buildOneShotRateBySkillOption(quality: AnalyticsQuality): echarts.EChartsOption
export function buildOneShotRateByModelOption(quality: AnalyticsQuality): echarts.EChartsOption
export function buildSessionsBySkillStackedOption(quality: AnalyticsQuality): echarts.EChartsOption
```

### Color Constants for Quality Charts

Add these named constants to `analytics-utils.tsx` (do NOT inline):

```ts
const QUALITY_COLOR_ONESHOT   = "#2ec4b6"  // var(--status-done)
const QUALITY_COLOR_CORRECTED = "#22c55e"  // var(--status-progress)
const QUALITY_COLOR_ABORTED   = "#ff9f1c"  // var(--highlight-2)
const QUALITY_COLOR_NOOUTPUT  = "#6b7280"  // var(--status-backlog)
```

### Chart Specifications

**Chart 1 & 2 — Horizontal Bar: One-Shot Rate (per skill / per model)**

- `xAxis`: value (0–1, format as `${Math.round(v * 100)}%`)
- `yAxis`: category — skill/model names sorted descending by one-shot rate
- Single series bar, color `QUALITY_COLOR_ONESHOT`
- Tooltip: show `${Math.round(rate * 100)}% one-shot (N sessions)`
- Empty check: if `Object.keys(quality.bySkill).length === 0`, skip chart (show empty state)

```ts
// Sort pattern (descending by oneShotRate):
const sorted = Object.entries(quality.bySkill)
  .sort(([, a], [, b]) => b.oneShotRate - a.oneShotRate)
const names = sorted.map(([k]) => k)
const rates = sorted.map(([, v]) => v.oneShotRate)
```

**Chart 3 — Stacked Bar: Sessions per Skill**

- `xAxis`: category — skill names (sorted by total sessions descending)
- `yAxis`: value (session count)
- 4 stacked series: One-Shot, Corrected, Aborted, No-Output
- Each series has its own color constant
- Tooltip trigger: "axis", axisPointer: shadow
- Legend shows all 4 series names

### Route Registration Pattern

Follow the exact pattern from existing analytics routes:

```ts
// analytics-quality.tsx
export const analyticsQualityRoute = createRoute({
  getParentRoute: () => analyticsLayoutRoute,
  path: "quality",
  component: AnalyticsQualityPage,
})
```

```ts
// route-tree.ts — add to analyticsLayoutRoute.addChildren([...]):
analyticsQualityRoute,
```

### Navigation Update (exact change in `__root.tsx`)

Current `ANALYTICS_SUBMENU`:
```ts
const ANALYTICS_SUBMENU = [
  { label: "Overview", to: "/analytics" },
  { label: "Epics", to: "/analytics/epics" },
  { label: "Stories", to: "/analytics/stories" },
  { label: "Sessions", to: "/analytics/sessions" },
  { label: "Models", to: "/analytics/models" },
] as const
```

After change (add "Quality" after "Models"):
```ts
const ANALYTICS_SUBMENU = [
  { label: "Overview", to: "/analytics" },
  { label: "Epics", to: "/analytics/epics" },
  { label: "Stories", to: "/analytics/stories" },
  { label: "Sessions", to: "/analytics/sessions" },
  { label: "Models", to: "/analytics/models" },
  { label: "Quality", to: "/analytics/quality" },
] as const
```

### Empty State Logic

```tsx
// In AnalyticsQualityPage, after data loads:
const hasQualityData = data.quality != null && data.quality.overall.sessions > 0

if (!hasQualityData) {
  return (
    <main className="screen">
      <section className="panel reveal">
        <p className="eyebrow">Analytics</p>
        <h2>Session Quality</h2>
        <p className="empty-state-message">
          Run sync-sessions to populate session quality metrics
        </p>
      </section>
    </main>
  )
}
```

### Summary Stat Row

Reuse existing `StatCard` component from `analytics-utils.tsx`:

```tsx
<div className="stat-grid">
  <StatCard label="Total Sessions" value={String(overall.sessions)} />
  <StatCard label="Delivery Rate" value={`${Math.round((overall.delivered / overall.sessions) * 100)}%`} />
  <StatCard label="One-Shot Rate" value={`${Math.round(overall.oneShotRate * 100)}%`} />
  <StatCard label="Abort Rate" value={`${Math.round((overall.aborted / overall.sessions) * 100)}%`} />
</div>
```

### Existing Patterns to Follow

1. **`useAnalyticsData()` hook** — already uses `useEffect` for fetching (this is an established exception for analytics data polling). Use it as-is; do NOT migrate to TanStack Query for this story.

2. **`EChart` component** — already in `analytics-utils.tsx`. Reuse it for all 3 charts. Pass an `echarts.EChartsOption` object built by the new builder functions.

3. **`buildBaseChartOption()`** — private function in `analytics-utils.tsx`. Spread it in all new chart builders: `...buildBaseChartOption()`. This applies dark theme (transparent bg, text colors, tooltip styling, grid).

4. **`StatCard` component** — already exported from `analytics-utils.tsx`. Reuse it for the 4 summary stat cards.

5. **`PageSkeleton` / `QueryErrorState`** — from `src/lib/loading-states.tsx`. Use these for loading and error states (matches pattern in `analytics-sessions.tsx`).

6. **Import pattern**: Named imports only. `import type` for type-only imports. Use `@/` alias for imports from `src/`.

### Anti-Patterns to Avoid

- ❌ Do NOT create new `useEffect` for data fetching — `useAnalyticsData()` already exists
- ❌ Do NOT inline color hex values in chart options — use the named constants
- ❌ Do NOT add new custom CSS classes for this story — use Tailwind utilities and existing classes
- ❌ Do NOT add a default export — use named exports only
- ❌ Do NOT register the route using string path `/analytics/quality` — use the route constant `analyticsQualityRoute`
- ❌ Do NOT use `isNaN`, `parseInt`, `parseFloat` — use `Number.isNaN()`, `Number.parseInt()`, etc.
- ❌ Do NOT hardcode `"/analytics/quality"` string in route — let TanStack Router manage it

### Project Structure Notes

- `analytics-quality.tsx` goes in `_bmad-custom/bmad-ui/src/routes/` — same folder as all other analytics routes
- Import from `analytics-utils.tsx` using relative path (same folder): `"./analytics-utils"`
- Import types from `src/types.ts` using `@/` alias: `import type { ... } from "@/types"`
- Import `analyticsLayoutRoute` from `"./analytics"` (relative, same folder)

### References

- Epic 10 story definition: `_bmad-output/planning-artifacts/epics.md` §Story 10.3 (lines 1310–1342)
- Analytics route layout: `src/routes/analytics.tsx`
- Route tree registration: `src/routes/route-tree.ts`
- Analytics submenu: `src/routes/__root.tsx` `ANALYTICS_SUBMENU` constant
- Existing chart patterns: `src/routes/analytics-utils.tsx` (EChart, buildBaseChartOption, StatCard, CHART_*)
- Quality API shape (Story 10.2): `_bmad-output/planning-artifacts/epics.md` §Story 10.2 (lines 1273–1308)
- Project context rules: `_bmad-output/project-context.md`
- Architecture: `_bmad-output/planning-artifacts/architecture.md` §Frontend route patterns

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
