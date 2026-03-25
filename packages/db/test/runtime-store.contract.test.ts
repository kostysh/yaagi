import test from 'node:test';
import assert from 'node:assert/strict';
import { createTickRuntimeStore, type RuntimeDbExecutor } from '../src/runtime.ts';

void test('AC-F0009-01 normalizes recent episode timestamps to ISO strings at the db boundary', async () => {
  const db: RuntimeDbExecutor = {
    query: () =>
      Promise.resolve({
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
        rows: [
          {
            episodeId: 'episode-1',
            tickId: 'tick-1',
            summary: 'bounded decision completed',
            resultJson: {},
            createdAt: new Date('2026-03-24T00:00:00.000Z'),
          },
        ],
      }) as never,
  };

  const store = createTickRuntimeStore(db);
  const rows = await store.listRecentEpisodes({ limit: 5 });

  assert.equal(rows[0]?.createdAt, '2026-03-24T00:00:00.000Z');
});

void test('AC-F0013-03 normalizes paged episode timestamps to ISO strings at the db boundary', async () => {
  const db: RuntimeDbExecutor = {
    query: () =>
      Promise.resolve({
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
        rows: [
          {
            episodeId: 'episode-2',
            tickId: 'tick-2',
            summary: 'operator page',
            resultJson: {},
            createdAt: new Date('2026-03-25T00:01:00.000Z'),
          },
        ],
      }) as never,
  };

  const store = createTickRuntimeStore(db);
  const rows = await store.listEpisodesPage({
    limit: 5,
    after: {
      createdAt: '2026-03-24T23:59:59.000Z',
      episodeId: 'episode-1',
    },
  });

  assert.equal(rows[0]?.createdAt, '2026-03-25T00:01:00.000Z');
});

void test('AC-F0013-03 normalizes paged timeline timestamps to ISO strings at the db boundary', async () => {
  const db: RuntimeDbExecutor = {
    query: () =>
      Promise.resolve({
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
        rows: [
          {
            sequenceId: '2',
            eventId: 'event-2',
            eventType: 'tick.completed',
            occurredAt: new Date('2026-03-25T00:02:00.000Z'),
            subjectRef: 'tick-2',
            payloadJson: {},
            createdAt: new Date('2026-03-25T00:02:00.000Z'),
          },
        ],
      }) as never,
  };

  const store = createTickRuntimeStore(db);
  const rows = await store.listTimelineEventsPage({
    limit: 5,
    after: {
      occurredAt: '2026-03-25T00:01:00.000Z',
      sequenceId: '1',
    },
  });

  assert.equal(rows[0]?.occurredAt, '2026-03-25T00:02:00.000Z');
  assert.equal(rows[0]?.createdAt, '2026-03-25T00:02:00.000Z');
});
