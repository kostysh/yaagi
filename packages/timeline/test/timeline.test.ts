import assert from 'node:assert/strict';
import test from 'node:test';
import { createState } from '@polyphony/state';
import {
  createSqliteAdapter,
  type SqlScope,
} from '@polyphony/state/adapters/sqlite';
import type { StorageAdapter } from '@polyphony/state/contracts';
import { bindTimeline } from '@polyphony/timeline/sqlite';
import {
  parseActionId,
  parseElapsedMs,
  parseWallTimeMs,
} from '@polyphony/core-types';
import type {
  TimelineFailure,
  TickRecord,
} from '@polyphony/timeline/contracts';
import {
  action,
  agent,
  fixture,
  limits,
  outcome,
  reserve,
  value,
} from './fixture.js';

const denied = (code: TimelineFailure['code']) => ({
  ok: false,
  error: { kind: 'owner', error: { code } },
});
const ok = <T>(result: T) => ({ ok: true as const, value: result });

test('T1: full public input → SQLite → detached readback → reopen, next frame and unknown outcome', async (t) => {
  const { state, open } = await fixture(t);
  assert.deepEqual(
    value(
      value(await state.readSnapshot((o) => o.timeline.readHead(), limits())),
    ),
    { lastSequence: 0, previousCompleteTick: null, lastTick: null },
  );
  const input = reserve();
  const reserved = value(
    await state.transact((o) => o.timeline.reserveTick(input), limits()),
  );
  assert.deepEqual(reserved, {
    schemaVersion: 1,
    phase: 'reserved',
    revision: 0,
    frame: {
      ...input,
      agentId: 'agent-A',
      sequence: 1,
      previousCompleteTick: null,
    },
  });
  const decided = value(
    await state.transact(
      (o) =>
        o.timeline.decide({
          tickId: input.tickId,
          expectedRevision: 0,
          actionRef: action,
        }),
      limits(),
    ),
  );
  const settled = value(
    await state.transact(
      (o) =>
        o.timeline.settle({
          tickId: input.tickId,
          expectedRevision: 1,
          actionRef: action,
          outcomeRef: outcome,
        }),
      limits(),
    ),
  );
  assert.equal(reserved.phase, 'reserved');
  assert.equal(decided.phase, 'decided');
  assert.equal(settled.phase, 'settled');
  assert.equal(settled.revision, 2);
  assert.deepEqual(settled.frame, reserved.frame);
  assert.ok(Object.isFrozen(settled));
  assert.ok(Object.isFrozen(settled.frame));
  if (settled.phase === 'settled')
    assert.ok(Object.isFrozen(settled.outcomeRef));
  assert.equal(Reflect.set(settled.frame, 'epoch', 'changed'), false);
  value(await state.close());
  const reopened = await open();
  assert.deepEqual(
    value(
      value(
        await reopened.readSnapshot(
          (o) => o.timeline.readTick({ tickId: input.tickId }),
          limits(),
        ),
      ),
    ),
    settled,
  );
  assert.deepEqual(
    value(
      value(
        await reopened.readSnapshot(
          (o) => o.timeline.readTick({ sequence: 1 }),
          limits(),
        ),
      ),
    ),
    settled,
  );
  const next = {
    ...reserve('tick-2'),
    wallTime: value(parseWallTimeMs(-100)),
    elapsed: value(parseElapsedMs(0)),
    mode: 'DORMANT' as const,
    epoch: 'next',
  };
  const second = value(
    await reopened.transact((o) => o.timeline.reserveTick(next), limits()),
  );
  assert.equal(second.frame.sequence, 2);
  assert.equal(second.frame.previousCompleteTick, input.tickId);
  assert.equal(second.frame.wallTime, -100);
  assert.equal(second.frame.elapsed, 0);
});

test('T1: independent competing writers accept one reservation; the loser is conflict', async (t) => {
  const { state, open } = await fixture(t);
  const competitor = await open();
  const results = await Promise.all([
    state.transact((o) => o.timeline.reserveTick(reserve('a')), limits()),
    competitor.transact((o) => o.timeline.reserveTick(reserve('b')), limits()),
  ]);
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.deepEqual(
    results.find((r) => !r.ok),
    denied('conflict'),
  );
  const head = value(
    value(await state.readSnapshot((o) => o.timeline.readHead(), limits())),
  );
  assert.equal(head.lastSequence, 1);
  assert.equal(head.lastTick?.phase, 'reserved');
});

test('T1: duplicate IDs across agents, invalid transitions, stale revisions and action mismatch fail closed', async (t) => {
  const { state } = await fixture(t);
  const input = reserve();
  value(await state.transact((o) => o.timeline.reserveTick(input), limits()));
  assert.deepEqual(
    await state.transact((o) => o.other.reserveTick(input), limits()),
    denied('conflict'),
  );
  assert.deepEqual(
    await state.transact(
      (o) =>
        o.other.decide({
          tickId: input.tickId,
          expectedRevision: 0,
          actionRef: action,
        }),
      limits(),
    ),
    denied('conflict'),
  );
  const settle = {
    tickId: input.tickId,
    expectedRevision: 1 as const,
    actionRef: action,
    outcomeRef: outcome,
  };
  assert.deepEqual(
    await state.transact((o) => o.timeline.settle(settle), limits()),
    denied('conflict'),
  );
  const decide = {
    tickId: input.tickId,
    expectedRevision: 0 as const,
    actionRef: action,
  };
  value(await state.transact((o) => o.timeline.decide(decide), limits()));
  assert.deepEqual(
    await state.transact((o) => o.timeline.decide(decide), limits()),
    denied('conflict'),
  );
  assert.deepEqual(
    await state.transact(
      (o) =>
        o.timeline.settle({
          ...settle,
          actionRef: value(parseActionId('wrong')),
        }),
      limits(),
    ),
    denied('conflict'),
  );
  value(await state.transact((o) => o.timeline.settle(settle), limits()));
  assert.deepEqual(
    await state.transact((o) => o.timeline.settle(settle), limits()),
    denied('conflict'),
  );
  assert.deepEqual(
    await state.transact((o) => o.timeline.reserveTick(input), limits()),
    denied('conflict'),
  );
  assert.equal(
    value(
      value(
        await state.readSnapshot(
          (o) => o.other.readTick({ tickId: input.tickId }),
          limits(),
        ),
      ),
    ),
    null,
  );
  assert.equal(
    value(
      value(
        await state.readSnapshot(
          (o) => o.timeline.readTick({ sequence: 90 }),
          limits(),
        ),
      ),
    ),
    null,
  );
});

test('T1: resume preserves reserved as interrupted, decided stays undecided in outcome, terminal resume is idempotent', async (t) => {
  const { state, open } = await fixture(t);
  const first = reserve();
  value(await state.transact((o) => o.timeline.reserveTick(first), limits()));
  value(await state.close());
  const reopened = await open();
  const interrupted = value(
    await reopened.transact((o) => o.timeline.resume(), limits()),
  );
  assert.equal(interrupted.lastTick?.phase, 'interrupted');
  assert.equal(interrupted.lastTick?.revision, 1);
  assert.equal(interrupted.previousCompleteTick, null);
  assert.equal('actionRef' in (interrupted.lastTick ?? {}), false);
  assert.deepEqual(
    value(await reopened.transact((o) => o.timeline.resume(), limits())),
    interrupted,
  );
  const next = reserve('next');
  value(await reopened.transact((o) => o.timeline.reserveTick(next), limits()));
  const decided = value(
    await reopened.transact(
      (o) =>
        o.timeline.decide({
          tickId: next.tickId,
          expectedRevision: 0,
          actionRef: action,
        }),
      limits(),
    ),
  );
  value(await reopened.close());
  const third = await open();
  assert.deepEqual(
    value(await third.transact((o) => o.timeline.resume(), limits())).lastTick,
    decided,
  );
  assert.deepEqual(
    await third.transact(
      (o) => o.timeline.reserveTick(reserve('blocked')),
      limits(),
    ),
    denied('conflict'),
  );
  const settled = value(
    await third.transact(
      (o) =>
        o.timeline.settle({
          tickId: next.tickId,
          expectedRevision: 1,
          actionRef: action,
          outcomeRef: outcome,
        }),
      limits(),
    ),
  );
  assert.deepEqual(
    value(await third.transact((o) => o.timeline.resume(), limits())).lastTick,
    settled,
  );
});

test('T1: caller mutation cannot change reserved input or previously returned DTO', async (t) => {
  const { state } = await fixture(t);
  const input = { ...reserve() };
  const pending = state.transact((o) => {
    const result = o.timeline.reserveTick(input);
    input.epoch = 'changed after call';
    return result;
  }, limits());
  const saved = value(await pending);
  assert.equal(saved.frame.epoch, ' epoch:Exact ');
  assert.equal(Reflect.set(saved.frame, 'sequence', 100), false);
  assert.deepEqual(
    value(
      value(
        await state.readSnapshot(
          (o) => o.timeline.readTick({ sequence: 1 }),
          limits(),
        ),
      ),
    ),
    saved,
  );
});

test('T1: owner failure, SQL failure and cancellation roll back writes; durable sequence is reused', async (t) => {
  const { state, open } = await fixture(t);
  const rejected = await state.transact(async (o) => {
    value(await o.timeline.reserveTick(reserve()));
    value(
      await o.timeline.decide({
        tickId: reserve().tickId,
        expectedRevision: 0,
        actionRef: action,
      }),
    );
    value(
      await o.timeline.settle({
        tickId: reserve().tickId,
        expectedRevision: 1,
        actionRef: action,
        outcomeRef: outcome,
      }),
    );
    return { ok: false as const, error: { code: 'conflict' as const } };
  }, limits());
  assert.deepEqual(rejected, denied('conflict'));
  const sqlFailure = await state.transact(async (o) => {
    value(await o.timeline.reserveTick(reserve()));
    try {
      await o.sql.run('INSERT INTO missing_timeline_table VALUES (1)');
    } catch {
      /* scope remains poisoned */
    }
    return ok(undefined);
  }, limits());
  assert.equal(sqlFailure.ok, false);
  if (!sqlFailure.ok) assert.equal(sqlFailure.error.kind, 'storage');
  const controller = new AbortController();
  const cancelled = await state.transact(
    async (o) => {
      value(await o.timeline.reserveTick(reserve()));
      controller.abort();
      return ok(undefined);
    },
    { signal: controller.signal, timeoutMs: 10_000 },
  );
  assert.deepEqual(cancelled, {
    ok: false,
    error: { kind: 'storage', code: 'cancelled' },
  });
  value(await state.close());
  const reopened = await open();
  assert.equal(
    value(
      value(
        await reopened.readSnapshot((o) => o.timeline.readHead(), limits()),
      ),
    ).lastSequence,
    0,
  );
  assert.equal(
    value(
      await reopened.transact(
        (o) => o.timeline.reserveTick(reserve()),
        limits(),
      ),
    ).frame.sequence,
    1,
  );
});

test('T1: committed SQLite data is read back after a failed commit acknowledgement, without replay', async (t) => {
  const { state, open, path, migrations } = await fixture(t);
  value(await state.close());
  const adapter = value(
    await createSqliteAdapter({ path, migrations }, limits()),
  );
  let loseAcknowledgement = true;
  const boundary: StorageAdapter<SqlScope> = {
    begin: async (mode, options) => {
      const begun = await adapter.begin(mode, options);
      if (!begun.ok) return begun;
      const session = begun.value;
      return {
        ok: true,
        value: {
          scope: session.scope,
          get failure() {
            return session.failure;
          },
          finish: async (outcome) => {
            const result = await session.finish(outcome);
            if (outcome === 'commit' && result.ok && loseAcknowledgement) {
              loseAcknowledgement = false;
              return {
                ok: false,
                error: { kind: 'storage', code: 'write_failed' },
              };
            }
            return result;
          },
        },
      };
    },
    checkSchema: (options) => adapter.checkSchema(options),
    migrate: (options) => adapter.migrate(options),
    close: () => adapter.close(),
  };
  const uncertain = createState(boundary, (scope) =>
    bindTimeline(scope, agent),
  );
  let writes = 0;
  try {
    const result = await uncertain.transact(async (timeline) => {
      writes++;
      return timeline.reserveTick(reserve());
    }, limits());
    assert.deepEqual(result, {
      ok: false,
      error: { kind: 'storage', code: 'write_failed' },
    });
    assert.equal(writes, 1);
  } finally {
    value(await uncertain.close());
  }
  const reopened = await open();
  const saved = value(
    value(
      await reopened.readSnapshot(
        (o) => o.timeline.readTick({ sequence: 1 }),
        limits(),
      ),
    ),
  );
  assert.equal(saved?.phase, 'reserved');
  assert.deepEqual(
    await reopened.transact((o) => o.timeline.reserveTick(reserve()), limits()),
    denied('conflict'),
  );
  assert.equal(writes, 1);
});

test('T1: invalid inputs and exact read keys return bounded invalid_input without writes', async (t) => {
  const { state } = await fixture(t);
  const good = reserve();
  const cases: unknown[] = [
    null,
    {},
    { ...good, [Symbol('extra')]: 'canary' },
    Object.defineProperty({ ...good }, 'extra', {
      value: 'canary',
      enumerable: false,
    }),
    { ...good, extra: 'canary' },
    { ...good, epoch: '' },
    { ...good, tickId: '' },
    { ...good, elapsed: -1 },
    { ...good, elapsed: 0.1 },
    { ...good, wallTime: NaN },
    { ...good, wallTime: Number.MAX_SAFE_INTEGER + 1 },
    { ...good, mode: 'OTHER' },
    { ...good, policyRevision: null },
    { ...good, snapshotRevision: '' },
  ];
  for (const raw of cases)
    assert.deepEqual(
      await state.transact(
        (o) => o.timeline.reserveTick(raw as never),
        limits(),
      ),
      denied('invalid_input'),
    );
  for (const key of [
    {},
    { tickId: good.tickId, sequence: 1 },
    { sequence: 0 },
    { sequence: 1.5 },
    { tickId: null },
    { sequence: 1, extra: true },
  ]) {
    assert.deepEqual(
      value(
        await state.readSnapshot(
          (o) => o.timeline.readTick(key as never),
          limits(),
        ),
      ),
      { ok: false, error: { code: 'invalid_input' } },
    );
  }
  assert.equal(
    value(
      value(await state.readSnapshot((o) => o.timeline.readHead(), limits())),
    ).lastSequence,
    0,
  );
});

test('T1: all modes and exact time boundaries, signed zero and tokens survive real reopen', async (t) => {
  const { state, open } = await fixture(t);
  const modes = [
    'REACTIVE',
    'DELIBERATIVE',
    'CONTEMPLATIVE',
    'CONSOLIDATION',
    'DEVELOPMENTAL',
    'DORMANT',
  ] as const;
  const expected: TickRecord[] = [];
  for (const [index, mode] of modes.entries()) {
    const input = {
      ...reserve(` tick ${index} Ä `),
      mode,
      wallTime: value(
        parseWallTimeMs(
          index === 0
            ? -0
            : index === 1
              ? Number.MIN_SAFE_INTEGER
              : Number.MAX_SAFE_INTEGER,
        ),
      ),
      elapsed: value(
        parseElapsedMs(index === 0 ? -0 : Number.MAX_SAFE_INTEGER),
      ),
    };
    value(await state.transact((o) => o.timeline.reserveTick(input), limits()));
    const recovered = value(
      await state.transact((o) => o.timeline.resume(), limits()),
    );
    assert.ok(recovered.lastTick);
    expected.push(recovered.lastTick);
  }
  value(await state.close());
  const reopened = await open();
  for (const record of expected) {
    const saved = value(
      value(
        await reopened.readSnapshot(
          (o) => o.timeline.readTick({ sequence: record.frame.sequence }),
          limits(),
        ),
      ),
    );
    assert.deepEqual(saved, record);
  }
});

test('T1: malformed/version/phase/ref/link/metadata history is incompatible and is not rewritten', async (t) => {
  const { state } = await fixture(t);
  const initial = value(
    await state.transact((o) => o.timeline.reserveTick(reserve()), limits()),
  );
  const corruptions = [
    'not-json-canary',
    JSON.stringify({ ...initial, schemaVersion: 2 }),
    JSON.stringify({ ...initial, revision: 2 }),
    JSON.stringify({ ...initial, actionRef: action }),
    JSON.stringify({ ...initial, frame: { ...initial.frame, mode: 'OTHER' } }),
    JSON.stringify({ ...initial, frame: { ...initial.frame, elapsed: -1 } }),
    JSON.stringify({
      ...initial,
      frame: { ...initial.frame, previousCompleteTick: 'orphan' },
    }),
    JSON.stringify({
      ...initial,
      frame: { ...initial.frame, agentId: 'other' },
    }),
    JSON.stringify({
      ...initial,
      phase: 'settled',
      revision: 2,
      actionRef: action,
      outcomeRef: { sourceKind: 'bad' },
    }),
  ];
  for (const body of corruptions) {
    value(
      await state.transact(async (o) => {
        await o.sql.run(
          'UPDATE timeline_ticks SET body = ? WHERE tick_id = ?',
          [body, initial.frame.tickId],
        );
        return ok(undefined);
      }, limits()),
    );
    assert.deepEqual(
      value(await state.readSnapshot((o) => o.timeline.readHead(), limits())),
      { ok: false, error: { code: 'incompatible' } },
    );
    assert.deepEqual(
      await state.transact((o) => o.timeline.resume(), limits()),
      denied('incompatible'),
    );
    assert.deepEqual(
      value(
        await state.readSnapshot(
          (o) => o.sql.all('SELECT body FROM timeline_ticks'),
          limits(),
        ),
      ),
      [[body]],
    );
  }
});

test('T1: transition input/ref validation and detached outcome survive caller mutation', async (t) => {
  const { state } = await fixture(t);
  const first = reserve();
  value(await state.transact((o) => o.timeline.reserveTick(first), limits()));
  const decision = {
    tickId: first.tickId,
    expectedRevision: 0 as const,
    actionRef: action,
  };
  for (const raw of [
    null,
    { ...decision, extra: 'canary' },
    { ...decision, expectedRevision: 2 },
    { ...decision, actionRef: '' },
  ]) {
    assert.deepEqual(
      await state.transact((o) => o.timeline.decide(raw as never), limits()),
      denied('invalid_input'),
    );
  }
  value(await state.transact((o) => o.timeline.decide(decision), limits()));
  const settlement = {
    ...decision,
    expectedRevision: 1 as const,
    outcomeRef: outcome,
  };
  for (const raw of [
    null,
    { ...settlement, extra: true },
    { ...settlement, outcomeRef: { ...outcome, extra: 'canary' } },
    { ...settlement, outcomeRef: { ...outcome, revision: '' } },
  ]) {
    assert.deepEqual(
      await state.transact((o) => o.timeline.settle(raw as never), limits()),
      denied('invalid_input'),
    );
  }
  const mutable = { ...outcome };
  const settled = value(
    await state.transact((o) => {
      const pending = o.timeline.settle({ ...settlement, outcomeRef: mutable });
      mutable.id = 'changed after call';
      return pending;
    }, limits()),
  );
  assert.equal(settled.phase, 'settled');
  if (settled.phase === 'settled') {
    assert.equal(settled.outcomeRef.id, outcome.id);
    assert.equal(
      Reflect.set(settled.outcomeRef, 'id', 'changed result'),
      false,
    );
  }
  assert.deepEqual(
    value(
      value(
        await state.readSnapshot(
          (o) => o.timeline.readTick({ tickId: first.tickId }),
          limits(),
        ),
      ),
    ),
    settled,
  );
});

test('T1: an active older record is incompatible, and a snapshot cannot commit a reservation', async (t) => {
  const { state: snapshotState, open } = await fixture(t);
  const snapshotWrite = await snapshotState.readSnapshot(
    (o) => o.timeline.reserveTick(reserve()),
    limits(),
  );
  assert.equal(snapshotWrite.ok, false);
  value(await snapshotState.close());
  const state = await open();
  assert.equal(
    value(
      value(await state.readSnapshot((o) => o.timeline.readHead(), limits())),
    ).lastSequence,
    0,
  );
  const before = value(
    await state.transact((o) => o.timeline.reserveTick(reserve()), limits()),
  );
  value(await state.transact((o) => o.timeline.resume(), limits()));
  value(
    await state.transact(
      (o) => o.timeline.reserveTick(reserve('second')),
      limits(),
    ),
  );
  value(await state.transact((o) => o.timeline.resume(), limits()));
  value(
    await state.transact(async (o) => {
      await o.sql.run(
        'UPDATE timeline_ticks SET body = ?, phase = ? WHERE tick_id = ?',
        [JSON.stringify(before), 'reserved', before.frame.tickId],
      );
      return ok(undefined);
    }, limits()),
  );
  assert.deepEqual(
    value(await state.readSnapshot((o) => o.timeline.readHead(), limits())),
    { ok: false, error: { code: 'incompatible' } },
  );
});

test('T1: allowed sequence gaps read as absent; maximum sequence refuses overflow', async (t) => {
  const { state } = await fixture(t);
  value(
    await state.transact((o) => o.timeline.reserveTick(reserve()), limits()),
  );
  const terminal = value(
    await state.transact((o) => o.timeline.resume(), limits()),
  ).lastTick;
  assert.ok(terminal);
  const maximum = {
    ...terminal,
    frame: { ...terminal.frame, sequence: Number.MAX_SAFE_INTEGER },
  };
  value(
    await state.transact(async (o) => {
      await o.sql.run('UPDATE timeline_ticks SET sequence = ?, body = ?', [
        Number.MAX_SAFE_INTEGER,
        JSON.stringify(maximum),
      ]);
      return ok(undefined);
    }, limits()),
  );
  assert.equal(
    value(
      value(await state.readSnapshot((o) => o.timeline.readHead(), limits())),
    ).lastSequence,
    Number.MAX_SAFE_INTEGER,
  );
  assert.equal(
    value(
      value(
        await state.readSnapshot(
          (o) => o.timeline.readTick({ sequence: 1 }),
          limits(),
        ),
      ),
    ),
    null,
  );
  assert.deepEqual(
    await state.transact(
      (o) => o.timeline.reserveTick(reserve('overflow')),
      limits(),
    ),
    denied('conflict'),
  );
});
