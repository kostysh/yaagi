import type { Client } from 'pg';
import {
  BODY_CHANGE_EVENT_KIND,
  BODY_CHANGE_STATUS,
  type BodyChangeEventKind,
  type BodyChangeRequestedByOwner,
  type BodyChangeScopeKind,
  type BodyChangeStatus,
} from '@yaagi/contracts/body-evolution';
import { RUNTIME_SCHEMA } from './runtime.ts';

export type BodyEvolutionDbExecutor = Pick<Client, 'query'>;

const runtimeSchemaTable = (table: string): string => `${RUNTIME_SCHEMA}.${table}`;
const proposalsTable = runtimeSchemaTable('code_change_proposals');
const eventsTable = runtimeSchemaTable('body_change_events');
const snapshotsTable = runtimeSchemaTable('stable_snapshots');

const asUtcIso = (column: string, alias: string): string =>
  `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "${alias}"`;

const transaction = async <T>(db: BodyEvolutionDbExecutor, run: () => Promise<T>): Promise<T> => {
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

const toStringRecord = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
};

export type BodyChangeProposalRow = {
  proposalId: string;
  requestId: string;
  normalizedRequestHash: string;
  requestedByOwner: BodyChangeRequestedByOwner;
  governorProposalId: string | null;
  governorDecisionRef: string | null;
  ownerOverrideEvidenceRef: string | null;
  branchName: string;
  worktreePath: string;
  candidateCommitSha: string | null;
  stableSnapshotId: string | null;
  status: BodyChangeStatus;
  scopeKind: BodyChangeScopeKind;
  requiredEvalSuite: string;
  targetPathsJson: string[];
  rollbackPlanRef: string;
  evidenceRefsJson: string[];
  createdAt: string;
  updatedAt: string;
};

export type BodyChangeEventRow = {
  eventId: string;
  proposalId: string;
  eventKind: BodyChangeEventKind;
  status: BodyChangeStatus;
  evidenceRefsJson: string[];
  payloadJson: Record<string, unknown>;
  createdAt: string;
};

export type BodyStableSnapshotRow = {
  snapshotId: string;
  proposalId: string;
  gitTag: string;
  schemaVersion: string;
  modelProfileMapJson: Record<string, string>;
  criticalConfigHash: string;
  evalSummaryJson: Record<string, unknown>;
  manifestHash: string;
  manifestPath: string;
  createdAt: string;
};

export type RecordBodyChangeProposalInput = {
  proposalId: string;
  eventId: string;
  requestId: string;
  normalizedRequestHash: string;
  requestedByOwner: BodyChangeRequestedByOwner;
  governorProposalId: string | null;
  governorDecisionRef: string | null;
  ownerOverrideEvidenceRef: string | null;
  branchName: string;
  worktreePath: string;
  scopeKind: BodyChangeScopeKind;
  requiredEvalSuite: string;
  targetPaths: string[];
  rollbackPlanRef: string;
  evidenceRefs: string[];
  createdAt: string;
  payloadJson?: Record<string, unknown>;
  status?: Extract<BodyChangeStatus, typeof BODY_CHANGE_STATUS.REQUESTED>;
};

export type RecordBodyChangeProposalResult =
  | {
      accepted: true;
      deduplicated: boolean;
      proposal: BodyChangeProposalRow;
      event: BodyChangeEventRow | null;
    }
  | {
      accepted: false;
      reason: 'request_hash_conflict';
      proposal: BodyChangeProposalRow;
    };

export type RecordBodyChangeLifecycleEventInput = {
  proposalId: string;
  eventId: string;
  eventKind: BodyChangeEventKind;
  status: BodyChangeStatus;
  evidenceRefs: string[];
  createdAt: string;
  payloadJson?: Record<string, unknown>;
  expectedCurrentStatuses?: BodyChangeStatus[];
  candidateCommitSha?: string | null;
  stableSnapshotId?: string | null;
};

export type RecordBodyChangeLifecycleEventResult =
  | {
      accepted: true;
      proposal: BodyChangeProposalRow;
      event: BodyChangeEventRow;
    }
  | {
      accepted: false;
      reason: 'proposal_not_found' | 'invalid_status';
      proposal?: BodyChangeProposalRow;
    };

export type PublishBodyStableSnapshotInput = {
  snapshotId: string;
  proposalId: string;
  eventId: string;
  gitTag: string;
  schemaVersion: string;
  modelProfileMapJson: Record<string, string>;
  criticalConfigHash: string;
  evalSummaryJson: Record<string, unknown>;
  manifestHash: string;
  manifestPath: string;
  evidenceRefs: string[];
  createdAt: string;
  payloadJson?: Record<string, unknown>;
  expectedCurrentStatuses?: BodyChangeStatus[];
};

export type PublishBodyStableSnapshotResult =
  | {
      accepted: true;
      deduplicated: boolean;
      proposal: BodyChangeProposalRow;
      event: BodyChangeEventRow | null;
      snapshot: BodyStableSnapshotRow;
    }
  | {
      accepted: false;
      reason: 'proposal_not_found' | 'invalid_status' | 'snapshot_conflict';
      proposal?: BodyChangeProposalRow;
      snapshot?: BodyStableSnapshotRow;
    };

export type BodyEvolutionStore = {
  recordProposal(input: RecordBodyChangeProposalInput): Promise<RecordBodyChangeProposalResult>;
  recordLifecycleEvent(
    input: RecordBodyChangeLifecycleEventInput,
  ): Promise<RecordBodyChangeLifecycleEventResult>;
  publishStableSnapshot(
    input: PublishBodyStableSnapshotInput,
  ): Promise<PublishBodyStableSnapshotResult>;
  getProposal(proposalId: string): Promise<BodyChangeProposalRow | null>;
  getProposalByRequestId(requestId: string): Promise<BodyChangeProposalRow | null>;
  getProposalByOwnerOverrideEvidenceRef(
    ownerOverrideEvidenceRef: string,
  ): Promise<BodyChangeProposalRow | null>;
  getStableSnapshot(snapshotId: string): Promise<BodyStableSnapshotRow | null>;
  getStableSnapshotByProposalId(proposalId: string): Promise<BodyStableSnapshotRow | null>;
  listProposalEvents(input: { proposalId: string }): Promise<BodyChangeEventRow[]>;
};

const proposalColumns = `
  proposal_id as "proposalId",
  request_id as "requestId",
  normalized_request_hash as "normalizedRequestHash",
  requested_by_owner as "requestedByOwner",
  governor_proposal_id as "governorProposalId",
  governor_decision_ref as "governorDecisionRef",
  owner_override_evidence_ref as "ownerOverrideEvidenceRef",
  branch_name as "branchName",
  worktree_path as "worktreePath",
  candidate_commit_sha as "candidateCommitSha",
  stable_snapshot_id as "stableSnapshotId",
  status,
  scope_kind as "scopeKind",
  required_eval_suite as "requiredEvalSuite",
  target_paths_json as "targetPathsJson",
  rollback_plan_ref as "rollbackPlanRef",
  evidence_refs_json as "evidenceRefsJson",
  ${asUtcIso('created_at', 'createdAt')},
  ${asUtcIso('updated_at', 'updatedAt')}
`;

const eventColumns = `
  event_id as "eventId",
  proposal_id as "proposalId",
  event_kind as "eventKind",
  status,
  evidence_refs_json as "evidenceRefsJson",
  payload_json as "payloadJson",
  ${asUtcIso('created_at', 'createdAt')}
`;

const snapshotColumns = `
  snapshot_id as "snapshotId",
  proposal_id as "proposalId",
  git_tag as "gitTag",
  schema_version as "schemaVersion",
  model_profile_map_json as "modelProfileMapJson",
  critical_config_hash as "criticalConfigHash",
  eval_summary_json as "evalSummaryJson",
  manifest_hash as "manifestHash",
  manifest_path as "manifestPath",
  ${asUtcIso('created_at', 'createdAt')}
`;

const mapProposalRow = (row: Record<string, unknown>): BodyChangeProposalRow => ({
  proposalId: String(row['proposalId']),
  requestId: String(row['requestId']),
  normalizedRequestHash: String(row['normalizedRequestHash']),
  requestedByOwner: row['requestedByOwner'] as BodyChangeRequestedByOwner,
  governorProposalId:
    typeof row['governorProposalId'] === 'string' ? row['governorProposalId'] : null,
  governorDecisionRef:
    typeof row['governorDecisionRef'] === 'string' ? row['governorDecisionRef'] : null,
  ownerOverrideEvidenceRef:
    typeof row['ownerOverrideEvidenceRef'] === 'string' ? row['ownerOverrideEvidenceRef'] : null,
  branchName: String(row['branchName']),
  worktreePath: String(row['worktreePath']),
  candidateCommitSha:
    typeof row['candidateCommitSha'] === 'string' ? row['candidateCommitSha'] : null,
  stableSnapshotId: typeof row['stableSnapshotId'] === 'string' ? row['stableSnapshotId'] : null,
  status: row['status'] as BodyChangeStatus,
  scopeKind: row['scopeKind'] as BodyChangeScopeKind,
  requiredEvalSuite: String(row['requiredEvalSuite']),
  targetPathsJson: toStringArray(row['targetPathsJson']),
  rollbackPlanRef: String(row['rollbackPlanRef']),
  evidenceRefsJson: toStringArray(row['evidenceRefsJson']),
  createdAt: String(row['createdAt']),
  updatedAt: String(row['updatedAt']),
});

const mapEventRow = (row: Record<string, unknown>): BodyChangeEventRow => ({
  eventId: String(row['eventId']),
  proposalId: String(row['proposalId']),
  eventKind: row['eventKind'] as BodyChangeEventKind,
  status: row['status'] as BodyChangeStatus,
  evidenceRefsJson: toStringArray(row['evidenceRefsJson']),
  payloadJson: toRecord(row['payloadJson']),
  createdAt: String(row['createdAt']),
});

const mapSnapshotRow = (row: Record<string, unknown>): BodyStableSnapshotRow => ({
  snapshotId: String(row['snapshotId']),
  proposalId: String(row['proposalId']),
  gitTag: String(row['gitTag']),
  schemaVersion: String(row['schemaVersion']),
  modelProfileMapJson: toStringRecord(row['modelProfileMapJson']),
  criticalConfigHash: String(row['criticalConfigHash']),
  evalSummaryJson: toRecord(row['evalSummaryJson']),
  manifestHash: String(row['manifestHash']),
  manifestPath: String(row['manifestPath']),
  createdAt: String(row['createdAt']),
});

export const createBodyEvolutionStore = (db: BodyEvolutionDbExecutor): BodyEvolutionStore => {
  const getProposal = async (proposalId: string): Promise<BodyChangeProposalRow | null> => {
    const result = await db.query(
      `
        select ${proposalColumns}
        from ${proposalsTable}
        where proposal_id = $1
      `,
      [proposalId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapProposalRow(row) : null;
  };

  const getProposalForUpdate = async (
    proposalId: string,
  ): Promise<BodyChangeProposalRow | null> => {
    const result = await db.query(
      `
        select ${proposalColumns}
        from ${proposalsTable}
        where proposal_id = $1
        for update
      `,
      [proposalId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapProposalRow(row) : null;
  };

  const getProposalByRequestId = async (
    requestId: string,
  ): Promise<BodyChangeProposalRow | null> => {
    const result = await db.query(
      `
        select ${proposalColumns}
        from ${proposalsTable}
        where request_id = $1
      `,
      [requestId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapProposalRow(row) : null;
  };

  const getProposalByOwnerOverrideEvidenceRef = async (
    ownerOverrideEvidenceRef: string,
  ): Promise<BodyChangeProposalRow | null> => {
    const result = await db.query(
      `
        select ${proposalColumns}
        from ${proposalsTable}
        where owner_override_evidence_ref = $1
      `,
      [ownerOverrideEvidenceRef],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapProposalRow(row) : null;
  };

  const listProposalEvents = async (input: {
    proposalId: string;
  }): Promise<BodyChangeEventRow[]> => {
    const result = await db.query(
      `
        select ${eventColumns}
        from ${eventsTable}
        where proposal_id = $1
        order by created_at asc, event_id asc
      `,
      [input.proposalId],
    );
    return result.rows.map((row) => mapEventRow(row as Record<string, unknown>));
  };

  const getStableSnapshot = async (snapshotId: string): Promise<BodyStableSnapshotRow | null> => {
    const result = await db.query(
      `
        select ${snapshotColumns}
        from ${snapshotsTable}
        where snapshot_id = $1
      `,
      [snapshotId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapSnapshotRow(row) : null;
  };

  const getStableSnapshotByProposalId = async (
    proposalId: string,
  ): Promise<BodyStableSnapshotRow | null> => {
    const result = await db.query(
      `
        select ${snapshotColumns}
        from ${snapshotsTable}
        where proposal_id = $1
      `,
      [proposalId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapSnapshotRow(row) : null;
  };

  const updateProposalLifecycle = async (input: {
    proposalId: string;
    status: BodyChangeStatus;
    candidateCommitSha: string | null;
    stableSnapshotId: string | null;
    updatedAt: string;
  }): Promise<BodyChangeProposalRow> => {
    const result = await db.query(
      `
        update ${proposalsTable}
        set status = $2,
            candidate_commit_sha = $3,
            stable_snapshot_id = $4,
            updated_at = $5
        where proposal_id = $1
        returning ${proposalColumns}
      `,
      [
        input.proposalId,
        input.status,
        input.candidateCommitSha,
        input.stableSnapshotId,
        input.updatedAt,
      ],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error(`failed to update body change proposal ${input.proposalId}`);
    }
    return mapProposalRow(row);
  };

  const insertLifecycleEvent = async (input: {
    eventId: string;
    proposalId: string;
    eventKind: BodyChangeEventKind;
    status: BodyChangeStatus;
    evidenceRefs: string[];
    payloadJson: Record<string, unknown>;
    createdAt: string;
  }): Promise<BodyChangeEventRow> => {
    const result = await db.query(
      `
        insert into ${eventsTable} (
          event_id,
          proposal_id,
          event_kind,
          status,
          evidence_refs_json,
          payload_json,
          created_at
        )
        values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
        returning ${eventColumns}
      `,
      [
        input.eventId,
        input.proposalId,
        input.eventKind,
        input.status,
        JSON.stringify(input.evidenceRefs),
        JSON.stringify(input.payloadJson),
        input.createdAt,
      ],
    );
    return mapEventRow(result.rows[0] as Record<string, unknown>);
  };

  return {
    async recordProposal(input) {
      return await transaction(db, async () => {
        const existing = await getProposalByRequestId(input.requestId);
        if (existing) {
          if (existing.normalizedRequestHash === input.normalizedRequestHash) {
            return {
              accepted: true,
              deduplicated: true,
              proposal: existing,
              event: null,
            };
          }

          return {
            accepted: false,
            reason: 'request_hash_conflict',
            proposal: existing,
          };
        }

        const proposalResult = await db.query(
          `
          insert into ${proposalsTable} (
            proposal_id,
            request_id,
            normalized_request_hash,
            requested_by_owner,
            governor_proposal_id,
            governor_decision_ref,
            owner_override_evidence_ref,
            branch_name,
            worktree_path,
            status,
            scope_kind,
            required_eval_suite,
            target_paths_json,
            rollback_plan_ref,
            evidence_refs_json,
            created_at,
            updated_at
          )
          values (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13::jsonb, $14, $15::jsonb, $16, $16
          )
          on conflict (request_id) do nothing
          returning ${proposalColumns}
        `,
          [
            input.proposalId,
            input.requestId,
            input.normalizedRequestHash,
            input.requestedByOwner,
            input.governorProposalId,
            input.governorDecisionRef,
            input.ownerOverrideEvidenceRef,
            input.branchName,
            input.worktreePath,
            input.status ?? BODY_CHANGE_STATUS.REQUESTED,
            input.scopeKind,
            input.requiredEvalSuite,
            JSON.stringify(input.targetPaths),
            input.rollbackPlanRef,
            JSON.stringify(input.evidenceRefs),
            input.createdAt,
          ],
        );
        const insertedRow = proposalResult.rows[0] as Record<string, unknown> | undefined;
        if (!insertedRow) {
          const existingAfterConflict = await getProposalByRequestId(input.requestId);
          if (!existingAfterConflict) {
            throw new Error(
              `proposal insert lost race for request_id=${input.requestId}, but no persisted row was found`,
            );
          }

          if (existingAfterConflict.normalizedRequestHash === input.normalizedRequestHash) {
            return {
              accepted: true,
              deduplicated: true,
              proposal: existingAfterConflict,
              event: null,
            };
          }

          return {
            accepted: false,
            reason: 'request_hash_conflict',
            proposal: existingAfterConflict,
          };
        }

        const proposal = mapProposalRow(insertedRow);
        const eventResult = await db.query(
          `
          insert into ${eventsTable} (
            event_id,
            proposal_id,
            event_kind,
            status,
            evidence_refs_json,
            payload_json,
            created_at
          )
          values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
          returning ${eventColumns}
        `,
          [
            input.eventId,
            proposal.proposalId,
            BODY_CHANGE_EVENT_KIND.PROPOSAL_RECORDED,
            proposal.status,
            JSON.stringify(input.evidenceRefs),
            JSON.stringify(input.payloadJson ?? {}),
            input.createdAt,
          ],
        );

        return {
          accepted: true,
          deduplicated: false,
          proposal,
          event: mapEventRow(eventResult.rows[0] as Record<string, unknown>),
        };
      });
    },

    async recordLifecycleEvent(input) {
      return await transaction(db, async () => {
        const proposal = await getProposalForUpdate(input.proposalId);
        if (!proposal) {
          return {
            accepted: false,
            reason: 'proposal_not_found',
          };
        }

        if (
          input.expectedCurrentStatuses &&
          input.expectedCurrentStatuses.length > 0 &&
          !input.expectedCurrentStatuses.includes(proposal.status)
        ) {
          return {
            accepted: false,
            reason: 'invalid_status',
            proposal,
          };
        }

        const updatedProposal = await updateProposalLifecycle({
          proposalId: proposal.proposalId,
          status: input.status,
          candidateCommitSha:
            input.candidateCommitSha === undefined
              ? proposal.candidateCommitSha
              : input.candidateCommitSha,
          stableSnapshotId:
            input.stableSnapshotId === undefined
              ? proposal.stableSnapshotId
              : input.stableSnapshotId,
          updatedAt: input.createdAt,
        });
        const event = await insertLifecycleEvent({
          eventId: input.eventId,
          proposalId: proposal.proposalId,
          eventKind: input.eventKind,
          status: input.status,
          evidenceRefs: input.evidenceRefs,
          payloadJson: input.payloadJson ?? {},
          createdAt: input.createdAt,
        });

        return {
          accepted: true,
          proposal: updatedProposal,
          event,
        };
      });
    },

    async publishStableSnapshot(input) {
      return await transaction(db, async () => {
        const proposal = await getProposalForUpdate(input.proposalId);
        if (!proposal) {
          return {
            accepted: false,
            reason: 'proposal_not_found',
          };
        }

        const existingSnapshot = await getStableSnapshotByProposalId(proposal.proposalId);
        if (existingSnapshot) {
          if (proposal.status === BODY_CHANGE_STATUS.ROLLED_BACK) {
            return {
              accepted: false,
              reason: 'invalid_status',
              proposal,
              snapshot: existingSnapshot,
            };
          }

          if (
            existingSnapshot.snapshotId === input.snapshotId &&
            existingSnapshot.manifestHash === input.manifestHash
          ) {
            const updatedProposal =
              proposal.status === BODY_CHANGE_STATUS.SNAPSHOT_READY &&
              proposal.stableSnapshotId === existingSnapshot.snapshotId
                ? proposal
                : await updateProposalLifecycle({
                    proposalId: proposal.proposalId,
                    status: BODY_CHANGE_STATUS.SNAPSHOT_READY,
                    candidateCommitSha: proposal.candidateCommitSha,
                    stableSnapshotId: existingSnapshot.snapshotId,
                    updatedAt: input.createdAt,
                  });

            return {
              accepted: true,
              deduplicated: true,
              proposal: updatedProposal,
              event: null,
              snapshot: existingSnapshot,
            };
          }

          return {
            accepted: false,
            reason: 'snapshot_conflict',
            proposal,
            snapshot: existingSnapshot,
          };
        }

        if (
          input.expectedCurrentStatuses &&
          input.expectedCurrentStatuses.length > 0 &&
          !input.expectedCurrentStatuses.includes(proposal.status)
        ) {
          return {
            accepted: false,
            reason: 'invalid_status',
            proposal,
          };
        }

        const snapshotResult = await db.query(
          `
            insert into ${snapshotsTable} (
              snapshot_id,
              proposal_id,
              git_tag,
              schema_version,
              model_profile_map_json,
              critical_config_hash,
              eval_summary_json,
              manifest_hash,
              manifest_path,
              created_at
            )
            values ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8, $9, $10)
            returning ${snapshotColumns}
          `,
          [
            input.snapshotId,
            input.proposalId,
            input.gitTag,
            input.schemaVersion,
            JSON.stringify(input.modelProfileMapJson),
            input.criticalConfigHash,
            JSON.stringify(input.evalSummaryJson),
            input.manifestHash,
            input.manifestPath,
            input.createdAt,
          ],
        );
        const snapshotRow = snapshotResult.rows[0] as Record<string, unknown> | undefined;
        if (!snapshotRow) {
          throw new Error(`failed to insert stable snapshot ${input.snapshotId}`);
        }
        const snapshot = mapSnapshotRow(snapshotRow);
        const updatedProposal = await updateProposalLifecycle({
          proposalId: proposal.proposalId,
          status: BODY_CHANGE_STATUS.SNAPSHOT_READY,
          candidateCommitSha: proposal.candidateCommitSha,
          stableSnapshotId: snapshot.snapshotId,
          updatedAt: input.createdAt,
        });
        const event = await insertLifecycleEvent({
          eventId: input.eventId,
          proposalId: proposal.proposalId,
          eventKind: BODY_CHANGE_EVENT_KIND.STABLE_SNAPSHOT_PUBLISHED,
          status: BODY_CHANGE_STATUS.SNAPSHOT_READY,
          evidenceRefs: input.evidenceRefs,
          payloadJson: input.payloadJson ?? {},
          createdAt: input.createdAt,
        });

        return {
          accepted: true,
          deduplicated: false,
          proposal: updatedProposal,
          event,
          snapshot,
        };
      });
    },

    getProposal,
    getProposalByRequestId,
    getProposalByOwnerOverrideEvidenceRef,
    getStableSnapshot,
    getStableSnapshotByProposalId,
    listProposalEvents,
  };
};
