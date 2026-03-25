import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODEL_PROFILE_STATUS,
  createExpandedModelEcologyStore,
  createRuntimeModelProfileStore,
} from '../../src/index.ts';
import { createSubjectStateDbHarness } from '../../testing/subject-state-db-harness.ts';

void test('AC-F0014-02 richer organ families persist explicit capability and status metadata without replacing baseline ownership', async () => {
  const harness = createSubjectStateDbHarness();
  const profileStore = createRuntimeModelProfileStore(harness.db);
  const ecologyStore = createExpandedModelEcologyStore(harness.db);

  await profileStore.ensureModelProfiles([
    {
      modelProfileId: 'code.deep@shared',
      role: 'code',
      serviceId: 'vllm-deep',
      endpoint: 'http://vllm-deep:8001/v1',
      baseModel: 'model-deep',
      capabilities: ['code', 'structured-output'],
      costJson: { class: 'shared-deep' },
      healthJson: { owner: 'F-0014' },
      status: MODEL_PROFILE_STATUS.ACTIVE,
    },
    {
      modelProfileId: 'embedding.pool@shared',
      role: 'embedding',
      serviceId: 'vllm-pool',
      endpoint: 'http://vllm-pool:8002/v1',
      baseModel: 'model-pool',
      capabilities: ['embedding'],
      costJson: { class: 'shared-pool' },
      healthJson: { owner: 'F-0014' },
      status: MODEL_PROFILE_STATUS.DEGRADED,
    },
  ]);

  await ecologyStore.upsertProfileHealth([
    {
      modelProfileId: 'code.deep@shared',
      serviceId: 'vllm-deep',
      availability: 'available',
      quarantineState: 'clear',
      healthy: true,
      errorRate: 0,
      latencyMsP95: 140,
      checkedAt: '2026-03-25T20:00:00.000Z',
      sourceJson: { owner: 'F-0014', detail: 'deep reachable' },
    },
    {
      modelProfileId: 'embedding.pool@shared',
      serviceId: 'vllm-pool',
      availability: 'degraded',
      quarantineState: 'active',
      healthy: false,
      errorRate: 0.4,
      latencyMsP95: 310,
      checkedAt: '2026-03-25T20:00:01.000Z',
      sourceJson: { owner: 'F-0014', detail: 'pool degraded' },
    },
  ]);

  const profiles = await profileStore.listModelProfiles({
    roles: ['code', 'embedding'],
  });
  const healthRows = await ecologyStore.listProfileHealth();

  assert.deepEqual(
    profiles.map((profile) => ({
      modelProfileId: profile.modelProfileId,
      role: profile.role,
      serviceId: profile.serviceId,
      status: profile.status,
      capabilities: profile.capabilitiesJson,
    })),
    [
      {
        modelProfileId: 'code.deep@shared',
        role: 'code',
        serviceId: 'vllm-deep',
        status: 'active',
        capabilities: ['code', 'structured-output'],
      },
      {
        modelProfileId: 'embedding.pool@shared',
        role: 'embedding',
        serviceId: 'vllm-pool',
        status: 'degraded',
        capabilities: ['embedding'],
      },
    ],
  );
  assert.deepEqual(
    healthRows.map((row) => ({
      modelProfileId: row.modelProfileId,
      serviceId: row.serviceId,
      availability: row.availability,
      quarantineState: row.quarantineState,
    })),
    [
      {
        modelProfileId: 'code.deep@shared',
        serviceId: 'vllm-deep',
        availability: 'available',
        quarantineState: 'clear',
      },
      {
        modelProfileId: 'embedding.pool@shared',
        serviceId: 'vllm-pool',
        availability: 'degraded',
        quarantineState: 'active',
      },
    ],
  );
});
