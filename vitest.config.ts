import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          bindings: {
            CF_API_TOKEN: 'test-token',
            CF_ACCOUNT_ID: 'test-account-id',
            BYPASS_POLICY_ID: 'test-bypass-policy-id',
          },
        },
      },
    },
  },
});
