import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPECIALIST_EVIDENCE_CLASS,
  SPECIALIST_FOREIGN_WRITE_SURFACE,
  SPECIALIST_OWNED_WRITE_SURFACE,
  SPECIALIST_POLICY_OWNER,
  SPECIALIST_REFUSAL_REASON,
  SPECIALIST_ROLLOUT_STAGE,
  assertSpecialistOwnedWriteSurface,
  assertValidSpecialistAdmissionDecision,
  assertValidSpecialistOrgan,
  assertValidSpecialistRetirementDecision,
  assertValidSpecialistRolloutPolicy,
  isSpecialistLiveStage,
} from '../src/specialists.ts';

const createdAt = '2026-04-28T10:00:00.000Z';

void test('AC-F0027-01 / AC-F0027-02 / AC-F0027-03 defines one specialist policy owner surface', () => {
  assert.equal(SPECIALIST_POLICY_OWNER, 'F-0027');
  assert.deepEqual(Object.values(SPECIALIST_OWNED_WRITE_SURFACE), [
    'polyphony_runtime.specialist_organs',
    'polyphony_runtime.specialist_rollout_policies',
    'polyphony_runtime.specialist_rollout_events',
    'polyphony_runtime.specialist_admission_decisions',
    'polyphony_runtime.specialist_retirement_decisions',
  ]);
  assert.throws(
    () => assertSpecialistOwnedWriteSurface(SPECIALIST_FOREIGN_WRITE_SURFACE.MODEL_CANDIDATES),
    new RegExp(SPECIALIST_REFUSAL_REASON.FOREIGN_OWNER_WRITE_REJECTED),
  );
});

void test('AC-F0027-07 / AC-F0027-08 encodes staged specialist rollout semantics', () => {
  assert.deepEqual(Object.values(SPECIALIST_ROLLOUT_STAGE), [
    'candidate',
    'shadow',
    'limited-active',
    'active',
    'stable',
    'retiring',
    'retired',
  ]);
  assert.equal(isSpecialistLiveStage(SPECIALIST_ROLLOUT_STAGE.SHADOW), false);
  assert.equal(isSpecialistLiveStage(SPECIALIST_ROLLOUT_STAGE.LIMITED_ACTIVE), true);
  assert.equal(isSpecialistLiveStage(SPECIALIST_ROLLOUT_STAGE.ACTIVE), true);
  assert.equal(isSpecialistLiveStage(SPECIALIST_ROLLOUT_STAGE.STABLE), true);
});

void test('AC-F0027-10 validates live rollback target and limited-active traffic limit', () => {
  assert.throws(
    () =>
      assertValidSpecialistOrgan({
        specialistId: 'specialist.summary@v1',
        taskSignature: 'summarize.incident',
        capability: 'summarization',
        workshopCandidateId: 'candidate-specialist-1',
        promotionPackageRef: 'workshop-promotion:candidate-specialist-1',
        modelProfileId: 'summary.specialist@v1',
        serviceId: 'vllm-fast',
        predecessorProfileId: 'deliberation.fast@baseline',
        rollbackTargetProfileId: null,
        fallbackTargetProfileId: 'deliberation.fast@baseline',
        stage: SPECIALIST_ROLLOUT_STAGE.ACTIVE,
        statusReason: 'missing rollback target',
        currentPolicyId: 'policy-specialist-1',
        createdAt,
        updatedAt: createdAt,
      }),
    /rollbackTargetProfileId/,
  );

  assert.throws(
    () =>
      assertValidSpecialistRolloutPolicy({
        policyId: 'policy-specialist-1',
        requestId: 'policy-request-1',
        normalizedRequestHash: 'hash-1',
        specialistId: 'specialist.summary@v1',
        governedScope: 'summarize.incident',
        allowedStage: SPECIALIST_ROLLOUT_STAGE.LIMITED_ACTIVE,
        trafficLimit: null,
        requiredEvidenceClassesJson: [
          SPECIALIST_EVIDENCE_CLASS.WORKSHOP_PROMOTION,
          SPECIALIST_EVIDENCE_CLASS.GOVERNOR_DECISION,
        ],
        healthMaxAgeMs: 300_000,
        fallbackTargetProfileId: 'deliberation.fast@baseline',
        evidenceRefsJson: ['governor:allow:1'],
        createdAt,
      }),
    /trafficLimit/,
  );
});

void test('AC-F0027-11 validates admission and retirement decision shapes', () => {
  assert.doesNotThrow(() =>
    assertValidSpecialistAdmissionDecision({
      decisionId: 'admission-1',
      requestId: 'admission-request-1',
      normalizedRequestHash: 'hash-1',
      specialistId: 'specialist.summary@v1',
      taskSignature: 'summarize.incident',
      selectedModelProfileId: 'summary.specialist@v1',
      stage: SPECIALIST_ROLLOUT_STAGE.LIMITED_ACTIVE,
      decision: 'allow',
      reasonCode: 'admitted',
      fallbackTargetProfileId: 'deliberation.fast@baseline',
      evidenceRefsJson: ['workshop:promotion:1', 'governor:allow:1'],
      payloadJson: {},
      createdAt,
    }),
  );

  assert.doesNotThrow(() =>
    assertValidSpecialistRetirementDecision({
      retirementId: 'retirement-1',
      requestId: 'retirement-request-1',
      normalizedRequestHash: 'hash-1',
      specialistId: 'specialist.summary@v1',
      triggerKind: 'degraded',
      previousStage: SPECIALIST_ROLLOUT_STAGE.ACTIVE,
      replacementSpecialistId: null,
      fallbackTargetProfileId: 'deliberation.fast@baseline',
      evidenceRefsJson: ['health:degraded:1'],
      reason: 'health degraded beyond policy',
      createdAt,
    }),
  );
});
