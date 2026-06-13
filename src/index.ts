import { syncPolicy, type Env } from './policy';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { method, url } = request;
    const { pathname } = new URL(url);

    if (method === 'POST' && pathname === '/register') {
      const ip = request.headers.get('CF-Connecting-IP');
      if (!ip) {
        return new Response('Missing CF-Connecting-IP\n', { status: 400 });
      }
      await env.IP_ALLOWLIST.put(`ip:${ip}`, new Date().toISOString(), {
        expirationTtl: 86400,
      });
      try {
        await syncPolicy(env);
      } catch {
        return new Response(`Registered ${ip} for 24h (policy sync pending — active within 1h)\n`, { status: 200 });
      }
      return new Response(`Registered ${ip} for 24h\n`, { status: 200 });
    }

    if (method === 'DELETE' && pathname === '/register') {
      const ip = request.headers.get('CF-Connecting-IP');
      if (!ip) {
        return new Response('Missing CF-Connecting-IP\n', { status: 400 });
      }
      await env.IP_ALLOWLIST.delete(`ip:${ip}`);
      try {
        await syncPolicy(env);
      } catch {
        return new Response(`Unregistered ${ip} (policy sync pending — active within 1h)\n`, { status: 200 });
      }
      return new Response(`Unregistered ${ip}\n`, { status: 200 });
    }

    return new Response('Not found\n', { status: 404 });
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    await syncPolicy(env);
  },
};
