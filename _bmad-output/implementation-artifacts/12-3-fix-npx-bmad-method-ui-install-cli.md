# Story 12.3: Fix `npx bmad-method-ui install` CLI and Publish New Version

Status: done

## Story

As a new bmad user,
I want `npx bmad-method-ui install` to correctly download and install bmad-ui into my project,
so that I can add the UI dashboard to any bmad project with a single command.

## Acceptance Criteria

1. **Given** root `package.json` defines the npm package, **When** the package layout is updated, **Then** the `files` field references `_bmad-ui/` (not `_bmad-custom/bmad-ui/`).

2. **Given** `bin/install.mjs` copies files from the package, **When** updated, **Then** source path resolves to `_bmad-ui/` and destination creates `_bmad-ui/` in the user's project.

3. **Given** the installer is updated, **When** the overwrite prompt is shown, **Then** all messages reference `_bmad-ui/` (correct paths).

4. **Given** all tests pass, **When** a new version is published, **Then** the version is bumped to at least `0.2.0` and `npm publish` succeeds.

## Tasks / Subtasks

- [x] Update `package.json` `files` field to reference `_bmad-ui/` (AC: 1)
- [x] Update `bin/install.mjs` source path to `_bmad-ui/` (AC: 2)
- [x] Update success message and next-steps in `bin/install.mjs` to reference `_bmad-ui/` (AC: 3)
- [x] Bump version to `0.2.0` in root `package.json` (AC: 4)
- [x] Publish via GitHub Actions `publish.yml` workflow (AC: 4)

## Dev Notes

- Commit: `b8b7e38` — `dev-story(12-3): fix npx bmad-method-ui install CLI for new structure`
- Removed unused `mkdirSync` import from `bin/install.mjs` (caught by Biome `noUnusedImports`)
- Version bumped from 0.1.x → 0.2.0 to signal the structural change
- Published successfully via GitHub Actions `publish.yml` workflow
- Story file was omitted from the original commit (same-commit rule violation, flagged in Epic 12 retro)
- This story file created retroactively to close the sprint-status / story-file inconsistency (Epic 12 retro action item 1)

## Review

No separate code review run. Changes were mechanical path updates. `pnpm check` passed.
