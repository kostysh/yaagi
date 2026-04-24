import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DEPLOY_ATTEMPT_STATUS,
  RELEASE_REQUEST_SOURCE,
  RELEASE_TARGET_ENVIRONMENT,
  ROLLBACK_EXECUTION_STATUS,
  ROLLBACK_EXECUTION_TRIGGER,
} from '../packages/contracts/src/release-automation.ts';
import {
  releaseCellResultIndicatesFailure,
  runReleaseCellCommand,
} from '../scripts/release-cell.ts';
import type { ReleaseAutomationService } from '../apps/core/src/platform/release-automation.ts';

type Call = {
  method: string;
  input: Record<string, unknown>;
};

const createFakeService = (calls: Call[]): ReleaseAutomationService => ({
  prepareRelease: (input) => {
    calls.push({ method: 'prepareRelease', input: input as unknown as Record<string, unknown> });
    return Promise.resolve({
      accepted: true,
      request: {
        requestId: input.requestId,
        normalizedRequestHash: 'hash',
        targetEnvironment: input.targetEnvironment,
        gitRef: input.gitRef,
        rollbackTargetRef: input.rollbackTargetRef,
        actorRef: input.actorRef,
        source: input.source,
        requestedAction: 'deploy',
        evidenceRefs: input.evidenceRefs ?? [],
        requestedAt: input.requestedAt ?? '2026-04-24T18:20:00.000Z',
        createdAt: input.requestedAt ?? '2026-04-24T18:20:00.000Z',
      },
      rollbackPlan: {
        rollbackPlanId: 'rollback-plan:cli',
        releaseRequestId: input.requestId,
        deployAttemptId: null,
        rollbackTargetRef: input.rollbackTargetRef,
        requiredEvidenceRefs: [],
        executionMode: 'automatic',
        preflightStatus: 'ready',
        createdAt: input.requestedAt ?? '2026-04-24T18:20:00.000Z',
      },
      requestDeduplicated: false,
      rollbackPlanDeduplicated: false,
    });
  },
  runDeployAttempt: (input) => {
    calls.push({ method: 'runDeployAttempt', input: input as unknown as Record<string, unknown> });
    return Promise.resolve({ accepted: false, reason: 'smoke_harness_unavailable' });
  },
  inspectRelease: (requestId) => {
    calls.push({ method: 'inspectRelease', input: { requestId } });
    return Promise.resolve(null);
  },
  executeRollback: (input) => {
    calls.push({ method: 'executeRollback', input: input as unknown as Record<string, unknown> });
    return Promise.resolve({ accepted: false, reason: 'rollback_executor_unavailable' });
  },
});

void test('AC-F0026-07 release:cell root script points at the canonical TypeScript CLI', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as {
    scripts: Record<string, string>;
  };

  assert.equal(
    packageJson.scripts['release:cell'],
    'node --experimental-strip-types scripts/release-cell.ts',
  );
  assert.equal(
    packageJson.scripts['release:cell:local'],
    'node --env-file=.env.local --experimental-strip-types scripts/release-cell.ts',
  );
});

void test('AC-F0026-07 AC-F0026-13 CLI prepare delegates to the shared release service', async () => {
  const calls: Call[] = [];
  const result = await runReleaseCellCommand(
    [
      'prepare',
      '--request-id',
      'release-request:cli',
      '--environment',
      'local',
      '--git-ref',
      'git:main',
      '--actor',
      'operator:cli',
      '--rollback-target-ref',
      'git:stable',
      '--governor-evidence-ref',
      'development-proposal-decision:1',
      '--lifecycle-rollback-target-ref',
      'graceful_shutdown:shutdown-1',
      '--model-serving-readiness-ref',
      'model_profile_health:code.deep@shared',
      '--diagnostic-report-ref',
      'report-run:development',
    ],
    createFakeService(calls),
  );

  assert.equal((result as { accepted: boolean }).accepted, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.method, 'prepareRelease');
  assert.equal(calls[0]?.input['source'], RELEASE_REQUEST_SOURCE.CLI);
  assert.equal(calls[0]?.input['targetEnvironment'], RELEASE_TARGET_ENVIRONMENT.LOCAL);
  assert.deepEqual(calls[0]?.input['diagnosticReportRefs'], ['report-run:development']);
});

void test('AC-F0026-07 CLI deploy and rollback actions stay thin service calls', async () => {
  const calls: Call[] = [];
  const service = createFakeService(calls);

  await runReleaseCellCommand(
    ['deploy', '--request-id', 'release-request:cli', '--deploy-attempt-id', 'deploy-attempt:cli'],
    service,
  );
  await runReleaseCellCommand(
    [
      'rollback',
      '--request-id',
      'release-request:cli',
      '--deploy-attempt-id',
      'deploy-attempt:cli',
    ],
    service,
  );

  assert.deepEqual(
    calls.map((call) => call.method),
    ['runDeployAttempt', 'executeRollback'],
  );
  assert.equal(calls[1]?.input['trigger'], ROLLBACK_EXECUTION_TRIGGER.CI_MANUAL);
  assert.equal(calls[1]?.input['rollbackExecutionId'], undefined);
});

void test('AC-F0026-13 CLI rejects unsupported release-control flags before service invocation', async () => {
  const calls: Call[] = [];

  await assert.rejects(
    runReleaseCellCommand(
      [
        'rollback',
        '--request-id',
        'release-request:cli',
        '--deploy-attempt-id',
        'deploy-attempt:cli',
        '--trigger',
        'operator_manual',
      ],
      createFakeService(calls),
    ),
    /Unsupported --trigger for release:cell rollback/,
  );
  await assert.rejects(
    runReleaseCellCommand(
      [
        'rollback',
        '--request-id',
        'release-request:cli',
        '--deploy-attempt-id',
        'deploy-attempt:cli',
        '--rollback-execution-id',
        'rollback-execution:cli',
      ],
      createFakeService(calls),
    ),
    /Unsupported --rollback-execution-id for release:cell rollback/,
  );

  assert.equal(calls.length, 0);
});

void test('AC-F0026-13 CLI marks rejected deploy, failed deploy and failed rollback results as command failures', () => {
  assert.equal(
    releaseCellResultIndicatesFailure({ accepted: false, reason: 'smoke_harness_unavailable' }),
    true,
  );
  assert.equal(
    releaseCellResultIndicatesFailure({
      accepted: true,
      deployAttempt: { status: DEPLOY_ATTEMPT_STATUS.SMOKE_FAILED },
    }),
    true,
  );
  assert.equal(
    releaseCellResultIndicatesFailure({
      accepted: true,
      rollbackExecution: { status: ROLLBACK_EXECUTION_STATUS.FAILED },
    }),
    true,
  );
  assert.equal(
    releaseCellResultIndicatesFailure({
      accepted: true,
      deployAttempt: { status: DEPLOY_ATTEMPT_STATUS.SUCCEEDED },
      rollbackExecution: null,
    }),
    false,
  );
});
