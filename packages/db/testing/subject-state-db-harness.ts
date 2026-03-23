import type {
  RuntimeAgentStateRow,
  RuntimeDbExecutor,
  RuntimeEpisodeRow,
  RuntimeTickRow,
  RuntimeTimelineEventRow,
} from '../src/runtime.ts';
import type {
  EvidenceRef,
  SubjectBelief,
  SubjectEntity,
  SubjectGoal,
  SubjectRelationship,
} from '../src/subject-state.ts';

type HarnessTick = RuntimeTickRow;
type HarnessEpisode = RuntimeEpisodeRow;
type HarnessEvent = RuntimeTimelineEventRow;

type HarnessState = {
  agentState: RuntimeAgentStateRow | null;
  ticks: Record<string, HarnessTick>;
  episodesById: Record<string, HarnessEpisode>;
  goals: Record<string, SubjectGoal>;
  beliefs: Record<string, SubjectBelief>;
  entities: Record<string, SubjectEntity>;
  relationships: Record<string, SubjectRelationship>;
  events: HarnessEvent[];
};

type HarnessOptions = {
  seed?: Partial<HarnessState>;
};

type QueryResult<T> = {
  rows: T[];
};

const nowIso = () => '2026-03-23T00:00:00.000Z';

const cloneState = (state: HarnessState): HarnessState => structuredClone(state);

const normalizeSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim().toLowerCase();

const defaultAgentState = (): RuntimeAgentStateRow => ({
  id: 1,
  agentId: 'polyphony-core',
  mode: 'normal',
  schemaVersion: '2026-03-23',
  bootStateJson: {},
  currentTickId: null,
  currentModelProfileId: null,
  lastStableSnapshotId: null,
  psmJson: {},
  resourcePostureJson: {},
  developmentFreeze: false,
  updatedAt: nowIso(),
});

const toAgentStateRow = (state: HarnessState): RuntimeAgentStateRow[] =>
  state.agentState ? [structuredClone(state.agentState)] : [];

const sortGoals = (goals: SubjectGoal[]): SubjectGoal[] =>
  [...goals].sort((left, right) => {
    const byPriority = right.priority - left.priority;
    if (byPriority !== 0) return byPriority;

    const byUpdatedAt = right.updatedAt.localeCompare(left.updatedAt);
    if (byUpdatedAt !== 0) return byUpdatedAt;

    return left.goalId.localeCompare(right.goalId);
  });

const sortBeliefs = (beliefs: SubjectBelief[]): SubjectBelief[] =>
  [...beliefs].sort((left, right) => {
    const byConfidence = right.confidence - left.confidence;
    if (byConfidence !== 0) return byConfidence;

    const byUpdatedAt = right.updatedAt.localeCompare(left.updatedAt);
    if (byUpdatedAt !== 0) return byUpdatedAt;

    return left.beliefId.localeCompare(right.beliefId);
  });

const sortEntities = (entities: SubjectEntity[]): SubjectEntity[] =>
  [...entities].sort((left, right) => {
    const byName = left.canonicalName.localeCompare(right.canonicalName, 'en', {
      sensitivity: 'base',
    });
    if (byName !== 0) return byName;

    const leftSeen = left.lastSeenAt ?? '';
    const rightSeen = right.lastSeenAt ?? '';
    if (leftSeen !== rightSeen) {
      return rightSeen.localeCompare(leftSeen);
    }

    const byUpdatedAt = right.updatedAt.localeCompare(left.updatedAt);
    if (byUpdatedAt !== 0) return byUpdatedAt;

    return left.entityId.localeCompare(right.entityId);
  });

const sortRelationships = (relationships: SubjectRelationship[]): SubjectRelationship[] =>
  [...relationships].sort((left, right) => {
    const byUpdatedAt = right.updatedAt.localeCompare(left.updatedAt);
    if (byUpdatedAt !== 0) return byUpdatedAt;
    const bySrc = left.srcEntityId.localeCompare(right.srcEntityId);
    if (bySrc !== 0) return bySrc;
    const byDst = left.dstEntityId.localeCompare(right.dstEntityId);
    if (byDst !== 0) return byDst;
    return left.relationKind.localeCompare(right.relationKind);
  });

const mergeJson = (
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> => ({
  ...base,
  ...patch,
});

const relationKey = (
  value: Pick<SubjectRelationship, 'srcEntityId' | 'dstEntityId' | 'relationKind'>,
) => `${value.srcEntityId}|${value.dstEntityId}|${value.relationKind}`;

const parseJsonParam = <T>(value: unknown): T =>
  typeof value === 'string' ? (JSON.parse(value) as T) : (value as T);

export function createSubjectStateDbHarness(options: HarnessOptions = {}): {
  db: RuntimeDbExecutor;
  state: HarnessState;
  failOnSqlFragment(fragment: string): void;
  clearFailures(): void;
} {
  const state: HarnessState = {
    agentState: options.seed?.agentState ? structuredClone(options.seed.agentState) : null,
    ticks: structuredClone(options.seed?.ticks ?? {}),
    episodesById: structuredClone(options.seed?.episodesById ?? {}),
    goals: structuredClone(options.seed?.goals ?? {}),
    beliefs: structuredClone(options.seed?.beliefs ?? {}),
    entities: structuredClone(options.seed?.entities ?? {}),
    relationships: structuredClone(options.seed?.relationships ?? {}),
    events: structuredClone(options.seed?.events ?? []),
  };

  let transactionBackup: HarnessState | null = null;
  let failureFragment: string | null = null;

  const query = async <TRow = Record<string, unknown>>(
    sqlText: string,
    params: unknown[] = [],
  ): Promise<QueryResult<TRow>> => {
    await Promise.resolve();
    const sql = normalizeSql(sqlText);

    if (failureFragment && sql.includes(failureFragment)) {
      throw new Error(`forced harness failure for ${failureFragment}`);
    }

    if (sql === 'begin') {
      transactionBackup = cloneState(state);
      return { rows: [] };
    }

    if (sql === 'commit') {
      transactionBackup = null;
      return { rows: [] };
    }

    if (sql === 'rollback') {
      if (transactionBackup) {
        const restored = cloneState(transactionBackup);
        state.agentState = restored.agentState;
        state.ticks = restored.ticks;
        state.episodesById = restored.episodesById;
        state.goals = restored.goals;
        state.beliefs = restored.beliefs;
        state.entities = restored.entities;
        state.relationships = restored.relationships;
        state.events = restored.events;
      }
      transactionBackup = null;
      return { rows: [] };
    }

    if (sql.includes('insert into polyphony_runtime.agent_state (id, agent_id)')) {
      if (!state.agentState) {
        state.agentState = defaultAgentState();
        const maybeAgentId = typeof params[0] === 'string' ? params[0] : 'polyphony-core';
        state.agentState.agentId = maybeAgentId;
      }
      return { rows: [] };
    }

    if (sql.startsWith('select') && sql.includes('from polyphony_runtime.agent_state')) {
      return { rows: toAgentStateRow(state) as TRow[] };
    }

    if (
      sql.startsWith('update polyphony_runtime.agent_state') &&
      sql.includes('set current_tick_id =')
    ) {
      if (!state.agentState) state.agentState = defaultAgentState();
      state.agentState.currentTickId = (params[0] as string | null) ?? null;
      state.agentState.updatedAt = nowIso();
      return { rows: toAgentStateRow(state) as TRow[] };
    }

    if (
      sql.startsWith('update polyphony_runtime.agent_state') &&
      !sql.includes('boot_state_json') &&
      !sql.includes('development_freeze') &&
      !sql.includes('set current_tick_id =')
    ) {
      if (!state.agentState) state.agentState = defaultAgentState();
      let index = 0;

      if (sql.includes('psm_json =')) {
        state.agentState.psmJson = mergeJson(
          state.agentState.psmJson,
          parseJsonParam<Record<string, unknown>>(params[index]),
        );
        index += 1;
      }

      if (sql.includes('resource_posture_json =')) {
        state.agentState.resourcePostureJson = mergeJson(
          state.agentState.resourcePostureJson,
          parseJsonParam<Record<string, unknown>>(params[index]),
        );
        index += 1;
      }

      if (sql.includes('current_model_profile_id =')) {
        state.agentState.currentModelProfileId = (params[index] as string | null) ?? null;
        index += 1;
      }

      if (sql.includes('last_stable_snapshot_id =')) {
        state.agentState.lastStableSnapshotId = (params[index] as string | null) ?? null;
      }

      state.agentState.updatedAt = nowIso();
      return { rows: [] };
    }

    if (
      sql.startsWith('select status from polyphony_runtime.ticks') &&
      sql.includes('where tick_id = $1')
    ) {
      const tick = state.ticks[String(params[0])];
      return { rows: tick ? ([{ status: tick.status }] as TRow[]) : [] };
    }

    if (
      sql.startsWith('select') &&
      sql.includes('from polyphony_runtime.ticks') &&
      sql.includes('where tick_id = $1')
    ) {
      const tick = state.ticks[String(params[0])];
      if (!tick) {
        return { rows: [] };
      }

      if (sql.includes("and status = 'completed'") && tick.status !== 'completed') {
        return { rows: [] };
      }

      return { rows: [structuredClone(tick) as TRow] };
    }

    if (sql.startsWith('update polyphony_runtime.ticks') && sql.includes('set status = $2')) {
      const tick = state.ticks[String(params[0])];
      if (!tick) {
        return { rows: [] };
      }

      tick.status = String(params[1]) as RuntimeTickRow['status'];
      tick.endedAt = String(params[2]);
      tick.resultJson = parseJsonParam<Record<string, unknown>>(params[3]);
      tick.failureJson = parseJsonParam<Record<string, unknown>>(params[4]);
      tick.continuityFlagsJson = parseJsonParam<Record<string, unknown>>(params[5]);
      tick.updatedAt = nowIso();

      return { rows: [structuredClone(tick) as TRow] };
    }

    if (sql.startsWith('insert into polyphony_runtime.episodes')) {
      const episode: HarnessEpisode = {
        episodeId: String(params[0]),
        tickId: String(params[1]),
        summary: String(params[2]),
        resultJson: parseJsonParam<Record<string, unknown>>(params[3]),
        createdAt: nowIso(),
      };
      state.episodesById[episode.episodeId] = episode;
      return { rows: [structuredClone(episode) as TRow] };
    }

    if (
      sql.startsWith('select') &&
      sql.includes('from polyphony_runtime.episodes') &&
      sql.includes('where episode_id = $1')
    ) {
      const episode = state.episodesById[String(params[0])];
      const tickId = String(params[1]);
      return {
        rows:
          episode && episode.tickId === tickId
            ? ([{ episode_id: episode.episodeId, episodeId: episode.episodeId }] as TRow[])
            : [],
      };
    }

    if (sql.startsWith('insert into polyphony_runtime.timeline_events')) {
      const event: HarnessEvent = {
        sequenceId: String(state.events.length + 1),
        eventId: String(params[0]),
        eventType: String(params[1]),
        occurredAt: String(params[2]),
        subjectRef: String(params[3]),
        payloadJson: parseJsonParam<Record<string, unknown>>(params[4]),
        createdAt: nowIso(),
      };
      state.events.push(event);
      return { rows: [structuredClone(event) as TRow] };
    }

    if (
      sql.startsWith('select evidence_refs_json from polyphony_runtime.goals') &&
      sql.includes('where goal_id = $1')
    ) {
      const goal = state.goals[String(params[0])];
      return {
        rows: goal ? ([{ evidence_refs_json: structuredClone(goal.evidenceRefs) }] as TRow[]) : [],
      };
    }

    if (
      sql.startsWith('select') &&
      sql.includes('from polyphony_runtime.goals where goal_id = $1')
    ) {
      const goal = state.goals[String(params[0])];
      return {
        rows: goal
          ? ([
              {
                ...structuredClone(goal),
                evidenceRefsJson: structuredClone(goal.evidenceRefs),
              },
            ] as TRow[])
          : [],
      };
    }

    if (sql.startsWith('insert into polyphony_runtime.goals')) {
      const goal: SubjectGoal = {
        goalId: String(params[0]),
        title: String(params[1]),
        status: params[2] as SubjectGoal['status'],
        priority: Number(params[3]),
        goalType: String(params[4]),
        parentGoalId: (params[5] as string | null) ?? null,
        rationaleJson: parseJsonParam<Record<string, unknown>>(params[6]),
        evidenceRefs: parseJsonParam<EvidenceRef[]>(params[7]),
        updatedAt: nowIso(),
      };
      state.goals[goal.goalId] = goal;
      return { rows: [] };
    }

    if (
      sql.startsWith('select evidence_refs_json from polyphony_runtime.beliefs') &&
      sql.includes('where belief_id = $1')
    ) {
      const belief = state.beliefs[String(params[0])];
      return {
        rows: belief
          ? ([{ evidence_refs_json: structuredClone(belief.evidenceRefs) }] as TRow[])
          : [],
      };
    }

    if (
      sql.startsWith('select') &&
      sql.includes('from polyphony_runtime.beliefs') &&
      sql.includes('where belief_id = $1')
    ) {
      const belief = state.beliefs[String(params[0])];
      return {
        rows: belief
          ? ([
              {
                ...structuredClone(belief),
                evidenceRefsJson: structuredClone(belief.evidenceRefs),
              },
            ] as TRow[])
          : [],
      };
    }

    if (sql.startsWith('insert into polyphony_runtime.beliefs')) {
      const belief: SubjectBelief = {
        beliefId: String(params[0]),
        topic: String(params[1]),
        proposition: String(params[2]),
        confidence: Number(params[3]),
        status: params[4] as SubjectBelief['status'],
        evidenceRefs: parseJsonParam<EvidenceRef[]>(params[5]),
        updatedAt: nowIso(),
      };
      state.beliefs[belief.beliefId] = belief;
      return { rows: [] };
    }

    if (sql.startsWith('insert into polyphony_runtime.entities')) {
      const entity: SubjectEntity = {
        entityId: String(params[0]),
        entityKind: String(params[1]),
        canonicalName: String(params[2]),
        stateJson: parseJsonParam<Record<string, unknown>>(params[3]),
        trustJson: parseJsonParam<Record<string, unknown>>(params[4]),
        lastSeenAt: (params[5] as string | null) ?? null,
        updatedAt: nowIso(),
      };
      state.entities[entity.entityId] = entity;
      return { rows: [] };
    }

    if (
      sql.startsWith('select') &&
      sql.includes('from polyphony_runtime.entities') &&
      sql.includes('where entity_id = $1')
    ) {
      const entity = state.entities[String(params[0])];
      return { rows: entity ? ([structuredClone(entity)] as TRow[]) : [] };
    }

    if (sql.startsWith('insert into polyphony_runtime.relationships')) {
      const relationship: SubjectRelationship = {
        srcEntityId: String(params[0]),
        dstEntityId: String(params[1]),
        relationKind: String(params[2]),
        confidence: Number(params[3]),
        updatedAt: nowIso(),
      };
      state.relationships[relationKey(relationship)] = relationship;
      return { rows: [] };
    }

    if (
      sql.startsWith('select') &&
      sql.includes('from polyphony_runtime.goals') &&
      sql.includes("where status in ('proposed', 'active', 'blocked')")
    ) {
      const limit = Number(params[0]);
      return {
        rows: sortGoals(Object.values(state.goals))
          .filter((goal) => ['proposed', 'active', 'blocked'].includes(goal.status))
          .slice(0, limit)
          .map((goal) => ({
            ...goal,
            evidenceRefsJson: structuredClone(goal.evidenceRefs),
          })) as TRow[],
      };
    }

    if (
      sql.startsWith('select') &&
      sql.includes('from polyphony_runtime.beliefs') &&
      sql.includes('order by confidence desc')
    ) {
      const limit = Number(params[0]);
      return {
        rows: sortBeliefs(Object.values(state.beliefs))
          .slice(0, limit)
          .map((belief) => ({
            ...belief,
            evidenceRefsJson: structuredClone(belief.evidenceRefs),
          })) as TRow[],
      };
    }

    if (
      sql.startsWith('select') &&
      sql.includes('from polyphony_runtime.entities') &&
      sql.includes('order by canonical_name asc')
    ) {
      const limit = Number(params[0]);
      return {
        rows: sortEntities(Object.values(state.entities)).slice(0, limit) as TRow[],
      };
    }

    if (
      sql.startsWith('select') &&
      sql.includes('from polyphony_runtime.relationships') &&
      sql.includes('where src_entity_id = any')
    ) {
      const entityIds = new Set((params[0] as string[]) ?? []);
      const limit = Number(params[1]);
      return {
        rows: sortRelationships(Object.values(state.relationships))
          .filter(
            (relationship) =>
              entityIds.has(relationship.srcEntityId) && entityIds.has(relationship.dstEntityId),
          )
          .slice(0, limit) as TRow[],
      };
    }

    throw new Error(`Unsupported harness SQL: ${sqlText}`);
  };

  return {
    db: { query: query as RuntimeDbExecutor['query'] },
    state,
    failOnSqlFragment(fragment: string): void {
      failureFragment = fragment;
    },
    clearFailures(): void {
      failureFragment = null;
    },
  };
}
