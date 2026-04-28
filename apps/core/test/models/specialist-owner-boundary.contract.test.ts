import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPECIALIST_FOREIGN_WRITE_SURFACE,
  SPECIALIST_OWNED_WRITE_SURFACE,
  SPECIALIST_REFUSAL_REASON,
} from '@yaagi/contracts/specialists';
import { SPECIALIST_POLICY_WRITE_SURFACES, createSpecialistPolicyStore } from '@yaagi/db';
import { createSpecialistPolicyDbHarness } from '../../../../packages/db/testing/specialist-policy-db-harness.ts';

void test('AC-F0027-13 / AC-F0027-14 / AC-F0027-15 / AC-F0027-16 exposes only specialist policy write surfaces', () => {
  assert.deepEqual(
    [...SPECIALIST_POLICY_WRITE_SURFACES],
    Object.values(SPECIALIST_OWNED_WRITE_SURFACE),
  );

  const store = createSpecialistPolicyStore(createSpecialistPolicyDbHarness().db);
  assert.doesNotThrow(() =>
    store.assertOwnedWriteSurface(SPECIALIST_OWNED_WRITE_SURFACE.ADMISSION_DECISIONS),
  );
  assert.throws(
    () => store.assertOwnedWriteSurface(SPECIALIST_FOREIGN_WRITE_SURFACE.MODEL_CANDIDATES),
    new RegExp(SPECIALIST_REFUSAL_REASON.FOREIGN_OWNER_WRITE_REJECTED),
  );
  assert.throws(
    () => store.assertOwnedWriteSurface(SPECIALIST_FOREIGN_WRITE_SURFACE.RELEASE_EVIDENCE),
    new RegExp(SPECIALIST_REFUSAL_REASON.FOREIGN_OWNER_WRITE_REJECTED),
  );
});
