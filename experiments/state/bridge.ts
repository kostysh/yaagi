import { drizzle } from 'drizzle-orm/sqlite-proxy';
import type { SqlScope, SqlValue } from './sqlite.js';

function parameter(value: unknown): SqlValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    value instanceof Uint8Array
  )
    return value;
  throw new TypeError('Unsupported SQL parameter');
}

export function ownerDb(scope: SqlScope) {
  const db = drizzle(async (sql, params: unknown[], method) => {
    const values = params.map(parameter);
    if (method === 'run') {
      scope.run(sql, values);
      return { rows: [] };
    }
    const rows = scope.all(sql, values);
    // Proxy get expects one positional row, not an array containing that row.
    // For no row the upstream runtime expects undefined despite its any[] declaration.
    return { rows: method === 'get' ? (rows[0] as SqlValue[]) : rows };
  });
  // No transaction/commit/batch or underlying client on the owner's surface.
  return {
    select: db.select.bind(db),
    insert: db.insert.bind(db),
    update: db.update.bind(db),
    delete: db.delete.bind(db),
  };
}
