import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCoreRuntimeConfig } from '../../src/platform/core-config.ts';

void test('AC-F0025-12 keeps policy governance on the existing runtime cell without new boot-critical consultant config', () => {
  const config = loadCoreRuntimeConfig({});
  const keys = Object.keys(config);

  assert.equal(keys.includes('policyGovernanceUrl'), false);
  assert.equal(keys.includes('externalConsultantUrl'), false);
  assert.equal(keys.includes('consultantBootCritical'), false);
});
