variable "ENVIRONMENT" {
  description = "Deployment environment (development, staging, production)"
  type        = string
  default     = "development"
}

variable "repository" {
  description = "GitHub repository configuration"
  type = object({
    name                   = string
    description            = string
    visibility             = string
    has_issues             = bool
    has_discussions        = bool
    default_branch         = string
    allow_squash_merge     = bool
    allow_merge_commit     = bool
    allow_rebase_merge     = bool
    allow_auto_merge       = bool
    allow_update_branch    = bool
    delete_branch_on_merge = bool
  })
}

variable "branch_protections" {
  description = "Branch protection rules to create"
  type = list(object({
    branch_name                          = string
    require_status_checks                = bool
    required_status_check_contexts       = list(string)
    require_code_owner_reviews           = bool
    require_pull_request_reviews         = bool
    required_review_count                = number
    dismiss_stale_reviews                = bool
    require_linear_history               = bool
    require_conversation_resolution      = bool
  }))
  default = []
}

variable "labels" {
  description = "Issue labels to create in the repository"
  type = list(object({
    name        = string
    description = string
    color       = string
  }))
  default = []
}

variable "topics" {
  description = "Repository topics/tags for discoverability"
  type        = list(string)
  default     = []
}
