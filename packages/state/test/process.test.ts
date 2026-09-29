import assert from 'node:assert/strict';
import { execFileSync, fork } from 'node:child_process';
import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { writeOwners } from '../examples/owners.js';
import { failure, fixture, limits, value } from './fixture.js';

test('all public imports are native-free; common contracts are side-effect-free', () => {
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL('./import-child.js', import.meta.url))],
    { timeout: 10_000 },
  );
});

for (const mode of ['rollback', 'commit'])
  test(`real writer busy, kill and public reopen (${mode})`, async (t) => {
    const f = await fixture(t);
    value(
      await f.store.transact(async (scope) => {
        await writeOwners(scope);
        return { ok: true, value: 0 };
      }, limits()),
    );
    const child = fork(
      new URL('./writer-child.js', import.meta.url),
      [f.path, mode],
      { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] },
    );
    const exited = once(child, 'exit');
    t.after(async () => {
      if (child.exitCode === null && child.signalCode === null)
        child.kill('SIGKILL');
      await exited;
    });
    const [message] = await once(child, 'message', {
      signal: AbortSignal.timeout(5_000),
    });
    assert.equal(message, 'writer-ready');
    let calls = 0;
    const start = performance.now();
    failure(
      await f.store.transact(
        async () => {
          calls++;
          return { ok: true, value: 0 };
        },
        limits(undefined, 250),
      ),
      'deadline',
    );
    assert.equal(calls, 0);
    assert.ok(performance.now() - start < 1_000);
    child.kill('SIGKILL');
    assert.deepEqual(await exited, [null, 'SIGKILL']);
    value(await f.store.close());
    const reopened = await f.open();
    assert.deepEqual(
      value(
        await reopened.readSnapshot(
          async (scope) =>
            await scope.all('SELECT revision FROM fixture_notes'),
          limits(),
        ),
      ),
      [[mode === 'commit' ? 11 : 0]],
    );
  });

for (const mode of [
  'full',
  'readonly',
  'extension',
  'worker-before',
  'worker-after',
  'backup-cancel',
])
  test(`safe real SQLite/extension failure (${mode})`, async (t) => {
    const f = await fixture(t);
    execFileSync(
      process.execPath,
      [
        '--import',
        fileURLToPath(new URL('./fault-hook.js', import.meta.url)),
        fileURLToPath(new URL('./fault-child.js', import.meta.url)),
        f.path,
        mode,
      ],
      {
        timeout: 10_000,
        env: { ...process.env, YAAGI_STATE_TEST_FAULT: mode },
      },
    );
  });
