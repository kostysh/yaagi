import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BODY_CHANGE_EVENT_KIND,
  BODY_CHANGE_REQUESTED_BY_OWNER,
  BODY_CHANGE_SCOPE_KIND,
  BODY_CHANGE_STATUS,
} from '@yaagi/contracts/body-evolution';
import {
  createBodyEvolutionStore,
  type BodyChangeEventRow,
  type BodyChangeProposalRow,
  type BodyStableSnapshotRow,
  type BodyEvolutionDbExecutor,
} from '../src/body-evolution.ts';

// Coverage refs: AC-F0017-04 AC-F0017-05 AC-F0017-09 AC-F0017-10 AC-F0017-11
// Coverage refs: AC-F0017-12 AC-F0017-13 AC-F0017-14 AC-F0017-15
// Coverage refs: AC-F0017-16 AC-F0017-17 AC-F0017-19 AC-F0017-20 AC-F0017-21
// Coverage refs: AC-F0017-22 AC-F0017-23 AC-F0017-25 AC-F0017-26 AC-F0017-27 AC-F0017-28

const createdAt = '2026-04-10T18:00:00.000Z';

const createProposalInput = (
  overrides: Partial<
    Parameters<ReturnType<typeof createBodyEvolutionStore>['recordProposal']>[0]
  > = {},
) => ({
  proposalId: 'body-change-proposal:1',
  eventId: 'body-change-event:1',
  requestId: 'body-change-request:1',
  normalizedRequestHash: 'body-change-hash:1',
  requestedByOwner: BODY_CHANGE_REQUESTED_BY_OWNER.GOVERNOR,
  governorProposalId: 'development-proposal:1',
  governorDecisionRef: 'development-proposal-decision:1',
  ownerOverrideEvidenceRef: null,
  branchName: 'agent/proposals/body-change-request-1',
  worktreePath: '/workspace/body/.yaagi/body-proposals/body-change-request-1',
  scopeKind: BODY_CHANGE_SCOPE_KIND.CODE,
  requiredEvalSuite: 'body-evolution.boundary',
  targetPaths: ['src/body/body-evolution.ts'],
  rollbackPlanRef: 'rollback:body-change:1',
  evidenceRefs: ['governor:decision:1'],
  createdAt,
  payloadJson: {
    owner: 'F-0017',
    slice: 'SL-F0017-01',
    actorSource: BODY_CHANGE_REQUESTED_BY_OWNER.GOVERNOR,
    branchName: 'agent/proposals/body-change-request-1',
    worktreePath: '/workspace/body/.yaagi/body-proposals/body-change-request-1',
    candidateCommitSha: null,
    stableSnapshotId: null,
    evalResult: null,
  },
  ...overrides,
});

const createBodyEvolutionDbHarness = (): {
  db: BodyEvolutionDbExecutor;
  proposals: BodyChangeProposalRow[];
  events: BodyChangeEventRow[];
  snapshots: BodyStableSnapshotRow[];
  queries: string[];
} => {
  const proposals: BodyChangeProposalRow[] = [];
  const events: BodyChangeEventRow[] = [];
  const snapshots: BodyStableSnapshotRow[] = [];
  const queries: string[] = [];

  const query = (sqlText: unknown, params: unknown[] = []) => {
    if (typeof sqlText !== 'string') {
      throw new Error('body evolution harness supports only text queries');
    }

    const sql = sqlText.replace(/\s+/g, ' ').trim().toLowerCase();
    queries.push(sql);

    if (sql === 'begin' || sql === 'commit' || sql === 'rollback') {
      return Promise.resolve({ rows: [] });
    }

    if (
      sql.includes('from polyphony_runtime.code_change_proposals') &&
      sql.includes('where request_id = $1')
    ) {
      const row = proposals.find((entry) => entry.requestId === params[0]);
      return Promise.resolve({ rows: row ? [row] : [] });
    }

    if (
      sql.includes('from polyphony_runtime.code_change_proposals') &&
      sql.includes('where proposal_id = $1')
    ) {
      const row = proposals.find((entry) => entry.proposalId === params[0]);
      return Promise.resolve({ rows: row ? [row] : [] });
    }

    if (sql.startsWith('insert into polyphony_runtime.code_change_proposals')) {
      const row: BodyChangeProposalRow = {
        proposalId: String(params[0]),
        requestId: String(params[1]),
        normalizedRequestHash: String(params[2]),
        requestedByOwner: params[3] as BodyChangeProposalRow['requestedByOwner'],
        governorProposalId: typeof params[4] === 'string' ? params[4] : null,
        governorDecisionRef: typeof params[5] === 'string' ? params[5] : null,
        ownerOverrideEvidenceRef: typeof params[6] === 'string' ? params[6] : null,
        branchName: String(params[7]),
        worktreePath: String(params[8]),
        candidateCommitSha: null,
        stableSnapshotId: null,
        status: params[9] as BodyChangeProposalRow['status'],
        scopeKind: params[10] as BodyChangeProposalRow['scopeKind'],
        requiredEvalSuite: String(params[11]),
        targetPathsJson: JSON.parse(String(params[12])) as string[],
        rollbackPlanRef: String(params[13]),
        evidenceRefsJson: JSON.parse(String(params[14])) as string[],
        createdAt: new Date(String(params[15])).toISOString(),
        updatedAt: new Date(String(params[15])).toISOString(),
      };
      proposals.push(row);
      return Promise.resolve({ rows: [row] });
    }

    if (sql.startsWith('insert into polyphony_runtime.body_change_events')) {
      const row: BodyChangeEventRow = {
        eventId: String(params[0]),
        proposalId: String(params[1]),
        eventKind: params[2] as BodyChangeEventRow['eventKind'],
        status: params[3] as BodyChangeEventRow['status'],
        evidenceRefsJson: JSON.parse(String(params[4])) as string[],
        payloadJson: JSON.parse(String(params[5])) as Record<string, unknown>,
        createdAt: new Date(String(params[6])).toISOString(),
      };
      events.push(row);
      return Promise.resolve({ rows: [row] });
    }

    if (sql.startsWith('update polyphony_runtime.code_change_proposals')) {
      const row = proposals.find((entry) => entry.proposalId === params[0]);
      if (!row) {
        return Promise.resolve({ rows: [] });
      }

      row.status = params[1] as BodyChangeProposalRow['status'];
      row.candidateCommitSha = typeof params[2] === 'string' ? params[2] : null;
      row.stableSnapshotId = typeof params[3] === 'string' ? params[3] : null;
      row.updatedAt = new Date(String(params[4])).toISOString();
      return Promise.resolve({ rows: [row] });
    }

    if (
      sql.includes('from polyphony_runtime.body_change_events') &&
      sql.includes('where proposal_id = $1')
    ) {
      const rows = events.filter((entry) => entry.proposalId === params[0]);
      return Promise.resolve({ rows });
    }

    if (
      sql.includes('from polyphony_runtime.stable_snapshots') &&
      sql.includes('where proposal_id = $1')
    ) {
      const row = snapshots.find((entry) => entry.proposalId === params[0]);
      return Promise.resolve({ rows: row ? [row] : [] });
    }

    if (
      sql.includes('from polyphony_runtime.stable_snapshots') &&
      sql.includes('where snapshot_id = $1')
    ) {
      const row = snapshots.find((entry) => entry.snapshotId === params[0]);
      return Promise.resolve({ rows: row ? [row] : [] });
    }

    if (sql.startsWith('insert into polyphony_runtime.stable_snapshots')) {
      const row: BodyStableSnapshotRow = {
        snapshotId: String(params[0]),
        proposalId: String(params[1]),
        gitTag: String(params[2]),
        schemaVersion: String(params[3]),
        modelProfileMapJson: JSON.parse(String(params[4])) as Record<string, string>,
        criticalConfigHash: String(params[5]),
        evalSummaryJson: JSON.parse(String(params[6])) as Record<string, unknown>,
        manifestHash: String(params[7]),
        manifestPath: String(params[8]),
        createdAt: new Date(String(params[9])).toISOString(),
      };
      snapshots.push(row);
      return Promise.resolve({ rows: [row] });
    }

    throw new Error(`unexpected body evolution query: ${sql}`);
  };

  return {
    db: { query } as BodyEvolutionDbExecutor,
    proposals,
    events,
    snapshots,
    queries,
  };
};

void test('AC-F0017-09 through AC-F0017-15 persist body change proposal and event rows', async () => {
  const harness = createBodyEvolutionDbHarness();
  const store = createBodyEvolutionStore(harness.db);

  const result = await store.recordProposal(createProposalInput());

  assert.equal(result.accepted, true);
  assert.equal(result.deduplicated, false);
  assert.equal(result.proposal.proposalId, 'body-change-proposal:1');
  assert.equal(result.proposal.governorProposalId, 'development-proposal:1');
  assert.equal(result.proposal.branchName, 'agent/proposals/body-change-request-1');
  assert.equal(
    result.proposal.worktreePath,
    '/workspace/body/.yaagi/body-proposals/body-change-request-1',
  );
  assert.equal(result.proposal.status, BODY_CHANGE_STATUS.REQUESTED);
  assert.equal(result.proposal.requiredEvalSuite, 'body-evolution.boundary');
  assert.deepEqual(result.proposal.evidenceRefsJson, ['governor:decision:1']);
  assert.equal(result.event?.eventKind, BODY_CHANGE_EVENT_KIND.PROPOSAL_RECORDED);
  assert.equal(result.event?.payloadJson['branchName'], 'agent/proposals/body-change-request-1');
  assert.equal(
    result.event?.payloadJson['worktreePath'],
    '/workspace/body/.yaagi/body-proposals/body-change-request-1',
  );
  assert.equal(result.event?.payloadJson['actorSource'], BODY_CHANGE_REQUESTED_BY_OWNER.GOVERNOR);
  assert.equal(harness.proposals.length, 1);
  assert.equal(harness.events.length, 1);
});

void test('AC-F0017-04 returns existing proposal for the same normalized request hash', async () => {
  const harness = createBodyEvolutionDbHarness();
  const store = createBodyEvolutionStore(harness.db);

  await store.recordProposal(createProposalInput());
  const replay = await store.recordProposal(
    createProposalInput({
      proposalId: 'body-change-proposal:replay',
      eventId: 'body-change-event:replay',
    }),
  );

  assert.equal(replay.accepted, true);
  assert.equal(replay.deduplicated, true);
  assert.equal(replay.proposal.proposalId, 'body-change-proposal:1');
  assert.equal(replay.event, null);
  assert.equal(harness.proposals.length, 1);
  assert.equal(harness.events.length, 1);
});

void test('AC-F0017-05 rejects request id replay with a different normalized hash', async () => {
  const harness = createBodyEvolutionDbHarness();
  const store = createBodyEvolutionStore(harness.db);

  await store.recordProposal(createProposalInput());
  const conflict = await store.recordProposal(
    createProposalInput({
      proposalId: 'body-change-proposal:conflict',
      eventId: 'body-change-event:conflict',
      normalizedRequestHash: 'body-change-hash:2',
    }),
  );

  assert.equal(conflict.accepted, false);
  assert.equal(conflict.reason, 'request_hash_conflict');
  assert.equal(conflict.proposal.proposalId, 'body-change-proposal:1');
  assert.equal(harness.proposals.length, 1);
  assert.equal(harness.events.length, 1);
});

void test('AC-F0017-04 recovers deterministic replay after concurrent request_id insert race', async () => {
  const existingRow: BodyChangeProposalRow = {
    proposalId: 'body-change-proposal:race',
    requestId: 'body-change-request:race',
    normalizedRequestHash: 'body-change-hash:race',
    requestedByOwner: BODY_CHANGE_REQUESTED_BY_OWNER.GOVERNOR,
    governorProposalId: 'development-proposal:race',
    governorDecisionRef: 'development-proposal-decision:race',
    ownerOverrideEvidenceRef: null,
    branchName: 'agent/proposals/body-change-request-race',
    worktreePath: '/workspace/body/.yaagi/body-proposals/body-change-request-race',
    candidateCommitSha: null,
    stableSnapshotId: null,
    status: BODY_CHANGE_STATUS.REQUESTED,
    scopeKind: BODY_CHANGE_SCOPE_KIND.CODE,
    requiredEvalSuite: 'body-evolution.boundary',
    targetPathsJson: ['src/body/body-evolution.ts'],
    rollbackPlanRef: 'rollback:body-change:race',
    evidenceRefsJson: ['governor:decision:race'],
    createdAt,
    updatedAt: createdAt,
  };
  let requestLookupCount = 0;
  const query: BodyEvolutionDbExecutor['query'] = ((sqlText: unknown) => {
    if (typeof sqlText !== 'string') {
      throw new Error('body evolution harness supports only text queries');
    }

    const sql = sqlText.replace(/\s+/g, ' ').trim().toLowerCase();
    if (sql === 'begin' || sql === 'commit' || sql === 'rollback') {
      return Promise.resolve({ rows: [] });
    }

    if (
      sql.includes('from polyphony_runtime.code_change_proposals') &&
      sql.includes('where request_id = $1')
    ) {
      requestLookupCount += 1;
      return Promise.resolve({ rows: requestLookupCount === 1 ? [] : [existingRow] });
    }

    if (sql.startsWith('insert into polyphony_runtime.code_change_proposals')) {
      return Promise.resolve({ rows: [] });
    }

    throw new Error(`unexpected body evolution race query: ${sql}`);
  }) as BodyEvolutionDbExecutor['query'];
  const db: BodyEvolutionDbExecutor = { query };
  const store = createBodyEvolutionStore(db);

  const replay = await store.recordProposal(
    createProposalInput({
      proposalId: 'body-change-proposal:new',
      eventId: 'body-change-event:new',
      requestId: existingRow.requestId,
      normalizedRequestHash: existingRow.normalizedRequestHash,
    }),
  );

  assert.equal(replay.accepted, true);
  assert.equal(replay.deduplicated, true);
  assert.equal(replay.proposal.proposalId, existingRow.proposalId);
  assert.equal(replay.event, null);
});

void test('AC-F0017-05 recovers concurrent request_id insert race as hash conflict when payload changed', async () => {
  const existingRow: BodyChangeProposalRow = {
    proposalId: 'body-change-proposal:race',
    requestId: 'body-change-request:race',
    normalizedRequestHash: 'body-change-hash:race',
    requestedByOwner: BODY_CHANGE_REQUESTED_BY_OWNER.GOVERNOR,
    governorProposalId: 'development-proposal:race',
    governorDecisionRef: 'development-proposal-decision:race',
    ownerOverrideEvidenceRef: null,
    branchName: 'agent/proposals/body-change-request-race',
    worktreePath: '/workspace/body/.yaagi/body-proposals/body-change-request-race',
    candidateCommitSha: null,
    stableSnapshotId: null,
    status: BODY_CHANGE_STATUS.REQUESTED,
    scopeKind: BODY_CHANGE_SCOPE_KIND.CODE,
    requiredEvalSuite: 'body-evolution.boundary',
    targetPathsJson: ['src/body/body-evolution.ts'],
    rollbackPlanRef: 'rollback:body-change:race',
    evidenceRefsJson: ['governor:decision:race'],
    createdAt,
    updatedAt: createdAt,
  };
  let requestLookupCount = 0;
  const query: BodyEvolutionDbExecutor['query'] = ((sqlText: unknown) => {
    if (typeof sqlText !== 'string') {
      throw new Error('body evolution harness supports only text queries');
    }

    const sql = sqlText.replace(/\s+/g, ' ').trim().toLowerCase();
    if (sql === 'begin' || sql === 'commit' || sql === 'rollback') {
      return Promise.resolve({ rows: [] });
    }

    if (
      sql.includes('from polyphony_runtime.code_change_proposals') &&
      sql.includes('where request_id = $1')
    ) {
      requestLookupCount += 1;
      return Promise.resolve({ rows: requestLookupCount === 1 ? [] : [existingRow] });
    }

    if (sql.startsWith('insert into polyphony_runtime.code_change_proposals')) {
      return Promise.resolve({ rows: [] });
    }

    throw new Error(`unexpected body evolution race query: ${sql}`);
  }) as BodyEvolutionDbExecutor['query'];
  const db: BodyEvolutionDbExecutor = { query };
  const store = createBodyEvolutionStore(db);

  const conflict = await store.recordProposal(
    createProposalInput({
      proposalId: 'body-change-proposal:new',
      eventId: 'body-change-event:new',
      requestId: existingRow.requestId,
      normalizedRequestHash: 'body-change-hash:changed',
    }),
  );

  assert.equal(conflict.accepted, false);
  assert.equal(conflict.reason, 'request_hash_conflict');
  assert.equal(conflict.proposal.proposalId, existingRow.proposalId);
});

void test('AC-F0017-16 / AC-F0017-17 transition lifecycle events update proposal status and candidate commit sha', async () => {
  const harness = createBodyEvolutionDbHarness();
  const store = createBodyEvolutionStore(harness.db);

  await store.recordProposal(createProposalInput());
  const worktreeReady = await store.recordLifecycleEvent({
    proposalId: 'body-change-proposal:1',
    eventId: 'body-change-event:worktree-ready',
    eventKind: BODY_CHANGE_EVENT_KIND.WORKTREE_PREPARED,
    status: BODY_CHANGE_STATUS.WORKTREE_READY,
    evidenceRefs: ['body-change:worktree:1'],
    createdAt,
    expectedCurrentStatuses: [BODY_CHANGE_STATUS.REQUESTED],
    payloadJson: {
      branchName: 'agent/proposals/body-change-request-1',
    },
  });
  const evaluating = await store.recordLifecycleEvent({
    proposalId: 'body-change-proposal:1',
    eventId: 'body-change-event:evaluating',
    eventKind: BODY_CHANGE_EVENT_KIND.EVALUATION_STARTED,
    status: BODY_CHANGE_STATUS.EVALUATING,
    evidenceRefs: ['body-change:evaluating:1'],
    createdAt,
    expectedCurrentStatuses: [BODY_CHANGE_STATUS.WORKTREE_READY],
    payloadJson: {
      requiredEvalSuite: 'body-evolution.boundary',
    },
  });
  const candidateCommitted = await store.recordLifecycleEvent({
    proposalId: 'body-change-proposal:1',
    eventId: 'body-change-event:candidate-committed',
    eventKind: BODY_CHANGE_EVENT_KIND.CANDIDATE_COMMITTED,
    status: BODY_CHANGE_STATUS.CANDIDATE_COMMITTED,
    evidenceRefs: ['body-change:candidate:1'],
    createdAt,
    expectedCurrentStatuses: [BODY_CHANGE_STATUS.EVALUATING],
    candidateCommitSha: 'abcdef123456',
    payloadJson: {
      candidateCommitSha: 'abcdef123456',
    },
  });

  assert.equal(worktreeReady.accepted, true);
  assert.equal(evaluating.accepted, true);
  assert.equal(candidateCommitted.accepted, true);
  assert.equal(candidateCommitted.proposal.status, BODY_CHANGE_STATUS.CANDIDATE_COMMITTED);
  assert.equal(candidateCommitted.proposal.candidateCommitSha, 'abcdef123456');
  assert.equal(harness.events.length, 4);
});

void test('recordLifecycleEvent rejects invalid status transitions before mutating proposal state', async () => {
  const harness = createBodyEvolutionDbHarness();
  const store = createBodyEvolutionStore(harness.db);

  await store.recordProposal(createProposalInput());
  const invalid = await store.recordLifecycleEvent({
    proposalId: 'body-change-proposal:1',
    eventId: 'body-change-event:invalid',
    eventKind: BODY_CHANGE_EVENT_KIND.CANDIDATE_COMMITTED,
    status: BODY_CHANGE_STATUS.CANDIDATE_COMMITTED,
    evidenceRefs: ['body-change:candidate:1'],
    createdAt,
    expectedCurrentStatuses: [BODY_CHANGE_STATUS.EVALUATING],
    candidateCommitSha: 'abcdef123456',
  });

  assert.equal(invalid.accepted, false);
  assert.equal(invalid.reason, 'invalid_status');
  assert.equal(harness.events.length, 1);
  assert.equal(harness.proposals[0]?.status, BODY_CHANGE_STATUS.REQUESTED);
});

void test('AC-F0017-19 through AC-F0017-23 publish stable snapshots and persist manifest fields', async () => {
  const harness = createBodyEvolutionDbHarness();
  const store = createBodyEvolutionStore(harness.db);

  await store.recordProposal(createProposalInput());
  const persistedProposal = harness.proposals[0];
  assert.ok(persistedProposal);
  persistedProposal.status = BODY_CHANGE_STATUS.CANDIDATE_COMMITTED;
  persistedProposal.candidateCommitSha = 'abcdef123456';
  const result = await store.publishStableSnapshot({
    snapshotId: 'stable-snapshot:1',
    proposalId: 'body-change-proposal:1',
    eventId: 'body-change-event:snapshot',
    gitTag: 'stable/stable-snapshot:1',
    schemaVersion: '2026-04-13',
    modelProfileMapJson: {
      reflex: 'model-profile:reflex.fast@baseline',
    },
    criticalConfigHash: 'deadbeef',
    evalSummaryJson: {
      suite: 'body-evolution.boundary',
      verdict: 'pass',
    },
    manifestHash: 'hash:snapshot:1',
    manifestPath: '/runtime/data/snapshots/stable-snapshot-1.json',
    evidenceRefs: ['body-change:snapshot:1'],
    createdAt,
    expectedCurrentStatuses: [BODY_CHANGE_STATUS.CANDIDATE_COMMITTED],
    payloadJson: {
      snapshotId: 'stable-snapshot:1',
    },
  });

  assert.equal(result.accepted, true);
  assert.equal(result.deduplicated, false);
  assert.equal(result.snapshot.gitTag, 'stable/stable-snapshot:1');
  assert.equal(result.snapshot.schemaVersion, '2026-04-13');
  assert.equal(result.snapshot.modelProfileMapJson['reflex'], 'model-profile:reflex.fast@baseline');
  assert.equal(result.snapshot.criticalConfigHash, 'deadbeef');
  assert.equal(result.snapshot.evalSummaryJson['verdict'], 'pass');
  assert.equal(result.proposal.status, BODY_CHANGE_STATUS.SNAPSHOT_READY);
  assert.equal(result.proposal.stableSnapshotId, 'stable-snapshot:1');
  assert.equal(harness.snapshots.length, 1);
  assert.equal(
    harness.queries.some((sql) => sql.includes('polyphony_runtime.agent_state')),
    false,
  );
});

void test('publishStableSnapshot deduplicates same manifest hash for the same proposal', async () => {
  const harness = createBodyEvolutionDbHarness();
  const store = createBodyEvolutionStore(harness.db);

  await store.recordProposal(createProposalInput());
  const persistedProposal = harness.proposals[0];
  assert.ok(persistedProposal);
  persistedProposal.status = BODY_CHANGE_STATUS.CANDIDATE_COMMITTED;
  persistedProposal.candidateCommitSha = 'abcdef123456';

  await store.publishStableSnapshot({
    snapshotId: 'stable-snapshot:1',
    proposalId: 'body-change-proposal:1',
    eventId: 'body-change-event:snapshot-1',
    gitTag: 'stable/stable-snapshot:1',
    schemaVersion: '2026-04-13',
    modelProfileMapJson: {
      reflex: 'model-profile:reflex.fast@baseline',
    },
    criticalConfigHash: 'deadbeef',
    evalSummaryJson: {
      verdict: 'pass',
    },
    manifestHash: 'hash:snapshot:1',
    manifestPath: '/runtime/data/snapshots/stable-snapshot-1.json',
    evidenceRefs: ['body-change:snapshot:1'],
    createdAt,
    expectedCurrentStatuses: [BODY_CHANGE_STATUS.CANDIDATE_COMMITTED],
  });
  const replay = await store.publishStableSnapshot({
    snapshotId: 'stable-snapshot:1',
    proposalId: 'body-change-proposal:1',
    eventId: 'body-change-event:snapshot-2',
    gitTag: 'stable/stable-snapshot:1',
    schemaVersion: '2026-04-13',
    modelProfileMapJson: {
      reflex: 'model-profile:reflex.fast@baseline',
    },
    criticalConfigHash: 'deadbeef',
    evalSummaryJson: {
      verdict: 'pass',
    },
    manifestHash: 'hash:snapshot:1',
    manifestPath: '/runtime/data/snapshots/stable-snapshot-1.json',
    evidenceRefs: ['body-change:snapshot:1'],
    createdAt,
    expectedCurrentStatuses: [BODY_CHANGE_STATUS.CANDIDATE_COMMITTED],
  });

  assert.equal(replay.accepted, true);
  assert.equal(replay.deduplicated, true);
  assert.equal(harness.snapshots.length, 1);
  assert.equal(harness.events.length, 2);
});

void test('publishStableSnapshot fails closed when the proposal was already rolled back', async () => {
  const harness = createBodyEvolutionDbHarness();
  const store = createBodyEvolutionStore(harness.db);

  await store.recordProposal(createProposalInput());
  const persistedProposal = harness.proposals[0];
  assert.ok(persistedProposal);
  persistedProposal.status = BODY_CHANGE_STATUS.CANDIDATE_COMMITTED;
  persistedProposal.candidateCommitSha = 'abcdef123456';

  await store.publishStableSnapshot({
    snapshotId: 'stable-snapshot:1',
    proposalId: 'body-change-proposal:1',
    eventId: 'body-change-event:snapshot-1',
    gitTag: 'stable/stable-snapshot:1',
    schemaVersion: '2026-04-13',
    modelProfileMapJson: {
      reflex: 'model-profile:reflex.fast@baseline',
    },
    criticalConfigHash: 'deadbeef',
    evalSummaryJson: {
      verdict: 'pass',
    },
    manifestHash: 'hash:snapshot:1',
    manifestPath: '/runtime/data/snapshots/stable-snapshot-1.json',
    evidenceRefs: ['body-change:snapshot:1'],
    createdAt,
    expectedCurrentStatuses: [BODY_CHANGE_STATUS.CANDIDATE_COMMITTED],
  });
  persistedProposal.status = BODY_CHANGE_STATUS.ROLLED_BACK;

  const replay = await store.publishStableSnapshot({
    snapshotId: 'stable-snapshot:1',
    proposalId: 'body-change-proposal:1',
    eventId: 'body-change-event:snapshot-2',
    gitTag: 'stable/stable-snapshot:1',
    schemaVersion: '2026-04-13',
    modelProfileMapJson: {
      reflex: 'model-profile:reflex.fast@baseline',
    },
    criticalConfigHash: 'deadbeef',
    evalSummaryJson: {
      verdict: 'pass',
    },
    manifestHash: 'hash:snapshot:1',
    manifestPath: '/runtime/data/snapshots/stable-snapshot-1.json',
    evidenceRefs: ['body-change:snapshot:1'],
    createdAt,
    expectedCurrentStatuses: [BODY_CHANGE_STATUS.CANDIDATE_COMMITTED],
  });

  assert.equal(replay.accepted, false);
  assert.equal(replay.reason, 'invalid_status');
  assert.equal(harness.proposals[0]?.status, BODY_CHANGE_STATUS.ROLLED_BACK);
  assert.equal(harness.events.length, 2);
});
