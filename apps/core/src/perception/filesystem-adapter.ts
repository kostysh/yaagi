import path from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import {
  ADAPTER_HEALTH_STATUS,
  SENSOR_SOURCE,
  STIMULUS_PRIORITY,
  type AdapterHealthSnapshot,
} from '@yaagi/contracts/perception';
import {
  createAdapterSnapshot,
  type AdapterStatusReporter,
  type SensorAdapterRuntime,
  type SensorEmitter,
} from './adapters.ts';

export function createFilesystemAdapter(options: {
  emitSignal: SensorEmitter;
  reportStatus: AdapterStatusReporter;
  watchPaths: string[];
  repoRoot?: string;
  now?: () => string;
}): SensorAdapterRuntime {
  const now = options.now ?? (() => new Date().toISOString());
  const repoRoot = options.repoRoot ?? process.cwd();
  let watcher: FSWatcher | null = null;
  let snapshot: AdapterHealthSnapshot = createAdapterSnapshot(
    SENSOR_SOURCE.FILE,
    ADAPTER_HEALTH_STATUS.DISABLED,
  );

  const toRelativePath = (targetPath: string): string => {
    const relative = path.relative(repoRoot, targetPath);
    return relative.length > 0 ? relative : path.basename(targetPath);
  };

  return {
    source: SENSOR_SOURCE.FILE,

    start(): Promise<void> {
      if (watcher) {
        return Promise.resolve();
      }

      snapshot = {
        source: SENSOR_SOURCE.FILE,
        status: ADAPTER_HEALTH_STATUS.HEALTHY,
      };
      options.reportStatus(snapshot);

      watcher = chokidar.watch(options.watchPaths, {
        ignoreInitial: true,
        persistent: true,
      });

      watcher.on('all', (eventName: string, targetPath: string) => {
        void options
          .emitSignal({
            source: SENSOR_SOURCE.FILE,
            signalType: `filesystem.${eventName}`,
            occurredAt: now(),
            priority: STIMULUS_PRIORITY.NORMAL,
            payload: {
              eventName,
              path: toRelativePath(targetPath),
            },
            dedupeKey: `filesystem:${eventName}:${toRelativePath(targetPath)}`,
          })
          .then(() => {
            snapshot = {
              source: SENSOR_SOURCE.FILE,
              status: ADAPTER_HEALTH_STATUS.HEALTHY,
              lastSignalAt: now(),
            };
            options.reportStatus(snapshot);
          })
          .catch((error) => {
            snapshot = {
              source: SENSOR_SOURCE.FILE,
              status: ADAPTER_HEALTH_STATUS.DEGRADED,
              detail: error instanceof Error ? error.message : String(error),
            };
            options.reportStatus(snapshot);
          });
      });

      watcher.on('error', (error: unknown) => {
        snapshot = {
          source: SENSOR_SOURCE.FILE,
          status: ADAPTER_HEALTH_STATUS.DEGRADED,
          detail: error instanceof Error ? error.message : String(error),
        };
        options.reportStatus(snapshot);
      });

      return Promise.resolve();
    },

    async stop(): Promise<void> {
      if (watcher) {
        await watcher.close();
        watcher = null;
      }

      snapshot = createAdapterSnapshot(SENSOR_SOURCE.FILE, ADAPTER_HEALTH_STATUS.DISABLED);
      options.reportStatus(snapshot);
    },

    snapshot(): AdapterHealthSnapshot {
      return snapshot;
    },
  };
}
