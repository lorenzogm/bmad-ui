# Story 8.4: Establish Phase Boundary and Evolution Guardrails

Status: review

## Story

As a maintainer,
I want explicit boundaries between Phase 1 outcomes and post-MVP expansion,
so that the project can evolve without destabilizing foundational workflows.

## Acceptance Criteria

1. **Given** current scope (Epics 1–8 delivered), **When** documented, **Then** phase-1-completion-summary.md is updated to include Epic 8 as a delivered capability, and all deferred Phase 2 and Phase 3 items remain clearly separated.

2. **Given** proposed enhancements, **When** triaged, **Then** maintainers can classify them as foundational hardening versus new capability expansion using the existing guide (verify it covers Epic 8 operational learnings and UI companion capabilities).

3. **Given** architecture and project-context artifacts, **When** reviewed after Epic 8 story executions, **Then** they accurately reflect the state of the delivered product — no stale references, outdated versions, or contradictions with changes made in Epic 8 stories (8.1–8.3).

## Tasks / Subtasks

- [x] Update phase-1-completion-summary.md to add Epic 8 delivery (AC: #1)
  - [x] Add Epic 8 row to the "Epics 1–7 Delivery Checklist" section (rename heading to "Epics 1–8 Delivery Checklist")
  - [x] Document what Epic 8 delivered: core workflow visibility views, backlog artifact integration, self-referential delivery loop validation, and this phase boundary story
  - [x] Review deferred items list for any new deferrals surfaced during Epic 8 stories — append to deferred-work.md if found, then reference here

- [x] Update architecture.md Phase 1 Delivered section to include Epic 8 (AC: #1, #3)
  - [x] Add Epic 8 row to the Delivered Capabilities table
  - [x] Confirm "Architectural Choices Confirmed as Shipped" section still matches post-Epic 8 state
  - [x] Add any new deferred decisions that emerged during Epic 8 work to the deferred decisions list

- [x] Audit project-context.md for accuracy after Epic 8 changes (AC: #3)
  - [x] Verify library versions still match `_bmad-custom/bmad-ui/package.json` exactly
  - [x] Confirm all rule sections reflect active patterns — check for any patterns changed or added by 8.1–8.3 stories
  - [x] No rewriting; surgical corrections only if something was changed during Epic 8 story work

- [x] Verify no regressions: `cd _bmad-custom/bmad-ui && pnpm run check` (AC: #3)

## Dev Notes

### Story Nature

This is primarily a **documentation and artifact maintenance** story — no source code changes in `src/`. All work is limited to markdown files in `_bmad-output/`. Do NOT touch `_bmad-custom/bmad-ui/src/`.

### Prerequisite Context: What Story 7.4 Already Established

Story 7.4 (done) already completed the foundational phase boundary work:
- Created `_bmad-output/implementation-artifacts/phase-1-completion-summary.md` covering Epics 1–7
- Audited `_bmad-output/project-context.md` against package.json; corrected aspirational rules
- Updated `_bmad-output/planning-artifacts/architecture.md` with "Phase 1 Delivered" section covering Epics 1–7

**Do NOT recreate or rewrite these files.** Story 8.4's role is a targeted update pass to extend the existing baseline to include Epic 8's delivered capabilities.

### What Epic 8 Delivers (the missing piece from 7.4's baseline)

Epic 8 ("Core Product Operation and Phase Readiness Validation") proves that bmad-ui functions as a working visual companion to bmad orchestration workflows. The four stories:
- **8.1**: Core workflow visibility views — UI displays workflow state and progress signals
- **8.2**: Backlog artifact integration — epics/stories context surfaced in a consistent readable format
- **8.3**: Self-referential delivery loop validation — bmad-ui supports execution from its own generated epics/stories
- **8.4** (this story): Phase boundary update after operational proof

### Deliverable Updates

#### phase-1-completion-summary.md Update

Add Epic 8 to the delivery checklist. Example row to add:
```
- ✅ **Epic 8 — Core Product Operation & Phase Readiness Validation**: bmad-ui proven as visual companion; backlog artifacts surfaced in UI; self-referential delivery loop validated; Phase 1 boundary confirmed with Epics 1–8 as baseline.
```

Update the section heading from "Epics 1–7 Delivery Checklist" to "Epics 1–8 Delivery Checklist".

Review `deferred-work.md` to check if Epic 8 stories added any new deferrals. If found, reference them in the deferred items tables.

The document footer `_Story: 7-4-establish-phase-boundary-and-evolution-guardrails_` should be updated to note that it was last extended by `8-4`.

#### architecture.md Update

The "Phase 1 Delivered" table (added in 7.4) currently has rows for Epics 1–7. Add:
```
| Epic 8 | Core product operation: workflow visibility, backlog artifact integration, self-referential delivery loop validation | ✅ Done |
```

Check "Architectural Choices Confirmed as Shipped" — if Epic 8 stories introduced any new confirmed patterns (e.g., new TanStack Query usage, new component patterns), note them.

#### project-context.md Audit

Check that nothing was changed in Epic 8 stories that would make the existing rules stale. Specifically:
- If 8.1–8.3 touched CSS variables or design system, verify var names still match
- If new components or routes were added, verify the manual route-tree registration note is still accurate
- Versions in package.json should still match (no new major bumps expected)

### Files to Create/Modify

| File | Action |
|---|---|
| `_bmad-output/implementation-artifacts/phase-1-completion-summary.md` | Edit — add Epic 8 row, rename delivery checklist heading |
| `_bmad-output/planning-artifacts/architecture.md` | Edit — add Epic 8 row to Phase 1 Delivered table |
| `_bmad-output/project-context.md` | Edit if and only if audit finds stale content — surgical corrections only |
| `_bmad-output/implementation-artifacts/deferred-work.md` | Append only — add any new deferrals from Epic 8 stories if found |

### Key Constraints

- **No source code changes** — do not touch anything in `_bmad-custom/bmad-ui/src/`
- **No rewriting** of existing files — surgical additions and corrections only
- Preserve all existing sections, structure, and wording in all files
- `deferred-work.md` is append-only; do not restructure or clean it
- `pnpm run check` must still pass (it should, since this is docs-only)
- Do NOT replicate 7.4's work — rely on what was already established and extend it

### Previous Story Intelligence (7.4)

Dev notes from story 7.4:
- `phase-1-completion-summary.md` was created at `_bmad-output/implementation-artifacts/phase-1-completion-summary.md` and covers Epics 1–7 in full
- `project-context.md` was corrected: aspirational rules (shadcn/ui, Base UI, `src/ui/`) were marked `[Phase 2 planned]`; all library versions match `package.json`
- `architecture.md` received a "Phase 1 Delivered" section at the end with Epic 1–7 capability table and architectural choices confirmed
- `pnpm run check` passed at exit code 0 after all changes

Code-review findings from 7.4 (still open — may need to verify):
- `[Review][Patch]` Phase 1 completion claim contradicts sprint tracker state [phase-1-completion-summary.md:9] — check if this was resolved
- `[Review][Patch]` Phase 2 deferred list is incomplete (missing non-TTY stdin deferral) [phase-1-completion-summary.md:48] — check if this was added to deferred-work.md

### Project Structure Notes

- `_bmad-output/implementation-artifacts/` — story files, retrospectives, phase summary
- `_bmad-output/planning-artifacts/` — epics.md, prd.md, architecture.md
- `_bmad-output/project-context.md` — AI agent rules; frozen version of project conventions
- `_bmad-output/implementation-artifacts/deferred-work.md` — running log of deferred items
- `_bmad-custom/bmad-ui/package.json` — source of truth for all library versions

### References

- [Source: epics.md#Story-8.4] — User story, acceptance criteria, FR39/FR40 mapping
- [Source: epics.md#Epic-8] — Epic context: Core Product Operation and Phase Readiness Validation
- [Source: _bmad-output/implementation-artifacts/7-4-establish-phase-boundary-and-evolution-guardrails.md] — Previous story establishing the foundational phase boundary artifacts
- [Source: _bmad-output/implementation-artifacts/phase-1-completion-summary.md] — File to update with Epic 8 delivery
- [Source: _bmad-output/planning-artifacts/architecture.md#Phase-1-Delivered] — Table to update with Epic 8 row
- [Source: _bmad-output/project-context.md] — File to audit for accuracy post-Epic 8
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — Append-only log to check for Epic 8 deferrals

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

- Renamed "Epics 1–7 Delivery Checklist" heading to "Epics 1–8 Delivery Checklist" in phase-1-completion-summary.md
- Added Epic 8 row documenting core workflow visibility, backlog artifact integration, self-referential delivery loop, and phase boundary confirmation
- Updated phase-1-completion-summary.md footer to note last extension by story 8-4
- Added Epic 8 row to architecture.md Phase 1 Delivered capabilities table
- Updated architecture.md section header to note Story 8-4 extension; updated "all seven epics" to "all eight epics"
- Updated architecture.md deferred decisions note to include Epic 5/6/7/8
- Audited project-context.md: all library versions match package.json exactly (React 19.2.5, TypeScript 6.0.2, Vite 8.0.8, TanStack Router 1.168.22, TanStack Query 5.99.0, ECharts 6.0.0, marked 18.0.0, Tailwind 4.2.2, Vitest 4.1.4, Biome 2.4.12); no stale content found; no corrections required
- Reviewed deferred-work.md: no new deferrals from Epic 8 stories (8.1–8.3 remain in ready-for-dev; no code changes were introduced that generated deferrals)
- pnpm check passed: exit code 0 (lint + types + tests + build)

### File List

- `_bmad-output/implementation-artifacts/phase-1-completion-summary.md` — Updated: renamed delivery checklist heading, added Epic 8 row, updated footer
- `_bmad-output/planning-artifacts/architecture.md` — Updated: added Epic 8 row to Phase 1 Delivered table, updated section header and description
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Updated: 8-4 status → review
- `_bmad-output/implementation-artifacts/8-4-establish-phase-boundary-and-evolution-guardrails.md` — Updated: tasks marked complete, Dev Agent Record, File List, Change Log, Status

## Change Log

- **2026-04-21** (Story 8-4): Targeted update pass extending Story 7-4's phase boundary baseline to include Epic 8. Updated phase-1-completion-summary.md delivery checklist heading and added Epic 8 row. Added Epic 8 row to architecture.md Phase 1 Delivered capabilities table. Audited project-context.md — all library versions verified accurate, no corrections needed. Reviewed deferred-work.md — no new Epic 8 deferrals to append.
