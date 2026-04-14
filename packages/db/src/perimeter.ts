import type { Client, QueryResultRow } from 'pg';
import type {
  PerimeterActionClass,
  PerimeterAuthorityOwner,
  PerimeterDecisionReason,
  PerimeterDecisionRow,
  PerimeterIngressOwner,
  PerimeterVerdict,
} from '@yaagi/contracts/perimeter';
import { RUNTIME_SCHEMA } from './runtime.ts';

export type PerimeterDbExecutor = Pick<Client, 'query'>;
type StoredPerimeterDecisionRow = PerimeterDecisionRow & {
  normalizedRequestHash: string;
};

const perimeterDecisionsTable = `${RUNTIME_SCHEMA}.perimeter_decisions`;

const asUtcIso = (column: string, alias: string): string =>
  `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "${alias}"`;

const perimeterDecisionColumns = `
  decision_id as "decisionId",
  request_id as "requestId",
  normalized_request_hash as "normalizedRequestHash",
  action_class as "actionClass",
  ingress_owner as "ingressOwner",
  authority_owner as "authorityOwner",
  governor_proposal_id as "governorProposalId",
  governor_decision_ref as "governorDecisionRef",
  human_override_evidence_ref as "humanOverrideEvidenceRef",
  target_ref as "targetRef",
  evidence_refs_json as "evidenceRefsJson",
  verdict,
  decision_reason as "decisionReason",
  policy_version as "policyVersion",
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

  throw new Error(`perimeter row field ${field} must be a string or Date timestamp`);
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

const normalizeDecisionRow = (row: QueryResultRow): StoredPerimeterDecisionRow => ({
  decisionId: String(row['decisionId']),
  requestId: String(row['requestId']),
  normalizedRequestHash: String(row['normalizedRequestHash']),
  actionClass: row['actionClass'] as PerimeterActionClass,
  ingressOwner: row['ingressOwner'] as PerimeterIngressOwner,
  authorityOwner: row['authorityOwner'] as PerimeterAuthorityOwner,
  governorProposalId:
    typeof row['governorProposalId'] === 'string' ? row['governorProposalId'] : null,
  governorDecisionRef:
    typeof row['governorDecisionRef'] === 'string' ? row['governorDecisionRef'] : null,
  humanOverrideEvidenceRef:
    typeof row['humanOverrideEvidenceRef'] === 'string' ? row['humanOverrideEvidenceRef'] : null,
  targetRef: typeof row['targetRef'] === 'string' ? row['targetRef'] : null,
  evidenceRefsJson: toStringArray(row['evidenceRefsJson']),
  verdict: row['verdict'] as PerimeterVerdict,
  decisionReason: row['decisionReason'] as PerimeterDecisionReason,
  policyVersion: String(row['policyVersion']),
  payloadJson: toRecord(row['payloadJson']),
  createdAt: normalizeTimestamp(row['createdAt'], 'perimeter_decisions.createdAt'),
});

const toPublicDecisionRow = (row: StoredPerimeterDecisionRow): PerimeterDecisionRow => ({
  decisionId: row.decisionId,
  requestId: row.requestId,
  actionClass: row.actionClass,
  ingressOwner: row.ingressOwner,
  authorityOwner: row.authorityOwner,
  governorProposalId: row.governorProposalId,
  governorDecisionRef: row.governorDecisionRef,
  humanOverrideEvidenceRef: row.humanOverrideEvidenceRef,
  targetRef: row.targetRef,
  evidenceRefsJson: row.evidenceRefsJson,
  verdict: row.verdict,
  decisionReason: row.decisionReason,
  policyVersion: row.policyVersion,
  payloadJson: row.payloadJson,
  createdAt: row.createdAt,
});

export type RecordPerimeterDecisionInput = {
  decisionId: string;
  requestId: string;
  normalizedRequestHash: string;
  actionClass: PerimeterActionClass;
  ingressOwner: PerimeterIngressOwner;
  authorityOwner: PerimeterAuthorityOwner;
  governorProposalId: string | null;
  governorDecisionRef: string | null;
  humanOverrideEvidenceRef: string | null;
  targetRef: string | null;
  evidenceRefs: string[];
  verdict: PerimeterVerdict;
  decisionReason: PerimeterDecisionReason;
  policyVersion: string;
  payloadJson?: Record<string, unknown>;
  createdAt: string;
};

export type RecordPerimeterDecisionResult =
  | {
      accepted: true;
      deduplicated: boolean;
      decision: PerimeterDecisionRow;
    }
  | {
      accepted: false;
      reason: 'conflicting_request_id';
      decision: PerimeterDecisionRow;
    };

export type PerimeterStore = {
  recordDecision(input: RecordPerimeterDecisionInput): Promise<RecordPerimeterDecisionResult>;
  getDecisionByRequestId(requestId: string): Promise<PerimeterDecisionRow | null>;
};

const selectDecisionByRequestId = async (
  db: PerimeterDbExecutor,
  requestId: string,
): Promise<StoredPerimeterDecisionRow | null> => {
  const result = await db.query<StoredPerimeterDecisionRow>(
    `select ${perimeterDecisionColumns}
     from ${perimeterDecisionsTable}
     where request_id = $1`,
    [requestId],
  );

  return result.rows[0] ? normalizeDecisionRow(result.rows[0] as QueryResultRow) : null;
};

export function createPerimeterStore(db: PerimeterDbExecutor): PerimeterStore {
  return {
    async recordDecision(
      input: RecordPerimeterDecisionInput,
    ): Promise<RecordPerimeterDecisionResult> {
      const result = await db.query<StoredPerimeterDecisionRow>(
        `insert into ${perimeterDecisionsTable} (
          decision_id,
          request_id,
          normalized_request_hash,
          action_class,
          ingress_owner,
          authority_owner,
          governor_proposal_id,
          governor_decision_ref,
          human_override_evidence_ref,
          target_ref,
          evidence_refs_json,
          verdict,
          decision_reason,
          policy_version,
          payload_json,
          created_at
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15::jsonb, $16
        )
        on conflict (request_id) do nothing
        returning ${perimeterDecisionColumns}`,
        [
          input.decisionId,
          input.requestId,
          input.normalizedRequestHash,
          input.actionClass,
          input.ingressOwner,
          input.authorityOwner,
          input.governorProposalId,
          input.governorDecisionRef,
          input.humanOverrideEvidenceRef,
          input.targetRef,
          JSON.stringify(input.evidenceRefs),
          input.verdict,
          input.decisionReason,
          input.policyVersion,
          JSON.stringify(input.payloadJson ?? {}),
          input.createdAt,
        ],
      );

      const inserted = result.rows[0]
        ? normalizeDecisionRow(result.rows[0] as QueryResultRow)
        : null;
      if (inserted) {
        return {
          accepted: true,
          deduplicated: false,
          decision: toPublicDecisionRow(inserted),
        };
      }

      const existing = await selectDecisionByRequestId(db, input.requestId);
      if (!existing) {
        throw new Error(`failed to load perimeter decision ${input.requestId} after conflict`);
      }

      if (existing.normalizedRequestHash !== input.normalizedRequestHash) {
        return {
          accepted: false,
          reason: 'conflicting_request_id',
          decision: toPublicDecisionRow(existing),
        };
      }

      return {
        accepted: true,
        deduplicated: true,
        decision: toPublicDecisionRow(existing),
      };
    },

    async getDecisionByRequestId(requestId: string): Promise<PerimeterDecisionRow | null> {
      const decision = await selectDecisionByRequestId(db, requestId);
      return decision ? toPublicDecisionRow(decision) : null;
    },
  };
}
