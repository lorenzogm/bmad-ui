# Deployment Guide

This guide is for **maintainers** who need to deploy bmad-ui to Vercel. Contributors running the app locally do not need this guide — see [Quick Start](../README.md#quick-start) instead.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ | Current LTS recommended |
| pnpm | 10.16+ | `npm install -g pnpm` or `corepack enable && corepack prepare pnpm@latest --activate` |
| Vercel CLI | latest | `npm install -g vercel@latest` |
| dotenvx | 1.61.0+ | `npm install -g @dotenvx/dotenvx` — needed to work with encrypted secrets locally |
| Terraform | 1.14.0+ | Only required for infrastructure changes in `infra/vercel/` |

> **Local development:** No secrets or environment variables are required to run the app locally. The deployment secrets are only needed in CI and for maintainers who manage the Vercel project.

---

## Secrets Required for Deployment

Deployment will fail without the following secrets correctly set:

### GitHub Repository Secrets

Set these at **Repository → Settings → Secrets and variables → Actions**:

| Secret | Purpose |
|--------|---------|
| `DOTENV_PRIVATE_KEY` | Decrypts the committed `.env` file in CI — **must be set before any deployment succeeds** |
| `TERRAFORM_STATE_ENCRYPT_KEY` | Decrypts the Terraform state in CI — needed before dotenvx runs in Terraform steps |

### Encrypted `.env` (committed to repository)

The `.env` file at the repository root is committed encrypted. Its secrets are decrypted at deploy time using `DOTENV_PRIVATE_KEY`. It contains:

| Key | Purpose |
|-----|---------|
| `VERCEL_TOKEN` | Vercel API token for deployments |
| `VERCEL_ORG_ID` | Vercel organization ID |
| `TF_VAR_GH_PAT_TOKEN` | GitHub PAT for the Terraform GitHub provider |
| `TF_VAR_GITHUB_OWNER` | GitHub org/user for Terraform |
| `TERRAFORM_STATE_ENCRYPT_KEY` | AES key for encrypting Terraform state |

See [docs/secrets-workflow.md](secrets-workflow.md) for the full dotenvx encryption model, how to add or rotate secrets, and local usage.

---

## Deployment Paths

### Preview — automatic on every push to `main`

- **Trigger**: Any push to the `main` branch
- **Environment**: `development`
- **Safeguards**: None — all CI checks (lint, type-check, tests, build) must pass first
- **Result**: A unique Vercel preview URL posted in the GitHub Actions run summary

### Production — manual via `workflow_dispatch`

- **Trigger**: Manually via **Actions → bmad-ui-deploy → Run workflow → environment: production**
- **Environment**: `production`
- **Safeguards**: GitHub Environment protection gate on the `production` environment — requires approval if configured
- **Result**: The canonical production URL promoted to the Vercel production alias

> **Note on `vercel deploy --prod`**: Both preview and production deployments use `vercel deploy --prod` in the CLI. For the preview path this produces a unique preview URL, not the production alias. The production alias promotion only happens in the `deploy-production` job.

---

## Job Sequence

The workflow (`.github/workflows/deploy.yml`, name: `bmad-ui-deploy`) runs four jobs:

| Job | Condition | Purpose |
|-----|-----------|---------|
| `check-changes` | Always | Runs quality checks (lint, types, tests, build); detects which paths changed (`infra/vercel/` or `_bmad-ui/`); resolves target environment |
| `infra-deploy` | Only if `infra/vercel/` changed (or `workflow_dispatch`) | Runs `terraform apply` to provision/update the Vercel project and GitHub repo via Terraform; needs both `DOTENV_PRIVATE_KEY` and `TERRAFORM_STATE_ENCRYPT_KEY` |
| `deploy` | Only if app or infra changed (and `infra-deploy` did not fail) | Builds the app; calls `vercel deploy --prod` to get a preview URL |
| `deploy-production` | Only if `environment == production` AND `deploy` succeeded | Calls `vercel deploy --prod` again with the `production` GitHub Environment gate; outputs the final production URL |

---

## Diagnostics

When a deployment fails, use GitHub Actions to find the root cause:

### Deploy Trigger Summary

The `check-changes` job always emits a **"Deploy Trigger Summary"** to the step summary. Check it to confirm:
- Which event triggered the run (push vs. workflow_dispatch)
- Which environment was resolved
- Whether `infra-changed` and `app-changed` are `true` or `false`

### Common failure: Unable to resolve Vercel project ID

```
::error::Unable to resolve Vercel project ID for preview deployment
```

**Cause:** The `infra-deploy` job has not run yet (first-time setup) or Terraform did not output a project ID. The deploy job tries to look up the project ID from Vercel's API using `VERCEL_TOKEN`, but the Vercel project (`bmad-ui-dev` or `bmad-ui-prod`) does not exist yet.

**Fix:** Run the workflow manually with `workflow_dispatch` so that `infra-changed=true` is forced and `infra-deploy` provisions the Vercel project.

### Finding `::error::` annotations

Failed jobs emit `::error::` annotations visible as red markers in the GitHub Actions run summary. For Terraform failures, expand the **Terraform Plan** and **Terraform Apply** steps in the `infra-deploy` job logs.

---

## New Maintainer Onboarding

Follow these steps in order to set up deployment access for the first time:

1. **Ensure Terraform has been applied** — the Vercel project (`bmad-ui-dev` / `bmad-ui-prod`) and the GitHub repository must already exist. Ask an existing maintainer to confirm.

2. **Obtain `.env.keys`** — get the file from an existing maintainer or your team's password manager. This file contains `DOTENV_PRIVATE_KEY` and is never committed to the repository.

3. **Set `DOTENV_PRIVATE_KEY` as a GitHub Secret**
   - Go to **Repository → Settings → Secrets and variables → Actions → New repository secret**
   - Name: `DOTENV_PRIVATE_KEY`
   - Value: the `DOTENV_PRIVATE_KEY` value from `.env.keys`

4. **Set `TERRAFORM_STATE_ENCRYPT_KEY` as a GitHub Secret** (same location)
   - Name: `TERRAFORM_STATE_ENCRYPT_KEY`
   - Value: obtain from existing maintainer or password manager

5. **Verify local decryption** (optional but recommended):
   - Place `.env.keys` at the repository root (it is gitignored)
   - Run: `dotenvx run -- env | grep VERCEL_TOKEN` — should print `VERCEL_TOKEN=Bearer xxx...`

6. **Trigger a test deployment**: Push a trivial commit to `main` and monitor the `deploy` job in GitHub Actions. The run summary should show a Vercel preview URL with no `::error::` annotations.

7. **Production deployment**: Trigger manually via **Actions → bmad-ui-deploy → Run workflow → environment: production**.

---

## References

- [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) — authoritative deployment pipeline
- [docs/secrets-workflow.md](secrets-workflow.md) — dotenvx secrets model, inventory, rotation
- [`infra/vercel/`](../infra/vercel/) — Terraform configuration for Vercel and GitHub infrastructure
