import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPECIALIST_ADMISSION_DECISION,
  SPECIALIST_REFUSAL_REASON,
  SPECIALIST_ROLLOUT_STAGE,
} from '@yaagi/contracts/specialists';
import { createSpecialistPolicyTestHarness } from '../../testing/specialist-policy-fixture.ts';

void test('AC-F0027-02 / AC-F0027-04 / AC-F0027-05 admits only after required specialist evidence is current', async () => {
  const harness = await createSpecialistPolicyTestHarness();

  const result = await harness.service.admitSpecialist(harness.admissionInput());

  assert.equal(result.accepted, true);
  assert.equal(result.decision.decision, SPECIALIST_ADMISSION_DECISION.ALLOW);
  assert.equal(result.decision.reasonCode, 'admitted');
  assert.equal(result.decision.stage, SPECIALIST_ROLLOUT_STAGE.LIMITED_ACTIVE);
  assert.equal(result.decision.selectedModelProfileId, 'summary.specialist@v1');
  assert.ok(result.decision.evidenceRefsJson.includes('governor:allow:1'));
  assert.ok(result.decision.evidenceRefsJson.includes('health:ready:1'));
});

void test('AC-F0027-07 persists refusal before invocation for shadow specialists', async () => {
  const harness = await createSpecialistPolicyTestHarness({
    organ: { stage: SPECIALIST_ROLLOUT_STAGE.SHADOW, rollbackTargetProfileId: null },
    policy: {
      allowedStage: SPECIALIST_ROLLOUT_STAGE.SHADOW,
      trafficLimit: null,
    },
  });
  let invocationCount = 0;

  const result = await harness.service.executeWithAdmittedSpecialist(
    harness.admissionInput({ requestId: 'admission-shadow' }),
    () => {
      invocationCount += 1;
      return Promise.resolve('must-not-run');
    },
  );

  assert.equal(result.accepted, false);
  assert.equal(result.specialistInvoked, false);
  assert.equal(invocationCount, 0);
  assert.equal(result.admission.refusal.reason, SPECIALIST_REFUSAL_REASON.SHADOW_NO_LIVE_AUTHORITY);
  assert.equal(Object.values(harness.dbHarness.state.admissionsById).length, 1);
});

void test('AC-F0027-08 refuses limited-active admissions after the explicit traffic limit', async () => {
  const harness = await createSpecialistPolicyTestHarness({
    policy: { trafficLimit: 1 },
  });

  const result = await harness.service.admitSpecialist(
    harness.admissionInput({
      requestId: 'admission-limit-exceeded',
      currentTrafficCount: 1,
    }),
  );

  assert.equal(result.accepted, false);
  assert.equal(result.decision.decision, SPECIALIST_ADMISSION_DECISION.REFUSAL);
  assert.equal(result.refusal.reason, SPECIALIST_REFUSAL_REASON.TRAFFIC_LIMIT_EXCEEDED);
});

void test('AC-F0027-09 refuses stale health evidence', async () => {
  const harness = await createSpecialistPolicyTestHarness({
    policy: { healthMaxAgeMs: 1_000 },
  });
  harness.evidence.healthEvidence.set('health:ready:1', {
    healthRef: 'health:ready:1',
    healthy: true,
    observedAt: '2026-04-28T09:00:00.000Z',
  });

  const result = await harness.service.admitSpecialist(
    harness.admissionInput({ requestId: 'admission-stale-health' }),
  );

  assert.equal(result.accepted, false);
  assert.equal(result.refusal.reason, SPECIALIST_REFUSAL_REASON.STALE_EVIDENCE);
});
