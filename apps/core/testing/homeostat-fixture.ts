import { HOMEOSTAT_CADENCE_KIND, type HomeostatSnapshot } from '@yaagi/contracts/runtime';
import type { HomeostatEvaluationContext } from '../src/runtime/index.ts';

export const createBaseHomeostatContext = (
  overrides: Partial<HomeostatEvaluationContext> = {},
): HomeostatEvaluationContext => ({
  cadenceKind: HOMEOSTAT_CADENCE_KIND.TICK_COMPLETE,
  tickId: 'tick-homeostat-1',
  createdAt: '2026-03-25T12:00:00.000Z',
  developmentFreeze: false,
  goals: [
    {
      goalId: 'goal-operator-reply',
      title: 'Reply to the operator',
      status: 'active',
      priority: 5,
      goalType: 'continuity',
      parentGoalId: null,
      rationaleJson: {},
      evidenceRefs: [{ kind: 'tick', tickId: 'tick-homeostat-1' }],
      updatedAt: '2026-03-25T11:30:00.000Z',
    },
    {
      goalId: 'goal-health',
      title: 'Protect operational health',
      status: 'active',
      priority: 4,
      goalType: 'safety',
      parentGoalId: null,
      rationaleJson: {},
      evidenceRefs: [{ kind: 'system', note: 'baseline' }],
      updatedAt: '2026-03-25T05:00:00.000Z',
    },
  ],
  resourcePostureJson: {
    pressure: 0.82,
  },
  latestNarrativeVersion: {
    versionId: 'narrative-homeostat-1',
    tickId: 'tick-homeostat-1',
    basedOnVersionId: null,
    currentChapter: 'response',
    summary: 'respond carefully under pressure',
    continuityDirection: 'stabilize',
    tensionsJson: [
      {
        tensionId: 'tension-homeostat-1',
        summary: 'resource pressure is escalating',
        severity: 0.78,
      },
    ],
    provenanceAnchorsJson: ['goal:goal-operator-reply'],
    createdAt: '2026-03-25T11:59:00.000Z',
  },
  recentFieldJournalEntries: [
    {
      entryId: 'journal-homeostat-1',
      tickId: 'tick-homeostat-1',
      entryType: 'tension',
      summary: 'resource pressure constrains stable response',
      interpretation: 'watch pressure before deeper reflection',
      tensionMarkersJson: ['resource_pressure'],
      maturityState: 'tracking',
      linkedUnitId: null,
      provenanceAnchorsJson: ['goal:goal-operator-reply'],
      createdAt: '2026-03-25T11:58:00.000Z',
    },
  ],
  recentCompletedTicks: [
    {
      tickId: 'tick-homeostat-1',
      selectedCoalitionId: 'coalition-stable',
      endedAt: '2026-03-25T11:59:30.000Z',
    },
    {
      tickId: 'tick-homeostat-0',
      selectedCoalitionId: 'coalition-stable',
      endedAt: '2026-03-25T11:50:00.000Z',
    },
  ],
  narrativeRewriteCountLast24h: 1,
  developmentProposalCountLast24h: null,
  rollbackFrequencySource: null,
  futureSourceStates: {
    developmentProposalRate: 'missing',
    organErrorRate: 'missing',
    rollbackFrequency: 'missing',
  },
  ...overrides,
});

export const createSnapshotForDedupe = (
  input: Pick<HomeostatSnapshot, 'alerts' | 'createdAt'>,
): HomeostatSnapshot => ({
  snapshotId: 'homeostat-snapshot-existing',
  cadenceKind: HOMEOSTAT_CADENCE_KIND.PERIODIC,
  tickId: null,
  overallStability: 0.6,
  signalScores: [],
  alerts: input.alerts,
  reactionRequestRefs: ['existing-reaction'],
  developmentFreeze: false,
  createdAt: input.createdAt,
});
