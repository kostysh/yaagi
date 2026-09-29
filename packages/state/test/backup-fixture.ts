import { backup as nativeBackup } from 'node:sqlite';
import { workerData } from 'node:worker_threads';
export * from 'node:sqlite';

// Preload-only fixture. It delegates to the REAL native backup and injects
// cancellation after SQLite reports copied pages, not at worker startup.
export async function backup(
  ...[source, target, options]: Parameters<typeof nativeBackup>
) {
  return nativeBackup(source, target, {
    ...options,
    rate: 1,
    progress: (info) => {
      Atomics.store(new Int32Array(workerData.cancelled), 0, 1);
      options?.progress?.(info);
    },
  });
}
