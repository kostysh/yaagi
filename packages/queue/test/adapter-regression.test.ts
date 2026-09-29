import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
import { Agenda, type JobParameters } from 'agenda';
import type { QueueAdapter } from '@polyphony/queue/ports';
import {
  agenda,
  deferred,
  enqueue,
  fixture,
  job,
  limits,
  open,
  policy,
  required,
  startOptions,
  terminal,
} from './fixture.js';

test('a finite synchronous handler cannot return a successful result after its deadline', async (t) => {
  let signal: { readonly aborted: boolean } | undefined;
  const registration = job(async (_value, context) => {
    signal = context.signal;
    const until = performance.now() + 500;
    while (performance.now() < until) {
      /* Finite CPU work delays timer delivery. */
    }
    return 42;
  });
  const root = await fixture(t);
  const queue = root.make(registration);
  required(
    await queue.enqueue(
      registration.type,
      {
        id: 'a',
        payload: 4,
        policy: { ...policy, timeoutMs: 200, maxAttempts: 1 },
      },
      limits(),
    ),
  );
  const done = root.committed(terminal);
  required(await queue.start(startOptions, limits()));
  await done;
  required(await queue.stop(limits()));
  const status = required(await queue.get(registration.type, 'a', limits()));
  assert.equal(status.status, 'failed');
  assert.equal(status.attempts[0].reason, 'timeout');
  assert.deepEqual(status.result, { available: false });
  assert.equal(signal?.aborted, true);
});

test('execution window blocks admission even before an overdue timer can run', async (t) => {
  const root = await fixture(t);
  const scanned = deferred();
  let calls = 0;
  let reservations = 0;
  const registration = job(async () => {
    calls++;
    return 42;
  });
  const queue = root.make(registration, agenda(), 'tests', {
    ...root.storage,
    transact: async (action, options) => {
      let selected = false;
      const result = await root.storage.transact(
        (scope) =>
          action({
            ...scope,
            candidate: async (...args) => {
              const row = await scope.candidate(...args);
              assert.ok(row);
              selected = true;
              const until = performance.now() + 1_100;
              while (performance.now() < until) {
                /* Delay window timer delivery. */
              }
              return row;
            },
            put: async (row) => {
              if (row.lease) reservations++;
              await scope.put(row);
            },
          }),
        options,
      );
      if (selected) scanned.resolve();
      return result;
    },
  });
  await enqueue(queue, registration);
  required(await queue.start({ ...startOptions, windowMs: 1_000 }, limits()));
  await scanned.promise;
  required(await queue.stop(limits()));
  const status = required(await queue.get(registration.type, 'a', limits()));
  assert.equal(calls, 0);
  assert.equal(reservations, 0);
  assert.equal(status.attemptsUsed, 0);
  assert.equal(status.status, 'pending');
});

for (const mode of ['future', 'completed'] as const) {
  test(`successful stop leaves no Agenda timers and child exits naturally: ${mode}`, async (t) => {
    const root = await fixture(t);
    const registration = job();
    const notBefore = mode === 'future' ? Date.now() + 3_000 : 0;
    await enqueue(root.make(registration), registration, 'a', 3, notBefore);
    await root.close();
    const child = fork(
      new URL('./shutdown-child.js', import.meta.url),
      [root.path, mode],
      {
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      },
    );
    let stderr = '';
    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });
    const exited = once(child, 'exit');
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const received = once(child, 'message');
      child.send('start');
      const [message] = await Promise.race([
        received,
        exited.then(() => {
          throw new Error(`Child exited before close: ${stderr}`);
        }),
      ]);
      assert.deepEqual(message, {
        phase: 'closed',
        calls: mode === 'future' ? 0 : 1,
        state: 'idle',
        timers: 0,
      });
      const [code, signal] = await Promise.race([
        exited,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Child retained resources after close')),
            1_500,
          );
        }),
      ]);
      assert.equal(code, 0);
      assert.equal(signal, null);
      assert.equal(stderr, '');
    } finally {
      clearTimeout(timeout);
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
        await exited;
      }
    }
    const reopened = await open(root.path);
    try {
      const worker = job(async () => {
        assert.ok(Date.now() >= notBefore);
        return 42;
      });
      const queue = reopened.make(worker);
      const before = required(await queue.get(worker.type, 'a', limits()));
      assert.equal(before.status, mode === 'future' ? 'pending' : 'completed');
      assert.equal(before.notBefore, notBefore);
      if (mode === 'future') {
        const done = reopened.committed(terminal);
        required(await queue.start(startOptions, limits()));
        await done;
        required(await queue.stop(limits()));
      }
      assert.deepEqual(
        required(await queue.get(worker.type, 'a', limits())).result,
        {
          available: true,
          value: 42,
        },
      );
    } finally {
      await reopened.close();
    }
  });
}

test('production Agenda stale touch, terminal save and single/bulk unlock cannot change a newer lease', async (t) => {
  // Observe the real public constructor/lifecycle seam without changing any
  // processing method. Calls below target the actual production JobRepository.
  const instances: Agenda[] = [];
  const original = Agenda.prototype.define;
  t.mock.method(
    Agenda.prototype,
    'define',
    function (this: Agenda, ...args: Parameters<Agenda['define']>) {
      if (!instances.includes(this)) instances.push(this);
      return original.apply(this, args);
    },
  );
  const heartbeatHeld = deferred();
  const heartbeatRelease = deferred();
  const oldEntered = deferred();
  const newEntered = deferred();
  const oldRelease = deferred();
  const newRelease = deferred();
  const processing = agenda(600);
  const delayedHeartbeat: QueueAdapter = {
    ...processing,
    start: (input) =>
      processing.start({
        ...input,
        store: {
          reserve: (...args) => input.store.reserve(...args),
          begin: (...args) => input.store.begin(...args),
          release: (...args) => input.store.release(...args),
          touch: async (...args) => {
            heartbeatHeld.resolve();
            await heartbeatRelease.promise;
            return input.store.touch(...args);
          },
        },
      }),
  };
  const root = await fixture(t);
  const second = await open(root.path);
  t.after(() => second.close());
  const firstJob = job(async () => {
    oldEntered.resolve();
    await oldRelease.promise;
    return 999;
  });
  const secondJob = job(async () => {
    newEntered.resolve();
    await newRelease.promise;
    return 42;
  });
  const q1 = root.make(firstJob, delayedHeartbeat);
  const q2 = second.make(secondJob, agenda());
  await enqueue(q1, firstJob);
  required(await q1.start(startOptions, limits()));
  const [first] = instances;
  assert.ok(first);
  let old: JobParameters | undefined;
  first.on('start', (job) => {
    old = { ...job.attrs };
  });
  try {
    await oldEntered.promise;
    await heartbeatHeld.promise;
    assert.ok(old?._id);
    required(await q2.start(startOptions, limits()));
    await newEntered.promise;
    const current = required(
      await second.base.readSnapshot(
        (scope) => scope.get('tests', 'a'),
        limits(),
      ),
    );
    heartbeatRelease.resolve();
    await assert.rejects(
      first.db.saveJobState({ ...old, lockedAt: new Date() }, {}),
      { code: 'conflict' },
    );
    await first.db.unlockJob(old);
    await first.db.unlockJobs([old._id]);
    await first.db.saveJobState({ ...old, lockedAt: undefined }, {});
    await first.db.unlockJob(old);
    await first.db.unlockJobs([old._id]);
    assert.deepEqual(
      required(
        await second.base.readSnapshot(
          (scope) => scope.get('tests', 'a'),
          limits(),
        ),
      ),
      current,
    );
    heartbeatRelease.resolve();
    const done = second.committed(terminal);
    newRelease.resolve();
    await done;
  } finally {
    heartbeatRelease.resolve();
    oldRelease.resolve();
    newRelease.resolve();
  }
  required(await q1.stop(limits()));
  required(await q2.stop(limits()));
  const completed = required(await q2.get(secondJob.type, 'a', limits()));
  assert.equal(completed.attemptsUsed, 2);
  assert.equal(completed.attempts[0].reason, 'interrupted');
  assert.deepEqual(completed.result, { available: true, value: 42 });
  // Sealed callbacks are safe even after the old connection has been closed.
  await root.close();
  assert.ok(old?._id);
  await first.db.unlockJob(old);
  await first.db.unlockJobs([old._id]);
  await assert.rejects(first.db.saveJobState(old, {}), { code: 'stopping' });
  assert.deepEqual(
    required(await q2.get(secondJob.type, 'a', limits())),
    completed,
  );
});

for (const mode of ['single', 'bulk'] as const) {
  test(`production ${mode} unlock fences an unstarted reservation replaced by another consumer`, async (t) => {
    const initialSave = deferred<JobParameters>();
    const beginHeld = deferred();
    const beginRelease = deferred();
    const newEntered = deferred();
    const newRelease = deferred();
    const instances: Agenda[] = [];
    const define = Agenda.prototype.define;
    t.mock.method(
      Agenda.prototype,
      'define',
      function (this: Agenda, ...args: Parameters<Agenda['define']>) {
        if (!instances.length) {
          instances.push(this);
          const save = this.db.saveJobState.bind(this.db);
          t.mock.method(
            this.db,
            'saveJobState',
            async (...args: Parameters<typeof save>) => {
              initialSave.resolve({ ...args[0] });
              return save(...args);
            },
          );
        }
        return define.apply(this, args);
      },
    );
    const processing = agenda(1_000);
    const heldBegin: QueueAdapter = {
      ...processing,
      start: (input) =>
        processing.start({
          ...input,
          store: {
            reserve: (...args) => input.store.reserve(...args),
            begin: async (...args) => {
              beginHeld.resolve();
              await beginRelease.promise;
              return input.store.begin(...args);
            },
            touch: (...args) => input.store.touch(...args),
            release: (...args) => input.store.release(...args),
          },
        }),
    };
    const root = await fixture(t);
    const second = await open(root.path);
    t.after(() => second.close());
    let oldCalls = 0;
    const oldJob = job(async () => {
      oldCalls++;
      return 999;
    });
    const newJob = job(async () => {
      newEntered.resolve();
      await newRelease.promise;
      return 42;
    });
    const q1 = root.make(oldJob, heldBegin);
    const q2 = second.make(newJob, agenda(1_000));
    await enqueue(q1, oldJob);
    required(await q1.start(startOptions, limits()));
    try {
      await beginHeld.promise;
      const old = await initialSave.promise;
      const [first] = instances;
      assert.ok(first && old._id);
      required(await q2.start(startOptions, limits()));
      await newEntered.promise;
      const current = required(
        await second.base.readSnapshot(
          (scope) => scope.get('tests', 'a'),
          limits(),
        ),
      );
      if (mode === 'single') await first.db.unlockJob(old);
      else await first.db.unlockJobs([old._id]);
      assert.deepEqual(
        required(
          await second.base.readSnapshot(
            (scope) => scope.get('tests', 'a'),
            limits(),
          ),
        ),
        current,
      );
      beginRelease.resolve();
      const done = second.committed(terminal);
      newRelease.resolve();
      await done;
    } finally {
      beginRelease.resolve();
      newRelease.resolve();
    }
    required(await q1.stop(limits()));
    required(await q2.stop(limits()));
    const status = required(await q2.get(newJob.type, 'a', limits()));
    assert.equal(oldCalls, 0);
    assert.equal(status.attemptsUsed, 1);
    assert.deepEqual(status.result, { available: true, value: 42 });
  });
}
