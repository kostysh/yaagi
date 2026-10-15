import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

test('C1-R10: public imports and boot checks work with timers, network globals and logging forbidden', () => {
  const probe = spawnSync(
    process.execPath,
    [new URL('./import-probe.js', import.meta.url).pathname],
    { encoding: 'utf8', timeout: 10000 },
  );
  assert.equal(probe.error, undefined);
  assert.equal(probe.status, 0, probe.stderr);
  assert.equal(probe.stdout, '');
  assert.equal(probe.stderr, '');
});
