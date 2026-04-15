# ─────────────────────────────────────────────────────────────────────────────
# Repository
# ─────────────────────────────────────────────────────────────────────────────

resource "github_repository" "main" {
  name                   = var.repository.name
  description            = var.repository.description
  visibility             = var.repository.visibility
  has_issues             = var.repository.has_issues
  has_discussions        = var.repository.has_discussions
  allow_squash_merge     = var.repository.allow_squash_merge
  allow_merge_commit     = var.repository.allow_merge_commit
  allow_rebase_merge     = var.repository.allow_rebase_merge
  allow_auto_merge       = var.repository.allow_auto_merge
  allow_update_branch    = var.repository.allow_update_branch
  delete_branch_on_merge = var.repository.delete_branch_on_merge
  topics                 = var.topics

  # Enable Dependabot vulnerability alerts
  vulnerability_alerts = true

  lifecycle {
    # Prevent accidental deletion via `terraform destroy`
    prevent_destroy = true

    # Ignore fields managed outside of Terraform (e.g., auto_init, template)
    ignore_changes = [auto_init]
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# Branch Protection Rules
# ─────────────────────────────────────────────────────────────────────────────

resource "github_branch_protection" "protections" {
  for_each = { for bp in var.branch_protections : bp.branch_name => bp }

  repository_id = github_repository.main.node_id
  pattern       = each.value.branch_name

  # Allow repository admins to bypass restrictions (maintainer can force-push)
  enforce_admins = false

  allows_force_pushes    = false
  allows_deletions       = false
  require_signed_commits = false

  dynamic "required_status_checks" {
    for_each = each.value.require_status_checks ? [1] : []

    content {
      strict = true
      # Context names are populated automatically after CI workflows run at
      # least once; leave empty for initial setup.
      contexts = []
    }
  }

  dynamic "required_pull_request_reviews" {
    for_each = each.value.require_pull_request_reviews ? [1] : []

    content {
      required_approving_review_count = each.value.required_review_count
      dismiss_stale_reviews           = each.value.dismiss_stale_reviews
      require_code_owner_reviews      = each.value.require_code_owner_reviews
    }
  }

  required_linear_history              = each.value.require_linear_history
  require_conversation_resolution      = each.value.require_conversation_resolution
}

# ─────────────────────────────────────────────────────────────────────────────
# Issue Labels
# ─────────────────────────────────────────────────────────────────────────────

resource "github_issue_label" "labels" {
  for_each = { for label in var.labels : label.name => label }

  repository  = github_repository.main.name
  name        = each.key
  color       = each.value.color
  description = each.value.description
}
