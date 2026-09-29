import type { Result } from '@polyphony/core-types';
import { z } from 'zod';
import type {
  OperationOptions,
  StorageFailure,
  StoragePort,
} from './contracts.js';
import { Budget } from './internal/budget.js';
import { safeFailure } from './internal/errors.js';
import type { SqlMigration, SqlScope } from './sqlite.js';

export interface SqliteState extends StoragePort<SqlScope> {
  migrate(options: OperationOptions): Promise<Result<void, StorageFailure>>;
  backupTo(
    path: string,
    options: OperationOptions,
  ): Promise<Result<void, StorageFailure>>;
}

const Configuration = z.object({
  path: z
    .string()
    .min(1)
    .refine((path) => path !== ':memory:' && !path.includes('\0')),
  migrations: z
    .array(z.object({ id: z.string().min(1), sql: z.string().min(1) }))
    .refine(
      (chain) => new Set(chain.map((unit) => unit.id)).size === chain.length,
    ),
});

export async function openSqlite(
  options: {
    readonly path: string;
    readonly migrations: readonly SqlMigration[];
  },
  limits: OperationOptions,
): Promise<Result<SqliteState, StorageFailure>> {
  try {
    const budget = new Budget(limits);
    const config = Configuration.safeParse(options);
    if (!config.success)
      return { ok: false, error: { kind: 'storage', code: 'incompatible' } };
    // Importing any public entrypoint alone never loads SQLite or the extension.
    const { openStore } = await import('./internal/store.js');
    budget.check();
    return { ok: true, value: openStore(config.data, budget) };
  } catch (error) {
    return { ok: false, error: safeFailure(error) };
  }
}
