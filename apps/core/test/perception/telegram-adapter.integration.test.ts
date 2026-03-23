import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';
import { createPerceptionController } from '../../src/perception/index.ts';
import {
  buildPerceptionTestConfig,
  createPerceptionTestWorkspace,
} from '../../testing/perception-config.ts';
import { createPerceptionStoreHarness } from '../../testing/perception-store-harness.ts';

const startFakeTelegramApi = async (
  updates: unknown[] = [
    {
      update_id: 1,
      message: {
        message_id: 10,
        date: 1_773_590_400,
        text: 'hello from telegram',
        chat: {
          id: 12345,
          type: 'private',
        },
        from: {
          id: 100,
          username: 'operator',
        },
      },
    },
  ],
): Promise<{
  baseUrl: string;
  close(): Promise<void>;
}> => {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (url.pathname.endsWith('/getUpdates')) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          ok: true,
          result: updates,
        }),
      );
      return;
    }

    response.writeHead(404);
    response.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('failed to resolve fake telegram api address');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
};

void test('AC-F0005-02 normalizes Telegram long-poll updates into the canonical perception intake layer', async () => {
  const workspace = await createPerceptionTestWorkspace();
  const fakeApi = await startFakeTelegramApi();
  const storeHarness = createPerceptionStoreHarness();
  const controller = createPerceptionController({
    config: buildPerceptionTestConfig(workspace.root, {
      telegramEnabled: true,
      telegramBotToken: 'token',
      telegramAllowedChatIds: ['12345'],
      telegramApiBaseUrl: fakeApi.baseUrl,
    }),
    store: storeHarness.store,
    requestReactiveTick: () =>
      Promise.resolve({
        accepted: true,
        tickId: 'tick-telegram-1',
      }),
    createId: (() => {
      let step = 0;
      return () => `telegram-stimulus-${step++}`;
    })(),
  });

  try {
    await controller.start();
    await sleep(1_500);

    const rows = [...storeHarness.stimuli.values()];
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.sourceKind, 'telegram');
    assert.equal(rows[0]?.threadId, '12345');
    assert.equal(rows[0]?.dedupeKey, 'telegram:update:1');
    assert.equal(rows[0]?.normalizedJson.signalType, 'telegram.message');
  } finally {
    await controller.stop();
    await fakeApi.close();
    await workspace.cleanup();
  }
});

void test('AC-F0005-05 drops Telegram updates from chats outside the allowlist', async () => {
  const workspace = await createPerceptionTestWorkspace();
  const fakeApi = await startFakeTelegramApi([
    {
      update_id: 2,
      message: {
        message_id: 20,
        date: 1_773_590_500,
        text: 'blocked chat',
        chat: {
          id: 99999,
          type: 'private',
        },
        from: {
          id: 101,
          username: 'intruder',
        },
      },
    },
  ]);
  const storeHarness = createPerceptionStoreHarness();
  const controller = createPerceptionController({
    config: buildPerceptionTestConfig(workspace.root, {
      telegramEnabled: true,
      telegramBotToken: 'token',
      telegramAllowedChatIds: ['12345'],
      telegramApiBaseUrl: fakeApi.baseUrl,
    }),
    store: storeHarness.store,
    requestReactiveTick: () =>
      Promise.resolve({
        accepted: true,
        tickId: 'tick-telegram-blocked',
      }),
  });

  try {
    await controller.start();
    await sleep(1_500);

    const rows = [...storeHarness.stimuli.values()];
    assert.equal(rows.length, 0);
  } finally {
    await controller.stop();
    await fakeApi.close();
    await workspace.cleanup();
  }
});

void test('AC-F0005-02 keeps Telegram replay restart-safe through update_id dedupe across adapter restarts', async () => {
  const workspace = await createPerceptionTestWorkspace();
  const fakeApi = await startFakeTelegramApi();
  const storeHarness = createPerceptionStoreHarness();
  const config = buildPerceptionTestConfig(workspace.root, {
    telegramEnabled: true,
    telegramBotToken: 'token',
    telegramAllowedChatIds: ['12345'],
    telegramApiBaseUrl: fakeApi.baseUrl,
  });

  const createController = () =>
    createPerceptionController({
      config,
      store: storeHarness.store,
      requestReactiveTick: () =>
        Promise.resolve({
          accepted: true,
          tickId: 'tick-telegram-replay',
        }),
      createId: (() => {
        let step = 0;
        return () => `telegram-replay-${step++}`;
      })(),
    });

  const firstController = createController();
  const secondController = createController();

  try {
    await firstController.start();
    await sleep(1_500);
    await firstController.stop();

    await secondController.start();
    await sleep(1_500);

    const rows = [...storeHarness.stimuli.values()];
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.dedupeKey, 'telegram:update:1');
  } finally {
    await secondController.stop();
    await fakeApi.close();
    await workspace.cleanup();
  }
});
