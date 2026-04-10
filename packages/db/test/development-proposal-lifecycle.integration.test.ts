import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVELOPMENT_FREEZE_TRIGGER_KIND,
  DEVELOPMENT_GOVERNOR_LEDGER_ENTRY_KIND,
  DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE,
  DEVELOPMENT_PROPOSAL_DECISION_KIND,
  DEVELOPMENT_PROPOSAL_KIND,
} from '@yaagi/contracts/governor';
import {
  createDevelopmentGovernorStore,
  type DevelopmentFreezeRow,
  type DevelopmentGovernorDbExecutor,
  type DevelopmentLedgerRow,
  type DevelopmentProposalDecisionRow,
  type DevelopmentProposalRow,
} from '../src/development-governor.ts';

const createdAt = '2026-04-10T12:00:00.000Z';

const nullableStringParam = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const createProposalInput = (
  overrides: Partial<
    Parameters<ReturnType<typeof createDevelopmentGovernorStore>['submitDevelopmentProposal']>[0]
  > = {},
) => ({
  proposalId: 'development-proposal:1',
  ledgerId: 'development-ledger:proposal-1',
  proposalKind: DEVELOPMENT_PROPOSAL_KIND.CODE_CHANGE,
  originSurface: DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.OPERATOR_API,
  requestId: 'proposal-request-1',
  normalizedRequestHash: 'proposal-hash-1',
  submitterOwner: 'operator_api',
  problemSignature: 'code change proposal requires governor review',
  summary: 'Create a durable proposal without executing code.',
  rollbackPlanRef: 'rollback:code-change:1',
  targetRef: 'workspace:body',
  evidenceRefs: ['operator:evidence:1'],
  createdAt,
  payloadJson: { route: '/control/development-proposals' },
  ...overrides,
});

const createDecisionInput = (
  proposalId = 'development-proposal:1',
  overrides: Partial<
    Parameters<ReturnType<typeof createDevelopmentGovernorStore>['recordProposalDecision']>[0]
  > = {},
) => ({
  decisionId: 'development-proposal-decision:1',
  ledgerId: 'development-ledger:decision-1',
  proposalId,
  decisionKind: DEVELOPMENT_PROPOSAL_DECISION_KIND.APPROVED,
  decisionOrigin: DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.HUMAN_OVERRIDE,
  originSurface: DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.HUMAN_OVERRIDE,
  requestId: 'proposal-decision-request-1',
  normalizedRequestHash: 'decision-hash-1',
  rationale: 'Approve as advisory only; downstream owner still executes.',
  evidenceRefs: ['review:governor:1'],
  createdAt: '2026-04-10T12:10:00.000Z',
  payloadJson: { advisoryOnly: true },
  ...overrides,
});

const createGovernorDbHarness = (): {
  db: DevelopmentGovernorDbExecutor;
  freezes: DevelopmentFreezeRow[];
  proposals: DevelopmentProposalRow[];
  decisions: DevelopmentProposalDecisionRow[];
  ledger: DevelopmentLedgerRow[];
  queries: string[];
} => {
  const freezes: DevelopmentFreezeRow[] = [];
  const proposals: DevelopmentProposalRow[] = [];
  const decisions: DevelopmentProposalDecisionRow[] = [];
  const ledger: DevelopmentLedgerRow[] = [];
  const queries: string[] = [];

  const query = ((sqlText: unknown, params: unknown[] = []) => {
    if (typeof sqlText !== 'string') {
      throw new Error('development governor harness supports only text queries');
    }

    const sql = sqlText.replace(/\s+/g, ' ').trim().toLowerCase();
    queries.push(sql);

    if (sql === 'begin' || sql === 'commit' || sql === 'rollback') {
      return Promise.resolve({ rows: [] });
    }

    if (
      sql.includes('from polyphony_runtime.development_proposals') &&
      sql.includes('where request_id = $1')
    ) {
      const row = proposals.find((entry) => entry.requestId === params[0]);
      return Promise.resolve({ rows: row ? [row] : [] });
    }

    if (
      sql.includes('from polyphony_runtime.development_proposals') &&
      sql.includes('where proposal_id = $1')
    ) {
      const row = proposals.find((entry) => entry.proposalId === params[0]);
      return Promise.resolve({ rows: row ? [row] : [] });
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

    if (sql.startsWith('insert into polyphony_runtime.development_proposals')) {
      const row: DevelopmentProposalRow = {
        proposalId: String(params[0]),
        proposalKind: params[1] as DevelopmentProposalRow['proposalKind'],
        state: params[2] as DevelopmentProposalRow['state'],
        originSurface: params[3] as DevelopmentProposalRow['originSurface'],
        requestId: String(params[4]),
        normalizedRequestHash: String(params[5]),
        submitterOwner: String(params[7]),
        problemSignature: String(params[8]),
        summary: String(params[9]),
        rollbackPlanRef: nullableStringParam(params[10]),
        targetRef: nullableStringParam(params[11]),
        payloadJson: JSON.parse(String(params[12])) as Record<string, unknown>,
        evidenceRefsJson: JSON.parse(String(params[13])) as string[],
        createdAt: new Date(String(params[14])).toISOString(),
        updatedAt: new Date(String(params[14])).toISOString(),
      };
      proposals.push(row);
      return Promise.resolve({ rows: [row] });
    }

    if (
      sql.includes('from polyphony_runtime.development_proposal_decisions') &&
      sql.includes('where request_id = $1')
    ) {
      const row = decisions.find((entry) => entry.requestId === params[0]);
      return Promise.resolve({ rows: row ? [row] : [] });
    }

    if (sql.startsWith('insert into polyphony_runtime.development_proposal_decisions')) {
      const row: DevelopmentProposalDecisionRow = {
        decisionId: String(params[0]),
        proposalId: String(params[1]),
        decisionKind: params[2] as DevelopmentProposalDecisionRow['decisionKind'],
        decisionOrigin: params[3] as DevelopmentProposalDecisionRow['decisionOrigin'],
        originSurface: params[4] as DevelopmentProposalDecisionRow['originSurface'],
        requestId: String(params[5]),
        normalizedRequestHash: String(params[6]),
        rationale: String(params[7]),
        evidenceRefsJson: JSON.parse(String(params[8])) as string[],
        createdAt: new Date(String(params[9])).toISOString(),
      };
      decisions.push(row);
      return Promise.resolve({ rows: [row] });
    }

    if (sql.startsWith('update polyphony_runtime.development_proposals set state')) {
      const proposal = proposals.find((entry) => entry.proposalId === params[0]);
      if (!proposal) {
        return Promise.resolve({ rows: [] });
      }

      proposal.state = params[1] as DevelopmentProposalRow['state'];
      proposal.updatedAt = new Date(String(params[2])).toISOString();
      return Promise.resolve({ rows: [proposal] });
    }

    if (sql.startsWith('insert into polyphony_runtime.development_ledger')) {
      const entryKind = params[1] as DevelopmentLedgerRow['entryKind'];
      const row: DevelopmentLedgerRow = {
        ledgerId: String(params[0]),
        entryKind,
        originSurface: params[2] as DevelopmentLedgerRow['originSurface'],
        requestId: String(params[3]),
        freezeId: null,
        proposalId:
          entryKind === DEVELOPMENT_GOVERNOR_LEDGER_ENTRY_KIND.PROPOSAL_RECORDED
            ? String(params[4])
            : String(params[4]),
        decisionId:
          entryKind === DEVELOPMENT_GOVERNOR_LEDGER_ENTRY_KIND.PROPOSAL_DECISION_RECORDED
            ? String(params[5])
            : null,
        evidenceRefsJson: JSON.parse(
          String(
            entryKind === DEVELOPMENT_GOVERNOR_LEDGER_ENTRY_KIND.PROPOSAL_DECISION_RECORDED
              ? params[6]
              : params[5],
          ),
        ) as string[],
        payloadJson: JSON.parse(
          String(
            entryKind === DEVELOPMENT_GOVERNOR_LEDGER_ENTRY_KIND.PROPOSAL_DECISION_RECORDED
              ? params[7]
              : params[6],
          ),
        ) as Record<string, unknown>,
        createdAt: new Date(
          String(
            entryKind === DEVELOPMENT_GOVERNOR_LEDGER_ENTRY_KIND.PROPOSAL_DECISION_RECORDED
              ? params[8]
              : params[7],
          ),
        ).toISOString(),
      };
      ledger.push(row);
      return Promise.resolve({ rows: [row] });
    }

    throw new Error(`unsupported sql in development proposal harness: ${sqlText}`);
  }) as DevelopmentGovernorDbExecutor['query'];

  return {
    db: { query },
    freezes,
    proposals,
    decisions,
    ledger,
    queries,
  };
};

void test('AC-F0016-04 / AC-F0016-06 submits one durable proposal and ledger entry', async () => {
  const harness = createGovernorDbHarness();
  const store = createDevelopmentGovernorStore(harness.db);

  const result = await store.submitDevelopmentProposal(createProposalInput());

  assert.equal(result.accepted, true);
  assert.equal(result.deduplicated, false);
  assert.equal(result.proposal.state, 'submitted');
  assert.equal(result.proposal.submitterOwner, 'operator_api');
  assert.deepEqual(result.proposal.evidenceRefsJson, ['operator:evidence:1']);
  assert.equal(harness.ledger.length, 1);
  assert.equal(harness.ledger[0]?.entryKind, 'proposal_recorded');
});

void test('AC-F0016-06 makes proposal submission idempotent and conflict-closed', async () => {
  const harness = createGovernorDbHarness();
  const store = createDevelopmentGovernorStore(harness.db);
  const input = createProposalInput();

  const first = await store.submitDevelopmentProposal(input);
  const replay = await store.submitDevelopmentProposal({
    ...input,
    proposalId: 'development-proposal:2',
    ledgerId: 'development-ledger:proposal-2',
  });
  const conflict = await store.submitDevelopmentProposal({
    ...input,
    proposalId: 'development-proposal:3',
    ledgerId: 'development-ledger:proposal-3',
    normalizedRequestHash: 'proposal-hash-2',
  });

  assert.equal(first.accepted, true);
  assert.equal(replay.accepted, true);
  assert.equal(replay.deduplicated, true);
  assert.equal(replay.proposal.proposalId, 'development-proposal:1');
  assert.equal(conflict.accepted, false);
  assert.equal(conflict.reason, 'conflicting_request_id');
  assert.equal(harness.proposals.length, 1);
  assert.equal(harness.ledger.length, 1);
});

void test('AC-F0016-04 rejects new proposal submissions while development is frozen', async () => {
  const harness = createGovernorDbHarness();
  harness.freezes.push({
    freezeId: 'development-freeze:1',
    state: 'frozen',
    triggerKind: DEVELOPMENT_FREEZE_TRIGGER_KIND.OPERATOR,
    originSurface: DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.OPERATOR_API,
    requestId: 'freeze-request-1',
    normalizedRequestHash: 'freeze-hash-1',
    reason: 'manual freeze',
    requestedBy: 'operator_api',
    evidenceRefsJson: ['operator:freeze'],
    createdAt,
  });
  const store = createDevelopmentGovernorStore(harness.db);

  const result = await store.submitDevelopmentProposal(createProposalInput());

  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'development_frozen');
  assert.equal(harness.proposals.length, 0);
  assert.equal(harness.ledger.length, 0);
});

void test('AC-F0016-09 records advisory decisions without execution-side mutations', async () => {
  const harness = createGovernorDbHarness();
  const store = createDevelopmentGovernorStore(harness.db);
  const proposal = await store.submitDevelopmentProposal(createProposalInput());
  assert.equal(proposal.accepted, true);

  const decision = await store.recordProposalDecision(
    createDecisionInput(proposal.proposal.proposalId),
  );
  const invalidSecondDecision = await store.recordProposalDecision(
    createDecisionInput(proposal.proposal.proposalId, {
      decisionId: 'development-proposal-decision:2',
      ledgerId: 'development-ledger:decision-2',
      requestId: 'proposal-decision-request-2',
      normalizedRequestHash: 'decision-hash-2',
      decisionKind: DEVELOPMENT_PROPOSAL_DECISION_KIND.REJECTED,
    }),
  );

  assert.equal(decision.accepted, true);
  assert.equal(decision.proposal.state, 'approved');
  assert.equal(decision.decision.decisionKind, 'approved');
  assert.equal(decision.ledgerEntry?.payloadJson['advisoryOnly'], true);
  assert.equal(invalidSecondDecision.accepted, false);
  assert.equal(invalidSecondDecision.reason, 'invalid_state_transition');
  assert.equal(harness.proposals[0]?.targetRef, 'workspace:body');
  assert.equal(harness.decisions.length, 1);
  assert.equal(
    harness.queries.some(
      (query) =>
        query.includes('from polyphony_runtime.development_proposals') &&
        query.includes('where proposal_id = $1') &&
        query.endsWith('for update'),
    ),
    true,
  );
  assert.equal(
    harness.ledger.map((entry) => entry.entryKind).join(','),
    ['proposal_recorded', 'proposal_decision_recorded'].join(','),
  );
});

void test('AC-F0016-07 rejects repeated deferred proposal decisions', async () => {
  const harness = createGovernorDbHarness();
  const store = createDevelopmentGovernorStore(harness.db);
  const proposal = await store.submitDevelopmentProposal(createProposalInput());
  assert.equal(proposal.accepted, true);

  const deferred = await store.recordProposalDecision(
    createDecisionInput(proposal.proposal.proposalId, {
      decisionKind: DEVELOPMENT_PROPOSAL_DECISION_KIND.DEFERRED,
    }),
  );
  const repeatedDeferred = await store.recordProposalDecision(
    createDecisionInput(proposal.proposal.proposalId, {
      decisionId: 'development-proposal-decision:2',
      ledgerId: 'development-ledger:decision-2',
      requestId: 'proposal-decision-request-2',
      normalizedRequestHash: 'decision-hash-2',
      decisionKind: DEVELOPMENT_PROPOSAL_DECISION_KIND.DEFERRED,
    }),
  );
  const finalDecision = await store.recordProposalDecision(
    createDecisionInput(proposal.proposal.proposalId, {
      decisionId: 'development-proposal-decision:3',
      ledgerId: 'development-ledger:decision-3',
      requestId: 'proposal-decision-request-3',
      normalizedRequestHash: 'decision-hash-3',
      decisionKind: DEVELOPMENT_PROPOSAL_DECISION_KIND.APPROVED,
    }),
  );

  assert.equal(deferred.accepted, true);
  assert.equal(deferred.proposal.state, 'deferred');
  assert.equal(repeatedDeferred.accepted, false);
  assert.equal(repeatedDeferred.reason, 'invalid_state_transition');
  assert.equal(finalDecision.accepted, true);
  assert.equal(finalDecision.proposal.state, 'approved');
});
