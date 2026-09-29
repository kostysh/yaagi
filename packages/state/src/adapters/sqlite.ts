import type { Result } from '@polyphony/core-types';
import { z } from 'zod';
import type {
  OperationOptions,
  StorageAdapter,
  StorageFailure,
} from '../contracts.js';
import { Budget } from '../internal/budget.js';
import { coreFailure } from '../internal/errors.js';

export type SqlValue = null | string | number | bigint | Uint8Array;
export interface SqlScope {
  all(sql: string, params?: readonly SqlValue[]): Promise<SqlValue[][]>;
  run(
    sql: string,
    params?: readonly SqlValue[],
  ): Promise<{ changes: number; lastInsertRowid: bigint }>;
}
export type SqlMigration = { readonly id: string; readonly sql: string };
export interface SqliteAdapter extends StorageAdapter<SqlScope> {
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
export async function createSqliteAdapter(
  config: {
    readonly path: string;
    readonly migrations: readonly SqlMigration[];
  },
  options: OperationOptions,
): Promise<Result<SqliteAdapter, StorageFailure>> {
  try {
    const budget = new Budget(options);
    const parsed = Configuration.safeParse(config);
    if (!parsed.success)
      return { ok: false, error: { kind: 'storage', code: 'incompatible' } };
    // Import alone neither loads Node/native code nor opens a file.
    const { openAdapter } = await import('./sqlite/adapter.js');
    return await openAdapter(parsed.data, budget);
  } catch (error) {
    return { ok: false, error: coreFailure(error) };
  }
}
