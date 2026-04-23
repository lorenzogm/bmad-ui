---
title: 'UI Fixes — Homepage, Discover & Define, Epic Detail'
type: 'bugfix'
created: '2026-04-23'
status: 'done'
baseline_commit: '6051cf1'
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Five UI inconsistencies: (1) homepage duplicates the Epic Breakdown list already shown on Develop & Deliver, (2) Discover & Define shows inflated step totals that include skipped steps (e.g., 0/6 instead of 0/0 when all 6 are skipped), (3) Solutioning phase is missing test architect steps for the newly installed `bmad-testarch-*` skills, (4) Epic 13 has no name in `epics.md` so it renders as "Epic 13" with no description, (5) the epic detail back button navigates to Home instead of Develop & Deliver.

**Approach:** Batch of targeted edits across 4 source files and 1 data file — remove a JSX section, fix progress math, add 2 new `makeStep()` calls, append an epic heading to `epics.md`, and retarget one `<Link>`.

## Boundaries & Constraints

**Always:** Use existing CSS variables and Tailwind classes. Keep `detectWorkflowStatus` step additions consistent with existing `makeStep()` signature. New steps must reference real skill names from installed `.github/skills/` folders.

**Ask First:** Whether any of the new testarch steps should be marked `isOptional: false` (required).

**Never:** Add steps for implementation-phase test skills (automate, ci, atdd, review, trace, framework) to the Discover & Define phases — those belong in the Implementation phase.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| All analysis steps skipped | 6 `.skipped` files, 0 completions | Phase header shows "0/0 steps done" | N/A |
| Mix of skipped + completed | 3 skipped, 1 completed, 2 not-started | Header shows "1/3 steps done" | N/A |
| No skipped steps | 0 `.skipped` files | Header shows same as today (done/total) | N/A |
| Epic 13 name resolution | `epics.md` has `### Epic 13:` heading | UI shows "Navigation & Content Discovery" | N/A |

</frozen-after-approval>

## Code Map

- `_bmad-ui/src/routes/home.tsx` -- homepage; contains the "Epic Breakdown" section to remove
- `_bmad-ui/src/routes/discover-define.tsx` -- progress counting in `PhaseAccordion` (`doneCount/totalCount`)
- `_bmad-ui/src/app.tsx` -- `detectWorkflowStatus()` solutioning phase steps
- `_bmad-ui/src/routes/epic.$epicId.tsx` -- back button `<Link>` target
- `_bmad-output/planning-artifacts/epics.md` -- epic definitions parsed by the server for names

## Tasks & Acceptance

**Execution:**
- [x] `_bmad-ui/src/routes/home.tsx` -- Remove the entire "Epic Progress Detail" `<section>` block (the one with eyebrow "Epic Breakdown" and `<EpicsProgressList>`) -- duplicates Develop & Deliver content
- [x] `_bmad-ui/src/routes/discover-define.tsx` -- In `PhaseAccordion`, change `totalCount` from `phase.steps.length` to `phase.steps.filter((s) => !s.isSkipped).length` so skipped steps are excluded from both numerator and denominator
- [x] `_bmad-ui/src/app.tsx` -- Add two new steps to the solutioning phase array after "Implementation Readiness": (1) `makeStep("test-design", "Test Design", "Create system-level or epic-level test plans covering strategy, scope, and coverage targets.", "bmad-testarch-test-design", true, planningFiles, (f) => f.some((x) => x.includes("test-design")))` (2) `makeStep("nfr", "NFR Assessment", "Assess non-functional requirements — performance, security, reliability — before implementation begins.", "bmad-testarch-nfr", true, planningFiles, (f) => f.some((x) => x.includes("nfr")))` 
- [x] `_bmad-ui/src/routes/epic.$epicId.tsx` -- Change back link from `to="/"` and text `← Home` to `to="/develop-deliver"` and text `← Develop & Deliver`
- [x] `_bmad-output/planning-artifacts/epics.md` -- Append after Epic 12 section: `### Epic 13: Navigation & Content Discovery` with description covering sidebar navigation redesign, documentation browser, and agents catalog

**Acceptance Criteria:**
- Given the homepage loads, when rendered, then no "Epic Breakdown" section is visible
- Given all analysis steps are skipped, when Discover & Define loads, then analysis phase shows "0/0 steps done"
- Given Discover & Define loads, when expanding solutioning phase, then "Test Design" and "NFR Assessment" steps appear after "Implementation Readiness"
- Given epic detail page for any epic, when clicking the back button, then the user navigates to `/develop-deliver`
- Given the API parses `epics.md`, when epic 13 data is requested, then the name is "Navigation & Content Discovery"

## Verification

**Commands:**
- `cd _bmad-ui && pnpm check` -- expected: lint + types + tests + build pass with zero errors

**Manual checks (if no CLI):**
- Open http://localhost:5173 — no "Epic Breakdown" section on homepage
- Open http://localhost:5173/discover-define — analysis phase shows "0/0 steps done", solutioning shows "Test Design" and "NFR Assessment"
- Open http://localhost:5173/epic/epic-1 — back button says "← Develop & Deliver" and navigates to `/develop-deliver`

## Suggested Review Order

**Progress counting fix**

- Skipped steps excluded from totals; shows "All skipped" when 0 non-skipped remain
  [`discover-define.tsx:127`](../../_bmad-ui/src/routes/discover-define.tsx#L127)

**Workflow step additions**

- Two new optional steps (Test Design, NFR Assessment) appended to solutioning phase
  [`app.tsx:685`](../../_bmad-ui/src/app.tsx#L685)

**Navigation fix**

- Epic detail back button now targets /develop-deliver instead of /
  [`epic.$epicId.tsx:713`](../../_bmad-ui/src/routes/epic.$epicId.tsx#L713)

**Homepage cleanup**

- Epic Breakdown section and unused EpicsProgressList import removed
  [`home.tsx:249`](../../_bmad-ui/src/routes/home.tsx#L249)

**Data**

- Epic 13 heading and description appended after Epic 12
  [`epics.md:252`](../../_bmad-output/planning-artifacts/epics.md#L252)
