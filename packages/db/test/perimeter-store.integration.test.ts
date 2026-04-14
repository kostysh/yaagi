import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PERIMETER_ACTION_CLASS,
  PERIMETER_AUTHORITY_OWNER,
  PERIMETER_DECISION_REASON,
  PERIMETER_INGRESS_OWNER,
  PERIMETER_VERDICT,
} from '@yaagi/contracts/perimeter';
import { createPerimeterStore, type PerimeterDbExecutor } from '../src/perimeter.ts';
import type { PerimeterDecisionRow } from '@yaagi/contracts/perimeter';

type PerimeterDecisionHarnessRow = PerimeterDecisionRow & {
  normalizedRequestHash: string;
};

const createPerimeterDbHarness = (): {
  db: PerimeterDbExecutor;
  decisions: PerimeterDecisionHarnessRow[];
} => {
  const decisions: PerimeterDecisionHarnessRow[] = [];

  const query = ((sqlText: unknown, params: unknown[] = []) => {
    if (typeof sqlText !== 'string') {
      throw new Error('perimeter harness supports only text queries');
    }

    const sql = sqlText.replace(/\s+/g, ' ').trim().toLowerCase();

    if (sql.startsWith('insert into polyphony_runtime.perimeter_decisions')) {
      const existing = decisions.find((entry) => entry.requestId === params[1]);
      if (existing) {
        return Promise.resolve({ rows: [] });
      }

      const row: PerimeterDecisionHarnessRow = {
        decisionId: String(params[0]),
        requestId: String(params[1]),
        normalizedRequestHash: String(params[2]),
        actionClass: params[3] as PerimeterDecisionHarnessRow['actionClass'],
        ingressOwner: params[4] as PerimeterDecisionHarnessRow['ingressOwner'],
        authorityOwner: params[5] as PerimeterDecisionHarnessRow['authorityOwner'],
        governorProposalId: typeof params[6] === 'string' ? String(params[6]) : null,
        governorDecisionRef: typeof params[7] === 'string' ? String(params[7]) : null,
        humanOverrideEvidenceRef: typeof params[8] === 'string' ? String(params[8]) : null,
        targetRef: typeof params[9] === 'string' ? String(params[9]) : null,
        evidenceRefsJson: JSON.parse(String(params[10])) as string[],
        verdict: params[11] as PerimeterDecisionHarnessRow['verdict'],
        decisionReason: params[12] as PerimeterDecisionHarnessRow['decisionReason'],
        policyVersion: String(params[13]),
        payloadJson: JSON.parse(String(params[14])) as Record<string, unknown>,
        createdAt: new Date(String(params[15])).toISOString(),
      };
      decisions.push(row);
      return Promise.resolve({ rows: [row] });
    }

    if (
      sql.includes('from polyphony_runtime.perimeter_decisions') &&
      sql.includes('where request_id = $1')
    ) {
      const row = decisions.find((entry) => entry.requestId === params[0]);
      return Promise.resolve({ rows: row ? [row] : [] });
    }

    throw new Error(`unsupported sql in perimeter harness: ${sqlText}`);
  }) as PerimeterDbExecutor['query'];

  return {
    db: { query },
    decisions,
  };
};

void test('AC-F0018-03 / AC-F0018-06 persists one durable perimeter decision per request id', async () => {
  const harness = createPerimeterDbHarness();
  const store = createPerimeterStore(harness.db);

  const result = await store.recordDecision({
    decisionId: 'perimeter-decision:1',
    requestId: 'perimeter-request:1',
    normalizedRequestHash: 'hash-1',
    actionClass: PERIMETER_ACTION_CLASS.CODE_OR_PROMOTION_CHANGE,
    ingressOwner: PERIMETER_INGRESS_OWNER.F_0016,
    authorityOwner: PERIMETER_AUTHORITY_OWNER.GOVERNOR,
    governorProposalId: 'development-proposal:1',
    governorDecisionRef: 'development-proposal-decision:1',
    humanOverrideEvidenceRef: null,
    targetRef: 'workspace:body',
    evidenceRefs: ['governor:decision:1'],
    verdict: PERIMETER_VERDICT.ALLOW,
    decisionReason: PERIMETER_DECISION_REASON.VERIFIED_AUTHORITY,
    policyVersion: '2026-04-14.f0018.sl-f0018-01',
    payloadJson: { policyFamily: 'promotionChangeGates' },
    createdAt: '2026-04-14T21:00:00.000Z',
  });

  assert.equal(result.accepted, true);
  assert.equal(result.deduplicated, false);
  assert.equal(harness.decisions.length, 1);
  assert.equal(harness.decisions[0]?.decisionReason, 'verified_authority');
});

void test('AC-F0018-03 reuses idempotent perimeter decisions when request id and hash match', async () => {
  const harness = createPerimeterDbHarness();
  const store = createPerimeterStore(harness.db);
  const input = {
    decisionId: 'perimeter-decision:1',
    requestId: 'perimeter-request:2',
    normalizedRequestHash: 'hash-2',
    actionClass: PERIMETER_ACTION_CLASS.FREEZE_DEVELOPMENT,
    ingressOwner: PERIMETER_INGRESS_OWNER.F_0013,
    authorityOwner: PERIMETER_AUTHORITY_OWNER.HUMAN_OVERRIDE,
    governorProposalId: null,
    governorDecisionRef: null,
    humanOverrideEvidenceRef: 'human-override:evidence:1',
    targetRef: null,
    evidenceRefs: ['operator:manual-control'],
    verdict: PERIMETER_VERDICT.ALLOW,
    decisionReason: PERIMETER_DECISION_REASON.VERIFIED_AUTHORITY,
    policyVersion: '2026-04-14.f0018.sl-f0018-01',
    createdAt: '2026-04-14T21:00:00.000Z',
  };

  const first = await store.recordDecision(input);
  const replay = await store.recordDecision({
    ...input,
    decisionId: 'perimeter-decision:2',
  });

  assert.equal(first.accepted, true);
  assert.equal(replay.accepted, true);
  assert.equal(replay.deduplicated, true);
  assert.equal(harness.decisions.length, 1);
});

void test('AC-F0018-04 rejects conflicting request id reuse across different perimeter payloads', async () => {
  const harness = createPerimeterDbHarness();
  const store = createPerimeterStore(harness.db);

  await store.recordDecision({
    decisionId: 'perimeter-decision:1',
    requestId: 'perimeter-request:3',
    normalizedRequestHash: 'hash-3',
    actionClass: PERIMETER_ACTION_CLASS.CODE_OR_PROMOTION_CHANGE,
    ingressOwner: PERIMETER_INGRESS_OWNER.F_0016,
    authorityOwner: PERIMETER_AUTHORITY_OWNER.GOVERNOR,
    governorProposalId: 'development-proposal:1',
    governorDecisionRef: 'development-proposal-decision:1',
    humanOverrideEvidenceRef: null,
    targetRef: 'workspace:body',
    evidenceRefs: ['governor:decision:1'],
    verdict: PERIMETER_VERDICT.ALLOW,
    decisionReason: PERIMETER_DECISION_REASON.VERIFIED_AUTHORITY,
    policyVersion: '2026-04-14.f0018.sl-f0018-01',
    createdAt: '2026-04-14T21:00:00.000Z',
  });

  const conflict = await store.recordDecision({
    decisionId: 'perimeter-decision:2',
    requestId: 'perimeter-request:3',
    normalizedRequestHash: 'hash-4',
    actionClass: PERIMETER_ACTION_CLASS.DISABLE_EXTERNAL_NETWORK,
    ingressOwner: PERIMETER_INGRESS_OWNER.PLATFORM_RUNTIME,
    authorityOwner: PERIMETER_AUTHORITY_OWNER.GOVERNOR,
    governorProposalId: 'development-proposal:2',
    governorDecisionRef: 'development-proposal-decision:2',
    humanOverrideEvidenceRef: null,
    targetRef: null,
    evidenceRefs: ['governor:decision:2'],
    verdict: PERIMETER_VERDICT.REQUIRE_HUMAN_REVIEW,
    decisionReason: PERIMETER_DECISION_REASON.EXPLICIT_UNAVAILABLE,
    policyVersion: '2026-04-14.f0018.sl-f0018-01',
    createdAt: '2026-04-14T21:05:00.000Z',
  });

  assert.equal(conflict.accepted, false);
  assert.equal(conflict.reason, 'conflicting_request_id');
  assert.equal(conflict.decision.actionClass, 'code_or_promotion_change');
});
