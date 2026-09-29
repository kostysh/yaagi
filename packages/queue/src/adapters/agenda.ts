import type { Result } from '@polyphony/core-types';
import type { OperationOptions } from '@polyphony/state/contracts';
import {
  Agenda,
  toJobId,
  type Job,
  type JobId,
  type JobParameters,
  type JobRepository,
  type JobsOverview,
  type JobsQueryOptions,
  type JobsResult,
} from 'agenda';
import type { QueueFailure } from '../contracts.js';
import type { AdapterInput, Delivery, QueueAdapter } from '../ports.js';
import {
  Budget,
  duration,
  fail,
  ok,
  QueueError,
  unwrap,
  within,
} from '../internal/model.js';

export function createAgendaAdapter(input: {
  pollIntervalMs: number;
  leaseMs: number;
}): Result<QueueAdapter, QueueFailure> {
  if (
    !input ||
    !duration.safeParse(input.pollIntervalMs).success ||
    !duration.safeParse(input.leaseMs).success
  )
    return fail('invalid');
  const options = { ...input };
  let runtime: Runtime | undefined;
  return ok({
    start: async (config) => {
      if (runtime && !runtime.sealed) return fail('already_running');
      runtime = new Runtime(config, options);
      try {
        await runtime.agenda.start();
        return ok(undefined);
      } catch {
        runtime.error('adapter');
        return fail('adapter');
      }
    },
    stop: async (limits) => (runtime ? runtime.stop(limits) : ok(undefined)),
  });
}

type Entry = {
  delivery: Delivery;
  begun: boolean;
  controller: AbortController;
};
const identity = (delivery: Delivery): string =>
  JSON.stringify([delivery.id, delivery.token]);
const jobName = (name: string, version: number): string =>
  JSON.stringify([name, version]);
function unsupported(): never {
  throw new QueueError('adapter');
}

class Runtime {
  readonly agenda: Agenda;
  readonly entries = new Map<string, Entry>();
  readonly lifecycles = new Set<string>();
  readonly pending = new Set<Promise<unknown>>();
  readonly active = new Set<Promise<void>>();
  accepting = true;
  sealed = false;
  private changed = Promise.withResolvers<void>();
  private draining: Promise<void> | undefined;

  constructor(
    readonly input: AdapterInput,
    options: { pollIntervalMs: number; leaseMs: number },
  ) {
    const repository = new Repository(this);
    this.agenda = new Agenda({
      backend: {
        name: 'polyphony-state',
        repository,
        ownsConnection: false,
        connect: async () => {},
        disconnect: async () => {
          unsupported();
        },
      },
      processEvery: options.pollIntervalMs,
      defaultLockLifetime: options.leaseMs,
      lockLimit: input.concurrency,
      defaultLockLimit: input.concurrency,
      maxConcurrency: input.concurrency,
      defaultConcurrency: input.concurrency,
      removeOnComplete: false,
    });
    this.agenda.on('error', () => {
      if (this.accepting) this.error('adapter');
    });
    for (const type of input.types) {
      this.agenda.define(jobName(type.name, type.version), async (job) => {
        const execution = this.execute(job, options.leaseMs);
        this.active.add(execution);
        try {
          await execution;
        } finally {
          this.active.delete(execution);
          this.notify();
        }
      });
    }
  }

  notify(): void {
    this.changed.resolve();
    this.changed = Promise.withResolvers<void>();
  }
  error(code: QueueFailure['code']): void {
    if (this.sealed) return;
    this.accepting = false;
    for (const entry of this.entries.values()) entry.controller.abort();
    this.input.onError({ code });
  }
  track<T>(action: () => Promise<T>): Promise<T> {
    const work = action();
    this.pending.add(work);
    void work.then(
      () => {
        this.pending.delete(work);
        this.notify();
      },
      () => {
        this.pending.delete(work);
        this.notify();
      },
    );
    return work;
  }
  async execute(job: Job, leaseMs: number): Promise<void> {
    const entry = this.entries.get(String(job.attrs._id));
    if (!entry || this.sealed) throw new QueueError('stopping');
    if (!this.accepting) entry.controller.abort();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: Promise<void> | undefined;
    let executing = true;
    const tick = () => {
      timer = setTimeout(
        () => {
          if (!executing || entry.controller.signal.aborted) return;
          heartbeat = job
            .touch()
            .then(
              () => {},
              (failure: unknown) => {
                // Completion can win a transaction concurrently with the final touch.
                // Once execute has settled, its own durable outcome is authoritative.
                if (
                  !executing &&
                  failure instanceof QueueError &&
                  failure.code === 'conflict'
                )
                  return;
                entry.controller.abort();
                this.error(
                  failure instanceof QueueError ? failure.code : 'storage',
                );
              },
            )
            .finally(() => {
              if (executing && !entry.controller.signal.aborted) tick();
            });
        },
        Math.max(1, Math.floor(leaseMs / 3)),
      );
    };
    tick();
    try {
      await this.input.execute(entry.delivery, entry.controller.signal);
    } finally {
      executing = false;
      clearTimeout(timer);
      await heartbeat;
    }
  }
  async stop(options: OperationOptions): Promise<Result<void, QueueFailure>> {
    let budget: Budget;
    try {
      budget = new Budget(options);
    } catch {
      return fail('stop_incomplete');
    }
    if (this.sealed) return ok(undefined);
    this.accepting = false;
    if (!this.draining) {
      // Drain disables library polling before cancellation. Agenda's own list is
      // insufficient after watchdog expiry; also wait for the whole Job.run seam.
      const drained = this.agenda.drain({
        timeout: budget.options().timeoutMs,
        closeConnection: false,
      });
      for (const entry of this.entries.values()) entry.controller.abort();
      this.draining = (async () => {
        await drained;
        await this.agenda.stop(false);
        while (this.active.size || this.pending.size || this.lifecycles.size)
          await this.changed.promise;
        this.sealed = true;
        this.entries.clear();
      })();
      // A failed stop keeps resources open; a later stop can retry the drain.
      void this.draining.catch(() => {
        this.draining = undefined;
      });
    }
    return (await within(this.draining, budget)) && this.sealed
      ? ok(undefined)
      : fail('stop_incomplete');
  }
}

class Repository implements JobRepository {
  constructor(readonly runtime: Runtime) {}
  async connect(): Promise<void> {}
  private parameters(delivery: Delivery): JobParameters {
    return {
      _id: toJobId(identity(delivery)),
      name: jobName(delivery.name, delivery.version),
      type: 'normal',
      priority: 0,
      data: null,
      nextRunAt: new Date(delivery.notBefore),
      lockedAt: new Date(delivery.lockedAt),
    };
  }
  async getNextJobToRun(
    name: string,
    through: Date,
    deadline: Date,
  ): Promise<JobParameters | undefined> {
    const runtime = this.runtime;
    if (
      !runtime.accepting ||
      runtime.sealed ||
      runtime.lifecycles.size >= runtime.input.concurrency
    )
      return;
    const type = runtime.input.types.find(
      (type) => jobName(type.name, type.version) === name,
    );
    if (!type) unsupported();
    return runtime.track(async () => {
      const reserved = await runtime.input.store.reserve(
        type.name,
        type.version,
        through.getTime(),
        deadline.getTime(),
      );
      if (!reserved.ok) {
        runtime.error(reserved.error.code);
        throw new QueueError(reserved.error.code);
      }
      if (!reserved.value) return;
      const delivery = reserved.value;
      runtime.entries.set(identity(delivery), {
        delivery,
        begun: false,
        controller: new AbortController(),
      });
      return this.parameters(delivery);
    });
  }
  async saveJobState(job: JobParameters): Promise<void> {
    const runtime = this.runtime;
    if (runtime.sealed) throw new QueueError('stopping');
    const id = String(job._id);
    const entry = runtime.entries.get(id);
    if (!entry) throw new QueueError('conflict');
    if (!job.lockedAt) {
      // Core already persisted the outcome. Agenda's terminal save must neither
      // overwrite it nor unlock a newer lease, even if its events claim success.
      runtime.lifecycles.delete(id);
      runtime.entries.delete(id);
      runtime.notify();
      return;
    }
    const beginning = !entry.begun;
    if (beginning) {
      if (
        !runtime.accepting ||
        runtime.lifecycles.size >= runtime.input.concurrency
      )
        throw new QueueError('stopping');
      runtime.lifecycles.add(id);
    }
    return runtime.track(async () => {
      try {
        unwrap(
          await (beginning
            ? runtime.input.store.begin(entry.delivery)
            : runtime.input.store.touch(
                entry.delivery,
                job.lockedAt?.getTime() ?? 0,
              )),
        );
        entry.begun = true;
      } catch (failure) {
        // Initial save is before Job.run's try/finally and has no terminal save.
        if (beginning) runtime.lifecycles.delete(id);
        if (
          !(
            failure instanceof QueueError &&
            failure.code === 'conflict' &&
            !beginning
          )
        )
          runtime.error(
            failure instanceof QueueError ? failure.code : 'storage',
          );
        throw failure;
      } finally {
        runtime.notify();
      }
    });
  }
  async unlockJob(job: JobParameters): Promise<void> {
    if (job._id) await this.unlockJobs([job._id]);
  }
  async unlockJobs(ids: (JobId | string)[]): Promise<void> {
    const runtime = this.runtime;
    if (runtime.sealed) return;
    await runtime.track(async () => {
      for (const id of ids) {
        const entry = runtime.entries.get(String(id));
        if (!entry || entry.begun) continue;
        const released = await runtime.input.store.release(entry.delivery);
        if (!released.ok && released.error.code !== 'conflict')
          runtime.error(released.error.code);
        runtime.entries.delete(String(id));
      }
    });
  }
  async getJobById(id: string): Promise<JobParameters | null> {
    const entry = this.runtime.entries.get(id);
    return entry ? this.parameters(entry.delivery) : null;
  }
  async queryJobs(options?: JobsQueryOptions): Promise<JobsResult> {
    if (!options?.id) unsupported();
    const job = await this.getJobById(options.id);
    return {
      jobs: job ? [{ ...job, _id: toJobId(options.id), state: 'running' }] : [],
      total: job ? 1 : 0,
    };
  }
  // The module uses only polling/processing. No public Agenda management surface,
  // scheduling writer, automatic deletion, or disconnected second source of truth.
  async saveJob<DATA>(): Promise<JobParameters<DATA>> {
    return unsupported();
  }
  async lockJob(): Promise<JobParameters | undefined> {
    return unsupported();
  }
  async getJobsOverview(): Promise<JobsOverview[]> {
    return unsupported();
  }
  async getDistinctJobNames(): Promise<string[]> {
    return unsupported();
  }
  async getQueueSize(): Promise<number> {
    return unsupported();
  }
  async removeJobs(): Promise<number> {
    return unsupported();
  }
  async disableJobs(): Promise<number> {
    return unsupported();
  }
  async enableJobs(): Promise<number> {
    return unsupported();
  }
  async purgeAllJobs(): Promise<number> {
    return unsupported();
  }
}
