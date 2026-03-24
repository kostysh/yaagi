import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRuntimeActionLogStore } from '@yaagi/db';
import { createExecutiveCenter, createPhase0ToolGateway } from '../../src/actions/index.ts';
import { createActionTestConfig } from '../../testing/action-test-config.ts';
import { createSubjectStateDbHarness } from '../../../../packages/db/testing/subject-state-db-harness.ts';

void test('AC-F0010-05 returns structured refusal and action_log evidence before boundary-denied side effects', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'yaagi-f0010-refusal-'));
  const config = createActionTestConfig(rootDir);
  await mkdir(config.workspaceBodyPath, { recursive: true });
  await mkdir(config.seedRootPath, { recursive: true });
  await writeFile(config.seedConstitutionPath, 'immutable seed', 'utf8');

  const harness = createSubjectStateDbHarness();
  const executive = createExecutiveCenter({
    actionLogStore: createRuntimeActionLogStore(harness.db),
    toolGateway: createPhase0ToolGateway({ config }),
    createActionId: () => 'action-boundary-denied',
  });

  const verdict = await executive.handleDecisionAction({
    tickId: 'tick-refusal',
    decisionMode: 'reactive',
    selectedModelProfileId: 'reflex.fast@baseline',
    action: {
      type: 'tool_call',
      tool: 'git_body.write_file',
      summary: 'attempt forbidden seed mutation',
      argsJson: {
        relativePath: '../../seed/constitution.yaml',
        content: 'mutated',
      },
    },
  });

  assert.equal(verdict.accepted, false);
  assert.equal(verdict.refusalReason, 'boundary_denied');
  assert.equal(await readFile(config.seedConstitutionPath, 'utf8'), 'immutable seed');
  assert.deepEqual(harness.state.actionLogsById['action-boundary-denied']?.resultJson, {
    refusalReason: 'boundary_denied',
    detail:
      'path ../../seed/constitution.yaml targets /seed, which is immutable for the executive seam',
  });
});
