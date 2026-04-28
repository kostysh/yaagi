import type {
  SpecialistAdmissionDecisionRow,
  SpecialistOrganRow,
  SpecialistRetirementDecisionRow,
  SpecialistRolloutEventRow,
  SpecialistRolloutPolicyRow,
} from '@yaagi/contracts/specialists';
import type { SpecialistPolicyDbExecutor } from '../src/specialists.ts';

type SpecialistPolicyHarnessState = {
  organsById: Record<string, SpecialistOrganRow>;
  policiesById: Record<string, SpecialistRolloutPolicyRow>;
  policyRequestIndex: Record<string, string>;
  rolloutEventsById: Record<string, SpecialistRolloutEventRow>;
  rolloutEventRequestIndex: Record<string, string>;
  admissionsById: Record<string, SpecialistAdmissionDecisionRow>;
  admissionRequestIndex: Record<string, string>;
  retirementsById: Record<string, SpecialistRetirementDecisionRow>;
  retirementRequestIndex: Record<string, string>;
};

type QueryResult<T> = {
  rows: T[];
};

type SpecialistPolicyHarnessOptions = {
  seed?: Partial<SpecialistPolicyHarnessState>;
};

const normalizeSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim().toLowerCase();

const cloneState = (state: SpecialistPolicyHarnessState): SpecialistPolicyHarnessState =>
  structuredClone(state);

const parseStringArray = (value: unknown): string[] =>
  typeof value === 'string' ? (JSON.parse(value) as string[]) : (value as string[]);

const parseRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'string'
    ? (JSON.parse(value) as Record<string, unknown>)
    : (value as Record<string, unknown>);

const sortByCreatedAt = <TRow extends { createdAt: string }>(rows: TRow[]): TRow[] =>
  [...rows].sort((left, right) => left.createdAt.localeCompare(right.createdAt));

export function createSpecialistPolicyDbHarness(options: SpecialistPolicyHarnessOptions = {}): {
  db: SpecialistPolicyDbExecutor;
  state: SpecialistPolicyHarnessState;
} {
  const state: SpecialistPolicyHarnessState = {
    organsById: structuredClone(options.seed?.organsById ?? {}),
    policiesById: structuredClone(options.seed?.policiesById ?? {}),
    policyRequestIndex: structuredClone(options.seed?.policyRequestIndex ?? {}),
    rolloutEventsById: structuredClone(options.seed?.rolloutEventsById ?? {}),
    rolloutEventRequestIndex: structuredClone(options.seed?.rolloutEventRequestIndex ?? {}),
    admissionsById: structuredClone(options.seed?.admissionsById ?? {}),
    admissionRequestIndex: structuredClone(options.seed?.admissionRequestIndex ?? {}),
    retirementsById: structuredClone(options.seed?.retirementsById ?? {}),
    retirementRequestIndex: structuredClone(options.seed?.retirementRequestIndex ?? {}),
  };

  let transactionBackup: SpecialistPolicyHarnessState | null = null;

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
        state.organsById = restored.organsById;
        state.policiesById = restored.policiesById;
        state.policyRequestIndex = restored.policyRequestIndex;
        state.rolloutEventsById = restored.rolloutEventsById;
        state.rolloutEventRequestIndex = restored.rolloutEventRequestIndex;
        state.admissionsById = restored.admissionsById;
        state.admissionRequestIndex = restored.admissionRequestIndex;
        state.retirementsById = restored.retirementsById;
        state.retirementRequestIndex = restored.retirementRequestIndex;
      }
      transactionBackup = null;
      return { rows: [] };
    }

    if (
      sql.startsWith('select pg_advisory_lock') ||
      sql.startsWith('select pg_advisory_xact_lock') ||
      sql.startsWith('select pg_advisory_unlock')
    ) {
      return { rows: [] };
    }

    if (sql.includes('insert into polyphony_runtime.specialist_organs')) {
      const row: SpecialistOrganRow = {
        specialistId: String(params[0]),
        taskSignature: String(params[1]),
        capability: String(params[2]),
        workshopCandidateId: String(params[3]),
        promotionPackageRef: String(params[4]),
        modelProfileId: String(params[5]),
        serviceId: String(params[6]) as SpecialistOrganRow['serviceId'],
        predecessorProfileId: (params[7] as string | null) ?? null,
        rollbackTargetProfileId: (params[8] as string | null) ?? null,
        fallbackTargetProfileId: (params[9] as string | null) ?? null,
        stage: params[10] as SpecialistOrganRow['stage'],
        statusReason: String(params[11]),
        currentPolicyId: (params[12] as string | null) ?? null,
        createdAt: String(params[13]),
        updatedAt: String(params[14]),
      };
      const existing = state.organsById[row.specialistId];
      if (existing?.stage === 'retired') {
        return { rows: [] };
      }
      state.organsById[row.specialistId] = existing ? { ...existing, ...row } : row;
      return { rows: [state.organsById[row.specialistId] as TRow] };
    }

    if (
      sql.includes('from polyphony_runtime.specialist_organs') &&
      sql.includes('where specialist_id = $1')
    ) {
      const row = state.organsById[String(params[0])];
      return { rows: row ? ([row] as TRow[]) : [] };
    }

    if (
      sql.startsWith('update polyphony_runtime.specialist_organs') &&
      sql.includes('set current_policy_id')
    ) {
      const specialistId = String(params[3]);
      const current = state.organsById[specialistId];
      if (current) {
        state.organsById[specialistId] = {
          ...current,
          currentPolicyId: String(params[0]),
          fallbackTargetProfileId: (params[1] as string | null) ?? current.fallbackTargetProfileId,
          updatedAt: String(params[2]),
        };
      }
      return { rows: [] };
    }

    if (sql.startsWith('update polyphony_runtime.specialist_organs') && sql.includes('set stage')) {
      const specialistId = String(params[4]);
      const current = state.organsById[specialistId];
      if (current) {
        state.organsById[specialistId] = {
          ...current,
          stage: params[0] as SpecialistOrganRow['stage'],
          statusReason: String(params[1]),
          currentPolicyId:
            sql.includes('current_policy_id') && typeof params[2] === 'string'
              ? String(params[2])
              : current.currentPolicyId,
          fallbackTargetProfileId:
            sql.includes('fallback_target_profile_id') && typeof params[2] === 'string'
              ? String(params[2])
              : current.fallbackTargetProfileId,
          updatedAt: String(params[3]),
        };
      }
      return { rows: [] };
    }

    if (sql.includes('insert into polyphony_runtime.specialist_rollout_policies')) {
      const requestId = String(params[1]);
      if (state.policyRequestIndex[requestId]) {
        return { rows: [] };
      }
      const row: SpecialistRolloutPolicyRow = {
        policyId: String(params[0]),
        requestId,
        normalizedRequestHash: String(params[2]),
        specialistId: String(params[3]),
        governedScope: String(params[4]),
        allowedStage: params[5] as SpecialistRolloutPolicyRow['allowedStage'],
        trafficLimit: (params[6] as number | null) ?? null,
        requiredEvidenceClassesJson: parseStringArray(
          params[7],
        ) as SpecialistRolloutPolicyRow['requiredEvidenceClassesJson'],
        healthMaxAgeMs: (params[8] as number | null) ?? null,
        fallbackTargetProfileId: (params[9] as string | null) ?? null,
        evidenceRefsJson: parseStringArray(params[10]),
        createdAt: String(params[11]),
      };
      state.policiesById[row.policyId] = row;
      state.policyRequestIndex[row.requestId] = row.policyId;
      return { rows: [row as TRow] };
    }

    if (
      sql.includes('from polyphony_runtime.specialist_rollout_policies') &&
      sql.includes('where request_id = $1')
    ) {
      const policyId = state.policyRequestIndex[String(params[0])];
      const row = policyId ? state.policiesById[policyId] : null;
      return { rows: row ? ([row] as TRow[]) : [] };
    }

    if (
      sql.includes('from polyphony_runtime.specialist_rollout_policies') &&
      sql.includes('where policy_id = $1')
    ) {
      const row = state.policiesById[String(params[0])];
      return { rows: row ? ([row] as TRow[]) : [] };
    }

    if (sql.includes('insert into polyphony_runtime.specialist_rollout_events')) {
      const row: SpecialistRolloutEventRow = {
        eventId: String(params[0]),
        requestId: String(params[1]),
        normalizedRequestHash: String(params[2]),
        policyId: String(params[3]),
        specialistId: String(params[4]),
        fromStage: (params[5] as SpecialistRolloutEventRow['fromStage']) ?? null,
        toStage: params[6] as SpecialistRolloutEventRow['toStage'],
        decision: params[7] as SpecialistRolloutEventRow['decision'],
        reasonCode: params[8] as SpecialistRolloutEventRow['reasonCode'],
        actorRef: (params[9] as string | null) ?? null,
        evidenceRefsJson: parseStringArray(params[10]),
        createdAt: String(params[11]),
      };
      state.rolloutEventsById[row.eventId] = row;
      state.rolloutEventRequestIndex[row.requestId] = row.eventId;
      return { rows: [row as TRow] };
    }

    if (
      sql.includes('from polyphony_runtime.specialist_rollout_events') &&
      sql.includes('where request_id = $1')
    ) {
      const eventId = state.rolloutEventRequestIndex[String(params[0])];
      const row = eventId ? state.rolloutEventsById[eventId] : null;
      return { rows: row ? ([row] as TRow[]) : [] };
    }

    if (
      sql.includes('from polyphony_runtime.specialist_rollout_events') &&
      sql.includes('where specialist_id = $1')
    ) {
      return {
        rows: sortByCreatedAt(
          Object.values(state.rolloutEventsById).filter(
            (row) => row.specialistId === String(params[0]),
          ),
        ) as TRow[],
      };
    }

    if (sql.includes('insert into polyphony_runtime.specialist_admission_decisions')) {
      const requestId = String(params[1]);
      const row: SpecialistAdmissionDecisionRow = {
        decisionId: String(params[0]),
        requestId,
        normalizedRequestHash: String(params[2]),
        specialistId: String(params[3]),
        taskSignature: String(params[4]),
        selectedModelProfileId: (params[5] as string | null) ?? null,
        stage: (params[6] as SpecialistAdmissionDecisionRow['stage']) ?? null,
        decision: params[7] as SpecialistAdmissionDecisionRow['decision'],
        reasonCode: params[8] as SpecialistAdmissionDecisionRow['reasonCode'],
        fallbackTargetProfileId: (params[9] as string | null) ?? null,
        evidenceRefsJson: parseStringArray(params[10]),
        payloadJson: parseRecord(params[11]),
        createdAt: String(params[12]),
      };
      state.admissionsById[row.decisionId] = row;
      state.admissionRequestIndex[row.requestId] = row.decisionId;
      return { rows: [row as TRow] };
    }

    if (
      sql.includes('select count(*)::int as "count"') &&
      sql.includes('from polyphony_runtime.specialist_admission_decisions')
    ) {
      const count = Object.values(state.admissionsById).filter(
        (row) =>
          row.specialistId === String(params[0]) &&
          row.stage === params[1] &&
          row.decision === params[2],
      ).length;
      return { rows: [{ count } as TRow] };
    }

    if (
      sql.includes('from polyphony_runtime.specialist_admission_decisions') &&
      sql.includes('where request_id = $1')
    ) {
      const decisionId = state.admissionRequestIndex[String(params[0])];
      const row = decisionId ? state.admissionsById[decisionId] : null;
      return { rows: row ? ([row] as TRow[]) : [] };
    }

    if (
      sql.includes('from polyphony_runtime.specialist_admission_decisions') &&
      sql.includes('where specialist_id = $1')
    ) {
      return {
        rows: sortByCreatedAt(
          Object.values(state.admissionsById).filter(
            (row) => row.specialistId === String(params[0]),
          ),
        ) as TRow[],
      };
    }

    if (
      sql.includes('select') &&
      sql.includes('from polyphony_runtime.specialist_retirement_decisions') &&
      sql.includes('where request_id = $1')
    ) {
      const retirementId = state.retirementRequestIndex[String(params[0])];
      const row = retirementId ? state.retirementsById[retirementId] : null;
      return { rows: row ? ([row] as TRow[]) : [] };
    }

    if (
      sql.includes('select') &&
      sql.includes('from polyphony_runtime.specialist_retirement_decisions') &&
      sql.includes('where specialist_id = $1')
    ) {
      return {
        rows: sortByCreatedAt(
          Object.values(state.retirementsById).filter(
            (row) => row.specialistId === String(params[0]),
          ),
        ) as TRow[],
      };
    }

    if (sql.includes('insert into polyphony_runtime.specialist_retirement_decisions')) {
      const row: SpecialistRetirementDecisionRow = {
        retirementId: String(params[0]),
        requestId: String(params[1]),
        normalizedRequestHash: String(params[2]),
        specialistId: String(params[3]),
        triggerKind: params[4] as SpecialistRetirementDecisionRow['triggerKind'],
        previousStage: params[5] as SpecialistRetirementDecisionRow['previousStage'],
        replacementSpecialistId: (params[6] as string | null) ?? null,
        fallbackTargetProfileId: (params[7] as string | null) ?? null,
        evidenceRefsJson: parseStringArray(params[8]),
        reason: String(params[9]),
        createdAt: String(params[10]),
      };
      state.retirementsById[row.retirementId] = row;
      state.retirementRequestIndex[row.requestId] = row.retirementId;
      return { rows: [row as TRow] };
    }

    throw new Error(`specialist policy harness does not support SQL: ${sqlText}`);
  };

  return { db: { query } as unknown as SpecialistPolicyDbExecutor, state };
}
