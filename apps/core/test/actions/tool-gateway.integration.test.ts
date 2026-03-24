import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createPhase0ToolGateway } from '../../src/actions/index.ts';
import { createActionTestConfig } from '../../testing/action-test-config.ts';

void test('AC-F0010-02 refuses out-of-scope world/state mutation tools until canonical owner adapters exist', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'yaagi-f0010-refuse-'));
  const config = createActionTestConfig(rootDir);
  await mkdir(config.workspaceBodyPath, { recursive: true });

  const gateway = createPhase0ToolGateway({ config });
  const refusal = await gateway.execute({
    tickId: 'tick-1',
    actionId: 'action-unsupported',
    verdictKind: 'tool_call',
    toolName: 'state.mutate',
    parametersJson: {
      table: 'psm_json',
    },
  });

  assert.equal(refusal.verdict.accepted, false);
  assert.equal(refusal.verdict.refusalReason, 'unsupported_tool');
  assert.equal(refusal.verdict.boundaryCheck.deniedBy, 'tool_allowlist');
});
