import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import {
  type Result,
  parseActionId,
  parseAgentId,
  parseEvidenceRef,
  parseRevision,
  parseTickId,
  parseWallTimeMs,
  parseElapsedMs,
} from '@polyphony/core-types';
import { createState } from '@polyphony/state';
import {
  createSqliteAdapter,
  type SqlMigration,
  type SqliteAdapter,
} from '@polyphony/state/adapters/sqlite';
import {
  bindTimeline,
  loadTimelineMigrations,
} from '@polyphony/timeline/sqlite';
import type { ReserveTickInput } from '@polyphony/timeline/contracts';

export function value<T, E>(result: Result<T, E>): T {
  assert.ok(result.ok, `Expected success: ${JSON.stringify(result)}`);
  return result.value;
}
export const limits = () => ({
  signal: new AbortController().signal,
  timeoutMs: 10_000,
});
export const agent = value(parseAgentId('agent-A'));
export const otherAgent = value(parseAgentId('agent-B'));
export const action = value(parseActionId('action-1'));
export const outcome = value(
  parseEvidenceRef({
    sourceKind: 'technical-unknown',
    id: 'outcome-1',
    revision: 'hash:Exact',
  }),
);
export function reserve(id = 'tick-1'): ReserveTickInput {
  return {
    tickId: value(parseTickId(id)),
    epoch: ' epoch:Exact ',
    wallTime: value(parseWallTimeMs(1000)),
    elapsed: value(parseElapsedMs(5)),
    mode: 'REACTIVE',
    policyRevision: value(parseRevision('Policy A')),
    snapshotRevision: value(parseRevision('Snapshot:Ä')),
  };
}
export async function fixture(t: TestContext, migrate = true) {
  const directory = mkdtempSync(join(tmpdir(), 'timeline-t1-'));
  const path = join(directory, 'canonical.db');
  const migrations = await loadTimelineMigrations();
  const stores = [] as ReturnType<typeof createOwners>[];
  function createOwners(adapter: SqliteAdapter) {
    return createState(adapter, (sql) => ({
      sql,
      timeline: bindTimeline(sql, agent),
      other: bindTimeline(sql, otherAgent),
    }));
  }
  t.after(async () => {
    for (const state of stores) value(await state.close());
    rmSync(directory, { recursive: true, force: true });
  });
  const open = async (chain: readonly SqlMigration[] = migrations) => {
    const adapter = value(
      await createSqliteAdapter({ path, migrations: chain }, limits()),
    );
    const state = createOwners(adapter);
    stores.push(state);
    return state;
  };
  const state = await open();
  if (migrate) value(await state.migrate(limits()));
  return { state, open, directory, path, migrations };
}
