import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createState } from '@polyphony/state';
import { createSqliteAdapter } from '@polyphony/state/adapters/sqlite';
import { Agenda, type JobParameters } from 'agenda';
import { Repository, limits, migrations, required } from './repository.js';

export async function open(path: string) {
  const adapter = required(
    await createSqliteAdapter({ path, migrations }, limits()),
  );
  const storage = createState(adapter, (scope) => scope);
  required(await storage.migrate(limits()));
  return { storage, repository: new Repository(storage) };
}
export async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'queue-agenda-probe-'));
  const path = join(directory, 'queue.db');
  const root = await open(path);
  return {
    ...root,
    path,
    cleanup: async () => {
      required(await root.storage.close());
      await rm(directory, { recursive: true, force: true });
    },
  };
}
export function worker(
  repository: Repository,
  handler: (job: JobParameters, signal: AbortSignal) => Promise<number>,
  stopTimeoutMs = 2_000,
) {
  const abort = new AbortController();
  const active = new Set<Promise<void>>();
  // Agenda may remove a job from its running list before Job.run finally enters
  // saveJobState. Track that whole public repository lifecycle, including the gap.
  const deliveries = new Set<string>();
  let changed = Promise.withResolvers<void>();
  let sealed = false;
  const notify = () => {
    changed.resolve();
    changed = Promise.withResolvers<void>();
  };
  const errors: Error[] = [];
  // Resource accounting, not a second worker/scheduler: drain public repository calls
  // already accepted by Agenda before its poll interval was stopped.
  const pending = new Set<Promise<unknown>>();
  function track<T>(promise: Promise<T>): Promise<T> {
    pending.add(promise);
    void promise.then(
      () => {
        pending.delete(promise);
        notify();
      },
      () => {
        pending.delete(promise);
        notify();
      },
    );
    return promise;
  }
  const next = repository.getNextJobToRun.bind(repository);
  repository.getNextJobToRun = (...args) =>
    sealed ? Promise.resolve(undefined) : track(next(...args));
  const save = repository.saveJobState.bind(repository);
  repository.saveJobState = (job) => {
    if (sealed) return Promise.reject(new Error('Repository admission closed'));
    const finalizing = !job.lockedAt;
    const beginning = Boolean(
      job._id && !finalizing && !deliveries.has(job._id),
    );
    if (job._id && !finalizing) deliveries.add(job._id);
    return track(
      (async () => {
        try {
          await save(job);
        } catch (error) {
          // The first save in Agenda Job.run is BEFORE its try/finally. Rejection
          // there never gets a terminal save and never enters the handler.
          if (job._id && beginning) deliveries.delete(job._id);
          throw error;
        } finally {
          if (job._id && finalizing) deliveries.delete(job._id);
          notify();
        }
      })(),
    );
  };
  const unlock = repository.unlockJob.bind(repository);
  repository.unlockJob = (...args) =>
    sealed ? Promise.resolve() : track(unlock(...args));
  const unlockMany = repository.unlockJobs.bind(repository);
  repository.unlockJobs = (...args) =>
    sealed ? Promise.resolve() : track(unlockMany(...args));
  const agenda = new Agenda({
    backend: {
      name: 'state-probe',
      repository,
      ownsConnection: false,
      connect: () => repository.connect(),
      disconnect: async () => {
        throw new Error('Agenda must not close state');
      },
    },
    processEvery: 40,
    defaultLockLifetime: 2_000,
    lockLimit: 1,
    defaultLockLimit: 1,
    defaultConcurrency: 1,
    maxConcurrency: 1,
    removeOnComplete: false,
  });
  agenda.on('error', (error: Error) => errors.push(error));
  agenda.define(
    'work',
    async (job) => {
      const execution = (async () => {
        if (abort.signal.aborted) throw new Error('stopping');
        const value = await handler(job.attrs, abort.signal);
        if (abort.signal.aborted) throw new Error('stopping');
        await repository.complete(job.attrs, value);
      })();
      active.add(execution);
      try {
        await execution;
      } finally {
        active.delete(execution);
        notify();
      }
    },
    { backoff: () => 20 },
  );
  return {
    agenda,
    errors,
    start: () => agenda.start(),
    stop: async () => {
      repository.accepting = false;
      const drained = agenda.drain({
        timeout: stopTimeoutMs,
        closeConnection: false,
      });
      abort.abort();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        // Bounds the wait, NOT the callback. A rejected stop does not permit closing
        // storage. The actual callbacks remain tracked and must settle before retry.
        await Promise.race([
          (async () => {
            const result = await drained;
            if (result.timedOut || result.aborted)
              throw new Error('Agenda drain incomplete');
            await agenda.stop(false);
            while (active.size || pending.size || deliveries.size)
              await changed.promise;
            // No future library continuation can start I/O after successful stop.
            sealed = true;
          })(),
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(
              () => reject(new Error('Stop incomplete; keep storage open')),
              stopTimeoutMs,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
export function enqueue(
  repository: Repository,
  id = 'a',
  maxAttempts = 2,
  value = 4,
  nextRunAt = new Date(0),
) {
  return repository.saveJob({
    name: 'work',
    type: 'normal',
    priority: 0,
    nextRunAt,
    data: { id, value, maxAttempts },
  });
}
