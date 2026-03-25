import test from 'node:test';
import assert from 'node:assert/strict';
import { createHomeostatService } from '../../src/runtime/index.ts';
import { createBaseHomeostatContext } from '../../testing/homeostat-fixture.ts';

void test('AC-F0012-08 keeps homeostat outputs advisory and does not encode direct foreign-table mutations', async () => {
  const persistedSnapshots: Array<Record<string, unknown>> = [];
  const enqueued: Array<Record<string, unknown>> = [];

  const service = createHomeostatService({
    createId: (() => {
      let index = 0;
      return () => `id-${++index}`;
    })(),
    loadContext: (input) =>
      Promise.resolve(
        createBaseHomeostatContext({
          cadenceKind: input.cadenceKind,
          tickId: input.tickId,
          createdAt: input.createdAt,
        }),
      ),
    loadLatestSnapshot: () => Promise.resolve(null),
    persistSnapshot: (snapshot) => {
      persistedSnapshots.push(snapshot as unknown as Record<string, unknown>);
      return Promise.resolve();
    },
    updateReactionRequestRefs: () => Promise.resolve(),
    enqueueReactionRequest: (request) => {
      enqueued.push(request as unknown as Record<string, unknown>);
      return Promise.resolve();
    },
  });

  await service.evaluateTickComplete({
    tickId: 'tick-homeostat-authority',
    createdAt: '2026-03-25T12:20:00.000Z',
  });

  assert.ok(
    persistedSnapshots.every(
      (snapshot) =>
        !Object.hasOwn(snapshot, 'psmJson') &&
        !Object.hasOwn(snapshot, 'goals') &&
        !Object.hasOwn(snapshot, 'beliefs') &&
        !Object.hasOwn(snapshot, 'actionLog'),
    ),
  );
  assert.ok(
    enqueued.every(
      (request) =>
        !Object.hasOwn(request, 'psmJson') &&
        !Object.hasOwn(request, 'goals') &&
        !Object.hasOwn(request, 'beliefs') &&
        !Object.hasOwn(request, 'developmentFreeze'),
    ),
  );
});
