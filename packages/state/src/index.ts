import type { Result } from '@polyphony/core-types';
import type {
  OperationOptions,
  OwnerFailure,
  StorageAdapter,
  StorageFailure,
  StoragePort,
} from './contracts.js';
import { Budget } from './internal/budget.js';
import { coreFailure, StorageError } from './internal/errors.js';

export function createState<S, O>(
  adapter: StorageAdapter<S>,
  bind: (scope: S) => O,
): StoragePort<O> {
  let closing: Promise<Result<void, StorageFailure>> | undefined;
  const active = new Set<Promise<unknown>>();
  function admitted<T, E>(
    options: OperationOptions,
    action: (budget: Budget) => Promise<Result<T, E | StorageFailure>>,
  ): Promise<Result<T, E | StorageFailure>> {
    const operation = (async (): Promise<Result<T, E | StorageFailure>> => {
      try {
        const budget = new Budget(options);
        if (closing) throw new StorageError('closed');
        return await action(budget);
      } catch (error) {
        return { ok: false, error: coreFailure(error) };
      }
    })();
    // Resource accounting for close, not admission control or a queue.
    active.add(operation);
    void operation.then(() => active.delete(operation));
    return operation;
  }
  async function scoped<T, E>(
    mode: 'snapshot' | 'transaction',
    callback: (scope: O) => Promise<Result<T, E>>,
    budget: Budget,
  ): Promise<Result<T, StorageFailure | OwnerFailure<E>>> {
    const started = await adapter.begin(mode, budget.options());
    if (!started.ok) return started;
    const session = started.value;
    let result: Result<T, StorageFailure | OwnerFailure<E>>;
    try {
      budget.check();
      let owner: Result<T, E>;
      try {
        owner = await callback(bind(session.scope));
      } catch {
        throw new StorageError(session.failure?.code ?? 'callback_failed');
      }
      if (session.failure) throw new StorageError(session.failure.code);
      budget.check();
      result = owner.ok
        ? owner
        : { ok: false, error: { kind: 'owner', error: owner.error } };
    } catch (error) {
      result = { ok: false, error: session.failure ?? coreFailure(error) };
    }
    // Finish waits for already-submitted operations and always ends the scope.
    const ended = await session.finish(result.ok ? 'commit' : 'rollback');
    if (!ended.ok) return ended;
    return result;
  }
  return Object.freeze({
    readSnapshot: <T>(
      read: (scope: O) => Promise<T>,
      options: OperationOptions,
    ) =>
      admitted<T, never>(options, async (budget) => {
        const result = await scoped<T, never>(
          'snapshot',
          async (scope) => ({ ok: true, value: await read(scope) }),
          budget,
        );
        if (result.ok) return result;
        if (result.error.kind === 'owner')
          throw new StorageError('operation_failed');
        return { ok: false, error: result.error };
      }),
    transact: <T, E>(
      write: (scope: O) => Promise<Result<T, E>>,
      options: OperationOptions,
    ) =>
      admitted<T, OwnerFailure<E>>(options, (budget) =>
        scoped('transaction', write, budget),
      ),
    checkSchema: (options: OperationOptions) =>
      admitted(options, (budget) => adapter.checkSchema(budget.options())),
    migrate: (options: OperationOptions) =>
      admitted(options, (budget) => adapter.migrate(budget.options())),
    close: () => {
      closing ??= (async () => {
        await Promise.all(active);
        try {
          return await adapter.close();
        } catch (error) {
          return { ok: false, error: coreFailure(error) } as const;
        }
      })();
      return closing;
    },
  });
}
