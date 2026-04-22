# Story 9.1: Improve Empty States and Loading Feedback

Status: done

## Story

As a user,
I want clear loading skeletons and empty state messages,
So that I never see a blank screen or raw spinner without context.

## Acceptance Criteria

**AC1 — Loading skeleton during fetch:**
**Given** any page loading data via TanStack Query,
**When** a fetch is in progress,
**Then** a skeleton or shimmer placeholder is shown that matches the final layout (not a raw text spinner)

**AC2 — Empty state when no data:**
**Given** a page with no data (e.g., no sessions, no epics),
**When** the page loads successfully but returns empty results,
**Then** a friendly empty state message with a relevant icon and suggested action is displayed

**AC3 — Error state with retry:**
**Given** a fetch error,
**When** encountered,
**Then** an error state with a retry action button replaces the blank content area (clicking retry re-fires the query)

## Tasks / Subtasks

- [x] Create shared loading-state components (AC: #1, #2, #3)
  - [x] Create `src/lib/loading-states.tsx` with `PageSkeleton`, `EmptyState`, and `QueryErrorState` components
  - [x] `PageSkeleton` renders 2–3 shimmering panel-shaped blocks using Tailwind `animate-pulse`
  - [x] `EmptyState` accepts `icon`, `title`, `description`, and optional `action` (label + onClick) props
  - [x] `QueryErrorState` accepts `message` and `onRetry` (the TanStack Query `refetch` function) props

- [x] Replace raw text loading states in TanStack Query routes (AC: #1)
  - [x] `src/routes/workflow-index.tsx` — replace `<main className="screen loading">Loading...</main>` with `<PageSkeleton />`
  - [x] `src/routes/workflow.$phaseId.tsx` — replace `<main className="screen loading">Loading...</main>` with `<PageSkeleton />`
  - [x] `src/routes/workflow.$phaseId.$stepId.tsx` — replace `<main className="screen loading">Loading step details...</main>` with `<PageSkeleton />`
  - [x] `src/routes/sessions.tsx` — replace local `LoadingState` text component with `<PageSkeleton />`
  - [x] `src/routes/home.tsx` — replace local `LoadingState` text component with `<PageSkeleton />`

- [x] Upgrade error states to include retry (AC: #3)
  - [x] `src/routes/workflow-index.tsx` — replace raw error string with `<QueryErrorState message={...} onRetry={refetch} />`
  - [x] `src/routes/workflow.$phaseId.tsx` — replace raw error string with `<QueryErrorState />`
  - [x] `src/routes/workflow.$phaseId.$stepId.tsx` — replace raw error string with `<QueryErrorState />`
  - [x] `src/routes/sessions.tsx` — update `ErrorState` to accept and wire `refetch` as `onRetry`
  - [x] `src/routes/home.tsx` — update `ErrorState` to accept and wire `refetch` as `onRetry`

- [x] Add empty states to sessions and home (AC: #2)
  - [x] `src/routes/sessions.tsx` — when filtered list is empty, show `<EmptyState>` with "No sessions found" and hint to adjust filter or run sync daemon
  - [x] `src/routes/sessions.tsx` — when full list is empty (no data at all), show `<EmptyState>` with "No sessions yet" and hint to run `sync-sessions`
  - [x] `src/routes/home.tsx` — when `epics` array is empty, show `<EmptyState>` in the sprint section with "No active sprint" and hint to run `bmad sprint-planning`

- [x] Update analytics routes that use simple text loading (AC: #1, #3)
  - [x] `src/routes/analytics-dashboard.tsx` — replace `<main className="screen loading">Loading analytics...</main>` with `<PageSkeleton />`
  - [x] `src/routes/analytics-sessions.tsx` — same
  - [x] `src/routes/analytics-epic-detail.tsx` — same
  - [x] `src/routes/analytics-model-detail.tsx` — same
  - [x] `src/routes/analytics-story-detail.tsx` — same
  - [x] `src/routes/analytics-stories.tsx` — same
  - [x] For analytics routes: replace generic error strings with `<QueryErrorState>` where a `refetch` is accessible from the data hook

- [x] Verify quality gate (AC: all)
  - [x] `cd _bmad-custom/bmad-ui && pnpm check` passes with exit code 0

### Review Findings

- [x] [Review][Patch] Filtered sessions empty state did not use the shared `EmptyState` UX [src/routes/sessions.tsx:101]

## Dev Notes

### Critical Architecture Rules

- **TanStack Query only**: Use `isLoading`, `isError`, `error`, `refetch` from `useQuery` / `useAnalyticsData`. Do NOT use `useEffect` + `useState(true)` for loading states. Routes that currently use `useEffect` loading patterns (e.g., `prepare-story.$storyId.tsx`, `story.$storyId.tsx`, `app.tsx`) are **out of scope for this story** — do not touch them.
- **No new CSS classes**: Per project-context.md rule, do not add new classes to `styles.css`. Use Tailwind utility classes (`animate-pulse`, `bg-white/10`, `rounded`) directly in components. [Source: _bmad-output/project-context.md#85]
- **No hardcoded colors**: Use CSS variables (`var(--panel)`, `var(--muted)`, `var(--highlight)`, etc.) — never hardcoded hex/rgb values.
- **Named function exports**: Use `export function PageSkeleton()` not `export const PageSkeleton = () =>`. [Source: _bmad-output/project-context.md#Code-Style]
- **Import types**: Use `import type { ... }` for type-only imports. [Source: _bmad-output/project-context.md#Code-Style]
- **No barrel exports**: Each export in `loading-states.tsx` must be a named export, no default export, no re-export index. [Source: _bmad-output/project-context.md]

### New File: `src/lib/loading-states.tsx`

Place shared loading/empty/error state components here — the `src/lib/` directory is the correct home for cross-cutting React utilities in Phase 1. Do NOT create `src/ui/` (Phase 2 only). [Source: _bmad-output/project-context.md#90-91]

```tsx
// src/lib/loading-states.tsx
// Shared UI components for loading, empty, and error states

export function PageSkeleton() {
  return (
    <main className="screen">
      <div className="panel animate-pulse" style={{ height: "6rem", opacity: 0.4 }} />
      <div className="panel animate-pulse" style={{ height: "10rem", opacity: 0.3, marginTop: "1rem" }} />
      <div className="panel animate-pulse" style={{ height: "8rem", opacity: 0.2, marginTop: "1rem" }} />
    </main>
  )
}

type EmptyStateProps = {
  icon?: string          // emoji or short glyph, e.g. "📭"
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) { ... }

type QueryErrorStateProps = {
  message: string
  onRetry?: () => void
}

export function QueryErrorState({ message, onRetry }: QueryErrorStateProps) { ... }
```

### Existing Pattern Reference: `ErrorState` in sessions.tsx and home.tsx

Both files currently define a local `ErrorState` function component (without retry). These should be replaced/upgraded to use `QueryErrorState` from `loading-states.tsx` and wire `refetch` as `onRetry`.

```tsx
// Before (sessions.tsx):
const { data, isLoading, error } = useQuery(...)
if (error) return <ErrorState message={String(error)} />

// After:
const { data, isLoading, error, refetch } = useQuery(...)
if (error) return <QueryErrorState message={String(error)} onRetry={refetch} />
```

### Loading State Patterns Found — Routes to Fix

The following routes use the antipattern `<main className="screen loading">Loading...</main>`:

| Route file | Current pattern | Fix |
|---|---|---|
| `workflow-index.tsx:34` | `<main className="screen loading">Loading...</main>` | `<PageSkeleton />` |
| `workflow.$phaseId.tsx:132` | `<main className="screen loading">Loading...</main>` | `<PageSkeleton />` |
| `workflow.$phaseId.$stepId.tsx:215` | `<main className="screen loading">Loading step details...</main>` | `<PageSkeleton />` |
| `analytics-dashboard.tsx:23` | `<main className="screen loading">Loading analytics...</main>` | `<PageSkeleton />` |
| `analytics-sessions.tsx:15` | `<main className="screen loading">Loading analytics...</main>` | `<PageSkeleton />` |
| `analytics-epic-detail.tsx:17` | `<main className="screen loading">Loading analytics...</main>` | `<PageSkeleton />` |
| `analytics-model-detail.tsx:17` | `<main className="screen loading">Loading analytics...</main>` | `<PageSkeleton />` |
| `analytics-story-detail.tsx:17` | `<main className="screen loading">Loading analytics...</main>` | `<PageSkeleton />` |
| `analytics-stories.tsx:15` | `<main className="screen loading">Loading analytics...</main>` | `<PageSkeleton />` |

Routes with custom `LoadingState` functions (also to replace):

| Route file | Fix |
|---|---|
| `sessions.tsx:46` — local `LoadingState()` | Remove local function; use `<PageSkeleton />` |
| `home.tsx:16` — local `LoadingState()` | Remove local function; use `<PageSkeleton />` |

### Out of Scope — Do Not Touch

These files use `useState(true)` + `useEffect` for loading — they are NOT using TanStack Query for loading and would require a larger refactor. Leave them unchanged:

- `src/app.tsx` — root app loading (separate concern, uses custom initialization logic)
- `src/routes/prepare-story.$storyId.tsx` — uses `useEffect` for markdown fetch
- `src/routes/story.$storyId.tsx` — uses `useEffect` for file fetch
- `src/routes/analytics-utils.tsx` — custom `useAnalyticsData` hook that returns `loading` state

> For `analytics-utils.tsx`: the analytics sub-routes use `const { data, loading, error } = useAnalyticsData()` which returns a `loading: boolean`. The `PageSkeleton` can be used but there is no `refetch` available from the hook. For these routes, replacing the text loading state with `<PageSkeleton />` is sufficient; error retry is not achievable without refactoring the hook.

### PageSkeleton Design

The skeleton should use the `.panel` CSS class (existing dark glass card) with `animate-pulse` Tailwind class to produce a shimmering dark rectangle. Use reduced opacity to signal "loading" state. Three blocks at different heights mimic the typical page layout (header panel, main content panel, secondary panel).

Do NOT add keyframe animation to `styles.css` — `animate-pulse` from Tailwind is sufficient. [Source: _bmad-output/project-context.md#85]

### EmptyState Design

Should follow the design system:
- Container: `<main className="screen"><div className="panel">...`
- Icon: large centered emoji or glyph using `var(--muted)` color
- Title: uses `var(--text)` color, readable size
- Description: uses `var(--muted)` color, smaller
- Optional action button: use `.cta` class (existing teal button) or `.ghost` class

### QueryErrorState Design

Should follow `home.tsx`'s current `ErrorState` pattern but add:
- Retry button using `.ghost` class
- Wire `onRetry` to the button's `onClick`
- Use `var(--highlight-2)` (amber) for the error accent color (same as existing pattern)

### Project Structure Notes

**Files to create:**
- `src/lib/loading-states.tsx` — new shared component file

**Files to modify:**
- `src/routes/workflow-index.tsx` — loading + error states
- `src/routes/workflow.$phaseId.tsx` — loading + error states
- `src/routes/workflow.$phaseId.$stepId.tsx` — loading + error states
- `src/routes/sessions.tsx` — loading + error + empty states
- `src/routes/home.tsx` — loading + error + empty states
- `src/routes/analytics-dashboard.tsx` — loading state
- `src/routes/analytics-sessions.tsx` — loading state
- `src/routes/analytics-epic-detail.tsx` — loading state
- `src/routes/analytics-model-detail.tsx` — loading state
- `src/routes/analytics-story-detail.tsx` — loading state
- `src/routes/analytics-stories.tsx` — loading state

**Files NOT to create or modify:**
- `src/routes/route-tree.ts` — no new routes added; `loading-states.tsx` is not a route
- `src/styles.css` — no new CSS classes
- `src/types.ts` — no new types needed (colocate props types with the new component)
- Any file in `_bmad-output/` outside of this story file and sprint-status.yaml

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-9.1] — User story, AC, FR mapping
- [Source: _bmad-output/planning-artifacts/prd.md#NFR3] — "Core UI pages render initial usable state within 3 seconds"
- [Source: _bmad-output/planning-artifacts/prd.md#NFR21] — Keyboard-navigable interaction paths
- [Source: _bmad-output/planning-artifacts/prd.md#NFR22] — No reduction to accessibility baseline
- [Source: _bmad-output/planning-artifacts/architecture.md#419] — "Every route that reads remote state must define loading, empty, and error behavior explicitly"
- [Source: _bmad-output/planning-artifacts/architecture.md#426] — "Query-driven loading indicators are the default for remote reads"
- [Source: _bmad-output/project-context.md#85] — "Do not add new CSS classes; shared visual patterns should live in React components"
- [Source: _bmad-output/project-context.md#90] — "All components colocated in route files or app.tsx in Phase 1; no src/ui/ hierarchy"
- [Source: src/routes/sessions.tsx#46-69] — Existing LoadingState/ErrorState patterns to replace
- [Source: src/routes/home.tsx#16-39] — Same pattern in home route

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

- Created `src/lib/loading-states.tsx` with `PageSkeleton`, `EmptyState`, and `QueryErrorState` components
- Replaced all text-based loading states across 11 route files with `<PageSkeleton />`
- Added retry button to all error states via `QueryErrorState` with `onRetry` wired to `refetch`
- Added `EmptyState` for sessions (empty list + filtered empty), and home page (no epics)
- For analytics routes using `useAnalyticsData()`, `refetch` is not available — error states use `QueryErrorState` without retry per story spec
- `pnpm check` passes with exit code 0

### File List

- `_bmad-custom/bmad-ui/src/lib/loading-states.tsx` (created)
- `_bmad-custom/bmad-ui/src/routes/workflow-index.tsx` (modified)
- `_bmad-custom/bmad-ui/src/routes/workflow.$phaseId.tsx` (modified)
- `_bmad-custom/bmad-ui/src/routes/workflow.$phaseId.$stepId.tsx` (modified)
- `_bmad-custom/bmad-ui/src/routes/sessions.tsx` (modified)
- `_bmad-custom/bmad-ui/src/routes/home.tsx` (modified)
- `_bmad-custom/bmad-ui/src/routes/analytics-dashboard.tsx` (modified)
- `_bmad-custom/bmad-ui/src/routes/analytics-sessions.tsx` (modified)
- `_bmad-custom/bmad-ui/src/routes/analytics-epic-detail.tsx` (modified)
- `_bmad-custom/bmad-ui/src/routes/analytics-model-detail.tsx` (modified)
- `_bmad-custom/bmad-ui/src/routes/analytics-story-detail.tsx` (modified)
- `_bmad-custom/bmad-ui/src/routes/analytics-stories.tsx` (modified)
- `_bmad-output/implementation-artifacts/9-1-improve-empty-states-and-loading-feedback.md` (updated)
