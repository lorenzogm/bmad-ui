# Story 4.1: Create CI Validation Workflow

Status: in-progress

## Story

As a maintainer,
I want a GitHub Actions CI workflow that runs on pull requests and key branch updates,
so that code quality is automatically validated before integration.

## Acceptance Criteria

1. **Given** a pull request is opened or updated against `main`, **When** CI runs, **Then** it executes install, lint, typecheck, and test/build checks using pnpm — and each check is a clearly named step.

2. **Given** CI is configured, **When** dependencies are installed, **Then** lockfile consistency is enforced (`--frozen-lockfile`) to prevent environment drift.

3. **Given** CI completion, **When** checks fail, **Then** the workflow is marked failed with clear job-level logs showing exactly which step failed.

## Tasks / Subtasks

- [x] Create `.github/workflows/ci.yml` (AC: #1, #2, #3)
  - [x] Add `pull_request` trigger (types: opened, synchronize, reopened) targeting `main`
  - [x] Add `push` trigger on `main` branch for post-merge validation
  - [x] Add `workflow_dispatch` trigger for manual runs
  - [x] Configure `pnpm/action-setup@v5` with `package_json_file: _bmad-custom/bmad-ui/package.json`
  - [x] Configure `actions/setup-node@v6` with `node-version: "24"`, `cache: "pnpm"`, `cache-dependency-path: _bmad-custom/bmad-ui/pnpm-lock.yaml`
  - [x] Add "Install dependencies" step: `pnpm install --frozen-lockfile` in `_bmad-custom/bmad-ui`
  - [x] Add "Lint" step: `pnpm check:lint` in `_bmad-custom/bmad-ui`
  - [x] Add "Type check" step: `pnpm check:types` in `_bmad-custom/bmad-ui`
  - [x] Add "Tests" step: `pnpm check:tests` in `_bmad-custom/bmad-ui`
  - [x] Add "Build" step: `pnpm build` in `_bmad-custom/bmad-ui`
- [x] Verify workflow runs on an open PR or via `workflow_dispatch` (AC: #1, #3)
- [x] Confirm that a lockfile mismatch causes install to fail (AC: #2)

### Review Findings

- [ ] [Review][Patch] Add a job-level timeout to cap CI runtime and align with NFR2 (<=15 minutes) [.github/workflows/ci.yml:15]

## Dev Notes

### Critical Context

This is the **first story in Epic 4**. No CI workflow for PRs exists yet. The existing `.github/workflows/deploy.yml` handles push-to-main and deployment — do **not** modify it. This story creates a brand new, standalone `.github/workflows/ci.yml` dedicated to PR validation.

### Existing Deploy Workflow (reference, do not change)

`.github/workflows/deploy.yml`:
- Triggers on `push` to `main` and `workflow_dispatch`
- Already runs `pnpm check` (lint + types + tests + build) in the `check-changes` job
- Uses pnpm v10, Node 24, cache on `_bmad-custom/bmad-ui/pnpm-lock.yaml`
- Does NOT run on pull requests

### New CI Workflow Requirements

**File**: `.github/workflows/ci.yml`

**Triggers**:
```yaml
on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]
  push:
    branches: [main]
  workflow_dispatch:
```

**Working directory**: all pnpm commands run in `_bmad-custom/bmad-ui/`.

**pnpm setup** (must match deploy.yml exactly to ensure consistency):
```yaml
- uses: pnpm/action-setup@v5
  with:
    package_json_file: _bmad-custom/bmad-ui/package.json

- uses: actions/setup-node@v6
  with:
    node-version: "24"
    cache: "pnpm"
    cache-dependency-path: _bmad-custom/bmad-ui/pnpm-lock.yaml
```

**Install with lockfile enforcement**:
```yaml
- name: Install dependencies
  run: pnpm install --frozen-lockfile
  working-directory: _bmad-custom/bmad-ui
```

> `--frozen-lockfile` causes pnpm to exit non-zero if the lockfile needs updating, satisfying AC #2.

**Check steps** (run as individual named steps so each is visible as a separate entry in the GitHub Actions UI — satisfies AC #3):
```yaml
- name: Lint
  run: pnpm check:lint
  working-directory: _bmad-custom/bmad-ui

- name: Type check
  run: pnpm check:types
  working-directory: _bmad-custom/bmad-ui

- name: Tests
  run: pnpm check:tests
  working-directory: _bmad-custom/bmad-ui

- name: Build
  run: pnpm build
  working-directory: _bmad-custom/bmad-ui
```

### Available pnpm Scripts (from `_bmad-custom/bmad-ui/package.json`)

| Script | Command |
|---|---|
| `check` | lint + types + tests + build (all-in-one) |
| `check:lint` | `biome check src/` |
| `check:types` | `tsc --noEmit` |
| `check:tests` | `vitest run --passWithNoTests` |
| `build` | `tsc --noEmit && vite build` |

Use **individual scripts** in CI (not the composite `check`) so each step fails independently with its own log output.

### No Secrets Required

This CI workflow validates code quality only — it does not deploy and requires no secrets (`DOTENV_PRIVATE_KEY`, `VERCEL_TOKEN`, etc.). Keep the workflow simple with no `env:` or `secrets:` entries.

### Permissions

Minimal read permissions are sufficient:
```yaml
permissions:
  contents: read
```

### Architecture Constraints

- pnpm is the **mandatory** package manager — never use `npm install` or `yarn`
- Node.js version must be `"24"` to match `engines.node: ">=24"` in package.json
- No test files exist yet; `vitest run --passWithNoTests` passes by design

### Project Structure Notes

- New file location: `.github/workflows/ci.yml` (repo root level, not inside `_bmad-custom/`)
- Infrastructure and CI config are explicitly repo-level concerns [Source: architecture.md — "Infrastructure and CI config should remain repo-level, not hidden inside frontend source directories"]
- Do not touch `_bmad-custom/bmad-ui/` package.json or any source files

### References

- Existing deployment workflow: `.github/workflows/deploy.yml`
- Package scripts: `_bmad-custom/bmad-ui/package.json#scripts`
- FR16 (trigger automated validation on repo changes), FR18 (standard pnpm workflow in CI), FR21 (contributors validate against same checks as maintainers): [Source: epics.md#Epic-4]
- NFR2: CI validation completes within 15 minutes [Source: prd.md]
- Architecture constraint: "GitHub Actions is the authoritative CI enforcement layer" [Source: architecture.md]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

- Created `.github/workflows/ci.yml` with all required triggers (pull_request, push to main, workflow_dispatch)
- Used `pnpm install --frozen-lockfile` to enforce lockfile consistency (AC #2)
- Each check runs as an individual named step: Lint, Type check, Tests, Build (AC #1, #3)
- pnpm/Node setup matches deploy.yml exactly for consistency
- Minimal `contents: read` permissions; no secrets required

### File List

- `.github/workflows/ci.yml` (new)
