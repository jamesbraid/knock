import { describe, it, expect, vi, type MockedFunction } from 'vitest';
import { SELF } from 'cloudflare:test';
import { syncPolicy } from '../src/policy';
import type { Env } from '../src/policy';
import worker from '../src/index';

vi.mock('../src/policy', () => ({
  syncPolicy: vi.fn().mockResolvedValue(undefined),
}));

const mockSyncPolicy = syncPolicy as MockedFunction<typeof syncPolicy>;

const URL_REGISTER = 'https://knock.example.com/register';

describe('POST /register', () => {
  it('registers CF-Connecting-IP when no body is provided', async () => {
    const res = await SELF.fetch(URL_REGISTER, {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '1.2.3.4' },
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Registered 1.2.3.4');
  });

  it('returns 400 when neither header nor body provide an IP', async () => {
    const res = await SELF.fetch(URL_REGISTER, { method: 'POST' });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('CF-Connecting-IP');
  });

  it('registers extra_ips alongside CF-Connecting-IP (dual-stack)', async () => {
    const res = await SELF.fetch(URL_REGISTER, {
      method: 'POST',
      headers: {
        'CF-Connecting-IP': '1.2.3.4',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ extra_ips: ['2001:db8::1'] }),
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('1.2.3.4');
    expect(body).toContain('2001:db8::1');
  });

  it('registers extra_ips even when CF-Connecting-IP is absent', async () => {
    const res = await SELF.fetch(URL_REGISTER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extra_ips: ['5.6.7.8'] }),
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('5.6.7.8');
  });

  it('deduplicates CF-Connecting-IP with extra_ips', async () => {
    const res = await SELF.fetch(URL_REGISTER, {
      method: 'POST',
      headers: {
        'CF-Connecting-IP': '1.2.3.4',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ extra_ips: ['1.2.3.4', '2001:db8::1'] }),
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body.match(/1\.2\.3\.4/g)?.length).toBe(1);
    expect(body).toContain('2001:db8::1');
  });

  it('drops invalid IP strings silently in extra_ips', async () => {
    const res = await SELF.fetch(URL_REGISTER, {
      method: 'POST',
      headers: {
        'CF-Connecting-IP': '1.2.3.4',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ extra_ips: ['not-an-ip', '<script>', '2001:db8::1'] }),
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('1.2.3.4');
    expect(body).toContain('2001:db8::1');
    expect(body).not.toContain('not-an-ip');
    expect(body).not.toContain('script');
  });

  it('rejects too many extra_ips', async () => {
    const tooMany = Array.from({ length: 20 }, (_, i) => `10.0.0.${i}`);
    const res = await SELF.fetch(URL_REGISTER, {
      method: 'POST',
      headers: {
        'CF-Connecting-IP': '1.2.3.4',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ extra_ips: tooMany }),
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Too many');
  });

  it('rejects malformed JSON body', async () => {
    const res = await SELF.fetch(URL_REGISTER, {
      method: 'POST',
      headers: {
        'CF-Connecting-IP': '1.2.3.4',
        'Content-Type': 'application/json',
      },
      body: '{not json',
    });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Invalid JSON');
  });

  it('returns pending message when syncPolicy throws', async () => {
    mockSyncPolicy.mockRejectedValueOnce(new Error('cf api down'));
    const res = await SELF.fetch(URL_REGISTER, {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '1.2.3.4' },
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('pending');
  });
});

describe('DELETE /register', () => {
  it('unregisters CF-Connecting-IP', async () => {
    const res = await SELF.fetch(URL_REGISTER, {
      method: 'DELETE',
      headers: { 'CF-Connecting-IP': '1.2.3.4' },
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Unregistered 1.2.3.4');
  });

  it('unregisters extra_ips alongside CF-Connecting-IP', async () => {
    const res = await SELF.fetch(URL_REGISTER, {
      method: 'DELETE',
      headers: {
        'CF-Connecting-IP': '1.2.3.4',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ extra_ips: ['2001:db8::1'] }),
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('1.2.3.4');
    expect(body).toContain('2001:db8::1');
  });

  it('returns 400 when no IP is available', async () => {
    const res = await SELF.fetch(URL_REGISTER, { method: 'DELETE' });
    expect(res.status).toBe(400);
  });
});

describe('other paths', () => {
  it('returns 404 for GET /', async () => {
    const res = await SELF.fetch('https://knock.example.com/');
    expect(res.status).toBe(404);
  });

  it('returns 404 for an unknown POST path', async () => {
    const res = await SELF.fetch('https://knock.example.com/unknown', { method: 'POST' });
    expect(res.status).toBe(404);
  });
});

describe('scheduled handler', () => {
  it('calls syncPolicy', async () => {
    const env: Env = {
      IP_ALLOWLIST: {} as KVNamespace,
      CF_API_TOKEN: 'token',
      CF_ACCOUNT_ID: 'account',
      BYPASS_POLICY_ID: 'policy-id',
    };
    await worker.scheduled({} as ScheduledEvent, env, {} as ExecutionContext);
    expect(mockSyncPolicy).toHaveBeenCalledWith(env);
  });
});
