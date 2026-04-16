# Story 4.2: Enforce Protected Branch Quality Gates

Status: ready-for-dev

## Story

As a maintainer,
I want required status checks enforced on the `main` branch protection,
so that only pull requests that pass CI validation can be merged.

## Acceptance Criteria

1. **Given** branch protection settings, **When** a pull request to `main` has a failing CI check, **Then** merge is blocked until the check passes.

2. **Given** required checks are configured, **When** a contributor submits a pull request, **Then** the same CI validation gate applies regardless of who opened the PR.

3. **Given** protection rules are reviewed, **When** audited via GitHub UI or Terraform state, **Then** required check contexts are explicitly named (not empty) and tied to CI workflow job(s) from story 4.1.

## Tasks / Subtasks

- [ ] Identify exact required-check context string(s) from the CI workflow created in story 4.1 (AC: #3)
  - [ ] Run the CI workflow once on a PR (or via `workflow_dispatch`) to let GitHub register the check context
  - [ ] Verify the context name in GitHub → Settings → Branches → Edit `main` protection rule → "Status checks that are required"
  - [ ] Expected format: `<workflow-name> / <job-name>` (e.g., `CI / validate`)
- [ ] Update `infra/github/src/variables.tf`: add `required_status_check_contexts` field to `branch_protections` type (AC: #1, #3)
  - [ ] Field type: `list(string)`, defaults to `[]`
- [ ] Update `infra/github/src/main.tf`: use `each.value.required_status_check_contexts` for `contexts` instead of hardcoded `[]` (AC: #1, #3)
- [ ] Update `infra/github/src/config.json`: add `required_status_check_contexts` array with the CI job context string to the `main` branch protection entry (AC: #1, #2, #3)
- [ ] Trigger Terraform deploy via `workflow_dispatch` on `deploy.yml` to apply the updated branch protection (AC: #1)
- [ ] Verify in GitHub that merge is blocked on a PR with a failing check (AC: #1, #2)

## Dev Notes

### Dependency on Story 4.1

**This story requires that story 4.1's CI workflow (`.github/workflows/ci.yml`) exists and has run at least once** so GitHub has registered the check context name. Do not start Terraform changes until you know the exact context string.

To discover the context string:
1. Story 4.1 must be complete (CI workflow file committed to `main`)
2. Open a test PR or run the CI workflow via `workflow_dispatch`
3. Check GitHub → Settings → Branches → Edit main rule → "Status checks" search box
4. The registered context will appear — typically `<workflow name> / <job name>`

If story 4.1's workflow has `name: CI` and a job `validate`, the context string is `CI / validate`.

### Current Terraform State (Baseline)

**File**: `infra/github/src/main.tf`

The `github_branch_protection` resource already exists for `main`:
```hcl
dynamic "required_status_checks" {
  for_each = each.value.require_status_checks ? [1] : []

  content {
    strict = true
    contexts = []   # ← THIS IS THE GAP: must be populated with CI job context
  }
}
```

`infra/github/src/config.json` already has:
```json
"branch_protections": [
  {
    "branch_name": "main",
    "require_status_checks": true,
    ...
  }
]
```

With `contexts = []`, GitHub allows merging regardless of check results — the protection rule exists but enforces nothing specific. Story 4.2 fills this gap.

### Required Changes

#### 1. `infra/github/src/variables.tf`

Add `required_status_check_contexts` to the `branch_protections` object type:

```hcl
variable "branch_protections" {
  description = "Branch protection rules to create"
  type = list(object({
    branch_name                          = string
    require_status_checks                = bool
    required_status_check_contexts       = list(string)   # ADD THIS
    require_code_owner_reviews           = bool
    require_pull_request_reviews         = bool
    required_review_count                = number
    dismiss_stale_reviews                = bool
    require_linear_history               = bool
    require_conversation_resolution      = bool
  }))
  default = []
}
```

#### 2. `infra/github/src/main.tf`

Replace hardcoded `contexts = []` with the variable value:

```hcl
dynamic "required_status_checks" {
  for_each = each.value.require_status_checks ? [1] : []

  content {
    strict   = true
    contexts = each.value.required_status_check_contexts
  }
}
```

#### 3. `infra/github/src/config.json`

Add the `required_status_check_contexts` field to the `main` branch protection entry. Replace `<CI_JOB_CONTEXT>` with the actual context name discovered from step above (e.g., `"CI / validate"`):

```json
"branch_protections": [
  {
    "branch_name": "main",
    "require_status_checks": true,
    "required_status_check_contexts": ["<CI_JOB_CONTEXT>"],
    "require_code_owner_reviews": false,
    "require_pull_request_reviews": false,
    "required_review_count": 0,
    "dismiss_stale_reviews": true,
    "require_linear_history": true,
    "require_conversation_resolution": true
  }
]
```

### Terraform Deploy Mechanism

Changes are applied via the existing `deploy.yml` workflow — no separate Terraform workflow needed:

1. Commit the three file changes to `main`
2. The `deploy.yml` push-to-main trigger will execute `infra-deploy` job (since `infra/` files changed)
3. It runs `terraform plan` then `terraform apply` with `--frozen-lockfile` equivalent (`terraform apply -auto-approve`)
4. The `github_branch_protection` resource will be updated in-place (Terraform detects the `contexts` diff)

Alternatively, trigger manually: GitHub Actions → `bmad-ui-deploy` → Run workflow → `development`.

### GitHub API Context String Format

GitHub required status check contexts follow these patterns:
- **GitHub Actions**: `<workflow display name> / <job id>` — where `workflow display name` = the `name:` field in the YAML, `job id` = the key under `jobs:`
- **Example**: workflow `name: CI`, job key `validate` → context = `CI / validate`
- **Note**: if the workflow YAML has no `name:` field, the filename is used (e.g., `ci.yml` → `ci`)

The exact string must match what GitHub registers. Case-sensitive. Use the GitHub UI "required status checks" search to confirm before committing to config.json.

### What NOT to Change

- Do **not** modify `deploy.yml` — it already handles Terraform apply for `infra/` changes
- Do **not** touch `infra/vercel/` — this story is GitHub-only
- Do **not** add `enforce_admins = true` — the architecture decision explicitly keeps `enforce_admins = false` to allow maintainer direct pushes [Source: infra/github/src/main.tf]
- Do **not** add `require_pull_request_reviews` — already `false` by design (maintainer-only repo)

### Architecture Constraints

- GitHub Actions is the authoritative CI enforcement layer [Source: architecture.md — Decision Priority Analysis]
- Protected branches and required status checks are the security boundary that enforces this [Source: architecture.md — Security & Observability]
- Terraform is the single source of truth for all GitHub repository infrastructure — never configure branch protections via GitHub UI [Source: architecture.md]
- pnpm is the mandatory package manager — Terraform variables use standard `list(string)` (no pnpm implications here, but do not introduce npm/yarn in any adjacent scripts)

### Project Structure Notes

- All changes are in `infra/github/src/` — three files: `variables.tf`, `main.tf`, `config.json`
- No frontend source files (`_bmad-custom/bmad-ui/`) are touched
- No workflow YAML files are created (the deploy is handled by the existing `deploy.yml`)
- Terraform state is managed by the `deploy.yml` workflow's state branch mechanism — no manual state manipulation

### References

- Terraform branch protection baseline: `infra/github/src/main.tf#github_branch_protection`
- Branch protection config: `infra/github/src/config.json#branch_protections`
- Variable type definition: `infra/github/src/variables.tf#branch_protections`
- FR17 (enforce quality gates before protected branch merges): [Source: epics.md#Epic-4]
- NFR7 (branch protection enforces required checks before merge): [Source: epics.md#NFRs]
- NFR13 (required quality checks must pass before protected branch integration): [Source: epics.md#NFRs]
- CI workflow to be created in story 4.1: `.github/workflows/ci.yml` [Source: 4-1-create-ci-validation-workflow.md]
- Architecture decision "Use GitHub Actions as the authoritative CI gate before protected branch merges": [Source: architecture.md#Decision-Priority-Analysis]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Debug Log References

### Completion Notes List

### File List
