import type { Result } from '@polyphony/core-types';
import type {
  OperationOptions,
  OwnerFailure,
  StorageFailure,
  StoragePort,
} from '@polyphony/state/contracts';
import type { FixtureOwners } from './m1-consumer.js';

// Test-only copy-on-write port. Not a second production backend or durability model.
export class MemoryPort implements StoragePort<FixtureOwners> {
  #data = { alpha: 0, beta: '' };
  #closed = false;
  #active = false;
  async close(): Promise<Result<void, StorageFailure>> {
    if (this.#active)
      return { ok: false, error: { kind: 'storage', code: 'busy' } };
    this.#closed = true;
    return { ok: true, value: undefined };
  }
  async checkSchema(): Promise<
    Result<{ applied: number; pending: number }, StorageFailure>
  > {
    return { ok: true, value: { applied: 0, pending: 0 } };
  }
  async readSnapshot<T>(
    read: (owners: FixtureOwners) => Promise<T>,
    options: OperationOptions,
  ): Promise<Result<T, StorageFailure>> {
    const result = await this.#scope(
      false,
      async (owners) => ({ ok: true, value: await read(owners) }) as const,
      options,
    );
    if (result.ok) return result;
    return {
      ok: false,
      error:
        result.error.kind === 'storage'
          ? result.error
          : { kind: 'storage', code: 'callback_failed' },
    };
  }
  transact<T, E>(
    write: (owners: FixtureOwners) => Promise<Result<T, E>>,
    options: OperationOptions,
  ): Promise<Result<T, StorageFailure | OwnerFailure<E>>> {
    return this.#scope(true, write, options);
  }
  async #scope<T, E>(
    write: boolean,
    callback: (owners: FixtureOwners) => Promise<Result<T, E>>,
    options: OperationOptions,
  ): Promise<Result<T, StorageFailure | OwnerFailure<E>>> {
    const fail = (
      code: StorageFailure['code'],
    ): Result<never, StorageFailure> => ({
      ok: false,
      error: { kind: 'storage', code },
    });
    if (this.#closed) return fail('closed');
    if (this.#active) return fail('busy');
    if (options.signal.aborted) return fail('cancelled');
    if (options.timeoutMs <= 0) return fail('deadline');
    const end = Date.now() + options.timeoutMs;
    this.#active = true;
    let live = true;
    const draft = { ...this.#data };
    const check = () => {
      if (!live) throw new Error('scope_ended');
    };
    const owners: FixtureOwners = {
      alpha: {
        read: async () => {
          check();
          return draft.alpha;
        },
        write: async (value) => {
          check();
          if (!write) throw new Error('read-only');
          draft.alpha = value;
        },
      },
      beta: {
        read: async () => {
          check();
          return draft.beta;
        },
        write: async (value) => {
          check();
          if (!write) throw new Error('read-only');
          draft.beta = value;
        },
      },
    };
    try {
      const result = await callback(owners);
      if (options.signal.aborted) return fail('cancelled');
      if (Date.now() >= end) return fail('deadline');
      if (!result.ok)
        return { ok: false, error: { kind: 'owner', error: result.error } };
      if (write) this.#data = draft;
      return result;
    } catch {
      return fail('callback_failed');
    } finally {
      live = false;
      this.#active = false;
    }
  }
}
