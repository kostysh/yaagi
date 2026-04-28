import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhase0ModelRouter } from '../../src/runtime/index.ts';
import { createSpecialistPolicyTestHarness } from '../../testing/specialist-policy-fixture.ts';

void test('AC-F0027-02 / AC-F0027-12 admits a router-proposed specialist only through policy service', async () => {
  const harness = await createSpecialistPolicyTestHarness();
  const router = createPhase0ModelRouter({
    fastModelBaseUrl: 'http://vllm-fast:8000/v1',
    store: {
      ensureModelProfiles: () => Promise.resolve([]),
      listModelProfiles: () => Promise.resolve([]),
      persistTickModelSelection: () => {
        throw new Error('baseline selection persistence is not part of specialist admission');
      },
      setCurrentModelProfile: () => Promise.resolve(),
    },
    specialistPolicy: harness.service,
  });

  const selection = await router.admitSpecialistSelection(harness.admissionInput());

  assert.equal(selection.accepted, true);
  assert.equal(selection.accepted ? selection.specialistId : null, 'specialist.summary@v1');
  assert.equal(selection.accepted ? selection.modelProfileId : null, 'summary.specialist@v1');
  assert.equal(Object.values(harness.dbHarness.state.admissionsById).length, 1);
});

void test('AC-F0027-02 / AC-F0027-08 refuses replayed router specialist admission as non-invocable', async () => {
  const harness = await createSpecialistPolicyTestHarness();
  const router = createPhase0ModelRouter({
    fastModelBaseUrl: 'http://vllm-fast:8000/v1',
    store: {
      ensureModelProfiles: () => Promise.resolve([]),
      listModelProfiles: () => {
        throw new Error('baseline router must not remap a replayed specialist admission');
      },
      persistTickModelSelection: () => {
        throw new Error('selection persistence must not run after specialist replay');
      },
      setCurrentModelProfile: () => Promise.resolve(),
    },
    specialistPolicy: harness.service,
  });

  const input = harness.admissionInput({ requestId: 'admission-router-replay' });
  const first = await router.admitSpecialistSelection(input);
  const replay = await router.admitSpecialistSelection(input);

  assert.equal(first.accepted, true);
  assert.equal(replay.accepted, false);
  assert.equal(replay.accepted ? null : replay.reason, 'specialist_admission_replayed');
  assert.equal(replay.accepted ? null : replay.remapped, false);
  assert.equal(Object.values(harness.dbHarness.state.admissionsById).length, 1);
});
