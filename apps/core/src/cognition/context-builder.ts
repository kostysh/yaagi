import {
  DECISION_MODE,
  decisionContextSchema,
  type DecisionContext,
  type DecisionMode,
  type DecisionRefusal,
  type DecisionRefusalReason,
  type DecisionRole,
} from '@yaagi/contracts/cognition';
import {
  STIMULUS_PRIORITY,
  type PerceptionBatch,
  type PerceptionBatchItem,
} from '@yaagi/contracts/perception';
import type { RuntimeEpisodeRow, SubjectStateSnapshot } from '@yaagi/db';

export type DecisionContextLimits = {
  goalLimit: number;
  beliefLimit: number;
  entityLimit: number;
  relationshipLimit: number;
  recentEpisodeLimit: number;
};

export const DECISION_CONTEXT_LIMITS: DecisionContextLimits = Object.freeze({
  goalLimit: 10,
  beliefLimit: 10,
  entityLimit: 10,
  relationshipLimit: 20,
  recentEpisodeLimit: 5,
});

export type DecisionContextBuildInput = {
  tickId: string;
  decisionMode: DecisionMode;
  selectedModelProfileId: string;
  selectedRole: DecisionRole;
  subjectStateSnapshot: SubjectStateSnapshot;
  recentEpisodes: RuntimeEpisodeRow[];
  perceptionBatch?: PerceptionBatch;
  requiredSubjectStateSchemaVersion?: string;
  limits?: Partial<DecisionContextLimits>;
};

export type DecisionContextBuildResult =
  | {
      accepted: true;
      context: DecisionContext;
    }
  | {
      accepted: false;
      refusal: DecisionRefusal;
    };

const createRefusal = (
  reason: DecisionRefusalReason,
  detail: string,
): DecisionContextBuildResult => ({
  accepted: false,
  refusal: {
    accepted: false,
    reason,
    detail,
  },
});

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const toUrgency = (priority: PerceptionBatch['highestPriority']): number => {
  switch (priority) {
    case STIMULUS_PRIORITY.CRITICAL:
      return 1;
    case STIMULUS_PRIORITY.HIGH:
      return 0.8;
    case STIMULUS_PRIORITY.NORMAL:
      return 0.55;
    case STIMULUS_PRIORITY.LOW:
      return 0.25;
    default:
      return 0;
  }
};

const summarizePerceptionItems = (items: PerceptionBatchItem[]): string => {
  if (items.length === 0) {
    return 'no claimed stimuli';
  }

  const bySource = new Map<string, number>();
  for (const item of items) {
    bySource.set(item.source, (bySource.get(item.source) ?? 0) + 1);
  }

  const parts = [...bySource.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([source, count]) => `${source}:${count}`);

  return `${items.length} claimed stimuli (${parts.join(', ')})`;
};

const readPerceptionMeta = (
  batch: PerceptionBatch | undefined,
): {
  truncated: boolean;
  conflictMarkers: string[];
} => {
  if (!batch) {
    return {
      truncated: false,
      conflictMarkers: [],
    };
  }

  const candidate = batch as PerceptionBatch &
    Partial<{
      truncated: boolean;
      conflictMarkers: string[];
    }>;

  return {
    truncated: candidate.truncated === true,
    conflictMarkers: Array.isArray(candidate.conflictMarkers)
      ? candidate.conflictMarkers.filter(
          (marker): marker is string => typeof marker === 'string' && marker.length > 0,
        )
      : [],
  };
};

export function buildDecisionContext(input: DecisionContextBuildInput): DecisionContextBuildResult {
  if (
    input.decisionMode !== DECISION_MODE.REACTIVE &&
    input.decisionMode !== DECISION_MODE.DELIBERATIVE &&
    input.decisionMode !== DECISION_MODE.CONTEMPLATIVE
  ) {
    return createRefusal(
      'unsupported_decision_mode',
      `decision mode "${String(input.decisionMode)}" is not delivered in phase 0`,
    );
  }

  const subjectStateSchemaVersion = input.subjectStateSnapshot.subjectStateSchemaVersion;
  if (!subjectStateSchemaVersion) {
    return createRefusal(
      'context_incompatible',
      'subject-state snapshot is missing subjectStateSchemaVersion',
    );
  }

  if (
    input.requiredSubjectStateSchemaVersion &&
    subjectStateSchemaVersion !== input.requiredSubjectStateSchemaVersion
  ) {
    return createRefusal(
      'context_incompatible',
      `subject-state schema version ${subjectStateSchemaVersion} does not match expected ${input.requiredSubjectStateSchemaVersion}`,
    );
  }

  const limits = {
    ...DECISION_CONTEXT_LIMITS,
    ...(input.limits ?? {}),
  };
  const perceptionBatch = input.perceptionBatch;
  const perceptionMeta = readPerceptionMeta(perceptionBatch);
  const perceptionItems = perceptionBatch?.items ?? [];
  const sourceIds = perceptionBatch?.claimedStimulusIds.length
    ? perceptionBatch.claimedStimulusIds
    : [`tick:${input.tickId}:perception:none`];
  const novelty =
    perceptionItems.length === 0
      ? 0
      : clamp01(
          perceptionItems.reduce((total, item) => total + item.coalescedCount, 0) /
            (perceptionItems.length * 4),
        );
  const resourcePressure = clamp01(
    Number(input.subjectStateSnapshot.agentState.resourcePostureJson['pressure'] ?? 0) ||
      Number(input.subjectStateSnapshot.agentState.resourcePostureJson['cpuLoad'] ?? 0) ||
      Number(input.subjectStateSnapshot.agentState.resourcePostureJson['memoryPressure'] ?? 0) ||
      0,
  );

  const subjectStateMetaTruncated =
    input.subjectStateSnapshot.goals.length >= limits.goalLimit ||
    input.subjectStateSnapshot.beliefs.length >= limits.beliefLimit ||
    input.subjectStateSnapshot.entities.length >= limits.entityLimit ||
    input.subjectStateSnapshot.relationships.length >= limits.relationshipLimit;
  const episodeMetaTruncated = input.recentEpisodes.length >= limits.recentEpisodeLimit;

  const context = decisionContextSchema.parse({
    tickId: input.tickId,
    decisionMode: input.decisionMode,
    selectedModelProfileId: input.selectedModelProfileId,
    selectedRole: input.selectedRole,
    perceptualContext: {
      tickId: input.tickId,
      summary: summarizePerceptionItems(perceptionItems),
      urgency: toUrgency(perceptionBatch?.highestPriority ?? null),
      novelty,
      resourcePressure,
    },
    perceptualMeta: {
      truncated: perceptionMeta.truncated,
      sourceIds,
      conflictMarkers: perceptionMeta.conflictMarkers,
    },
    subjectState: {
      subjectStateSchemaVersion,
      agentState: { ...input.subjectStateSnapshot.agentState },
      goals: input.subjectStateSnapshot.goals.map((goal) => ({ ...goal })),
      beliefs: input.subjectStateSnapshot.beliefs.map((belief) => ({ ...belief })),
      entities: input.subjectStateSnapshot.entities.map((entity) => ({ ...entity })),
      relationships: input.subjectStateSnapshot.relationships.map((relationship) => ({
        ...relationship,
      })),
    },
    subjectStateMeta: {
      truncated: subjectStateMetaTruncated,
      sourceIds: [
        `agent:${input.subjectStateSnapshot.agentState.agentId}`,
        ...input.subjectStateSnapshot.goals.map((goal) => `goal:${goal.goalId}`),
        ...input.subjectStateSnapshot.beliefs.map((belief) => `belief:${belief.beliefId}`),
        ...input.subjectStateSnapshot.entities.map((entity) => `entity:${entity.entityId}`),
        ...input.subjectStateSnapshot.relationships.map(
          (relationship) =>
            `relationship:${relationship.srcEntityId}:${relationship.dstEntityId}:${relationship.relationKind}`,
        ),
      ],
      conflictMarkers: subjectStateMetaTruncated ? ['subject_state_truncated'] : [],
    },
    recentEpisodes: input.recentEpisodes.map((episode) => ({
      ...episode,
    })),
    episodeMeta: {
      truncated: episodeMetaTruncated,
      sourceIds: input.recentEpisodes.map((episode) => `episode:${episode.episodeId}`),
      conflictMarkers: episodeMetaTruncated ? ['episode_slice_truncated'] : [],
    },
    resourcePostureJson: { ...input.subjectStateSnapshot.agentState.resourcePostureJson },
  });

  return {
    accepted: true,
    context,
  };
}
