import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNarrativeMemeticCycle } from '../../src/cognition/index.ts';

const baseInput = {
  tickId: 'tick-memetic-contract',
  decisionMode: 'reactive' as const,
  perceptionSummary: {
    stimulusRefs: ['stimulus-1', 'stimulus-2'],
    urgency: 0.8,
    novelty: 0.45,
    resourcePressure: 0.35,
    summary: '2 claimed stimuli',
  },
  subjectStateSnapshot: {
    subjectStateSchemaVersion: '2026-03-25',
    agentState: {
      agentId: 'polyphony-core',
      currentFocus: 'operator continuity',
    },
    goals: [
      {
        goalId: 'goal-operator-reply',
        title: 'Reply to the operator',
      },
    ],
    beliefs: [
      {
        beliefId: 'belief-operator-waiting',
        proposition: 'the operator is waiting for a response',
      },
    ],
    entities: [
      {
        entityId: 'entity-operator',
        canonicalName: 'Operator',
      },
    ],
    relationships: [],
  },
  recentEpisodes: [
    {
      episodeId: 'episode-1',
      tickId: 'tick-1',
      summary: 'handled the previous operator question',
      sourceRefs: ['episode:episode-1'],
    },
  ],
  activeMemeticUnits: [
    {
      unitId: 'seed:goal:goal-operator-reply',
      label: 'Reply to the operator',
      activation: 0.6,
      reinforcement: 0.55,
      decay: 0.12,
      provenanceAnchors: ['goal:goal-operator-reply', 'agent:polyphony-core'],
    },
  ],
  fieldJournalExcerpts: [
    {
      entryId: 'journal-1',
      summary: 'tracking operator continuity pressure',
      tensionMarkers: ['resource_pressure'],
      provenanceAnchors: ['goal:goal-operator-reply'],
    },
  ],
  resourcePostureJson: {
    pressure: 0.35,
  },
  previousNarrative: {
    versionId: 'narrative-previous',
    currentChapter: 'hold',
    continuityDirection: 'continue',
    summary: 'continuity stayed stable',
  },
};

void test('AC-F0011-02 assembles only canonical tick-local memetic candidates and keeps durable promotion disabled', () => {
  const built = buildNarrativeMemeticCycle(baseInput);

  assert.equal(built.seededBaseline, false);
  assert.ok(built.candidates.length >= 4);
  assert.equal(
    built.candidates.some(
      (candidate) =>
        candidate.candidateId === 'candidate:stimulus:tick-memetic-contract' &&
        candidate.supportingRefs.includes('stimulus-1') &&
        candidate.durablePromotionAllowed === false,
    ),
    true,
  );
  assert.equal(
    built.candidates.every((candidate) => candidate.durablePromotionAllowed === false),
    true,
  );
});

void test('AC-F0011-03 emits bounded read-model outputs while updating only existing durable units on ordinary ticks', () => {
  const built = buildNarrativeMemeticCycle(baseInput);

  assert.equal(built.delta.seedMemeticUnits.length, 0);
  assert.equal(built.delta.memeticUnitUpdates.length, 1);
  assert.equal(built.outputs.activeMemeticUnits.length, 1);
  assert.equal(built.outputs.winningCoalition?.memberUnitIds[0], 'seed:goal:goal-operator-reply');
  assert.equal(
    built.outputs.coalitionDiagnostics.suppressedUnitIds.includes('seed:goal:goal-operator-reply'),
    false,
  );
});

void test('AC-F0011-01 bootstraps a minimal baseline when no prior narrative or durable units exist', () => {
  const built = buildNarrativeMemeticCycle({
    ...baseInput,
    tickId: 'tick-memetic-bootstrap',
    decisionMode: 'wake',
    activeMemeticUnits: [],
    previousNarrative: null,
  });

  assert.equal(built.seededBaseline, true);
  assert.ok(built.delta.seedMemeticUnits.length >= 2);
  assert.equal(
    built.delta.seedMemeticUnits.some((unit) => unit.unitId === 'seed:constitution:continuity'),
    true,
  );
  assert.ok(built.outputs.activeMemeticUnits.length >= 2);
});
