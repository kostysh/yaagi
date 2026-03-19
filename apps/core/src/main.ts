import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCoreRuntimeConfig, createCoreRuntime } from "./platform/index.ts";

const isMainModule = (): boolean => {
  const entryPoint = process.argv[1];
  if (!entryPoint) return false;

  const currentPath = fileURLToPath(import.meta.url);
  return currentPath === path.resolve(entryPoint);
};

const main = async (): Promise<void> => {
  const config = loadCoreRuntimeConfig();
  const runtime = createCoreRuntime(config);
  const { url } = await runtime.start();

  process.on("SIGINT", async () => {
    await runtime.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await runtime.stop();
    process.exit(0);
  });

  console.log(JSON.stringify({ status: "started", url, health: `${url}/health` }));
};

if (isMainModule()) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
