terraform {
  required_version = ">= 1.4.0"

  required_providers {
    github = {
      source  = "integrations/github"
      version = "~> 6.2"
    }
  }
}

variable "GH_PAT_TOKEN" {
  description = "GitHub Personal Access Token with repository admin permissions"
  type        = string
  sensitive   = true
}

variable "GITHUB_OWNER" {
  description = "GitHub owner login (user or organization)"
  type        = string
}

provider "github" {
  token = var.GH_PAT_TOKEN
  owner = var.GITHUB_OWNER
}
