import type { Client, QueryResultRow } from 'pg';
import {
  SUPPORT_OWNED_WRITE_SURFACE,
  evaluateSupportClosureReadiness,
  isSupportTerminalClosureStatus,
  supportEvidenceBundleSchema,
  type SupportCanonicalEvidenceState,
  type SupportClosureReadiness,
  type SupportEvidenceBundle,
  type SupportIncidentClass,
} from '@yaagi/contracts/support';
import { RUNTIME_SCHEMA } from './runtime.ts';

export type SupportDbExecutor = Pick<Client, 'query'>;

const supportIncidentsTable = `${RUNTIME_SCHEMA}.support_incidents`;
const supportIncidentUpdateRequestsTable = `${RUNTIME_SCHEMA}.support_incident_update_requests`;
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
  closure_readiness_status as "closureReadinessStatus",
  closure_readiness_reasons_json as "closureReadinessReasonsJson",
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
  closureReadinessStatus: SupportClosureReadiness['status'];
  closureReadinessReasons: string[];
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
  | 'incident_missing'
  | 'request_failed'
  | 'request_in_progress';

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
    requestClaimed?: boolean;
    scalarFieldUpdates?: {
      closureStatus?: boolean;
      residualRisk?: boolean;
      nextOwnerRef?: boolean;
    };
  };

export type ClaimSupportIncidentUpdateInput = RequestedWriteSurfaces & {
  supportIncidentId: string;
  requestId: string;
  normalizedRequestHash: string;
  createdAt: string;
};

export type RejectSupportIncidentUpdateInput = RequestedWriteSurfaces & {
  supportIncidentId: string;
  requestId: string;
  normalizedRequestHash: string;
  completedAt: string;
  reason?: SupportRejectionReason;
  closureReasons?: readonly string[];
};

type UpdateRequestRow = {
  supportIncidentId: string;
  normalizedRequestHash: string;
  status: 'pending' | 'applied' | 'rejected';
  rejectionReason: SupportRejectionReason | null;
  closureReasons: string[];
};

type UpdateRequestClaimResult =
  | {
      accepted: true;
      inserted: true;
      incident: SupportIncidentRow;
    }
  | {
      accepted: true;
      inserted: false;
      replay: UpdateRequestRow | null;
      incident: SupportIncidentRow | null;
    }
  | {
      accepted: false;
      reason: SupportRejectionReason;
      existingIncident?: SupportIncidentRow;
      rejectedWriteSurface?: string;
      closureReasons?: string[];
    };

export type SupportIncidentRecordResult =
  | {
      accepted: true;
      deduplicated: boolean;
      incident: SupportIncidentRow;
      closureReadiness: SupportClosureReadiness;
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
  claimIncidentUpdate(input: ClaimSupportIncidentUpdateInput): Promise<SupportIncidentRecordResult>;
  rejectIncidentUpdate(input: RejectSupportIncidentUpdateInput): Promise<void>;
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
    closureReadinessStatus: row['closureReadinessStatus'] as SupportClosureReadiness['status'],
    closureReadinessReasons: parseJson<string[]>(row['closureReadinessReasonsJson'], []),
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

const uniqueStrings = (values: readonly string[]): string[] =>
  Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
  ).sort();

const uniqueActions = (
  values: readonly SupportEvidenceBundle['actionRefs'][number][],
): SupportEvidenceBundle['actionRefs'] =>
  Array.from(new Map(values.map((action) => [action.ref, action])).values()).sort((left, right) =>
    left.ref.localeCompare(right.ref),
  );

const uniqueNotes = (
  values: readonly SupportEvidenceBundle['operatorNotes'][number][],
): SupportEvidenceBundle['operatorNotes'] =>
  Array.from(new Map(values.map((note) => [note.noteId, note])).values()).sort((left, right) =>
    left.noteId.localeCompare(right.noteId),
  );

const mergeIncidentBundle = (
  current: SupportIncidentRow,
  next: SupportEvidenceBundle,
  scalarFieldUpdates: UpdateSupportIncidentInput['scalarFieldUpdates'] = {},
): SupportEvidenceBundle => {
  const preserveTerminalClosure =
    scalarFieldUpdates.closureStatus && isSupportTerminalClosureStatus(current.closureStatus);
  const closureStatus = preserveTerminalClosure
    ? current.closureStatus
    : scalarFieldUpdates.closureStatus
      ? next.closureStatus
      : current.closureStatus;
  const residualRisk = scalarFieldUpdates.residualRisk ? next.residualRisk : current.residualRisk;
  const nextOwnerRef = scalarFieldUpdates.nextOwnerRef ? next.nextOwnerRef : current.nextOwnerRef;
  const closedAt = preserveTerminalClosure
    ? current.closedAt
    : scalarFieldUpdates.closureStatus
      ? isSupportTerminalClosureStatus(closureStatus)
        ? (current.closedAt ?? next.updatedAt)
        : null
      : current.closedAt;

  return supportEvidenceBundleSchema.parse({
    ...next,
    createdAt: current.createdAt,
    sourceRefs: uniqueStrings([...current.sourceRefs, ...next.sourceRefs]),
    reportRunRefs: uniqueStrings([...current.reportRunRefs, ...next.reportRunRefs]),
    releaseRefs: uniqueStrings([...current.releaseRefs, ...next.releaseRefs]),
    operatorEvidenceRefs: uniqueStrings([
      ...current.operatorEvidenceRefs,
      ...next.operatorEvidenceRefs,
    ]),
    actionRefs: uniqueActions([...current.actionRefs, ...next.actionRefs]),
    escalationRefs: uniqueStrings([...current.escalationRefs, ...next.escalationRefs]),
    closureCriteria: uniqueStrings([...current.closureCriteria, ...next.closureCriteria]),
    operatorNotes: uniqueNotes([...current.operatorNotes, ...next.operatorNotes]),
    closureStatus,
    residualRisk,
    nextOwnerRef,
    closedAt,
  });
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

  const getIncidentById = async (
    supportIncidentId: string,
    options: { forUpdate?: boolean } = {},
  ): Promise<SupportIncidentRow | null> => {
    const result = await db.query<QueryResultRow>(
      `select ${supportIncidentColumns}
       from ${supportIncidentsTable}
       where support_incident_id = $1
       ${options.forUpdate ? 'for update' : ''}`,
      [supportIncidentId],
    );

    return result.rows[0] ? normalizeSupportIncidentRow(result.rows[0]) : null;
  };

  const normalizeUpdateRequestRow = (row: QueryResultRow): UpdateRequestRow => ({
    supportIncidentId: String(row['supportIncidentId']),
    normalizedRequestHash: String(row['normalizedRequestHash']),
    status: row['status'] as UpdateRequestRow['status'],
    rejectionReason:
      typeof row['rejectionReason'] === 'string'
        ? (row['rejectionReason'] as SupportRejectionReason)
        : null,
    closureReasons: parseJson<string[]>(row['closureReasonsJson'], []),
  });

  const updateRequestColumns = `
    support_incident_id as "supportIncidentId",
    normalized_request_hash as "normalizedRequestHash",
    status,
    rejection_reason as "rejectionReason",
    closure_reasons_json as "closureReasonsJson"
  `;

  const selectUpdateRequest = async (
    requestId: string,
    options: { forUpdate?: boolean } = {},
  ): Promise<UpdateRequestRow | null> => {
    const result = await db.query<QueryResultRow>(
      `select ${updateRequestColumns}
       from ${supportIncidentUpdateRequestsTable}
       where request_id = $1
       ${options.forUpdate ? 'for update' : ''}`,
      [requestId],
    );

    return result.rows[0] ? normalizeUpdateRequestRow(result.rows[0]) : null;
  };

  const completeUpdateRequest = async (input: {
    requestId: string;
    status: UpdateRequestRow['status'];
    completedAt: string;
    rejectionReason?: SupportRejectionReason | null;
    closureReasons?: readonly string[];
  }): Promise<void> => {
    await db.query(
      `update ${supportIncidentUpdateRequestsTable}
       set status = $2,
           rejection_reason = $3,
           closure_reasons_json = $4::jsonb,
           completed_at = $5
       where request_id = $1`,
      [
        input.requestId,
        input.status,
        input.rejectionReason ?? null,
        JSON.stringify(input.closureReasons ?? []),
        input.completedAt,
      ],
    );
  };

  const interpretUpdateRequestReplay = async (
    replay: UpdateRequestRow | null,
    input: ClaimSupportIncidentUpdateInput,
  ): Promise<SupportIncidentRecordResult> => {
    const existing = replay ? await getIncidentById(replay.supportIncidentId) : null;
    if (
      !replay ||
      replay.normalizedRequestHash !== input.normalizedRequestHash ||
      replay.supportIncidentId !== input.supportIncidentId
    ) {
      return {
        accepted: false,
        reason: 'conflicting_request_id',
        ...(existing ? { existingIncident: existing } : {}),
      };
    }

    if (replay.status === 'pending') {
      return {
        accepted: false,
        reason: 'request_in_progress',
        ...(existing ? { existingIncident: existing } : {}),
      };
    }

    if (replay.status === 'rejected') {
      return {
        accepted: false,
        reason: replay.rejectionReason ?? 'conflicting_request_id',
        ...(existing ? { existingIncident: existing } : {}),
        ...(replay.closureReasons.length > 0 ? { closureReasons: replay.closureReasons } : {}),
      };
    }

    if (!existing) {
      return {
        accepted: false,
        reason: 'incident_missing',
      };
    }

    return {
      accepted: true,
      deduplicated: true,
      incident: existing,
      closureReadiness: {
        status: existing.closureReadinessStatus,
        reasons: existing.closureReadinessReasons,
      },
    };
  };

  const claimUpdateRequest = async (
    input: ClaimSupportIncidentUpdateInput,
  ): Promise<UpdateRequestClaimResult> => {
    const surfaces = ensureWriteSurfaces(input.requestedWriteSurfaces);
    if (!surfaces.accepted) {
      return {
        accepted: false,
        reason: 'foreign_owner_write_rejected',
        rejectedWriteSurface: surfaces.rejectedWriteSurface,
      };
    }

    await db.query('begin');
    try {
      const existing = await getIncidentById(input.supportIncidentId, { forUpdate: true });
      if (!existing) {
        await db.query('rollback');
        return {
          accepted: false,
          reason: 'incident_missing',
        };
      }

      const result = await db.query<QueryResultRow>(
        `insert into ${supportIncidentUpdateRequestsTable} (
           request_id,
           support_incident_id,
           normalized_request_hash,
           status,
           rejection_reason,
           closure_reasons_json,
           created_at,
           completed_at
         )
         values ($1, $2, $3, 'pending', null, '[]'::jsonb, $4, null)
         on conflict (request_id) do nothing
         returning request_id`,
        [input.requestId, input.supportIncidentId, input.normalizedRequestHash, input.createdAt],
      );

      if (result.rows[0]) {
        await db.query('commit');
        return {
          accepted: true,
          inserted: true,
          incident: existing,
        };
      }

      const replay = await selectUpdateRequest(input.requestId, { forUpdate: true });
      await db.query('commit');
      return {
        accepted: true,
        inserted: false,
        replay: replay as UpdateRequestRow,
        incident: replay ? await getIncidentById(replay.supportIncidentId) : null,
      };
    } catch (error) {
      await db.query('rollback');
      throw error;
    }
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
	           closure_readiness_status,
	           closure_readiness_reasons_json,
	           residual_risk,
	           next_owner_ref,
           created_at,
           updated_at,
           closed_at
         )
	         values (
	           $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb,
	           $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14, $15, $16::jsonb,
	           $17, $18, $19, $20, $21
	         )
	         on conflict (request_id) do nothing
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
          readiness.status,
          JSON.stringify(readiness.reasons),
          bundle.residualRisk,
          bundle.nextOwnerRef,
          bundle.createdAt,
          bundle.updatedAt,
          bundle.closedAt,
        ],
      );

      if (!result.rows[0]) {
        const existing = await getIncidentByRequestId(requestId);
        if (existing?.normalizedRequestHash !== normalizedRequestHash) {
          return {
            accepted: false,
            reason: 'conflicting_request_id',
            ...(existing ? { existingIncident: existing } : {}),
          };
        }

        if (existing) {
          return {
            accepted: true,
            deduplicated: true,
            incident: existing,
            closureReadiness: {
              status: existing.closureReadinessStatus,
              reasons: existing.closureReadinessReasons,
            },
          };
        }

        return {
          accepted: false,
          reason: 'incident_missing',
        };
      }

      const incident = normalizeSupportIncidentRow(result.rows[0] as QueryResultRow);

      return {
        accepted: true,
        deduplicated: false,
        incident,
        closureReadiness: readiness,
      };
    },

    async claimIncidentUpdate(input) {
      const claim = await claimUpdateRequest(input);
      if (!claim.accepted) {
        return claim;
      }

      if (!claim.inserted) {
        return interpretUpdateRequestReplay(claim.replay, input);
      }

      return {
        accepted: true,
        deduplicated: false,
        incident: claim.incident,
        closureReadiness: {
          status: claim.incident.closureReadinessStatus,
          reasons: claim.incident.closureReadinessReasons,
        },
      };
    },

    async rejectIncidentUpdate(input) {
      const surfaces = ensureWriteSurfaces(input.requestedWriteSurfaces);
      if (!surfaces.accepted) {
        throw new Error(
          `support update rejection attempted foreign owner write: ${surfaces.rejectedWriteSurface}`,
        );
      }

      await db.query('begin');
      try {
        const claimed = await selectUpdateRequest(input.requestId, { forUpdate: true });
        if (
          !claimed ||
          claimed.normalizedRequestHash !== input.normalizedRequestHash ||
          claimed.supportIncidentId !== input.supportIncidentId ||
          claimed.status !== 'pending'
        ) {
          await db.query('commit');
          return;
        }

        await completeUpdateRequest({
          requestId: input.requestId,
          status: 'rejected',
          rejectionReason: input.reason ?? 'request_failed',
          closureReasons: input.closureReasons ?? [],
          completedAt: input.completedAt,
        });
        await db.query('commit');
      } catch (error) {
        await db.query('rollback');
        throw error;
      }
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
        requestClaimed,
        scalarFieldUpdates,
        ...bundleInput
      } = input;
      void requestedWriteSurfaces;
      const bundle = supportEvidenceBundleSchema.parse(bundleInput);

      await db.query('begin');
      try {
        if (requestClaimed) {
          const claimed = await selectUpdateRequest(requestId, { forUpdate: true });
          if (
            !claimed ||
            claimed.normalizedRequestHash !== normalizedRequestHash ||
            claimed.supportIncidentId !== bundle.supportIncidentId
          ) {
            const existing = claimed ? await getIncidentById(claimed.supportIncidentId) : null;
            await db.query('commit');
            return {
              accepted: false,
              reason: 'conflicting_request_id',
              ...(existing ? { existingIncident: existing } : {}),
            };
          }

          if (claimed.status !== 'pending') {
            await db.query('commit');
            return interpretUpdateRequestReplay(claimed, {
              supportIncidentId: bundle.supportIncidentId,
              requestId,
              normalizedRequestHash,
              createdAt: bundle.updatedAt,
            });
          }
        } else {
          const updateRequest = await db.query<QueryResultRow>(
            `insert into ${supportIncidentUpdateRequestsTable} (
               request_id,
               support_incident_id,
               normalized_request_hash,
               status,
               rejection_reason,
               closure_reasons_json,
               created_at,
               completed_at
             )
             values ($1, $2, $3, 'pending', null, '[]'::jsonb, $4, null)
             on conflict (request_id) do nothing
             returning request_id`,
            [requestId, bundle.supportIncidentId, normalizedRequestHash, bundle.updatedAt],
          );

          if (!updateRequest.rows[0]) {
            const replay = await selectUpdateRequest(requestId);
            const replayResult = await interpretUpdateRequestReplay(replay, {
              supportIncidentId: bundle.supportIncidentId,
              requestId,
              normalizedRequestHash,
              createdAt: bundle.updatedAt,
            });
            await db.query('commit');
            return replayResult;
          }
        }

        const existing = await getIncidentById(bundle.supportIncidentId, { forUpdate: true });
        if (!existing) {
          await completeUpdateRequest({
            requestId,
            status: 'rejected',
            rejectionReason: 'incident_missing',
            completedAt: bundle.updatedAt,
          });
          await db.query('commit');
          return {
            accepted: false,
            reason: 'incident_missing',
          };
        }

        const mergedBundle = mergeIncidentBundle(existing, bundle, scalarFieldUpdates);
        const readiness = evaluateSupportClosureReadiness({
          bundle: mergedBundle,
          ...(canonicalEvidenceStates ? { canonicalEvidenceStates } : {}),
        });
        if (readiness.status === 'blocked') {
          await completeUpdateRequest({
            requestId,
            status: 'rejected',
            rejectionReason: 'closure_blocked',
            closureReasons: readiness.reasons,
            completedAt: bundle.updatedAt,
          });
          await db.query('commit');
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
	               closure_readiness_status = $11,
	               closure_readiness_reasons_json = $12::jsonb,
	               residual_risk = $13,
	               next_owner_ref = $14,
	               updated_at = $15,
	               closed_at = $16
	           where support_incident_id = $1
	           returning ${supportIncidentColumns}`,
          [
            mergedBundle.supportIncidentId,
            JSON.stringify(mergedBundle.sourceRefs),
            JSON.stringify(mergedBundle.reportRunRefs),
            JSON.stringify(mergedBundle.releaseRefs),
            JSON.stringify(mergedBundle.operatorEvidenceRefs),
            JSON.stringify(mergedBundle.actionRefs),
            JSON.stringify(mergedBundle.escalationRefs),
            JSON.stringify(mergedBundle.closureCriteria),
            JSON.stringify(mergedBundle.operatorNotes),
            mergedBundle.closureStatus,
            readiness.status,
            JSON.stringify(readiness.reasons),
            mergedBundle.residualRisk,
            mergedBundle.nextOwnerRef,
            mergedBundle.updatedAt,
            mergedBundle.closedAt,
          ],
        );
        await completeUpdateRequest({
          requestId,
          status: 'applied',
          completedAt: bundle.updatedAt,
        });
        await db.query('commit');
        const incident = normalizeSupportIncidentRow(result.rows[0] as QueryResultRow);

        return {
          accepted: true,
          deduplicated: false,
          incident,
          closureReadiness: readiness,
        };
      } catch (error) {
        await db.query('rollback');
        throw error;
      }
    },

    async getIncident(supportIncidentId) {
      return getIncidentById(supportIncidentId);
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
