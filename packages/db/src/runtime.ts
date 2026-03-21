import { randomUUID } from 'node:crypto';
import { Client, type QueryResultRow } from 'pg';

export const DEFAULT_RUNTIME_AGENT_ID = 'polyphony-core';
export const DEFAULT_RUNTIME_LEASE_OWNER = 'core';
export const DEFAULT_RUNTIME_LEASE_DURATION_MS = 60_000;
export const RUNTIME_SCHEMA = 'polyphony_runtime';

export const TICK_KIND = Object.freeze({
  REACTIVE: 'reactive',
  DELIBERATIVE: 'deliberative',
  CONTEMPLATIVE: 'contemplative',
  CONSOLIDATION: 'consolidation',
  DEVELOPMENTAL: 'developmental',
  WAKE: 'wake',
} as const);

export type TickKind = (typeof TICK_KIND)[keyof typeof TICK_KIND];

export const TICK_TRIGGER = Object.freeze({
  BOOT: 'boot',
  SCHEDULER: 'scheduler',
  SYSTEM: 'system',
} as const);

export type TickTrigger = (typeof TICK_TRIGGER)[keyof typeof TICK_TRIGGER];

export const TICK_STATUS = Object.freeze({
  STARTED: 'started',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const);

export type TickStatus = (typeof TICK_STATUS)[keyof typeof TICK_STATUS];

export type RuntimeMode = 'inactive' | 'normal' | 'degraded' | 'recovery';

export type RuntimeDbExecutor = Pick<Client, 'query'>;

export type BootStateBridge = {
  mode: RuntimeMode;
  schemaVersion: string;
  dependencyResults: Array<{
    dependency: string;
    ok: boolean;
    requiredForNormal: boolean;
    detail?: string;
  }>;
  degradedDependencies: string[];
  snapshotId: string | null;
};

export type RuntimeAgentStateRow = {
  id: number;
  agentId: string;
  mode: RuntimeMode;
  schemaVersion: string | null;
  bootStateJson: Record<string, unknown>;
  currentTickId: string | null;
  currentModelProfileId: string | null;
  lastStableSnapshotId: string | null;
  developmentFreeze: boolean;
  updatedAt: string;
};

export type RuntimeTickRow = {
  tickId: string;
  agentId: string;
  requestId: string;
  tickKind: TickKind;
  triggerKind: TickTrigger;
  status: TickStatus;
  queuedAt: string;
  startedAt: string;
  endedAt: string | null;
  leaseOwner: string;
  leaseExpiresAt: string;
  requestJson: Record<string, unknown>;
  resultJson: Record<string, unknown>;
  failureJson: Record<string, unknown>;
  continuityFlagsJson: Record<string, unknown>;
  selectedCoalitionId: string | null;
  selectedModelProfileId: string | null;
  actionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RuntimeEpisodeRow = {
  episodeId: string;
  tickId: string;
  summary: string;
  resultJson: Record<string, unknown>;
  createdAt: string;
};

export type RuntimeTimelineEventRow = {
  sequenceId: string;
  eventId: string;
  eventType: string;
  occurredAt: string;
  subjectRef: string;
  payloadJson: Record<string, unknown>;
  createdAt: string;
};

export type TickAdmissionAccepted = {
  accepted: true;
  deduplicated: boolean;
  tick: RuntimeTickRow;
};

export type TickAdmissionRejected = {
  accepted: false;
  reason: 'boot_inactive' | 'lease_busy';
  activeTickId: string | null;
};

export type TickAdmissionResult = TickAdmissionAccepted | TickAdmissionRejected;

export type TickRequestInput = {
  requestId: string;
  kind: TickKind;
  trigger: TickTrigger;
  payload?: Record<string, unknown>;
  agentId?: string;
  leaseOwner?: string;
  leaseDurationMs?: number;
  requestedAt?: Date;
};

export type TickFinalizationInput = {
  tickId: string;
  agentId?: string;
  summary?: string;
  resultJson?: Record<string, unknown>;
  failureJson?: Record<string, unknown>;
  continuityFlagsJson?: Record<string, unknown>;
  occurredAt?: Date;
};

export type RuntimeTimelineEventInput = {
  eventType: string;
  subjectRef: string;
  payloadJson?: Record<string, unknown>;
  occurredAt?: Date;
  eventId?: string;
};

export type RuntimeTickStore = {
  ensureAgentStateRow(agentId?: string): Promise<RuntimeAgentStateRow>;
  getAgentState(agentId?: string): Promise<RuntimeAgentStateRow | null>;
  setBootState(input: BootStateBridge, agentId?: string): Promise<RuntimeAgentStateRow>;
  setCurrentTick(tickId: string | null, agentId?: string): Promise<RuntimeAgentStateRow>;
  setDevelopmentFreeze(developmentFreeze: boolean, agentId?: string): Promise<RuntimeAgentStateRow>;
  requestTick(input: TickRequestInput): Promise<TickAdmissionResult>;
  completeTick(input: TickFinalizationInput): Promise<{
    tick: RuntimeTickRow;
    episode: RuntimeEpisodeRow;
    event: RuntimeTimelineEventRow;
  }>;
  failTick(input: TickFinalizationInput): Promise<{
    tick: RuntimeTickRow;
    event: RuntimeTimelineEventRow;
  }>;
  cancelTick(input: TickFinalizationInput): Promise<{
    tick: RuntimeTickRow;
    event: RuntimeTimelineEventRow;
  }>;
  reclaimStaleTicks(options?: { agentId?: string; now?: Date }): Promise<number>;
  appendTimelineEvent(input: RuntimeTimelineEventInput): Promise<RuntimeTimelineEventRow>;
};

const toTimestamp = (value: Date = new Date()): string => value.toISOString();

const transaction = async <T>(db: RuntimeDbExecutor, run: () => Promise<T>): Promise<T> => {
  await db.query('begin');
  try {
    const result = await run();
    await db.query('commit');
    return result;
  } catch (error) {
    try {
      await db.query('rollback');
    } catch {
      // Ignore rollback failures; original error is the useful one.
    }
    throw error;
  }
};

const runtimeSchemaTable = (table: string): string => `${RUNTIME_SCHEMA}.${table}`;

const agentStateColumns = `
  id,
  agent_id as "agentId",
  mode,
  schema_version as "schemaVersion",
  boot_state_json as "bootStateJson",
  current_tick_id as "currentTickId",
  current_model_profile_id as "currentModelProfileId",
  last_stable_snapshot_id as "lastStableSnapshotId",
  development_freeze as "developmentFreeze",
  updated_at as "updatedAt"
`;

const tickColumns = `
  tick_id as "tickId",
  agent_id as "agentId",
  request_id as "requestId",
  tick_kind as "tickKind",
  trigger_kind as "triggerKind",
  status,
  queued_at as "queuedAt",
  started_at as "startedAt",
  ended_at as "endedAt",
  lease_owner as "leaseOwner",
  lease_expires_at as "leaseExpiresAt",
  request_json as "requestJson",
  result_json as "resultJson",
  failure_json as "failureJson",
  continuity_flags_json as "continuityFlagsJson",
  selected_coalition_id as "selectedCoalitionId",
  selected_model_profile_id as "selectedModelProfileId",
  action_id as "actionId",
  created_at as "createdAt",
  updated_at as "updatedAt"
`;

const episodeColumns = `
  episode_id as "episodeId",
  tick_id as "tickId",
  summary,
  result_json as "resultJson",
  created_at as "createdAt"
`;

const timelineEventColumns = `
  sequence_id::text as "sequenceId",
  event_id as "eventId",
  event_type as "eventType",
  occurred_at as "occurredAt",
  subject_ref as "subjectRef",
  payload_json as "payloadJson",
  created_at as "createdAt"
`;

const agentStateTable = runtimeSchemaTable('agent_state');
const tickTable = runtimeSchemaTable('ticks');
const episodeTable = runtimeSchemaTable('episodes');
const timelineEventTable = runtimeSchemaTable('timeline_events');

const normalizeAgentStateRow = (row: QueryResultRow): RuntimeAgentStateRow =>
  row as unknown as RuntimeAgentStateRow;

const normalizeTickRow = (row: QueryResultRow): RuntimeTickRow => row as unknown as RuntimeTickRow;

const normalizeEpisodeRow = (row: QueryResultRow): RuntimeEpisodeRow =>
  row as unknown as RuntimeEpisodeRow;

const normalizeTimelineEventRow = (row: QueryResultRow): RuntimeTimelineEventRow =>
  row as unknown as RuntimeTimelineEventRow;

const ensureAgentStateSeed = async (db: RuntimeDbExecutor, agentId: string): Promise<void> => {
  await db.query(
    `insert into ${agentStateTable} (id, agent_id)
     values (1, $1)
     on conflict (id) do nothing`,
    [agentId],
  );
};

const loadAgentStateRow = async (db: RuntimeDbExecutor): Promise<RuntimeAgentStateRow | null> => {
  const result = await db.query<RuntimeAgentStateRow>(
    `select ${agentStateColumns}
     from ${agentStateTable}
     where id = 1`,
  );

  return result.rows[0] ? normalizeAgentStateRow(result.rows[0]) : null;
};

const lockAgentStateRow = async (db: RuntimeDbExecutor): Promise<RuntimeAgentStateRow> => {
  const result = await db.query<RuntimeAgentStateRow>(
    `select ${agentStateColumns}
     from ${agentStateTable}
     where id = 1
     for update`,
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('agent_state singleton row is missing');
  }

  return normalizeAgentStateRow(row);
};

const loadTickByRequestId = async (
  db: RuntimeDbExecutor,
  requestId: string,
): Promise<RuntimeTickRow | null> => {
  const result = await db.query<RuntimeTickRow>(
    `select ${tickColumns}
     from ${tickTable}
     where request_id = $1`,
    [requestId],
  );

  return result.rows[0] ? normalizeTickRow(result.rows[0]) : null;
};

const loadTickById = async (
  db: RuntimeDbExecutor,
  tickId: string,
): Promise<RuntimeTickRow | null> => {
  const result = await db.query<RuntimeTickRow>(
    `select ${tickColumns}
     from ${tickTable}
     where tick_id = $1`,
    [tickId],
  );

  return result.rows[0] ? normalizeTickRow(result.rows[0]) : null;
};

const loadActiveTick = async (
  db: RuntimeDbExecutor,
  agentId: string,
): Promise<RuntimeTickRow | null> => {
  const result = await db.query<RuntimeTickRow>(
    `select ${tickColumns}
     from ${tickTable}
     where agent_id = $1
       and status = $2
       and ended_at is null
     order by started_at desc
     limit 1
     for update`,
    [agentId, TICK_STATUS.STARTED],
  );

  return result.rows[0] ? normalizeTickRow(result.rows[0]) : null;
};

const insertTickStarted = async (
  db: RuntimeDbExecutor,
  input: TickRequestInput,
  startedAt: string,
  leaseExpiresAt: string,
): Promise<RuntimeTickRow> => {
  const tickId = randomUUID();
  const result = await db.query<RuntimeTickRow>(
    `insert into ${tickTable} (
      tick_id,
      agent_id,
      request_id,
      tick_kind,
      trigger_kind,
      status,
      queued_at,
      started_at,
      lease_owner,
      lease_expires_at,
      request_json,
      continuity_flags_json,
      updated_at
    ) values (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, '{}'::jsonb, now()
    )
    returning ${tickColumns}`,
    [
      tickId,
      input.agentId ?? DEFAULT_RUNTIME_AGENT_ID,
      input.requestId,
      input.kind,
      input.trigger,
      TICK_STATUS.STARTED,
      startedAt,
      startedAt,
      input.leaseOwner ?? DEFAULT_RUNTIME_LEASE_OWNER,
      leaseExpiresAt,
      input.payload ?? {},
    ],
  );

  const tick = result.rows[0];
  if (!tick) {
    throw new Error('failed to create started tick');
  }

  return normalizeTickRow(tick);
};

const updateAgentCurrentTick = async (
  db: RuntimeDbExecutor,
  tickId: string | null,
): Promise<RuntimeAgentStateRow> => {
  const result = await db.query<RuntimeAgentStateRow>(
    `update ${agentStateTable}
     set current_tick_id = $1,
         updated_at = now()
     where id = 1
     returning ${agentStateColumns}`,
    [tickId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('failed to update agent_state.current_tick');
  }

  return normalizeAgentStateRow(row);
};

const updateAgentBootState = async (
  db: RuntimeDbExecutor,
  input: BootStateBridge,
): Promise<RuntimeAgentStateRow> => {
  const result = await db.query<RuntimeAgentStateRow>(
    `update ${agentStateTable}
     set mode = $1,
         schema_version = $2,
         boot_state_json = $3::jsonb,
         last_stable_snapshot_id = $4,
         updated_at = now()
     where id = 1
     returning ${agentStateColumns}`,
    [
      input.mode,
      input.schemaVersion,
      JSON.stringify({
        mode: input.mode,
        schemaVersion: input.schemaVersion,
        dependencyResults: input.dependencyResults,
        degradedDependencies: input.degradedDependencies,
        snapshotId: input.snapshotId,
      }),
      input.snapshotId,
    ],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('failed to update boot state');
  }

  return normalizeAgentStateRow(row);
};

const updateAgentDevelopmentFreeze = async (
  db: RuntimeDbExecutor,
  developmentFreeze: boolean,
): Promise<RuntimeAgentStateRow> => {
  const result = await db.query<RuntimeAgentStateRow>(
    `update ${agentStateTable}
     set development_freeze = $1,
         updated_at = now()
     where id = 1
     returning ${agentStateColumns}`,
    [developmentFreeze],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('failed to update development freeze state');
  }

  return normalizeAgentStateRow(row);
};

const appendTimelineEventRow = async (
  db: RuntimeDbExecutor,
  input: RuntimeTimelineEventInput,
): Promise<RuntimeTimelineEventRow> => {
  const result = await db.query<RuntimeTimelineEventRow>(
    `insert into ${timelineEventTable} (
      event_id,
      event_type,
      occurred_at,
      subject_ref,
      payload_json,
      created_at
    ) values (
      $1, $2, $3, $4, $5::jsonb, now()
    )
    returning ${timelineEventColumns}`,
    [
      input.eventId ?? randomUUID(),
      input.eventType,
      toTimestamp(input.occurredAt),
      input.subjectRef,
      input.payloadJson ?? {},
    ],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('failed to append timeline event');
  }

  return normalizeTimelineEventRow(row);
};

const insertEpisodeRow = async (
  db: RuntimeDbExecutor,
  input: TickFinalizationInput,
  tickId: string,
): Promise<RuntimeEpisodeRow> => {
  const result = await db.query<RuntimeEpisodeRow>(
    `insert into ${episodeTable} (
      episode_id,
      tick_id,
      summary,
      result_json,
      created_at
    ) values (
      $1, $2, $3, $4::jsonb, now()
    )
    returning ${episodeColumns}`,
    [randomUUID(), tickId, input.summary ?? '', JSON.stringify(input.resultJson ?? {})],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('failed to insert episode');
  }

  return normalizeEpisodeRow(row);
};

const finalizeTickRow = async (
  db: RuntimeDbExecutor,
  input: TickFinalizationInput,
  status: TickStatus,
  eventType: string,
): Promise<{
  tick: RuntimeTickRow;
  event: RuntimeTimelineEventRow;
}> => {
  const occurredAt = toTimestamp(input.occurredAt);
  return await transaction(db, async () => {
    await ensureAgentStateSeed(db, input.agentId ?? DEFAULT_RUNTIME_AGENT_ID);
    await lockAgentStateRow(db);

    const tickResult = await db.query<RuntimeTickRow>(
      `select ${tickColumns}
       from ${tickTable}
       where tick_id = $1
       for update`,
      [input.tickId],
    );
    const existingTick = tickResult.rows[0];
    if (!existingTick) {
      throw new Error(`tick ${input.tickId} was not found`);
    }
    if (existingTick.status !== TICK_STATUS.STARTED) {
      throw new Error(`tick ${input.tickId} is not active`);
    }

    const updatedTickResult = await db.query<RuntimeTickRow>(
      `update ${tickTable}
       set status = $2,
           ended_at = $3,
           result_json = $4::jsonb,
           failure_json = $5::jsonb,
           continuity_flags_json = $6::jsonb,
           updated_at = now()
       where tick_id = $1
       returning ${tickColumns}`,
      [
        input.tickId,
        status,
        occurredAt,
        JSON.stringify(input.resultJson ?? {}),
        JSON.stringify(input.failureJson ?? {}),
        JSON.stringify(input.continuityFlagsJson ?? {}),
      ],
    );

    const updatedTick = updatedTickResult.rows[0];
    if (!updatedTick) {
      throw new Error(`failed to update tick ${input.tickId}`);
    }

    await updateAgentCurrentTick(db, null);

    const eventInput: RuntimeTimelineEventInput = {
      eventType,
      subjectRef: input.tickId,
      payloadJson: {
        tickId: input.tickId,
        status,
        resultJson: input.resultJson ?? {},
        failureJson: input.failureJson ?? {},
        continuityFlagsJson: input.continuityFlagsJson ?? {},
      },
    };
    if (input.occurredAt) {
      eventInput.occurredAt = input.occurredAt;
    }

    const event = await appendTimelineEventRow(db, eventInput);

    return {
      tick: normalizeTickRow(updatedTick),
      event,
    };
  });
};

async function reclaimStaleTicksInternal(
  db: RuntimeDbExecutor,
  agentId: string,
  now: Date,
): Promise<RuntimeTickRow[]> {
  const staleTicksResult = await db.query<RuntimeTickRow>(
    `select ${tickColumns}
     from ${tickTable}
     where agent_id = $1
       and status = $2
       and ended_at is null
       and lease_expires_at < $3
     order by started_at asc
     for update skip locked`,
    [agentId, TICK_STATUS.STARTED, toTimestamp(now)],
  );

  const staleTicks = staleTicksResult.rows.map(normalizeTickRow);
  if (staleTicks.length === 0) {
    return [];
  }

  for (const tick of staleTicks) {
    await db.query(
      `update ${tickTable}
       set status = $2,
           ended_at = $3,
           failure_json = $4::jsonb,
           updated_at = now()
       where tick_id = $1`,
      [
        tick.tickId,
        TICK_STATUS.FAILED,
        toTimestamp(now),
        JSON.stringify({
          reason: 'stale_tick_reclaimed',
          leaseOwner: tick.leaseOwner,
          leaseExpiresAt: tick.leaseExpiresAt,
        }),
      ],
    );

    await appendTimelineEventRow(db, {
      eventType: 'tick.failed',
      subjectRef: tick.tickId,
      occurredAt: now,
      payloadJson: {
        tickId: tick.tickId,
        reason: 'stale_tick_reclaimed',
        leaseOwner: tick.leaseOwner,
        leaseExpiresAt: tick.leaseExpiresAt,
      },
    });
  }

  await db.query(
    `update ${agentStateTable}
     set current_tick_id = null,
         updated_at = now()
     where id = 1
       and current_tick_id = any($1::text[])`,
    [staleTicks.map((tick) => tick.tickId)],
  );

  return staleTicks;
}

export function createRuntimeDbClient(connectionString: string): Client {
  return new Client({ connectionString });
}

export function createTickRuntimeStore(
  db: RuntimeDbExecutor,
  options: {
    agentId?: string;
    leaseOwner?: string;
    leaseDurationMs?: number;
  } = {},
): RuntimeTickStore {
  const agentId = options.agentId ?? DEFAULT_RUNTIME_AGENT_ID;
  const leaseOwner = options.leaseOwner ?? DEFAULT_RUNTIME_LEASE_OWNER;
  const leaseDurationMs = options.leaseDurationMs ?? DEFAULT_RUNTIME_LEASE_DURATION_MS;

  return {
    async ensureAgentStateRow(nextAgentId = agentId): Promise<RuntimeAgentStateRow> {
      await ensureAgentStateSeed(db, nextAgentId);
      const row = await loadAgentStateRow(db);
      if (!row) {
        throw new Error('failed to load agent_state row');
      }
      return row;
    },

    async getAgentState(nextAgentId = agentId): Promise<RuntimeAgentStateRow | null> {
      await ensureAgentStateSeed(db, nextAgentId);
      return await loadAgentStateRow(db);
    },

    async setBootState(
      input: BootStateBridge,
      nextAgentId = agentId,
    ): Promise<RuntimeAgentStateRow> {
      await ensureAgentStateSeed(db, nextAgentId);
      return await updateAgentBootState(db, input);
    },

    async setCurrentTick(
      tickId: string | null,
      nextAgentId = agentId,
    ): Promise<RuntimeAgentStateRow> {
      await ensureAgentStateSeed(db, nextAgentId);
      return await updateAgentCurrentTick(db, tickId);
    },

    async setDevelopmentFreeze(
      developmentFreeze: boolean,
      nextAgentId = agentId,
    ): Promise<RuntimeAgentStateRow> {
      await ensureAgentStateSeed(db, nextAgentId);
      return await updateAgentDevelopmentFreeze(db, developmentFreeze);
    },

    async requestTick(input: TickRequestInput): Promise<TickAdmissionResult> {
      const nextAgentId = input.agentId ?? agentId;
      const nextLeaseOwner = input.leaseOwner ?? leaseOwner;
      const now = input.requestedAt ?? new Date();
      const startedAt = toTimestamp(now);
      const leaseExpiresAt = toTimestamp(
        new Date(now.getTime() + (input.leaseDurationMs ?? leaseDurationMs)),
      );

      await ensureAgentStateSeed(db, nextAgentId);

      return await transaction(db, async () => {
        const state = await lockAgentStateRow(db);
        if (state.mode === 'inactive') {
          return {
            accepted: false,
            reason: 'boot_inactive',
            activeTickId: state.currentTickId,
          } satisfies TickAdmissionRejected;
        }

        await reclaimStaleTicksInternal(db, nextAgentId, now);

        if (state.currentTickId) {
          const currentTick = await loadTickById(db, state.currentTickId);
          if (!currentTick || currentTick.status !== TICK_STATUS.STARTED || currentTick.endedAt) {
            await updateAgentCurrentTick(db, null);
          }
        }

        const existingByRequest = await loadTickByRequestId(db, input.requestId);
        if (existingByRequest) {
          if (existingByRequest.status === TICK_STATUS.STARTED) {
            await updateAgentCurrentTick(db, existingByRequest.tickId);
          }

          return {
            accepted: true,
            deduplicated: true,
            tick: existingByRequest,
          } satisfies TickAdmissionAccepted;
        }

        const activeTick = await loadActiveTick(db, nextAgentId);
        if (activeTick) {
          return {
            accepted: false,
            reason: 'lease_busy',
            activeTickId: activeTick.tickId,
          } satisfies TickAdmissionRejected;
        }

        const tick = await insertTickStarted(
          db,
          {
            ...input,
            agentId: nextAgentId,
            leaseOwner: nextLeaseOwner,
          },
          startedAt,
          leaseExpiresAt,
        );

        await updateAgentCurrentTick(db, tick.tickId);

        await appendTimelineEventRow(db, {
          eventType: 'tick.started',
          subjectRef: tick.tickId,
          occurredAt: now,
          payloadJson: {
            tickId: tick.tickId,
            requestId: input.requestId,
            tickKind: input.kind,
            triggerKind: input.trigger,
            leaseOwner: nextLeaseOwner,
            leaseExpiresAt,
            requestJson: input.payload ?? {},
          },
        });

        return {
          accepted: true,
          deduplicated: false,
          tick,
        } satisfies TickAdmissionAccepted;
      });
    },

    async completeTick(input: TickFinalizationInput): Promise<{
      tick: RuntimeTickRow;
      episode: RuntimeEpisodeRow;
      event: RuntimeTimelineEventRow;
    }> {
      const nextAgentId = input.agentId ?? agentId;
      const occurredAt = input.occurredAt ?? new Date();
      await ensureAgentStateSeed(db, nextAgentId);

      return await transaction(db, async () => {
        const state = await lockAgentStateRow(db);

        const tickResult = await db.query<RuntimeTickRow>(
          `select ${tickColumns}
           from ${tickTable}
           where tick_id = $1
           for update`,
          [input.tickId],
        );
        const existingTick = tickResult.rows[0];
        if (!existingTick) {
          throw new Error(`tick ${input.tickId} was not found`);
        }
        if (existingTick.status !== TICK_STATUS.STARTED) {
          throw new Error(`tick ${input.tickId} is not active`);
        }

        if (state.currentTickId && state.currentTickId !== input.tickId) {
          const currentTick = await loadTickById(db, state.currentTickId);
          if (!currentTick || currentTick.status !== TICK_STATUS.STARTED || currentTick.endedAt) {
            await updateAgentCurrentTick(db, null);
          }
        }

        const updatedTickResult = await db.query<RuntimeTickRow>(
          `update ${tickTable}
           set status = $2,
               ended_at = $3,
               result_json = $4::jsonb,
               failure_json = '{}'::jsonb,
               continuity_flags_json = $5::jsonb,
               updated_at = now()
           where tick_id = $1
           returning ${tickColumns}`,
          [
            input.tickId,
            TICK_STATUS.COMPLETED,
            toTimestamp(occurredAt),
            JSON.stringify(input.resultJson ?? {}),
            JSON.stringify(input.continuityFlagsJson ?? {}),
          ],
        );
        const tick = updatedTickResult.rows[0];
        if (!tick) {
          throw new Error(`failed to complete tick ${input.tickId}`);
        }

        const episode = await insertEpisodeRow(
          db,
          {
            ...input,
            summary: input.summary ?? '',
          },
          input.tickId,
        );

        await updateAgentCurrentTick(db, null);

        const event = await appendTimelineEventRow(db, {
          eventType: 'tick.completed',
          subjectRef: input.tickId,
          occurredAt,
          payloadJson: {
            tickId: input.tickId,
            episodeId: episode.episodeId,
            summary: episode.summary,
            resultJson: episode.resultJson,
          },
        });

        return {
          tick: normalizeTickRow(tick),
          episode,
          event,
        };
      });
    },

    async failTick(input: TickFinalizationInput): Promise<{
      tick: RuntimeTickRow;
      event: RuntimeTimelineEventRow;
    }> {
      return await finalizeTickRow(
        db,
        {
          ...input,
          agentId: input.agentId ?? agentId,
        },
        TICK_STATUS.FAILED,
        'tick.failed',
      );
    },

    async cancelTick(input: TickFinalizationInput): Promise<{
      tick: RuntimeTickRow;
      event: RuntimeTimelineEventRow;
    }> {
      return await finalizeTickRow(
        db,
        {
          ...input,
          agentId: input.agentId ?? agentId,
        },
        TICK_STATUS.CANCELLED,
        'tick.cancelled',
      );
    },

    async reclaimStaleTicks(options?: { agentId?: string; now?: Date }): Promise<number> {
      const nextAgentId = options?.agentId ?? agentId;
      const now = options?.now ?? new Date();

      await ensureAgentStateSeed(db, nextAgentId);

      return await transaction(db, async () => {
        await lockAgentStateRow(db);
        const staleTicks = await reclaimStaleTicksInternal(db, nextAgentId, now);
        return staleTicks.length;
      });
    },

    async appendTimelineEvent(input: RuntimeTimelineEventInput): Promise<RuntimeTimelineEventRow> {
      return await appendTimelineEventRow(db, input);
    },
  };
}

export async function ensureRuntimeAgentStateRow(
  db: RuntimeDbExecutor,
  agentId = DEFAULT_RUNTIME_AGENT_ID,
): Promise<RuntimeAgentStateRow> {
  await ensureAgentStateSeed(db, agentId);
  const row = await loadAgentStateRow(db);
  if (!row) {
    throw new Error('failed to load agent_state row');
  }

  return row;
}

export async function getRuntimeAgentStateRow(
  db: RuntimeDbExecutor,
  agentId = DEFAULT_RUNTIME_AGENT_ID,
): Promise<RuntimeAgentStateRow | null> {
  await ensureAgentStateSeed(db, agentId);
  return await loadAgentStateRow(db);
}

export async function setRuntimeBootState(
  db: RuntimeDbExecutor,
  input: BootStateBridge,
  agentId = DEFAULT_RUNTIME_AGENT_ID,
): Promise<RuntimeAgentStateRow> {
  await ensureAgentStateSeed(db, agentId);
  return await updateAgentBootState(db, input);
}

export async function setRuntimeCurrentTick(
  db: RuntimeDbExecutor,
  tickId: string | null,
  agentId = DEFAULT_RUNTIME_AGENT_ID,
): Promise<RuntimeAgentStateRow> {
  await ensureAgentStateSeed(db, agentId);
  return await updateAgentCurrentTick(db, tickId);
}

export async function setRuntimeDevelopmentFreeze(
  db: RuntimeDbExecutor,
  developmentFreeze: boolean,
  agentId = DEFAULT_RUNTIME_AGENT_ID,
): Promise<RuntimeAgentStateRow> {
  await ensureAgentStateSeed(db, agentId);
  return await updateAgentDevelopmentFreeze(db, developmentFreeze);
}

export async function appendRuntimeTimelineEvent(
  db: RuntimeDbExecutor,
  input: RuntimeTimelineEventInput,
): Promise<RuntimeTimelineEventRow> {
  return await appendTimelineEventRow(db, input);
}

export async function reclaimRuntimeStaleTicks(
  db: RuntimeDbExecutor,
  options: {
    agentId?: string;
    now?: Date;
  } = {},
): Promise<number> {
  const agentId = options.agentId ?? DEFAULT_RUNTIME_AGENT_ID;
  const now = options.now ?? new Date();

  await ensureAgentStateSeed(db, agentId);
  return await transaction(db, async () => {
    await lockAgentStateRow(db);
    const staleTicks = await reclaimStaleTicksInternal(db, agentId, now);
    return staleTicks.length;
  });
}
