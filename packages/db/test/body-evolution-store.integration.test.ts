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
  type BodyEvolutionDbExecutor,
} from '../src/body-evolution.ts';

// Coverage refs: AC-F0017-04 AC-F0017-05 AC-F0017-09 AC-F0017-10 AC-F0017-11
// Coverage refs: AC-F0017-12 AC-F0017-13 AC-F0017-14 AC-F0017-15

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
  queries: string[];
} => {
  const proposals: BodyChangeProposalRow[] = [];
  const events: BodyChangeEventRow[] = [];
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

    if (
      sql.includes('from polyphony_runtime.body_change_events') &&
      sql.includes('where proposal_id = $1')
    ) {
      const rows = events.filter((entry) => entry.proposalId === params[0]);
      return Promise.resolve({ rows });
    }

    throw new Error(`unexpected body evolution query: ${sql}`);
  };

  return {
    db: { query } as BodyEvolutionDbExecutor,
    proposals,
    events,
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
