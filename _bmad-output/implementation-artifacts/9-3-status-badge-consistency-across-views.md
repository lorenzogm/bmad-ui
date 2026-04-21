# Story 9.3: Status Badge Consistency Across Views

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want consistent, accessible status badges on all entities (epics, stories, sessions),
so that I can quickly scan status without decoding inconsistent label styles.

## Acceptance Criteria

1. **Given** any status value (done, in-progress, ready-for-dev, backlog, running, completed, planned, failed, cancelled, review, stale, warning, not-started, pending, skipped),
   **When** displayed as a badge,
   **Then** it uses the canonical `.step-badge` variant (e.g. `step-done`, `step-in-progress`) with no hardcoded inline colors.

2. **Given** all views that show statuses (sessions table, epic table, story detail, epic detail, workflow phases, analytics views),
   **When** reviewed,
   **Then** no hardcoded colors or one-off badge styles exist outside the design system CSS classes.

3. **Given** screen-reader context,
   **When** a badge is read aloud,
   **Then** the status label text is meaningful (e.g., "Done", "In Progress", "To Do", "Running") — not just a raw machine key like "in-progress".

4. **Given** a shared `StatusBadge` component is introduced,
   **When** any view renders a status badge,
   **Then** it uses the shared component rather than inline `<span className="step-badge step-${status}">` patterns scattered across route files.

## Tasks / Subtasks

- [x] Audit all status badge usages across the codebase (AC: 1, 2)
  - [x] Catalogue every inline `step-badge` pattern in `src/app.tsx` and all `src/routes/*.tsx` files
  - [x] Identify which render raw machine-readable values vs. already-humanized labels
  - [x] Identify any inline styles or non-design-system badge patterns that must be removed

- [x] Define a shared `StatusBadge` component and status label map (AC: 1, 3, 4)
  - [x] Add `statusBadgeClass(status: string): string` — maps raw status keys to the correct `.step-${variant}` suffix (e.g., `"in-progress"` → `"in-progress"`, `"ready-for-dev"` → `"in-progress"`, `"backlog"` → `"not-started"`)
  - [x] Add `statusLabel(status: string): string` — maps raw status keys to human-readable labels (e.g., `"in-progress"` → `"In Progress"`, `"ready-for-dev"` → `"Ready"`, `"not-started"` → `"To Do"`, `"backlog"` → `"To Do"`, `"running"` → `"Running"`)
  - [x] Export `StatusBadge` as a named function component from `src/app.tsx` — accepts `status: string` prop, renders `<span className={\`step-badge step-${statusBadgeClass(status)}\`}>{statusLabel(status)}</span>`
  - [x] No new CSS classes — only use existing `.step-badge` variants from `src/styles.css`

- [x] Replace inline badge patterns in `src/app.tsx` (AC: 4)
  - [x] `SessionsTable`: replace both inline `step-badge step-${displayStatus}` spans with `<StatusBadge status={displayStatus} />`
  - [x] `EpicTableSection`: replace `step-badge step-${epic.status}` and `step-badge step-${epic.lifecycleSteps["bmad-retrospective"]}` spans
  - [x] `BMADWorkflowSection` (workflow phase header badges): replace inline `step-badge step-${status}` for phase-level status summary
  - [x] `BMADWorkflowSection` (workflow step badges): replace inline `step-badge ${stepStatusClassName}` for individual workflow steps — keep the `isRunning` ⬡ icon logic as-is, just use `StatusBadge` for the label part
  - [x] `BMADWorkflowSection` (epic rows): replace `step-badge step-${epic.status}` in implementation phase epic list

- [x] Replace inline badge patterns in route files (AC: 4)
  - [x] `src/routes/home.tsx` — replace `step-badge step-in-progress` hardcoded badge and `step-badge step-${epic.status}` badges
  - [x] `src/routes/sessions.tsx` — replace `step-badge step-${session.status}` with `<StatusBadge status={session.status} />`
  - [x] `src/routes/session.$sessionId.tsx` — replace `step-badge step-${session.status}` with `<StatusBadge status={session.status} />`
  - [x] `src/routes/analytics-sessions.tsx` — replace `step-badge step-${session.status}` with `<StatusBadge status={session.status} />`
  - [x] `src/routes/analytics-model-detail.tsx` — replace `step-badge step-${session.status}` with `<StatusBadge status={session.status} />`
  - [x] `src/routes/analytics-story-detail.tsx` — replace `step-badge step-${session.status}` with `<StatusBadge status={session.status} />`
  - [x] `src/routes/story.$storyId.tsx` — replace `step-badge step-${props.state}` (workflow state badge) and the inline ternary badge for story status
  - [x] `src/routes/epic.$epicId.tsx` — replace `step-badge step-${computedEpicStatus}`, story status badges (`storyStatusBadgeClass`), and lifecycle step badges; remove the now-redundant local `storyStatusBadgeClass` / `storyStatusLabel` / `STORY_STATUS_LABELS` / `STORY_STATUS_BADGE_CLASS` in favour of the shared map
  - [x] `src/routes/workflow.$phaseId.tsx` — replace step-status and epic-status badges in phase detail view
  - [x] `src/routes/workflow.$phaseId.$stepId.tsx` — replace `step-badge step-${statusLabel}` with `<StatusBadge status={...} />`
  - [x] `src/routes/workflow-index.tsx` — replace `step-badge step-${status}` in workflow overview
  - [x] `src/routes/improvement-workflow.tsx` — replace inline ternary badge pattern (running icon kept as special span)

- [x] Verify quality gate (AC: 1, 2, 3, 4)
  - [x] `cd _bmad-custom/bmad-ui && pnpm check` passes with no lint, type, or build errors
  - [x] No remaining inline `step-badge step-done` / `step-badge step-${rawValue}` patterns without `StatusBadge` wrapper (run `grep -r 'step-badge' src/` to confirm)
  - [x] Confirm `<StatusBadge>` renders meaningful text labels (not "in-progress", "not-started" as literal text) in browser dev build

## Dev Notes

### Story Intent

This is a pure refactoring + accessibility story. The visual appearance of existing badges must **not change** — only the implementation pattern is being unified. Do not add new badge styles or CSS variables.

### Existing `.step-badge` CSS Variants (from `src/styles.css`)

Use only these existing classes — do NOT add new ones:

| CSS class | Display color |
|---|---|
| `.step-done` / `.step-completed` / `.step-skipped` | Green |
| `.step-in-progress` / `.step-running` / `.step-ready-for-dev` | Amber |
| `.step-backlog` / `.step-not-started` | Gray |
| `.step-review` | Blue |
| `.step-planned` | Indigo |
| `.step-warning` | Amber + orange border |
| `.step-failed` | Red |
| `.step-cancelled` / `.step-stale` | Slate |
| `.step-all` | Cyan |

### `statusBadgeClass` Mapping

Map raw status strings to the right CSS suffix. Handle all known values:

```ts
const STATUS_BADGE_CLASS: Record<string, string> = {
  done: "done",
  completed: "done",
  skipped: "done",
  "in-progress": "in-progress",
  running: "running",
  "ready-for-dev": "in-progress",
  review: "review",
  backlog: "not-started",
  "not-started": "not-started",
  pending: "not-started",
  planned: "planned",
  failed: "failed",
  cancelled: "cancelled",
  stale: "stale",
  warning: "warning",
}
// fallback: return status as-is so unknown values still render
```

### `statusLabel` Mapping

Convert machine keys to human-readable English:

```ts
const STATUS_LABEL: Record<string, string> = {
  done: "Done",
  completed: "Done",
  skipped: "Skipped",
  "in-progress": "In Progress",
  running: "Running",
  "ready-for-dev": "Ready",
  review: "In Review",
  backlog: "To Do",
  "not-started": "To Do",
  pending: "Pending",
  planned: "Planned",
  failed: "Failed",
  cancelled: "Cancelled",
  stale: "Stale",
  warning: "Warning",
}
// fallback: title-case the raw value
```

### `StatusBadge` Component Shape

```tsx
// Export from src/app.tsx (existing export file for shared components)
export function StatusBadge(props: { status: string }) {
  const cls = STATUS_BADGE_CLASS[props.status] ?? props.status
  const label = STATUS_LABEL[props.status] ?? titleCase(props.status)
  return <span className={`step-badge step-${cls}`}>{label}</span>
}
```

### Special Cases to Handle

1. **`BMADWorkflowSection` running step** — the running step renders a `⬡` icon + " running" text inside the badge. Keep this special render as-is (it's a `stepStatusClassName` pattern not a raw status), or inline it only for the running state in the workflow step badge.

2. **session status filter buttons in `AgentSessionsSection`** — the filter button badges must continue to show the raw filter label (e.g., "All", "running") because the label is used for UX affordance. Use `StatusBadge` only for the non-"All" filter badges; the display text for filter buttons should still match what users selected (do not change filter pill labels).

3. **`epic.$epicId.tsx` local helpers** — `storyStatusBadgeClass`, `storyStatusLabel`, `STORY_STATUS_LABELS`, `STORY_STATUS_BADGE_CLASS` can all be removed once `StatusBadge` + `statusLabel` are in place. Use `statusLabel` in place of `storyStatusLabel`. Use `StatusBadge` in place of the inline badge spans with `storyStatusBadgeClass`.

4. **`storyStepLabel` in `app.tsx`** — keep this function as-is (it's used for workflow step rendering where "running" is displayed as "in-progress" for UX reasons). Do not remove it.

### Project Structure Notes

- `StatusBadge`, `statusBadgeClass`, and `statusLabel` live in `src/app.tsx` alongside other shared exported helpers (`storyStepLabel`, `AgentSessionsSection`, etc.)
- All constants (`STATUS_BADGE_CLASS`, `STATUS_LABEL`) must be named `const` at the top of the file (Biome magic-number rule applies to number literals, but consistency favors top-of-file placement)
- Named function component only — no arrow function const
- Use `import type` for type-only imports in route files

### References

- Existing `.step-badge` CSS: `_bmad-custom/bmad-ui/src/styles.css` lines ~1800–1874
- Current badge usage audit: `src/app.tsx` lines 153, 163, 186, 392, 807, 813, 902, 927, 989, 992
- Routes with inline badges: `src/routes/epic.$epicId.tsx:979,1011,1054,1081,1108`, `src/routes/sessions.tsx:193`, `src/routes/session.$sessionId.tsx:536`, `src/routes/analytics-*.tsx`, `src/routes/workflow.$phaseId.tsx:250,383,387`, `src/routes/story.$storyId.tsx:168,265`
- Local helpers to consolidate: `epic.$epicId.tsx` lines 71–94 (`STORY_STATUS_LABELS`, `storyStatusLabel`, `STORY_STATUS_BADGE_CLASS`, `storyStatusBadgeClass`)
- Exported shared helpers pattern: `src/app.tsx` — `storyStepLabel` (line 34), `AgentSessionsSection`, `EpicTableSection`, `WorkflowStep`, etc.
- project-context: `_bmad-output/project-context.md` — always read before editing

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

- Implemented `StatusBadge`, `statusBadgeClass`, `statusLabel` in `src/app.tsx` with `STATUS_BADGE_CLASS` and `STATUS_LABEL` maps
- Replaced all inline `step-badge step-${...}` patterns across 12 route files with `<StatusBadge status={...} />`
- Removed local `STORY_STATUS_LABELS`, `storyStatusLabel`, `STORY_STATUS_BADGE_CLASS`, `storyStatusBadgeClass` helpers from `epic.$epicId.tsx`
- Running-icon badges in `workflow.$phaseId.tsx` line 260 kept as-is per Dev Notes (special case with ⬡ icon)
- `improvement-workflow.tsx` running icon extracted to conditional: special span for running state, `StatusBadge` for non-running
- `pnpm check` passes: lint, types, tests, build all green

### File List

- `_bmad-custom/bmad-ui/src/app.tsx` (modified — added StatusBadge, statusBadgeClass, statusLabel, STATUS_BADGE_CLASS, STATUS_LABEL)
- `_bmad-custom/bmad-ui/src/routes/home.tsx` (modified — StatusBadge import + 2 badge replacements)
- `_bmad-custom/bmad-ui/src/routes/sessions.tsx` (modified — StatusBadge import + badge replacement)
- `_bmad-custom/bmad-ui/src/routes/session.$sessionId.tsx` (modified — StatusBadge import + badge replacement)
- `_bmad-custom/bmad-ui/src/routes/analytics-sessions.tsx` (modified — StatusBadge import + badge replacement)
- `_bmad-custom/bmad-ui/src/routes/analytics-model-detail.tsx` (modified — StatusBadge import + badge replacement)
- `_bmad-custom/bmad-ui/src/routes/analytics-story-detail.tsx` (modified — StatusBadge import + badge replacement)
- `_bmad-custom/bmad-ui/src/routes/story.$storyId.tsx` (modified — StatusBadge import + 2 badge replacements)
- `_bmad-custom/bmad-ui/src/routes/epic.$epicId.tsx` (modified — StatusBadge import, removed 4 local helpers, replaced 10 badges)
- `_bmad-custom/bmad-ui/src/routes/workflow.$phaseId.tsx` (modified — StatusBadge import + 2 epic badge replacements)
- `_bmad-custom/bmad-ui/src/routes/workflow.$phaseId.$stepId.tsx` (modified — StatusBadge import, removed local statusLabel var, replaced artifact badge)
- `_bmad-custom/bmad-ui/src/routes/workflow-index.tsx` (modified — StatusBadge import + badge replacement)
- `_bmad-custom/bmad-ui/src/routes/improvement-workflow.tsx` (modified — StatusBadge import, replaced ternary badge with conditional rendering)
- `_bmad-output/implementation-artifacts/9-3-status-badge-consistency-across-views.md` (modified — status + tasks updated)
