---
storyId: '2-2'
storyTitle: 'GitHub Actions Deployment Pipeline'
epicId: '2'
epicTitle: 'Infrastructure Provisioning via Terraform'
status: 'ready-for-dev'
created: '2026-04-15'
priority: 'high'
---

# Story 2.2: GitHub Actions Deployment Pipeline

Status: ready-for-dev

## Story

As a maintainer,
I want deployment to be executed through GitHub Actions workflows,
so that releases are automated, auditable, and consistent across environments.

## Acceptance Criteria

1. **Given** a push or merge to the configured deployment branch (`main`), **when** the deploy workflow is triggered, **then** GitHub Actions builds and deploys bmad-ui to Vercel successfully
2. **Given** deployment secrets are required, **when** the workflow runs, **then** it reads required credentials from GitHub Secrets and does not expose secret values in logs
3. **Given** a failed deployment step, **when** the workflow completes, **then** the run is marked failed with clear stage-level logs for diagnosis
4. **Given** a successful deployment, **when** maintainers review the run, **then** deployment status and environment target are visible in the workflow summary

## Tasks / Subtasks

- [x] Create `.github/workflows/deploy.yml` workflow file (AC: #1, #2, #3, #4)
  - [x] Trigger on `push` to `main` and `workflow_dispatch` with environment choice (development/production)
  - [x] `check-changes` job: runs `pnpm check`, detects infra/app changes, resolves environment
  - [x] `infra-deploy` job: Terraform init/plan/apply for Vercel project provisioning via `infra/vercel/src/`
  - [x] `deploy-preview` job: `vercel build` + `vercel deploy --prebuilt` for preview URL
  - [x] `deploy-production` job: `vercel build --prod` + `vercel deploy --prebuilt --prod` scoped to `production` environment
  - [x] Secrets loaded via dotenvx from encrypted `.env` using `DOTENV_PRIVATE_KEY` GitHub Secret
  - [x] Workflow summary step on production deploy showing deployed URL
- [x] Create `infra/vercel/src/` Terraform module for Vercel project provisioning
  - [x] `providers.tf` — vercel provider `4.7.1`
  - [x] `variables.tf` — `ENVIRONMENT`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `vercel` object, `environment_variables`
  - [x] `main.tf` — `vercel_project`, `vercel_project_domain` (primary + redirect), `vercel_project_environment_variable`, output `BMAD_UI_VERCEL_PROJECT_ID`
  - [x] `config.development.json` — project `bmad-ui-dev`, root `_bmad-custom/bmad-ui`, `pnpm run build` / `pnpm install`
  - [x] `config.production.json` — project `bmad-ui-prod`, same build config, `project_domains: []` (add domain later)
- [ ] Add `DOTENV_PRIVATE_KEY` to GitHub repository secrets (AC: #2)
  - [ ] Go to `https://github.com/lorenzogm/bmad-ui/settings/secrets/actions`
  - [ ] Add `DOTENV_PRIVATE_KEY` as a repository-level secret (same key used locally with dotenvx)
- [ ] Add `TERRAFORM_STATE_ENCRYPT_KEY` to GitHub repository secrets
  - [ ] Generate with: `openssl rand -base64 32`
  - [ ] Add as repository-level secret `TERRAFORM_STATE_ENCRYPT_KEY`
- [ ] Verify end-to-end: push to `main` triggers workflow → `pnpm check` passes → Vercel deploys (AC: #1, #3, #4)

## Dev Notes

### What Was Built

Files created (adapted from `../lorenzogm` repo patterns):

```
.github/workflows/deploy.yml     ← GitHub Actions pipeline
infra/vercel/src/
├── providers.tf                  ← vercel provider 4.7.1
├── variables.tf                  ← ENVIRONMENT, VERCEL_TOKEN, VERCEL_ORG_ID, vercel object
├── main.tf                       ← vercel_project, domains, env vars, output
├── config.development.json       ← project: bmad-ui-dev, root: _bmad-custom/bmad-ui
└── config.production.json        ← project: bmad-ui-prod, same build config
```

### Workflow Jobs

The deploy workflow has 4 jobs:

1. **`check-changes`** — runs `pnpm check` (lint + typecheck + tests + build), detects which paths changed, resolves environment (`development` default on push, selectable via `workflow_dispatch`)
2. **`infra-deploy`** — runs Terraform to provision/update the Vercel project; stores encrypted state in `terraform-state` branch
3. **`deploy-preview`** — builds and deploys a Vercel preview deployment
4. **`deploy-production`** — builds and deploys to Vercel production; scoped to `production` GitHub Environment

### Secrets Model

Secrets flow through dotenvx — only **one** GitHub Secret is needed for dotenvx-managed secrets:

| Secret | Scope | Purpose |
|--------|-------|---------|
| `DOTENV_PRIVATE_KEY` | Repository | Decrypts `.env` to expose `VERCEL_TOKEN`, `VERCEL_ORG_ID` |
| `TERRAFORM_STATE_ENCRYPT_KEY` | Repository | Encrypts/decrypts `terraform.tfstate` for the state branch |

The `VERCEL_TOKEN` and `VERCEL_ORG_ID` values must be added to the encrypted `.env` at repo root using dotenvx:

```bash
dotenvx set VERCEL_TOKEN <your-token>
dotenvx set VERCEL_ORG_ID <your-org-id>
dotenvx set TERRAFORM_STATE_ENCRYPT_KEY $(openssl rand -base64 32)
```

Then `TERRAFORM_STATE_ENCRYPT_KEY` also needs to be added as a plain GitHub Secret (it's used before dotenvx decryption is available).

### Vercel Terraform Project Naming

Projects are named `bmad-ui-dev` (development) and `bmad-ui-prod` (production). The environment suffix comes from the `ENVIRONMENT` variable passed at `terraform plan/apply` time.

To run Terraform locally:
```bash
cd infra/vercel/src
dotenvx run -- sh -c 'TF_VAR_VERCEL_TOKEN=$VERCEL_TOKEN TF_VAR_VERCEL_ORG_ID=$VERCEL_ORG_ID terraform init'
dotenvx run -- sh -c 'TF_VAR_VERCEL_TOKEN=$VERCEL_TOKEN TF_VAR_VERCEL_ORG_ID=$VERCEL_ORG_ID terraform plan -var-file=config.development.json'
dotenvx run -- sh -c 'TF_VAR_VERCEL_TOKEN=$VERCEL_TOKEN TF_VAR_VERCEL_ORG_ID=$VERCEL_ORG_ID terraform apply -var-file=config.development.json'
```

### Terraform State Strategy

State is **not** stored in the repo on `main`. The workflow:
1. Fetches encrypted `terraform-<env>.tfstate.enc` from `origin/terraform-state` branch
2. Decrypts with `TERRAFORM_STATE_ENCRYPT_KEY` via openssl AES-256-CBC
3. Runs terraform with the decrypted state
4. Re-encrypts and pushes updated state back to `terraform-state` branch

On first run (no state): Terraform starts fresh and the `Import existing project` step attempts to reconcile any pre-existing Vercel project by name.

### Relationship to Story 2-1

Story 2-1's Terraform (at `infra/github/src/`) has `required_status_checks` with empty `contexts: []`. After this workflow runs at least once, update `infra/github/src/config.json` to add the check name (e.g., `"Check for changes"`) to `contexts` to enforce CI before merge.

### Relationship to Story 2-3

Story 2-3 (Environment Separation) will refine environment targeting — e.g., preview deploys on PRs, production only on `main`. The `workflow_dispatch` environment choice provides manual control in the interim.

### No E2E Tests

Unlike the source repo (`../lorenzogm`), bmad-ui has no E2E/Playwright tests yet. The `e2e-tests` job was deliberately omitted. `deploy-production` depends only on `deploy-preview` success.

### Project Structure Notes

- Workflow: `.github/workflows/deploy.yml` — repo root level, not inside `_bmad-custom/bmad-ui/`
- Vercel Terraform: `infra/vercel/src/` — parallel to `infra/github/src/`
- Encrypted terraform state: pushed to `terraform-state` branch only — never committed to `main`
- `*.tfstate` and `*.tfstate.*` are already in `.gitignore`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2] — acceptance criteria
- [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure & Deployment] — Vercel + GH Actions decision
- [Source: _bmad-output/implementation-artifacts/2-1-terraform-github-repository-infrastructure.md] — existing Terraform patterns
- [Source: ../lorenzogm/.github/workflows/web-vercel-deploy.yml] — source workflow (adapted)
- [Source: ../lorenzogm/infra/vercel/web/src/] — source Terraform module (adapted)
- [Source: _bmad-custom/bmad-ui/package.json] — pnpm@10.19.0, node>=24, `pnpm check` script

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

- `.github/workflows/deploy.yml` — GitHub Actions deployment pipeline (adapted from `../lorenzogm`)
- `infra/vercel/src/providers.tf` — Vercel Terraform provider (vercel/vercel 4.7.1)
- `infra/vercel/src/variables.tf` — Terraform variable declarations
- `infra/vercel/src/main.tf` — Vercel project, domains, env vars, output
- `infra/vercel/src/config.development.json` — development environment config (project: bmad-ui-dev)
- `infra/vercel/src/config.production.json` — production environment config (project: bmad-ui-prod)
- `_bmad-output/implementation-artifacts/2-2-github-actions-deployment-pipeline.md` — this story file
