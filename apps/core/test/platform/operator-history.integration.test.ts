import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  RuntimeEpisodePageInput,
  RuntimeEpisodeRow,
  RuntimeTimelineEventPageInput,
  RuntimeTimelineEventRow,
} from '@yaagi/db';
import { createPlatformTestRuntime } from '../../testing/platform-test-fixture.ts';

const timelineRows: RuntimeTimelineEventRow[] = [
  {
    sequenceId: '12',
    eventId: 'event-12',
    eventType: 'tick.completed',
    occurredAt: '2026-03-25T10:02:00.000Z',
    subjectRef: 'tick-12',
    payloadJson: { result: 'ok-12' },
    createdAt: '2026-03-25T10:02:00.000Z',
  },
  {
    sequenceId: '11',
    eventId: 'event-11',
    eventType: 'tick.completed',
    occurredAt: '2026-03-25T10:01:00.000Z',
    subjectRef: 'tick-11',
    payloadJson: { result: 'ok-11' },
    createdAt: '2026-03-25T10:01:00.000Z',
  },
  {
    sequenceId: '10',
    eventId: 'event-10',
    eventType: 'tick.started',
    occurredAt: '2026-03-25T10:00:00.000Z',
    subjectRef: 'tick-10',
    payloadJson: { result: 'ok-10' },
    createdAt: '2026-03-25T10:00:00.000Z',
  },
];

const episodeRows: RuntimeEpisodeRow[] = [
  {
    episodeId: 'episode-3',
    tickId: 'tick-3',
    summary: 'episode 3',
    resultJson: { score: 3 },
    createdAt: '2026-03-25T10:02:00.000Z',
  },
  {
    episodeId: 'episode-2',
    tickId: 'tick-2',
    summary: 'episode 2',
    resultJson: { score: 2 },
    createdAt: '2026-03-25T10:01:00.000Z',
  },
  {
    episodeId: 'episode-1',
    tickId: 'tick-1',
    summary: 'episode 1',
    resultJson: { score: 1 },
    createdAt: '2026-03-25T10:00:00.000Z',
  },
];

void test('AC-F0013-03 returns stable timeline pagination with opaque cursors', async () => {
  const receivedInputs: RuntimeTimelineEventPageInput[] = [];
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        listTimelineEvents: (input) => {
          receivedInputs.push(input ?? {});
          if (input?.after?.sequenceId === '11') {
            return Promise.resolve(timelineRows.slice(2));
          }

          return Promise.resolve(timelineRows);
        },
      }),
    },
  });

  try {
    const firstResponse = await runtime.fetch(new Request('http://yaagi/timeline?limit=2'));
    assert.equal(firstResponse.status, 200);

    const firstPayload = (await firstResponse.json()) as {
      items: Array<{
        sequenceId: string;
        eventId: string;
        eventType: string;
        occurredAt: string;
        subjectRef: string;
        payload: Record<string, unknown>;
      }>;
      page: {
        limit: number;
        nextCursor: string | null;
        hasMore: boolean;
      };
    };

    assert.deepEqual(receivedInputs[0], { limit: 3 });
    assert.deepEqual(
      firstPayload.items.map((item) => item.sequenceId),
      ['12', '11'],
    );
    assert.equal(firstPayload.page.limit, 2);
    assert.equal(firstPayload.page.hasMore, true);
    const nextTimelineCursor = firstPayload.page.nextCursor;
    assert.ok(nextTimelineCursor);

    const secondResponse = await runtime.fetch(
      new Request(`http://yaagi/timeline?limit=2&cursor=${encodeURIComponent(nextTimelineCursor)}`),
    );
    assert.equal(secondResponse.status, 200);

    const secondPayload = (await secondResponse.json()) as {
      items: Array<{ sequenceId: string }>;
      page: { limit: number; nextCursor: string | null; hasMore: boolean };
    };

    assert.deepEqual(receivedInputs[1], {
      limit: 3,
      after: {
        occurredAt: '2026-03-25T10:01:00.000Z',
        sequenceId: '11',
      },
    });
    assert.deepEqual(
      secondPayload.items.map((item) => item.sequenceId),
      ['10'],
    );
    assert.equal(secondPayload.page.hasMore, false);
    assert.equal(secondPayload.page.nextCursor, null);
  } finally {
    await cleanup();
  }
});

void test('AC-F0013-03 returns stable episode pagination and bounded cursor validation', async () => {
  const receivedInputs: RuntimeEpisodePageInput[] = [];
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        listEpisodes: (input) => {
          receivedInputs.push(input ?? {});
          if (input?.after?.episodeId === 'episode-2') {
            return Promise.resolve(episodeRows.slice(2));
          }

          return Promise.resolve(episodeRows);
        },
      }),
    },
  });

  try {
    const firstResponse = await runtime.fetch(new Request('http://yaagi/episodes?limit=2'));
    assert.equal(firstResponse.status, 200);

    const firstPayload = (await firstResponse.json()) as {
      items: RuntimeEpisodeRow[];
      page: { limit: number; nextCursor: string | null; hasMore: boolean };
    };

    assert.deepEqual(receivedInputs[0], { limit: 3 });
    assert.deepEqual(
      firstPayload.items.map((item) => item.episodeId),
      ['episode-3', 'episode-2'],
    );
    assert.equal(firstPayload.page.hasMore, true);
    const nextEpisodeCursor = firstPayload.page.nextCursor;
    assert.ok(nextEpisodeCursor);

    const secondResponse = await runtime.fetch(
      new Request(`http://yaagi/episodes?limit=2&cursor=${encodeURIComponent(nextEpisodeCursor)}`),
    );
    assert.equal(secondResponse.status, 200);

    const secondPayload = (await secondResponse.json()) as {
      items: RuntimeEpisodeRow[];
      page: { limit: number; nextCursor: string | null; hasMore: boolean };
    };

    assert.deepEqual(receivedInputs[1], {
      limit: 3,
      after: {
        createdAt: '2026-03-25T10:01:00.000Z',
        episodeId: 'episode-2',
      },
    });
    assert.deepEqual(
      secondPayload.items.map((item) => item.episodeId),
      ['episode-1'],
    );
    assert.equal(secondPayload.page.hasMore, false);

    const invalidCursorResponse = await runtime.fetch(
      new Request('http://yaagi/episodes?cursor=not-base64'),
    );
    assert.equal(invalidCursorResponse.status, 400);
  } finally {
    await cleanup();
  }
});
