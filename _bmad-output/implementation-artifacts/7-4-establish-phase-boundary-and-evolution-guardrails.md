# Story 7.4: Establish Phase Boundary and Evolution Guardrails

Status: ready-for-dev

## Story

As a maintainer,
I want explicit boundaries between Phase 1 outcomes and post-MVP expansion,
so that the project can evolve without destabilizing foundational workflows.

## Acceptance Criteria

1. **Given** current scope, **When** documented, **Then** Phase 1 done criteria and deferred Phase 2 and 3 items are clearly separated in a dedicated artifact.

2. **Given** proposed enhancements, **When** triaged, **Then** maintainers can classify them as foundational hardening versus new capability expansion using a defined classification guide.

3. **Given** architecture and project-context artifacts, **When** reviewed, **Then** they reflect a stable baseline for future refactoring and feature growth (no stale references, outdated versions, or contradictions with current implementation).

## Tasks / Subtasks

- [ ] Create Phase 1 completion summary document (AC: #1)
  - [ ] Document Phase 1 done criteria checklist (all epics 1–7 completed)
  - [ ] List all deferred Phase 2 items from PRD, architecture, and deferred-work.md
  - [ ] List all deferred Phase 3 items from PRD
  - [ ] Include a "why deferred" rationale for each major deferral

- [ ] Add enhancement triage classification guide to the Phase 1 completion document (AC: #2)
  - [ ] Define "Foundational Hardening" category with examples
  - [ ] Define "New Capability Expansion" category with examples
  - [ ] Add a simple decision tree or checklist for classifying proposed changes

- [ ] Audit and update `_bmad-output/project-context.md` for baseline accuracy (AC: #3)
  - [ ] Verify all library versions match `_bmad-custom/bmad-ui/package.json`
  - [ ] Confirm all rule sections reflect actual enforced patterns (no contradictions)
  - [ ] Remove or mark any rules that are aspirational vs. actively enforced

- [ ] Audit `_bmad-output/planning-artifacts/architecture.md` for baseline accuracy (AC: #3)
  - [ ] Confirm deferred decisions list is complete and up to date
  - [ ] Ensure phase boundary statements are accurate relative to what was shipped
  - [ ] Add a "Phase 1 Delivered" summary section if missing

- [ ] Verify no regressions: `cd _bmad-custom/bmad-ui && pnpm run check` (AC: #3)

## Dev Notes

### Story Nature

This is primarily a **documentation and artifact maintenance** story — no source code changes in `src/`. All work is limited to markdown files in `_bmad-output/` and optionally `docs/`. Do NOT touch `_bmad-custom/bmad-ui/src/`.

### Deliverable: Phase 1 Completion Summary

Create a new file at `_bmad-output/implementation-artifacts/phase-1-completion-summary.md`. This file must:

1. **Phase 1 Done Criteria** — checklist of what was delivered across Epics 1–7:
   - ✅ Public GitHub repo with governance baseline (Epic 1)
   - ✅ Terraform-managed GitHub and Vercel infrastructure (Epic 2)
   - ✅ dotenvx-based secrets workflow (Epic 3)
   - ✅ CI/CD GitHub Actions workflows (Epic 4)
   - ✅ Portable installation CLI (`npx bmad-method-ui install`) (Epic 5)
   - ✅ Setup/deploy/troubleshooting documentation (Epic 6)
   - ✅ Playwright E2E smoke tests on all routes as CI merge gate (Epic 7)

2. **Deferred Items — Phase 2 (Refactoring & Hardening)**
   From PRD [Source: prd.md#Post-MVP Features]:
   - Refactoring for maintainability and technical debt reduction
   - Enhanced documentation, examples, and contribution guidelines
   - Reliability hardening across workflows and runtime diagnostics

   From Architecture [Source: architecture.md#Deferred Decisions]:
   - End-user authentication and authorization
   - Database adoption for runtime/session persistence
   - Multi-user tenancy
   - GraphQL or alternate API protocol adoption
   - Offline-first synchronization
   - Distributed background job architecture

   From deferred-work.md [Source: deferred-work.md]:
   - Focus management for New Chat flyout (ref + focus approach compatible with project rules)
   - TTL/expiry for localStorage orchestrating flag
   - Multi-tab orchestration deduplication
   - Cross-tab `storage` event listener for state sync
   - Garbage collection for zombie localStorage keys
   - Store richer metadata in localStorage (JSON with `startedAt`, `epicId`)
   - `--access public` flag consideration for `npm publish` if package is scoped

3. **Deferred Items — Phase 3 (Expansion)**
   From PRD [Source: prd.md#Vision]:
   - Rich agentic flow visualization and analysis UI
   - Advanced orchestration monitoring and control features
   - Guided product development workflow integration (PRD → epics → stories)

### Enhancement Triage Classification Guide

Include in the Phase 1 completion document. Two categories:

**Foundational Hardening** (Phase 2 target):
- Improves reliability, maintainability, or developer experience of existing Phase 1 features
- Does not add new user-facing capabilities
- Examples: refactoring `agent-server.ts`, adding test coverage, fixing deferred localStorage issues, improving error states

**New Capability Expansion** (Phase 3 target):
- Adds a feature not present in the current Phase 1 product
- Requires new routes, new API endpoints, or new UX surfaces
- Examples: real-time orchestration controls, guided PRD workflow, advanced analytics charts, auth layer

Decision tree (simple):
> "Does this change make something that already exists work better?" → Foundational Hardening
> "Does this add something that doesn't exist today?" → New Capability Expansion

### Artifact Audit Guidance

#### project-context.md Audit

Key things to verify against `_bmad-custom/bmad-ui/package.json`:
- React version (currently 19.2.x in project-context; verify exact semver)
- TypeScript, Vite, TanStack Router, TanStack Query, ECharts, Biome versions
- Node.js and pnpm minimum versions

Also verify these patterns are still accurate:
- `useEffect` restriction (only for SSE, DOM scroll, localStorage sync, ECharts lifecycle)
- `IS_LOCAL_MODE` dual-mode architecture is still the pattern
- `src/routes/route-tree.ts` manual registration (no auto-generation)
- Named function components (not arrow const)
- shadcn/ui + Base UI component model (added in recent update)

#### architecture.md Audit

Verify:
- Three-boundary architecture still correct: frontend / adapter-API / orchestrator runtime
- File-backed data (no database) is still the chosen approach
- Phase 1 security model (no auth, operational controls) matches what was shipped
- Deferred decisions list is complete (add any new ones surfaced during Epic 5/6/7 work)

### Current State Snapshot

As of Epic 7 stories completion:
- All Epics 1–6 are done (sprint-status.yaml)
- Epic 7 (`7-4`) is the final story of the epics in epic-7
- No `phase-1-completion-summary.md` exists yet
- `deferred-work.md` exists at `_bmad-output/implementation-artifacts/deferred-work.md` with known deferrals

### Files to Create/Modify

| File | Action |
|---|---|
| `_bmad-output/implementation-artifacts/phase-1-completion-summary.md` | Create — Phase 1 completion summary, deferred items, classification guide |
| `_bmad-output/project-context.md` | Edit (if audit finds stale content) — version/rule corrections only |
| `_bmad-output/planning-artifacts/architecture.md` | Edit (if audit finds stale content) — surgical additions only |

### Key Constraints

- **No source code changes** — do not touch anything in `_bmad-custom/bmad-ui/src/`
- **No rewriting** of architecture.md or project-context.md from scratch — surgical additions and corrections only
- Preserve all existing sections and structure in existing files
- The `deferred-work.md` file is append-only; do not clean or restructure it
- `pnpm run check` must still pass after any changes (it should, since this is docs-only)

### Project Structure Notes

- `_bmad-output/implementation-artifacts/` — story files and implementation artifacts
- `_bmad-output/planning-artifacts/` — epics.md, prd.md, architecture.md (planning layer)
- `_bmad-output/project-context.md` — AI agent rules; frozen version of project conventions
- `_bmad-output/implementation-artifacts/deferred-work.md` — running log of deferred items

### References

- [Source: epics.md#Story-8.4] — User story, acceptance criteria, FR39 mapping
- [Source: prd.md#Post-MVP Features] — Phase 2 and Phase 3 deferred feature lists
- [Source: prd.md#MVP-Phase-1] — Phase 1 done criteria baseline
- [Source: architecture.md#Deferred Decisions] — Architecture-level deferred decisions
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — Running deferred-work log
- [Source: _bmad-output/planning-artifacts/sprint-status.yaml] — Epic/story completion state
- [Source: _bmad-output/project-context.md] — Project conventions and tech stack versions

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
