import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PERIMETER_ACTION_CLASS,
  PERIMETER_AUTHORITY_OWNER,
  PERIMETER_INGRESS_OWNER,
  type PerimeterActionClass,
  type PerimeterDecisionReason,
  type PerimeterDecisionRow,
  type PerimeterVerdict,
} from '@yaagi/contracts/perimeter';
import type {
  PerimeterStore,
  RecordPerimeterDecisionInput,
  RecordPerimeterDecisionResult,
} from '@yaagi/db';
import { createPerimeterDecisionService } from '../../src/perimeter/service.ts';

type MemoryDecision = {
  requestId: string;
  normalizedRequestHash: string;
  actionClass: PerimeterActionClass;
  verdict: PerimeterVerdict;
  decisionReason: PerimeterDecisionReason;
};

const createMemoryStore = () => {
  const decisions = new Map<string, MemoryDecision>();
  const buildDecisionRow = (
    input: RecordPerimeterDecisionInput,
    createdAt: string,
  ): PerimeterDecisionRow => ({
    decisionId: input.decisionId,
    requestId: input.requestId,
    actionClass: input.actionClass,
    ingressOwner: input.ingressOwner,
    authorityOwner: input.authorityOwner,
    governorProposalId: input.governorProposalId,
    governorDecisionRef: input.governorDecisionRef,
    humanOverrideEvidenceRef: input.humanOverrideEvidenceRef,
    targetRef: input.targetRef,
    evidenceRefsJson: input.evidenceRefs,
    verdict: input.verdict,
    decisionReason: input.decisionReason,
    policyVersion: input.policyVersion,
    payloadJson: input.payloadJson ?? {},
    createdAt,
  });
  const store: Pick<PerimeterStore, 'recordDecision'> = {
    recordDecision(input: RecordPerimeterDecisionInput): Promise<RecordPerimeterDecisionResult> {
      const existing = decisions.get(input.requestId);
      if (existing) {
        const existingDecision = buildDecisionRow(
          {
            ...input,
            decisionId: 'perimeter-decision:existing',
            actionClass: existing.actionClass,
            verdict: existing.verdict,
            decisionReason: existing.decisionReason,
            normalizedRequestHash: existing.normalizedRequestHash,
          },
          input.createdAt,
        );

        if (existing.normalizedRequestHash !== input.normalizedRequestHash) {
          return Promise.resolve({
            accepted: false,
            reason: 'conflicting_request_id',
            decision: existingDecision,
          });
        }

        return Promise.resolve({
          accepted: true,
          deduplicated: true,
          decision: existingDecision,
        });
      }

      decisions.set(input.requestId, {
        requestId: input.requestId,
        normalizedRequestHash: input.normalizedRequestHash,
        actionClass: input.actionClass,
        verdict: input.verdict,
        decisionReason: input.decisionReason,
      });

      return Promise.resolve({
        accepted: true,
        deduplicated: false,
        decision: buildDecisionRow(input, input.createdAt),
      });
    },
  };

  return {
    decisions,
    store,
  };
};

void test('AC-F0018-03 / AC-F0018-06 allow trusted code-change requests with verified governor authority', async () => {
  const memory = createMemoryStore();
  const service = createPerimeterDecisionService({
    store: memory.store,
    createDecisionId: () => 'perimeter-decision:1',
    now: () => new Date('2026-04-14T21:00:00.000Z'),
  });

  const result = await service.evaluateControlRequest({
    requestId: 'perimeter-request:1',
    ingressOwner: PERIMETER_INGRESS_OWNER.F_0016,
    actionClass: PERIMETER_ACTION_CLASS.CODE_OR_PROMOTION_CHANGE,
    authorityOwner: PERIMETER_AUTHORITY_OWNER.GOVERNOR,
    governorProposalId: 'development-proposal:1',
    governorDecisionRef: 'development-proposal-decision:1',
    targetRef: 'workspace:body',
    evidenceRefs: ['governor:decision:1'],
  });

  assert.equal(result.accepted, true);
  assert.equal(result.verdict, 'allow');
  assert.equal(result.decisionReason, 'verified_authority');
});

void test('AC-F0018-03 allows internal trusted-ingress requests without minting a second approval ledger', async () => {
  const memory = createMemoryStore();
  const service = createPerimeterDecisionService({
    store: memory.store,
    createDecisionId: () => 'perimeter-decision:freeze-1',
    now: () => new Date('2026-04-15T08:00:00.000Z'),
  });

  const result = await service.evaluateControlRequest({
    requestId: 'perimeter-request:trusted-internal-1',
    ingressOwner: PERIMETER_INGRESS_OWNER.F_0016,
    actionClass: PERIMETER_ACTION_CLASS.CODE_OR_PROMOTION_CHANGE,
    authorityOwner: PERIMETER_AUTHORITY_OWNER.TRUSTED_INGRESS,
    targetRef: 'workspace:body',
    evidenceRefs: ['internal:proposal:1'],
  });

  assert.equal(result.accepted, true);
  assert.equal(result.verdict, 'allow');
  assert.equal(result.decisionReason, 'verified_authority');
});

void test('AC-F0018-04 denies operator-api trusted ingress until caller admission exists', async () => {
  const memory = createMemoryStore();
  const service = createPerimeterDecisionService({
    store: memory.store,
    createDecisionId: () => 'perimeter-decision:freeze-operator-denied',
    now: () => new Date('2026-04-15T08:00:30.000Z'),
  });

  const result = await service.evaluateControlRequest({
    requestId: 'perimeter-request:freeze-operator-denied',
    ingressOwner: PERIMETER_INGRESS_OWNER.F_0013,
    actionClass: PERIMETER_ACTION_CLASS.FREEZE_DEVELOPMENT,
    authorityOwner: PERIMETER_AUTHORITY_OWNER.TRUSTED_INGRESS,
    evidenceRefs: ['operator:freeze:1'],
  });

  assert.equal(result.accepted, true);
  assert.equal(result.verdict, 'deny');
  assert.equal(result.decisionReason, 'trusted_ingress_missing');
});

void test('AC-F0024-10 allows operator-api freeze trusted ingress only when caller admission evidence is present', async () => {
  const memory = createMemoryStore();
  const service = createPerimeterDecisionService({
    store: memory.store,
    createDecisionId: () => 'perimeter-decision:freeze-operator-admitted',
    now: () => new Date('2026-04-23T10:00:00.000Z'),
  });

  const result = await service.evaluateControlRequest({
    requestId: 'perimeter-request:freeze-operator-admitted',
    ingressOwner: PERIMETER_INGRESS_OWNER.F_0013,
    actionClass: PERIMETER_ACTION_CLASS.FREEZE_DEVELOPMENT,
    authorityOwner: PERIMETER_AUTHORITY_OWNER.TRUSTED_INGRESS,
    evidenceRefs: ['operator-auth-evidence:http-request-1'],
  });

  assert.equal(result.accepted, true);
  assert.equal(result.verdict, 'allow');
  assert.equal(result.decisionReason, 'verified_authority');
});

void test('AC-F0024-10 allows operator-api proposal trusted ingress only when caller admission evidence is present', async () => {
  const memory = createMemoryStore();
  const service = createPerimeterDecisionService({
    store: memory.store,
    createDecisionId: () => 'perimeter-decision:proposal-operator-admitted',
    now: () => new Date('2026-04-23T10:01:00.000Z'),
  });

  const result = await service.evaluateControlRequest({
    requestId: 'perimeter-request:proposal-operator-admitted',
    ingressOwner: PERIMETER_INGRESS_OWNER.F_0013,
    actionClass: PERIMETER_ACTION_CLASS.CODE_OR_PROMOTION_CHANGE,
    authorityOwner: PERIMETER_AUTHORITY_OWNER.TRUSTED_INGRESS,
    evidenceRefs: ['operator-auth-evidence:http-request-2'],
    targetRef: 'policy:development-governor',
  });

  assert.equal(result.accepted, true);
  assert.equal(result.verdict, 'allow');
  assert.equal(result.decisionReason, 'verified_authority');
});

void test('AC-F0018-04 denies supported paths when trusted ingress is missing', async () => {
  const memory = createMemoryStore();
  const service = createPerimeterDecisionService({
    store: memory.store,
    createDecisionId: () => 'perimeter-decision:2',
    now: () => new Date('2026-04-14T21:01:00.000Z'),
  });

  const result = await service.evaluateControlRequest({
    requestId: 'perimeter-request:2',
    ingressOwner: PERIMETER_INGRESS_OWNER.CF_025,
    actionClass: PERIMETER_ACTION_CLASS.CODE_OR_PROMOTION_CHANGE,
    authorityOwner: PERIMETER_AUTHORITY_OWNER.GOVERNOR,
    governorProposalId: 'development-proposal:2',
    governorDecisionRef: 'development-proposal-decision:2',
    evidenceRefs: ['governor:decision:2'],
  });

  assert.equal(result.accepted, true);
  assert.equal(result.verdict, 'deny');
  assert.equal(result.decisionReason, 'trusted_ingress_missing');
});

void test('AC-F0018-06 denies governor authority claims when the read-only authority validator cannot confirm the decision ref', async () => {
  const memory = createMemoryStore();
  const service = createPerimeterDecisionService({
    store: memory.store,
    authorityValidator: {
      validate() {
        return Promise.resolve({
          accepted: false,
          decisionReason: 'governor_authority_missing',
        });
      },
    },
    createDecisionId: () => 'perimeter-decision:2b',
    now: () => new Date('2026-04-14T21:01:30.000Z'),
  });

  const result = await service.evaluateControlRequest({
    requestId: 'perimeter-request:2b',
    ingressOwner: PERIMETER_INGRESS_OWNER.F_0016,
    actionClass: PERIMETER_ACTION_CLASS.CODE_OR_PROMOTION_CHANGE,
    authorityOwner: PERIMETER_AUTHORITY_OWNER.GOVERNOR,
    governorProposalId: 'development-proposal:2b',
    governorDecisionRef: 'development-proposal-decision:2b',
    evidenceRefs: ['governor:decision:2b'],
  });

  assert.equal(result.accepted, true);
  assert.equal(result.verdict, 'deny');
  assert.equal(result.decisionReason, 'governor_authority_missing');
});

void test('AC-F0018-07 denies human_override claims when adjacent owner evidence cannot be confirmed read-only', async () => {
  const memory = createMemoryStore();
  const service = createPerimeterDecisionService({
    store: memory.store,
    authorityValidator: {
      validate() {
        return Promise.resolve({
          accepted: false,
          decisionReason: 'human_override_evidence_missing',
        });
      },
    },
    createDecisionId: () => 'perimeter-decision:2c',
    now: () => new Date('2026-04-14T21:01:45.000Z'),
  });

  const result = await service.evaluateControlRequest({
    requestId: 'perimeter-request:2c',
    ingressOwner: PERIMETER_INGRESS_OWNER.F_0013,
    actionClass: PERIMETER_ACTION_CLASS.FREEZE_DEVELOPMENT,
    authorityOwner: PERIMETER_AUTHORITY_OWNER.HUMAN_OVERRIDE,
    humanOverrideEvidenceRef: 'body-change:override:2c',
    evidenceRefs: ['body-change:override:2c'],
  });

  assert.equal(result.accepted, true);
  assert.equal(result.verdict, 'deny');
  assert.equal(result.decisionReason, 'human_override_evidence_missing');
});

void test('AC-F0018-05 allows rollback gating for adjacent owner seams and keeps disable_external_network explicit unavailable', async () => {
  const memory = createMemoryStore();
  const service = createPerimeterDecisionService({
    store: memory.store,
    createDecisionId: () => 'perimeter-decision:3',
    now: () => new Date('2026-04-14T21:02:00.000Z'),
  });

  const rollback = await service.evaluateControlRequest({
    requestId: 'perimeter-request:3',
    ingressOwner: PERIMETER_INGRESS_OWNER.F_0017,
    actionClass: PERIMETER_ACTION_CLASS.FORCE_ROLLBACK,
    authorityOwner: PERIMETER_AUTHORITY_OWNER.GOVERNOR,
    governorProposalId: 'development-proposal:3',
    governorDecisionRef: 'development-proposal-decision:3',
    evidenceRefs: ['governor:decision:3'],
  });
  const network = await service.evaluateControlRequest({
    requestId: 'perimeter-request:4',
    ingressOwner: PERIMETER_INGRESS_OWNER.PLATFORM_RUNTIME,
    actionClass: PERIMETER_ACTION_CLASS.DISABLE_EXTERNAL_NETWORK,
    authorityOwner: PERIMETER_AUTHORITY_OWNER.GOVERNOR,
    governorProposalId: 'development-proposal:4',
    governorDecisionRef: 'development-proposal-decision:4',
    evidenceRefs: ['governor:decision:4'],
  });

  assert.equal(rollback.accepted, true);
  assert.equal(rollback.verdict, 'allow');
  assert.equal(rollback.decisionReason, 'verified_authority');
  assert.equal(network.accepted, true);
  assert.equal(network.verdict, 'require_human_review');
  assert.equal(network.decisionReason, 'explicit_unavailable');
});
