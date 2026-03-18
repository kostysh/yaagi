import test from "node:test";
import assert from "node:assert/strict";
import { SYSTEM_EVENT } from "@yaagi/contracts/boot";
import { createBootHarness } from "../../testing/boot-harness.js";

test('AC-F0001-03 restores git and model pointers from the last valid stable snapshot before activation', async () => {
  const harness = await createBootHarness({
    allowedDegradedDependencies: [],
    dependencyResults: {
      "model-fast": { ok: false, detail: "offline" },
    },
  });

  try {
    const result = await harness.service.boot();

    assert.equal(result.ok, true);
    assert.equal(harness.agentState.developmentFreeze, true);
    assert.deepEqual(harness.restoredTags, ["stable/snapshot-41"]);
    assert.equal(harness.restoredProfileMaps.length, 1);
    assert.equal(harness.scheduler.startCalls, 1);
    assert.equal(harness.tickEngine.startCalls, 1);

    const recoveryEvent = harness.events.find(
      (event) => event.type === SYSTEM_EVENT.RECOVERY_COMPLETED,
    );
    assert.ok(recoveryEvent);
    assert.equal(recoveryEvent.payload.outcome, "recovered");

    const bootEvent = harness.events.find((event) => event.type === SYSTEM_EVENT.BOOT_COMPLETED);
    assert.ok(bootEvent);
    assert.equal(bootEvent.payload.mode, "recovery");
    assert.equal(bootEvent.payload.snapshotId, "snapshot-41");
  } finally {
    await harness.cleanup();
  }
});

test('AC-F0001-04 leaves runtime inactive when recovery target is missing or invalid', async () => {
  const harness = await createBootHarness({
    allowedDegradedDependencies: [],
    dependencyResults: {
      "model-fast": { ok: false, detail: "offline" },
    },
    snapshots: [],
  });

  try {
    const result = await harness.service.boot();

    assert.equal(result.ok, false);
    assert.equal(harness.lifecycle.state, "inactive");
    assert.equal(harness.scheduler.startCalls, 0);
    assert.equal(harness.tickEngine.startCalls, 0);
    assert.equal(harness.agentState.developmentFreeze, true);

    const recoveryEvent = harness.events.find(
      (event) => event.type === SYSTEM_EVENT.RECOVERY_COMPLETED,
    );
    assert.ok(recoveryEvent);
    assert.equal(recoveryEvent.payload.outcome, "failed");
    assert.equal(harness.ledgerEntries.length, 1);

    const bootEvent = harness.events.find((event) => event.type === SYSTEM_EVENT.BOOT_COMPLETED);
    assert.equal(bootEvent, undefined);
  } finally {
    await harness.cleanup();
  }
});
