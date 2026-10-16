import assert from 'node:assert/strict';
import test from 'node:test';
import { parseActionId, type Result } from '@polyphony/core-types';
import type { OwnerFailure, StorageFailure } from '@polyphony/state/contracts';
import type {
  TickRecord,
  TimelineFailure,
  TimelineHead,
  TimelinePort,
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

function ownerResult<T>(
  result: Result<T, StorageFailure | OwnerFailure<TimelineFailure>>,
): Result<T, TimelineFailure> {
  if (result.ok) return result;
  if (result.error.kind !== 'owner')
    throw new Error(`Unexpected storage failure: ${result.error.code}`);
  return { ok: false, error: result.error.error };
}

// Unchanged consumer: no knowledge of SQLite, callbacks or the alternative.
async function consumer(port: TimelinePort) {
  assert.deepEqual(await port.reserveTick({ ...reserve(), epoch: '' }), {
    ok: false,
    error: { code: 'invalid_input' },
  });
  value(await port.reserveTick(reserve('interrupted')));
  assert.deepEqual(await port.reserveTick(reserve('blocked')), {
    ok: false,
    error: { code: 'conflict' },
  });
  const interrupted = value(await port.resume());
  assert.equal(interrupted.lastTick?.phase, 'interrupted');
  assert.deepEqual(value(await port.resume()), interrupted);
  const next = reserve('decided');
  const saved = value(await port.reserveTick(next));
  assert.equal(saved.frame.sequence, 2);
  assert.equal(saved.frame.previousCompleteTick, null);
  const decided = value(
    await port.decide({
      tickId: next.tickId,
      expectedRevision: 0,
      actionRef: action,
    }),
  );
  assert.deepEqual(value(await port.resume()).lastTick, decided);
  const settlement = {
    tickId: next.tickId,
    expectedRevision: 1 as const,
    actionRef: action,
    outcomeRef: outcome,
  };
  assert.deepEqual(
    await port.settle({
      ...settlement,
      actionRef: value(parseActionId('wrong')),
    }),
    { ok: false, error: { code: 'conflict' } },
  );
  const settled = value(await port.settle(settlement));
  assert.deepEqual(await port.settle(settlement), {
    ok: false,
    error: { code: 'conflict' },
  });
  assert.deepEqual(value(await port.readTick({ sequence: 2 })), settled);
  assert.equal(value(await port.readHead()).previousCompleteTick, next.tickId);
  const final = value(await port.reserveTick(reserve('final')));
  assert.equal(final.frame.sequence, 3);
  assert.equal(final.frame.previousCompleteTick, next.tickId);
}

// Bounded independent test-only alternative for these same public scenarios.
// It does not call production schemas/parsers, persist, or claim SQL fidelity.
function alternative(): TimelinePort {
  const records: TickRecord[] = [];
  const success = <T>(value: T): Result<T, TimelineFailure> =>
    Object.freeze({ ok: true, value });
  const failure = (
    code: TimelineFailure['code'],
  ): Result<never, TimelineFailure> => ({ ok: false, error: { code } });
  const current = (): TimelineHead => {
    const lastTick = records.at(-1) ?? null;
    return Object.freeze({
      lastSequence: lastTick?.frame.sequence ?? 0,
      previousCompleteTick:
        lastTick?.phase === 'settled'
          ? lastTick.frame.tickId
          : (lastTick?.frame.previousCompleteTick ?? null),
      lastTick,
    });
  };
  const replace = (record: TickRecord) => {
    const index = records.findIndex(
      (before) => before.frame.tickId === record.frame.tickId,
    );
    records[index] = record;
    return success(record);
  };
  return {
    reserveTick: async (input) => {
      if (!input.epoch) return failure('invalid_input');
      const head = current();
      if (
        head.lastTick?.phase === 'reserved' ||
        head.lastTick?.phase === 'decided' ||
        records.some((record) => record.frame.tickId === input.tickId)
      )
        return failure('conflict');
      const record: TickRecord = Object.freeze({
        schemaVersion: 1,
        phase: 'reserved',
        revision: 0,
        frame: Object.freeze({
          ...input,
          agentId: agent,
          sequence: head.lastSequence + 1,
          previousCompleteTick: head.previousCompleteTick,
        }),
      });
      records.push(record);
      return success(record);
    },
    decide: async (input) => {
      const before = records.find((r) => r.frame.tickId === input.tickId);
      if (before?.phase !== 'reserved' || input.expectedRevision !== 0)
        return failure('conflict');
      return replace(
        Object.freeze({
          ...before,
          phase: 'decided',
          revision: 1,
          actionRef: input.actionRef,
        }),
      );
    },
    settle: async (input) => {
      const before = records.find((r) => r.frame.tickId === input.tickId);
      if (
        before?.phase !== 'decided' ||
        input.expectedRevision !== 1 ||
        before.actionRef !== input.actionRef
      )
        return failure('conflict');
      return replace(
        Object.freeze({
          ...before,
          phase: 'settled',
          revision: 2,
          outcomeRef: Object.freeze({ ...input.outcomeRef }),
        }),
      );
    },
    resume: async () => {
      const before = records.at(-1);
      if (before?.phase === 'reserved')
        replace(
          Object.freeze({ ...before, phase: 'interrupted', revision: 1 }),
        );
      return success(current());
    },
    readTick: async (key) =>
      success(
        records.find((r) =>
          'tickId' in key
            ? r.frame.tickId === key.tickId
            : r.frame.sequence === key.sequence,
        ) ?? null,
      ),
    readHead: async () => success(current()),
  };
}

test('M1: unchanged consumer with production TimelinePort and real state', async (t) => {
  const { state } = await fixture(t);
  await consumer({
    reserveTick: async (input) =>
      ownerResult(
        await state.transact((o) => o.timeline.reserveTick(input), limits()),
      ),
    decide: async (input) =>
      ownerResult(
        await state.transact((o) => o.timeline.decide(input), limits()),
      ),
    settle: async (input) =>
      ownerResult(
        await state.transact((o) => o.timeline.settle(input), limits()),
      ),
    resume: async () =>
      ownerResult(await state.transact((o) => o.timeline.resume(), limits())),
    readTick: async (key) =>
      value(
        await state.readSnapshot((o) => o.timeline.readTick(key), limits()),
      ),
    readHead: async () =>
      value(await state.readSnapshot((o) => o.timeline.readHead(), limits())),
  });
});
test('M1: unchanged consumer with a compatible bounded test-only alternative', async () => {
  await consumer(alternative());
});
