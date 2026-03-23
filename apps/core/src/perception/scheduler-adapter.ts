import {
  ADAPTER_HEALTH_STATUS,
  SENSOR_SOURCE,
  type AdapterHealthSnapshot,
  type SensorSignal,
} from '@yaagi/contracts/perception';
import {
  createAdapterSnapshot,
  type AdapterStatusReporter,
  type SensorAdapterRuntime,
  type SensorEmitter,
} from './adapters.ts';

export type SchedulerAdapterRuntime = SensorAdapterRuntime & {
  emitRuntimeSignal(input: Omit<SensorSignal, 'source'>): Promise<unknown>;
};

export function createSchedulerAdapter(options: {
  emitSignal: SensorEmitter;
  reportStatus: AdapterStatusReporter;
  now?: () => string;
}): SchedulerAdapterRuntime {
  const now = options.now ?? (() => new Date().toISOString());
  let started = false;
  let snapshot: AdapterHealthSnapshot = createAdapterSnapshot(
    SENSOR_SOURCE.SCHEDULER,
    ADAPTER_HEALTH_STATUS.DISABLED,
  );

  return {
    source: SENSOR_SOURCE.SCHEDULER,

    start(): Promise<void> {
      if (started) {
        return Promise.resolve();
      }

      started = true;
      snapshot = {
        source: SENSOR_SOURCE.SCHEDULER,
        status: ADAPTER_HEALTH_STATUS.HEALTHY,
      };
      options.reportStatus(snapshot);
      return Promise.resolve();
    },

    stop(): Promise<void> {
      started = false;
      snapshot = createAdapterSnapshot(SENSOR_SOURCE.SCHEDULER, ADAPTER_HEALTH_STATUS.DISABLED);
      options.reportStatus(snapshot);
      return Promise.resolve();
    },

    async emitRuntimeSignal(input): Promise<unknown> {
      if (!started) {
        throw new Error('scheduler adapter is not active');
      }

      const occurredAt = input.occurredAt ?? now();

      try {
        const result = await options.emitSignal({
          ...input,
          source: SENSOR_SOURCE.SCHEDULER,
          occurredAt,
        });
        snapshot = {
          source: SENSOR_SOURCE.SCHEDULER,
          status: ADAPTER_HEALTH_STATUS.HEALTHY,
          lastSignalAt: occurredAt,
        };
        options.reportStatus(snapshot);
        return result;
      } catch (error) {
        snapshot = {
          source: SENSOR_SOURCE.SCHEDULER,
          status: ADAPTER_HEALTH_STATUS.DEGRADED,
          detail: error instanceof Error ? error.message : String(error),
          lastSignalAt: snapshot.lastSignalAt ?? null,
        };
        options.reportStatus(snapshot);
        throw error;
      }
    },

    snapshot(): AdapterHealthSnapshot {
      return snapshot;
    },
  };
}
