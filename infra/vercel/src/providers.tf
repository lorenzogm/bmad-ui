terraform {
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "4.7.1"
    }
  }
}

provider "vercel" {
  api_token = var.VERCEL_TOKEN
}
