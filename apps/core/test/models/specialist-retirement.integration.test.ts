import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPECIALIST_REFUSAL_REASON,
  SPECIALIST_RETIREMENT_TRIGGER_KIND,
  SPECIALIST_ROLLOUT_STAGE,
} from '@yaagi/contracts/specialists';
import { createSpecialistPolicyTestHarness } from '../../testing/specialist-policy-fixture.ts';

void test('AC-F0027-03 / AC-F0027-11 retirement preserves lineage and refuses future admissions', async () => {
  const harness = await createSpecialistPolicyTestHarness({
    organ: { stage: SPECIALIST_ROLLOUT_STAGE.ACTIVE },
    policy: { allowedStage: SPECIALIST_ROLLOUT_STAGE.ACTIVE, trafficLimit: null },
  });

  const retirement = await harness.service.retireSpecialist({
    requestId: 'retirement-request-1',
    specialistId: 'specialist.summary@v1',
    triggerKind: SPECIALIST_RETIREMENT_TRIGGER_KIND.DEGRADED,
    reason: 'health degraded beyond threshold',
    evidenceRefs: ['health:degraded:1', 'release:evidence:1'],
    fallbackTargetProfileId: 'deliberation.fast@baseline',
    requestedAt: '2026-04-28T10:02:00.000Z',
  });
  const admission = await harness.service.admitSpecialist(
    harness.admissionInput({ requestId: 'admission-after-retirement' }),
  );
  const retirements = await harness.store.listRetirementDecisions({
    specialistId: 'specialist.summary@v1',
  });

  assert.equal(retirement.accepted, true);
  assert.equal(retirements.length, 1);
  assert.equal(retirements[0]?.previousStage, SPECIALIST_ROLLOUT_STAGE.ACTIVE);
  assert.deepEqual(retirements[0]?.evidenceRefsJson, ['health:degraded:1', 'release:evidence:1']);
  assert.equal(admission.accepted, false);
  assert.equal(
    admission.accepted ? null : admission.refusal.reason,
    SPECIALIST_REFUSAL_REASON.RETIRED,
  );
});

void test('AC-F0027-11 gives idempotent retirement replay and fails closed on conflicting replay', async () => {
  const harness = await createSpecialistPolicyTestHarness({
    organ: { stage: SPECIALIST_ROLLOUT_STAGE.ACTIVE },
    policy: { allowedStage: SPECIALIST_ROLLOUT_STAGE.ACTIVE, trafficLimit: null },
  });
  const input = {
    requestId: 'retirement-request-replay',
    specialistId: 'specialist.summary@v1',
    triggerKind: SPECIALIST_RETIREMENT_TRIGGER_KIND.STALE,
    reason: 'evidence stale',
    evidenceRefs: ['health:stale:1'],
    fallbackTargetProfileId: 'deliberation.fast@baseline',
    requestedAt: '2026-04-28T10:02:00.000Z',
  };

  const first = await harness.service.retireSpecialist(input);
  const replay = await harness.service.retireSpecialist(input);
  const conflict = await harness.service.retireSpecialist({
    ...input,
    reason: 'different retirement reason',
  });

  assert.equal(first.accepted, true);
  assert.equal(replay.accepted, true);
  assert.equal(replay.accepted ? replay.deduplicated : null, true);
  assert.equal(conflict.accepted, false);
});
