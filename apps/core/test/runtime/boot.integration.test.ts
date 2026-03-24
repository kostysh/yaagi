import test from 'node:test';
import assert from 'node:assert/strict';
import { SYSTEM_EVENT, type BootCompletedPayload, type SystemEvent } from '@yaagi/contracts/boot';
import { createBootHarness } from '../../testing/boot-harness.ts';

const isBootEvent = (
  event: SystemEvent<BootCompletedPayload> | SystemEvent<unknown>,
): event is SystemEvent<BootCompletedPayload> => event.type === SYSTEM_EVENT.BOOT_COMPLETED;

const getErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null) return undefined;
  if (!('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
};

void test('AC-F0001-01 blocks runtime activation until constitution, schema and volume checks pass', async () => {
  const harness = await createBootHarness({
    missingVolumes: ['models'],
  });

  try {
    const result = await harness.service.boot();

    assert.equal(result.ok, false);
    assert.equal(getErrorCode(result.error), 'REQUIRED_VOLUME_MISSING');
    assert.equal(harness.lifecycle.state, 'inactive');
    assert.equal(harness.sensorAdapter.startCalls, 0);
    assert.equal(harness.scheduler.startCalls, 0);
    assert.equal(harness.tickEngine.startCalls, 0);
    assert.equal(harness.events.length, 0);
  } finally {
    await harness.cleanup();
  }
});

void test('AC-F0001-02 emits boot event with selected startup mode and dependency results', async () => {
  const harness = await createBootHarness();

  try {
    const result = await harness.service.boot();

    assert.equal(result.ok, true);
    assert.equal(harness.lifecycle.state, 'active');
    assert.equal(harness.scheduler.startCalls, 1);
    assert.equal(harness.tickEngine.startCalls, 1);

    const bootEvent = harness.events.find(isBootEvent);
    assert.ok(bootEvent);
    assert.equal(bootEvent.payload.mode, 'normal');
    assert.equal(bootEvent.payload.snapshotId, null);
    assert.equal(bootEvent.payload.dependencyResults.length, 4);
    assert.deepEqual(bootEvent.payload.degradedDependencies, []);
  } finally {
    await harness.cleanup();
  }
});

void test('AC-F0001-05 allows degraded boot only for policy-approved dependency loss', async () => {
  const harness = await createBootHarness({
    dependencyResults: {
      'model-fast': { ok: false, detail: 'timeout' },
    },
  });

  try {
    const result = await harness.service.boot();

    assert.equal(result.ok, true);
    assert.equal(harness.lifecycle.state, 'degraded');
    assert.equal(harness.agentState.mode, 'degraded');

    const bootEvent = harness.events.find(isBootEvent);
    assert.ok(bootEvent);
    assert.equal(bootEvent.payload.mode, 'degraded');
    assert.deepEqual(bootEvent.payload.degradedDependencies, ['model-fast']);
    assert.equal(harness.scheduler.startCalls, 1);
    assert.equal(harness.tickEngine.startCalls, 1);
  } finally {
    await harness.cleanup();
  }
});

void test('AC-F0001-06 refuses activation when subject-state schema version is unsupported', async () => {
  const harness = await createBootHarness({
    subjectStateSchemaVersion: '2026-03-01',
    snapshots: [],
  });

  try {
    const result = await harness.service.boot();

    assert.equal(result.ok, false);
    assert.equal(harness.lifecycle.state, 'inactive');
    assert.equal(harness.scheduler.startCalls, 0);
    assert.equal(harness.tickEngine.startCalls, 0);
    assert.equal(harness.sensorAdapter.startCalls, 0);
    assert.equal(harness.events.some(isBootEvent), false);
  } finally {
    await harness.cleanup();
  }
});
