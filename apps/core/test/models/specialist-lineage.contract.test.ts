import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPECIALIST_RETIREMENT_TRIGGER_KIND,
  SPECIALIST_ROLLOUT_STAGE,
} from '@yaagi/contracts/specialists';
import { createSpecialistPolicyTestHarness } from '../../testing/specialist-policy-fixture.ts';

void test('AC-F0027-11 preserves predecessor, fallback and retirement evidence after retirement', async () => {
  const harness = await createSpecialistPolicyTestHarness({
    organ: {
      stage: SPECIALIST_ROLLOUT_STAGE.STABLE,
      predecessorProfileId: 'summary.specialist@v0',
      rollbackTargetProfileId: 'summary.specialist@v0',
      fallbackTargetProfileId: 'deliberation.fast@baseline',
    },
    policy: {
      allowedStage: SPECIALIST_ROLLOUT_STAGE.STABLE,
      trafficLimit: null,
    },
  });

  await harness.service.retireSpecialist({
    requestId: 'retirement-lineage',
    specialistId: 'specialist.summary@v1',
    triggerKind: SPECIALIST_RETIREMENT_TRIGGER_KIND.SUPERSEDED,
    reason: 'superseded by a better specialist',
    evidenceRefs: ['workshop:evaluation:new-specialist', 'release:evidence:1'],
    replacementSpecialistId: 'specialist.summary@v2',
    fallbackTargetProfileId: 'deliberation.fast@baseline',
    requestedAt: '2026-04-28T10:02:00.000Z',
  });

  const organ = await harness.store.getSpecialistOrgan('specialist.summary@v1');
  const retirements = await harness.store.listRetirementDecisions({
    specialistId: 'specialist.summary@v1',
  });

  assert.equal(organ?.stage, SPECIALIST_ROLLOUT_STAGE.RETIRED);
  assert.equal(organ?.predecessorProfileId, 'summary.specialist@v0');
  assert.equal(retirements[0]?.replacementSpecialistId, 'specialist.summary@v2');
  assert.deepEqual(retirements[0]?.evidenceRefsJson, [
    'workshop:evaluation:new-specialist',
    'release:evidence:1',
  ]);
});
