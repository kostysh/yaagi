import {
  ADAPTER_HEALTH_STATUS,
  type AdapterHealthSnapshot,
  type SensorSignal,
  type SensorSource,
} from '@yaagi/contracts/perception';

export type SensorEmitter = (signal: SensorSignal) => Promise<unknown>;

export type AdapterStatusReporter = (snapshot: AdapterHealthSnapshot) => void;

export type SensorAdapterRuntime = {
  source: SensorSource;
  start(): Promise<void>;
  stop(): Promise<void>;
  snapshot(): AdapterHealthSnapshot;
};

export const createAdapterSnapshot = (
  source: SensorSource,
  status: AdapterHealthSnapshot['status'] = ADAPTER_HEALTH_STATUS.DISABLED,
): AdapterHealthSnapshot => ({
  source,
  status,
});
