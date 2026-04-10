import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE,
  DEVELOPMENT_PROPOSAL_DECISION_KIND,
  DEVELOPMENT_PROPOSAL_KIND,
  DEVELOPMENT_PROPOSAL_STATE,
  developmentProposalCommandSchema,
  developmentProposalDecisionCommandSchema,
  developmentProposalDecisionResultSchema,
  developmentProposalResultSchema,
} from '../../src/governor.ts';
import { operatorDevelopmentProposalRequestSchema } from '../../src/operator-api.ts';

void test('AC-F0016-06 / AC-F0016-07 define bounded proposal submission contracts', () => {
  const operatorRequest = operatorDevelopmentProposalRequestSchema.parse({
    requestId: 'proposal-request-1',
    proposalKind: DEVELOPMENT_PROPOSAL_KIND.MODEL_ADAPTER,
    problemSignature: 'reflex baseline loses stability after workshop eval',
    summary: 'Evaluate a bounded adapter proposal for reflex stability.',
    evidenceRefs: ['workshop:eval-run:1'],
    rollbackPlanRef: 'rollback:adapter:reflex-v1',
    targetRef: 'model-profile:reflex.fast@baseline',
  });
  const command = developmentProposalCommandSchema.parse({
    ...operatorRequest,
    originSurface: DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.OPERATOR_API,
    submitterOwner: 'operator_api',
    payload: { route: '/control/development-proposals' },
    requestedAt: '2026-04-10T12:00:00.000Z',
  });

  assert.deepEqual(operatorRequest, {
    requestId: 'proposal-request-1',
    proposalKind: 'model_adapter',
    problemSignature: 'reflex baseline loses stability after workshop eval',
    summary: 'Evaluate a bounded adapter proposal for reflex stability.',
    evidenceRefs: ['workshop:eval-run:1'],
    rollbackPlanRef: 'rollback:adapter:reflex-v1',
    targetRef: 'model-profile:reflex.fast@baseline',
  });
  assert.equal(command.proposalKind, 'model_adapter');
  assert.equal(command.originSurface, 'operator_api');
  assert.equal(command.evidenceRefs.length, 1);
});

void test('AC-F0016-06 rejects under-specified canonical proposal commands', () => {
  const rejected = developmentProposalCommandSchema.safeParse({
    requestId: 'proposal-request-2',
    proposalKind: DEVELOPMENT_PROPOSAL_KIND.CODE_CHANGE,
    originSurface: DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.OPERATOR_API,
    submitterOwner: 'operator_api',
    problemSignature: 'code evolution target',
    summary: 'Missing evidence must not create a durable proposal.',
    evidenceRefs: [],
    rollbackPlanRef: null,
    targetRef: null,
    requestedAt: '2026-04-10T12:00:00.000Z',
  });

  assert.equal(rejected.success, false);
});

void test('AC-F0016-04 / AC-F0016-07 expose deterministic proposal result shapes', () => {
  const accepted = developmentProposalResultSchema.parse({
    accepted: true,
    requestId: 'proposal-request-1',
    proposalId: 'development-proposal:1',
    state: DEVELOPMENT_PROPOSAL_STATE.SUBMITTED,
    deduplicated: false,
    createdAt: '2026-04-10T12:00:00.000Z',
  });
  const frozen = developmentProposalResultSchema.parse({
    accepted: false,
    requestId: 'proposal-request-2',
    reason: 'development_frozen',
  });
  const unsupported = developmentProposalResultSchema.parse({
    accepted: false,
    reason: 'unsupported_proposal_kind',
  });

  assert.equal(accepted.accepted, true);
  assert.equal(frozen.accepted, false);
  assert.equal(unsupported.accepted, false);
  assert.equal(accepted.state, 'submitted');
  assert.equal(frozen.reason, 'development_frozen');
  assert.equal(unsupported.reason, 'unsupported_proposal_kind');
});

void test('AC-F0016-09 defines advisory decision records separately from execution', () => {
  const command = developmentProposalDecisionCommandSchema.parse({
    requestId: 'proposal-decision-1',
    proposalId: 'development-proposal:1',
    decisionKind: DEVELOPMENT_PROPOSAL_DECISION_KIND.APPROVED,
    originSurface: DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.HUMAN_OVERRIDE,
    decisionOrigin: 'human_override',
    rationale: 'Evidence supports approval; execution remains with downstream owner.',
    evidenceRefs: ['review:governor:1'],
    payload: { advisoryOnly: true },
    decidedAt: '2026-04-10T12:10:00.000Z',
  });
  const result = developmentProposalDecisionResultSchema.parse({
    accepted: true,
    requestId: command.requestId,
    proposalId: command.proposalId,
    decisionId: 'development-proposal-decision:1',
    state: DEVELOPMENT_PROPOSAL_STATE.APPROVED,
    decisionKind: DEVELOPMENT_PROPOSAL_DECISION_KIND.APPROVED,
    deduplicated: false,
    createdAt: command.decidedAt,
  });

  assert.equal(result.accepted, true);
  assert.equal(command.payload['advisoryOnly'], true);
  assert.equal(result.state, 'approved');
  assert.equal(result.decisionKind, 'approved');
});
