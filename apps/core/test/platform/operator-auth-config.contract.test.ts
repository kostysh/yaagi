import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCoreRuntimeConfig } from '../../src/platform/index.ts';
import { createPlatformConfigEnv } from '../../testing/platform-test-fixture.ts';

void test('AC-F0024-16 loads optional operator auth config as mounted file path and bounded rate limits', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-operator-auth-config-'));

  try {
    const config = loadCoreRuntimeConfig({
      ...createPlatformConfigEnv(root),
      YAAGI_OPERATOR_AUTH_PRINCIPALS_FILE: 'secrets/operator-principals.json',
      YAAGI_OPERATOR_AUTH_RATE_LIMIT_WINDOW_MS: '30000',
      YAAGI_OPERATOR_AUTH_RATE_LIMIT_MAX_REQUESTS: '5',
    });

    assert.equal(
      config.operatorAuthPrincipalsFilePath,
      path.resolve('secrets/operator-principals.json'),
    );
    assert.equal(config.operatorAuthRateLimitWindowMs, 30_000);
    assert.equal(config.operatorAuthRateLimitMaxRequests, 5);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0024-16 rejects invalid operator auth rate-limit env values at config load', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-operator-auth-config-'));

  try {
    assert.throws(
      () =>
        loadCoreRuntimeConfig({
          ...createPlatformConfigEnv(root),
          YAAGI_OPERATOR_AUTH_RATE_LIMIT_MAX_REQUESTS: '0',
        }),
      /YAAGI_OPERATOR_AUTH_RATE_LIMIT_MAX_REQUESTS/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
