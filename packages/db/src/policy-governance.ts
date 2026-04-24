import type { Client, QueryResultRow } from 'pg';
import {
  CONSULTANT_ADMISSION_DECISION,
  PERCEPTION_POLICY_OUTCOME,
  PHASE6_GOVERNANCE_EVENT_KIND,
  POLICY_ACTIVATION_DECISION,
  POLICY_GOVERNANCE_SCOPE,
  POLICY_GOVERNANCE_OWNED_WRITE_SURFACE,
  POLICY_PROFILE_STATUS,
  POLICY_REFUSAL_REASON,
  assertPolicyGovernanceOwnedWriteSurface,
  assertValidPolicyProfile,
  type ConsultantAdmissionDecision,
  type ConsultantAdmissionDecisionRow,
  type ConsultantKind,
  type PerceptionPolicyDecisionRow,
  type PerceptionPolicyOutcome,
  type Phase6GovernanceEventKind,
  type Phase6GovernanceEventRow,
  type PolicyActivationDecision,
  type PolicyActivationRequirements,
  type PolicyGovernanceScope,
  type PolicyProfileActivationRow,
  type PolicyProfileRow,
  type PolicyProfileRules,
  type PolicyProfileStatus,
  type PolicyRefusalReason,
} from '@yaagi/contracts/policy-governance';
import type { SensorSource, StimulusPriority } from '@yaagi/contracts/perception';
import { RUNTIME_SCHEMA } from './runtime.ts';

export type PolicyGovernanceDbExecutor = Pick<Client, 'query'>;

const policyProfilesTable = `${RUNTIME_SCHEMA}.policy_profiles`;
const policyProfileActivationsTable = `${RUNTIME_SCHEMA}.policy_profile_activations`;
const consultantAdmissionDecisionsTable = `${RUNTIME_SCHEMA}.consultant_admission_decisions`;
const perceptionPolicyDecisionsTable = `${RUNTIME_SCHEMA}.perception_policy_decisions`;
const phase6GovernanceEventsTable = `${RUNTIME_SCHEMA}.phase6_governance_events`;
const policyActivationScopeLockNamespace = 'yaagi.policy_profile_activations.active_scope';

const asUtcIso = (column: string, alias: string): string =>
  `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "${alias}"`;

const policyProfileColumns = `
  profile_id as "profileId",
  profile_version as "profileVersion",
  status,
  governed_scopes_json as "governedScopesJson",
  activation_requirements_json as "activationRequirementsJson",
  rules_json as "rulesJson",
  ${asUtcIso('created_at', 'createdAt')},
  ${asUtcIso('updated_at', 'updatedAt')}
`;

const policyProfileActivationColumns = `
  activation_id as "activationId",
  request_id as "requestId",
  normalized_request_hash as "normalizedRequestHash",
  profile_id as "profileId",
  profile_version as "profileVersion",
  scope,
  decision,
  reason_code as "reasonCode",
  actor_ref as "actorRef",
  evidence_refs_json as "evidenceRefsJson",
  ${asUtcIso('activated_at', 'activatedAt')},
  ${asUtcIso('deactivated_at', 'deactivatedAt')},
  ${asUtcIso('created_at', 'createdAt')}
`;

const consultantAdmissionDecisionColumns = `
  decision_id as "decisionId",
  request_id as "requestId",
  normalized_request_hash as "normalizedRequestHash",
  profile_id as "profileId",
  profile_version as "profileVersion",
  consultant_kind as "consultantKind",
  target_scope as "targetScope",
  decision,
  reason_code as "reasonCode",
  selected_model_profile_id as "selectedModelProfileId",
  health_ref as "healthRef",
  evidence_refs_json as "evidenceRefsJson",
  payload_json as "payloadJson",
  ${asUtcIso('created_at', 'createdAt')}
`;

const perceptionPolicyDecisionColumns = `
  decision_id as "decisionId",
  request_id as "requestId",
  normalized_request_hash as "normalizedRequestHash",
  stimulus_id as "stimulusId",
  source_kind as "sourceKind",
  priority,
  profile_id as "profileId",
  profile_version as "profileVersion",
  outcome,
  reason_code as "reasonCode",
  evidence_refs_json as "evidenceRefsJson",
  payload_json as "payloadJson",
  ${asUtcIso('created_at', 'createdAt')}
`;

const phase6GovernanceEventColumns = `
  event_id as "eventId",
  event_kind as "eventKind",
  source_ref as "sourceRef",
  profile_id as "profileId",
  profile_version as "profileVersion",
  decision_ref as "decisionRef",
  payload_json as "payloadJson",
  ${asUtcIso('created_at', 'createdAt')}
`;

const normalizeTimestamp = (value: unknown, field: string): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  throw new Error(`policy governance row field ${field} must be a string or Date timestamp`);
};

const normalizeNullableTimestamp = (value: unknown, field: string): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return normalizeTimestamp(value, field);
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

const toActivationRequirements = (value: unknown): PolicyActivationRequirements => {
  const record = toRecord(value);
  return {
    callerAdmissionEvidence: record['callerAdmissionEvidence'] === true,
    governorEvidence: record['governorEvidence'] === true,
    perimeterEvidence: record['perimeterEvidence'] === true,
    reportingEvidence: record['reportingEvidence'] === true,
    maxEvidenceAgeMs:
      typeof record['maxEvidenceAgeMs'] === 'number' && Number.isInteger(record['maxEvidenceAgeMs'])
        ? record['maxEvidenceAgeMs']
        : null,
  };
};

const toProfileRules = (value: unknown): PolicyProfileRules => {
  const record = toRecord(value);
  const supportedConsultantKinds = Array.isArray(record['supportedConsultantKinds'])
    ? record['supportedConsultantKinds'].filter(
        (entry): entry is ConsultantKind => typeof entry === 'string',
      )
    : [];

  return {
    externalConsultantsEnabled: record['externalConsultantsEnabled'] === true,
    supportedConsultantKinds,
    defaultPerceptionOutcome:
      typeof record['defaultPerceptionOutcome'] === 'string'
        ? (record['defaultPerceptionOutcome'] as PerceptionPolicyOutcome)
        : PERCEPTION_POLICY_OUTCOME.ACCEPTED,
  };
};

const normalizePolicyProfileRow = (row: QueryResultRow): PolicyProfileRow => {
  const profile = {
    profileId: String(row['profileId']),
    profileVersion: String(row['profileVersion']),
    status: row['status'] as PolicyProfileStatus,
    governedScopesJson: toStringArray(row['governedScopesJson']) as PolicyGovernanceScope[],
    activationRequirementsJson: toActivationRequirements(row['activationRequirementsJson']),
    rulesJson: toProfileRules(row['rulesJson']),
    createdAt: normalizeTimestamp(row['createdAt'], 'policy_profiles.createdAt'),
    updatedAt: normalizeTimestamp(row['updatedAt'], 'policy_profiles.updatedAt'),
  };
  assertValidPolicyProfile(profile);
  return profile;
};

const normalizePolicyProfileActivationRow = (row: QueryResultRow): PolicyProfileActivationRow => ({
  activationId: String(row['activationId']),
  requestId: String(row['requestId']),
  normalizedRequestHash: String(row['normalizedRequestHash']),
  profileId: String(row['profileId']),
  profileVersion: String(row['profileVersion']),
  scope: row['scope'] as PolicyGovernanceScope,
  decision: row['decision'] as PolicyActivationDecision,
  reasonCode: row['reasonCode'] as PolicyProfileActivationRow['reasonCode'],
  actorRef: typeof row['actorRef'] === 'string' ? row['actorRef'] : null,
  evidenceRefsJson: toStringArray(row['evidenceRefsJson']),
  activatedAt: normalizeNullableTimestamp(
    row['activatedAt'],
    'policy_profile_activations.activatedAt',
  ),
  deactivatedAt: normalizeNullableTimestamp(
    row['deactivatedAt'],
    'policy_profile_activations.deactivatedAt',
  ),
  createdAt: normalizeTimestamp(row['createdAt'], 'policy_profile_activations.createdAt'),
});

const normalizeConsultantAdmissionDecisionRow = (
  row: QueryResultRow,
): ConsultantAdmissionDecisionRow => ({
  decisionId: String(row['decisionId']),
  requestId: String(row['requestId']),
  normalizedRequestHash: String(row['normalizedRequestHash']),
  profileId: typeof row['profileId'] === 'string' ? row['profileId'] : null,
  profileVersion: typeof row['profileVersion'] === 'string' ? row['profileVersion'] : null,
  consultantKind: String(row['consultantKind']),
  targetScope: String(row['targetScope']),
  decision: row['decision'] as ConsultantAdmissionDecision,
  reasonCode: row['reasonCode'] as ConsultantAdmissionDecisionRow['reasonCode'],
  selectedModelProfileId:
    typeof row['selectedModelProfileId'] === 'string' ? row['selectedModelProfileId'] : null,
  healthRef: typeof row['healthRef'] === 'string' ? row['healthRef'] : null,
  evidenceRefsJson: toStringArray(row['evidenceRefsJson']),
  payloadJson: toRecord(row['payloadJson']),
  createdAt: normalizeTimestamp(row['createdAt'], 'consultant_admission_decisions.createdAt'),
});

const normalizePerceptionPolicyDecisionRow = (
  row: QueryResultRow,
): PerceptionPolicyDecisionRow => ({
  decisionId: String(row['decisionId']),
  requestId: String(row['requestId']),
  normalizedRequestHash: String(row['normalizedRequestHash']),
  stimulusId: String(row['stimulusId']),
  sourceKind: row['sourceKind'] as SensorSource,
  priority: row['priority'] as StimulusPriority,
  profileId: typeof row['profileId'] === 'string' ? row['profileId'] : null,
  profileVersion: typeof row['profileVersion'] === 'string' ? row['profileVersion'] : null,
  outcome: row['outcome'] as PerceptionPolicyOutcome,
  reasonCode: row['reasonCode'] as PerceptionPolicyDecisionRow['reasonCode'],
  evidenceRefsJson: toStringArray(row['evidenceRefsJson']),
  payloadJson: toRecord(row['payloadJson']),
  createdAt: normalizeTimestamp(row['createdAt'], 'perception_policy_decisions.createdAt'),
});

const normalizePhase6GovernanceEventRow = (row: QueryResultRow): Phase6GovernanceEventRow => ({
  eventId: String(row['eventId']),
  eventKind: row['eventKind'] as Phase6GovernanceEventKind,
  sourceRef: String(row['sourceRef']),
  profileId: typeof row['profileId'] === 'string' ? row['profileId'] : null,
  profileVersion: typeof row['profileVersion'] === 'string' ? row['profileVersion'] : null,
  decisionRef: typeof row['decisionRef'] === 'string' ? row['decisionRef'] : null,
  payloadJson: toRecord(row['payloadJson']),
  createdAt: normalizeTimestamp(row['createdAt'], 'phase6_governance_events.createdAt'),
});

export type RecordPolicyProfileInput = {
  profileId: string;
  profileVersion: string;
  status: PolicyProfileStatus;
  governedScopes: PolicyGovernanceScope[];
  activationRequirements: PolicyActivationRequirements;
  rules: PolicyProfileRules;
  createdAt: string;
  updatedAt: string;
};

export type RecordPolicyActivationInput = {
  activationId: string;
  requestId: string;
  normalizedRequestHash: string;
  profileId: string;
  profileVersion: string;
  scope: PolicyGovernanceScope;
  decision: PolicyActivationDecision;
  reasonCode: PolicyProfileActivationRow['reasonCode'];
  actorRef: string | null;
  evidenceRefs: string[];
  activatedAt: string | null;
  deactivatedAt: string | null;
  createdAt: string;
};

export type RecordPolicyActivationResult =
  | {
      accepted: true;
      deduplicated: boolean;
      activation: PolicyProfileActivationRow;
    }
  | {
      accepted: false;
      reason: 'conflicting_request_id' | 'active_scope_conflict';
      activation: PolicyProfileActivationRow;
    };

export type RecordConsultantAdmissionDecisionInput = {
  decisionId: string;
  requestId: string;
  normalizedRequestHash: string;
  profileId: string | null;
  profileVersion: string | null;
  consultantKind: string;
  targetScope: string;
  decision: ConsultantAdmissionDecision;
  reasonCode: ConsultantAdmissionDecisionRow['reasonCode'];
  selectedModelProfileId: string | null;
  healthRef: string | null;
  evidenceRefs: string[];
  payloadJson?: Record<string, unknown>;
  createdAt: string;
};

export type RecordConsultantAdmissionDecisionResult =
  | {
      accepted: true;
      deduplicated: boolean;
      decision: ConsultantAdmissionDecisionRow;
    }
  | {
      accepted: false;
      reason: 'conflicting_request_id';
      decision: ConsultantAdmissionDecisionRow;
    };

export type RecordPerceptionPolicyDecisionInput = {
  decisionId: string;
  requestId: string;
  normalizedRequestHash: string;
  stimulusId: string;
  sourceKind: SensorSource;
  priority: StimulusPriority;
  profileId: string | null;
  profileVersion: string | null;
  outcome: PerceptionPolicyOutcome;
  reasonCode: PerceptionPolicyDecisionRow['reasonCode'];
  evidenceRefs: string[];
  payloadJson?: Record<string, unknown>;
  createdAt: string;
};

export type RecordPerceptionPolicyDecisionResult =
  | {
      accepted: true;
      deduplicated: boolean;
      decision: PerceptionPolicyDecisionRow;
    }
  | {
      accepted: false;
      reason: 'conflicting_request_id';
      decision: PerceptionPolicyDecisionRow;
    };

export type RecordPhase6GovernanceEventInput = {
  eventId: string;
  eventKind: Phase6GovernanceEventKind;
  sourceRef: string;
  profileId: string | null;
  profileVersion: string | null;
  decisionRef: string | null;
  payloadJson?: Record<string, unknown>;
  createdAt: string;
};

export type PolicyGovernanceStore = {
  assertOwnedWriteSurface(surface: string): void;
  recordPolicyProfile(input: RecordPolicyProfileInput): Promise<PolicyProfileRow>;
  getPolicyProfile(input: {
    profileId: string;
    profileVersion: string;
  }): Promise<PolicyProfileRow | null>;
  listPolicyProfiles(input?: { status?: PolicyProfileStatus }): Promise<PolicyProfileRow[]>;
  recordPolicyActivation(input: RecordPolicyActivationInput): Promise<RecordPolicyActivationResult>;
  resolveActivePolicyActivation(
    scope: PolicyGovernanceScope,
  ): Promise<PolicyProfileActivationRow | null>;
  recordConsultantAdmissionDecision(
    input: RecordConsultantAdmissionDecisionInput,
  ): Promise<RecordConsultantAdmissionDecisionResult>;
  getConsultantAdmissionDecisionByRequestId(
    requestId: string,
  ): Promise<ConsultantAdmissionDecisionRow | null>;
  recordPerceptionPolicyDecision(
    input: RecordPerceptionPolicyDecisionInput,
  ): Promise<RecordPerceptionPolicyDecisionResult>;
  recordPhase6GovernanceEvent(
    input: RecordPhase6GovernanceEventInput,
  ): Promise<Phase6GovernanceEventRow>;
  listPhase6GovernanceEvents(input?: { limit?: number }): Promise<Phase6GovernanceEventRow[]>;
};

const loadActivationByRequestId = async (
  db: PolicyGovernanceDbExecutor,
  requestId: string,
): Promise<PolicyProfileActivationRow | null> => {
  const result = await db.query<QueryResultRow>(
    `select ${policyProfileActivationColumns}
     from ${policyProfileActivationsTable}
     where request_id = $1`,
    [requestId],
  );

  return result.rows[0] ? normalizePolicyProfileActivationRow(result.rows[0]) : null;
};

const loadConsultantAdmissionDecisionByRequestId = async (
  db: PolicyGovernanceDbExecutor,
  requestId: string,
): Promise<ConsultantAdmissionDecisionRow | null> => {
  const result = await db.query<QueryResultRow>(
    `select ${consultantAdmissionDecisionColumns}
     from ${consultantAdmissionDecisionsTable}
     where request_id = $1`,
    [requestId],
  );

  return result.rows[0] ? normalizeConsultantAdmissionDecisionRow(result.rows[0]) : null;
};

const loadPerceptionPolicyDecisionByRequestId = async (
  db: PolicyGovernanceDbExecutor,
  requestId: string,
): Promise<PerceptionPolicyDecisionRow | null> => {
  const result = await db.query<QueryResultRow>(
    `select ${perceptionPolicyDecisionColumns}
     from ${perceptionPolicyDecisionsTable}
     where request_id = $1`,
    [requestId],
  );

  return result.rows[0] ? normalizePerceptionPolicyDecisionRow(result.rows[0]) : null;
};

const acquirePolicyActivationScopeLock = async (
  db: PolicyGovernanceDbExecutor,
  scope: PolicyGovernanceScope,
): Promise<void> => {
  await db.query(`select pg_advisory_lock(hashtext($1), hashtext($2))`, [
    policyActivationScopeLockNamespace,
    scope,
  ]);
};

const releasePolicyActivationScopeLock = async (
  db: PolicyGovernanceDbExecutor,
  scope: PolicyGovernanceScope,
): Promise<void> => {
  await db.query(`select pg_advisory_unlock(hashtext($1), hashtext($2))`, [
    policyActivationScopeLockNamespace,
    scope,
  ]);
};

export function createPolicyGovernanceStore(db: PolicyGovernanceDbExecutor): PolicyGovernanceStore {
  const resolveActivePolicyActivation = async (
    scope: PolicyGovernanceScope,
  ): Promise<PolicyProfileActivationRow | null> => {
    const result = await db.query<QueryResultRow>(
      `select ${policyProfileActivationColumns}
       from ${policyProfileActivationsTable}
       where scope = $1
       order by created_at desc, activation_id desc
       limit 32`,
      [scope],
    );
    const rows = result.rows.map((row) => normalizePolicyProfileActivationRow(row));

    for (const row of rows) {
      if (row.decision === POLICY_ACTIVATION_DECISION.REFUSE) {
        continue;
      }

      return row.decision === POLICY_ACTIVATION_DECISION.ACTIVATE ? row : null;
    }

    return null;
  };

  return {
    assertOwnedWriteSurface(surface: string): void {
      assertPolicyGovernanceOwnedWriteSurface(surface);
    },

    async recordPolicyProfile(input: RecordPolicyProfileInput): Promise<PolicyProfileRow> {
      const result = await db.query<QueryResultRow>(
        `insert into ${policyProfilesTable} (
          profile_id,
          profile_version,
          status,
          governed_scopes_json,
          activation_requirements_json,
          rules_json,
          created_at,
          updated_at
        ) values (
          $1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8
        )
        on conflict (profile_id, profile_version) do update set
          status = excluded.status,
          governed_scopes_json = excluded.governed_scopes_json,
          activation_requirements_json = excluded.activation_requirements_json,
          rules_json = excluded.rules_json,
          updated_at = excluded.updated_at
        returning ${policyProfileColumns}`,
        [
          input.profileId,
          input.profileVersion,
          input.status,
          JSON.stringify(input.governedScopes),
          JSON.stringify(input.activationRequirements),
          JSON.stringify(input.rules),
          input.createdAt,
          input.updatedAt,
        ],
      );

      const row = result.rows[0];
      if (!row) {
        throw new Error(
          `failed to record policy profile ${input.profileId}@${input.profileVersion}`,
        );
      }

      return normalizePolicyProfileRow(row);
    },

    async getPolicyProfile(input: {
      profileId: string;
      profileVersion: string;
    }): Promise<PolicyProfileRow | null> {
      const result = await db.query<QueryResultRow>(
        `select ${policyProfileColumns}
         from ${policyProfilesTable}
         where profile_id = $1
           and profile_version = $2`,
        [input.profileId, input.profileVersion],
      );

      return result.rows[0] ? normalizePolicyProfileRow(result.rows[0]) : null;
    },

    async listPolicyProfiles(input?: {
      status?: PolicyProfileStatus;
    }): Promise<PolicyProfileRow[]> {
      const result = await db.query<QueryResultRow>(
        input?.status
          ? `select ${policyProfileColumns}
             from ${policyProfilesTable}
             where status = $1
             order by updated_at desc, profile_id asc`
          : `select ${policyProfileColumns}
             from ${policyProfilesTable}
             order by updated_at desc, profile_id asc`,
        input?.status ? [input.status] : [],
      );

      return result.rows.map((row) => normalizePolicyProfileRow(row));
    },

    async recordPolicyActivation(
      input: RecordPolicyActivationInput,
    ): Promise<RecordPolicyActivationResult> {
      await acquirePolicyActivationScopeLock(db, input.scope);
      try {
        if (input.decision === POLICY_ACTIVATION_DECISION.ACTIVATE) {
          const active = await resolveActivePolicyActivation(input.scope);
          if (
            active &&
            (active.profileId !== input.profileId || active.profileVersion !== input.profileVersion)
          ) {
            return {
              accepted: false,
              reason: 'active_scope_conflict',
              activation: active,
            };
          }
        }
        const result = await db.query<QueryResultRow>(
          `insert into ${policyProfileActivationsTable} (
            activation_id,
            request_id,
            normalized_request_hash,
            profile_id,
            profile_version,
            scope,
            decision,
            reason_code,
            actor_ref,
            evidence_refs_json,
            activated_at,
            deactivated_at,
            created_at
          ) values (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13
          )
          on conflict (request_id) do nothing
          returning ${policyProfileActivationColumns}`,
          [
            input.activationId,
            input.requestId,
            input.normalizedRequestHash,
            input.profileId,
            input.profileVersion,
            input.scope,
            input.decision,
            input.reasonCode,
            input.actorRef,
            JSON.stringify(input.evidenceRefs),
            input.activatedAt,
            input.deactivatedAt,
            input.createdAt,
          ],
        );
        const inserted = result.rows[0]
          ? normalizePolicyProfileActivationRow(result.rows[0])
          : null;
        if (inserted) {
          return { accepted: true, deduplicated: false, activation: inserted };
        }

        const existing = await loadActivationByRequestId(db, input.requestId);
        if (!existing) {
          throw new Error(`failed to load policy activation ${input.requestId} after conflict`);
        }
        if (existing.normalizedRequestHash !== input.normalizedRequestHash) {
          return { accepted: false, reason: 'conflicting_request_id', activation: existing };
        }

        return { accepted: true, deduplicated: true, activation: existing };
      } finally {
        await releasePolicyActivationScopeLock(db, input.scope);
      }
    },

    resolveActivePolicyActivation,

    async recordConsultantAdmissionDecision(
      input: RecordConsultantAdmissionDecisionInput,
    ): Promise<RecordConsultantAdmissionDecisionResult> {
      const result = await db.query<QueryResultRow>(
        `insert into ${consultantAdmissionDecisionsTable} (
          decision_id,
          request_id,
          normalized_request_hash,
          profile_id,
          profile_version,
          consultant_kind,
          target_scope,
          decision,
          reason_code,
          selected_model_profile_id,
          health_ref,
          evidence_refs_json,
          payload_json,
          created_at
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14
        )
        on conflict (request_id) do nothing
        returning ${consultantAdmissionDecisionColumns}`,
        [
          input.decisionId,
          input.requestId,
          input.normalizedRequestHash,
          input.profileId,
          input.profileVersion,
          input.consultantKind,
          input.targetScope,
          input.decision,
          input.reasonCode,
          input.selectedModelProfileId,
          input.healthRef,
          JSON.stringify(input.evidenceRefs),
          JSON.stringify(input.payloadJson ?? {}),
          input.createdAt,
        ],
      );
      const inserted = result.rows[0]
        ? normalizeConsultantAdmissionDecisionRow(result.rows[0])
        : null;
      if (inserted) {
        return { accepted: true, deduplicated: false, decision: inserted };
      }

      const existing = await loadConsultantAdmissionDecisionByRequestId(db, input.requestId);
      if (!existing) {
        throw new Error(
          `failed to load consultant admission decision ${input.requestId} after conflict`,
        );
      }
      if (existing.normalizedRequestHash !== input.normalizedRequestHash) {
        return { accepted: false, reason: 'conflicting_request_id', decision: existing };
      }

      return { accepted: true, deduplicated: true, decision: existing };
    },

    async getConsultantAdmissionDecisionByRequestId(
      requestId: string,
    ): Promise<ConsultantAdmissionDecisionRow | null> {
      return await loadConsultantAdmissionDecisionByRequestId(db, requestId);
    },

    async recordPerceptionPolicyDecision(
      input: RecordPerceptionPolicyDecisionInput,
    ): Promise<RecordPerceptionPolicyDecisionResult> {
      const result = await db.query<QueryResultRow>(
        `insert into ${perceptionPolicyDecisionsTable} (
          decision_id,
          request_id,
          normalized_request_hash,
          stimulus_id,
          source_kind,
          priority,
          profile_id,
          profile_version,
          outcome,
          reason_code,
          evidence_refs_json,
          payload_json,
          created_at
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13
        )
        on conflict (request_id) do nothing
        returning ${perceptionPolicyDecisionColumns}`,
        [
          input.decisionId,
          input.requestId,
          input.normalizedRequestHash,
          input.stimulusId,
          input.sourceKind,
          input.priority,
          input.profileId,
          input.profileVersion,
          input.outcome,
          input.reasonCode,
          JSON.stringify(input.evidenceRefs),
          JSON.stringify(input.payloadJson ?? {}),
          input.createdAt,
        ],
      );
      const inserted = result.rows[0] ? normalizePerceptionPolicyDecisionRow(result.rows[0]) : null;
      if (inserted) {
        return { accepted: true, deduplicated: false, decision: inserted };
      }

      const existing = await loadPerceptionPolicyDecisionByRequestId(db, input.requestId);
      if (!existing) {
        throw new Error(
          `failed to load perception policy decision ${input.requestId} after conflict`,
        );
      }
      if (existing.normalizedRequestHash !== input.normalizedRequestHash) {
        return { accepted: false, reason: 'conflicting_request_id', decision: existing };
      }

      return { accepted: true, deduplicated: true, decision: existing };
    },

    async recordPhase6GovernanceEvent(
      input: RecordPhase6GovernanceEventInput,
    ): Promise<Phase6GovernanceEventRow> {
      for (const surface of Object.values(POLICY_GOVERNANCE_OWNED_WRITE_SURFACE)) {
        assertPolicyGovernanceOwnedWriteSurface(surface);
      }

      const result = await db.query<QueryResultRow>(
        `insert into ${phase6GovernanceEventsTable} (
          event_id,
          event_kind,
          source_ref,
          profile_id,
          profile_version,
          decision_ref,
          payload_json,
          created_at
        ) values (
          $1, $2, $3, $4, $5, $6, $7::jsonb, $8
        )
        returning ${phase6GovernanceEventColumns}`,
        [
          input.eventId,
          input.eventKind,
          input.sourceRef,
          input.profileId,
          input.profileVersion,
          input.decisionRef,
          JSON.stringify(input.payloadJson ?? {}),
          input.createdAt,
        ],
      );
      const row = result.rows[0];
      if (!row) {
        throw new Error(`failed to record phase-6 governance event ${input.eventId}`);
      }

      return normalizePhase6GovernanceEventRow(row);
    },

    async listPhase6GovernanceEvents(input?: {
      limit?: number;
    }): Promise<Phase6GovernanceEventRow[]> {
      const limit = Math.max(1, Math.min(input?.limit ?? 50, 250));
      const result = await db.query<QueryResultRow>(
        `select ${phase6GovernanceEventColumns}
         from ${phase6GovernanceEventsTable}
         order by created_at desc, event_id desc
         limit $1`,
        [limit],
      );

      return result.rows.map((row) => normalizePhase6GovernanceEventRow(row));
    },
  };
}

export const CONSERVATIVE_BASELINE_POLICY_PROFILE: RecordPolicyProfileInput = Object.freeze({
  profileId: 'policy.phase6.baseline',
  profileVersion: '2026-04-24.phase6-conservative',
  status: POLICY_PROFILE_STATUS.ACTIVE,
  governedScopes: [
    POLICY_GOVERNANCE_SCOPE.CONSULTANT_ADMISSION,
    POLICY_GOVERNANCE_SCOPE.PERCEPTION_INTAKE,
    POLICY_GOVERNANCE_SCOPE.HUMAN_GATE,
    POLICY_GOVERNANCE_SCOPE.PHASE6_AUTONOMY,
  ],
  activationRequirements: {
    callerAdmissionEvidence: true,
    governorEvidence: true,
    perimeterEvidence: true,
    reportingEvidence: false,
    maxEvidenceAgeMs: 300_000,
  },
  rules: {
    externalConsultantsEnabled: false,
    supportedConsultantKinds: [],
    defaultPerceptionOutcome: PERCEPTION_POLICY_OUTCOME.ACCEPTED,
  },
  createdAt: '2026-04-24T00:00:00.000Z',
  updatedAt: '2026-04-24T00:00:00.000Z',
});

export const POLICY_GOVERNANCE_SUCCESS_REASON = Object.freeze({
  ACTIVATED: 'activated',
  DEACTIVATED: 'deactivated',
  ADMITTED: 'admitted',
  POLICY_MATCHED: 'policy_matched',
} as const);

export const POLICY_GOVERNANCE_DEFAULT_REFUSAL_REASON: PolicyRefusalReason =
  POLICY_REFUSAL_REASON.EVIDENCE_UNAVAILABLE;

export const POLICY_GOVERNANCE_DEFAULT_CONSULTANT_DECISION: ConsultantAdmissionDecision =
  CONSULTANT_ADMISSION_DECISION.REFUSAL;

export const POLICY_GOVERNANCE_DEFAULT_ACTIVATION_DECISION: PolicyActivationDecision =
  POLICY_ACTIVATION_DECISION.REFUSE;

export const POLICY_GOVERNANCE_DEFAULT_EVENT_KIND: Phase6GovernanceEventKind =
  PHASE6_GOVERNANCE_EVENT_KIND.GOVERNANCE_EVIDENCE_RECORDED;
