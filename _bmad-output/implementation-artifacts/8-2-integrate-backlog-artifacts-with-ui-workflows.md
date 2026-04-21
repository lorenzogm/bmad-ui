# Story 8.2: Integrate Backlog Artifacts with UI Workflows

Status: ready-for-dev

## Story

As a user,
I want bmad-ui to operate with backlog artifacts produced by bmad workflows,
So that planning outputs and execution views stay connected.

## Acceptance Criteria

1. **Given** planning artifacts exist (epics.md with story headings), **When** the epic detail view loads, **Then** all stories — including planned-only ones not yet in sprint-status.yaml — are shown in correct ticket order (e.g. 8.1, 8.2, 8.3 not 8.1, 8.3, 8.2)
2. **Given** an epic has a mix of tracked and planned-only stories, **When** the user clicks "Plan all stories", **Then** only genuinely unplanned stories are submitted — already-created stories (whose `bmad-create-story` step is not "not-started") are excluded from the batch
3. **Given** a bmad workflow updates planning/implementation artifacts on disk, **When** the UI refetches (via TanStack Query polling at 5-second interval), **Then** users see the latest state without a manual page reload
4. **Given** epics.md or sprint-status.yaml is malformed or missing, **When** affected views load, **Then** the UI shows an actionable error or empty-state message instead of crashing
5. **Given** all fixes are in place, **When** `pnpm check` is run from `_bmad-custom/bmad-ui`, **Then** lint + types + tests + build all pass with zero errors

## Tasks / Subtasks

- [ ] Task 1 — Fix planned-only story sort order in `filteredStories` (AC: 1)
  - [ ] In `epic.$epicId.tsx`, update the `filteredStories` useMemo (currently line ~324) to sort the combined `[...stories, ...plannedOnlyEntries]` array using `parseStoryTicket` before returning, so planned-only rows appear at their correct ticket position rather than appended at the end
  - [ ] Verify with a visual scan that if sprint-status has stories 8.1 and 8.3 and epics.md has 8.1, 8.2, 8.3, the table displays them in order 8.1 → 8.2 → 8.3

- [ ] Task 2 — Fix "Plan all stories" to exclude already-created stories (AC: 2)
  - [ ] In `epic.$epicId.tsx`, update `storiesNeedingPlan` useMemo (currently line ~363): filter `data?.plannedStories` to exclude story IDs that already exist in the `stories` array (i.e. filter by `!existingIds.has(pid)`), so the button count only reflects genuinely untracked stories
  - [ ] Update `handlePlanAllStories` callback (currently line ~377): build `storiesToPlan` from (a) `data.plannedStories` filtered to planned-only entries (not in `existingIds`) and (b) existing stories where `steps["bmad-create-story"] === "not-started"` — eliminating the previous dedup logic that relied on inclusion in `data.plannedStories`
  - [ ] Verify: if story 8.2 has `bmad-create-story` = "completed", it is NOT submitted when "Plan all stories" is clicked

- [ ] Task 3 — Validate end-to-end and run quality gate (AC: 3, 4, 5)
  - [ ] Run `cd _bmad-custom/bmad-ui && pnpm check` — lint + types + tests + build must pass with zero errors
  - [ ] Confirm no TypeScript errors in the updated memos/callbacks

## Dev Notes

### Context: Relationship to Story 7.2

Story 7.2 delivered the core backlog artifact integration (server-side `getPlannedStoriesFromEpics`, TanStack Query migration, `plannedStories` in API responses, error states). Two review findings were triaged as patches but not implemented:

1. **Planned-only rows unsorted** — `filteredStories` appends planned-only entries after the sorted `stories` array without re-sorting. `stories` is sorted by `parseStoryTicket` comparison but the final merged array isn't.
2. **"Plan all stories" includes already-created stories** — `storiesNeedingPlan` and `handlePlanAllStories` pass all of `data.plannedStories` directly, which includes stories already tracked in sprint-status.yaml (not just planned-only ones).

Story 8.2 exists to close these two gaps and validate the complete integration meets Epic 8's phase-readiness bar (FR30: "Use bmad-ui with backlog artifacts from bmad").

### Key File: `_bmad-custom/bmad-ui/src/routes/epic.$epicId.tsx`

This is the only file that needs changes. Both fixes are isolated useMemo/useCallback updates.

**Fix 1 — `filteredStories` (line ~324):**

Current (broken):
```typescript
const filteredStories = useMemo(() => {
  const existingIds = new Set(stories.map((s) => s.id))
  const plannedOnlyEntries = (data?.plannedStories ?? [])
    .filter((pid) => !existingIds.has(pid))
    .map((pid) => ({
      id: pid,
      status: "backlog" as StoryStatus,
      steps: PLANNED_ONLY_STEPS,
    }))
  return [...stories, ...plannedOnlyEntries]
}, [data?.plannedStories, stories])
```

Fixed:
```typescript
const filteredStories = useMemo(() => {
  const existingIds = new Set(stories.map((s) => s.id))
  const plannedOnlyEntries = (data?.plannedStories ?? [])
    .filter((pid) => !existingIds.has(pid))
    .map((pid) => ({
      id: pid,
      status: "backlog" as StoryStatus,
      steps: PLANNED_ONLY_STEPS,
    }))
  return [...stories, ...plannedOnlyEntries].sort((a, b) => {
    const aTicket = parseStoryTicket(a.id)
    const bTicket = parseStoryTicket(b.id)
    if (aTicket.epic !== bTicket.epic) return aTicket.epic - bTicket.epic
    if (aTicket.story !== bTicket.story) return aTicket.story - bTicket.story
    return a.id.localeCompare(b.id)
  })
}, [data?.plannedStories, stories])
```

**Fix 2 — `storiesNeedingPlan` (line ~363):**

Current (broken):
```typescript
const storiesNeedingPlan = useMemo(() => {
  const fromPlanned = data?.plannedStories ?? []
  const fromExisting = stories
    .filter((s) => s.steps["bmad-create-story"] === "not-started")
    .map((s) => s.id)
    .filter((id) => !fromPlanned.includes(id))
  return [...fromPlanned, ...fromExisting]
}, [data?.plannedStories, stories])
```

Fixed:
```typescript
const storiesNeedingPlan = useMemo(() => {
  const existingIds = new Set(stories.map((s) => s.id))
  const fromPlanned = (data?.plannedStories ?? []).filter((pid) => !existingIds.has(pid))
  const fromExisting = stories
    .filter((s) => s.steps["bmad-create-story"] === "not-started")
    .map((s) => s.id)
  return [...fromPlanned, ...fromExisting]
}, [data?.plannedStories, stories])
```

**Fix 2 — `handlePlanAllStories` (line ~377):**

Current (broken):
```typescript
const storiesToPlan = [
  ...(data.plannedStories ?? []),
  ...stories
    .filter((s) => s.steps["bmad-create-story"] === "not-started")
    .map((s) => s.id)
    .filter((id) => !(data.plannedStories ?? []).includes(id)),
]
```

Fixed:
```typescript
const existingIds = new Set(stories.map((s) => s.id))
const storiesToPlan = [
  ...(data.plannedStories ?? []).filter((pid) => !existingIds.has(pid)),
  ...stories
    .filter((s) => s.steps["bmad-create-story"] === "not-started")
    .map((s) => s.id),
]
```

### Architecture Guardrails

- **Dual-mode architecture**: Both `scripts/agent-server.ts` and `scripts/vite-plugin-static-data.ts` were updated in story 7.2. No server changes are needed for this story — fixes are frontend-only.
- **No `useEffect` for data fetching**: Already fixed in 7.2. The `filteredStories`, `storiesNeedingPlan`, and `handlePlanAllStories` are all `useMemo`/`useCallback` — no anti-patterns introduced.
- **Named constants**: `PLANNED_ONLY_STEPS` already exists. No new magic numbers.
- **CSS variables**: No styling changes in this story.
- **`parseStoryTicket`**: Already defined in `epic.$epicId.tsx` at line ~98 — reuse it in the sort comparator (same pattern already used in `stories` useMemo at line ~297).

### Code Quality Rules (Biome)

- `Number.isNaN()`, `Number.parseInt()`, `Number.parseFloat()` — enforced by Biome, already used correctly in `parseStoryTicket`
- `useImportType` — no new imports needed
- No barrel imports — no changes to imports in this story
- Line width: 100 chars, double quotes, no semicolons, 2-space indent

### References

- Story 7.2 unresolved review findings: [Source: _bmad-output/implementation-artifacts/7-2-integrate-backlog-artifacts-with-ui-workflows.md#Review-Findings]
- `filteredStories` implementation: [Source: _bmad-custom/bmad-ui/src/routes/epic.$epicId.tsx#324]
- `storiesNeedingPlan` implementation: [Source: _bmad-custom/bmad-ui/src/routes/epic.$epicId.tsx#363]
- `handlePlanAllStories` implementation: [Source: _bmad-custom/bmad-ui/src/routes/epic.$epicId.tsx#377]
- `parseStoryTicket` helper: [Source: _bmad-custom/bmad-ui/src/routes/epic.$epicId.tsx#98]
- Epic 8 Story 8.2 acceptance criteria: [Source: _bmad-output/planning-artifacts/epics.md#Story-8.2]
- Project context rules: [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
