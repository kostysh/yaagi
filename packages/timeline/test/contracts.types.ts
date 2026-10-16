import type {
  ActionId,
  AgentId,
  ElapsedMs,
  Revision,
  TickId,
  WallTimeMs,
} from '@polyphony/core-types';
import type {
  TickFrame,
  TickRecord,
  TimelinePort,
} from '@polyphony/timeline/contracts';

function contract(frame: TickFrame, record: TickRecord, port: TimelinePort) {
  const agent: AgentId = frame.agentId;
  const tick: TickId = frame.tickId;
  const wall: WallTimeMs = frame.wallTime;
  const elapsed: ElapsedMs = frame.elapsed;
  const revision: Revision = frame.policyRevision;
  void [agent, tick, wall, elapsed, revision];
  // @ts-expect-error IDs retain their core-types nominal identity.
  const wrongAgent: AgentId = frame.tickId;
  // @ts-expect-error elapsed is not a wall timestamp.
  const wrongWall: WallTimeMs = frame.elapsed;
  // @ts-expect-error opaque policy revision is not transition revision.
  const wrongRevision: Revision = record.revision;
  // @ts-expect-error frames are immutable.
  frame.mode = 'DORMANT';
  // @ts-expect-error read keys select exactly one address.
  void port.readTick({ tickId: frame.tickId, sequence: 1 });
  if (record.phase === 'settled') {
    const action: ActionId = record.actionRef;
    const outcomeRevision: Revision = record.outcomeRef.revision;
    void [action, outcomeRevision];
    // @ts-expect-error outcome refs are immutable.
    record.outcomeRef.id = 'changed';
  } else if (record.phase === 'reserved' || record.phase === 'interrupted') {
    // @ts-expect-error no decision is invented for this phase.
    void record.actionRef;
    // @ts-expect-error no outcome exists in this phase.
    void record.outcomeRef;
  } else {
    const action: ActionId = record.actionRef;
    // @ts-expect-error decided is not settled.
    void record.outcomeRef;
    void action;
  }
  void [wrongAgent, wrongWall, wrongRevision];
}
void contract;
