import test from "node:test";
import assert from "node:assert/strict";
import { createBootHarness } from "../../testing/boot-harness.ts";

test("AC-F0002-06 aligns F-0001 boot assumptions with the delivered deployment cell", async () => {
  const harness = await createBootHarness({
    requiredDependencies: ["postgres", "model-fast"],
    allowedDegradedDependencies: [],
  });

  try {
    const result = await harness.service.boot();

    assert.equal(result.ok, true);
    assert.equal(harness.lifecycle.state, "active");
    assert.equal(harness.agentState.mode, "normal");
    assert.equal(harness.agentState.dependencyResults.length, 2);
    assert.deepEqual(
      harness.agentState.dependencyResults.map((dependency) => dependency.dependency),
      ["postgres", "model-fast"],
    );
  } finally {
    await harness.cleanup();
  }
});
