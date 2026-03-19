import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCoreRuntimeConfig, createCoreRuntime } from './platform/index.ts';

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

  const registerShutdown = (signal: NodeJS.Signals): void => {
    process.on(signal, () => {
      void runtime
        .stop()
        .then(() => {
          process.exit(0);
        })
        .catch((error: unknown) => {
          console.error(error);
          process.exit(1);
        });
    });
  };

  registerShutdown('SIGINT');
  registerShutdown('SIGTERM');

  console.log(JSON.stringify({ status: 'started', url, health: `${url}/health` }));
};

if (isMainModule()) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
