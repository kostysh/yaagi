import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createVllmFastBaselineProfiles,
  loadCoreRuntimeConfig,
  loadVllmFastManifest,
} from '../../src/platform/index.ts';

const createManifestFixture = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'yaagi-vllm-fast-manifest-'));
  await mkdir(path.join(root, 'seed/models/base'), { recursive: true });
  await mkdir(path.join(root, 'models/base/vllm-fast'), { recursive: true });

  await writeFile(
    path.join(root, 'seed/models/base/vllm-fast-manifest.json'),
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
          dtype: 'bfloat16',
          tensorParallelSize: 1,
          maxModelLen: 16384,
          gpuMemoryUtilization: 0.82,
          maxNumSeqs: 4,
          generationConfig: 'vllm',
          attentionBackend: 'TRITON_ATTN',
          limitMmPerPrompt: '{"image":0,"audio":0}',
        },
        readinessProbe: {
          prompt: 'Reply with the single word READY.',
          expectedText: 'READY',
          maxTokens: 8,
          timeoutMs: 15000,
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

  return root;
};

void test('AC-F0020-07 loads the canonical vllm-fast descriptor and derives runtime-safe candidate paths', async () => {
  const root = await createManifestFixture();

  try {
    const config = loadCoreRuntimeConfig({
      YAAGI_SEED_ROOT_PATH: path.join(root, 'seed'),
      YAAGI_MODELS_PATH: path.join(root, 'models'),
    });
    const manifest = loadVllmFastManifest(config);

    assert.equal(manifest.serviceId, 'vllm-fast');
    assert.equal(manifest.preferredCandidate.modelId, 'google/gemma-4-E4B-it');
    assert.equal(
      manifest.descriptorUri,
      pathToFileURL(path.join(root, 'seed/models/base/vllm-fast-manifest.json')).toString(),
    );
    assert.equal(manifest.runtimeArtifactRootPath, path.join(root, 'models/base/vllm-fast'));
    assert.deepEqual(
      manifest.candidates.map((candidate) => candidate.selectionRole),
      ['preferred'],
    );
    assert.equal(
      manifest.candidates[0]?.runtimeArtifactPath,
      path.join(root, 'models/base/vllm-fast/google--gemma-4-E4B-it'),
    );
    assert.equal(
      manifest.candidates[0]?.runtimeArtifactUri,
      pathToFileURL(path.join(root, 'models/base/vllm-fast/google--gemma-4-E4B-it')).toString(),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0020-01 derives baseline profiles from the vllm-fast descriptor instead of an implicit model-fast placeholder', async () => {
  const root = await createManifestFixture();

  try {
    const config = loadCoreRuntimeConfig({
      YAAGI_FAST_MODEL_BASE_URL: 'http://vllm-fast:8000/v1',
      YAAGI_SEED_ROOT_PATH: path.join(root, 'seed'),
      YAAGI_MODELS_PATH: path.join(root, 'models'),
    });
    const profiles = createVllmFastBaselineProfiles(config);

    assert.equal(profiles.length, 3);
    assert.ok(profiles.every((profile) => profile.baseModel === 'google/gemma-4-E4B-it'));
    assert.ok(
      profiles.every(
        (profile) =>
          profile.artifactUri ===
          pathToFileURL(path.join(root, 'models/base/vllm-fast/google--gemma-4-E4B-it')).toString(),
      ),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0020-07 rejects descriptor candidate paths that escape the writable models root', async () => {
  const root = await createManifestFixture();

  try {
    await writeFile(
      path.join(root, 'seed/models/base/vllm-fast-manifest.json'),
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
          qualificationReportPath:
            '.dossier/verification/F-0020/vllm-fast-qualification-report.json',
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
            dtype: 'bfloat16',
            tensorParallelSize: 1,
            maxModelLen: 16384,
            gpuMemoryUtilization: 0.82,
            maxNumSeqs: 4,
            generationConfig: 'vllm',
            attentionBackend: 'TRITON_ATTN',
            limitMmPerPrompt: '{"image":0,"audio":0}',
          },
          readinessProbe: {
            prompt: 'Reply with the single word READY.',
            expectedText: 'READY',
            maxTokens: 8,
            timeoutMs: 15000,
          },
          candidates: [
            {
              candidateId: 'gemma-4-e4b-it',
              modelId: 'google/gemma-4-E4B-it',
              sourceUri: 'hf://google/gemma-4-E4B-it',
              selectionRole: 'preferred',
              runtimeSubdir: '../escape',
            },
          ],
        },
        null,
        2,
      ),
      'utf8',
    );

    const config = loadCoreRuntimeConfig({
      YAAGI_SEED_ROOT_PATH: path.join(root, 'seed'),
      YAAGI_MODELS_PATH: path.join(root, 'models'),
    });

    assert.throws(() => loadVllmFastManifest(config), /must stay inside the runtime models root/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0020-01 rejects silent re-expansion beyond the canonical Gemma-only candidate set', async () => {
  const root = await createManifestFixture();

  try {
    await writeFile(
      path.join(root, 'seed/models/base/vllm-fast-manifest.json'),
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
          qualificationReportPath:
            '.dossier/verification/F-0020/vllm-fast-qualification-report.json',
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
          candidates: [
            {
              candidateId: 'gemma-4-e4b-it',
              modelId: 'google/gemma-4-E4B-it',
              sourceUri: 'hf://google/gemma-4-E4B-it',
              selectionRole: 'preferred',
              runtimeSubdir: 'base/vllm-fast/google--gemma-4-E4B-it',
            },
            {
              candidateId: 'phi-4-mini-instruct',
              modelId: 'microsoft/Phi-4-mini-instruct',
              sourceUri: 'hf://microsoft/Phi-4-mini-instruct',
              selectionRole: 'preferred',
              runtimeSubdir: 'base/vllm-fast/microsoft--Phi-4-mini-instruct',
            },
          ],
        },
        null,
        2,
      ),
      'utf8',
    );

    const config = loadCoreRuntimeConfig({
      YAAGI_SEED_ROOT_PATH: path.join(root, 'seed'),
      YAAGI_MODELS_PATH: path.join(root, 'models'),
    });

    assert.throws(() => loadVllmFastManifest(config), /exactly one canonical candidate/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

void test('AC-F0020-07 rejects qualification paths that traverse outside the repository root after normalization', async () => {
  const root = await createManifestFixture();

  try {
    await writeFile(
      path.join(root, 'seed/models/base/vllm-fast-manifest.json'),
      JSON.stringify(
        {
          schemaVersion: '2026-04-17',
          serviceId: 'vllm-fast',
          selectionState: 'qualified',
          protocol: 'openai-compatible',
          preferredCandidateId: 'gemma-4-e4b-it',
          selectedCandidateId: 'gemma-4-e4b-it',
          runtimeArtifactRoot: 'base/vllm-fast',
          qualificationCorpusPath: 'tmp/../../outside-corpus.json',
          qualificationReportPath:
            '.dossier/verification/F-0020/vllm-fast-qualification-report.json',
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

    const config = loadCoreRuntimeConfig({
      YAAGI_SEED_ROOT_PATH: path.join(root, 'seed'),
      YAAGI_MODELS_PATH: path.join(root, 'models'),
    });

    assert.throws(
      () => loadVllmFastManifest(config),
      /qualificationCorpusPath must stay inside the repository root/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
