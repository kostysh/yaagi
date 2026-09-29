import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
import type { JobParameters } from 'agenda';
import { enqueue, fixture, open, worker } from './fixture.js';
import {
  type Repository,
  type ProbeRow,
  limits,
  required,
} from './repository.js';

function terminal(repository: Repository, id = 'a') {
  const done = Promise.withResolvers<ProbeRow>();
  const observe = async () => {
    const row = await repository.read(id);
    if (row && ['completed', 'failed', 'cancelled'].includes(row.state))
      done.resolve(row);
  };
  repository.onScan = observe;
  repository.onFinalized = observe;
  return done.promise;
}

test('Agenda processes a real state record; FULL/WAL, identity, conflict, durable result and reopen', async () => {
  const root = await fixture();
  let running: ReturnType<typeof worker> | undefined;
  try {
    const mode = required(
      await root.storage.readSnapshot(
        async (sql) => ({
          sync: await sql.all('SELECT synchronous FROM pragma_synchronous'),
          wal: await sql.all('SELECT journal_mode FROM pragma_journal_mode'),
        }),
        limits(),
      ),
    );
    assert.deepEqual(mode, { sync: [[2]], wal: [['wal']] });
    await enqueue(root.repository);
    await Promise.all([enqueue(root.repository), enqueue(root.repository)]);
    await assert.rejects(enqueue(root.repository, 'a', 2, 999));
    const done = terminal(root.repository);
    let calls = 0;
    running = worker(root.repository, async () => {
      calls++;
      return 42;
    });
    await running.start();
    const row = await done;
    assert.equal(row.attempts, 1);
    assert.equal(row.result, 42);
    assert.equal(calls, 1);
    await running.stop();
    assert.deepEqual(running.errors, []);
    required(await root.storage.close());
    const again = await open(root.path);
    try {
      assert.equal((await again.repository.read('a'))?.result, 42);
    } finally {
      required(await again.storage.close());
    }
  } finally {
    await running?.stop();
    await root.cleanup();
  }
});

test('a lost enqueue acknowledgement is resolved using the same identity without a second job', async () => {
  const root = await fixture();
  try {
    const commit = root.storage.transact;
    let lose = true;
    // Real transaction commits, then the public port response is lost; no mock DB.
    const port = {
      ...root.storage,
      transact: (async (...args: Parameters<typeof commit>) => {
        const value = await commit(...args);
        if (lose && value.ok) {
          lose = false;
          return {
            ok: false as const,
            error: { kind: 'storage' as const, code: 'unavailable' as const },
          };
        }
        return value;
      }) as typeof commit,
    };
    const { Repository } = await import('./repository.js');
    const uncertain = new Repository(port);
    await assert.rejects(enqueue(uncertain));
    await enqueue(root.repository);
    const rows = required(
      await root.storage.readSnapshot(
        (sql) => sql.all('SELECT count(*) FROM probe_jobs'),
        limits(),
      ),
    );
    assert.deepEqual(rows, [[1]]);
    assert.equal((await root.repository.read('a'))?.attempts, 0);
  } finally {
    await root.cleanup();
  }
});

test('old completion, touch and single/bulk unlock cannot mutate a new reservation', async () => {
  const root = await fixture();
  try {
    await enqueue(root.repository, 'a', 3);
    const old = await root.repository.getNextJobToRun(
      'work',
      new Date(),
      new Date(0),
      new Date(1),
    );
    assert.ok(old);
    old.lastRunAt = new Date(2);
    await root.repository.saveJobState(old);
    // Repeated ambiguous start acknowledgement does not consume another attempt.
    await root.repository.saveJobState(old);
    assert.equal((await root.repository.read('a'))?.attempts, 1);
    const next = await root.repository.getNextJobToRun(
      'work',
      new Date(),
      new Date(3),
    );
    assert.ok(next);
    assert.notEqual(old._id, next._id);
    await assert.rejects(root.repository.complete(old, 9));
    old.lockedAt = new Date();
    await assert.rejects(root.repository.saveJobState(old));
    await root.repository.unlockJob(old);
    assert.ok(old._id);
    assert.ok(next._id);
    await root.repository.unlockJobs([old._id]);
    assert.ok(await root.repository.getJobById(next._id));
    next.lastRunAt = new Date();
    await root.repository.saveJobState(next);
    await root.repository.complete(next, 42);
    assert.equal((await root.repository.read('a'))?.result, 42);
    assert.equal((await root.repository.read('a'))?.attempts, 2);
  } finally {
    await root.cleanup();
  }
});

for (const phase of ['reserved', 'started', 'handled', 'completed']) {
  for (const maxAttempts of [1, 3]) {
    test(`SIGKILL ${phase}, budget ${maxAttempts}: restart without enqueue preserves budget and result`, async () => {
      const root = await fixture();
      let running: ReturnType<typeof worker> | undefined;
      let reopened: Awaited<ReturnType<typeof open>> | undefined;
      const child = fork(
        new URL('./worker-child.js', import.meta.url),
        [root.path, phase],
        { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] },
      );
      const exit = once(child, 'exit');
      let stderr = '';
      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
      try {
        await enqueue(root.repository, 'a', maxAttempts);
        required(await root.storage.close());
        const checkpoint = once(child, 'message');
        child.send('start');
        await checkpoint;
        child.kill('SIGKILL');
        await exit;
        assert.equal(stderr, '');
        reopened = await open(root.path);
        const before = await reopened.repository.read('a');
        assert.ok(before);
        assert.equal(before.attempts, phase === 'reserved' ? 0 : 1);
        let calls = 0;
        const done = terminal(reopened.repository);
        running = worker(reopened.repository, async () => {
          calls++;
          return 42;
        });
        await running.start();
        const result = await done;
        if (phase === 'completed') {
          assert.equal(result.state, 'completed');
          assert.equal(calls, 0);
          assert.equal(result.attempts, 1);
        } else if (maxAttempts === 1 && phase !== 'reserved') {
          assert.equal(result.state, 'failed');
          assert.equal(calls, 0);
          assert.equal(result.attempts, 1);
        } else {
          assert.equal(result.state, 'completed');
          assert.equal(calls, 1);
          assert.equal(result.attempts, phase === 'reserved' ? 1 : 2);
        }
        await running.stop();
        assert.deepEqual(running.errors, []);
      } finally {
        if (child.exitCode === null && child.signalCode === null)
          child.kill('SIGKILL');
        await exit;
        await running?.stop();
        if (reopened) required(await reopened.storage.close());
        await root.cleanup();
      }
    });
  }
}

test('bounded stop aborts a cooperative handler, preserves the interrupted job, and permits root close', async () => {
  const root = await fixture();
  const started = Promise.withResolvers<void>();
  let finished = false;
  const running = worker(root.repository, async (_job, signal) => {
    const aborted = new Promise<void>((resolve) =>
      signal.addEventListener('abort', () => resolve(), { once: true }),
    );
    started.resolve();
    await aborted;
    finished = true;
    return 42;
  });
  try {
    await enqueue(root.repository);
    await running.start();
    await started.promise;
    const before = Date.now();
    await running.stop();
    assert.ok(Date.now() - before < 2_000);
    assert.equal(finished, true);
    const row = await root.repository.read('a');
    assert.equal(row?.state, 'queued');
    assert.equal(row?.attempts, 1);
    assert.equal(row?.result, null);
    required(await root.storage.close());
    assert.deepEqual(running.errors, []);
  } finally {
    await running.stop();
    await root.cleanup();
  }
});

test('Agenda complete event does not turn a rejected durable result write into successful queue status', async () => {
  const root = await fixture();
  const finalize = root.repository.saveJobState.bind(root.repository);
  root.repository.complete = async () => {
    throw new Error('injected result persistence failure');
  };
  root.repository.saveJobState = async (job: JobParameters) => {
    if (!job.lockedAt) throw new Error('injected terminal persistence failure');
    await finalize(job);
  };
  const running = worker(root.repository, async () => 42);
  try {
    await enqueue(root.repository, 'a', 1);
    const event = once(running.agenda, 'complete');
    await running.start();
    await event;
    const row = await root.repository.read('a');
    assert.notEqual(row?.state, 'completed');
    assert.equal(row?.result, null);
  } finally {
    await running.stop();
    await root.cleanup();
  }
});

test('two independent state clients cannot reserve the same live job', async () => {
  const root = await fixture();
  const second = await open(root.path);
  try {
    await enqueue(root.repository);
    const claims = await Promise.all([
      root.repository.getNextJobToRun('work', new Date(), new Date(0)),
      second.repository.getNextJobToRun('work', new Date(), new Date(0)),
    ]);
    assert.equal(claims.filter(Boolean).length, 1);
    assert.equal((await root.repository.read('a'))?.attempts, 0);
  } finally {
    required(await second.storage.close());
    await root.cleanup();
  }
});

test('lost start acknowledgement reads back the committed attempt before entering handler', async () => {
  const root = await fixture();
  const commit = root.storage.transact;
  let lose = false;
  const port = {
    ...root.storage,
    transact: (async (...args: Parameters<typeof commit>) => {
      const value = await commit(...args);
      if (lose && value.ok) {
        lose = false;
        return {
          ok: false as const,
          error: { kind: 'storage' as const, code: 'unavailable' as const },
        };
      }
      return value;
    }) as typeof commit,
  };
  const { Repository } = await import('./repository.js');
  const repository = new Repository(port);
  repository.onReserved = async () => {
    lose = true;
  };
  const done = terminal(repository);
  let calls = 0;
  const running = worker(repository, async () => {
    calls++;
    return 42;
  });
  try {
    await enqueue(repository, 'a', 1);
    await running.start();
    const row = await done;
    assert.equal(row.state, 'completed');
    assert.equal(row.attempts, 1);
    assert.equal(calls, 1);
  } finally {
    await running.stop();
    await root.cleanup();
  }
});

test('stop reports incomplete while a callback ignores abort; storage stays open until callback settles', async () => {
  const root = await fixture();
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const completed = Promise.withResolvers<void>();
  const running = worker(
    root.repository,
    async () => {
      started.resolve();
      await release.promise;
      completed.resolve();
      return 42;
    },
    100,
  );
  try {
    await enqueue(root.repository);
    await running.start();
    await started.promise;
    await assert.rejects(running.stop(), /incomplete/i);
    assert.equal((await root.repository.read('a'))?.state, 'running');
    const finalized = once(running.agenda, 'complete');
    release.resolve();
    await completed.promise;
    await finalized;
    await running.stop();
    assert.equal((await root.repository.read('a'))?.result, null);
  } finally {
    release.resolve();
    await running.stop();
    await root.cleanup();
  }
});

test('stop waits for a held terminal repository callback, not only the handler or Agenda running list', async () => {
  const root = await fixture();
  const held = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const finalize = root.repository.saveJobState.bind(root.repository);
  root.repository.saveJobState = async (job) => {
    if (!job.lockedAt) {
      held.resolve();
      await release.promise;
    }
    await finalize(job);
  };
  const running = worker(root.repository, async () => 42, 100);
  try {
    await enqueue(root.repository);
    await running.start();
    await held.promise;
    await assert.rejects(running.stop(), /incomplete/i);
    assert.equal((await root.repository.read('a'))?.result, 42);
    const finalized = once(running.agenda, 'complete');
    release.resolve();
    await finalized;
    await running.stop();
    required(await root.storage.close());
  } finally {
    release.resolve();
    await running.stop();
    await root.cleanup();
  }
});

test('watchdog expiry cannot make stop succeed in the gap before the late terminal save', async () => {
  const root = await fixture();
  const started = Promise.withResolvers<void>();
  const held = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let terminalSettled = false;
  const finalize = root.repository.saveJobState.bind(root.repository);
  root.repository.saveJobState = async (job) => {
    if (!job.lockedAt) {
      held.resolve();
      await release.promise;
    }
    await finalize(job);
    if (!job.lockedAt) terminalSettled = true;
  };
  const running = worker(
    root.repository,
    async (_job, signal) => {
      const aborted = new Promise<void>((resolve) =>
        signal.addEventListener('abort', () => resolve(), { once: true }),
      );
      started.resolve();
      await aborted;
      return 42;
    },
    200,
  );
  try {
    await enqueue(root.repository);
    const expired = once(running.agenda, 'error');
    await running.start();
    await started.promise;
    await expired;
    const stopping = running.stop();
    const rejected = assert.rejects(stopping, /incomplete/i);
    await held.promise;
    await rejected;
    assert.equal(terminalSettled, false);
    const finalized = once(running.agenda, 'complete');
    release.resolve();
    await finalized;
    await running.stop();
    assert.equal(terminalSettled, true);
    required(await root.storage.close());
    // Even a future library continuation cannot write after successful stop.
    await root.repository.unlockJobs(['["a","obsolete"]']);
  } finally {
    release.resolve();
    await running.stop();
    await root.cleanup();
  }
});

test('rejected start save has no future terminal callback and does not strand stop tracking', async () => {
  const root = await fixture();
  root.repository.saveJobState = async () => {
    throw new Error('injected start refusal');
  };
  const running = worker(root.repository, async () => {
    assert.fail('Start not committed');
  });
  try {
    await enqueue(root.repository);
    const refused = once(running.agenda, 'error');
    await running.start();
    await refused;
    await running.stop();
    assert.equal((await root.repository.read('a'))?.attempts, 0);
    required(await root.storage.close());
  } finally {
    await running.stop();
    await root.cleanup();
  }
});

test('delayed job survives reopen and is never executed before notBefore', async () => {
  const root = await fixture();
  const notBefore = Date.now() + 2_000;
  let reopened: Awaited<ReturnType<typeof open>> | undefined;
  let running: ReturnType<typeof worker> | undefined;
  try {
    await enqueue(root.repository, 'a', 2, 4, new Date(notBefore));
    required(await root.storage.close());
    reopened = await open(root.path);
    assert.equal((await reopened.repository.read('a'))?.notBefore, notBefore);
    const done = terminal(reopened.repository);
    let executedAt = 0;
    running = worker(reopened.repository, async () => {
      executedAt = Date.now();
      return 42;
    });
    await running.start();
    const row = await done;
    assert.ok(executedAt >= notBefore);
    assert.equal(row.attempts, 1);
    assert.equal(row.result, 42);
  } finally {
    await running?.stop();
    if (reopened) required(await reopened.storage.close());
    await root.cleanup();
  }
});

test('two crashed processes exhaust a shared persisted budget; further starts do not reset it', async () => {
  const root = await fixture();
  try {
    await enqueue(root.repository, 'a', 2);
    required(await root.storage.close());
    for (const expected of [1, 2]) {
      const child = fork(
        new URL('./worker-child.js', import.meta.url),
        [root.path, 'started'],
        { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] },
      );
      const exited = once(child, 'exit');
      try {
        const checkpoint = once(child, 'message');
        child.send('start');
        await checkpoint;
        child.kill('SIGKILL');
        await exited;
        const check = await open(root.path);
        try {
          assert.equal((await check.repository.read('a'))?.attempts, expected);
        } finally {
          required(await check.storage.close());
        }
      } finally {
        if (child.exitCode === null && child.signalCode === null)
          child.kill('SIGKILL');
        await exited;
      }
    }
    for (let restart = 0; restart < 2; restart++) {
      const opened = await open(root.path);
      const done = terminal(opened.repository);
      const running = worker(opened.repository, async () => {
        assert.fail('Budget exhausted: handler must not run');
      });
      try {
        await running.start();
        const row = await done;
        assert.equal(row.state, 'failed');
        assert.equal(row.attempts, 2);
      } finally {
        await running.stop();
        required(await opened.storage.close());
      }
    }
  } finally {
    await root.cleanup();
  }
});
