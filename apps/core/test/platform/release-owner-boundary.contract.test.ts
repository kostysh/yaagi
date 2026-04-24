import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  RELEASE_AUTOMATION_FOREIGN_WRITE_SURFACE,
  RELEASE_AUTOMATION_OWNED_WRITE_SURFACE,
} from '@yaagi/contracts/release-automation';
import { createInMemoryReleaseAutomationStore } from '../../testing/release-automation-fixture.ts';

void test('AC-F0026-12 AC-F0026-14 AC-F0026-15 AC-F0026-16 keeps release automation inside its owner surface', async () => {
  const { store } = createInMemoryReleaseAutomationStore();

  assert.doesNotThrow(() =>
    store.assertOwnedWriteSurface(RELEASE_AUTOMATION_OWNED_WRITE_SURFACE.RELEASE_EVIDENCE),
  );
  assert.throws(
    () =>
      store.assertOwnedWriteSurface(
        RELEASE_AUTOMATION_FOREIGN_WRITE_SURFACE.LIFECYCLE_ROLLBACK_INCIDENTS,
      ),
    /foreign_owner_write_rejected/,
  );

  const source = await readFile('apps/core/src/platform/release-automation.ts', 'utf8');
  assert.equal(source.includes('createDevelopmentGovernorStore'), false);
  assert.equal(source.includes('createLifecycleStore'), false);
  assert.equal(source.includes('createReportingStore'), false);
  assert.equal(source.includes('createExpandedModelEcologyStore'), false);
});
