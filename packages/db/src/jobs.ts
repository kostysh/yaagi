import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PgBoss } from 'pg-boss';

const JOB_ENQUEUE_TIMEOUT_MESSAGE = 'job_enqueue.phase0_followup timed out';
const JOB_ROLLBACK_TIMEOUT_MS = 1_000;

export type RuntimeJobHandle = {
  jobId: string;
  rollback: () => Promise<void>;
};

export type RuntimeJobEnqueueOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type RuntimeJobEnqueuer = (
  queueName: string,
  payload: Record<string, unknown>,
  options?: RuntimeJobEnqueueOptions,
) => Promise<RuntimeJobHandle>;

type DeadlineDatabase = {
  executeSql: (text: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
  close: () => Promise<void>;
  abort: (reason: Error) => void;
};

const toAbortError = (
  signal: AbortSignal | undefined,
  fallbackMessage = JOB_ENQUEUE_TIMEOUT_MESSAGE,
): Error => {
  const reason: unknown = signal?.reason;
  if (reason instanceof Error) {
    return reason;
  }

  if (typeof reason === 'string' && reason.length > 0) {
    return new Error(reason);
  }

  return new Error(fallbackMessage);
};

const throwIfAborted = (
  signal: AbortSignal | undefined,
  fallbackMessage = JOB_ENQUEUE_TIMEOUT_MESSAGE,
): void => {
  if (signal?.aborted) {
    throw toAbortError(signal, fallbackMessage);
  }
};

const composeAbortSignal = (
  signal: AbortSignal | undefined,
  timeoutMs: number | undefined,
): AbortSignal | undefined => {
  const timeoutSignal = timeoutMs && timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined;

  if (signal && timeoutSignal) {
    return AbortSignal.any([signal, timeoutSignal]);
  }

  return signal ?? timeoutSignal;
};

const destroyClientConnection = (client: Client, reason: Error): void => {
  const stream = (
    client as Client & {
      connection?: { stream?: { destroy: (error?: Error) => void; destroyed?: boolean } };
    }
  ).connection?.stream;

  if (stream && !stream.destroyed) {
    stream.destroy(reason);
  }
};

const runAbortable = async <T>(
  signal: AbortSignal | undefined,
  operation: () => Promise<T>,
  onAbort: (reason: Error) => void,
): Promise<T> => {
  if (!signal) {
    return await operation();
  }

  throwIfAborted(signal);

  return await new Promise<T>((resolve, reject) => {
    let settled = false;

    const cleanup = (): void => {
      signal.removeEventListener('abort', handleAbort);
    };

    const settleReject = (error: unknown): void => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const handleAbort = (): void => {
      const error = toAbortError(signal);
      onAbort(error);
      settleReject(error);
    };

    signal.addEventListener('abort', handleAbort, { once: true });

    void operation()
      .then((value) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        resolve(value);
      })
      .catch((error) => {
        settleReject(error);
      });
  });
};

const createDeadlineDatabase = async (options: {
  connectionString: string;
  schema?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<DeadlineDatabase | null> => {
  if (!options.signal && (!options.timeoutMs || options.timeoutMs <= 0)) {
    return null;
  }

  const deadline =
    options.timeoutMs && options.timeoutMs > 0 ? Date.now() + options.timeoutMs : null;
  const client = new Client({
    connectionString: options.connectionString,
  });
  const abortClient = (reason: Error): void => {
    destroyClientConnection(client, reason);
  };

  await runAbortable(
    options.signal,
    async () => {
      await client.connect();
    },
    abortClient,
  );

  return {
    executeSql: async (text, values = []) => {
      throwIfAborted(options.signal);

      if (deadline !== null) {
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) {
          throw new Error(JOB_ENQUEUE_TIMEOUT_MESSAGE);
        }

        await runAbortable(
          options.signal,
          async () => {
            await client.query(`set statement_timeout to ${Math.max(1, remainingMs)}`);
          },
          abortClient,
        );
      }

      const result = await runAbortable(
        options.signal,
        async () => await client.query(text, values),
        abortClient,
      );

      throwIfAborted(options.signal);

      return {
        rows: result.rows as unknown[],
      };
    },
    close: async () => {
      await client.end().catch(() => {});
    },
    abort: abortClient,
  };
};

const createBoss = (
  options: {
    connectionString: string;
    schema?: string;
    timeoutMs?: number;
    signal?: AbortSignal;
  },
  db: DeadlineDatabase | null,
): PgBoss =>
  new PgBoss({
    ...(db
      ? { db: { executeSql: db.executeSql } }
      : { connectionString: options.connectionString }),
    schema: options.schema ?? 'pgboss',
    supervise: false,
    schedule: false,
    migrate: true,
  });

const withBoss = async <T>(
  options: { connectionString: string; schema?: string; timeoutMs?: number; signal?: AbortSignal },
  run: (
    boss: PgBoss,
    signal: AbortSignal | undefined,
    abort: (reason: Error) => void,
  ) => Promise<T>,
): Promise<T> => {
  const db = await createDeadlineDatabase(options);
  const boss = createBoss(options, db);
  const abortResources = (reason: Error): void => {
    db?.abort(reason);
    void boss.stop({ graceful: false }).catch(() => {});
  };

  await runAbortable(
    options.signal,
    async () => {
      await boss.start();
    },
    abortResources,
  );

  try {
    throwIfAborted(options.signal);
    const result = await run(boss, options.signal, abortResources);
    throwIfAborted(options.signal);
    return result;
  } finally {
    await boss.stop({ graceful: true, timeout: 1_000 }).catch(() => {});
    await db?.close();
  }
};

const deleteJobBestEffort = async (
  options: { connectionString: string; schema?: string; timeoutMs?: number },
  queueName: string,
  jobId: string,
): Promise<void> => {
  const bossOptions = {
    connectionString: options.connectionString,
    ...(options.schema ? { schema: options.schema } : {}),
    timeoutMs: JOB_ROLLBACK_TIMEOUT_MS,
  };

  await withBoss(bossOptions, async (boss) => {
    await boss.deleteJob(queueName, jobId).catch(() => {});
  }).catch(() => {});
};

export const createRuntimeJobEnqueuer = (options: {
  connectionString: string;
  schema?: string;
  timeoutMs?: number;
}): RuntimeJobEnqueuer => {
  return async (queueName, payload, enqueueOptions = {}) => {
    const timeoutMs = enqueueOptions.timeoutMs ?? options.timeoutMs;
    const signal = composeAbortSignal(enqueueOptions.signal, timeoutMs);
    const jobId = randomUUID();
    const bossOptions = {
      connectionString: options.connectionString,
      ...(options.schema ? { schema: options.schema } : {}),
      ...(timeoutMs !== undefined ? { timeoutMs } : {}),
      ...(signal ? { signal } : {}),
    };

    try {
      await withBoss(bossOptions, async (boss, activeSignal, abort) => {
        await runAbortable(
          activeSignal,
          async () => {
            await boss.createQueue(queueName).catch(() => {});
          },
          abort,
        );
        throwIfAborted(activeSignal);

        const insertedJobId = await runAbortable(
          activeSignal,
          async () =>
            await boss.send(queueName, payload, {
              id: jobId,
            }),
          abort,
        );
        throwIfAborted(activeSignal);

        if (!insertedJobId) {
          throw new Error(`pg-boss did not return a job id for ${queueName}`);
        }
      });
    } catch (error) {
      if (
        signal?.aborted ||
        (error instanceof Error && error.message === JOB_ENQUEUE_TIMEOUT_MESSAGE)
      ) {
        await deleteJobBestEffort(options, queueName, jobId);
        throw toAbortError(signal);
      }

      throw error;
    }

    return {
      jobId,
      rollback: async () => {
        await deleteJobBestEffort(options, queueName, jobId);
      },
    };
  };
};
