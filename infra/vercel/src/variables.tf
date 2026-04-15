variable "ENVIRONMENT" {
  type = string
}

variable "environment_variables" {
  type    = map(string)
  default = {}
}

variable "vercel" {
  type = object({
    project = object({
      name                       = string
      root_directory             = optional(string)
      build_command              = string
      framework                  = optional(string)
      public_source              = bool
      output_directory           = optional(string)
      install_command            = optional(string)
      auto_assign_custom_domains = bool
      vercel_authentication = object({
        deployment_type = string
      })
    })
    project_domains = optional(list(object({
      domain   = string
      redirect = optional(string)
    })), [])
  })
}

##############
### VERCEL ###
##############
variable "VERCEL_TOKEN" {
  type = string
}
variable "VERCEL_ORG_ID" {
  type    = string
  default = ""
}
