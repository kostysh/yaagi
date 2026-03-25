import type {
  WorkshopCandidateStageEventRow,
  WorkshopDatasetRow,
  WorkshopDbExecutor,
  WorkshopEvalRunRow,
  WorkshopModelCandidateRow,
  WorkshopTrainingRunRow,
} from '../src/workshop.ts';

type WorkshopHarnessState = {
  datasetsById: Record<string, WorkshopDatasetRow>;
  trainingRunsById: Record<string, WorkshopTrainingRunRow>;
  evalRunsById: Record<string, WorkshopEvalRunRow>;
  candidatesById: Record<string, WorkshopModelCandidateRow>;
  candidateStageEventsById: Record<string, WorkshopCandidateStageEventRow>;
};

type QueryResult<T> = {
  rows: T[];
};

type WorkshopHarnessOptions = {
  seed?: Partial<WorkshopHarnessState>;
};

const normalizeSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim().toLowerCase();

const cloneState = (state: WorkshopHarnessState): WorkshopHarnessState => structuredClone(state);

const sortStageEvents = (
  rows: WorkshopCandidateStageEventRow[],
): WorkshopCandidateStageEventRow[] =>
  [...rows].sort((left, right) => {
    const byCreatedAt = left.createdAt.localeCompare(right.createdAt);
    if (byCreatedAt !== 0) {
      return byCreatedAt;
    }

    return left.eventId.localeCompare(right.eventId);
  });

export function createWorkshopDbHarness(options: WorkshopHarnessOptions = {}): {
  db: WorkshopDbExecutor;
  state: WorkshopHarnessState;
} {
  const state: WorkshopHarnessState = {
    datasetsById: structuredClone(options.seed?.datasetsById ?? {}),
    trainingRunsById: structuredClone(options.seed?.trainingRunsById ?? {}),
    evalRunsById: structuredClone(options.seed?.evalRunsById ?? {}),
    candidatesById: structuredClone(options.seed?.candidatesById ?? {}),
    candidateStageEventsById: structuredClone(options.seed?.candidateStageEventsById ?? {}),
  };

  let transactionBackup: WorkshopHarnessState | null = null;

  const query = async <TRow = Record<string, unknown>>(
    sqlText: string,
    params: unknown[] = [],
  ): Promise<QueryResult<TRow>> => {
    await Promise.resolve();
    const sql = normalizeSql(sqlText);

    if (sql === 'begin') {
      transactionBackup = cloneState(state);
      return { rows: [] };
    }

    if (sql === 'commit') {
      transactionBackup = null;
      return { rows: [] };
    }

    if (sql === 'rollback') {
      if (transactionBackup) {
        const restored = cloneState(transactionBackup);
        state.datasetsById = restored.datasetsById;
        state.trainingRunsById = restored.trainingRunsById;
        state.evalRunsById = restored.evalRunsById;
        state.candidatesById = restored.candidatesById;
        state.candidateStageEventsById = restored.candidateStageEventsById;
      }
      transactionBackup = null;
      return { rows: [] };
    }

    if (sql.includes('insert into polyphony_runtime.datasets')) {
      const row: WorkshopDatasetRow = {
        datasetId: String(params[0]),
        datasetKind: params[1] as WorkshopDatasetRow['datasetKind'],
        sourceManifestJson: JSON.parse(String(params[2])) as Record<string, unknown>,
        sourceEpisodeIdsJson: JSON.parse(String(params[3])) as string[],
        splitManifestJson: JSON.parse(String(params[4])) as Record<string, unknown>,
        status: String(params[5]),
        createdAt: String(params[6]),
      };
      state.datasetsById[row.datasetId] = row;
      return { rows: [row as TRow] };
    }

    if (sql.includes('from polyphony_runtime.datasets where dataset_id = $1')) {
      const row = state.datasetsById[String(params[0])];
      return { rows: row ? ([row] as TRow[]) : [] };
    }

    if (sql.includes('insert into polyphony_runtime.training_runs')) {
      const datasetId = (params[3] as string | null) ?? null;
      if (datasetId && !state.datasetsById[datasetId]) {
        throw new Error(`unknown dataset ${datasetId}`);
      }

      const row: WorkshopTrainingRunRow = {
        runId: String(params[0]),
        targetKind: params[1] as WorkshopTrainingRunRow['targetKind'],
        targetProfileId: (params[2] as string | null) ?? null,
        datasetId,
        method: params[4] as WorkshopTrainingRunRow['method'],
        hyperparamsJson: JSON.parse(String(params[5])) as Record<string, unknown>,
        metricsJson: JSON.parse(String(params[6])) as Record<string, unknown>,
        artifactUri: String(params[7]),
        status: String(params[8]),
        startedAt: String(params[9]),
        endedAt: (params[10] as string | null) ?? null,
      };
      state.trainingRunsById[row.runId] = row;
      return { rows: [row as TRow] };
    }

    if (sql.includes('from polyphony_runtime.training_runs where run_id = $1')) {
      const row = state.trainingRunsById[String(params[0])];
      return { rows: row ? ([row] as TRow[]) : [] };
    }

    if (sql.includes('insert into polyphony_runtime.eval_runs')) {
      const row: WorkshopEvalRunRow = {
        evalRunId: String(params[0]),
        subjectKind: params[1] as WorkshopEvalRunRow['subjectKind'],
        subjectRef: String(params[2]),
        suiteName: String(params[3]),
        metricsJson: JSON.parse(String(params[4])) as Record<string, unknown>,
        pass: Boolean(params[5]),
        reportUri: String(params[6]),
        createdAt: String(params[7]),
      };
      state.evalRunsById[row.evalRunId] = row;
      return { rows: [row as TRow] };
    }

    if (sql.includes('from polyphony_runtime.eval_runs where eval_run_id = $1')) {
      const row = state.evalRunsById[String(params[0])];
      return { rows: row ? ([row] as TRow[]) : [] };
    }

    if (sql.includes('insert into polyphony_runtime.model_candidates')) {
      const datasetId = String(params[3]);
      const trainingRunId = String(params[4]);
      const latestEvalRunId = String(params[5]);
      if (!state.datasetsById[datasetId]) {
        throw new Error(`unknown dataset ${datasetId}`);
      }
      if (!state.trainingRunsById[trainingRunId]) {
        throw new Error(`unknown training run ${trainingRunId}`);
      }
      if (!state.evalRunsById[latestEvalRunId]) {
        throw new Error(`unknown eval run ${latestEvalRunId}`);
      }

      const row: WorkshopModelCandidateRow = {
        candidateId: String(params[0]),
        candidateKind: params[1] as WorkshopModelCandidateRow['candidateKind'],
        targetProfileId: (params[2] as string | null) ?? null,
        datasetId,
        trainingRunId,
        latestEvalRunId,
        artifactUri: String(params[6]),
        stage: params[7] as WorkshopModelCandidateRow['stage'],
        predecessorProfileId: (params[8] as string | null) ?? null,
        rollbackTarget: (params[9] as string | null) ?? null,
        requiredEvalSuite: String(params[10]),
        lastKnownGoodEvalReportUri: (params[11] as string | null) ?? null,
        statusReason: String(params[12]),
        createdAt: String(params[13]),
        updatedAt: String(params[14]),
      };
      state.candidatesById[row.candidateId] = row;
      return { rows: [row as TRow] };
    }

    if (sql.includes('from polyphony_runtime.model_candidates where candidate_id = $1')) {
      const row = state.candidatesById[String(params[0])];
      return { rows: row ? ([row] as TRow[]) : [] };
    }

    if (sql.startsWith('update polyphony_runtime.model_candidates')) {
      const candidateId = String(params[0]);
      const current = state.candidatesById[candidateId];
      if (!current) {
        return { rows: [] };
      }

      const next: WorkshopModelCandidateRow = {
        ...current,
        stage: params[1] as WorkshopModelCandidateRow['stage'],
        statusReason: String(params[2]),
        updatedAt: String(params[3]),
      };
      state.candidatesById[candidateId] = next;
      return { rows: [next as TRow] };
    }

    if (sql.includes('insert into polyphony_runtime.candidate_stage_events')) {
      const candidateId = String(params[1]);
      if (!state.candidatesById[candidateId]) {
        throw new Error(`unknown candidate ${candidateId}`);
      }

      const row: WorkshopCandidateStageEventRow = {
        eventId: String(params[0]),
        candidateId,
        fromStage:
          params.length === 8
            ? ((params[2] as WorkshopCandidateStageEventRow['fromStage']) ?? null)
            : null,
        toStage:
          params.length === 8
            ? (params[3] as WorkshopCandidateStageEventRow['toStage'])
            : (params[2] as WorkshopCandidateStageEventRow['toStage']),
        triggerKind:
          params.length === 8
            ? (params[4] as WorkshopCandidateStageEventRow['triggerKind'])
            : (params[3] as WorkshopCandidateStageEventRow['triggerKind']),
        evidenceJson: JSON.parse(String(params[params.length === 8 ? 5 : 4])) as Record<
          string,
          unknown
        >,
        requestedByOwner: params[
          params.length === 8 ? 6 : 5
        ] as WorkshopCandidateStageEventRow['requestedByOwner'],
        createdAt: String(params[params.length === 8 ? 7 : 6]),
      };
      state.candidateStageEventsById[row.eventId] = row;
      return { rows: [row as TRow] };
    }

    if (
      sql.includes('from polyphony_runtime.candidate_stage_events') &&
      sql.includes('where candidate_id = $1')
    ) {
      return {
        rows: sortStageEvents(
          Object.values(state.candidateStageEventsById).filter(
            (row) => row.candidateId === String(params[0]),
          ),
        ) as TRow[],
      };
    }

    throw new Error(`workshop harness does not support SQL: ${sqlText}`);
  };

  return {
    db: {
      query: query as WorkshopDbExecutor['query'],
    },
    state,
  };
}
