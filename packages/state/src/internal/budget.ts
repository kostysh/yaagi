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
      typeof value.aborted === 'boolean' &&
      'addEventListener' in value &&
      typeof value.addEventListener === 'function' &&
      'removeEventListener' in value &&
      typeof value.removeEventListener === 'function',
  ),
  timeoutMs: z.number().finite().nonnegative(),
});

export class Budget {
  readonly #signal: OperationOptions['signal'];
  readonly #end: number;
  constructor(options: OperationOptions, end?: number) {
    const parsed = Limits.safeParse(options);
    if (!parsed.success) throw new StorageError('incompatible');
    this.#signal = parsed.data.signal;
    this.#end =
      end ?? performance.timeOrigin + performance.now() + parsed.data.timeoutMs;
    this.check();
  }
  check(): void {
    if (this.#signal.aborted) throw new StorageError('cancelled');
    if (performance.timeOrigin + performance.now() >= this.#end)
      throw new StorageError('deadline');
  }
  get end(): number {
    return this.#end;
  }
  options(): OperationOptions {
    this.check();
    return {
      signal: this.#signal,
      timeoutMs: Math.max(
        0,
        this.#end - performance.timeOrigin - performance.now(),
      ),
    };
  }
}
