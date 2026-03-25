import test from 'node:test';
import assert from 'node:assert/strict';
import { createExpandedModelEcologyStore, createRuntimeModelProfileStore } from '@yaagi/db';
import {
  PHASE0_BASELINE_PROFILE_ID,
  createExpandedModelEcologyService,
  createPhase0ModelRouter,
} from '../../src/runtime/index.ts';
import { createSubjectStateDbHarness } from '../../../../packages/db/testing/subject-state-db-harness.ts';

void test('AC-F0014-04 richer fallback preserves explicit reflection, structured refusal and selection-admission separation', async () => {
  const harness = createSubjectStateDbHarness();
  const profileStore = createRuntimeModelProfileStore(harness.db);
  const store = createExpandedModelEcologyStore(harness.db);
  const router = createPhase0ModelRouter({
    fastModelBaseUrl: 'http://vllm-fast:8000/v1',
    store: profileStore,
  });
  const service = createExpandedModelEcologyService({
    deepModelBaseUrl: 'http://vllm-deep:8001/v1',
    poolModelBaseUrl: 'http://vllm-pool:8002/v1',
    modelProfileStore: profileStore,
    store,
    probeService: () =>
      Promise.resolve({
        availability: 'unavailable',
        healthy: false,
        errorRate: 1,
        latencyMsP95: null,
        detail: 'optional organ absent',
      }),
  });

  await router.ensureBaselineProfiles();
  await service.ensureExpandedCatalog();

  const unsupported = await router.selectProfile({
    tickMode: 'reactive',
    taskKind: 'reactive.signal',
    latencyBudget: 'tight',
    riskLevel: 'low',
    contextSize: 64,
    requestedRole: 'embedding',
  });
  const fallbackLinks = await store.listFallbackLinks();
  const baselineDiagnostics = await router.getBaselineDiagnostics();

  assert.deepEqual(unsupported, {
    accepted: false,
    reason: 'unsupported_role',
    detail: 'requested baseline role "embedding" is not delivered in phase 0',
  });
  assert.ok(
    fallbackLinks.every(
      (link) =>
        link.allowed === false &&
        link.fallbackTargetProfileId === null &&
        link.reason === 'no delivered richer fallback target',
    ),
  );
  assert.ok(
    baselineDiagnostics.some(
      (profile) => profile.modelProfileId === PHASE0_BASELINE_PROFILE_ID.REFLECTION,
    ),
  );
});
