# Story 12.1: Rename `_bmad-custom` to `_bmad-ui` and Flatten App Directory

Status: done

## Story

As a contributor,
I want the project to use `_bmad-ui/` as the single app directory with source files at the top level,
so that I don't navigate through redundant `_bmad-custom/bmad-ui/` nesting for every file path.

## Acceptance Criteria

1. **Given** the current `_bmad-custom/bmad-ui/` directory exists, **When** the directory is renamed and flattened, **Then** `_bmad-ui/` contains all files that were in `_bmad-custom/bmad-ui/` (src/, scripts/, package.json, vite.config.ts, tsconfig.json, biome.json, index.html, etc.)

2. **Given** files across the repository reference `_bmad-custom` or `_bmad-custom/bmad-ui`, **When** the rename is applied, **Then** ALL references are updated in GitHub Actions workflows, Terraform configs, documentation, VS Code settings, Copilot instructions, story files, and server code.

3. **Given** the rename is complete, **When** `pnpm check` is run from `_bmad-ui/`, **Then** lint, types, tests, and build all pass with zero regressions.

4. **Given** git history, **When** the rename is performed, **Then** `git mv` is used where possible to preserve file history.

## Tasks / Subtasks

- [x] Rename `_bmad-custom/bmad-ui/` → `_bmad-ui/` using `git mv` (AC: 1, 4)
- [x] Update all GitHub Actions workflow files (`.github/workflows/*.yml`) — path references to `_bmad-ui` (AC: 2)
- [x] Update Terraform config files (`infra/vercel/src/*.json`) (AC: 2)
- [x] Update documentation (`docs/*.md`, `README.md`, `.github/*.md`) (AC: 2)
- [x] Update Copilot instructions (`.github/copilot-instructions.md`) (AC: 2)
- [x] Update VS Code settings (`.vscode/settings.json`) (AC: 2)
- [x] Update all planning and implementation artifact story files (`_bmad-output/**/*.md`) (AC: 2)
- [x] Update root `package.json` `files` field (AC: 2)
- [x] Update server code (`scripts/server/paths.ts`, etc.) (AC: 2)
- [x] Run `pnpm check` to verify zero regressions (AC: 3)

## Dev Notes

- Commit: `0c1d5d4` — `dev-story(12-1): rename _bmad-custom to _bmad-ui and flatten app directory`
- Follow-up commit `0ed7e3c` — `fix: add scripts/server/logs/ to git (was excluded by 'logs' gitignore pattern)` — minor miss caught in same session
- ~100 files touched in total; no broken references found after migration
- Story file was omitted from the original commit (same-commit rule violation, flagged in Epic 12 retro)
- This story file created retroactively to close the sprint-status / story-file inconsistency (Epic 12 retro action item 1)

## Review

No separate code review run. The rename was mechanical with no logic changes. `pnpm check` passed post-rename.
