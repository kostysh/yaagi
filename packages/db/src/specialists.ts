import type { Client, QueryResultRow } from 'pg';
import {
  SPECIALIST_ADMISSION_DECISION,
  SPECIALIST_OWNED_WRITE_SURFACE,
  SPECIALIST_REFUSAL_REASON,
  SPECIALIST_ROLLOUT_EVENT_DECISION,
  SPECIALIST_ROLLOUT_STAGE,
  assertSpecialistOwnedWriteSurface,
  assertValidSpecialistAdmissionDecision,
  assertValidSpecialistOrgan,
  assertValidSpecialistRetirementDecision,
  assertValidSpecialistRolloutPolicy,
  isSpecialistTerminalStage,
  type SpecialistAdmissionDecision,
  type SpecialistAdmissionDecisionRow,
  type SpecialistEvidenceClass,
  type SpecialistRefusalReason,
  type SpecialistRetirementDecisionRow,
  type SpecialistRetirementTriggerKind,
  type SpecialistRolloutEventDecision,
  type SpecialistRolloutEventRow,
  type SpecialistRolloutPolicyRow,
  type SpecialistRolloutStage,
  type SpecialistOrganRow,
} from '@yaagi/contracts/specialists';
import type { ServingDependencyServiceId } from '@yaagi/contracts/models';
import { RUNTIME_SCHEMA } from './runtime.ts';

export type SpecialistPolicyDbExecutor = Pick<Client, 'query'>;

const specialistOrgansTable = `${RUNTIME_SCHEMA}.specialist_organs`;
const specialistRolloutPoliciesTable = `${RUNTIME_SCHEMA}.specialist_rollout_policies`;
const specialistRolloutEventsTable = `${RUNTIME_SCHEMA}.specialist_rollout_events`;
const specialistAdmissionDecisionsTable = `${RUNTIME_SCHEMA}.specialist_admission_decisions`;
const specialistRetirementDecisionsTable = `${RUNTIME_SCHEMA}.specialist_retirement_decisions`;
const specialistStageLockNamespace = 'yaagi.specialist_policy.stage';

const asUtcIso = (column: string, alias: string): string =>
  `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "${alias}"`;

const specialistOrganColumns = `
  specialist_id as "specialistId",
  task_signature as "taskSignature",
  capability,
  workshop_candidate_id as "workshopCandidateId",
  promotion_package_ref as "promotionPackageRef",
  model_profile_id as "modelProfileId",
  service_id as "serviceId",
  predecessor_profile_id as "predecessorProfileId",
  rollback_target_profile_id as "rollbackTargetProfileId",
  fallback_target_profile_id as "fallbackTargetProfileId",
  stage,
  status_reason as "statusReason",
  current_policy_id as "currentPolicyId",
  ${asUtcIso('created_at', 'createdAt')},
  ${asUtcIso('updated_at', 'updatedAt')}
`;

const specialistRolloutPolicyColumns = `
  policy_id as "policyId",
  request_id as "requestId",
  normalized_request_hash as "normalizedRequestHash",
  specialist_id as "specialistId",
  governed_scope as "governedScope",
  allowed_stage as "allowedStage",
  traffic_limit as "trafficLimit",
  required_evidence_classes_json as "requiredEvidenceClassesJson",
  health_max_age_ms as "healthMaxAgeMs",
  fallback_target_profile_id as "fallbackTargetProfileId",
  evidence_refs_json as "evidenceRefsJson",
  ${asUtcIso('created_at', 'createdAt')}
`;

const specialistRolloutEventColumns = `
  event_id as "eventId",
  request_id as "requestId",
  normalized_request_hash as "normalizedRequestHash",
  policy_id as "policyId",
  specialist_id as "specialistId",
  from_stage as "fromStage",
  to_stage as "toStage",
  decision,
  reason_code as "reasonCode",
  actor_ref as "actorRef",
  evidence_refs_json as "evidenceRefsJson",
  ${asUtcIso('created_at', 'createdAt')}
`;

const specialistAdmissionDecisionColumns = `
  decision_id as "decisionId",
  request_id as "requestId",
  normalized_request_hash as "normalizedRequestHash",
  specialist_id as "specialistId",
  task_signature as "taskSignature",
  selected_model_profile_id as "selectedModelProfileId",
  stage,
  decision,
  reason_code as "reasonCode",
  fallback_target_profile_id as "fallbackTargetProfileId",
  evidence_refs_json as "evidenceRefsJson",
  payload_json as "payloadJson",
  ${asUtcIso('created_at', 'createdAt')}
`;

const specialistRetirementDecisionColumns = `
  retirement_id as "retirementId",
  request_id as "requestId",
  normalized_request_hash as "normalizedRequestHash",
  specialist_id as "specialistId",
  trigger_kind as "triggerKind",
  previous_stage as "previousStage",
  replacement_specialist_id as "replacementSpecialistId",
  fallback_target_profile_id as "fallbackTargetProfileId",
  evidence_refs_json as "evidenceRefsJson",
  reason,
  ${asUtcIso('created_at', 'createdAt')}
`;

const normalizeTimestamp = (value: unknown, field: string): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  throw new Error(`specialist policy row field ${field} must be a string or Date timestamp`);
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
};

const normalizeSpecialistOrganRow = (row: QueryResultRow): SpecialistOrganRow => {
  const organ: SpecialistOrganRow = {
    specialistId: String(row['specialistId']),
    taskSignature: String(row['taskSignature']),
    capability: String(row['capability']),
    workshopCandidateId: String(row['workshopCandidateId']),
    promotionPackageRef: String(row['promotionPackageRef']),
    modelProfileId: String(row['modelProfileId']),
    serviceId: String(row['serviceId']) as ServingDependencyServiceId,
    predecessorProfileId:
      typeof row['predecessorProfileId'] === 'string' ? row['predecessorProfileId'] : null,
    rollbackTargetProfileId:
      typeof row['rollbackTargetProfileId'] === 'string' ? row['rollbackTargetProfileId'] : null,
    fallbackTargetProfileId:
      typeof row['fallbackTargetProfileId'] === 'string' ? row['fallbackTargetProfileId'] : null,
    stage: row['stage'] as SpecialistRolloutStage,
    statusReason: String(row['statusReason']),
    currentPolicyId: typeof row['currentPolicyId'] === 'string' ? row['currentPolicyId'] : null,
    createdAt: normalizeTimestamp(row['createdAt'], 'specialist_organs.createdAt'),
    updatedAt: normalizeTimestamp(row['updatedAt'], 'specialist_organs.updatedAt'),
  };
  assertValidSpecialistOrgan(organ);
  return organ;
};

const normalizeSpecialistRolloutPolicyRow = (row: QueryResultRow): SpecialistRolloutPolicyRow => {
  const policy: SpecialistRolloutPolicyRow = {
    policyId: String(row['policyId']),
    requestId: String(row['requestId']),
    normalizedRequestHash: String(row['normalizedRequestHash']),
    specialistId: String(row['specialistId']),
    governedScope: String(row['governedScope']),
    allowedStage: row['allowedStage'] as SpecialistRolloutStage,
    trafficLimit: typeof row['trafficLimit'] === 'number' ? row['trafficLimit'] : null,
    requiredEvidenceClassesJson: toStringArray(
      row['requiredEvidenceClassesJson'],
    ) as SpecialistEvidenceClass[],
    healthMaxAgeMs: typeof row['healthMaxAgeMs'] === 'number' ? row['healthMaxAgeMs'] : null,
    fallbackTargetProfileId:
      typeof row['fallbackTargetProfileId'] === 'string' ? row['fallbackTargetProfileId'] : null,
    evidenceRefsJson: toStringArray(row['evidenceRefsJson']),
    createdAt: normalizeTimestamp(row['createdAt'], 'specialist_rollout_policies.createdAt'),
  };
  assertValidSpecialistRolloutPolicy(policy);
  return policy;
};

const normalizeSpecialistRolloutEventRow = (row: QueryResultRow): SpecialistRolloutEventRow => ({
  eventId: String(row['eventId']),
  requestId: String(row['requestId']),
  normalizedRequestHash: String(row['normalizedRequestHash']),
  policyId: String(row['policyId']),
  specialistId: String(row['specialistId']),
  fromStage: (row['fromStage'] as SpecialistRolloutStage | null) ?? null,
  toStage: row['toStage'] as SpecialistRolloutStage,
  decision: row['decision'] as SpecialistRolloutEventDecision,
  reasonCode: row['reasonCode'] as SpecialistRefusalReason | 'stage_recorded',
  actorRef: typeof row['actorRef'] === 'string' ? row['actorRef'] : null,
  evidenceRefsJson: toStringArray(row['evidenceRefsJson']),
  createdAt: normalizeTimestamp(row['createdAt'], 'specialist_rollout_events.createdAt'),
});

const normalizeSpecialistAdmissionDecisionRow = (
  row: QueryResultRow,
): SpecialistAdmissionDecisionRow => {
  const decision: SpecialistAdmissionDecisionRow = {
    decisionId: String(row['decisionId']),
    requestId: String(row['requestId']),
    normalizedRequestHash: String(row['normalizedRequestHash']),
    specialistId: String(row['specialistId']),
    taskSignature: String(row['taskSignature']),
    selectedModelProfileId:
      typeof row['selectedModelProfileId'] === 'string' ? row['selectedModelProfileId'] : null,
    stage: (row['stage'] as SpecialistRolloutStage | null) ?? null,
    decision: row['decision'] as SpecialistAdmissionDecision,
    reasonCode: row['reasonCode'] as SpecialistRefusalReason | 'admitted',
    fallbackTargetProfileId:
      typeof row['fallbackTargetProfileId'] === 'string' ? row['fallbackTargetProfileId'] : null,
    evidenceRefsJson: toStringArray(row['evidenceRefsJson']),
    payloadJson: toRecord(row['payloadJson']),
    createdAt: normalizeTimestamp(row['createdAt'], 'specialist_admission_decisions.createdAt'),
  };
  assertValidSpecialistAdmissionDecision(decision);
  return decision;
};

const normalizeSpecialistRetirementDecisionRow = (
  row: QueryResultRow,
): SpecialistRetirementDecisionRow => {
  const decision: SpecialistRetirementDecisionRow = {
    retirementId: String(row['retirementId']),
    requestId: String(row['requestId']),
    normalizedRequestHash: String(row['normalizedRequestHash']),
    specialistId: String(row['specialistId']),
    triggerKind: row['triggerKind'] as SpecialistRetirementTriggerKind,
    previousStage: row['previousStage'] as SpecialistRolloutStage,
    replacementSpecialistId:
      typeof row['replacementSpecialistId'] === 'string' ? row['replacementSpecialistId'] : null,
    fallbackTargetProfileId:
      typeof row['fallbackTargetProfileId'] === 'string' ? row['fallbackTargetProfileId'] : null,
    evidenceRefsJson: toStringArray(row['evidenceRefsJson']),
    reason: String(row['reason']),
    createdAt: normalizeTimestamp(row['createdAt'], 'specialist_retirement_decisions.createdAt'),
  };
  assertValidSpecialistRetirementDecision(decision);
  return decision;
};

export type RegisterSpecialistOrganInput = Omit<SpecialistOrganRow, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

export type RecordSpecialistRolloutPolicyInput = SpecialistRolloutPolicyRow;

export type RecordSpecialistRolloutEventInput = SpecialistRolloutEventRow;

export type RecordSpecialistAdmissionDecisionInput = SpecialistAdmissionDecisionRow;

export type RecordSpecialistRetirementDecisionInput = SpecialistRetirementDecisionRow;

export type SpecialistRequestRecordResult<TRow> =
  | {
      accepted: true;
      deduplicated: boolean;
      row: TRow;
    }
  | {
      accepted: false;
      reason: 'conflicting_request_id' | 'terminal_stage_conflict';
      row: TRow;
    };

export type SpecialistPolicyStore = {
  assertOwnedWriteSurface(surface: string): void;
  registerSpecialistOrgan(input: RegisterSpecialistOrganInput): Promise<SpecialistOrganRow>;
  getSpecialistOrgan(specialistId: string): Promise<SpecialistOrganRow | null>;
  recordRolloutPolicy(
    input: RecordSpecialistRolloutPolicyInput,
  ): Promise<SpecialistRequestRecordResult<SpecialistRolloutPolicyRow>>;
  getRolloutPolicy(policyId: string): Promise<SpecialistRolloutPolicyRow | null>;
  getCurrentRolloutPolicyForSpecialist(
    specialistId: string,
  ): Promise<SpecialistRolloutPolicyRow | null>;
  recordRolloutEvent(
    input: RecordSpecialistRolloutEventInput,
  ): Promise<SpecialistRequestRecordResult<SpecialistRolloutEventRow>>;
  listRolloutEvents(input: { specialistId: string }): Promise<SpecialistRolloutEventRow[]>;
  recordAdmissionDecision(
    input: RecordSpecialistAdmissionDecisionInput,
  ): Promise<SpecialistRequestRecordResult<SpecialistAdmissionDecisionRow>>;
  getAdmissionDecisionByRequestId(
    requestId: string,
  ): Promise<SpecialistAdmissionDecisionRow | null>;
  listAdmissionDecisions(input: {
    specialistId: string;
  }): Promise<SpecialistAdmissionDecisionRow[]>;
  recordRetirementDecision(
    input: RecordSpecialistRetirementDecisionInput,
  ): Promise<SpecialistRequestRecordResult<SpecialistRetirementDecisionRow>>;
  listRetirementDecisions(input: {
    specialistId: string;
  }): Promise<SpecialistRetirementDecisionRow[]>;
};

const loadRolloutPolicyByRequestId = async (
  db: SpecialistPolicyDbExecutor,
  requestId: string,
): Promise<SpecialistRolloutPolicyRow | null> => {
  const result = await db.query<QueryResultRow>(
    `select ${specialistRolloutPolicyColumns}
     from ${specialistRolloutPoliciesTable}
     where request_id = $1`,
    [requestId],
  );

  return result.rows[0] ? normalizeSpecialistRolloutPolicyRow(result.rows[0]) : null;
};

const loadRolloutEventByRequestId = async (
  db: SpecialistPolicyDbExecutor,
  requestId: string,
): Promise<SpecialistRolloutEventRow | null> => {
  const result = await db.query<QueryResultRow>(
    `select ${specialistRolloutEventColumns}
     from ${specialistRolloutEventsTable}
     where request_id = $1`,
    [requestId],
  );

  return result.rows[0] ? normalizeSpecialistRolloutEventRow(result.rows[0]) : null;
};

const loadAdmissionDecisionByRequestId = async (
  db: SpecialistPolicyDbExecutor,
  requestId: string,
): Promise<SpecialistAdmissionDecisionRow | null> => {
  const result = await db.query<QueryResultRow>(
    `select ${specialistAdmissionDecisionColumns}
     from ${specialistAdmissionDecisionsTable}
     where request_id = $1`,
    [requestId],
  );

  return result.rows[0] ? normalizeSpecialistAdmissionDecisionRow(result.rows[0]) : null;
};

const loadRetirementDecisionByRequestId = async (
  db: SpecialistPolicyDbExecutor,
  requestId: string,
): Promise<SpecialistRetirementDecisionRow | null> => {
  const result = await db.query<QueryResultRow>(
    `select ${specialistRetirementDecisionColumns}
     from ${specialistRetirementDecisionsTable}
     where request_id = $1`,
    [requestId],
  );

  return result.rows[0] ? normalizeSpecialistRetirementDecisionRow(result.rows[0]) : null;
};

const acquireSpecialistStageLock = async (
  db: SpecialistPolicyDbExecutor,
  specialistId: string,
): Promise<void> => {
  await db.query(`select pg_advisory_lock(hashtext($1), hashtext($2))`, [
    specialistStageLockNamespace,
    specialistId,
  ]);
};

const releaseSpecialistStageLock = async (
  db: SpecialistPolicyDbExecutor,
  specialistId: string,
): Promise<void> => {
  await db.query(`select pg_advisory_unlock(hashtext($1), hashtext($2))`, [
    specialistStageLockNamespace,
    specialistId,
  ]);
};

const transaction = async <T>(
  db: SpecialistPolicyDbExecutor,
  run: () => Promise<T>,
): Promise<T> => {
  await db.query('begin');
  try {
    const result = await run();
    await db.query('commit');
    return result;
  } catch (error) {
    try {
      await db.query('rollback');
    } catch {
      // Preserve original error.
    }
    throw error;
  }
};

const compareRequestHash = <TRow extends { normalizedRequestHash: string }>(
  existing: TRow,
  incomingHash: string,
  reason: 'conflicting_request_id' | 'terminal_stage_conflict' = 'conflicting_request_id',
): SpecialistRequestRecordResult<TRow> =>
  existing.normalizedRequestHash === incomingHash
    ? { accepted: true, deduplicated: true, row: existing }
    : { accepted: false, reason, row: existing };

export function createSpecialistPolicyStore(db: SpecialistPolicyDbExecutor): SpecialistPolicyStore {
  const getSpecialistOrgan = async (specialistId: string): Promise<SpecialistOrganRow | null> => {
    const result = await db.query<QueryResultRow>(
      `select ${specialistOrganColumns}
       from ${specialistOrgansTable}
       where specialist_id = $1`,
      [specialistId],
    );

    return result.rows[0] ? normalizeSpecialistOrganRow(result.rows[0]) : null;
  };

  const getRolloutPolicy = async (policyId: string): Promise<SpecialistRolloutPolicyRow | null> => {
    const result = await db.query<QueryResultRow>(
      `select ${specialistRolloutPolicyColumns}
       from ${specialistRolloutPoliciesTable}
       where policy_id = $1`,
      [policyId],
    );

    return result.rows[0] ? normalizeSpecialistRolloutPolicyRow(result.rows[0]) : null;
  };

  return {
    assertOwnedWriteSurface(surface: string): void {
      assertSpecialistOwnedWriteSurface(surface);
    },

    async registerSpecialistOrgan(input): Promise<SpecialistOrganRow> {
      assertValidSpecialistOrgan(input);
      const result = await db.query<QueryResultRow>(
        `insert into ${specialistOrgansTable} (
          specialist_id,
          task_signature,
          capability,
          workshop_candidate_id,
          promotion_package_ref,
          model_profile_id,
          service_id,
          predecessor_profile_id,
          rollback_target_profile_id,
          fallback_target_profile_id,
          stage,
          status_reason,
          current_policy_id,
          created_at,
          updated_at
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )
        on conflict (specialist_id) do update set
          task_signature = excluded.task_signature,
          capability = excluded.capability,
          promotion_package_ref = excluded.promotion_package_ref,
          model_profile_id = excluded.model_profile_id,
          service_id = excluded.service_id,
          predecessor_profile_id = excluded.predecessor_profile_id,
          rollback_target_profile_id = excluded.rollback_target_profile_id,
          fallback_target_profile_id = excluded.fallback_target_profile_id,
          stage = excluded.stage,
          status_reason = excluded.status_reason,
          current_policy_id = excluded.current_policy_id,
          updated_at = excluded.updated_at
        returning ${specialistOrganColumns}`,
        [
          input.specialistId,
          input.taskSignature,
          input.capability,
          input.workshopCandidateId,
          input.promotionPackageRef,
          input.modelProfileId,
          input.serviceId,
          input.predecessorProfileId,
          input.rollbackTargetProfileId,
          input.fallbackTargetProfileId,
          input.stage,
          input.statusReason,
          input.currentPolicyId,
          input.createdAt,
          input.updatedAt,
        ],
      );

      const row = result.rows[0];
      if (!row) {
        throw new Error(`failed to register specialist organ ${input.specialistId}`);
      }

      return normalizeSpecialistOrganRow(row);
    },

    getSpecialistOrgan,

    async recordRolloutPolicy(
      input,
    ): Promise<SpecialistRequestRecordResult<SpecialistRolloutPolicyRow>> {
      assertValidSpecialistRolloutPolicy(input);
      const result = await db.query<QueryResultRow>(
        `insert into ${specialistRolloutPoliciesTable} (
          policy_id,
          request_id,
          normalized_request_hash,
          specialist_id,
          governed_scope,
          allowed_stage,
          traffic_limit,
          required_evidence_classes_json,
          health_max_age_ms,
          fallback_target_profile_id,
          evidence_refs_json,
          created_at
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11::jsonb, $12
        )
        on conflict (request_id) do nothing
        returning ${specialistRolloutPolicyColumns}`,
        [
          input.policyId,
          input.requestId,
          input.normalizedRequestHash,
          input.specialistId,
          input.governedScope,
          input.allowedStage,
          input.trafficLimit,
          JSON.stringify(input.requiredEvidenceClassesJson),
          input.healthMaxAgeMs,
          input.fallbackTargetProfileId,
          JSON.stringify(input.evidenceRefsJson),
          input.createdAt,
        ],
      );

      const inserted = result.rows[0] ? normalizeSpecialistRolloutPolicyRow(result.rows[0]) : null;
      if (inserted) {
        await db.query(
          `update ${specialistOrgansTable}
           set current_policy_id = $1,
               fallback_target_profile_id = coalesce($2, fallback_target_profile_id),
               updated_at = $3
           where specialist_id = $4`,
          [input.policyId, input.fallbackTargetProfileId, input.createdAt, input.specialistId],
        );
        return { accepted: true, deduplicated: false, row: inserted };
      }

      const existing = await loadRolloutPolicyByRequestId(db, input.requestId);
      if (!existing) {
        throw new Error(`failed to load specialist rollout policy ${input.requestId}`);
      }

      return compareRequestHash(existing, input.normalizedRequestHash);
    },

    getRolloutPolicy,

    async getCurrentRolloutPolicyForSpecialist(
      specialistId: string,
    ): Promise<SpecialistRolloutPolicyRow | null> {
      const organ = await getSpecialistOrgan(specialistId);
      if (!organ?.currentPolicyId) {
        return null;
      }

      return await getRolloutPolicy(organ.currentPolicyId);
    },

    async recordRolloutEvent(
      input,
    ): Promise<SpecialistRequestRecordResult<SpecialistRolloutEventRow>> {
      return await transaction(db, async () => {
        await acquireSpecialistStageLock(db, input.specialistId);
        try {
          const existing = await loadRolloutEventByRequestId(db, input.requestId);
          if (existing) {
            return compareRequestHash(existing, input.normalizedRequestHash);
          }

          const organ = await getSpecialistOrgan(input.specialistId);
          if (
            organ &&
            isSpecialistTerminalStage(organ.stage) &&
            input.toStage !== SPECIALIST_ROLLOUT_STAGE.RETIRED
          ) {
            const terminalEvent: SpecialistRolloutEventRow = {
              ...input,
              decision: SPECIALIST_ROLLOUT_EVENT_DECISION.REFUSED,
              reasonCode: SPECIALIST_REFUSAL_REASON.TERMINAL_STAGE_CONFLICT,
              fromStage: organ.stage,
            };
            return { accepted: false, reason: 'terminal_stage_conflict', row: terminalEvent };
          }

          const result = await db.query<QueryResultRow>(
            `insert into ${specialistRolloutEventsTable} (
              event_id,
              request_id,
              normalized_request_hash,
              policy_id,
              specialist_id,
              from_stage,
              to_stage,
              decision,
              reason_code,
              actor_ref,
              evidence_refs_json,
              created_at
            ) values (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12
            )
            returning ${specialistRolloutEventColumns}`,
            [
              input.eventId,
              input.requestId,
              input.normalizedRequestHash,
              input.policyId,
              input.specialistId,
              organ?.stage ?? input.fromStage,
              input.toStage,
              input.decision,
              input.reasonCode,
              input.actorRef,
              JSON.stringify(input.evidenceRefsJson),
              input.createdAt,
            ],
          );
          const row = result.rows[0];
          if (!row) {
            throw new Error(`failed to record specialist rollout event ${input.eventId}`);
          }
          const event = normalizeSpecialistRolloutEventRow(row);
          if (event.decision === SPECIALIST_ROLLOUT_EVENT_DECISION.RECORDED) {
            await db.query(
              `update ${specialistOrgansTable}
               set stage = $1,
                   status_reason = $2,
                   current_policy_id = $3,
                   updated_at = $4
               where specialist_id = $5`,
              [
                event.toStage,
                event.reasonCode,
                event.policyId,
                event.createdAt,
                event.specialistId,
              ],
            );
          }

          return { accepted: true, deduplicated: false, row: event };
        } finally {
          await releaseSpecialistStageLock(db, input.specialistId);
        }
      });
    },

    async listRolloutEvents(input): Promise<SpecialistRolloutEventRow[]> {
      const result = await db.query<QueryResultRow>(
        `select ${specialistRolloutEventColumns}
         from ${specialistRolloutEventsTable}
         where specialist_id = $1
         order by created_at asc, event_id asc`,
        [input.specialistId],
      );

      return result.rows.map((row) => normalizeSpecialistRolloutEventRow(row));
    },

    async recordAdmissionDecision(
      input,
    ): Promise<SpecialistRequestRecordResult<SpecialistAdmissionDecisionRow>> {
      assertValidSpecialistAdmissionDecision(input);
      const result = await db.query<QueryResultRow>(
        `insert into ${specialistAdmissionDecisionsTable} (
          decision_id,
          request_id,
          normalized_request_hash,
          specialist_id,
          task_signature,
          selected_model_profile_id,
          stage,
          decision,
          reason_code,
          fallback_target_profile_id,
          evidence_refs_json,
          payload_json,
          created_at
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13
        )
        on conflict (request_id) do nothing
        returning ${specialistAdmissionDecisionColumns}`,
        [
          input.decisionId,
          input.requestId,
          input.normalizedRequestHash,
          input.specialistId,
          input.taskSignature,
          input.selectedModelProfileId,
          input.stage,
          input.decision,
          input.reasonCode,
          input.fallbackTargetProfileId,
          JSON.stringify(input.evidenceRefsJson),
          JSON.stringify(input.payloadJson),
          input.createdAt,
        ],
      );
      const inserted = result.rows[0]
        ? normalizeSpecialistAdmissionDecisionRow(result.rows[0])
        : null;
      if (inserted) {
        return { accepted: true, deduplicated: false, row: inserted };
      }

      const existing = await loadAdmissionDecisionByRequestId(db, input.requestId);
      if (!existing) {
        throw new Error(`failed to load specialist admission decision ${input.requestId}`);
      }

      return compareRequestHash(existing, input.normalizedRequestHash);
    },

    getAdmissionDecisionByRequestId(requestId) {
      return loadAdmissionDecisionByRequestId(db, requestId);
    },

    async listAdmissionDecisions(input): Promise<SpecialistAdmissionDecisionRow[]> {
      const result = await db.query<QueryResultRow>(
        `select ${specialistAdmissionDecisionColumns}
         from ${specialistAdmissionDecisionsTable}
         where specialist_id = $1
         order by created_at asc, decision_id asc`,
        [input.specialistId],
      );

      return result.rows.map((row) => normalizeSpecialistAdmissionDecisionRow(row));
    },

    async recordRetirementDecision(
      input,
    ): Promise<SpecialistRequestRecordResult<SpecialistRetirementDecisionRow>> {
      assertValidSpecialistRetirementDecision(input);
      return await transaction(db, async () => {
        await acquireSpecialistStageLock(db, input.specialistId);
        try {
          const existing = await loadRetirementDecisionByRequestId(db, input.requestId);
          if (existing) {
            return compareRequestHash(existing, input.normalizedRequestHash);
          }

          const organ = await getSpecialistOrgan(input.specialistId);
          if (organ?.stage === SPECIALIST_ROLLOUT_STAGE.RETIRED) {
            const latestResult = await db.query<QueryResultRow>(
              `select ${specialistRetirementDecisionColumns}
               from ${specialistRetirementDecisionsTable}
               where specialist_id = $1
               order by created_at asc, retirement_id asc`,
              [input.specialistId],
            );
            const latest = latestResult.rows.at(-1)
              ? normalizeSpecialistRetirementDecisionRow(latestResult.rows.at(-1) as QueryResultRow)
              : null;
            if (latest) {
              return { accepted: false, reason: 'terminal_stage_conflict', row: latest };
            }
          }

          const result = await db.query<QueryResultRow>(
            `insert into ${specialistRetirementDecisionsTable} (
              retirement_id,
              request_id,
              normalized_request_hash,
              specialist_id,
              trigger_kind,
              previous_stage,
              replacement_specialist_id,
              fallback_target_profile_id,
              evidence_refs_json,
              reason,
              created_at
            ) values (
              $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11
            )
            returning ${specialistRetirementDecisionColumns}`,
            [
              input.retirementId,
              input.requestId,
              input.normalizedRequestHash,
              input.specialistId,
              input.triggerKind,
              organ?.stage ?? input.previousStage,
              input.replacementSpecialistId,
              input.fallbackTargetProfileId,
              JSON.stringify(input.evidenceRefsJson),
              input.reason,
              input.createdAt,
            ],
          );
          const row = result.rows[0];
          if (!row) {
            throw new Error(`failed to record specialist retirement ${input.retirementId}`);
          }
          const retirement = normalizeSpecialistRetirementDecisionRow(row);
          await db.query(
            `update ${specialistOrgansTable}
             set stage = $1,
                 status_reason = $2,
                 fallback_target_profile_id = coalesce($3, fallback_target_profile_id),
                 updated_at = $4
             where specialist_id = $5`,
            [
              SPECIALIST_ROLLOUT_STAGE.RETIRED,
              retirement.triggerKind,
              retirement.fallbackTargetProfileId,
              retirement.createdAt,
              retirement.specialistId,
            ],
          );

          return { accepted: true, deduplicated: false, row: retirement };
        } finally {
          await releaseSpecialistStageLock(db, input.specialistId);
        }
      });
    },

    async listRetirementDecisions(input): Promise<SpecialistRetirementDecisionRow[]> {
      const result = await db.query<QueryResultRow>(
        `select ${specialistRetirementDecisionColumns}
         from ${specialistRetirementDecisionsTable}
         where specialist_id = $1
         order by created_at asc, retirement_id asc`,
        [input.specialistId],
      );

      return result.rows.map((row) => normalizeSpecialistRetirementDecisionRow(row));
    },
  };
}

export const SPECIALIST_POLICY_WRITE_SURFACES = Object.freeze([
  SPECIALIST_OWNED_WRITE_SURFACE.ORGANS,
  SPECIALIST_OWNED_WRITE_SURFACE.ROLLOUT_POLICIES,
  SPECIALIST_OWNED_WRITE_SURFACE.ROLLOUT_EVENTS,
  SPECIALIST_OWNED_WRITE_SURFACE.ADMISSION_DECISIONS,
  SPECIALIST_OWNED_WRITE_SURFACE.RETIREMENT_DECISIONS,
] as const);

export const SPECIALIST_POLICY_DEFAULT_ADMISSION_DECISION: SpecialistAdmissionDecision =
  SPECIALIST_ADMISSION_DECISION.REFUSAL;
