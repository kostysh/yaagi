import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { repoRoot } from '../helpers.ts';

const composeFile = path.join(repoRoot(), 'infra', 'docker', 'compose.yaml');
const envExampleFile = path.join(repoRoot(), '.env.example');

void test('AC-F0005-05 forwards YAAGI_TELEGRAM_* variables through the canonical local compose path', async () => {
  const composeText = await fs.readFile(composeFile, 'utf8');
  const envExampleText = await fs.readFile(envExampleFile, 'utf8');

  assert.match(composeText, /YAAGI_TELEGRAM_ENABLED:/);
  assert.match(composeText, /YAAGI_TELEGRAM_BOT_TOKEN:/);
  assert.match(composeText, /YAAGI_TELEGRAM_ALLOWED_CHAT_IDS:/);
  assert.match(composeText, /YAAGI_TELEGRAM_API_BASE_URL:/);
  assert.match(envExampleText, /YAAGI_TELEGRAM_ENABLED=false/);
  assert.match(envExampleText, /YAAGI_TELEGRAM_BOT_TOKEN=/);
  assert.match(envExampleText, /YAAGI_TELEGRAM_ALLOWED_CHAT_IDS=/);
});
