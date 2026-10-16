import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type Result,
  parseAgentId,
  parseTickId,
  parseActionId,
  parseRevision,
  parseWallTimeMs,
  parseElapsedMs,
  parseEvidenceRef,
} from '@polyphony/core-types';
import { createState } from '@polyphony/state';
import { createSqliteAdapter } from '@polyphony/state/adapters/sqlite';
import {
  bindTimeline,
  loadTimelineMigrations,
} from '@polyphony/timeline/sqlite';
import type { ReserveTickInput } from '@polyphony/timeline/contracts';

function value<T, E>(result: Result<T, E>): T {
  assert.ok(result.ok);
  return result.value;
}
const options = () => ({
  signal: new AbortController().signal,
  timeoutMs: 10_000,
});
const agent = value(parseAgentId('technical-agent'));
const input = (id: string): ReserveTickInput => ({
  tickId: value(parseTickId(id)),
  epoch: 'root-run-1',
  wallTime: value(parseWallTimeMs(1000)),
  elapsed: value(parseElapsedMs(4)),
  mode: 'REACTIVE',
  policyRevision: value(parseRevision('policy-1')),
  snapshotRevision: value(parseRevision('snapshot-1')),
});
const directory = mkdtempSync(join(tmpdir(), 'timeline-guide-'));
const path = join(directory, 'canonical.db');
const migrations = await loadTimelineMigrations();
async function open() {
  const adapter = value(
    await createSqliteAdapter({ path, migrations }, options()),
  );
  const state = createState(adapter, (sql) => bindTimeline(sql, agent));
  return state;
}
let state: Awaited<ReturnType<typeof open>> | undefined;
try {
  state = await open();
  value(await state.migrate(options()));
  const first = input('tick-1');
  const action = value(parseActionId('technical-action'));
  value(await state.transact((port) => port.reserveTick(first), options()));
  value(
    await state.transact(
      (port) =>
        port.decide({
          tickId: first.tickId,
          expectedRevision: 0,
          actionRef: action,
        }),
      options(),
    ),
  );
  const outcome = value(
    parseEvidenceRef({
      sourceKind: 'technical-unknown',
      id: 'outcome',
      revision: 'hash-1',
    }),
  );
  const settled = value(
    await state.transact(
      (port) =>
        port.settle({
          tickId: first.tickId,
          expectedRevision: 1,
          actionRef: action,
          outcomeRef: outcome,
        }),
      options(),
    ),
  );
  assert.equal(settled.phase, 'settled');
  console.log('success: settled tick persisted');
  assert.deepEqual(
    await state.transact((port) => port.reserveTick(first), options()),
    { ok: false, error: { kind: 'owner', error: { code: 'conflict' } } },
  );
  console.log('error: duplicate tick is conflict');
  value(
    await state.transact(
      (port) => port.reserveTick(input('tick-2')),
      options(),
    ),
  );
  value(await state.close());
  state = await open();
  const recovered = value(
    await state.transact((port) => port.resume(), options()),
  );
  assert.equal(recovered.lastTick?.phase, 'interrupted');
  assert.equal(recovered.previousCompleteTick, first.tickId);
  const next = value(
    await state.transact(
      (port) => port.reserveTick(input('tick-3')),
      options(),
    ),
  );
  assert.equal(next.frame.sequence, 3);
  assert.equal(next.frame.previousCompleteTick, first.tickId);
  console.log('recovery: interrupted attempt retained; next sequence is 3');
} finally {
  if (state) value(await state.close());
  rmSync(directory, { recursive: true, force: true });
}
