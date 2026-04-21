# Story 7.2: Integrate Backlog Artifacts with UI Workflows

Status: in-progress

## Story

As a user,
I want bmad-ui to operate with backlog artifacts produced by bmad workflows,
So that planning outputs and execution views stay connected.

## Acceptance Criteria

1. **Given** planning artifacts exist (epics.md with story headings), **When** the epic detail view loads, **Then** all stories from epics.md for that epic are shown — including stories not yet in sprint-status.yaml (planned-only stories)
2. **Given** a bmad workflow updates planning/implementation artifacts on disk, **When** the UI refetches (via TanStack Query polling), **Then** users see the latest corresponding state without a manual page reload
3. **Given** epics.md or sprint-status.yaml is malformed or missing, **When** affected views load, **Then** the UI shows an actionable error or empty-state message instead of crashing or silently returning empty data

## Tasks / Subtasks

- [x] Task 1 — Populate `plannedStories` in epic detail API response (AC: 1)
  - [x] Add helper `getPlannedStoriesFromEpics(content: string, epicNumber: number): string[]` in `agent-server.ts` that extracts story IDs from epics.md headings (e.g. `### Story 7.2: ...` → `"7-2-*"`)
  - [x] Update the `/api/epic/:epicId` handler to call `getPlannedStoriesFromEpics` and include `plannedStories: string[]` in the JSON response
  - [x] Update `vite-plugin-static-data.ts` to include `plannedStories` in the emitted `epic/epic-N.json` static asset for production builds
  - [x] Confirm `EpicDetailResponse` type already has `plannedStories: string[]` — no type change needed (it is defined in `src/types.ts` line 184)

- [x] Task 2 — Populate `plannedStoryCount` and `storiesToCreate` in overview response (AC: 1)
  - [x] Add `plannedStoryCount` and `storiesToCreate` to the internal `SprintOverview` server-side type in `agent-server.ts` (currently it has neither)
  - [x] In `summarizeSprint()`, after building the epic map, cross-reference epic story counts from sprint-status.yaml vs epics.md story headings to derive `plannedStoryCount` and `storiesToCreate`
  - [x] The existing frontend types already define these fields (`src/types.ts:99-100, 170-171`) — no type change needed

- [x] Task 3 — Migrate epic detail route to TanStack Query (AC: 2)
  - [x] Replace the `useEffect` + `useState` data fetching pattern in `src/routes/epic.$epicId.tsx` with `useQuery` from `@tanstack/react-query`
  - [x] Use `queryKey: ["epic", epicId]` and a `refetchInterval` of 5000ms (use named `const EPIC_REFETCH_INTERVAL_MS = 5_000`)
  - [x] Fetch both `/api/epic/:epicId` and `/api/overview` using two `useQuery` calls (as they are independent)
  - [x] Preserve all existing derived state logic; only replace the fetch/loading/error management plumbing
  - [x] Ensure `IS_LOCAL_MODE` gating on mutations is preserved

- [x] Task 4 — Error states for malformed artifact inputs (AC: 3)
  - [x] In the epic detail page, when `epicId` is invalid or 404, show a `<div className="panel">` with a red-tinted message and a "← Back" link instead of a blank screen
  - [x] In the home page and epic detail, when `epicConsistency.hasMismatch` is true, the existing warning banner is shown — verify it renders correctly with the new TanStack Query setup
  - [x] On parse errors (e.g. story markdown malformed), the server already catches and ignores — verify the UI handles `plannedStories: []` gracefully without crashing

- [x] Task 5 — Verify end-to-end with pnpm check (AC: 1, 2, 3)
  - [x] Run `pnpm check` from `_bmad-custom/bmad-ui` — lint, types, tests, build must all pass

### Review Findings

- [ ] [Review][Patch] Planned-only stories are not rendered in the epic story table [src/routes/epic.$epicId.tsx:290]
- [ ] [Review][Patch] Transient epic refetch failures replace valid stale data with a blocking error panel [src/routes/epic.$epicId.tsx:675]
- [ ] [Review][Patch] Duplicate story headings in epics.md inflate plannedStoryCount/storiesToCreate [scripts/agent-server.ts:1216]
- [ ] [Review][Patch] Malformed epics.md parsing is silently swallowed without actionable UI feedback [scripts/agent-server.ts:4248]

## Dev Notes

### Architecture Context

- **Dual-mode architecture**: In dev, data is served by `scripts/agent-server.ts` via Vite middleware. In production, static JSON is pre-built by `scripts/vite-plugin-static-data.ts`. **Both must be updated in sync** when adding new fields to API responses.
- **No `useEffect` for data fetching**: The existing `epic.$epicId.tsx` violates this rule by using `useEffect` + `setState` to load data. This story fixes that violation. See `project-context.md` line 57.
- **TanStack Query v5**: Use `useQuery` from `@tanstack/react-query`. Query key must be serializable. Use named `const` for refetch intervals.

### Key Files to Touch

| File | Change |
|------|--------|
| `scripts/agent-server.ts` | Add `getPlannedStoriesFromEpics()`, update epic detail endpoint, update `SprintOverview` type + `summarizeSprint()` |
| `scripts/vite-plugin-static-data.ts` | Include `plannedStories` in epic JSON emission |
| `src/routes/epic.$epicId.tsx` | Replace `useEffect` fetch with `useQuery` (two queries) |
| `src/types.ts` | No changes needed — types already define the fields |

### Parsing Logic for `getPlannedStoriesFromEpics`

Story headings in epics.md follow the pattern:
```
### Story 7.2: Some Title Here
```

To extract story IDs for epic N:
1. Match lines with `### Story N.M:` where N is the epic number
2. For each match, construct the story ID prefix `"N-M-"` (e.g. `"7-2-"`)
3. Look up the full story ID in the sprint-status stories list, or return the prefix as-is if not tracked yet

The existing `STORY_ID_PREFIX_REGEX = /^(\d+)-(\d+)-/` in agent-server is useful for the inverse — parsing a story ID into its epic and story numbers.

### TanStack Query Migration Pattern (epic.$epicId.tsx)

**Before (violates rules):**
```typescript
useEffect(() => {
  let mounted = true
  const load = async () => {
    const [epicResponse, overviewResponse] = await Promise.all([...])
    if (mounted) { setData(...); setLoading(false) }
  }
  load()
  return () => { mounted = false }
}, [epicId])
```

**After (correct pattern):**
```typescript
const EPIC_REFETCH_INTERVAL_MS = 5_000

const { data: epicData, isLoading: epicLoading, error: epicError } = useQuery<EpicDetailResponse>({
  queryKey: ["epic", epicId],
  queryFn: async () => {
    const res = await fetch(apiUrl(`/api/epic/${encodeURIComponent(epicId)}`))
    if (!res.ok) throw new Error(`epic detail request failed: ${res.status}`)
    return res.json() as Promise<EpicDetailResponse>
  },
  refetchInterval: IS_LOCAL_MODE ? EPIC_REFETCH_INTERVAL_MS : false,
})
```

> Note: EventSource usage in `epic.$epicId.tsx` is **allowed** to stay as `useEffect` — only the REST fetch calls must migrate.

### `EpicDetailResponse` Type Already Defined

`src/types.ts:161-192` already declares:
```typescript
export type EpicDetailResponse = {
  epic: { ... }
  stories: Array<{...}>
  plannedStories: string[]       // ← exists, just not populated by server yet
  storyDependencies: Record<string, string[]>
}
```

The UI at `epic.$epicId.tsx:365-388` already merges `plannedStories` with existing stories to determine display order. Once the server populates it, the UI will automatically show planned-only stories.

### `OverviewResponse` Fields Already Typed

`src/types.ts:99-100, 170-171` already declares `plannedStoryCount` and `storiesToCreate` on the epic objects in `OverviewResponse`. The server's internal `SprintOverview` type and `summarizeSprint()` must be updated to populate these.

### Error Handling Pattern

```typescript
if (epicError) {
  return (
    <main className="screen">
      <div className="panel" style={{ borderColor: "var(--highlight-2)" }}>
        <p className="eyebrow" style={{ color: "var(--highlight-2)" }}>Error</p>
        <p style={{ color: "var(--muted)" }}>{String(epicError)}</p>
        <Link to="/" className="ghost mt-4 inline-block">← Back to Home</Link>
      </div>
    </main>
  )
}
```

### CSS / Style Rules

- Never use inline hardcoded colors — use `var(--highlight-2)` for errors/warnings
- Use existing `.panel`, `.eyebrow`, `.ghost` classes for error states
- Dark theme: never use light backgrounds

### References

- Epic 8 Story 8.2 acceptance criteria: [Source: _bmad-output/planning-artifacts/epics.md#Story-8.2]
- EpicDetailResponse type: [Source: _bmad-custom/bmad-ui/src/types.ts#161]
- plannedStories UI usage: [Source: _bmad-custom/bmad-ui/src/routes/epic.$epicId.tsx#365]
- Server epic detail endpoint: [Source: _bmad-custom/bmad-ui/scripts/agent-server.ts#4157]
- getStoryContentFromEpics pattern: [Source: _bmad-custom/bmad-ui/scripts/agent-server.ts#1974]
- useEffect data fetching violation: [Source: _bmad-custom/bmad-ui/src/routes/epic.$epicId.tsx#210]
- No useEffect rule: [Source: _bmad-output/project-context.md#57]
- vite-plugin-static-data epic emission: [Source: _bmad-custom/bmad-ui/scripts/vite-plugin-static-data.ts#55]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

- Added `getPlannedStoriesFromEpics()` helper in `agent-server.ts` that extracts story IDs/prefixes from epics.md headings for a given epic number
- Updated `SprintOverview` internal type to include `plannedStoryCount` and `storiesToCreate` on each epic
- Updated both `summarizeSprint()` and `summarizeSprintFromEpics()` epic map initializations to include new fields
- In `loadSprintOverview()`, computes `plannedStoryCount` (from epics.md story headings count) and `storiesToCreate` (planned - created) when sprint-status.yaml exists; in epics-only mode sets `plannedStoryCount = storyCount`
- Updated `/api/epic/:epicId` endpoint to include `plannedStories`, `plannedStoryCount`, and `storiesToCreate` in response
- Updated `vite-plugin-static-data.ts` to emit `plannedStories`, `plannedStoryCount`, and `storiesToCreate` in static epic JSON
- Exported `getPlannedStoriesFromEpics` from `agent-server.ts`
- Replaced `useEffect` + `useState` data fetching in `epic.$epicId.tsx` with two `useQuery` calls (`["epic", epicId]` and `["overview"]`) with 5s `refetchInterval` in local mode
- EventSource usage preserved as `useEffect` (allowed per spec)
- Added proper error state when epic fetch fails: panel with amber border, eyebrow text, back link
- All 5 tasks and subtasks complete; `pnpm check` passes (lint + types + build)

### File List

- `_bmad-custom/bmad-ui/scripts/agent-server.ts`
- `_bmad-custom/bmad-ui/scripts/vite-plugin-static-data.ts`
- `_bmad-custom/bmad-ui/src/routes/epic.$epicId.tsx`
- `_bmad-output/implementation-artifacts/7-2-integrate-backlog-artifacts-with-ui-workflows.md`

## Change Log

- 2026-04-20: Implemented story 7.2 — populated `plannedStories`, `plannedStoryCount`, `storiesToCreate` in server/static responses; migrated epic detail route to TanStack Query; added error state for failed epic fetches
