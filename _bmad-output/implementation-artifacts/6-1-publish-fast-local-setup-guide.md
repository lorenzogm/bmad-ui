# Story 6.1: Publish Fast Local Setup Guide

Status: ready-for-dev

## Story

As a new user,
I want a concise local setup quickstart,
so that I can run bmad-ui in under 15 minutes.

## Acceptance Criteria

1. **Given** the repository README, **When** a new user follows quickstart steps, **Then** local setup is completable without undocumented prerequisites.

2. **Given** quickstart steps, **When** executed, **Then** required commands, environment preparation, and verification checks are explicit (including the `cd _bmad-custom/bmad-ui` working directory step).

3. **Given** a setup failure, **When** encountered, **Then** quickstart links to troubleshooting guidance for recovery.

## Tasks / Subtasks

- [ ] Fix README.md Quick Start section (AC: #1, #2)
  - [ ] Add explicit `cd _bmad-custom/bmad-ui` as the first command (currently missing — users who run `pnpm install` from the repo root get confused)
  - [ ] Add a verification step: open `http://localhost:5173` and confirm the BMAD UI loads
  - [ ] Add a "No secrets required" callout — contributors can run the full app without env vars
  - [ ] Remove or de-emphasize individual `pnpm run check:types` / `pnpm run check:tests` commands from Quick Start — the canonical command is `pnpm run check` (runs all checks at once)
- [ ] Add troubleshooting link to README.md Quick Start (AC: #3)
  - [ ] Link to `docs/development-guide-bmad-ui.md#Troubleshooting` for setup failure recovery
- [ ] Verify `docs/development-guide-bmad-ui.md` is accurate (AC: #1, #2, #3)
  - [ ] Confirm no leftover `npm` commands (Story 5.3 fixed these — verify they stay fixed)
  - [ ] Confirm Prerequisites section lists Node.js (LTS) and pnpm 10.16+
  - [ ] Confirm Troubleshooting section covers: Biome not formatting, pnpm not found, port conflict, TypeScript aliases
- [ ] Run `cd _bmad-custom/bmad-ui && pnpm run check` to confirm no regressions (AC: #1)

## Dev Notes

### Current State (as of Story 5.3 completion)

**`README.md` Quick Start — has a critical bug:**
```bash
# Install dependencies   ← WRONG: missing `cd _bmad-custom/bmad-ui` before this
pnpm install

# Start development server
pnpm dev
```
Running `pnpm install` from the repository root fails because `package.json` and `pnpm-lock.yaml` live in `_bmad-custom/bmad-ui/`, not the root. New users hit this immediately.

**`docs/development-guide-bmad-ui.md`** — comprehensive and accurate after Story 5.3. Its Troubleshooting section covers the four most common issues. Keep it as-is; just verify accuracy.

**`.github/CONTRIBUTING.md`** — already correct: starts with `cd _bmad-custom/bmad-ui`. Use this as the reference for the README fix.

### README.md Quick Start — Correct Version

Replace the current Quick Start with:

```markdown
## Quick Start

> No secrets or environment variables required — the full app runs immediately after install.

### Prerequisites

- Node.js 18+ (current LTS recommended)
- pnpm 10.16+ — install with `npm install -g pnpm` or `corepack enable && corepack prepare pnpm@latest --activate`

### Setup

```bash
# Move into the app workspace
cd _bmad-custom/bmad-ui

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Open `http://localhost:5173` — you should see the BMAD UI dashboard.

### Validate

```bash
pnpm run check   # lint + types + tests + build (run before every commit)
```

> **Setup issues?** See [Troubleshooting](docs/development-guide-bmad-ui.md#troubleshooting) in the development guide.
```

### Key Constraints

- This is a **documentation-only** story — do NOT modify any source code in `src/`, configs in `vite.config.ts`, `tsconfig.json`, `biome.json`, or CI workflows.
- Do NOT modify `docs/development-guide-bmad-ui.md` unless a specific inaccuracy is found (it is accurate after Story 5.3).
- Do NOT modify `.github/CONTRIBUTING.md` — it is already correct.
- The README lives at the **repository root** (`/README.md`), not inside `_bmad-custom/bmad-ui/`.

### Files to Create/Modify

| File | Action |
|---|---|
| `README.md` | Edit — fix Quick Start section |

No other files should be changed unless a specific verified inaccuracy is found.

### Verification

After completing:
1. Read `README.md` Quick Start — confirm `cd _bmad-custom/bmad-ui` is the first command
2. Confirm a troubleshooting link exists in Quick Start
3. Confirm `pnpm run check` is the canonical validation command shown (not individual sub-commands)
4. `cd _bmad-custom/bmad-ui && pnpm run check` passes cleanly — no regressions

### Project Structure Notes

- `README.md` is at the **repository root** — this is what GitHub shows on the project homepage
- `docs/development-guide-bmad-ui.md` is the deeper reference; README links to it
- `_bmad-custom/bmad-ui/` is where all app source and scripts live — the working directory for all `pnpm` commands
- There is no `package.json` at the repository root — running `pnpm install` from root fails

### References

- [Source: epics.md#Story-6.1] — User story, acceptance criteria, FR33 mapping
- [Source: .github/CONTRIBUTING.md#local-setup] — Correct setup steps reference
- [Source: docs/development-guide-bmad-ui.md] — Detailed dev guide (accurate after Story 5.3)
- [Source: README.md#quick-start] — Current broken Quick Start (missing `cd _bmad-custom/bmad-ui`)
- [Source: prd.md] — NFR: new users complete local setup in under 15 minutes

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
