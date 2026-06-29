terraform {
  required_version = ">= 1.6"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5"
    }
  }
}

# Auth via the CLOUDFLARE_API_TOKEN env var — never hard-code a token here.
provider "cloudflare" {}
