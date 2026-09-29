import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  agenda,
  enqueue,
  fixture,
  job,
  limits,
  open,
  required,
  startOptions,
  terminal,
} from './fixture.js';

const scenarios = JSON.parse(
  await readFile(
    new URL('../../../../experiments/queue/scenarios.json', import.meta.url),
    'utf8',
  ),
) as { phases: string[]; attemptBudgets: number[]; result: number };

async function killAt(path: string, phase: string) {
  const child = fork(
    new URL('./worker-child.js', import.meta.url),
    [path, phase],
    { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] },
  );
  let stderr = '';
  child.stderr?.on('data', (data: Buffer) => {
    stderr += data.toString();
  });
  const exited = once(child, 'exit');
  try {
    const message = once(child, 'message');
    child.send('start');
    assert.equal(
      (
        await Promise.race([
          message,
          exited.then(() => {
            throw new Error(`Child exited before checkpoint: ${stderr}`);
          }),
        ])
      )[0],
      phase,
    );
    child.kill('SIGKILL');
    await exited;
    assert.equal(stderr, '');
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      await exited;
    }
  }
}

for (const phase of scenarios.phases)
  for (const maxAttempts of scenarios.attemptBudgets) {
    test(`production SIGKILL ${phase}, attempts ${maxAttempts}: automatic recovery without enqueue`, async (t) => {
      const root = await fixture(t);
      const registration = job();
      const queue = root.make(registration);
      await enqueue(queue, registration, 'a', maxAttempts);
      await root.close();
      await killAt(root.path, phase);
      const reopened = await open(root.path);
      try {
        let calls = 0;
        const handler = job(async () => {
          calls++;
          return scenarios.result;
        });
        const worker = reopened.make(handler);
        const before = required(await worker.get(handler.type, 'a', limits()));
        assert.equal(before.attemptsUsed, phase === 'reserved' ? 0 : 1);
        const done =
          phase === 'completed'
            ? Promise.resolve(undefined)
            : reopened.committed(terminal);
        required(await worker.start(startOptions, limits()));
        await done;
        required(await worker.stop(limits()));
        const result = required(await worker.get(handler.type, 'a', limits()));
        if (phase === 'completed') {
          assert.equal(result.status, 'completed');
          assert.equal(calls, 0);
          assert.equal(result.attemptsUsed, 1);
        } else if (maxAttempts === 1 && phase !== 'reserved') {
          assert.equal(result.status, 'failed');
          assert.equal(calls, 0);
          assert.equal(result.attempts[0].reason, 'interrupted');
        } else {
          assert.equal(result.status, 'completed');
          assert.equal(calls, 1);
          assert.equal(result.attemptsUsed, phase === 'reserved' ? 1 : 2);
        }
        if (result.status === 'completed')
          assert.deepEqual(result.result, {
            available: true,
            value: scenarios.result,
          });
      } finally {
        await reopened.close();
      }
    });
  }

test('repeated process deaths exhaust one persisted total budget; later restart cannot reset it', async (t) => {
  const root = await fixture(t);
  const registration = job();
  await enqueue(root.make(registration), registration, 'a', 2);
  await root.close();
  await killAt(root.path, 'started');
  await killAt(root.path, 'started');
  const reopened = await open(root.path);
  try {
    let calls = 0;
    const forbidden = job(async () => {
      calls++;
      return 42;
    });
    const queue = reopened.make(forbidden);
    const done = reopened.committed(terminal);
    required(await queue.start(startOptions, limits()));
    await done;
    required(await queue.stop(limits()));
    for (let i = 0; i < 2; i++) {
      required(await queue.start(startOptions, limits()));
      required(await queue.stop(limits()));
    }
    const result = required(await queue.get(forbidden.type, 'a', limits()));
    assert.equal(result.status, 'failed');
    assert.equal(result.attemptsUsed, 2);
    assert.equal(calls, 0);
    assert.deepEqual(
      result.attempts.map((entry) => entry.reason),
      ['interrupted', 'interrupted'],
    );
  } finally {
    await reopened.close();
  }
});

test('delayed pending survives disabled-module rollback and re-enable without altering notBefore', async (t) => {
  const root = await fixture(t);
  const registration = job();
  const due = Date.now() + 800;
  await enqueue(root.make(registration), registration, 'delayed', 3, due);
  await root.close();
  // Rollback: prior application simply leaves the separate queue DB intact.
  const disabled = await open(root.path);
  const before = required(
    await disabled.base.readSnapshot(
      (scope) => scope.get('tests', 'delayed'),
      limits(),
    ),
  );
  await disabled.close();
  const reopened = await open(root.path);
  try {
    let startedAt = 0;
    const next = job(async () => {
      startedAt = Date.now();
      return 42;
    });
    const queue = reopened.make(next, agenda());
    assert.deepEqual(
      required(
        await reopened.base.readSnapshot(
          (scope) => scope.get('tests', 'delayed'),
          limits(),
        ),
      ),
      before,
    );
    const done = reopened.committed(terminal);
    required(await queue.start(startOptions, limits()));
    await done;
    required(await queue.stop(limits()));
    assert.ok(startedAt >= due);
    assert.equal(
      required(await queue.get(next.type, 'delayed', limits())).attemptsUsed,
      1,
    );
  } finally {
    await reopened.close();
  }
});
