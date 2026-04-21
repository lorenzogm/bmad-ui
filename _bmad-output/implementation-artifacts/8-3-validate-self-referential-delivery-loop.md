# Story 8.3: Validate Self-Referential Delivery Loop

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want to verify that bmad-ui can support implementation execution from its own generated epics and stories,
So that Phase 1 proves operational readiness for Phase 2.

## Acceptance Criteria

1. **Given** approved epics and stories, **When** implementation work is executed, **Then** maintainers can track progress through bmad-ui views — the home page sprint overview, epic detail views, and story detail views all reflect real project state from the actual bmad-ui sprint data, including Epic 8 stories delivered in this epic.

2. **Given** at least one end-to-end implementation sample, **When** reviewed, **Then** planning-to-execution traceability is demonstrable: the UI shows the path from epics.md → story spec files → session log data within the same interface, now including Epic 8 execution.

3. **Given** loop validation findings, **When** documented, **Then** blockers and follow-up actions are captured in `docs/phase-1-completion.md` (update existing doc) for Phase 2 planning, including: which views worked correctly, current gaps, and what the Phase 2 baseline is at Epic 8 close.

## Tasks / Subtasks

- [ ] Confirm dependency stories are done before starting (AC: #1)
  - [ ] Verify 8-1 (Deliver Core Workflow Visibility Views) is in `done` status in sprint-status.yaml
  - [ ] Verify 8-2 (Integrate Backlog Artifacts with UI Workflows) is in `done` status in sprint-status.yaml
  - [ ] If either is not done, block this story and report status

- [ ] Exercise key UI views against real bmad-ui project data at Epic 8 delivery state (AC: #1, #2)
  - [ ] Start dev server (`cd _bmad-custom/bmad-ui && pnpm dev`) and open bmad-ui in browser
  - [ ] Verify home page sprint overview shows correct epic/story counts reflecting Epic 8 progress
  - [ ] Navigate to epic detail view for epic-8 — confirm all 4 stories (8-1 through 8-4) appear with correct statuses
  - [ ] Navigate to a story-8 detail view — confirm story spec content from `_bmad-output/implementation-artifacts/8-*.md` is rendered correctly
  - [ ] Navigate to sessions list view — confirm recent agent sessions (Epic 8 execution sessions) appear in the table
  - [ ] Navigate to a session detail view — confirm individual session details render
  - [ ] Navigate to analytics dashboard — confirm charts include Epic 8 session data
  - [ ] Navigate to workflow view — confirm workflow phases render correctly
  - [ ] Record any views that fail to render, display empty, or throw console errors
  - [ ] Run `agent-browser errors` to check for JavaScript console errors

- [ ] Fix any rendering issues discovered during validation (AC: #1)
  - [ ] Address any JavaScript console errors in the views exercised above
  - [ ] Ensure graceful empty states appear where data may be absent (no blank screens)
  - [ ] Run `cd _bmad-custom/bmad-ui && pnpm check` to confirm no regressions

- [ ] Update `docs/phase-1-completion.md` with Epic 8 validation results (AC: #2, #3)
  - [ ] Update the view-by-view results table to reflect current state
  - [ ] Document Epic 8 traceability path: epic plan → story spec → session execution → UI visibility
  - [ ] Update Sprint State section to reflect Epic 8 completion counts
  - [ ] Add "Epic 8 Validation" section: loop verified including 8.1–8.4 story delivery
  - [ ] Capture any remaining open gaps and deferred items as Phase 2 baseline inputs
  - [ ] Note whether `deferred-work.md` items from earlier stories were addressed or remain open

## Dev Notes

### Nature of This Story

**Validation + documentation story with minor bug-fix scope.** The primary deliverable is exercising the live UI against real project data and updating `docs/phase-1-completion.md` to reflect the Epic 8 delivery state. Code changes are limited to fixing rendering bugs discovered during validation.

**Important prerequisite:** This story depends on 8-1 and 8-2 being done first. Before starting implementation, confirm sprint-status.yaml shows `8-1-deliver-core-workflow-visibility-views: done` and `8-2-integrate-backlog-artifacts-with-ui-workflows: done`. If either is still backlog or in-progress, do not proceed — create those stories and complete them first.

### What "Self-Referential" Means

bmad-ui tracks bmad agent workflows. bmad-ui was also *built using* bmad agent workflows. This story verifies the system is coherent: the same UI used to plan and track delivery is observable through itself.

The loop at Epic 8 close:
`epics.md → story spec files → Copilot CLI sessions → agents-sessions.json → bmad-ui views`

A successful validation means a maintainer can open bmad-ui and see:
- The Epic 8 breakdown showing all four stories with correct statuses
- Individual story 8.x specs in the story detail view (markdown rendered)
- The agent sessions that implemented Epic 8 stories
- Cost/model analytics aggregating Epic 8 execution sessions

### How This Differs from Story 7.3

Story 7.3 was the *first* self-referential loop validation, establishing `docs/phase-1-completion.md` from scratch. Story 8.3 is the *second* validation checkpoint — it re-exercises the same loop after Epic 8 has been delivered to confirm nothing regressed and to capture the updated Phase 2 baseline.

Key differences:
- Validate Epic 8 data specifically appears correctly in all views
- Update (not create) `docs/phase-1-completion.md` — add Epic 8 section
- Sprint counts and session analytics will have grown since 7.3 — update the numbers
- Any bug fixes from 8.1 or 8.2 should already be reflected; this story confirms they are

### Key Views to Validate

| Route | Data source | What to verify |
|---|---|---|
| `/` (home) | `/api/overview`, `/api/analytics` | Sprint overview counts include Epic 8 stories |
| `/epics/epic-8` | `/api/epics/epic-8` | All 4 stories shown with correct statuses |
| `/stories/8-3-validate-self-referential-delivery-loop` | `/api/stories/:storyId` | This story's spec rendered in markdown |
| `/sessions` | `/api/sessions` (analytics) | Recent Epic 8 execution sessions visible |
| `/sessions/:sessionId` | `/api/sessions/:id` | Session turn count, model, status |
| `/analytics` | `/api/analytics` | Cost chart includes Epic 8 sessions |
| `/workflow` | `/api/overview` | Workflow phase list renders correctly |

### Data Files That Back the Views

- `_bmad-custom/agents/agents-sessions.json` → Sessions and analytics views
- `_bmad-output/implementation-artifacts/sprint-status.yaml` → Sprint overview, epic/story statuses
- `_bmad-output/planning-artifacts/epics.md` → Epic goals and story descriptions
- `_bmad-output/implementation-artifacts/8-*.md` → Story spec files for Epic 8

### Dual-Mode Architecture

The dev server (`pnpm dev`) runs in local mode where `IS_LOCAL_MODE = true`. API calls are served by `scripts/agent-server.ts` middleware. Use `apiUrl("/api/...")` pattern — already established in all existing route files.

Never hardcode paths. Never use `useEffect` for data fetching — TanStack Query handles all data loading.

### Learnings from Story 7.3

From the 7.3 implementation record:
- All 7 core views rendered successfully against real project data
- No rendering bugs were found in 7.3 — views already had graceful loading/error states
- Known pre-existing issue: `story.$storyId.tsx`, `session.$sessionId.tsx`, `prepare-story.$storyId.tsx`, and `analytics-utils.tsx` still use `useEffect` for data fetching instead of TanStack Query — documented as Phase 2 technical debt, do NOT fix in this story
- The traceability path was successfully demonstrated end-to-end

If any of those `useEffect` data fetching patterns were fixed in 8.1 or 8.2, verify those routes still work correctly during this validation.

### Phase 2 Baseline to Document

The update to `docs/phase-1-completion.md` should capture the Phase 2 baseline after Epic 8:

1. All Phase 1 epics (1–8) completed
2. Self-referential loop validated twice (7.3 and 8.3)
3. Technical debt items still open (from `deferred-work.md`)
4. Phase 2 architectural goals (shadcn/ui, Base UI, `src/ui/` hierarchy) as described in `project-context.md`
5. Remaining `useEffect` data fetching violations (if not fixed in 8.1/8.2)

### agent-browser Verification

Use agent-browser to catch JavaScript errors during validation:

```bash
# Start dev server first
cd _bmad-custom/bmad-ui && pnpm dev &

# Verify app loads
agent-browser open http://localhost:5173
agent-browser snapshot -i
agent-browser errors

# Check epic-8 view
agent-browser open "http://localhost:5173/epics/epic-8"
agent-browser snapshot -i
agent-browser errors

# Close when done
agent-browser close
```

### Code Quality Constraints

- **No custom CSS classes** — existing legacy classes in `styles.css` should not be added to
- **No `useEffect` for data fetching** — all data already uses TanStack Query in most routes
- **Named functions** for any new components
- **`import type`** for type-only imports
- Run `pnpm check` before committing any code fixes

### Files to Create/Modify

| File | Action |
|---|---|
| `docs/phase-1-completion.md` | Update — add Epic 8 validation results and updated Phase 2 baseline |
| `_bmad-custom/bmad-ui/src/routes/*.tsx` | Modify — only if rendering bugs are found during validation |

### Project Structure Notes

- All docs live in `docs/` at the repository root (not inside `_bmad-custom/bmad-ui/`)
- Route files are in `_bmad-custom/bmad-ui/src/routes/`
- No barrel `index.ts` files — import directly from source file
- The `@/*` alias maps to `./src/*` inside `_bmad-custom/bmad-ui`

### References

- [Source: epics.md#Story-8.3] — User story, acceptance criteria, FR31+FR38
- [Source: prd.md#FR31] — "Maintainer can validate that bmad-ui supports development execution against epics and stories generated in backlog workflows"
- [Source: prd.md#FR38] — "Maintainer can use Phase 1 outputs as baseline inputs for Phase 2 refactoring"
- [Source: architecture.md#Phase-1-Delivered] — Phase 1 delivered capabilities, deferred decisions at Phase 1 close
- [Source: project-context.md] — Tech stack, code quality rules, TanStack Query for data fetching, Phase 2 aspirational rules
- [Source: 7-3-validate-self-referential-delivery-loop.md] — Previous validation approach, learnings, completion notes
- [Source: docs/phase-1-completion.md] — Existing Phase 1 report to update (do not recreate from scratch)
- [Source: deferred-work.md] — Open deferred items to review for Phase 2 baseline status

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
