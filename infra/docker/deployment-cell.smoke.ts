import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import test from 'node:test';
import path from 'node:path';
import { inspect } from 'node:util';
import { Client } from 'pg';
import { runSmokeActivationWithFence } from './smoke-activation-fence.ts';
import { repoEnvFilePath, repoRoot, run, waitForHttp } from './helpers.ts';

// Coverage refs: AC-F0024-18

const composeFile = path.join(repoRoot(), 'infra', 'docker', 'compose.yaml');
const smokeBaseComposeFile = path.join(repoRoot(), 'infra', 'docker', 'compose.smoke-base.yaml');
const telegramSmokeComposeFile = path.join(
  repoRoot(),
  'infra',
  'docker',
  'compose.smoke-telegram.yaml',
);
const projectName = 'yaagi-phase0';
const defaultCoreHostPort = 18080;
const defaultPostgresHostPort = Number(process.env['YAAGI_SMOKE_POSTGRES_HOST_PORT'] ?? '15432');
const smokePostgresQueryTimeoutMs = 5_000;
const smokeReactivePredicateTimeoutMs = Number(
  process.env['YAAGI_SMOKE_REACTIVE_PREDICATE_TIMEOUT_MS'] ?? '90000',
);
const smokeMemoryHeadroomBytes = parseByteLimit(
  process.env['YAAGI_SMOKE_HOST_MEMORY_HEADROOM'] ?? '4g',
  'YAAGI_SMOKE_HOST_MEMORY_HEADROOM',
);
const smokePostgresMemoryLimitBytes = parseByteLimit(
  process.env['YAAGI_SMOKE_POSTGRES_MEMORY_LIMIT'] ?? '768m',
  'YAAGI_SMOKE_POSTGRES_MEMORY_LIMIT',
);
const smokeVllmFastMemoryLimitBytes = parseByteLimit(
  process.env['YAAGI_SMOKE_VLLM_FAST_MEMORY_LIMIT'] ?? '20g',
  'YAAGI_SMOKE_VLLM_FAST_MEMORY_LIMIT',
);
const smokeCoreMemoryLimitBytes = parseByteLimit(
  process.env['YAAGI_SMOKE_CORE_MEMORY_LIMIT'] ?? '1g',
  'YAAGI_SMOKE_CORE_MEMORY_LIMIT',
);
const smokeTelegramApiMemoryLimitBytes = parseByteLimit(
  process.env['YAAGI_SMOKE_TELEGRAM_API_MEMORY_LIMIT'] ?? '256m',
  'YAAGI_SMOKE_TELEGRAM_API_MEMORY_LIMIT',
);
const smokeBaseBudgetBytes =
  smokePostgresMemoryLimitBytes + smokeVllmFastMemoryLimitBytes + smokeCoreMemoryLimitBytes;

const smokeLifecycleMetrics = {
  projectStarts: 0,
  projectTeardowns: 0,
  telegramOverlayActivations: 0,
  runtimeResets: 0,
};
const smokeRuntimeIdentity = {
  baseVllmFastContainerId: '' as string,
  telegramOverlayVllmFastContainerId: '' as string,
};
const expectedRuntimeResets = 14;
let smokePostgresClient: Client | null = null;
const operatorAuthSchemaVersion = '2026-04-23.operator-auth.v1';
const operatorTokenVersion = 'opk_v1';
const smokeOperatorPrincipalsFilePath = path.join(
  repoRoot(),
  '.temp',
  'smoke',
  'operator-principals.json',
);
const smokeOperatorToken = `${operatorTokenVersion}_${sha256('smoke:operator:token').slice(0, 32)}`;

function coreBaseUrl(port = defaultCoreHostPort): string {
  return `http://127.0.0.1:${port}`;
}

function coreHealthUrl(port = defaultCoreHostPort): string {
  return `${coreBaseUrl(port)}/health`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function smokeOperatorAuthHeaders(headers: Record<string, string> = {}): Record<string, string> {
  return {
    ...headers,
    authorization: `Bearer ${smokeOperatorToken}`,
  };
}

type ComposeOptions = Parameters<typeof run>[2] & {
  telegram?: boolean;
};

function parseByteLimit(input: string, label: string): number {
  const normalized = input.trim().toLowerCase();
  const match = normalized.match(/^(\d+(?:\.\d+)?)([kmgt]?i?b?)?$/);
  assert.ok(match, `${label} must be a byte-size string like 768m or 16g, received ${input}`);

  const value = Number(match[1]);
  const unit = match[2] ?? 'b';
  const multipliers: Record<string, number> = {
    b: 1,
    k: 1024,
    kb: 1024,
    kib: 1024,
    m: 1024 ** 2,
    mb: 1024 ** 2,
    mib: 1024 ** 2,
    g: 1024 ** 3,
    gb: 1024 ** 3,
    gib: 1024 ** 3,
    t: 1024 ** 4,
    tb: 1024 ** 4,
    tib: 1024 ** 4,
  };
  const multiplier = multipliers[unit];
  assert.ok(multiplier, `${label} uses unsupported unit in ${input}`);
  return Math.floor(value * multiplier);
}

function formatBytes(bytes: number): string {
  const gib = 1024 ** 3;
  const mib = 1024 ** 2;
  if (bytes >= gib) {
    return `${(bytes / gib).toFixed(2)} GiB`;
  }
  return `${Math.ceil(bytes / mib)} MiB`;
}

async function readMemAvailableBytes(): Promise<number | null> {
  try {
    const meminfo = await readFile('/proc/meminfo', 'utf8');
    const match = meminfo.match(/^MemAvailable:\s+(\d+)\s+kB$/m);
    return match ? Number(match[1]) * 1024 : null;
  } catch {
    return null;
  }
}

async function ensureSmokeHostMemoryHeadroom(extraBudgetBytes = 0): Promise<void> {
  const memAvailableBytes = await readMemAvailableBytes();
  if (memAvailableBytes == null) {
    return;
  }

  const requiredBytes = extraBudgetBytes + smokeMemoryHeadroomBytes;
  assert.ok(
    memAvailableBytes >= requiredBytes,
    `refusing to start smoke: host MemAvailable ${formatBytes(memAvailableBytes)} is below required ${formatBytes(requiredBytes)} (requested budget ${formatBytes(extraBudgetBytes)} + headroom ${formatBytes(smokeMemoryHeadroomBytes)})`,
  );
}

const runtimeResetSql = `
truncate table
  polyphony_runtime.stimulus_inbox,
  polyphony_runtime.relationships,
  polyphony_runtime.entities,
  polyphony_runtime.beliefs,
  polyphony_runtime.goals,
  polyphony_runtime.homeostat_snapshots,
  polyphony_runtime.development_ledger,
  polyphony_runtime.development_proposal_decisions,
  polyphony_runtime.development_proposals,
  polyphony_runtime.development_freezes,
  polyphony_runtime.retention_compaction_runs,
  polyphony_runtime.graceful_shutdown_events,
  polyphony_runtime.rollback_incidents,
  polyphony_runtime.consolidation_transitions,
  polyphony_runtime.lifecycle_events,
  polyphony_runtime.candidate_stage_events,
  polyphony_runtime.model_candidates,
  polyphony_runtime.eval_runs,
  polyphony_runtime.training_runs,
  polyphony_runtime.datasets,
  polyphony_runtime.episodes,
  polyphony_runtime.action_log,
  polyphony_runtime.timeline_events,
  polyphony_runtime.ticks
restart identity cascade;

truncate table
  pgboss.schedule,
  pgboss.subscription,
  pgboss.job,
  pgboss.job_common,
  pgboss.queue,
  pgboss.bam,
  pgboss.warning
restart identity cascade;

insert into polyphony_runtime.agent_state (
  id,
  agent_id,
  mode,
  schema_version,
  boot_state_json,
  current_tick_id,
  current_model_profile_id,
  last_stable_snapshot_id,
  psm_json,
  resource_posture_json,
  development_freeze,
  updated_at
)
values (
  1,
  'polyphony-core',
  'inactive',
  (select schema_version from platform_bootstrap.schema_state where id = 1),
  '{}'::jsonb,
  null,
  null,
  null,
  '{}'::jsonb,
  '{}'::jsonb,
  false,
  now()
)
on conflict (id) do update
set agent_id = excluded.agent_id,
    mode = excluded.mode,
    schema_version = excluded.schema_version,
    boot_state_json = excluded.boot_state_json,
    current_tick_id = excluded.current_tick_id,
    current_model_profile_id = excluded.current_model_profile_id,
    last_stable_snapshot_id = excluded.last_stable_snapshot_id,
    psm_json = excluded.psm_json,
    resource_posture_json = excluded.resource_posture_json,
    development_freeze = excluded.development_freeze,
    updated_at = excluded.updated_at;
`;

async function compose(args: string[], options: ComposeOptions = {}) {
  const { telegram = false, ...runOptions } = options;
  const composeFiles = telegram
    ? [composeFile, smokeBaseComposeFile, telegramSmokeComposeFile]
    : [composeFile, smokeBaseComposeFile];
  const envFilePath = repoEnvFilePath();

  return run(
    'docker',
    [
      'compose',
      ...(envFilePath ? ['--env-file', envFilePath] : []),
      ...composeFiles.flatMap((file) => ['-f', file]),
      '-p',
      projectName,
      ...args,
    ],
    {
      cwd: repoRoot(),
      env: {
        ...process.env,
        DOCKER_BUILDKIT: '0',
        COMPOSE_DOCKER_CLI_BUILD: '0',
        YAAGI_CORE_HOST_PORT: String(defaultCoreHostPort),
        YAAGI_SMOKE_POSTGRES_HOST_PORT: String(defaultPostgresHostPort),
        YAAGI_OPERATOR_AUTH_PRINCIPALS_FILE: smokeOperatorPrincipalsFilePath,
      },
      ...runOptions,
    },
  );
}

async function writeSmokeOperatorAuthFile(): Promise<void> {
  await mkdir(path.dirname(smokeOperatorPrincipalsFilePath), { recursive: true });
  await writeFile(
    smokeOperatorPrincipalsFilePath,
    JSON.stringify(
      {
        schemaVersion: operatorAuthSchemaVersion,
        principals: [
          {
            principalRef: 'operator:smoke',
            roles: ['operator', 'governor_operator'],
            credentials: [
              {
                credentialRef: 'credential:smoke',
                tokenSha256: sha256(smokeOperatorToken),
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );
}

async function waitForPortToClose(port: number, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const isOpen = await new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ host: '127.0.0.1', port });
      const cleanup = (open: boolean) => {
        socket.removeAllListeners();
        socket.destroy();
        resolve(open);
      };

      socket.once('connect', () => cleanup(true));
      socket.once('error', () => cleanup(false));
    });

    if (!isOpen) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`timed out waiting for port ${port} to close`);
}

async function waitForProjectResourcesToDisappear(
  composeProjectName: string,
  options: { ignoredVolumes?: string[] } = {},
  timeoutMs = 20_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const projectFilter = `label=com.docker.compose.project=${composeProjectName}`;
  const ignoredVolumes = new Set(options.ignoredVolumes ?? []);

  while (Date.now() <= deadline) {
    const [containers, networks, volumes] = await Promise.all([
      run('docker', ['ps', '-a', '--filter', projectFilter, '--format', '{{.Names}}'], {
        cwd: repoRoot(),
      }),
      run('docker', ['network', 'ls', '--filter', projectFilter, '--format', '{{.Name}}'], {
        cwd: repoRoot(),
      }),
      run('docker', ['volume', 'ls', '--filter', projectFilter, '--format', '{{.Name}}'], {
        cwd: repoRoot(),
      }),
    ]);

    const activeContainers = containers.stdout
      .split('\n')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const activeNetworks = networks.stdout
      .split('\n')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const activeVolumes = volumes.stdout
      .split('\n')
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && !ignoredVolumes.has(value));

    if (
      activeContainers.length === 0 &&
      activeNetworks.length === 0 &&
      activeVolumes.length === 0
    ) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `timed out waiting for docker resources of project ${composeProjectName} to disappear`,
  );
}

async function removeVolume(volumeName: string): Promise<void> {
  await run('docker', ['volume', 'rm', '-f', volumeName], {
    cwd: repoRoot(),
    rejectOnNonZeroExitCode: false,
  });
}

function modelsVolumeName(): string {
  return `${projectName}_models_state`;
}

async function tearDownSmokeProject(options: ComposeOptions = {}): Promise<void> {
  const preservedModelsVolume = modelsVolumeName();

  await closeSmokePostgres();
  await compose(['down', '--remove-orphans'], options).catch(() => {});
  await Promise.all([
    removeVolume(`${projectName}_postgres_data`),
    removeVolume(`${projectName}_workspace_state`),
    removeVolume(`${projectName}_data_state`),
  ]);
  await waitForProjectResourcesToDisappear(projectName, {
    ignoredVolumes: [preservedModelsVolume],
  });
  await waitForPortToClose(defaultCoreHostPort);
  await waitForPortToClose(defaultPostgresHostPort);
}

async function resetSmokeProjects(): Promise<void> {
  await closeSmokePostgres();
  await tearDownSmokeProject({
    rejectOnNonZeroExitCode: false,
    telegram: true,
  });
}

async function connectSmokePostgres(timeoutMs = 20_000): Promise<void> {
  if (smokePostgresClient) {
    return;
  }

  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;

  while (Date.now() <= deadline) {
    const candidate = new Client({
      host: '127.0.0.1',
      port: defaultPostgresHostPort,
      database: 'yaagi',
      user: 'yaagi',
      password: 'yaagi',
      connectionTimeoutMillis: 2_000,
      query_timeout: smokePostgresQueryTimeoutMs,
      statement_timeout: smokePostgresQueryTimeoutMs,
    });

    try {
      await candidate.connect();
      smokePostgresClient = candidate;
      return;
    } catch (error) {
      lastError = error;
      await candidate.end().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw new Error(
    `timed out connecting direct smoke postgres channel on 127.0.0.1:${defaultPostgresHostPort}: ${inspect(lastError)}`,
  );
}

async function closeSmokePostgres(): Promise<void> {
  if (!smokePostgresClient) {
    return;
  }

  const activeClient = smokePostgresClient;
  smokePostgresClient = null;
  await activeClient.end().catch(() => {});
}

function requireSmokePostgresClient(): Client {
  assert.ok(smokePostgresClient, 'direct smoke postgres channel must be connected before queries');
  return smokePostgresClient;
}

function postgresScalarToText(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }

  throw new Error(`unexpected non-scalar postgres query value: ${inspect(value)}`);
}

type PostgresRowArrayResult = {
  rows?: unknown[][];
};

async function queryPostgres(sql: string, _options: { telegram?: boolean } = {}): Promise<string> {
  void _options;
  const result = (await requireSmokePostgresClient().query({
    text: sql,
    rowMode: 'array',
  })) as PostgresRowArrayResult | PostgresRowArrayResult[];

  const rows = Array.isArray(result)
    ? result.flatMap((entry) => entry.rows ?? [])
    : (result.rows ?? []);

  return rows
    .map((row) => {
      const [value] = row;
      return postgresScalarToText(value);
    })
    .join('\n')
    .trim();
}

async function queryPostgresJson<T>(sql: string, options: { telegram?: boolean } = {}): Promise<T> {
  return JSON.parse(await queryPostgres(sql, options)) as T;
}

async function execCoreScript(
  source: string,
  options: { telegram?: boolean } = {},
): Promise<string> {
  const { stdout } = await compose(
    [
      'exec',
      '-T',
      'core',
      'node',
      '--experimental-strip-types',
      '--input-type=module',
      '-e',
      source,
    ],
    options,
  );

  return stdout.trim();
}

async function resetFakeTelegramUpdates(): Promise<void> {
  await compose(
    [
      'exec',
      '-T',
      'fake-telegram-api',
      'python',
      '-c',
      [
        'import urllib.request',
        "request = urllib.request.Request('http://127.0.0.1:8081/__test__/updates', method='DELETE')",
        'with urllib.request.urlopen(request, timeout=5) as response:',
        '    response.read()',
      ].join('\n'),
    ],
    { telegram: true },
  );
}

async function enqueueFakeTelegramUpdate(input: {
  updateId: number;
  chatId: string;
  text: string;
}): Promise<void> {
  await execCoreScript(
    `
    const response = await fetch('http://fake-telegram-api:8081/__test__/updates', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        update_id: ${input.updateId},
        chat_id: '${input.chatId}',
        text: ${JSON.stringify(input.text)},
      }),
    });

    if (!response.ok) {
      throw new Error('failed to enqueue fake telegram update: ' + response.status);
    }
  `,
    { telegram: true },
  );
}

async function waitForPostgresPredicate(
  sql: string,
  timeoutMs = 20_000,
  options: { telegram?: boolean } = {},
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const value = (await queryPostgres(sql, options)).trim().toLowerCase();
    if (value === 't' || value === 'true') {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`timed out waiting for postgres predicate to converge: ${sql}`);
}

async function waitForAdapterStatus(
  source: string,
  status: string,
  timeoutMs = 20_000,
  port = defaultCoreHostPort,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    try {
      const response = await fetch(coreHealthUrl(port));
      if (response.ok) {
        const payload = (await response.json()) as {
          perception?: {
            adapters?: Array<{
              source: string;
              status: string;
            }>;
          };
        };
        const adapter = payload.perception?.adapters?.find((entry) => entry.source === source);
        if (adapter?.status === status) {
          return;
        }
      }
    } catch {
      // Keep polling while the host port flips between compose projects.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`timed out waiting for adapter ${source} to become ${status}`);
}

async function composeServiceContainerId(
  serviceName: string,
  options: { telegram?: boolean } = {},
): Promise<string> {
  const { stdout } = await compose(['ps', '-q', serviceName], options);
  return stdout.trim();
}

async function fenceSmokeActivationFailure(options: ComposeOptions = {}): Promise<void> {
  await tearDownSmokeProject({ ...options, rejectOnNonZeroExitCode: false }).catch(() => {});
}

async function startSmokeProject(options: ComposeOptions = {}): Promise<void> {
  await ensureSmokeHostMemoryHeadroom(smokeBaseBudgetBytes);
  await runSmokeActivationWithFence(
    async () => {
      await compose(['up', '-d', '--build', '--wait'], options);
      await connectSmokePostgres();
      smokeLifecycleMetrics.projectStarts += 1;
      smokeRuntimeIdentity.baseVllmFastContainerId = await composeServiceContainerId('vllm-fast');
    },
    () => fenceSmokeActivationFailure(options),
  );
}

async function activateTelegramOverlay(): Promise<void> {
  await ensureSmokeHostMemoryHeadroom(smokeTelegramApiMemoryLimitBytes);
  await runSmokeActivationWithFence(
    async () => {
      await compose(
        ['up', '-d', '--no-build', '--force-recreate', '--wait', 'fake-telegram-api', 'core'],
        {
          telegram: true,
        },
      );
      await waitForAdapterStatus('telegram', 'healthy');
      smokeLifecycleMetrics.telegramOverlayActivations += 1;
      smokeRuntimeIdentity.telegramOverlayVllmFastContainerId = await composeServiceContainerId(
        'vllm-fast',
        { telegram: true },
      );
    },
    () => fenceSmokeActivationFailure({ telegram: true }),
  );
}

async function tearDownStartedSmokeProject(options: ComposeOptions = {}): Promise<void> {
  await tearDownSmokeProject(options);
  smokeLifecycleMetrics.projectTeardowns += 1;
}

// Covers: AC-F0007-02
async function prepareFreshRuntimeScenario(options: ComposeOptions = {}): Promise<void> {
  await compose(['stop', 'core'], options);
  await waitForPortToClose(defaultCoreHostPort);
  await queryPostgres(runtimeResetSql, options.telegram ? { telegram: true } : {});

  if (options.telegram) {
    await resetFakeTelegramUpdates();
  }

  smokeLifecycleMetrics.runtimeResets += 1;

  await compose(['start', 'core'], options);
  await waitForHttp(coreHealthUrl());

  if (options.telegram) {
    await waitForAdapterStatus('telegram', 'healthy');
  }
}

void test('F-0007 deployment-cell smoke suite', { concurrency: false }, async (t) => {
  await resetSmokeProjects();
  await writeSmokeOperatorAuthFile();
  let started = false;

  try {
    await startSmokeProject();
    started = true;

    await t.test('F-0007 base deployment-cell smoke family', async (t) => {
      await t.test(
        'AC-F0002-05 initializes postgres and pgboss readiness before core reports ready',
        async () => {
          const coreResponse = await waitForHttp(coreHealthUrl());
          const corePayload = (await coreResponse.json()) as {
            ok: boolean;
            postgres: boolean;
            fastModel: boolean;
            configuration: boolean;
            agents: string[];
          };

          assert.equal(corePayload.ok, true);
          assert.equal(corePayload.postgres, true);
          assert.equal(corePayload.fastModel, true);
          assert.equal(corePayload.configuration, true);
          assert.deepEqual(corePayload.agents, ['phase0DecisionAgent']);

          const { stdout: modelStdout } = await compose([
            'exec',
            '-T',
            'core',
            'node',
            '--input-type=module',
            '-e',
            "const response = await fetch('http://vllm-fast:8000/v1/models'); if (!response.ok) throw new Error('model request failed with ' + response.status); console.log(JSON.stringify(await response.json()));",
          ]);

          const modelPayload = JSON.parse(modelStdout.trim()) as {
            object: string;
            data: Array<{
              id: string;
            }>;
          };
          assert.equal(modelPayload.object, 'list');
          const [firstModel] = modelPayload.data;
          assert.ok(firstModel);
          assert.equal(firstModel.id, 'phase-0-fast');

          const materializationPayload = JSON.parse(
            await execCoreScript(`
            import { access, writeFile, rm } from 'node:fs/promises';

            const canAccess = async (targetPath) => {
              try {
                await access(targetPath);
                return true;
              } catch {
                return false;
              }
            };

            let seedWriteErrorCode = null;
            try {
              await writeFile('/seed/runtime-write-check.txt', 'forbidden');
              await rm('/seed/runtime-write-check.txt');
            } catch (error) {
              seedWriteErrorCode =
                error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
                  ? error.code
                  : 'unknown';
            }

            await writeFile('/workspace/body/runtime-write-check.txt', 'allowed');
            await rm('/workspace/body/runtime-write-check.txt');

            console.log(
              JSON.stringify({
                seedConstitution: await canAccess('/seed/constitution/constitution.yaml'),
                workspaceBody: await canAccess('/workspace/body/.gitkeep'),
                workspaceSkills: await canAccess('/workspace/skills'),
                modelsBase: await canAccess('/models/base/.gitkeep'),
                dataDatasets: await canAccess('/data/datasets/.gitkeep'),
                seedWriteErrorCode,
              }),
            );
          `),
          ) as {
            seedConstitution: boolean;
            workspaceBody: boolean;
            workspaceSkills: boolean;
            modelsBase: boolean;
            dataDatasets: boolean;
            seedWriteErrorCode: string | null;
          };

          assert.equal(materializationPayload.seedConstitution, true);
          assert.equal(materializationPayload.workspaceBody, true);
          assert.equal(materializationPayload.workspaceSkills, true);
          assert.equal(materializationPayload.modelsBase, true);
          assert.equal(materializationPayload.dataDatasets, true);
          assert.match(materializationPayload.seedWriteErrorCode ?? '', /^(EROFS|EACCES|EPERM)$/);

          const stdout = await queryPostgres(
            "select schema_name from information_schema.schemata where schema_name in ('platform_bootstrap', 'pgboss') order by schema_name;",
          );

          assert.match(stdout, /pgboss/);
          assert.match(stdout, /platform_bootstrap/);
        },
      );

      await prepareFreshRuntimeScenario();
      await t.test(
        'AC-F0008-06 surfaces baseline model-routing diagnostics through health and the bounded operator /models API in the deployment cell',
        async () => {
          const healthResponse = await waitForHttp(coreHealthUrl());
          const healthPayload = (await healthResponse.json()) as {
            ok: boolean;
            fastModel: boolean;
            modelRouting: {
              profiles: Array<{
                modelProfileId: string;
                role: string;
                status: string;
                eligibility: string;
              }>;
            };
          };

          assert.equal(healthPayload.ok, true);
          assert.equal(healthPayload.fastModel, true);
          assert.deepEqual(
            healthPayload.modelRouting.profiles.map((profile) => ({
              modelProfileId: profile.modelProfileId,
              role: profile.role,
              status: profile.status,
              eligibility: profile.eligibility,
            })),
            [
              {
                modelProfileId: 'deliberation.fast@baseline',
                role: 'deliberation',
                status: 'active',
                eligibility: 'eligible',
              },
              {
                modelProfileId: 'reflex.fast@baseline',
                role: 'reflex',
                status: 'active',
                eligibility: 'eligible',
              },
              {
                modelProfileId: 'reflection.fast@baseline',
                role: 'reflection',
                status: 'active',
                eligibility: 'eligible',
              },
            ],
          );

          const modelsResponse = await fetch(`${coreBaseUrl()}/models`, {
            headers: smokeOperatorAuthHeaders(),
          });
          assert.equal(modelsResponse.status, 200);
          const modelsPayload = (await modelsResponse.json()) as {
            baselineProfiles: Array<{
              modelProfileId: string;
              role: string;
              status: string;
              adapterOf: string | null;
              artifactUri: string | null;
              baseModel: string;
              healthSummary: {
                healthy: boolean;
              };
            }>;
            richerRegistryHealth: {
              available: boolean;
              owner: string;
              generatedAt: string | null;
              organs: Array<{
                modelProfileId: string;
                role: string;
                serviceId: string;
                availability: string;
                quarantineState: string;
                fallbackTargetProfileId: string | null;
                errorRate: number | null;
                latencyMsP95: number | null;
              }>;
            };
          };
          assert.deepEqual(
            modelsPayload.baselineProfiles.map((profile) => ({
              modelProfileId: profile.modelProfileId,
              role: profile.role,
              status: profile.status,
              adapterOf: profile.adapterOf,
              artifactDescriptorRedacted: profile.artifactUri === null,
              baseModel: profile.baseModel,
              healthy: profile.healthSummary.healthy,
            })),
            [
              {
                modelProfileId: 'deliberation.fast@baseline',
                role: 'deliberation',
                status: 'active',
                adapterOf: null,
                artifactDescriptorRedacted: true,
                baseModel: 'model-fast',
                healthy: true,
              },
              {
                modelProfileId: 'reflex.fast@baseline',
                role: 'reflex',
                status: 'active',
                adapterOf: null,
                artifactDescriptorRedacted: true,
                baseModel: 'model-fast',
                healthy: true,
              },
              {
                modelProfileId: 'reflection.fast@baseline',
                role: 'reflection',
                status: 'active',
                adapterOf: 'deliberation.fast@baseline',
                artifactDescriptorRedacted: true,
                baseModel: 'model-fast',
                healthy: true,
              },
            ],
          );
          assert.equal(modelsPayload.richerRegistryHealth.available, true);
          assert.equal(modelsPayload.richerRegistryHealth.owner, 'F-0014');
          assert.match(modelsPayload.richerRegistryHealth.generatedAt ?? '', /^\d{4}-\d{2}-\d{2}T/);
          assert.deepEqual(modelsPayload.richerRegistryHealth.organs, [
            {
              modelProfileId: 'classifier.pool@shared',
              role: 'classifier',
              serviceId: 'vllm-pool',
              availability: 'unavailable',
              quarantineState: 'active',
              fallbackTargetProfileId: null,
              errorRate: 1,
              latencyMsP95: null,
            },
            {
              modelProfileId: 'code.deep@shared',
              role: 'code',
              serviceId: 'vllm-deep',
              availability: 'unavailable',
              quarantineState: 'active',
              fallbackTargetProfileId: null,
              errorRate: 1,
              latencyMsP95: null,
            },
            {
              modelProfileId: 'embedding.pool@shared',
              role: 'embedding',
              serviceId: 'vllm-pool',
              availability: 'unavailable',
              quarantineState: 'active',
              fallbackTargetProfileId: null,
              errorRate: 1,
              latencyMsP95: null,
            },
            {
              modelProfileId: 'reranker.pool@shared',
              role: 'reranker',
              serviceId: 'vllm-pool',
              availability: 'unavailable',
              quarantineState: 'active',
              fallbackTargetProfileId: null,
              errorRate: 1,
              latencyMsP95: null,
            },
            {
              modelProfileId: 'safety.deep@shared',
              role: 'safety',
              serviceId: 'vllm-deep',
              availability: 'unavailable',
              quarantineState: 'active',
              fallbackTargetProfileId: null,
              errorRate: 1,
              latencyMsP95: null,
            },
          ]);

          assert.equal(
            await queryPostgres(
              "select count(*)::text from polyphony_runtime.model_registry where role in ('reflex', 'deliberation', 'reflection') and status = 'active';",
            ),
            '3',
          );
        },
      );

      await prepareFreshRuntimeScenario();
      await t.test(
        'AC-F0015-02 wires canonical workshop queues and artifact volumes in the deployment cell without opening a new public route family',
        async () => {
          const healthResponse = await waitForHttp(coreHealthUrl());
          assert.equal(healthResponse.status, 200);

          const queueNames = await queryPostgres(
            "select string_agg(name, ',' order by name) from pgboss.queue where name like 'workshop.%';",
          );
          assert.equal(
            queueNames,
            [
              'workshop.candidate-register',
              'workshop.candidate-transition',
              'workshop.dataset-build',
              'workshop.eval-run',
              'workshop.promotion-package',
              'workshop.training-run',
            ].join(','),
          );

          const materializationPayload = JSON.parse(
            await execCoreScript(`
            import { access } from 'node:fs/promises';

            const canAccess = async (targetPath) => {
              try {
                await access(targetPath);
                return true;
              } catch {
                return false;
              }
            };

            console.log(
              JSON.stringify({
                modelsAdapters: await canAccess('/models/adapters/.gitkeep'),
                modelsSpecialists: await canAccess('/models/specialists/.gitkeep'),
                dataReports: await canAccess('/data/reports/.gitkeep'),
                dataDatasets: await canAccess('/data/datasets/.gitkeep'),
              }),
            );
          `),
          ) as {
            modelsAdapters: boolean;
            modelsSpecialists: boolean;
            dataReports: boolean;
            dataDatasets: boolean;
          };

          assert.deepEqual(materializationPayload, {
            modelsAdapters: true,
            modelsSpecialists: true,
            dataReports: true,
            dataDatasets: true,
          });
        },
      );

      await prepareFreshRuntimeScenario();
      // Covers: AC-F0013-08
      // Covers: AC-F0016-08
      await t.test(
        'AC-F0013-08 exposes bounded operator state and explicit governor gating in the deployment cell',
        async () => {
          const expectedSubjectStateSchemaVersion = await queryPostgres(
            'select schema_version from platform_bootstrap.schema_state where id = 1;',
          );
          const stateResponse = await fetch(`${coreBaseUrl()}/state`, {
            headers: smokeOperatorAuthHeaders(),
          });
          assert.equal(stateResponse.status, 200);
          const statePayload = (await stateResponse.json()) as {
            snapshot: {
              subjectStateSchemaVersion: string;
              agentState: {
                agentId: string;
                mode: string;
              };
              goals: unknown[];
              beliefs: unknown[];
              entities: unknown[];
              relationships: unknown[];
            };
            bounds: {
              goalLimit: number;
              beliefLimit: number;
              entityLimit: number;
              relationshipLimit: number;
            };
          };
          assert.equal(
            statePayload.snapshot.subjectStateSchemaVersion,
            expectedSubjectStateSchemaVersion,
          );
          assert.equal(statePayload.snapshot.agentState.agentId, 'polyphony-core');
          assert.equal(statePayload.snapshot.agentState.mode, 'normal');
          assert.deepEqual(statePayload.bounds, {
            goalLimit: 25,
            beliefLimit: 25,
            entityLimit: 25,
            relationshipLimit: 50,
          });
          assert.ok(Array.isArray(statePayload.snapshot.goals));
          assert.ok(Array.isArray(statePayload.snapshot.beliefs));
          assert.ok(Array.isArray(statePayload.snapshot.entities));
          assert.ok(Array.isArray(statePayload.snapshot.relationships));

          const proposalResponse = await fetch(`${coreBaseUrl()}/control/development-proposals`, {
            method: 'POST',
            headers: smokeOperatorAuthHeaders({
              'content-type': 'application/json',
            }),
            body: JSON.stringify({
              requestId: 'smoke-proposal-1',
              proposalKind: 'policy_change',
              problemSignature: 'deployment-cell proposal route smoke',
              summary: 'Record a durable advisory governor proposal before freeze.',
              evidenceRefs: ['smoke:deployment-cell'],
              rollbackPlanRef: 'rollback:smoke-policy',
              targetRef: 'policy:development-governor',
            }),
          });
          assert.equal(proposalResponse.status, 202);
          const proposalPayload = (await proposalResponse.json()) as {
            accepted: boolean;
            requestId: string;
            state: string;
          };
          assert.equal(proposalPayload.accepted, true);
          assert.equal(proposalPayload.requestId, 'smoke-proposal-1');
          assert.equal(proposalPayload.state, 'submitted');

          const freezeResponse = await fetch(`${coreBaseUrl()}/control/freeze-development`, {
            method: 'POST',
            headers: smokeOperatorAuthHeaders({
              'content-type': 'application/json',
            }),
            body: JSON.stringify({
              requestId: 'smoke-freeze-1',
              reason: 'deployment-cell governor freeze smoke',
              evidenceRefs: ['smoke:deployment-cell'],
            }),
          });
          assert.equal(freezeResponse.status, 202);
          const freezePayload = (await freezeResponse.json()) as {
            accepted: boolean;
            requestId: string;
            state: string;
          };
          assert.equal(freezePayload.accepted, true);
          assert.equal(freezePayload.requestId, 'smoke-freeze-1');
          assert.equal(freezePayload.state, 'frozen');

          const frozenProposalResponse = await fetch(
            `${coreBaseUrl()}/control/development-proposals`,
            {
              method: 'POST',
              headers: smokeOperatorAuthHeaders({
                'content-type': 'application/json',
              }),
              body: JSON.stringify({
                requestId: 'smoke-proposal-while-frozen',
                proposalKind: 'policy_change',
                problemSignature: 'development freeze blocks new proposal intake',
                summary: 'New public proposal intake must be rejected while frozen.',
                evidenceRefs: ['smoke:deployment-cell'],
                rollbackPlanRef: 'rollback:smoke-policy',
              }),
            },
          );
          assert.equal(frozenProposalResponse.status, 409);
          assert.deepEqual(await frozenProposalResponse.json(), {
            accepted: false,
            reason: 'development_frozen',
          });
        },
      );

      await prepareFreshRuntimeScenario();
      await t.test(
        'AC-F0001-06 / AC-F0003-08 keeps deployment-cell startup fail-closed on unsupported subject-state schema version',
        async () => {
          await compose(['stop', 'core']);
          await waitForPortToClose(defaultCoreHostPort);
          await queryPostgres(runtimeResetSql);

          await queryPostgres(`
          update polyphony_runtime.agent_state
          set schema_version = '2026-03-01',
              updated_at = now()
          where id = 1;
        `);

          await compose(['start', 'core']);
          await assert.rejects(waitForHttp(coreHealthUrl(), 5_000, 250), /timeout waiting/);

          assert.equal(
            await queryPostgres(
              "select count(*)::text from polyphony_runtime.ticks where tick_kind = 'wake' and trigger_kind = 'boot';",
            ),
            '0',
          );
          assert.equal(
            await queryPostgres('select mode from polyphony_runtime.agent_state where id = 1;'),
            'inactive',
          );
        },
      );

      await prepareFreshRuntimeScenario();
      await t.test(
        'AC-F0003-01 starts the mandatory wake tick only after constitutional activation',
        async () => {
          assert.equal(
            await queryPostgres(
              "select count(*)::text from polyphony_runtime.ticks where tick_kind = 'wake' and trigger_kind = 'boot' and status = 'completed';",
            ),
            '1',
          );
          assert.equal(
            await queryPostgres(
              "select count(*)::text from polyphony_runtime.episodes where tick_id in (select tick_id from polyphony_runtime.ticks where tick_kind = 'wake' and trigger_kind = 'boot');",
            ),
            '1',
          );
          assert.equal(
            await queryPostgres(
              "select count(*)::text from polyphony_runtime.timeline_events where event_type = 'system.boot.completed';",
            ),
            '1',
          );
          assert.equal(
            await queryPostgres(
              "select count(*)::text from polyphony_runtime.timeline_events where event_type = 'tick.completed';",
            ),
            '1',
          );
          assert.equal(
            await queryPostgres(
              "select coalesce(current_tick_id, '') from polyphony_runtime.agent_state where id = 1;",
            ),
            '',
          );
          assert.equal(
            await queryPostgres(
              `select (
             (select min(sequence_id) from polyphony_runtime.timeline_events where event_type = 'system.boot.completed')
             <
             (select min(sequence_id) from polyphony_runtime.timeline_events where event_type = 'tick.started')
           )::text;`,
            ),
            'true',
          );
        },
      );

      await prepareFreshRuntimeScenario();
      await t.test(
        'AC-F0012-04 runs homeostat on the committed wake tick and on scheduled periodic cadence inside the deployment cell',
        async () => {
          assert.equal(
            await queryPostgres(
              "select count(*)::text from polyphony_runtime.homeostat_snapshots where cadence_kind = 'tick_complete' and tick_id is not null;",
            ),
            '1',
          );

          await waitForPostgresPredicate(
            "select exists(select 1 from polyphony_runtime.homeostat_snapshots where cadence_kind = 'periodic')::text;",
            15_000,
          );

          assert.ok(
            Number(
              await queryPostgres(
                "select count(*)::text from polyphony_runtime.homeostat_snapshots where cadence_kind = 'periodic';",
              ),
            ) >= 1,
            'expected at least one periodic homeostat snapshot after scheduler cadence',
          );

          assert.equal(
            await queryPostgres(
              "select count(*)::text from polyphony_runtime.ticks where status = 'completed';",
            ),
            '1',
          );
          assert.equal(
            await queryPostgres(
              "select count(*)::text from pgboss.queue where name = 'homeostat.periodic-evaluation';",
            ),
            '1',
          );
        },
      );

      await prepareFreshRuntimeScenario();
      await t.test(
        'AC-F0019-16 AC-F0019-17 runs rollback-frequency usage audit on real lifecycle evidence records',
        async () => {
          const auditPayload = JSON.parse(
            await execCoreScript(`
            import { createRuntimeDbClient, createLifecycleStore } from './packages/db/src/index.ts';
            import { createDbBackedHomeostatService } from './apps/core/src/runtime/index.ts';
            import { HOMEOSTAT_SIGNAL_FAMILY } from './packages/contracts/src/runtime.ts';

            const client = createRuntimeDbClient(process.env.YAAGI_POSTGRES_URL);
            await client.connect();

            try {
              const store = createLifecycleStore(client);
              await store.recordRollbackIncident({
                rollbackIncidentId: 'rollback-smoke-f0019',
                incidentKind: 'body_rollback',
                severity: 'warning',
                rollbackRef: 'body:snapshot-smoke-f0019',
                subjectRef: 'runtime:polyphony-core',
                evidenceRefs: ['body:snapshot-smoke-f0019'],
                recordedAt: '2026-04-15T12:20:00.000Z',
                schemaVersion: '018_lifecycle_consolidation.sql',
                idempotencyKey: 'smoke:f0019:rollback',
              });
              await store.recordGracefulShutdown({
                shutdownEventId: 'shutdown-smoke-f0019',
                shutdownState: 'completed',
                reason: 'smoke-audit',
                subjectRef: 'runtime:polyphony-core',
                admittedInFlightWork: [{ tickId: 'tick-smoke-f0019' }],
                terminalTickOutcome: { activeTickCountAfterStop: 0 },
                flushedBufferResult: { tickRuntime: 'stopped' },
                openConcerns: [],
                evidenceRefs: ['tick:tick-smoke-f0019'],
                recordedAt: '2026-04-15T12:21:00.000Z',
                schemaVersion: '018_lifecycle_consolidation.sql',
                idempotencyKey: 'smoke:f0019:shutdown',
              });
            } finally {
              await client.end();
            }

            const homeostat = createDbBackedHomeostatService({
              postgresUrl: process.env.YAAGI_POSTGRES_URL,
              pgBossSchema: process.env.YAAGI_PGBOSS_SCHEMA ?? 'pgboss',
            });
            const result = await homeostat.evaluatePeriodic({
              createdAt: '2026-04-15T12:30:00.000Z',
            });
            const rollbackScore = result.snapshot.signalScores.find(
              (score) => score.signalFamily === HOMEOSTAT_SIGNAL_FAMILY.ROLLBACK_FREQUENCY,
            );

            console.log(
              JSON.stringify({
                rollbackMetric: rollbackScore?.metricValue,
                rollbackStatus: rollbackScore?.status,
                rollbackEvidenceRefs: rollbackScore?.evidenceRefs ?? [],
                snapshotId: result.snapshot.snapshotId,
              }),
            );
          `),
          ) as {
            rollbackMetric: number;
            rollbackStatus: string;
            rollbackEvidenceRefs: string[];
            snapshotId: string;
          };

          assert.equal(auditPayload.rollbackMetric, 1);
          assert.equal(auditPayload.rollbackStatus, 'evaluated');
          assert.deepEqual(auditPayload.rollbackEvidenceRefs.sort(), [
            'graceful_shutdown:shutdown-smoke-f0019',
            'rollback_incident:rollback-smoke-f0019',
          ]);
          assert.equal(
            await queryPostgres(
              "select count(*)::text from polyphony_runtime.lifecycle_events where idempotency_key like 'smoke:f0019:%';",
            ),
            '2',
          );
          assert.equal(
            await queryPostgres(
              `select rollback_frequency::text from polyphony_runtime.homeostat_snapshots where snapshot_id = '${auditPayload.snapshotId}';`,
            ),
            '1.0000',
          );
        },
      );

      await prepareFreshRuntimeScenario();
      await t.test(
        'AC-F0003-07 reclaims stale active ticks after restart and clears agent_state.current_tick',
        async () => {
          await queryPostgres(`
            insert into polyphony_runtime.ticks (
              tick_id,
              request_id,
              tick_kind,
              trigger_kind,
              status,
              started_at,
              lease_owner,
              lease_expires_at,
              request_json
            ) values (
              'tick-stale-smoke',
              'request-stale-smoke',
              'reactive',
              'scheduler',
              'started',
              now() - interval '2 minutes',
              'core',
              now() - interval '1 minute',
              '{}'::jsonb
            );

            update polyphony_runtime.agent_state
            set current_tick_id = 'tick-stale-smoke',
                updated_at = now()
            where id = 1;
          `);

          await compose(['restart', 'core']);
          await waitForHttp(coreHealthUrl());

          assert.equal(
            await queryPostgres(
              "select status from polyphony_runtime.ticks where tick_id = 'tick-stale-smoke';",
            ),
            'failed',
          );
          assert.equal(
            await queryPostgres(
              "select failure_json ->> 'reason' from polyphony_runtime.ticks where tick_id = 'tick-stale-smoke';",
            ),
            'stale_tick_reclaimed',
          );
          assert.equal(
            await queryPostgres(
              "select coalesce(current_tick_id, '') from polyphony_runtime.agent_state where id = 1;",
            ),
            '',
          );
        },
      );

      await prepareFreshRuntimeScenario();
      await t.test(
        'AC-F0004-06 reloads the last committed subject-state after restart without process-local reconstruction',
        async () => {
          const commitResult = JSON.parse(
            await execCoreScript(`
            import { createRuntimeDbClient, createTickRuntimeStore } from './packages/db/src/index.ts';

            const client = createRuntimeDbClient(process.env.YAAGI_POSTGRES_URL);
            await client.connect();

            try {
              const store = createTickRuntimeStore(client);
              const admission = await store.requestTick({
                requestId: 'smoke-f0004-reload',
                kind: 'reactive',
                trigger: 'system',
                requestedAt: new Date('2026-03-23T00:10:00Z'),
                payload: { source: 'smoke-f0004' },
              });

              if (!admission.accepted) {
                throw new Error('expected smoke-f0004 admission to succeed');
              }

              const completion = await store.completeTick({
                tickId: admission.tick.tickId,
                occurredAt: new Date('2026-03-23T00:10:05Z'),
                summary: 'subject state survived restart',
                resultJson: { ok: true },
                subjectStateDelta: {
                  agentStatePatch: {
                    psmJson: { smokeMarker: 'persisted' },
                    resourcePostureJson: { memory: 'steady' },
                  },
                  goalUpserts: [
                    {
                      goalId: 'goal-smoke-reload',
                      title: 'Reload subject state after restart',
                      status: 'active',
                      priority: 4,
                      goalType: 'continuity',
                      evidenceRefs: [{ kind: 'tick', tickId: admission.tick.tickId }],
                    },
                  ],
                },
              });

              console.log(
                JSON.stringify({
                  tickId: admission.tick.tickId,
                  episodeId: completion.episode.episodeId,
                }),
              );
            } finally {
              await client.end();
            }
          `),
          ) as {
            tickId: string;
            episodeId: string;
          };

          assert.match(commitResult.tickId, /^[0-9a-f-]+$/);
          assert.match(commitResult.episodeId, /^[0-9a-f-]+$/);

          await compose(['restart', 'core']);
          await waitForHttp(coreHealthUrl());

          assert.equal(
            await queryPostgres(
              "select psm_json ->> 'smokeMarker' from polyphony_runtime.agent_state where id = 1;",
            ),
            'persisted',
          );
          assert.equal(
            await queryPostgres(
              "select resource_posture_json ->> 'memory' from polyphony_runtime.agent_state where id = 1;",
            ),
            'steady',
          );
          assert.equal(
            await queryPostgres(
              "select count(*)::text from polyphony_runtime.goals where goal_id = 'goal-smoke-reload' and status = 'active';",
            ),
            '1',
          );

          const snapshot = JSON.parse(
            await execCoreScript(`
            import { createRuntimeDbClient, createTickRuntimeStore } from './packages/db/src/index.ts';

            const client = createRuntimeDbClient(process.env.YAAGI_POSTGRES_URL);
            await client.connect();

            try {
              const store = createTickRuntimeStore(client);
              const snapshot = await store.loadSubjectStateSnapshot({
                goalLimit: 10,
                beliefLimit: 10,
                entityLimit: 10,
                relationshipLimit: 10,
              });

              console.log(
                JSON.stringify({
                  currentTickId: snapshot.agentState.currentTickId,
                  smokeMarker: snapshot.agentState.psmJson.smokeMarker ?? null,
                  memory: snapshot.agentState.resourcePostureJson.memory ?? null,
                  goals: snapshot.goals.map((goal) => goal.goalId),
                }),
              );
            } finally {
              await client.end();
            }
          `),
          ) as {
            currentTickId: string | null;
            smokeMarker: string | null;
            memory: string | null;
            goals: string[];
          };

          assert.equal(snapshot.currentTickId, null);
          assert.equal(snapshot.smokeMarker, 'persisted');
          assert.equal(snapshot.memory, 'steady');
          assert.deepEqual(snapshot.goals, ['goal-smoke-reload']);
        },
      );

      await prepareFreshRuntimeScenario();
      await t.test(
        'AC-F0005-02 accepts POST /ingest inside the deployment cell and reuses the canonical reactive handoff',
        async () => {
          const ingestResponse = await fetch(`${coreBaseUrl()}/ingest`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              signalType: 'http.operator.message',
              priority: 'critical',
              requiresImmediateTick: true,
              threadId: 'operator-http',
              payload: {
                text: 'smoke http ingest',
              },
            }),
          });

          assert.equal(ingestResponse.status, 202);
          const ingestPayload = (await ingestResponse.json()) as {
            accepted: boolean;
            stimulusId: string;
            deduplicated: boolean;
            tickAdmission: {
              accepted: boolean;
            } | null;
          };
          assert.equal(ingestPayload.accepted, true);
          assert.equal(ingestPayload.deduplicated, false);
          assert.equal(ingestPayload.tickAdmission?.accepted, true);

          await waitForPostgresPredicate(
            `select (
              exists(
                select 1
                from polyphony_runtime.stimulus_inbox
                where source_kind = 'http'
                  and normalized_json ->> 'signalType' = 'http.operator.message'
              )
              and exists(
                select 1
                from polyphony_runtime.ticks
                where tick_kind = 'reactive'
                  and trigger_kind = 'system'
                  and status = 'completed'
              )
            )::text;`,
            smokeReactivePredicateTimeoutMs,
          );

          const ingestionEvidence = await queryPostgresJson<{
            source: string | null;
            threadId: string | null;
            tickSourceKind: string | null;
          }>(
            `select json_build_object(
              'source',
              (
                select normalized_json -> 'envelope' ->> 'source'
                from polyphony_runtime.stimulus_inbox
                where source_kind = 'http'
                  and normalized_json ->> 'signalType' = 'http.operator.message'
                limit 1
              ),
              'threadId',
              (
                select normalized_json -> 'envelope' ->> 'threadId'
                from polyphony_runtime.stimulus_inbox
                where source_kind = 'http'
                  and normalized_json ->> 'signalType' = 'http.operator.message'
                limit 1
              ),
              'tickSourceKind',
              (
                select request_json -> 'perception' -> 'sourceKinds' ->> 0
                from polyphony_runtime.ticks
                where tick_kind = 'reactive'
                  and trigger_kind = 'system'
                  and status = 'completed'
                limit 1
              )
            )::text;`,
          );
          assert.equal(ingestionEvidence.source, 'http');
          assert.equal(ingestionEvidence.threadId, 'operator-http');
          assert.equal(ingestionEvidence.tickSourceKind, 'http');
        },
      );

      await prepareFreshRuntimeScenario();
      await t.test(
        'AC-F0009-06 executes one bounded reactive decision path inside the deployment cell without new public API or durable history tables',
        async () => {
          // Covers: AC-F0011-05
          const ingestResponse = await fetch(`${coreBaseUrl()}/ingest`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              signalType: 'http.operator.decision',
              priority: 'critical',
              requiresImmediateTick: true,
              threadId: 'operator-decision',
              payload: {
                text: 'summarize and decide conservatively',
              },
            }),
          });

          assert.equal(ingestResponse.status, 202);

          await waitForPostgresPredicate(
            `with completed_tick as (
              select tick_id
              from polyphony_runtime.ticks
              where tick_kind = 'reactive'
                and trigger_kind = 'system'
                and status = 'completed'
                and result_json ? 'decision'
                and selected_coalition_id is not null
              order by created_at desc
              limit 1
            )
            select (
              exists(select 1 from completed_tick)
              and exists(
                select 1
                from polyphony_runtime.episodes
                where result_json ? 'decision'
              )
              and exists(
                select 1
                from polyphony_runtime.field_journal_entries
                where tick_id = (select tick_id from completed_tick)
              )
            )::text;`,
            smokeReactivePredicateTimeoutMs,
          );

          const decisionEvidence = await queryPostgresJson<{
            selectedCoalitionId: string | null;
            winningCoalitionId: string | null;
            actionType: string | null;
            expectedSubjectStateSchemaVersion: string | null;
            observedSubjectStateSchemaVersion: string | null;
            legacyDecisionTables: string | null;
          }>(
            `with completed_tick as (
              select tick_id, selected_coalition_id, result_json
              from polyphony_runtime.ticks
              where tick_kind = 'reactive'
                and trigger_kind = 'system'
                and status = 'completed'
                and result_json ? 'decision'
                and selected_coalition_id is not null
              order by created_at desc
              limit 1
            )
            select json_build_object(
              'selectedCoalitionId',
              (select selected_coalition_id from completed_tick),
              'winningCoalitionId',
              (select result_json -> 'narrativeMemetic' -> 'winningCoalition' ->> 'coalitionId' from completed_tick),
              'actionType',
              (select result_json -> 'decision' -> 'action' ->> 'type' from completed_tick),
              'expectedSubjectStateSchemaVersion',
              (select schema_version from platform_bootstrap.schema_state where id = 1),
              'observedSubjectStateSchemaVersion',
              (select result_json -> 'decisionTrace' ->> 'subjectStateSchemaVersion' from completed_tick),
              'legacyDecisionTables',
              (
                select count(*)::text
                from information_schema.tables
                where table_schema = 'polyphony_runtime'
                  and table_name in ('decision_contexts', 'decision_history')
              )
            )::text;`,
          );
          assert.equal((decisionEvidence.selectedCoalitionId ?? '').length > 0, true);
          assert.equal(decisionEvidence.winningCoalitionId, decisionEvidence.selectedCoalitionId);
          assert.match(
            decisionEvidence.actionType ?? '',
            /^(none|tool_call|reflect|schedule_job)$/,
          );
          assert.equal(
            decisionEvidence.observedSubjectStateSchemaVersion,
            decisionEvidence.expectedSubjectStateSchemaVersion,
          );
          assert.equal(decisionEvidence.legacyDecisionTables, '0');

          const missingRouteResponse = await fetch(`${coreBaseUrl()}/decision`);
          assert.equal(missingRouteResponse.status, 404);
        },
      );

      await prepareFreshRuntimeScenario();
      await t.test(
        'AC-F0010-04 audits one bounded reactive executive outcome inside the deployment cell without new public API surface',
        async () => {
          const ingestResponse = await fetch(`${coreBaseUrl()}/ingest`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              signalType: 'http.operator.executive',
              priority: 'critical',
              requiresImmediateTick: true,
              threadId: 'operator-executive',
              payload: {
                text: 'decide conservatively and keep the action bounded',
              },
            }),
          });

          assert.equal(ingestResponse.status, 202);

          await waitForPostgresPredicate(
            `with completed_tick as (
              select tick_id, action_id
              from polyphony_runtime.ticks
              where tick_kind = 'reactive'
                and trigger_kind = 'system'
                and status = 'completed'
              order by created_at desc
              limit 1
            )
            select (
              exists(select 1 from completed_tick where action_id is not null)
              and exists(
                select 1
                from polyphony_runtime.action_log
                where tick_id = (select tick_id from completed_tick)
              )
            )::text;`,
            smokeReactivePredicateTimeoutMs,
          );

          const executiveEvidence = await queryPostgresJson<{
            tickActionId: string | null;
            logActionId: string | null;
            verdictKind: string | null;
            executiveActionId: string | null;
          }>(
            `with completed_tick as (
              select tick_id, action_id, result_json
              from polyphony_runtime.ticks
              where tick_kind = 'reactive'
                and trigger_kind = 'system'
                and status = 'completed'
              order by created_at desc
              limit 1
            ),
            latest_action as (
              select action_id, action_kind
              from polyphony_runtime.action_log
              where tick_id = (select tick_id from completed_tick)
              order by created_at desc
              limit 1
            )
            select json_build_object(
              'tickActionId',
              (select action_id from completed_tick),
              'logActionId',
              (select action_id from latest_action),
              'verdictKind',
              (select action_kind from latest_action),
              'executiveActionId',
              (select result_json -> 'executive' ->> 'actionId' from completed_tick)
            )::text;`,
          );

          assert.equal(executiveEvidence.logActionId, executiveEvidence.tickActionId);
          assert.match(
            executiveEvidence.verdictKind ?? '',
            /^(conscious_inaction|review_request|tool_call|schedule_job)$/,
          );
          assert.equal(executiveEvidence.executiveActionId, executiveEvidence.tickActionId);

          const missingRouteResponse = await fetch(`${coreBaseUrl()}/actions`);
          assert.equal(missingRouteResponse.status, 404);
        },
      );

      await prepareFreshRuntimeScenario();
      await t.test(
        'AC-F0020-12 fails closed in the deployment cell when the promoted vllm-fast dependency becomes unusable',
        async () => {
          await compose(['stop', 'vllm-fast']);

          const deadline = Date.now() + 20_000;
          let healthPayload: {
            ok: boolean;
            fastModel: boolean;
            servingDependencies: Array<{
              serviceId: string;
              readiness: string;
              readinessBasis: string;
            }>;
          } | null = null;

          while (Date.now() <= deadline) {
            try {
              const response = await fetch(coreHealthUrl());
              if (response.status === 503) {
                healthPayload = (await response.json()) as {
                  ok: boolean;
                  fastModel: boolean;
                  servingDependencies: Array<{
                    serviceId: string;
                    readiness: string;
                    readinessBasis: string;
                  }>;
                };
                break;
              }
            } catch {
              // keep waiting until core publishes the fail-closed health view
            }
            await new Promise((resolve) => setTimeout(resolve, 250));
          }

          assert.ok(
            healthPayload,
            'core must publish a fail-closed health snapshot after vllm-fast stops',
          );
          assert.equal(healthPayload.ok, false);
          assert.equal(healthPayload.fastModel, false);
          assert.ok(
            healthPayload.servingDependencies.some(
              (dependency) =>
                dependency.serviceId === 'vllm-fast' && dependency.readiness !== 'ready',
            ),
          );

          const modelsResponse = await fetch(`${coreBaseUrl()}/models`, {
            headers: smokeOperatorAuthHeaders(),
          });
          assert.equal(modelsResponse.status, 200);
          const modelsPayload = (await modelsResponse.json()) as {
            servingDependencies: Array<{
              serviceId: string;
              readiness: string;
              readinessBasis: string;
              detail?: string | null;
            }>;
          };
          const fastDependency = modelsPayload.servingDependencies.find(
            (dependency) => dependency.serviceId === 'vllm-fast',
          );
          assert.ok(fastDependency);
          assert.notEqual(fastDependency.readiness, 'ready');
          assert.equal(fastDependency.detail ?? null, null);

          const tickResponse = await fetch(`${coreBaseUrl()}/control/tick`, {
            method: 'POST',
            headers: smokeOperatorAuthHeaders({
              'content-type': 'application/json',
            }),
            body: JSON.stringify({
              requestId: 'smoke-f0020-promoted-dependency-down',
              kind: 'reactive',
              payload: {
                note: 'fail closed while promoted dependency is down',
              },
            }),
          });
          assert.equal(tickResponse.status, 503);
          const tickPayload = (await tickResponse.json()) as {
            accepted: boolean;
            reason?: string;
          };
          assert.equal(tickPayload.accepted, false);
          assert.equal(tickPayload.reason, 'promoted_dependency_unavailable');
        },
      );
    });

    await activateTelegramOverlay();
    await prepareFreshRuntimeScenario({ telegram: true });

    await t.test('F-0007 telegram deployment-cell smoke overlay', async (t) => {
      await t.test(
        'AC-F0005-02 ingests a Telegram update from a fake Bot API inside the deployment cell',
        async () => {
          await enqueueFakeTelegramUpdate({
            updateId: 1,
            chatId: '12345',
            text: 'smoke telegram message',
          });

          await waitForPostgresPredicate(
            `select (
              exists(
                select 1
                from polyphony_runtime.stimulus_inbox
                where source_kind = 'telegram'
              )
              and exists(
                select 1
                from polyphony_runtime.ticks
                where tick_kind = 'reactive'
                  and trigger_kind = 'system'
                  and status = 'completed'
              )
            )::text;`,
            smokeReactivePredicateTimeoutMs,
            { telegram: true },
          );

          const telegramEvidence = await queryPostgresJson<{
            source: string | null;
            threadId: string | null;
            tickSourceKind: string | null;
          }>(
            `select json_build_object(
              'source',
              (
                select normalized_json -> 'envelope' ->> 'source'
                from polyphony_runtime.stimulus_inbox
                where source_kind = 'telegram'
                limit 1
              ),
              'threadId',
              (
                select normalized_json -> 'envelope' ->> 'threadId'
                from polyphony_runtime.stimulus_inbox
                where source_kind = 'telegram'
                limit 1
              ),
              'tickSourceKind',
              (
                select request_json -> 'perception' -> 'sourceKinds' ->> 0
                from polyphony_runtime.ticks
                where tick_kind = 'reactive'
                  and trigger_kind = 'system'
                  and status = 'completed'
                limit 1
              )
            )::text;`,
            { telegram: true },
          );
          assert.equal(telegramEvidence.source, 'telegram');
          assert.equal(telegramEvidence.threadId, '12345');
          assert.equal(telegramEvidence.tickSourceKind, 'telegram');
        },
      );
    });
  } finally {
    if (started) {
      await tearDownStartedSmokeProject({
        rejectOnNonZeroExitCode: false,
        telegram: true,
      });
    } else {
      await tearDownSmokeProject({ rejectOnNonZeroExitCode: false, telegram: true });
    }
  }
});

void test('AC-F0007-01 reuses suite-scoped compose families instead of per-test full deployment-cell restarts', {
  concurrency: false,
}, () => {
  assert.equal(smokeLifecycleMetrics.projectStarts, 1);
  assert.equal(smokeLifecycleMetrics.projectTeardowns, 1);
  assert.equal(smokeLifecycleMetrics.telegramOverlayActivations, 1);
  assert.ok(smokeRuntimeIdentity.baseVllmFastContainerId.length > 0);
  assert.equal(
    smokeRuntimeIdentity.telegramOverlayVllmFastContainerId,
    smokeRuntimeIdentity.baseVllmFastContainerId,
  );
  assert.equal(smokeLifecycleMetrics.runtimeResets, expectedRuntimeResets);
});

void test('AC-F0007-02 restores clean post-bootstrap runtime state through deterministic resets between suite-scoped smoke scenarios', {
  concurrency: false,
}, () => {
  assert.equal(smokeLifecycleMetrics.runtimeResets, expectedRuntimeResets);
});

void test('AC-F0007-05 tears down suite-scoped smoke projects without orphaned docker resources', {
  concurrency: false,
}, async () => {
  await waitForProjectResourcesToDisappear(projectName, {
    ignoredVolumes: [modelsVolumeName()],
  });
  await waitForPortToClose(defaultCoreHostPort);
  await waitForPortToClose(defaultPostgresHostPort);
});
