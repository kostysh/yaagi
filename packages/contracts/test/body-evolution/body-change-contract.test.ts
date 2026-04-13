import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BODY_CHANGE_EVENT_KIND,
  BODY_CHANGE_REQUESTED_BY_OWNER,
  BODY_CHANGE_SCOPE_KIND,
  BODY_CHANGE_STATUS,
  bodyChangeProposalResultSchema,
  bodyChangeRequestSchema,
  bodyStableSnapshotSchema,
} from '../../src/body-evolution.ts';

// Coverage refs: AC-F0017-01 AC-F0017-02 AC-F0017-03 AC-F0017-09 AC-F0017-10
// Coverage refs: AC-F0017-11 AC-F0017-12 AC-F0017-13 AC-F0017-14 AC-F0017-15
// Coverage refs: AC-F0017-19 AC-F0017-20 AC-F0017-21 AC-F0017-22 AC-F0017-23

const requestedAt = '2026-04-10T18:00:00.000Z';

void test('AC-F0017-01 / AC-F0017-02 define mutually exclusive body change authority contracts', () => {
  const governorRequest = bodyChangeRequestSchema.parse({
    requestedByOwner: BODY_CHANGE_REQUESTED_BY_OWNER.GOVERNOR,
    governorProposalId: 'development-proposal:1',
    governorDecisionRef: 'development-proposal-decision:1',
    requestId: 'body-change:1',
    scopeKind: BODY_CHANGE_SCOPE_KIND.CODE,
    rationale: 'Apply an approved code change inside the materialized body.',
    requiredEvalSuite: 'body-evolution.boundary',
    targetPaths: ['src/body/body-evolution.ts'],
    rollbackPlanRef: 'rollback:body-change:1',
    evidenceRefs: ['governor:decision:1'],
  });
  const overrideRequest = bodyChangeRequestSchema.parse({
    requestedByOwner: BODY_CHANGE_REQUESTED_BY_OWNER.HUMAN_OVERRIDE,
    ownerOverrideEvidenceRef: 'owner-override:1',
    requestId: 'body-change:2',
    scopeKind: BODY_CHANGE_SCOPE_KIND.CONFIG,
    rationale: 'Apply an owner-approved config change inside the materialized body.',
    requiredEvalSuite: 'body-evolution.config',
    targetPaths: ['config/runtime.json'],
    rollbackPlanRef: 'rollback:body-change:2',
    evidenceRefs: ['operator:override:1'],
  });

  assert.equal(governorRequest.governorProposalId, 'development-proposal:1');
  assert.equal(governorRequest.requestedByOwner, 'governor');
  assert.equal(overrideRequest.ownerOverrideEvidenceRef, 'owner-override:1');
  assert.equal(overrideRequest.requestedByOwner, 'human_override');
});

void test('AC-F0017-03 rejects body change requests without a valid authority path', () => {
  const rejectedGovernor = bodyChangeRequestSchema.safeParse({
    requestedByOwner: BODY_CHANGE_REQUESTED_BY_OWNER.GOVERNOR,
    requestId: 'body-change:3',
    scopeKind: BODY_CHANGE_SCOPE_KIND.CODE,
    rationale: 'Missing approved governor evidence.',
    requiredEvalSuite: 'body-evolution.boundary',
    targetPaths: ['src/body/body-evolution.ts'],
    rollbackPlanRef: 'rollback:body-change:3',
    evidenceRefs: ['governor:decision:missing'],
  });
  const rejectedOverride = bodyChangeRequestSchema.safeParse({
    requestedByOwner: BODY_CHANGE_REQUESTED_BY_OWNER.HUMAN_OVERRIDE,
    requestId: 'body-change:4',
    scopeKind: BODY_CHANGE_SCOPE_KIND.CODE,
    rationale: 'Missing owner override evidence.',
    requiredEvalSuite: 'body-evolution.boundary',
    targetPaths: ['src/body/body-evolution.ts'],
    rollbackPlanRef: 'rollback:body-change:4',
    evidenceRefs: ['operator:override:missing'],
  });

  assert.equal(rejectedGovernor.success, false);
  assert.equal(rejectedOverride.success, false);
});

void test('AC-F0017-09 through AC-F0017-15 define proposal result fields', () => {
  const result = bodyChangeProposalResultSchema.parse({
    accepted: true,
    requestId: 'body-change:1',
    proposalId: 'body-change-proposal:1',
    status: BODY_CHANGE_STATUS.REQUESTED,
    deduplicated: false,
    createdAt: requestedAt,
    proposal: {
      proposalId: 'body-change-proposal:1',
      requestId: 'body-change:1',
      normalizedRequestHash: 'hash:1',
      requestedByOwner: BODY_CHANGE_REQUESTED_BY_OWNER.GOVERNOR,
      governorProposalId: 'development-proposal:1',
      governorDecisionRef: 'development-proposal-decision:1',
      ownerOverrideEvidenceRef: null,
      branchName: 'agent/proposals/body-change-1',
      worktreePath: '/workspace/body/.yaagi/body-proposals/body-change-1',
      candidateCommitSha: null,
      stableSnapshotId: null,
      status: BODY_CHANGE_STATUS.REQUESTED,
      scopeKind: BODY_CHANGE_SCOPE_KIND.CODE,
      requiredEvalSuite: 'body-evolution.boundary',
      targetPaths: ['src/body/body-evolution.ts'],
      rollbackPlanRef: 'rollback:body-change:1',
      evidenceRefs: ['governor:decision:1'],
      createdAt: requestedAt,
      updatedAt: requestedAt,
    },
  });

  assert.equal(result.accepted, true);
  assert.equal(result.proposal.proposalId, 'body-change-proposal:1');
  assert.equal(result.proposal.governorProposalId, 'development-proposal:1');
  assert.equal(result.proposal.branchName, 'agent/proposals/body-change-1');
  assert.equal(result.proposal.worktreePath, '/workspace/body/.yaagi/body-proposals/body-change-1');
  assert.equal(result.proposal.status, 'requested');
  assert.equal(result.proposal.requiredEvalSuite, 'body-evolution.boundary');
  assert.deepEqual(result.proposal.evidenceRefs, ['governor:decision:1']);
});

void test('AC-F0017-19 through AC-F0017-23 define stable snapshot manifest fields', () => {
  const snapshot = bodyStableSnapshotSchema.parse({
    snapshotId: 'stable-snapshot:proposal1-abcdef123456',
    proposalId: 'body-change-proposal:1',
    gitTag: 'stable/stable-snapshot:proposal1-abcdef123456',
    schemaVersion: '2026-04-13',
    modelProfileMapJson: {
      reflex: 'model-profile:reflex.fast@baseline',
    },
    criticalConfigHash: 'abcdef1234567890',
    evalSummaryJson: {
      suite: 'body-evolution.boundary',
      verdict: 'pass',
    },
    manifestHash: 'deadbeef0123456789',
    manifestPath: '/runtime/data/snapshots/stable-snapshot:proposal1-abcdef123456.json',
    createdAt: requestedAt,
  });

  assert.equal(snapshot.snapshotId.startsWith('stable-snapshot:'), true);
  assert.equal(snapshot.gitTag.startsWith('stable/'), true);
  assert.equal(snapshot.schemaVersion, '2026-04-13');
  assert.equal(snapshot.modelProfileMapJson['reflex'], 'model-profile:reflex.fast@baseline');
  assert.equal(snapshot.criticalConfigHash, 'abcdef1234567890');
  assert.equal(snapshot.evalSummaryJson['verdict'], 'pass');
});

void test('body change event contract exposes the extended lifecycle event kinds', () => {
  assert.equal(BODY_CHANGE_EVENT_KIND.WORKTREE_PREPARED, 'worktree_prepared');
  assert.equal(BODY_CHANGE_EVENT_KIND.EVALUATION_STARTED, 'evaluation_started');
  assert.equal(BODY_CHANGE_EVENT_KIND.EVALUATION_FAILED, 'evaluation_failed');
  assert.equal(BODY_CHANGE_EVENT_KIND.CANDIDATE_COMMITTED, 'candidate_committed');
  assert.equal(BODY_CHANGE_EVENT_KIND.STABLE_SNAPSHOT_PUBLISHED, 'stable_snapshot_published');
  assert.equal(BODY_CHANGE_EVENT_KIND.ROLLBACK_EVIDENCE_RECORDED, 'rollback_evidence_recorded');
});
