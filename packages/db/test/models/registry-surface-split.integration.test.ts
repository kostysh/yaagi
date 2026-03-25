import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createExpandedModelEcologyStore,
  createRuntimeModelProfileStore,
} from '../../src/index.ts';
import { createPhase0ModelRouter } from '../../../../apps/core/src/runtime/index.ts';
import { createSubjectStateDbHarness } from '../../testing/subject-state-db-harness.ts';

void test('AC-F0014-07 richer registry source state extends the model_registry family without a shadow registry', async () => {
  const harness = createSubjectStateDbHarness();
  const profileStore = createRuntimeModelProfileStore(harness.db);
  const ecologyStore = createExpandedModelEcologyStore(harness.db);
  const router = createPhase0ModelRouter({
    fastModelBaseUrl: 'http://vllm-fast:8000/v1',
    store: profileStore,
  });

  await router.ensureBaselineProfiles();
  await profileStore.ensureModelProfiles([
    {
      modelProfileId: 'code.deep@shared',
      role: 'code',
      serviceId: 'vllm-deep',
      endpoint: 'http://vllm-deep:8001/v1',
      baseModel: 'model-deep',
      capabilities: ['code'],
      healthJson: { owner: 'F-0014' },
    },
  ]);
  await ecologyStore.upsertProfileHealth([
    {
      modelProfileId: 'code.deep@shared',
      serviceId: 'vllm-deep',
      availability: 'unavailable',
      quarantineState: 'active',
      healthy: false,
      errorRate: 1,
      latencyMsP95: null,
      checkedAt: '2026-03-25T20:10:00.000Z',
      sourceJson: { owner: 'F-0014', detail: 'optional organ absent' },
    },
  ]);
  await ecologyStore.replaceFallbackLinks([
    {
      modelProfileId: 'code.deep@shared',
      fallbackTargetProfileId: null,
      linkKind: 'predecessor',
      allowed: false,
      reason: 'no delivered richer fallback target',
      updatedAt: '2026-03-25T20:10:00.000Z',
    },
  ]);

  const allProfiles = await profileStore.listModelProfiles();
  const baselineDiagnostics = await router.getBaselineDiagnostics();
  const fallbackLinks = await ecologyStore.listFallbackLinks();

  assert.equal(allProfiles.length, 4);
  assert.deepEqual(
    baselineDiagnostics.map((profile) => profile.role),
    ['deliberation', 'reflex', 'reflection'],
  );
  assert.deepEqual(
    allProfiles.filter((profile) => profile.role === 'code').map((profile) => profile.serviceId),
    ['vllm-deep'],
  );
  assert.deepEqual(fallbackLinks, [
    {
      modelProfileId: 'code.deep@shared',
      fallbackTargetProfileId: null,
      linkKind: 'predecessor',
      allowed: false,
      reason: 'no delivered richer fallback target',
      updatedAt: '2026-03-25T20:10:00.000Z',
    },
  ]);
});
