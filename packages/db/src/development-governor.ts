import type { Client } from 'pg';
import {
  DEVELOPMENT_FREEZE_STATE,
  DEVELOPMENT_GOVERNOR_LEDGER_ENTRY_KIND,
  type DevelopmentFreezeState,
  type DevelopmentFreezeTriggerKind,
  type DevelopmentGovernorLedgerEntryKind,
  type DevelopmentGovernorOriginSurface,
} from '@yaagi/contracts/governor';
import {
  DEFAULT_RUNTIME_AGENT_ID,
  RUNTIME_SCHEMA,
  setRuntimeDevelopmentFreeze,
} from './runtime.ts';

export type DevelopmentGovernorDbExecutor = Pick<Client, 'query'>;

const runtimeSchemaTable = (table: string): string => `${RUNTIME_SCHEMA}.${table}`;
const freezesTable = runtimeSchemaTable('development_freezes');
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

export type DevelopmentGovernorStore = {
  freezeDevelopment(input: FreezeDevelopmentInput): Promise<FreezeDevelopmentResult>;
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

  async loadActiveFreeze() {
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
  },
});
