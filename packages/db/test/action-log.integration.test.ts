import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeActionLogStore, TICK_STATUS } from '../src/index.ts';
import { createSubjectStateDbHarness } from '../testing/subject-state-db-harness.ts';

void test('AC-F0010-03 writes one append-only action_log row for each accepted, refused and review-oriented executive verdict', async () => {
  const harness = createSubjectStateDbHarness({
    seed: {
      ticks: {
        'tick-action-log': {
          tickId: 'tick-action-log',
          agentId: 'polyphony-core',
          requestId: 'request-action-log',
          tickKind: 'reactive',
          triggerKind: 'system',
          status: TICK_STATUS.STARTED,
          queuedAt: '2026-03-24T00:00:00.000Z',
          startedAt: '2026-03-24T00:00:00.000Z',
          endedAt: null,
          leaseOwner: 'core',
          leaseExpiresAt: '2026-03-24T00:01:00.000Z',
          requestJson: {},
          resultJson: {},
          failureJson: {},
          continuityFlagsJson: {},
          selectedCoalitionId: null,
          selectedModelProfileId: 'reflex.fast@baseline',
          actionId: null,
          createdAt: '2026-03-24T00:00:00.000Z',
          updatedAt: '2026-03-24T00:00:00.000Z',
        },
      },
    },
  });
  const store = createRuntimeActionLogStore(harness.db);

  await store.appendActionLog({
    actionId: 'action-conscious',
    tickId: 'tick-action-log',
    actionKind: 'conscious_inaction',
    boundaryCheckJson: {
      allowed: true,
      reason: 'conscious inaction is explicit',
    },
    resultJson: {
      outcome: 'conscious_inaction',
    },
    success: true,
    createdAt: new Date('2026-03-24T00:00:01.000Z'),
  });
  await store.appendActionLog({
    actionId: 'action-review',
    tickId: 'tick-action-log',
    actionKind: 'review_request',
    boundaryCheckJson: {
      allowed: true,
      reason: 'review request was explicit',
    },
    resultJson: {
      outcome: 'review_request',
    },
    success: true,
    createdAt: new Date('2026-03-24T00:00:02.000Z'),
  });
  await store.appendActionLog({
    actionId: 'action-tool',
    tickId: 'tick-action-log',
    actionKind: 'tool_call',
    toolName: 'safe_data.inspect_payload',
    parametersJson: {
      query: 'status',
    },
    boundaryCheckJson: {
      allowed: true,
      reason: 'safe_data is allowlisted',
      executionProfile: 'safe_data',
    },
    resultJson: {
      toolName: 'safe_data.inspect_payload',
    },
    success: true,
    createdAt: new Date('2026-03-24T00:00:03.000Z'),
  });
  await store.appendActionLog({
    actionId: 'action-refused',
    tickId: 'tick-action-log',
    actionKind: 'tool_call',
    toolName: 'git_body.write_file',
    parametersJson: {
      relativePath: '../../seed/constitution.yaml',
    },
    boundaryCheckJson: {
      allowed: false,
      reason: 'seed is immutable',
      executionProfile: 'git_body',
      deniedBy: 'git_body.seed',
    },
    resultJson: {
      refusalReason: 'boundary_denied',
    },
    success: false,
    createdAt: new Date('2026-03-24T00:00:04.000Z'),
  });

  const rows = await store.listActionLogForTick({
    tickId: 'tick-action-log',
    limit: 10,
  });
  const latest = await store.getActionLog('action-refused');

  assert.deepEqual(
    rows.map((row) => row.actionId),
    ['action-refused', 'action-tool', 'action-review', 'action-conscious'],
  );
  assert.equal(latest?.success, false);
  assert.equal(latest?.boundaryCheckJson.deniedBy, 'git_body.seed');
  assert.equal(latest?.createdAt, '2026-03-24T00:00:04.000Z');
});
