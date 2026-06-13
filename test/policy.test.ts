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

  it('appends /128 for IPv6 addresses', async () => {
    vi.mocked(env.IP_ALLOWLIST.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      keys: [{ name: 'ip:2001:db8::1', expiration: 0, metadata: null }],
      list_complete: true,
      cursor: '',
    });
    await syncPolicy(env);
    const call = mockPolicyUpdate.mock.calls[0][1];
    expect(call.include[0].ip.ip).toBe('2001:db8::1/128');
  });

  it('collects keys across multiple KV pages', async () => {
    const listMock = vi.mocked(env.IP_ALLOWLIST.list as ReturnType<typeof vi.fn>);
    listMock
      .mockResolvedValueOnce({
        keys: [{ name: 'ip:1.1.1.1', expiration: 0, metadata: null }],
        list_complete: false,
        cursor: 'page2',
      })
      .mockResolvedValueOnce({
        keys: [{ name: 'ip:2.2.2.2', expiration: 0, metadata: null }],
        list_complete: true,
        cursor: '',
      });
    await syncPolicy(env);
    const call = mockPolicyUpdate.mock.calls[0][1];
    expect(call.include).toHaveLength(2);
    expect(call.include[0].ip.ip).toBe('1.1.1.1/32');
    expect(call.include[1].ip.ip).toBe('2.2.2.2/32');
    expect(listMock).toHaveBeenCalledTimes(2);
    expect(listMock).toHaveBeenNthCalledWith(2, { prefix: 'ip:', cursor: 'page2' });
  });

  it('throws when CF API policy update fails', async () => {
    mockPolicyUpdate.mockRejectedValue(new Error('CF API 429'));
    await expect(syncPolicy(env)).rejects.toThrow('CF API 429');
  });
});
