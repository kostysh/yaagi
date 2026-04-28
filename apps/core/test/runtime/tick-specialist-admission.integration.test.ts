import test from 'node:test';
import assert from 'node:assert/strict';
import { createTickRuntimeHarness } from '../../testing/tick-runtime-harness.ts';
import { createSpecialistPolicyTestHarness } from '../../testing/specialist-policy-fixture.ts';

void test('AC-F0027-07 / AC-F0027-08 records specialist admission outcome before tick completion', async () => {
  const specialist = await createSpecialistPolicyTestHarness({ policy: { trafficLimit: 2 } });
  const tickHarness = createTickRuntimeHarness({
    now: () => '2026-04-28T10:00:00.000Z',
    executeTick: async (tick) => {
      const admission = await specialist.service.admitSpecialist(
        specialist.admissionInput({
          requestId: `specialist-admission:${tick.tickId}`,
        }),
      );

      return {
        status: 'completed',
        summary: 'tick evaluated specialist admission',
        result: {
          specialistAdmissionAccepted: admission.accepted,
          admissionDecisionId: admission.decision.decisionId,
        },
      };
    },
  });
  await tickHarness.runtime.start();

  const tick = await tickHarness.runtime.requestTick({
    requestId: 'tick-specialist-admission',
    kind: 'reactive',
    trigger: 'system',
    requestedAt: '2026-04-28T10:00:00.000Z',
    payload: { taskSignature: 'summarize.incident' },
  });

  assert.equal(tick.accepted, true);
  assert.equal(tickHarness.episodes.length, 2);
  assert.equal(tickHarness.episodes.at(-1)?.result['specialistAdmissionAccepted'], true);
  assert.equal(Object.values(specialist.dbHarness.state.admissionsById).length, 2);
});
