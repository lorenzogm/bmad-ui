# Story 9.6: Sidebar Running Sessions Panel

Status: done

## Story

As a user monitoring active BMAD agent workflows,
I want the sidebar Sessions section to show only currently running sessions,
So that I can instantly see what's happening without scanning through completed sessions.

## Acceptance Criteria

1. **Given** the sidebar Sessions section, **When** one or more sessions have `status === "running"`, **Then** only those running sessions are listed in the sidebar submenu, each with a status indicator dot.

2. **Given** the sidebar Sessions section, **When** no sessions are currently running, **Then** a subtle "No active sessions" label is shown in the submenu (instead of nothing).

3. **Given** a running session listed in the sidebar, **When** the session transitions to `status === "completed"`, **Then** it is removed from the sidebar list on the next data refetch (within the existing refetch interval).

4. **Given** the sidebar Sessions link, **When** clicked, **Then** it still navigates to the full sessions list page (all sessions, not just running ones).

5. **Given** the running sessions list in the sidebar, **When** more than the sidebar display limit are running, **Then** only up to that limit are shown, ordered by most-recently-started first.

## Tasks / Subtasks

- [x] Add "No active sessions" empty state to sidebar sessions submenu (AC: 2)
  - [x] In `_bmad-custom/bmad-ui/src/routes/__root.tsx`, change the conditional `{recentSessions.length > 0 ? <div className="sidebar-submenu">...</div> : null}` to always render the submenu
  - [x] When `recentSessions.length === 0`, render a `<span className="sidebar-sessions-empty">No active sessions</span>` inside the submenu div
  - [x] When `recentSessions.length > 0`, keep the existing session link list as-is

- [x] Verify all other ACs are met by the existing implementation (AC: 1, 3, 4, 5)
  - [x] Confirm `RUNNING_STATUS` filter is active on `recentSessions`
  - [x] Confirm `SESSIONS_SIDEBAR_LIMIT` slices the array
  - [x] Confirm sort by `startedAt` descending is applied
  - [x] Confirm Sessions sidebar link navigates to `/sessions`

- [x] Run quality gate (AC: all)
  - [x] `cd _bmad-custom/bmad-ui && pnpm check` must pass

### Review Findings

- [x] [Review][Patch] Show loading state while sidebar sessions query initializes [`_bmad-custom/bmad-ui/src/routes/__root.tsx:309`]
- [x] [Review][Patch] Prevent retry click event from being forwarded into TanStack `refetch` options [`_bmad-custom/bmad-ui/src/lib/loading-states.tsx:57`]
- [x] [Review][Patch] Replace shared loading-state inline styles with Tailwind/CSS-variable classes [`_bmad-custom/bmad-ui/src/lib/loading-states.tsx:1`]
- [x] [Review][Patch] Keep home dashboard visible when epics are empty but other analytics data exists [`_bmad-custom/bmad-ui/src/routes/home.tsx:160`]
- [x] [Review][Defer] Story commit touched files beyond the planned single-file scope — deferred, pre-existing

## Dev Notes

### Current Implementation State

Most of AC 1, 3, 4, 5 are **already implemented** in `_bmad-custom/bmad-ui/src/routes/__root.tsx`. The only gap is AC 2 — the "No active sessions" empty state.

**What is already in place (do not re-implement):**

- `useQuery` fetches from `apiUrl("/api/analytics")` every `SESSIONS_REFETCH_INTERVAL_MS` (3 000 ms) — `queryKey: ["sidebar-sessions"]`
- `recentSessions` is derived by `.filter((s) => s.status === RUNNING_STATUS && s.sessionId.startsWith(WORKFLOW_SESSION_PREFIX)).slice(0, SESSIONS_SIDEBAR_LIMIT)`
- Sessions are pre-sorted by `startedAt` descending before filtering
- Running sessions render inside `.sidebar-submenu` using `.sidebar-sublink.session-link-running` with `.sidebar-session-status[data-status="running"]` dot

**Constants already defined (do not duplicate):**
```
SESSIONS_SIDEBAR_LIMIT = 10
SESSIONS_REFETCH_INTERVAL_MS = 3_000
RUNNING_STATUS = "running"
WORKFLOW_SESSION_PREFIX = "workflow-"
```

### The Only Change Required

The current conditional block:

```tsx
{recentSessions.length > 0 ? (
  <div className="sidebar-submenu">
    {recentSessions.map((session) => { ... })}
  </div>
) : null}
```

Must become:

```tsx
<div className="sidebar-submenu">
  {recentSessions.length > 0 ? (
    recentSessions.map((session) => { ... })
  ) : (
    <span className="sidebar-sessions-empty">No active sessions</span>
  )}
</div>
```

### CSS Classes to Use

The `.sidebar-sessions-empty` class is already defined in `_bmad-custom/bmad-ui/src/styles.css` (line ~234):

```css
.sidebar-sessions-empty {
  padding: 0.2rem 1rem 0.4rem;
  font-size: 0.78rem;
  color: var(--muted);
  opacity: 0.6;
}
```

Use this class — do NOT add inline styles or new CSS.

### Project Structure Notes

- All changes are confined to a single file: `_bmad-custom/bmad-ui/src/routes/__root.tsx`
- No new routes, types, API endpoints, or server-side changes are needed
- The `SessionAnalytics` type (`src/types.ts` line ~277) and `AnalyticsResponse` type (line ~303) are already imported and used — no type changes needed

### Important Rules

- ❌ Never use `useEffect` for data fetching — TanStack Query is already in place, do not touch it
- ❌ Do not add new CSS classes — `.sidebar-sessions-empty` already exists
- ❌ Do not change the filter logic unless there is a clear regression — the `workflow-` prefix filter is intentional
- ✅ Use named functions for components (already the case in `RootLayout`)
- ✅ Always run `pnpm check` before marking done

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.6] — Acceptance criteria and implementation notes
- [Source: _bmad-output/implementation-artifacts/spec-sidebar-running-sessions.md] — One-shot spec that partially implemented this feature
- [Source: _bmad-custom/bmad-ui/src/routes/__root.tsx] — Current sidebar implementation (the only file to change)
- [Source: _bmad-custom/bmad-ui/src/styles.css#L234] — `.sidebar-sessions-empty` CSS class
- [Source: _bmad-output/project-context.md] — TanStack Query rules, Biome, named functions, no default exports

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

- Replaced `{recentSessions.length > 0 ? <div className="sidebar-submenu">…</div> : null}` with an always-rendered submenu div that shows "No active sessions" when the list is empty.
- All other ACs (1, 3, 4, 5) were already satisfied by the existing filter/sort/slice logic — no changes needed.
- Fixed pre-existing Biome import-order and missing-import issues in several analytics route files (`analytics-sessions.tsx`, `analytics-stories.tsx`, `analytics-story-detail.tsx`) to unblock the quality gate.
- `pnpm check` passes: lint ✅, types ✅, tests ✅, build ✅.

### File List

- `_bmad-custom/bmad-ui/src/routes/__root.tsx` — sidebar empty-state change (primary story change)
- `_bmad-custom/bmad-ui/src/routes/analytics-sessions.tsx` — fixed import order (pre-existing issue)
- `_bmad-custom/bmad-ui/src/routes/analytics-stories.tsx` — fixed import order (pre-existing issue)
- `_bmad-custom/bmad-ui/src/routes/analytics-story-detail.tsx` — added missing loading-states imports (pre-existing issue)

## Change Log

- 2026-04-22: Implemented "No active sessions" empty state in sidebar sessions submenu (AC 2). Fixed pre-existing lint/import issues in analytics route files to satisfy quality gate.
