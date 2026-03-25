import type {
  RuntimeAgentStateRow,
  RuntimeDbExecutor,
  RuntimeEpisodeRow,
  RuntimeTickRow,
  RuntimeTimelineEventRow,
} from '../src/runtime.ts';
import { TICK_STATUS } from '../src/runtime.ts';
import type { RuntimeActionLogRow } from '../src/action-log.ts';
import type { RuntimeModelProfileRow } from '../src/model-routing.ts';
import type {
  FieldJournalEntryRow,
  NarrativeMemeticCoalitionRow,
  NarrativeMemeticEdgeRow,
  NarrativeMemeticUnitRow,
  NarrativeSpineVersionRow,
} from '../src/narrative-memetic.ts';
import type { StimulusInboxRecord } from '@yaagi/contracts/perception';
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
type HarnessActionLog = RuntimeActionLogRow;
type HarnessMemeticUnit = NarrativeMemeticUnitRow;
type HarnessMemeticEdge = NarrativeMemeticEdgeRow;
type HarnessCoalition = NarrativeMemeticCoalitionRow;
type HarnessNarrativeVersion = NarrativeSpineVersionRow;
type HarnessFieldJournalEntry = FieldJournalEntryRow;

type HarnessState = {
  agentState: RuntimeAgentStateRow | null;
  ticks: Record<string, HarnessTick>;
  episodesById: Record<string, HarnessEpisode>;
  actionLogsById: Record<string, HarnessActionLog>;
  memeticUnits: Record<string, HarnessMemeticUnit>;
  memeticEdges: Record<string, HarnessMemeticEdge>;
  coalitionsById: Record<string, HarnessCoalition>;
  narrativeVersionsById: Record<string, HarnessNarrativeVersion>;
  fieldJournalEntriesById: Record<string, HarnessFieldJournalEntry>;
  modelProfiles: Record<string, RuntimeModelProfileRow>;
  goals: Record<string, SubjectGoal>;
  beliefs: Record<string, SubjectBelief>;
  entities: Record<string, SubjectEntity>;
  relationships: Record<string, SubjectRelationship>;
  stimuli: Record<string, StimulusInboxRecord>;
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
  state.agentState
    ? [
        {
          ...structuredClone(state.agentState),
          subjectStateSchemaVersion: state.agentState.schemaVersion,
        } as RuntimeAgentStateRow,
      ]
    : [];

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
    actionLogsById: structuredClone(options.seed?.actionLogsById ?? {}),
    memeticUnits: structuredClone(options.seed?.memeticUnits ?? {}),
    memeticEdges: structuredClone(options.seed?.memeticEdges ?? {}),
    coalitionsById: structuredClone(options.seed?.coalitionsById ?? {}),
    narrativeVersionsById: structuredClone(options.seed?.narrativeVersionsById ?? {}),
    fieldJournalEntriesById: structuredClone(options.seed?.fieldJournalEntriesById ?? {}),
    modelProfiles: structuredClone(options.seed?.modelProfiles ?? {}),
    goals: structuredClone(options.seed?.goals ?? {}),
    beliefs: structuredClone(options.seed?.beliefs ?? {}),
    entities: structuredClone(options.seed?.entities ?? {}),
    relationships: structuredClone(options.seed?.relationships ?? {}),
    stimuli: structuredClone(options.seed?.stimuli ?? {}),
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
        state.actionLogsById = restored.actionLogsById;
        state.memeticUnits = restored.memeticUnits;
        state.memeticEdges = restored.memeticEdges;
        state.coalitionsById = restored.coalitionsById;
        state.narrativeVersionsById = restored.narrativeVersionsById;
        state.fieldJournalEntriesById = restored.fieldJournalEntriesById;
        state.modelProfiles = restored.modelProfiles;
        state.goals = restored.goals;
        state.beliefs = restored.beliefs;
        state.entities = restored.entities;
        state.relationships = restored.relationships;
        state.stimuli = restored.stimuli;
        state.events = restored.events;
      }
      transactionBackup = null;
      return { rows: [] };
    }

    if (sql.includes('insert into polyphony_runtime.agent_state')) {
      if (!state.agentState) {
        state.agentState = defaultAgentState();
        const maybeAgentId = typeof params[0] === 'string' ? params[0] : 'polyphony-core';
        state.agentState.agentId = maybeAgentId;
      } else if (!state.agentState.schemaVersion) {
        state.agentState.schemaVersion = defaultAgentState().schemaVersion;
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

      if (sql.includes('current_tick_id = any($1::text[])')) {
        const tickIds = new Set((params[0] as string[]) ?? []);
        if (tickIds.has(state.agentState.currentTickId ?? '')) {
          state.agentState.currentTickId = null;
          state.agentState.currentModelProfileId = null;
        }
      } else {
        state.agentState.currentTickId = (params[0] as string | null) ?? null;
      }

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

    if (
      sql.startsWith('select') &&
      sql.includes('from polyphony_runtime.memetic_units') &&
      sql.includes("where status in ('active', 'dormant')")
    ) {
      const limit = Number(params[0]);
      const rows = Object.values(state.memeticUnits)
        .filter((unit) => unit.status === 'active' || unit.status === 'dormant')
        .sort((left, right) => {
          const byActivation = right.activationScore - left.activationScore;
          if (byActivation !== 0) return byActivation;
          const byReinforcement = right.reinforcementScore - left.reinforcementScore;
          if (byReinforcement !== 0) return byReinforcement;
          return right.updatedAt.localeCompare(left.updatedAt);
        })
        .slice(0, limit)
        .map((unit) => structuredClone(unit) as TRow);
      return { rows };
    }

    if (
      sql.startsWith('select') &&
      sql.includes('from polyphony_runtime.memetic_edges') &&
      sql.includes('source_unit_id = any($1::text[])')
    ) {
      const unitIds = new Set((params[0] as string[]) ?? []);
      const limit = Number(params[1]);
      const rows = Object.values(state.memeticEdges)
        .filter((edge) => unitIds.has(edge.sourceUnitId) || unitIds.has(edge.targetUnitId))
        .sort((left, right) => {
          const byUpdatedAt = right.updatedAt.localeCompare(left.updatedAt);
          if (byUpdatedAt !== 0) return byUpdatedAt;
          return left.edgeId.localeCompare(right.edgeId);
        })
        .slice(0, limit)
        .map((edge) => structuredClone(edge) as TRow);
      return { rows };
    }

    if (
      sql.startsWith('select') &&
      sql.includes('from polyphony_runtime.narrative_spine_versions') &&
      sql.includes('order by created_at desc')
    ) {
      const rows = Object.values(state.narrativeVersionsById)
        .sort((left, right) => {
          const byCreatedAt = right.createdAt.localeCompare(left.createdAt);
          if (byCreatedAt !== 0) return byCreatedAt;
          return right.versionId.localeCompare(left.versionId);
        })
        .slice(0, 1)
        .map((version) => structuredClone(version) as TRow);
      return { rows };
    }

    if (
      sql.startsWith('select') &&
      sql.includes('from polyphony_runtime.field_journal_entries') &&
      sql.includes('order by created_at desc, entry_id desc')
    ) {
      const limit = Number(params[0]);
      const rows = Object.values(state.fieldJournalEntriesById)
        .sort((left, right) => {
          const byCreatedAt = right.createdAt.localeCompare(left.createdAt);
          if (byCreatedAt !== 0) return byCreatedAt;
          return right.entryId.localeCompare(left.entryId);
        })
        .slice(0, limit)
        .map((entry) => structuredClone(entry) as TRow);
      return { rows };
    }

    if (sql.startsWith('insert into polyphony_runtime.model_registry')) {
      const profile: RuntimeModelProfileRow = {
        modelProfileId: String(params[0]),
        role: params[1] as RuntimeModelProfileRow['role'],
        endpoint: String(params[2]),
        artifactUri: (params[3] as string | null) ?? null,
        baseModel: String(params[4]),
        adapterOf: (params[5] as string | null) ?? null,
        capabilitiesJson: parseJsonParam<string[]>(params[6]),
        costJson: parseJsonParam<Record<string, unknown>>(params[7]),
        healthJson: parseJsonParam<Record<string, unknown>>(params[8]),
        status: params[9] as RuntimeModelProfileRow['status'],
        createdAt: state.modelProfiles[String(params[0])]?.createdAt ?? nowIso(),
        updatedAt: nowIso(),
      };
      state.modelProfiles[profile.modelProfileId] = profile;
      return { rows: [structuredClone(profile) as TRow] };
    }

    if (
      sql.startsWith('select') &&
      sql.includes('from polyphony_runtime.model_registry') &&
      sql.includes('order by role asc, model_profile_id asc')
    ) {
      const roles = sql.includes('where role = any($1::text[])')
        ? new Set((params[0] as string[]) ?? [])
        : null;
      const profiles = Object.values(state.modelProfiles)
        .filter((profile) => (roles ? roles.has(profile.role) : true))
        .sort((left, right) => {
          const byRole = left.role.localeCompare(right.role);
          if (byRole !== 0) return byRole;
          return left.modelProfileId.localeCompare(right.modelProfileId);
        })
        .map((profile) => structuredClone(profile) as TRow);
      return { rows: profiles };
    }

    if (
      sql.startsWith('select') &&
      sql.includes('from polyphony_runtime.ticks') &&
      sql.includes('where agent_id = $1') &&
      sql.includes('lease_expires_at < $3')
    ) {
      const agentId = String(params[0]);
      const status = String(params[1]);
      const now = String(params[2]);
      const rows = Object.values(state.ticks)
        .filter(
          (tick) =>
            tick.agentId === agentId &&
            tick.status === status &&
            tick.endedAt === null &&
            tick.leaseExpiresAt < now,
        )
        .sort((left, right) => left.startedAt.localeCompare(right.startedAt))
        .map((tick) => structuredClone(tick) as TRow);
      return { rows };
    }

    if (sql.startsWith('update polyphony_runtime.ticks') && sql.includes('set status = $2')) {
      const tick = state.ticks[String(params[0])];
      if (!tick) {
        return { rows: [] };
      }

      tick.status = String(params[1]) as RuntimeTickRow['status'];
      tick.endedAt = String(params[2]);
      tick.resultJson = parseJsonParam<Record<string, unknown>>(params[3]);
      if (sql.includes("failure_json = '{}'::jsonb")) {
        tick.failureJson = {};
        tick.continuityFlagsJson = parseJsonParam<Record<string, unknown>>(params[4]);
        tick.actionId = (params[5] as string | null) ?? null;
        tick.selectedCoalitionId = (params[6] as string | null) ?? null;
        if (
          tick.selectedCoalitionId &&
          !Object.hasOwn(state.coalitionsById, tick.selectedCoalitionId)
        ) {
          throw new Error(
            `insert or update on table "ticks" violates foreign key constraint "ticks_selected_coalition_fk"`,
          );
        }
      } else {
        tick.failureJson = parseJsonParam<Record<string, unknown>>(params[4]);
        tick.continuityFlagsJson = parseJsonParam<Record<string, unknown>>(params[5]);
        tick.actionId = (params[6] as string | null) ?? null;
      }
      tick.updatedAt = nowIso();

      return { rows: [structuredClone(tick) as TRow] };
    }

    if (
      sql.startsWith('update polyphony_runtime.ticks') &&
      sql.includes('set selected_model_profile_id = $2')
    ) {
      const tick = state.ticks[String(params[0])];
      if (!tick) {
        return { rows: [] };
      }

      tick.selectedModelProfileId = (params[1] as string | null) ?? null;
      tick.continuityFlagsJson = parseJsonParam<Record<string, unknown>>(params[2]);
      tick.updatedAt = nowIso();

      return { rows: [structuredClone(tick) as TRow] };
    }

    if (sql.startsWith('update polyphony_runtime.ticks') && sql.includes('set action_id = $2')) {
      const tick = state.ticks[String(params[0])];
      if (!tick || tick.status !== TICK_STATUS.STARTED) {
        return { rows: [] };
      }

      tick.actionId = String(params[1]);
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

    if (sql.startsWith('insert into polyphony_runtime.memetic_units')) {
      const unit: HarnessMemeticUnit = {
        unitId: String(params[0]),
        originKind: params[1] as HarnessMemeticUnit['originKind'],
        unitType: String(params[2]),
        abstractLabel: String(params[3]),
        canonicalSummary: String(params[4]),
        activationScore: Number(params[5]),
        reinforcementScore: Number(params[6]),
        decayScore: Number(params[7]),
        evidenceScore: Number(params[8]),
        status: params[9] as HarnessMemeticUnit['status'],
        lastActivatedTickId: (params[10] as string | null) ?? null,
        createdByPath: String(params[11]),
        provenanceAnchorsJson: parseJsonParam<string[]>(params[12]),
        createdAt: state.memeticUnits[String(params[0])]?.createdAt ?? nowIso(),
        updatedAt: nowIso(),
      };
      state.memeticUnits[unit.unitId] = unit;
      return { rows: [] };
    }

    if (
      sql.startsWith('update polyphony_runtime.memetic_units') &&
      sql.includes('set activation_score = $2')
    ) {
      const unit = state.memeticUnits[String(params[0])];
      if (!unit) {
        return { rows: [] };
      }

      unit.activationScore = Number(params[1]);
      unit.reinforcementScore = Number(params[2]);
      unit.decayScore = Number(params[3]);
      unit.evidenceScore = Number(params[4]);
      unit.status = params[5] as HarnessMemeticUnit['status'];
      unit.lastActivatedTickId = (params[6] as string | null) ?? null;
      unit.provenanceAnchorsJson = parseJsonParam<string[]>(params[7]);
      unit.updatedAt = nowIso();
      return { rows: [] };
    }

    if (sql.startsWith('insert into polyphony_runtime.memetic_edges')) {
      const edge: HarnessMemeticEdge = {
        edgeId: String(params[0]),
        sourceUnitId: String(params[1]),
        targetUnitId: String(params[2]),
        relationKind: params[3] as HarnessMemeticEdge['relationKind'],
        strength: Number(params[4]),
        confidence: Number(params[5]),
        tickId: String(params[6]),
        updatedAt: nowIso(),
      };
      state.memeticEdges[edge.edgeId] = edge;
      return { rows: [] };
    }

    if (sql.startsWith('insert into polyphony_runtime.coalitions')) {
      const coalition: HarnessCoalition = {
        coalitionId: String(params[0]),
        tickId: String(params[1]),
        decisionMode: params[2] as HarnessCoalition['decisionMode'],
        vector: String(params[3]),
        memberUnitIdsJson: parseJsonParam<string[]>(params[4]),
        supportScore: Number(params[5]),
        suppressionScore: Number(params[6]),
        winning: Boolean(params[7]),
        createdAt: state.coalitionsById[String(params[0])]?.createdAt ?? nowIso(),
      };
      state.coalitionsById[coalition.coalitionId] = coalition;
      return { rows: [] };
    }

    if (sql.startsWith('insert into polyphony_runtime.narrative_spine_versions')) {
      const version: HarnessNarrativeVersion = {
        versionId: String(params[0]),
        tickId: String(params[1]),
        basedOnVersionId: (params[2] as string | null) ?? null,
        currentChapter: String(params[3]),
        summary: String(params[4]),
        continuityDirection: String(params[5]),
        tensionsJson: parseJsonParam<HarnessNarrativeVersion['tensionsJson']>(params[6]),
        provenanceAnchorsJson: parseJsonParam<string[]>(params[7]),
        createdAt: state.narrativeVersionsById[String(params[0])]?.createdAt ?? nowIso(),
      };
      state.narrativeVersionsById[version.versionId] = version;
      return { rows: [] };
    }

    if (sql.startsWith('insert into polyphony_runtime.field_journal_entries')) {
      const entry: HarnessFieldJournalEntry = {
        entryId: String(params[0]),
        tickId: String(params[1]),
        entryType: String(params[2]),
        summary: String(params[3]),
        interpretation: String(params[4]),
        tensionMarkersJson: parseJsonParam<string[]>(params[5]),
        maturityState: params[6] as HarnessFieldJournalEntry['maturityState'],
        linkedUnitId: (params[7] as string | null) ?? null,
        provenanceAnchorsJson: parseJsonParam<string[]>(params[8]),
        createdAt: state.fieldJournalEntriesById[String(params[0])]?.createdAt ?? nowIso(),
      };
      state.fieldJournalEntriesById[entry.entryId] = entry;
      return { rows: [] };
    }

    if (
      sql.startsWith('select') &&
      sql.includes('from polyphony_runtime.episodes') &&
      sql.includes('order by created_at desc, episode_id desc')
    ) {
      const limit = Number(params[0]);
      const rows = Object.values(state.episodesById)
        .sort((left, right) => {
          const byCreatedAt = right.createdAt.localeCompare(left.createdAt);
          if (byCreatedAt !== 0) return byCreatedAt;
          return right.episodeId.localeCompare(left.episodeId);
        })
        .slice(0, limit)
        .map((episode) => structuredClone(episode) as TRow);
      return { rows };
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

    if (sql.startsWith('insert into polyphony_runtime.action_log')) {
      const createdAt =
        params[8] == null
          ? nowIso()
          : typeof params[8] === 'string'
            ? params[8]
            : params[8] instanceof Date
              ? params[8].toISOString()
              : nowIso();
      const row: HarnessActionLog = {
        actionId: String(params[0]),
        tickId: String(params[1]),
        actionKind: params[2] as HarnessActionLog['actionKind'],
        toolName: (params[3] as string | null) ?? null,
        parametersJson: parseJsonParam<Record<string, unknown>>(params[4]),
        boundaryCheckJson: parseJsonParam<HarnessActionLog['boundaryCheckJson']>(params[5]),
        resultJson: parseJsonParam<Record<string, unknown>>(params[6]),
        success: Boolean(params[7]),
        createdAt,
      };
      state.actionLogsById[row.actionId] = row;
      return { rows: [structuredClone(row) as TRow] };
    }

    if (
      sql.startsWith('select') &&
      sql.includes('from polyphony_runtime.action_log') &&
      sql.includes('where action_id = $1')
    ) {
      const row = state.actionLogsById[String(params[0])];
      return { rows: row ? ([structuredClone(row)] as TRow[]) : [] };
    }

    if (
      sql.startsWith('select') &&
      sql.includes('from polyphony_runtime.action_log') &&
      sql.includes('where tick_id = $1')
    ) {
      const limit = Number(params[1]);
      const rows = Object.values(state.actionLogsById)
        .filter((row) => row.tickId === String(params[0]))
        .sort((left, right) => {
          const byCreatedAt = right.createdAt.localeCompare(left.createdAt);
          if (byCreatedAt !== 0) return byCreatedAt;
          return right.actionId.localeCompare(left.actionId);
        })
        .slice(0, limit)
        .map((row) => structuredClone(row) as TRow);
      return { rows };
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

    if (sql.startsWith('insert into polyphony_runtime.stimulus_inbox')) {
      const stimulus: StimulusInboxRecord = {
        stimulusId: String(params[0]),
        sourceKind: params[1] as StimulusInboxRecord['sourceKind'],
        threadId: (params[2] as string | null) ?? null,
        occurredAt: String(params[3]),
        priority: params[4] as StimulusInboxRecord['priority'],
        priorityRank: Number(params[5]),
        requiresImmediateTick: Boolean(params[6]),
        payloadJson: parseJsonParam<Record<string, unknown>>(params[7]),
        normalizedJson: parseJsonParam<StimulusInboxRecord['normalizedJson']>(params[8]),
        dedupeKey: (params[9] as string | null) ?? null,
        claimTickId: null,
        status: params[10] as StimulusInboxRecord['status'],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      state.stimuli[stimulus.stimulusId] = stimulus;
      return { rows: [structuredClone(stimulus) as TRow] };
    }

    if (
      sql.startsWith('select') &&
      sql.includes('from polyphony_runtime.stimulus_inbox') &&
      sql.includes('where source_kind = $1') &&
      sql.includes('and dedupe_key = $2')
    ) {
      const sourceKind = String(params[0]);
      const dedupeKey = String(params[1]);
      const stimuli = Object.values(state.stimuli)
        .filter(
          (stimulus) => stimulus.sourceKind === sourceKind && stimulus.dedupeKey === dedupeKey,
        )
        .sort((left, right) => {
          const byOccurredAt = right.occurredAt.localeCompare(left.occurredAt);
          if (byOccurredAt !== 0) return byOccurredAt;
          return right.stimulusId.localeCompare(left.stimulusId);
        })
        .slice(0, 1);
      return { rows: stimuli.map((stimulus) => structuredClone(stimulus) as TRow) };
    }

    if (
      sql.startsWith('select') &&
      sql.includes('from polyphony_runtime.stimulus_inbox') &&
      sql.includes('where status = $1') &&
      sql.includes('order by')
    ) {
      const status = String(params[0]);
      const limit = Number(params[1]);
      const stimuli = Object.values(state.stimuli)
        .filter((stimulus) => stimulus.status === status)
        .sort((left, right) => {
          const byImmediate =
            Number(right.requiresImmediateTick) - Number(left.requiresImmediateTick);
          if (byImmediate !== 0) return byImmediate;
          const byPriority = right.priorityRank - left.priorityRank;
          if (byPriority !== 0) return byPriority;
          const byOccurredAt = left.occurredAt.localeCompare(right.occurredAt);
          if (byOccurredAt !== 0) return byOccurredAt;
          return left.stimulusId.localeCompare(right.stimulusId);
        })
        .slice(0, limit);
      return { rows: stimuli.map((stimulus) => structuredClone(stimulus) as TRow) };
    }

    if (
      sql.startsWith('update polyphony_runtime.stimulus_inbox') &&
      sql.includes('set status = $2, claim_tick_id = $1')
    ) {
      const tickId = String(params[0]);
      const nextStatus = String(params[1]) as StimulusInboxRecord['status'];
      const stimulusIds = new Set((params[2] as string[]) ?? []);
      const expectedStatus = String(params[3]);
      const rows: TRow[] = [];

      for (const stimulusId of stimulusIds) {
        const stimulus = state.stimuli[stimulusId];
        if (!stimulus || stimulus.status !== expectedStatus) {
          continue;
        }

        stimulus.status = nextStatus;
        stimulus.claimTickId = tickId;
        stimulus.updatedAt = nowIso();
        rows.push(structuredClone(stimulus) as TRow);
      }

      return { rows };
    }

    if (
      sql.startsWith('update polyphony_runtime.stimulus_inbox') &&
      sql.includes('set status = $2, updated_at = now()') &&
      sql.includes('where claim_tick_id = $1')
    ) {
      const tickId = String(params[0]);
      const nextStatus = String(params[1]) as StimulusInboxRecord['status'];
      const expectedStatus = String(params[2]);
      const stimulusIds = sql.includes('stimulus_id = any($4::text[])')
        ? new Set((params[3] as string[]) ?? [])
        : null;
      const rows: TRow[] = [];

      for (const stimulus of Object.values(state.stimuli)) {
        if (stimulus.claimTickId !== tickId || stimulus.status !== expectedStatus) {
          continue;
        }

        if (stimulusIds && !stimulusIds.has(stimulus.stimulusId)) {
          continue;
        }

        stimulus.status = nextStatus;
        stimulus.updatedAt = nowIso();
        rows.push({ count: '1' } as TRow);
      }

      return { rows };
    }

    if (
      sql.startsWith('update polyphony_runtime.stimulus_inbox') &&
      sql.includes('set status = $1') &&
      sql.includes('claim_tick_id = null') &&
      sql.includes('where claim_tick_id = any($2::text[])')
    ) {
      const nextStatus = String(params[0]) as StimulusInboxRecord['status'];
      const tickIds = new Set((params[1] as string[]) ?? []);
      const expectedStatus = String(params[2]);
      const rows: TRow[] = [];

      for (const stimulus of Object.values(state.stimuli)) {
        if (!tickIds.has(stimulus.claimTickId ?? '') || stimulus.status !== expectedStatus) {
          continue;
        }

        stimulus.status = nextStatus;
        stimulus.claimTickId = null;
        stimulus.updatedAt = nowIso();
        rows.push({ count: '1' } as TRow);
      }

      return { rows };
    }

    if (
      sql.startsWith('update polyphony_runtime.stimulus_inbox') &&
      sql.includes('set status = $2') &&
      sql.includes('claim_tick_id = null') &&
      sql.includes('where claim_tick_id = $1')
    ) {
      const tickId = String(params[0]);
      const nextStatus = String(params[1]) as StimulusInboxRecord['status'];
      const expectedStatus = String(params[2]);
      const stimulusIds = sql.includes('stimulus_id = any($4::text[])')
        ? new Set((params[3] as string[]) ?? [])
        : null;
      const rows: TRow[] = [];

      for (const stimulus of Object.values(state.stimuli)) {
        if (stimulus.claimTickId !== tickId || stimulus.status !== expectedStatus) {
          continue;
        }

        if (stimulusIds && !stimulusIds.has(stimulus.stimulusId)) {
          continue;
        }

        stimulus.status = nextStatus;
        stimulus.claimTickId = null;
        stimulus.updatedAt = nowIso();
        rows.push({ count: '1' } as TRow);
      }

      return { rows };
    }

    if (
      sql.startsWith('select status, count(*)::text as count') &&
      sql.includes('from polyphony_runtime.stimulus_inbox')
    ) {
      const counts = new Map<string, number>();
      for (const stimulus of Object.values(state.stimuli)) {
        counts.set(stimulus.status, (counts.get(stimulus.status) ?? 0) + 1);
      }

      return {
        rows: [...counts.entries()].map(
          ([status, count]) => ({ status, count: String(count) }) as TRow,
        ),
      };
    }

    if (
      sql.startsWith('update polyphony_runtime.ticks') &&
      sql.includes("jsonb_build_object('perception'")
    ) {
      const tick = state.ticks[String(params[0])];
      if (!tick) {
        return { rows: [] };
      }

      tick.requestJson = {
        ...tick.requestJson,
        perception: parseJsonParam<Record<string, unknown>>(params[1]),
      };
      tick.updatedAt = nowIso();
      return { rows: [] };
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
