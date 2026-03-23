import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  buildPerceptionTestConfig,
  createPerceptionTestWorkspace,
} from '../../testing/perception-config.ts';
import { loadCoreRuntimeConfig } from '../../src/platform/index.ts';

void test('AC-F0005-05 validates Telegram secrets and allowlist before enabling the adapter', async () => {
  const workspace = await createPerceptionTestWorkspace();

  try {
    const root = workspace.root;

    assert.throws(
      () =>
        loadCoreRuntimeConfig({
          YAAGI_POSTGRES_URL: 'postgres://yaagi:yaagi@127.0.0.1:5432/yaagi',
          YAAGI_FAST_MODEL_BASE_URL: 'http://127.0.0.1:8000/v1',
          YAAGI_SEED_ROOT_PATH: path.join(root, 'seed'),
          YAAGI_WORKSPACE_BODY_PATH: path.join(root, 'workspace/body'),
          YAAGI_WORKSPACE_SKILLS_PATH: path.join(root, 'workspace/skills'),
          YAAGI_MODELS_PATH: path.join(root, 'models'),
          YAAGI_DATA_PATH: path.join(root, 'data'),
          YAAGI_TELEGRAM_ENABLED: 'true',
          YAAGI_TELEGRAM_ALLOWED_CHAT_IDS: '12345',
        }),
      /YAAGI_TELEGRAM_BOT_TOKEN/,
    );

    assert.throws(
      () =>
        loadCoreRuntimeConfig({
          YAAGI_POSTGRES_URL: 'postgres://yaagi:yaagi@127.0.0.1:5432/yaagi',
          YAAGI_FAST_MODEL_BASE_URL: 'http://127.0.0.1:8000/v1',
          YAAGI_SEED_ROOT_PATH: path.join(root, 'seed'),
          YAAGI_WORKSPACE_BODY_PATH: path.join(root, 'workspace/body'),
          YAAGI_WORKSPACE_SKILLS_PATH: path.join(root, 'workspace/skills'),
          YAAGI_MODELS_PATH: path.join(root, 'models'),
          YAAGI_DATA_PATH: path.join(root, 'data'),
          YAAGI_TELEGRAM_ENABLED: 'true',
          YAAGI_TELEGRAM_BOT_TOKEN: 'token',
        }),
      /YAAGI_TELEGRAM_ALLOWED_CHAT_IDS/,
    );

    const config = {
      ...buildPerceptionTestConfig(root),
      telegramEnabled: true,
      telegramBotToken: 'token',
      telegramAllowedChatIds: ['12345'],
      telegramApiBaseUrl: 'http://127.0.0.1:8081',
    };

    assert.equal(config.telegramEnabled, true);
    assert.equal(config.telegramBotToken, 'token');
    assert.deepEqual(config.telegramAllowedChatIds, ['12345']);
  } finally {
    await workspace.cleanup();
  }
});
