import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import type { Result } from '@polyphony/core-types';
import { createState } from '@polyphony/state';
import { createSqliteAdapter } from '@polyphony/state/adapters/sqlite';
import { createQueue, defineJob } from '@polyphony/queue';
import { createAgendaAdapter } from '@polyphony/queue/adapters/agenda';
import {
  bindQueueScope,
  loadQueueMigrations,
} from '@polyphony/queue/storage/sqlite';
import { z } from 'zod';

function required<T, E>(value: Result<T, E>): T {
  if (!value.ok) throw new Error('Example operation failed');
  return value.value;
}
function codec<S extends z.ZodType>(schema: S) {
  return (value: unknown): Result<z.output<S>, { code: 'invalid' }> => {
    const parsed = schema.safeParse(value);
    return parsed.success
      ? { ok: true, value: parsed.data }
      : { ok: false, error: { code: 'invalid' } };
  };
}
const options = () => ({
  signal: new AbortController().signal,
  timeoutMs: 5_000,
});

export async function example(): Promise<void> {
  // Only this example owns/removes this freshly created temporary directory.
  // A real composition root must keep a stable private path between restarts.
  const directory = await mkdtemp(join(tmpdir(), 'queue-guide-'));
  const path = join(directory, 'queue.db');
  const migrations = await loadQueueMigrations();
  const registration = required(
    defineJob<{ value: number }, { doubled: number }>({
      name: 'double',
      version: 1,
      payload: codec(z.strictObject({ value: z.number().finite() })),
      result: codec(z.strictObject({ doubled: z.number().finite() })),
      handler: async (payload, context) => {
        if (context.signal.aborted) throw new Error('Cancelled');
        return { doubled: payload.value * 2 };
      },
    }),
  );
  const open = async () => {
    const adapter = required(
      await createSqliteAdapter({ path, migrations }, options()),
    );
    const storage = createState(adapter, bindQueueScope);
    required(await storage.migrate(options()));
    const queue = required(
      createQueue({
        namespace: 'guide',
        storage,
        registrations: [registration],
        adapter: required(
          createAgendaAdapter({ pollIntervalMs: 40, leaseMs: 2_000 }),
        ),
      }),
    );
    return { storage, queue };
  };
  let root = await open();
  try {
    const request = {
      id: 'double-21',
      payload: { value: 21 },
      policy: { maxAttempts: 3, backoffMs: 100, timeoutMs: 2_000 },
    };
    const enqueued = required(
      await root.queue.enqueue(registration.type, request, options()),
    );
    required(await root.queue.stop(options()));
    required(await root.storage.close());
    root = await open(); // Pending survives; no second enqueue is needed.
    required(
      await root.queue.start({ concurrency: 1, shutdownMs: 2_000 }, options()),
    );
    const until = Date.now() + 10_000;
    for (;;) {
      const status = required(
        await root.queue.get(registration.type, request.id, options()),
      );
      if (status.status === 'completed') {
        assert.deepEqual(status.result, {
          available: true,
          value: { doubled: 42 },
        });
        required(
          await root.queue.cleanup(
            {
              id: request.id,
              hash: enqueued.hash,
              attemptsUsed: status.attemptsUsed,
            },
            options(),
          ),
        );
        assert.equal(
          required(
            await root.queue.enqueue(registration.type, request, options()),
          ).duplicate,
          true,
        );
        break;
      }
      if (
        status.status === 'failed' ||
        root.queue.lifecycle().error ||
        Date.now() >= until
      )
        throw new Error('Example did not complete');
      // Ordinary consumer status polling, not an assumption about completion time.
      await delay(20);
    }
  } finally {
    const stopped = await root.queue.stop(options());
    // Failure throws before close/removal: ownership remains with the root.
    required(stopped);
    required(await root.storage.close());
    await rm(directory, { recursive: true, force: true });
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await example();
  console.log(
    'queue guide: durable enqueue, reopen, Agenda processing, result and receipt/tombstone passed',
  );
}
