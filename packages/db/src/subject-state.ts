import type { Client, QueryResultRow } from 'pg';

export type SubjectStateDbExecutor = Pick<Client, 'query'>;

const RUNTIME_SCHEMA = 'polyphony_runtime';
const DEFAULT_GOAL_LIMIT = 25;
const DEFAULT_BELIEF_LIMIT = 25;
const DEFAULT_ENTITY_LIMIT = 25;
const DEFAULT_RELATIONSHIP_LIMIT = 50;

const runtimeSchemaTable = (table: string): string => `${RUNTIME_SCHEMA}.${table}`;

const agentStateTable = runtimeSchemaTable('agent_state');
const tickTable = runtimeSchemaTable('ticks');
const episodeTable = runtimeSchemaTable('episodes');
const goalsTable = runtimeSchemaTable('goals');
const beliefsTable = runtimeSchemaTable('beliefs');
const entitiesTable = runtimeSchemaTable('entities');
const relationshipsTable = runtimeSchemaTable('relationships');

const transaction = async <T>(db: SubjectStateDbExecutor, run: () => Promise<T>): Promise<T> => {
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

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

export type EvidenceRef = {
  tickId?: string;
  episodeId?: string;
  kind: 'tick' | 'episode' | 'system' | 'operator';
  note?: string;
};

export type SubjectStateAgentStateSnapshot = {
  agentId: string;
  mode: 'inactive' | 'normal' | 'degraded' | 'recovery';
  currentTickId: string | null;
  currentModelProfileId: string | null;
  lastStableSnapshotId: string | null;
  psmJson: Record<string, unknown>;
  resourcePostureJson: Record<string, unknown>;
};

export type SubjectStateGoalSnapshot = {
  goalId: string;
  title: string;
  status: 'proposed' | 'active' | 'blocked' | 'completed' | 'abandoned';
  priority: number;
  goalType: string;
  parentGoalId: string | null;
  rationaleJson: Record<string, unknown>;
  evidenceRefs: EvidenceRef[];
  updatedAt: string;
};

export type SubjectStateBeliefSnapshot = {
  beliefId: string;
  topic: string;
  proposition: string;
  confidence: number;
  status: 'candidate' | 'active' | 'superseded' | 'rejected';
  evidenceRefs: EvidenceRef[];
  updatedAt: string;
};

export type SubjectStateEntitySnapshot = {
  entityId: string;
  entityKind: string;
  canonicalName: string;
  stateJson: Record<string, unknown>;
  trustJson: Record<string, unknown>;
  lastSeenAt: string | null;
  updatedAt: string;
};

export type SubjectStateRelationshipSnapshot = {
  srcEntityId: string;
  dstEntityId: string;
  relationKind: string;
  confidence: number;
  updatedAt: string;
};

export type SubjectStateSnapshot = {
  agentState: SubjectStateAgentStateSnapshot;
  goals: SubjectStateGoalSnapshot[];
  beliefs: SubjectStateBeliefSnapshot[];
  entities: SubjectStateEntitySnapshot[];
  relationships: SubjectStateRelationshipSnapshot[];
};

export type SubjectStateGoalUpsert = {
  goalId: string;
  title?: string;
  status?: SubjectStateGoalSnapshot['status'];
  priority?: number;
  goalType?: string;
  parentGoalId?: string | null;
  rationaleJson?: Record<string, unknown>;
  evidenceRefs?: EvidenceRef[];
};

export type SubjectStateBeliefUpsert = {
  beliefId: string;
  topic?: string;
  proposition?: string;
  confidence?: number;
  status?: SubjectStateBeliefSnapshot['status'];
  evidenceRefs?: EvidenceRef[];
};

export type SubjectStateEntityUpsert = {
  entityId: string;
  entityKind?: string;
  canonicalName?: string;
  stateJson?: Record<string, unknown>;
  trustJson?: Record<string, unknown>;
  lastSeenAt?: string | null;
};

export type SubjectStateRelationshipUpsert = {
  srcEntityId: string;
  dstEntityId: string;
  relationKind: string;
  confidence?: number;
};

export type SubjectStateDelta = {
  agentStatePatch?: {
    psmJson?: Record<string, unknown>;
    resourcePostureJson?: Record<string, unknown>;
    currentModelProfileId?: string | null;
    lastStableSnapshotId?: string | null;
  };
  goalUpserts?: SubjectStateGoalUpsert[];
  beliefUpserts?: SubjectStateBeliefUpsert[];
  entityUpserts?: SubjectStateEntityUpsert[];
  relationshipUpserts?: SubjectStateRelationshipUpsert[];
};

export type LoadSubjectStateSnapshotInput = {
  tickId?: string;
  goalLimit?: number;
  beliefLimit?: number;
  entityLimit?: number;
  relationshipLimit?: number;
};

export type SubjectStateSnapshotInput = LoadSubjectStateSnapshotInput;
export type SubjectGoal = SubjectStateGoalSnapshot;
export type SubjectBelief = SubjectStateBeliefSnapshot;
export type SubjectEntity = SubjectStateEntitySnapshot;
export type SubjectRelationship = SubjectStateRelationshipSnapshot;
export type SubjectStateAgentPatch = NonNullable<SubjectStateDelta['agentStatePatch']>;
export type GoalUpsert = SubjectStateGoalUpsert;
export type BeliefUpsert = SubjectStateBeliefUpsert;
export type EntityUpsert = SubjectStateEntityUpsert;
export type RelationshipUpsert = SubjectStateRelationshipUpsert;

export type SubjectStateStore = {
  ensureSubjectStateAnchor(): Promise<SubjectStateSnapshot['agentState']>;
  loadSubjectStateSnapshot(input?: SubjectStateSnapshotInput): Promise<SubjectStateSnapshot>;
  applyTickStateDelta(input: ApplyTickStateDeltaInput): Promise<void>;
};

export type ApplyTickStateDeltaInput = {
  tickId: string;
  terminalStatus: 'completed';
  episodeId: string;
  delta: SubjectStateDelta;
};

type AgentStateSubjectRow = {
  agentId: string;
  mode: SubjectStateAgentStateSnapshot['mode'];
  currentTickId: string | null;
  currentModelProfileId: string | null;
  lastStableSnapshotId: string | null;
  psmJson: Record<string, unknown>;
  resourcePostureJson: Record<string, unknown>;
};

type GoalRow = {
  goalId: string;
  title: string;
  status: SubjectStateGoalSnapshot['status'];
  priority: number;
  goalType: string;
  parentGoalId: string | null;
  rationaleJson: Record<string, unknown>;
  evidenceRefsJson: unknown;
  updatedAt: string;
};

type BeliefRow = {
  beliefId: string;
  topic: string;
  proposition: string;
  confidence: number | string;
  status: SubjectStateBeliefSnapshot['status'];
  evidenceRefsJson: unknown;
  updatedAt: string;
};

type EntityRow = {
  entityId: string;
  entityKind: string;
  canonicalName: string;
  stateJson: Record<string, unknown>;
  trustJson: Record<string, unknown>;
  lastSeenAt: string | null;
  updatedAt: string;
};

type RelationshipRow = {
  srcEntityId: string;
  dstEntityId: string;
  relationKind: string;
  confidence: number | string;
  updatedAt: string;
};

const agentStateSnapshotColumns = `
  agent_id as "agentId",
  mode,
  current_tick_id as "currentTickId",
  current_model_profile_id as "currentModelProfileId",
  last_stable_snapshot_id as "lastStableSnapshotId",
  psm_json as "psmJson",
  resource_posture_json as "resourcePostureJson"
`;

const goalColumns = `
  goal_id as "goalId",
  title,
  status,
  priority,
  goal_type as "goalType",
  parent_goal_id as "parentGoalId",
  rationale_json as "rationaleJson",
  evidence_refs_json as "evidenceRefsJson",
  updated_at::text as "updatedAt"
`;

const beliefColumns = `
  belief_id as "beliefId",
  topic,
  proposition,
  confidence::float8 as "confidence",
  status,
  evidence_refs_json as "evidenceRefsJson",
  updated_at::text as "updatedAt"
`;

const entityColumns = `
  entity_id as "entityId",
  entity_kind as "entityKind",
  canonical_name as "canonicalName",
  state_json as "stateJson",
  trust_json as "trustJson",
  last_seen_at::text as "lastSeenAt",
  updated_at::text as "updatedAt"
`;

const relationshipColumns = `
  src_entity_id as "srcEntityId",
  dst_entity_id as "dstEntityId",
  relation_kind as "relationKind",
  confidence::float8 as "confidence",
  updated_at::text as "updatedAt"
`;

export const normalizeEvidenceRefs = (value: unknown): EvidenceRef[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const refs: EvidenceRef[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      continue;
    }

    const candidate = entry as Record<string, unknown>;
    const kind = candidate['kind'];
    if (kind !== 'tick' && kind !== 'episode' && kind !== 'system' && kind !== 'operator') {
      continue;
    }

    const tickId =
      typeof candidate['tickId'] === 'string' && candidate['tickId'].length > 0
        ? candidate['tickId']
        : undefined;
    const episodeId =
      typeof candidate['episodeId'] === 'string' && candidate['episodeId'].length > 0
        ? candidate['episodeId']
        : undefined;
    const note =
      typeof candidate['note'] === 'string' && candidate['note'].length > 0
        ? candidate['note']
        : undefined;

    const key = `${tickId ?? ''}|${episodeId ?? ''}|${kind}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    refs.push({
      ...(tickId ? { tickId } : {}),
      ...(episodeId ? { episodeId } : {}),
      kind,
      ...(note ? { note } : {}),
    });
  }

  return refs;
};

const mergeEvidenceRefs = (current: unknown, next: EvidenceRef[] | undefined): EvidenceRef[] =>
  normalizeEvidenceRefs([...normalizeEvidenceRefs(current), ...(next ?? [])]);

const normalizeGoalRow = (row: QueryResultRow): SubjectStateGoalSnapshot => {
  const goal = row as unknown as GoalRow;
  return {
    goalId: goal.goalId,
    title: goal.title,
    status: goal.status,
    priority: goal.priority,
    goalType: goal.goalType,
    parentGoalId: goal.parentGoalId,
    rationaleJson: toRecord(goal.rationaleJson),
    evidenceRefs: normalizeEvidenceRefs(goal.evidenceRefsJson),
    updatedAt: goal.updatedAt,
  };
};

const normalizeBeliefRow = (row: QueryResultRow): SubjectStateBeliefSnapshot => {
  const belief = row as unknown as BeliefRow;
  return {
    beliefId: belief.beliefId,
    topic: belief.topic,
    proposition: belief.proposition,
    confidence: toNumber(belief.confidence),
    status: belief.status,
    evidenceRefs: normalizeEvidenceRefs(belief.evidenceRefsJson),
    updatedAt: belief.updatedAt,
  };
};

const normalizeEntityRow = (row: QueryResultRow): SubjectStateEntitySnapshot => {
  const entity = row as unknown as EntityRow;
  return {
    entityId: entity.entityId,
    entityKind: entity.entityKind,
    canonicalName: entity.canonicalName,
    stateJson: toRecord(entity.stateJson),
    trustJson: toRecord(entity.trustJson),
    lastSeenAt: entity.lastSeenAt,
    updatedAt: entity.updatedAt,
  };
};

const normalizeRelationshipRow = (row: QueryResultRow): SubjectStateRelationshipSnapshot => {
  const relationship = row as unknown as RelationshipRow;
  return {
    srcEntityId: relationship.srcEntityId,
    dstEntityId: relationship.dstEntityId,
    relationKind: relationship.relationKind,
    confidence: toNumber(relationship.confidence),
    updatedAt: relationship.updatedAt,
  };
};

const loadAgentStateSnapshot = async (
  db: SubjectStateDbExecutor,
): Promise<SubjectStateAgentStateSnapshot> => {
  const result = await db.query<AgentStateSubjectRow>(
    `select ${agentStateSnapshotColumns}
     from ${agentStateTable}
     where id = 1`,
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('agent_state singleton row is missing');
  }

  return {
    agentId: row.agentId,
    mode: row.mode,
    currentTickId: row.currentTickId,
    currentModelProfileId: row.currentModelProfileId,
    lastStableSnapshotId: row.lastStableSnapshotId,
    psmJson: toRecord(row.psmJson),
    resourcePostureJson: toRecord(row.resourcePostureJson),
  };
};

const loadGoalSnapshots = async (
  db: SubjectStateDbExecutor,
  limit: number,
): Promise<SubjectStateGoalSnapshot[]> => {
  const result = await db.query<GoalRow>(
    `select ${goalColumns}
     from ${goalsTable}
     where status in ('proposed', 'active', 'blocked')
     order by priority desc, updated_at desc, goal_id asc
     limit $1`,
    [limit],
  );

  return result.rows.map(normalizeGoalRow);
};

const loadBeliefSnapshots = async (
  db: SubjectStateDbExecutor,
  limit: number,
): Promise<SubjectStateBeliefSnapshot[]> => {
  const result = await db.query<BeliefRow>(
    `select ${beliefColumns}
     from ${beliefsTable}
     order by confidence desc, updated_at desc, belief_id asc
     limit $1`,
    [limit],
  );

  return result.rows.map(normalizeBeliefRow);
};

const loadEntitySnapshots = async (
  db: SubjectStateDbExecutor,
  limit: number,
): Promise<SubjectStateEntitySnapshot[]> => {
  const result = await db.query<EntityRow>(
    `select ${entityColumns}
     from ${entitiesTable}
     order by canonical_name asc, last_seen_at desc nulls last, updated_at desc, entity_id asc
     limit $1`,
    [limit],
  );

  return result.rows.map(normalizeEntityRow);
};

const loadRelationshipSnapshots = async (
  db: SubjectStateDbExecutor,
  entityIds: string[],
  limit: number,
): Promise<SubjectStateRelationshipSnapshot[]> => {
  if (entityIds.length === 0) {
    return [];
  }

  const result = await db.query<RelationshipRow>(
    `select ${relationshipColumns}
     from ${relationshipsTable}
     where src_entity_id = any($1::text[])
       and dst_entity_id = any($1::text[])
     order by updated_at desc, src_entity_id asc, dst_entity_id asc, relation_kind asc
     limit $2`,
    [entityIds, limit],
  );

  return result.rows.map(normalizeRelationshipRow);
};

const loadExistingGoalRow = async (
  db: SubjectStateDbExecutor,
  goalId: string,
): Promise<GoalRow | null> => {
  const result = await db.query<GoalRow>(
    `select ${goalColumns}
     from ${goalsTable}
     where goal_id = $1`,
    [goalId],
  );
  return result.rows[0] ?? null;
};

const loadExistingBeliefRow = async (
  db: SubjectStateDbExecutor,
  beliefId: string,
): Promise<BeliefRow | null> => {
  const result = await db.query<BeliefRow>(
    `select ${beliefColumns}
     from ${beliefsTable}
     where belief_id = $1`,
    [beliefId],
  );
  return result.rows[0] ?? null;
};

const loadExistingEntityRow = async (
  db: SubjectStateDbExecutor,
  entityId: string,
): Promise<EntityRow | null> => {
  const result = await db.query<EntityRow>(
    `select ${entityColumns}
     from ${entitiesTable}
     where entity_id = $1`,
    [entityId],
  );
  return result.rows[0] ?? null;
};

const upsertGoal = async (
  db: SubjectStateDbExecutor,
  input: SubjectStateGoalUpsert,
): Promise<void> => {
  const existing = await loadExistingGoalRow(db, input.goalId);

  const title = input.title ?? existing?.title;
  const status = input.status ?? existing?.status ?? 'proposed';
  const priority = input.priority ?? existing?.priority ?? 0;
  const goalType = input.goalType ?? existing?.goalType;
  const parentGoalId =
    input.parentGoalId === undefined ? (existing?.parentGoalId ?? null) : input.parentGoalId;
  const rationaleJson = input.rationaleJson ?? toRecord(existing?.rationaleJson);
  const evidenceRefs = mergeEvidenceRefs(existing?.evidenceRefsJson, input.evidenceRefs);

  if (!title) {
    throw new Error(`goal ${input.goalId} requires title`);
  }

  if (!goalType) {
    throw new Error(`goal ${input.goalId} requires goalType`);
  }

  await db.query(
    `insert into ${goalsTable} (
      goal_id,
      title,
      status,
      priority,
      goal_type,
      parent_goal_id,
      rationale_json,
      evidence_refs_json,
      updated_at
    ) values (
      $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, now()
    )
    on conflict (goal_id) do update
    set title = excluded.title,
        status = excluded.status,
        priority = excluded.priority,
        goal_type = excluded.goal_type,
        parent_goal_id = excluded.parent_goal_id,
        rationale_json = excluded.rationale_json,
        evidence_refs_json = excluded.evidence_refs_json,
        updated_at = now()`,
    [
      input.goalId,
      title,
      status,
      priority,
      goalType,
      parentGoalId,
      JSON.stringify(rationaleJson),
      JSON.stringify(evidenceRefs),
    ],
  );
};

const upsertBelief = async (
  db: SubjectStateDbExecutor,
  input: SubjectStateBeliefUpsert,
): Promise<void> => {
  const existing = await loadExistingBeliefRow(db, input.beliefId);

  const topic = input.topic ?? existing?.topic;
  const proposition = input.proposition ?? existing?.proposition;
  const confidence = input.confidence ?? toNumber(existing?.confidence, 0);
  const status = input.status ?? existing?.status ?? 'candidate';
  const evidenceRefs = mergeEvidenceRefs(existing?.evidenceRefsJson, input.evidenceRefs);

  if (!topic) {
    throw new Error(`belief ${input.beliefId} requires topic`);
  }

  if (!proposition) {
    throw new Error(`belief ${input.beliefId} requires proposition`);
  }

  await db.query(
    `insert into ${beliefsTable} (
      belief_id,
      topic,
      proposition,
      confidence,
      status,
      evidence_refs_json,
      updated_at
    ) values (
      $1, $2, $3, $4, $5, $6::jsonb, now()
    )
    on conflict (belief_id) do update
    set topic = excluded.topic,
        proposition = excluded.proposition,
        confidence = excluded.confidence,
        status = excluded.status,
        evidence_refs_json = excluded.evidence_refs_json,
        updated_at = now()`,
    [input.beliefId, topic, proposition, confidence, status, JSON.stringify(evidenceRefs)],
  );
};

const upsertEntity = async (
  db: SubjectStateDbExecutor,
  input: SubjectStateEntityUpsert,
): Promise<void> => {
  const existing = await loadExistingEntityRow(db, input.entityId);

  const entityKind = input.entityKind ?? existing?.entityKind;
  const canonicalName = input.canonicalName ?? existing?.canonicalName;
  const stateJson = input.stateJson ?? toRecord(existing?.stateJson);
  const trustJson = input.trustJson ?? toRecord(existing?.trustJson);
  const lastSeenAt =
    input.lastSeenAt === undefined ? (existing?.lastSeenAt ?? null) : input.lastSeenAt;

  if (!entityKind) {
    throw new Error(`entity ${input.entityId} requires entityKind`);
  }

  if (!canonicalName) {
    throw new Error(`entity ${input.entityId} requires canonicalName`);
  }

  await db.query(
    `insert into ${entitiesTable} (
      entity_id,
      entity_kind,
      canonical_name,
      state_json,
      trust_json,
      last_seen_at,
      updated_at
    ) values (
      $1, $2, $3, $4::jsonb, $5::jsonb, $6, now()
    )
    on conflict (entity_id) do update
    set entity_kind = excluded.entity_kind,
        canonical_name = excluded.canonical_name,
        state_json = excluded.state_json,
        trust_json = excluded.trust_json,
        last_seen_at = excluded.last_seen_at,
        updated_at = now()`,
    [
      input.entityId,
      entityKind,
      canonicalName,
      JSON.stringify(stateJson),
      JSON.stringify(trustJson),
      lastSeenAt,
    ],
  );
};

const upsertRelationship = async (
  db: SubjectStateDbExecutor,
  input: SubjectStateRelationshipUpsert,
): Promise<void> => {
  await db.query(
    `insert into ${relationshipsTable} (
      src_entity_id,
      dst_entity_id,
      relation_kind,
      confidence,
      updated_at
    ) values (
      $1, $2, $3, $4, now()
    )
    on conflict (src_entity_id, dst_entity_id, relation_kind) do update
    set confidence = excluded.confidence,
        updated_at = now()`,
    [input.srcEntityId, input.dstEntityId, input.relationKind, input.confidence ?? 0],
  );
};

const applyAgentStatePatch = async (
  db: SubjectStateDbExecutor,
  patch: SubjectStateDelta['agentStatePatch'],
): Promise<void> => {
  if (!patch) {
    return;
  }

  const current = await loadAgentStateSnapshot(db);
  await db.query(
    `update ${agentStateTable}
     set psm_json = $1::jsonb,
         resource_posture_json = $2::jsonb,
         current_model_profile_id = $3,
         last_stable_snapshot_id = $4,
         updated_at = now()
     where id = 1`,
    [
      JSON.stringify(patch.psmJson ? { ...current.psmJson, ...patch.psmJson } : current.psmJson),
      JSON.stringify(
        patch.resourcePostureJson
          ? { ...current.resourcePostureJson, ...patch.resourcePostureJson }
          : current.resourcePostureJson,
      ),
      patch.currentModelProfileId === undefined
        ? current.currentModelProfileId
        : patch.currentModelProfileId,
      patch.lastStableSnapshotId === undefined
        ? current.lastStableSnapshotId
        : patch.lastStableSnapshotId,
    ],
  );
};

export async function ensureSubjectStateAnchor(
  db: SubjectStateDbExecutor,
  agentId = 'polyphony-core',
): Promise<SubjectStateSnapshot['agentState']> {
  await db.query(
    `insert into ${agentStateTable} (id, agent_id)
     values (1, $1)
     on conflict (id) do nothing`,
    [agentId],
  );

  return await loadAgentStateSnapshot(db);
}

export async function loadSubjectStateSnapshot(
  db: SubjectStateDbExecutor,
  input: LoadSubjectStateSnapshotInput = {},
): Promise<SubjectStateSnapshot> {
  await ensureSubjectStateAnchor(db);

  const goalLimit = input.goalLimit ?? DEFAULT_GOAL_LIMIT;
  const beliefLimit = input.beliefLimit ?? DEFAULT_BELIEF_LIMIT;
  const entityLimit = input.entityLimit ?? DEFAULT_ENTITY_LIMIT;
  const relationshipLimit = input.relationshipLimit ?? DEFAULT_RELATIONSHIP_LIMIT;
  void input.tickId;

  const agentState = await loadAgentStateSnapshot(db);
  const goals = await loadGoalSnapshots(db, goalLimit);
  const beliefs = await loadBeliefSnapshots(db, beliefLimit);
  const entities = await loadEntitySnapshots(db, entityLimit);
  const relationships = await loadRelationshipSnapshots(
    db,
    entities.map((entity) => entity.entityId),
    relationshipLimit,
  );

  return {
    agentState,
    goals,
    beliefs,
    entities,
    relationships,
  };
}

export async function applyTickStateDeltaInTransaction(
  db: SubjectStateDbExecutor,
  input: ApplyTickStateDeltaInput,
): Promise<void> {
  if (input.terminalStatus !== 'completed') {
    throw new Error('subject-state deltas can only be applied to completed ticks');
  }

  await applyAgentStatePatch(db, input.delta.agentStatePatch);

  for (const upsert of input.delta.goalUpserts ?? []) {
    await upsertGoal(db, upsert);
  }

  for (const upsert of input.delta.beliefUpserts ?? []) {
    await upsertBelief(db, upsert);
  }

  for (const upsert of input.delta.entityUpserts ?? []) {
    await upsertEntity(db, upsert);
  }

  for (const upsert of input.delta.relationshipUpserts ?? []) {
    await upsertRelationship(db, upsert);
  }

  void input.tickId;
  void input.episodeId;
}

export async function applySubjectStateDeltaMutation(
  db: SubjectStateDbExecutor,
  input: ApplyTickStateDeltaInput,
): Promise<void> {
  await applyTickStateDeltaInTransaction(db, input);
}

export async function applyTickStateDelta(
  db: SubjectStateDbExecutor,
  input: ApplyTickStateDeltaInput,
): Promise<void> {
  await ensureSubjectStateAnchor(db);

  await transaction(db, async () => {
    const tickResult = await db.query<{ tickId: string }>(
      `select tick_id as "tickId"
       from ${tickTable}
       where tick_id = $1
         and status = 'completed'`,
      [input.tickId],
    );
    if (!tickResult.rows[0]) {
      throw new Error(`completed tick ${input.tickId} was not found`);
    }

    const episodeResult = await db.query<{ episodeId: string }>(
      `select episode_id as "episodeId"
       from ${episodeTable}
       where episode_id = $1
         and tick_id = $2`,
      [input.episodeId, input.tickId],
    );
    if (!episodeResult.rows[0]) {
      throw new Error(`episode ${input.episodeId} was not found for tick ${input.tickId}`);
    }

    await applyTickStateDeltaInTransaction(db, input);
  });
}

export function createSubjectStateStore(db: SubjectStateDbExecutor): SubjectStateStore {
  return {
    ensureSubjectStateAnchor: () => ensureSubjectStateAnchor(db),
    loadSubjectStateSnapshot: (input) => loadSubjectStateSnapshot(db, input),
    applyTickStateDelta: (input) => applyTickStateDelta(db, input),
  };
}
