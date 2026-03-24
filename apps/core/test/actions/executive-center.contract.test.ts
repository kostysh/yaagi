import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { TICK_STATUS, createRuntimeActionLogStore, createTickRuntimeStore } from '@yaagi/db';
import { createExecutiveCenter, createPhase0ToolGateway } from '../../src/actions/index.ts';
import { createActionTestConfig } from '../../testing/action-test-config.ts';
import { createSubjectStateDbHarness } from '../../../../packages/db/testing/subject-state-db-harness.ts';

void test('AC-F0010-01 normalizes a validated TickDecisionV1 action through the canonical executive interface', async () => {
  const harness = createSubjectStateDbHarness();
  const gatewayCalls: string[] = [];
  const executive = createExecutiveCenter({
    actionLogStore: createRuntimeActionLogStore(harness.db),
    toolGateway: {
      execute(input) {
        gatewayCalls.push(input.toolName ?? '<missing>');
        return Promise.resolve({
          verdict: {
            accepted: true,
            actionId: input.actionId,
            verdictKind: input.verdictKind,
            boundaryCheck: {
              allowed: true,
              reason: 'tool gateway accepted the bounded tool',
              executionProfile: input.verdictKind === 'schedule_job' ? 'job_enqueue' : 'safe_data',
            },
            resultJson: {
              toolName: input.toolName ?? null,
            },
          },
        });
      },
    },
    createActionId: (() => {
      let index = 0;
      return () => `action-${++index}`;
    })(),
  });

  const conscious = await executive.handleDecisionAction({
    tickId: 'tick-1',
    decisionMode: 'reactive',
    selectedModelProfileId: 'reflex.fast@baseline',
    action: {
      type: 'none',
      summary: 'do nothing',
    },
  });
  const review = await executive.handleDecisionAction({
    tickId: 'tick-1',
    decisionMode: 'reactive',
    selectedModelProfileId: 'reflex.fast@baseline',
    action: {
      type: 'reflect',
      summary: 'ask for review',
    },
  });
  const tool = await executive.handleDecisionAction({
    tickId: 'tick-1',
    decisionMode: 'reactive',
    selectedModelProfileId: 'reflex.fast@baseline',
    action: {
      type: 'tool_call',
      tool: 'safe_data.inspect_payload',
      summary: 'inspect payload',
      argsJson: {
        payload: 'status',
      },
    },
  });
  const job = await executive.handleDecisionAction({
    tickId: 'tick-1',
    decisionMode: 'reactive',
    selectedModelProfileId: 'reflex.fast@baseline',
    action: {
      type: 'schedule_job',
      tool: 'job_enqueue.phase0_followup',
      summary: 'queue follow-up',
      argsJson: {
        step: 'follow-up',
      },
    },
  });

  assert.equal(conscious.verdictKind, 'conscious_inaction');
  assert.equal(review.verdictKind, 'review_request');
  assert.equal(tool.verdictKind, 'tool_call');
  assert.equal(job.verdictKind, 'schedule_job');
  assert.deepEqual(gatewayCalls, ['safe_data.inspect_payload', 'job_enqueue.phase0_followup']);
});

void test('AC-F0010-03 appends one action_log row for conscious inaction, review, accepted tools and structured refusals', async () => {
  const harness = createSubjectStateDbHarness();
  const executive = createExecutiveCenter({
    actionLogStore: createRuntimeActionLogStore(harness.db),
    toolGateway: {
      execute(input) {
        if (input.toolName === 'safe_data.inspect_payload') {
          return Promise.resolve({
            verdict: {
              accepted: true,
              actionId: input.actionId,
              verdictKind: 'tool_call',
              boundaryCheck: {
                allowed: true,
                reason: 'safe_data is allowlisted',
                executionProfile: 'safe_data',
              },
              resultJson: {
                toolName: input.toolName,
              },
            },
          });
        }

        return Promise.resolve({
          verdict: {
            accepted: false,
            actionId: input.actionId,
            verdictKind: 'tool_call',
            boundaryCheck: {
              allowed: false,
              reason: 'unsupported tool',
              deniedBy: 'tool_allowlist',
            },
            refusalReason: 'unsupported_tool',
            detail: `${input.toolName} is not allowlisted`,
          },
        });
      },
    },
    createActionId: (() => {
      let index = 0;
      return () => `action-${++index}`;
    })(),
  });

  await executive.handleDecisionAction({
    tickId: 'tick-audit',
    decisionMode: 'reactive',
    selectedModelProfileId: 'reflex.fast@baseline',
    action: {
      type: 'none',
      summary: 'do nothing explicitly',
    },
  });
  await executive.handleDecisionAction({
    tickId: 'tick-audit',
    decisionMode: 'reactive',
    selectedModelProfileId: 'reflex.fast@baseline',
    action: {
      type: 'reflect',
      summary: 'review explicitly',
    },
  });
  await executive.handleDecisionAction({
    tickId: 'tick-audit',
    decisionMode: 'reactive',
    selectedModelProfileId: 'reflex.fast@baseline',
    action: {
      type: 'tool_call',
      tool: 'safe_data.inspect_payload',
      summary: 'inspect',
      argsJson: {
        payload: 'status',
      },
    },
  });
  await executive.handleDecisionAction({
    tickId: 'tick-audit',
    decisionMode: 'reactive',
    selectedModelProfileId: 'reflex.fast@baseline',
    action: {
      type: 'tool_call',
      tool: 'state.mutate',
      summary: 'mutate forbidden state',
      argsJson: {
        key: 'psm_json',
      },
    },
  });

  const rows = Object.values(harness.state.actionLogsById);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((row) => row.actionKind).sort(), [
    'conscious_inaction',
    'review_request',
    'tool_call',
    'tool_call',
  ]);
  assert.equal(rows.find((row) => row.toolName === 'state.mutate')?.success, false);
});

void test('AC-F0010-03 preserves reserved tick action_id and rolls back git_body writes when canonical audit append fails', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'yaagi-f0010-audit-rollback-'));
  const config = createActionTestConfig(rootDir);
  await mkdir(config.workspaceBodyPath, { recursive: true });
  await mkdir(config.seedRootPath, { recursive: true });
  const targetPath = path.join(config.workspaceBodyPath, 'notes', 'executive.txt');
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, 'stable content', 'utf8');

  const harness = createSubjectStateDbHarness({
    seed: {
      ticks: {
        'tick-audit-rollback': {
          tickId: 'tick-audit-rollback',
          agentId: 'polyphony-core',
          requestId: 'request-audit-rollback',
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
  const tickStore = createTickRuntimeStore(harness.db);
  const executive = createExecutiveCenter({
    actionLogStore: {
      appendActionLog: () => Promise.reject(new Error('action_log unavailable')),
    },
    toolGateway: createPhase0ToolGateway({ config }),
    createActionId: () => 'action-audit-rollback',
    reserveActionId: async (input) => {
      await tickStore.setTickActionId(input);
    },
  });

  await assert.rejects(
    () =>
      executive.handleDecisionAction({
        tickId: 'tick-audit-rollback',
        decisionMode: 'reactive',
        selectedModelProfileId: 'reflex.fast@baseline',
        action: {
          type: 'tool_call',
          tool: 'git_body.write_file',
          summary: 'attempt bounded write before audit failure',
          argsJson: {
            relativePath: 'notes/executive.txt',
            content: 'mutated content',
          },
        },
      }),
    /action_log unavailable/,
  );

  assert.equal(await readFile(targetPath, 'utf8'), 'stable content');
  assert.equal(harness.state.ticks['tick-audit-rollback']?.actionId, 'action-audit-rollback');
});
