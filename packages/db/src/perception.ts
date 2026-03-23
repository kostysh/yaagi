import type { Client, QueryResultRow } from 'pg';
import {
  DEFAULT_PERCEPTION_BACKLOG_COUNTS,
  STIMULUS_STATUS,
  enqueueStimulusInputSchema,
  getStimulusPriorityRank,
  normalizedStimulusSchema,
  type EnqueueStimulusInput,
  type PerceptionBacklogCounts,
  type PerceptionBatch,
  type StimulusEnvelope,
  type StimulusInboxRecord,
  type StimulusStatus,
  type TickPerceptionClaim,
} from '@yaagi/contracts/perception';

export type PerceptionDbExecutor = Pick<Client, 'query'>;

export const PERCEPTION_SCHEMA = 'polyphony_runtime';

const runtimeSchemaTable = (table: string): string => `${PERCEPTION_SCHEMA}.${table}`;

const stimulusInboxTable = runtimeSchemaTable('stimulus_inbox');
const tickTable = runtimeSchemaTable('ticks');
const asUtcIso = (column: string, alias: string): string =>
  `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "${alias}"`;

const stimulusInboxColumns = `
  stimulus_id as "stimulusId",
  source_kind as "sourceKind",
  thread_id as "threadId",
  ${asUtcIso('occurred_at', 'occurredAt')},
  priority,
  priority_rank as "priorityRank",
  requires_immediate_tick as "requiresImmediateTick",
  payload_json as "payloadJson",
  normalized_json as "normalizedJson",
  dedupe_key as "dedupeKey",
  claim_tick_id as "claimTickId",
  status,
  ${asUtcIso('created_at', 'createdAt')},
  ${asUtcIso('updated_at', 'updatedAt')}
`;

const normalizeStimulusInboxRow = (row: QueryResultRow): StimulusInboxRecord => ({
  ...(row as StimulusInboxRecord),
  normalizedJson: normalizedStimulusSchema.parse((row as StimulusInboxRecord).normalizedJson),
});

const normalizeCount = (value: unknown): number => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.length > 0) {
    return Number(value);
  }

  return 0;
};

export const parseTickPerceptionClaim = (
  requestJson: Record<string, unknown>,
): TickPerceptionClaim | null => {
  const candidate = requestJson['perception'];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }

  const claim = candidate as Partial<TickPerceptionClaim>;
  if (!claim.tickId || !Array.isArray(claim.claimedStimulusIds) || !Array.isArray(claim.items)) {
    return null;
  }

  return claim as TickPerceptionClaim;
};

export type PerceptionStore = {
  enqueueStimulus(input: EnqueueStimulusInput): Promise<StimulusInboxRecord>;
  findLatestBySourceAndDedupeKey(input: {
    sourceKind: StimulusInboxRecord['sourceKind'];
    dedupeKey: string;
    statuses?: StimulusStatus[];
  }): Promise<StimulusInboxRecord | null>;
  updateQueuedStimulus(input: {
    stimulusId: string;
    envelope: StimulusEnvelope;
    signalType: string;
    dedupeKey?: string | null;
    aggregateHints?: Record<string, unknown>;
  }): Promise<StimulusInboxRecord | null>;
  loadReadyStimuli(input?: { limit?: number }): Promise<StimulusInboxRecord[]>;
  claimStimuli(input: { tickId: string; stimulusIds: string[] }): Promise<StimulusInboxRecord[]>;
  consumeClaimedStimuli(input: { tickId: string; stimulusIds?: string[] }): Promise<number>;
  releaseClaimedStimuli(input: { tickId: string; stimulusIds?: string[] }): Promise<number>;
  releaseClaimedStimuliForTicks(tickIds: string[]): Promise<number>;
  countBacklog(): Promise<PerceptionBacklogCounts>;
  attachTickPerceptionClaim(input: { tickId: string; claim: PerceptionBatch }): Promise<void>;
};

export function createPerceptionStore(db: PerceptionDbExecutor): PerceptionStore {
  return {
    async enqueueStimulus(input: EnqueueStimulusInput): Promise<StimulusInboxRecord> {
      const parsed = enqueueStimulusInputSchema.parse(input);
      const normalizedJson = {
        envelope: parsed.envelope,
        signalType: parsed.signalType,
        dedupeKey: parsed.dedupeKey ?? null,
        aggregateHints: parsed.aggregateHints ?? {},
      };

      const result = await db.query<StimulusInboxRecord>(
        `insert into ${stimulusInboxTable} (
          stimulus_id,
          source_kind,
          thread_id,
          occurred_at,
          priority,
          priority_rank,
          requires_immediate_tick,
          payload_json,
          normalized_json,
          dedupe_key,
          claim_tick_id,
          status,
          created_at,
          updated_at
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, null, $11, now(), now()
        )
        returning ${stimulusInboxColumns}`,
        [
          parsed.envelope.id,
          parsed.envelope.source,
          parsed.envelope.threadId ?? null,
          parsed.envelope.occurredAt,
          parsed.envelope.priority,
          getStimulusPriorityRank(parsed.envelope.priority),
          parsed.envelope.requiresImmediateTick,
          JSON.stringify(parsed.envelope.payload),
          JSON.stringify(normalizedJson),
          parsed.dedupeKey ?? null,
          STIMULUS_STATUS.QUEUED,
        ],
      );

      const row = result.rows[0];
      if (!row) {
        throw new Error('failed to enqueue stimulus');
      }

      return normalizeStimulusInboxRow(row);
    },

    async findLatestBySourceAndDedupeKey({
      sourceKind,
      dedupeKey,
      statuses,
    }): Promise<StimulusInboxRecord | null> {
      const result = await db.query<StimulusInboxRecord>(
        `select ${stimulusInboxColumns}
         from ${stimulusInboxTable}
         where source_kind = $1
           and dedupe_key = $2
           and ($3::text[] is null or status = any($3::text[]))
         order by occurred_at desc, stimulus_id desc
         limit 1`,
        [sourceKind, dedupeKey, statuses && statuses.length > 0 ? statuses : null],
      );

      return result.rows[0] ? normalizeStimulusInboxRow(result.rows[0]) : null;
    },

    async updateQueuedStimulus(input): Promise<StimulusInboxRecord | null> {
      const parsed = enqueueStimulusInputSchema.parse({
        envelope: input.envelope,
        signalType: input.signalType,
        dedupeKey: input.dedupeKey ?? null,
        aggregateHints: input.aggregateHints ?? {},
      });
      const normalizedJson = {
        envelope: parsed.envelope,
        signalType: parsed.signalType,
        dedupeKey: parsed.dedupeKey ?? null,
        aggregateHints: parsed.aggregateHints ?? {},
      };

      const result = await db.query<StimulusInboxRecord>(
        `update ${stimulusInboxTable}
         set thread_id = $2,
             occurred_at = $3,
             priority = $4,
             priority_rank = $5,
             requires_immediate_tick = $6,
             payload_json = $7::jsonb,
             normalized_json = $8::jsonb,
             dedupe_key = $9,
             updated_at = now()
         where stimulus_id = $1
           and status = $10
         returning ${stimulusInboxColumns}`,
        [
          input.stimulusId,
          parsed.envelope.threadId ?? null,
          parsed.envelope.occurredAt,
          parsed.envelope.priority,
          getStimulusPriorityRank(parsed.envelope.priority),
          parsed.envelope.requiresImmediateTick,
          JSON.stringify(parsed.envelope.payload),
          JSON.stringify(normalizedJson),
          parsed.dedupeKey ?? null,
          STIMULUS_STATUS.QUEUED,
        ],
      );

      const row = result.rows[0];
      return row ? normalizeStimulusInboxRow(row) : null;
    },

    async loadReadyStimuli({
      limit = 64,
    }: {
      limit?: number;
    } = {}): Promise<StimulusInboxRecord[]> {
      const result = await db.query<StimulusInboxRecord>(
        `select ${stimulusInboxColumns}
         from ${stimulusInboxTable}
         where status = $1
         order by
           requires_immediate_tick desc,
           priority_rank desc,
           occurred_at asc,
           stimulus_id asc
         limit $2`,
        [STIMULUS_STATUS.QUEUED, limit],
      );

      return result.rows.map(normalizeStimulusInboxRow);
    },

    async claimStimuli({ tickId, stimulusIds }): Promise<StimulusInboxRecord[]> {
      if (stimulusIds.length === 0) {
        return [];
      }

      const result = await db.query<StimulusInboxRecord>(
        `update ${stimulusInboxTable}
         set status = $2,
             claim_tick_id = $1,
             updated_at = now()
         where stimulus_id = any($3::text[])
           and status = $4
         returning ${stimulusInboxColumns}`,
        [tickId, STIMULUS_STATUS.CLAIMED, stimulusIds, STIMULUS_STATUS.QUEUED],
      );

      const rows = result.rows.map(normalizeStimulusInboxRow);
      const order = new Map(stimulusIds.map((stimulusId, index) => [stimulusId, index]));
      rows.sort((left, right) => {
        const leftIndex = order.get(left.stimulusId) ?? Number.MAX_SAFE_INTEGER;
        const rightIndex = order.get(right.stimulusId) ?? Number.MAX_SAFE_INTEGER;
        return leftIndex - rightIndex;
      });
      return rows;
    },

    async consumeClaimedStimuli({ tickId, stimulusIds }): Promise<number> {
      return await updateClaimedStimuliStatus(db, {
        tickId,
        ...(stimulusIds ? { stimulusIds } : {}),
        nextStatus: STIMULUS_STATUS.CONSUMED,
      });
    },

    async releaseClaimedStimuli({ tickId, stimulusIds }): Promise<number> {
      return await releaseClaimedStimuliInternal(db, tickId, stimulusIds);
    },

    async releaseClaimedStimuliForTicks(tickIds: string[]): Promise<number> {
      if (tickIds.length === 0) {
        return 0;
      }

      const result = await db.query<{ count: string }>(
        `update ${stimulusInboxTable}
         set status = $1,
             claim_tick_id = null,
             updated_at = now()
         where claim_tick_id = any($2::text[])
           and status = $3
         returning 1::text as count`,
        [STIMULUS_STATUS.QUEUED, tickIds, STIMULUS_STATUS.CLAIMED],
      );

      return result.rowCount ?? result.rows.length;
    },

    async countBacklog(): Promise<PerceptionBacklogCounts> {
      const result = await db.query<{
        status: StimulusStatus;
        count: string;
      }>(
        `select status, count(*)::text as count
         from ${stimulusInboxTable}
         group by status`,
      );

      const counts = structuredClone(DEFAULT_PERCEPTION_BACKLOG_COUNTS);
      for (const row of result.rows) {
        counts[row.status] = normalizeCount(row.count);
      }

      return counts;
    },

    async attachTickPerceptionClaim({ tickId, claim }): Promise<void> {
      await db.query(
        `update ${tickTable}
         set request_json = coalesce(request_json, '{}'::jsonb) || jsonb_build_object('perception', $2::jsonb),
             updated_at = now()
         where tick_id = $1`,
        [tickId, JSON.stringify(claim)],
      );
    },
  };
}

const updateClaimedStimuliStatus = async (
  db: PerceptionDbExecutor,
  input: {
    tickId: string;
    stimulusIds?: string[];
    nextStatus: Extract<StimulusStatus, 'consumed' | 'dropped'>;
  },
): Promise<number> => {
  if (input.stimulusIds && input.stimulusIds.length === 0) {
    return 0;
  }

  const params: unknown[] = [input.tickId, input.nextStatus, STIMULUS_STATUS.CLAIMED];
  const filter =
    input.stimulusIds && input.stimulusIds.length > 0
      ? (() => {
          params.push(input.stimulusIds);
          return 'and stimulus_id = any($4::text[])';
        })()
      : '';

  const result = await db.query<{ count: string }>(
    `update ${stimulusInboxTable}
     set status = $2,
         updated_at = now()
     where claim_tick_id = $1
       and status = $3
       ${filter}
     returning 1::text as count`,
    params,
  );

  return result.rowCount ?? result.rows.length;
};

const releaseClaimedStimuliInternal = async (
  db: PerceptionDbExecutor,
  tickId: string,
  stimulusIds?: string[],
): Promise<number> => {
  if (stimulusIds && stimulusIds.length === 0) {
    return 0;
  }

  const params: unknown[] = [tickId, STIMULUS_STATUS.QUEUED, STIMULUS_STATUS.CLAIMED];
  const filter =
    stimulusIds && stimulusIds.length > 0
      ? (() => {
          params.push(stimulusIds);
          return 'and stimulus_id = any($4::text[])';
        })()
      : '';

  const result = await db.query<{ count: string }>(
    `update ${stimulusInboxTable}
     set status = $2,
         claim_tick_id = null,
         updated_at = now()
     where claim_tick_id = $1
       and status = $3
       ${filter}
     returning 1::text as count`,
    params,
  );

  return result.rowCount ?? result.rows.length;
};
