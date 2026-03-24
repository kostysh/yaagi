import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRuntimeActionLogStore } from '@yaagi/db';
import { createExecutiveCenter, createPhase0ToolGateway } from '../../src/actions/index.ts';
import { createActionTestConfig } from '../../testing/action-test-config.ts';
import { createSubjectStateDbHarness } from '../../../../packages/db/testing/subject-state-db-harness.ts';

void test('AC-F0010-06 routes body or state consequences through bounded canonical owners instead of direct foreign writes', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'yaagi-f0010-write-authority-'));
  const config = createActionTestConfig(rootDir);
  await mkdir(config.workspaceBodyPath, { recursive: true });
  await mkdir(config.seedRootPath, { recursive: true });
  await mkdir(path.join(config.workspaceBodyPath, 'notes'), { recursive: true });

  const harness = createSubjectStateDbHarness({
    seed: {
      agentState: {
        id: 1,
        agentId: 'polyphony-core',
        mode: 'normal',
        schemaVersion: '2026-03-24',
        bootStateJson: {},
        currentTickId: null,
        currentModelProfileId: null,
        lastStableSnapshotId: null,
        psmJson: {
          continuityMarker: 'stable',
        },
        resourcePostureJson: {},
        developmentFreeze: false,
        updatedAt: '2026-03-24T00:00:00.000Z',
      },
    },
  });
  const executive = createExecutiveCenter({
    actionLogStore: createRuntimeActionLogStore(harness.db),
    toolGateway: createPhase0ToolGateway({ config }),
    createActionId: (() => {
      let index = 0;
      return () => `action-${++index}`;
    })(),
  });

  const workspaceWrite = await executive.handleDecisionAction({
    tickId: 'tick-write-authority',
    decisionMode: 'reactive',
    selectedModelProfileId: 'reflex.fast@baseline',
    action: {
      type: 'tool_call',
      tool: 'git_body.write_file',
      summary: 'write only inside workspace body',
      argsJson: {
        relativePath: 'notes/executive.txt',
        content: 'bounded workspace write',
      },
    },
  });
  const foreignWrite = await executive.handleDecisionAction({
    tickId: 'tick-write-authority',
    decisionMode: 'reactive',
    selectedModelProfileId: 'reflex.fast@baseline',
    action: {
      type: 'tool_call',
      tool: 'state.mutate',
      summary: 'attempt direct foreign state write',
      argsJson: {
        table: 'psm_json',
      },
    },
  });

  assert.equal(workspaceWrite.accepted, true);
  assert.equal(
    await readFile(path.join(config.workspaceBodyPath, 'notes', 'executive.txt'), 'utf8'),
    'bounded workspace write',
  );
  assert.equal(foreignWrite.accepted, false);
  assert.equal(foreignWrite.refusalReason, 'unsupported_tool');
  assert.deepEqual(harness.state.agentState?.psmJson, {
    continuityMarker: 'stable',
  });
});
