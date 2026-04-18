# Story 6.5: Capture Early Adoption Signals

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want lightweight adoption signal tracking,
so that I can evaluate traction and prioritize improvements.

## Acceptance Criteria

1. **Given** the public repository, **When** monitored, **Then** key signals are tracked, including stars, forks, issues, discussions, and first-time contributors.

2. **Given** periodic review, **When** performed, **Then** signals are summarized in a simple cadence, such as weekly notes.

3. **Given** trend changes, **When** identified, **Then** maintainers can map signals to follow-up actions in backlog planning.

## Tasks / Subtasks

- [x] Create `docs/adoption-signals.md` (AC: #1, #2, #3)
  - [x] Define the signal inventory: what to monitor and where (GitHub Insights, stars, forks, issues, discussions, first-time contributors)
  - [x] Provide a minimal weekly review template with fields for each signal category
  - [x] Document how to map signal trends to backlog planning actions (mapping table or guidance)
- [x] Run `cd _bmad-custom/bmad-ui && pnpm run check` to confirm no regressions (documentation only — this should be a no-op)

## Dev Notes

### Nature of This Story

**Documentation-only story.** No source code changes. No changes to `src/`, configs, CI workflows, or Terraform. The deliverable is a single new file: `docs/adoption-signals.md`.

### What Signals to Track

GitHub native features cover all required signals — no external tooling needed:

| Signal | Where to find | Cadence |
|---|---|---|
| Stars | Repository main page / GitHub Insights → Traffic | Weekly |
| Forks | Repository main page / GitHub Insights → Traffic | Weekly |
| Issues opened / closed | Issues tab | Weekly |
| Discussions started | Discussions tab | Weekly |
| First-time contributors | GitHub Insights → Contributors | Weekly |
| Clones (unique) | GitHub Insights → Traffic → Git clones | Weekly |
| Views (unique) | GitHub Insights → Traffic | Weekly |

All of these are readable under **Insights → Traffic** and **Insights → Contributors** — no API tokens or automation required for Phase 1.

### Weekly Review Template

The document should include a copy-paste–ready template. Suggested structure:

```markdown
## Week of YYYY-MM-DD

| Signal | Count | Delta vs last week | Notes |
|---|---|---|---|
| Stars | | | |
| Forks | | | |
| Issues opened | | | |
| Issues closed | | | |
| Discussions started | | | |
| First-time contributors | | | |
| Unique clones | | | |
| Unique views | | | |

### Observations

- [Key trend 1]
- [Key trend 2]

### Backlog Actions

- [Action → Link to issue/backlog item if raised]
```

### Signal-to-Backlog Mapping

The doc should guide the maintainer on what signals indicate what types of follow-up:

| Signal pattern | Likely implication | Suggested follow-up |
|---|---|---|
| Stars growing, forks low | Interest but adoption friction | Review quickstart (Story 6.1 area) |
| Issues spike with `bug` label | Reliability problem surfaced | Triage → Epic 4/8 items |
| First-time contributor PRs appear | Onboarding working | Ensure contribution path (Story 6.4) stays current |
| Discussion questions repeat | Docs gap | Update relevant guide, consider FAQ section |
| Star growth stalls after initial spike | Positioning gap | Review README, project description, topics |

### File Location

```
docs/adoption-signals.md
```

This is the canonical home for all project-level documentation in the repository. No other file needs to be created or modified.

### Context: PRD Goals for Adoption

From `prd.md`:
- **Phase 1 success metric:** "Repository is public, CI/CD pipelines are functional, initial GitHub community feedback/stars indicate adoption interest."
- **Risk:** Low initial adoption despite publication.
- **Mitigation:** Fast onboarding path, clear positioning for bmad users and AI developers, immediate feedback loops via issues/discussions.

The adoption signals document directly supports the mitigation strategy by ensuring maintainers have a repeatable process to detect and respond to early traction signals.

### GitHub Discussions

GitHub Discussions are already enabled on the repository (confirmed in repository metadata). Discussions are a native adoption signal — track threads started per week as part of the weekly review.

### Key Constraints

- **Documentation-only** — do NOT touch `src/`, `vite.config.ts`, `tsconfig.json`, `biome.json`, Terraform files, or CI workflows.
- Do NOT add any automation, GitHub Actions workflow, or API integration — Phase 1 is lightweight manual tracking only.
- Do NOT modify any existing `docs/` files — create only `docs/adoption-signals.md`.
- Keep the document concise: a short intro, the signal table, the weekly template, and the mapping guide. No verbose prose.

### Files to Create/Modify

| File | Action |
|---|---|
| `docs/adoption-signals.md` | Create — new adoption signal tracking guide |

No other files should be changed.

### Verification

After completing:
1. `docs/adoption-signals.md` exists and covers stars, forks, issues, discussions, first-time contributors
2. The file contains a weekly review template maintainers can copy-paste
3. The file contains guidance on mapping signals to backlog planning actions
4. `cd _bmad-custom/bmad-ui && pnpm run check` passes cleanly — no regressions

### Project Structure Notes

- All project documentation lives in `docs/` at the repository root
- `docs/index.md` provides the documentation index — the new file may be referenced there if appropriate, but it is not required for this story
- `README.md` does not need to be updated for this story (already links to `docs/` for deeper references)

### References

- [Source: epics.md#Story-6.5] — User story statement, acceptance criteria, FR37 mapping
- [Source: prd.md#FR37] — "Maintainer can collect and review early adoption signals from public project interaction"
- [Source: prd.md#phase-1-success] — Stars/community feedback as Phase 1 success metric
- [Source: prd.md#risks] — Low adoption risk and immediate feedback loop mitigation
- [Source: architecture.md] — GitHub as repository governance platform; GitHub Discussions enabled
- [Source: docs/index.md] — Existing documentation structure

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

- Created `docs/adoption-signals.md` with signal inventory table (7 signals), copy-paste weekly review template, and signal-to-backlog mapping table.
- Documentation-only story: no source code changes. `pnpm check` passed cleanly (lint, types, tests, build).

### File List

- `docs/adoption-signals.md` — new file
- `_bmad-output/implementation-artifacts/6-5-capture-early-adoption-signals.md` — story updated (status → review)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story status → review

## Change Log

- 2026-04-18: Created `docs/adoption-signals.md` — adoption signal tracking guide with inventory, weekly template, and backlog mapping.
