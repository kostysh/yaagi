import test from 'node:test';
import assert from 'node:assert/strict';
import { DEVELOPMENT_PROPOSAL_KIND } from '@yaagi/contracts/governor';
import {
  PERIMETER_ACTION_CLASS,
  PERIMETER_INGRESS_OWNER,
  PERIMETER_VERDICT,
} from '@yaagi/contracts/perimeter';
import { createDbBackedDevelopmentGovernorService } from '../../src/runtime/development-governor.ts';

// Coverage refs: AC-F0018-13

void test('AC-F0018-03 / AC-F0018-04 fail closed on operator freeze when perimeter refuses the trusted ingress', async () => {
  const governor = createDbBackedDevelopmentGovernorService(
    {
      postgresUrl: 'postgres://unused:unused@127.0.0.1:65432/unused',
    },
    {
      perimeterDecisionService: {
        evaluateControlRequest: (input) =>
          Promise.resolve({
            accepted: true,
            requestId: input.requestId,
            decisionId: 'perimeter-decision:freeze-denied',
            actionClass: PERIMETER_ACTION_CLASS.FREEZE_DEVELOPMENT,
            verdict: PERIMETER_VERDICT.DENY,
            decisionReason: 'trusted_ingress_missing',
            deduplicated: false,
            createdAt: '2026-04-15T09:00:00.000Z',
          }),
      },
    },
  );

  const result = await governor.freezeDevelopment({
    requestId: 'freeze-perimeter-denied',
    reason: 'deny before governor write',
    evidenceRefs: ['operator:freeze:denied'],
    requestedBy: 'operator_api',
    requestedAt: '2026-04-15T09:00:00.000Z',
  });

  assert.deepEqual(result, {
    accepted: false,
    requestId: 'freeze-perimeter-denied',
    reason: 'invalid_request',
  });
});

void test('AC-F0018-03 / AC-F0018-04 fail closed on proposal intake when perimeter refuses code_or_promotion_change', async () => {
  const governor = createDbBackedDevelopmentGovernorService(
    {
      postgresUrl: 'postgres://unused:unused@127.0.0.1:65432/unused',
    },
    {
      perimeterDecisionService: {
        evaluateControlRequest: (input) =>
          Promise.resolve({
            accepted: true,
            requestId: input.requestId,
            decisionId: 'perimeter-decision:proposal-denied',
            actionClass: PERIMETER_ACTION_CLASS.CODE_OR_PROMOTION_CHANGE,
            verdict: PERIMETER_VERDICT.REQUIRE_HUMAN_REVIEW,
            decisionReason: 'trusted_ingress_missing',
            deduplicated: false,
            createdAt: '2026-04-15T09:00:00.000Z',
          }),
      },
    },
  );

  const result = await governor.submitDevelopmentProposal({
    requestId: 'proposal-perimeter-denied',
    proposalKind: DEVELOPMENT_PROPOSAL_KIND.CODE_CHANGE,
    problemSignature: 'perimeter denial path',
    summary: 'This must fail before any governor DB write.',
    evidenceRefs: ['operator:proposal:denied'],
    rollbackPlanRef: 'rollback:proposal:denied',
    targetRef: 'workspace:body',
    requestedAt: '2026-04-15T09:00:00.000Z',
  });

  assert.deepEqual(result, {
    accepted: false,
    requestId: 'proposal-perimeter-denied',
    reason: 'insufficient_evidence',
  });
});

void test('AC-F0016-05 / AC-F0018-07 keeps operator proposal ingress distinct from internal trusted-ingress seams', async () => {
  const seenIngressOwners: string[] = [];
  const governor = createDbBackedDevelopmentGovernorService(
    {
      postgresUrl: 'postgres://unused:unused@127.0.0.1:65432/unused',
    },
    {
      perimeterDecisionService: {
        evaluateControlRequest: (input) => {
          seenIngressOwners.push(input.ingressOwner);
          return Promise.resolve({
            accepted: true,
            requestId: input.requestId,
            decisionId: `perimeter-decision:${seenIngressOwners.length}`,
            actionClass: input.actionClass,
            verdict: PERIMETER_VERDICT.DENY,
            decisionReason: 'trusted_ingress_missing',
            deduplicated: false,
            createdAt: '2026-04-15T09:30:00.000Z',
          });
        },
      },
    },
  );

  await governor.submitDevelopmentProposal({
    requestId: 'proposal-external-ingress',
    proposalKind: DEVELOPMENT_PROPOSAL_KIND.CODE_CHANGE,
    problemSignature: 'external proposal path',
    summary: 'operator route must not reuse the internal ingress owner',
    evidenceRefs: ['operator:proposal:1'],
    rollbackPlanRef: 'rollback:external:1',
    targetRef: 'workspace:body',
    requestedAt: '2026-04-15T09:30:00.000Z',
  });

  await governor.submitInternalDevelopmentProposal({
    requestId: 'proposal-internal-ingress',
    sourceOwner: 'runtime',
    proposalKind: DEVELOPMENT_PROPOSAL_KIND.CODE_CHANGE,
    problemSignature: 'internal proposal path',
    summary: 'internal owner-routed proposal remains on the internal ingress seam',
    evidenceRefs: ['runtime:proposal:1'],
    rollbackPlanRef: 'rollback:internal:1',
    targetRef: 'workspace:body',
    requestedAt: '2026-04-15T09:30:01.000Z',
  });

  assert.deepEqual(seenIngressOwners, [
    PERIMETER_INGRESS_OWNER.F_0013,
    PERIMETER_INGRESS_OWNER.F_0016,
  ]);
});
