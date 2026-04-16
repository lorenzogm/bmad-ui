# Story 4.5: Validate End-to-End Pipeline and Vercel Deployment

Status: in-progress

## Story

As a maintainer,
I want all GitHub Actions workflows to pass cleanly and the app to be live on Vercel,
so that I can confirm the full CI/CD pipeline is operational end-to-end.

## Acceptance Criteria

1. **Given** the current `main` branch, **When** the CI workflow (`bmad-ui-ci`) runs, **Then** it completes with `success` — all lint, type-check, tests, and build steps pass.

2. **Given** a push to `main`, **When** the deploy workflow (`bmad-ui-deploy`) runs, **Then** it completes with `success` and produces a live Vercel deployment URL.

3. **Given** the live Vercel URL, **When** smoke-tested, **Then**:
   - The home page loads and returns HTTP 200
   - The page title contains "bmad-ui" or equivalent product name
   - No JavaScript runtime errors are present on the home page
   - Key navigation routes (`/epics`, `/analytics`) are reachable and render without blank screens

4. **Given** all workflows pass, **When** the sprint status is reviewed, **Then** story 4.5 is marked `done` and Epic 4 can be closed.

## Tasks / Subtasks

- [x] Diagnose all current CI failures blocking `main` (AC: #1)
  - [x] Run `pnpm check:lint` locally to identify Biome errors
  - [x] Identify affected files: `styles.css`, `app.tsx`, `__root.tsx`, `epic.$epicId.tsx`, `improvement-workflow.tsx`, `prepare-story.$storyId.tsx`, `session.$sessionId.tsx`, `sessions.tsx`, `story.$storyId.tsx`
- [x] Fix all Biome formatting errors (AC: #1)
  - [x] Run `biome check --write` to auto-fix formatting in all affected files
  - [x] Manually fix lint errors not auto-fixed: `noUnusedVariables` in `__root.tsx`, `useExhaustiveDependencies` in `__root.tsx`, unused suppression in `session.$sessionId.tsx`
- [x] Verify CI passes locally (AC: #1)
  - [x] Run `pnpm check:lint` — 0 errors
  - [x] Run `pnpm check:types` — 0 errors
  - [x] Run `pnpm build` — exits 0
- [x] Push fix commit to `main` and monitor workflows (AC: #1, #2)
  - [x] `git push origin main`
  - [x] Monitor `bmad-ui-ci` run to `success`
  - [x] Monitor `bmad-ui-deploy` run to `success`
- [x] Smoke test Vercel deployment (AC: #3)
  - [x] Confirm Vercel URL from deploy workflow summary or Vercel dashboard
  - [x] HTTP GET `/` returns 200
  - [x] HTTP GET `/epics` returns 200
  - [x] HTTP GET `/analytics` returns 200
  - [x] No JS errors detected

## Dev Notes

### Root Cause of CI Failures

All CI failures since story 4.1 have been Biome format/lint violations introduced by recent feature work (analytics ECharts, sprint-status derivation fix). The violations are:

| File | Issue |
|---|---|
| `src/styles.css` | CSS formatting — multi-value `transition` and keyframe rules not split across lines |
| `src/app.tsx` | TSX formatting — long JSX expressions need line breaks |
| `src/routes/__root.tsx` | Unused variable + `useExhaustiveDependencies` lint errors |
| `src/routes/epic.$epicId.tsx` | TSX formatting |
| `src/routes/improvement-workflow.tsx` | TSX formatting |
| `src/routes/prepare-story.$storyId.tsx` | TSX formatting |
| `src/routes/session.$sessionId.tsx` | TSX formatting + unused biome suppression |
| `src/routes/sessions.tsx` | TSX formatting |
| `src/routes/story.$storyId.tsx` | TSX formatting |

### Fix Strategy

1. **Auto-fix**: `cd _bmad-custom/bmad-ui && npx biome check --write .` handles all formatting violations and auto-fixable lint issues.
2. **Manual fixes**: Unused variable in `__root.tsx` and unused suppression in `session.$sessionId.tsx` must be removed by hand.

### Deploy Workflow Context

The deploy workflow (`bmad-ui-deploy`) also fails on `main` because it runs `pnpm check:lint` in the `check-changes` job before deploying. Fixing CI automatically unblocks deploy.

### Smoke Test URLs

Vercel production URL is determined from the deploy workflow summary output or from the Vercel project dashboard. The expected URL pattern is `https://bmad-ui-*.vercel.app` or a custom domain if configured.

### pnpm + Biome Constraint

- Always use `pnpm` (not `npm`) in this project
- Biome config is at `_bmad-custom/bmad-ui/biome.json`
- `pnpm check:lint` = `biome check .`
- `pnpm check:types` = `tsc --noEmit`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Completion Notes List

- Ran `biome check --write` to auto-fix all formatting violations across 9 files
- Manually removed unused variable import in `__root.tsx`
- Fixed `useExhaustiveDependencies` in `__root.tsx`
- Removed unused biome suppression comment in `session.$sessionId.tsx`
- Pushed fix commit, monitored both workflows to `success`
- Smoke tested Vercel deployment: all routes returned 200, no JS errors

### File List

- `_bmad-custom/bmad-ui/src/styles.css`
- `_bmad-custom/bmad-ui/src/app.tsx`
- `_bmad-custom/bmad-ui/src/routes/__root.tsx`
- `_bmad-custom/bmad-ui/src/routes/epic.$epicId.tsx`
- `_bmad-custom/bmad-ui/src/routes/improvement-workflow.tsx`
- `_bmad-custom/bmad-ui/src/routes/prepare-story.$storyId.tsx`
- `_bmad-custom/bmad-ui/src/routes/session.$sessionId.tsx`
- `_bmad-custom/bmad-ui/src/routes/sessions.tsx`
- `_bmad-custom/bmad-ui/src/routes/story.$storyId.tsx`
