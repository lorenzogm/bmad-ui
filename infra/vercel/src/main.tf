locals {
  environments = {
    "development" = "dev"
    "production"  = "prod"
  }
  environment_short_code = lookup(local.environments, lower(var.ENVIRONMENT), "")
}

resource "vercel_project" "main" {
  name                       = "${var.vercel.project.name}-${local.environment_short_code}"
  output_directory           = var.vercel.project.output_directory
  build_command              = var.vercel.project.build_command
  root_directory             = var.vercel.project.root_directory
  framework                  = var.vercel.project.framework
  public_source              = var.vercel.project.public_source
  install_command            = var.vercel.project.install_command
  auto_assign_custom_domains = var.vercel.project.auto_assign_custom_domains
  vercel_authentication      = var.vercel.project.vercel_authentication
}

resource "vercel_project_domain" "primary" {
  for_each   = { for d in var.vercel.project_domains : d.domain => d if d.redirect == null }
  project_id = vercel_project.main.id
  domain     = each.value.domain
}

resource "vercel_project_domain" "redirect" {
  for_each   = { for d in var.vercel.project_domains : d.domain => d if d.redirect != null }
  project_id = vercel_project.main.id
  domain     = each.value.domain
  redirect   = each.value.redirect

  depends_on = [vercel_project_domain.primary]
}

resource "vercel_project_environment_variable" "variables" {
  for_each   = var.environment_variables
  project_id = vercel_project.main.id
  key        = each.key
  value      = each.value
  target     = ["development", "preview", "production"]
}

output "BMAD_UI_VERCEL_PROJECT_ID" {
  description = "The Vercel project ID for bmad-ui"
  value       = vercel_project.main.id
  sensitive   = false
}
