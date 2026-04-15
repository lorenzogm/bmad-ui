---
storyId: '2-3'
storyTitle: 'Environment Separation Across Infra and Deploy Workflows'
epicId: '2'
epicTitle: 'Infrastructure Provisioning via Terraform'
status: 'ready-for-dev'
created: '2026-04-15'
priority: 'high'
---

# Story 2.3: Environment Separation Across Infra and Deploy Workflows

Status: ready-for-dev

## Story

As a maintainer,
I want development, preview, and production configuration separated across Terraform and GitHub Actions,
so that changes to one environment do not unintentionally affect the others.

## Acceptance Criteria

1. **Given** the deployment workflow configuration, **when** reviewed, **then** preview and production deploy jobs are clearly separated with explicit branch or environment targeting
2. **Given** a deployment workflow run, **when** executed for preview, **then** it cannot deploy to production unless production-specific conditions are satisfied
3. **Given** the infra and deployment runbook, **when** read, **then** plan, apply, import, and deploy flow per environment is documented end-to-end

> **Note on original AC1 (Terraform env separation):** There is a single GitHub repository, so splitting Terraform config into dev/production variable files adds no value — there is nothing environment-specific to configure. The `ENVIRONMENT` variable already exists in `variables.tf` as informational metadata. No Terraform changes are required for this story.

## Tasks / Subtasks

- [ ] Create GitHub Actions deployment workflow with separated jobs (AC: #1, #2)
  - [ ] Create `.github/workflows/deploy.yml` with `preview` and `production` jobs
  - [ ] `preview` job: triggers on `pull_request` events → deploys to Vercel preview
  - [ ] `production` job: triggers on `push` to `main` only → deploys to Vercel production with `environment: production` gate
  - [ ] Add `environment: production` to production job to enforce GitHub Environment approval gate
  - [ ] Ensure production job reads secrets from `environment: production` secret scope (not repo-level)
- [ ] Create GitHub Environment `production` if not already present (AC: #2)
  - [ ] Create via GitHub UI: Settings → Environments → New environment → `production`
  - [ ] Document manual creation step in runbook (Terraform provider 6.11.1 does not expose `required_deployment_environments` — must be done manually)
- [ ] Update deployment runbook `docs/deployment-guide.md` (AC: #3)
  - [ ] Document preview environment: GitHub Actions preview deploy job triggered on PRs
  - [ ] Document production environment: GitHub Actions production deploy job (push to `main` + environment gate)
  - [ ] Document Terraform infra workflow: plan/apply/import using existing `config.json`
  - [ ] Add environment secrets reference (which secrets live at repo level vs `production` environment scope)

## Dev Notes

### Dependency on Story 2.2

Story 2.2 (GitHub Actions Deployment Pipeline) is the predecessor that creates the base deployment workflow for Vercel. This story BUILDS ON or REPLACES that work with proper environment separation.

**If Story 2.2 was already implemented:** Extend the existing `.github/workflows/deploy.yml` by splitting jobs and adding the `environment:` gate. Do NOT recreate from scratch — diff and extend.

**If Story 2.2 was NOT implemented:** This story can create the full deployment workflow from scratch with environment separation included from the start. Check `ls .github/workflows/` before proceeding.

### Current Terraform State

There is a single GitHub repository (`bmad-ui`). The `ENVIRONMENT` variable in `infra/github/src/variables.tf` is informational metadata only — it has no bearing on environment separation since there is nothing environment-specific to configure in GitHub itself. **No Terraform changes are required for this story.**

Terraform runs continue using the existing `config.json`:

```bash
cd infra/github/src
dotenvx run -- terraform plan -var-file=config.json
dotenvx run -- terraform apply -var-file=config.json
```

### GitHub Actions Deployment Workflow

No `.github/workflows/` directory exists yet. Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  preview:
    name: Deploy Preview
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: latest
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter bmad-ui build
      # Vercel CLI deploy to preview
      - name: Deploy to Vercel (Preview)
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        run: |
          npx vercel --token "$VERCEL_TOKEN" \
            --yes \
            --cwd _bmad-custom/bmad-ui/dist

  production:
    name: Deploy Production
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    environment: production          # <-- requires GitHub Environment gate
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: latest
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter bmad-ui build
      - name: Deploy to Vercel (Production)
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        run: |
          npx vercel --prod --token "$VERCEL_TOKEN" \
            --yes \
            --cwd _bmad-custom/bmad-ui/dist
```

**Critical environment gate:** The `environment: production` on the production job creates a GitHub Environment approval requirement. Without this, a push to `main` would immediately deploy to production — this is the AC3 guard.

### Required GitHub Secrets

For the GitHub Actions workflow to function, the following secrets must exist:

| Secret | Scope | Description |
|---|---|---|
| `VERCEL_TOKEN` | Repository or environment `production` | Vercel API token |
| `VERCEL_ORG_ID` | Repository | Vercel organization/team ID |
| `VERCEL_PROJECT_ID` | Repository | Vercel project ID for bmad-ui |

**For environment-isolated secrets (AC3):** Move `VERCEL_TOKEN` to the `production` GitHub Environment secrets (Settings → Environments → production → Add secret) rather than repository-level. This prevents preview jobs from accessing production credentials.

### File Structure After This Story

```
.github/
└── workflows/
    └── deploy.yml          # NEW — preview + production jobs

infra/github/
└── src/
    ├── config.json         # UNCHANGED
    ├── main.tf             # UNCHANGED
    ├── providers.tf        # UNCHANGED
    └── variables.tf        # UNCHANGED

docs/
└── deployment-guide.md     # UPDATED — end-to-end runbook per environment
```

### What NOT to Change

- All files in `infra/github/src/` — no Terraform changes needed (single GitHub repo, no environment split required)
- `_bmad-custom/bmad-ui/` — no changes (deployment is at repo level, not package level)
- Do NOT introduce Terraform workspaces or split config files for GitHub infra

### Terraform Runbook (No Change)

Terraform continues using the single `config.json` as before:

```bash
cd infra/github/src
dotenvx run -- terraform plan -var-file=config.json
dotenvx run -- terraform apply -var-file=config.json
```

### Learnings from Story 2.1

- `required_deployment_environments` on `github_branch_protection` was NOT available in provider `integrations/github@6.11.1` despite docs suggesting it. Verified by `terraform providers schema`. Do NOT attempt to manage GitHub Environments via Terraform branch protection — create the `production` environment manually via GitHub UI instead.
- Terraform runs require `.env` with `GH_PAT_TOKEN` and `GITHUB_OWNER` via dotenvx at `infra/github/.env`. The dotenvx encrypted file exists at project root.
- `terraform validate` can be run without credentials; `plan`/`apply` require credentials.
- `config.json` is the `-var-file` argument (not using `*.tfvars` extension).

### pnpm + Monorepo Context

- The project uses pnpm workspaces (see `pnpm-workspace.yaml`)
- Filter syntax: `pnpm --filter bmad-ui build` (the frontend package name)
- `pnpm/action-setup@v4` is the official GitHub Action for pnpm
- Node 24 is the baseline (set in project baseline)
- Build output: `_bmad-custom/bmad-ui/dist/` (Vite build target)

### Project Structure Notes

- All GitHub Actions workflows go in `.github/workflows/` (no subdirectories needed for Phase 1)
- Terraform files stay in `infra/github/src/` — do not move or add a `infra/vercel/` directory in this story
- Runbook updates go to `docs/deployment-guide.md` — the architecture designates this as the deployment docs location
- Config files are committed (not gitignored) — they contain configuration values, not secrets

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3] — acceptance criteria
- [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure & Deployment] — "Keep environment separation across local, preview, and production"
- [Source: infra/github/README.md] — existing Terraform runbook to extend
- [Source: docs/deployment-guide.md] — stub deployment guide to flesh out
- [Source: _bmad-output/implementation-artifacts/2-1-terraform-github-repository-infrastructure.md] — Story 2.1 learnings (required_deployment_environments unavailable in provider 6.11.1; GitHub Environment must be created manually)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
