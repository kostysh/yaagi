import type { Client, QueryResultRow } from 'pg';
import { EXPANDED_MODEL_SERVICE_ID } from '@yaagi/contracts/models';
import type {
  ExpandedModelServiceId,
  ExpandedFallbackLink,
  ExpandedModelProfileHealth,
  ModelFallbackLinkKind,
  ModelProfileAvailability,
  ModelProfileQuarantineState,
} from '@yaagi/contracts/models';

export type ModelEcologyDbExecutor = Pick<Client, 'query'>;

const RUNTIME_SCHEMA = 'polyphony_runtime';

const runtimeSchemaTable = (table: string): string => `${RUNTIME_SCHEMA}.${table}`;
const modelProfileHealthTable = runtimeSchemaTable('model_profile_health');
const modelFallbackLinksTable = runtimeSchemaTable('model_fallback_links');

const asUtcIso = (column: string, alias: string): string =>
  `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "${alias}"`;

type ExpandedModelProfileHealthRecord = {
  modelProfileId: string;
  serviceId: string;
  availability: ModelProfileAvailability;
  quarantineState: ModelProfileQuarantineState;
  healthy: boolean | null;
  errorRate: number | string | null;
  latencyMsP95: number | string | null;
  checkedAt: string | Date;
  sourceJson: unknown;
};

type ExpandedFallbackLinkRecord = {
  modelProfileId: string;
  fallbackTargetProfileId: string | null;
  linkKind: ModelFallbackLinkKind;
  allowed: boolean;
  reason: string;
  updatedAt: string | Date;
};

export type ExpandedModelProfileHealthInput = Omit<ExpandedModelProfileHealth, 'checkedAt'> & {
  checkedAt?: string;
};

export type ExpandedFallbackLinkInput = Omit<ExpandedFallbackLink, 'updatedAt'> & {
  updatedAt?: string;
};

export type ExpandedModelEcologyStore = {
  upsertProfileHealth(
    entries: ExpandedModelProfileHealthInput[],
  ): Promise<ExpandedModelProfileHealth[]>;
  replaceFallbackLinks(entries: ExpandedFallbackLinkInput[]): Promise<ExpandedFallbackLink[]>;
  listProfileHealth(input?: { modelProfileIds?: string[] }): Promise<ExpandedModelProfileHealth[]>;
  listFallbackLinks(input?: { modelProfileIds?: string[] }): Promise<ExpandedFallbackLink[]>;
};

const profileHealthColumns = `
  model_profile_id as "modelProfileId",
  service_id as "serviceId",
  availability,
  quarantine_state as "quarantineState",
  healthy,
  error_rate::float8 as "errorRate",
  latency_ms_p95::float8 as "latencyMsP95",
  ${asUtcIso('checked_at', 'checkedAt')},
  source_json as "sourceJson"
`;

const fallbackLinkColumns = `
  model_profile_id as "modelProfileId",
  fallback_target_profile_id as "fallbackTargetProfileId",
  link_kind as "linkKind",
  allowed,
  reason,
  ${asUtcIso('updated_at', 'updatedAt')}
`;

const transaction = async <T>(db: ModelEcologyDbExecutor, run: () => Promise<T>): Promise<T> => {
  await db.query('begin');
  try {
    const result = await run();
    await db.query('commit');
    return result;
  } catch (error) {
    try {
      await db.query('rollback');
    } catch {
      // Ignore rollback failure and preserve the original error.
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

  throw new Error(`model ecology field ${field} must be a string or Date timestamp`);
};

const toNullableNumber = (value: unknown): number | null => {
  if (value == null) return null;

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error(
    `model ecology numeric field must be coercible to number, received ${JSON.stringify(value)}`,
  );
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
};

const toExpandedModelServiceId = (value: unknown): ExpandedModelServiceId => {
  if (
    value === EXPANDED_MODEL_SERVICE_ID.VLLM_DEEP ||
    value === EXPANDED_MODEL_SERVICE_ID.VLLM_POOL
  ) {
    return value;
  }

  throw new Error(`unsupported expanded model service id ${JSON.stringify(value)}`);
};

const normalizeProfileHealthRow = (row: QueryResultRow): ExpandedModelProfileHealth => {
  const record = row as unknown as ExpandedModelProfileHealthRecord;
  return {
    modelProfileId: record.modelProfileId,
    serviceId: toExpandedModelServiceId(record.serviceId),
    availability: record.availability,
    quarantineState: record.quarantineState,
    healthy: record.healthy ?? null,
    errorRate: toNullableNumber(record.errorRate),
    latencyMsP95: toNullableNumber(record.latencyMsP95),
    checkedAt: normalizeTimestamp(record.checkedAt, 'model_profile_health.checkedAt'),
    sourceJson: toRecord(record.sourceJson),
  };
};

const normalizeFallbackLinkRow = (row: QueryResultRow): ExpandedFallbackLink => {
  const record = row as unknown as ExpandedFallbackLinkRecord;
  return {
    modelProfileId: record.modelProfileId,
    fallbackTargetProfileId: record.fallbackTargetProfileId ?? null,
    linkKind: record.linkKind,
    allowed: record.allowed,
    reason: record.reason,
    updatedAt: normalizeTimestamp(record.updatedAt, 'model_fallback_links.updatedAt'),
  };
};

export function createExpandedModelEcologyStore(
  db: ModelEcologyDbExecutor,
): ExpandedModelEcologyStore {
  return {
    async upsertProfileHealth(
      entries: ExpandedModelProfileHealthInput[],
    ): Promise<ExpandedModelProfileHealth[]> {
      return await transaction(db, async () => {
        const rows: ExpandedModelProfileHealth[] = [];

        for (const entry of entries) {
          const result = await db.query<ExpandedModelProfileHealth>(
            `insert into ${modelProfileHealthTable} (
               model_profile_id,
               service_id,
               availability,
               quarantine_state,
               healthy,
               error_rate,
               latency_ms_p95,
               checked_at,
               source_json,
               updated_at
             ) values (
               $1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9::jsonb, now()
             )
             on conflict (model_profile_id) do update
               set service_id = excluded.service_id,
                   availability = excluded.availability,
                   quarantine_state = excluded.quarantine_state,
                   healthy = excluded.healthy,
                   error_rate = excluded.error_rate,
                   latency_ms_p95 = excluded.latency_ms_p95,
                   checked_at = excluded.checked_at,
                   source_json = excluded.source_json,
                   updated_at = now()
             returning ${profileHealthColumns}`,
            [
              entry.modelProfileId,
              entry.serviceId,
              entry.availability,
              entry.quarantineState,
              entry.healthy,
              entry.errorRate,
              entry.latencyMsP95,
              entry.checkedAt ?? new Date().toISOString(),
              JSON.stringify(entry.sourceJson),
            ],
          );

          const row = result.rows[0];
          if (!row) {
            throw new Error(`failed to upsert model_profile_health for ${entry.modelProfileId}`);
          }
          rows.push(normalizeProfileHealthRow(row));
        }

        return rows;
      });
    },

    async replaceFallbackLinks(
      entries: ExpandedFallbackLinkInput[],
    ): Promise<ExpandedFallbackLink[]> {
      return await transaction(db, async () => {
        const modelProfileIds = [...new Set(entries.map((entry) => entry.modelProfileId))];
        if (modelProfileIds.length > 0) {
          await db.query(
            `delete from ${modelFallbackLinksTable}
             where model_profile_id = any($1::text[])`,
            [modelProfileIds],
          );
        }

        const rows: ExpandedFallbackLink[] = [];

        for (const entry of entries) {
          const result = await db.query<ExpandedFallbackLink>(
            `insert into ${modelFallbackLinksTable} (
               model_profile_id,
               fallback_target_profile_id,
               link_kind,
               allowed,
               reason,
               updated_at
             ) values (
               $1, $2, $3, $4, $5, $6::timestamptz
             )
             returning ${fallbackLinkColumns}`,
            [
              entry.modelProfileId,
              entry.fallbackTargetProfileId,
              entry.linkKind,
              entry.allowed,
              entry.reason,
              entry.updatedAt ?? new Date().toISOString(),
            ],
          );

          const row = result.rows[0];
          if (!row) {
            throw new Error(`failed to insert model_fallback_links for ${entry.modelProfileId}`);
          }
          rows.push(normalizeFallbackLinkRow(row));
        }

        return rows;
      });
    },

    async listProfileHealth(input?: {
      modelProfileIds?: string[];
    }): Promise<ExpandedModelProfileHealth[]> {
      const modelProfileIds = input?.modelProfileIds?.length ? input.modelProfileIds : null;
      const result = modelProfileIds
        ? await db.query<ExpandedModelProfileHealth>(
            `select ${profileHealthColumns}
             from ${modelProfileHealthTable}
             where model_profile_id = any($1::text[])
             order by model_profile_id asc`,
            [modelProfileIds],
          )
        : await db.query<ExpandedModelProfileHealth>(
            `select ${profileHealthColumns}
             from ${modelProfileHealthTable}
             order by model_profile_id asc`,
          );

      return result.rows.map(normalizeProfileHealthRow);
    },

    async listFallbackLinks(input?: {
      modelProfileIds?: string[];
    }): Promise<ExpandedFallbackLink[]> {
      const modelProfileIds = input?.modelProfileIds?.length ? input.modelProfileIds : null;
      const result = modelProfileIds
        ? await db.query<ExpandedFallbackLink>(
            `select ${fallbackLinkColumns}
             from ${modelFallbackLinksTable}
             where model_profile_id = any($1::text[])
             order by model_profile_id asc, link_kind asc`,
            [modelProfileIds],
          )
        : await db.query<ExpandedFallbackLink>(
            `select ${fallbackLinkColumns}
             from ${modelFallbackLinksTable}
             order by model_profile_id asc, link_kind asc`,
          );

      return result.rows.map(normalizeFallbackLinkRow);
    },
  };
}
