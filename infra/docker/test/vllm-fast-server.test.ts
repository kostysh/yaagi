import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { run, repoRoot } from '../helpers.ts';

void test('F-0020 vllm-fast bootstrap fails closed when manifest selection is not qualified', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'yaagi-vllm-fast-server-'));
  const manifestPath = path.join(tempDir, 'manifest.json');
  const runtimeModelsRoot = path.join(tempDir, 'models');

  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        selectionState: 'qualification_pending',
      },
      null,
      2,
    ),
    'utf8',
  );

  const result = await run('python3', ['infra/docker/vllm-fast/server.py'], {
    cwd: repoRoot(),
    rejectOnNonZeroExitCode: false,
    env: {
      ...process.env,
      VLLM_FAST_MANIFEST_PATH: manifestPath,
      VLLM_FAST_RUNTIME_MODELS_ROOT: runtimeModelsRoot,
    },
  });

  assert.match(result.stderr, /selectionState=qualified, got qualification_pending/);
});

void test('F-0020 vllm-fast bootstrap rejects malformed qualified manifests', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'yaagi-vllm-fast-server-'));
  const manifestPath = path.join(tempDir, 'manifest.json');
  const runtimeModelsRoot = path.join(tempDir, 'models');

  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        selectionState: 'qualified',
        preferredCandidateId: 'gemma-4-e4b-it',
        selectedCandidateId: 'other-candidate',
        candidates: [
          {
            candidateId: 'gemma-4-e4b-it',
            modelId: 'google/gemma-4-E4B-it',
            runtimeSubdir: 'base/vllm-fast/google--gemma-4-E4B-it',
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  const result = await run('python3', ['infra/docker/vllm-fast/server.py'], {
    cwd: repoRoot(),
    rejectOnNonZeroExitCode: false,
    env: {
      ...process.env,
      VLLM_FAST_MANIFEST_PATH: manifestPath,
      VLLM_FAST_RUNTIME_MODELS_ROOT: runtimeModelsRoot,
    },
  });

  assert.match(result.stderr, /selectedCandidateId to match preferredCandidateId/);
});
