import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Coverage refs: AC-F0026-07 AC-F0026-12 AC-F0026-16 AC-F0026-17

void test('AC-F0026 release automation stays on one service and the canonical deployment cell path', async () => {
  const [readme, operatorApi, runtimeLifecycle, cli, smokeHarness] = await Promise.all([
    readFile('README.md', 'utf8'),
    readFile('apps/core/src/platform/operator-api.ts', 'utf8'),
    readFile('apps/core/src/runtime/runtime-lifecycle.ts', 'utf8'),
    readFile('scripts/release-cell.ts', 'utf8'),
    readFile('infra/docker/deployment-cell.smoke.ts', 'utf8'),
  ]);

  assert.match(readme, /pnpm release:cell prepare\|deploy\|inspect\|rollback/);
  assert.match(readme, /YAAGI_RELEASE_EVIDENCE_ROOT/);
  assert.match(operatorApi, /prepareRelease/);
  assert.match(operatorApi, /runReleaseDeployAttempt/);
  assert.match(operatorApi, /executeReleaseRollback/);
  assert.match(runtimeLifecycle, /createDbBackedReleaseAutomationService/);
  assert.doesNotMatch(runtimeLifecycle, /createReleaseCellRollbackExecutor/);
  assert.match(cli, /createDbBackedReleaseAutomationService/);
  assert.match(cli, /createPnpmSmokeCellRunner/);
  assert.match(cli, /createReleaseCellRollbackExecutor/);
  assert.match(smokeHarness, /polyphony_runtime\.release_requests/);
  assert.doesNotMatch(`${readme}\n${operatorApi}\n${cli}`, /kubectl|helm|kubernetes/i);
});

void test('AC-F0026 Operator API runtime does not default to host-only release executors', async () => {
  const releaseAutomation = await readFile('apps/core/src/platform/release-automation.ts', 'utf8');

  assert.match(releaseAutomation, /smokeRunner:\s*options\.smokeRunner\s*\?\?\s*null/);
  assert.match(releaseAutomation, /rollbackExecutor:\s*options\.rollbackExecutor\s*\?\?\s*null/);
  assert.doesNotMatch(
    releaseAutomation,
    /options\.smokeRunner === undefined \? createPnpmSmokeCellRunner\(\)/,
  );
  assert.doesNotMatch(releaseAutomation, /options\.rollbackExecutor === undefined/);
});
