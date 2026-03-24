import type { Client, QueryResultRow } from 'pg';

export type ModelRoutingDbExecutor = Pick<Client, 'query'>;

const RUNTIME_SCHEMA = 'polyphony_runtime';

const runtimeSchemaTable = (table: string): string => `${RUNTIME_SCHEMA}.${table}`;

const modelRegistryTable = runtimeSchemaTable('model_registry');
const tickTable = runtimeSchemaTable('ticks');
const agentStateTable = runtimeSchemaTable('agent_state');

export const MODEL_PROFILE_ROLE = Object.freeze({
  REFLEX: 'reflex',
  DELIBERATION: 'deliberation',
  REFLECTION: 'reflection',
  CODE: 'code',
  EMBEDDING: 'embedding',
  RERANKER: 'reranker',
  CLASSIFIER: 'classifier',
  SAFETY: 'safety',
} as const);

export type ModelProfileRole = (typeof MODEL_PROFILE_ROLE)[keyof typeof MODEL_PROFILE_ROLE];

export const BASELINE_MODEL_PROFILE_ROLE = Object.freeze({
  REFLEX: MODEL_PROFILE_ROLE.REFLEX,
  DELIBERATION: MODEL_PROFILE_ROLE.DELIBERATION,
  REFLECTION: MODEL_PROFILE_ROLE.REFLECTION,
} as const);

export type BaselineModelProfileRole =
  (typeof BASELINE_MODEL_PROFILE_ROLE)[keyof typeof BASELINE_MODEL_PROFILE_ROLE];

export const MODEL_PROFILE_STATUS = Object.freeze({
  ACTIVE: 'active',
  DEGRADED: 'degraded',
  DISABLED: 'disabled',
} as const);

export type ModelProfileStatus = (typeof MODEL_PROFILE_STATUS)[keyof typeof MODEL_PROFILE_STATUS];

export const MODEL_SELECTION_CONTINUITY_KEY = 'modelSelection';

export type RuntimeModelProfileRow = {
  modelProfileId: string;
  role: ModelProfileRole;
  endpoint: string;
  artifactUri: string | null;
  baseModel: string;
  adapterOf: string | null;
  capabilitiesJson: string[];
  costJson: Record<string, unknown>;
  healthJson: Record<string, unknown>;
  status: ModelProfileStatus;
  createdAt: string;
  updatedAt: string;
};

export type RuntimeModelProfileSeedInput = {
  modelProfileId: string;
  role: ModelProfileRole;
  endpoint: string;
  artifactUri?: string | null;
  baseModel: string;
  adapterOf?: string | null;
  capabilities: string[];
  costJson?: Record<string, unknown>;
  healthJson?: Record<string, unknown>;
  status?: ModelProfileStatus;
};

export type RuntimeModelProfileSelectionInput = {
  tickId: string;
  modelProfileId: string;
  selectionReasonJson?: Record<string, unknown>;
};

export type RuntimeTickSelectionRow = {
  tickId: string;
  status: 'started' | 'completed' | 'failed' | 'cancelled';
  endedAt: string | null;
  continuityFlagsJson: Record<string, unknown>;
  selectedModelProfileId: string | null;
};

export type RuntimeModelSelectionPersistenceResult = {
  tickId: string;
  selectedModelProfileId: string;
  currentModelProfileId: string;
  continuityFlagsJson: Record<string, unknown>;
};

export type RuntimeModelProfileStore = {
  ensureModelProfiles(profiles: RuntimeModelProfileSeedInput[]): Promise<RuntimeModelProfileRow[]>;
  listModelProfiles(input?: { roles?: ModelProfileRole[] }): Promise<RuntimeModelProfileRow[]>;
  persistTickModelSelection(
    input: RuntimeModelProfileSelectionInput,
  ): Promise<RuntimeModelSelectionPersistenceResult>;
  setCurrentModelProfile(modelProfileId: string | null): Promise<void>;
};

const transaction = async <T>(db: ModelRoutingDbExecutor, run: () => Promise<T>): Promise<T> => {
  await db.query('begin');
  try {
    const result = await run();
    await db.query('commit');
    return result;
  } catch (error) {
    try {
      await db.query('rollback');
    } catch {
      // Ignore rollback failures; the original error is the useful one.
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

const modelProfileColumns = `
  model_profile_id as "modelProfileId",
  role,
  endpoint,
  artifact_uri as "artifactUri",
  base_model as "baseModel",
  adapter_of as "adapterOf",
  capabilities_json as "capabilitiesJson",
  cost_json as "costJson",
  health_json as "healthJson",
  status,
  created_at::text as "createdAt",
  updated_at::text as "updatedAt"
`;

const tickSelectionColumns = `
  tick_id as "tickId",
  status,
  ended_at as "endedAt",
  continuity_flags_json as "continuityFlagsJson",
  selected_model_profile_id as "selectedModelProfileId"
`;

const normalizeModelProfileRow = (row: QueryResultRow): RuntimeModelProfileRow => {
  const profile = row as unknown as RuntimeModelProfileRow;

  return {
    ...profile,
    capabilitiesJson: toStringArray(profile.capabilitiesJson),
    costJson: toRecord(profile.costJson),
    healthJson: toRecord(profile.healthJson),
  };
};

const normalizeTickSelectionRow = (row: QueryResultRow): RuntimeTickSelectionRow => {
  const tick = row as unknown as RuntimeTickSelectionRow;

  return {
    ...tick,
    continuityFlagsJson: toRecord(tick.continuityFlagsJson),
  };
};

const mergeSelectionContinuity = (
  current: Record<string, unknown>,
  input: RuntimeModelProfileSelectionInput,
): Record<string, unknown> => ({
  ...current,
  [MODEL_SELECTION_CONTINUITY_KEY]: {
    modelProfileId: input.modelProfileId,
    ...(input.selectionReasonJson ?? {}),
  },
});

async function upsertModelProfile(
  db: ModelRoutingDbExecutor,
  profile: RuntimeModelProfileSeedInput,
): Promise<RuntimeModelProfileRow> {
  const result = await db.query<RuntimeModelProfileRow>(
    `insert into ${modelRegistryTable} (
      model_profile_id,
      role,
      endpoint,
      artifact_uri,
      base_model,
      adapter_of,
      capabilities_json,
      cost_json,
      health_json,
      status,
      updated_at
    ) values (
      $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, now()
    )
    on conflict (model_profile_id) do update
      set role = excluded.role,
          endpoint = excluded.endpoint,
          artifact_uri = excluded.artifact_uri,
          base_model = excluded.base_model,
          adapter_of = excluded.adapter_of,
          capabilities_json = excluded.capabilities_json,
          cost_json = excluded.cost_json,
          health_json = excluded.health_json,
          status = excluded.status,
          updated_at = now()
    returning ${modelProfileColumns}`,
    [
      profile.modelProfileId,
      profile.role,
      profile.endpoint,
      profile.artifactUri ?? null,
      profile.baseModel,
      profile.adapterOf ?? null,
      JSON.stringify(profile.capabilities),
      JSON.stringify(profile.costJson ?? {}),
      JSON.stringify(profile.healthJson ?? {}),
      profile.status ?? MODEL_PROFILE_STATUS.ACTIVE,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error(`failed to upsert model profile ${profile.modelProfileId}`);
  }

  return normalizeModelProfileRow(row);
}

async function listModelProfilesInternal(
  db: ModelRoutingDbExecutor,
  input?: { roles?: ModelProfileRole[] },
): Promise<RuntimeModelProfileRow[]> {
  const roles = input?.roles?.length ? input.roles : null;

  const result = roles
    ? await db.query<RuntimeModelProfileRow>(
        `select ${modelProfileColumns}
         from ${modelRegistryTable}
         where role = any($1::text[])
         order by role asc, model_profile_id asc`,
        [roles],
      )
    : await db.query<RuntimeModelProfileRow>(
        `select ${modelProfileColumns}
         from ${modelRegistryTable}
         order by role asc, model_profile_id asc`,
      );

  return result.rows.map(normalizeModelProfileRow);
}

async function updateRuntimeCurrentModelProfileInternal(
  db: ModelRoutingDbExecutor,
  modelProfileId: string | null,
): Promise<void> {
  await db.query(
    `update ${agentStateTable}
     set current_model_profile_id = $1,
         updated_at = now()
     where id = 1`,
    [modelProfileId],
  );
}

export async function setRuntimeCurrentModelProfile(
  db: ModelRoutingDbExecutor,
  modelProfileId: string | null,
): Promise<void> {
  await updateRuntimeCurrentModelProfileInternal(db, modelProfileId);
}

async function persistTickModelSelectionInternal(
  db: ModelRoutingDbExecutor,
  input: RuntimeModelProfileSelectionInput,
): Promise<RuntimeModelSelectionPersistenceResult> {
  return await transaction(db, async () => {
    const tickResult = await db.query<RuntimeTickSelectionRow>(
      `select ${tickSelectionColumns}
       from ${tickTable}
       where tick_id = $1
       for update`,
      [input.tickId],
    );
    const tick = tickResult.rows[0];
    if (!tick) {
      throw new Error(`tick ${input.tickId} was not found`);
    }

    const currentTick = normalizeTickSelectionRow(tick);
    if (currentTick.status !== 'started' || currentTick.endedAt) {
      throw new Error(`tick ${input.tickId} is not active`);
    }

    const continuityFlagsJson = mergeSelectionContinuity(currentTick.continuityFlagsJson, input);
    const updatedTickResult = await db.query<RuntimeTickSelectionRow>(
      `update ${tickTable}
       set selected_model_profile_id = $2,
           continuity_flags_json = $3::jsonb,
           updated_at = now()
       where tick_id = $1
       returning ${tickSelectionColumns}`,
      [input.tickId, input.modelProfileId, JSON.stringify(continuityFlagsJson)],
    );
    const updatedTick = updatedTickResult.rows[0];
    if (!updatedTick) {
      throw new Error(`failed to persist model selection for tick ${input.tickId}`);
    }

    await updateRuntimeCurrentModelProfileInternal(db, input.modelProfileId);

    return {
      tickId: input.tickId,
      selectedModelProfileId: input.modelProfileId,
      currentModelProfileId: input.modelProfileId,
      continuityFlagsJson: normalizeTickSelectionRow(updatedTick).continuityFlagsJson,
    };
  });
}

export function createRuntimeModelProfileStore(
  db: ModelRoutingDbExecutor,
): RuntimeModelProfileStore {
  return {
    async ensureModelProfiles(
      profiles: RuntimeModelProfileSeedInput[],
    ): Promise<RuntimeModelProfileRow[]> {
      return await transaction(db, async () => {
        const seededProfiles: RuntimeModelProfileRow[] = [];

        for (const profile of profiles) {
          seededProfiles.push(await upsertModelProfile(db, profile));
        }

        return seededProfiles;
      });
    },

    listModelProfiles(input?: { roles?: ModelProfileRole[] }): Promise<RuntimeModelProfileRow[]> {
      return listModelProfilesInternal(db, input);
    },

    persistTickModelSelection(
      input: RuntimeModelProfileSelectionInput,
    ): Promise<RuntimeModelSelectionPersistenceResult> {
      return persistTickModelSelectionInternal(db, input);
    },

    setCurrentModelProfile(modelProfileId: string | null): Promise<void> {
      return updateRuntimeCurrentModelProfileInternal(db, modelProfileId);
    },
  };
}
