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
    delete_branch_on_merge = bool
  })
}

variable "branch_protections" {
  description = "Branch protection rules to create"
  type = list(object({
    branch_name                  = string
    require_status_checks        = bool
    require_code_owner_reviews   = bool
    require_pull_request_reviews = bool
    required_review_count        = number
    dismiss_stale_reviews        = bool
    require_linear_history       = bool
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
