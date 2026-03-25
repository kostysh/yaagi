import {
  createEmptyNarrativeMemeticOutputs,
  type ContextSectionMeta,
  type FieldJournalMaturityState,
  type NarrativeMemeticInputs,
  type NarrativeMemeticJournalEntry,
  type NarrativeMemeticOutputs,
  type NarrativeMemeticSeedUnit,
  type NarrativeMemeticTickDelta,
  type NarrativeMemeticTension,
  type TickLocalMemeticCandidate,
} from '@yaagi/contracts/cognition';

export type PreviousNarrativeSummary = {
  versionId: string;
  currentChapter: string;
  continuityDirection: string;
  summary: string;
} | null;

export type NarrativeMemeticBuildInput = NarrativeMemeticInputs & {
  previousNarrative: PreviousNarrativeSummary;
};

export type NarrativeMemeticBuildResult = {
  outputs: NarrativeMemeticOutputs;
  meta: ContextSectionMeta;
  candidates: TickLocalMemeticCandidate[];
  delta: NarrativeMemeticTickDelta;
  seededBaseline: boolean;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const unique = <T>(values: T[]): T[] => [...new Set(values)];

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const toStringField = (value: Record<string, unknown>, key: string): string | null => {
  const candidate = value[key];
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
};

const toSourceRefs = (input: NarrativeMemeticInputs): string[] =>
  unique([
    ...input.perceptionSummary.stimulusRefs,
    ...input.recentEpisodes.flatMap((episode) => [
      `episode:${episode.episodeId}`,
      ...episode.sourceRefs,
    ]),
    ...input.fieldJournalExcerpts.flatMap((entry) => [
      `journal:${entry.entryId}`,
      ...entry.provenanceAnchors,
    ]),
    ...input.subjectStateSnapshot.goals.flatMap((goal) => {
      const record = toRecord(goal);
      const goalId = toStringField(record, 'goalId');
      return goalId ? [`goal:${goalId}`] : [];
    }),
    ...input.subjectStateSnapshot.beliefs.flatMap((belief) => {
      const record = toRecord(belief);
      const beliefId = toStringField(record, 'beliefId');
      return beliefId ? [`belief:${beliefId}`] : [];
    }),
    ...input.subjectStateSnapshot.entities.flatMap((entity) => {
      const record = toRecord(entity);
      const entityId = toStringField(record, 'entityId');
      return entityId ? [`entity:${entityId}`] : [];
    }),
    ...input.activeMemeticUnits.flatMap((unit) => unit.provenanceAnchors),
  ]);

const tokenize = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 2);

const buildBootstrapSeedUnits = (input: NarrativeMemeticInputs): NarrativeMemeticSeedUnit[] => {
  const agentId =
    toStringField(input.subjectStateSnapshot.agentState, 'agentId') ?? 'polyphony-core';
  const seedUnits: NarrativeMemeticSeedUnit[] = [
    {
      unitId: 'seed:constitution:continuity',
      originKind: 'seeded',
      unitType: 'constitution',
      abstractLabel: 'protect continuity and constitutional guardrails',
      canonicalSummary: 'bootstrap continuity anchor for bounded runtime reasoning',
      activation: 0.82,
      reinforcement: 0.74,
      decay: 0.08,
      evidenceScore: 0.8,
      status: 'active',
      createdByPath: 'bootstrap.wake',
      provenanceAnchors: ['constitution:continuity'],
    },
    {
      unitId: `seed:identity:${agentId}`,
      originKind: 'seeded',
      unitType: 'identity',
      abstractLabel: `${agentId} identity core`,
      canonicalSummary: 'bootstrap identity anchor for the subject-state singleton',
      activation: 0.7,
      reinforcement: 0.68,
      decay: 0.1,
      evidenceScore: 0.72,
      status: 'active',
      createdByPath: 'bootstrap.wake',
      provenanceAnchors: [`agent:${agentId}`],
    },
  ];

  for (const goal of input.subjectStateSnapshot.goals.slice(0, 2)) {
    const record = toRecord(goal);
    const goalId = toStringField(record, 'goalId');
    const title = toStringField(record, 'title');
    if (!goalId || !title) {
      continue;
    }

    seedUnits.push({
      unitId: `seed:goal:${goalId}`,
      originKind: 'seeded',
      unitType: 'goal',
      abstractLabel: title,
      canonicalSummary: `bootstrap goal anchor for ${title}`,
      activation: 0.66,
      reinforcement: 0.6,
      decay: 0.12,
      evidenceScore: 0.64,
      status: 'active',
      createdByPath: 'bootstrap.wake',
      provenanceAnchors: [`goal:${goalId}`],
    });
  }

  for (const belief of input.subjectStateSnapshot.beliefs.slice(0, 2)) {
    const record = toRecord(belief);
    const beliefId = toStringField(record, 'beliefId');
    const proposition = toStringField(record, 'proposition') ?? toStringField(record, 'topic');
    if (!beliefId || !proposition) {
      continue;
    }

    seedUnits.push({
      unitId: `seed:belief:${beliefId}`,
      originKind: 'seeded',
      unitType: 'belief',
      abstractLabel: proposition,
      canonicalSummary: `bootstrap belief anchor for ${proposition}`,
      activation: 0.58,
      reinforcement: 0.54,
      decay: 0.16,
      evidenceScore: 0.56,
      status: 'active',
      createdByPath: 'bootstrap.wake',
      provenanceAnchors: [`belief:${beliefId}`],
    });
  }

  return seedUnits;
};

const buildCandidates = (input: NarrativeMemeticInputs): TickLocalMemeticCandidate[] => {
  const candidates: TickLocalMemeticCandidate[] = [];

  if (input.perceptionSummary.stimulusRefs.length > 0) {
    candidates.push({
      candidateId: `candidate:stimulus:${input.tickId}`,
      abstractLabel: input.perceptionSummary.summary,
      supportingRefs: input.perceptionSummary.stimulusRefs,
      sourceKinds: ['stimulus'],
      durablePromotionAllowed: false,
    });
  }

  for (const goal of input.subjectStateSnapshot.goals.slice(0, 3)) {
    const record = toRecord(goal);
    const goalId = toStringField(record, 'goalId');
    const title = toStringField(record, 'title');
    if (!goalId || !title) {
      continue;
    }

    candidates.push({
      candidateId: `candidate:goal:${goalId}`,
      abstractLabel: title,
      supportingRefs: [`goal:${goalId}`],
      sourceKinds: ['goal'],
      durablePromotionAllowed: false,
    });
  }

  for (const belief of input.subjectStateSnapshot.beliefs.slice(0, 2)) {
    const record = toRecord(belief);
    const beliefId = toStringField(record, 'beliefId');
    const proposition = toStringField(record, 'proposition') ?? toStringField(record, 'topic');
    if (!beliefId || !proposition) {
      continue;
    }

    candidates.push({
      candidateId: `candidate:belief:${beliefId}`,
      abstractLabel: proposition,
      supportingRefs: [`belief:${beliefId}`],
      sourceKinds: ['belief'],
      durablePromotionAllowed: false,
    });
  }

  for (const episode of input.recentEpisodes.slice(0, 2)) {
    candidates.push({
      candidateId: `candidate:episode:${episode.episodeId}`,
      abstractLabel: episode.summary,
      supportingRefs: [`episode:${episode.episodeId}`, ...episode.sourceRefs],
      sourceKinds: ['episode'],
      durablePromotionAllowed: false,
    });
  }

  for (const entry of input.fieldJournalExcerpts.slice(0, 2)) {
    candidates.push({
      candidateId: `candidate:journal:${entry.entryId}`,
      abstractLabel: entry.summary,
      supportingRefs: [`journal:${entry.entryId}`, ...entry.provenanceAnchors],
      sourceKinds: ['journal'],
      durablePromotionAllowed: false,
    });
  }

  return candidates;
};

const buildUnitUpdates = (
  input: NarrativeMemeticInputs,
  candidates: TickLocalMemeticCandidate[],
): NarrativeMemeticTickDelta['memeticUnitUpdates'] => {
  const canonicalRefs = new Set(toSourceRefs(input));
  const candidateTokens = new Set(
    candidates.flatMap((candidate) => tokenize(candidate.abstractLabel)),
  );
  const urgencyWeight = input.perceptionSummary.urgency * 0.12;
  const noveltyWeight = input.perceptionSummary.novelty * 0.08;

  return input.activeMemeticUnits.map((unit) => {
    const anchorOverlap = unit.provenanceAnchors.filter((anchor) =>
      canonicalRefs.has(anchor),
    ).length;
    const labelTokens = tokenize(unit.label);
    const lexicalOverlap = labelTokens.filter((token) => candidateTokens.has(token)).length;
    const evidenceScore = clamp01(
      anchorOverlap * 0.24 + lexicalOverlap * 0.08 + urgencyWeight + noveltyWeight,
    );
    const activation = clamp01(unit.activation * 0.72 + evidenceScore);
    const reinforcement = clamp01(unit.reinforcement + evidenceScore * 0.5);
    const decay =
      evidenceScore > 0
        ? clamp01(Math.max(0, unit.decay - 0.08))
        : clamp01(unit.decay + 0.12 + input.perceptionSummary.resourcePressure * 0.08);

    return {
      unitId: unit.unitId,
      activation,
      reinforcement,
      decay,
      evidenceScore,
      status: activation >= 0.22 ? 'active' : 'dormant',
      lastActivatedTickId: evidenceScore > 0 ? input.tickId : null,
      provenanceAnchors: unique([...unit.provenanceAnchors, ...canonicalRefs]),
    };
  });
};

const buildTensions = (
  input: NarrativeMemeticInputs,
  updatedUnits: NarrativeMemeticTickDelta['memeticUnitUpdates'],
  suppressedUnitIds: string[],
  conflictMarkers: string[],
): NarrativeMemeticTension[] => {
  const tensions: NarrativeMemeticTension[] = [];

  if (input.perceptionSummary.resourcePressure >= 0.7) {
    tensions.push({
      tensionId: `tension:${input.tickId}:resource-pressure`,
      summary: 'resource pressure is constraining coalition stability',
      severity: clamp01(input.perceptionSummary.resourcePressure),
    });
  }

  if (suppressedUnitIds.length > 0) {
    tensions.push({
      tensionId: `tension:${input.tickId}:suppressed-units`,
      summary: `${suppressedUnitIds.length} active unit(s) were suppressed by the winning coalition`,
      severity: clamp01(suppressedUnitIds.length / Math.max(updatedUnits.length, 1)),
    });
  }

  if (conflictMarkers.includes('no_winning_coalition')) {
    tensions.push({
      tensionId: `tension:${input.tickId}:no-coalition`,
      summary: 'candidate pressure did not produce a stable winning coalition',
      severity: clamp01(
        input.perceptionSummary.urgency * 0.75 + input.perceptionSummary.novelty * 0.25,
      ),
    });
  }

  return tensions.slice(0, 3);
};

const toExcerptMaturityState = (hasTensionMarkers: boolean): FieldJournalMaturityState =>
  hasTensionMarkers ? 'tracking' : 'immature';

export function buildNarrativeMemeticCycle(
  input: NarrativeMemeticBuildInput,
): NarrativeMemeticBuildResult {
  const seededBaseline = input.activeMemeticUnits.length === 0;
  const seedMemeticUnits = seededBaseline ? buildBootstrapSeedUnits(input) : [];
  const effectiveUnits = seededBaseline
    ? seedMemeticUnits.map((unit) => ({
        unitId: unit.unitId,
        label: unit.abstractLabel,
        activation: unit.activation,
        reinforcement: unit.reinforcement,
        decay: unit.decay,
        provenanceAnchors: unit.provenanceAnchors,
      }))
    : input.activeMemeticUnits;
  const candidates = buildCandidates(input);
  const effectiveInput = {
    ...input,
    activeMemeticUnits: effectiveUnits,
  };
  const updatedUnits = buildUnitUpdates(effectiveInput, candidates);
  const rankedUnits = [...updatedUnits].sort((left, right) => {
    const byActivation = right.activation - left.activation;
    if (byActivation !== 0) return byActivation;
    return right.reinforcement - left.reinforcement;
  });
  const winningMembers = rankedUnits.filter((unit) => unit.activation >= 0.22).slice(0, 3);
  const winningCoalition =
    winningMembers.length > 0
      ? {
          coalitionId: `coalition:${input.tickId}`,
          vector:
            input.perceptionSummary.resourcePressure >= 0.7
              ? 'stabilize'
              : input.perceptionSummary.urgency >= 0.7
                ? 'act'
                : candidates.length > winningMembers.length
                  ? 'orient'
                  : 'hold',
          strength: clamp01(
            winningMembers.reduce((total, unit) => total + unit.activation, 0) /
              winningMembers.length,
          ),
          memberUnitIds: winningMembers.map((unit) => unit.unitId),
        }
      : null;
  const suppressedUnitIds = rankedUnits
    .filter(
      (unit) => unit.activation >= 0.2 && !winningCoalition?.memberUnitIds.includes(unit.unitId),
    )
    .map((unit) => unit.unitId);
  const supportEdges =
    winningCoalition && winningCoalition.memberUnitIds.length > 1
      ? winningCoalition.memberUnitIds.slice(0, -1).map((unitId, index) => {
          const nextUnitId = winningCoalition.memberUnitIds[index + 1];
          return `edge:${unitId}:supports:${nextUnitId}`;
        })
      : [];
  const conflictMarkers = unique([
    ...(input.perceptionSummary.resourcePressure >= 0.7 ? ['resource_pressure'] : []),
    ...(input.perceptionSummary.novelty >= 0.7 ? ['novelty_spike'] : []),
    ...(winningCoalition ? [] : ['no_winning_coalition']),
    ...(seededBaseline ? ['bootstrap_seeded'] : []),
  ]);
  const tensions = buildTensions(effectiveInput, updatedUnits, suppressedUnitIds, conflictMarkers);
  const narrativeSummary = {
    currentChapter: winningCoalition?.vector ?? 'bootstrap',
    summary:
      winningCoalition && winningMembers.length > 0
        ? `coalition ${winningCoalition.vector} is led by ${winningMembers[0]?.unitId ?? 'none'} while ${input.perceptionSummary.summary}`
        : `narrative remains observational because ${input.perceptionSummary.summary}`,
    continuityDirection:
      input.previousNarrative == null
        ? 'bootstrap'
        : input.previousNarrative.currentChapter === (winningCoalition?.vector ?? 'bootstrap')
          ? 'continue'
          : 'pivot',
  };
  const journalEntry: NarrativeMemeticJournalEntry = {
    entryId: `journal:${input.tickId}:main`,
    entryType: seededBaseline ? 'bootstrap' : 'tick_tension',
    summary:
      winningCoalition == null
        ? 'tracking unresolved tension before durable promotion'
        : `tracking coalition ${winningCoalition.vector} after bounded competition`,
    interpretation:
      conflictMarkers.length > 0
        ? `markers: ${conflictMarkers.join(', ')}`
        : 'bounded coalition remained stable enough for downstream cognition',
    tensionMarkers: conflictMarkers,
    maturityState:
      input.perceptionSummary.resourcePressure >= 0.82 || winningCoalition == null
        ? 'escalated'
        : conflictMarkers.length > 0
          ? 'tracking'
          : 'immature',
    linkedUnitId: winningCoalition?.memberUnitIds[0] ?? null,
    provenanceAnchors: unique(toSourceRefs(effectiveInput)),
  };
  const fieldJournalExcerpts = [
    {
      entryId: journalEntry.entryId,
      summary: journalEntry.summary,
      maturityState: journalEntry.maturityState,
    },
    ...input.fieldJournalExcerpts.map((entry) => ({
      entryId: entry.entryId,
      summary: entry.summary,
      maturityState: toExcerptMaturityState(entry.tensionMarkers.length > 0),
    })),
  ].slice(0, 5);
  const outputs: NarrativeMemeticOutputs = {
    ...createEmptyNarrativeMemeticOutputs(),
    activeMemeticUnits: updatedUnits.map((unit) => ({
      unitId: unit.unitId,
      label:
        effectiveUnits.find((candidate) => candidate.unitId === unit.unitId)?.label ?? unit.unitId,
      activation: unit.activation,
      reinforcement: unit.reinforcement,
      decay: unit.decay,
    })),
    winningCoalition,
    coalitionDiagnostics: {
      suppressedUnitIds,
      supportEdges,
      conflictMarkers,
    },
    affectPatch: {
      arousal: input.perceptionSummary.urgency,
      pressure: input.perceptionSummary.resourcePressure,
      narrativeWeight: winningCoalition?.strength ?? 0,
    },
    narrativeSummary,
    fieldJournalExcerpts,
    narrativeTensions: tensions,
    provenanceAnchors: journalEntry.provenanceAnchors,
  };
  const delta: NarrativeMemeticTickDelta = {
    seedMemeticUnits,
    memeticUnitUpdates: seededBaseline ? [] : updatedUnits,
    memeticEdgeUpserts:
      winningCoalition && winningCoalition.memberUnitIds.length > 1
        ? winningCoalition.memberUnitIds.slice(0, -1).flatMap((unitId, index) => {
            const targetUnitId = winningCoalition.memberUnitIds[index + 1];
            if (!targetUnitId) {
              return [];
            }

            return [
              {
                edgeId: `edge:${unitId}:supports:${targetUnitId}`,
                sourceUnitId: unitId,
                targetUnitId,
                relationKind: 'supports' as const,
                strength: clamp01(winningCoalition.strength),
                confidence: clamp01(0.65 + input.perceptionSummary.novelty * 0.2),
              },
            ];
          })
        : [],
    coalition:
      winningCoalition == null
        ? null
        : {
            coalitionId: winningCoalition.coalitionId,
            decisionMode: input.decisionMode === 'wake' ? 'reactive' : input.decisionMode,
            vector: winningCoalition.vector,
            memberUnitIds: winningCoalition.memberUnitIds,
            supportScore: winningCoalition.strength,
            suppressionScore: clamp01(suppressedUnitIds.length / Math.max(rankedUnits.length, 1)),
            winning: true,
            provenanceAnchors: outputs.provenanceAnchors,
          },
    narrativeVersion: {
      versionId: `narrative:${input.tickId}`,
      basedOnVersionId: input.previousNarrative?.versionId ?? null,
      currentChapter: narrativeSummary.currentChapter,
      summary: narrativeSummary.summary,
      continuityDirection: narrativeSummary.continuityDirection,
      tensions,
      provenanceAnchors: outputs.provenanceAnchors,
    },
    fieldJournalEntries: [journalEntry],
  };

  return {
    outputs,
    meta: {
      truncated: false,
      sourceIds:
        outputs.provenanceAnchors.length > 0
          ? outputs.provenanceAnchors
          : [`tick:${input.tickId}:narrative:none`],
      conflictMarkers,
    },
    candidates,
    delta,
    seededBaseline,
  };
}
