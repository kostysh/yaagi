import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, next) {
    if (
      specifier.startsWith("node:") ||
      specifier.includes("sqlite-vec") ||
      specifier.includes("drizzle-orm")
    ) {
      throw new Error("Native import forbidden");
    }
    return next(specifier, context);
  },
});

await import("./contracts.js");
await import("./sqlite.js");
