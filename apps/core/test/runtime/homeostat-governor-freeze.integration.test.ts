import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOMEOSTAT_ALERT_SEVERITY,
  HOMEOSTAT_REQUESTED_ACTION_KIND,
  HOMEOSTAT_SIGNAL_FAMILY,
  type HomeostatReactionRequest,
} from '@yaagi/contracts/runtime';
import {
  createDbBackedDevelopmentGovernorService,
  createHomeostatService,
} from '../../src/runtime/index.ts';
import { createBaseHomeostatContext } from '../../testing/homeostat-fixture.ts';

void test('AC-F0016-03 routes critical development proposal pressure to the governor reaction handler', async () => {
  const handled: HomeostatReactionRequest[] = [];
  const service = createHomeostatService({
    createId: (() => {
      let index = 0;
      return () => `id-${++index}`;
    })(),
    loadContext: (input) =>
      Promise.resolve(
        createBaseHomeostatContext({
          cadenceKind: input.cadenceKind,
          tickId: input.tickId,
          createdAt: input.createdAt,
          goals: [],
          resourcePostureJson: {},
          latestNarrativeVersion: null,
          recentFieldJournalEntries: [],
          recentCompletedTicks: [],
          narrativeRewriteCountLast24h: 0,
          developmentProposalCountLast24h: 6,
          futureSourceStates: {
            developmentProposalRate: 'available',
            organErrorRate: 'missing',
            rollbackFrequency: 'missing',
          },
        }),
      ),
    loadLatestSnapshot: () => Promise.resolve(null),
    persistSnapshot: () => Promise.resolve(),
    updateReactionRequestRefs: () => Promise.resolve(),
    enqueueReactionRequest: () => Promise.resolve(),
    handleReactionRequest: (request) => {
      handled.push(request);
      return Promise.resolve();
    },
  });

  const result = await service.evaluatePeriodic({
    createdAt: '2026-04-10T12:00:00.000Z',
  });

  assert.equal(result.reactions.length, 1);
  assert.equal(handled.length, 1);
  assert.equal(handled[0]?.signalFamily, HOMEOSTAT_SIGNAL_FAMILY.DEVELOPMENT_PROPOSAL_RATE);
  assert.equal(handled[0]?.severity, HOMEOSTAT_ALERT_SEVERITY.CRITICAL);
  assert.equal(
    handled[0]?.requestedActionKind,
    HOMEOSTAT_REQUESTED_ACTION_KIND.FREEZE_DEVELOPMENT_PROPOSALS,
  );
});

void test('AC-F0016-03 keeps warning-level development proposal pressure advisory-only', async () => {
  const governor = createDbBackedDevelopmentGovernorService({
    postgresUrl: 'postgres://unused:unused@127.0.0.1:65432/unused',
  });
  const result = await governor.applyHomeostatReaction({
    reactionRequestId: 'homeostat-reaction:warning',
    snapshotId: 'homeostat-snapshot:warning',
    signalFamily: HOMEOSTAT_SIGNAL_FAMILY.DEVELOPMENT_PROPOSAL_RATE,
    severity: HOMEOSTAT_ALERT_SEVERITY.WARNING,
    requestedActionKind: HOMEOSTAT_REQUESTED_ACTION_KIND.FREEZE_DEVELOPMENT_PROPOSALS,
    evidenceRefs: ['development-governor:proposals:last-24h'],
    idempotencyKey:
      'development_proposal_rate|warning|freeze_development_proposals|development-governor:proposals:last-24h',
    expiresAt: '2026-04-10T12:15:00.000Z',
    createdAt: '2026-04-10T12:00:00.000Z',
  });

  assert.deepEqual(result, {
    accepted: false,
    requestId: 'homeostat-reaction:warning',
    reason: 'unsupported_reaction',
  });
});
