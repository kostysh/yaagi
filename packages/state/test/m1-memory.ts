import type { Result } from '@polyphony/core-types';
import type {
  OperationOptions,
  StorageAdapter,
  StorageFailure,
  StorageSession,
} from '@polyphony/state/contracts';

export interface MemoryScope {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}
// Test-only copy-on-write backend: no StoragePort and no execution of callbacks.
// M1 proves neither durability nor native concurrent writers of this double.
export class MemoryAdapter implements StorageAdapter<MemoryScope> {
  #data = new Map<string, unknown>([
    ['alpha', 0],
    ['beta', ''],
  ]);
  #closed = false;
  async begin(
    mode: 'snapshot' | 'transaction',
    options: OperationOptions,
  ): Promise<Result<StorageSession<MemoryScope>, StorageFailure>> {
    if (this.#closed)
      return { ok: false, error: { kind: 'storage', code: 'closed' } };
    const data = new Map(this.#data);
    let live = true;
    let poison: StorageFailure | undefined;
    const end = performance.now() + options.timeoutMs;
    const check = () => {
      if (!live) throw new Error('scope_ended');
      if (options.signal.aborted)
        poison ??= { kind: 'storage', code: 'cancelled' };
      if (performance.now() >= end)
        poison ??= { kind: 'storage', code: 'deadline' };
      if (poison) throw new Error(poison.code);
    };
    return {
      ok: true,
      value: {
        scope: {
          get: (key) => {
            check();
            return data.get(key);
          },
          set: (key, value) => {
            check();
            if (mode === 'snapshot') {
              poison = { kind: 'storage', code: 'write_failed' };
              throw new Error(poison.code);
            }
            data.set(key, value);
          },
        },
        get failure() {
          return poison;
        },
        finish: async (outcome) => {
          if (outcome === 'commit') {
            try {
              check();
            } catch {
              /* preserved poison */
            }
          }
          live = false;
          if (poison) return { ok: false, error: poison };
          if (outcome === 'commit' && mode === 'transaction') this.#data = data;
          return { ok: true, value: undefined };
        },
      },
    };
  }
  async checkSchema() {
    return { ok: true, value: { applied: 1, pending: 0 } } as const;
  }
  async migrate() {
    return { ok: true, value: undefined } as const;
  }
  async close() {
    this.#closed = true;
    return { ok: true, value: undefined } as const;
  }
}
