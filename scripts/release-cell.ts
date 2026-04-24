import { pathToFileURL } from 'node:url';
import {
  DEPLOY_ATTEMPT_STATUS,
  RELEASE_REQUEST_SOURCE,
  RELEASE_TARGET_ENVIRONMENT,
  ROLLBACK_EXECUTION_STATUS,
  ROLLBACK_EXECUTION_TRIGGER,
  type ReleaseTargetEnvironment,
} from '../packages/contracts/src/release-automation.ts';
import {
  buildCliReleasePrepareInput,
  createDbBackedReleaseAutomationService,
  createPnpmSmokeCellRunner,
  createReleaseCellRollbackExecutor,
  type ExecuteReleaseRollbackInput,
  type ReleaseAutomationService,
  type RunReleaseDeployAttemptInput,
} from '../apps/core/src/platform/release-automation.ts';
import { loadCoreRuntimeConfig } from '../apps/core/src/platform/core-config.ts';

type ReleaseCellAction = 'prepare' | 'deploy' | 'inspect' | 'rollback';

type ParsedArgs = {
  action: ReleaseCellAction;
  options: Map<string, string[]>;
};

const usage = `Usage:
  pnpm release:cell prepare --request-id <id> --environment local|release_cell --git-ref <ref> --actor <ref> --rollback-target-ref <ref> --governor-evidence-ref development-proposal-decision:<id> --lifecycle-rollback-target-ref graceful_shutdown:<id> --model-serving-readiness-ref model_profile_health:<profile>|report:model_health:<profile> --diagnostic-report-ref report-run:<id> [--diagnostic-report-ref report-run:<id>] [--evidence-ref <ref>]
  pnpm release:cell deploy --request-id <id> [--deploy-attempt-id <id>] [--deployment-identity <ref>] [--migration-state <ref>]
  pnpm release:cell inspect --request-id <id>
  pnpm release:cell rollback --request-id <id> --deploy-attempt-id <id> [--rollback-plan-id <id>]`;

const allowedOptionsByAction: Record<ReleaseCellAction, ReadonlySet<string>> = {
  prepare: new Set([
    'request-id',
    'environment',
    'git-ref',
    'actor',
    'rollback-target-ref',
    'governor-evidence-ref',
    'lifecycle-rollback-target-ref',
    'model-serving-readiness-ref',
    'diagnostic-report-ref',
    'evidence-ref',
  ]),
  deploy: new Set(['request-id', 'deploy-attempt-id', 'deployment-identity', 'migration-state']),
  inspect: new Set(['request-id']),
  rollback: new Set(['request-id', 'deploy-attempt-id', 'rollback-plan-id']),
};

const parseArgs = (argv: readonly string[]): ParsedArgs => {
  const [action, ...rest] = argv;
  if (
    action !== 'prepare' &&
    action !== 'deploy' &&
    action !== 'inspect' &&
    action !== 'rollback'
  ) {
    throw new Error(usage);
  }

  const options = new Map<string, string[]>();
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith('--') || value === undefined || value.startsWith('--')) {
      throw new Error(`Invalid argument sequence near ${key ?? '<end>'}\n${usage}`);
    }

    const name = key.slice(2);
    options.set(name, [...(options.get(name) ?? []), value]);
  }

  const allowedOptions = allowedOptionsByAction[action];
  for (const optionName of options.keys()) {
    if (!allowedOptions.has(optionName)) {
      throw new Error(`Unsupported --${optionName} for release:cell ${action}\n${usage}`);
    }
  }

  return { action, options };
};

const requireOne = (options: Map<string, string[]>, key: string): string => {
  const value = options.get(key)?.at(-1)?.trim();
  if (!value) {
    throw new Error(`Missing required --${key}`);
  }
  return value;
};

const many = (options: Map<string, string[]>, key: string): string[] =>
  (options.get(key) ?? []).map((value) => value.trim()).filter((value) => value.length > 0);

const optionalOne = (options: Map<string, string[]>, key: string): string | undefined => {
  const value = options.get(key)?.at(-1)?.trim();
  return value && value.length > 0 ? value : undefined;
};

const parseEnvironment = (value: string): ReleaseTargetEnvironment => {
  if (
    value === RELEASE_TARGET_ENVIRONMENT.LOCAL ||
    value === RELEASE_TARGET_ENVIRONMENT.RELEASE_CELL
  ) {
    return value;
  }
  throw new Error(`Unsupported release environment: ${value}`);
};

const createDefaultService = (): ReleaseAutomationService =>
  createDbBackedReleaseAutomationService(loadCoreRuntimeConfig(), {
    smokeRunner: createPnpmSmokeCellRunner(),
    rollbackExecutor: createReleaseCellRollbackExecutor(),
  });

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export const releaseCellResultIndicatesFailure = (result: unknown): boolean => {
  const record = asRecord(result);
  if (!record) {
    return true;
  }

  if (record['accepted'] === false) {
    return true;
  }

  const deployAttempt = asRecord(record['deployAttempt']);
  if (
    deployAttempt &&
    deployAttempt['status'] !== undefined &&
    deployAttempt['status'] !== DEPLOY_ATTEMPT_STATUS.SUCCEEDED
  ) {
    return true;
  }

  const rollbackExecution = asRecord(record['rollbackExecution']);
  if (
    rollbackExecution &&
    rollbackExecution['status'] !== undefined &&
    rollbackExecution['status'] !== ROLLBACK_EXECUTION_STATUS.SUCCEEDED
  ) {
    return true;
  }

  return false;
};

export const runReleaseCellCommand = async (
  argv: readonly string[],
  service: ReleaseAutomationService = createDefaultService(),
): Promise<unknown> => {
  const { action, options } = parseArgs(argv);

  switch (action) {
    case 'prepare':
      return await service.prepareRelease(
        buildCliReleasePrepareInput({
          requestId: requireOne(options, 'request-id'),
          targetEnvironment: parseEnvironment(requireOne(options, 'environment')),
          gitRef: requireOne(options, 'git-ref'),
          actorRef: requireOne(options, 'actor'),
          source: RELEASE_REQUEST_SOURCE.CLI,
          rollbackTargetRef: requireOne(options, 'rollback-target-ref'),
          governorEvidenceRef: requireOne(options, 'governor-evidence-ref'),
          lifecycleRollbackTargetRef: requireOne(options, 'lifecycle-rollback-target-ref'),
          modelServingReadinessRef: requireOne(options, 'model-serving-readiness-ref'),
          diagnosticReportRefs: many(options, 'diagnostic-report-ref'),
          evidenceRefs: many(options, 'evidence-ref'),
        }),
      );
    case 'deploy': {
      const deployInput: RunReleaseDeployAttemptInput = {
        requestId: requireOne(options, 'request-id'),
      };
      {
        const deployAttemptId = optionalOne(options, 'deploy-attempt-id');
        const deploymentIdentity = optionalOne(options, 'deployment-identity');
        const migrationState = optionalOne(options, 'migration-state');
        if (deployAttemptId) deployInput.deployAttemptId = deployAttemptId;
        if (deploymentIdentity) deployInput.deploymentIdentity = deploymentIdentity;
        if (migrationState) deployInput.migrationState = migrationState;
      }
      return await service.runDeployAttempt(deployInput);
    }
    case 'inspect':
      return await service.inspectRelease(requireOne(options, 'request-id'));
    case 'rollback': {
      const rollbackInput: ExecuteReleaseRollbackInput = {
        requestId: requireOne(options, 'request-id'),
        deployAttemptId: requireOne(options, 'deploy-attempt-id'),
        trigger: ROLLBACK_EXECUTION_TRIGGER.CI_MANUAL,
      };
      {
        const rollbackPlanId = optionalOne(options, 'rollback-plan-id');
        if (rollbackPlanId) rollbackInput.rollbackPlanId = rollbackPlanId;
      }
      return await service.executeRollback(rollbackInput);
    }
  }
};

const main = async (): Promise<void> => {
  try {
    const result = await runReleaseCellCommand(process.argv.slice(2));
    console.log(JSON.stringify(result, null, 2));
    if (releaseCellResultIndicatesFailure(result)) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
