# Story 7.1: Deliver Core Workflow Visibility Views

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to view core workflow state and flow context in bmad-ui,
so that I can understand project execution without reading raw orchestration logs.

## Acceptance Criteria

1. **Given** a running workflow context, **When** the user opens bmad-ui, **Then** overview screens show current workflow state and key progress signals (epic/story counts by status, active sessions, estimated cost).

2. **Given** available epic and story data, **When** navigating core views, **Then** users can inspect status and progression across backlog items by navigating: Home → Workflow/Implementation phase → Epic detail → Story detail.

3. **Given** missing or stale runtime data, **When** encountered, **Then** the UI shows graceful empty and error states instead of crashing (empty-row messages in tables, panel-level "no data" messages, error strings surfaced inline).

## Tasks / Subtasks

- [ ] Audit and fix `useEffect`-based data fetching violations (AC: #1, #2, #3)
  - [ ] Migrate `src/routes/story.$storyId.tsx` — replace `useEffect` data fetch with `useQuery` for `/api/story/{storyId}` and `/api/story-preview/{storyId}` calls
  - [ ] Migrate `src/routes/epic.$epicId.tsx` — replace `useEffect` data fetch with `useQuery` for `/api/epic/{epicId}` and `/api/overview` (SSE `EventSource` subscription can stay as `useEffect` — real-time streaming is an accepted exception)
  - [ ] Migrate `src/routes/analytics-utils.tsx` — if used as a shared data-loading hook, refactor to `useQuery`

- [ ] Verify and harden empty states across core views (AC: #3)
  - [ ] Home page (`src/routes/home.tsx`): confirm that when `overview` has empty `epics` / `stories` arrays, the overview cards show `0` counts cleanly (no crash)
  - [ ] Workflow phase view (`src/routes/workflow.$phaseId.tsx`): confirm that when `sortedEpics` is empty the table shows "No epics found in sprint status" row
  - [ ] Epic detail view (`src/routes/epic.$epicId.tsx`): confirm that when `stories` is empty the story list shows an empty-state row
  - [ ] Story detail view (`src/routes/story.$storyId.tsx`): confirm graceful rendering when `markdownContent` is null
  - [ ] Sessions list (`src/routes/sessions.tsx`): already shows "No sessions found" row — confirm it still renders when `sessions` is an empty array

- [ ] Verify and harden error states across core views (AC: #3)
  - [ ] Home page: `overviewError` / `analyticsError` currently render as plain text inside `<main className="screen loading">` — confirm error string is legible and the page does not crash
  - [ ] Workflow index (`src/routes/workflow-index.tsx`): error is surfaced inline — confirm
  - [ ] Epic detail: surfaced via inline error from `useQuery` — confirm after migration
  - [ ] Story detail: surfaced via inline error — confirm after migration

- [ ] End-to-end smoke test of the visibility path (AC: #1, #2)
  - [ ] Run `pnpm run dev` locally, open `http://localhost:5173`
  - [ ] Navigate: Home → Workflow → Implementation phase → an in-progress/backlog Epic → a Story
  - [ ] Confirm no JavaScript console errors on any of these pages
  - [ ] Confirm all panels render data (or graceful empty states) without layout breakage

- [ ] Run quality gate: `cd _bmad-custom/bmad-ui && pnpm check` — must pass before committing

## Dev Notes

### What Exists vs. What Needs Work

This story is primarily a **validation + hardening** story. The major UI views were built as part of earlier epics. The work here is:
1. Fixing `useEffect` data-fetch violations (project rule: use `useQuery`, never `useEffect` for data)
2. Verifying every view on the critical navigation path (Home → Workflow → Epic → Story) shows graceful states
3. No new routes are needed

### Critical File Locations

| File | Role | Issue |
|---|---|---|
| `src/routes/home.tsx` | Home overview page | OK — uses `useQuery` already |
| `src/routes/workflow-index.tsx` | Workflow phases list | OK — uses `useQuery` |
| `src/routes/workflow.$phaseId.tsx` | Phase detail + epic list | OK — uses `useQuery` |
| `src/routes/epic.$epicId.tsx` | Epic detail + story list | ❌ uses `useEffect` for data fetch + SSE |
| `src/routes/story.$storyId.tsx` | Story detail + markdown | ❌ uses `useEffect` for data fetch |
| `src/routes/prepare-story.$storyId.tsx` | Story preparation | ❌ uses `useEffect` for data fetch |
| `src/routes/analytics-utils.tsx` | Shared analytics hook | ❌ uses `useEffect` for data fetch |
| `src/routes/sessions.tsx` | Sessions list | OK — uses `useQuery` |
| `src/routes/session.$sessionId.tsx` | Session detail + SSE | Partial — SSE acceptable, scroll `useEffect` acceptable |

### useEffect Migration Pattern

**Forbidden pattern (data fetch in useEffect):**
```tsx
// ❌ DO NOT DO THIS
useEffect(() => {
  let mounted = true
  const load = async () => {
    const res = await fetch(apiUrl(`/api/story/${storyId}`))
    if (mounted) setData(await res.json())
  }
  void load()
  return () => { mounted = false }
}, [storyId])
```

**Required pattern (TanStack Query):**
```tsx
// ✅ CORRECT
const { data, isLoading, error } = useQuery<StoryDetailResponse>({
  queryKey: ["story", storyId],
  queryFn: async () => {
    const response = await fetch(apiUrl(`/api/story/${storyId}`))
    if (!response.ok) throw new Error(`Request failed: ${response.status}`)
    return (await response.json()) as StoryDetailResponse
  },
})
```

**SSE (EventSource) — allowed in useEffect:**
SSE connections for live updates (`/api/events/session/{id}`, `/api/events/overview`) are real-time subscriptions, not one-shot data fetches. These may remain as `useEffect` with proper cleanup:
```tsx
useEffect(() => {
  const es = new EventSource(apiUrl(`/api/events/session/${sessionId}`))
  es.onmessage = (e) => { /* handle */ }
  return () => es.close()  // cleanup required
}, [sessionId])
```

**Scroll-to-bottom useEffect — allowed:**
```tsx
useEffect(() => {
  chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
}, [streamContent])
```

### TanStack Query Key Conventions

Look at existing `useQuery` calls in the codebase before creating new ones — reuse same query keys so data is shared:
- `["overview"]` — OverviewResponse from `/api/overview`
- `["analytics"]` — AnalyticsResponse from `/api/analytics`
- `["sessions"]` — SessionAnalytics[] from `/api/analytics`
- `["story", storyId]` — StoryDetailResponse from `/api/story/{id}`
- `["epic", epicId]` — EpicDetailResponse from `/api/epic/{id}`
- `["session", sessionId]` — SessionDetailResponse from `/api/session/{id}`
- `["sidebar-sessions"]` — used in `__root.tsx` (do not remove or rename)

### Empty State Pattern (required for all tables)

When a table has no rows, show a colSpan row:
```tsx
{items.length === 0 && (
  <tr>
    <td className="empty-row" colSpan={NUM_COLS}>
      No items found
    </td>
  </tr>
)}
```

### Loading & Error State Pattern

**Loading:**
```tsx
if (isLoading) return <main className="screen loading">Loading...</main>
```

**Error:**
```tsx
if (error) return <main className="screen loading">{String(error)}</main>
```

These are the current minimal patterns. Do NOT add skeleton loaders or fancy empty states here — that work belongs to Story 8.1.

### API Endpoints Used by Core Views

All are `GET` requests, no auth needed, no request body:
- `GET /api/overview` → `OverviewResponse` (home, workflow views)
- `GET /api/epic/{epicId}` → `EpicDetailResponse` (epic detail)
- `GET /api/story/{storyId}` → `StoryDetailResponse` (story detail)
- `GET /api/story-preview/{storyId}` → `StoryPreviewResponse` (story preparation)
- `GET /api/analytics` → `AnalyticsResponse` (sessions, analytics views)

In production (non-local mode), `apiUrl()` maps these to `/data/*.json` static files — no server needed.

### Production vs. Local Mode

The `IS_LOCAL_MODE` flag (`src/lib/mode.ts`) is `import.meta.env.DEV`. Production builds serve static JSON files from `/data/`. Action buttons that mutate state must check `IS_LOCAL_MODE` and be disabled in production. **Read-only views always work in both modes.**

### Design System Rules (Must Follow)

- Dark space/tech theme — never use light backgrounds
- Use existing CSS classes: `.panel`, `.step-badge step-{status}`, `.eyebrow`, `.subtitle`, `.empty-row`
- CSS variables: `var(--text)`, `var(--muted)`, `var(--highlight)`, `var(--status-done)`, `var(--status-progress)`, `var(--status-ready)`, `var(--status-backlog)`
- `Number.isNaN()` not `isNaN()` — Biome enforces
- `import type { ... }` for type-only imports — Biome enforces
- Named function components (not arrow functions assigned to const)
- Magic numbers → named `const` at top of file

### TypeScript Types

All shared types are in `src/types.ts`. Do not create new type definitions in route files unless they are purely local view-model types. The relevant types for this story:
- `OverviewResponse` — home and workflow views
- `EpicDetailResponse` — epic detail
- `StoryDetailResponse` — story detail  
- `StoryPreviewResponse` — story preparation
- `AnalyticsResponse` — sessions, analytics

### Route Registration

Routes are manually registered in `src/routes/route-tree.ts`. This story does NOT add new routes — all needed routes already exist. Do not modify `route-tree.ts` unless adding a new route.

### Project Structure Notes

- All route components live in `_bmad-custom/bmad-ui/src/routes/`
- Shared utility functions live in `src/app.tsx` (exported: `detectWorkflowStatus`, `storyStepLabel`)
- API URL helper: `src/lib/mode.ts` → `apiUrl(path)`
- No barrel exports — import directly from file path
- `@/*` path alias maps to `./src/*`

### References

- Story requirements: [Source: _bmad-output/planning-artifacts/epics.md — Epic 7, Story 7.1]
- FR28, FR29, FR32: [Source: _bmad-output/planning-artifacts/epics.md — Functional Requirements]
- Architecture data patterns: [Source: _bmad-output/planning-artifacts/architecture.md — Frontend Architecture, Data Architecture]
- Project rules: [Source: _bmad-output/project-context.md — Language-Specific Rules, Framework-Specific Rules]
- Design system: [Source: custom_instruction Design System section]
- API contracts: [Source: docs/api-contracts-bmad-ui.md]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
