import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { repoRoot } from "../helpers.ts";

test("AC-F0002-05 wires the dedicated smoke:cell command to the deployment-cell smoke suite", async () => {
  const rootPackageJson = JSON.parse(
    await readFile(path.join(repoRoot(), "package.json"), "utf8"),
  ) as {
    scripts: Record<string, string>;
  };

  assert.equal(
    rootPackageJson.scripts["smoke:cell"],
    "node --experimental-strip-types --test infra/docker/deployment-cell.smoke.ts",
  );
});
