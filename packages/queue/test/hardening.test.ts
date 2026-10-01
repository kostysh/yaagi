import assert from 'node:assert/strict';
import test from 'node:test';
import { Agenda } from 'agenda';
import type { Result } from '@polyphony/core-types';
import { defineJob } from '@polyphony/queue';
import type { Context, QueueFailure } from '@polyphony/queue/contracts';
import type { QueueAdapter } from '@polyphony/queue/ports';
import {
  agenda,
  deferred,
  enqueue,
  fixture,
  job,
  limits,
  number,
  open,
  policy,
  required,
  startOptions,
  terminal,
} from './fixture.js';

test('begin acknowledgement can exhaust the deadline without entering the handler', async (t) => {
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  let calls = 0;
  const root = await fixture(t, {
    afterCommit: async (row) => {
      if (row.status === 'running') now = row.attempts[0].startedAt + 201;
    },
  });
  const registration = job(async () => {
    calls++;
    return 42;
  });
  const queue = root.make(registration);
  required(
    await queue.enqueue(
      registration.type,
      {
        id: 'a',
        payload: 4,
        policy: { ...policy, timeoutMs: 200, maxAttempts: 1 },
      },
      limits(),
    ),
  );
  const done = root.committed(terminal);
  required(await queue.start(startOptions, limits()));
  await done;
  required(await queue.stop(limits()));
  const status = required(await queue.get(registration.type, 'a', limits()));
  assert.equal(calls, 0);
  assert.equal(status.status, 'failed');
  assert.equal(status.attempts[0].reason, 'timeout');
  assert.deepEqual(status.result, { available: false });
});

for (const mode of ['partial', 'timeout', 'window'] as const) {
  test(`payload decode respects the actual handler deadline: ${mode}`, async (t) => {
    let now = Date.now();
    t.mock.method(Date, 'now', () => now);
    let executing = false;
    let decodes = 0;
    let calls = 0;
    let received: number | undefined;
    let context: Context | undefined;
    const elapsed = mode === 'partial' ? 75 : 250;
    const registration = required(
      defineJob({
        name: 'work',
        version: 1,
        payload: (value) => {
          // The first execute decode validates the durable record. The second
          // is the typed bridge immediately before the handler. Its transform
          // must survive; the codec is not assumed to be idempotent.
          if (executing && ++decodes === 2) now += elapsed;
          const parsed = number(value);
          return parsed.ok ? { ok: true, value: parsed.value + 1 } : parsed;
        },
        result: number,
        handler: async (value, input) => {
          calls++;
          received = value;
          context = input;
          return 42;
        },
      }),
    );
    const processing = agenda();
    const adapter: QueueAdapter = {
      ...processing,
      start: (input) =>
        processing.start({
          ...input,
          execute: async (...args) => {
            executing = true;
            try {
              await input.execute(...args);
            } finally {
              executing = false;
            }
          },
        }),
    };
    const root = await fixture(t);
    const queue = root.make(registration, adapter);
    required(
      await queue.enqueue(
        registration.type,
        {
          id: 'a',
          payload: 4,
          policy: {
            ...policy,
            timeoutMs: mode === 'window' ? 1_000 : 200,
            maxAttempts: 1,
          },
        },
        limits(),
      ),
    );
    const done = root.committed(terminal);
    // Hold timer delivery independently of the wall clock. The scenario is
    // expiry during decode, not a startup race against a short real window.
    if (mode === 'window') t.mock.timers.enable({ apis: ['setTimeout'] });
    required(
      await queue.start(
        mode === 'window' ? { ...startOptions, windowMs: 200 } : startOptions,
        limits(),
      ),
    );
    try {
      await done;
    } finally {
      if (mode === 'window') t.mock.timers.reset();
    }
    required(await queue.stop(limits()));
    const status = required(await queue.get(registration.type, 'a', limits()));
    assert.ok(decodes >= 2);
    if (mode === 'partial') {
      assert.equal(calls, 1);
      assert.equal(received, 6);
      assert.equal(context?.timeoutMs, 125);
      assert.equal(status.status, 'completed');
      assert.deepEqual(status.result, { available: true, value: 42 });
    } else {
      assert.equal(calls, 0);
      assert.equal(status.status, 'failed');
      assert.equal(status.attempts[0].reason, 'timeout');
      assert.deepEqual(status.result, { available: false });
    }
  });
}

test('defineJob does not enter a handler cancelled during payload decode', async () => {
  const controller = new AbortController();
  let calls = 0;
  const registration = required(
    defineJob({
      name: 'work',
      version: 1,
      payload: (value) => {
        controller.abort();
        return number(value);
      },
      result: number,
      handler: async () => {
        calls++;
        return 42;
      },
    }),
  );
  await assert.rejects(
    registration.invoke(4, {
      id: 'a',
      namespace: 'tests',
      attempt: 1,
      signal: controller.signal,
      timeoutMs: 200,
    }),
    { code: 'cancelled' },
  );
  assert.equal(calls, 0);
});

for (const mode of ['completed', 'retry'] as const) {
  test(`heartbeat confirms its own finish while acknowledgement is pending: ${mode}`, async (t) => {
    const committed = deferred();
    const acknowledge = deferred();
    const touched = deferred<Result<void, QueueFailure>>();
    let finishing = false;
    let calls = 0;
    const root = await fixture(t, {
      afterCommit: async (row) => {
        if (row.attempts.length === 1 && row.attempts[0].status !== 'running') {
          finishing = true;
          committed.resolve();
          await acknowledge.promise;
        }
      },
    });
    const processing = agenda(1_000);
    const observed: QueueAdapter = {
      ...processing,
      start: (input) =>
        processing.start({
          ...input,
          store: {
            reserve: (...args) => input.store.reserve(...args),
            begin: (...args) => input.store.begin(...args),
            release: (...args) => input.store.release(...args),
            touch: async (...args) => {
              const result = await input.store.touch(...args);
              if (finishing) touched.resolve(result);
              return result;
            },
          },
        }),
    };
    const registration = job(async () => {
      calls++;
      if (mode === 'retry' && calls === 1) throw new Error('first attempt');
      return 42;
    });
    const queue = root.make(registration, observed);
    await enqueue(queue, registration, 'a', 2);
    required(await queue.start(startOptions, limits()));
    try {
      await committed.promise;
      required(await touched.promise);
      assert.equal(queue.lifecycle().error, undefined);
      assert.equal(queue.lifecycle().state, 'running');
      const done = mode === 'retry' ? root.committed(terminal) : undefined;
      acknowledge.resolve();
      await done;
    } finally {
      acknowledge.resolve();
      required(await queue.stop(limits()));
    }
    const status = required(await queue.get(registration.type, 'a', limits()));
    assert.equal(queue.lifecycle().error, undefined);
    assert.equal(calls, mode === 'retry' ? 2 : 1);
    assert.equal(status.attemptsUsed, calls);
    assert.equal(status.status, 'completed');
    assert.deepEqual(status.result, { available: true, value: 42 });
  });
}

test('a lost heartbeat acknowledgement can confirm the concurrently committed finish', async (t) => {
  const renewed = deferred();
  const touchReply = deferred();
  const finished = deferred();
  const finishReply = deferred();
  const handlerRelease = deferred();
  const touched = deferred<Result<void, QueueFailure>>();
  let lost = false;
  const root = await fixture(t, {
    afterCommit: async (row) => {
      if (
        row.status === 'running' &&
        row.lease &&
        row.lease.lockedAt > row.attempts[0].startedAt
      ) {
        renewed.resolve();
        await touchReply.promise;
      } else if (row.status === 'completed') {
        finished.resolve();
        await finishReply.promise;
      }
    },
    loseReply: (row) => {
      if (
        !lost &&
        row.status === 'running' &&
        row.lease &&
        row.lease.lockedAt > row.attempts[0].startedAt
      ) {
        lost = true;
        return true;
      }
      return false;
    },
  });
  const processing = agenda(1_000);
  const observed: QueueAdapter = {
    ...processing,
    start: (input) =>
      processing.start({
        ...input,
        store: {
          reserve: (...args) => input.store.reserve(...args),
          begin: (...args) => input.store.begin(...args),
          release: (...args) => input.store.release(...args),
          touch: async (...args) => {
            const result = await input.store.touch(...args);
            touched.resolve(result);
            return result;
          },
        },
      }),
  };
  const registration = job(async () => {
    await handlerRelease.promise;
    return 42;
  });
  const queue = root.make(registration, observed);
  await enqueue(queue, registration);
  required(await queue.start(startOptions, limits()));
  try {
    await renewed.promise;
    handlerRelease.resolve();
    await finished.promise;
    touchReply.resolve();
    required(await touched.promise);
    assert.equal(lost, true);
    assert.equal(queue.lifecycle().error, undefined);
  } finally {
    handlerRelease.resolve();
    touchReply.resolve();
    finishReply.resolve();
    required(await queue.stop(limits()));
  }
  const status = required(await queue.get(registration.type, 'a', limits()));
  assert.equal(status.status, 'completed');
  assert.equal(status.attemptsUsed, 1);
  assert.deepEqual(status.result, { available: true, value: 42 });
});

test('an in-flight finish cannot hide a replacement lease from heartbeat', async (t) => {
  const committed = deferred();
  const acknowledge = deferred();
  const touchEntered = deferred();
  const touchRelease = deferred();
  const touched = deferred<Result<void, QueueFailure>>();
  const nextEntered = deferred();
  const nextRelease = deferred();
  const root = await fixture(t, {
    afterCommit: async (row) => {
      if (row.status === 'pending' && row.attempts.length === 1) {
        committed.resolve();
        await acknowledge.promise;
      }
    },
  });
  const second = await open(root.path);
  t.after(() => second.close());
  const processing = agenda(2_000);
  const held: QueueAdapter = {
    ...processing,
    start: (input) =>
      processing.start({
        ...input,
        store: {
          reserve: (...args) => input.store.reserve(...args),
          begin: (...args) => input.store.begin(...args),
          release: (...args) => input.store.release(...args),
          touch: async (...args) => {
            touchEntered.resolve();
            await touchRelease.promise;
            const result = await input.store.touch(...args);
            touched.resolve(result);
            return result;
          },
        },
      }),
  };
  const firstJob = job(async () => {
    throw new Error('first attempt');
  });
  const nextJob = job(async () => {
    nextEntered.resolve();
    await nextRelease.promise;
    return 42;
  });
  const q1 = root.make(firstJob, held);
  const q2 = second.make(nextJob);
  await enqueue(q1, firstJob, 'a', 2);
  required(await q1.start(startOptions, limits()));
  try {
    await committed.promise;
    required(await q2.start(startOptions, limits()));
    await nextEntered.promise;
    await touchEntered.promise;
    touchRelease.resolve();
    assert.deepEqual(await touched.promise, {
      ok: false,
      error: { code: 'conflict' },
    });
    const done = second.committed(terminal);
    nextRelease.resolve();
    await done;
  } finally {
    touchRelease.resolve();
    nextRelease.resolve();
    acknowledge.resolve();
    required(await q1.stop(limits()));
    required(await q2.stop(limits()));
  }
  const status = required(await q2.get(nextJob.type, 'a', limits()));
  assert.equal(status.attemptsUsed, 2);
  assert.equal(status.attempts[0].reason, 'handler_failed');
  assert.deepEqual(status.result, { available: true, value: 42 });
});

test('stop rejects a late acknowledgement even before its deadline timer can run', async (t) => {
  let now = performance.now();
  t.mock.method(performance, 'now', () => now);
  const entered = deferred();
  const acknowledge = deferred();
  const stop = Agenda.prototype.stop;
  t.mock.method(
    Agenda.prototype,
    'stop',
    async function (this: Agenda, ...args: Parameters<Agenda['stop']>) {
      await stop.apply(this, args);
      entered.resolve();
      await acknowledge.promise;
    },
  );
  const root = await fixture(t);
  const queue = root.make();
  required(await queue.start(startOptions, limits()));
  const stopped = queue.stop(limits(5_000));
  try {
    await entered.promise;
    now += 5_001;
    acknowledge.resolve();
    assert.deepEqual(await stopped, {
      ok: false,
      error: { code: 'stop_incomplete' },
    });
    assert.equal(queue.lifecycle().state, 'stopping');
  } finally {
    acknowledge.resolve();
    await stopped;
    required(await queue.stop(limits()));
  }
  assert.equal(queue.lifecycle().state, 'idle');
});
