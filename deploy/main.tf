# KV namespace the Worker reads/writes allowlisted IPs into.
resource "cloudflare_workers_kv_namespace" "ip_allowlist" {
  account_id = var.cloudflare_account_id
  title      = "knock_ip_allowlist"
}

# Reusable bypass policy — the Worker owns `include`; Tofu owns existence/decision.
resource "cloudflare_zero_trust_access_policy" "ip_bypass" {
  account_id = var.cloudflare_account_id
  name       = "knock IP bypass (dynamic)"
  decision   = "bypass"
  include = [{
    ip = { ip = "0.0.0.0/32" }
  }]
  lifecycle {
    ignore_changes = [include]
  }
}

# Who may knock — an email allowlist. Auth uses the account's default login
# methods (Cloudflare One-Time PIN / Cloudflare IdP); no external IdP needed.
resource "cloudflare_zero_trust_access_policy" "knock_admin" {
  account_id = var.cloudflare_account_id
  name       = "knock admins"
  decision   = "allow"
  include    = [for e in var.admin_emails : { email = { email = e } }]
}

# The knock Access application. allowed_idps intentionally omitted → default
# login methods (One-Time PIN works with zero IdP setup).
resource "cloudflare_zero_trust_access_application" "knock" {
  account_id       = var.cloudflare_account_id
  name             = "knock"
  domain           = var.knock_hostname
  type             = "self_hosted"
  session_duration = "24h"
  policies         = [{ id = cloudflare_zero_trust_access_policy.knock_admin.id }]
}
