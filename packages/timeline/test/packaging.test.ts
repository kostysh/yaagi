import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('fresh imports keep contracts portable; built SQL is loaded from an unrelated cwd', (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'timeline-import-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const output = execFileSync(
    process.execPath,
    [fileURLToPath(new URL('./import-child.js', import.meta.url))],
    { cwd, encoding: 'utf8', timeout: 10_000 },
  );
  assert.equal(
    output.trim(),
    'imports and built SQL independent of cwd: passed',
  );
});
