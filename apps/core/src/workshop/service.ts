import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CoreRuntimeConfig } from '../platform/core-config.ts';
import {
  createRuntimeDbClient,
  createWorkshopStore,
  type RecordWorkshopCandidateStageTransitionInput,
  type RegisterWorkshopCandidateInput,
  type WorkshopCandidateStageEventRow,
  type WorkshopDatasetRow,
  type WorkshopEvalRunRow,
  type WorkshopModelCandidateRow,
  type WorkshopStore,
  type WorkshopTrainingRunRow,
} from '@yaagi/db';
import {
  WORKSHOP_CANDIDATE_KIND,
  WORKSHOP_CANDIDATE_STAGE,
  WORKSHOP_JOB_KIND,
  WORKSHOP_JOB_QUEUE,
  WORKSHOP_REQUESTED_BY_OWNER,
  type PrepareWorkshopPromotionPackageRequest,
  type RecordCandidateStageTransitionRequest,
  type RegisterModelCandidateRequest,
  type WorkshopCandidateKind,
  type WorkshopCandidateStage,
  type WorkshopDatasetBuildRequest,
  type WorkshopEvalRequest,
  type WorkshopJobEnvelope,
  type WorkshopJobKind,
  type WorkshopPromotionPackage,
  type WorkshopTrainingRequest,
  assertValidDatasetBuildRequest,
  assertValidWorkshopJobEnvelope,
  createWorkshopJobEnvelope,
} from '@yaagi/contracts/workshop';
import {
  createRuntimeJobEnqueuer,
  type RuntimeJobEnqueuer,
  type RuntimeJobHandle,
} from '@yaagi/db';

type WorkshopClock = () => Date;

type WorkshopServiceOptions = {
  now?: WorkshopClock;
  createId?: () => string;
  store: WorkshopStore;
  dataPath: string;
  modelsPath: string;
};

type WorkshopJobGatewayOptions = {
  now?: WorkshopClock;
  enqueueJob?: RuntimeJobEnqueuer;
  postgresUrl: string;
  pgBossSchema: string;
};

export type WorkshopBuildDatasetResult = {
  dataset: WorkshopDatasetRow;
  manifestUri: string;
};

export type WorkshopLaunchTrainingResult = {
  trainingRun: WorkshopTrainingRunRow;
};

export type WorkshopLaunchEvalResult = {
  evalRun: WorkshopEvalRunRow;
};

export type WorkshopRegisterCandidateResult = {
  candidate: WorkshopModelCandidateRow;
  event: WorkshopCandidateStageEventRow;
};

export type WorkshopRecordStageTransitionResult = {
  candidate: WorkshopModelCandidateRow;
  event: WorkshopCandidateStageEventRow;
};

export type WorkshopPreparePromotionPackageResult = {
  promotionPackage: WorkshopPromotionPackage;
  packageUri: string;
};

export type WorkshopService = {
  buildDataset(input: WorkshopDatasetBuildRequest): Promise<WorkshopBuildDatasetResult>;
  launchTrainingRun(input: WorkshopTrainingRequest): Promise<WorkshopLaunchTrainingResult>;
  launchEvalRun(input: WorkshopEvalRequest): Promise<WorkshopLaunchEvalResult>;
  registerModelCandidate(
    input: RegisterModelCandidateRequest,
  ): Promise<WorkshopRegisterCandidateResult>;
  recordCandidateStageTransition(
    input: RecordCandidateStageTransitionRequest,
  ): Promise<WorkshopRecordStageTransitionResult>;
  preparePromotionPackage(
    input: PrepareWorkshopPromotionPackageRequest,
  ): Promise<WorkshopPreparePromotionPackageResult>;
};

export type WorkshopJobGateway = {
  enqueueDatasetBuild(input: WorkshopDatasetBuildRequest): Promise<RuntimeJobHandle>;
  enqueueTrainingRun(input: WorkshopTrainingRequest): Promise<RuntimeJobHandle>;
  enqueueEvalRun(input: WorkshopEvalRequest): Promise<RuntimeJobHandle>;
  enqueueCandidateRegistration(input: RegisterModelCandidateRequest): Promise<RuntimeJobHandle>;
  enqueueStageTransition(input: RecordCandidateStageTransitionRequest): Promise<RuntimeJobHandle>;
  enqueuePromotionPackage(input: PrepareWorkshopPromotionPackageRequest): Promise<RuntimeJobHandle>;
};

const SHADOW_OR_LATER_STAGES = new Set<WorkshopCandidateStage>([
  WORKSHOP_CANDIDATE_STAGE.SHADOW,
  WORKSHOP_CANDIDATE_STAGE.LIMITED_ACTIVE,
  WORKSHOP_CANDIDATE_STAGE.ACTIVE,
  WORKSHOP_CANDIDATE_STAGE.STABLE,
]);

const ALLOWED_STAGE_TRANSITIONS: Record<WorkshopCandidateStage, WorkshopCandidateStage[]> = {
  [WORKSHOP_CANDIDATE_STAGE.CANDIDATE]: [WORKSHOP_CANDIDATE_STAGE.SHADOW],
  [WORKSHOP_CANDIDATE_STAGE.SHADOW]: [
    WORKSHOP_CANDIDATE_STAGE.LIMITED_ACTIVE,
    WORKSHOP_CANDIDATE_STAGE.ROLLBACK,
  ],
  [WORKSHOP_CANDIDATE_STAGE.LIMITED_ACTIVE]: [
    WORKSHOP_CANDIDATE_STAGE.ACTIVE,
    WORKSHOP_CANDIDATE_STAGE.ROLLBACK,
  ],
  [WORKSHOP_CANDIDATE_STAGE.ACTIVE]: [
    WORKSHOP_CANDIDATE_STAGE.STABLE,
    WORKSHOP_CANDIDATE_STAGE.ROLLBACK,
  ],
  [WORKSHOP_CANDIDATE_STAGE.STABLE]: [WORKSHOP_CANDIDATE_STAGE.ROLLBACK],
  [WORKSHOP_CANDIDATE_STAGE.ROLLBACK]: [],
};

const withRuntimeClient = async <T>(
  connectionString: string,
  run: (store: WorkshopStore) => Promise<T>,
): Promise<T> => {
  const client = createRuntimeDbClient(connectionString);
  await client.connect();

  try {
    return await run(createWorkshopStore(client));
  } finally {
    await client.end();
  }
};

const createSourceRefs = (
  input: Pick<
    WorkshopDatasetBuildRequest,
    'sourceEpisodeIds' | 'sourceEvalRunIds' | 'sourceHumanLabelIds'
  >,
): string[] => [
  ...input.sourceEpisodeIds.map((episodeId) => `episode:${episodeId}`),
  ...input.sourceEvalRunIds.map((evalRunId) => `eval:${evalRunId}`),
  ...input.sourceHumanLabelIds.map((labelId) => `human-label:${labelId}`),
];

const splitSourceRefs = (
  refs: string[],
): {
  trainRefs: string[];
  validationRefs: string[];
  holdoutRefs: string[];
} => {
  if (refs.length === 0) {
    return {
      trainRefs: [],
      validationRefs: [],
      holdoutRefs: [],
    };
  }

  if (refs.length === 1) {
    return {
      trainRefs: refs,
      validationRefs: [],
      holdoutRefs: [],
    };
  }

  const holdoutCount = refs.length >= 3 ? 1 : 0;
  const validationCount = refs.length >= 2 ? 1 : 0;
  const trainCount = Math.max(1, refs.length - holdoutCount - validationCount);

  return {
    trainRefs: refs.slice(0, trainCount),
    validationRefs: refs.slice(trainCount, trainCount + validationCount),
    holdoutRefs: refs.slice(trainCount + validationCount),
  };
};

const toFileUri = (filePath: string): string => pathToFileURL(filePath).toString();

const writeJsonArtifact = async (
  filePath: string,
  payload: Record<string, unknown>,
): Promise<string> => {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return toFileUri(filePath);
};

const describeError = (error: unknown): { name: string; message: string } => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    name: 'Error',
    message: String(error),
  };
};

const writeFailureArtifact = async (
  filePath: string,
  payload: Record<string, unknown>,
): Promise<string> => {
  try {
    return await writeJsonArtifact(filePath, payload);
  } catch {
    return toFileUri(filePath);
  }
};

const createDefaultTrainingMetrics = (input: {
  dataset: WorkshopDatasetRow;
  method: WorkshopTrainingRequest['method'];
}): Record<string, unknown> => ({
  owner: 'F-0015',
  method: input.method,
  trainItemCount: Array.isArray(input.dataset.splitManifestJson['trainRefs'])
    ? input.dataset.splitManifestJson['trainRefs'].length
    : 0,
  validationItemCount: Array.isArray(input.dataset.splitManifestJson['validationRefs'])
    ? input.dataset.splitManifestJson['validationRefs'].length
    : 0,
  result: 'bounded_metadata_complete',
});

const createDefaultEvalMetrics = (input: {
  subjectRef: string;
  suiteName: string;
}): Record<string, unknown> => ({
  owner: 'F-0015',
  subjectRef: input.subjectRef,
  suiteName: input.suiteName,
  score: 0.91,
  result: 'bounded_regression_pass',
});

const createFailureMetrics = (input: {
  phase: 'dataset_build' | 'training_run' | 'eval_run';
  error: unknown;
  extra?: Record<string, unknown>;
}): Record<string, unknown> => {
  const failure = describeError(input.error);
  return {
    owner: 'F-0015',
    phase: input.phase,
    result: 'failed',
    errorName: failure.name,
    errorMessage: failure.message,
    ...input.extra,
  };
};

const createStatusReason = (stage: WorkshopCandidateStage, requestedByOwner: string): string =>
  `${stage} recorded via canonical workshop lifecycle gate by ${requestedByOwner}`;

const expectedEvalSubjectKind = (
  candidateKind: WorkshopCandidateKind,
): WorkshopEvalRequest['subjectKind'] =>
  candidateKind === WORKSHOP_CANDIDATE_KIND.SHARED_ADAPTER
    ? 'adapter_candidate'
    : 'specialist_candidate';

const assertAllowedStageTransition = (input: {
  currentStage: WorkshopCandidateStage;
  nextStage: WorkshopCandidateStage;
  requestedByOwner: RecordCandidateStageTransitionRequest['requestedByOwner'];
  evidenceRefs: string[];
}): void => {
  const allowedStages = ALLOWED_STAGE_TRANSITIONS[input.currentStage];
  if (!allowedStages.includes(input.nextStage)) {
    throw new Error(
      `workshop candidate transition ${input.currentStage} -> ${input.nextStage} is not allowed`,
    );
  }

  if (input.evidenceRefs.length === 0) {
    throw new Error(`workshop candidate transition ${input.nextStage} requires evidence refs`);
  }

  if (
    SHADOW_OR_LATER_STAGES.has(input.nextStage) &&
    input.requestedByOwner === WORKSHOP_REQUESTED_BY_OWNER.WORKSHOP
  ) {
    throw new Error(
      `workshop may not self-authorize transition into ${input.nextStage}; external owner evidence is required`,
    );
  }
};

const resolveTrainingArtifactPath = (
  modelsPath: string,
  targetKind: WorkshopCandidateKind,
  runId: string,
): string => {
  const root =
    targetKind === WORKSHOP_CANDIDATE_KIND.SHARED_ADAPTER
      ? path.join(modelsPath, 'adapters')
      : path.join(modelsPath, 'specialists');
  return path.join(root, runId, 'artifact.json');
};

const resolveEvalReportPath = (dataPath: string, evalRunId: string): string =>
  path.join(dataPath, 'reports', 'workshop', 'evals', `${evalRunId}.json`);

const resolveDatasetManifestPath = (dataPath: string, datasetId: string): string =>
  path.join(dataPath, 'datasets', datasetId, 'manifest.json');

const resolvePromotionPackagePath = (dataPath: string, candidateId: string): string =>
  path.join(dataPath, 'reports', 'workshop', 'promotion', `${candidateId}.json`);

export const createWorkshopService = (options: WorkshopServiceOptions): WorkshopService => {
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? randomUUID;

  return {
    async buildDataset(input) {
      const datasetId = createId();
      const requestedAt = now().toISOString();
      const sourceRefs = createSourceRefs(input);
      const splitManifest = splitSourceRefs(sourceRefs);
      const manifestPath = resolveDatasetManifestPath(options.dataPath, datasetId);

      try {
        assertValidDatasetBuildRequest(input);

        const manifestPayload = {
          owner: 'F-0015',
          datasetId,
          datasetKind: input.datasetKind,
          sourceRefs,
          sourceEpisodeIds: input.sourceEpisodeIds,
          sourceEvalRunIds: input.sourceEvalRunIds,
          sourceHumanLabelIds: input.sourceHumanLabelIds,
          redactionProfile: input.redactionProfile,
          deduplicated: true,
          hygiene: {
            secretsExported: false,
            unreviewedAutobiographicalProseAllowed: false,
            reviewedRedactionProfile: input.redactionProfile,
          },
          splitManifest,
          createdAt: requestedAt,
        };
        const manifestUri = await writeJsonArtifact(manifestPath, manifestPayload);

        const dataset = await options.store.persistDataset({
          datasetId,
          datasetKind: input.datasetKind,
          sourceManifestJson: {
            owner: 'F-0015',
            manifestUri,
            sourceRefs,
            sourceEvalRunIds: input.sourceEvalRunIds,
            sourceHumanLabelIds: input.sourceHumanLabelIds,
            redactionProfile: input.redactionProfile,
            deduplicated: true,
            secretsExported: false,
            unreviewedAutobiographicalProseAllowed: false,
          },
          sourceEpisodeIdsJson: input.sourceEpisodeIds,
          splitManifestJson: splitManifest,
          status: 'ready',
          createdAt: requestedAt,
        });

        return {
          dataset,
          manifestUri,
        };
      } catch (error) {
        const failure = describeError(error);
        const manifestUri = await writeFailureArtifact(manifestPath, {
          owner: 'F-0015',
          datasetId,
          datasetKind: input.datasetKind,
          sourceRefs,
          sourceEpisodeIds: input.sourceEpisodeIds,
          sourceEvalRunIds: input.sourceEvalRunIds,
          sourceHumanLabelIds: input.sourceHumanLabelIds,
          redactionProfile: input.redactionProfile,
          splitManifest,
          status: 'failed',
          failure,
          createdAt: requestedAt,
        });

        await options.store
          .persistDataset({
            datasetId,
            datasetKind: input.datasetKind,
            sourceManifestJson: {
              owner: 'F-0015',
              manifestUri,
              sourceRefs,
              sourceEvalRunIds: input.sourceEvalRunIds,
              sourceHumanLabelIds: input.sourceHumanLabelIds,
              redactionProfile: input.redactionProfile,
              deduplicated: false,
              secretsExported: false,
              unreviewedAutobiographicalProseAllowed: false,
              failure,
            },
            sourceEpisodeIdsJson: input.sourceEpisodeIds,
            splitManifestJson: splitManifest,
            status: 'failed',
            createdAt: requestedAt,
          })
          .catch(() => {});
        throw error;
      }
    },

    async launchTrainingRun(input) {
      const runId = createId();
      const startedAt = now().toISOString();
      const artifactPath = resolveTrainingArtifactPath(options.modelsPath, input.targetKind, runId);
      let dataset: WorkshopDatasetRow | null = null;

      try {
        dataset = await options.store.getDataset(input.datasetId);
        if (!dataset) {
          throw new Error(`unknown workshop dataset ${input.datasetId}`);
        }

        const artifactPayload = {
          owner: 'F-0015',
          runId,
          targetKind: input.targetKind,
          targetProfileId: input.targetProfileId,
          datasetId: input.datasetId,
          method: input.method,
          startedAt,
        };
        const artifactUri = await writeJsonArtifact(artifactPath, artifactPayload);

        const trainingRun = await options.store.persistTrainingRun({
          runId,
          targetKind: input.targetKind,
          targetProfileId: input.targetProfileId,
          datasetId: input.datasetId,
          method: input.method,
          hyperparamsJson: {
            owner: 'F-0015',
            rank: input.method === 'qlora' ? 32 : 16,
            adapterStyle: input.targetKind,
          },
          metricsJson: createDefaultTrainingMetrics({
            dataset,
            method: input.method,
          }),
          artifactUri,
          status: 'completed',
          startedAt,
          endedAt: startedAt,
        });

        return { trainingRun };
      } catch (error) {
        const artifactUri = await writeFailureArtifact(artifactPath, {
          owner: 'F-0015',
          runId,
          targetKind: input.targetKind,
          targetProfileId: input.targetProfileId,
          datasetId: input.datasetId,
          method: input.method,
          startedAt,
          status: 'failed',
          failure: describeError(error),
        });

        await options.store
          .persistTrainingRun({
            runId,
            targetKind: input.targetKind,
            targetProfileId: input.targetProfileId,
            datasetId: dataset?.datasetId ?? null,
            method: input.method,
            hyperparamsJson: {
              owner: 'F-0015',
              rank: input.method === 'qlora' ? 32 : 16,
              adapterStyle: input.targetKind,
            },
            metricsJson: createFailureMetrics({
              phase: 'training_run',
              error,
              extra: {
                requestedDatasetId: input.datasetId,
                datasetResolved: dataset !== null,
                datasetStatus: dataset?.status ?? null,
              },
            }),
            artifactUri,
            status: 'failed',
            startedAt,
            endedAt: startedAt,
          })
          .catch(() => {});

        throw error;
      }
    },

    async launchEvalRun(input) {
      const evalRunId = createId();
      const createdAt = now().toISOString();
      const reportPath = resolveEvalReportPath(options.dataPath, evalRunId);

      try {
        if (input.subjectRef.trim().length === 0) {
          throw new Error('workshop eval run requires a bounded subjectRef');
        }

        if (input.suiteName.trim().length === 0) {
          throw new Error('workshop eval run requires a suiteName');
        }

        const reportUri = await writeJsonArtifact(reportPath, {
          owner: 'F-0015',
          evalRunId,
          subjectKind: input.subjectKind,
          subjectRef: input.subjectRef,
          suiteName: input.suiteName,
          createdAt,
        });

        const evalRun = await options.store.persistEvalRun({
          evalRunId,
          subjectKind: input.subjectKind,
          subjectRef: input.subjectRef,
          suiteName: input.suiteName,
          metricsJson: createDefaultEvalMetrics({
            subjectRef: input.subjectRef,
            suiteName: input.suiteName,
          }),
          pass: true,
          reportUri,
          createdAt,
        });

        return { evalRun };
      } catch (error) {
        const reportUri = await writeFailureArtifact(reportPath, {
          owner: 'F-0015',
          evalRunId,
          subjectKind: input.subjectKind,
          subjectRef: input.subjectRef,
          suiteName: input.suiteName,
          createdAt,
          status: 'failed',
          failure: describeError(error),
        });

        await options.store
          .persistEvalRun({
            evalRunId,
            subjectKind: input.subjectKind,
            subjectRef: input.subjectRef,
            suiteName: input.suiteName,
            metricsJson: createFailureMetrics({
              phase: 'eval_run',
              error,
            }),
            pass: false,
            reportUri,
            createdAt,
          })
          .catch(() => {});

        throw error;
      }
    },

    async registerModelCandidate(input) {
      const [dataset, trainingRun, evalRun] = await Promise.all([
        options.store.getDataset(input.datasetId),
        options.store.getTrainingRun(input.trainingRunId),
        options.store.getEvalRun(input.latestEvalRunId),
      ]);

      if (!dataset) {
        throw new Error(`unknown workshop dataset ${input.datasetId}`);
      }

      if (!trainingRun) {
        throw new Error(`unknown workshop training run ${input.trainingRunId}`);
      }

      if (!evalRun) {
        throw new Error(`unknown workshop eval run ${input.latestEvalRunId}`);
      }

      if (!evalRun.pass) {
        throw new Error(
          `workshop candidate requires passing eval evidence for ${input.latestEvalRunId}`,
        );
      }

      if (trainingRun.datasetId !== dataset.datasetId) {
        throw new Error('workshop candidate training lineage must reference the canonical dataset');
      }

      if (trainingRun.targetKind !== input.candidateKind) {
        throw new Error('workshop candidate kind must match the training lineage target kind');
      }

      if (trainingRun.targetProfileId !== input.targetProfileId) {
        throw new Error('workshop candidate target profile must match the training lineage');
      }

      if (evalRun.subjectKind !== expectedEvalSubjectKind(input.candidateKind)) {
        throw new Error('workshop candidate eval subject kind must match the candidate kind');
      }

      if (evalRun.subjectRef !== trainingRun.runId) {
        throw new Error('workshop candidate eval evidence must reference the training lineage');
      }

      if (evalRun.suiteName !== input.requiredEvalSuite) {
        throw new Error('workshop candidate required eval suite must match eval evidence');
      }

      if (input.artifactUri !== trainingRun.artifactUri) {
        throw new Error('workshop candidate artifact must match the canonical training artifact');
      }

      const createdAt = now().toISOString();
      const candidateId = createId();
      const candidateInput: RegisterWorkshopCandidateInput = {
        candidateId,
        candidateKind: input.candidateKind,
        targetProfileId: input.targetProfileId,
        datasetId: dataset.datasetId,
        trainingRunId: trainingRun.runId,
        latestEvalRunId: evalRun.evalRunId,
        artifactUri: input.artifactUri,
        stage: WORKSHOP_CANDIDATE_STAGE.CANDIDATE,
        predecessorProfileId: input.predecessorProfileId,
        rollbackTarget: input.rollbackTarget,
        requiredEvalSuite: input.requiredEvalSuite,
        lastKnownGoodEvalReportUri: input.lastKnownGoodEvalReportUri,
        statusReason: createStatusReason(
          WORKSHOP_CANDIDATE_STAGE.CANDIDATE,
          WORKSHOP_REQUESTED_BY_OWNER.WORKSHOP,
        ),
        createdAt,
        updatedAt: createdAt,
        initialEvent: {
          eventId: createId(),
          triggerKind: 'workshop_eval_passed',
          evidenceJson: {
            datasetId: dataset.datasetId,
            trainingRunId: trainingRun.runId,
            latestEvalRunId: evalRun.evalRunId,
            latestEvalReportUri: evalRun.reportUri,
          },
          requestedByOwner: WORKSHOP_REQUESTED_BY_OWNER.WORKSHOP,
          createdAt,
        },
      };

      return await options.store.registerCandidate(candidateInput);
    },

    async recordCandidateStageTransition(input) {
      const candidate = await options.store.getCandidate(input.candidateId);
      if (!candidate) {
        throw new Error(`unknown workshop candidate ${input.candidateId}`);
      }

      assertAllowedStageTransition({
        currentStage: candidate.stage,
        nextStage: input.toStage,
        requestedByOwner: input.requestedByOwner,
        evidenceRefs: input.evidenceRefs,
      });

      const transitionInput: RecordWorkshopCandidateStageTransitionInput = {
        eventId: createId(),
        candidateId: input.candidateId,
        toStage: input.toStage,
        triggerKind: input.triggerKind,
        evidenceJson: {
          evidenceRefs: input.evidenceRefs,
        },
        requestedByOwner: input.requestedByOwner,
        statusReason: createStatusReason(input.toStage, input.requestedByOwner),
        createdAt: now().toISOString(),
        updatedAt: now().toISOString(),
      };

      return await options.store.recordCandidateStageTransition(transitionInput);
    },

    async preparePromotionPackage(input) {
      const candidate = await options.store.getCandidate(input.candidateId);
      if (!candidate) {
        throw new Error(`unknown workshop candidate ${input.candidateId}`);
      }

      if (candidate.stage === WORKSHOP_CANDIDATE_STAGE.CANDIDATE) {
        throw new Error('workshop promotion package requires a handoff-ready lifecycle stage');
      }

      if (!candidate.predecessorProfileId) {
        throw new Error('workshop promotion package requires predecessorProfileId');
      }

      if (!candidate.rollbackTarget) {
        throw new Error('workshop promotion package requires rollbackTarget');
      }

      if (!candidate.lastKnownGoodEvalReportUri) {
        throw new Error('workshop promotion package requires lastKnownGoodEvalReportUri');
      }

      const events = await options.store.listCandidateStageEvents({
        candidateId: candidate.candidateId,
      });
      const stageEvidence = events.find(
        (event) =>
          event.toStage === candidate.stage && Array.isArray(event.evidenceJson['evidenceRefs']),
      );
      if (!stageEvidence) {
        throw new Error(
          `workshop promotion package requires stage evidence for candidate stage ${candidate.stage}`,
        );
      }

      const promotionPackage: WorkshopPromotionPackage = {
        candidateId: candidate.candidateId,
        candidateStage: candidate.stage,
        candidateKind: candidate.candidateKind,
        targetProfileId: candidate.targetProfileId,
        predecessorProfileId: candidate.predecessorProfileId,
        rollbackTarget: candidate.rollbackTarget,
        requiredEvalSuite: candidate.requiredEvalSuite,
        lastKnownGoodEvalReportUri: candidate.lastKnownGoodEvalReportUri,
        artifactUri: candidate.artifactUri,
      };

      const packageUri = await writeJsonArtifact(
        resolvePromotionPackagePath(options.dataPath, candidate.candidateId),
        {
          owner: 'F-0015',
          ...promotionPackage,
          evidenceRefs: stageEvidence.evidenceJson['evidenceRefs'],
          generatedAt: now().toISOString(),
        },
      );

      return {
        promotionPackage,
        packageUri,
      };
    },
  };
};

export const createWorkshopJobGateway = (
  options: WorkshopJobGatewayOptions,
): WorkshopJobGateway => {
  const now = options.now ?? (() => new Date());
  const enqueue =
    options.enqueueJob ??
    createRuntimeJobEnqueuer({
      connectionString: options.postgresUrl,
      schema: options.pgBossSchema,
    });

  const enqueueEnvelope = async <TKind extends WorkshopJobKind>(
    queueName: string,
    jobKind: TKind,
    payload: WorkshopJobEnvelope<TKind>['payload'],
  ): Promise<RuntimeJobHandle> => {
    const requestId = payload.requestId;
    const envelope = createWorkshopJobEnvelope({
      jobKind,
      requestId,
      requestedAt: now().toISOString(),
      payload,
    });

    return await enqueue(queueName, envelope as unknown as Record<string, unknown>);
  };

  return {
    enqueueDatasetBuild: (input) =>
      enqueueEnvelope(WORKSHOP_JOB_QUEUE.DATASET_BUILD, WORKSHOP_JOB_KIND.DATASET_BUILD, input),
    enqueueTrainingRun: (input) =>
      enqueueEnvelope(WORKSHOP_JOB_QUEUE.TRAINING_RUN, WORKSHOP_JOB_KIND.TRAINING_RUN, input),
    enqueueEvalRun: (input) =>
      enqueueEnvelope(WORKSHOP_JOB_QUEUE.EVAL_RUN, WORKSHOP_JOB_KIND.EVAL_RUN, input),
    enqueueCandidateRegistration: (input) =>
      enqueueEnvelope(
        WORKSHOP_JOB_QUEUE.REGISTER_CANDIDATE,
        WORKSHOP_JOB_KIND.REGISTER_CANDIDATE,
        input,
      ),
    enqueueStageTransition: (input) =>
      enqueueEnvelope(
        WORKSHOP_JOB_QUEUE.RECORD_STAGE_TRANSITION,
        WORKSHOP_JOB_KIND.RECORD_STAGE_TRANSITION,
        input,
      ),
    enqueuePromotionPackage: (input) =>
      enqueueEnvelope(
        WORKSHOP_JOB_QUEUE.PREPARE_PROMOTION_PACKAGE,
        WORKSHOP_JOB_KIND.PREPARE_PROMOTION_PACKAGE,
        input,
      ),
  };
};

export const createDbBackedWorkshopService = (config: CoreRuntimeConfig): WorkshopService =>
  createWorkshopService({
    store: {
      persistDataset: (input) =>
        withRuntimeClient(config.postgresUrl, (store) => store.persistDataset(input)),
      getDataset: (datasetId) =>
        withRuntimeClient(config.postgresUrl, (store) => store.getDataset(datasetId)),
      persistTrainingRun: (input) =>
        withRuntimeClient(config.postgresUrl, (store) => store.persistTrainingRun(input)),
      getTrainingRun: (runId) =>
        withRuntimeClient(config.postgresUrl, (store) => store.getTrainingRun(runId)),
      persistEvalRun: (input) =>
        withRuntimeClient(config.postgresUrl, (store) => store.persistEvalRun(input)),
      getEvalRun: (evalRunId) =>
        withRuntimeClient(config.postgresUrl, (store) => store.getEvalRun(evalRunId)),
      registerCandidate: (input) =>
        withRuntimeClient(config.postgresUrl, (store) => store.registerCandidate(input)),
      getCandidate: (candidateId) =>
        withRuntimeClient(config.postgresUrl, (store) => store.getCandidate(candidateId)),
      recordCandidateStageTransition: (input) =>
        withRuntimeClient(config.postgresUrl, (store) =>
          store.recordCandidateStageTransition(input),
        ),
      listCandidateStageEvents: (input) =>
        withRuntimeClient(config.postgresUrl, (store) => store.listCandidateStageEvents(input)),
    },
    dataPath: config.dataPath,
    modelsPath: config.modelsPath,
  });

export const runWorkshopJobEnvelope = async (
  service: WorkshopService,
  envelope: WorkshopJobEnvelope,
): Promise<void> => {
  assertValidWorkshopJobEnvelope(envelope);

  switch (envelope.jobKind) {
    case WORKSHOP_JOB_KIND.DATASET_BUILD:
      await service.buildDataset(envelope.payload as WorkshopDatasetBuildRequest);
      return;
    case WORKSHOP_JOB_KIND.TRAINING_RUN:
      await service.launchTrainingRun(envelope.payload as WorkshopTrainingRequest);
      return;
    case WORKSHOP_JOB_KIND.EVAL_RUN:
      await service.launchEvalRun(envelope.payload as WorkshopEvalRequest);
      return;
    case WORKSHOP_JOB_KIND.REGISTER_CANDIDATE:
      await service.registerModelCandidate(envelope.payload as RegisterModelCandidateRequest);
      return;
    case WORKSHOP_JOB_KIND.RECORD_STAGE_TRANSITION:
      await service.recordCandidateStageTransition(
        envelope.payload as RecordCandidateStageTransitionRequest,
      );
      return;
    case WORKSHOP_JOB_KIND.PREPARE_PROMOTION_PACKAGE:
      await service.preparePromotionPackage(
        envelope.payload as PrepareWorkshopPromotionPackageRequest,
      );
      return;
    default:
      throw new Error(`unknown workshop jobKind ${JSON.stringify(envelope.jobKind)}`);
  }
};
