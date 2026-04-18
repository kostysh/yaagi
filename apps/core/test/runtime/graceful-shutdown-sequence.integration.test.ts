import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTickRuntime,
  runGracefulShutdownSequence,
  type TickRuntimeStore,
} from '../../src/runtime/index.ts';

void test('AC-F0019-13 AC-F0019-14 AC-F0019-15 closes admission before wait and persists terminal shutdown evidence', async () => {
  const order: string[] = [];
  const evidence: Array<{
    shutdownEventId: string;
    shutdownState: string;
    admittedInFlightWork: Array<Record<string, unknown>>;
    terminalTickOutcome: Record<string, unknown>;
    flushedBufferResult: Record<string, unknown>;
    openConcerns: string[];
  }> = [];
  let activeWork = [
    {
      tickId: 'tick-active',
      requestId: 'request-active',
      tickKind: 'reactive',
      status: 'started',
      startedAt: '2026-04-15T12:00:00.000Z',
      leaseExpiresAt: '2026-04-15T12:01:00.000Z',
    },
  ];

  await runGracefulShutdownSequence({
    closeAdmission: () => {
      order.push('close-admission');
    },
    closeTickAdmission: () => {
      order.push('close-tick-admission');
      return Promise.resolve();
    },
    getSchemaVersion: () => {
      order.push('schema-version');
      return Promise.resolve('018_lifecycle_consolidation.sql');
    },
    listActiveTickWork: () => {
      order.push(`list-active:${activeWork.length}`);
      return Promise.resolve([...activeWork]);
    },
    recordShutdownEvidence: (input) => {
      order.push(`record:${input.shutdownState}`);
      evidence.push(input);
      return Promise.resolve();
    },
    stopWorkshopWorker: () => {
      order.push('stop-workshop');
      return Promise.resolve();
    },
    stopPeriodicHomeostatWorker: () => {
      order.push('stop-homeostat');
      return Promise.resolve();
    },
    stopPerceptionController: () => {
      order.push('stop-perception');
      return Promise.resolve();
    },
    stopRuntimeSkills: () => {
      order.push('stop-runtime-skills');
      return Promise.resolve();
    },
    stopTickRuntime: () => {
      order.push('stop-tick-runtime');
      activeWork = [];
      return Promise.resolve();
    },
    now: (() => {
      const values = ['2026-04-15T12:00:00.000Z', '2026-04-15T12:00:01.000Z'];
      return () => values.shift() ?? '2026-04-15T12:00:02.000Z';
    })(),
    createShutdownId: () => 'shutdown-test',
  });

  assert.deepEqual(order, [
    'close-admission',
    'close-tick-admission',
    'schema-version',
    'list-active:1',
    'record:shutting_down',
    'stop-workshop',
    'stop-homeostat',
    'stop-runtime-skills',
    'stop-perception',
    'stop-tick-runtime',
    'list-active:0',
    'record:completed',
  ]);
  assert.equal(evidence[0]?.shutdownEventId, 'shutdown-test:requested');
  assert.equal(evidence[0]?.admittedInFlightWork[0]?.['tickId'], 'tick-active');
  assert.equal(evidence[1]?.shutdownEventId, 'shutdown-test:completed');
  assert.deepEqual(evidence[1]?.terminalTickOutcome['remainingActiveTickIds'], []);
  assert.equal(evidence[1]?.flushedBufferResult['tickRuntime'], 'stopped');
  assert.deepEqual(evidence[1]?.openConcerns, []);
});

void test('AC-F0019-14 waits for in-progress tick admission before graceful-shutdown evidence snapshots active work', async () => {
  const order: string[] = [];
  const evidence: Array<{
    shutdownState: string;
    admittedInFlightWork: Array<Record<string, unknown>>;
  }> = [];
  let activeWork: Array<{
    tickId: string;
    requestId: string;
    tickKind: string;
    status: string;
    startedAt: string;
    leaseExpiresAt: string;
  }> = [];

  await runGracefulShutdownSequence({
    closeAdmission: () => {
      order.push('close-admission');
    },
    closeTickAdmission: async () => {
      order.push('close-tick-admission:start');
      activeWork = [
        {
          tickId: 'tick-race',
          requestId: 'request-race',
          tickKind: 'reactive',
          status: 'started',
          startedAt: '2026-04-15T12:00:00.000Z',
          leaseExpiresAt: '2026-04-15T12:01:00.000Z',
        },
      ];
      await Promise.resolve();
      order.push('close-tick-admission:done');
    },
    getSchemaVersion: () => Promise.resolve('018_lifecycle_consolidation.sql'),
    listActiveTickWork: () => {
      order.push(`list-active:${activeWork.length}`);
      return Promise.resolve([...activeWork]);
    },
    recordShutdownEvidence: (input) => {
      order.push(`record:${input.shutdownState}`);
      evidence.push(input);
      return Promise.resolve();
    },
    stopWorkshopWorker: () => Promise.resolve(),
    stopPeriodicHomeostatWorker: () => Promise.resolve(),
    stopPerceptionController: () => Promise.resolve(),
    stopRuntimeSkills: () => Promise.resolve(),
    stopTickRuntime: () => {
      activeWork = [];
      return Promise.resolve();
    },
    now: () => '2026-04-15T12:00:00.000Z',
    createShutdownId: () => 'shutdown-race',
  });

  assert.deepEqual(order.slice(0, 5), [
    'close-admission',
    'close-tick-admission:start',
    'close-tick-admission:done',
    'list-active:1',
    'record:shutting_down',
  ]);
  assert.equal(evidence[0]?.shutdownState, 'shutting_down');
  assert.equal(evidence[0]?.admittedInFlightWork[0]?.['tickId'], 'tick-race');
});

void test('AC-F0019-14 tick runtime closeAdmission waits for already-started admission writes', async () => {
  let releaseReactiveAdmission: (value: { accepted: true; tickId: string }) => void = () => {
    throw new Error('reactive admission release callback was not initialized');
  };
  let resolveReactiveAdmissionStarted = (): void => {
    throw new Error('reactive admission started callback was not initialized');
  };
  const reactiveAdmissionStarted = new Promise<void>((resolve) => {
    resolveReactiveAdmissionStarted = resolve;
  });
  let resolveReactiveExecution = (): void => {
    throw new Error('reactive execution callback was not initialized');
  };
  const reactiveExecution = new Promise<void>((resolve) => {
    resolveReactiveExecution = resolve;
  });
  const activeTickIds: string[] = [];
  const finishedTickIds: string[] = [];

  const store: TickRuntimeStore = {
    initialize: () => Promise.resolve(),
    reclaimStaleTicks: () => Promise.resolve(0),
    startTick: (input) => {
      if (input.kind === 'wake') {
        return Promise.resolve({ accepted: true, tickId: input.tickId });
      }

      resolveReactiveAdmissionStarted();
      return new Promise((resolve) => {
        releaseReactiveAdmission = (value) => {
          activeTickIds.push(value.tickId);
          resolve(value);
        };
      });
    },
    finishTick: (input) => {
      finishedTickIds.push(input.tickId);
      return Promise.resolve();
    },
  };

  const runtime = createTickRuntime({
    store,
    startupWakeRequestId: 'startup-wake:test',
    executeTick: async (input) => {
      if (input.kind === 'reactive') {
        await reactiveExecution;
      }

      return {
        status: 'completed',
      };
    },
    createId: (() => {
      let nextId = 0;
      return () => `tick-${++nextId}`;
    })(),
  });

  await runtime.start();

  const request = runtime.requestTick({
    requestId: 'reactive-race',
    kind: 'reactive',
    trigger: 'system',
    requestedAt: '2026-04-15T12:00:00.000Z',
    payload: {},
  });
  await reactiveAdmissionStarted;

  let admissionClosed = false;
  const closeAdmission = runtime.closeAdmission().then(() => {
    admissionClosed = true;
  });
  await Promise.resolve();
  assert.equal(admissionClosed, false);

  releaseReactiveAdmission({ accepted: true, tickId: 'tick-race' });
  await closeAdmission;
  assert.equal(admissionClosed, true);
  assert.deepEqual(activeTickIds, ['tick-race']);

  const rejected = await runtime.requestTick({
    requestId: 'reactive-after-close',
    kind: 'reactive',
    trigger: 'system',
    requestedAt: '2026-04-15T12:00:01.000Z',
    payload: {},
  });
  assert.deepEqual(rejected, {
    accepted: false,
    reason: 'boot_inactive',
  });

  resolveReactiveExecution();
  assert.deepEqual(await request, {
    accepted: true,
    tickId: 'tick-race',
  });
  assert.deepEqual(finishedTickIds, ['tick-1', 'tick-race']);
});
