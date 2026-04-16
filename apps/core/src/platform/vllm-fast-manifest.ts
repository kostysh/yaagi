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

const candidateRoleSchema = z.enum(['preferred', 'fallback', 'comparator']);

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

const manifestSchema = z
  .object({
    schemaVersion: z.literal('2026-04-16'),
    serviceId: z.literal('vllm-fast'),
    selectionState: z.enum(['qualification_pending', 'qualified', 'no_winner']),
    protocol: z.literal('openai-compatible'),
    preferredCandidateId: z.string().min(1),
    runtimeArtifactRoot: z.string().min(1),
    mustPassGates: z.array(z.string().min(1)).min(1),
    scorecard: z.array(scorecardEntrySchema).min(1),
    candidates: z.array(candidateSchema).length(3),
  })
  .superRefine((value, context) => {
    const candidateIds = new Set<string>();
    const roleCounts = {
      preferred: 0,
      fallback: 0,
      comparator: 0,
    };

    for (const candidate of value.candidates) {
      if (candidateIds.has(candidate.candidateId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['candidates'],
          message: `duplicate candidateId ${candidate.candidateId}`,
        });
      }
      candidateIds.add(candidate.candidateId);
      roleCounts[candidate.selectionRole] += 1;
    }

    if (!candidateIds.has(value.preferredCandidateId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['preferredCandidateId'],
        message: `preferredCandidateId ${value.preferredCandidateId} is missing from candidates`,
      });
    }

    for (const [role, count] of Object.entries(roleCounts)) {
      if (count !== 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['candidates'],
          message: `expected exactly one ${role} candidate, received ${count}`,
        });
      }
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
};

export type VllmFastManifest = Omit<VllmFastManifestSchema, 'candidates'> & {
  descriptorPath: string;
  descriptorUri: string;
  runtimeArtifactRootPath: string;
  preferredCandidate: VllmFastManifestCandidate;
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
  }));

  const preferredCandidate = candidates.find(
    (candidate) => candidate.candidateId === parsed.preferredCandidateId,
  );

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
    preferredCandidate,
    candidates,
  };
}

export function createVllmFastBaselineProfiles(
  config: Pick<CoreRuntimeConfig, 'fastModelBaseUrl' | 'fastModelDescriptorPath' | 'modelsPath'>,
): RuntimeModelProfileSeedInput[] {
  const manifest = loadVllmFastManifest(config);
  const baseCostJson = {
    class: 'phase0-fast',
    selectionState: manifest.selectionState,
    descriptorUri: manifest.descriptorUri,
    preferredCandidateId: manifest.preferredCandidate.candidateId,
  };
  const baseHealthJson = {
    healthy: true,
    detail: `vllm-fast descriptor loaded for ${manifest.preferredCandidate.modelId}`,
    artifactDescriptorPath: manifest.descriptorPath,
    runtimeArtifactRoot: manifest.runtimeArtifactRootPath,
    selectionState: manifest.selectionState,
  };

  return [
    {
      modelProfileId: PHASE0_BASELINE_PROFILE_ID.REFLEX,
      role: MODEL_PROFILE_ROLE.REFLEX,
      serviceId: 'vllm-fast',
      endpoint: config.fastModelBaseUrl,
      artifactUri: manifest.descriptorUri,
      baseModel: manifest.preferredCandidate.modelId,
      capabilities: ['reactive', 'low-latency', 'text-generation'],
      costJson: baseCostJson,
      healthJson: {
        ...baseHealthJson,
        detail: `vllm-fast descriptor loaded for reflex via ${manifest.preferredCandidate.modelId}`,
      },
      status: MODEL_PROFILE_STATUS.ACTIVE,
    },
    {
      modelProfileId: PHASE0_BASELINE_PROFILE_ID.DELIBERATION,
      role: MODEL_PROFILE_ROLE.DELIBERATION,
      serviceId: 'vllm-fast',
      endpoint: config.fastModelBaseUrl,
      artifactUri: manifest.descriptorUri,
      baseModel: manifest.preferredCandidate.modelId,
      capabilities: ['deliberation', 'structured-output', 'longer-context'],
      costJson: baseCostJson,
      healthJson: {
        ...baseHealthJson,
        detail: `vllm-fast descriptor loaded for deliberation via ${manifest.preferredCandidate.modelId}`,
      },
      status: MODEL_PROFILE_STATUS.ACTIVE,
    },
    {
      modelProfileId: PHASE0_BASELINE_PROFILE_ID.REFLECTION,
      role: MODEL_PROFILE_ROLE.REFLECTION,
      serviceId: 'vllm-fast',
      endpoint: config.fastModelBaseUrl,
      artifactUri: manifest.descriptorUri,
      baseModel: manifest.preferredCandidate.modelId,
      adapterOf: PHASE0_BASELINE_PROFILE_ID.DELIBERATION,
      capabilities: ['reflection', 'retrospective-analysis'],
      costJson: baseCostJson,
      healthJson: {
        ...baseHealthJson,
        detail: `vllm-fast descriptor loaded for reflection via ${manifest.preferredCandidate.modelId}`,
      },
      status: MODEL_PROFILE_STATUS.ACTIVE,
    },
  ];
}
