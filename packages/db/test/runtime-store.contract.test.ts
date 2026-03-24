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
