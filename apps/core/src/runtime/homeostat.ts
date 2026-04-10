import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import type { CoreRuntimeConfig } from '../platform/core-config.ts';
import {
  PgBoss,
  createHomeostatStore,
  createNarrativeMemeticStore,
  createRuntimeDbClient,
  createRuntimeJobEnqueuer,
  createTickRuntimeStore,
  type FieldJournalEntryRow,
  type NarrativeSpineVersionRow,
  type RuntimeTickRow,
  type SubjectGoal,
} from '@yaagi/db';
import {
  HOMEOSTAT_ALERT_SEVERITY,
  HOMEOSTAT_CADENCE_KIND,
  HOMEOSTAT_PERIODIC_CRON,
  HOMEOSTAT_PERIODIC_QUEUE,
  HOMEOSTAT_PERIODIC_SCHEDULE_KEY,
  HOMEOSTAT_REACTION_QUEUE,
  HOMEOSTAT_REQUESTED_ACTION_KIND,
  HOMEOSTAT_SIGNAL_FAMILY,
  HOMEOSTAT_SIGNAL_STATUS,
  type HomeostatAlert,
  type HomeostatAlertSeverity,
  type HomeostatCadenceKind,
  type HomeostatReactionRequest,
  type HomeostatRequestedActionKind,
  type HomeostatSignalFamily,
  type HomeostatSignalScore,
  type HomeostatSnapshot,
} from '@yaagi/contracts/runtime';

type HomeostatFutureSourceState = 'available' | 'stale' | 'missing';

type RecentCompletedTick = Pick<RuntimeTickRow, 'tickId' | 'selectedCoalitionId' | 'endedAt'>;

export type HomeostatEvaluationContext = {
  cadenceKind: HomeostatCadenceKind;
  tickId: string | null;
  createdAt: string;
  developmentFreeze: boolean;
  goals: SubjectGoal[];
  resourcePostureJson: Record<string, unknown>;
  latestNarrativeVersion: NarrativeSpineVersionRow | null;
  recentFieldJournalEntries: FieldJournalEntryRow[];
  recentCompletedTicks: RecentCompletedTick[];
  narrativeRewriteCountLast24h: number;
  developmentProposalCountLast24h: number | null;
  futureSourceStates: {
    developmentProposalRate: HomeostatFutureSourceState;
    organErrorRate: HomeostatFutureSourceState;
    rollbackFrequency: HomeostatFutureSourceState;
  };
};

export type HomeostatEvaluationResult = {
  snapshot: HomeostatSnapshot;
  reactions: HomeostatReactionRequest[];
};

export type HomeostatRunResult = {
  snapshot: HomeostatSnapshot;
  reactions: HomeostatReactionRequest[];
  skippedIdempotencyKeys: string[];
};

export type HomeostatService = {
  evaluateTickComplete(input: { tickId: string; createdAt?: string }): Promise<HomeostatRunResult>;
  evaluatePeriodic(input?: { createdAt?: string }): Promise<HomeostatRunResult>;
};

export type PeriodicHomeostatWorker = {
  start(): Promise<void>;
  stop(): Promise<void>;
};

type PeriodicQueueBoss = {
  start: () => Promise<unknown>;
  createQueue: (...args: Parameters<PgBoss['createQueue']>) => Promise<unknown>;
  schedule: (...args: Parameters<PgBoss['schedule']>) => Promise<unknown>;
  work: (...args: Parameters<PgBoss['work']>) => Promise<unknown>;
  offWork: (...args: Parameters<PgBoss['offWork']>) => Promise<unknown>;
  unschedule: (...args: Parameters<PgBoss['unschedule']>) => Promise<unknown>;
  stop: (...args: Parameters<PgBoss['stop']>) => Promise<unknown>;
};

type HomeostatServiceOptions = {
  now?: () => Date;
  createId?: () => string;
  dedupeWindowMs?: number;
  loadContext: (input: {
    cadenceKind: HomeostatCadenceKind;
    tickId: string | null;
    createdAt: string;
  }) => Promise<HomeostatEvaluationContext>;
  loadLatestSnapshot: () => Promise<HomeostatSnapshot | null>;
  persistSnapshot: (snapshot: HomeostatSnapshot) => Promise<void>;
  updateReactionRequestRefs: (input: {
    snapshotId: string;
    reactionRequestRefs: string[];
  }) => Promise<void>;
  enqueueReactionRequest: (request: HomeostatReactionRequest) => Promise<void>;
  handleReactionRequest?: (request: HomeostatReactionRequest) => Promise<void>;
};

type PeriodicHomeostatWorkerOptions = {
  createBoss?: () => PeriodicQueueBoss;
};

type Threshold = {
  warning: number;
  critical: number;
};

const THRESHOLDS: Record<HomeostatSignalFamily, Threshold> = {
  affect_volatility: { warning: 0.45, critical: 0.7 },
  goal_churn: { warning: 0.3, critical: 0.5 },
  coalition_dominance: { warning: 5, critical: 12 },
  narrative_rewrite_rate: { warning: 2, critical: 5 },
  development_proposal_rate: { warning: 3, critical: 6 },
  resource_pressure: { warning: 0.75, critical: 0.9 },
  organ_error_rate: { warning: 0.05, critical: 0.15 },
  rollback_frequency: { warning: 2, critical: 4 },
};

const DEFAULT_DEDUPE_WINDOW_MS = 15 * 60 * 1_000;
const PERIODIC_POLLING_INTERVAL_SECONDS = 1;

const runtimeSchemaTable = (table: string): string => `polyphony_runtime.${table}`;

const tickColumns = `
  tick_id as "tickId",
  selected_coalition_id as "selectedCoalitionId",
  ended_at::text as "endedAt"
`;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
};

const parseIsoDate = (value: string): number => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const withRuntimeClient = async <T>(
  connectionString: string,
  run: (client: Client) => Promise<T>,
): Promise<T> => {
  const client = createRuntimeDbClient(connectionString);
  await client.connect();

  try {
    return await run(client);
  } finally {
    await client.end();
  }
};

const addMilliseconds = (value: string, deltaMs: number): string =>
  new Date(parseIsoDate(value) + deltaMs).toISOString();

const buildIdempotencyKey = (input: {
  signalFamily: HomeostatSignalFamily;
  severity: Exclude<HomeostatAlertSeverity, 'none'>;
  requestedActionKind: HomeostatRequestedActionKind;
  evidenceRefs: string[];
}): string =>
  [
    input.signalFamily,
    input.severity,
    input.requestedActionKind,
    ...[...input.evidenceRefs].sort(),
  ].join('|');

const unique = <T>(values: T[]): T[] => [...new Set(values)];

const getExpectedReactionCount = (snapshot: Pick<HomeostatSnapshot, 'alerts'>): number =>
  snapshot.alerts.reduce((total, alert) => total + alert.requestedActionKinds.length, 0);

const getPublishedDedupeKeys = (input: {
  latestSnapshot: HomeostatSnapshot | null;
  createdAt: string;
  dedupeWindowMs: number;
}): Set<string> => {
  const { latestSnapshot, createdAt, dedupeWindowMs } = input;
  if (!latestSnapshot) {
    return new Set<string>();
  }

  if (parseIsoDate(createdAt) - parseIsoDate(latestSnapshot.createdAt) > dedupeWindowMs) {
    return new Set<string>();
  }

  const expectedReactionCount = getExpectedReactionCount(latestSnapshot);
  if (
    expectedReactionCount === 0 ||
    latestSnapshot.reactionRequestRefs.length < expectedReactionCount
  ) {
    return new Set<string>();
  }

  return new Set(latestSnapshot.alerts.flatMap((alert) => alert.idempotencyKeys));
};

const buildReactionKinds = (
  signalFamily: HomeostatSignalFamily,
  severity: Exclude<HomeostatAlertSeverity, 'none'>,
): HomeostatRequestedActionKind[] => {
  switch (signalFamily) {
    case HOMEOSTAT_SIGNAL_FAMILY.AFFECT_VOLATILITY:
      return severity === HOMEOSTAT_ALERT_SEVERITY.CRITICAL
        ? [HOMEOSTAT_REQUESTED_ACTION_KIND.REFLECTIVE_COUNTERWEIGHT]
        : [HOMEOSTAT_REQUESTED_ACTION_KIND.LIMIT_AFFECT_PATCH];
    case HOMEOSTAT_SIGNAL_FAMILY.GOAL_CHURN:
      return [HOMEOSTAT_REQUESTED_ACTION_KIND.RESTRICT_GOAL_PROMOTIONS];
    case HOMEOSTAT_SIGNAL_FAMILY.COALITION_DOMINANCE:
      return severity === HOMEOSTAT_ALERT_SEVERITY.CRITICAL
        ? [HOMEOSTAT_REQUESTED_ACTION_KIND.FORCE_ALTERNATIVE_SEARCH]
        : [HOMEOSTAT_REQUESTED_ACTION_KIND.ANTI_MONOCULTURE_RECALL];
    case HOMEOSTAT_SIGNAL_FAMILY.NARRATIVE_REWRITE_RATE:
      return [HOMEOSTAT_REQUESTED_ACTION_KIND.FREEZE_NARRATIVE_EDITS];
    case HOMEOSTAT_SIGNAL_FAMILY.DEVELOPMENT_PROPOSAL_RATE:
      return [HOMEOSTAT_REQUESTED_ACTION_KIND.FREEZE_DEVELOPMENT_PROPOSALS];
    case HOMEOSTAT_SIGNAL_FAMILY.RESOURCE_PRESSURE:
      return [HOMEOSTAT_REQUESTED_ACTION_KIND.LOWER_TICK_AMBITION];
    case HOMEOSTAT_SIGNAL_FAMILY.ORGAN_ERROR_RATE:
      return [HOMEOSTAT_REQUESTED_ACTION_KIND.ROUTER_QUARANTINE_ESCALATION];
    case HOMEOSTAT_SIGNAL_FAMILY.ROLLBACK_FREQUENCY:
      return [HOMEOSTAT_REQUESTED_ACTION_KIND.HUMAN_REVIEW];
  }
};

const metricToSeverity = (
  metricValue: number | null,
  threshold: Threshold,
): HomeostatAlertSeverity => {
  if (metricValue == null) {
    return HOMEOSTAT_ALERT_SEVERITY.NONE;
  }

  if (metricValue >= threshold.critical) {
    return HOMEOSTAT_ALERT_SEVERITY.CRITICAL;
  }

  if (metricValue >= threshold.warning) {
    return HOMEOSTAT_ALERT_SEVERITY.WARNING;
  }

  return HOMEOSTAT_ALERT_SEVERITY.NONE;
};

const normalizeRisk = (score: HomeostatSignalScore): number => {
  if (score.status === HOMEOSTAT_SIGNAL_STATUS.NOT_EVALUABLE) {
    return 0.2;
  }

  if (score.status === HOMEOSTAT_SIGNAL_STATUS.DEGRADED) {
    return 0.12;
  }

  if (score.metricValue == null) {
    return 0;
  }

  if (score.severity === HOMEOSTAT_ALERT_SEVERITY.CRITICAL) {
    return 1;
  }

  if (score.severity === HOMEOSTAT_ALERT_SEVERITY.WARNING) {
    return 0.65;
  }

  return clamp01(score.metricValue / Math.max(score.warningThreshold, 0.0001)) * 0.45;
};

const countRecentGoalUpdates = (goals: SubjectGoal[], createdAt: string): number => {
  const since = parseIsoDate(createdAt) - 24 * 60 * 60 * 1_000;
  return goals.filter((goal) => {
    if (goal.status === 'completed' || goal.status === 'abandoned') {
      return false;
    }

    return parseIsoDate(goal.updatedAt) >= since;
  }).length;
};

const calculateAffectVolatility = (
  latestNarrativeVersion: NarrativeSpineVersionRow | null,
  recentFieldJournalEntries: FieldJournalEntryRow[],
): number => {
  const tensions = latestNarrativeVersion?.tensionsJson ?? [];
  const averageTensionSeverity =
    tensions.length === 0
      ? 0
      : tensions.reduce((total, tension) => total + tension.severity, 0) / tensions.length;
  const escalatedEntries = recentFieldJournalEntries.filter(
    (entry) => entry.maturityState === 'escalated',
  ).length;
  const trackingEntries = recentFieldJournalEntries.filter(
    (entry) => entry.maturityState === 'tracking',
  ).length;

  return clamp01(
    Math.max(
      averageTensionSeverity,
      escalatedEntries * 0.24 + trackingEntries * 0.1,
      recentFieldJournalEntries.some((entry) =>
        entry.tensionMarkersJson.includes('resource_pressure'),
      )
        ? 0.4
        : 0,
    ),
  );
};

const calculateGoalChurn = (goals: SubjectGoal[], createdAt: string): number => {
  const activeGoals = goals.filter(
    (goal) => goal.status !== 'completed' && goal.status !== 'abandoned',
  );
  if (activeGoals.length === 0) {
    return 0;
  }

  return clamp01(countRecentGoalUpdates(activeGoals, createdAt) / activeGoals.length);
};

const calculateCoalitionDominance = (recentCompletedTicks: RecentCompletedTick[]): number => {
  const [latest] = recentCompletedTicks;
  if (!latest?.selectedCoalitionId) {
    return 0;
  }

  let streak = 0;
  for (const tick of recentCompletedTicks) {
    if (tick.selectedCoalitionId !== latest.selectedCoalitionId) {
      break;
    }
    streak += 1;
  }

  return streak;
};

const calculateResourcePressure = (resourcePostureJson: Record<string, unknown>): number =>
  clamp01(
    toNumber(resourcePostureJson['pressure']) ||
      toNumber(resourcePostureJson['cpuLoad']) ||
      toNumber(resourcePostureJson['memoryPressure']) ||
      0,
  );

const evaluateDeliveredSignal = (input: {
  signalFamily: Extract<
    HomeostatSignalFamily,
    | 'affect_volatility'
    | 'goal_churn'
    | 'coalition_dominance'
    | 'narrative_rewrite_rate'
    | 'development_proposal_rate'
    | 'resource_pressure'
  >;
  metricValue: number;
  evidenceRefs: string[];
}): HomeostatSignalScore => {
  const threshold = THRESHOLDS[input.signalFamily];
  return {
    signalFamily: input.signalFamily,
    status: HOMEOSTAT_SIGNAL_STATUS.EVALUATED,
    metricValue: input.metricValue,
    warningThreshold: threshold.warning,
    criticalThreshold: threshold.critical,
    severity: metricToSeverity(input.metricValue, threshold),
    evidenceRefs: unique(input.evidenceRefs),
  };
};

const evaluateFutureSignal = (input: {
  signalFamily: Extract<
    HomeostatSignalFamily,
    'development_proposal_rate' | 'organ_error_rate' | 'rollback_frequency'
  >;
  sourceState: HomeostatFutureSourceState;
  evidenceRefs: string[];
}): HomeostatSignalScore => {
  const threshold = THRESHOLDS[input.signalFamily];
  return {
    signalFamily: input.signalFamily,
    status:
      input.sourceState === 'available'
        ? HOMEOSTAT_SIGNAL_STATUS.DEGRADED
        : HOMEOSTAT_SIGNAL_STATUS.NOT_EVALUABLE,
    metricValue: null,
    warningThreshold: threshold.warning,
    criticalThreshold: threshold.critical,
    severity: HOMEOSTAT_ALERT_SEVERITY.NONE,
    evidenceRefs: unique(input.evidenceRefs),
  };
};

export const evaluateHomeostatSignals = (
  input: HomeostatEvaluationContext,
): HomeostatEvaluationResult => {
  const signalScores: HomeostatSignalScore[] = [
    evaluateDeliveredSignal({
      signalFamily: HOMEOSTAT_SIGNAL_FAMILY.AFFECT_VOLATILITY,
      metricValue: calculateAffectVolatility(
        input.latestNarrativeVersion,
        input.recentFieldJournalEntries,
      ),
      evidenceRefs: unique([
        ...(input.latestNarrativeVersion
          ? [`narrative:${input.latestNarrativeVersion.versionId}`]
          : ['narrative:latest:none']),
        ...input.recentFieldJournalEntries.map((entry) => `journal:${entry.entryId}`),
      ]),
    }),
    evaluateDeliveredSignal({
      signalFamily: HOMEOSTAT_SIGNAL_FAMILY.GOAL_CHURN,
      metricValue: calculateGoalChurn(input.goals, input.createdAt),
      evidenceRefs: unique(input.goals.map((goal) => `goal:${goal.goalId}`)),
    }),
    evaluateDeliveredSignal({
      signalFamily: HOMEOSTAT_SIGNAL_FAMILY.COALITION_DOMINANCE,
      metricValue: calculateCoalitionDominance(input.recentCompletedTicks),
      evidenceRefs: unique(
        input.recentCompletedTicks
          .map((tick) =>
            tick.selectedCoalitionId
              ? [`tick:${tick.tickId}`, `coalition:${tick.selectedCoalitionId}`]
              : [`tick:${tick.tickId}`],
          )
          .flat(),
      ),
    }),
    evaluateDeliveredSignal({
      signalFamily: HOMEOSTAT_SIGNAL_FAMILY.NARRATIVE_REWRITE_RATE,
      metricValue: input.narrativeRewriteCountLast24h,
      evidenceRefs: input.latestNarrativeVersion
        ? [`narrative:${input.latestNarrativeVersion.versionId}`]
        : ['narrative:latest:none'],
    }),
    input.developmentProposalCountLast24h == null
      ? evaluateFutureSignal({
          signalFamily: HOMEOSTAT_SIGNAL_FAMILY.DEVELOPMENT_PROPOSAL_RATE,
          sourceState: input.futureSourceStates.developmentProposalRate,
          evidenceRefs: ['future:CF-016:development-ledger'],
        })
      : evaluateDeliveredSignal({
          signalFamily: HOMEOSTAT_SIGNAL_FAMILY.DEVELOPMENT_PROPOSAL_RATE,
          metricValue: input.developmentProposalCountLast24h,
          evidenceRefs: ['development-governor:proposals:last-24h'],
        }),
    evaluateDeliveredSignal({
      signalFamily: HOMEOSTAT_SIGNAL_FAMILY.RESOURCE_PRESSURE,
      metricValue: calculateResourcePressure(input.resourcePostureJson),
      evidenceRefs: ['runtime:resource-posture'],
    }),
    evaluateFutureSignal({
      signalFamily: HOMEOSTAT_SIGNAL_FAMILY.ORGAN_ERROR_RATE,
      sourceState: input.futureSourceStates.organErrorRate,
      evidenceRefs: ['future:CF-015:model-health-report'],
    }),
    evaluateFutureSignal({
      signalFamily: HOMEOSTAT_SIGNAL_FAMILY.ROLLBACK_FREQUENCY,
      sourceState: input.futureSourceStates.rollbackFrequency,
      evidenceRefs: ['future:CF-018:rollback-evidence'],
    }),
  ];

  const alerts: HomeostatAlert[] = signalScores
    .filter(
      (
        score,
      ): score is HomeostatSignalScore & {
        severity: Extract<HomeostatAlertSeverity, 'warning' | 'critical'>;
      } =>
        score.severity === HOMEOSTAT_ALERT_SEVERITY.WARNING ||
        score.severity === HOMEOSTAT_ALERT_SEVERITY.CRITICAL,
    )
    .map((score) => {
      const requestedActionKinds = buildReactionKinds(score.signalFamily, score.severity);
      return {
        signalFamily: score.signalFamily,
        status: score.status,
        severity: score.severity,
        metricValue: score.metricValue,
        warningThreshold: score.warningThreshold,
        criticalThreshold: score.criticalThreshold,
        evidenceRefs: score.evidenceRefs,
        requestedActionKinds,
        idempotencyKeys: requestedActionKinds.map((requestedActionKind) =>
          buildIdempotencyKey({
            signalFamily: score.signalFamily,
            severity: score.severity,
            requestedActionKind,
            evidenceRefs: score.evidenceRefs,
          }),
        ),
      };
    });

  const reactions = alerts.flatMap((alert) =>
    alert.requestedActionKinds.map((requestedActionKind, index) => ({
      reactionRequestId: `homeostat-reaction:${randomUUID()}`,
      snapshotId: '',
      signalFamily: alert.signalFamily,
      severity: alert.severity,
      requestedActionKind,
      evidenceRefs: alert.evidenceRefs,
      idempotencyKey: alert.idempotencyKeys[index] ?? alert.idempotencyKeys[0] ?? '',
      expiresAt: addMilliseconds(
        input.createdAt,
        alert.severity === HOMEOSTAT_ALERT_SEVERITY.CRITICAL ? 30 * 60 * 1_000 : 15 * 60 * 1_000,
      ),
      createdAt: input.createdAt,
    })),
  );

  return {
    snapshot: {
      snapshotId: '',
      cadenceKind: input.cadenceKind,
      tickId: input.tickId,
      overallStability: clamp01(
        1 - Math.max(...signalScores.map((score) => normalizeRisk(score)), 0),
      ),
      signalScores,
      alerts,
      reactionRequestRefs: reactions.map((reaction) => reaction.reactionRequestId),
      developmentFreeze: input.developmentFreeze,
      createdAt: input.createdAt,
    },
    reactions,
  };
};

export function createHomeostatService(options: HomeostatServiceOptions): HomeostatService {
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? randomUUID;
  const dedupeWindowMs = options.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS;

  const runEvaluation = async (input: {
    cadenceKind: HomeostatCadenceKind;
    tickId: string | null;
    createdAt?: string;
  }): Promise<HomeostatRunResult> => {
    const createdAt = input.createdAt ?? now().toISOString();
    const context = await options.loadContext({
      cadenceKind: input.cadenceKind,
      tickId: input.tickId,
      createdAt,
    });
    const evaluated = evaluateHomeostatSignals(context);
    const snapshotId = `homeostat-snapshot:${createId()}`;
    const latestSnapshot = await options.loadLatestSnapshot();
    const dedupeKeys = getPublishedDedupeKeys({
      latestSnapshot,
      createdAt,
      dedupeWindowMs,
    });

    const reactions = evaluated.reactions
      .map((reaction) => ({
        ...reaction,
        snapshotId,
        reactionRequestId: `homeostat-reaction:${createId()}`,
      }))
      .filter((reaction) => reaction.idempotencyKey.length > 0);

    const reactionsToEnqueue = reactions.filter(
      (reaction) => !dedupeKeys.has(reaction.idempotencyKey),
    );
    const skippedIdempotencyKeys = reactions
      .filter((reaction) => dedupeKeys.has(reaction.idempotencyKey))
      .map((reaction) => reaction.idempotencyKey);

    const snapshot: HomeostatSnapshot = {
      ...evaluated.snapshot,
      snapshotId,
      reactionRequestRefs: [],
    };

    await options.persistSnapshot(snapshot);

    const enqueuedReactionRefs: string[] = [];
    for (const reaction of reactionsToEnqueue) {
      await options.enqueueReactionRequest(reaction);
      await options.handleReactionRequest?.(reaction);
      enqueuedReactionRefs.push(reaction.reactionRequestId);
      await options.updateReactionRequestRefs({
        snapshotId,
        reactionRequestRefs: [...enqueuedReactionRefs],
      });
    }

    return {
      snapshot: {
        ...snapshot,
        reactionRequestRefs: enqueuedReactionRefs,
      },
      reactions: reactionsToEnqueue,
      skippedIdempotencyKeys,
    };
  };

  return {
    evaluateTickComplete: (input) =>
      runEvaluation({
        cadenceKind: HOMEOSTAT_CADENCE_KIND.TICK_COMPLETE,
        tickId: input.tickId,
        ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      }),
    evaluatePeriodic: (input = {}) =>
      runEvaluation({
        cadenceKind: HOMEOSTAT_CADENCE_KIND.PERIODIC,
        tickId: null,
        ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      }),
  };
}

const loadRecentCompletedTicks = async (
  client: Client,
  limit = 16,
): Promise<RecentCompletedTick[]> => {
  const result = await client.query<RecentCompletedTick>(
    `select ${tickColumns}
     from ${runtimeSchemaTable('ticks')}
     where status = 'completed'
     order by ended_at desc nulls last, tick_id desc
     limit $1`,
    [limit],
  );

  return result.rows.map((row) => ({
    tickId: row.tickId,
    selectedCoalitionId: row.selectedCoalitionId ?? null,
    endedAt: row.endedAt ?? null,
  }));
};

const loadNarrativeRewriteCount = async (client: Client, createdAt: string): Promise<number> => {
  const result = await client.query<{ count: string }>(
    `select count(*)::text as count
     from ${runtimeSchemaTable('narrative_spine_versions')}
     where created_at >= $1::timestamptz - interval '1 day'
       and created_at <= $1::timestamptz`,
    [createdAt],
  );

  return toNumber(result.rows[0]?.count ?? 0);
};

const loadDevelopmentProposalCount = async (client: Client, createdAt: string): Promise<number> => {
  const result = await client.query<{ count: string }>(
    `select count(*)::text as count
     from ${runtimeSchemaTable('development_proposals')}
     where created_at >= $1::timestamptz - interval '1 day'
       and created_at <= $1::timestamptz`,
    [createdAt],
  );

  return toNumber(result.rows[0]?.count ?? 0);
};

const loadDbBackedHomeostatContext = async (
  client: Client,
  input: { cadenceKind: HomeostatCadenceKind; tickId: string | null; createdAt: string },
): Promise<HomeostatEvaluationContext> => {
  const tickStore = createTickRuntimeStore(client);
  const narrativeStore = createNarrativeMemeticStore(client);
  const state = await tickStore.getAgentState();
  const subjectStateSnapshot = await tickStore.loadSubjectStateSnapshot({
    goalLimit: 100,
    beliefLimit: 50,
    entityLimit: 50,
    relationshipLimit: 100,
  });
  const narrativeSnapshot = await narrativeStore.loadSnapshot({
    activeUnitLimit: 16,
    fieldJournalLimit: 16,
    edgeLimit: 24,
  });

  return {
    cadenceKind: input.cadenceKind,
    tickId: input.tickId,
    createdAt: input.createdAt,
    developmentFreeze: state?.developmentFreeze ?? false,
    goals: subjectStateSnapshot.goals,
    resourcePostureJson: subjectStateSnapshot.agentState.resourcePostureJson,
    latestNarrativeVersion: narrativeSnapshot.latestNarrativeVersion,
    recentFieldJournalEntries: narrativeSnapshot.recentFieldJournalEntries,
    recentCompletedTicks: await loadRecentCompletedTicks(client),
    narrativeRewriteCountLast24h: await loadNarrativeRewriteCount(client, input.createdAt),
    developmentProposalCountLast24h: await loadDevelopmentProposalCount(client, input.createdAt),
    futureSourceStates: {
      developmentProposalRate: 'available',
      organErrorRate: 'missing',
      rollbackFrequency: 'missing',
    },
  };
};

export const createDbBackedHomeostatService = (
  config: Pick<CoreRuntimeConfig, 'postgresUrl' | 'pgBossSchema'>,
  options: {
    handleReactionRequest?: (request: HomeostatReactionRequest) => Promise<void>;
  } = {},
): HomeostatService => {
  const enqueueReactionRequest = createRuntimeJobEnqueuer({
    connectionString: config.postgresUrl,
    schema: config.pgBossSchema,
  });

  return createHomeostatService({
    loadContext: (input) =>
      withRuntimeClient(config.postgresUrl, async (client) => {
        return await loadDbBackedHomeostatContext(client, input);
      }),
    loadLatestSnapshot: () =>
      withRuntimeClient(config.postgresUrl, async (client) => {
        const store = createHomeostatStore(client);
        return await store.loadLatestSnapshot();
      }),
    persistSnapshot: (snapshot) =>
      withRuntimeClient(config.postgresUrl, async (client) => {
        const store = createHomeostatStore(client);
        await store.persistSnapshot({ snapshot });
      }),
    updateReactionRequestRefs: (input) =>
      withRuntimeClient(config.postgresUrl, async (client) => {
        const store = createHomeostatStore(client);
        await store.updateReactionRequestRefs(input);
      }),
    enqueueReactionRequest: async (request) => {
      await enqueueReactionRequest(HOMEOSTAT_REACTION_QUEUE, request);
    },
    ...(options.handleReactionRequest
      ? { handleReactionRequest: options.handleReactionRequest }
      : {}),
  });
};

export const createPeriodicHomeostatWorker = (
  config: Pick<CoreRuntimeConfig, 'postgresUrl' | 'pgBossSchema'>,
  service: HomeostatService,
  options: PeriodicHomeostatWorkerOptions = {},
): PeriodicHomeostatWorker => {
  const boss =
    options.createBoss?.() ??
    new PgBoss({
      connectionString: config.postgresUrl,
      schema: config.pgBossSchema,
      migrate: true,
      supervise: false,
      schedule: true,
      cronMonitorIntervalSeconds: 1,
      cronWorkerIntervalSeconds: 1,
    });
  let started = false;

  const teardownBoss = async (graceful: boolean): Promise<void> => {
    await boss.offWork(HOMEOSTAT_PERIODIC_QUEUE).catch(() => {});
    await boss
      .unschedule(HOMEOSTAT_PERIODIC_QUEUE, HOMEOSTAT_PERIODIC_SCHEDULE_KEY)
      .catch(() => {});
    await boss
      .stop(graceful ? { graceful: true, timeout: 1_000 } : { graceful: false })
      .catch(() => {});
    started = false;
  };

  return {
    async start(): Promise<void> {
      if (started) {
        return;
      }

      try {
        await boss.start();
        await boss.createQueue(HOMEOSTAT_PERIODIC_QUEUE, {
          policy: 'singleton',
        });
        await boss.schedule(HOMEOSTAT_PERIODIC_QUEUE, HOMEOSTAT_PERIODIC_CRON, null, {
          key: HOMEOSTAT_PERIODIC_SCHEDULE_KEY,
        });
        await boss.work(
          HOMEOSTAT_PERIODIC_QUEUE,
          {
            pollingIntervalSeconds: PERIODIC_POLLING_INTERVAL_SECONDS,
          },
          async () => {
            const result = await service.evaluatePeriodic();
            return {
              snapshotId: result.snapshot.snapshotId,
              reactionRequestRefs: result.snapshot.reactionRequestRefs,
            };
          },
        );
        started = true;
      } catch (error) {
        await teardownBoss(false);
        throw error;
      }
    },

    async stop(): Promise<void> {
      await teardownBoss(true);
    },
  };
};
