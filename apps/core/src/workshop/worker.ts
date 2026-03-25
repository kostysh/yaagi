import type { CoreRuntimeConfig } from '../platform/core-config.ts';
import { PgBoss } from '@yaagi/db';
import { WORKSHOP_JOB_QUEUE, type WorkshopJobEnvelope } from '@yaagi/contracts/workshop';
import {
  createDbBackedWorkshopService,
  runWorkshopJobEnvelope,
  type WorkshopService,
} from './service.ts';

type WorkshopQueueBoss = {
  start: () => Promise<unknown>;
  createQueue: (...args: Parameters<PgBoss['createQueue']>) => Promise<unknown>;
  work: (...args: Parameters<PgBoss['work']>) => Promise<unknown>;
  offWork: (...args: Parameters<PgBoss['offWork']>) => Promise<unknown>;
  stop: (...args: Parameters<PgBoss['stop']>) => Promise<unknown>;
};

type WorkshopWorkerOptions = {
  createBoss?: () => WorkshopQueueBoss;
};

export type WorkshopWorker = {
  start(): Promise<void>;
  stop(): Promise<void>;
};

const WORKSHOP_QUEUE_NAMES = Object.values(WORKSHOP_JOB_QUEUE);

export const createWorkshopWorker = (
  config: CoreRuntimeConfig,
  service: WorkshopService = createDbBackedWorkshopService(config),
  options: WorkshopWorkerOptions = {},
): WorkshopWorker => {
  const boss =
    options.createBoss?.() ??
    new PgBoss({
      connectionString: config.postgresUrl,
      schema: config.pgBossSchema,
      supervise: false,
      schedule: false,
      migrate: true,
    });

  let started = false;

  const cleanup = async (): Promise<void> => {
    for (const queueName of WORKSHOP_QUEUE_NAMES) {
      await boss.offWork(queueName).catch(() => {});
    }
    await boss.stop({ graceful: true, timeout: 1_000 }).catch(() => {});
    started = false;
  };

  return {
    async start(): Promise<void> {
      if (started) {
        return;
      }

      try {
        await boss.start();
        for (const queueName of WORKSHOP_QUEUE_NAMES) {
          await boss.createQueue(queueName).catch(() => {});
        }
        for (const queueName of WORKSHOP_QUEUE_NAMES) {
          await boss.work<WorkshopJobEnvelope>(queueName, async (jobs) => {
            for (const job of jobs) {
              if (!job.data) {
                continue;
              }

              await runWorkshopJobEnvelope(service, job.data);
            }
          });
        }
        started = true;
      } catch (error) {
        await cleanup();
        throw error;
      }
    },

    async stop(): Promise<void> {
      await cleanup();
    },
  };
};
