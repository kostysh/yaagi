import type { Client, QueryResultRow } from 'pg';
import {
  SUPPORT_OWNED_WRITE_SURFACE,
  evaluateSupportClosureReadiness,
  supportEvidenceBundleSchema,
  type SupportCanonicalEvidenceState,
  type SupportEvidenceBundle,
  type SupportIncidentClass,
} from '@yaagi/contracts/support';
import { RUNTIME_SCHEMA } from './runtime.ts';

export type SupportDbExecutor = Pick<Client, 'query'>;

const supportIncidentsTable = `${RUNTIME_SCHEMA}.support_incidents`;
const supportRunbookVersionsTable = `${RUNTIME_SCHEMA}.support_runbook_versions`;
const supportOwnedWriteSurfaces = new Set<string>(Object.values(SUPPORT_OWNED_WRITE_SURFACE));

const asUtcIso = (column: string, alias: string): string =>
  `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "${alias}"`;

const supportIncidentColumns = `
  support_incident_id as "supportIncidentId",
  request_id as "requestId",
  normalized_request_hash as "normalizedRequestHash",
  incident_class as "incidentClass",
  severity,
  source_refs_json as "sourceRefsJson",
  report_run_refs_json as "reportRunRefsJson",
  release_refs_json as "releaseRefsJson",
  operator_evidence_refs_json as "operatorEvidenceRefsJson",
  action_refs_json as "actionRefsJson",
  escalation_refs_json as "escalationRefsJson",
  closure_criteria_json as "closureCriteriaJson",
  operator_notes_json as "operatorNotesJson",
  closure_status as "closureStatus",
  residual_risk as "residualRisk",
  next_owner_ref as "nextOwnerRef",
  ${asUtcIso('created_at', 'createdAt')},
  ${asUtcIso('updated_at', 'updatedAt')},
  ${asUtcIso('closed_at', 'closedAt')}
`;

const supportRunbookVersionColumns = `
  runbook_id as "runbookId",
  incident_class as "incidentClass",
  doc_path as "docPath",
  version,
  required_sections_json as "requiredSectionsJson",
  source_refs_json as "sourceRefsJson",
  ${asUtcIso('created_at', 'createdAt')},
  ${asUtcIso('updated_at', 'updatedAt')}
`;

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }

  if (value === null || value === undefined) {
    return fallback;
  }

  return value as T;
};

const normalizeTimestamp = (value: unknown, field: string): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  throw new Error(`support row field ${field} must be a string, Date or null timestamp`);
};

export type SupportIncidentRow = SupportEvidenceBundle & {
  requestId: string;
  normalizedRequestHash: string;
};

export type SupportRunbookVersionRow = {
  runbookId: string;
  incidentClass: SupportIncidentClass;
  docPath: string;
  version: string;
  requiredSectionsJson: string[];
  sourceRefsJson: string[];
  createdAt: string;
  updatedAt: string;
};

export type SupportRejectionReason =
  | 'conflicting_request_id'
  | 'foreign_owner_write_rejected'
  | 'closure_blocked'
  | 'incident_missing';

type RequestedWriteSurfaces = {
  requestedWriteSurfaces?: readonly string[];
};

export type OpenSupportIncidentInput = SupportEvidenceBundle &
  RequestedWriteSurfaces & {
    requestId: string;
    normalizedRequestHash: string;
    canonicalEvidenceStates?: readonly SupportCanonicalEvidenceState[];
  };

export type UpdateSupportIncidentInput = SupportEvidenceBundle &
  RequestedWriteSurfaces & {
    requestId: string;
    normalizedRequestHash: string;
    canonicalEvidenceStates?: readonly SupportCanonicalEvidenceState[];
  };

export type SupportIncidentRecordResult =
  | {
      accepted: true;
      deduplicated: boolean;
      incident: SupportIncidentRow;
    }
  | {
      accepted: false;
      reason: SupportRejectionReason;
      existingIncident?: SupportIncidentRow;
      rejectedWriteSurface?: string;
      closureReasons?: string[];
    };

export type UpsertSupportRunbookVersionInput = Omit<
  SupportRunbookVersionRow,
  'createdAt' | 'updatedAt'
> & {
  createdAt: string;
  updatedAt: string;
  requestedWriteSurfaces?: readonly string[];
};

export type SupportStore = {
  assertOwnedWriteSurface(surface: string): void;
  upsertRunbookVersion(input: UpsertSupportRunbookVersionInput): Promise<SupportRunbookVersionRow>;
  listRunbookVersions(): Promise<SupportRunbookVersionRow[]>;
  openIncident(input: OpenSupportIncidentInput): Promise<SupportIncidentRecordResult>;
  updateIncident(input: UpdateSupportIncidentInput): Promise<SupportIncidentRecordResult>;
  getIncident(supportIncidentId: string): Promise<SupportIncidentRow | null>;
  listIncidents(input?: {
    limit?: number;
    closureStatus?: SupportEvidenceBundle['closureStatus'];
  }): Promise<SupportIncidentRow[]>;
};

const normalizeSupportIncidentRow = (row: QueryResultRow): SupportIncidentRow => {
  const bundle = supportEvidenceBundleSchema.parse({
    supportIncidentId: String(row['supportIncidentId']),
    incidentClass: String(row['incidentClass']),
    severity: String(row['severity']),
    sourceRefs: parseJson<string[]>(row['sourceRefsJson'], []),
    reportRunRefs: parseJson<string[]>(row['reportRunRefsJson'], []),
    releaseRefs: parseJson<string[]>(row['releaseRefsJson'], []),
    operatorEvidenceRefs: parseJson<string[]>(row['operatorEvidenceRefsJson'], []),
    actionRefs: parseJson<SupportEvidenceBundle['actionRefs']>(row['actionRefsJson'], []),
    escalationRefs: parseJson<string[]>(row['escalationRefsJson'], []),
    closureCriteria: parseJson<string[]>(row['closureCriteriaJson'], []),
    operatorNotes: parseJson<SupportEvidenceBundle['operatorNotes']>(row['operatorNotesJson'], []),
    closureStatus: String(row['closureStatus']),
    residualRisk: (row['residualRisk'] as string | null) ?? null,
    nextOwnerRef: (row['nextOwnerRef'] as string | null) ?? null,
    createdAt: normalizeTimestamp(row['createdAt'], 'support_incidents.createdAt'),
    updatedAt: normalizeTimestamp(row['updatedAt'], 'support_incidents.updatedAt'),
    closedAt: normalizeTimestamp(row['closedAt'], 'support_incidents.closedAt'),
  });

  return {
    ...bundle,
    requestId: String(row['requestId']),
    normalizedRequestHash: String(row['normalizedRequestHash']),
  };
};

const normalizeRunbookVersionRow = (row: QueryResultRow): SupportRunbookVersionRow => ({
  runbookId: String(row['runbookId']),
  incidentClass: row['incidentClass'] as SupportIncidentClass,
  docPath: String(row['docPath']),
  version: String(row['version']),
  requiredSectionsJson: parseJson<string[]>(row['requiredSectionsJson'], []),
  sourceRefsJson: parseJson<string[]>(row['sourceRefsJson'], []),
  createdAt: String(normalizeTimestamp(row['createdAt'], 'support_runbook_versions.createdAt')),
  updatedAt: String(normalizeTimestamp(row['updatedAt'], 'support_runbook_versions.updatedAt')),
});

const ensureWriteSurfaces = (
  requestedWriteSurfaces: readonly string[] | undefined,
): { accepted: true } | { accepted: false; rejectedWriteSurface: string } => {
  for (const surface of requestedWriteSurfaces ?? [SUPPORT_OWNED_WRITE_SURFACE.SUPPORT_INCIDENTS]) {
    if (!supportOwnedWriteSurfaces.has(surface)) {
      return { accepted: false, rejectedWriteSurface: surface };
    }
  }

  return { accepted: true };
};

export const createSupportStore = (db: SupportDbExecutor): SupportStore => {
  const getIncidentByRequestId = async (requestId: string): Promise<SupportIncidentRow | null> => {
    const result = await db.query<QueryResultRow>(
      `select ${supportIncidentColumns}
       from ${supportIncidentsTable}
       where request_id = $1`,
      [requestId],
    );

    return result.rows[0] ? normalizeSupportIncidentRow(result.rows[0]) : null;
  };

  return {
    assertOwnedWriteSurface(surface) {
      if (!supportOwnedWriteSurfaces.has(surface)) {
        throw new Error(`support write surface is not owned by F-0028: ${surface}`);
      }
    },

    async upsertRunbookVersion(input) {
      const surfaces = ensureWriteSurfaces(
        input.requestedWriteSurfaces ?? [SUPPORT_OWNED_WRITE_SURFACE.SUPPORT_RUNBOOK_VERSIONS],
      );
      if (!surfaces.accepted) {
        throw new Error(`support foreign write rejected: ${surfaces.rejectedWriteSurface}`);
      }

      const result = await db.query(
        `insert into ${supportRunbookVersionsTable} (
           runbook_id,
           incident_class,
           doc_path,
           version,
           required_sections_json,
           source_refs_json,
           created_at,
           updated_at
         )
         values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
         on conflict (incident_class) do update
           set runbook_id = excluded.runbook_id,
               doc_path = excluded.doc_path,
               version = excluded.version,
               required_sections_json = excluded.required_sections_json,
               source_refs_json = excluded.source_refs_json,
               updated_at = excluded.updated_at
         returning ${supportRunbookVersionColumns}`,
        [
          input.runbookId,
          input.incidentClass,
          input.docPath,
          input.version,
          JSON.stringify(input.requiredSectionsJson),
          JSON.stringify(input.sourceRefsJson),
          input.createdAt,
          input.updatedAt,
        ],
      );

      return normalizeRunbookVersionRow(result.rows[0] as QueryResultRow);
    },

    async listRunbookVersions() {
      const result = await db.query(
        `select ${supportRunbookVersionColumns}
         from ${supportRunbookVersionsTable}
         order by incident_class asc`,
      );

      return result.rows.map(normalizeRunbookVersionRow);
    },

    async openIncident(input) {
      const surfaces = ensureWriteSurfaces(input.requestedWriteSurfaces);
      if (!surfaces.accepted) {
        return {
          accepted: false,
          reason: 'foreign_owner_write_rejected',
          rejectedWriteSurface: surfaces.rejectedWriteSurface,
        };
      }

      const {
        requestId,
        normalizedRequestHash,
        canonicalEvidenceStates,
        requestedWriteSurfaces,
        ...bundleInput
      } = input;
      void requestedWriteSurfaces;
      const bundle = supportEvidenceBundleSchema.parse(bundleInput);
      const readiness = evaluateSupportClosureReadiness({
        bundle,
        ...(canonicalEvidenceStates ? { canonicalEvidenceStates } : {}),
      });
      if (readiness.status === 'blocked') {
        return {
          accepted: false,
          reason: 'closure_blocked',
          closureReasons: readiness.reasons,
        };
      }

      const existing = await getIncidentByRequestId(requestId);
      if (existing) {
        if (existing.normalizedRequestHash !== normalizedRequestHash) {
          return {
            accepted: false,
            reason: 'conflicting_request_id',
            existingIncident: existing,
          };
        }

        return {
          accepted: true,
          deduplicated: true,
          incident: existing,
        };
      }

      const result = await db.query(
        `insert into ${supportIncidentsTable} (
           support_incident_id,
           request_id,
           normalized_request_hash,
           incident_class,
           severity,
           source_refs_json,
           report_run_refs_json,
           release_refs_json,
           operator_evidence_refs_json,
           action_refs_json,
           escalation_refs_json,
           closure_criteria_json,
           operator_notes_json,
           closure_status,
           residual_risk,
           next_owner_ref,
           created_at,
           updated_at,
           closed_at
         )
         values (
           $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb,
           $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14, $15, $16, $17, $18, $19
         )
         returning ${supportIncidentColumns}`,
        [
          bundle.supportIncidentId,
          requestId,
          normalizedRequestHash,
          bundle.incidentClass,
          bundle.severity,
          JSON.stringify(bundle.sourceRefs),
          JSON.stringify(bundle.reportRunRefs),
          JSON.stringify(bundle.releaseRefs),
          JSON.stringify(bundle.operatorEvidenceRefs),
          JSON.stringify(bundle.actionRefs),
          JSON.stringify(bundle.escalationRefs),
          JSON.stringify(bundle.closureCriteria),
          JSON.stringify(bundle.operatorNotes),
          bundle.closureStatus,
          bundle.residualRisk,
          bundle.nextOwnerRef,
          bundle.createdAt,
          bundle.updatedAt,
          bundle.closedAt,
        ],
      );

      return {
        accepted: true,
        deduplicated: false,
        incident: normalizeSupportIncidentRow(result.rows[0] as QueryResultRow),
      };
    },

    async updateIncident(input) {
      const surfaces = ensureWriteSurfaces(input.requestedWriteSurfaces);
      if (!surfaces.accepted) {
        return {
          accepted: false,
          reason: 'foreign_owner_write_rejected',
          rejectedWriteSurface: surfaces.rejectedWriteSurface,
        };
      }

      const {
        canonicalEvidenceStates,
        requestId,
        normalizedRequestHash,
        requestedWriteSurfaces,
        ...bundleInput
      } = input;
      void requestId;
      void normalizedRequestHash;
      void requestedWriteSurfaces;
      const bundle = supportEvidenceBundleSchema.parse(bundleInput);
      const existing = await this.getIncident(bundle.supportIncidentId);
      if (!existing) {
        return {
          accepted: false,
          reason: 'incident_missing',
        };
      }

      const readiness = evaluateSupportClosureReadiness({
        bundle,
        ...(canonicalEvidenceStates ? { canonicalEvidenceStates } : {}),
      });
      if (readiness.status === 'blocked') {
        return {
          accepted: false,
          reason: 'closure_blocked',
          existingIncident: existing,
          closureReasons: readiness.reasons,
        };
      }

      const result = await db.query(
        `update ${supportIncidentsTable}
         set source_refs_json = $2::jsonb,
             report_run_refs_json = $3::jsonb,
             release_refs_json = $4::jsonb,
             operator_evidence_refs_json = $5::jsonb,
             action_refs_json = $6::jsonb,
             escalation_refs_json = $7::jsonb,
             closure_criteria_json = $8::jsonb,
             operator_notes_json = $9::jsonb,
             closure_status = $10,
             residual_risk = $11,
             next_owner_ref = $12,
             updated_at = $13,
             closed_at = $14
         where support_incident_id = $1
         returning ${supportIncidentColumns}`,
        [
          bundle.supportIncidentId,
          JSON.stringify(bundle.sourceRefs),
          JSON.stringify(bundle.reportRunRefs),
          JSON.stringify(bundle.releaseRefs),
          JSON.stringify(bundle.operatorEvidenceRefs),
          JSON.stringify(bundle.actionRefs),
          JSON.stringify(bundle.escalationRefs),
          JSON.stringify(bundle.closureCriteria),
          JSON.stringify(bundle.operatorNotes),
          bundle.closureStatus,
          bundle.residualRisk,
          bundle.nextOwnerRef,
          bundle.updatedAt,
          bundle.closedAt,
        ],
      );

      return {
        accepted: true,
        deduplicated: false,
        incident: normalizeSupportIncidentRow(result.rows[0] as QueryResultRow),
      };
    },

    async getIncident(supportIncidentId) {
      const result = await db.query<QueryResultRow>(
        `select ${supportIncidentColumns}
         from ${supportIncidentsTable}
         where support_incident_id = $1`,
        [supportIncidentId],
      );

      return result.rows[0] ? normalizeSupportIncidentRow(result.rows[0]) : null;
    },

    async listIncidents(input = {}) {
      const limit = input.limit ?? 50;
      const params: unknown[] = [limit];
      const where = input.closureStatus ? 'where closure_status = $2' : '';
      if (input.closureStatus) {
        params.push(input.closureStatus);
      }

      const result = await db.query(
        `select ${supportIncidentColumns}
         from ${supportIncidentsTable}
         ${where}
         order by updated_at desc, support_incident_id desc
         limit $1`,
        params,
      );

      return result.rows.map(normalizeSupportIncidentRow);
    },
  };
};
