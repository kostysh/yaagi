import test from 'node:test';
import assert from 'node:assert/strict';
import { WORKSHOP_CANDIDATE_KIND } from '@yaagi/contracts/workshop';
import { SPECIALIST_REFUSAL_REASON } from '@yaagi/contracts/specialists';
import { createSpecialistPolicyTestHarness } from '../../testing/specialist-policy-fixture.ts';

void test('AC-F0027-04 / AC-F0027-05 / AC-F0027-06 consumes upstream evidence read-only before admission', async () => {
  const harness = await createSpecialistPolicyTestHarness();

  const result = await harness.service.admitSpecialist(harness.admissionInput());

  assert.equal(result.accepted, true);
  assert.equal(
    harness.evidence.promotionPackages.get('workshop-promotion:candidate-specialist-1')
      ?.candidateKind,
    WORKSHOP_CANDIDATE_KIND.SPECIALIST_CANDIDATE,
  );
  assert.equal(harness.evidence.governorDecisions.get('governor:allow:1')?.approved, true);
  assert.equal(harness.evidence.servingDependencies.get('vllm-fast')?.readiness, 'ready');
  assert.equal(harness.evidence.releaseEvidence.get('release:evidence:1')?.ready, true);
});

void test('AC-F0027-14 rejects a non-specialist workshop package without mutating workshop truth', async () => {
  const harness = await createSpecialistPolicyTestHarness();
  const packageRef = 'workshop-promotion:candidate-specialist-1';
  const packageBefore = harness.evidence.promotionPackages.get(packageRef);
  assert.ok(packageBefore);
  harness.evidence.promotionPackages.set(packageRef, {
    ...packageBefore,
    candidateKind: WORKSHOP_CANDIDATE_KIND.SHARED_ADAPTER,
  });

  const result = await harness.service.admitSpecialist(
    harness.admissionInput({ requestId: 'admission-non-specialist-package' }),
  );

  assert.equal(result.accepted, false);
  assert.equal(result.refusal.reason, SPECIALIST_REFUSAL_REASON.WORKSHOP_CANDIDATE_INVALID);
  assert.equal(
    harness.evidence.promotionPackages.get(packageRef)?.candidateKind,
    WORKSHOP_CANDIDATE_KIND.SHARED_ADAPTER,
  );
});
