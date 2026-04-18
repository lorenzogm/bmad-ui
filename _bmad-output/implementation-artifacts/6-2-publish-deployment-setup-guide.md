# Story 6.2: Publish Deployment Setup Guide

Status: ready-for-dev

## Story

As a new user,
I want clear deployment setup instructions,
so that I can deploy bmad-ui reliably.

## Acceptance Criteria

1. **Given** deployment documentation, **When** followed, **Then** setup steps cover environment requirements, secrets prerequisites, and deployment workflow triggers.

2. **Given** preview and production deployment paths, **When** documented, **Then** differences and safeguards are explicit (preview = auto on push to `main`; production = manual `workflow_dispatch`).

3. **Given** a deployment issue, **When** encountered, **Then** docs point to actionable diagnostics in workflow logs (GitHub Actions run summary / `::error::` messages).

## Tasks / Subtasks

- [ ] Rewrite `docs/deployment-guide.md` as the authoritative deployment reference (AC: #1, #2, #3)
  - [ ] Cover prerequisites: Node.js 18+, pnpm 10.16+, Vercel CLI, dotenvx, Terraform (maintainer path)
  - [ ] Document GitHub Secrets required: `DOTENV_PRIVATE_KEY` (must be set before any deployment succeeds)
  - [ ] Document `.env` encrypted secrets inventory: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `TF_VAR_GH_PAT_TOKEN`, `TF_VAR_GITHUB_OWNER`, `TERRAFORM_STATE_ENCRYPT_KEY`
  - [ ] Document the two deployment paths — preview (push to `main`) and production (`workflow_dispatch` with `environment: production`) — with trigger conditions and safeguards
  - [ ] Explain the job sequence: `check-changes` → `infra-deploy` (conditional) → `deploy` → `deploy-production` (conditional)
  - [ ] Document how to find deployment diagnostics in GitHub Actions: step summaries, `::error::` annotations, and the "Deploy Trigger Summary" job output
  - [ ] Add "New Maintainer Onboarding" section: how to obtain `.env.keys`, set `DOTENV_PRIVATE_KEY` GitHub Secret, and verify decryption
- [ ] Add a `## Deployment` link section to `README.md` Quick Start area pointing to `docs/deployment-guide.md` (AC: #1)
  - [ ] Keep the callout "No secrets required for local dev" and add a sibling note clarifying maintainers need `DOTENV_PRIVATE_KEY` for deployment
- [ ] Verify `docs/secrets-workflow.md` links and references are consistent with the new deployment guide (read-only verification, fix only if broken)
- [ ] Run `cd _bmad-custom/bmad-ui && pnpm run check` to confirm no regressions (documentation-only change — this should pass trivially)

## Dev Notes

### Current State

**`docs/deployment-guide.md`** — stale auto-generated stub. Current content is inaccurate:
- Claims "No explicit deployment manifests were detected" — FALSE, `.github/workflows/deploy.yml` exists and is fully operational
- References `npm ci` — the project uses `pnpm`, not `npm`
- Contains no secrets documentation, no Vercel context, no job sequence

This file must be **fully replaced** with accurate content. The stub has no valuable content to preserve.

**`README.md`** — has a `Maintainers only: dotenvx` note in Prerequisites but no "Deployment" section or link to the deployment guide. Story 6.1 will fix the Quick Start section (separate story, may not yet be complete — write Story 6.2 independently, do not depend on 6.1 changes being merged).

**`.github/workflows/deploy.yml`** — the source of truth for deployment behavior. Do not modify.

**`docs/secrets-workflow.md`** — already accurate and comprehensive. Cross-link from deployment guide; do NOT rewrite it.

### Deployment Architecture (from `deploy.yml`)

**Triggers:**
```yaml
on:
  push:
    branches: [main]        # → environment: development (preview)
  workflow_dispatch:
    inputs:
      environment:
        options: [development, production]   # manual trigger for production
        default: development
```

**Job sequence (all jobs in `deploy.yml`):**

| Job | Condition | Purpose |
|---|---|---|
| `check-changes` | always | Detects if `infra/` or `_bmad-custom/bmad-ui/` changed; resolves target environment |
| `infra-deploy` | if `infra-changed == 'true'` | Runs `terraform apply` for GitHub/Vercel infra; needs `DOTENV_PRIVATE_KEY` |
| `deploy` | if `app-changed == 'true'` (or infra-deploy didn't fail) | Builds app; runs `vercel deploy --prod` to get a preview URL |
| `deploy-production` | if `environment == 'production'` AND prior jobs succeeded | Promotes to Vercel production alias |

**Preview vs. Production differences:**
- **Preview**: triggered automatically on every push to `main`. Calls `vercel deploy --prod` (confusingly named — this gives a unique preview URL, not the production alias). No environment protection gate.
- **Production**: requires manual `workflow_dispatch` with `environment: production`. Has a GitHub Environment protection on the `production` environment (`environment: name: production`). Calls `vercel deploy --prod` and captures the canonical production URL.

**Secrets required to deploy:**

| Secret / File | Where Set | Purpose |
|---|---|---|
| `DOTENV_PRIVATE_KEY` | GitHub → Settings → Secrets → Actions | Decrypts `.env` in CI |
| `TERRAFORM_STATE_ENCRYPT_KEY` | GitHub → Settings → Secrets → Actions | Needed by Terraform before dotenvx runs |
| `.env` (committed) | Repository root | Contains encrypted `VERCEL_TOKEN`, `VERCEL_ORG_ID`, Terraform vars |

**Vercel project ID resolution:** The deploy job reads `VERCEL_PROJECT_ID_PROD` or `VERCEL_PROJECT_ID_DEV` from Terraform outputs stored in state — if Terraform hasn't run, these are empty and the deploy step emits `::error::Unable to resolve Vercel project ID`. This is the most common first-time failure.

**Diagnostic signals in GitHub Actions:**
- `check-changes` job: "Deploy Trigger Summary" step summary shows which paths changed and which environment was selected
- `infra-deploy` job: Terraform plan/apply output in logs
- `deploy` / `deploy-production` jobs: Preview/production URLs in step summary; `::error::` annotations on failure

### Key Constraints

- **Documentation-only story** — do NOT modify any source code in `src/`, configs (`vite.config.ts`, `tsconfig.json`, `biome.json`), CI workflows, or Terraform files.
- Do NOT modify `docs/secrets-workflow.md` — it is accurate; only cross-link from the new deployment guide.
- Do NOT modify `.github/workflows/deploy.yml` — it is the source of truth; document it, don't change it.
- The deployment guide is for **maintainers**, not contributors. Contributors never need deployment docs (they run locally).

### Files to Create/Modify

| File | Action |
|---|---|
| `docs/deployment-guide.md` | Full rewrite — replace stale stub with accurate content |
| `README.md` | Add `## Deployment` link section (or inline note linking to `docs/deployment-guide.md`) |

No other files should be changed unless a specific verified inaccuracy is found.

### New Maintainer Onboarding Checklist (for the guide)

The deployment guide should include a sequential checklist for a new maintainer:

1. Ensure Terraform has been applied (`infra/` directory) — Vercel project and GitHub repo already provisioned
2. Obtain `.env.keys` from an existing maintainer (or from password manager)
3. Set `DOTENV_PRIVATE_KEY` GitHub Secret: **Repository → Settings → Secrets and variables → Actions → New repository secret**
4. Set `TERRAFORM_STATE_ENCRYPT_KEY` GitHub Secret (same location)
5. Trigger a test deployment: push a trivial commit to `main` and confirm the `deploy` job reaches "Deploy to Vercel" without `::error::` annotations
6. For production: trigger manually via **Actions → bmad-ui-deploy → Run workflow → environment: production**

### Verification After Completing

1. Read `docs/deployment-guide.md` — confirm it covers: prerequisites, secrets setup, preview vs. production differences, job sequence, and diagnostic guidance
2. Read `README.md` — confirm a link to `docs/deployment-guide.md` exists for deployment setup
3. `cd _bmad-custom/bmad-ui && pnpm run check` passes cleanly

### Project Structure Notes

- `docs/deployment-guide.md` is the target file — writable, currently a stub
- `docs/secrets-workflow.md` is accurate — cross-link only
- `.github/workflows/deploy.yml` — read-only reference
- `infra/` — Terraform configs; read-only reference for documentation
- `README.md` is at repository root — visible on GitHub homepage

### References

- [Source: epics.md#Story-6.2] — User story, acceptance criteria, FR34 mapping
- [Source: .github/workflows/deploy.yml] — Authoritative deployment pipeline (triggers, jobs, secrets usage)
- [Source: docs/secrets-workflow.md] — dotenvx secrets pattern, inventory, CI usage
- [Source: prd.md#FR34] — "New user can complete deployment setup from repository documentation"
- [Source: prd.md#User-Stories] — Priya (new contributor) persona: deploys to Vercel using documented steps
- [Source: _bmad-output/implementation-artifacts/6-1-publish-fast-local-setup-guide.md] — Pattern for documentation-only story; do not depend on 6.1 being merged

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
