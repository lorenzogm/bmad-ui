---
title: 'Replace Orchestrator Controls with BMAD Workflow Steps Display'
type: 'feature'
created: '2026-04-15'
status: 'done'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The home page currently displays "Orchestrator Controls" which is outdated context. Users need a clear visual representation of the BMAD workflow steps and which ones are complete, optional, or need to be run next.

**Approach:** Replace the OrchestratorControlsSection component with a new BMADWorkflowSection that displays workflow steps with icons, completion status, optional flags, and a single play button that appears only on the next required action to take (based on artifact existence).

## Boundaries & Constraints

**Always:** 
- Display workflow steps in order following BMAD Method phases (Analysis → Planning → Solutioning → Implementation)
- Each step shows: icon, name, completion status badge, optional/required flag, and file name
- Only ONE play button appears - on the next action to take
- Determine completion by checking file existence in `_bmad-output/planning-artifacts`:
  - PRD: check for `prd.md`
  - Architecture: check for `architecture.md`
  - UX: check for `*ux*.md` files
  - Epics: check for `epics.md`
  - Implementation Readiness: check for `*readiness*.md` files
  - Sprint Planning: check for `*sprint-plan*.md` or similar
- Maintain existing styling conventions and animation patterns (reveal, delay classes)
- Do not make API calls to check file status — pass data from the backend or use static detection

**Ask First:** None specified in updated requirements.

**Never:** 
- Do not keep the Orchestrator Controls section — it is fully replaced, not hidden
- Do not add new external dependencies
- Do not change the API response structure unless absolutely necessary
- Do not show multiple play buttons

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Standard project flow | PRD done, Architecture done, UX optional uncompleted | PRD ✓, Architecture ✓, UX (optional), with play button on UX | Display accurately |
| After UX optional skipped | PRD, Architecture done, Implementation Readiness done | All previous ✓, play button on Sprint Planning | Display accurately |
| After Sprint Planning | All previous done | All previous ✓, no play button (implementation requires no workflow button) | Show completed state |
| File system check fails | Cannot access planning-artifacts | Display steps with unknown status | Graceful fallback |

</frozen-after-approval>

## Code Map

- `_bmad-custom/bmad-ui/src/app.tsx` -- Contains OrchestratorControlsSection component (lines 926-988) and its usage in DashboardPage (lines 1397-1407); will replace with BMADWorkflowSection
- `_bmad-output/planning-artifacts/` -- Directory to check for artifact files to determine workflow completion status

## Tasks & Acceptance

**Execution:**
- [ ] `_bmad-custom/bmad-ui/src/app.tsx` -- Create BMADWorkflowSection component that displays BMAD workflow steps with icons, status badges, and a single play button on the next action -- Replaces OrchestratorControlsSection with workflow step tracking
- [ ] `_bmad-custom/bmad-ui/src/app.tsx` -- Update DashboardPage to call BMADWorkflowSection instead of OrchestratorControlsSection, passing artifact detection logic -- Integrates new component into dashboard layout
- [ ] Implement file existence detection for workflow step tracking -- Verify correct steps are marked complete based on artifact presence

**Acceptance Criteria:**
- Given the home page loads with PRD and Architecture artifacts present, when the page renders, then PRD and Architecture steps display as completed with checkmarks
- Given UX is optional and not completed and is the next action, when the page renders, then UX step shows optional flag and displays a play button with the bmad-create-ux icon
- Given Implementation Readiness is completed and Sprint Planning is the next action, when the page renders, then a play button appears only on the Sprint Planning step
- Given all workflow steps are completed, when the page renders, then no play button is displayed and all steps show as completed
- Given the Orchestrator Controls section previously existed, when the home page renders, then the BMADWorkflowSection appears in its place with matching visual styling and animations

## Design Notes

The BMADWorkflowSection displays workflow steps in order:

1. **PRD** (Phase 2: Planning) - file check: `prd.md`
2. **Architecture** (Phase 3: Solutioning) - file check: `architecture.md`
3. **UX Design** (Phase 3: Solutioning, optional) - file check: `*ux*.md`
4. **Epics** (Phase 3: Solutioning) - file check: `epics.md`
5. **Implementation Readiness** (Phase 3: Solutioning) - file check: `*readiness*.md`
6. **Sprint Planning** (Phase 4: Implementation) - file check: `*sprint-plan*.md`

Each step displays:
- Icon (representing the BMAD skill)
- Step name
- Status badge (completed ✓, pending, or optional)
- Play button (only on the next action to take)

The single play button should:
- Appear only on the next incomplete required step or next incomplete optional step (if all required are done)
- Show the appropriate skill icon
- Trigger the corresponding BMAD workflow command
- Be styled with existing button classes (`.cta` or `.hero-actions`)

Styling uses existing `.panel`, `.reveal`, `.delay-*` classes from the old section.

## Verification

**Commands:**
- `npm run build` in `_bmad-custom/bmad-ui/` -- expected: No TypeScript or build errors
- Visual inspection in browser after build -- expected: BMADWorkflowSection displays correctly with step progress

**Manual checks (if no CLI):**
- Verify all workflow steps display in correct order
- Verify step completion status matches file existence in `_bmad-output/planning-artifacts/`
- Verify optional flag displays on UX step
- Verify only ONE play button appears on the next action
- Verify play button disappears when step is completed
- Verify no styling regressions from old Orchestrator Controls section
