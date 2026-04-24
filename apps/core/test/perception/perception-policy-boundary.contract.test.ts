import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = process.cwd();

void test('AC-F0025-08 / AC-F0025-14 keeps stimulus_inbox as the only durable raw intake layer', async () => {
  const migration = await readFile(
    path.join(REPO_ROOT, 'infra/migrations/021_policy_governance.sql'),
    'utf8',
  );
  const policyStore = await readFile(
    path.join(REPO_ROOT, 'packages/db/src/policy-governance.ts'),
    'utf8',
  );

  assert.match(
    migration,
    /create table if not exists polyphony_runtime\.perception_policy_decisions/i,
  );
  assert.doesNotMatch(migration, /create table if not exists .*stimulus_inbox/i);
  assert.doesNotMatch(
    policyStore,
    /\b(?:insert\s+into|update|delete\s+from)\s+[^;]*stimulus_inbox/i,
  );
});

void test('AC-F0025-08 applies policy through the perception controller instead of adapter-specific storage', async () => {
  const controller = await readFile(
    path.join(REPO_ROOT, 'apps/core/src/perception/controller.ts'),
    'utf8',
  );

  assert.match(controller, /enforcePerceptionPolicy/);
  assert.doesNotMatch(controller, /adapter_policy_decisions|raw_policy_events|shadow_intake/i);
});
