import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Result } from '@polyphony/core-types';
import { createState } from '@polyphony/state';
import { createSqliteAdapter } from '@polyphony/state/adapters/sqlite';
import { eq } from 'drizzle-orm';
import { Note, notes, ownerDb, vector, writeOwners } from './owners.js';

function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error('Example operation failed');
  return result.value;
}

export async function example(): Promise<void> {
  // Temporary private directory for this example; the composition root owns real paths.
  const dir = mkdtempSync(join(tmpdir(), 'state-guide-'));
  const path = join(dir, 'state.db');
  const migrations = [
    '0000_initial',
    '0001_tag',
    '0002_vectors_and_transform',
  ].map((id) => ({
    id,
    sql: readFileSync(
      new URL(`../../test/migrations/${id}.sql`, import.meta.url),
      'utf8',
    ),
  }));
  const abort = new AbortController();
  // Example-only policy budget, not a default chosen by state.
  const limits = () => ({ signal: abort.signal, timeoutMs: 5_000 });
  try {
    const adapter = unwrap(
      await createSqliteAdapter({ path, migrations }, limits()),
    );
    const state = createState(adapter, (scope) => scope);
    try {
      unwrap(await state.migrate(limits()));
      unwrap(
        await state.transact(async (scope) => {
          await writeOwners(scope); // Both owners use Drizzle; vec0 uses the SAME scope.
          return { ok: true, value: undefined };
        }, limits()),
      );
      const result = await state.readSnapshot(async (scope) => {
        const row = await ownerDb(scope)
          .select()
          .from(notes)
          .where(eq(notes.id, 'n'))
          .get();
        return {
          note: Note.parse(row),
          nearest: await scope.all(
            'SELECT rowid,distance FROM fixture_vectors WHERE embedding MATCH ? AND k=?',
            [vector, 1n],
          ),
        };
      }, limits());
      if (!result.ok) throw new Error(`Storage: ${result.error.code}`);
      assert.equal(result.value.note.text, 'fixture');
      assert.deepEqual(result.value.nearest, [[1, 0]]);
      // No model/network call while a scope is live: only detached DTOs escape.
      const denied = await state.transact(async (scope) => {
        await scope.run("UPDATE fixture_notes SET text='discard'");
        return { ok: false, error: 'owner-conflict' };
      }, limits());
      assert.deepEqual(denied, {
        ok: false,
        error: { kind: 'owner', error: 'owner-conflict' },
      });
      unwrap(await adapter.backupTo(join(dir, 'backup.db'), limits()));
    } finally {
      unwrap(await state.close());
    }
    const reopened = createState(
      unwrap(await createSqliteAdapter({ path, migrations }, limits())),
      (scope) => scope,
    );
    try {
      const rows = unwrap(
        await reopened.readSnapshot(
          async (scope) => await scope.all('SELECT text FROM fixture_notes'),
          limits(),
        ),
      );
      assert.deepEqual(rows, [['fixture']]);
      abort.abort();
      assert.deepEqual(await reopened.checkSchema(limits()), {
        ok: false,
        error: { kind: 'storage', code: 'cancelled' },
      });
    } finally {
      unwrap(await reopened.close());
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await example();
  console.log(
    'state guide: commit, vector query, rollback, backup and reopen passed',
  );
}
