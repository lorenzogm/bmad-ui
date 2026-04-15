---
storyId: '2-1'
storyTitle: 'Terraform GitHub Repository Infrastructure'
epicId: '2'
epicTitle: 'Infrastructure Provisioning via Terraform'
status: 'ready-for-dev'
created: '2026-04-15'
priority: 'high'
---

# Story 2.1: Terraform GitHub Repository Infrastructure

Status: ready-for-dev

## Story

As a maintainer,
I want the bmad-ui GitHub repository configuration managed as Terraform code,
so that repository settings, branch protections, and labels are reproducible and version-controlled.

## Acceptance Criteria

1. **Given** the Terraform config in the repo, **when** `terraform apply` is run, **then** it provisions or updates repository settings, branch protections, and labels without manual GitHub UI intervention
2. **Given** an existing GitHub repo, **when** `terraform import` is run for the repo resource, **then** the resource is successfully reconciled into managed Terraform state
3. **Given** the Terraform state, **when** reviewed, **then** it reflects current repository configuration as source of truth
4. Repository settings enforce: squash-merge only (no merge commits, no rebase), no discussions, auto-merge enabled, always suggest updating PR branches
5. `main` branch protection enforces: require conversation resolution before merging, linear history required, require deployments to succeed before merging

## Tasks / Subtasks

- [ ] Update `variables.tf` to add missing repository and branch protection fields (AC: #4, #5)
  - [ ] Add `allow_merge_commit`, `allow_rebase_merge`, `allow_auto_merge`, `allow_update_branch` to `repository` object type
  - [ ] Add `require_conversation_resolution`, `required_deployment_environments` to `branch_protections` list object type
- [ ] Update `main.tf` to wire new variables into `github_repository` and `github_branch_protection` resources (AC: #4, #5)
  - [ ] Add `allow_merge_commit`, `allow_rebase_merge`, `allow_auto_merge`, `allow_update_branch` attributes to `github_repository.main`
  - [ ] Add `require_conversation_resolution` to `github_branch_protection.protections`
  - [ ] Add `required_deployment_environments` to `github_branch_protection.protections`
- [ ] Update `config.json` with correct values for all new and existing settings (AC: #4, #5)
  - [ ] Set `has_discussions: false`, `allow_auto_merge: true`, `allow_update_branch: true`
  - [ ] Set `allow_merge_commit: false`, `allow_rebase_merge: false`
  - [ ] Set `require_conversation_resolution: true`, `require_linear_history: true`, `required_deployment_environments: ["production"]` for `main`
- [ ] Run `terraform plan` and verify no unintended drift (AC: #1, #3)
- [ ] Run `terraform apply` and confirm GitHub UI reflects settings (AC: #1)
- [ ] Verify `terraform state list` includes all resources (AC: #3)

## Dev Notes

### What This Story Is Doing

Story 1.2 already established the Terraform skeleton (`infra/github/src/`). This story **extends** that foundation by:
1. Adding missing GitHub repository settings fields to enforce squash-only merging, auto-merge, and PR-branch update suggestions
2. Adding missing branch protection fields to enforce conversation resolution, linear history, and deployment gates

**Do NOT recreate or restructure the Terraform files** — extend them surgically.

### Current State of `infra/github/src/`

```
infra/github/src/
├── providers.tf    # github provider ~> 6.2, reads GH_PAT_TOKEN + GITHUB_OWNER
├── variables.tf    # typed variable declarations
└── main.tf         # github_repository + github_branch_protection + github_issue_label
```

`config.json` (at `infra/github/src/config.json`) is the tfvars input — it is loaded via `terraform apply -var-file=config.json`.

### Exact Changes Required

#### `variables.tf` — `repository` object

Add these four fields to the `repository` object type:

```hcl
allow_merge_commit  = bool
allow_rebase_merge  = bool
allow_auto_merge    = bool
allow_update_branch = bool
```

#### `variables.tf` — `branch_protections` list object

Add these two fields to each branch protection object type:

```hcl
require_conversation_resolution = bool
required_deployment_environments = list(string)
```

#### `main.tf` — `github_repository.main` resource

Add these attributes (they map 1-to-1 to provider arguments):

```hcl
allow_merge_commit  = var.repository.allow_merge_commit
allow_rebase_merge  = var.repository.allow_rebase_merge
allow_auto_merge    = var.repository.allow_auto_merge
allow_update_branch = var.repository.allow_update_branch
```

#### `main.tf` — `github_branch_protection.protections` resource

Add `require_conversation_resolution` as a top-level argument:

```hcl
require_conversation_resolution = each.value.require_conversation_resolution
```

Add `required_deployment_environments` as a top-level argument (list of environment names):

```hcl
required_deployment_environments = each.value.required_deployment_environments
```

> **Provider note:** `required_deployment_environments` is a direct argument on `github_branch_protection` in provider `~> 6.2`. It accepts a `list(string)` of GitHub Environment names (e.g., `["production"]`). The environment must already exist in the repo. [Source: terraform-provider-github docs, `github_branch_protection`]

#### `config.json` — target values

```json
"repository": {
  "name": "bmad-ui",
  "description": "BMAd UI - Visual interface for agentic development workflows",
  "visibility": "public",
  "has_issues": true,
  "has_discussions": false,
  "default_branch": "main",
  "allow_squash_merge": true,
  "allow_merge_commit": false,
  "allow_rebase_merge": false,
  "allow_auto_merge": true,
  "allow_update_branch": true,
  "delete_branch_on_merge": true
},
"branch_protections": [
  {
    "branch_name": "main",
    "require_status_checks": true,
    "require_code_owner_reviews": false,
    "require_pull_request_reviews": false,
    "required_review_count": 0,
    "dismiss_stale_reviews": true,
    "require_linear_history": true,
    "require_conversation_resolution": true,
    "required_deployment_environments": ["production"]
  }
]
```

### GitHub Provider Reference (`~> 6.2`)

Relevant `github_repository` arguments:
- `allow_squash_merge` (bool) — already present
- `allow_merge_commit` (bool) — new
- `allow_rebase_merge` (bool) — new
- `allow_auto_merge` (bool) — enables auto-merge on eligible PRs
- `allow_update_branch` (bool) — surfaces "Update branch" button on PRs
- `has_discussions` (bool) — already present, set to `false`

Relevant `github_branch_protection` arguments:
- `required_linear_history` (bool) — already present in variable, set to `true`
- `require_conversation_resolution` (bool) — new
- `required_deployment_environments` (list of string) — new; GitHub Environment names

### Project Structure Notes

- All Terraform source files live in `infra/github/src/` — do not move or rename them
- `config.json` is the only file that changes at runtime per environment; keep it as the single source of values
- The `lifecycle { prevent_destroy = true }` block on `github_repository.main` must remain intact
- Terraform state is local (no remote backend yet); `terraform.tfstate` is gitignored

### How Terraform Is Run

```bash
cd infra/github/src
dotenvx run -- terraform init          # first time only
dotenvx run -- terraform plan -var-file=config.json
dotenvx run -- terraform apply -var-file=config.json
```

Credentials come from `.env` (encrypted via dotenvx): `GH_PAT_TOKEN` and `GITHUB_OWNER`.

### Prerequisite: GitHub `production` Environment

`required_deployment_environments = ["production"]` requires a GitHub Environment named `production` to exist in the repository before `terraform apply` will succeed. If it does not exist:

1. Create it manually in GitHub UI → Settings → Environments → New environment → `production`
2. Or check if a prior story/epic created it via Terraform (not yet — this is Epic 2 story 1)

**Safe fallback:** Set `required_deployment_environments: []` for initial apply, then add `["production"]` once the environment is created in Story 2.2 or 2.3.

### References

- [Source: infra/github/src/main.tf] — existing `github_repository` and `github_branch_protection` resources
- [Source: infra/github/src/variables.tf] — existing variable type definitions
- [Source: infra/github/src/config.json] — current values (baseline to diff against)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1] — acceptance criteria
- [Source: _bmad-output/implementation-artifacts/1-2-setup-github-infrastructure-with-terraform.md] — prior terraform setup story

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
