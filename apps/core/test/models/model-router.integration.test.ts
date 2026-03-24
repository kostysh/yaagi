import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeModelProfileStore, type ModelRoutingDbExecutor } from '@yaagi/db';
import { createPhase0ModelRouter, PHASE0_BASELINE_PROFILE_ID } from '../../src/runtime/index.ts';
import { createSubjectStateDbHarness } from '../../../../packages/db/testing/subject-state-db-harness.ts';

void test('AC-F0008-01 loads baseline profiles from the canonical profile store', async () => {
  const harness = createSubjectStateDbHarness();
  const store = createRuntimeModelProfileStore(harness.db);
  const router = createPhase0ModelRouter({
    fastModelBaseUrl: 'http://vllm-fast:8000/v1',
    store,
  });

  const diagnostics = await router.ensureBaselineProfiles();
  const profiles = await store.listModelProfiles();

  assert.equal(profiles.length, 3);
  assert.deepEqual(profiles.map((profile) => profile.modelProfileId).sort(), [
    PHASE0_BASELINE_PROFILE_ID.DELIBERATION,
    PHASE0_BASELINE_PROFILE_ID.REFLECTION,
    PHASE0_BASELINE_PROFILE_ID.REFLEX,
  ]);
  assert.ok(
    profiles.every(
      (profile) =>
        profile.endpoint === 'http://vllm-fast:8000/v1' && profile.baseModel === 'model-fast',
    ),
  );
  assert.ok(
    profiles.every(
      (profile) => Array.isArray(profile.capabilitiesJson) && profile.capabilitiesJson.length > 0,
    ),
  );
  assert.ok(
    diagnostics.every(
      (profile) =>
        profile.eligibility === 'eligible' &&
        profile.healthSummary.healthy === true &&
        profile.status === 'active',
    ),
  );
});

void test('AC-F0008-01 rolls back baseline profile seeding on partial failure', async () => {
  const harness = createSubjectStateDbHarness();
  let modelRegistryUpserts = 0;
  const failingQuery = (async (sqlText: string, params?: unknown[]) => {
    if (sqlText.includes('insert into polyphony_runtime.model_registry')) {
      modelRegistryUpserts += 1;
      if (modelRegistryUpserts === 3) {
        throw new Error('forced baseline seed failure');
      }
    }

    return await harness.db.query(sqlText, params);
  }) as unknown as ModelRoutingDbExecutor['query'];
  const store = createRuntimeModelProfileStore({ query: failingQuery });
  const router = createPhase0ModelRouter({
    fastModelBaseUrl: 'http://vllm-fast:8000/v1',
    store,
  });

  await assert.rejects(router.ensureBaselineProfiles(), /forced baseline seed failure/);
  assert.equal(modelRegistryUpserts, 3);
  assert.deepEqual(await store.listModelProfiles(), []);
});

void test('AC-F0008-02 keeps reflection as an explicit profile or adapter-over-deliberation mapping', async () => {
  const harness = createSubjectStateDbHarness();
  const store = createRuntimeModelProfileStore(harness.db);
  const router = createPhase0ModelRouter({
    fastModelBaseUrl: 'http://vllm-fast:8000/v1',
    store,
  });

  await router.ensureBaselineProfiles();
  const profiles = await store.listModelProfiles();
  const reflection = profiles.find(
    (profile) => profile.modelProfileId === PHASE0_BASELINE_PROFILE_ID.REFLECTION,
  );
  const deliberation = profiles.find(
    (profile) => profile.modelProfileId === PHASE0_BASELINE_PROFILE_ID.DELIBERATION,
  );

  assert.ok(reflection);
  assert.ok(deliberation);
  assert.equal(reflection.adapterOf, deliberation.modelProfileId);
  assert.equal(reflection.role, 'reflection');
});
