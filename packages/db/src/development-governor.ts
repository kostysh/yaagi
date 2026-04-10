import type { Client } from 'pg';
import {
  DEVELOPMENT_FREEZE_STATE,
  DEVELOPMENT_GOVERNOR_LEDGER_ENTRY_KIND,
  DEVELOPMENT_PROPOSAL_DECISION_KIND,
  DEVELOPMENT_PROPOSAL_STATE,
  type DevelopmentFreezeState,
  type DevelopmentFreezeTriggerKind,
  type DevelopmentGovernorLedgerEntryKind,
  type DevelopmentGovernorOriginSurface,
  type DevelopmentProposalDecisionKind,
  type DevelopmentProposalKind,
  type DevelopmentProposalState,
} from '@yaagi/contracts/governor';
import {
  DEFAULT_RUNTIME_AGENT_ID,
  RUNTIME_SCHEMA,
  setRuntimeDevelopmentFreeze,
} from './runtime.ts';

export type DevelopmentGovernorDbExecutor = Pick<Client, 'query'>;

const runtimeSchemaTable = (table: string): string => `${RUNTIME_SCHEMA}.${table}`;
const freezesTable = runtimeSchemaTable('development_freezes');
const proposalsTable = runtimeSchemaTable('development_proposals');
const proposalDecisionsTable = runtimeSchemaTable('development_proposal_decisions');
const ledgerTable = runtimeSchemaTable('development_ledger');

const asUtcIso = (column: string, alias: string): string =>
  `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "${alias}"`;

const transaction = async <T>(
  db: DevelopmentGovernorDbExecutor,
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

  throw new Error(`development governor row field ${field} must be a string or Date timestamp`);
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

export type DevelopmentFreezeRow = {
  freezeId: string;
  state: DevelopmentFreezeState;
  triggerKind: DevelopmentFreezeTriggerKind;
  originSurface: DevelopmentGovernorOriginSurface;
  requestId: string;
  normalizedRequestHash: string;
  reason: string;
  requestedBy: string;
  evidenceRefsJson: string[];
  createdAt: string;
};

export type DevelopmentLedgerRow = {
  ledgerId: string;
  entryKind: DevelopmentGovernorLedgerEntryKind;
  originSurface: DevelopmentGovernorOriginSurface;
  requestId: string;
  freezeId: string | null;
  proposalId: string | null;
  decisionId: string | null;
  evidenceRefsJson: string[];
  payloadJson: Record<string, unknown>;
  createdAt: string;
};

export type DevelopmentProposalRow = {
  proposalId: string;
  proposalKind: DevelopmentProposalKind;
  state: DevelopmentProposalState;
  originSurface: DevelopmentGovernorOriginSurface;
  requestId: string;
  normalizedRequestHash: string;
  submitterOwner: string;
  problemSignature: string;
  summary: string;
  rollbackPlanRef: string | null;
  targetRef: string | null;
  evidenceRefsJson: string[];
  payloadJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type DevelopmentProposalDecisionRow = {
  decisionId: string;
  proposalId: string;
  decisionKind: DevelopmentProposalDecisionKind;
  decisionOrigin: DevelopmentGovernorOriginSurface;
  originSurface: DevelopmentGovernorOriginSurface;
  requestId: string;
  normalizedRequestHash: string;
  rationale: string;
  evidenceRefsJson: string[];
  createdAt: string;
};

export type FreezeDevelopmentInput = {
  freezeId: string;
  ledgerId: string;
  triggerKind: DevelopmentFreezeTriggerKind;
  originSurface: DevelopmentGovernorOriginSurface;
  requestId: string;
  normalizedRequestHash: string;
  reason: string;
  requestedBy: string;
  evidenceRefs: string[];
  createdAt: string;
  payloadJson?: Record<string, unknown>;
};

export type FreezeDevelopmentResult =
  | {
      accepted: true;
      deduplicated: boolean;
      freeze: DevelopmentFreezeRow;
      ledgerEntry: DevelopmentLedgerRow | null;
    }
  | {
      accepted: false;
      reason: 'conflicting_request_id';
      freeze: DevelopmentFreezeRow;
    };

export type SubmitDevelopmentProposalInput = {
  proposalId: string;
  ledgerId: string;
  proposalKind: DevelopmentProposalKind;
  originSurface: DevelopmentGovernorOriginSurface;
  requestId: string;
  normalizedRequestHash: string;
  submitterOwner: string;
  problemSignature: string;
  summary: string;
  rollbackPlanRef: string | null;
  targetRef: string | null;
  evidenceRefs: string[];
  createdAt: string;
  payloadJson?: Record<string, unknown>;
};

export type SubmitDevelopmentProposalResult =
  | {
      accepted: true;
      deduplicated: boolean;
      proposal: DevelopmentProposalRow;
      ledgerEntry: DevelopmentLedgerRow | null;
    }
  | {
      accepted: false;
      reason: 'conflicting_request_id';
      proposal: DevelopmentProposalRow;
    }
  | {
      accepted: false;
      reason: 'development_frozen';
      freeze: DevelopmentFreezeRow;
    };

export type RecordDevelopmentProposalDecisionInput = {
  decisionId: string;
  ledgerId: string;
  proposalId: string;
  decisionKind: DevelopmentProposalDecisionKind;
  decisionOrigin: DevelopmentGovernorOriginSurface;
  originSurface: DevelopmentGovernorOriginSurface;
  requestId: string;
  normalizedRequestHash: string;
  rationale: string;
  evidenceRefs: string[];
  createdAt: string;
  payloadJson?: Record<string, unknown>;
};

export type RecordDevelopmentProposalDecisionResult =
  | {
      accepted: true;
      deduplicated: boolean;
      proposal: DevelopmentProposalRow;
      decision: DevelopmentProposalDecisionRow;
      ledgerEntry: DevelopmentLedgerRow | null;
    }
  | {
      accepted: false;
      reason: 'conflicting_request_id';
      decision: DevelopmentProposalDecisionRow;
    }
  | {
      accepted: false;
      reason: 'proposal_not_found' | 'invalid_state_transition';
      proposal?: DevelopmentProposalRow;
    };

export type DevelopmentGovernorStore = {
  freezeDevelopment(input: FreezeDevelopmentInput): Promise<FreezeDevelopmentResult>;
  submitDevelopmentProposal(
    input: SubmitDevelopmentProposalInput,
  ): Promise<SubmitDevelopmentProposalResult>;
  recordProposalDecision(
    input: RecordDevelopmentProposalDecisionInput,
  ): Promise<RecordDevelopmentProposalDecisionResult>;
  loadActiveFreeze(): Promise<DevelopmentFreezeRow | null>;
};

const freezeColumns = `
  freeze_id as "freezeId",
  state,
  trigger_kind as "triggerKind",
  origin_surface as "originSurface",
  request_id as "requestId",
  normalized_request_hash as "normalizedRequestHash",
  reason,
  requested_by as "requestedBy",
  evidence_refs_json as "evidenceRefsJson",
  ${asUtcIso('created_at', 'createdAt')}
`;

const ledgerColumns = `
  ledger_id as "ledgerId",
  entry_kind as "entryKind",
  origin_surface as "originSurface",
  request_id as "requestId",
  freeze_id as "freezeId",
  proposal_id as "proposalId",
  decision_id as "decisionId",
  evidence_refs_json as "evidenceRefsJson",
  payload_json as "payloadJson",
  ${asUtcIso('created_at', 'createdAt')}
`;

const proposalColumns = `
  proposal_id as "proposalId",
  proposal_kind as "proposalKind",
  state,
  origin_surface as "originSurface",
  request_id as "requestId",
  normalized_request_hash as "normalizedRequestHash",
  submitter_owner as "submitterOwner",
  problem_signature as "problemSignature",
  summary,
  rollback_plan_ref as "rollbackPlanRef",
  target_ref as "targetRef",
  evidence_refs_json as "evidenceRefsJson",
  payload_json as "payloadJson",
  ${asUtcIso('created_at', 'createdAt')},
  ${asUtcIso('updated_at', 'updatedAt')}
`;

const proposalDecisionColumns = `
  decision_id as "decisionId",
  proposal_id as "proposalId",
  decision_kind as "decisionKind",
  decision_origin as "decisionOrigin",
  origin_surface as "originSurface",
  request_id as "requestId",
  normalized_request_hash as "normalizedRequestHash",
  rationale,
  evidence_refs_json as "evidenceRefsJson",
  ${asUtcIso('created_at', 'createdAt')}
`;

const normalizeFreezeRow = (row: DevelopmentFreezeRow): DevelopmentFreezeRow => ({
  freezeId: row.freezeId,
  state: row.state,
  triggerKind: row.triggerKind,
  originSurface: row.originSurface,
  requestId: row.requestId,
  normalizedRequestHash: row.normalizedRequestHash,
  reason: row.reason,
  requestedBy: row.requestedBy,
  evidenceRefsJson: toStringArray(row.evidenceRefsJson),
  createdAt: normalizeTimestamp(row.createdAt, 'createdAt'),
});

const normalizeLedgerRow = (row: DevelopmentLedgerRow): DevelopmentLedgerRow => ({
  ledgerId: row.ledgerId,
  entryKind: row.entryKind,
  originSurface: row.originSurface,
  requestId: row.requestId,
  freezeId: row.freezeId ?? null,
  proposalId: row.proposalId ?? null,
  decisionId: row.decisionId ?? null,
  evidenceRefsJson: toStringArray(row.evidenceRefsJson),
  payloadJson: toRecord(row.payloadJson),
  createdAt: normalizeTimestamp(row.createdAt, 'createdAt'),
});

const normalizeProposalRow = (row: DevelopmentProposalRow): DevelopmentProposalRow => ({
  proposalId: row.proposalId,
  proposalKind: row.proposalKind,
  state: row.state,
  originSurface: row.originSurface,
  requestId: row.requestId,
  normalizedRequestHash: row.normalizedRequestHash,
  submitterOwner: row.submitterOwner,
  problemSignature: row.problemSignature,
  summary: row.summary,
  rollbackPlanRef: row.rollbackPlanRef ?? null,
  targetRef: row.targetRef ?? null,
  evidenceRefsJson: toStringArray(row.evidenceRefsJson),
  payloadJson: toRecord(row.payloadJson),
  createdAt: normalizeTimestamp(row.createdAt, 'createdAt'),
  updatedAt: normalizeTimestamp(row.updatedAt, 'updatedAt'),
});

const normalizeProposalDecisionRow = (
  row: DevelopmentProposalDecisionRow,
): DevelopmentProposalDecisionRow => ({
  decisionId: row.decisionId,
  proposalId: row.proposalId,
  decisionKind: row.decisionKind,
  decisionOrigin: row.decisionOrigin,
  originSurface: row.originSurface,
  requestId: row.requestId,
  normalizedRequestHash: row.normalizedRequestHash,
  rationale: row.rationale,
  evidenceRefsJson: toStringArray(row.evidenceRefsJson),
  createdAt: normalizeTimestamp(row.createdAt, 'createdAt'),
});

const loadFreezeByRequestId = async (
  db: DevelopmentGovernorDbExecutor,
  requestId: string,
): Promise<DevelopmentFreezeRow | null> => {
  const result = await db.query<DevelopmentFreezeRow>(
    `select ${freezeColumns}
     from ${freezesTable}
     where request_id = $1
     limit 1`,
    [requestId],
  );

  const row = result.rows[0];
  return row ? normalizeFreezeRow(row) : null;
};

const loadProposalByRequestId = async (
  db: DevelopmentGovernorDbExecutor,
  requestId: string,
): Promise<DevelopmentProposalRow | null> => {
  const result = await db.query<DevelopmentProposalRow>(
    `select ${proposalColumns}
     from ${proposalsTable}
     where request_id = $1
     limit 1`,
    [requestId],
  );

  const row = result.rows[0];
  return row ? normalizeProposalRow(row) : null;
};

const loadProposalById = async (
  db: DevelopmentGovernorDbExecutor,
  proposalId: string,
  options: { lockForUpdate?: boolean } = {},
): Promise<DevelopmentProposalRow | null> => {
  const result = await db.query<DevelopmentProposalRow>(
    `select ${proposalColumns}
     from ${proposalsTable}
     where proposal_id = $1
     limit 1${options.lockForUpdate ? '\n     for update' : ''}`,
    [proposalId],
  );

  const row = result.rows[0];
  return row ? normalizeProposalRow(row) : null;
};

const loadDecisionByRequestId = async (
  db: DevelopmentGovernorDbExecutor,
  requestId: string,
): Promise<DevelopmentProposalDecisionRow | null> => {
  const result = await db.query<DevelopmentProposalDecisionRow>(
    `select ${proposalDecisionColumns}
     from ${proposalDecisionsTable}
     where request_id = $1
     limit 1`,
    [requestId],
  );

  const row = result.rows[0];
  return row ? normalizeProposalDecisionRow(row) : null;
};

const insertFreeze = async (
  db: DevelopmentGovernorDbExecutor,
  input: FreezeDevelopmentInput,
): Promise<DevelopmentFreezeRow> => {
  const result = await db.query<DevelopmentFreezeRow>(
    `insert into ${freezesTable} (
       freeze_id,
       state,
       trigger_kind,
       origin_surface,
       request_id,
       normalized_request_hash,
       reason,
       requested_by,
       evidence_refs_json,
       created_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::timestamptz)
     returning ${freezeColumns}`,
    [
      input.freezeId,
      DEVELOPMENT_FREEZE_STATE.FROZEN,
      input.triggerKind,
      input.originSurface,
      input.requestId,
      input.normalizedRequestHash,
      input.reason,
      input.requestedBy,
      JSON.stringify(input.evidenceRefs),
      input.createdAt,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('failed to insert development freeze');
  }

  return normalizeFreezeRow(row);
};

const insertProposal = async (
  db: DevelopmentGovernorDbExecutor,
  input: SubmitDevelopmentProposalInput,
): Promise<DevelopmentProposalRow> => {
  const result = await db.query<DevelopmentProposalRow>(
    `insert into ${proposalsTable} (
       proposal_id,
       proposal_kind,
       state,
       origin_surface,
       request_id,
       normalized_request_hash,
       title,
       submitter_owner,
       problem_signature,
       summary,
       rollback_plan_ref,
       target_ref,
       payload_json,
       evidence_refs_json,
       created_at,
       updated_at
     )
     values (
       $1, $2, $3, $4, $5, $6, $7, $8,
       $9, $10, $11, $12, $13::jsonb, $14::jsonb,
       $15::timestamptz, $15::timestamptz
     )
     returning ${proposalColumns}`,
    [
      input.proposalId,
      input.proposalKind,
      DEVELOPMENT_PROPOSAL_STATE.SUBMITTED,
      input.originSurface,
      input.requestId,
      input.normalizedRequestHash,
      input.problemSignature,
      input.submitterOwner,
      input.problemSignature,
      input.summary,
      input.rollbackPlanRef,
      input.targetRef,
      JSON.stringify(input.payloadJson ?? {}),
      JSON.stringify(input.evidenceRefs),
      input.createdAt,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('failed to insert development proposal');
  }

  return normalizeProposalRow(row);
};

const insertFreezeLedgerEntry = async (
  db: DevelopmentGovernorDbExecutor,
  input: FreezeDevelopmentInput,
): Promise<DevelopmentLedgerRow> => {
  const result = await db.query<DevelopmentLedgerRow>(
    `insert into ${ledgerTable} (
       ledger_id,
       entry_kind,
       origin_surface,
       request_id,
       freeze_id,
       evidence_refs_json,
       payload_json,
       created_at
     )
     values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::timestamptz)
     returning ${ledgerColumns}`,
    [
      input.ledgerId,
      DEVELOPMENT_GOVERNOR_LEDGER_ENTRY_KIND.FREEZE_CREATED,
      input.originSurface,
      input.requestId,
      input.freezeId,
      JSON.stringify(input.evidenceRefs),
      JSON.stringify(input.payloadJson ?? {}),
      input.createdAt,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('failed to insert development ledger entry');
  }

  return normalizeLedgerRow(row);
};

const insertProposalLedgerEntry = async (
  db: DevelopmentGovernorDbExecutor,
  input: SubmitDevelopmentProposalInput,
): Promise<DevelopmentLedgerRow> => {
  const result = await db.query<DevelopmentLedgerRow>(
    `insert into ${ledgerTable} (
       ledger_id,
       entry_kind,
       origin_surface,
       request_id,
       proposal_id,
       evidence_refs_json,
       payload_json,
       created_at
     )
     values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::timestamptz)
     returning ${ledgerColumns}`,
    [
      input.ledgerId,
      DEVELOPMENT_GOVERNOR_LEDGER_ENTRY_KIND.PROPOSAL_RECORDED,
      input.originSurface,
      input.requestId,
      input.proposalId,
      JSON.stringify(input.evidenceRefs),
      JSON.stringify(input.payloadJson ?? {}),
      input.createdAt,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('failed to insert development proposal ledger entry');
  }

  return normalizeLedgerRow(row);
};

const insertProposalDecision = async (
  db: DevelopmentGovernorDbExecutor,
  input: RecordDevelopmentProposalDecisionInput,
): Promise<DevelopmentProposalDecisionRow> => {
  const result = await db.query<DevelopmentProposalDecisionRow>(
    `insert into ${proposalDecisionsTable} (
       decision_id,
       proposal_id,
       decision_kind,
       decision_origin,
       origin_surface,
       request_id,
       normalized_request_hash,
       rationale,
       evidence_refs_json,
       created_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::timestamptz)
     returning ${proposalDecisionColumns}`,
    [
      input.decisionId,
      input.proposalId,
      input.decisionKind,
      input.decisionOrigin,
      input.originSurface,
      input.requestId,
      input.normalizedRequestHash,
      input.rationale,
      JSON.stringify(input.evidenceRefs),
      input.createdAt,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('failed to insert development proposal decision');
  }

  return normalizeProposalDecisionRow(row);
};

const updateProposalState = async (
  db: DevelopmentGovernorDbExecutor,
  proposalId: string,
  state: Extract<
    DevelopmentProposalState,
    | typeof DEVELOPMENT_PROPOSAL_STATE.APPROVED
    | typeof DEVELOPMENT_PROPOSAL_STATE.REJECTED
    | typeof DEVELOPMENT_PROPOSAL_STATE.DEFERRED
  >,
  updatedAt: string,
): Promise<DevelopmentProposalRow> => {
  const result = await db.query<DevelopmentProposalRow>(
    `update ${proposalsTable}
     set state = $2,
         updated_at = $3::timestamptz
     where proposal_id = $1
     returning ${proposalColumns}`,
    [proposalId, state, updatedAt],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('failed to update development proposal state');
  }

  return normalizeProposalRow(row);
};

const insertProposalDecisionLedgerEntry = async (
  db: DevelopmentGovernorDbExecutor,
  input: RecordDevelopmentProposalDecisionInput,
): Promise<DevelopmentLedgerRow> => {
  const result = await db.query<DevelopmentLedgerRow>(
    `insert into ${ledgerTable} (
       ledger_id,
       entry_kind,
       origin_surface,
       request_id,
       proposal_id,
       decision_id,
       evidence_refs_json,
       payload_json,
       created_at
     )
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::timestamptz)
     returning ${ledgerColumns}`,
    [
      input.ledgerId,
      DEVELOPMENT_GOVERNOR_LEDGER_ENTRY_KIND.PROPOSAL_DECISION_RECORDED,
      input.originSurface,
      input.requestId,
      input.proposalId,
      input.decisionId,
      JSON.stringify(input.evidenceRefs),
      JSON.stringify(input.payloadJson ?? {}),
      input.createdAt,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('failed to insert development proposal decision ledger entry');
  }

  return normalizeLedgerRow(row);
};

export const createDevelopmentGovernorStore = (
  db: DevelopmentGovernorDbExecutor,
): DevelopmentGovernorStore => ({
  freezeDevelopment: (input) =>
    transaction(db, async () => {
      const existing = await loadFreezeByRequestId(db, input.requestId);
      if (existing) {
        if (existing.normalizedRequestHash !== input.normalizedRequestHash) {
          return {
            accepted: false,
            reason: 'conflicting_request_id',
            freeze: existing,
          };
        }

        await setRuntimeDevelopmentFreeze(db, true, DEFAULT_RUNTIME_AGENT_ID);
        return {
          accepted: true,
          deduplicated: true,
          freeze: existing,
          ledgerEntry: null,
        };
      }

      const freeze = await insertFreeze(db, input);
      const ledgerEntry = await insertFreezeLedgerEntry(db, input);
      await setRuntimeDevelopmentFreeze(db, true, DEFAULT_RUNTIME_AGENT_ID);

      return {
        accepted: true,
        deduplicated: false,
        freeze,
        ledgerEntry,
      };
    }),

  submitDevelopmentProposal: (input) =>
    transaction(db, async () => {
      const existing = await loadProposalByRequestId(db, input.requestId);
      if (existing) {
        if (existing.normalizedRequestHash !== input.normalizedRequestHash) {
          return {
            accepted: false,
            reason: 'conflicting_request_id',
            proposal: existing,
          };
        }

        return {
          accepted: true,
          deduplicated: true,
          proposal: existing,
          ledgerEntry: null,
        };
      }

      const activeFreeze = await loadActiveFreeze(db);
      if (activeFreeze) {
        return {
          accepted: false,
          reason: 'development_frozen',
          freeze: activeFreeze,
        };
      }

      const proposal = await insertProposal(db, input);
      const ledgerEntry = await insertProposalLedgerEntry(db, input);

      return {
        accepted: true,
        deduplicated: false,
        proposal,
        ledgerEntry,
      };
    }),

  recordProposalDecision: (input) =>
    transaction(db, async () => {
      const existingDecision = await loadDecisionByRequestId(db, input.requestId);
      if (existingDecision) {
        if (existingDecision.normalizedRequestHash !== input.normalizedRequestHash) {
          return {
            accepted: false,
            reason: 'conflicting_request_id',
            decision: existingDecision,
          };
        }

        const proposal = await loadProposalById(db, existingDecision.proposalId);
        if (!proposal) {
          return {
            accepted: false,
            reason: 'proposal_not_found',
          };
        }

        return {
          accepted: true,
          deduplicated: true,
          proposal,
          decision: existingDecision,
          ledgerEntry: null,
        };
      }

      const proposal = await loadProposalById(db, input.proposalId, { lockForUpdate: true });
      if (!proposal) {
        return {
          accepted: false,
          reason: 'proposal_not_found',
        };
      }

      const acceptsDecisionFromSubmitted = proposal.state === DEVELOPMENT_PROPOSAL_STATE.SUBMITTED;
      const acceptsDecisionFromDeferred =
        proposal.state === DEVELOPMENT_PROPOSAL_STATE.DEFERRED &&
        input.decisionKind !== DEVELOPMENT_PROPOSAL_DECISION_KIND.DEFERRED;

      if (!acceptsDecisionFromSubmitted && !acceptsDecisionFromDeferred) {
        return {
          accepted: false,
          reason: 'invalid_state_transition',
          proposal,
        };
      }

      const decision = await insertProposalDecision(db, input);
      const updatedProposal = await updateProposalState(
        db,
        input.proposalId,
        input.decisionKind,
        input.createdAt,
      );
      const ledgerEntry = await insertProposalDecisionLedgerEntry(db, input);

      return {
        accepted: true,
        deduplicated: false,
        proposal: updatedProposal,
        decision,
        ledgerEntry,
      };
    }),

  async loadActiveFreeze() {
    return await loadActiveFreeze(db);
  },
});

const loadActiveFreeze = async (
  db: DevelopmentGovernorDbExecutor,
): Promise<DevelopmentFreezeRow | null> => {
  const result = await db.query<DevelopmentFreezeRow>(
    `select ${freezeColumns}
     from ${freezesTable}
     where state = $1
     order by created_at desc, freeze_id desc
     limit 1`,
    [DEVELOPMENT_FREEZE_STATE.FROZEN],
  );

  const row = result.rows[0];
  return row ? normalizeFreezeRow(row) : null;
};
