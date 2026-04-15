import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadCoreRuntimeConfig } from '../../src/platform/core-config.ts';

void test('AC-F0018-10 reads telegram bot token from an external secret file when direct env is absent', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-core-config-'));
  const secretFile = path.join(root, 'telegram-bot-token.txt');
  await mkdir(path.join(root, 'seed', 'constitution'), { recursive: true });
  await writeFile(secretFile, 'bot-secret-from-file\n', 'utf8');

  const config = loadCoreRuntimeConfig({
    YAAGI_SEED_ROOT_PATH: path.join(root, 'seed'),
    YAAGI_TELEGRAM_ENABLED: 'true',
    YAAGI_TELEGRAM_BOT_TOKEN_FILE: secretFile,
    YAAGI_TELEGRAM_ALLOWED_CHAT_IDS: '12345',
  });

  assert.equal(config.telegramBotToken, 'bot-secret-from-file');
});

void test('AC-F0018-10 rejects empty external secret files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-core-config-empty-'));
  const secretFile = path.join(root, 'telegram-bot-token.txt');
  await mkdir(path.join(root, 'seed', 'constitution'), { recursive: true });
  await writeFile(secretFile, '\n', 'utf8');

  assert.throws(
    () =>
      loadCoreRuntimeConfig({
        YAAGI_SEED_ROOT_PATH: path.join(root, 'seed'),
        YAAGI_TELEGRAM_ENABLED: 'true',
        YAAGI_TELEGRAM_BOT_TOKEN_FILE: secretFile,
        YAAGI_TELEGRAM_ALLOWED_CHAT_IDS: '12345',
      }),
    /empty secret file/i,
  );
});
