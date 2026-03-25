import test from 'node:test';
import assert from 'node:assert/strict';
import { createExpandedModelEcologyStore, createRuntimeModelProfileStore } from '@yaagi/db';
import {
  EXPANDED_MODEL_PROFILE_ID,
  createExpandedModelEcologyService,
} from '../../src/runtime/index.ts';
import { createSubjectStateDbHarness } from '../../../../packages/db/testing/subject-state-db-harness.ts';

void test('AC-F0014-03 richer source diagnostics feed bounded operator projection and CF-015 report input without creating shadow state', async () => {
  const harness = createSubjectStateDbHarness();
  const profileStore = createRuntimeModelProfileStore(harness.db);
  const store = createExpandedModelEcologyStore(harness.db);
  const service = createExpandedModelEcologyService({
    deepModelBaseUrl: 'http://vllm-deep:8001/v1',
    poolModelBaseUrl: 'http://vllm-pool:8002/v1',
    modelProfileStore: profileStore,
    store,
    probeService: ({ serviceId }) =>
      Promise.resolve(
        serviceId === 'vllm-deep'
          ? {
              availability: 'available',
              healthy: true,
              errorRate: 0,
              latencyMsP95: 125,
              detail: 'deep reachable',
            }
          : {
              availability: 'degraded',
              healthy: false,
              errorRate: 0.35,
              latencyMsP95: 290,
              detail: 'pool degraded',
            },
      ),
  });

  const summary = await service.syncRicherSourceDiagnostics();
  const reportInput = await service.getModelOrganHealthReportInput();

  assert.equal(summary.owner, 'F-0014');
  assert.deepEqual(
    summary.organs.map((organ) => ({
      modelProfileId: organ.modelProfileId,
      serviceId: organ.serviceId,
      availability: organ.availability,
      quarantineState: organ.quarantineState,
    })),
    [
      {
        modelProfileId: EXPANDED_MODEL_PROFILE_ID.CLASSIFIER_POOL,
        serviceId: 'vllm-pool',
        availability: 'degraded',
        quarantineState: 'active',
      },
      {
        modelProfileId: EXPANDED_MODEL_PROFILE_ID.CODE_DEEP,
        serviceId: 'vllm-deep',
        availability: 'available',
        quarantineState: 'clear',
      },
      {
        modelProfileId: EXPANDED_MODEL_PROFILE_ID.EMBEDDING_POOL,
        serviceId: 'vllm-pool',
        availability: 'degraded',
        quarantineState: 'active',
      },
      {
        modelProfileId: EXPANDED_MODEL_PROFILE_ID.RERANKER_POOL,
        serviceId: 'vllm-pool',
        availability: 'degraded',
        quarantineState: 'active',
      },
      {
        modelProfileId: EXPANDED_MODEL_PROFILE_ID.SAFETY_DEEP,
        serviceId: 'vllm-deep',
        availability: 'available',
        quarantineState: 'clear',
      },
    ],
  );
  assert.deepEqual(reportInput.profiles, summary.organs);
});
