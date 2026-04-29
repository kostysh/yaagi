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

void test('AC-F0026-06 treats blank release evidence root as default data subdirectory', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-core-config-release-evidence-'));
  const dataPath = path.join(root, 'data');

  const config = loadCoreRuntimeConfig({
    YAAGI_DATA_PATH: dataPath,
    YAAGI_RELEASE_EVIDENCE_ROOT: '',
  });

  assert.equal(config.dataPath, dataPath);
  assert.equal(config.releaseEvidenceRootPath, path.join(dataPath, 'release-evidence'));
});

void test('AC-F0029-03 AC-F0029-04 validates operator-only telegram egress config fail-closed', () => {
  assert.throws(
    () =>
      loadCoreRuntimeConfig({
        YAAGI_TELEGRAM_EGRESS_ENABLED: 'true',
        YAAGI_TELEGRAM_BOT_TOKEN: 'token',
        YAAGI_TELEGRAM_ALLOWED_CHAT_IDS: '12345',
      }),
    /YAAGI_TELEGRAM_OPERATOR_CHAT_ID/,
  );

  assert.throws(
    () =>
      loadCoreRuntimeConfig({
        YAAGI_TELEGRAM_EGRESS_ENABLED: 'true',
        YAAGI_TELEGRAM_BOT_TOKEN: 'token',
        YAAGI_TELEGRAM_OPERATOR_CHAT_ID: '12345',
        YAAGI_TELEGRAM_ALLOWED_CHAT_IDS: '999',
      }),
    /YAAGI_TELEGRAM_OPERATOR_CHAT_ID must be included/,
  );

  const config = loadCoreRuntimeConfig({
    YAAGI_TELEGRAM_EGRESS_ENABLED: 'true',
    YAAGI_TELEGRAM_BOT_TOKEN: 'token',
    YAAGI_TELEGRAM_OPERATOR_CHAT_ID: '12345',
    YAAGI_TELEGRAM_ALLOWED_CHAT_IDS: '12345',
  });

  assert.equal(config.telegramEnabled, false);
  assert.equal(config.telegramEgressEnabled, true);
  assert.equal(config.telegramOperatorChatId, '12345');
});
