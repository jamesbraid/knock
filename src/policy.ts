import Cloudflare from 'cloudflare';

export interface Env {
  IP_ALLOWLIST: KVNamespace;
  CF_API_TOKEN: string;
  CF_ACCOUNT_ID: string;
  BYPASS_POLICY_ID: string;
}

export async function syncPolicy(env: Env): Promise<void> {
  const allKeys: KVNamespaceListKey<unknown>[] = [];
  let cursor: string | undefined;
  do {
    const result = await env.IP_ALLOWLIST.list({ prefix: 'ip:', cursor });
    allKeys.push(...result.keys);
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor !== undefined);
  const ips = allKeys.map((k) => k.name.slice(3)); // strip 'ip:' prefix

  const include =
    ips.length > 0
      ? ips.map((ip) => ({ ip: { ip: ip.includes('/') ? ip : `${ip}/32` } }))
      : [{ ip: { ip: '0.0.0.0/32' } }]; // inert placeholder — CF rejects empty include

  const cf = new Cloudflare({ apiToken: env.CF_API_TOKEN });
  await cf.zeroTrust.access.policies.update(env.BYPASS_POLICY_ID, {
    account_id: env.CF_ACCOUNT_ID,
    name: 'IP Bypass - Dynamic',
    decision: 'bypass',
    include,
  });
}
