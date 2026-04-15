---
storyId: '1-3'
storyTitle: 'Define Issue Labels for Triage'
epicId: '1'
epicTitle: 'Open-Source Repository Governance & Publication'
status: 'done'
created: '2026-04-15'
priority: 'high'
---

# Story 1.3: Define Issue Labels for Triage

## Story Statement

**As a** maintainer,  
**I want** a standard set of issue labels defined in the repository,  
**So that** issues and PRs can be triaged consistently.

---

## Acceptance Criteria

### Core Labels Exist

- ✅ **Given** the repository labels,
  **When** listing them,
  **Then** labels exist for: `bug`, `enhancement`, `documentation`, `good first issue`, `help wanted`, `question`, `wontfix`

### Labels Have Description and Distinct Color

- ✅ **Given** each label,
  **When** viewed,
  **Then** it has a distinct color and a short description

### Labels Immediately Available to Contributors

- ✅ **Given** the labels,
  **When** a new contributor opens an issue,
  **Then** labels are immediately available to apply

---

## Tasks & Subtasks

- [x] Define label schema and naming conventions
  - [x] Document required label categories (type, status, priority)
  - [x] Determine label names, colors, and descriptions (see schema below)
- [x] Add label resources to Terraform infrastructure
  - [x] Update `infra/github/src/main.tf` with GitHub label resources
  - [x] Define all seven labels: bug, enhancement, documentation, good first issue, help wanted, question, wontfix
  - [x] Configure each label with correct name, color, and description
- [x] Apply Terraform changes
  - [x] Run `terraform init` if not already done
  - [x] Run `terraform plan` to verify label resources will be created
  - [x] Run `terraform apply` to create labels in GitHub repository
- [x] Verify labels in GitHub repository
  - [x] Confirm all labels appear in repository labels page
  - [x] Verify each label has correct color and description
  - [x] Test: Create a test issue and verify labels can be applied
  - [x] Test: Verify labels display correctly on issues and PRs

### Review Findings

- [x] [Review][Patch] Update stale Terraform path references to `infra/github/src/main.tf` — fixed
- [x] [Review][Patch] Clarify the File List section so it does not read like `infra/github/src/*.tf` files were modified in the review-status commit — fixed

---

## Dev Notes

### Label Definition Schema

Based on common open-source practices and bmad-ui requirements, define these labels in Terraform:

| Label | Color Hex | Description |
|-------|-----------|-------------|
| `bug` | `d73a49` | Indicates an unexpected problem or unintended behavior |
| `enhancement` | `a2eeef` | Indicates new feature or request |
| `documentation` | `0075ca` | Indicates improvements or additions to documentation |
| `good first issue` | `7057ff` | Good for newcomers seeking contribution opportunities |
| `help wanted` | `008672` | Indicates the maintainer would like community input |
| `question` | `d876e3` | Indicates this issue is a question or needs discussion |
| `wontfix` | `cccccc` | Indicates this will not be worked on |

**Rationale:** This schema follows GitHub's default labels with distinct, accessible colors. All seven labels are required by acceptance criteria.

### Implementation Approach: Terraform Required

This story **MUST** use Terraform to create labels. This aligns with Phase 1 goals of infrastructure-as-code and ensures labels are versioned and reproducible.

**Terraform Implementation Pattern:**

Add label resources to `infra/github/src/main.tf` following the pattern from Story 1-2 (GitHub repository infrastructure):

```hcl
resource "github_issue_label" "bug" {
  repository  = github_repository.main.name
  name        = "bug"
  color       = "d73a49"
  description = "Indicates an unexpected problem or unintended behavior"
}

resource "github_issue_label" "enhancement" {
  repository  = github_repository.main.name
  name        = "enhancement"
  color       = "a2eeef"
  description = "Indicates new feature or request"
}

resource "github_issue_label" "documentation" {
  repository  = github_repository.main.name
  name        = "documentation"
  color       = "0075ca"
  description = "Indicates improvements or additions to documentation"
}

resource "github_issue_label" "good_first_issue" {
  repository  = github_repository.main.name
  name        = "good first issue"
  color       = "7057ff"
  description = "Good for newcomers seeking contribution opportunities"
}

resource "github_issue_label" "help_wanted" {
  repository  = github_repository.main.name
  name        = "help wanted"
  color       = "008672"
  description = "Indicates the maintainer would like community input"
}

resource "github_issue_label" "question" {
  repository  = github_repository.main.name
  name        = "question"
  color       = "d876e3"
  description = "Indicates this issue is a question or needs discussion"
}

resource "github_issue_label" "wontfix" {
  repository  = github_repository.main.name
  name        = "wontfix"
  color       = "cccccc"
  description = "Indicates this will not be worked on"
}
```

**Workflow:**

1. Add above resources to `infra/github/src/main.tf` (or split into separate label file if preferred)
2. Run `terraform init` (if not already done)
3. Run `terraform plan` to preview label creation
4. Run `terraform apply` to create labels in GitHub repository
5. Verify in GitHub UI that all labels appear with correct colors and descriptions

**Dependency Note:** This story should coordinate with Story 1-2 (Terraform GitHub infrastructure setup). If Story 1-2 infrastructure is not yet in place:
- Ensure `github_repository.main` resource exists in `infra/github/src/main.tf` before applying these label resources
- Both stories contribute to the same Terraform module; they may be implemented in sequence or together

### Project Structure

- **Storage Location:** Labels are created via Terraform infrastructure-as-code, stored in GitHub repository settings
- **Configuration Location:** Label definitions are in `infra/github/src/main.tf` as Terraform `github_issue_label` resources
- **No Code Changes:** This story modifies infrastructure configuration only, not the application codebase

### File Locations to Modify

- **Required:**
  - `infra/github/src/main.tf` — Add all seven `github_issue_label` resources
  
- **Optional (if organizing by concern):**
  - `infra/github/src/labels.tf` — Create separate file for label resources (cleaner organization)

### References

- **Acceptance Criteria Source:** [Epic 1, Story 1.3](../planning-artifacts/epics.md#story-13-define-issue-labels-for-triage)
- **Related Story:** [Story 1-2: Setup GitHub Infrastructure with Terraform](1-2-setup-github-infrastructure-with-terraform.md) — may provide Terraform infrastructure context
- **Project PRD:** [Phase 1: Infrastructure Setup](../planning-artifacts/prd.md)

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4.6

### Completion Notes

- All 7 required labels already exist in GitHub via Terraform (applied in prior session)
- Verified via `gh label list`: bug, enhancement, documentation, good first issue, help wanted, question, wontfix — all present with correct hex colors and descriptions
- Terraform state (`terraform.tfstate`) confirms all `github_issue_label` resources are managed by Terraform
- Infrastructure code: `infra/github/src/main.tf` uses `for_each` over `var.labels`; label definitions in `infra/github/src/config.json`
- No code changes needed — infrastructure was already applied

### File List

- **Referenced (already present):** `infra/github/src/main.tf` — `github_issue_label.labels` resource exists
- **Referenced (already present):** `infra/github/src/config.json` — all 7 labels defined
- **Referenced (already present):** `infra/github/src/variables.tf` — `labels` variable definition exists
- **Modified:** `_bmad-output/implementation-artifacts/1-3-define-issue-labels-for-triage.md` — status and review findings updated

### Change Log

- 2026-04-15: Verified all 7 labels live in GitHub repository; Terraform state confirms IaC management; story marked review
- 2026-04-15: Resolved code review findings (path consistency and file list clarity); story marked done
