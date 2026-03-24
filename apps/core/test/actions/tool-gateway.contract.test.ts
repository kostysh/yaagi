import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lstat as nodeLstat,
  mkdtemp,
  mkdir,
  readFile as nodeReadFile,
  realpath as nodeRealpath,
  symlink,
  unlink as nodeUnlink,
  writeFile as nodeWriteFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createPhase0ToolGateway } from '../../src/actions/index.ts';
import { createActionTestConfig } from '../../testing/action-test-config.ts';

void test('AC-F0010-02 enforces allowlisted execution profiles and boundary checks before any side effect', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'yaagi-f0010-gateway-'));
  const config = createActionTestConfig(rootDir);
  await mkdir(config.workspaceBodyPath, { recursive: true });
  await mkdir(config.seedRootPath, { recursive: true });
  await mkdir(path.join(config.workspaceBodyPath, 'notes'), { recursive: true });

  const gateway = createPhase0ToolGateway({
    config,
    fetchImpl: () =>
      Promise.resolve(
        new Response('pong', {
          status: 200,
        }),
      ),
    executeShell: ({ command, cwd }) =>
      Promise.resolve({
        stdout: `${command}:${cwd}`,
        stderr: '',
        exitCode: 0,
      }),
    enqueueJob: (queueName) =>
      Promise.resolve({
        jobId: `${queueName}-job-id`,
        rollback: async () => {},
      }),
  });

  const safeData = await gateway.execute({
    tickId: 'tick-1',
    actionId: 'action-safe-data',
    verdictKind: 'tool_call',
    toolName: 'safe_data.inspect_payload',
    parametersJson: {
      payload: 'status',
    },
  });
  const bodyWrite = await gateway.execute({
    tickId: 'tick-1',
    actionId: 'action-body-write',
    verdictKind: 'tool_call',
    toolName: 'git_body.write_file',
    parametersJson: {
      relativePath: 'notes/result.txt',
      content: 'bounded body mutation',
    },
  });
  const bodyRead = await gateway.execute({
    tickId: 'tick-1',
    actionId: 'action-body-read',
    verdictKind: 'tool_call',
    toolName: 'git_body.read_file',
    parametersJson: {
      relativePath: 'notes/result.txt',
    },
  });
  const httpResult = await gateway.execute({
    tickId: 'tick-1',
    actionId: 'action-http',
    verdictKind: 'tool_call',
    toolName: 'network_http.get',
    parametersJson: {
      url: 'http://127.0.0.1/health',
    },
  });
  const shellResult = await gateway.execute({
    tickId: 'tick-1',
    actionId: 'action-shell',
    verdictKind: 'tool_call',
    toolName: 'restricted_shell.exec',
    parametersJson: {
      command: 'pwd',
      cwd: '.',
    },
  });
  const jobResult = await gateway.execute({
    tickId: 'tick-1',
    actionId: 'action-job',
    verdictKind: 'schedule_job',
    toolName: 'job_enqueue.phase0_followup',
    parametersJson: {
      step: 'follow-up',
    },
  });

  assert.equal(safeData.verdict.accepted, true);
  assert.equal(safeData.verdict.boundaryCheck.executionProfile, 'safe_data');
  assert.equal(bodyWrite.verdict.accepted, true);
  assert.equal(bodyWrite.verdict.boundaryCheck.executionProfile, 'git_body');
  assert.equal(bodyRead.verdict.accepted, true);
  assert.equal(httpResult.verdict.accepted, true);
  assert.equal(httpResult.verdict.boundaryCheck.executionProfile, 'network_http');
  assert.equal(shellResult.verdict.accepted, true);
  assert.equal(shellResult.verdict.boundaryCheck.executionProfile, 'restricted_shell');
  assert.equal(jobResult.verdict.accepted, true);
  assert.equal(jobResult.verdict.boundaryCheck.executionProfile, 'job_enqueue');
  assert.equal(
    await nodeReadFile(path.join(config.workspaceBodyPath, 'notes', 'result.txt'), 'utf8'),
    'bounded body mutation',
  );
});

void test('AC-F0010-02 denies restricted_shell path arguments that escape the writable runtime body', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'yaagi-f0010-shell-boundary-'));
  const config = createActionTestConfig(rootDir);
  await mkdir(config.workspaceBodyPath, { recursive: true });
  await mkdir(config.seedRootPath, { recursive: true });

  let shellCalled = false;
  const gateway = createPhase0ToolGateway({
    config,
    executeShell: () => {
      shellCalled = true;
      return Promise.resolve({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
    },
  });

  const result = await gateway.execute({
    tickId: 'tick-shell-boundary',
    actionId: 'action-shell-boundary',
    verdictKind: 'tool_call',
    toolName: 'restricted_shell.exec',
    parametersJson: {
      command: 'ls',
      cwd: '.',
      args: ['/'],
    },
  });

  assert.equal(result.verdict.accepted, false);
  assert.equal(result.verdict.refusalReason, 'boundary_denied');
  assert.equal(result.verdict.boundaryCheck.executionProfile, 'restricted_shell');
  assert.equal(result.verdict.boundaryCheck.deniedBy, 'restricted_shell.args');
  assert.equal(shellCalled, false);
});

void test('AC-F0010-05 denies git_body writes that traverse a workspace symlink into immutable seed content', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'yaagi-f0010-symlink-boundary-'));
  const config = createActionTestConfig(rootDir);
  await mkdir(config.workspaceBodyPath, { recursive: true });
  await mkdir(config.seedRootPath, { recursive: true });
  await mkdir(path.join(config.workspaceBodyPath, 'notes'), { recursive: true });
  await nodeWriteFile(
    path.join(config.seedRootPath, 'constitution.yaml'),
    'immutable seed',
    'utf8',
  );
  await symlink(config.seedRootPath, path.join(config.workspaceBodyPath, 'notes', 'seed-link'));

  const gateway = createPhase0ToolGateway({ config });
  const result = await gateway.execute({
    tickId: 'tick-symlink-boundary',
    actionId: 'action-symlink-boundary',
    verdictKind: 'tool_call',
    toolName: 'git_body.write_file',
    parametersJson: {
      relativePath: 'notes/seed-link/constitution.yaml',
      content: 'mutated seed',
    },
  });

  assert.equal(result.verdict.accepted, false);
  assert.equal(result.verdict.refusalReason, 'boundary_denied');
  assert.equal(result.verdict.boundaryCheck.deniedBy, 'git_body.symlink');
  assert.equal(
    await nodeReadFile(path.join(config.seedRootPath, 'constitution.yaml'), 'utf8'),
    'immutable seed',
  );
});

void test('AC-F0010-02 refuses git_body writes when the parent directory is missing from the workspace body', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'yaagi-f0010-parent-boundary-'));
  const config = createActionTestConfig(rootDir);
  await mkdir(config.workspaceBodyPath, { recursive: true });
  await mkdir(config.seedRootPath, { recursive: true });

  const gateway = createPhase0ToolGateway({ config });
  const result = await gateway.execute({
    tickId: 'tick-parent-boundary',
    actionId: 'action-parent-boundary',
    verdictKind: 'tool_call',
    toolName: 'git_body.write_file',
    parametersJson: {
      relativePath: 'missing/path/result.txt',
      content: 'mutated seed',
    },
  });

  assert.equal(result.verdict.accepted, false);
  assert.equal(result.verdict.refusalReason, 'boundary_denied');
  assert.equal(result.verdict.boundaryCheck.deniedBy, 'git_body.parent');
});

void test('AC-F0010-02 returns execution_timeout before a delayed git_body parent inspection can reach any write side effect', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'yaagi-f0010-parent-timeout-'));
  const config = createActionTestConfig(rootDir);
  await mkdir(config.workspaceBodyPath, { recursive: true });
  await mkdir(config.seedRootPath, { recursive: true });

  const delayedParentPath = path.join(config.workspaceBodyPath, 'missing');
  let delayedInspectionResolved = false;
  const gateway = createPhase0ToolGateway({
    config,
    fileOps: {
      lstat: (async (
        targetPath: Parameters<typeof nodeLstat>[0],
        options?: Parameters<typeof nodeLstat>[1],
      ) => {
        if (path.resolve(String(targetPath)) === delayedParentPath) {
          await delay(1_700);
          delayedInspectionResolved = true;
          const error = Object.assign(new Error('missing parent'), {
            code: 'ENOENT',
          });
          throw error;
        }

        return await nodeLstat(targetPath, options as never);
      }) as typeof nodeLstat,
      readFile: nodeReadFile,
      realpath: nodeRealpath,
      unlink: nodeUnlink,
      writeFile: nodeWriteFile,
    },
  });
  const targetFilePath = path.join(config.workspaceBodyPath, 'missing', 'result.txt');
  const startedAt = Date.now();
  const result = await gateway.execute({
    tickId: 'tick-parent-timeout',
    actionId: 'action-parent-timeout',
    verdictKind: 'tool_call',
    toolName: 'git_body.write_file',
    parametersJson: {
      relativePath: 'missing/result.txt',
      content: 'mutated seed',
    },
  });
  const elapsedMs = Date.now() - startedAt;

  assert.equal(result.verdict.accepted, false);
  assert.equal(result.verdict.refusalReason, 'execution_timeout');
  assert.ok(
    elapsedMs < 1_700,
    `expected timeout refusal inside the 1500ms budget window, got ${elapsedMs}ms`,
  );
  await delay(250);
  assert.equal(delayedInspectionResolved, true);
  await assert.rejects(nodeReadFile(targetFilePath, 'utf8'));
});

void test('AC-F0010-02 bounds schedule_job enqueue latency with an explicit timeout refusal', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'yaagi-f0010-job-timeout-'));
  const config = createActionTestConfig(rootDir);
  await mkdir(config.workspaceBodyPath, { recursive: true });
  await mkdir(config.seedRootPath, { recursive: true });

  const gateway = createPhase0ToolGateway({
    config,
    enqueueJob: async (_queueName, _payload, options) => {
      const toAbortError = (): Error => {
        const reason: unknown = options?.signal?.reason;
        return reason instanceof Error ? reason : new Error('aborted');
      };

      return await new Promise((_, reject) => {
        options?.signal?.addEventListener('abort', () => reject(toAbortError()), { once: true });
      });
    },
  });
  const result = await gateway.execute({
    tickId: 'tick-job-timeout',
    actionId: 'action-job-timeout',
    verdictKind: 'schedule_job',
    toolName: 'job_enqueue.phase0_followup',
    parametersJson: {
      step: 'follow-up',
    },
  });

  assert.equal(result.verdict.accepted, false);
  assert.equal(result.verdict.refusalReason, 'execution_timeout');
  assert.equal(result.verdict.boundaryCheck.executionProfile, 'job_enqueue');
});

void test('AC-F0010-02 prevents a late schedule_job enqueue from surfacing after the bounded timeout window', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'yaagi-f0010-job-late-timeout-'));
  const config = createActionTestConfig(rootDir);
  await mkdir(config.workspaceBodyPath, { recursive: true });
  await mkdir(config.seedRootPath, { recursive: true });

  let lateCommitReached = false;
  const gateway = createPhase0ToolGateway({
    config,
    enqueueJob: async (_queueName, _payload, options) => {
      const toAbortError = (): Error => {
        const reason: unknown = options?.signal?.reason;
        return reason instanceof Error ? reason : new Error('aborted');
      };

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          lateCommitReached = true;
          resolve();
        }, 1_700);

        options?.signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            reject(toAbortError());
          },
          { once: true },
        );
      });

      return {
        jobId: 'late-job-id',
        rollback: () => {
          lateCommitReached = false;
          return Promise.resolve();
        },
      };
    },
  });
  const result = await gateway.execute({
    tickId: 'tick-job-late-timeout',
    actionId: 'action-job-late-timeout',
    verdictKind: 'schedule_job',
    toolName: 'job_enqueue.phase0_followup',
    parametersJson: {
      step: 'follow-up',
    },
  });

  assert.equal(result.verdict.accepted, false);
  assert.equal(result.verdict.refusalReason, 'execution_timeout');
  await delay(250);
  assert.equal(lateCommitReached, false);
});
