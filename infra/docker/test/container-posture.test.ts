import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { repoRoot } from '../helpers.ts';

const composeFile = path.join(repoRoot(), 'infra', 'docker', 'compose.yaml');

void test('AC-F0002-04 enforces baseline container posture and declared mounts', async () => {
  const text = await fs.readFile(composeFile, 'utf8');

  assert.match(text, /postgres:/);
  assert.match(text, /vllm-fast:/);
  assert.match(text, /core:/);
  assert.match(text, /read_only: true/);
  assert.match(text, /no-new-privileges:true/);
  assert.match(text, /cap_drop:/);
  assert.match(text, /tmpfs:/);
  assert.match(text, /user: "\$\{YAAGI_UID:-1000\}:\$\{YAAGI_GID:-1000\}"/);
  assert.match(text, /internal: true/);
  assert.match(text, /\.\.\/\.\.\/seed:\/seed:ro/);
  assert.match(text, /workspace_state:\/workspace/);
  assert.match(text, /models_state:\/models/);
  assert.match(text, /data_state:\/data/);
  assert.doesNotMatch(text, /privileged:/);
  assert.doesNotMatch(text, /docker\.sock/);
});
