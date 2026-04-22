# Story 9.7: Add Planning & Solutioning Step Detail Views

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user reviewing BMAD workflow phases,
I want direct detail views for the PRD, UX Design, and Architecture workflow steps,
so that I can inspect the related artifacts and understand what each workflow skill will ask before I run it.

## Acceptance Criteria

1. **Given** the Planning phase detail page at `/workflow/planning`, **When** the PRD and UX Design rows render, **Then** each row includes a dedicated detail link that opens a step detail view while preserving the existing run, skip, and session actions.

2. **Given** the Solutioning phase detail page at `/workflow/solutioning`, **When** the Architecture row renders, **Then** it includes the same detail-link pattern and opens a dedicated Architecture detail view.

3. **Given** a step detail view, **When** the related planning artifact exists, **Then** the page shows the artifact status and a readable markdown preview of the corresponding document (`prd.md`, the UX design doc if present, or `architecture.md`), and **When** the UX step is skipped or no UX markdown file exists, **Then** the page shows a graceful skipped or not-created state instead of an error.

4. **Given** a PRD, UX Design, or Architecture detail view, **When** the page loads, **Then** it shows a skill overview plus a summary of the question themes and representative prompts that the related BMAD skill asks, based on the current workflow step files for `bmad-create-prd`, `bmad-create-ux-design`, and `bmad-create-architecture`.

5. **Given** local and production modes, **When** the detail views load, **Then** they use the existing dual-mode architecture: dev data from `scripts/agent-server.ts`, production data emitted by `scripts/vite-plugin-static-data.ts`, and frontend fetching through `apiUrl()` + TanStack Query (no `useEffect` data fetching).

## Tasks / Subtasks

- [x] Add a workflow-step detail response contract and payload builder (AC: 3, 4, 5)
  - [x] Add a dedicated response type in `_bmad-ui/src/types.ts` for workflow step details covering phase metadata, step metadata, artifact state, artifact markdown content, skill summary, question-summary bullets, and source-file references.
  - [x] Add a dedicated dev-server endpoint in `_bmad-ui/scripts/agent-server.ts` for the supported detail views only: `planning/prd`, `planning/ux`, and `solutioning/architecture`.
  - [x] Mirror the same payloads in `_bmad-ui/scripts/vite-plugin-static-data.ts` so production emits matching static JSON for the new detail routes.
  - [x] Keep the implementation deliberately scoped to these three steps; do not build a generic parser or UI for every BMAD skill in this story.

- [x] Add Planning/Solutioning detail navigation in the workflow UI (AC: 1, 2)
  - [x] Extend the workflow step model in `_bmad-ui/src/app.tsx` only as needed so supported steps can expose a detail target.
  - [x] Update `_bmad-ui/src/routes/workflow.$phaseId.tsx` to render a `Details` link or button for PRD, UX Design, and Architecture rows while preserving the existing play, skip, unskip, and session actions.
  - [x] Add and manually register a dedicated route for the detail page in `_bmad-ui/src/routes/route-tree.ts`.

- [x] Build the step detail page (AC: 1, 2, 3, 4, 5)
  - [x] Create a dedicated workflow-step detail route component under `_bmad-ui/src/routes/` that uses TanStack Query plus `apiUrl()` to fetch the payload.
  - [x] Render a summary section describing what the skill does and what kinds of questions it asks.
  - [x] Render a readable markdown artifact preview when content exists.
  - [x] Provide a graceful empty or skipped state for the UX detail view when only `ux.skipped` exists or no UX markdown file is present.
  - [x] Include a clear back link to the parent phase page.

- [x] Curate the skill question summaries from the workflow source files (AC: 4)
  - [x] For `bmad-create-prd`, summarize classification and discovery questions, vision and differentiator questions, success-criteria questions, and scoping/MVP questions.
  - [x] For `bmad-create-ux-design`, summarize project-understanding questions, core-experience questions, and emotional-response questions.
  - [x] For `bmad-create-architecture`, summarize context-analysis questions, technical-preference and starter-evaluation questions, and core-decision questions.
  - [x] Include the specific source step-file paths in the payload or page so the summary remains traceable to the underlying skill definitions.

- [x] Verify end-to-end behavior (AC: 1, 2, 3, 4, 5)
  - [x] Extend `_bmad-ui/tests/smoke.spec.ts` or add a focused Playwright case that opens the new detail views and verifies they render without JavaScript errors.
  - [x] Run `cd _bmad-ui && pnpm check`.
  - [x] Manually verify `/workflow/planning`, `/workflow/solutioning`, and the new detail routes in the browser.

### Review Findings

- [x] [Review][Patch] Validate detail slug route params before rendering the link [_bmad-ui/src/routes/workflow.$phaseId.tsx:16] — fixed by parsing `detailSlug` with a strict `phase/step` guard so malformed slugs do not generate invalid route params.

## Dev Notes

### Story Intent

This is a focused workflow-page UX story. Do not broaden it into a generic artifact browser or a full skill-catalog experience. Limit scope to the exact request: PRD and UX Design details in Planning, plus Architecture details in Solutioning.

### Relevant Current Implementation

- `_bmad-ui/src/routes/workflow.$phaseId.tsx` currently renders workflow step rows with run, skip, unskip, and session actions only. There is no artifact-detail navigation today.
- `_bmad-ui/src/app.tsx` creates workflow step metadata through `makeStep()` and `detectWorkflowStatus()`. Any detail-link support should hook into that flow with minimal shape changes.
- `_bmad-ui/scripts/agent-server.ts` currently exposes artifact file listing (`/api/artifacts/files`) plus overview, epic, story, story-preview, and session APIs. There is no existing workflow-step detail endpoint.
- `_bmad-ui/scripts/vite-plugin-static-data.ts` already mirrors overview, epic, story, story-preview, and session payloads into `dist/data`. Any new workflow-step detail endpoint must be emitted here too to preserve the dev/prod dual-mode contract.

### Artifact Availability to Handle

- Planning artifacts currently include `_bmad-output/planning-artifacts/prd.md` and `_bmad-output/planning-artifacts/architecture.md`.
- There is no UX markdown artifact today. Planning currently records `ux.skipped`, so the UX detail route must treat that as a valid skipped or absent state, not as a failed load.
- `_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-15.md` already identifies the missing UX artifact as a planning risk and recommends a lightweight UX brief. Use that context to keep the UX detail page informative even when no document exists.

### Skill Question Summaries to Surface

For `bmad-create-prd`:

- Classification questions: product type, domain, complexity, and greenfield vs brownfield context.
- Vision questions: core insight, product differentiation, deeper problem framing, why now, and future-state outcomes.
- Success questions: user success moments, business outcomes, technical success, and measurable targets.
- Scope questions: MVP must-haves, later-phase features, and technical, market, or resource risks.

Source files:

- `.github/skills/bmad-create-prd/steps-c/step-02-discovery.md`
- `.github/skills/bmad-create-prd/steps-c/step-02b-vision.md`
- `.github/skills/bmad-create-prd/steps-c/step-03-success.md`
- `.github/skills/bmad-create-prd/steps-c/step-08-scoping.md`

For `bmad-create-ux-design`:

- Project and user questions: what is being built, who it is for, user frustrations, and the main job to be done.
- Core-experience questions: primary action, platform context, effortless interactions, and critical success moments.
- Emotional-response questions: target feelings, emotional journey, micro-emotions, and design choices that build trust, delight, or clarity.

Source files:

- `.github/skills/bmad-create-ux-design/steps/step-02-discovery.md`
- `.github/skills/bmad-create-ux-design/steps/step-03-core-experience.md`
- `.github/skills/bmad-create-ux-design/steps/step-04-emotional-response.md`

For `bmad-create-architecture`:

- Context-analysis questions: FR/NFR implications, cross-cutting concerns, scale, technical constraints, and UX-driven technical needs.
- Starter and preference questions: language, framework, database, deployment, team familiarity, third-party integrations, and starter-template choices.
- Core-decision questions: data architecture, auth/security, API style, frontend patterns, and infrastructure or deployment decisions.

Source files:

- `.github/skills/bmad-create-architecture/steps/step-02-context.md`
- `.github/skills/bmad-create-architecture/steps/step-03-starter.md`
- `.github/skills/bmad-create-architecture/steps/step-04-decisions.md`

### Implementation Guidance

- Reuse the existing dual-mode pattern: local mode reads from `agent-server.ts`; production reads prebuilt JSON via `apiUrl()`.
- Reuse the existing markdown-rendering approach already used by story preview/detail routes instead of introducing a new markdown stack.
- Prefer a small, source-backed metadata helper for these three skills over a generic runtime parser for every file in `.github/skills/`.
- Do not overload `/api/artifacts/files`; add a dedicated structured endpoint for workflow step details.
- Keep `WorkflowStep` changes minimal. A simple optional detail slug or boolean plus route params is enough.
- Any new route must be manually registered in `_bmad-ui/src/routes/route-tree.ts`.
- Preserve the existing styling language and CSS-variable usage. Do not add new one-off hardcoded colors.

### Previous Story Intelligence

- Story 7.2 demonstrated that new workflow-facing data must be updated in both `_bmad-ui/scripts/agent-server.ts` and `_bmad-ui/scripts/vite-plugin-static-data.ts`; implementing only one side will break either local mode or production mode.
- Story 7.2 also established TanStack Query as the correct data-fetching pattern for workflow and epic routes. Follow that pattern here rather than adding `useEffect` fetch code.
- Story 7.3 validated that workflow views are part of the self-referential delivery loop, so new detail pages must degrade gracefully against real artifact state instead of assuming perfect inputs.

### Git Intelligence Summary

Recent commits relevant to this story:

- `story 7.3: validate self-referential delivery loop`
- `feat(7-2): integrate backlog artifacts with UI workflows`
- `fix(e2e): fix smoke tests for story 7.1`

These changes reinforce the current pattern: keep workflow-route changes paired with artifact-aware server updates and preserve Playwright smoke coverage.

### Key Files to Touch

| File | Change |
| --- | --- |
| `_bmad-ui/src/app.tsx` | Extend workflow-step metadata only as needed for detail links |
| `_bmad-ui/src/routes/workflow.$phaseId.tsx` | Add detail-link actions to PRD, UX Design, and Architecture rows |
| `_bmad-ui/src/routes/route-tree.ts` | Register the new workflow-step detail route |
| `_bmad-ui/src/routes/workflow.$phaseId.$stepId.tsx` (or equivalent) | New route component for the step detail page |
| `_bmad-ui/src/types.ts` | Add the workflow-step detail response type |
| `_bmad-ui/scripts/agent-server.ts` | Build and serve workflow-step detail payloads |
| `_bmad-ui/scripts/vite-plugin-static-data.ts` | Emit static JSON for the new workflow-step detail routes |
| `_bmad-ui/tests/smoke.spec.ts` | Add coverage for the new detail links and routes |

### Project Structure Notes

- Route files live in `_bmad-ui/src/routes/`, and manual registration in `route-tree.ts` is mandatory.
- `apiUrl()` maps `/api/...` paths to `/data/...json` in production, so nested API paths are acceptable as long as the build emits matching nested JSON files.
- There are no existing implementation story files for Epic 9 yet, so keep this story self-contained and do not depend on unpublished Epic 9 implementation artifacts.

### Testing Requirements

- Extend existing Playwright smoke coverage for the new detail flows instead of introducing a separate test stack.
- `pnpm check` must pass before the story is marked complete.
- Verify the new routes produce no JavaScript errors and preserve navigation back to the parent workflow phase.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 9] — Epic context and Story 9.7 acceptance criteria
- [Source: _bmad-output/planning-artifacts/prd.md] — FR29, FR30, FR32 visibility and planning-artifact context
- [Source: _bmad-output/planning-artifacts/architecture.md] — dual-mode architecture, file-backed data, route and API adapter constraints
- [Source: _bmad-output/project-context.md] — route registration, TanStack Query, `apiUrl()`, and code-quality rules
- [Source: _bmad-output/planning-artifacts/implementation-readiness-report-2026-04-15.md#UX Alignment Assessment] — missing UX artifact context and recommendation
- [Source: _bmad-ui/src/routes/workflow.$phaseId.tsx] — current workflow phase detail UI
- [Source: _bmad-ui/src/app.tsx] — `WorkflowStep`, `makeStep()`, and `detectWorkflowStatus()`
- [Source: _bmad-ui/src/lib/mode.ts] — dev/prod API path mapping
- [Source: _bmad-ui/scripts/vite-plugin-static-data.ts] — static JSON emission pattern

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

- Story created to add workflow-step drilldowns for PRD, UX Design, and Architecture.
- Scope intentionally limited to three steps to avoid overbuilding a generic artifact or skill browser.
- UX detail view must handle `ux.skipped` and absent UX markdown gracefully.
- Added `detailSlug: string | null` to `WorkflowStep` type and `makeStep()` helper. Three steps now carry slugs: `planning/prd`, `planning/ux`, `solutioning/architecture`.
- Added `WorkflowStepDetailResponse` type to `types.ts` covering phase, step, artifact state + content, and skill summary with question themes and source files.
- Added `buildWorkflowStepDetailPayload()` to `agent-server.ts` with hardcoded metadata for the three supported steps; reads planning artifact files at runtime to determine artifact status.
- Added `/api/workflow-step/:phaseId/:stepId` GET endpoint in `agent-server.ts`.
- Added static JSON emission for `workflow-step/planning/prd.json`, `workflow-step/planning/ux.json`, and `workflow-step/solutioning/architecture.json` in `vite-plugin-static-data.ts`.
- Created `workflow.$phaseId.$stepId.tsx` route with `ArtifactSection` (handles present/skipped/missing) and `SkillSummarySection` (question theme cards + source file list).
- Registered `workflowStepDetailRoute` as sibling of `workflowPhaseRoute` under `workflowLayoutRoute` in `route-tree.ts`.
- Added "Details" inline link in actions column of `workflow.$phaseId.tsx` for steps with `detailSlug`.
- Extended `smoke.spec.ts` with workflow phase and step detail page tests.
- `pnpm check` passes (lint + types + tests + build).

### File List

- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/9-7-add-planning-and-solutioning-step-detail-views.md`
- `_bmad-ui/src/types.ts`
- `_bmad-ui/src/app.tsx`
- `_bmad-ui/src/routes/route-tree.ts`
- `_bmad-ui/src/routes/workflow.$phaseId.tsx`
- `_bmad-ui/src/routes/workflow.$phaseId.$stepId.tsx` (new)
- `_bmad-ui/scripts/agent-server.ts`
- `_bmad-ui/scripts/vite-plugin-static-data.ts`
- `_bmad-ui/tests/smoke.spec.ts`

## Change Log

- 2026-04-21: Implemented story 9.7 — added WorkflowStepDetailResponse type, server payload builder + endpoint, static JSON emission, new detail route, detail link in phase table, and smoke tests. All five ACs satisfied; `pnpm check` passes.
