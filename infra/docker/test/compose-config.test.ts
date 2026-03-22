import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileExists, infraRoot, run } from '../helpers.ts';

const composeFile = path.join(infraRoot(), 'docker', 'compose.yaml');
const coreDockerfile = path.join(infraRoot(), 'docker', 'core', 'Dockerfile');
const vllmDockerfile = path.join(infraRoot(), 'docker', 'vllm-fast', 'Dockerfile');
const migrationFile = path.join(infraRoot(), 'migrations', '001_platform_bootstrap.sql');

void test('AC-F0002-03 renders the canonical compose cell with phase-0 service wiring', async () => {
  assert.equal(await fileExists(composeFile), true);
  assert.equal(await fileExists(coreDockerfile), true);
  assert.equal(await fileExists(vllmDockerfile), true);
  assert.equal(await fileExists(migrationFile), true);

  const { stdout } = await run('docker', ['compose', '-f', composeFile, 'config']);
  assert.match(stdout, /core:/);
  assert.match(stdout, /postgres:/);
  assert.match(stdout, /vllm-fast:/);
  assert.match(stdout, /core_net:/);
  assert.match(stdout, /models_net:/);
  assert.match(stdout, /db_net:/);
  assert.match(stdout, /dockerfile: infra\/docker\/core\/Dockerfile/);
  assert.match(stdout, /dockerfile: infra\/docker\/vllm-fast\/Dockerfile/);
  assert.match(stdout, /http:\/\/vllm-fast:8000\/v1/);
  assert.match(stdout, /target: \/seed/);
  assert.match(stdout, /read_only: true/);
  assert.match(stdout, /source: workspace_state/);
  assert.match(stdout, /target: \/workspace/);
  assert.match(stdout, /source: models_state/);
  assert.match(stdout, /target: \/models/);
  assert.match(stdout, /source: data_state/);
  assert.match(stdout, /target: \/data/);
  assert.match(stdout, /internal: true/);
});
