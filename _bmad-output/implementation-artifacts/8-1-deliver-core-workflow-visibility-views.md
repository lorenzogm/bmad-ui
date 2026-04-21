# Story 8.1: Deliver Core Workflow Visibility Views

Status: review

## Story

As a user,
I want to view core workflow state and flow context in bmad-ui,
so that I can understand project execution without reading raw orchestration logs.

## Acceptance Criteria

1. **Given** a running workflow context, **When** the user opens bmad-ui, **Then** overview screens show current workflow state and key progress signals (active epic, in-progress stories, running sessions).

2. **Given** available epic and story data, **When** navigating core views, **Then** users can inspect status and progression across backlog items (epic detail, story lists, progress indicators).

3. **Given** missing or stale runtime data, **When** encountered, **Then** the UI shows graceful empty and error states instead of crashing.

## Tasks / Subtasks

- [x] Improve home page overview section to surface active workflow state (AC: #1)
  - [x] Replace static Phase 1 description text with dynamic active sprint context (current epic, in-progress stories count, running sessions)
  - [x] Ensure the "Project Summary" section correctly reflects live data with no placeholder copy
  - [x] Verify "At a Glance" cards all show sensible zeros when data is absent (no crash)

- [x] Audit and improve loading and error states in core views (AC: #3)
  - [x] Replace `<main className="screen loading">Loading...</main>` in `home.tsx` with a styled skeleton or spinner matching the dark theme
  - [x] Replace raw error string in `home.tsx` with a styled error panel using CSS variables
  - [x] Audit `epic.$epicId.tsx` loading and error states for graceful display
  - [x] Audit `sessions.tsx` loading and error states for graceful display
  - [x] Audit `story.$storyId.tsx` loading and error states for graceful display

- [x] Add empty state handling for zero-data scenarios (AC: #3)
  - [x] Home page "Epic Breakdown" section: show a helpful empty message when `epics.length === 0`
  - [x] Sessions page: show a helpful empty message when sessions list is empty (no filters active)
  - [x] Epic detail: show a graceful message when no stories exist in the epic

- [x] Run quality gate and verify no regressions (AC: #1, #2, #3)
  - [x] `cd _bmad-custom/bmad-ui && pnpm check` passes with zero errors

## Dev Notes

### Story Nature

This story is a **targeted UI improvement** to the existing core views. The views already exist and largely work — the goal is to:
1. Improve the home/overview page to surface active workflow state
2. Replace generic loading/error strings with styled components
3. Add graceful empty states where data is absent

**Do NOT** add new routes. **Do NOT** restructure existing views. Make surgical edits to the existing route files only.

### Current State Snapshot

As of story 7-4 completion:
- `home.tsx` — overview page exists, uses `/api/overview` and `/api/analytics`. Loading state is `<main className="screen loading">Loading...</main>`. Error state dumps raw error string. Static description paragraph is about Phase 1 infrastructure.
- `epic.$epicId.tsx` — epic detail page exists with stories, steps, and orchestration actions.
- `story.$storyId.tsx` — story detail page exists.
- `sessions.tsx` — sessions list exists with filter controls.
- `__root.tsx` — sidebar layout with navigation and New Chat flyout.

### Key Implementation Guidance

#### 1. Home Page Active Workflow State (Task 1)

The home page (`src/routes/home.tsx`) has a static `<section className="panel reveal">` with hardcoded Phase 1 description text. Replace the description paragraphs with a dynamic active sprint summary:

- Show the active epic (first epic with `status === "in-progress"`) with its name and story completion percentage
- Show in-progress story count across all epics
- Show running sessions count
- If nothing is active, show a neutral "All caught up" message

Use data already fetched from `useQuery<OverviewResponse>({ queryKey: ["overview"] })` — the `overview.sprintOverview.epics` array has `status`, `name`, `number`, `storyCount`, `byStoryStatus`.

**Do NOT** introduce a new API call for this. Derive from existing `overview` and `analytics` query data already on the page.

#### 2. Loading State Replacement (Task 2)

Replace both inline loading/error strings in `home.tsx`:

```tsx
// BEFORE (do not leave as-is):
if (overviewLoading || analyticsLoading) {
  return <main className="screen loading">Loading...</main>
}
if (overviewError || analyticsError) {
  return <main className="screen loading">{String(overviewError || analyticsError)}</main>
}

// AFTER (styled, dark theme):
// Loading: use a panel with subtle animated pulse or "Loading dashboard..." text using var(--muted)
// Error: use a panel with error icon and message using var(--highlight-2) or similar
```

Naming pattern for helper components: keep them named functions (not arrow const), e.g. `function LoadingState()` and `function ErrorState({ message }: { message: string })`.

Do the same for `sessions.tsx` and `epic.$epicId.tsx` — check if they have similar bare loading/error returns and replace with styled equivalents.

#### 3. Empty State Handling (Task 3)

Empty states should be simple and helpful. Example pattern:

```tsx
// In the Epic Breakdown section of home.tsx, when epics.length === 0:
<div className="py-8 text-center" style={{ color: "var(--muted)" }}>
  <p>No epics found. Run sprint-planning to initialize.</p>
</div>
```

For `sessions.tsx`, when the filtered list is empty:
```tsx
<div className="py-8 text-center" style={{ color: "var(--muted)" }}>
  <p>No sessions found{statusFilter !== ALL_FILTER ? ` with status "${statusFilter}"` : ""}.</p>
</div>
```

### Project Structure Notes

All edits are in `_bmad-custom/bmad-ui/src/routes/`. Files to touch:

| File | Change |
|---|---|
| `src/routes/home.tsx` | Replace loading/error states; replace static description with dynamic summary; add epic empty state |
| `src/routes/sessions.tsx` | Audit + improve loading/error/empty states |
| `src/routes/epic.$epicId.tsx` | Audit + improve loading/error/empty states |
| `src/routes/story.$storyId.tsx` | Audit + improve loading/error/empty states (if bare strings found) |

### Styling Rules (Critical)

- **Never hardcode colors** — always use `var(--text)`, `var(--muted)`, `var(--highlight)`, `var(--highlight-2)`, `var(--status-done)`, `var(--status-progress)`, etc.
- **Never use light backgrounds** — dark theme only
- Use `className="panel"` for card containers
- Use Tailwind utility classes for layout (flex, grid, gap, py, px, etc.)
- Existing CSS classes in `styles.css` can be reused: `.eyebrow`, `.subtitle`, `.step-badge`, `.step-badge.step-done`, `.cta`, `.ghost`
- No new custom CSS classes — use Tailwind utilities on JSX directly

### Code Quality Rules (Critical)

- Named functions only — `function ComponentName()` not `const ComponentName = () =>`
- `import type { ... }` for type-only imports
- Use `Number.isNaN()`, `Number.parseInt()`, `Number.parseFloat()` — never global variants
- Magic numbers → named `const` at top of file
- No default exports
- `@/*` path alias for imports from `src/` — never relative `../../`
- No `useEffect` for data fetching — TanStack Query only
- `noUnusedLocals`/`noUnusedParameters` enforced — every variable must be used

### Tech Stack Reference

- React 19.2.5, TypeScript 6.0.2, Vite 8.0.8
- TanStack Router 1.168.22 (manual route tree in `src/routes/route-tree.ts`)
- TanStack Query 5.99.0 (`useQuery`, `useMutation`)
- Tailwind CSS v4 (Vite plugin — no PostCSS, no `tailwind.config.js`)
- Biome 2.4.12 (linter + formatter — NOT ESLint/Prettier)
- `pnpm check` = lint + types + tests + build quality gate

### References

- [Source: epics.md#Story-8.1] — User story, acceptance criteria, FR28/FR29/FR32 mapping
- [Source: epics.md#Epic-8] — Epic objectives: "visual companion to bmad orchestration workflows, observing flow and analysis context without reading raw logs"
- [Source: project-context.md#Styling-Rules] — CSS variables, Tailwind v4, dark theme rules
- [Source: project-context.md#React-Rules] — Named function components, TanStack Query usage
- [Source: project-context.md#Critical-Don't-Miss-Rules] — Anti-patterns to avoid
- [Source: src/routes/home.tsx] — Existing overview page to improve
- [Source: src/routes/sessions.tsx] — Existing sessions page to audit
- [Source: src/routes/epic.$epicId.tsx] — Existing epic detail page to audit

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

- Replaced static Phase 1 description in `home.tsx` with dynamic `ActiveSprintSummary` component that shows active epic, in-progress story count, and running sessions count (or "All caught up" when idle).
- Added styled `LoadingState` and `ErrorState` helper components in `home.tsx`, `sessions.tsx` replacing bare `<main className="screen loading">` strings.
- Improved error state in `story.$storyId.tsx` with a styled panel matching dark theme (previously used plain text in loading-class `<main>`).
- Enhanced epic `$epicId.tsx` bare loading string with a styled panel.
- Replaced sessions table-row empty state with a contextual `<div>` showing filter-aware message (e.g. `No sessions found with status "running"`).
- Added empty state for Epic Breakdown section in home page when `epics.length === 0`.
- Improved epic detail table empty row with centered styled text.
- All changes validated via `pnpm check` (lint + types + tests + build) — zero errors.

### File List

- `_bmad-custom/bmad-ui/src/routes/home.tsx` — Added `LoadingState`, `ErrorState`, `ActiveSprintSummary` components; replaced static description with dynamic sprint summary; added epic empty state
- `_bmad-custom/bmad-ui/src/routes/sessions.tsx` — Added `LoadingState`, `ErrorState` components; replaced bare loading/error returns; improved sessions empty state with filter-aware message
- `_bmad-custom/bmad-ui/src/routes/epic.$epicId.tsx` — Replaced bare loading string with styled panel; improved empty stories table row styling
- `_bmad-custom/bmad-ui/src/routes/story.$storyId.tsx` — Replaced bare loading/error states with styled panels matching dark theme
- `_bmad-output/implementation-artifacts/8-1-deliver-core-workflow-visibility-views.md` — Story file updated
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Story status updated to review
