import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIALIST_REFUSAL_REASON } from '@yaagi/contracts/specialists';
import { createSpecialistPolicyTestHarness } from '../../testing/specialist-policy-fixture.ts';

void test('AC-F0027-04 / AC-F0027-17 refuses missing governor evidence', async () => {
  const harness = await createSpecialistPolicyTestHarness();

  const result = await harness.service.admitSpecialist(
    harness.admissionInput({
      requestId: 'admission-missing-governor',
      evidenceRefs: {
        servingReadinessRef: 'serving:vllm-fast:ready:1',
        releaseEvidenceRef: 'release:evidence:1',
        healthRef: 'health:ready:1',
      },
    }),
  );

  assert.equal(result.accepted, false);
  assert.equal(result.refusal.reason, SPECIALIST_REFUSAL_REASON.GOVERNOR_EVIDENCE_MISSING);
});

void test('AC-F0027-05 / AC-F0027-17 refuses missing serving readiness', async () => {
  const harness = await createSpecialistPolicyTestHarness();
  harness.evidence.servingDependencies.clear();

  const result = await harness.service.admitSpecialist(
    harness.admissionInput({ requestId: 'admission-missing-serving' }),
  );

  assert.equal(result.accepted, false);
  assert.equal(result.refusal.reason, SPECIALIST_REFUSAL_REASON.SERVING_READINESS_MISSING);
});

void test('AC-F0027-06 / AC-F0027-17 refuses missing release evidence for live rollout', async () => {
  const harness = await createSpecialistPolicyTestHarness();

  const result = await harness.service.admitSpecialist(
    harness.admissionInput({
      requestId: 'admission-missing-release',
      evidenceRefs: {
        governorDecisionRef: 'governor:allow:1',
        servingReadinessRef: 'serving:vllm-fast:ready:1',
        healthRef: 'health:ready:1',
      },
    }),
  );

  assert.equal(result.accepted, false);
  assert.equal(result.refusal.reason, SPECIALIST_REFUSAL_REASON.RELEASE_EVIDENCE_MISSING);
});

void test('AC-F0027-10 / AC-F0027-17 refuses live specialist without rollback target', async () => {
  const harness = await createSpecialistPolicyTestHarness({
    organ: {
      stage: 'candidate',
      rollbackTargetProfileId: null,
    },
  });

  const result = await harness.service.admitSpecialist(
    harness.admissionInput({ requestId: 'admission-missing-rollback' }),
  );

  assert.equal(result.accepted, false);
  assert.equal(result.refusal.reason, SPECIALIST_REFUSAL_REASON.ROLLBACK_TARGET_MISSING);
});
