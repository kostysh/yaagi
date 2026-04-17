import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadCoreRuntimeConfig, loadVllmFastManifest } from '../../apps/core/src/platform/index.ts';
import { probeTextMatchesExpected } from '../../apps/core/src/platform/vllm-fast-serving.ts';
import { repoRoot, run } from './helpers.ts';

type CorpusTask = {
  taskId: string;
  kind: 'freeform' | 'json';
  messages: Array<{ role: 'user' | 'system' | 'assistant'; content: string }>;
  maxTokens: number;
  checks: Record<string, unknown>;
};

type QualificationCorpus = {
  schemaVersion: string;
  serviceId: 'vllm-fast';
  servedModelName: string;
  qualityTasks: CorpusTask[];
  structuredOutputGate: CorpusTask & {
    runs: number;
    requiredPassRate: number;
  };
};

type CandidateRunSummary = {
  candidateId: string;
  modelId: string;
  passedGates: boolean;
  gateResults: Record<string, boolean>;
  coldStartLatenciesMs: number[];
  warmLatenciesMs: number[];
  structuredPassRate: number;
  qualityPassRate: number;
  memoryUsedPercent: number | null;
  memoryHeadroomPercent: number | null;
  weightedScore: number;
  failureDetail: string | null;
};

const qualificationImage = 'yaagi-vllm-fast-qualification:latest';
const qualificationPort = 18000;
const containerNamePrefix = 'yaagi-vllm-fast-qualification';
const qualificationModelsDirEnv = 'YAAGI_VLLM_FAST_QUALIFICATION_MODELS_DIR';
const qualificationResetModelsEnv = 'YAAGI_VLLM_FAST_QUALIFICATION_RESET_MODELS';

const median = (values: number[]): number => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  if (sorted.length % 2 === 0) {
    const left = sorted[middle - 1];
    const right = sorted[middle];
    return typeof left === 'number' && typeof right === 'number'
      ? (left + right) / 2
      : Number.POSITIVE_INFINITY;
  }

  const value = sorted[middle];
  return typeof value === 'number' ? value : Number.POSITIVE_INFINITY;
};

const scoreBooleanChecks = (checks: boolean[]): number =>
  checks.length === 0 ? 0 : (checks.filter(Boolean).length / checks.length) * 100;

const withTrailingSlash = (value: string): string => (value.endsWith('/') ? value : `${value}/`);

const parseJsonSafely = (value: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

export const qualificationJsonChecksPass = (input: {
  parsed: Record<string, unknown>;
  task: CorpusTask;
}): { ok: boolean; detail: string | null } => {
  const requiredKeys = Array.isArray(input.task.checks['requiredKeys'])
    ? (input.task.checks['requiredKeys'] as string[])
    : [];
  if (requiredKeys.some((key) => !Object.hasOwn(input.parsed, key))) {
    return {
      ok: false,
      detail: `task ${input.task.taskId} missed required keys`,
    };
  }

  const allowedStatusValues = Array.isArray(input.task.checks['allowedStatusValues'])
    ? (input.task.checks['allowedStatusValues'] as string[])
    : [];
  if (allowedStatusValues.length > 0 && typeof input.parsed['status'] !== 'string') {
    return {
      ok: false,
      detail: `task ${input.task.taskId} returned a non-string status`,
    };
  }
  if (
    allowedStatusValues.length > 0 &&
    typeof input.parsed['status'] === 'string' &&
    !allowedStatusValues.includes(input.parsed['status'])
  ) {
    return {
      ok: false,
      detail: `task ${input.task.taskId} returned unexpected status`,
    };
  }

  const requiredTrueKeys = Array.isArray(input.task.checks['requiredTrueKeys'])
    ? (input.task.checks['requiredTrueKeys'] as string[])
    : [];
  if (requiredTrueKeys.some((key) => input.parsed[key] !== true)) {
    return {
      ok: false,
      detail: `task ${input.task.taskId} returned a non-true guard field`,
    };
  }

  const requiredStringKeys = Array.isArray(input.task.checks['requiredStringKeys'])
    ? (input.task.checks['requiredStringKeys'] as string[])
    : [];
  if (requiredStringKeys.some((key) => typeof input.parsed[key] !== 'string')) {
    return {
      ok: false,
      detail: `task ${input.task.taskId} returned a non-string field`,
    };
  }

  const requiredBooleanKeys = Array.isArray(input.task.checks['requiredBooleanKeys'])
    ? (input.task.checks['requiredBooleanKeys'] as string[])
    : [];
  if (requiredBooleanKeys.some((key) => typeof input.parsed[key] !== 'boolean')) {
    return {
      ok: false,
      detail: `task ${input.task.taskId} returned a non-boolean field`,
    };
  }

  if (
    typeof input.task.checks['expectedEcho'] === 'string' &&
    input.parsed['echo'] !== input.task.checks['expectedEcho']
  ) {
    return {
      ok: false,
      detail: `task ${input.task.taskId} returned unexpected echo`,
    };
  }

  return { ok: true, detail: null };
};

const getContainerState = async (
  containerName: string,
): Promise<{ running: boolean; status: string; exitCode: number | null; logs: string }> => {
  const [{ stdout: inspectStdout }, { stdout: logsStdout }] = await Promise.all([
    run('docker', ['inspect', containerName, '--format', '{{json .State}}'], {
      cwd: repoRoot(),
      rejectOnNonZeroExitCode: false,
    }),
    run('docker', ['logs', containerName], {
      cwd: repoRoot(),
      rejectOnNonZeroExitCode: false,
    }),
  ]);

  const parsed = parseJsonSafely(inspectStdout);
  return {
    running: parsed?.['Running'] === true,
    status: typeof parsed?.['Status'] === 'string' ? parsed['Status'] : 'missing',
    exitCode: typeof parsed?.['ExitCode'] === 'number' ? parsed['ExitCode'] : null,
    logs: logsStdout.trim(),
  };
};

const waitForChatReadiness = async (input: {
  baseUrl: string;
  servedModelName: string;
  timeoutMs: number;
  containerName: string;
}): Promise<number> => {
  const startedAt = Date.now();
  const deadline = startedAt + input.timeoutMs;
  let lastError = 'probe did not start';

  while (Date.now() <= deadline) {
    const attemptStartedAt = Date.now();
    const containerState = await getContainerState(input.containerName);
    if (!containerState.running) {
      const logTail = containerState.logs.split('\n').slice(-20).join('\n').trim();
      const detail = logTail.length > 0 ? `\n${logTail}` : '';
      throw new Error(
        `candidate container ${input.containerName} stopped with status=${containerState.status} exitCode=${containerState.exitCode ?? 'unknown'}${detail}`,
      );
    }
    try {
      const response = await fetch(new URL('chat/completions', withTrailingSlash(input.baseUrl)), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: input.servedModelName,
          temperature: 0,
          max_tokens: 8,
          messages: [
            {
              role: 'user',
              content: 'Reply with the single word READY.',
            },
          ],
        }),
      });
      if (response.ok) {
        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: string | null } }>;
        };
        const content = payload.choices?.[0]?.message?.content?.trim().toLowerCase() ?? '';
        if (probeTextMatchesExpected(content, 'READY')) {
          return Date.now() - startedAt;
        }
        lastError = `unexpected readiness content: ${content}`;
      } else {
        lastError = `readiness probe returned ${response.status}`;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    const elapsed = Date.now() - attemptStartedAt;
    await new Promise((resolve) => setTimeout(resolve, Math.max(250, 1000 - elapsed)));
  }

  throw new Error(lastError);
};

const runPrompt = async (input: {
  baseUrl: string;
  servedModelName: string;
  task: CorpusTask;
}): Promise<{ ok: boolean; latencyMs: number; detail: string | null }> => {
  const startedAt = Date.now();
  const response = await fetch(new URL('chat/completions', withTrailingSlash(input.baseUrl)), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: input.servedModelName,
      temperature: 0,
      max_tokens: input.task.maxTokens,
      ...(input.task.kind === 'json' ? { response_format: { type: 'json_object' } } : {}),
      messages: input.task.messages,
    }),
  });
  const latencyMs = Date.now() - startedAt;
  if (!response.ok) {
    return {
      ok: false,
      latencyMs,
      detail: `task ${input.task.taskId} returned ${response.status}`,
    };
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content?.trim() ?? '';
  if (input.task.kind === 'json') {
    const parsed = parseJsonSafely(content);
    if (!parsed) {
      return {
        ok: false,
        latencyMs,
        detail: `task ${input.task.taskId} returned non-json content`,
      };
    }
    const verdict = qualificationJsonChecksPass({
      parsed,
      task: input.task,
    });
    return { ok: verdict.ok, latencyMs, detail: verdict.detail };
  }

  const minLength =
    typeof input.task.checks['minLength'] === 'number' ? Number(input.task.checks['minLength']) : 0;
  const mustIncludeAny = Array.isArray(input.task.checks['mustIncludeAny'])
    ? (input.task.checks['mustIncludeAny'] as string[])
    : [];
  const normalized = content.toLowerCase();

  if (content.length < minLength) {
    return {
      ok: false,
      latencyMs,
      detail: `task ${input.task.taskId} returned too little content`,
    };
  }

  if (mustIncludeAny.length > 0 && !mustIncludeAny.some((token) => normalized.includes(token))) {
    return {
      ok: false,
      latencyMs,
      detail: `task ${input.task.taskId} missed required tokens`,
    };
  }

  return { ok: true, latencyMs, detail: null };
};

const getMemoryUsedPercent = async (): Promise<number | null> => {
  const { stdout } = await run('/opt/rocm/bin/rocm-smi', ['--showmemuse', '--json'], {
    cwd: repoRoot(),
    rejectOnNonZeroExitCode: false,
  });
  if (!stdout.trim()) {
    return null;
  }
  const parsed = JSON.parse(stdout) as Record<string, Record<string, string>>;
  const firstCard = Object.values(parsed)[0];
  if (!firstCard) {
    return null;
  }
  const raw = firstCard['GPU Memory Allocated (VRAM%)'];
  const parsedPercent = Number(raw);
  return Number.isFinite(parsedPercent) ? parsedPercent : null;
};

const removeContainer = async (containerName: string): Promise<void> => {
  await run('docker', ['rm', '-f', containerName], {
    cwd: repoRoot(),
    rejectOnNonZeroExitCode: false,
  });
};

const startCandidateContainer = async (input: {
  containerName: string;
  modelsDir: string;
  candidateId: string;
}): Promise<void> => {
  const hfTokenFile = process.env['YAAGI_HF_TOKEN_FILE']?.trim();
  await removeContainer(input.containerName);
  await run(
    'docker',
    [
      'run',
      '--detach',
      '--name',
      input.containerName,
      '--read-only',
      '--group-add=video',
      '--group-add=render',
      '--cap-drop=ALL',
      '--cap-add=DAC_OVERRIDE',
      '--security-opt',
      'seccomp=unconfined',
      '--security-opt',
      'no-new-privileges:true',
      '--device',
      '/dev/kfd',
      '--device',
      '/dev/dri',
      '--ipc=host',
      '--tmpfs',
      '/tmp:exec,mode=1777',
      '--ulimit',
      'memlock=-1',
      '--ulimit',
      'stack=67108864',
      '--publish',
      `127.0.0.1:${qualificationPort}:8000`,
      '--volume',
      `${path.join(repoRoot(), 'seed')}:/seed:ro`,
      '--volume',
      `${input.modelsDir}:/models`,
      ...(hfTokenFile ? ['--volume', `${hfTokenFile}:/run/secrets/yaagi_hf_token:ro`] : []),
      '--env',
      'HOME=/models/.home',
      '--env',
      'VLLM_FAST_MANIFEST_PATH=/seed/models/base/vllm-fast-manifest.json',
      '--env',
      'VLLM_FAST_RUNTIME_MODELS_ROOT=/models',
      '--env',
      'XDG_CACHE_HOME=/models/.cache',
      '--env',
      'XDG_CONFIG_HOME=/models/.config',
      '--env',
      'HF_HOME=/models/.hf-cache',
      '--env',
      'HF_HUB_CACHE=/models/.hf-cache/hub',
      '--env',
      'HF_XET_CACHE=/models/.hf-cache/xet',
      '--env',
      'TRITON_CACHE_DIR=/models/.cache/triton',
      '--env',
      'TORCHINDUCTOR_CACHE_DIR=/models/.cache/torchinductor',
      '--env',
      'VLLM_CACHE_ROOT=/models/.cache/vllm',
      '--env',
      'VLLM_CONFIG_ROOT=/models/.config/vllm',
      '--env',
      `VLLM_FAST_SELECTED_CANDIDATE_ID=${input.candidateId}`,
      ...(hfTokenFile ? ['--env', 'YAAGI_HF_TOKEN_FILE=/run/secrets/yaagi_hf_token'] : []),
      qualificationImage,
    ],
    {
      cwd: repoRoot(),
    },
  );
};

const stopCandidateContainer = async (containerName: string): Promise<void> => {
  await removeContainer(containerName);
};

const clearModelsDir = async (modelsDir: string): Promise<void> => {
  await run(
    'docker',
    [
      'run',
      '--rm',
      '--volume',
      `${modelsDir}:/models`,
      '--entrypoint',
      'sh',
      qualificationImage,
      '-lc',
      'rm -rf /models/* /models/.[!.]* /models/..?* 2>/dev/null || true',
    ],
    {
      cwd: repoRoot(),
      rejectOnNonZeroExitCode: false,
    },
  );
};

const qualifyCandidate = async (input: {
  modelsDir: string;
  candidateId: string;
  modelId: string;
  servedModelName: string;
  corpus: QualificationCorpus;
}): Promise<CandidateRunSummary> => {
  const containerName = `${containerNamePrefix}-${input.candidateId}`;
  const baseUrl = `http://127.0.0.1:${qualificationPort}/v1`;
  const coldStartLatenciesMs: number[] = [];
  const warmLatenciesMs: number[] = [];
  const gateResults: Record<string, boolean> = {
    canonical_container_boot: false,
    real_inference_probe: false,
    cold_start_stability: false,
    warm_probe_stability: false,
    structured_output_threshold: false,
    descriptor_to_runtime_trace: false,
  };

  try {
    if (input.corpus.qualityTasks.length === 0) {
      throw new Error('qualification corpus must define at least one quality task');
    }

    for (let index = 0; index < 3; index += 1) {
      await startCandidateContainer({
        containerName,
        modelsDir: input.modelsDir,
        candidateId: input.candidateId,
      });
      const coldStartLatency = await waitForChatReadiness({
        baseUrl,
        servedModelName: input.servedModelName,
        timeoutMs: 20 * 60_000,
        containerName,
      });
      coldStartLatenciesMs.push(coldStartLatency);
      await stopCandidateContainer(containerName);
    }

    gateResults['canonical_container_boot'] = coldStartLatenciesMs.length === 3;
    gateResults['real_inference_probe'] = coldStartLatenciesMs.length === 3;
    gateResults['cold_start_stability'] = coldStartLatenciesMs.length === 3;

    await startCandidateContainer({
      containerName,
      modelsDir: input.modelsDir,
      candidateId: input.candidateId,
    });
    await waitForChatReadiness({
      baseUrl,
      servedModelName: input.servedModelName,
      timeoutMs: 20 * 60_000,
      containerName,
    });

    const warmResults = [];
    for (let index = 0; index < 20; index += 1) {
      const task = input.corpus.qualityTasks[index % input.corpus.qualityTasks.length];
      if (!task) {
        throw new Error('qualification corpus task selection failed');
      }

      const result = await runPrompt({
        baseUrl,
        servedModelName: input.servedModelName,
        task,
      });
      warmLatenciesMs.push(result.latencyMs);
      warmResults.push(result.ok);
    }
    gateResults['warm_probe_stability'] = warmResults.every(Boolean);

    const structuredResults: boolean[] = [];
    for (let index = 0; index < input.corpus.structuredOutputGate.runs; index += 1) {
      const result = await runPrompt({
        baseUrl,
        servedModelName: input.servedModelName,
        task: input.corpus.structuredOutputGate,
      });
      structuredResults.push(result.ok);
      warmLatenciesMs.push(result.latencyMs);
    }

    const structuredPassRate = structuredResults.filter(Boolean).length / structuredResults.length;
    gateResults['structured_output_threshold'] =
      structuredPassRate >= input.corpus.structuredOutputGate.requiredPassRate;

    const materializationPath = path.join(
      input.modelsDir,
      'base',
      'vllm-fast',
      input.modelId.replace('/', '--'),
      'materialization.json',
    );
    gateResults['descriptor_to_runtime_trace'] = !!(await readFile(
      materializationPath,
      'utf8',
    ).catch(() => null));

    const qualityChecks = await Promise.all(
      input.corpus.qualityTasks.map((task) =>
        runPrompt({
          baseUrl,
          servedModelName: input.servedModelName,
          task,
        }),
      ),
    );
    const qualityPassRate =
      qualityChecks.filter((result) => result.ok).length / qualityChecks.length;
    warmLatenciesMs.push(...qualityChecks.map((result) => result.latencyMs));

    const memoryUsedPercent = await getMemoryUsedPercent();
    const memoryHeadroomPercent =
      memoryUsedPercent === null ? null : Math.max(0, 100 - memoryUsedPercent);

    return {
      candidateId: input.candidateId,
      modelId: input.modelId,
      passedGates: Object.values(gateResults).every(Boolean),
      gateResults,
      coldStartLatenciesMs,
      warmLatenciesMs,
      structuredPassRate,
      qualityPassRate,
      memoryUsedPercent,
      memoryHeadroomPercent,
      weightedScore: 0,
      failureDetail: null,
    };
  } catch (error) {
    return {
      candidateId: input.candidateId,
      modelId: input.modelId,
      passedGates: false,
      gateResults,
      coldStartLatenciesMs,
      warmLatenciesMs,
      structuredPassRate: 0,
      qualityPassRate: 0,
      memoryUsedPercent: null,
      memoryHeadroomPercent: null,
      weightedScore: 0,
      failureDetail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await stopCandidateContainer(containerName);
  }
};

const normalizeHigherIsBetter = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (max === min) {
    return 100;
  }
  return ((value - min) / (max - min)) * 100;
};

const normalizeLowerIsBetter = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (max === min) {
    return 100;
  }
  return ((max - value) / (max - min)) * 100;
};

const computeWeightedScores = (results: CandidateRunSummary[]): CandidateRunSummary[] => {
  const warmMedians = results.map((result) => median(result.warmLatenciesMs));
  const coldMedians = results.map((result) => median(result.coldStartLatenciesMs));
  const headrooms = results.map((result) => result.memoryHeadroomPercent ?? 0);
  const minWarm = Math.min(...warmMedians);
  const maxWarm = Math.max(...warmMedians);
  const minCold = Math.min(...coldMedians);
  const maxCold = Math.max(...coldMedians);
  const minHeadroom = Math.min(...headrooms);
  const maxHeadroom = Math.max(...headrooms);

  return results.map((result) => {
    const qualityScore = result.qualityPassRate * 100;
    const latencyScore =
      normalizeLowerIsBetter(median(result.warmLatenciesMs), minWarm, maxWarm) * 0.7 +
      normalizeLowerIsBetter(median(result.coldStartLatenciesMs), minCold, maxCold) * 0.3;
    const memoryScore = normalizeHigherIsBetter(
      result.memoryHeadroomPercent ?? 0,
      minHeadroom,
      maxHeadroom,
    );
    const stabilityScore =
      scoreBooleanChecks(Object.values(result.gateResults)) * 0.6 +
      result.structuredPassRate * 100 * 0.4;

    return {
      ...result,
      weightedScore:
        qualityScore * 0.4 + latencyScore * 0.25 + memoryScore * 0.2 + stabilityScore * 0.15,
    };
  });
};

async function main(): Promise<void> {
  const config = loadCoreRuntimeConfig({
    ...process.env,
    YAAGI_SEED_ROOT_PATH: process.env['YAAGI_SEED_ROOT_PATH'] ?? path.join(repoRoot(), 'seed'),
    YAAGI_MODELS_PATH: process.env['YAAGI_MODELS_PATH'] ?? path.join(repoRoot(), 'models'),
  });
  const manifest = loadVllmFastManifest(config);
  const corpusPath = path.resolve(
    repoRoot(),
    manifest.qualificationCorpusPath ?? 'seed/models/base/vllm-fast-qualification-corpus.json',
  );
  const corpus = JSON.parse(await readFile(corpusPath, 'utf8')) as QualificationCorpus;
  assert.equal(corpus.servedModelName, manifest.servingConfig.servedModelName);

  await run(
    'docker',
    ['build', '-f', 'infra/docker/vllm-fast/Dockerfile', '-t', qualificationImage, '.'],
    {
      cwd: repoRoot(),
      env: {
        ...process.env,
        DOCKER_BUILDKIT: '0',
      },
    },
  );

  const explicitModelsDir = process.env[qualificationModelsDirEnv]?.trim() ?? '';
  const modelsDir =
    explicitModelsDir.length > 0
      ? path.resolve(explicitModelsDir)
      : path.join(os.homedir(), '.cache', 'yaagi-vllm-fast-qualification-models');
  const ownsModelsDir = false;
  await mkdir(modelsDir, { recursive: true });
  try {
    if (process.env[qualificationResetModelsEnv]?.trim() === '1') {
      await clearModelsDir(modelsDir);
    }

    const [candidate] = manifest.candidates;
    assert.ok(candidate, 'vllm-fast manifest must declare one canonical candidate');

    const result = computeWeightedScores([
      await qualifyCandidate({
        modelsDir,
        candidateId: candidate.candidateId,
        modelId: candidate.modelId,
        servedModelName: manifest.servingConfig.servedModelName,
        corpus,
      }),
    ])[0];
    assert.ok(result, 'qualification run must produce one candidate summary');

    const selectedCandidateId = result.passedGates ? result.candidateId : null;
    const report = {
      schemaVersion: '2026-04-17',
      serviceId: manifest.serviceId,
      manifestDescriptorPath: manifest.descriptorPath,
      manifestDescriptorUri: manifest.descriptorUri,
      generatedAt: new Date().toISOString(),
      selectedCandidateId,
      selectionState: selectedCandidateId ? 'qualified' : 'no_winner',
      results: [result],
    };

    const reportPath = path.resolve(
      repoRoot(),
      manifest.qualificationReportPath ??
        '.dossier/verification/F-0020/vllm-fast-qualification-report.json',
    );
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ reportPath, selectedCandidateId }, null, 2));
  } finally {
    if (ownsModelsDir) {
      await rm(modelsDir, { recursive: true, force: true });
    }
  }
}

const executedAsScript =
  typeof process.argv[1] === 'string' &&
  pathToFileURL(path.resolve(process.argv[1])).toString() === import.meta.url;

if (executedAsScript) {
  void main();
}
