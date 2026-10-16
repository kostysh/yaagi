import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('public executable guide: success, conflict, close/reopen/resume and next sequence', () => {
  const output = execFileSync(
    process.execPath,
    [fileURLToPath(new URL('../examples/usage.js', import.meta.url))],
    { encoding: 'utf8', timeout: 15_000 },
  );
  assert.deepEqual(output.trim().split('\n'), [
    'success: settled tick persisted',
    'error: duplicate tick is conflict',
    'recovery: interrupted attempt retained; next sequence is 3',
  ]);
});
