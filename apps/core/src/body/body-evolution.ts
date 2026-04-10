import { createHash, randomUUID } from 'node:crypto';
import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import {
  BODY_CHANGE_REQUESTED_BY_OWNER,
  type BodyChangeProposal,
  type BodyChangeProposalResult,
  type BodyChangeRequest,
  bodyChangeRequestSchema,
} from '@yaagi/contracts/body-evolution';
import {
  createBodyEvolutionStore,
  createRuntimeDbClient,
  type BodyChangeProposalRow,
  type BodyEvolutionStore,
} from '@yaagi/db';
import type { CoreRuntimeConfig } from '../platform/core-config.ts';

type BodyEvolutionClock = () => Date;

type BodyEvolutionFileOps = {
  lstat: typeof lstat;
  realpath: typeof realpath;
};

export type BodyChangeApprovalVerifier = (input: {
  governorProposalId: string;
  governorDecisionRef: string;
}) => Promise<boolean>;

export type BodyEvolutionServiceOptions = {
  config: CoreRuntimeConfig;
  store: BodyEvolutionStore;
  now?: BodyEvolutionClock;
  createId?: () => string;
  verifyGovernorApproval?: BodyChangeApprovalVerifier;
  fileOps?: Partial<BodyEvolutionFileOps>;
};

export type DbBackedBodyEvolutionServiceOptions = Omit<
  BodyEvolutionServiceOptions,
  'config' | 'store'
>;

export type BodyEvolutionService = {
  submitBodyChangeRequest(input: unknown): Promise<BodyChangeProposalResult>;
};

type NormalizedBodyChangeRequest = BodyChangeRequest & {
  evidenceRefs: string[];
  targetPaths: string[];
};

const defaultFileOps: BodyEvolutionFileOps = {
  lstat,
  realpath,
};

const uniqueSorted = (values: string[]): string[] =>
  [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))].sort();

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableJson(entryValue)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
};

const isWithinPath = (basePath: string, candidatePath: string): boolean => {
  const relative = path.relative(path.resolve(basePath), path.resolve(candidatePath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const getErrorCode = (error: unknown): string | null =>
  typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : null;

const resolveExistingPathRoot = async (
  targetPath: string,
  fileOps: BodyEvolutionFileOps,
): Promise<string> => {
  try {
    return await fileOps.realpath(targetPath);
  } catch (error) {
    if (getErrorCode(error) !== 'ENOENT') {
      throw error;
    }

    return path.resolve(targetPath);
  }
};

const sanitizePathSegment = (value: string): string => {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return sanitized.length > 0 ? sanitized.slice(0, 80) : 'request';
};

const shortId = (value: string): string => value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);

const normalizeRequest = (request: BodyChangeRequest): NormalizedBodyChangeRequest => ({
  ...request,
  evidenceRefs: uniqueSorted(request.evidenceRefs),
  targetPaths: uniqueSorted(request.targetPaths.map((targetPath) => path.normalize(targetPath))),
});

const hashRequest = (request: NormalizedBodyChangeRequest): string =>
  createHash('sha256')
    .update(
      stableJson({
        evidenceRefs: request.evidenceRefs,
        governorDecisionRef:
          request.requestedByOwner === BODY_CHANGE_REQUESTED_BY_OWNER.GOVERNOR
            ? request.governorDecisionRef
            : null,
        governorProposalId:
          request.requestedByOwner === BODY_CHANGE_REQUESTED_BY_OWNER.GOVERNOR
            ? request.governorProposalId
            : null,
        ownerOverrideEvidenceRef:
          request.requestedByOwner === BODY_CHANGE_REQUESTED_BY_OWNER.HUMAN_OVERRIDE
            ? request.ownerOverrideEvidenceRef
            : null,
        rationale: request.rationale,
        requestedByOwner: request.requestedByOwner,
        requestId: request.requestId,
        requiredEvalSuite: request.requiredEvalSuite,
        rollbackPlanRef: request.rollbackPlanRef,
        scopeKind: request.scopeKind,
        targetPaths: request.targetPaths,
      }),
    )
    .digest('hex');

const hasNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const preflightAuthorityFailure = (input: unknown): BodyChangeProposalResult | null => {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const request = input as Record<string, unknown>;
  const requestId = hasNonEmptyString(request['requestId']) ? request['requestId'] : undefined;
  const requestedByOwner = request['requestedByOwner'];

  if (requestedByOwner === BODY_CHANGE_REQUESTED_BY_OWNER.GOVERNOR) {
    if (
      !hasNonEmptyString(request['governorProposalId']) ||
      !hasNonEmptyString(request['governorDecisionRef'])
    ) {
      return createRejectedResult('governor_not_approved', requestId);
    }
  }

  if (
    requestedByOwner === BODY_CHANGE_REQUESTED_BY_OWNER.HUMAN_OVERRIDE &&
    !hasNonEmptyString(request['ownerOverrideEvidenceRef'])
  ) {
    return createRejectedResult('override_not_recorded', requestId);
  }

  return null;
};

const createRejectedResult = (
  reason: Exclude<BodyChangeProposalResult, { accepted: true }>['reason'],
  requestId?: string,
  detail?: string,
): BodyChangeProposalResult => ({
  accepted: false,
  reason,
  ...(requestId ? { requestId } : {}),
  ...(detail ? { detail } : {}),
});

const mapProposalRow = (row: BodyChangeProposalRow): BodyChangeProposal => ({
  proposalId: row.proposalId,
  requestId: row.requestId,
  normalizedRequestHash: row.normalizedRequestHash,
  requestedByOwner: row.requestedByOwner,
  governorProposalId: row.governorProposalId,
  governorDecisionRef: row.governorDecisionRef,
  ownerOverrideEvidenceRef: row.ownerOverrideEvidenceRef,
  branchName: row.branchName,
  worktreePath: row.worktreePath,
  candidateCommitSha: row.candidateCommitSha,
  stableSnapshotId: row.stableSnapshotId,
  status: row.status,
  scopeKind: row.scopeKind,
  requiredEvalSuite: row.requiredEvalSuite,
  targetPaths: row.targetPathsJson,
  rollbackPlanRef: row.rollbackPlanRef,
  evidenceRefs: row.evidenceRefsJson,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const resolveWorktreePath = (
  config: CoreRuntimeConfig,
  requestId: string,
  normalizedRequestHash: string,
): string =>
  path.resolve(
    config.workspaceBodyPath,
    '.yaagi',
    'body-proposals',
    `${sanitizePathSegment(requestId)}-${shortId(normalizedRequestHash)}`,
  );

const resolveTargetPath = (workspaceBodyPath: string, targetPath: string): string =>
  path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(workspaceBodyPath, targetPath);

const validateTargetPath = async (
  config: CoreRuntimeConfig,
  targetPath: string,
  fileOps: BodyEvolutionFileOps,
): Promise<
  | { ok: true }
  | { ok: false; reason: 'seed_write_rejected' | 'worktree_escape_rejected'; detail: string }
> => {
  const workspaceRoot = await resolveExistingPathRoot(config.workspaceBodyPath, fileOps);
  const seedBodyRoot = await resolveExistingPathRoot(config.seedBodyPath, fileOps);
  const absolutePath = resolveTargetPath(config.workspaceBodyPath, targetPath);

  if (isWithinPath(seedBodyRoot, absolutePath)) {
    return {
      ok: false,
      reason: 'seed_write_rejected',
      detail: `target path ${targetPath} resolves under immutable /seed/body`,
    };
  }

  if (!isWithinPath(workspaceRoot, absolutePath)) {
    return {
      ok: false,
      reason: 'worktree_escape_rejected',
      detail: `target path ${targetPath} escapes the materialized writable body`,
    };
  }

  if (
    absolutePath.includes(`${path.sep}.git${path.sep}`) ||
    absolutePath.endsWith(`${path.sep}.git`)
  ) {
    return {
      ok: false,
      reason: 'worktree_escape_rejected',
      detail: `target path ${targetPath} targets forbidden git metadata`,
    };
  }

  const relativeToWorkspace = path.relative(path.resolve(config.workspaceBodyPath), absolutePath);
  const segments = relativeToWorkspace.split(path.sep).filter(Boolean);

  for (let index = 0; index < segments.length; index += 1) {
    const segmentPath = path.join(
      path.resolve(config.workspaceBodyPath),
      ...segments.slice(0, index + 1),
    );

    try {
      const stats = await fileOps.lstat(segmentPath);
      if (stats.isSymbolicLink()) {
        return {
          ok: false,
          reason: 'worktree_escape_rejected',
          detail: `target path ${targetPath} traverses a symlink inside the writable body`,
        };
      }

      const realSegmentPath = await fileOps.realpath(segmentPath);
      if (isWithinPath(seedBodyRoot, realSegmentPath)) {
        return {
          ok: false,
          reason: 'seed_write_rejected',
          detail: `target path ${targetPath} resolves under immutable /seed/body`,
        };
      }

      if (!isWithinPath(workspaceRoot, realSegmentPath)) {
        return {
          ok: false,
          reason: 'worktree_escape_rejected',
          detail: `target path ${targetPath} escapes the materialized writable body`,
        };
      }
    } catch (error) {
      if (getErrorCode(error) === 'ENOENT') {
        break;
      }

      throw error;
    }
  }

  return { ok: true };
};

const validateRequestPaths = async (
  config: CoreRuntimeConfig,
  request: NormalizedBodyChangeRequest,
  worktreePath: string,
  fileOps: BodyEvolutionFileOps,
): Promise<
  | { ok: true }
  | { ok: false; reason: 'seed_write_rejected' | 'worktree_escape_rejected'; detail: string }
> => {
  const worktreePathValidation = await validateTargetPath(config, worktreePath, fileOps);
  if (!worktreePathValidation.ok) {
    return {
      ...worktreePathValidation,
      detail: `body change worktree path is invalid: ${worktreePathValidation.detail}`,
    };
  }

  for (const targetPath of request.targetPaths) {
    const result = await validateTargetPath(config, targetPath, fileOps);
    if (!result.ok) {
      return result;
    }
  }

  return { ok: true };
};

const withRuntimeClient = async <T>(
  connectionString: string,
  run: (store: BodyEvolutionStore) => Promise<T>,
): Promise<T> => {
  const client = createRuntimeDbClient(connectionString);
  await client.connect();

  try {
    return await run(createBodyEvolutionStore(client));
  } finally {
    await client.end();
  }
};

export const createBodyEvolutionService = (
  options: BodyEvolutionServiceOptions,
): BodyEvolutionService => {
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? randomUUID;
  const fileOps: BodyEvolutionFileOps = {
    ...defaultFileOps,
    ...options.fileOps,
  };

  return {
    async submitBodyChangeRequest(input) {
      const authorityFailure = preflightAuthorityFailure(input);
      if (authorityFailure) {
        return authorityFailure;
      }

      const parsed = bodyChangeRequestSchema.safeParse(input);
      if (!parsed.success) {
        return createRejectedResult('invalid_request');
      }

      const request = normalizeRequest(parsed.data);
      if (request.requestedByOwner === BODY_CHANGE_REQUESTED_BY_OWNER.GOVERNOR) {
        const approved = await (options.verifyGovernorApproval?.({
          governorDecisionRef: request.governorDecisionRef,
          governorProposalId: request.governorProposalId,
        }) ?? Promise.resolve(false));
        if (!approved) {
          return createRejectedResult('governor_not_approved', request.requestId);
        }
      }

      const proposalRawId = createId();
      const proposalId = `body-change-proposal:${proposalRawId}`;
      const eventId = `body-change-event:${createId()}`;
      const createdAt = now().toISOString();
      const normalizedRequestHash = hashRequest(request);
      const worktreePath = resolveWorktreePath(
        options.config,
        request.requestId,
        normalizedRequestHash,
      );
      let pathValidation: Awaited<ReturnType<typeof validateRequestPaths>>;
      try {
        pathValidation = await validateRequestPaths(options.config, request, worktreePath, fileOps);
      } catch (error) {
        return createRejectedResult(
          'worktree_escape_rejected',
          request.requestId,
          error instanceof Error ? error.message : String(error),
        );
      }

      if (!pathValidation.ok) {
        return createRejectedResult(
          pathValidation.reason,
          request.requestId,
          pathValidation.detail,
        );
      }

      const proposalIdSuffix = shortId(proposalRawId) || shortId(normalizedRequestHash);
      const branchName = `agent/proposals/${sanitizePathSegment(request.requestId)}-${proposalIdSuffix}`;

      try {
        const result = await options.store.recordProposal({
          proposalId,
          eventId,
          requestId: request.requestId,
          normalizedRequestHash,
          requestedByOwner: request.requestedByOwner,
          governorProposalId:
            request.requestedByOwner === BODY_CHANGE_REQUESTED_BY_OWNER.GOVERNOR
              ? request.governorProposalId
              : null,
          governorDecisionRef:
            request.requestedByOwner === BODY_CHANGE_REQUESTED_BY_OWNER.GOVERNOR
              ? request.governorDecisionRef
              : null,
          ownerOverrideEvidenceRef:
            request.requestedByOwner === BODY_CHANGE_REQUESTED_BY_OWNER.HUMAN_OVERRIDE
              ? request.ownerOverrideEvidenceRef
              : null,
          branchName,
          worktreePath,
          scopeKind: request.scopeKind,
          requiredEvalSuite: request.requiredEvalSuite,
          targetPaths: request.targetPaths,
          rollbackPlanRef: request.rollbackPlanRef,
          evidenceRefs: request.evidenceRefs,
          createdAt,
          payloadJson: {
            owner: 'F-0017',
            slice: 'SL-F0017-01',
            actorSource: request.requestedByOwner,
            requestedByOwner: request.requestedByOwner,
            governorProposalId:
              request.requestedByOwner === BODY_CHANGE_REQUESTED_BY_OWNER.GOVERNOR
                ? request.governorProposalId
                : null,
            governorDecisionRef:
              request.requestedByOwner === BODY_CHANGE_REQUESTED_BY_OWNER.GOVERNOR
                ? request.governorDecisionRef
                : null,
            ownerOverrideEvidenceRef:
              request.requestedByOwner === BODY_CHANGE_REQUESTED_BY_OWNER.HUMAN_OVERRIDE
                ? request.ownerOverrideEvidenceRef
                : null,
            branchName,
            worktreePath,
            candidateCommitSha: null,
            stableSnapshotId: null,
            evalResult: null,
          },
        });

        if (!result.accepted) {
          return createRejectedResult('request_hash_conflict', request.requestId);
        }

        const proposal = mapProposalRow(result.proposal);
        return {
          accepted: true,
          requestId: proposal.requestId,
          proposalId: proposal.proposalId,
          status: proposal.status,
          deduplicated: result.deduplicated,
          proposal,
          createdAt: proposal.createdAt,
        };
      } catch (error) {
        return createRejectedResult(
          'persistence_unavailable',
          request.requestId,
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  };
};

export const createDbBackedBodyEvolutionService = (
  config: CoreRuntimeConfig,
  options: DbBackedBodyEvolutionServiceOptions = {},
): BodyEvolutionService => ({
  async submitBodyChangeRequest(input) {
    return await withRuntimeClient(
      config.postgresUrl,
      async (store) =>
        await createBodyEvolutionService({
          ...options,
          config,
          store,
        }).submitBodyChangeRequest(input),
    );
  },
});
