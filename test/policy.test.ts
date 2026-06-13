import { describe, it, expect, vi, beforeEach } from 'vitest';
import Cloudflare from 'cloudflare';
import { syncPolicy } from '../src/policy';
import type { Env } from '../src/policy';

vi.mock('cloudflare', () => ({
  default: vi.fn(),
}));

describe('syncPolicy', () => {
  let mockPolicyUpdate: ReturnType<typeof vi.fn>;
  let env: Env;

  beforeEach(() => {
    mockPolicyUpdate = vi.fn().mockResolvedValue({});
    vi.mocked(Cloudflare).mockImplementation(
      () =>
        ({
          zeroTrust: {
            access: {
              policies: { update: mockPolicyUpdate },
            },
          },
        }) as unknown as Cloudflare,
    );

    env = {
      IP_ALLOWLIST: {
        list: vi.fn().mockResolvedValue({ keys: [], list_complete: true, cursor: '' }),
        put: vi.fn().mockResolvedValue(undefined),
        get: vi.fn(),
        getWithMetadata: vi.fn(),
        delete: vi.fn(),
      } as unknown as KVNamespace,
      CF_API_TOKEN: 'test-token',
      CF_ACCOUNT_ID: 'test-account-id',
      BYPASS_POLICY_ID: 'test-policy-id',
    };
  });

  it('uses inert placeholder when KV is empty', async () => {
    await syncPolicy(env);
    expect(mockPolicyUpdate).toHaveBeenCalledWith('test-policy-id', {
      account_id: 'test-account-id',
      name: 'IP Bypass - Dynamic',
      decision: 'bypass',
      include: [{ ip: { ip: '0.0.0.0/32' } }],
    });
  });

  it('includes all registered IPs from KV with /32 suffix', async () => {
    vi.mocked(env.IP_ALLOWLIST.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      keys: [
        { name: 'ip:1.2.3.4', expiration: 0, metadata: null },
        { name: 'ip:5.6.7.8', expiration: 0, metadata: null },
      ],
      list_complete: true,
      cursor: '',
    });
    await syncPolicy(env);
    expect(mockPolicyUpdate).toHaveBeenCalledWith('test-policy-id', {
      account_id: 'test-account-id',
      name: 'IP Bypass - Dynamic',
      decision: 'bypass',
      include: [{ ip: { ip: '1.2.3.4/32' } }, { ip: { ip: '5.6.7.8/32' } }],
    });
  });

  it('preserves existing CIDR notation stored in KV', async () => {
    vi.mocked(env.IP_ALLOWLIST.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      keys: [{ name: 'ip:10.0.0.0/24', expiration: 0, metadata: null }],
      list_complete: true,
      cursor: '',
    });
    await syncPolicy(env);
    const call = mockPolicyUpdate.mock.calls[0][1];
    expect(call.include[0].ip.ip).toBe('10.0.0.0/24');
  });
});
