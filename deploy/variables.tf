variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID that owns the Zero Trust org and the Worker."
}

variable "knock_hostname" {
  type        = string
  description = "Hostname the knock Worker serves, e.g. knock.example.com."
}

variable "admin_emails" {
  type        = list(string)
  description = "Emails allowed to knock (authenticate via Cloudflare One-Time PIN)."
}
