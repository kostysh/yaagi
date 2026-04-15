import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  BODY_CHANGE_EVENT_KIND,
  BODY_CHANGE_GATE_KIND,
  BODY_CHANGE_REQUESTED_BY_OWNER,
  BODY_CHANGE_STATUS,
  type BodyChangeGateCheck,
  type BodyChangeProposal,
  type BodyChangeProposalResult,
  type BodyChangeRequest,
  type BodyStableSnapshot,
  bodyChangeRequestSchema,
} from '@yaagi/contracts/body-evolution';
import {
  DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE,
  type DevelopmentProposalExecutionOutcomeResult,
} from '@yaagi/contracts/governor';
import {
  PERIMETER_ACTION_CLASS,
  PERIMETER_AUTHORITY_OWNER,
  PERIMETER_INGRESS_OWNER,
  PERIMETER_VERDICT,
} from '@yaagi/contracts/perimeter';
import {
  createBodyEvolutionStore,
  createRuntimeDbClient,
  type BodyChangeEventRow,
  type BodyChangeProposalRow,
  type BodyEvolutionStore,
  type BodyStableSnapshotRow,
} from '@yaagi/db';
import type { CoreRuntimeConfig } from '../platform/core-config.ts';
import { createDbBackedDevelopmentGovernorService } from '../runtime/development-governor.ts';
import {
  createBodyEvolutionCommandRunner,
  type BodyEvolutionCommandRunner,
  type BodyEvolutionCommandSpec,
} from './command-runner.ts';
import {
  createDbBackedPerimeterDecisionService,
  type PerimeterDecisionService,
} from '../perimeter/index.ts';
import {
  createBodyEvolutionGitGateway,
  createBodyEvolutionStableTagName,
  type BodyEvolutionGitGateway,
} from './git-gateway.ts';

type BodyEvolutionClock = () => Date;

type BodyEvolutionFileOps = {
  lstat: typeof lstat;
  mkdir: typeof mkdir;
  readFile: typeof readFile;
  realpath: typeof realpath;
  unlink: typeof unlink;
  writeFile: typeof writeFile;
};

type BodyChangeAuthorityVerification =
  | boolean
  | {
      approved: boolean;
      targetRef?: string | null;
    };

export type BodyChangeApprovalVerifier = (input: {
  governorProposalId: string;
  governorDecisionRef: string;
  expectedTargetRef: string;
}) => Promise<BodyChangeAuthorityVerification>;

export type BodyChangeGovernorOutcomeRecorder = (input: {
  requestId: string;
  proposalId: string;
  outcomeKind: 'executed' | 'rolled_back';
  outcomeOrigin: 'runtime' | 'recovery' | 'workshop' | 'human_override';
  targetRef: string;
  evidenceRefs: string[];
  recordedAt: string;
  payload?: Record<string, unknown>;
}) => Promise<DevelopmentProposalExecutionOutcomeResult>;

export type BodyChangeHumanOverrideGovernorApproval = {
  accepted: true;
  governorProposalId: string;
  governorDecisionRef: string;
  targetRef: string;
};

export type BodyChangeHumanOverrideGovernorApprover = (input: {
  request: NormalizedBodyChangeRequest;
  normalizedRequestHash: string;
}) => Promise<BodyChangeHumanOverrideGovernorApproval>;

export type BodyChangeWorktreePreparationInput = {
  proposalId: string;
  requestId: string;
  evidenceRefs: string[];
  preparedAt?: string;
};

export type BodyChangeEvalCommandInput = {
  label: string;
  command: string;
  args: string[];
  evidenceRef?: string | null;
};

export type BodyChangeEvalSuiteResolver = (
  suiteLabel: string,
) => Promise<BodyEvolutionCommandSpec | null> | BodyEvolutionCommandSpec | null;

export type BodyChangeCandidateEvaluationInput = {
  proposalId: string;
  requestId: string;
  candidateCommitMessage: string;
  evalCommand: BodyChangeEvalCommandInput;
  evidenceRefs: string[];
  evaluatedAt?: string;
};

export type BodyChangeStableSnapshotInput = {
  proposalId: string;
  requestId: string;
  schemaVersion: string;
  modelProfileMapJson: Record<string, string>;
  criticalConfigJson: Record<string, unknown>;
  evalSummaryJson: Record<string, unknown>;
  evidenceRefs: string[];
  publishedAt?: string;
};

export type BodyChangeRollbackInput = {
  proposalId: string;
  requestId: string;
  snapshotId: string;
  rollbackReason: string;
  verificationResult: string;
  evidenceRefs: string[];
  recordedAt?: string;
};

type BodyChangeMutationRejectedReason =
  | 'proposal_not_found'
  | 'invalid_status'
  | 'invalid_eval_suite'
  | 'snapshot_manifest_invalid'
  | 'snapshot_not_found'
  | 'worktree_unavailable'
  | 'governor_target_unavailable'
  | 'governor_outcome_unavailable'
  | 'perimeter_denied'
  | 'persistence_unavailable';

type BodyChangeMutationRejected = {
  accepted: false;
  requestId: string;
  reason: BodyChangeMutationRejectedReason;
  detail?: string;
  proposal?: BodyChangeProposal;
  snapshot?: BodyStableSnapshot;
};

export type BodyChangeWorktreePreparationResult =
  | {
      accepted: true;
      requestId: string;
      proposalId: string;
      status: typeof BODY_CHANGE_STATUS.WORKTREE_READY;
      proposal: BodyChangeProposal;
      createdAt: string;
    }
  | BodyChangeMutationRejected;

export type BodyChangeCandidateEvaluationResult =
  | {
      accepted: true;
      requestId: string;
      proposalId: string;
      status:
        | typeof BODY_CHANGE_STATUS.EVALUATION_FAILED
        | typeof BODY_CHANGE_STATUS.CANDIDATE_COMMITTED;
      proposal: BodyChangeProposal;
      gateReport: BodyChangeGateCheck[];
      createdAt: string;
    }
  | BodyChangeMutationRejected;

export type BodyChangeStableSnapshotResult =
  | {
      accepted: true;
      requestId: string;
      proposalId: string;
      status: typeof BODY_CHANGE_STATUS.SNAPSHOT_READY;
      proposal: BodyChangeProposal;
      snapshot: BodyStableSnapshot;
      deduplicated: boolean;
      createdAt: string;
    }
  | BodyChangeMutationRejected;

export type BodyChangeRollbackResult =
  | {
      accepted: true;
      requestId: string;
      proposalId: string;
      status: typeof BODY_CHANGE_STATUS.ROLLED_BACK;
      proposal: BodyChangeProposal;
      snapshot: BodyStableSnapshot;
      createdAt: string;
    }
  | BodyChangeMutationRejected;

export type BodyEvolutionServiceOptions = {
  config: CoreRuntimeConfig;
  store: BodyEvolutionStore;
  now?: BodyEvolutionClock;
  createId?: () => string;
  verifyGovernorApproval?: BodyChangeApprovalVerifier;
  ensureHumanOverrideGovernorApproval: BodyChangeHumanOverrideGovernorApprover;
  recordGovernorOutcome: BodyChangeGovernorOutcomeRecorder;
  perimeterDecisionService?: PerimeterDecisionService;
  resolveEvalSuiteCommand?: BodyChangeEvalSuiteResolver;
  gitGateway?: BodyEvolutionGitGateway;
  commandRunner?: BodyEvolutionCommandRunner;
  fileOps?: Partial<BodyEvolutionFileOps>;
};

export type DbBackedBodyEvolutionServiceOptions = Omit<
  BodyEvolutionServiceOptions,
  'config' | 'store' | 'ensureHumanOverrideGovernorApproval' | 'recordGovernorOutcome'
> &
  Partial<
    Pick<
      BodyEvolutionServiceOptions,
      'ensureHumanOverrideGovernorApproval' | 'recordGovernorOutcome'
    >
  >;

export type BodyEvolutionService = {
  submitBodyChangeRequest(input: unknown): Promise<BodyChangeProposalResult>;
  prepareProposalWorktree(
    input: BodyChangeWorktreePreparationInput,
  ): Promise<BodyChangeWorktreePreparationResult>;
  evaluateProposalForCandidate(
    input: BodyChangeCandidateEvaluationInput,
  ): Promise<BodyChangeCandidateEvaluationResult>;
  publishStableSnapshot(
    input: BodyChangeStableSnapshotInput,
  ): Promise<BodyChangeStableSnapshotResult>;
  recordRollbackEvidence(input: BodyChangeRollbackInput): Promise<BodyChangeRollbackResult>;
};

type NormalizedBodyChangeRequest = BodyChangeRequest & {
  evidenceRefs: string[];
  targetPaths: string[];
};

const defaultFileOps: BodyEvolutionFileOps = {
  lstat,
  mkdir,
  readFile,
  realpath,
  unlink,
  writeFile,
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

const hashStableValue = (value: unknown): string =>
  createHash('sha256').update(stableJson(value)).digest('hex');

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

const createMutationRejected = (
  reason: BodyChangeMutationRejectedReason,
  requestId: string,
  detail?: string,
  extra: { proposal?: BodyChangeProposal; snapshot?: BodyStableSnapshot } = {},
): BodyChangeMutationRejected => ({
  accepted: false,
  requestId,
  reason,
  ...(detail ? { detail } : {}),
  ...(extra.proposal ? { proposal: extra.proposal } : {}),
  ...(extra.snapshot ? { snapshot: extra.snapshot } : {}),
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

const mapStableSnapshotRow = (row: BodyStableSnapshotRow): BodyStableSnapshot => ({
  snapshotId: row.snapshotId,
  proposalId: row.proposalId,
  gitTag: row.gitTag,
  schemaVersion: row.schemaVersion,
  modelProfileMapJson: row.modelProfileMapJson,
  criticalConfigHash: row.criticalConfigHash,
  evalSummaryJson: row.evalSummaryJson,
  manifestHash: row.manifestHash,
  manifestPath: row.manifestPath,
  createdAt: row.createdAt,
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

const normalizeAuthorityVerification = (
  verification: BodyChangeAuthorityVerification,
): {
  approved: boolean;
  targetRef: string | null;
} =>
  typeof verification === 'boolean'
    ? {
        approved: verification,
        targetRef: null,
      }
    : {
        approved: verification.approved,
        targetRef: typeof verification.targetRef === 'string' ? verification.targetRef : null,
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

const withRuntimeDbClient = async <T>(
  connectionString: string,
  run: (client: ReturnType<typeof createRuntimeDbClient>) => Promise<T>,
): Promise<T> => {
  const client = createRuntimeDbClient(connectionString);
  await client.connect();

  try {
    return await run(client);
  } finally {
    await client.end();
  }
};

const extractGovernorTargetRef = (events: BodyChangeEventRow[]): string | null => {
  const proposalRecordedEvent = events.find(
    (event) => event.eventKind === BODY_CHANGE_EVENT_KIND.PROPOSAL_RECORDED,
  );
  const candidate = proposalRecordedEvent?.payloadJson['governorTargetRef'];
  return typeof candidate === 'string' ? candidate : null;
};

const proposalRequiresSmoke = (proposal: BodyChangeProposal): boolean =>
  proposal.targetPaths.some((targetPath) =>
    [
      'src/runtime/',
      'src/boot/',
      'src/platform/',
      'src/actions/',
      'src/perception/',
      'infra/',
      'docker/',
      'README.md',
    ].some((prefix) => targetPath === prefix || targetPath.startsWith(prefix)),
  );

const createManifestPath = (config: CoreRuntimeConfig, snapshotId: string): string =>
  path.join(config.dataPath, 'snapshots', `${snapshotId}.json`);

const createSnapshotId = (proposal: BodyChangeProposal): string =>
  `stable-snapshot:${shortId(proposal.proposalId)}-${shortId(proposal.candidateCommitSha ?? proposal.normalizedRequestHash)}`;

const buildSnapshotManifest = (input: {
  snapshotId: string;
  proposalId: string;
  gitTag: string;
  schemaVersion: string;
  modelProfileMapJson: Record<string, string>;
  criticalConfigHash: string;
  evalSummaryJson: Record<string, unknown>;
  manifestPath: string;
}) => ({
  snapshotId: input.snapshotId,
  proposalId: input.proposalId,
  gitTag: input.gitTag,
  schemaVersion: input.schemaVersion,
  modelProfileMapJson: input.modelProfileMapJson,
  criticalConfigHash: input.criticalConfigHash,
  evalSummaryJson: input.evalSummaryJson,
  manifestPath: input.manifestPath,
});

const validateSnapshotInput = (input: BodyChangeStableSnapshotInput): string | null => {
  if (input.schemaVersion.trim().length === 0) {
    return 'schemaVersion is required for stable snapshot publication';
  }

  if (Object.keys(input.modelProfileMapJson).length === 0) {
    return 'modelProfileMapJson must contain at least one active profile';
  }

  if (Object.keys(input.evalSummaryJson).length === 0) {
    return 'evalSummaryJson must contain the candidate evaluation summary';
  }

  if (Object.keys(input.criticalConfigJson).length === 0) {
    return 'criticalConfigJson must contain the bounded critical configuration snapshot';
  }

  return null;
};

const buildBodyChangeTargetRef = (normalizedRequestHash: string): string =>
  `body-change:${normalizedRequestHash}`;

const buildHumanOverrideGovernorRequestId = (
  normalizedRequestHash: string,
  kind: 'proposal' | 'decision',
): string => `body-change:${normalizedRequestHash}:${kind}`;

const defaultEvalSuiteContracts: Record<
  string,
  Omit<BodyEvolutionCommandSpec, 'kind' | 'label'>
> = {
  'body-evolution.boundary': {
    command: 'pnpm',
    args: ['test'],
    evidenceRef: 'eval:body-evolution.boundary',
  },
  'body-evolution.config': {
    command: 'pnpm',
    args: ['test'],
    evidenceRef: 'eval:body-evolution.config',
  },
};

const resolveDefaultEvalSuiteCommand = (suiteLabel: string): BodyEvolutionCommandSpec | null => {
  const contract = defaultEvalSuiteContracts[suiteLabel];
  if (!contract) {
    return null;
  }

  return {
    kind: BODY_CHANGE_GATE_KIND.EVAL,
    label: suiteLabel,
    command: contract.command,
    args: [...contract.args],
    evidenceRef: contract.evidenceRef ?? null,
  };
};

const matchesEvalSuiteContract = (
  input: BodyChangeEvalCommandInput,
  expected: BodyEvolutionCommandSpec,
): boolean =>
  input.label === expected.label &&
  input.command === expected.command &&
  input.args.length === expected.args.length &&
  input.args.every((value, index) => value === expected.args[index]);

const buildRepoGateCommands = (
  proposal: BodyChangeProposal,
  evalCommand: BodyEvolutionCommandSpec,
): BodyEvolutionCommandSpec[] => {
  const commands: BodyEvolutionCommandSpec[] = [
    {
      kind: BODY_CHANGE_GATE_KIND.REPO,
      label: 'pnpm format',
      command: 'pnpm',
      args: ['format'],
      evidenceRef: 'check:pnpm-format',
    },
    {
      kind: BODY_CHANGE_GATE_KIND.REPO,
      label: 'pnpm typecheck',
      command: 'pnpm',
      args: ['typecheck'],
      evidenceRef: 'check:pnpm-typecheck',
    },
    {
      kind: BODY_CHANGE_GATE_KIND.REPO,
      label: 'pnpm lint',
      command: 'pnpm',
      args: ['lint'],
      evidenceRef: 'check:pnpm-lint',
    },
    {
      kind: BODY_CHANGE_GATE_KIND.EVAL,
      label: evalCommand.label,
      command: evalCommand.command,
      args: evalCommand.args,
      evidenceRef: evalCommand.evidenceRef ?? `eval:${proposal.requiredEvalSuite}`,
    },
  ];

  if (proposalRequiresSmoke(proposal)) {
    commands.push({
      kind: BODY_CHANGE_GATE_KIND.SMOKE,
      label: 'pnpm smoke:cell',
      command: 'pnpm',
      args: ['smoke:cell'],
      evidenceRef: 'check:pnpm-smoke-cell',
    });
  }

  return commands;
};

const collectGateEvidenceRefs = (gateReport: BodyChangeGateCheck[]): string[] =>
  uniqueSorted(gateReport.flatMap((check) => (check.evidenceRef ? [check.evidenceRef] : [])));

const buildGovernorOutcomeEvidenceRefs = (
  requestEvidenceRefs: string[],
  suffixEvidenceRef: string,
): string[] => uniqueSorted([...requestEvidenceRefs, suffixEvidenceRef]);

const isGateCheck = (value: unknown): value is BodyChangeGateCheck =>
  typeof value === 'object' &&
  value !== null &&
  'kind' in value &&
  'label' in value &&
  'ok' in value &&
  typeof value.kind === 'string' &&
  typeof value.label === 'string' &&
  typeof value.ok === 'boolean';

const extractCheckpointGateReport = (event: BodyChangeEventRow): BodyChangeGateCheck[] => {
  const gateReport = event.payloadJson['gateReport'];
  if (!Array.isArray(gateReport)) {
    return [];
  }

  return gateReport.filter(isGateCheck);
};

const extractEventGateReport = (event: BodyChangeEventRow | null): BodyChangeGateCheck[] =>
  event ? extractCheckpointGateReport(event) : [];

const findLatestBoundaryCheckpoint = (
  events: BodyChangeEventRow[],
): { gateReport: BodyChangeGateCheck[]; evidenceRefs: string[] } | null => {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.eventKind !== BODY_CHANGE_EVENT_KIND.BOUNDARY_CHECKED) {
      continue;
    }

    return {
      gateReport: extractCheckpointGateReport(event),
      evidenceRefs: event.evidenceRefsJson,
    };
  }

  return null;
};

const findLatestEventByKind = (
  events: BodyChangeEventRow[],
  eventKind: BodyChangeEventRow['eventKind'],
): BodyChangeEventRow | null => {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.eventKind === eventKind) {
      return event;
    }
  }

  return null;
};

const buildCandidateCommitMessage = (message: string, proposalId: string): string =>
  `${message}\n\nBody-Change-Proposal: ${proposalId}`;

const rollbackEventMatchesInput = (
  event: BodyChangeEventRow,
  input: BodyChangeRollbackInput,
): boolean => {
  if (event.eventKind !== BODY_CHANGE_EVENT_KIND.ROLLBACK_EVIDENCE_RECORDED) {
    return false;
  }

  return (
    event.payloadJson['snapshotId'] === input.snapshotId &&
    event.payloadJson['rollbackReason'] === input.rollbackReason &&
    event.payloadJson['verificationResult'] === input.verificationResult
  );
};

const verifyGovernorApprovalFromDb =
  (config: CoreRuntimeConfig): BodyChangeApprovalVerifier =>
  async (input) =>
    await withRuntimeDbClient(config.postgresUrl, async (client) => {
      const result = await client.query<{
        target_ref: string | null;
        proposal_state: string;
        decision_kind: string;
      }>(
        `select p.target_ref,
                p.state as proposal_state,
                d.decision_kind
         from polyphony_runtime.development_proposals p
         join polyphony_runtime.development_proposal_decisions d
           on d.proposal_id = p.proposal_id
         where p.proposal_id = $1
           and d.decision_id = $2
         limit 1`,
        [input.governorProposalId, input.governorDecisionRef],
      );

      const row = result.rows[0];
      if (!row) {
        return {
          approved: false,
          targetRef: null,
        };
      }

      return {
        approved:
          row.proposal_state === 'approved' &&
          row.decision_kind === 'approved' &&
          row.target_ref === input.expectedTargetRef,
        targetRef: row.target_ref,
      };
    });

const createGovernorOutcomeRecorder =
  (config: CoreRuntimeConfig): BodyChangeGovernorOutcomeRecorder =>
  async (input) => {
    const governorService = createDbBackedDevelopmentGovernorService(config);
    return await governorService.recordProposalExecutionOutcome({
      requestId: input.requestId,
      proposalId: input.proposalId,
      outcomeKind: input.outcomeKind,
      outcomeOrigin: input.outcomeOrigin,
      targetRef: input.targetRef,
      evidenceRefs: input.evidenceRefs,
      recordedAt: input.recordedAt,
    });
  };

const ensureHumanOverrideGovernorApprovalFromDb =
  (config: CoreRuntimeConfig): BodyChangeHumanOverrideGovernorApprover =>
  async ({ request, normalizedRequestHash }) => {
    const governorService = createDbBackedDevelopmentGovernorService(config);
    const targetRef = buildBodyChangeTargetRef(normalizedRequestHash);
    const evidenceRefs = uniqueSorted([
      request.ownerOverrideEvidenceRef ?? '',
      ...request.evidenceRefs,
    ]);
    const proposalRequestId = buildHumanOverrideGovernorRequestId(
      normalizedRequestHash,
      'proposal',
    );
    const decisionRequestId = buildHumanOverrideGovernorRequestId(
      normalizedRequestHash,
      'decision',
    );

    const proposal = await governorService.submitInternalDevelopmentProposal({
      requestId: proposalRequestId,
      sourceOwner: 'human_override',
      proposalKind: 'code_change',
      problemSignature: `body-change:${normalizedRequestHash}`,
      summary: `Human override body change ${request.requestId}`,
      evidenceRefs,
      rollbackPlanRef: request.rollbackPlanRef,
      targetRef,
      requestedAt: new Date().toISOString(),
      payload: {
        bodyChangeRequestId: request.requestId,
        scopeKind: request.scopeKind,
        rationale: request.rationale,
        requiredEvalSuite: request.requiredEvalSuite,
        targetPaths: request.targetPaths,
      },
    });

    if (!proposal.accepted) {
      throw new Error(`failed to register human_override governor proposal: ${proposal.reason}`);
    }

    const decision = await governorService.recordProposalDecision({
      requestId: decisionRequestId,
      proposalId: proposal.proposalId,
      decisionKind: 'approved',
      decisionOrigin: DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.HUMAN_OVERRIDE,
      rationale: `Approved via owner override evidence ${request.ownerOverrideEvidenceRef}`,
      evidenceRefs,
      decidedAt: new Date().toISOString(),
    });

    if (!decision.accepted) {
      throw new Error(`failed to register human_override governor approval: ${decision.reason}`);
    }

    return {
      accepted: true,
      governorProposalId: proposal.proposalId,
      governorDecisionRef: decision.decisionId,
      targetRef,
    };
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
  const gitGateway =
    options.gitGateway ?? createBodyEvolutionGitGateway({ config: options.config });
  const commandRunner = options.commandRunner ?? createBodyEvolutionCommandRunner();
  const resolveEvalSuiteCommand = options.resolveEvalSuiteCommand ?? resolveDefaultEvalSuiteCommand;
  const perimeterDecisionService = options.perimeterDecisionService;

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
      const normalizedRequestHash = hashRequest(request);
      const expectedGovernorTargetRef = buildBodyChangeTargetRef(normalizedRequestHash);
      let governorProposalId: string | null = null;
      let governorDecisionRef: string | null = null;
      let governorTargetRef: string | null = null;
      if (request.requestedByOwner === BODY_CHANGE_REQUESTED_BY_OWNER.GOVERNOR) {
        const verification = normalizeAuthorityVerification(
          (await options.verifyGovernorApproval?.({
            governorDecisionRef: request.governorDecisionRef,
            governorProposalId: request.governorProposalId,
            expectedTargetRef: expectedGovernorTargetRef,
          })) ?? false,
        );
        if (!verification.approved || verification.targetRef !== expectedGovernorTargetRef) {
          return createRejectedResult(
            'governor_not_approved',
            request.requestId,
            'governor approval target does not match the requested body change',
          );
        }
        governorProposalId = request.governorProposalId;
        governorDecisionRef = request.governorDecisionRef;
        governorTargetRef = verification.targetRef;
      } else {
        try {
          const approval = await options.ensureHumanOverrideGovernorApproval({
            request,
            normalizedRequestHash,
          });
          governorProposalId = approval.governorProposalId;
          governorDecisionRef = approval.governorDecisionRef;
          governorTargetRef = approval.targetRef;
        } catch (error) {
          return createRejectedResult(
            'persistence_unavailable',
            request.requestId,
            error instanceof Error ? error.message : String(error),
          );
        }
      }

      const proposalRawId = createId();
      const proposalId = `body-change-proposal:${proposalRawId}`;
      const eventId = `body-change-event:${createId()}`;
      const createdAt = now().toISOString();
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

      const perimeterResult = await perimeterDecisionService?.evaluateControlRequest(
        request.requestedByOwner === BODY_CHANGE_REQUESTED_BY_OWNER.GOVERNOR
          ? {
              requestId: request.requestId,
              ingressOwner: PERIMETER_INGRESS_OWNER.F_0017,
              actionClass: PERIMETER_ACTION_CLASS.CODE_OR_PROMOTION_CHANGE,
              authorityOwner: PERIMETER_AUTHORITY_OWNER.GOVERNOR,
              governorProposalId: governorProposalId ?? request.governorProposalId,
              governorDecisionRef: governorDecisionRef ?? request.governorDecisionRef,
              targetRef: expectedGovernorTargetRef,
              evidenceRefs: request.evidenceRefs,
            }
          : {
              requestId: request.requestId,
              ingressOwner: PERIMETER_INGRESS_OWNER.F_0017,
              actionClass: PERIMETER_ACTION_CLASS.CODE_OR_PROMOTION_CHANGE,
              authorityOwner: PERIMETER_AUTHORITY_OWNER.HUMAN_OVERRIDE,
              humanOverrideEvidenceRef: request.ownerOverrideEvidenceRef,
              targetRef: expectedGovernorTargetRef,
              evidenceRefs: request.evidenceRefs,
            },
      );
      if (perimeterResult && !perimeterResult.accepted) {
        return createRejectedResult(
          'persistence_unavailable',
          request.requestId,
          'perimeter decision persistence is unavailable',
        );
      }
      if (perimeterResult && perimeterResult.verdict !== PERIMETER_VERDICT.ALLOW) {
        return createRejectedResult(
          request.requestedByOwner === BODY_CHANGE_REQUESTED_BY_OWNER.GOVERNOR
            ? 'governor_not_approved'
            : 'override_not_recorded',
          request.requestId,
          `perimeter refused code_or_promotion_change with ${perimeterResult.decisionReason}`,
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
          governorProposalId,
          governorDecisionRef,
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
            governorProposalId,
            governorDecisionRef,
            ownerOverrideEvidenceRef:
              request.requestedByOwner === BODY_CHANGE_REQUESTED_BY_OWNER.HUMAN_OVERRIDE
                ? request.ownerOverrideEvidenceRef
                : null,
            governorTargetRef,
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

    async prepareProposalWorktree(input) {
      const proposalRow = await options.store.getProposal(input.proposalId);
      if (!proposalRow) {
        return createMutationRejected('proposal_not_found', input.requestId);
      }
      const proposal = mapProposalRow(proposalRow);
      if (proposal.status === BODY_CHANGE_STATUS.WORKTREE_READY) {
        return {
          accepted: true,
          requestId: input.requestId,
          proposalId: proposal.proposalId,
          status: BODY_CHANGE_STATUS.WORKTREE_READY,
          proposal,
          createdAt: proposal.updatedAt,
        };
      }
      if (proposal.status !== BODY_CHANGE_STATUS.REQUESTED) {
        return createMutationRejected('invalid_status', input.requestId, undefined, { proposal });
      }
      const createdAt = input.preparedAt ?? now().toISOString();

      try {
        await gitGateway.createWorktree({
          branchName: proposal.branchName,
          worktreePath: proposal.worktreePath,
        });
      } catch (error) {
        return createMutationRejected(
          'worktree_unavailable',
          input.requestId,
          error instanceof Error ? error.message : String(error),
          { proposal },
        );
      }

      try {
        const result = await options.store.recordLifecycleEvent({
          proposalId: proposal.proposalId,
          eventId: `body-change-event:${createId()}`,
          eventKind: BODY_CHANGE_EVENT_KIND.WORKTREE_PREPARED,
          status: BODY_CHANGE_STATUS.WORKTREE_READY,
          evidenceRefs: uniqueSorted(input.evidenceRefs),
          createdAt,
          expectedCurrentStatuses: [BODY_CHANGE_STATUS.REQUESTED],
          payloadJson: {
            owner: 'F-0017',
            slice: 'SL-F0017-02',
            branchName: proposal.branchName,
            worktreePath: proposal.worktreePath,
          },
        });

        if (!result.accepted) {
          return createMutationRejected(
            result.reason === 'proposal_not_found' ? 'proposal_not_found' : 'invalid_status',
            input.requestId,
            undefined,
            result.proposal ? { proposal: mapProposalRow(result.proposal) } : {},
          );
        }

        return {
          accepted: true,
          requestId: input.requestId,
          proposalId: proposal.proposalId,
          status: BODY_CHANGE_STATUS.WORKTREE_READY,
          proposal: mapProposalRow(result.proposal),
          createdAt,
        };
      } catch (error) {
        return createMutationRejected(
          'persistence_unavailable',
          input.requestId,
          error instanceof Error ? error.message : String(error),
          { proposal },
        );
      }
    },

    async evaluateProposalForCandidate(input) {
      const proposalRow = await options.store.getProposal(input.proposalId);
      if (!proposalRow) {
        return createMutationRejected('proposal_not_found', input.requestId);
      }

      const proposal = mapProposalRow(proposalRow);
      const createdAt = input.evaluatedAt ?? now().toISOString();
      const candidateCommitMessage = buildCandidateCommitMessage(
        input.candidateCommitMessage,
        proposal.proposalId,
      );
      const recordedEvents = await options.store.listProposalEvents({
        proposalId: proposal.proposalId,
      });
      const resolvedEvalSuiteCommand = await resolveEvalSuiteCommand(proposal.requiredEvalSuite);
      if (!resolvedEvalSuiteCommand) {
        return createMutationRejected(
          'invalid_eval_suite',
          input.requestId,
          `proposal eval suite ${proposal.requiredEvalSuite} is not mapped to a local command contract`,
          { proposal },
        );
      }

      if (!matchesEvalSuiteContract(input.evalCommand, resolvedEvalSuiteCommand)) {
        return createMutationRejected(
          'invalid_eval_suite',
          input.requestId,
          `proposal requires eval suite contract ${proposal.requiredEvalSuite}`,
          { proposal },
        );
      }

      if (proposal.status === BODY_CHANGE_STATUS.CANDIDATE_COMMITTED) {
        const committedEvent = findLatestEventByKind(
          recordedEvents,
          BODY_CHANGE_EVENT_KIND.CANDIDATE_COMMITTED,
        );
        const committedGateReport = extractEventGateReport(committedEvent);
        return {
          accepted: true,
          requestId: input.requestId,
          proposalId: proposal.proposalId,
          status: BODY_CHANGE_STATUS.CANDIDATE_COMMITTED,
          proposal,
          gateReport:
            committedGateReport.length > 0
              ? committedGateReport
              : (findLatestBoundaryCheckpoint(recordedEvents)?.gateReport ?? []),
          createdAt: committedEvent?.createdAt ?? proposal.updatedAt,
        };
      }

      if (proposal.status === BODY_CHANGE_STATUS.EVALUATION_FAILED) {
        const failedEvent = findLatestEventByKind(
          recordedEvents,
          BODY_CHANGE_EVENT_KIND.EVALUATION_FAILED,
        );
        return {
          accepted: true,
          requestId: input.requestId,
          proposalId: proposal.proposalId,
          status: BODY_CHANGE_STATUS.EVALUATION_FAILED,
          proposal,
          gateReport: extractEventGateReport(failedEvent),
          createdAt: failedEvent?.createdAt ?? proposal.updatedAt,
        };
      }

      if (
        proposal.status !== BODY_CHANGE_STATUS.WORKTREE_READY &&
        proposal.status !== BODY_CHANGE_STATUS.EVALUATING
      ) {
        return createMutationRejected('invalid_status', input.requestId, undefined, { proposal });
      }

      if (proposal.status === BODY_CHANGE_STATUS.WORKTREE_READY) {
        try {
          const started = await options.store.recordLifecycleEvent({
            proposalId: proposal.proposalId,
            eventId: `body-change-event:${createId()}`,
            eventKind: BODY_CHANGE_EVENT_KIND.EVALUATION_STARTED,
            status: BODY_CHANGE_STATUS.EVALUATING,
            evidenceRefs: uniqueSorted(input.evidenceRefs),
            createdAt,
            expectedCurrentStatuses: [BODY_CHANGE_STATUS.WORKTREE_READY],
            payloadJson: {
              owner: 'F-0017',
              slice: 'SL-F0017-02',
              requiredEvalSuite: proposal.requiredEvalSuite,
              candidateCommitMessage,
            },
          });

          if (!started.accepted) {
            return createMutationRejected(
              started.reason === 'proposal_not_found' ? 'proposal_not_found' : 'invalid_status',
              input.requestId,
              undefined,
              started.proposal ? { proposal: mapProposalRow(started.proposal) } : {},
            );
          }
        } catch (error) {
          return createMutationRejected(
            'persistence_unavailable',
            input.requestId,
            error instanceof Error ? error.message : String(error),
            { proposal },
          );
        }
      }

      const boundaryCheckpoint = findLatestBoundaryCheckpoint(recordedEvents);
      let gateReport: BodyChangeGateCheck[];
      let lifecycleEvidenceRefs: string[];
      if (proposal.status === BODY_CHANGE_STATUS.EVALUATING && boundaryCheckpoint) {
        gateReport = boundaryCheckpoint.gateReport;
        lifecycleEvidenceRefs = uniqueSorted([
          ...input.evidenceRefs,
          ...boundaryCheckpoint.evidenceRefs,
        ]);
      } else {
        const commands = buildRepoGateCommands(proposal, resolvedEvalSuiteCommand);
        gateReport = [];
        for (const command of commands) {
          gateReport.push(
            await commandRunner({
              worktreePath: proposal.worktreePath,
              command,
            }),
          );
          if (!gateReport[gateReport.length - 1]?.ok) {
            break;
          }
        }

        const gateEvidenceRefs = collectGateEvidenceRefs(gateReport);
        lifecycleEvidenceRefs = uniqueSorted([...input.evidenceRefs, ...gateEvidenceRefs]);

        const failedCheck = gateReport.find((check) => !check.ok);
        if (failedCheck) {
          try {
            const failed = await options.store.recordLifecycleEvent({
              proposalId: proposal.proposalId,
              eventId: `body-change-event:${createId()}`,
              eventKind: BODY_CHANGE_EVENT_KIND.EVALUATION_FAILED,
              status: BODY_CHANGE_STATUS.EVALUATION_FAILED,
              evidenceRefs: lifecycleEvidenceRefs,
              createdAt,
              expectedCurrentStatuses: [BODY_CHANGE_STATUS.EVALUATING],
              payloadJson: {
                owner: 'F-0017',
                slice: 'SL-F0017-02',
                gateReport,
                candidateCommitMessage,
              },
            });

            if (!failed.accepted) {
              return createMutationRejected(
                failed.reason === 'proposal_not_found' ? 'proposal_not_found' : 'invalid_status',
                input.requestId,
                undefined,
                failed.proposal ? { proposal: mapProposalRow(failed.proposal) } : {},
              );
            }

            return {
              accepted: true,
              requestId: input.requestId,
              proposalId: proposal.proposalId,
              status: BODY_CHANGE_STATUS.EVALUATION_FAILED,
              proposal: mapProposalRow(failed.proposal),
              gateReport,
              createdAt,
            };
          } catch (error) {
            return createMutationRejected(
              'persistence_unavailable',
              input.requestId,
              error instanceof Error ? error.message : String(error),
              { proposal },
            );
          }
        }

        try {
          const boundaryChecked = await options.store.recordLifecycleEvent({
            proposalId: proposal.proposalId,
            eventId: `body-change-event:${createId()}`,
            eventKind: BODY_CHANGE_EVENT_KIND.BOUNDARY_CHECKED,
            status: BODY_CHANGE_STATUS.EVALUATING,
            evidenceRefs: lifecycleEvidenceRefs,
            createdAt,
            expectedCurrentStatuses: [BODY_CHANGE_STATUS.EVALUATING],
            payloadJson: {
              owner: 'F-0017',
              slice: 'SL-F0017-02',
              gateReport,
              candidateCommitMessage,
            },
          });

          if (!boundaryChecked.accepted) {
            return createMutationRejected(
              boundaryChecked.reason === 'proposal_not_found'
                ? 'proposal_not_found'
                : 'invalid_status',
              input.requestId,
              undefined,
              boundaryChecked.proposal
                ? { proposal: mapProposalRow(boundaryChecked.proposal) }
                : {},
            );
          }
        } catch (error) {
          return createMutationRejected(
            'persistence_unavailable',
            input.requestId,
            error instanceof Error ? error.message : String(error),
            { proposal },
          );
        }
      }

      let commitSha: string;
      try {
        const existingCommit = await gitGateway.findCommittedCandidate({
          worktreePath: proposal.worktreePath,
          message: candidateCommitMessage,
        });
        if (existingCommit) {
          commitSha = existingCommit.commitSha;
        } else {
          const commitResult = await gitGateway.commitCandidate({
            worktreePath: proposal.worktreePath,
            message: candidateCommitMessage,
          });
          commitSha = commitResult.commitSha;
        }
      } catch (error) {
        try {
          const failed = await options.store.recordLifecycleEvent({
            proposalId: proposal.proposalId,
            eventId: `body-change-event:${createId()}`,
            eventKind: BODY_CHANGE_EVENT_KIND.EVALUATION_FAILED,
            status: BODY_CHANGE_STATUS.EVALUATION_FAILED,
            evidenceRefs: lifecycleEvidenceRefs,
            createdAt,
            expectedCurrentStatuses: [BODY_CHANGE_STATUS.EVALUATING],
            payloadJson: {
              owner: 'F-0017',
              slice: 'SL-F0017-02',
              gateReport,
              candidateCommitMessage,
              commitError: error instanceof Error ? error.message : String(error),
            },
          });

          if (!failed.accepted) {
            return createMutationRejected(
              failed.reason === 'proposal_not_found' ? 'proposal_not_found' : 'invalid_status',
              input.requestId,
              undefined,
              failed.proposal ? { proposal: mapProposalRow(failed.proposal) } : {},
            );
          }

          return {
            accepted: true,
            requestId: input.requestId,
            proposalId: proposal.proposalId,
            status: BODY_CHANGE_STATUS.EVALUATION_FAILED,
            proposal: mapProposalRow(failed.proposal),
            gateReport,
            createdAt,
          };
        } catch (persistenceError) {
          return createMutationRejected(
            'persistence_unavailable',
            input.requestId,
            persistenceError instanceof Error ? persistenceError.message : String(persistenceError),
            { proposal },
          );
        }
      }

      try {
        const committed = await options.store.recordLifecycleEvent({
          proposalId: proposal.proposalId,
          eventId: `body-change-event:${createId()}`,
          eventKind: BODY_CHANGE_EVENT_KIND.CANDIDATE_COMMITTED,
          status: BODY_CHANGE_STATUS.CANDIDATE_COMMITTED,
          evidenceRefs: lifecycleEvidenceRefs,
          createdAt,
          expectedCurrentStatuses: [BODY_CHANGE_STATUS.EVALUATING],
          candidateCommitSha: commitSha,
          payloadJson: {
            owner: 'F-0017',
            slice: 'SL-F0017-02',
            gateReport,
            candidateCommitMessage,
            candidateCommitSha: commitSha,
          },
        });

        if (!committed.accepted) {
          return createMutationRejected(
            committed.reason === 'proposal_not_found' ? 'proposal_not_found' : 'invalid_status',
            input.requestId,
            undefined,
            committed.proposal ? { proposal: mapProposalRow(committed.proposal) } : {},
          );
        }

        return {
          accepted: true,
          requestId: input.requestId,
          proposalId: proposal.proposalId,
          status: BODY_CHANGE_STATUS.CANDIDATE_COMMITTED,
          proposal: mapProposalRow(committed.proposal),
          gateReport,
          createdAt,
        };
      } catch (error) {
        return createMutationRejected(
          'persistence_unavailable',
          input.requestId,
          error instanceof Error ? error.message : String(error),
          { proposal },
        );
      }
    },

    async publishStableSnapshot(input) {
      const proposalRow = await options.store.getProposal(input.proposalId);
      if (!proposalRow) {
        return createMutationRejected('proposal_not_found', input.requestId);
      }
      const proposal = mapProposalRow(proposalRow);
      const manifestValidationError = validateSnapshotInput(input);
      if (manifestValidationError) {
        return createMutationRejected(
          'snapshot_manifest_invalid',
          input.requestId,
          manifestValidationError,
          { proposal },
        );
      }

      const recordedEvents = await options.store.listProposalEvents({
        proposalId: proposal.proposalId,
      });
      const governorTargetRef = extractGovernorTargetRef(recordedEvents);
      if (!proposal.governorProposalId || !governorTargetRef) {
        return createMutationRejected(
          'governor_outcome_unavailable',
          input.requestId,
          'governor execution authority is missing from the recorded approval evidence',
          { proposal },
        );
      }

      const createdAt = input.publishedAt ?? now().toISOString();
      const snapshotId = createSnapshotId(proposal);
      const criticalConfigHash = hashStableValue(input.criticalConfigJson);
      const gitTag = createBodyEvolutionStableTagName(snapshotId);

      const manifestPath = createManifestPath(options.config, snapshotId);
      const manifest = buildSnapshotManifest({
        snapshotId,
        proposalId: proposal.proposalId,
        gitTag,
        schemaVersion: input.schemaVersion,
        modelProfileMapJson: input.modelProfileMapJson,
        criticalConfigHash,
        evalSummaryJson: input.evalSummaryJson,
        manifestPath,
      });
      const manifestHash = hashStableValue(manifest);
      const manifestContents = `${JSON.stringify({ ...manifest, manifestHash }, null, 2)}\n`;

      const existingSnapshot = await options.store.getStableSnapshotByProposalId(
        proposal.proposalId,
      );
      if (proposal.status === BODY_CHANGE_STATUS.ROLLED_BACK) {
        return createMutationRejected('invalid_status', input.requestId, undefined, {
          proposal,
          ...(existingSnapshot ? { snapshot: mapStableSnapshotRow(existingSnapshot) } : {}),
        });
      }

      if (existingSnapshot) {
        if (
          existingSnapshot.snapshotId !== snapshotId ||
          existingSnapshot.manifestHash !== manifestHash
        ) {
          return createMutationRejected(
            'snapshot_manifest_invalid',
            input.requestId,
            'stable snapshot manifest hash conflicts with the existing proposal snapshot',
            {
              proposal,
              snapshot: mapStableSnapshotRow(existingSnapshot),
            },
          );
        }
      }

      if (!existingSnapshot && proposal.status !== BODY_CHANGE_STATUS.CANDIDATE_COMMITTED) {
        return createMutationRejected('invalid_status', input.requestId, undefined, {
          proposal,
        });
      }

      const stableTagCommitSha = proposal.candidateCommitSha;
      if (!stableTagCommitSha) {
        return createMutationRejected(
          'snapshot_manifest_invalid',
          input.requestId,
          'candidate commit sha is required before stable snapshot publication',
          { proposal },
        );
      }

      let manifestCreated = false;
      try {
        await fileOps.mkdir(path.dirname(manifestPath), { recursive: true });
        if (!existingSnapshot) {
          await fileOps.writeFile(manifestPath, manifestContents, {
            encoding: 'utf8',
            flag: 'wx',
          });
          manifestCreated = true;
        }
      } catch (error) {
        if (getErrorCode(error) === 'EEXIST') {
          const racedSnapshot = await options.store.getStableSnapshotByProposalId(
            proposal.proposalId,
          );
          if (
            racedSnapshot &&
            racedSnapshot.snapshotId === snapshotId &&
            racedSnapshot.manifestHash === manifestHash
          ) {
            manifestCreated = false;
          } else if (racedSnapshot) {
            return createMutationRejected(
              'snapshot_manifest_invalid',
              input.requestId,
              'stable snapshot manifest hash conflicts with the existing proposal snapshot',
              {
                proposal,
                snapshot: mapStableSnapshotRow(racedSnapshot),
              },
            );
          } else {
            try {
              const existingManifest = await fileOps.readFile(manifestPath, 'utf8');
              if (existingManifest === manifestContents) {
                manifestCreated = false;
              } else {
                return createMutationRejected(
                  'snapshot_manifest_invalid',
                  input.requestId,
                  'stable snapshot manifest path already exists without a registered snapshot record',
                  { proposal },
                );
              }
            } catch (readError) {
              return createMutationRejected(
                'snapshot_manifest_invalid',
                input.requestId,
                readError instanceof Error ? readError.message : String(readError),
                { proposal },
              );
            }
          }
        } else {
          return createMutationRejected(
            'snapshot_manifest_invalid',
            input.requestId,
            error instanceof Error ? error.message : String(error),
            { proposal },
          );
        }
      }

      try {
        await gitGateway.createStableTag({
          worktreePath: proposal.worktreePath,
          snapshotId,
          commitSha: stableTagCommitSha,
        });
      } catch (error) {
        if (manifestCreated) {
          await fileOps.unlink(manifestPath).catch(() => undefined);
        }
        return createMutationRejected(
          'snapshot_manifest_invalid',
          input.requestId,
          error instanceof Error ? error.message : String(error),
          existingSnapshot
            ? {
                proposal,
                snapshot: mapStableSnapshotRow(existingSnapshot),
              }
            : { proposal },
        );
      }

      let publicationResult: Awaited<ReturnType<BodyEvolutionStore['publishStableSnapshot']>>;
      try {
        publicationResult = await options.store.publishStableSnapshot({
          snapshotId,
          proposalId: proposal.proposalId,
          eventId: `body-change-event:${createId()}`,
          gitTag,
          schemaVersion: input.schemaVersion,
          modelProfileMapJson: input.modelProfileMapJson,
          criticalConfigHash,
          evalSummaryJson: input.evalSummaryJson,
          manifestHash,
          manifestPath,
          evidenceRefs: uniqueSorted(input.evidenceRefs),
          createdAt,
          expectedCurrentStatuses: [BODY_CHANGE_STATUS.CANDIDATE_COMMITTED],
          payloadJson: {
            owner: 'F-0017',
            slice: 'SL-F0017-03',
            snapshotId,
            gitTag,
            manifestPath,
            criticalConfigHash,
            evalSummaryJson: input.evalSummaryJson,
          },
        });
      } catch (error) {
        if (manifestCreated) {
          await fileOps.unlink(manifestPath).catch(() => undefined);
        }
        return createMutationRejected(
          'persistence_unavailable',
          input.requestId,
          error instanceof Error ? error.message : String(error),
          { proposal },
        );
      }

      if (!publicationResult.accepted) {
        if (manifestCreated) {
          await fileOps.unlink(manifestPath).catch(() => undefined);
        }
        return createMutationRejected(
          publicationResult.reason === 'proposal_not_found'
            ? 'proposal_not_found'
            : publicationResult.reason === 'invalid_status'
              ? 'invalid_status'
              : 'snapshot_manifest_invalid',
          input.requestId,
          publicationResult.reason === 'snapshot_conflict'
            ? 'stable snapshot manifest hash conflicts with the existing proposal snapshot'
            : undefined,
          {
            ...(publicationResult.proposal
              ? { proposal: mapProposalRow(publicationResult.proposal) }
              : {}),
            ...(publicationResult.snapshot
              ? { snapshot: mapStableSnapshotRow(publicationResult.snapshot) }
              : {}),
          },
        );
      }

      const outcome = await options.recordGovernorOutcome({
        requestId: `${input.requestId}:executed`,
        proposalId: proposal.governorProposalId,
        outcomeKind: 'executed',
        outcomeOrigin:
          proposal.requestedByOwner === BODY_CHANGE_REQUESTED_BY_OWNER.HUMAN_OVERRIDE
            ? 'human_override'
            : 'runtime',
        targetRef: governorTargetRef,
        evidenceRefs: buildGovernorOutcomeEvidenceRefs(
          input.evidenceRefs,
          `body-change:snapshot:${snapshotId}`,
        ),
        recordedAt: createdAt,
        payload: {
          executionBoundary: 'F-0017',
          evidenceOnly: true,
          snapshotId,
        },
      });

      if (!outcome.accepted) {
        return createMutationRejected(
          'governor_outcome_unavailable',
          input.requestId,
          `execution outcome recording failed with reason ${outcome.reason}`,
          {
            proposal: mapProposalRow(publicationResult.proposal),
            snapshot: mapStableSnapshotRow(publicationResult.snapshot),
          },
        );
      }

      return {
        accepted: true,
        requestId: input.requestId,
        proposalId: proposal.proposalId,
        status: BODY_CHANGE_STATUS.SNAPSHOT_READY,
        proposal: mapProposalRow(publicationResult.proposal),
        snapshot: mapStableSnapshotRow(publicationResult.snapshot),
        deduplicated: publicationResult.deduplicated,
        createdAt,
      };
    },

    async recordRollbackEvidence(input) {
      const proposalRow = await options.store.getProposal(input.proposalId);
      if (!proposalRow) {
        return createMutationRejected('proposal_not_found', input.requestId);
      }
      const proposal = mapProposalRow(proposalRow);
      const snapshotRow = await options.store.getStableSnapshot(input.snapshotId);
      if (!snapshotRow || snapshotRow.proposalId !== proposal.proposalId) {
        return createMutationRejected(
          'snapshot_not_found',
          input.requestId,
          `stable snapshot ${input.snapshotId} was not found for proposal ${proposal.proposalId}`,
          { proposal },
        );
      }
      const snapshot = mapStableSnapshotRow(snapshotRow);

      const recordedEvents = await options.store.listProposalEvents({
        proposalId: proposal.proposalId,
      });
      const replayedRollbackEvent = recordedEvents.find((event) =>
        rollbackEventMatchesInput(event, input),
      );
      const governorTargetRef = extractGovernorTargetRef(recordedEvents);
      if (!proposal.governorProposalId || !governorTargetRef) {
        return createMutationRejected(
          'governor_outcome_unavailable',
          input.requestId,
          'governor execution authority is missing from the recorded approval evidence',
          { proposal, snapshot },
        );
      }

      const rollbackEvidenceRefs = buildGovernorOutcomeEvidenceRefs(
        input.evidenceRefs,
        `body-change:rollback:${snapshot.snapshotId}`,
      );
      const perimeterResult = await perimeterDecisionService?.evaluateControlRequest(
        proposal.requestedByOwner === BODY_CHANGE_REQUESTED_BY_OWNER.HUMAN_OVERRIDE
          ? {
              requestId: input.requestId,
              ingressOwner: PERIMETER_INGRESS_OWNER.F_0017,
              actionClass: PERIMETER_ACTION_CLASS.FORCE_ROLLBACK,
              authorityOwner: PERIMETER_AUTHORITY_OWNER.HUMAN_OVERRIDE,
              humanOverrideEvidenceRef: proposal.ownerOverrideEvidenceRef ?? '',
              targetRef: governorTargetRef,
              evidenceRefs: rollbackEvidenceRefs,
            }
          : {
              requestId: input.requestId,
              ingressOwner: PERIMETER_INGRESS_OWNER.F_0017,
              actionClass: PERIMETER_ACTION_CLASS.FORCE_ROLLBACK,
              authorityOwner: PERIMETER_AUTHORITY_OWNER.GOVERNOR,
              governorProposalId: proposal.governorProposalId,
              governorDecisionRef: proposal.governorDecisionRef ?? '',
              targetRef: governorTargetRef,
              evidenceRefs: rollbackEvidenceRefs,
            },
      );
      if (perimeterResult && !perimeterResult.accepted) {
        return createMutationRejected(
          'persistence_unavailable',
          input.requestId,
          'perimeter decision persistence is unavailable',
          { proposal, snapshot },
        );
      }
      if (perimeterResult && perimeterResult.verdict !== PERIMETER_VERDICT.ALLOW) {
        return createMutationRejected(
          'perimeter_denied',
          input.requestId,
          `perimeter refused force_rollback with ${perimeterResult.decisionReason}`,
          { proposal, snapshot },
        );
      }

      const createdAt = input.recordedAt ?? now().toISOString();
      let rollbackProposal = proposal;
      if (proposal.status === BODY_CHANGE_STATUS.ROLLED_BACK) {
        if (!replayedRollbackEvent) {
          return createMutationRejected(
            'invalid_status',
            input.requestId,
            'rollback evidence was already recorded with different payload',
            { proposal, snapshot },
          );
        }
      } else {
        let rollbackResult: Awaited<ReturnType<BodyEvolutionStore['recordLifecycleEvent']>>;
        try {
          rollbackResult = await options.store.recordLifecycleEvent({
            proposalId: proposal.proposalId,
            eventId: `body-change-event:${createId()}`,
            eventKind: BODY_CHANGE_EVENT_KIND.ROLLBACK_EVIDENCE_RECORDED,
            status: BODY_CHANGE_STATUS.ROLLED_BACK,
            evidenceRefs: uniqueSorted(input.evidenceRefs),
            createdAt,
            expectedCurrentStatuses: [BODY_CHANGE_STATUS.SNAPSHOT_READY],
            payloadJson: {
              owner: 'F-0017',
              slice: 'SL-F0017-03',
              snapshotId: snapshot.snapshotId,
              rollbackReason: input.rollbackReason,
              verificationResult: input.verificationResult,
            },
          });
        } catch (error) {
          return createMutationRejected(
            'persistence_unavailable',
            input.requestId,
            error instanceof Error ? error.message : String(error),
            { proposal, snapshot },
          );
        }

        if (!rollbackResult.accepted) {
          return createMutationRejected(
            rollbackResult.reason === 'proposal_not_found'
              ? 'proposal_not_found'
              : 'invalid_status',
            input.requestId,
            undefined,
            {
              ...(rollbackResult.proposal
                ? { proposal: mapProposalRow(rollbackResult.proposal) }
                : {}),
              snapshot,
            },
          );
        }

        rollbackProposal = mapProposalRow(rollbackResult.proposal);
      }

      const outcome = await options.recordGovernorOutcome({
        requestId: `${input.requestId}:rolled-back`,
        proposalId: proposal.governorProposalId,
        outcomeKind: 'rolled_back',
        outcomeOrigin:
          proposal.requestedByOwner === BODY_CHANGE_REQUESTED_BY_OWNER.HUMAN_OVERRIDE
            ? 'human_override'
            : 'runtime',
        targetRef: governorTargetRef,
        evidenceRefs: rollbackEvidenceRefs,
        recordedAt: createdAt,
        payload: {
          executionBoundary: 'F-0017',
          evidenceOnly: true,
          snapshotId: snapshot.snapshotId,
          rollbackReason: input.rollbackReason,
          verificationResult: input.verificationResult,
        },
      });

      if (!outcome.accepted) {
        return createMutationRejected(
          'governor_outcome_unavailable',
          input.requestId,
          `rollback outcome recording failed with reason ${outcome.reason}`,
          {
            proposal: rollbackProposal,
            snapshot,
          },
        );
      }

      return {
        accepted: true,
        requestId: input.requestId,
        proposalId: proposal.proposalId,
        status: BODY_CHANGE_STATUS.ROLLED_BACK,
        proposal: rollbackProposal,
        snapshot,
        createdAt,
      };
    },
  };
};

export const createDbBackedBodyEvolutionService = (
  config: CoreRuntimeConfig,
  options: DbBackedBodyEvolutionServiceOptions = {},
): BodyEvolutionService => {
  const verifyGovernorApproval =
    options.verifyGovernorApproval ?? verifyGovernorApprovalFromDb(config);
  const ensureHumanOverrideGovernorApproval =
    options.ensureHumanOverrideGovernorApproval ??
    ensureHumanOverrideGovernorApprovalFromDb(config);
  const recordGovernorOutcome =
    options.recordGovernorOutcome ?? createGovernorOutcomeRecorder(config);
  const perimeterDecisionService =
    options.perimeterDecisionService ?? createDbBackedPerimeterDecisionService(config);

  const runWithStore = async <T>(
    execute: (service: BodyEvolutionService) => Promise<T>,
  ): Promise<T> =>
    await withRuntimeClient(
      config.postgresUrl,
      async (store) =>
        await execute(
          createBodyEvolutionService({
            ...options,
            config,
            store,
            verifyGovernorApproval,
            ensureHumanOverrideGovernorApproval,
            recordGovernorOutcome,
            perimeterDecisionService,
          }),
        ),
    );

  return {
    submitBodyChangeRequest: async (input) =>
      await runWithStore((service) => service.submitBodyChangeRequest(input)),
    prepareProposalWorktree: async (input) =>
      await runWithStore((service) => service.prepareProposalWorktree(input)),
    evaluateProposalForCandidate: async (input) =>
      await runWithStore((service) => service.evaluateProposalForCandidate(input)),
    publishStableSnapshot: async (input) =>
      await runWithStore((service) => service.publishStableSnapshot(input)),
    recordRollbackEvidence: async (input) =>
      await runWithStore((service) => service.recordRollbackEvidence(input)),
  };
};
