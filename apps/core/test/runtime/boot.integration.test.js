import test from "node:test";
import assert from "node:assert/strict";
import { SYSTEM_EVENT } from "@yaagi/contracts/boot";
import { createBootHarness } from "../../testing/boot-harness.js";

test('AC-F0001-01 blocks runtime activation until constitution, schema and volume checks pass', async () => {
  const harness = await createBootHarness({
    missingVolumes: ["models"],
  });

  try {
    const result = await harness.service.boot();

    assert.equal(result.ok, false);
    assert.equal(result.error.code, "REQUIRED_VOLUME_MISSING");
    assert.equal(harness.lifecycle.state, "inactive");
    assert.equal(harness.sensorAdapter.startCalls, 0);
    assert.equal(harness.scheduler.startCalls, 0);
    assert.equal(harness.tickEngine.startCalls, 0);
    assert.equal(harness.events.length, 0);
  } finally {
    await harness.cleanup();
  }
});

test('AC-F0001-02 emits boot event with selected startup mode and dependency results', async () => {
  const harness = await createBootHarness();

  try {
    const result = await harness.service.boot();

    assert.equal(result.ok, true);
    assert.equal(harness.lifecycle.state, "active");
    assert.equal(harness.scheduler.startCalls, 1);
    assert.equal(harness.tickEngine.startCalls, 1);

    const bootEvent = harness.events.find((event) => event.type === SYSTEM_EVENT.BOOT_COMPLETED);
    assert.ok(bootEvent);
    assert.equal(bootEvent.payload.mode, "normal");
    assert.equal(bootEvent.payload.snapshotId, null);
    assert.equal(bootEvent.payload.dependencyResults.length, 4);
    assert.deepEqual(bootEvent.payload.degradedDependencies, []);
  } finally {
    await harness.cleanup();
  }
});

test('AC-F0001-05 allows degraded boot only for policy-approved dependency loss', async () => {
  const harness = await createBootHarness({
    dependencyResults: {
      "model-fast": { ok: false, detail: "timeout" },
    },
  });

  try {
    const result = await harness.service.boot();

    assert.equal(result.ok, true);
    assert.equal(harness.lifecycle.state, "degraded");
    assert.equal(harness.agentState.mode, "degraded");

    const bootEvent = harness.events.find((event) => event.type === SYSTEM_EVENT.BOOT_COMPLETED);
    assert.ok(bootEvent);
    assert.equal(bootEvent.payload.mode, "degraded");
    assert.deepEqual(bootEvent.payload.degradedDependencies, ["model-fast"]);
    assert.equal(harness.scheduler.startCalls, 1);
    assert.equal(harness.tickEngine.startCalls, 1);
  } finally {
    await harness.cleanup();
  }
});
