import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PERIMETER_ACTION_CLASS,
  PERIMETER_AUTHORITY_OWNER,
  PERIMETER_INGRESS_OWNER,
  PERIMETER_VERDICT,
  perimeterControlRequestSchema,
  perimeterDecisionResultSchema,
  safetyKernelSchema,
} from '../../src/perimeter.ts';

void test('AC-F0018-01 / AC-F0018-02 define bounded perimeter control contracts and a four-family safety kernel', () => {
  const request = perimeterControlRequestSchema.parse({
    requestId: 'perimeter-request-1',
    ingressOwner: PERIMETER_INGRESS_OWNER.F_0016,
    actionClass: PERIMETER_ACTION_CLASS.CODE_OR_PROMOTION_CHANGE,
    authorityOwner: PERIMETER_AUTHORITY_OWNER.TRUSTED_INGRESS,
    targetRef: 'workspace:body',
    evidenceRefs: ['governor:decision:1'],
  });
  const kernel = safetyKernelSchema.parse({
    version: '2026-04-15.f0018.external-fail-closed',
    forbiddenActions: {
      explicitUnavailableActionClasses: [PERIMETER_ACTION_CLASS.DISABLE_EXTERNAL_NETWORK],
    },
    networkEgress: {
      disableExternalNetworkMode: 'explicit_unavailable',
      publicRouteCreation: 'deny',
    },
    promotionChangeGates: {
      actionPolicies: {
        freeze_development: {
          allowedIngressOwners: [
            PERIMETER_INGRESS_OWNER.F_0013,
            PERIMETER_INGRESS_OWNER.PLATFORM_RUNTIME,
          ],
          allowedAuthorityOwners: [PERIMETER_AUTHORITY_OWNER.TRUSTED_INGRESS],
        },
        code_or_promotion_change: {
          allowedIngressOwners: [PERIMETER_INGRESS_OWNER.F_0016, PERIMETER_INGRESS_OWNER.F_0017],
          allowedAuthorityOwners: [
            PERIMETER_AUTHORITY_OWNER.TRUSTED_INGRESS,
            PERIMETER_AUTHORITY_OWNER.GOVERNOR,
            PERIMETER_AUTHORITY_OWNER.HUMAN_OVERRIDE,
          ],
        },
        force_rollback: {
          allowedIngressOwners: [PERIMETER_INGRESS_OWNER.F_0017, PERIMETER_INGRESS_OWNER.CF_025],
          allowedAuthorityOwners: [
            PERIMETER_AUTHORITY_OWNER.GOVERNOR,
            PERIMETER_AUTHORITY_OWNER.HUMAN_OVERRIDE,
          ],
        },
      },
    },
    budgetCeilings: {
      maxEvidenceRefsPerRequest: 100,
      maxPayloadBytes: 16384,
    },
  });

  assert.equal(request.actionClass, 'code_or_promotion_change');
  assert.equal(request.authorityOwner, 'trusted_ingress');
  assert.equal(kernel.forbiddenActions.explicitUnavailableActionClasses.length, 1);
  assert.equal(kernel.networkEgress.disableExternalNetworkMode, 'explicit_unavailable');
  assert.ok(kernel.promotionChangeGates.actionPolicies['freeze_development']);
});

void test('AC-F0018-06 / AC-F0018-07 reject mixed governor and human-override authority claims', () => {
  const rejected = perimeterControlRequestSchema.safeParse({
    requestId: 'perimeter-request-2',
    ingressOwner: PERIMETER_INGRESS_OWNER.F_0017,
    actionClass: PERIMETER_ACTION_CLASS.CODE_OR_PROMOTION_CHANGE,
    authorityOwner: 'human_override',
    governorProposalId: 'development-proposal:1',
    governorDecisionRef: 'development-proposal-decision:1',
    humanOverrideEvidenceRef: 'body-change:override:1',
    evidenceRefs: ['body-change:override:1'],
  });

  assert.equal(rejected.success, false);
});

void test('AC-F0018-03 exposes deterministic perimeter verdict result shapes', () => {
  const accepted = perimeterDecisionResultSchema.parse({
    accepted: true,
    requestId: 'perimeter-request-3',
    decisionId: 'perimeter-decision:1',
    actionClass: PERIMETER_ACTION_CLASS.FREEZE_DEVELOPMENT,
    verdict: PERIMETER_VERDICT.ALLOW,
    decisionReason: 'verified_authority',
    deduplicated: false,
    createdAt: '2026-04-14T21:00:00.000Z',
  });
  const rejected = perimeterDecisionResultSchema.parse({
    accepted: false,
    requestId: 'perimeter-request-4',
    reason: 'conflicting_request_id',
  });

  assert.equal(accepted.accepted, true);
  assert.equal(accepted.verdict, 'allow');
  assert.equal(rejected.accepted, false);
});
