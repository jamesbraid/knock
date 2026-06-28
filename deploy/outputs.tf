output "kv_namespace_id" {
  value       = cloudflare_workers_kv_namespace.ip_allowlist.id
  description = "Bind as IP_ALLOWLIST in wrangler.toml (replaces REPLACE_KV_NAMESPACE_ID)."
}

output "bypass_policy_id" {
  value       = cloudflare_zero_trust_access_policy.ip_bypass.id
  description = "Set as the Worker's BYPASS_POLICY_ID secret."
}
