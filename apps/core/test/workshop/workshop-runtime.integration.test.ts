import test from 'node:test';
import assert from 'node:assert/strict';
import { WORKSHOP_JOB_QUEUE, type WorkshopDatasetBuildRequest } from '@yaagi/contracts/workshop';
import {
  createWorkshopWorker,
  runWorkshopJobEnvelope,
  startBoundedWorkshopWorker,
  type WorkshopService,
} from '../../src/runtime/index.ts';
import {
  createPlatformConfigEnv,
  createPlatformTempWorkspace,
} from '../../testing/platform-test-fixture.ts';

void test('AC-F0015-02 registers the canonical workshop queue family on the pg-boss substrate and tears it down cleanly on startup failure', async () => {
  const calls: string[] = [];
  const service: WorkshopService = {
    buildDataset: () =>
      Promise.resolve({
        dataset: {
          datasetId: 'dataset-1',
          datasetKind: 'sft',
          sourceManifestJson: {},
          sourceEpisodeIdsJson: [],
          splitManifestJson: {},
          status: 'ready',
          createdAt: '2026-03-26T17:00:00.000Z',
        },
        manifestUri: 'file:///tmp/dataset-1.json',
      }),
    launchTrainingRun: () => Promise.reject(new Error('not used')),
    launchEvalRun: () => Promise.reject(new Error('not used')),
    registerModelCandidate: () => Promise.reject(new Error('not used')),
    recordCandidateStageTransition: () => Promise.reject(new Error('not used')),
    preparePromotionPackage: () => Promise.reject(new Error('not used')),
  };

  const root = await createPlatformTempWorkspace('yaagi-workshop-runtime-');
  try {
    const worker = createWorkshopWorker(
      {
        ...createPlatformConfigEnv(root),
        postgresUrl: 'postgres://unused',
        fastModelBaseUrl: 'http://127.0.0.1:8000/v1',
        fastModelDescriptorPath: `${root}/seed/models/base/vllm-fast-manifest.json`,
        deepModelBaseUrl: 'http://127.0.0.1:8001/v1',
        poolModelBaseUrl: 'http://127.0.0.1:8002/v1',
        telegramEnabled: false,
        telegramBotToken: null,
        telegramAllowedChatIds: [],
        telegramEgressEnabled: false,
        telegramOperatorChatId: null,
        telegramApiBaseUrl: 'https://api.telegram.org',
        seedRootPath: `${root}/seed`,
        seedConstitutionPath: `${root}/seed/constitution/constitution.yaml`,
        seedBodyPath: `${root}/seed/body`,
        seedSkillsPath: `${root}/seed/skills`,
        seedModelsPath: `${root}/seed/models`,
        seedDataPath: `${root}/seed/data`,
        workspaceBodyPath: `${root}/workspace/body`,
        workspaceSkillsPath: `${root}/workspace/skills`,
        modelsPath: `${root}/models`,
        dataPath: `${root}/data`,
        migrationsDir: `${root}/infra/migrations`,
        pgBossSchema: 'pgboss',
        operatorAuthPrincipalsFilePath: null,
        operatorAuthRateLimitWindowMs: 60_000,
        operatorAuthRateLimitMaxRequests: 120,
        host: '127.0.0.1',
        port: 8787,
        bootTimeoutMs: 60_000,
      },
      service,
      {
        createBoss: () => ({
          start: () => {
            calls.push('start');
            return Promise.resolve();
          },
          createQueue: (queueName: string) => {
            calls.push(`createQueue:${queueName}`);
            return Promise.resolve();
          },
          work: (queueName: string) => {
            calls.push(`work:${queueName}`);
            if (queueName === WORKSHOP_JOB_QUEUE.PREPARE_PROMOTION_PACKAGE) {
              return Promise.reject(new Error('workshop registration failed'));
            }
            return Promise.resolve();
          },
          offWork: (queueName: string) => {
            calls.push(`offWork:${queueName}`);
            return Promise.resolve();
          },
          stop: () => {
            calls.push('stop');
            return Promise.resolve();
          },
        }),
      },
    );

    await assert.rejects(() => worker.start(), /workshop registration failed/);
    await worker.stop();
    assert.ok(calls.includes(`createQueue:${WORKSHOP_JOB_QUEUE.DATASET_BUILD}`));
    assert.ok(calls.includes(`work:${WORKSHOP_JOB_QUEUE.DATASET_BUILD}`));
    assert.ok(calls.includes('stop'));
  } finally {
    await import('node:fs/promises').then(({ rm }) => rm(root, { recursive: true, force: true }));
  }
});

void test('AC-F0015-08 keeps workshop startup bounded by degrading instead of throwing when the worker cannot boot', async () => {
  const calls: string[] = [];
  const started = await startBoundedWorkshopWorker(
    {
      start: () => Promise.reject(new Error('workshop unavailable')),
      stop: () => {
        calls.push('stop');
        return Promise.resolve();
      },
    },
    (message, error) => {
      calls.push(`${message}:${error instanceof Error ? error.message : String(error)}`);
    },
  );

  assert.equal(started, false);
  assert.equal(calls[0]?.includes('workshop unavailable'), true);
});

void test('AC-F0015-02 routes canonical workshop envelopes to bounded service handlers instead of shell-style workflows', async () => {
  const calls: string[] = [];
  const service: WorkshopService = {
    buildDataset: (input: WorkshopDatasetBuildRequest) => {
      calls.push(`dataset:${input.requestId}`);
      return Promise.resolve({
        dataset: {
          datasetId: 'dataset-2',
          datasetKind: 'sft',
          sourceManifestJson: {},
          sourceEpisodeIdsJson: [],
          splitManifestJson: {},
          status: 'ready',
          createdAt: '2026-03-26T17:05:00.000Z',
        },
        manifestUri: 'file:///tmp/dataset-2.json',
      });
    },
    launchTrainingRun: () => Promise.reject(new Error('not used')),
    launchEvalRun: () => Promise.reject(new Error('not used')),
    registerModelCandidate: () => Promise.reject(new Error('not used')),
    recordCandidateStageTransition: () => Promise.reject(new Error('not used')),
    preparePromotionPackage: () => Promise.reject(new Error('not used')),
  };

  await runWorkshopJobEnvelope(service, {
    jobKind: 'dataset_build',
    requestId: 'dataset-job-1',
    requestedAt: '2026-03-26T17:05:00.000Z',
    payload: {
      requestId: 'dataset-job-1',
      datasetKind: 'sft',
      sourceEpisodeIds: ['episode-1'],
      sourceEvalRunIds: [],
      sourceHumanLabelIds: [],
      redactionProfile: 'episodes-redacted-v1',
    },
  });

  assert.deepEqual(calls, ['dataset:dataset-job-1']);
});

void test('AC-F0015-02 rejects malformed workshop envelopes instead of silently acknowledging unknown job kinds', async () => {
  const service: WorkshopService = {
    buildDataset: () => Promise.reject(new Error('not used')),
    launchTrainingRun: () => Promise.reject(new Error('not used')),
    launchEvalRun: () => Promise.reject(new Error('not used')),
    registerModelCandidate: () => Promise.reject(new Error('not used')),
    recordCandidateStageTransition: () => Promise.reject(new Error('not used')),
    preparePromotionPackage: () => Promise.reject(new Error('not used')),
  };

  await assert.rejects(
    () =>
      runWorkshopJobEnvelope(service, {
        jobKind: 'future_job_kind',
        requestId: 'bad-envelope-1',
        requestedAt: '2026-03-26T17:15:00.000Z',
        payload: {
          requestId: 'bad-envelope-1',
        },
      } as never),
    /unknown workshop jobKind/,
  );
});
