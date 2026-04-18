# Story 6.4: Define Documentation Contribution Path

Status: review

## Story

As a contributor,
I want a simple path to submit documentation improvements,
so that onboarding gaps can be fixed quickly.

## Acceptance Criteria

1. **Given** contribution docs, **When** reviewed, **Then** there is a clear process for proposing documentation updates (dedicated section in CONTRIBUTING.md).

2. **Given** a docs pull request, **When** submitted, **Then** expected review criteria are explicit and lightweight (no code quality checks required for docs-only changes).

3. **Given** recurring onboarding issues, **When** identified, **Then** maintainers can point contributors to the docs update process (CONTRIBUTING.md is a self-contained reference).

## Tasks / Subtasks

- [x] Add "Documentation Contributions" section to `.github/CONTRIBUTING.md` (AC: #1, #2, #3)
  - [x] Define what counts as a docs-only change (files under `docs/`, `README.md`, `.github/CONTRIBUTING.md`, `.github/*.md`)
  - [x] Provide a lightweight step-by-step path: fork → branch `docs/…` → edit → PR
  - [x] List explicit, lightweight review criteria for docs PRs (no build/lint required; spelling, accuracy, link validity)
  - [x] Add a one-liner maintainers can paste when pointing contributors to the process
- [x] Fix outdated quality-check commands in CONTRIBUTING.md (AC: #2)
  - [x] Replace `pnpm run check:types` and `pnpm run check:tests` in "Making Changes" with `pnpm run check` (the canonical command per project standards)
  - [x] Update the PR template checklist line `npm run build` → `pnpm run check`
- [x] Update `.github/PULL_REQUEST_TEMPLATE.md` to reflect docs-only PRs (AC: #2)
  - [x] Add a `Documentation update` type checkbox (already has the slot — just add the item)
  - [x] Add a docs-only fast-path note: "For documentation-only changes, Testing section can be marked N/A"
- [x] Verify no regressions: `cd _bmad-custom/bmad-ui && pnpm run check` (AC: #1)

## Dev Notes

### Current State

**`.github/CONTRIBUTING.md`** — exists and covers code contribution workflow well, but:
- Uses outdated individual commands (`pnpm run check:types`, `pnpm run check:tests`) — canonical command is `pnpm run check`
- Has no dedicated section for docs-only contributions
- Review criteria for PRs are code-focused; docs contributors must infer what's expected
- The "Submitting a Pull Request" section works for both code and docs but doesn't say so explicitly

**`.github/PULL_REQUEST_TEMPLATE.md`** — code-centric:
- Type of Change has: Bug fix, New feature, Breaking change, Documentation update — the last checkbox exists ✅
- Testing section asks for unit/integration tests — docs contributors don't need this
- Checklist references `npm run build`, `biome check src/`, `pnpm run check:types` — needs updating to `pnpm run check`

**`docs/`** — contains: `development-guide-bmad-ui.md`, `deployment-guide.md`, `secrets-workflow.md`, `project-overview.md`, `architecture-bmad-ui.md`, and many more. Docs contributions typically touch these files or `README.md`.

### Documentation Contribution Section (target content for CONTRIBUTING.md)

Add after "Submitting a Pull Request" and before "Code Quality":

```markdown
## Documentation Contributions

Documentation improvements are the fastest path to improving the contributor experience. If you notice an error, gap, or unclear step in any doc, please fix it.

### What Counts as a Docs-Only Change

A docs-only PR modifies only:
- `README.md`
- `docs/*.md`
- `.github/CONTRIBUTING.md`
- `.github/*.md` (other markdown in `.github/`)

No source code, config, or workflow files should be changed in a docs-only PR.

### How to Submit a Docs Improvement

1. Fork the repository and create a branch: `git checkout -b docs/fix-setup-steps`
2. Edit the relevant file(s) in `docs/` or `README.md`
3. Open a PR against `main` with the title prefix `docs:` (e.g., `docs: fix pnpm install step`)
4. Mark **Documentation update** in the PR Type of Change checklist
5. Mark the Testing section as **N/A** — no test runs required for docs-only PRs

### Review Criteria for Docs PRs

Docs PRs are reviewed for:
- **Accuracy**: Commands, paths, and steps are correct
- **Clarity**: Instructions are unambiguous for the target audience
- **Link validity**: All internal links resolve to real sections or files
- **Spelling/grammar**: No obvious errors

No Biome lint, TypeScript, or build checks are required for docs-only changes.

### Pointing Contributors to This Process

Maintainers can use this one-liner when directing contributors:

> See [Documentation Contributions](CONTRIBUTING.md#documentation-contributions) in the contributing guide for how to submit a docs improvement.
```

### Outdated Commands to Fix

In the "Making Changes" step 3 of CONTRIBUTING.md:
```
# BEFORE (wrong — sub-commands, not canonical):
pnpm run check:types   # TypeScript type check
pnpm run check:tests   # Vitest test suite

# AFTER (correct — single canonical command):
pnpm run check         # lint + types + tests + build
```

In the Code Quality table, `pnpm run check:types` should stay as a row (it's descriptive), but the **step-by-step instructions** must use `pnpm run check`.

### PR Template Fix

The checklist line:
```
- [ ] I have verified that the build succeeds: `npm run build`
- [ ] I have verified that linting passes: `biome check src/`
- [ ] I have verified that type checking passes: `npm run check:types`
```
Should be replaced with:
```
- [ ] I have run `cd _bmad-custom/bmad-ui && pnpm run check` and all checks pass (or N/A for docs-only PRs)
```

### Key Constraints

- This is a **documentation-only** story — do NOT modify any source code in `src/`, configs, or CI workflows.
- All changes are limited to: `.github/CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE.md`
- Do NOT rewrite CONTRIBUTING.md from scratch — make surgical additions/edits only
- Preserve all existing sections and their content; add the new section in the logical location

### Files to Create/Modify

| File | Action |
|---|---|
| `.github/CONTRIBUTING.md` | Edit — add Documentation Contributions section, fix outdated commands |
| `.github/PULL_REQUEST_TEMPLATE.md` | Edit — consolidate checklist, add docs-only note |

### Verification

After completing:
1. Read `.github/CONTRIBUTING.md` — confirm a "Documentation Contributions" section exists
2. Confirm the section defines what counts as a docs-only PR
3. Confirm lightweight review criteria are listed (no build/lint required)
4. Confirm CONTRIBUTING.md no longer references `pnpm run check:types` / `pnpm run check:tests` in the step-by-step instructions
5. `cd _bmad-custom/bmad-ui && pnpm run check` passes cleanly — no regressions

### Project Structure Notes

- `.github/CONTRIBUTING.md` — contribution guide; shown by GitHub on new PR creation
- `.github/PULL_REQUEST_TEMPLATE.md` — pre-filled PR description template
- `docs/` — developer reference docs (not changed in this story)
- `README.md` — project homepage (not changed in this story)

### References

- [Source: epics.md#Story-6.4] — User story, acceptance criteria, FR36 mapping
- [Source: .github/CONTRIBUTING.md] — Current state (has outdated commands, missing docs section)
- [Source: .github/PULL_REQUEST_TEMPLATE.md] — Current PR template (code-centric checklist)
- [Source: _bmad-output/project-context.md] — `pnpm run check` is the canonical quality command

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

- Added "Documentation Contributions" section to `.github/CONTRIBUTING.md` after "Submitting a Pull Request": defines docs-only scope, lightweight step-by-step path, review criteria, and maintainer one-liner.
- Fixed outdated commands in CONTRIBUTING.md "Making Changes": replaced `pnpm run check:types` + `pnpm run check:tests` with single `pnpm run check`.
- Updated `.github/PULL_REQUEST_TEMPLATE.md`: consolidated three checklist items into one canonical `pnpm run check` line; added `N/A — documentation-only change` checkbox to Testing section.
- `pnpm run check` passed cleanly — no regressions.

### File List

- `.github/CONTRIBUTING.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `_bmad-output/implementation-artifacts/6-4-define-documentation-contribution-path.md`

## Change Log

- 2026-04-18: Added Documentation Contributions section to CONTRIBUTING.md, fixed outdated pnpm commands, updated PR template with docs-only fast-path.
