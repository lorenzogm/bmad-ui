# Story 12.2: Consolidate Data Files into `_bmad-ui/artifacts/` and Clean Up

Status: done

## Story

As a maintainer,
I want links, notes, and story-dependency data files organized in a dedicated `artifacts/` subdirectory,
so that runtime agent data (sessions, state, logs) is clearly separated from project planning artifacts.

## Acceptance Criteria

1. **Given** `_bmad-ui/` exists from Story 12.1, **When** data files are reorganized, **Then** `_bmad-ui/artifacts/` contains `links.yaml`, `notes.json`, and `story-dependencies.yaml`.

2. **Given** `notes.yaml` is a superseded duplicate of `notes.json`, **When** the consolidation is applied, **Then** `notes.yaml` is deleted and only `notes.json` remains.

3. **Given** server code references file paths for links, notes, and story-dependencies, **When** files are moved, **Then** all path references are updated in `scripts/server/links-notes/links.ts`, `scripts/server/links-notes/notes.ts`, and `scripts/server/epics/dependencies.ts`.

4. **Given** the consolidation is complete, **When** `pnpm check` is run, **Then** all quality gates pass with zero regressions.

5. **Given** the app is started with `pnpm dev`, **When** data endpoints are called, **Then** all data loads correctly from the new `artifacts/` paths.

## Tasks / Subtasks

- [x] Create `_bmad-ui/artifacts/` directory (AC: 1)
- [x] Move `_bmad-ui/links.yaml` → `_bmad-ui/artifacts/links.yaml` (AC: 1)
- [x] Move `_bmad-ui/notes.json` → `_bmad-ui/artifacts/notes.json` (AC: 1)
- [x] Move `_bmad-ui/story-dependencies.yaml` → `_bmad-ui/artifacts/story-dependencies.yaml` (AC: 1)
- [x] Delete `_bmad-ui/notes.yaml` (superseded by notes.json) (AC: 2)
- [x] Update path reference in `scripts/server/links-notes/links.ts` (AC: 3)
- [x] Update path reference in `scripts/server/links-notes/notes.ts` (AC: 3)
- [x] Update path reference in `scripts/server/epics/dependencies.ts` (AC: 3)
- [x] Run `pnpm check` to verify zero regressions (AC: 4)

## Dev Notes

- Commit: `073c185` — `dev-story(12-2): consolidate data files into _bmad-ui/artifacts/`
- 5 files moved/deleted, 3 server path references updated
- `notes.yaml` was an older format superseded by `notes.json` — confirmed safe to delete
- Story file was omitted from the original commit (same-commit rule violation, flagged in Epic 12 retro)
- This story file created retroactively to close the sprint-status / story-file inconsistency (Epic 12 retro action item 1)

## Review

No separate code review run. File moves were mechanical. `pnpm check` passed post-consolidation.
