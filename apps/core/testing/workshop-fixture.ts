import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ServingDependencyState } from '@yaagi/contracts/models';
import { createWorkshopStore, type RuntimeModelProfileRow } from '@yaagi/db';
import { createWorkshopService } from '../src/workshop/service.ts';
import { createWorkshopDbHarness } from '../../../packages/db/testing/workshop-db-harness.ts';

export async function createWorkshopServiceHarness(): Promise<{
  root: string;
  service: ReturnType<typeof createWorkshopService>;
  store: ReturnType<typeof createWorkshopStore>;
  state: ReturnType<typeof createWorkshopDbHarness>['state'];
  cleanup: () => Promise<void>;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-workshop-'));
  await mkdir(path.join(root, 'data'), { recursive: true });
  await mkdir(path.join(root, 'models'), { recursive: true });

  const harness = createWorkshopDbHarness();
  const store = createWorkshopStore(harness.db);
  const dependencyProfiles = new Map<string, RuntimeModelProfileRow>([
    [
      'deliberation.fast@baseline',
      {
        modelProfileId: 'deliberation.fast@baseline',
        role: 'deliberation',
        serviceId: 'vllm-fast',
        endpoint: 'http://vllm-fast:8000/v1',
        artifactUri: 'file:///runtime/models/base/vllm-fast/google--gemma-4-E4B-it',
        baseModel: 'google/gemma-4-E4B-it',
        adapterOf: null,
        capabilitiesJson: ['deliberation', 'structured-output'],
        costJson: {},
        healthJson: {},
        status: 'active',
        createdAt: '2026-03-26T17:00:00.000Z',
        updatedAt: '2026-03-26T17:00:00.000Z',
      },
    ],
    [
      'specialist.predecessor@shared',
      {
        modelProfileId: 'specialist.predecessor@shared',
        role: 'code',
        serviceId: 'vllm-deep',
        endpoint: 'http://vllm-deep:8000/v1',
        artifactUri: 'file:///runtime/models/base/vllm-deep/specialist-predecessor',
        baseModel: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-14B',
        adapterOf: null,
        capabilitiesJson: ['specialist'],
        costJson: {},
        healthJson: {},
        status: 'active',
        createdAt: '2026-03-26T17:00:00.000Z',
        updatedAt: '2026-03-26T17:00:00.000Z',
      },
    ],
  ]);
  const servingDependencies: ServingDependencyState[] = [
    {
      serviceId: 'vllm-fast',
      endpoint: 'http://vllm-fast:8000/v1',
      bootCritical: true,
      optionalUntilPromoted: false,
      artifactUri: 'file:///runtime/models/base/vllm-fast/google--gemma-4-E4B-it',
      artifactDescriptorPath: '/seed/models/base/vllm-fast-manifest.json',
      runtimeArtifactRoot: '/models/base/vllm-fast',
      readiness: 'ready',
      readinessBasis: 'probe_passed',
      candidateId: 'gemma-4-e4b-it',
      baseModel: 'google/gemma-4-E4B-it',
      servedModelName: 'phase-0-fast',
      detail: 'qualification-selected fast dependency is ready',
      lastCheckedAt: '2026-03-26T17:00:00.000Z',
    },
    {
      serviceId: 'vllm-deep',
      endpoint: 'http://vllm-deep:8000/v1',
      bootCritical: false,
      optionalUntilPromoted: true,
      artifactUri: 'file:///runtime/models/base/vllm-deep/specialist-predecessor',
      artifactDescriptorPath: '/seed/models/base/vllm-fast-manifest.json',
      runtimeArtifactRoot: '/models/base/vllm-deep',
      readiness: 'ready',
      readinessBasis: 'probe_passed',
      candidateId: null,
      baseModel: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-14B',
      servedModelName: null,
      detail: 'optional deep dependency remains available',
      lastCheckedAt: '2026-03-26T17:00:00.000Z',
    },
  ];
  const service = createWorkshopService({
    store,
    dataPath: path.join(root, 'data'),
    modelsPath: path.join(root, 'models'),
    createId: (() => {
      let index = 0;
      return () => `workshop-${++index}`;
    })(),
    now: (() => {
      let index = 0;
      return () => new Date(Date.UTC(2026, 2, 26, 17, 0, index++));
    })(),
    getServingDependencyStates: () => Promise.resolve(servingDependencies),
    getModelProfileById: (modelProfileId) =>
      Promise.resolve(dependencyProfiles.get(modelProfileId) ?? null),
  });

  return {
    root,
    service,
    store,
    state: harness.state,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}
