import assert from 'node:assert/strict';
import test from 'node:test';
import { createQueue, defineJob } from '@polyphony/queue';
import type { JsonValue } from '@polyphony/queue/contracts';
import type { StoredJob } from '@polyphony/queue/ports';
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

test('public consumer → Agenda → state → durable result → reopen; actual FULL/WAL', async (t) => {
  const root = await fixture(t);
  const registration = job();
  const queue = root.make(registration);
  const modes = required(
    await root.raw.readSnapshot(
      async (sql) => ({
        full: await sql.all('SELECT synchronous FROM pragma_synchronous'),
        wal: await sql.all('SELECT journal_mode FROM pragma_journal_mode'),
      }),
      limits(),
    ),
  );
  assert.deepEqual(modes, { full: [[2]], wal: [['wal']] });
  const results = await Promise.all([
    enqueue(queue, registration),
    enqueue(queue, registration),
  ]);
  assert.equal(results.filter((result) => !result.duplicate).length, 1);
  assert.equal(results[0].hash, results[1].hash);
  assert.deepEqual(
    await queue.enqueue(
      registration.type,
      { id: 'a', payload: 999, policy },
      limits(),
    ),
    { ok: false, error: { code: 'conflict' } },
  );
  const done = root.committed(terminal);
  required(await queue.start(startOptions, limits()));
  await done;
  required(await queue.stop(limits()));
  assert.deepEqual(queue.lifecycle(), { state: 'idle' });
  const result = required(await queue.get(registration.type, 'a', limits()));
  assert.equal(result.status, 'completed');
  assert.equal(result.attemptsUsed, 1);
  assert.deepEqual(result.result, { available: true, value: 42 });
  await root.close();
  const reopened = await open(root.path);
  try {
    const again = reopened.make(registration);
    assert.deepEqual(
      required(await again.get(registration.type, 'a', limits())),
      result,
    );
  } finally {
    await reopened.close();
  }
});

test('lost enqueue/start/result commit acknowledgements use readback, not a new ID or another budget charge', async (t) => {
  const lost = new Set<string>();
  const root = await fixture(t, {
    loseReply: (row) => {
      if (!lost.has(row.status)) {
        lost.add(row.status);
        return true;
      }
      return false;
    },
  });
  const registration = job();
  const queue = root.make(registration);
  const enqueued = await enqueue(queue, registration);
  assert.equal(enqueued.duplicate, true);
  const done = root.committed(terminal);
  required(await queue.start(startOptions, limits()));
  await done;
  required(await queue.stop(limits()));
  assert.deepEqual([...lost], ['pending', 'running', 'completed']);
  const result = required(await queue.get(registration.type, 'a', limits()));
  assert.equal(result.attemptsUsed, 1);
  assert.equal(result.status, 'completed');
  assert.deepEqual(queue.lifecycle(), { state: 'idle' });
});

test('result retained until matching terminal receipt; tombstone rejects new payload and prevents replay', async (t) => {
  const root = await fixture(t);
  const registration = job();
  const queue = root.make(registration);
  const enqueued = await enqueue(queue, registration);
  assert.deepEqual(
    await queue.cleanup({ ...enqueued, attemptsUsed: 0 }, limits()),
    { ok: false, error: { code: 'invalid' } },
  );
  assert.deepEqual(
    await queue.cleanup(
      { id: 'a', hash: enqueued.hash, attemptsUsed: 0 },
      limits(),
    ),
    { ok: false, error: { code: 'conflict' } },
  );
  const done = root.committed(terminal);
  required(await queue.start(startOptions, limits()));
  await done;
  required(await queue.stop(limits()));
  assert.deepEqual(
    await queue.cleanup(
      { id: 'a', hash: enqueued.hash, attemptsUsed: 0 },
      limits(),
    ),
    { ok: false, error: { code: 'conflict' } },
  );
  const receipt = { id: 'a', hash: enqueued.hash, attemptsUsed: 1 };
  required(await queue.cleanup(receipt, limits()));
  required(await queue.cleanup(receipt, limits()));
  const result = required(await queue.get(registration.type, 'a', limits()));
  assert.equal(result.status, 'completed');
  assert.equal(result.cleaned, true);
  assert.deepEqual(result.result, { available: false });
  assert.equal((await enqueue(queue, registration)).duplicate, true);
  assert.deepEqual(
    await queue.enqueue(
      registration.type,
      { id: 'a', payload: 5, policy },
      limits(),
    ),
    { ok: false, error: { code: 'conflict' } },
  );
  assert.equal(
    required(await queue.get(registration.type, 'a', limits())).attemptsUsed,
    1,
  );
});

test('bounded retries and persisted notBefore; invalid result never becomes success', async (t) => {
  const root = await fixture(t);
  let count = 0;
  const registration = job(async () => {
    count++;
    throw new Error('private exception payload /path');
  });
  const queue = root.make(registration);
  const due = Date.now() + 200;
  const started = root.committed((row) => row.status === 'running');
  required(
    await queue.enqueue(
      registration.type,
      {
        id: 'a',
        payload: 4,
        policy: { ...policy, maxAttempts: 2, backoffMs: 100 },
        notBefore: due,
      },
      limits(),
    ),
  );
  const done = root.committed(terminal);
  required(await queue.start(startOptions, limits()));
  assert.ok((await started).attempts[0].startedAt >= due);
  const row = await done;
  required(await queue.stop(limits()));
  assert.equal(count, 2);
  assert.equal(row.status, 'failed');
  assert.ok(
    row.attempts[1].startedAt >= (row.attempts[0].finishedAt ?? 0) + 100,
  );
  assert.equal(JSON.stringify(row).includes('private exception'), false);
  const invalid = job(async () => Number.NaN);
  const second = root.make(invalid, agenda(), 'invalid-result');
  const failed = root.committed(
    (row) => row.namespace === 'invalid-result' && terminal(row),
  );
  await enqueue(second, invalid, 'b', 1);
  required(await second.start(startOptions, limits()));
  await failed;
  required(await second.stop(limits()));
  assert.equal(
    required(await second.get(invalid.type, 'b', limits())).attempts[0].reason,
    'invalid_result',
  );
});

test('input/codec/registry validation, canonical hash, namespace isolation and safe errors', async (t) => {
  const root = await fixture(t);
  const registration = job();
  const queue = root.make(registration);
  assert.deepEqual(await queue.get(registration.type, 'absent', limits()), {
    ok: false,
    error: { code: 'not_found' },
  });
  assert.deepEqual(
    await queue.get({ ...registration.type }, 'absent', limits()),
    { ok: false, error: { code: 'unknown_job' } },
  );
  for (const payload of [NaN, Infinity, undefined, 1n, new Date(), () => {}]) {
    assert.deepEqual(
      await queue.enqueue(
        registration.type,
        { id: 'a', payload: payload as number, policy },
        limits(),
      ),
      { ok: false, error: { code: 'invalid' } },
    );
  }
  const aborted = new AbortController();
  aborted.abort();
  assert.deepEqual(
    await queue.get(registration.type, 'a', {
      ...limits(),
      signal: aborted.signal,
    }),
    { ok: false, error: { code: 'cancelled' } },
  );
  for (const maxAttempts of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(
      (
        await queue.enqueue(
          registration.type,
          { id: 'a', payload: 4, policy: { ...policy, maxAttempts } },
          limits(),
        )
      ).ok,
      false,
    );
  assert.equal(
    defineJob({
      name: '',
      version: 1,
      payload: number,
      result: number,
      handler: async (value) => value,
    }).ok,
    false,
  );
  assert.equal(
    createQueue({
      namespace: 'a',
      storage: root.storage,
      adapter: agenda(),
      registrations: [registration, registration],
    }).ok,
    false,
  );
  const codec = (value: unknown) => ({
    ok: true as const,
    value: value as JsonValue,
  });
  const object = required(
    defineJob({
      name: 'object',
      version: 1,
      payload: codec,
      result: codec,
      handler: async (value) => value,
    }),
  );
  const objects = required(
    createQueue({
      namespace: 'objects',
      storage: root.storage,
      adapter: agenda(),
      registrations: [object],
    }),
  );
  const first = required(
    await objects.enqueue(
      object.type,
      { id: 'a', payload: { z: 2, a: 1 }, policy },
      limits(),
    ),
  );
  const second = required(
    await objects.enqueue(
      object.type,
      { id: 'a', payload: { a: 1, z: 2 }, policy },
      limits(),
    ),
  );
  assert.equal(first.hash, second.hash);
  assert.equal(second.duplicate, true);
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  for (const payload of [
    cyclic,
    Object.defineProperty({}, 'value', {
      enumerable: true,
      get: () => {
        throw new Error('getter');
      },
    }),
  ])
    assert.equal(
      (
        await objects.enqueue(
          object.type,
          { id: 'bad', payload: payload as JsonValue, policy },
          limits(),
        )
      ).ok,
      false,
    );
  const other = root.make(registration, agenda(), 'other');
  await enqueue(queue, registration);
  await enqueue(other, registration);
  required(await queue.cancel('a', limits()));
  assert.equal(
    required(await other.get(registration.type, 'a', limits())).status,
    'pending',
  );
});

test('corrupt persisted envelope/payload/hash and closed storage are not not_found or false success', async (t) => {
  const root = await fixture(t);
  const registration = job();
  const queue = root.make(registration);
  await enqueue(queue, registration);
  const original = required(
    await root.base.readSnapshot((scope) => scope.get('tests', 'a'), limits()),
  ) as StoredJob;
  for (const mutation of [
    { ...original, hash: '0'.repeat(64) },
    { ...original, attempts: [{}] },
    { ...original, payload: 'wrong' },
  ]) {
    required(
      await root.base.transact(async (scope) => {
        await scope.put(mutation as StoredJob);
        return { ok: true, value: undefined };
      }, limits()),
    );
    assert.deepEqual(await queue.get(registration.type, 'a', limits()), {
      ok: false,
      error: { code: 'corrupt' },
    });
  }
  await root.close();
  assert.deepEqual(await queue.get(registration.type, 'a', limits()), {
    ok: false,
    error: { code: 'storage' },
  });
});

test('ambiguous enqueue with unavailable readback stays unknown_commit; same-ID retry discovers one record', async (t) => {
  const root = await fixture(t, { loseReply: () => true });
  const registration = job();
  const queue = root.make(registration, agenda(), 'tests', {
    ...root.storage,
    readSnapshot: async () => ({
      ok: false,
      error: { kind: 'storage', code: 'unavailable' },
    }),
  });
  assert.deepEqual(
    await queue.enqueue(
      registration.type,
      { id: 'a', payload: 4, policy },
      limits(),
    ),
    { ok: false, error: { code: 'unknown_commit' } },
  );
  const readback = root.make(registration);
  assert.equal((await enqueue(readback, registration)).duplicate, true);
});

test('held terminal save cannot be mistaken for a completed durable result or a successful stop', async (t) => {
  const held = deferred();
  const release = deferred();
  const root = await fixture(t, {
    beforePut: async (row) => {
      if (row.status === 'completed') {
        held.resolve();
        await release.promise;
      }
    },
  });
  const registration = job();
  const queue = root.make(registration);
  await enqueue(queue, registration);
  required(await queue.start(startOptions, limits()));
  await held.promise;
  try {
    assert.deepEqual(await queue.stop(limits(30)), {
      ok: false,
      error: { code: 'stop_incomplete' },
    });
    assert.equal(queue.lifecycle().state, 'stopping');
  } finally {
    release.resolve();
  }
  required(await queue.stop(limits()));
  assert.equal(
    required(await queue.get(registration.type, 'a', limits())).status,
    'completed',
  );
});
