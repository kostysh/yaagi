const coreTypes = await import("@polyphony/core-types");

if (Object.getOwnPropertyNames(coreTypes).length !== 0) {
  throw new Error("@polyphony/core-types must not expose runtime values");
}
