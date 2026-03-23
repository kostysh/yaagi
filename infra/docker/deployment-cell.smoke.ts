import assert from 'node:assert/strict';
import net from 'node:net';
import test from 'node:test';
import path from 'node:path';
import { repoRoot, run, waitForHttp } from './helpers.ts';

const composeFile = path.join(repoRoot(), 'infra', 'docker', 'compose.yaml');
const telegramSmokeComposeFile = path.join(
  repoRoot(),
  'infra',
  'docker',
  'compose.smoke-telegram.yaml',
);
const projectName = 'yaagi-phase0';
const telegramProjectName = 'yaagi-phase0-telegram';
const coreHealthUrl = 'http://127.0.0.1:18080/health';

type ComposeOptions = Parameters<typeof run>[2] & {
  telegram?: boolean;
  projectName?: string;
};

async function compose(args: string[], options: ComposeOptions = {}) {
  const {
    telegram = false,
    projectName: composeProjectName = projectName,
    ...runOptions
  } = options;
  const composeFiles = telegram ? [composeFile, telegramSmokeComposeFile] : [composeFile];

  return run(
    'docker',
    ['compose', ...composeFiles.flatMap((file) => ['-f', file]), '-p', composeProjectName, ...args],
    {
      cwd: repoRoot(),
      env: {
        ...process.env,
        DOCKER_BUILDKIT: '0',
        COMPOSE_DOCKER_CLI_BUILD: '0',
      },
      ...runOptions,
    },
  );
}

async function resetSmokeProjects(): Promise<void> {
  await compose(['down', '-v', '--remove-orphans'], {
    rejectOnNonZeroExitCode: false,
    telegram: true,
  }).catch(() => {});
  await compose(['down', '-v', '--remove-orphans'], {
    rejectOnNonZeroExitCode: false,
    telegram: true,
    projectName: telegramProjectName,
  }).catch(() => {});
  await waitForPortToClose(18080);
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

async function queryPostgres(
  sql: string,
  options: { telegram?: boolean; projectName?: string } = {},
): Promise<string> {
  const { stdout } = await compose(
    ['exec', '-T', 'postgres', 'psql', '-U', 'yaagi', '-d', 'yaagi', '-tAc', sql],
    options,
  );

  return stdout.trim();
}

async function execCoreScript(
  source: string,
  options: { telegram?: boolean; projectName?: string } = {},
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
    { telegram: true, projectName: telegramProjectName },
  );
}

async function waitForPostgresValue(
  sql: string,
  expected: string,
  timeoutMs = 20_000,
  options: { telegram?: boolean; projectName?: string } = {},
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    if ((await queryPostgres(sql, options)) === expected) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`timed out waiting for postgres query to return ${expected}: ${sql}`);
}

async function waitForAdapterStatus(
  source: string,
  status: string,
  timeoutMs = 20_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    try {
      const response = await fetch(coreHealthUrl);
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

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`timed out waiting for adapter ${source} to become ${status}`);
}

void test('AC-F0002-05 initializes postgres and pgboss readiness before core reports ready', {
  concurrency: false,
}, async () => {
  await resetSmokeProjects();
  await compose(['up', '-d', '--build']);

  try {
    const coreResponse = await waitForHttp(coreHealthUrl);
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
            workspaceSkills: await canAccess('/workspace/skills/.gitkeep'),
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
  } finally {
    await compose(['down', '-v'], { rejectOnNonZeroExitCode: false }).catch(() => {});
  }
});

void test('AC-F0003-01 starts the mandatory wake tick only after constitutional activation', {
  concurrency: false,
}, async () => {
  await resetSmokeProjects();
  await compose(['up', '-d', '--build']);

  try {
    const coreResponse = await waitForHttp(coreHealthUrl);
    assert.equal(coreResponse.status, 200);

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
  } finally {
    await compose(['down', '-v'], { rejectOnNonZeroExitCode: false }).catch(() => {});
  }
});

void test('AC-F0003-02 prevents overlapping active ticks through DB-backed lease discipline', {
  concurrency: false,
}, async () => {
  await resetSmokeProjects();
  await compose(['up', '-d', '--build']);

  try {
    const coreResponse = await waitForHttp(coreHealthUrl);
    assert.equal(coreResponse.status, 200);

    const admissionResult = JSON.parse(
      await execCoreScript(`
        import { createRuntimeDbClient, createTickRuntimeStore } from './packages/db/src/index.ts';

        const client = createRuntimeDbClient(process.env.YAAGI_POSTGRES_URL);
        await client.connect();

        try {
          const store = createTickRuntimeStore(client);
          const first = await store.requestTick({
            requestId: 'smoke-lease-1',
            kind: 'reactive',
            trigger: 'scheduler',
            requestedAt: new Date('2026-03-21T00:00:01Z'),
            payload: {},
          });
          const second = await store.requestTick({
            requestId: 'smoke-lease-2',
            kind: 'reactive',
            trigger: 'scheduler',
            requestedAt: new Date('2026-03-21T00:00:02Z'),
            payload: {},
          });

          if (!first.accepted) {
            throw new Error('expected first admission to succeed');
          }

          await store.failTick({
            tickId: first.tick.tickId,
            occurredAt: new Date('2026-03-21T00:00:03Z'),
            failureJson: { reason: 'smoke_cleanup' },
          });

          console.log(
            JSON.stringify({
              firstAccepted: first.accepted,
              firstTickId: first.accepted ? first.tick.tickId : null,
              secondAccepted: second.accepted,
              secondReason: second.accepted ? null : second.reason,
            }),
          );
        } finally {
          await client.end();
        }
      `),
    ) as {
      firstAccepted: boolean;
      firstTickId: string;
      secondAccepted: boolean;
      secondReason: string | null;
    };

    assert.equal(admissionResult.firstAccepted, true);
    assert.equal(admissionResult.secondAccepted, false);
    assert.equal(admissionResult.secondReason, 'lease_busy');
    assert.equal(
      await queryPostgres(
        "select coalesce(current_tick_id, '') from polyphony_runtime.agent_state where id = 1;",
      ),
      '',
    );
    assert.equal(
      await queryPostgres(
        `select count(*)::text
         from polyphony_runtime.ticks
         where request_id in ('smoke-lease-1', 'smoke-lease-2');`,
      ),
      '1',
    );
  } finally {
    await compose(['down', '-v'], { rejectOnNonZeroExitCode: false }).catch(() => {});
  }
});

void test('AC-F0003-07 reclaims stale active ticks after restart and clears agent_state.current_tick', {
  concurrency: false,
}, async () => {
  await resetSmokeProjects();
  await compose(['up', '-d', '--build']);

  try {
    const coreResponse = await waitForHttp(coreHealthUrl);
    assert.equal(coreResponse.status, 200);

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
    await waitForHttp(coreHealthUrl);

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
  } finally {
    await compose(['down', '-v'], { rejectOnNonZeroExitCode: false }).catch(() => {});
  }
});

void test('AC-F0004-06 reloads the last committed subject-state after restart without process-local reconstruction', {
  concurrency: false,
}, async () => {
  await resetSmokeProjects();
  await compose(['up', '-d', '--build']);

  try {
    const coreResponse = await waitForHttp(coreHealthUrl);
    assert.equal(coreResponse.status, 200);

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
    await waitForHttp(coreHealthUrl);

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
  } finally {
    await compose(['down', '-v'], { rejectOnNonZeroExitCode: false }).catch(() => {});
  }
});

void test('AC-F0005-02 accepts POST /ingest inside the deployment cell and reuses the canonical reactive handoff', {
  concurrency: false,
}, async () => {
  await resetSmokeProjects();
  await compose(['up', '-d', '--build']);

  try {
    const coreResponse = await waitForHttp(coreHealthUrl);
    assert.equal(coreResponse.status, 200);

    const ingestResponse = await fetch('http://127.0.0.1:18080/ingest', {
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

    await waitForPostgresValue(
      "select count(*)::text from polyphony_runtime.stimulus_inbox where source_kind = 'http' and normalized_json ->> 'signalType' = 'http.operator.message';",
      '1',
    );
    await waitForPostgresValue(
      "select count(*)::text from polyphony_runtime.ticks where tick_kind = 'reactive' and trigger_kind = 'system' and status = 'completed';",
      '1',
    );

    assert.equal(
      await queryPostgres(
        "select normalized_json -> 'envelope' ->> 'source' from polyphony_runtime.stimulus_inbox where source_kind = 'http' and normalized_json ->> 'signalType' = 'http.operator.message' limit 1;",
      ),
      'http',
    );
    assert.equal(
      await queryPostgres(
        "select normalized_json -> 'envelope' ->> 'threadId' from polyphony_runtime.stimulus_inbox where source_kind = 'http' and normalized_json ->> 'signalType' = 'http.operator.message' limit 1;",
      ),
      'operator-http',
    );
    assert.equal(
      await queryPostgres(
        "select request_json -> 'perception' -> 'sourceKinds' ->> 0 from polyphony_runtime.ticks where tick_kind = 'reactive' and trigger_kind = 'system' and status = 'completed' limit 1;",
      ),
      'http',
    );
  } finally {
    await compose(['down', '-v'], { rejectOnNonZeroExitCode: false }).catch(() => {});
  }
});

void test('AC-F0005-02 ingests a Telegram update from a fake Bot API inside the deployment cell', {
  concurrency: false,
}, async () => {
  await resetSmokeProjects();
  await compose(['up', '-d', '--build'], {
    telegram: true,
    projectName: telegramProjectName,
  });

  try {
    const coreResponse = await waitForHttp(coreHealthUrl);
    assert.equal(coreResponse.status, 200);
    await waitForAdapterStatus('telegram', 'healthy');

    await enqueueFakeTelegramUpdate({
      updateId: 1,
      chatId: '12345',
      text: 'smoke telegram message',
    });

    await waitForPostgresValue(
      "select count(*)::text from polyphony_runtime.stimulus_inbox where source_kind = 'telegram';",
      '1',
      20_000,
      { telegram: true, projectName: telegramProjectName },
    );
    await waitForPostgresValue(
      "select count(*)::text from polyphony_runtime.ticks where tick_kind = 'reactive' and trigger_kind = 'system' and status = 'completed';",
      '1',
      20_000,
      { telegram: true, projectName: telegramProjectName },
    );

    assert.equal(
      await queryPostgres(
        "select normalized_json -> 'envelope' ->> 'source' from polyphony_runtime.stimulus_inbox where source_kind = 'telegram' limit 1;",
        { telegram: true, projectName: telegramProjectName },
      ),
      'telegram',
    );
    assert.equal(
      await queryPostgres(
        "select normalized_json -> 'envelope' ->> 'threadId' from polyphony_runtime.stimulus_inbox where source_kind = 'telegram' limit 1;",
        { telegram: true, projectName: telegramProjectName },
      ),
      '12345',
    );
    assert.equal(
      await queryPostgres(
        "select request_json -> 'perception' -> 'sourceKinds' ->> 0 from polyphony_runtime.ticks where tick_kind = 'reactive' and trigger_kind = 'system' and status = 'completed' limit 1;",
        { telegram: true, projectName: telegramProjectName },
      ),
      'telegram',
    );
  } finally {
    await compose(['down', '-v'], {
      rejectOnNonZeroExitCode: false,
      telegram: true,
      projectName: telegramProjectName,
    }).catch(() => {});
  }
});
