import { performance } from 'node:perf_hooks';
import { z } from 'zod';
import type { OperationOptions } from '../contracts.js';
import { StorageError } from './errors.js';

const Limits = z.object({
  // Keep the original signal: object parsing would snapshot its aborted getter.
  signal: z.custom<OperationOptions['signal']>(
    (value) =>
      value !== null &&
      typeof value === 'object' &&
      'aborted' in value &&
      typeof value.aborted === 'boolean',
  ),
  timeoutMs: z.number().finite().nonnegative(),
});

export class Budget {
  readonly #signal: OperationOptions['signal'];
  readonly #end: number;
  constructor(options: OperationOptions) {
    const parsed = Limits.safeParse(options);
    if (!parsed.success) throw new StorageError('incompatible');
    this.#signal = parsed.data.signal;
    this.#end = performance.now() + parsed.data.timeoutMs;
    this.check();
  }
  check(): void {
    if (this.#signal.aborted) throw new StorageError('cancelled');
    if (performance.now() >= this.#end) throw new StorageError('deadline');
  }
  busyMs(): number {
    this.check();
    return Math.max(0, Math.min(40, Math.floor(this.#end - performance.now())));
  }
}
