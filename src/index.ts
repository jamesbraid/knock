import { syncPolicy, type Env } from './policy';

const MAX_EXTRA_IPS = 10;

function isPlausibleIp(s: unknown): s is string {
  if (typeof s !== 'string' || s.length === 0 || s.length > 45) return false;
  // Permissive check: hex / colons / dots only, must look v4-ish or v6-ish.
  // CF validates the IP server-side when we PATCH the bypass policy.
  return /^[0-9a-fA-F:.]+$/.test(s) && (s.includes('.') || s.includes(':'));
}

async function collectIps(request: Request): Promise<{ ips: string[] } | { error: string }> {
  const cfIp = request.headers.get('CF-Connecting-IP');
  const ips = new Set<string>();
  if (cfIp && isPlausibleIp(cfIp)) ips.add(cfIp);

  const ct = request.headers.get('Content-Type') ?? '';
  if (ct.includes('application/json')) {
    let body: { extra_ips?: unknown };
    try {
      body = (await request.json()) as { extra_ips?: unknown };
    } catch {
      return { error: 'Invalid JSON body' };
    }
    const extras = Array.isArray(body.extra_ips) ? body.extra_ips : [];
    if (extras.length > MAX_EXTRA_IPS) {
      return { error: `Too many extra_ips (max ${MAX_EXTRA_IPS})` };
    }
    for (const e of extras) {
      if (isPlausibleIp(e)) ips.add(e);
    }
  }

  if (ips.size === 0) {
    return { error: 'Missing CF-Connecting-IP and no valid extra_ips' };
  }
  return { ips: [...ips] };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { method, url } = request;
    const { pathname } = new URL(url);

    if ((method === 'POST' || method === 'DELETE') && pathname === '/register') {
      const result = await collectIps(request);
      if ('error' in result) {
        return new Response(`${result.error}\n`, { status: 400 });
      }
      const { ips } = result;
      const isPost = method === 'POST';

      for (const ip of ips) {
        if (isPost) {
          await env.IP_ALLOWLIST.put(`ip:${ip}`, new Date().toISOString(), {
            expirationTtl: 86400,
          });
        } else {
          await env.IP_ALLOWLIST.delete(`ip:${ip}`);
        }
      }

      const verb = isPost ? 'Registered' : 'Unregistered';
      const suffix = isPost ? ' for 24h' : '';
      const list = ips.join(', ');

      try {
        await syncPolicy(env);
      } catch {
        return new Response(
          `${verb} ${list}${suffix} (policy sync pending — active within 1h)\n`,
          { status: 200 },
        );
      }
      return new Response(`${verb} ${list}${suffix}\n`, { status: 200 });
    }

    return new Response('Not found\n', { status: 404 });
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    await syncPolicy(env);
  },
};
