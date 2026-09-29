import assert from 'node:assert/strict';
import test from 'node:test';
import type { StoragePort } from '@polyphony/state/contracts';
import { createState } from '@polyphony/state';
import type { SqlScope } from '@polyphony/state/adapters/sqlite';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';
import { ownerDb } from '../examples/owners.js';
import { failure, fixture, limits, value } from './fixture.js';
import { Consumer, type FixtureOwners } from './m1-consumer.js';
import { MemoryAdapter, type MemoryScope } from './m1-memory.js';

const alphaTable = sqliteTable('m1_alpha', { value: integer().notNull() });
const betaTable = sqliteTable('m1_beta', { value: text().notNull() });
const Alpha = z.object({ value: z.number().int() });
const Beta = z.object({ value: z.string() });
function owners(scope: SqlScope): FixtureOwners {
  const db = ownerDb(scope);
  return {
    alpha: {
      read: async () =>
        Alpha.parse(await db.select().from(alphaTable).get()).value,
      write: async (value) => {
        await db.update(alphaTable).set(Alpha.parse({ value }));
      },
    },
    beta: {
      read: async () =>
        Beta.parse(await db.select().from(betaTable).get()).value,
      write: async (value) => {
        await db.update(betaTable).set(Beta.parse({ value }));
      },
    },
  };
}
function memoryOwners(scope: MemoryScope): FixtureOwners {
  return {
    alpha: {
      read: async () => Alpha.parse({ value: scope.get('alpha') }).value,
      write: async (value) => {
        scope.set('alpha', Alpha.parse({ value }).value);
      },
    },
    beta: {
      read: async () => Beta.parse({ value: scope.get('beta') }).value,
      write: async (value) => {
        scope.set('beta', Beta.parse({ value }).value);
      },
    },
  };
}
for (const implementation of ['sqlite', 'memory'])
  test(`M1 unchanged consumer and fixtures: ${implementation}`, async (t) => {
    const port: StoragePort<FixtureOwners> =
      implementation === 'memory'
        ? createState(new MemoryAdapter(), memoryOwners)
        : createState(
            (
              await fixture(t, [
                {
                  id: 'm1',
                  sql: "CREATE TABLE m1_alpha(value); INSERT INTO m1_alpha VALUES(0); CREATE TABLE m1_beta(value); INSERT INTO m1_beta VALUES('');",
                },
              ])
            ).store.adapter,
            owners,
          );
    const consumer = new Consumer(port);
    failure(await consumer.read(limits(AbortSignal.abort())), 'cancelled');
    failure(await consumer.read(limits(undefined, 0)), 'deadline');
    failure(await consumer.read(limits(undefined, NaN)), 'incompatible');
    assert.deepEqual(value(await consumer.read(limits())), {
      alpha: 0,
      beta: '',
    });
    assert.equal(value(await consumer.save(0, 1, 'one', limits())), undefined);
    assert.deepEqual(await consumer.save(0, 9, 'wrong', limits()), {
      ok: false,
      error: { kind: 'owner', error: 'conflict' },
    });
    assert.deepEqual(value(await consumer.read(limits())), {
      alpha: 1,
      beta: 'one',
    });
    const ownerError = { conflict: false };
    assert.deepEqual(
      await port.transact(async (owners) => {
        await owners.alpha.write(100);
        await owners.beta.write('discard');
        return { ok: false, error: ownerError };
      }, limits()),
      { ok: false, error: { kind: 'owner', error: ownerError } },
    );
    const abort = new AbortController();
    failure(
      await port.transact(async (owners) => {
        await owners.alpha.write(100);
        await owners.beta.write('discard');
        abort.abort();
        return { ok: true, value: false };
      }, limits(abort.signal)),
      'cancelled',
    );
    let expired: FixtureOwners | undefined;
    assert.deepEqual(
      value(
        await port.readSnapshot(async (owners) => {
          expired = owners;
          const before = await owners.alpha.read();
          await Promise.resolve();
          assert.equal(await owners.alpha.read(), before);
          return { alpha: before, beta: await owners.beta.read() };
        }, limits()),
      ),
      { alpha: 1, beta: 'one' },
    );
    assert.ok(expired);
    // The owner ORM may wrap scope_ended; the shared port promises revocation,
    // not a vendor-specific thrown Error shape outside a completed operation.
    await assert.rejects(expired.alpha.write(7));
    assert.deepEqual(value(await consumer.read(limits())), {
      alpha: 1,
      beta: 'one',
    });
    for (const payload of [false, '', 0, undefined])
      assert.equal(
        value(
          await port.transact(
            async () => ({ ok: true, value: payload }),
            limits(),
          ),
        ),
        payload,
      );
    value(await port.close());
    failure(await consumer.read(limits()), 'closed');
  });
