import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Coverage refs: AC-F0026-09 AC-F0026-12 AC-F0026-17

void test('AC-F0026-09 AC-F0026-17 includes release state in deterministic deployment-cell resets', async () => {
  const smokeHarness = await readFile('infra/docker/deployment-cell.smoke.ts', 'utf8');

  assert.match(smokeHarness, /polyphony_runtime\.release_requests/);
  assert.match(smokeHarness, /polyphony_runtime\.rollback_plans/);
  assert.match(smokeHarness, /polyphony_runtime\.deploy_attempts/);
  assert.match(smokeHarness, /polyphony_runtime\.release_evidence/);
  assert.match(smokeHarness, /polyphony_runtime\.rollback_executions/);
  assert.doesNotMatch(smokeHarness, /kubernetes|kubectl|helm/i);
});
