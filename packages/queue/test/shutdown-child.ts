import assert from 'node:assert/strict';
import { once } from 'node:events';
import { setImmediate } from 'node:timers/promises';
import { createAgendaAdapter } from '@polyphony/queue/adapters/agenda';
import {
  deferred,
  job,
  limits,
  open,
  required,
  startOptions,
  terminal,
} from './fixture.js';

const [path, mode] = process.argv.slice(2);
assert.ok(path && (mode === 'future' || mode === 'completed'));
await once(process, 'message');
const root = await open(path);
const scanned = deferred();
let calls = 0;
const registration = job(async () => {
  calls++;
  return 42;
});
const processing = required(
  createAgendaAdapter({
    pollIntervalMs: mode === 'future' ? 8_000 : 20,
    leaseMs: mode === 'future' ? 20_000 : 2_000,
  }),
);
const queue = root.make(registration, {
  ...processing,
  start: (input) =>
    processing.start({
      ...input,
      store: {
        reserve: async (...args) => {
          const value = await input.store.reserve(...args);
          // The actual poll has returned. Let Agenda finish its microtask chain
          // before testing stop; no replacement repository or fake scheduler.
          void setImmediate().then(() => scanned.resolve());
          return value;
        },
        begin: (...args) => input.store.begin(...args),
        touch: (...args) => input.store.touch(...args),
        release: (...args) => input.store.release(...args),
      },
    }),
});
const done = mode === 'completed' ? root.committed(terminal) : scanned.promise;
required(await queue.start(startOptions, limits()));
await done;
required(await queue.stop(limits(mode === 'future' ? 1_000 : 3_000)));
await root.close();
await setImmediate();
process.send?.({
  phase: 'closed',
  calls,
  state: queue.lifecycle().state,
  timers: process.getActiveResourcesInfo().filter((name) => name === 'Timeout')
    .length,
});
process.disconnect();
