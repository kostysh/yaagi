import type { Client } from 'pg';
import {
  createLifecycleStore,
  createRuntimeDbClient,
  type LifecycleActiveWorkRef,
  type LifecycleRollbackFrequencySource,
  type RecordConsolidationTransitionInput,
  type RecordConsolidationTransitionResult,
  type RecordGracefulShutdownInput,
  type RecordGracefulShutdownResult,
  type RecordRetentionCompactionInput,
  type RecordRetentionCompactionResult,
  type RecordRollbackIncidentInput,
  type RecordRollbackIncidentResult,
} from '@yaagi/db';
import type { CoreRuntimeConfig } from '../platform/core-config.ts';

export type LifecycleConsolidationService = {
  recordConsolidationTransition(
    input: RecordConsolidationTransitionInput,
  ): Promise<RecordConsolidationTransitionResult>;
  recordRetentionCompaction(
    input: RecordRetentionCompactionInput,
  ): Promise<RecordRetentionCompactionResult>;
  recordRollbackIncident(input: RecordRollbackIncidentInput): Promise<RecordRollbackIncidentResult>;
  recordGracefulShutdown(input: RecordGracefulShutdownInput): Promise<RecordGracefulShutdownResult>;
  loadRollbackFrequencySource(input: {
    since: string;
    until: string;
  }): Promise<LifecycleRollbackFrequencySource>;
  listActiveTickWork(input?: { agentId?: string }): Promise<LifecycleActiveWorkRef[]>;
};

const withRuntimeClient = async <T>(
  connectionString: string,
  run: (client: Client) => Promise<T>,
): Promise<T> => {
  const client = createRuntimeDbClient(connectionString);
  await client.connect();

  try {
    return await run(client);
  } finally {
    await client.end();
  }
};

export const createDbBackedLifecycleConsolidationService = (
  config: Pick<CoreRuntimeConfig, 'postgresUrl'>,
): LifecycleConsolidationService => ({
  recordConsolidationTransition: (input) =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createLifecycleStore(client);
      return await store.recordConsolidationTransition(input);
    }),

  recordRetentionCompaction: (input) =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createLifecycleStore(client);
      return await store.recordRetentionCompaction(input);
    }),

  recordRollbackIncident: (input) =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createLifecycleStore(client);
      return await store.recordRollbackIncident(input);
    }),

  recordGracefulShutdown: (input) =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createLifecycleStore(client);
      return await store.recordGracefulShutdown(input);
    }),

  loadRollbackFrequencySource: (input) =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createLifecycleStore(client);
      return await store.loadRollbackFrequencySource(input);
    }),

  listActiveTickWork: (input) =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createLifecycleStore(client);
      return await store.listActiveTickWork(input);
    }),
});
