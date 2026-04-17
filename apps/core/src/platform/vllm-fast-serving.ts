import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  ServingDependencyReadiness,
  ServingDependencyReadinessBasis,
  ServingDependencyServiceId,
  ServingDependencyState,
} from '@yaagi/contracts/models';
import type { CoreRuntimeConfig } from './core-config.ts';
import {
  loadVllmFastManifest,
  type VllmFastManifest,
  type VllmFastManifestCandidate,
} from './vllm-fast-manifest.ts';

type MaterializationRecord = {
  candidateId: string;
  modelId: string;
  snapshotPath: string;
  servedModelName: string;
};

type ProbeResult = {
  readiness: ServingDependencyReadiness;
  readinessBasis: ServingDependencyReadinessBasis;
  detail: string | null;
};

const DEFAULT_VLLM_FAST_STATE_CACHE_TTL_MS = 5_000;

const normalizeBoundedProbeText = (value: string): string =>
  value
    .trim()
    .replace(/^[\s"'`([{<]+|[\s"'`)\]}>.,!?;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

export const probeTextMatchesExpected = (value: string, expectedText: string): boolean =>
  normalizeBoundedProbeText(value) === normalizeBoundedProbeText(expectedText);

const fileExists = async (targetPath: string): Promise<boolean> => {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const createBaseState = (input: {
  manifest: VllmFastManifest;
  candidate: VllmFastManifestCandidate | null;
  artifactUri?: string | null;
  readiness: ServingDependencyReadiness;
  readinessBasis: ServingDependencyReadinessBasis;
  detail: string | null;
  lastCheckedAt?: string | null;
}): ServingDependencyState => ({
  serviceId: input.manifest.serviceId,
  endpoint: '',
  bootCritical: true,
  optionalUntilPromoted: false,
  artifactUri: input.artifactUri ?? input.candidate?.runtimeArtifactUri ?? null,
  artifactDescriptorPath: input.manifest.descriptorPath,
  runtimeArtifactRoot: input.manifest.runtimeArtifactRootPath,
  readiness: input.readiness,
  readinessBasis: input.readinessBasis,
  candidateId: input.candidate?.candidateId ?? null,
  baseModel: input.candidate?.modelId ?? null,
  servedModelName: input.manifest.servingConfig.servedModelName,
  detail: input.detail,
  lastCheckedAt: input.lastCheckedAt ?? null,
});

const loadMaterializationRecord = async (
  candidate: VllmFastManifestCandidate,
): Promise<MaterializationRecord | null> => {
  const materializationPath = path.join(candidate.runtimeArtifactPath, 'materialization.json');
  if (!(await fileExists(materializationPath))) {
    return null;
  }

  const raw = JSON.parse(await readFile(materializationPath, 'utf8')) as Record<string, unknown>;
  const candidateId =
    typeof raw['candidateId'] === 'string' && raw['candidateId'].length > 0
      ? raw['candidateId']
      : null;
  const modelId =
    typeof raw['modelId'] === 'string' && raw['modelId'].length > 0 ? raw['modelId'] : null;
  const snapshotPath =
    typeof raw['snapshotPath'] === 'string' && raw['snapshotPath'].length > 0
      ? raw['snapshotPath']
      : null;
  const servedModelName =
    typeof raw['servedModelName'] === 'string' && raw['servedModelName'].length > 0
      ? raw['servedModelName']
      : null;

  if (!candidateId || !modelId || !snapshotPath || !servedModelName) {
    return null;
  }

  return {
    candidateId,
    modelId,
    snapshotPath,
    servedModelName,
  };
};

export const createOptionalServingDependencyState = (input: {
  serviceId: Extract<ServingDependencyServiceId, 'vllm-deep' | 'vllm-pool'>;
  endpoint: string;
  artifactDescriptorPath: string;
  runtimeArtifactRoot: string;
  detail: string;
}): ServingDependencyState => ({
  serviceId: input.serviceId,
  endpoint: input.endpoint,
  bootCritical: false,
  optionalUntilPromoted: true,
  artifactUri: null,
  artifactDescriptorPath: input.artifactDescriptorPath,
  runtimeArtifactRoot: input.runtimeArtifactRoot,
  readiness: 'unavailable',
  readinessBasis: 'transport_failed',
  candidateId: null,
  baseModel: null,
  servedModelName: null,
  detail: input.detail,
  lastCheckedAt: null,
});

export const probeVllmFastTransport = async (
  baseUrl: string,
  timeoutMs = 1_500,
): Promise<boolean> => {
  const target = new URL(baseUrl);
  target.pathname = '/health';
  target.search = '';
  target.hash = '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(target, {
      method: 'GET',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

export const probeVllmFastInference = async (input: {
  baseUrl: string;
  manifest: VllmFastManifest;
}): Promise<ProbeResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.manifest.readinessProbe.timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(new URL('chat/completions', `${input.baseUrl}/`), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: input.manifest.servingConfig.servedModelName,
        temperature: 0,
        max_tokens: input.manifest.readinessProbe.maxTokens,
        messages: [
          {
            role: 'system',
            content: 'You are a readiness probe. Follow the instruction exactly.',
          },
          {
            role: 'user',
            content: input.manifest.readinessProbe.prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      return {
        readiness: 'unavailable',
        readinessBasis: response.status >= 500 ? 'transport_failed' : 'probe_failed',
        detail: `model-fast probe returned ${response.status}`,
      };
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
        };
      }>;
    };
    const content = payload.choices?.[0]?.message?.content?.trim() ?? '';
    if (!probeTextMatchesExpected(content, input.manifest.readinessProbe.expectedText)) {
      return {
        readiness: 'degraded',
        readinessBasis: 'probe_failed',
        detail: content.length > 0 ? `unexpected probe content: ${content}` : 'empty probe content',
      };
    }

    return {
      readiness: 'ready',
      readinessBasis: 'probe_passed',
      detail: `probe passed in ${Date.now() - startedAt}ms`,
    };
  } catch (error) {
    return {
      readiness: 'unavailable',
      readinessBasis: 'transport_failed',
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
};

const evaluateVllmFastDependencyState = async (
  config: Pick<CoreRuntimeConfig, 'fastModelBaseUrl' | 'fastModelDescriptorPath' | 'modelsPath'>,
): Promise<ServingDependencyState> => {
  let manifest: VllmFastManifest;

  try {
    manifest = loadVllmFastManifest(config);
  } catch (error) {
    return {
      serviceId: 'vllm-fast',
      endpoint: config.fastModelBaseUrl,
      bootCritical: true,
      optionalUntilPromoted: false,
      artifactUri: null,
      artifactDescriptorPath: path.resolve(config.fastModelDescriptorPath),
      runtimeArtifactRoot: path.resolve(config.modelsPath, 'base/vllm-fast'),
      readiness: 'unavailable',
      readinessBasis: 'descriptor_invalid',
      candidateId: null,
      baseModel: null,
      servedModelName: null,
      detail: error instanceof Error ? error.message : String(error),
      lastCheckedAt: new Date().toISOString(),
    };
  }

  const candidate = manifest.selectedCandidate ?? manifest.preferredCandidate;
  if (manifest.selectionState === 'no_winner' || !candidate) {
    return {
      ...createBaseState({
        manifest,
        candidate,
        readiness: 'unavailable',
        readinessBasis: 'descriptor_invalid',
        detail:
          manifest.selectionState === 'no_winner'
            ? 'manifest reports selectionState=no_winner'
            : 'manifest does not resolve a canonical candidate',
        lastCheckedAt: new Date().toISOString(),
      }),
      endpoint: config.fastModelBaseUrl,
    };
  }

  const materialization = await loadMaterializationRecord(candidate);
  if (!materialization) {
    return {
      ...createBaseState({
        manifest,
        candidate,
        readiness: 'warming',
        readinessBasis: 'artifact_missing',
        detail: 'runtime artifact has not been materialized yet',
        lastCheckedAt: new Date().toISOString(),
      }),
      endpoint: config.fastModelBaseUrl,
    };
  }

  if (
    materialization.candidateId !== candidate.candidateId ||
    materialization.modelId !== candidate.modelId
  ) {
    return {
      ...createBaseState({
        manifest,
        candidate,
        readiness: 'degraded',
        readinessBasis: 'artifact_missing',
        detail: 'materialization record does not match the selected candidate identity',
        lastCheckedAt: new Date().toISOString(),
      }),
      endpoint: config.fastModelBaseUrl,
      servedModelName: materialization.servedModelName,
    };
  }

  if (!(await fileExists(materialization.snapshotPath))) {
    return {
      ...createBaseState({
        manifest,
        candidate,
        readiness: 'degraded',
        readinessBasis: 'artifact_missing',
        detail: `runtime snapshot path is missing: ${materialization.snapshotPath}`,
        lastCheckedAt: new Date().toISOString(),
      }),
      endpoint: config.fastModelBaseUrl,
      servedModelName: materialization.servedModelName,
    };
  }

  const probe = await probeVllmFastInference({
    baseUrl: config.fastModelBaseUrl,
    manifest,
  });

  return {
    ...createBaseState({
      manifest,
      candidate,
      readiness: probe.readiness,
      readinessBasis: probe.readinessBasis,
      detail: probe.detail,
      lastCheckedAt: new Date().toISOString(),
    }),
    endpoint: config.fastModelBaseUrl,
    servedModelName: materialization.servedModelName,
  };
};

export type VllmFastDependencyMonitor = {
  getState(input?: { maxAgeMs?: number }): Promise<ServingDependencyState>;
  refreshState(): Promise<ServingDependencyState>;
  peekState(): ServingDependencyState | null;
};

export const createVllmFastDependencyMonitor = (
  config: Pick<CoreRuntimeConfig, 'fastModelBaseUrl' | 'fastModelDescriptorPath' | 'modelsPath'>,
): VllmFastDependencyMonitor => {
  let currentState: ServingDependencyState | null = null;
  let inflight: Promise<ServingDependencyState> | null = null;
  let issuedProbeId = 0;
  let committedProbeId = 0;

  const refreshState = async (): Promise<ServingDependencyState> => {
    const nextProbeId = ++issuedProbeId;
    const promise = evaluateVllmFastDependencyState(config).then((state) => {
      if (nextProbeId >= committedProbeId) {
        committedProbeId = nextProbeId;
        currentState = state;
      }
      return state;
    });

    const inflightPromise = promise.finally(() => {
      if (inflight === inflightPromise) {
        inflight = null;
      }
    });
    inflight = inflightPromise;

    return await promise;
  };

  return {
    async getState(input?: { maxAgeMs?: number }): Promise<ServingDependencyState> {
      const maxAgeMs =
        typeof input?.maxAgeMs === 'number' && Number.isFinite(input.maxAgeMs)
          ? input.maxAgeMs
          : null;
      if (
        maxAgeMs !== null &&
        currentState?.lastCheckedAt &&
        Date.now() - Date.parse(currentState.lastCheckedAt) <= maxAgeMs
      ) {
        return currentState;
      }
      if (inflight) {
        return await inflight;
      }
      return await refreshState();
    },

    refreshState,

    peekState(): ServingDependencyState | null {
      return currentState;
    },
  };
};

export const vllmFastStateCacheTtlMs = (): number => DEFAULT_VLLM_FAST_STATE_CACHE_TTL_MS;
