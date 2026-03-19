import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { repoRoot, run, waitForHttp } from './helpers.ts';

const composeFile = path.join(repoRoot(), 'infra', 'docker', 'compose.yaml');
const projectName = 'yaagi-phase0';
const coreHealthUrl = 'http://127.0.0.1:18080/health';

async function compose(args: string[], options: Parameters<typeof run>[2] = {}) {
  return run('docker', ['compose', '-f', composeFile, '-p', projectName, ...args], {
    cwd: repoRoot(),
    env: {
      ...process.env,
      DOCKER_BUILDKIT: '0',
      COMPOSE_DOCKER_CLI_BUILD: '0',
    },
    ...options,
  });
}

void test('AC-F0002-05 initializes postgres and pgboss readiness before core reports ready', async () => {
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

    const { stdout } = await compose([
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'yaagi',
      '-d',
      'yaagi',
      '-tAc',
      "select schema_name from information_schema.schemata where schema_name in ('platform_bootstrap', 'pgboss') order by schema_name;",
    ]);

    assert.match(stdout, /pgboss/);
    assert.match(stdout, /platform_bootstrap/);
  } finally {
    await compose(['down', '-v'], { rejectOnNonZeroExitCode: false }).catch(() => {});
  }
});
