import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhase0ModelRouter } from '../../src/runtime/index.ts';
import { createSpecialistPolicyTestHarness } from '../../testing/specialist-policy-fixture.ts';

void test('AC-F0027-12 refuses specialist admission without silently remapping to baseline', async () => {
  const harness = await createSpecialistPolicyTestHarness();
  harness.evidence.governorDecisions.clear();
  const router = createPhase0ModelRouter({
    fastModelBaseUrl: 'http://vllm-fast:8000/v1',
    store: {
      ensureModelProfiles: () => Promise.resolve([]),
      listModelProfiles: () => {
        throw new Error('baseline router must not remap a refused specialist');
      },
      persistTickModelSelection: () => {
        throw new Error('selection persistence must not run after specialist refusal');
      },
      setCurrentModelProfile: () => Promise.resolve(),
    },
    specialistPolicy: harness.service,
  });

  const selection = await router.admitSpecialistSelection(
    harness.admissionInput({ requestId: 'admission-no-remap' }),
  );

  assert.equal(selection.accepted, false);
  assert.equal(selection.accepted ? null : selection.reason, 'specialist_admission_refused');
  assert.equal(selection.accepted ? null : selection.remapped, false);
  assert.equal(
    selection.accepted ? null : selection.fallbackTargetProfileId,
    'deliberation.fast@baseline',
  );
});
