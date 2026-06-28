# knock

A small Cloudflare Worker that gates access to CF-Access-protected services by
dynamically updating a reusable CF Access bypass policy with the caller's IP.

Useful when you want a CF Access app accessible via a long-lived OIDC login on
your own browsers, plus a knock-style "tap to unlock" flow for clients (apps,
scripts, mobile shortcuts) that cannot do OIDC.

## How it works

1. Client `POST`s `/register` against the Worker.
2. Worker reads the caller's IP (`CF-Connecting-IP`) and optionally additional
   IPs from a JSON body (see [Dual-stack callers](#dual-stack-callers)).
3. Worker stores each IP in KV with a 24h TTL.
4. Worker reads all live IPs from KV and PATCHes them into the configured CF
   Access bypass policy's `include` rules.
5. An hourly cron re-sync resolves drift between Worker writes and policy state.

`DELETE /register` removes IPs the same way.

## Required Cloudflare resources

You provision these in your own account (Tofu, Terraform, wrangler, dashboard
— your call):

- A KV namespace bound as `IP_ALLOWLIST` in `wrangler.toml`
- A Cloudflare Access "Reusable Policy" with `decision = bypass` whose `include`
  list this Worker rewrites
- A CF API token with Zero Trust Edit scope (passed as the `CF_API_TOKEN` secret)

## Dual-stack callers

A single `POST /register` only allowlists ONE IP — the address CF saw the
request come from. On a dual-stack network where your IPv4 and IPv6 egress
differ (most home ISPs, mobile networks), a follow-up request to a
CF-Access-gated app may go over the OTHER family and get blocked.

**Single call with `extra_ips`** (recommended):

```bash
V4=$(curl -4 -s --max-time 3 ifconfig.me)
V6=$(curl -6 -s --max-time 3 ifconfig.me)
BODY=$(jq -nc --arg v4 "$V4" --arg v6 "$V6" '{extra_ips: [$v4, $v6] | map(select(. != ""))}')
cloudflared access curl https://knock.example.com/register \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$BODY"
```

The Worker dedupes against `CF-Connecting-IP`, validates basic IP shape, and
caps `extra_ips` at 10 entries. Invalid strings are silently dropped.

**Two calls, one per family** (works without `jq`):

```bash
cloudflared access curl -4 https://knock.example.com/register -X POST
cloudflared access curl -6 https://knock.example.com/register -X POST 2>/dev/null
```

## Deployment

`wrangler.toml` has a placeholder `REPLACE_KV_NAMESPACE_ID` that your deploy
harness substitutes before `wrangler deploy`:

```bash
KV_ID="<your-kv-namespace-id>"
BYPASS_ID="<your-access-bypass-policy-id>"

sed -i.bak "s/REPLACE_KV_NAMESPACE_ID/${KV_ID}/" wrangler.toml
npx wrangler deploy

printf '%s' "$CF_API_TOKEN_VALUE" | npx wrangler secret put CF_API_TOKEN
printf '%s' "$CF_ACCOUNT_ID"      | npx wrangler secret put CF_ACCOUNT_ID
printf '%s' "$BYPASS_ID"          | npx wrangler secret put BYPASS_POLICY_ID
```

## Local development

```bash
npm ci
npm test                         # vitest unit tests
npx wrangler dev                 # local Worker preview
npx wrangler deploy --dry-run    # verify it builds
```

## Roadmap

- **Companion client**: a small cross-platform CLI that detects the caller's
  reachable IP families, formats the `extra_ips` body, handles CF Access auth,
  and prints which IPs were registered.
- **Allow CIDR ranges in `extra_ips`**: useful for "allow my whole home /64".

## Contributing

This GitHub repo is a public mirror of a repo I develop privately. Issues are
welcome here. PRs are too, but heads-up: the mirror is one-way, so I port
accepted changes by hand and the merge happens upstream — expect a little delay.

## License

MIT — see [LICENSE](LICENSE).
