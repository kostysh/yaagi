import test from 'node:test';
import assert from 'node:assert/strict';
import { createBootHarness } from '../../testing/boot-harness.ts';

void test('AC-F0002-06 aligns F-0001 boot assumptions with the delivered deployment cell', async () => {
  const harness = await createBootHarness({
    requiredDependencies: ['postgres', 'model-fast'],
    allowedDegradedDependencies: [],
  });

  try {
    const result = await harness.service.boot();

    assert.equal(result.ok, true);
    assert.equal(harness.lifecycle.state, 'active');
    assert.equal(harness.agentState.mode, 'normal');
    assert.equal(harness.agentState.dependencyResults.length, 2);
    assert.deepEqual(
      harness.agentState.dependencyResults.map((dependency) => dependency.dependency),
      ['postgres', 'model-fast'],
    );
  } finally {
    await harness.cleanup();
  }
});

void test('AC-F0001-06 preserves boot fail-closed behavior for unsupported subject-state schema version inside the containerized startup path', async () => {
  const harness = await createBootHarness({
    requiredDependencies: ['postgres', 'model-fast'],
    allowedDegradedDependencies: [],
    subjectStateSchemaVersion: '2026-03-01',
    snapshots: [],
  });

  try {
    const result = await harness.service.boot();

    assert.equal(result.ok, false);
    assert.equal(harness.lifecycle.state, 'inactive');
    assert.equal(harness.scheduler.startCalls, 0);
    assert.equal(harness.tickEngine.startCalls, 0);
  } finally {
    await harness.cleanup();
  }
});
