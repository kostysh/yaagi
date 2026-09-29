import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { failure, fixture, limits, value } from './fixture.js';
import type { OperationOptions } from '@polyphony/state/contracts';

const migrations = [
  { id: 'owners', sql: 'CREATE TABLE owner_events(id TEXT PRIMARY KEY)' },
];
function barrier(t: TestContext) {
  const gate = Promise.withResolvers<void>();
  // Also release held callbacks if the test itself is cancelled: cleanup must drain.
  const release = () => gate.resolve();
  t.signal.addEventListener('abort', release, { once: true });
  t.after(() => t.signal.removeEventListener('abort', release));
  return gate;
}
test('portable abort events reach executing worker SQL; completion waits for rollback', async (t) => {
  const f = await fixture(t, migrations);
  const controller = new AbortController();
  // A structural signal, not an instanceof AbortSignal: no Node identity in contracts.
  const signal: OperationOptions['signal'] = {
    get aborted() {
      return controller.signal.aborted;
    },
    addEventListener: controller.signal.addEventListener.bind(
      controller.signal,
    ),
    removeEventListener: controller.signal.removeEventListener.bind(
      controller.signal,
    ),
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  t.after(() => clearTimeout(timer));
  let executed = false;
  let timerRan = false;
  failure(
    await f.store.transact(
      async (scope) => {
        await scope.run("INSERT INTO owner_events VALUES('cancelled')");
        executed = true;
        const sql = scope.all(
          'WITH RECURSIVE x(n) AS (VALUES(0) UNION ALL SELECT n+1 FROM x WHERE n<3000000) SELECT sum(n) FROM x',
        );
        timer = setTimeout(() => {
          timerRan = true;
          controller.abort();
        }, 10);
        await sql;
        return { ok: true, value: undefined };
      },
      { signal, timeoutMs: 5000 },
    ),
    'cancelled',
  );
  assert.equal(executed, true);
  assert.equal(timerRan, true);
  value(await f.store.close());
  assert.deepEqual(
    value(
      await (await f.open()).readSnapshot(
        (scope) => scope.all('SELECT id FROM owner_events'),
        limits(),
      ),
    ),
    [],
  );
});
for (const topology of ['same-state', 'same-file']) {
  test(`AC6 ${topology}: readers overlap; writer commits inside a stable snapshot`, async (t) => {
    const f = await fixture(t, migrations);
    const other = topology === 'same-state' ? f.store : await f.open();
    const both = barrier(t);
    let readers = 0;
    const results = await Promise.all(
      [f.store, other].map((state) =>
        state.readSnapshot(async (scope) => {
          const rows = await scope.all('SELECT id FROM owner_events');
          if (++readers === 2) both.resolve();
          await both.promise;
          return rows;
        }, limits()),
      ),
    );
    assert.deepEqual(results.map(value), [[], []]);
    const snapshot = value(
      await f.store.readSnapshot(async (scope) => {
        const before = await scope.all('SELECT id FROM owner_events');
        value(
          await other.transact(async (writer) => {
            await writer.run("INSERT INTO owner_events VALUES('writer')");
            return { ok: true, value: 0 };
          }, limits()),
        );
        return [before, await scope.all('SELECT id FROM owner_events')];
      }, limits()),
    );
    assert.deepEqual(snapshot, [[], []]);
    assert.deepEqual(
      value(
        await other.readSnapshot(
          (scope) => scope.all('SELECT id FROM owner_events'),
          limits(),
        ),
      ),
      [['writer']],
    );
  });
  for (const outcome of [
    'commit',
    'owner-error',
    'throw',
    'sql-error',
    'cancel',
  ]) {
    test(`AC6 ${topology}: waiting writer succeeds after first ${outcome}, with no replay`, async (t) => {
      const f = await fixture(t, migrations);
      const other = topology === 'same-state' ? f.store : await f.open();
      const entered = barrier(t);
      const resume = barrier(t);
      const cancellation = new AbortController();
      let firstCalls = 0;
      let secondCalls = 0;
      const first = f.store.transact(async (scope) => {
        firstCalls++;
        await scope.run("INSERT INTO owner_events VALUES('first')");
        entered.resolve();
        await resume.promise;
        if (outcome === 'throw') throw new Error('owner');
        if (outcome === 'sql-error') {
          await assert.rejects(scope.run('INSERT INTO absent VALUES(1)'));
          await assert.rejects(
            scope.run("INSERT INTO owner_events VALUES('escape')"),
          );
        }
        if (outcome === 'cancel') cancellation.abort();
        return outcome === 'owner-error'
          ? { ok: false, error: 'conflict' }
          : { ok: true, value: 0 };
      }, limits(cancellation.signal));
      await entered.promise;
      const second = other.transact(async (scope) => {
        secondCalls++;
        await scope.run("INSERT INTO owner_events VALUES('second')");
        await Promise.resolve();
        return { ok: true, value: false };
      }, limits());
      // No sleep oracle: an independent real read completes while first owns the writer.
      assert.deepEqual(
        value(
          await other.readSnapshot(
            (scope) => scope.all('SELECT id FROM owner_events'),
            limits(),
          ),
        ),
        [],
      );
      assert.equal(secondCalls, 0);
      resume.resolve();
      const result = await first;
      if (outcome === 'commit') value(result);
      else if (outcome === 'owner-error')
        assert.deepEqual(result, {
          ok: false,
          error: { kind: 'owner', error: 'conflict' },
        });
      else
        failure(
          result,
          outcome === 'throw'
            ? 'callback_failed'
            : outcome === 'sql-error'
              ? 'operation_failed'
              : 'cancelled',
        );
      assert.equal(value(await second), false);
      assert.equal(firstCalls, 1);
      assert.equal(secondCalls, 1);
      value(await other.close());
      value(await f.store.close());
      const reopened = await f.open();
      assert.deepEqual(
        value(
          await reopened.readSnapshot(
            (scope) => scope.all('SELECT id FROM owner_events ORDER BY id'),
            limits(),
          ),
        ),
        outcome === 'commit' ? [['first'], ['second']] : [['second']],
      );
    });
  }
}
test('a native-wait deadline expires without invoking the waiting callback or leaving late writes', async (t) => {
  const f = await fixture(t, migrations);
  const entered = barrier(t);
  const resume = barrier(t);
  const first = f.store.transact(async (scope) => {
    await scope.run("INSERT INTO owner_events VALUES('first')");
    entered.resolve();
    await resume.promise;
    return { ok: true, value: undefined };
  }, limits());
  await entered.promise;
  let calls = 0;
  failure(
    await f.store.transact(
      async (scope) => {
        calls++;
        await scope.run("INSERT INTO owner_events VALUES('late')");
        return { ok: true, value: undefined };
      },
      limits(undefined, 200),
    ),
    'deadline',
  );
  assert.equal(calls, 0);
  resume.resolve();
  value(await first);
  value(await f.store.close());
  assert.deepEqual(
    value(
      await (await f.open()).readSnapshot(
        (scope) => scope.all('SELECT id FROM owner_events'),
        limits(),
      ),
    ),
    [['first']],
  );
});
