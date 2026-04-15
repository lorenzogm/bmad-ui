terraform {
  required_version = ">= 1.4.0"

  required_providers {
    github = {
      source  = "integrations/github"
      version = "~> 6.2"
    }
  }
}

provider "github" {
  # Credentials are read from environment variables:
  #   GITHUB_TOKEN  — Personal Access Token with repo/admin permissions
  #   GITHUB_OWNER  — Repository owner login (e.g. lorenzogm)
  #
  # Load via dotenvx:
  #   dotenvx run -- terraform <command> -var-file="../config.json"
}
