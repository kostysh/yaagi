import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  AdapterInput,
  Delivery,
  QueueAdapter,
} from '@polyphony/queue/ports';
import {
  agenda,
  deferred,
  enqueue,
  fixture,
  job,
  limits,
  open,
  policy,
  required,
  startOptions,
  terminal,
} from './fixture.js';

test('stop aborts a live signal, consumes started attempt, and restart retries without enqueue', async (t) => {
  const entered = deferred();
  let calls = 0;
  let aborted = false;
  const registration = job(async (_value, context) => {
    calls++;
    assert.ok(context.timeoutMs > 0 && context.timeoutMs <= policy.timeoutMs);
    if (calls === 1) {
      entered.resolve();
      await new Promise<void>((resolve) =>
        context.signal.addEventListener('abort', resolve, { once: true }),
      );
      aborted = context.signal.aborted;
    }
    return 42;
  });
  const root = await fixture(t);
  const queue = root.make(registration);
  await enqueue(queue, registration);
  required(await queue.start(startOptions, limits()));
  await entered.promise;
  assert.deepEqual(await queue.start(startOptions, limits()), {
    ok: false,
    error: { code: 'already_running' },
  });
  required(await queue.stop(limits()));
  assert.equal(aborted, true);
  const interrupted = required(
    await queue.get(registration.type, 'a', limits()),
  );
  assert.equal(interrupted.status, 'pending');
  assert.equal(interrupted.attemptsUsed, 1);
  assert.equal(interrupted.attempts[0].reason, 'stopped');
  const done = root.committed(terminal);
  required(await queue.start(startOptions, limits()));
  await done;
  required(await queue.stop(limits()));
  assert.equal(calls, 2);
  assert.equal(
    required(await queue.get(registration.type, 'a', limits())).status,
    'completed',
  );
});

test('ignoring cancellation cannot escape bounded stop or free a real concurrency slot', async (t) => {
  const entered = deferred();
  const release = deferred();
  let live = 0;
  let maximum = 0;
  const registration = job(async (_value, context) => {
    live++;
    maximum = Math.max(maximum, live);
    entered.resolve();
    await release.promise;
    assert.equal(context.signal.aborted, true);
    live--;
    return 42;
  });
  const root = await fixture(t);
  const queue = root.make(registration, agenda(1_200));
  await enqueue(queue, registration, 'a');
  await enqueue(queue, registration, 'b');
  required(await queue.start(startOptions, limits()));
  await entered.promise;
  try {
    assert.deepEqual(await queue.stop(limits(30)), {
      ok: false,
      error: { code: 'stop_incomplete' },
    });
    assert.equal(queue.lifecycle().state, 'stopping');
    assert.equal(live, 1);
    assert.deepEqual(await queue.start(startOptions, limits()), {
      ok: false,
      error: { code: 'stopping' },
    });
  } finally {
    release.resolve();
  }
  required(await queue.stop(limits()));
  assert.equal(maximum, 1);
  assert.equal(
    required(await queue.get(registration.type, 'b', limits())).attemptsUsed,
    0,
  );
});

test('deadline and execution window abort handlers without terminal cancel', async (t) => {
  for (const window of [false, true]) {
    const entered = deferred();
    const signalled = deferred();
    const registration = job(async (_value, context) => {
      entered.resolve();
      await new Promise<void>((resolve) =>
        context.signal.addEventListener('abort', resolve, { once: true }),
      );
      signalled.resolve();
      return 42;
    });
    const root = await fixture(t);
    const queue = root.make(registration);
    required(
      await queue.enqueue(
        registration.type,
        {
          id: 'a',
          payload: 4,
          policy: {
            ...policy,
            timeoutMs: window ? 5_000 : 600,
            maxAttempts: window ? 3 : 1,
          },
        },
        limits(),
      ),
    );
    const written = root.committed(
      (row) => row.attempts.length === 1 && row.status !== 'running',
    );
    required(
      await queue.start(
        { ...startOptions, ...(window ? { windowMs: 1_500 } : {}) },
        limits(),
      ),
    );
    await entered.promise;
    await signalled.promise;
    await written;
    required(await queue.stop(limits()));
    const result = required(await queue.get(registration.type, 'a', limits()));
    assert.equal(result.status, window ? 'pending' : 'failed');
    assert.equal(result.attemptsUsed, 1);
    assert.ok(['timeout', 'stopped'].includes(result.attempts[0].reason ?? ''));
  }
});

test('durable pending/running cancellation is idempotent; late handler cannot overwrite it', async (t) => {
  const entered = deferred();
  const release = deferred();
  let cancelled = false;
  const registration = job(async (_value, context) => {
    entered.resolve();
    await new Promise<void>((resolve) =>
      context.signal.addEventListener('abort', resolve, { once: true }),
    );
    cancelled = context.signal.aborted;
    await release.promise;
    return 42;
  });
  const root = await fixture(t);
  const queue = root.make(registration);
  await enqueue(queue, registration, 'pending');
  required(await queue.cancel('pending', limits()));
  required(await queue.cancel('pending', limits()));
  await enqueue(queue, registration, 'running');
  required(await queue.start(startOptions, limits()));
  await entered.promise;
  try {
    required(await queue.cancel('running', limits()));
    assert.equal(
      required(await queue.get(registration.type, 'running', limits())).status,
      'cancelled',
    );
  } finally {
    release.resolve();
  }
  required(await queue.stop(limits()));
  assert.equal(cancelled, true);
  assert.equal(
    required(await queue.get(registration.type, 'pending', limits()))
      .attemptsUsed,
    0,
  );
  assert.deepEqual(
    required(await queue.get(registration.type, 'running', limits())).result,
    { available: false },
  );
});

function captured() {
  let input: AdapterInput | undefined;
  const adapter: QueueAdapter = {
    start: async (value) => {
      input = value;
      return { ok: true, value: undefined };
    },
    stop: async () => ({ ok: true, value: undefined }),
  };
  return {
    adapter,
    get: () => {
      assert.ok(input);
      return input;
    },
  };
}
async function claim(input: AdapterInput): Promise<Delivery> {
  const result = required(
    await input.store.reserve('work', 1, Date.now(), Date.now() + 100_000),
  );
  assert.ok(result);
  return result;
}

test('competing reservations, idempotent begin and stale finalize/touch/single-or-bulk release fencing', async (t) => {
  const entered = deferred();
  const release = deferred();
  let calls = 0;
  const registration = job(async () => {
    calls++;
    if (calls === 1) {
      entered.resolve();
      await release.promise;
      return 999;
    }
    return 42;
  });
  const root = await fixture(t);
  const first = captured();
  const second = captured();
  const q1 = root.make(registration, first.adapter);
  const q2 = root.make(registration, second.adapter);
  await enqueue(q1, registration);
  required(await q1.start(startOptions, limits()));
  required(await q2.start(startOptions, limits()));
  const c1 = first.get();
  const c2 = second.get();
  const reservations = await Promise.all([
    c1.store.reserve('work', 1, Date.now(), 0),
    c2.store.reserve('work', 1, Date.now(), 0),
  ]);
  const deliveries = reservations
    .map(required)
    .filter((value) => value !== undefined);
  assert.equal(deliveries.length, 1);
  const old = deliveries[0];
  required(await c1.store.begin(old));
  required(await c1.store.begin(old));
  const oldExecution = c1.execute(old, new AbortController().signal);
  await entered.promise;
  required(await c2.store.reserve('work', 1, Date.now(), Date.now() + 100_000)); // recovery marks interrupted, not another attempt
  const next = await claim(c2);
  required(await c2.store.begin(next));
  try {
    assert.notEqual(old.token, next.token);
    assert.deepEqual(await c1.store.touch(old, Date.now()), {
      ok: false,
      error: { code: 'conflict' },
    });
    assert.deepEqual(await c1.store.release(old), {
      ok: false,
      error: { code: 'conflict' },
    });
    const batch = await Promise.all([
      c1.store.release(old),
      c2.store.release(next),
    ]);
    assert.equal(
      batch.every((value) => !value.ok),
      true,
    );
    await c2.execute(next, new AbortController().signal);
  } finally {
    release.resolve();
    await oldExecution;
  }
  const result = required(await q2.get(registration.type, 'a', limits()));
  assert.equal(result.attemptsUsed, 2);
  assert.equal(result.attempts[0].reason, 'interrupted');
  assert.deepEqual(result.result, { available: true, value: 42 });
});

test('two real Agenda consumers share one durable job; heartbeat protects a long live lease', async (t) => {
  const entered = deferred();
  const release = deferred();
  const heartbeat = deferred();
  let calls = 0;
  const root = await fixture(t, {
    afterCommit: async (row) => {
      if (
        row.status === 'running' &&
        row.lease &&
        row.lease.lockedAt > row.attempts[0].startedAt
      )
        heartbeat.resolve();
    },
  });
  const second = await open(root.path);
  t.after(() => second.close());
  const registration = job(async () => {
    calls++;
    entered.resolve();
    await release.promise;
    return 42;
  });
  const q1 = root.make(registration, agenda(1_000));
  const q2 = second.make(registration, agenda(1_000));
  await enqueue(q1, registration);
  const done = root.committed(terminal);
  required(await q1.start(startOptions, limits()));
  await entered.promise;
  required(await q2.start(startOptions, limits()));
  await heartbeat.promise;
  release.resolve();
  await done;
  required(await q1.stop(limits()));
  required(await q2.stop(limits()));
  assert.equal(calls, 1);
});

test('heartbeat storage failure aborts callback and stops dispatch, retaining the actual callback until it settles', async (t) => {
  const aborted = deferred();
  const release = deferred();
  const root = await fixture(t, {
    beforePut: async (row) => {
      if (
        row.status === 'running' &&
        row.lease &&
        row.lease.lockedAt > row.attempts[0].startedAt
      )
        throw new Error('injected renewal failure');
    },
  });
  const registration = job(async (_value, context) => {
    await new Promise<void>((resolve) =>
      context.signal.addEventListener('abort', resolve, { once: true }),
    );
    aborted.resolve();
    await release.promise;
    return 42;
  });
  const queue = root.make(registration, agenda(600));
  await enqueue(queue, registration);
  required(await queue.start(startOptions, limits()));
  await aborted.promise;
  try {
    assert.ok(queue.lifecycle().error);
    assert.deepEqual(await queue.stop(limits(20)), {
      ok: false,
      error: { code: 'stop_incomplete' },
    });
  } finally {
    release.resolve();
  }
  required(await queue.stop(limits()));
  assert.equal(
    required(await queue.get(registration.type, 'a', limits())).status,
    'pending',
  );
});

test('Agenda watchdog expiry → handler abort → held final write: stop cannot close the lifecycle gap', async (t) => {
  const heartbeatHeld = deferred();
  const heartbeatRelease = deferred();
  const aborted = deferred();
  const finalHeld = deferred();
  const finalRelease = deferred();
  const root = await fixture(t, {
    beforePut: async (row) => {
      if (
        row.status === 'running' &&
        row.lease &&
        row.lease.lockedAt > row.attempts[0].startedAt
      ) {
        heartbeatHeld.resolve();
        await heartbeatRelease.promise;
      }
      if (row.status === 'pending' && row.attempts.length > 0) {
        finalHeld.resolve();
        await finalRelease.promise;
      }
    },
  });
  const registration = job(async (_value, context) => {
    await new Promise<void>((resolve) =>
      context.signal.addEventListener('abort', resolve, { once: true }),
    );
    aborted.resolve();
    return 42;
  });
  const queue = root.make(registration, agenda(1_000));
  await enqueue(queue, registration);
  required(await queue.start({ ...startOptions, shutdownMs: 3_000 }, limits()));
  await heartbeatHeld.promise;
  await aborted.promise;
  heartbeatRelease.resolve();
  await finalHeld.promise;
  try {
    assert.ok(queue.lifecycle().error);
    assert.deepEqual(await queue.stop(limits(30)), {
      ok: false,
      error: { code: 'stop_incomplete' },
    });
  } finally {
    heartbeatRelease.resolve();
    finalRelease.resolve();
  }
  required(await queue.stop(limits()));
  assert.equal(
    required(await queue.get(registration.type, 'a', limits())).status,
    'pending',
  );
});

test('failed initial save and rejected durable result stop dispatch without phantom success or orphan lifecycle', async (t) => {
  for (const phase of ['running', 'completed']) {
    const failed = deferred();
    const root = await fixture(t, {
      beforePut: async (row) => {
        if (row.status === phase) {
          failed.resolve();
          throw new Error('injected storage failure');
        }
      },
    });
    let calls = 0;
    const registration = job(async () => {
      calls++;
      return 42;
    });
    const queue = root.make(registration);
    await enqueue(queue, registration);
    required(await queue.start(startOptions, limits()));
    await failed.promise;
    required(await queue.stop(limits()));
    const result = required(await queue.get(registration.type, 'a', limits()));
    assert.equal(result.status, phase === 'running' ? 'pending' : 'running');
    assert.equal(result.attemptsUsed, phase === 'running' ? 0 : 1);
    assert.equal(calls, phase === 'running' ? 0 : 1);
    assert.deepEqual(result.result, { available: false });
    assert.ok(queue.lifecycle().error);
  }
});

test('an already-aborted stop still stops admission, signals the handler and requires a fresh wait', async (t) => {
  const entered = deferred();
  const release = deferred();
  let signal: { readonly aborted: boolean } | undefined;
  const root = await fixture(t);
  const registration = job(async (_value, context) => {
    signal = context.signal;
    entered.resolve();
    await release.promise;
    return 42;
  });
  const queue = root.make(registration);
  await enqueue(queue, registration);
  required(await queue.start(startOptions, limits()));
  await entered.promise;
  const controller = new AbortController();
  controller.abort();
  try {
    assert.deepEqual(
      await queue.stop({ ...limits(), signal: controller.signal }),
      { ok: false, error: { code: 'stop_incomplete' } },
    );
    assert.equal(signal?.aborted, true);
    assert.equal(queue.lifecycle().state, 'stopping');
  } finally {
    release.resolve();
  }
  required(await queue.stop(limits()));
});
