import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const path = process.argv[2];
assert.ok(path);
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "sqlite-vec-linux-x64/vec0.so") {
      throw new Error("private supply path");
    }
    return next(specifier, context);
  },
});

const { openProbeDb, ProbeError } = await import("./probe.js");
assert.throws(() => openProbeDb(path), new ProbeError("incompatible"));
