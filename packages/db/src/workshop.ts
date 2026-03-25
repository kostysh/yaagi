import type { Client, QueryResultRow } from 'pg';
import {
  WORKSHOP_CANDIDATE_STAGE,
  type WorkshopCandidateKind,
  type WorkshopCandidateStage,
  type WorkshopRequestedByOwner,
  type WorkshopStageTriggerKind,
  type WorkshopTrainingMethod,
  type WorkshopDatasetKind,
  type WorkshopEvalSubjectKind,
} from '@yaagi/contracts/workshop';

export type WorkshopDbExecutor = Pick<Client, 'query'>;

const RUNTIME_SCHEMA = 'polyphony_runtime';

const runtimeSchemaTable = (table: string): string => `${RUNTIME_SCHEMA}.${table}`;
const datasetsTable = runtimeSchemaTable('datasets');
const trainingRunsTable = runtimeSchemaTable('training_runs');
const evalRunsTable = runtimeSchemaTable('eval_runs');
const modelCandidatesTable = runtimeSchemaTable('model_candidates');
const candidateStageEventsTable = runtimeSchemaTable('candidate_stage_events');

const asUtcIso = (column: string, alias: string): string =>
  `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "${alias}"`;

const transaction = async <T>(db: WorkshopDbExecutor, run: () => Promise<T>): Promise<T> => {
  await db.query('begin');
  try {
    const result = await run();
    await db.query('commit');
    return result;
  } catch (error) {
    try {
      await db.query('rollback');
    } catch {
      // Preserve the original error.
    }
    throw error;
  }
};

const normalizeTimestamp = (value: unknown, field: string): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  throw new Error(`workshop row field ${field} must be a string or Date timestamp`);
};

const toNullableTimestamp = (value: unknown, field: string): string | null => {
  if (value == null) {
    return null;
  }

  return normalizeTimestamp(value, field);
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
};

export type WorkshopDatasetRow = {
  datasetId: string;
  datasetKind: WorkshopDatasetKind;
  sourceManifestJson: Record<string, unknown>;
  sourceEpisodeIdsJson: string[];
  splitManifestJson: Record<string, unknown>;
  status: string;
  createdAt: string;
};

export type WorkshopTrainingRunRow = {
  runId: string;
  targetKind: WorkshopCandidateKind;
  targetProfileId: string | null;
  datasetId: string | null;
  method: WorkshopTrainingMethod;
  hyperparamsJson: Record<string, unknown>;
  metricsJson: Record<string, unknown>;
  artifactUri: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
};

export type WorkshopEvalRunRow = {
  evalRunId: string;
  subjectKind: WorkshopEvalSubjectKind;
  subjectRef: string;
  suiteName: string;
  metricsJson: Record<string, unknown>;
  pass: boolean;
  reportUri: string;
  createdAt: string;
};

export type WorkshopModelCandidateRow = {
  candidateId: string;
  candidateKind: WorkshopCandidateKind;
  targetProfileId: string | null;
  datasetId: string;
  trainingRunId: string;
  latestEvalRunId: string;
  artifactUri: string;
  stage: WorkshopCandidateStage;
  predecessorProfileId: string | null;
  rollbackTarget: string | null;
  requiredEvalSuite: string;
  lastKnownGoodEvalReportUri: string | null;
  statusReason: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkshopCandidateStageEventRow = {
  eventId: string;
  candidateId: string;
  fromStage: WorkshopCandidateStage | null;
  toStage: WorkshopCandidateStage;
  triggerKind: WorkshopStageTriggerKind;
  evidenceJson: Record<string, unknown>;
  requestedByOwner: WorkshopRequestedByOwner;
  createdAt: string;
};

export type PersistWorkshopDatasetInput = Omit<WorkshopDatasetRow, 'createdAt'> & {
  createdAt?: string;
};

export type PersistWorkshopTrainingRunInput = Omit<
  WorkshopTrainingRunRow,
  'startedAt' | 'endedAt'
> & {
  startedAt?: string;
  endedAt?: string | null;
};

export type PersistWorkshopEvalRunInput = Omit<WorkshopEvalRunRow, 'createdAt'> & {
  createdAt?: string;
};

export type RegisterWorkshopCandidateInput = Omit<
  WorkshopModelCandidateRow,
  'createdAt' | 'updatedAt'
> & {
  createdAt?: string;
  updatedAt?: string;
  initialEvent: {
    eventId: string;
    triggerKind: WorkshopStageTriggerKind;
    evidenceJson: Record<string, unknown>;
    requestedByOwner: WorkshopRequestedByOwner;
    createdAt?: string;
  };
};

export type RecordWorkshopCandidateStageTransitionInput = {
  eventId: string;
  candidateId: string;
  toStage: WorkshopCandidateStage;
  triggerKind: WorkshopStageTriggerKind;
  evidenceJson: Record<string, unknown>;
  requestedByOwner: WorkshopRequestedByOwner;
  statusReason: string;
  createdAt?: string;
  updatedAt?: string;
};

export type WorkshopStore = {
  persistDataset(input: PersistWorkshopDatasetInput): Promise<WorkshopDatasetRow>;
  getDataset(datasetId: string): Promise<WorkshopDatasetRow | null>;
  persistTrainingRun(input: PersistWorkshopTrainingRunInput): Promise<WorkshopTrainingRunRow>;
  getTrainingRun(runId: string): Promise<WorkshopTrainingRunRow | null>;
  persistEvalRun(input: PersistWorkshopEvalRunInput): Promise<WorkshopEvalRunRow>;
  getEvalRun(evalRunId: string): Promise<WorkshopEvalRunRow | null>;
  registerCandidate(
    input: RegisterWorkshopCandidateInput,
  ): Promise<{ candidate: WorkshopModelCandidateRow; event: WorkshopCandidateStageEventRow }>;
  getCandidate(candidateId: string): Promise<WorkshopModelCandidateRow | null>;
  recordCandidateStageTransition(
    input: RecordWorkshopCandidateStageTransitionInput,
  ): Promise<{ candidate: WorkshopModelCandidateRow; event: WorkshopCandidateStageEventRow }>;
  listCandidateStageEvents(input: {
    candidateId: string;
  }): Promise<WorkshopCandidateStageEventRow[]>;
};

const datasetColumns = `
  dataset_id as "datasetId",
  dataset_kind as "datasetKind",
  source_manifest_json as "sourceManifestJson",
  source_episode_ids_json as "sourceEpisodeIdsJson",
  split_manifest_json as "splitManifestJson",
  status,
  ${asUtcIso('created_at', 'createdAt')}
`;

const trainingRunColumns = `
  run_id as "runId",
  target_kind as "targetKind",
  target_profile_id as "targetProfileId",
  dataset_id as "datasetId",
  method,
  hyperparams_json as "hyperparamsJson",
  metrics_json as "metricsJson",
  artifact_uri as "artifactUri",
  status,
  ${asUtcIso('started_at', 'startedAt')},
  ${asUtcIso('ended_at', 'endedAt')}
`;

const evalRunColumns = `
  eval_run_id as "evalRunId",
  subject_kind as "subjectKind",
  subject_ref as "subjectRef",
  suite_name as "suiteName",
  metrics_json as "metricsJson",
  pass,
  report_uri as "reportUri",
  ${asUtcIso('created_at', 'createdAt')}
`;

const candidateColumns = `
  candidate_id as "candidateId",
  candidate_kind as "candidateKind",
  target_profile_id as "targetProfileId",
  dataset_id as "datasetId",
  training_run_id as "trainingRunId",
  latest_eval_run_id as "latestEvalRunId",
  artifact_uri as "artifactUri",
  stage,
  predecessor_profile_id as "predecessorProfileId",
  rollback_target as "rollbackTarget",
  required_eval_suite as "requiredEvalSuite",
  last_known_good_eval_report_uri as "lastKnownGoodEvalReportUri",
  status_reason as "statusReason",
  ${asUtcIso('created_at', 'createdAt')},
  ${asUtcIso('updated_at', 'updatedAt')}
`;

const candidateEventColumns = `
  event_id as "eventId",
  candidate_id as "candidateId",
  from_stage as "fromStage",
  to_stage as "toStage",
  trigger_kind as "triggerKind",
  evidence_json as "evidenceJson",
  requested_by_owner as "requestedByOwner",
  ${asUtcIso('created_at', 'createdAt')}
`;

const normalizeDatasetRow = (row: QueryResultRow): WorkshopDatasetRow => ({
  datasetId: String(row['datasetId']),
  datasetKind: row['datasetKind'] as WorkshopDatasetKind,
  sourceManifestJson: toRecord(row['sourceManifestJson']),
  sourceEpisodeIdsJson: toStringArray(row['sourceEpisodeIdsJson']),
  splitManifestJson: toRecord(row['splitManifestJson']),
  status: String(row['status']),
  createdAt: normalizeTimestamp(row['createdAt'], 'datasets.createdAt'),
});

const normalizeTrainingRunRow = (row: QueryResultRow): WorkshopTrainingRunRow => ({
  runId: String(row['runId']),
  targetKind: row['targetKind'] as WorkshopCandidateKind,
  targetProfileId: (row['targetProfileId'] as string | null) ?? null,
  datasetId: (row['datasetId'] as string | null) ?? null,
  method: row['method'] as WorkshopTrainingMethod,
  hyperparamsJson: toRecord(row['hyperparamsJson']),
  metricsJson: toRecord(row['metricsJson']),
  artifactUri: String(row['artifactUri']),
  status: String(row['status']),
  startedAt: normalizeTimestamp(row['startedAt'], 'training_runs.startedAt'),
  endedAt: toNullableTimestamp(row['endedAt'], 'training_runs.endedAt'),
});

const normalizeEvalRunRow = (row: QueryResultRow): WorkshopEvalRunRow => ({
  evalRunId: String(row['evalRunId']),
  subjectKind: row['subjectKind'] as WorkshopEvalSubjectKind,
  subjectRef: String(row['subjectRef']),
  suiteName: String(row['suiteName']),
  metricsJson: toRecord(row['metricsJson']),
  pass: Boolean(row['pass']),
  reportUri: String(row['reportUri']),
  createdAt: normalizeTimestamp(row['createdAt'], 'eval_runs.createdAt'),
});

const normalizeCandidateRow = (row: QueryResultRow): WorkshopModelCandidateRow => ({
  candidateId: String(row['candidateId']),
  candidateKind: row['candidateKind'] as WorkshopCandidateKind,
  targetProfileId: (row['targetProfileId'] as string | null) ?? null,
  datasetId: String(row['datasetId']),
  trainingRunId: String(row['trainingRunId']),
  latestEvalRunId: String(row['latestEvalRunId']),
  artifactUri: String(row['artifactUri']),
  stage: row['stage'] as WorkshopCandidateStage,
  predecessorProfileId: (row['predecessorProfileId'] as string | null) ?? null,
  rollbackTarget: (row['rollbackTarget'] as string | null) ?? null,
  requiredEvalSuite: String(row['requiredEvalSuite']),
  lastKnownGoodEvalReportUri: (row['lastKnownGoodEvalReportUri'] as string | null) ?? null,
  statusReason: String(row['statusReason']),
  createdAt: normalizeTimestamp(row['createdAt'], 'model_candidates.createdAt'),
  updatedAt: normalizeTimestamp(row['updatedAt'], 'model_candidates.updatedAt'),
});

const normalizeCandidateEventRow = (row: QueryResultRow): WorkshopCandidateStageEventRow => ({
  eventId: String(row['eventId']),
  candidateId: String(row['candidateId']),
  fromStage: (row['fromStage'] as WorkshopCandidateStage | null) ?? null,
  toStage: row['toStage'] as WorkshopCandidateStage,
  triggerKind: row['triggerKind'] as WorkshopStageTriggerKind,
  evidenceJson: toRecord(row['evidenceJson']),
  requestedByOwner: row['requestedByOwner'] as WorkshopRequestedByOwner,
  createdAt: normalizeTimestamp(row['createdAt'], 'candidate_stage_events.createdAt'),
});

export function createWorkshopStore(db: WorkshopDbExecutor): WorkshopStore {
  return {
    async persistDataset(input) {
      const result = await db.query<QueryResultRow>(
        `insert into ${datasetsTable} (
           dataset_id,
           dataset_kind,
           source_manifest_json,
           source_episode_ids_json,
           split_manifest_json,
           status,
           created_at
         ) values (
           $1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7::timestamptz
         )
         returning ${datasetColumns}`,
        [
          input.datasetId,
          input.datasetKind,
          JSON.stringify(input.sourceManifestJson),
          JSON.stringify(input.sourceEpisodeIdsJson),
          JSON.stringify(input.splitManifestJson),
          input.status,
          input.createdAt ?? new Date().toISOString(),
        ],
      );

      const row = result.rows[0];
      if (!row) {
        throw new Error(`failed to persist workshop dataset ${input.datasetId}`);
      }

      return normalizeDatasetRow(row);
    },

    async getDataset(datasetId) {
      const result = await db.query<QueryResultRow>(
        `select ${datasetColumns}
         from ${datasetsTable}
         where dataset_id = $1`,
        [datasetId],
      );

      const row = result.rows[0];
      return row ? normalizeDatasetRow(row) : null;
    },

    async persistTrainingRun(input) {
      const result = await db.query<QueryResultRow>(
        `insert into ${trainingRunsTable} (
           run_id,
           target_kind,
           target_profile_id,
           dataset_id,
           method,
           hyperparams_json,
           metrics_json,
           artifact_uri,
           status,
           started_at,
           ended_at
         ) values (
           $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10::timestamptz, $11::timestamptz
         )
         returning ${trainingRunColumns}`,
        [
          input.runId,
          input.targetKind,
          input.targetProfileId,
          input.datasetId,
          input.method,
          JSON.stringify(input.hyperparamsJson),
          JSON.stringify(input.metricsJson),
          input.artifactUri,
          input.status,
          input.startedAt ?? new Date().toISOString(),
          input.endedAt ?? null,
        ],
      );

      const row = result.rows[0];
      if (!row) {
        throw new Error(`failed to persist workshop training run ${input.runId}`);
      }

      return normalizeTrainingRunRow(row);
    },

    async getTrainingRun(runId) {
      const result = await db.query<QueryResultRow>(
        `select ${trainingRunColumns}
         from ${trainingRunsTable}
         where run_id = $1`,
        [runId],
      );

      const row = result.rows[0];
      return row ? normalizeTrainingRunRow(row) : null;
    },

    async persistEvalRun(input) {
      const result = await db.query<QueryResultRow>(
        `insert into ${evalRunsTable} (
           eval_run_id,
           subject_kind,
           subject_ref,
           suite_name,
           metrics_json,
           pass,
           report_uri,
           created_at
         ) values (
           $1, $2, $3, $4, $5::jsonb, $6, $7, $8::timestamptz
         )
         returning ${evalRunColumns}`,
        [
          input.evalRunId,
          input.subjectKind,
          input.subjectRef,
          input.suiteName,
          JSON.stringify(input.metricsJson),
          input.pass,
          input.reportUri,
          input.createdAt ?? new Date().toISOString(),
        ],
      );

      const row = result.rows[0];
      if (!row) {
        throw new Error(`failed to persist workshop eval run ${input.evalRunId}`);
      }

      return normalizeEvalRunRow(row);
    },

    async getEvalRun(evalRunId) {
      const result = await db.query<QueryResultRow>(
        `select ${evalRunColumns}
         from ${evalRunsTable}
         where eval_run_id = $1`,
        [evalRunId],
      );

      const row = result.rows[0];
      return row ? normalizeEvalRunRow(row) : null;
    },

    async registerCandidate(input) {
      return await transaction(db, async () => {
        const candidateResult = await db.query<QueryResultRow>(
          `insert into ${modelCandidatesTable} (
             candidate_id,
             candidate_kind,
             target_profile_id,
             dataset_id,
             training_run_id,
             latest_eval_run_id,
             artifact_uri,
             stage,
             predecessor_profile_id,
             rollback_target,
             required_eval_suite,
             last_known_good_eval_report_uri,
             status_reason,
             created_at,
             updated_at
           ) values (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::timestamptz, $15::timestamptz
           )
           returning ${candidateColumns}`,
          [
            input.candidateId,
            input.candidateKind,
            input.targetProfileId,
            input.datasetId,
            input.trainingRunId,
            input.latestEvalRunId,
            input.artifactUri,
            input.stage,
            input.predecessorProfileId,
            input.rollbackTarget,
            input.requiredEvalSuite,
            input.lastKnownGoodEvalReportUri,
            input.statusReason,
            input.createdAt ?? new Date().toISOString(),
            input.updatedAt ?? input.createdAt ?? new Date().toISOString(),
          ],
        );

        const candidateRow = candidateResult.rows[0];
        if (!candidateRow) {
          throw new Error(`failed to register model candidate ${input.candidateId}`);
        }

        const eventResult = await db.query<QueryResultRow>(
          `insert into ${candidateStageEventsTable} (
             event_id,
             candidate_id,
             from_stage,
             to_stage,
             trigger_kind,
             evidence_json,
             requested_by_owner,
             created_at
           ) values (
             $1, $2, null, $3, $4, $5::jsonb, $6, $7::timestamptz
           )
           returning ${candidateEventColumns}`,
          [
            input.initialEvent.eventId,
            input.candidateId,
            WORKSHOP_CANDIDATE_STAGE.CANDIDATE,
            input.initialEvent.triggerKind,
            JSON.stringify(input.initialEvent.evidenceJson),
            input.initialEvent.requestedByOwner,
            input.initialEvent.createdAt ?? input.createdAt ?? new Date().toISOString(),
          ],
        );

        const eventRow = eventResult.rows[0];
        if (!eventRow) {
          throw new Error(
            `failed to append initial candidate stage event for ${input.candidateId}`,
          );
        }

        return {
          candidate: normalizeCandidateRow(candidateRow),
          event: normalizeCandidateEventRow(eventRow),
        };
      });
    },

    async getCandidate(candidateId) {
      const result = await db.query<QueryResultRow>(
        `select ${candidateColumns}
         from ${modelCandidatesTable}
         where candidate_id = $1`,
        [candidateId],
      );

      const row = result.rows[0];
      return row ? normalizeCandidateRow(row) : null;
    },

    async recordCandidateStageTransition(input) {
      return await transaction(db, async () => {
        const previous = await this.getCandidate(input.candidateId);
        if (!previous) {
          throw new Error(`unknown workshop candidate ${input.candidateId}`);
        }

        const candidateResult = await db.query<QueryResultRow>(
          `update ${modelCandidatesTable}
           set stage = $2,
               status_reason = $3,
               updated_at = $4::timestamptz
           where candidate_id = $1
           returning ${candidateColumns}`,
          [
            input.candidateId,
            input.toStage,
            input.statusReason,
            input.updatedAt ?? input.createdAt ?? new Date().toISOString(),
          ],
        );

        const candidateRow = candidateResult.rows[0];
        if (!candidateRow) {
          throw new Error(`failed to update workshop candidate ${input.candidateId}`);
        }

        const eventResult = await db.query<QueryResultRow>(
          `insert into ${candidateStageEventsTable} (
             event_id,
             candidate_id,
             from_stage,
             to_stage,
             trigger_kind,
             evidence_json,
             requested_by_owner,
             created_at
           ) values (
             $1, $2, $3, $4, $5, $6::jsonb, $7, $8::timestamptz
           )
           returning ${candidateEventColumns}`,
          [
            input.eventId,
            input.candidateId,
            previous.stage,
            input.toStage,
            input.triggerKind,
            JSON.stringify(input.evidenceJson),
            input.requestedByOwner,
            input.createdAt ?? new Date().toISOString(),
          ],
        );

        const eventRow = eventResult.rows[0];
        if (!eventRow) {
          throw new Error(`failed to append candidate stage event for ${input.candidateId}`);
        }

        return {
          candidate: normalizeCandidateRow(candidateRow),
          event: normalizeCandidateEventRow(eventRow),
        };
      });
    },

    async listCandidateStageEvents(input) {
      const result = await db.query<QueryResultRow>(
        `select ${candidateEventColumns}
         from ${candidateStageEventsTable}
         where candidate_id = $1
         order by created_at asc, event_id asc`,
        [input.candidateId],
      );

      return result.rows.map((row) => normalizeCandidateEventRow(row));
    },
  };
}
