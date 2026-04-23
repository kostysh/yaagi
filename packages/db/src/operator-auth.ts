import type { Client, QueryResultRow } from 'pg';
import type {
  OperatorAuthAuditEventRow,
  OperatorAuthDecision,
  OperatorAuthFailureReason,
  OperatorRiskClass,
  OperatorRouteClass,
} from '@yaagi/contracts/operator-auth';
import { RUNTIME_SCHEMA } from './runtime.ts';

export type OperatorAuthDbExecutor = Pick<Client, 'query'>;

const operatorAuthAuditEventsTable = `${RUNTIME_SCHEMA}.operator_auth_audit_events`;

const asUtcIso = (column: string, alias: string): string =>
  `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "${alias}"`;

const operatorAuthAuditEventColumns = `
  audit_event_id as "auditEventId",
  request_id as "requestId",
  principal_ref as "principalRef",
  session_ref as "sessionRef",
  method,
  route,
  route_class as "routeClass",
  risk_class as "riskClass",
  decision,
  denial_reason as "denialReason",
  evidence_ref as "evidenceRef",
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

  throw new Error(`operator auth row field ${field} must be a string or Date timestamp`);
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
};

const normalizeAuditEventRow = (row: QueryResultRow): OperatorAuthAuditEventRow => ({
  auditEventId: String(row['auditEventId']),
  requestId: String(row['requestId']),
  principalRef: typeof row['principalRef'] === 'string' ? row['principalRef'] : null,
  sessionRef: typeof row['sessionRef'] === 'string' ? row['sessionRef'] : null,
  method: String(row['method']),
  route: String(row['route']),
  routeClass: row['routeClass'] as OperatorRouteClass,
  riskClass: row['riskClass'] as OperatorRiskClass,
  decision: row['decision'] as OperatorAuthDecision,
  denialReason:
    typeof row['denialReason'] === 'string'
      ? (row['denialReason'] as OperatorAuthFailureReason)
      : null,
  evidenceRef: typeof row['evidenceRef'] === 'string' ? row['evidenceRef'] : null,
  payloadJson: toRecord(row['payloadJson']),
  createdAt: normalizeTimestamp(row['createdAt'], 'operator_auth_audit_events.createdAt'),
});

export type RecordOperatorAuthAuditEventInput = {
  auditEventId: string;
  requestId: string;
  principalRef: string | null;
  sessionRef: string | null;
  method: string;
  route: string;
  routeClass: OperatorRouteClass;
  riskClass: OperatorRiskClass;
  decision: OperatorAuthDecision;
  denialReason: OperatorAuthFailureReason | null;
  evidenceRef: string | null;
  payloadJson?: Record<string, unknown>;
  createdAt: string;
};

export type RecordOperatorAuthAuditEventResult = {
  accepted: true;
  event: OperatorAuthAuditEventRow;
};

export type OperatorAuthStore = {
  recordAuthAuditEvent(
    input: RecordOperatorAuthAuditEventInput,
  ): Promise<RecordOperatorAuthAuditEventResult>;
};

export function createOperatorAuthStore(db: OperatorAuthDbExecutor): OperatorAuthStore {
  return {
    async recordAuthAuditEvent(
      input: RecordOperatorAuthAuditEventInput,
    ): Promise<RecordOperatorAuthAuditEventResult> {
      const result = await db.query<OperatorAuthAuditEventRow>(
        `insert into ${operatorAuthAuditEventsTable} (
          audit_event_id,
          request_id,
          principal_ref,
          session_ref,
          method,
          route,
          route_class,
          risk_class,
          decision,
          denial_reason,
          evidence_ref,
          payload_json,
          created_at
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13
        )
        returning ${operatorAuthAuditEventColumns}`,
        [
          input.auditEventId,
          input.requestId,
          input.principalRef,
          input.sessionRef,
          input.method,
          input.route,
          input.routeClass,
          input.riskClass,
          input.decision,
          input.denialReason,
          input.evidenceRef,
          JSON.stringify(input.payloadJson ?? {}),
          input.createdAt,
        ],
      );

      const event = result.rows[0];
      if (!event) {
        throw new Error(`failed to record operator auth audit event ${input.auditEventId}`);
      }

      return {
        accepted: true,
        event: normalizeAuditEventRow(event as QueryResultRow),
      };
    },
  };
}
