import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as production from '@polyphony/core-types';
import type {
  ActionId,
  AgentId,
  ElapsedMs,
  EvidenceRef,
  PrimitiveFailure,
  Result,
  Revision,
  TickId,
  WallTimeMs,
} from '@polyphony/core-types';

type Parsers = typeof production;
type RawProjection = {
  agentId: unknown;
  tickId: unknown;
  actionRef: unknown;
  policyRevision: unknown;
  wallTime: unknown;
  elapsed: unknown;
  outcomeRef: unknown;
};
type Projection = {
  readonly agentId: AgentId;
  readonly tickId: TickId;
  readonly actionRef: ActionId;
  readonly policyRevision: Revision;
  readonly wallTime: WallTimeMs;
  readonly elapsed: ElapsedMs;
  readonly outcomeRef: EvidenceRef;
};

// Test consumer for the subset T1 needs; it performs no timeline transitions or I/O.
function consume(
  parsers: Parsers,
  input: RawProjection,
): Result<Projection, PrimitiveFailure> {
  const agentId = parsers.parseAgentId(input.agentId);
  if (!agentId.ok) return agentId;
  const tickId = parsers.parseTickId(input.tickId);
  if (!tickId.ok) return tickId;
  const actionRef = parsers.parseActionId(input.actionRef);
  if (!actionRef.ok) return actionRef;
  const policyRevision = parsers.parseRevision(input.policyRevision);
  if (!policyRevision.ok) return policyRevision;
  const wallTime = parsers.parseWallTimeMs(input.wallTime);
  if (!wallTime.ok) return wallTime;
  const elapsed = parsers.parseElapsedMs(input.elapsed);
  if (!elapsed.ok) return elapsed;
  const outcomeRef = parsers.parseEvidenceRef(input.outcomeRef);
  if (!outcomeRef.ok) return outcomeRef;
  return {
    ok: true,
    value: {
      agentId: agentId.value,
      tickId: tickId.value,
      actionRef: actionRef.value,
      policyRevision: policyRevision.value,
      wallTime: wallTime.value,
      elapsed: elapsed.value,
      outcomeRef: outcomeRef.value,
    },
  };
}

const refInput = Object.freeze({
  sourceKind: 'outcome',
  id: 'o',
  revision: ' hash:1 ',
});
const invalidRef = Object.freeze({ ...refInput, revision: '' });
const input = Object.freeze({
  agentId: 'a',
  tickId: 't',
  actionRef: 'x',
  policyRevision: ' policy:1 ',
  wallTime: -1,
  elapsed: 0,
  outcomeRef: refInput,
});
const failure = Object.freeze({
  ok: false as const,
  error: Object.freeze({ code: 'invalid_input' as const }),
});
const value = <T>(item: T): Result<T, PrimitiveFailure> =>
  Object.freeze({ ok: true, value: item });

function fixtureParser<T>(
  entries: readonly (readonly [unknown, Result<T, PrimitiveFailure>])[],
) {
  const fixtures = new Map(entries);
  return (raw: unknown): Result<T, PrimitiveFailure> => {
    const result = fixtures.get(raw);
    if (result === undefined)
      throw new Error('Input outside the bounded M1 fixture set');
    return result;
  };
}

// Accepted valid literals are branded only in this bounded test double.
// It never calls production parsers and is not a second validation framework.
const double: Parsers = {
  parseAgentId: fixtureParser([['a', value('a' as AgentId)]]),
  parseTickId: fixtureParser([['t', value('t' as TickId)]]),
  parseActionId: fixtureParser([['x', value('x' as ActionId)]]),
  parseRevision: fixtureParser([
    [' policy:1 ', value(' policy:1 ' as Revision)],
  ]),
  parseWallTimeMs: fixtureParser([[-1, value(-1 as WallTimeMs)]]),
  parseElapsedMs: fixtureParser([
    [0, value(0 as ElapsedMs)],
    [-1, failure],
  ]),
  parseEvidenceRef: fixtureParser([
    [
      refInput,
      value(Object.freeze({ ...refInput, revision: ' hash:1 ' as Revision })),
    ],
    [invalidRef, failure],
  ]),
};

for (const [name, parsers] of Object.entries({ production, double })) {
  test(`M1 unchanged T1-shaped consumer: ${name}`, () => {
    const expected = { ok: true, value: input };
    assert.deepEqual(consume(parsers, input), expected);
    assert.deepEqual(consume(parsers, { ...input, elapsed: -1 }), failure);
    assert.deepEqual(
      consume(parsers, { ...input, outcomeRef: invalidRef }),
      failure,
    );
    assert.deepEqual(consume(parsers, input), expected);
  });
}
