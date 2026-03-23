import os from 'node:os';
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

const DEFAULT_RESOURCE_SAMPLE_MS = 5_000;

const classifyResourcePressure = (): 'normal' | 'high' | 'critical' => {
  const totalMemory = os.totalmem();
  const usedMemoryRatio = totalMemory > 0 ? process.memoryUsage().rss / totalMemory : 0;
  const cpuDenominator = Math.max(os.cpus().length, 1);
  const cpuRatio = (os.loadavg()[0] ?? 0) / cpuDenominator;
  const pressure = Math.max(usedMemoryRatio, cpuRatio);

  if (pressure >= 0.9) {
    return 'critical';
  }

  if (pressure >= 0.75) {
    return 'high';
  }

  return 'normal';
};

export function createResourceAdapter(options: {
  emitSignal: SensorEmitter;
  reportStatus: AdapterStatusReporter;
  now?: () => string;
  intervalMs?: number;
  samplePressure?: () => 'normal' | 'high' | 'critical';
}): SensorAdapterRuntime {
  const now = options.now ?? (() => new Date().toISOString());
  const intervalMs = options.intervalMs ?? DEFAULT_RESOURCE_SAMPLE_MS;
  const samplePressure = options.samplePressure ?? classifyResourcePressure;
  let timer: NodeJS.Timeout | null = null;
  let lastSeverity: 'normal' | 'high' | 'critical' = 'normal';
  let snapshot: AdapterHealthSnapshot = createAdapterSnapshot(
    SENSOR_SOURCE.RESOURCE,
    ADAPTER_HEALTH_STATUS.DISABLED,
  );

  const publishPressureSignal = async (): Promise<void> => {
    const severity = samplePressure();
    if (severity === 'normal' || severity === lastSeverity) {
      lastSeverity = severity;
      return;
    }

    try {
      await options.emitSignal({
        source: SENSOR_SOURCE.RESOURCE,
        signalType: 'resource.pressure',
        occurredAt: now(),
        priority: severity === 'critical' ? STIMULUS_PRIORITY.CRITICAL : STIMULUS_PRIORITY.HIGH,
        requiresImmediateTick: severity === 'critical',
        payload: {
          severity,
          rssBytes: process.memoryUsage().rss,
          loadAverage1m: os.loadavg()[0] ?? 0,
        },
        dedupeKey: 'resource:pressure',
      });
      lastSeverity = severity;
      snapshot = {
        source: SENSOR_SOURCE.RESOURCE,
        status: ADAPTER_HEALTH_STATUS.HEALTHY,
        lastSignalAt: now(),
      };
      options.reportStatus(snapshot);
    } catch (error) {
      snapshot = {
        source: SENSOR_SOURCE.RESOURCE,
        status: ADAPTER_HEALTH_STATUS.DEGRADED,
        detail: error instanceof Error ? error.message : String(error),
      };
      options.reportStatus(snapshot);
    }
  };

  return {
    source: SENSOR_SOURCE.RESOURCE,

    start(): Promise<void> {
      if (timer) {
        return Promise.resolve();
      }

      lastSeverity = 'normal';
      snapshot = {
        source: SENSOR_SOURCE.RESOURCE,
        status: ADAPTER_HEALTH_STATUS.HEALTHY,
      };
      options.reportStatus(snapshot);
      timer = setInterval(() => {
        void publishPressureSignal();
      }, intervalMs);
      return Promise.resolve();
    },

    stop(): Promise<void> {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }

      lastSeverity = 'normal';
      snapshot = createAdapterSnapshot(SENSOR_SOURCE.RESOURCE, ADAPTER_HEALTH_STATUS.DISABLED);
      options.reportStatus(snapshot);
      return Promise.resolve();
    },

    snapshot(): AdapterHealthSnapshot {
      return snapshot;
    },
  };
}
