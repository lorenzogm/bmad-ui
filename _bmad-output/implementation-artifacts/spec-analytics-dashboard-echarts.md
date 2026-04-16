---
title: 'Add ECharts visualizations to Analytics Dashboard'
type: 'feature'
created: '2026-04-16'
status: 'done'
baseline_commit: '7151646'
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Analytics Dashboard shows only static stat cards with aggregate numbers. There is no visual representation of trends over time, distribution across models, or activity patterns — making it hard to spot usage patterns at a glance.

**Approach:** Add 4 ECharts.js charts to the Analytics Dashboard page: (1) **line chart** — requests + tokens over time, (2) **stacked bar chart** — token breakdown by model, (3) **donut chart** — sessions by skill, (4) **bar chart** — requests by epic. All charts use the existing `AnalyticsResponse` data from `useAnalyticsData()` — no new API endpoints needed.

## Boundaries & Constraints

**Always:**
- Use `echarts` npm package (Apache ECharts) — not a React wrapper
- Follow the dark theme: chart backgrounds transparent, text `var(--text)`, accent colors from CSS variables (`--highlight`, `--highlight-2`, `--status-done`, `--status-progress`)
- Charts must be responsive (resize on window resize)
- Use existing `useAnalyticsData()` hook for data — no new fetch calls
- Named functions for components, `import type` for type-only imports
- Magic numbers as named constants

**Ask First:**
- Adding charts to pages other than the dashboard

**Never:**
- React ECharts wrapper libraries — use `echarts` directly with refs
- `useEffect` for data fetching (chart init/dispose via refs + event listeners is acceptable)
- Inline hardcoded colors
- Light theme colors

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Normal data | Sessions with varied dates, models, skills, epics | All 4 charts render with data | N/A |
| Empty sessions | `data.sessions` is `[]` | Charts show empty state / "No data" | N/A |
| Single session | One session only | Charts render with single data point | N/A |
| Window resize | Browser window resized | Charts resize proportionally | N/A |

</frozen-after-approval>

## Code Map

- `_bmad-custom/bmad-ui/src/routes/analytics-dashboard.tsx` -- Main page to add charts below existing stat cards
- `_bmad-custom/bmad-ui/src/routes/analytics-utils.tsx` -- Shared analytics utilities; add reusable EChart component + theme constants
- `_bmad-custom/bmad-ui/src/types.ts` -- Existing types (SessionAnalytics, AnalyticsResponse)
- `_bmad-custom/bmad-ui/src/styles.css` -- Minimal chart container styles
- `_bmad-custom/bmad-ui/package.json` -- Add `echarts` dependency

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- Add `echarts` dependency and install
- [x] `src/routes/analytics-utils.tsx` -- Add `EChart` reusable component (ref-based init/dispose/resize) and dark theme constants
- [x] `src/routes/analytics-dashboard.tsx` -- Add 4 chart panels: (1) line chart — requests+tokens over time, (2) stacked bar — token breakdown by model, (3) donut — sessions by skill, (4) bar — requests by epic
- [x] `src/styles.css` -- Add `.chart-container` class for chart dimensions

**Acceptance Criteria:**
- Given the Analytics Dashboard loads with session data, when the page renders, then 4 charts (line, stacked bar, donut, bar) are visible below the stat cards
- Given the browser window is resized, when the resize completes, then all charts adjust to the new width
- Given no session data exists, when the dashboard renders, then charts display gracefully (empty or with placeholder)
- Given `npm run build` is executed, then it passes with zero TypeScript errors

## Design Notes

ECharts init pattern using a ref callback + `ResizeObserver` avoids `useEffect`:

```tsx
function EChart({ option }: { option: echarts.EChartsOption }) {
  const chartRef = useRef<echarts.ECharts | null>(null)
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      chartRef.current = echarts.init(node)
      chartRef.current.setOption(option)
    }
    return () => { chartRef.current?.dispose() }
  }, [option])
  return <div ref={containerRef} className="chart-container" />
}
```

**Chart 1 — Line:** Aggregate sessions by `startedAt` date buckets. Two series: daily requests count and daily total tokens.
**Chart 2 — Stacked Bar:** Group sessions by model. Stacked segments: tokensIn, tokensOut, tokensCached.
**Chart 3 — Donut:** Count sessions per `skill` value. Show percentage labels.
**Chart 4 — Bar:** Aggregate requests per `epicId` from `data.epics`.

## Verification

**Commands:**
- `cd _bmad-custom/bmad-ui && npm run build` -- expected: zero errors
- `cd _bmad-custom/bmad-ui && npx biome check src/` -- expected: no lint violations

## Suggested Review Order

**Dashboard composition**

- Entry point: how charts are wired into the dashboard below stat cards
  [`analytics-dashboard.tsx:69`](../../_bmad-custom/bmad-ui/src/routes/analytics-dashboard.tsx#L69)

**Reusable chart component**

- Ref-based ECharts init with ResizeObserver — no useEffect needed
  [`analytics-utils.tsx:158`](../../_bmad-custom/bmad-ui/src/routes/analytics-utils.tsx#L158)

**Chart option builders**

- Line chart: requests + tokens over time, dual Y axes
  [`analytics-utils.tsx:213`](../../_bmad-custom/bmad-ui/src/routes/analytics-utils.tsx#L213)

- Stacked bar: token breakdown (in/out/cached) per model
  [`analytics-utils.tsx:286`](../../_bmad-custom/bmad-ui/src/routes/analytics-utils.tsx#L286)

- Donut: session count per skill with percentage labels
  [`analytics-utils.tsx:356`](../../_bmad-custom/bmad-ui/src/routes/analytics-utils.tsx#L356)

- Bar: requests per epic with per-bar colors
  [`analytics-utils.tsx:403`](../../_bmad-custom/bmad-ui/src/routes/analytics-utils.tsx#L403)

**Styling**

- Chart container dimensions and 2-column grid layout
  [`styles.css:2458`](../../_bmad-custom/bmad-ui/src/styles.css#L2458)
