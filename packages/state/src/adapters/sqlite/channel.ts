import { Worker } from 'node:worker_threads';
import type { Result } from '@polyphony/core-types';
import type { StorageFailure } from '../../contracts.js';
import type { Budget } from '../../internal/budget.js';
import { failure, coreFailure } from '../../internal/errors.js';
import type { Command, Payload, Reply, Start } from './protocol.js';

type Response = Result<Payload, StorageFailure>;
// Correlates messages only. Every call is posted immediately: no task queue/pool/replay.
export class Channel {
  readonly done: Promise<void>;
  readonly ready: Promise<Response>;
  readonly #worker: Worker;
  readonly #pending = new Map<number, (response: Response) => void>();
  #sequence = 0;
  #exited = false;
  constructor(start: Omit<Start, 'cancelled'>, budget: Budget) {
    const cancelled = new SharedArrayBuffer(4);
    const signal = budget.options().signal;
    const abort = () => Atomics.store(new Int32Array(cancelled), 0, 1);
    if (signal.aborted) abort();
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    try {
      this.#worker = new Worker(new URL('./worker.js', import.meta.url), {
        workerData: { ...start, cancelled } satisfies Start,
      });
    } catch (error) {
      signal.removeEventListener('abort', abort);
      throw error;
    }
    this.ready = new Promise((resolve) => this.#pending.set(0, resolve));
    this.done = new Promise((resolve) => {
      this.#worker.once('exit', () => {
        this.#exited = true;
        this.#failPending();
        signal.removeEventListener('abort', abort);
        resolve();
      });
    });
    this.#worker.on('error', () => this.#failPending());
    this.#worker.on('message', (reply: Reply) => {
      this.#pending.get(reply.id)?.(reply.result);
      this.#pending.delete(reply.id);
    });
  }
  #failPending(): void {
    for (const resolve of this.#pending.values())
      resolve({ ok: false, error: failure('unavailable') });
    this.#pending.clear();
  }
  request(
    command:
      | Omit<Extract<Command, { kind: 'all' | 'run' }>, 'id'>
      | Omit<Extract<Command, { kind: 'finish' }>, 'id'>,
  ): Promise<Response> {
    if (this.#exited)
      return Promise.resolve({ ok: false, error: failure('unavailable') });
    const id = ++this.#sequence;
    return new Promise((resolve) => {
      this.#pending.set(id, resolve);
      try {
        this.#worker.postMessage({ ...command, id } satisfies Command);
      } catch (error) {
        this.#pending.delete(id);
        resolve({ ok: false, error: coreFailure(error) });
      }
    });
  }
}
