import { readFile } from 'node:fs/promises';
import type {
  SqlMigration,
  SqlScope,
  SqlValue,
} from '@polyphony/state/adapters/sqlite';
import { and, asc, eq, isNull, lte, or } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import type { QueueScope, StoredJob } from '../ports.js';
import { jobs } from './schema.js';

function parameter(value: unknown): SqlValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    value instanceof Uint8Array
  )
    return value;
  throw new TypeError('Invalid SQL parameter');
}
function row(value: typeof jobs.$inferSelect | undefined): unknown | undefined {
  if (!value) return undefined;
  try {
    const body = JSON.parse(value.body) as StoredJob;
    if (
      body.namespace !== value.namespace ||
      body.id !== value.id ||
      body.name !== value.name ||
      body.version !== value.version ||
      body.status !== value.status ||
      body.notBefore !== value.notBefore ||
      (body.lease?.lockedAt ?? null) !== value.lockedAt
    )
      return null;
    return body;
  } catch {
    return null;
  } // Core treats invalid rows as corrupt, not absent.
}
export function bindQueueScope(scope: SqlScope): QueueScope {
  const db = drizzle(async (sql, params: unknown[], method) => {
    const values = params.map(parameter);
    if (method === 'run') {
      await scope.run(sql, values);
      return { rows: [] };
    }
    const rows = await scope.all(sql, values);
    // Drizzle 0.45.3's get returns one positional row or undefined; the callback
    // declaration incorrectly requires any[] for the missing-row case (state precedent).
    return { rows: method === 'get' ? (rows[0] as SqlValue[]) : rows };
  });
  return {
    get: async (namespace, id) =>
      row(
        await db
          .select()
          .from(jobs)
          .where(and(eq(jobs.namespace, namespace), eq(jobs.id, id)))
          .get(),
      ),
    put: async (job) => {
      const values = {
        namespace: job.namespace,
        id: job.id,
        name: job.name,
        version: job.version,
        status: job.status,
        notBefore: job.notBefore,
        lockedAt: job.lease?.lockedAt ?? null,
        body: JSON.stringify(job),
      };
      await db
        .insert(jobs)
        .values(values)
        .onConflictDoUpdate({ target: [jobs.namespace, jobs.id], set: values });
    },
    candidate: async (namespace, name, version, through, lockDeadline) =>
      row(
        await db
          .select()
          .from(jobs)
          .where(
            and(
              eq(jobs.namespace, namespace),
              eq(jobs.name, name),
              eq(jobs.version, version),
              or(
                and(
                  eq(jobs.status, 'pending'),
                  lte(jobs.notBefore, through),
                  or(isNull(jobs.lockedAt), lte(jobs.lockedAt, lockDeadline)),
                ),
                and(
                  eq(jobs.status, 'running'),
                  lte(jobs.lockedAt, lockDeadline),
                ),
              ),
            ),
          )
          .orderBy(asc(jobs.notBefore), asc(jobs.id))
          .get(),
      ),
  };
}
export async function loadQueueMigrations(): Promise<readonly SqlMigration[]> {
  return [
    {
      id: 'queue_0000',
      sql: await readFile(
        new URL('./migrations/0000_queue.sql', import.meta.url),
        'utf8',
      ),
    },
  ];
}
