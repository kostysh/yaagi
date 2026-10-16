import {
  type ActionId,
  type AgentId,
  type ElapsedMs,
  type EvidenceRef,
  type PrimitiveFailure,
  type Result,
  type Revision,
  type TickId,
  type WallTimeMs,
  parseActionId,
  parseAgentId,
  parseElapsedMs,
  parseEvidenceRef,
  parseRevision,
  parseTickId,
  parseWallTimeMs,
} from '@polyphony/core-types';

declare const agent: AgentId;
declare const tick: TickId;
declare const action: ActionId;
declare const revision: Revision;
declare const wall: WallTimeMs;
declare const elapsed: ElapsedMs;

const ids: readonly string[] = [agent, tick, action, revision];
const times: readonly number[] = [wall, elapsed];
const outputs: readonly [
  Result<AgentId, PrimitiveFailure>,
  Result<TickId, PrimitiveFailure>,
  Result<ActionId, PrimitiveFailure>,
  Result<Revision, PrimitiveFailure>,
  Result<WallTimeMs, PrimitiveFailure>,
  Result<ElapsedMs, PrimitiveFailure>,
  Result<EvidenceRef, PrimitiveFailure>,
] = [
  parseAgentId('a'),
  parseTickId('t'),
  parseActionId('x'),
  parseRevision('v'),
  parseWallTimeMs(-1),
  parseElapsedMs(0),
  parseEvidenceRef({ sourceKind: 'outcome', id: 'o', revision: 'v' }),
];

// @ts-expect-error -- a raw string is not an AgentId.
const rawAgent: AgentId = 'a';
// @ts-expect-error -- a raw string is not a TickId.
const rawTick: TickId = 't';
// @ts-expect-error -- a raw string is not an ActionId.
const rawAction: ActionId = 'x';
// @ts-expect-error -- a raw string is not a Revision.
const rawRevision: Revision = 'v';
// @ts-expect-error -- a raw number is not WallTimeMs.
const rawWall: WallTimeMs = 0;
// @ts-expect-error -- a raw number is not ElapsedMs.
const rawElapsed: ElapsedMs = 0;

// @ts-expect-error -- AgentId cannot contain TickId.
const agentFromTick: AgentId = tick;
// @ts-expect-error -- AgentId cannot contain ActionId.
const agentFromAction: AgentId = action;
// @ts-expect-error -- AgentId cannot contain Revision.
const agentFromRevision: AgentId = revision;
// @ts-expect-error -- TickId cannot contain AgentId.
const tickFromAgent: TickId = agent;
// @ts-expect-error -- TickId cannot contain ActionId.
const tickFromAction: TickId = action;
// @ts-expect-error -- TickId cannot contain Revision.
const tickFromRevision: TickId = revision;
// @ts-expect-error -- ActionId cannot contain AgentId.
const actionFromAgent: ActionId = agent;
// @ts-expect-error -- ActionId cannot contain TickId.
const actionFromTick: ActionId = tick;
// @ts-expect-error -- ActionId cannot contain Revision.
const actionFromRevision: ActionId = revision;
// @ts-expect-error -- Revision cannot contain AgentId.
const revisionFromAgent: Revision = agent;
// @ts-expect-error -- Revision cannot contain TickId.
const revisionFromTick: Revision = tick;
// @ts-expect-error -- Revision cannot contain ActionId.
const revisionFromAction: Revision = action;
// @ts-expect-error -- wall time and duration are different domains.
const wallFromElapsed: WallTimeMs = elapsed;
// @ts-expect-error -- duration and wall time are different domains.
const elapsedFromWall: ElapsedMs = wall;

const ref: EvidenceRef = { sourceKind: 'outcome', id: 'o', revision };
// @ts-expect-error -- evidence fields are readonly.
ref.id = 'changed';
// @ts-expect-error -- evidence revision must be a checked Revision.
const rawRef: EvidenceRef = { sourceKind: 'outcome', id: 'o', revision: 'v' };
const parsed = parseEvidenceRef(ref);
if (parsed.ok) {
  const value: EvidenceRef = parsed.value;
  // @ts-expect-error -- result payload is readonly.
  parsed.value = value;
  // @ts-expect-error -- the other result branch is unavailable.
  void parsed.error;
} else {
  const code: 'invalid_input' = parsed.error.code;
  // @ts-expect-error -- failure code is readonly.
  parsed.error.code = code;
}
// @ts-expect-error -- portable consumer fixtures do not acquire Node globals.
void process;

void [
  ids,
  times,
  outputs,
  rawAgent,
  rawTick,
  rawAction,
  rawRevision,
  rawWall,
  rawElapsed,
  agentFromTick,
  agentFromAction,
  agentFromRevision,
  tickFromAgent,
  tickFromAction,
  tickFromRevision,
  actionFromAgent,
  actionFromTick,
  actionFromRevision,
  revisionFromAgent,
  revisionFromTick,
  revisionFromAction,
  wallFromElapsed,
  elapsedFromWall,
  rawRef,
];
