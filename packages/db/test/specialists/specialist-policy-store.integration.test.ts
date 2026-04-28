import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPECIALIST_EVIDENCE_CLASS,
  SPECIALIST_REFUSAL_REASON,
  SPECIALIST_RETIREMENT_TRIGGER_KIND,
  SPECIALIST_ROLLOUT_EVENT_DECISION,
  SPECIALIST_ROLLOUT_STAGE,
  type SpecialistOrganRow,
  type SpecialistRolloutPolicyRow,
} from '@yaagi/contracts/specialists';
import { createSpecialistPolicyStore } from '../../src/index.ts';
import { createSpecialistPolicyDbHarness } from '../../testing/specialist-policy-db-harness.ts';

const now = '2026-04-28T10:00:00.000Z';

const baseOrgan = (patch: Partial<SpecialistOrganRow> = {}): SpecialistOrganRow => ({
  specialistId: 'specialist.summary@v1',
  taskSignature: 'summarize.incident',
  capability: 'summarization',
  workshopCandidateId: 'candidate-specialist-1',
  promotionPackageRef: 'workshop-promotion:candidate-specialist-1',
  modelProfileId: 'summary.specialist@v1',
  serviceId: 'vllm-fast',
  predecessorProfileId: 'deliberation.fast@baseline',
  rollbackTargetProfileId: 'deliberation.fast@baseline',
  fallbackTargetProfileId: 'deliberation.fast@baseline',
  stage: SPECIALIST_ROLLOUT_STAGE.CANDIDATE,
  statusReason: 'registered for policy rollout',
  currentPolicyId: null,
  createdAt: now,
  updatedAt: now,
  ...patch,
});

const basePolicy = (
  patch: Partial<SpecialistRolloutPolicyRow> = {},
): SpecialistRolloutPolicyRow => ({
  policyId: 'policy-specialist-1',
  requestId: 'policy-request-1',
  normalizedRequestHash: 'policy-hash-1',
  specialistId: 'specialist.summary@v1',
  governedScope: 'summarize.incident',
  allowedStage: SPECIALIST_ROLLOUT_STAGE.LIMITED_ACTIVE,
  trafficLimit: 2,
  requiredEvidenceClassesJson: [
    SPECIALIST_EVIDENCE_CLASS.WORKSHOP_PROMOTION,
    SPECIALIST_EVIDENCE_CLASS.GOVERNOR_DECISION,
    SPECIALIST_EVIDENCE_CLASS.SERVING_READINESS,
    SPECIALIST_EVIDENCE_CLASS.RELEASE_EVIDENCE,
    SPECIALIST_EVIDENCE_CLASS.HEALTH,
    SPECIALIST_EVIDENCE_CLASS.ROLLBACK_TARGET,
  ],
  healthMaxAgeMs: 300_000,
  fallbackTargetProfileId: 'deliberation.fast@baseline',
  evidenceRefsJson: ['governor:allow:1'],
  createdAt: now,
  ...patch,
});

void test('AC-F0027-01 / AC-F0027-03 persists specialist policy truth without foreign owner writes', async () => {
  const harness = createSpecialistPolicyDbHarness();
  const store = createSpecialistPolicyStore(harness.db);

  const organ = await store.registerSpecialistOrgan(baseOrgan());
  const policyResult = await store.recordRolloutPolicy(basePolicy());
  const rolloutResult = await store.recordRolloutEvent({
    eventId: 'rollout-event-1',
    requestId: 'rollout-request-1',
    normalizedRequestHash: 'rollout-hash-1',
    policyId: 'policy-specialist-1',
    specialistId: organ.specialistId,
    fromStage: organ.stage,
    toStage: SPECIALIST_ROLLOUT_STAGE.LIMITED_ACTIVE,
    decision: SPECIALIST_ROLLOUT_EVENT_DECISION.RECORDED,
    reasonCode: 'stage_recorded',
    actorRef: 'operator:1',
    evidenceRefsJson: [
      'workshop-promotion:candidate-specialist-1',
      'governor:allow:1',
      'release:evidence:1',
    ],
    createdAt: '2026-04-28T10:01:00.000Z',
  });

  assert.equal(policyResult.accepted, true);
  assert.equal(rolloutResult.accepted, true);
  assert.equal(
    harness.state.organsById['specialist.summary@v1']?.stage,
    SPECIALIST_ROLLOUT_STAGE.LIMITED_ACTIVE,
  );
  assert.equal(
    harness.state.organsById['specialist.summary@v1']?.currentPolicyId,
    'policy-specialist-1',
  );
  assert.deepEqual(
    Object.keys(harness.state).filter((key) => key.includes('workshop') || key.includes('release')),
    [],
  );
});

void test('AC-F0027-17 / AC-F0027-11 provides idempotent replay and conflicting request rejection', async () => {
  const harness = createSpecialistPolicyDbHarness();
  const store = createSpecialistPolicyStore(harness.db);
  await store.registerSpecialistOrgan(baseOrgan());

  const first = await store.recordRolloutPolicy(basePolicy());
  const replay = await store.recordRolloutPolicy(basePolicy());
  const conflict = await store.recordRolloutPolicy(
    basePolicy({
      allowedStage: SPECIALIST_ROLLOUT_STAGE.ACTIVE,
      normalizedRequestHash: 'different-policy-hash',
      trafficLimit: null,
    }),
  );

  assert.deepEqual([first.accepted, first.accepted ? first.deduplicated : null], [true, false]);
  assert.deepEqual([replay.accepted, replay.accepted ? replay.deduplicated : null], [true, true]);
  assert.equal(conflict.accepted, false);
  if (!conflict.accepted) {
    assert.equal(conflict.reason, 'conflicting_request_id');
  }
});

void test('AC-F0027-11 records append-only retirement and blocks terminal stage overwrite', async () => {
  const harness = createSpecialistPolicyDbHarness();
  const store = createSpecialistPolicyStore(harness.db);
  await store.registerSpecialistOrgan(
    baseOrgan({
      stage: SPECIALIST_ROLLOUT_STAGE.ACTIVE,
      currentPolicyId: 'policy-specialist-1',
    }),
  );
  await store.recordRolloutPolicy(basePolicy({ allowedStage: SPECIALIST_ROLLOUT_STAGE.ACTIVE }));

  const retirement = await store.recordRetirementDecision({
    retirementId: 'retirement-1',
    requestId: 'retirement-request-1',
    normalizedRequestHash: 'retirement-hash-1',
    specialistId: 'specialist.summary@v1',
    triggerKind: SPECIALIST_RETIREMENT_TRIGGER_KIND.DEGRADED,
    previousStage: SPECIALIST_ROLLOUT_STAGE.ACTIVE,
    replacementSpecialistId: null,
    fallbackTargetProfileId: 'deliberation.fast@baseline',
    evidenceRefsJson: ['health:degraded:1'],
    reason: 'health degraded beyond policy',
    createdAt: '2026-04-28T10:02:00.000Z',
  });
  const laterRollout = await store.recordRolloutEvent({
    eventId: 'rollout-event-after-retired',
    requestId: 'rollout-request-after-retired',
    normalizedRequestHash: 'rollout-after-retired-hash',
    policyId: 'policy-specialist-1',
    specialistId: 'specialist.summary@v1',
    fromStage: SPECIALIST_ROLLOUT_STAGE.RETIRED,
    toStage: SPECIALIST_ROLLOUT_STAGE.ACTIVE,
    decision: SPECIALIST_ROLLOUT_EVENT_DECISION.RECORDED,
    reasonCode: 'stage_recorded',
    actorRef: 'operator:1',
    evidenceRefsJson: ['governor:allow:2', 'release:evidence:2'],
    createdAt: '2026-04-28T10:03:00.000Z',
  });

  assert.equal(retirement.accepted, true);
  assert.equal(
    harness.state.organsById['specialist.summary@v1']?.stage,
    SPECIALIST_ROLLOUT_STAGE.RETIRED,
  );
  assert.equal(laterRollout.accepted, false);
  if (!laterRollout.accepted) {
    assert.equal(laterRollout.reason, 'terminal_stage_conflict');
    assert.equal(laterRollout.row.reasonCode, SPECIALIST_REFUSAL_REASON.TERMINAL_STAGE_CONFLICT);
  }
  assert.equal(
    (await store.listRetirementDecisions({ specialistId: 'specialist.summary@v1' })).length,
    1,
  );
});

void test('AC-F0027-06 refuses live rollout events without release evidence', async () => {
  const harness = createSpecialistPolicyDbHarness();
  const store = createSpecialistPolicyStore(harness.db);
  const organ = await store.registerSpecialistOrgan(baseOrgan());
  await store.recordRolloutPolicy(basePolicy());

  const rolloutResult = await store.recordRolloutEvent({
    eventId: 'rollout-event-missing-release',
    requestId: 'rollout-request-missing-release',
    normalizedRequestHash: 'rollout-missing-release-hash',
    policyId: 'policy-specialist-1',
    specialistId: organ.specialistId,
    fromStage: organ.stage,
    toStage: SPECIALIST_ROLLOUT_STAGE.LIMITED_ACTIVE,
    decision: SPECIALIST_ROLLOUT_EVENT_DECISION.RECORDED,
    reasonCode: 'stage_recorded',
    actorRef: 'operator:1',
    evidenceRefsJson: ['workshop-promotion:candidate-specialist-1', 'governor:allow:1'],
    createdAt: '2026-04-28T10:01:00.000Z',
  });

  assert.equal(rolloutResult.accepted, false);
  if (!rolloutResult.accepted) {
    assert.equal(rolloutResult.reason, 'release_evidence_missing');
    assert.equal(rolloutResult.row.reasonCode, SPECIALIST_REFUSAL_REASON.RELEASE_EVIDENCE_MISSING);
  }
  assert.equal(
    harness.state.organsById['specialist.summary@v1']?.stage,
    SPECIALIST_ROLLOUT_STAGE.CANDIDATE,
  );
});

void test('AC-F0027-11 keeps retired organs terminal across register replay', async () => {
  const harness = createSpecialistPolicyDbHarness();
  const store = createSpecialistPolicyStore(harness.db);
  await store.registerSpecialistOrgan(baseOrgan({ stage: SPECIALIST_ROLLOUT_STAGE.ACTIVE }));
  await store.recordRetirementDecision({
    retirementId: 'retirement-terminal-register-1',
    requestId: 'retirement-terminal-register-request-1',
    normalizedRequestHash: 'retirement-terminal-register-hash',
    specialistId: 'specialist.summary@v1',
    triggerKind: SPECIALIST_RETIREMENT_TRIGGER_KIND.DEGRADED,
    previousStage: SPECIALIST_ROLLOUT_STAGE.ACTIVE,
    replacementSpecialistId: null,
    fallbackTargetProfileId: 'deliberation.fast@baseline',
    evidenceRefsJson: ['health:degraded:1'],
    reason: 'health degraded beyond policy',
    createdAt: '2026-04-28T10:02:00.000Z',
  });

  const replay = await store.registerSpecialistOrgan(
    baseOrgan({
      stage: SPECIALIST_ROLLOUT_STAGE.ACTIVE,
      statusReason: 'attempted overwrite',
      updatedAt: '2026-04-28T10:03:00.000Z',
    }),
  );

  assert.equal(replay.stage, SPECIALIST_ROLLOUT_STAGE.RETIRED);
  assert.equal(
    harness.state.organsById['specialist.summary@v1']?.stage,
    SPECIALIST_ROLLOUT_STAGE.RETIRED,
  );
});

void test('AC-F0027-02 final allow recheck refuses stale policy identity before persisting allow', async () => {
  const harness = createSpecialistPolicyDbHarness();
  const store = createSpecialistPolicyStore(harness.db);
  await store.registerSpecialistOrgan(
    baseOrgan({
      stage: SPECIALIST_ROLLOUT_STAGE.LIMITED_ACTIVE,
      currentPolicyId: 'policy-specialist-1',
    }),
  );
  await store.recordRolloutPolicy(basePolicy());
  await store.recordRolloutPolicy(
    basePolicy({
      policyId: 'policy-specialist-2',
      requestId: 'policy-request-2',
      normalizedRequestHash: 'policy-hash-2',
      allowedStage: SPECIALIST_ROLLOUT_STAGE.LIMITED_ACTIVE,
      trafficLimit: 2,
    }),
  );

  const result = await store.recordAdmissionDecision({
    decisionId: 'admission-stale-policy-1',
    requestId: 'admission-stale-policy-request-1',
    normalizedRequestHash: 'admission-stale-policy-hash',
    specialistId: 'specialist.summary@v1',
    taskSignature: 'summarize.incident',
    selectedModelProfileId: 'summary.specialist@v1',
    stage: SPECIALIST_ROLLOUT_STAGE.LIMITED_ACTIVE,
    decision: 'allow',
    reasonCode: 'admitted',
    fallbackTargetProfileId: 'deliberation.fast@baseline',
    evidenceRefsJson: ['release:evidence:1'],
    payloadJson: {
      policyId: 'policy-specialist-1',
      serviceId: 'vllm-fast',
      governedScope: 'summarize.incident',
      trafficLimit: 2,
      rollbackTargetProfileId: 'deliberation.fast@baseline',
    },
    createdAt: '2026-04-28T10:04:00.000Z',
  });

  assert.equal(result.accepted, false);
  if (!result.accepted) {
    assert.equal(result.reason, 'terminal_stage_conflict');
    assert.equal(result.row.decision, 'refusal');
    assert.equal(result.row.reasonCode, SPECIALIST_REFUSAL_REASON.TERMINAL_STAGE_CONFLICT);
  }
});
