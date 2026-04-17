import path from 'node:path';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  MODEL_PROFILE_ROLE,
  MODEL_PROFILE_STATUS,
  type RuntimeModelProfileSeedInput,
} from '@yaagi/db';
import { z } from 'zod';
import type { CoreRuntimeConfig } from './core-config.ts';
import { PHASE0_BASELINE_PROFILE_ID } from '../runtime/model-router.ts';
import { PHASE0_MODEL_ID } from './phase0-ai.ts';

const candidateRoleSchema = z.literal('preferred');

const candidateSchema = z.object({
  candidateId: z.string().min(1),
  modelId: z.string().min(1),
  sourceUri: z.string().min(1),
  selectionRole: candidateRoleSchema,
  runtimeSubdir: z.string().min(1),
});

const scorecardEntrySchema = z.object({
  name: z.string().min(1),
  weight: z.number().int().positive(),
});

const servingConfigSchema = z.object({
  servedModelName: z.string().min(1).default(PHASE0_MODEL_ID),
  dtype: z.string().min(1).default('bfloat16'),
  tensorParallelSize: z.number().int().positive().default(1),
  maxModelLen: z.number().int().positive().default(16384),
  gpuMemoryUtilization: z.number().positive().max(0.99).default(0.82),
  maxNumSeqs: z.number().int().positive().default(4),
  generationConfig: z.string().min(1).default('vllm'),
  attentionBackend: z.string().min(1).optional(),
  limitMmPerPrompt: z.string().min(1).optional(),
});

const readinessProbeSchema = z.object({
  prompt: z.string().min(1).default('Reply with the single word READY.'),
  expectedText: z.string().min(1).default('READY'),
  maxTokens: z.number().int().positive().default(8),
  timeoutMs: z.number().int().positive().default(15_000),
});

const normalizeRepoRelativePath = (value: string, label: string): string => {
  const normalized = path.posix.normalize(value.replaceAll('\\', '/'));
  if (
    normalized.length === 0 ||
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    path.posix.isAbsolute(normalized)
  ) {
    throw new Error(`${label} must stay inside the repository root, received ${value}`);
  }

  return normalized;
};

const manifestSchema = z
  .object({
    schemaVersion: z.enum(['2026-04-16', '2026-04-17']),
    serviceId: z.literal('vllm-fast'),
    selectionState: z.enum(['qualification_pending', 'qualified', 'no_winner']),
    protocol: z.literal('openai-compatible'),
    preferredCandidateId: z.string().min(1),
    selectedCandidateId: z.string().min(1).nullable().optional(),
    runtimeArtifactRoot: z.string().min(1),
    qualificationCorpusPath: z.string().min(1).optional(),
    qualificationReportPath: z.string().min(1).optional(),
    mustPassGates: z.array(z.string().min(1)).min(1),
    scorecard: z.array(scorecardEntrySchema).min(1),
    servingConfig: servingConfigSchema.optional(),
    readinessProbe: readinessProbeSchema.optional(),
    candidates: z.array(candidateSchema).length(1),
  })
  .superRefine((value, context) => {
    const candidateIds = new Set<string>();
    const [canonicalCandidate] = value.candidates;

    for (const candidate of value.candidates) {
      if (candidateIds.has(candidate.candidateId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['candidates'],
          message: `duplicate candidateId ${candidate.candidateId}`,
        });
      }
      candidateIds.add(candidate.candidateId);
    }

    if (!candidateIds.has(value.preferredCandidateId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['preferredCandidateId'],
        message: `preferredCandidateId ${value.preferredCandidateId} is missing from candidates`,
      });
    }

    if (value.selectionState === 'qualified' && !value.selectedCandidateId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['selectedCandidateId'],
        message: 'selectionState=qualified requires selectedCandidateId',
      });
    }

    if (value.selectedCandidateId && !candidateIds.has(value.selectedCandidateId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['selectedCandidateId'],
        message: `selectedCandidateId ${value.selectedCandidateId} is missing from candidates`,
      });
    }

    if (canonicalCandidate && value.preferredCandidateId !== canonicalCandidate.candidateId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['preferredCandidateId'],
        message: 'preferredCandidateId must reference the sole canonical candidate',
      });
    }

    if (
      value.selectionState === 'qualified' &&
      value.selectedCandidateId !== value.preferredCandidateId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['selectedCandidateId'],
        message: 'selectedCandidateId must match preferredCandidateId for the canonical baseline',
      });
    }

    if (canonicalCandidate && canonicalCandidate.selectionRole !== 'preferred') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['candidates'],
        message: 'the sole canonical candidate must use selectionRole=preferred',
      });
    }

    if (value.selectionState === 'no_winner' && value.selectedCandidateId !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['selectedCandidateId'],
        message: 'selectionState=no_winner requires selectedCandidateId=null',
      });
    }

    if (value.candidates.length !== 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['candidates'],
        message: 'vllm-fast manifest must declare exactly one canonical candidate',
      });
    }

    try {
      if (value.qualificationReportPath) {
        normalizeRepoRelativePath(value.qualificationReportPath, 'qualificationReportPath');
      }
    } catch (error) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['qualificationReportPath'],
        message: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      if (value.qualificationCorpusPath) {
        normalizeRepoRelativePath(value.qualificationCorpusPath, 'qualificationCorpusPath');
      }
    } catch (error) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['qualificationCorpusPath'],
        message: error instanceof Error ? error.message : String(error),
      });
    }

    if (value.selectedCandidateId && value.selectedCandidateId !== value.preferredCandidateId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['selectedCandidateId'],
        message: 'selectedCandidateId may not diverge from preferredCandidateId in Gemma-only mode',
      });
    }

    const totalWeight = value.scorecard.reduce((sum, entry) => sum + entry.weight, 0);
    if (totalWeight !== 100) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scorecard'],
        message: `scorecard weights must sum to 100, received ${totalWeight}`,
      });
    }
  });

type VllmFastManifestSchema = z.infer<typeof manifestSchema>;

export type VllmFastManifestCandidate = VllmFastManifestSchema['candidates'][number] & {
  runtimeArtifactPath: string;
  runtimeArtifactUri: string;
};

export type VllmFastServingConfig = z.infer<typeof servingConfigSchema>;
export type VllmFastReadinessProbe = z.infer<typeof readinessProbeSchema>;

export type VllmFastManifest = Omit<VllmFastManifestSchema, 'candidates'> & {
  descriptorPath: string;
  descriptorUri: string;
  runtimeArtifactRootPath: string;
  selectedCandidate: VllmFastManifestCandidate | null;
  preferredCandidate: VllmFastManifestCandidate;
  servingConfig: VllmFastServingConfig;
  readinessProbe: VllmFastReadinessProbe;
  candidates: VllmFastManifestCandidate[];
};

const normalizeRelativeSubpath = (value: string, label: string): string => {
  const normalized = path.posix.normalize(value.replaceAll('\\', '/'));
  if (
    normalized.length === 0 ||
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    path.posix.isAbsolute(normalized)
  ) {
    throw new Error(`${label} must stay inside the runtime models root, received ${value}`);
  }

  return normalized;
};

const resolveRuntimePath = (modelsPath: string, relativePath: string, label: string): string => {
  const normalized = normalizeRelativeSubpath(relativePath, label);
  const resolvedPath = path.resolve(modelsPath, normalized);
  const relative = path.relative(modelsPath, resolvedPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} resolves outside the runtime models root: ${relativePath}`);
  }

  return resolvedPath;
};

export function loadVllmFastManifest(
  config: Pick<CoreRuntimeConfig, 'fastModelDescriptorPath' | 'modelsPath'>,
): VllmFastManifest {
  const descriptorPath = path.resolve(config.fastModelDescriptorPath);
  const raw = JSON.parse(readFileSync(descriptorPath, 'utf8')) as unknown;
  const parsed = manifestSchema.parse(raw);
  const runtimeArtifactRootPath = resolveRuntimePath(
    path.resolve(config.modelsPath),
    parsed.runtimeArtifactRoot,
    'runtimeArtifactRoot',
  );

  const candidates = parsed.candidates.map((candidate) => ({
    ...candidate,
    runtimeArtifactPath: resolveRuntimePath(
      path.resolve(config.modelsPath),
      candidate.runtimeSubdir,
      `runtimeSubdir for ${candidate.candidateId}`,
    ),
    runtimeArtifactUri: pathToFileURL(
      resolveRuntimePath(
        path.resolve(config.modelsPath),
        candidate.runtimeSubdir,
        `runtimeSubdir for ${candidate.candidateId}`,
      ),
    ).toString(),
  }));

  const preferredCandidate = candidates.find(
    (candidate) => candidate.candidateId === parsed.preferredCandidateId,
  );
  const selectedCandidate = parsed.selectedCandidateId
    ? (candidates.find((candidate) => candidate.candidateId === parsed.selectedCandidateId) ?? null)
    : null;

  if (!preferredCandidate) {
    throw new Error(
      `preferredCandidateId ${parsed.preferredCandidateId} is missing after manifest normalization`,
    );
  }

  return {
    ...parsed,
    descriptorPath,
    descriptorUri: pathToFileURL(descriptorPath).toString(),
    runtimeArtifactRootPath,
    selectedCandidate,
    preferredCandidate,
    servingConfig: servingConfigSchema.parse(parsed.servingConfig ?? {}),
    readinessProbe: readinessProbeSchema.parse(parsed.readinessProbe ?? {}),
    candidates,
  };
}

export function createVllmFastBaselineProfiles(
  config: Pick<CoreRuntimeConfig, 'fastModelBaseUrl' | 'fastModelDescriptorPath' | 'modelsPath'>,
): RuntimeModelProfileSeedInput[] {
  const manifest = loadVllmFastManifest(config);
  const canonicalCandidate = manifest.selectedCandidate ?? manifest.preferredCandidate;
  const baseCostJson = {
    class: 'phase0-fast',
    selectionState: manifest.selectionState,
    descriptorUri: manifest.descriptorUri,
    preferredCandidateId: manifest.preferredCandidate.candidateId,
    ...(manifest.selectedCandidate
      ? { selectedCandidateId: manifest.selectedCandidate.candidateId }
      : {}),
    servedModelName: manifest.servingConfig.servedModelName,
  };
  const baseHealthJson = {
    healthy: true,
    detail: `vllm-fast descriptor loaded for ${canonicalCandidate.modelId}`,
    artifactDescriptorPath: manifest.descriptorPath,
    runtimeArtifactRoot: manifest.runtimeArtifactRootPath,
    selectionState: manifest.selectionState,
    serviceId: manifest.serviceId,
    servedModelName: manifest.servingConfig.servedModelName,
    bootCritical: true,
    optionalUntilPromoted: false,
    readiness: 'warming',
    readinessBasis: 'artifact_missing',
  };

  return [
    {
      modelProfileId: PHASE0_BASELINE_PROFILE_ID.REFLEX,
      role: MODEL_PROFILE_ROLE.REFLEX,
      serviceId: 'vllm-fast',
      endpoint: config.fastModelBaseUrl,
      artifactUri: canonicalCandidate.runtimeArtifactUri,
      baseModel: canonicalCandidate.modelId,
      capabilities: ['reactive', 'low-latency', 'text-generation'],
      costJson: baseCostJson,
      healthJson: {
        ...baseHealthJson,
        detail: `vllm-fast descriptor loaded for reflex via ${canonicalCandidate.modelId}`,
      },
      status: MODEL_PROFILE_STATUS.ACTIVE,
    },
    {
      modelProfileId: PHASE0_BASELINE_PROFILE_ID.DELIBERATION,
      role: MODEL_PROFILE_ROLE.DELIBERATION,
      serviceId: 'vllm-fast',
      endpoint: config.fastModelBaseUrl,
      artifactUri: canonicalCandidate.runtimeArtifactUri,
      baseModel: canonicalCandidate.modelId,
      capabilities: ['deliberation', 'structured-output', 'longer-context'],
      costJson: baseCostJson,
      healthJson: {
        ...baseHealthJson,
        detail: `vllm-fast descriptor loaded for deliberation via ${canonicalCandidate.modelId}`,
      },
      status: MODEL_PROFILE_STATUS.ACTIVE,
    },
    {
      modelProfileId: PHASE0_BASELINE_PROFILE_ID.REFLECTION,
      role: MODEL_PROFILE_ROLE.REFLECTION,
      serviceId: 'vllm-fast',
      endpoint: config.fastModelBaseUrl,
      artifactUri: canonicalCandidate.runtimeArtifactUri,
      baseModel: canonicalCandidate.modelId,
      adapterOf: PHASE0_BASELINE_PROFILE_ID.DELIBERATION,
      capabilities: ['reflection', 'retrospective-analysis'],
      costJson: baseCostJson,
      healthJson: {
        ...baseHealthJson,
        detail: `vllm-fast descriptor loaded for reflection via ${canonicalCandidate.modelId}`,
      },
      status: MODEL_PROFILE_STATUS.ACTIVE,
    },
  ];
}
