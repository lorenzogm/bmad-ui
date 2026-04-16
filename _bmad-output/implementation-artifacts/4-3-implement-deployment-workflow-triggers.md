# Story 4.3: Implement Deployment Workflow Triggers

Status: ready-for-dev

## Story

As a maintainer,
I want deployment workflows triggered from approved repository events,
so that releases are automated and consistent.

## Acceptance Criteria

1. **Given** configured deployment branches or events, **When** an approved event occurs (push to `main` or `workflow_dispatch`), **Then** the deploy workflow starts automatically.

2. **Given** preview and production deployment paths, **When** workflows run, **Then** the target environment (`development` or `production`) is explicit in workflow job names, step names, and the GitHub Actions run summary.

3. **Given** deployment workflow prerequisites are not met (quality checks fail), **When** the run starts, **Then** deployment halts before any Vercel deploy step and reports the failed gate clearly in the job log.

## Tasks / Subtasks

- [ ] Audit and update `.github/workflows/deploy.yml` trigger and gate configuration (AC: #1, #2, #3)
  - [ ] Confirm `on.push.branches: [main]` auto-triggers development deployment (AC: #1)
  - [ ] Confirm `on.workflow_dispatch` allows explicit `environment` selection (`development` / `production`) (AC: #1)
  - [ ] Replace composite `pnpm check` in `check-changes` job with individual named steps: Install → Lint → Type check → Tests → Build (AC: #3)
  - [ ] Ensure each individual check step is named so GitHub Actions logs show exactly which gate failed (AC: #3)
  - [ ] Add `--frozen-lockfile` to the `pnpm install` step in `check-changes` (AC: #3)
  - [ ] Rename `deploy-preview` job to `deploy` and add `name: Deploy (${{ needs.check-changes.outputs.environment }})` so environment is explicit in run UI (AC: #2)
  - [ ] Add `echo "Environment: ..."` step in deploy job so environment appears in job-level logs (AC: #2)
  - [ ] Ensure `deploy-production` job retains `environment: production` block with `url:` output (AC: #2)
  - [ ] Add `GITHUB_STEP_SUMMARY` output to `check-changes` job summarising resolved environment and changed flags (AC: #2)
- [ ] Verify via `workflow_dispatch` (development) that deploy runs and summary shows environment (AC: #1, #2)
- [ ] Verify that a forced check failure in a test branch halts deployment before Vercel steps (AC: #3)

## Dev Notes

### Critical Context

This story operates **exclusively on `.github/workflows/deploy.yml`** — the existing production deployment workflow. The CI validation workflow (`ci.yml`) is created in story 4-1 as a separate file.

**Do NOT**:
- Create a new workflow file — this story only modifies `deploy.yml`
- Remove or replace any Terraform, Vercel, or secret-loading steps
- Change trigger events (keep `push: branches: [main]` and `workflow_dispatch`)
- Change any secret names (`DOTENV_PRIVATE_KEY`, `TERRAFORM_STATE_ENCRYPT_KEY`)

### Existing `deploy.yml` Structure (reference)

The current workflow has four jobs:

| Job | Purpose |
|---|---|
| `check-changes` | Runs quality checks + detects which paths changed |
| `infra-deploy` | Runs Terraform apply when `infra/vercel/` changes |
| `deploy-preview` | Deploys to Vercel preview environment |
| `deploy-production` | Promotes preview to production (only on `workflow_dispatch` with `environment=production`) |

**Current quality gate** (in `check-changes`):
```yaml
- name: Run code quality checks
  run: pnpm check
  working-directory: _bmad-custom/bmad-ui
```
This uses the composite `pnpm check` script, which means a single step fails with an opaque message. **Replace this with individual steps** matching the pattern from story 4-1's CI workflow:

```yaml
- name: Install dependencies
  run: pnpm install --frozen-lockfile
  working-directory: _bmad-custom/bmad-ui

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

Because `check-changes` job is `needs:` for all deploy jobs, any step failure here already halts the entire pipeline — satisfying AC #3 without any additional `if:` guards.

### Environment Explicitness

The `resolve-env` step already outputs the resolved environment. To make it visible in the Actions UI (AC #2):

1. Add a `GITHUB_STEP_SUMMARY` entry to `check-changes`:
```yaml
- name: Summary
  run: |
    echo "### Deploy triggered" >> $GITHUB_STEP_SUMMARY
    echo "Environment: ${{ steps.resolve-env.outputs.environment }}" >> $GITHUB_STEP_SUMMARY
    echo "Infra changed: ${{ steps.check.outputs.infra-changed }}" >> $GITHUB_STEP_SUMMARY
    echo "App changed: ${{ steps.check.outputs.app-changed }}" >> $GITHUB_STEP_SUMMARY
```

2. Keep `deploy-production` job's `environment:` block intact — this is the GitHub Environments gate:
```yaml
environment:
  name: production
  url: ${{ steps.production-deploy.outputs.url }}
```

### pnpm Setup Pattern (must be consistent across all jobs)

Every job that runs pnpm commands must use:
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
Node version must be `"24"` — matches `engines.node: ">=24"` in package.json. **Never use npm or yarn.**

### Permissions (keep existing)

The workflow currently has:
```yaml
permissions:
  contents: write
  actions: write
```
`contents: write` is required for the Terraform state commit to the `terraform-state` branch. `actions: write` is needed for `workflow_dispatch`. **Do not reduce these permissions.**

### Available pnpm Scripts

| Script | Command |
|---|---|
| `check` | lint + types + tests + build (composite — do NOT use in CI) |
| `check:lint` | `biome check src/` |
| `check:types` | `tsc --noEmit` |
| `check:tests` | `vitest run --passWithNoTests` |
| `build` | `tsc --noEmit && vite build` |

### Secret Handling (do not change)

Secrets are loaded via `pnpm dlx @dotenvx/dotenvx` from encrypted `.env` files. The `DOTENV_PRIVATE_KEY` and `TERRAFORM_STATE_ENCRYPT_KEY` secrets are already correctly handled in `infra-deploy` and all Vercel jobs. The shell-injection-safe multiline delimiter pattern (`write_env_var` with `openssl rand -hex 16` delimiters) was implemented in the Epic 3 work — do not simplify or replace it.

### Project Structure Notes

- File to modify: `.github/workflows/deploy.yml` (repo root level)
- Infra and CI config is repo-level, not inside `_bmad-custom/` [Source: architecture.md]
- No source files in `_bmad-custom/bmad-ui/` should be touched

### References

- FR19: "Trigger deployment workflows on approved repository events" [Source: epics.md#Epic-4]
- Architecture: "Use GitHub Actions as the CI enforcement layer" [Source: architecture.md]
- Architecture: "Use Vercel as the frontend hosting and deployment platform" [Source: architecture.md]
- Architecture: "Keep environment separation across local, preview, and production" [Source: architecture.md]
- Existing workflow: `.github/workflows/deploy.yml`
- Story 4.1 pattern for individual check steps: `_bmad-output/implementation-artifacts/4-1-create-ci-validation-workflow.md`
- NFR2: CI validation completes within 15 minutes [Source: prd.md]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
