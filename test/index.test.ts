import { describe, it, expect, vi, type MockedFunction } from 'vitest';
import { SELF } from 'cloudflare:test';
import { syncPolicy } from '../src/policy';
import type { Env } from '../src/policy';
import worker from '../src/index';

vi.mock('../src/policy', () => ({
  syncPolicy: vi.fn().mockResolvedValue(undefined),
}));

const mockSyncPolicy = syncPolicy as MockedFunction<typeof syncPolicy>;

describe('POST /register', () => {
  it('returns 200 with confirmation message containing the IP', async () => {
    const res = await SELF.fetch('https://knock.example.com/register', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '1.2.3.4' },
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('1.2.3.4');
  });

  it('returns 400 when CF-Connecting-IP header is absent', async () => {
    const res = await SELF.fetch('https://knock.example.com/register', {
      method: 'POST',
    });
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
