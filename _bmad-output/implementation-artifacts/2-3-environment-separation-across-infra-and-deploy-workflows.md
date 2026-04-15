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
I want GitHub infrastructure changes deployed automatically via GitHub Actions,
so that Terraform apply runs on push to main without requiring local credentials.

## Acceptance Criteria

1. **Given** a push to `main` that modifies files under `infra/github/`, **when** the workflow runs, **then** it runs `terraform plan` and `terraform apply` automatically
2. **Given** the workflow runs, **when** it completes, **then** deployment secrets are read from GitHub Secrets (never logged) and a summary is posted to the workflow run
3. **Given** the workflow runs, **when** reviewed, **then** it bootstraps Terraform state via `terraform import` before plan/apply so it is idempotent from any state

> **Scope:** This story is exclusively about automating the GitHub infra Terraform apply via GitHub Actions. It is based directly on the working pattern from `lorenzogm/lorenzogm` — copy and adapt, do not design from scratch.

## Tasks / Subtasks

- [ ] Create `.github/workflows/github-infra-deploy.yml` (AC: #1, #2, #3)
  - [ ] Copy structure from `lorenzogm/lorenzogm` repo's `github-infra-deploy.yml` (see Dev Notes for exact reference)
  - [ ] Adapt trigger paths: `infra/github/**`
  - [ ] Set `node-version: "24"` (not 22)
  - [ ] Set `terraform_version: "1.14.x"` (check latest 1.14 patch)
  - [ ] Fix import resource names for bmad-ui's Terraform resources (see Dev Notes — different from lorenzogm)
  - [ ] Remove `terraform-state` branch protection import (bmad-ui does not have that branch)
  - [ ] Add `GITHUB_REPOSITORY_ID` and `GITHUB_REPOSITORY_URL` outputs to `infra/github/src/main.tf` so the Export Results step works
- [ ] Add `DOTENV_PRIVATE_KEY` to GitHub repository secrets (AC: #2)
  - [ ] Copy the key from `infra/github/.env.keys` (or project root `.env.keys`) → GitHub Settings → Secrets → `DOTENV_PRIVATE_KEY`

## Dev Notes

### Reference Workflow

**Source:** `/Users/lorenzogm/lorenzogm/lorenzogm/.github/workflows/github-infra-deploy.yml`

Copy this file as the baseline. It is production-proven for the same Terraform provider and dotenvx pattern.

### Required Adaptations vs lorenzogm

| Item | lorenzogm value | bmad-ui value |
|---|---|---|
| `node-version` | `"22"` | `"24"` |
| `pnpm/action-setup` | `@v5` | `@v4` (check what's in pnpm-workspace.yaml) |
| `actions/setup-node` | `@v6` | `@v4` |
| `terraform_version` | `"1.10.5"` | `"1.14.x"` (pick latest 1.14 patch from releases) |
| Import: branch protection resource | `github_branch_protection.main["main"]` | `github_branch_protection.protections["main"]` |
| Import: terraform-state branch | present | **remove** — bmad-ui has no `terraform-state` branch |

### Terraform Import Bootstrap Step

The lorenzogm version imports these resources. bmad-ui adaptation:

```bash
# Keep:
terraform import -var-file='config.json' github_repository.main "$REPO_NAME" || true
terraform import -var-file='config.json' 'github_branch_protection.protections["main"]' "$REPO_NAME:main" || true

# Also import all labels dynamically (keep as-is from lorenzogm):
jq -r '.labels[].name' config.json | while read -r label; do
  [ -z "$label" ] && continue
  terraform import -var-file='config.json' "github_issue_label.labels[\"$label\"]" "$REPO_NAME:$label" || true
done
```

**Note:** `|| true` on each import is intentional — if the resource is already in state, import fails gracefully.

### Required Terraform Outputs

The `Export Results` step in the workflow calls `terraform output -raw GITHUB_REPOSITORY_ID` and `GITHUB_REPOSITORY_URL`. These do not exist in bmad-ui's `main.tf` yet. Add to `infra/github/src/main.tf`:

```hcl
output "GITHUB_REPOSITORY_ID" {
  value = github_repository.main.node_id
}

output "GITHUB_REPOSITORY_URL" {
  value = github_repository.main.html_url
}
```

### Dotenvx Secret Pattern

The workflow decrypts `.env` using `DOTENV_PRIVATE_KEY` (a GitHub secret) and extracts `GH_PAT_TOKEN` → `TF_VAR_GITHUB_TOKEN`:

```bash
pnpm dlx @dotenvx/dotenvx run -- sh -c '
  echo "TF_VAR_GITHUB_TOKEN=$GH_PAT_TOKEN" >> "$GITHUB_ENV"
'
```

The `.env` file at project root (encrypted) is committed. `DOTENV_PRIVATE_KEY` is the only secret needed in GitHub.

### File Structure After This Story

```
.github/
└── workflows/
    └── github-infra-deploy.yml     # NEW — adapted from lorenzogm

infra/github/src/
└── main.tf                         # UPDATED — add 2 outputs
```

### What NOT to Change

- `infra/github/src/variables.tf`, `providers.tf`, `config.json` — unchanged
- Do NOT create a separate Vercel deploy workflow in this story (out of scope)

### References

- [Source: /Users/lorenzogm/lorenzogm/lorenzogm/.github/workflows/github-infra-deploy.yml] — reference implementation to copy
- [Source: infra/github/src/main.tf] — add outputs here
- [Source: _bmad-output/implementation-artifacts/2-1-terraform-github-repository-infrastructure.md] — confirmed resource name is `github_branch_protection.protections`, not `.main`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
