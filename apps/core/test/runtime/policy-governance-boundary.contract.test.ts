import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { POLICY_GOVERNANCE_FOREIGN_WRITE_SURFACE } from '@yaagi/contracts/policy-governance';

const REPO_ROOT = process.cwd();
const POLICY_GOVERNANCE_FILES = [
  'apps/core/src/runtime/policy-governance.ts',
  'apps/core/src/perception/controller.ts',
  'packages/db/src/policy-governance.ts',
  'infra/migrations/021_policy_governance.sql',
];

const foreignWritePatterns = [
  /\b(?:insert\s+into|update|delete\s+from)\s+[^;]*(?:stimulus_inbox|ticks|model_registry|model_profile_health|model_fallback_links)/i,
  /\b(?:insert\s+into|update|delete\s+from)\s+[^;]*(?:development_freezes|development_proposals|development_proposal_decisions)/i,
  /\b(?:insert\s+into|update|delete\s+from)\s+[^;]*(?:perimeter_decisions|operator_auth_audit_events|report_runs|lifecycle_events)/i,
];

void test('AC-F0025-09 / AC-F0025-10 / AC-F0025-14 keeps F-0025 writes inside policy-governance surfaces', async () => {
  const violations: string[] = [];

  for (const relativePath of POLICY_GOVERNANCE_FILES) {
    const content = await readFile(path.join(REPO_ROOT, relativePath), 'utf8');
    if (foreignWritePatterns.some((pattern) => pattern.test(content))) {
      violations.push(relativePath);
    }
  }

  assert.deepEqual(violations, []);
});

void test('AC-F0025-14 names neighbouring owner surfaces as foreign write surfaces', () => {
  assert.equal(
    POLICY_GOVERNANCE_FOREIGN_WRITE_SURFACE.PERIMETER_DECISIONS,
    'polyphony_runtime.perimeter_decisions',
  );
  assert.equal(
    POLICY_GOVERNANCE_FOREIGN_WRITE_SURFACE.OPERATOR_AUTH_AUDIT_EVENTS,
    'polyphony_runtime.operator_auth_audit_events',
  );
  assert.equal(
    POLICY_GOVERNANCE_FOREIGN_WRITE_SURFACE.REPORT_RUNS,
    'polyphony_runtime.report_runs',
  );
});
