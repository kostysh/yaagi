import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(new URL('../../../../', import.meta.url).pathname);

const readRepoFile = (relativePath: string): string =>
  readFileSync(path.join(repoRoot, relativePath), 'utf8');

void test('AC-F0029-01 AC-F0029-02 AC-F0029-09 AC-F0029-10 keeps Telegram send ownership in the executive gateway', () => {
  const perceptionAdapter = readRepoFile('apps/core/src/perception/telegram-adapter.ts');
  const runtimeLifecycle = readRepoFile('apps/core/src/runtime/runtime-lifecycle.ts');
  const toolGateway = readRepoFile('apps/core/src/actions/tool-gateway.ts');

  assert.equal(perceptionAdapter.includes('sendMessage'), false);
  assert.equal(runtimeLifecycle.includes('/sendMessage'), false);
  assert.equal(toolGateway.includes('telegram.sendMessage'), true);
  assert.equal(toolGateway.includes('/sendMessage'), true);
});
