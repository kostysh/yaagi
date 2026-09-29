import assert from 'node:assert/strict';
import { once } from 'node:events';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { BroadcastChannel, setEnvironmentData } from 'node:worker_threads';
import { writeOwners } from '../examples/owners.js';
import { openState } from './fixture.js';
import { counts, failure, limits, release, value } from './fixture.js';

const [path, mode] = process.argv.slice(2);
if (mode === 'first-create') {
  const firstPath = `${path}.first`;
  const buffer = new SharedArrayBuffer(8);
  const flags = new Int32Array(buffer);
  const name = `state-first-create-${process.pid}`;
  const channel = new BroadcastChannel(name);
  const beforeClose = once(channel, 'message', {
    signal: AbortSignal.timeout(5000),
  });
  setEnvironmentData('state-first-create', { name, buffer });
  const first = openState(
    { path: firstPath, migrations: release },
    limits(undefined, 10_000),
  );
  const entered = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  let second:
    | Extract<Awaited<ReturnType<typeof openState>>, { ok: true }>['value']
    | undefined;
  let transaction: Promise<unknown> | undefined;
  try {
    await beforeClose;
    setEnvironmentData('state-first-create', undefined);
    second = value(
      await openState({ path: firstPath, migrations: release }, limits()),
    );
    value(await second.migrate(limits()));
    const pending = second.transact(
      async (scope) => {
        await writeOwners(scope);
        entered.resolve();
        await resume.promise;
        return { ok: true, value: await counts(scope) };
      },
      limits(undefined, 10_000),
    );
    transaction = pending;
    await entered.promise;
    const inode = statSync(firstPath).ino;
    // Inspect the real Linux lock, not merely eventual data: WAL SHM locks
    // can mask loss of the DB lock in an ordinary write/readback test.
    const locks = () =>
      readFileSync('/proc/locks', 'utf8')
        .split('\n')
        .filter((line) => line.includes(`:${inode} `))
        .map((line) => line.trim().split(/\s+/).slice(1).join(' '));
    const before = locks();
    assert.ok(before.length > 0);
    const afterClose = once(channel, 'message', {
      signal: AbortSignal.timeout(5000),
    });
    Atomics.store(flags, 0, 1);
    Atomics.notify(flags, 0);
    await afterClose;
    assert.deepEqual(locks(), before);
    Atomics.store(flags, 1, 1);
    Atomics.notify(flags, 1);
    value(await first);
    resume.resolve();
    assert.deepEqual(value(await pending), [1, 1, 1]);
  } finally {
    setEnvironmentData('state-first-create', undefined);
    resume.resolve();
    for (const index of [0, 1]) {
      Atomics.store(flags, index, 1);
      Atomics.notify(flags, index);
    }
    await transaction;
    if (second) value(await second.close());
    const opened = await first;
    if (opened.ok) value(await opened.value.close());
    channel.close();
  }
  const reopened = value(
    await openState({ path: firstPath, migrations: release }, limits()),
  );
  try {
    assert.deepEqual(
      value(await reopened.readSnapshot(counts, limits())),
      [1, 1, 1],
    );
    assert.equal(statSync(firstPath).mode & 0o777, 0o600);
    assert.equal(
      readdirSync(dirname(firstPath)).some((file) =>
        file.startsWith('.state-create-'),
      ),
      false,
    );
  } finally {
    value(await reopened.close());
  }
} else if (mode === 'wal-cleanup') {
  const state = value(await openState({ path, migrations: release }, limits()));
  const entered = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  const buffer = new SharedArrayBuffer(4);
  const flag = new Int32Array(buffer);
  const name = `state-wal-cleanup-${process.pid}`;
  const channel = new BroadcastChannel(name);
  const reader = state.readSnapshot(
    async (scope) => {
      const before = await counts(scope);
      entered.resolve();
      await resume.promise;
      return before;
    },
    limits(undefined, 10_000),
  );
  let checking: ReturnType<typeof state.checkSchema> | undefined;
  try {
    await entered.promise;
    assert.equal(existsSync(`${path}-wal`), true);
    setEnvironmentData('state-wal-cleanup', { name, buffer });
    const observed = once(channel, 'message', {
      signal: AbortSignal.timeout(5000),
    });
    checking = state.checkSchema(limits(undefined, 10_000));
    await observed;
    resume.resolve();
    assert.deepEqual(value(await reader), [0, 0, 0]);
    assert.equal(existsSync(`${path}-wal`), false);
    Atomics.store(flag, 0, 1);
    Atomics.notify(flag, 0);
    assert.deepEqual(value(await checking), { applied: 3, pending: 0 });
    value(await state.checkSchema(limits()));
    value(
      await state.transact(async (scope) => {
        await writeOwners(scope);
        return { ok: true, value: undefined };
      }, limits()),
    );
  } finally {
    resume.resolve();
    Atomics.store(flag, 0, 1);
    Atomics.notify(flag, 0);
    await reader;
    await checking;
    value(await state.close());
    channel.close();
    setEnvironmentData('state-wal-cleanup', undefined);
  }
  const reopened = value(
    await openState({ path, migrations: release }, limits()),
  );
  try {
    assert.deepEqual(
      value(await reopened.readSnapshot(counts, limits())),
      [1, 1, 1],
    );
  } finally {
    value(await reopened.close());
  }
} else if (mode === 'backup-cancel') {
  const state = value(await openState({ path, migrations: release }, limits()));
  try {
    value(
      await state.transact(async (scope) => {
        await scope.run(
          "INSERT INTO fixture_notes VALUES('large','backup',0,zeroblob(10000000),NULL)",
        );
        return { ok: true, value: undefined };
      }, limits()),
    );
    failure(
      await state.adapter.backupTo(`${path}.cancelled`, limits()),
      'cancelled',
    );
    assert.equal(existsSync(`${path}.cancelled`), false);
    assert.equal(
      readdirSync(dirname(path)).some((name) =>
        name.startsWith('.state-backup-'),
      ),
      false,
    );
    assert.deepEqual(
      value(
        await state.readSnapshot(
          (scope) => scope.all('SELECT length(bytes) FROM fixture_notes'),
          limits(),
        ),
      ),
      [[10000000]],
    );
  } finally {
    value(await state.close());
  }
} else if (mode === 'worker-before' || mode === 'worker-after') {
  const state = value(await openState({ path, migrations: release }, limits()));
  let calls = 0;
  failure(
    await state.transact(async (scope) => {
      calls++;
      await writeOwners(scope);
      return { ok: true, value: undefined };
    }, limits()),
    'unavailable',
  );
  assert.equal(calls, 1);
  failure(await state.checkSchema(limits()), 'closed');
  value(await state.close());
  const reopened = value(
    await openState({ path, migrations: release }, limits()),
  );
  assert.deepEqual(
    value(await reopened.readSnapshot(counts, limits())),
    mode === 'worker-before' ? [0, 0, 0] : [1, 1, 1],
  );
  value(await reopened.close());
} else if (mode === 'extension') {
  failure(
    await openState({ path, migrations: release }, limits()),
    'incompatible',
  );
} else {
  const store = value(await openState({ path, migrations: release }, limits()));
  try {
    failure(
      await store.transact(async (scope) => {
        await scope.run(
          "INSERT INTO fixture_notes VALUES('bad','x',0,zeroblob(10000000),NULL)",
        );
        return { ok: true, value: undefined };
      }, limits()),
      mode === 'full' ? 'full' : 'write_failed',
    );
    if (mode === 'readonly')
      failure(await store.readSnapshot(async () => 0, limits()), 'closed');
  } finally {
    value(await store.close());
  }
  const reopened = value(
    await openState({ path, migrations: release }, limits()),
  );
  assert.deepEqual(
    value(
      await reopened.readSnapshot(async (scope) => counts(scope), limits()),
    ),
    [0, 0, 0],
  );
  value(await reopened.close());
}
