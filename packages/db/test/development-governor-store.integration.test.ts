import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVELOPMENT_FREEZE_TRIGGER_KIND,
  DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE,
} from '@yaagi/contracts/governor';
import {
  createDevelopmentGovernorStore,
  type DevelopmentFreezeRow,
  type DevelopmentGovernorDbExecutor,
  type DevelopmentLedgerRow,
} from '../src/development-governor.ts';

type AgentStateRow = {
  id: number;
  agentId: string;
  mode: string;
  schemaVersion: string;
  bootStateJson: Record<string, unknown>;
  currentTickId: string | null;
  currentModelProfileId: string | null;
  lastStableSnapshotId: string | null;
  psmJson: Record<string, unknown>;
  resourcePostureJson: Record<string, unknown>;
  developmentFreeze: boolean;
  updatedAt: Date;
};

const createAgentStateRow = (): AgentStateRow => ({
  id: 1,
  agentId: 'polyphony-core',
  mode: 'normal',
  schemaVersion: '2026-04-10',
  bootStateJson: {},
  currentTickId: null,
  currentModelProfileId: null,
  lastStableSnapshotId: null,
  psmJson: {},
  resourcePostureJson: {},
  developmentFreeze: false,
  updatedAt: new Date('2026-04-10T12:00:00.000Z'),
});

const createGovernorDbHarness = (): {
  db: DevelopmentGovernorDbExecutor;
  freezes: DevelopmentFreezeRow[];
  ledger: DevelopmentLedgerRow[];
  agentState: AgentStateRow;
} => {
  const freezes: DevelopmentFreezeRow[] = [];
  const ledger: DevelopmentLedgerRow[] = [];
  const agentState = createAgentStateRow();

  const query = ((sqlText: unknown, params: unknown[] = []) => {
    if (typeof sqlText !== 'string') {
      throw new Error('development governor harness supports only text queries');
    }

    const sql = sqlText.replace(/\s+/g, ' ').trim().toLowerCase();

    if (sql === 'begin' || sql === 'commit' || sql === 'rollback') {
      return Promise.resolve({ rows: [] });
    }

    if (sql.startsWith('insert into polyphony_runtime.agent_state')) {
      agentState.agentId = typeof params[0] === 'string' ? params[0] : agentState.agentId;
      return Promise.resolve({ rows: [] });
    }

    if (sql.startsWith('update polyphony_runtime.agent_state set development_freeze')) {
      agentState.developmentFreeze = Boolean(params[0]);
      agentState.updatedAt = new Date('2026-04-10T12:01:00.000Z');
      return Promise.resolve({ rows: [agentState] });
    }

    if (
      sql.includes('from polyphony_runtime.development_freezes') &&
      sql.includes('where request_id = $1')
    ) {
      const row = freezes.find((entry) => entry.requestId === params[0]);
      return Promise.resolve({ rows: row ? [row] : [] });
    }

    if (sql.startsWith('insert into polyphony_runtime.development_freezes')) {
      const row: DevelopmentFreezeRow = {
        freezeId: String(params[0]),
        state: 'frozen',
        triggerKind: params[2] as DevelopmentFreezeRow['triggerKind'],
        originSurface: params[3] as DevelopmentFreezeRow['originSurface'],
        requestId: String(params[4]),
        normalizedRequestHash: String(params[5]),
        reason: String(params[6]),
        requestedBy: String(params[7]),
        evidenceRefsJson: JSON.parse(String(params[8])) as string[],
        createdAt: new Date(String(params[9])).toISOString(),
      };
      freezes.push(row);
      return Promise.resolve({ rows: [row] });
    }

    if (sql.startsWith('insert into polyphony_runtime.development_ledger')) {
      const row: DevelopmentLedgerRow = {
        ledgerId: String(params[0]),
        entryKind: params[1] as DevelopmentLedgerRow['entryKind'],
        originSurface: params[2] as DevelopmentLedgerRow['originSurface'],
        requestId: String(params[3]),
        freezeId: String(params[4]),
        proposalId: null,
        decisionId: null,
        evidenceRefsJson: JSON.parse(String(params[5])) as string[],
        payloadJson: JSON.parse(String(params[6])) as Record<string, unknown>,
        createdAt: new Date(String(params[7])).toISOString(),
      };
      ledger.push(row);
      return Promise.resolve({ rows: [row] });
    }

    if (
      sql.includes('from polyphony_runtime.development_freezes') &&
      sql.includes('where state = $1')
    ) {
      const [row] = [...freezes].sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      );
      return Promise.resolve({ rows: row ? [row] : [] });
    }

    throw new Error(`unsupported sql in development governor harness: ${sqlText}`);
  }) as DevelopmentGovernorDbExecutor['query'];

  return {
    db: { query },
    freezes,
    ledger,
    agentState,
  };
};

void test('AC-F0016-01 persists freeze requests through the governor store and runtime freeze flag', async () => {
  const harness = createGovernorDbHarness();
  const store = createDevelopmentGovernorStore(harness.db);

  const result = await store.freezeDevelopment({
    freezeId: 'development-freeze:1',
    ledgerId: 'development-ledger:1',
    triggerKind: DEVELOPMENT_FREEZE_TRIGGER_KIND.OPERATOR,
    originSurface: DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.OPERATOR_API,
    requestId: 'freeze-request-1',
    normalizedRequestHash: 'hash-1',
    reason: 'pause proposal intake',
    requestedBy: 'operator_api',
    evidenceRefs: ['operator:manual-control'],
    createdAt: '2026-04-10T12:00:00.000Z',
    payloadJson: { route: '/control/freeze-development' },
  });

  assert.equal(result.accepted, true);
  assert.equal(result.deduplicated, false);
  assert.equal(result.freeze.freezeId, 'development-freeze:1');
  assert.equal(harness.ledger.length, 1);
  assert.equal(harness.agentState.developmentFreeze, true);
});

void test('AC-F0016-02 makes freeze requests idempotent by request id and hash', async () => {
  const harness = createGovernorDbHarness();
  const store = createDevelopmentGovernorStore(harness.db);
  const input = {
    freezeId: 'development-freeze:1',
    ledgerId: 'development-ledger:1',
    triggerKind: DEVELOPMENT_FREEZE_TRIGGER_KIND.POLICY_AUTO,
    originSurface: DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.HOMEOSTAT,
    requestId: 'homeostat:development-proposals-critical',
    normalizedRequestHash: 'hash-1',
    reason: 'critical development_proposal_rate requested development proposal freeze',
    requestedBy: 'homeostat',
    evidenceRefs: ['development-governor:proposals:last-24h'],
    createdAt: '2026-04-10T12:00:00.000Z',
  };

  const first = await store.freezeDevelopment(input);
  const replay = await store.freezeDevelopment({
    ...input,
    freezeId: 'development-freeze:2',
    ledgerId: 'development-ledger:2',
  });
  const conflict = await store.freezeDevelopment({
    ...input,
    freezeId: 'development-freeze:3',
    ledgerId: 'development-ledger:3',
    normalizedRequestHash: 'hash-2',
  });

  assert.equal(first.accepted, true);
  assert.equal(replay.accepted, true);
  assert.equal(replay.deduplicated, true);
  assert.equal(replay.freeze.freezeId, 'development-freeze:1');
  assert.equal(harness.ledger.length, 1);
  assert.equal(conflict.accepted, false);
  assert.equal(conflict.reason, 'conflicting_request_id');
});

void test('AC-F0016-08 reloads the latest active freeze for startup recovery', async () => {
  const harness = createGovernorDbHarness();
  const store = createDevelopmentGovernorStore(harness.db);

  await store.freezeDevelopment({
    freezeId: 'development-freeze:old',
    ledgerId: 'development-ledger:old',
    triggerKind: DEVELOPMENT_FREEZE_TRIGGER_KIND.OPERATOR,
    originSurface: DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.OPERATOR_API,
    requestId: 'freeze-request-old',
    normalizedRequestHash: 'hash-old',
    reason: 'older active freeze',
    requestedBy: 'operator_api',
    evidenceRefs: ['operator:manual-control'],
    createdAt: '2026-04-10T12:00:00.000Z',
  });
  await store.freezeDevelopment({
    freezeId: 'development-freeze:new',
    ledgerId: 'development-ledger:new',
    triggerKind: DEVELOPMENT_FREEZE_TRIGGER_KIND.POLICY_AUTO,
    originSurface: DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.HOMEOSTAT,
    requestId: 'freeze-request-new',
    normalizedRequestHash: 'hash-new',
    reason: 'newer active freeze',
    requestedBy: 'homeostat',
    evidenceRefs: ['homeostat:development-proposal-rate'],
    createdAt: '2026-04-10T12:05:00.000Z',
  });

  const activeFreeze = await store.loadActiveFreeze();

  assert.equal(activeFreeze?.freezeId, 'development-freeze:new');
  assert.equal(activeFreeze?.requestId, 'freeze-request-new');
  assert.equal(harness.agentState.developmentFreeze, true);
});
