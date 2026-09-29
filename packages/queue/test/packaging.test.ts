import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import { createState } from '@polyphony/state';
import { createSqliteAdapter } from '@polyphony/state/adapters/sqlite';
import {
  bindQueueScope,
  loadQueueMigrations,
} from '@polyphony/queue/storage/sqlite';
import type { AdapterInput, QueueAdapter } from '@polyphony/queue/ports';
import {
  agenda,
  enqueue,
  fixture,
  job,
  limits,
  open,
  required,
  startOptions,
  terminal,
} from './fixture.js';

test('all production exports are importable without storage/timers/workers or reading migrations', async () => {
  const result = await promisify(execFile)(process.execPath, [
    new URL('./import-child.js', import.meta.url).pathname,
  ]);
  assert.equal(result.stderr, '');
});

test('SQL artifact: fresh, repeat and failed chain migration without partial schema', async (t) => {
  const root = await fixture(t);
  assert.deepEqual(required(await root.storage.checkSchema(limits())), {
    applied: 1,
    pending: 0,
  });
  required(await root.storage.migrate(limits()));
  const chain = await loadQueueMigrations();
  assert.equal(chain.length, 1);
  assert.match(chain[0].sql, /CREATE TABLE/);
  await root.close();
  const adapter = required(
    await createSqliteAdapter(
      {
        path: root.path,
        migrations: [
          ...chain,
          {
            id: 'broken_fixture',
            sql: 'CREATE TABLE should_rollback(id TEXT); THIS IS NOT SQL;',
          },
        ],
      },
      limits(),
    ),
  );
  const storage = createState(adapter, bindQueueScope);
  try {
    assert.equal((await storage.migrate(limits())).ok, false);
    assert.deepEqual(required(await storage.checkSchema(limits())), {
      applied: 1,
      pending: 1,
    });
    assert.equal(
      (await storage.readSnapshot(async () => undefined, limits())).ok,
      false,
    );
  } finally {
    required(await storage.close());
  }
  const restored = await open(root.path);
  try {
    assert.deepEqual(
      required(
        await restored.raw.readSnapshot(
          (scope) =>
            scope.all(
              "SELECT name FROM sqlite_master WHERE name='should_rollback'",
            ),
          limits(),
        ),
      ),
      [],
    );
  } finally {
    await restored.close();
  }
});

function oneShot(): QueueAdapter {
  let task: Promise<void> | undefined;
  let controller: AbortController;
  return {
    start: async (input: AdapterInput) => {
      controller = new AbortController();
      task = (async () => {
        for (const type of input.types) {
          const delivery = required(
            await input.store.reserve(type.name, type.version, Date.now(), 0),
          );
          if (!delivery) continue;
          required(await input.store.begin(delivery));
          await input.execute(delivery, controller.signal);
        }
      })();
      return { ok: true, value: undefined };
    },
    stop: async () => {
      controller?.abort();
      await task;
      return { ok: true, value: undefined };
    },
  };
}
for (const [name, factory] of [
  ['Agenda', agenda],
  ['test alternative', oneShot],
] as const) {
  test(`M1 unchanged production core/consumer/storage/fixtures with ${name}`, async (t) => {
    const root = await fixture(t);
    const registration = job();
    const queue = root.make(registration, factory());
    await enqueue(queue, registration);
    const done = root.committed(terminal);
    required(await queue.start(startOptions, limits()));
    await done;
    required(await queue.stop(limits()));
    assert.deepEqual(
      required(await queue.get(registration.type, 'a', limits())).result,
      { available: true, value: 42 },
    );
  });
}
