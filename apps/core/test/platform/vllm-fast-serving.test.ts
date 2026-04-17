import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createOptionalServingDependencyState,
  createVllmFastDependencyMonitor,
  probeTextMatchesExpected,
} from '../../src/platform/index.ts';

const createServingFixture = async (): Promise<{
  root: string;
  descriptorPath: string;
  modelsPath: string;
  snapshotPath: string;
}> => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-vllm-fast-serving-'));
  const descriptorPath = path.join(root, 'seed/models/base/vllm-fast-manifest.json');
  const modelsPath = path.join(root, 'models');
  const candidatePath = path.join(modelsPath, 'base/vllm-fast/google--gemma-4-E4B-it');
  const snapshotPath = path.join(candidatePath, 'snapshot');

  await mkdir(path.dirname(descriptorPath), { recursive: true });
  await mkdir(candidatePath, { recursive: true });
  await writeFile(
    descriptorPath,
    JSON.stringify(
      {
        schemaVersion: '2026-04-17',
        serviceId: 'vllm-fast',
        selectionState: 'qualified',
        protocol: 'openai-compatible',
        preferredCandidateId: 'gemma-4-e4b-it',
        selectedCandidateId: 'gemma-4-e4b-it',
        runtimeArtifactRoot: 'base/vllm-fast',
        qualificationCorpusPath: 'seed/models/base/vllm-fast-qualification-corpus.json',
        qualificationReportPath: '.dossier/verification/F-0020/vllm-fast-qualification-report.json',
        mustPassGates: [
          'canonical_container_boot',
          'real_inference_probe',
          'cold_start_stability',
          'warm_probe_stability',
          'structured_output_threshold',
          'descriptor_to_runtime_trace',
        ],
        scorecard: [
          { name: 'quality', weight: 40 },
          { name: 'latency_throughput', weight: 25 },
          { name: 'memory_headroom', weight: 20 },
          { name: 'stability_restart', weight: 15 },
        ],
        servingConfig: {
          servedModelName: 'phase-0-fast',
        },
        readinessProbe: {
          prompt: 'Reply with the single word READY.',
          expectedText: 'READY',
          maxTokens: 8,
          timeoutMs: 1000,
        },
        candidates: [
          {
            candidateId: 'gemma-4-e4b-it',
            modelId: 'google/gemma-4-E4B-it',
            sourceUri: 'hf://google/gemma-4-E4B-it',
            selectionRole: 'preferred',
            runtimeSubdir: 'base/vllm-fast/google--gemma-4-E4B-it',
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(snapshotPath, 'ready', 'utf8');
  await writeFile(
    path.join(candidatePath, 'materialization.json'),
    JSON.stringify(
      {
        candidateId: 'gemma-4-e4b-it',
        modelId: 'google/gemma-4-E4B-it',
        snapshotPath,
        servedModelName: 'phase-0-fast',
      },
      null,
      2,
    ),
    'utf8',
  );

  return { root, descriptorPath, modelsPath, snapshotPath };
};

void test('AC-F0020-08 / AC-F0020-09 / AC-F0020-11 keeps optional deep and pool dependencies explicit instead of silently promoting them', () => {
  const dependency = createOptionalServingDependencyState({
    serviceId: 'vllm-deep',
    endpoint: 'http://vllm-deep:8000/v1',
    artifactDescriptorPath: '/seed/models/shared/vllm-deep.json',
    runtimeArtifactRoot: '/models/base/vllm-deep',
    detail: 'optional diagnostics only until a future promotion seam exists',
  });

  assert.deepEqual(dependency, {
    serviceId: 'vllm-deep',
    endpoint: 'http://vllm-deep:8000/v1',
    bootCritical: false,
    optionalUntilPromoted: true,
    artifactUri: null,
    artifactDescriptorPath: '/seed/models/shared/vllm-deep.json',
    runtimeArtifactRoot: '/models/base/vllm-deep',
    readiness: 'unavailable',
    readinessBasis: 'transport_failed',
    candidateId: null,
    baseModel: null,
    servedModelName: null,
    detail: 'optional diagnostics only until a future promotion seam exists',
    lastCheckedAt: null,
  });
});

void test('AC-F0020-04 / AC-F0020-10 reprobes vllm-fast dependency truth instead of serving stale ready state after runtime artifact loss', async () => {
  const { root, descriptorPath, modelsPath, snapshotPath } = await createServingFixture();
  const originalFetch = globalThis.fetch;

  globalThis.fetch = () =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: 'READY',
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    );

  try {
    const monitor = createVllmFastDependencyMonitor({
      fastModelBaseUrl: 'http://127.0.0.1:8000/v1',
      fastModelDescriptorPath: descriptorPath,
      modelsPath,
    });

    const firstState = await monitor.getState();
    assert.equal(firstState.readiness, 'ready');
    assert.equal(firstState.readinessBasis, 'probe_passed');

    await unlink(snapshotPath);

    const secondState = await monitor.getState();
    assert.equal(secondState.readiness, 'degraded');
    assert.equal(secondState.readinessBasis, 'artifact_missing');
    assert.match(secondState.detail ?? '', /runtime snapshot path is missing/);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0020-04 requires a bounded readiness-token match instead of substring acceptance', () => {
  assert.equal(probeTextMatchesExpected('READY', 'READY'), true);
  assert.equal(probeTextMatchesExpected('"ready"', 'READY'), true);
  assert.equal(probeTextMatchesExpected('not ready', 'READY'), false);
  assert.equal(probeTextMatchesExpected('already ready', 'READY'), false);
});

void test('AC-F0020-04 marks the dependency degraded when the probe echoes a negative readiness phrase', async () => {
  const { root, descriptorPath, modelsPath } = await createServingFixture();
  const originalFetch = globalThis.fetch;

  globalThis.fetch = () =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: 'not ready',
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    );

  try {
    const monitor = createVllmFastDependencyMonitor({
      fastModelBaseUrl: 'http://127.0.0.1:8000/v1',
      fastModelDescriptorPath: descriptorPath,
      modelsPath,
    });

    const state = await monitor.getState();
    assert.equal(state.readiness, 'degraded');
    assert.equal(state.readinessBasis, 'probe_failed');
    assert.match(state.detail ?? '', /unexpected probe content: not ready/);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(root, { recursive: true, force: true });
  }
});
