# Story 7.3: Validate Self-Referential Delivery Loop

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want to verify that bmad-ui can support implementation execution from its own generated epics and stories,
So that Phase 1 proves operational readiness for Phase 2.

## Acceptance Criteria

1. **Given** approved epics and stories, **When** implementation work is executed, **Then** maintainers can track progress through bmad-ui views — the home page sprint overview, epic detail views, and story detail views all reflect real project state from the actual bmad-ui sprint data.

2. **Given** at least one end-to-end implementation sample, **When** reviewed, **Then** planning-to-execution traceability is demonstrable: the UI shows the path from epics.md → story spec files → session log data within the same interface.

3. **Given** loop validation findings, **When** documented, **Then** blockers and follow-up actions are captured in `docs/phase-1-completion.md` for Phase 2 planning, including: which views worked correctly, what gaps remain, and what the Phase 2 baseline is.

## Tasks / Subtasks

- [x] Exercise key UI views against real bmad-ui project data (AC: #1, #2)
  - [x] Start dev server (`cd _bmad-custom/bmad-ui && pnpm dev`) and open bmad-ui in browser
  - [x] Verify home page sprint overview shows correct epic/story counts from sprint-status.yaml
  - [x] Navigate to epic detail view for epic-7 and epic-8 — confirm titles, goals, and story lists render without errors
  - [x] Navigate to a story detail view — confirm story spec content is rendered correctly
  - [x] Navigate to sessions list view — confirm agent sessions from agents-sessions.json are shown in the table
  - [x] Navigate to a session detail view — confirm individual session details render
  - [x] Navigate to analytics dashboard — confirm charts and metrics render with real session data
  - [x] Navigate to workflow view — confirm workflow phases render correctly
  - [x] Record any views that fail to render, display empty, or throw console errors

- [x] Fix any rendering issues discovered during validation (AC: #1)
  - [x] Address any JavaScript console errors in the views exercised above
  - [x] Ensure graceful empty states appear where data may be absent (no blank screens)
  - [x] Run `cd _bmad-custom/bmad-ui && pnpm check` to confirm no regressions

- [x] Create `docs/phase-1-completion.md` documenting the self-referential loop validation (AC: #2, #3)
  - [x] Document which views successfully showed bmad-ui project data
  - [x] Document the traceability path: epic plan → story spec → session execution → UI visibility
  - [x] Capture Phase 1 done criteria met (infrastructure, CI/CD, docs, adoption signals, E2E baseline)
  - [x] Capture open gaps and deferred items as Phase 2 baseline inputs
  - [x] List deferred items from `deferred-work.md` that remain relevant for Phase 2

### Review Findings

- [x] [Review][Patch] Epic detail validation target mismatch (epic-8 required, epic-9 reported) [docs/phase-1-completion.md:35]
- [x] [Review][Patch] Story detail route evidence is truncated (`/stories/7-3-...`) and not reproducible [docs/phase-1-completion.md:36]
- [x] [Review][Defer] Pre-existing TanStack Query adoption gap remains in story/session/prepare-story and analytics routes [_bmad-output/implementation-artifacts/7-3-validate-self-referential-delivery-loop.md:149] — deferred, pre-existing

## Dev Notes

### Nature of This Story

**Validation + documentation story with minor bug-fix scope.** The primary deliverable is exercising the live UI against real project data and producing `docs/phase-1-completion.md`. Code changes are limited to fixing rendering bugs discovered during validation.

This story "closes the loop" on Phase 1: bmad-ui was built to monitor bmad workflows, and this story verifies it can monitor its own development execution.

### What "Self-Referential" Means

bmad-ui tracks bmad agent workflows. bmad-ui was also *built using* bmad agent workflows. This story verifies the system is coherent: the same UI used to plan and track delivery is observable through itself.

The loop: `epics.md → story spec files → Copilot CLI sessions → agents-sessions.json → bmad-ui views`

A successful validation means a maintainer can open bmad-ui and see:
- The epics breakdown for this very project
- The individual story progress
- The agent sessions that performed implementation
- The cost/model analytics from those sessions

### Key Views to Validate

| Route | Data source | What to verify |
|---|---|---|
| `/` (home) | `/api/overview`, `/api/analytics` | Sprint overview counts, session cost summary |
| `/epics/:epicId` | `/api/epics/:epicId` | Epic title, story list, story statuses |
| `/stories/:storyId` | `/api/stories/:storyId` | Story spec rendered in markdown |
| `/sessions` | `/api/sessions` (analytics) | Sessions table with rows |
| `/sessions/:sessionId` | `/api/sessions/:id` | Session turn count, model, status |
| `/analytics` | `/api/analytics` | Cost chart, model breakdown |
| `/workflow` | `/api/overview` | Workflow phase list |

### Data Files That Back the Views

- `_bmad-custom/agents/agents-sessions.json` → Sessions and analytics views
- `_bmad-output/implementation-artifacts/sprint-status.yaml` → Sprint overview, epic/story statuses
- `_bmad-output/planning-artifacts/epics.md` → Epic goals and story descriptions
- `_bmad-output/implementation-artifacts/*.md` → Story spec files

### Dual-Mode Architecture

The dev server (`pnpm dev`) runs in local mode where `IS_LOCAL_MODE = true`. API calls are served by `scripts/agent-server.ts` middleware. Use `apiUrl("/api/...")` pattern — already established in all existing route files.

Never hardcode paths. Never use `useEffect` for data fetching — TanStack Query handles all data loading.

### Phase 1 Done Criteria to Document

The `docs/phase-1-completion.md` should confirm these Phase 1 acceptance criteria from the PRD:

1. Repository is public with CI/CD pipelines functional
2. `npx bmad-method-ui install` installs bmad-ui in a bmad project
3. Dev server starts cleanly and all core views render
4. The app can run a self-referential delivery loop (this story proves it)
5. Phase 2 inputs are captured and deferred items are enumerated

### Deferred Work Reference

Check `_bmad-output/implementation-artifacts/deferred-work.md` for deferred items from earlier stories that are still unresolved. Include relevant ones in the Phase 2 baseline section of `docs/phase-1-completion.md`.

### Code Quality Constraints

- **No custom CSS classes** — existing legacy classes in `styles.css` should not be added to
- **No `useEffect` for data fetching** — all data already uses TanStack Query
- **Named functions** for any new components
- **`import type`** for type-only imports
- Run `pnpm check` before committing any code fixes

### Files to Create/Modify

| File | Action |
|---|---|
| `docs/phase-1-completion.md` | Create — Phase 1 validation summary |
| `_bmad-custom/bmad-ui/src/routes/*.tsx` | Modify — only if rendering bugs are found during validation |

### Project Structure Notes

- All docs live in `docs/` at the repository root (not inside `_bmad-custom/bmad-ui/`)
- Route files are in `_bmad-custom/bmad-ui/src/routes/`
- No barrel `index.ts` files — import directly from source file
- The `@/*` alias maps to `./src/*` inside `_bmad-custom/bmad-ui`

### References

- [Source: epics.md#Story-7.3 (old Epic 7 / current Epic 8)] — User story, acceptance criteria, FR31+FR38
- [Source: prd.md#FR31] — "Maintainer can validate that bmad-ui supports development execution against epics and stories generated in backlog workflows"
- [Source: prd.md#FR38] — "Maintainer can use Phase 1 outputs as baseline inputs for Phase 2 refactoring"
- [Source: prd.md#phase-1-acceptance] — "The app can run a self-referential delivery loop: consume backlog epics/stories and support implementation execution for the app itself"
- [Source: architecture.md] — Dual-mode architecture (dev vs prod), file-based data, no database in Phase 1
- [Source: project-context.md] — Tech stack, code quality rules, TanStack Query for data fetching

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

- All 7 core views validated against real bmad-ui project data: home, workflow, epic detail (epic-7, epic-8), story detail, sessions list, session detail, analytics dashboard — all render without errors.
- No rendering bugs found; all routes have graceful loading/error states.
- `pnpm check` passes (lint + types + build) with no regressions.
- Non-breaking code quality gaps noted: `story.$storyId.tsx`, `session.$sessionId.tsx`, `prepare-story.$storyId.tsx`, and `analytics-utils.tsx` still use `useEffect` for data fetching instead of TanStack Query — documented as Phase 2 technical debt.
- Traceability path demonstrated: epics.md → story spec files → Copilot CLI sessions → agents-sessions.json → UI views.
- Sprint state at validation: 11 epics (6 done, 2 in-progress, 3 backlog), 46 stories (23 done), 234 sessions captured.

### File List

- `docs/phase-1-completion.md` — Created: Phase 1 validation summary, traceability documentation, Phase 2 baseline
- `_bmad-output/implementation-artifacts/7-3-validate-self-referential-delivery-loop.md` — Updated: all tasks checked, status "done"
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Updated: story 7-3 status "done"
