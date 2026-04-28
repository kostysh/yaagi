import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

void test('AC-F0027-18 adds specialist policy storage without a second deployment stack', async () => {
  const migration = await readFile('infra/migrations/027_specialist_policy.sql', 'utf8');
  const compose = await readFile('infra/docker/compose.yaml', 'utf8');

  assert.match(migration, /specialist_organs/);
  assert.doesNotMatch(migration, /create\s+schema\s+specialist/i);
  assert.doesNotMatch(migration, /docker|compose|kubernetes|deployment/i);
  assert.match(compose, /vllm-fast/);
  assert.doesNotMatch(compose, /specialist/i);
});
