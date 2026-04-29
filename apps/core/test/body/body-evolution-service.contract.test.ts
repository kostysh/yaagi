import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  BODY_CHANGE_EVENT_KIND,
  BODY_CHANGE_REQUESTED_BY_OWNER,
  BODY_CHANGE_SCOPE_KIND,
  BODY_CHANGE_STATUS,
  type BodyChangeGateCheck,
} from '@yaagi/contracts/body-evolution';
import {
  PERIMETER_ACTION_CLASS,
  type PerimeterControlRequest,
  PERIMETER_VERDICT,
} from '@yaagi/contracts/perimeter';
import type {
  BodyChangeEventRow,
  BodyChangeProposalRow,
  BodyEvolutionStore,
  BodyStableSnapshotRow,
} from '@yaagi/db';
import type { CoreRuntimeConfig } from '../../src/platform/core-config.ts';
import {
  createBodyEvolutionService,
  type BodyChangeApprovalVerifier,
  type BodyChangeGovernorOutcomeRecorder,
  type BodyChangeHumanOverrideGovernorApprover,
} from '../../src/body/body-evolution.ts';
import type { PerimeterDecisionService } from '../../src/perimeter/index.ts';
import type { BodyEvolutionGitGateway } from '../../src/body/git-gateway.ts';

// Coverage refs: AC-F0017-01 AC-F0017-02 AC-F0017-03 AC-F0017-04 AC-F0017-05
// Coverage refs: AC-F0017-06 AC-F0017-07 AC-F0017-08 AC-F0017-09 AC-F0017-10
// Coverage refs: AC-F0017-11 AC-F0017-12 AC-F0017-13 AC-F0017-14 AC-F0017-15
// Coverage refs: AC-F0017-16 AC-F0017-17 AC-F0017-18 AC-F0017-19 AC-F0017-20
// Coverage refs: AC-F0017-21 AC-F0017-22 AC-F0017-23 AC-F0017-24 AC-F0017-25
// Coverage refs: AC-F0017-26 AC-F0017-27 AC-F0017-28 AC-F0017-29 AC-F0017-30

const createdAt = '2026-04-10T18:00:00.000Z';

const createConfig = (rootPath: string): CoreRuntimeConfig => ({
  postgresUrl: 'postgres://yaagi:yaagi@127.0.0.1:5432/yaagi',
  fastModelBaseUrl: 'http://127.0.0.1:8000/v1',
  fastModelDescriptorPath: path.join(rootPath, 'seed', 'models', 'base', 'vllm-fast-manifest.json'),
  deepModelBaseUrl: 'http://127.0.0.1:8001/v1',
  poolModelBaseUrl: 'http://127.0.0.1:8002/v1',
  telegramEnabled: false,
  telegramBotToken: null,
  telegramAllowedChatIds: [],
  telegramEgressEnabled: false,
  telegramOperatorChatId: null,
  telegramApiBaseUrl: 'https://api.telegram.org',
  seedRootPath: path.join(rootPath, 'seed'),
  seedConstitutionPath: path.join(rootPath, 'seed', 'constitution', 'constitution.yaml'),
  seedBodyPath: path.join(rootPath, 'seed', 'body'),
  seedSkillsPath: path.join(rootPath, 'seed', 'skills'),
  seedModelsPath: path.join(rootPath, 'seed', 'models'),
  seedDataPath: path.join(rootPath, 'seed', 'data'),
  workspaceBodyPath: path.join(rootPath, 'workspace', 'body'),
  workspaceSkillsPath: path.join(rootPath, 'workspace', 'skills'),
  modelsPath: path.join(rootPath, 'models'),
  dataPath: path.join(rootPath, 'data'),
  migrationsDir: path.join(rootPath, 'infra', 'migrations'),
  pgBossSchema: 'pgboss',
  operatorAuthPrincipalsFilePath: null,
  operatorAuthRateLimitWindowMs: 60_000,
  operatorAuthRateLimitMaxRequests: 120,
  host: '127.0.0.1',
  port: 8787,
  bootTimeoutMs: 60_000,
});

const createRuntimeRoots = async (): Promise<{ rootPath: string; config: CoreRuntimeConfig }> => {
  const rootPath = await mkdtemp(path.join(tmpdir(), 'yaagi-body-evolution-'));
  const config = createConfig(rootPath);
  await mkdir(config.seedBodyPath, { recursive: true });
  await mkdir(config.workspaceBodyPath, { recursive: true });
  await mkdir(path.join(config.dataPath, 'snapshots'), { recursive: true });
  return { rootPath, config };
};

const createBodyChangeRequest = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  requestedByOwner: BODY_CHANGE_REQUESTED_BY_OWNER.GOVERNOR,
  governorProposalId: 'development-proposal:1',
  governorDecisionRef: 'development-proposal-decision:1',
  requestId: 'body-change-request:1',
  scopeKind: BODY_CHANGE_SCOPE_KIND.CODE,
  rationale: 'Apply an approved code change inside the materialized body.',
  requiredEvalSuite: 'body-evolution.boundary',
  targetPaths: ['src/body/body-evolution.ts'],
  rollbackPlanRef: 'rollback:body-change:1',
  evidenceRefs: ['governor:decision:1'],
  ...overrides,
});

const approveHumanOverride: BodyChangeHumanOverrideGovernorApprover = ({ normalizedRequestHash }) =>
  Promise.resolve({
    accepted: true,
    governorProposalId: `development-proposal:${normalizedRequestHash}`,
    governorDecisionRef: `development-proposal-decision:${normalizedRequestHash}`,
    targetRef: 'workspace:body',
  });

const approveGovernor: BodyChangeApprovalVerifier = ({ expectedTargetRef }) =>
  Promise.resolve({
    approved: true,
    targetRef: expectedTargetRef,
  });

const rejectGovernor: BodyChangeApprovalVerifier = () => Promise.resolve(false);

const acceptGovernorOutcome: BodyChangeGovernorOutcomeRecorder = (input) =>
  Promise.resolve({
    accepted: true,
    requestId: input.requestId,
    proposalId: input.proposalId,
    outcomeId: `development-proposal-outcome:${input.outcomeKind}`,
    state: input.outcomeKind,
    outcomeKind: input.outcomeKind,
    deduplicated: false,
    createdAt: input.recordedAt,
  });

const allowPerimeterDecisions: PerimeterDecisionService = {
  evaluateControlRequest: (input: PerimeterControlRequest) =>
    Promise.resolve({
      accepted: true,
      requestId: input.requestId,
      decisionId: `perimeter-decision:${input.requestId}`,
      actionClass: input.actionClass,
      verdict: PERIMETER_VERDICT.ALLOW,
      decisionReason: 'verified_authority',
      deduplicated: false,
      createdAt,
    }),
};

const createTestBodyEvolutionService = (
  options: Omit<
    Parameters<typeof createBodyEvolutionService>[0],
    'ensureHumanOverrideGovernorApproval' | 'recordGovernorOutcome'
  > &
    Partial<
      Pick<
        Parameters<typeof createBodyEvolutionService>[0],
        'ensureHumanOverrideGovernorApproval' | 'recordGovernorOutcome'
      >
    >,
) =>
  createBodyEvolutionService({
    ensureHumanOverrideGovernorApproval: approveHumanOverride,
    recordGovernorOutcome: acceptGovernorOutcome,
    perimeterDecisionService: allowPerimeterDecisions,
    ...options,
  });

const createGitGateway = (
  overrides: Partial<BodyEvolutionGitGateway> = {},
): BodyEvolutionGitGateway => ({
  createWorktree: () => Promise.resolve(),
  findCommittedCandidate: () => Promise.resolve(null),
  commitCandidate: () =>
    Promise.resolve({
      commitSha: 'abcdef123456',
    }),
  createStableTag: () => Promise.reject(new Error('not used in this test')),
  ...overrides,
});

const createMemoryStore = (): BodyEvolutionStore & {
  proposals: BodyChangeProposalRow[];
  events: BodyChangeEventRow[];
  snapshots: BodyStableSnapshotRow[];
} => {
  const proposals: BodyChangeProposalRow[] = [];
  const events: BodyChangeEventRow[] = [];
  const snapshots: BodyStableSnapshotRow[] = [];

  return {
    proposals,
    events,
    snapshots,
    recordProposal(input) {
      const existing = proposals.find((entry) => entry.requestId === input.requestId);
      if (existing) {
        if (existing.normalizedRequestHash === input.normalizedRequestHash) {
          return Promise.resolve({
            accepted: true,
            deduplicated: true,
            proposal: existing,
            event: null,
          });
        }

        return Promise.resolve({
          accepted: false,
          reason: 'request_hash_conflict',
          proposal: existing,
        });
      }

      const proposal: BodyChangeProposalRow = {
        proposalId: input.proposalId,
        requestId: input.requestId,
        normalizedRequestHash: input.normalizedRequestHash,
        requestedByOwner: input.requestedByOwner,
        governorProposalId: input.governorProposalId,
        governorDecisionRef: input.governorDecisionRef,
        ownerOverrideEvidenceRef: input.ownerOverrideEvidenceRef,
        branchName: input.branchName,
        worktreePath: input.worktreePath,
        candidateCommitSha: null,
        stableSnapshotId: null,
        status: input.status ?? BODY_CHANGE_STATUS.REQUESTED,
        scopeKind: input.scopeKind,
        requiredEvalSuite: input.requiredEvalSuite,
        targetPathsJson: input.targetPaths,
        rollbackPlanRef: input.rollbackPlanRef,
        evidenceRefsJson: input.evidenceRefs,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      };
      const event: BodyChangeEventRow = {
        eventId: input.eventId,
        proposalId: input.proposalId,
        eventKind: BODY_CHANGE_EVENT_KIND.PROPOSAL_RECORDED,
        status: proposal.status,
        evidenceRefsJson: input.evidenceRefs,
        payloadJson: input.payloadJson ?? {},
        createdAt: input.createdAt,
      };
      proposals.push(proposal);
      events.push(event);
      return Promise.resolve({
        accepted: true,
        deduplicated: false,
        proposal,
        event,
      });
    },
    recordLifecycleEvent(input) {
      const proposal = proposals.find((entry) => entry.proposalId === input.proposalId);
      if (!proposal) {
        return Promise.resolve({
          accepted: false,
          reason: 'proposal_not_found',
        });
      }
      if (
        input.expectedCurrentStatuses &&
        input.expectedCurrentStatuses.length > 0 &&
        !input.expectedCurrentStatuses.includes(proposal.status)
      ) {
        return Promise.resolve({
          accepted: false,
          reason: 'invalid_status',
          proposal,
        });
      }

      proposal.status = input.status;
      proposal.candidateCommitSha =
        input.candidateCommitSha === undefined
          ? proposal.candidateCommitSha
          : input.candidateCommitSha;
      proposal.stableSnapshotId =
        input.stableSnapshotId === undefined ? proposal.stableSnapshotId : input.stableSnapshotId;
      proposal.updatedAt = input.createdAt;
      const event: BodyChangeEventRow = {
        eventId: input.eventId,
        proposalId: input.proposalId,
        eventKind: input.eventKind,
        status: input.status,
        evidenceRefsJson: input.evidenceRefs,
        payloadJson: input.payloadJson ?? {},
        createdAt: input.createdAt,
      };
      events.push(event);
      return Promise.resolve({
        accepted: true,
        proposal,
        event,
      });
    },
    publishStableSnapshot(input) {
      const proposal = proposals.find((entry) => entry.proposalId === input.proposalId);
      if (!proposal) {
        return Promise.resolve({
          accepted: false,
          reason: 'proposal_not_found',
        });
      }
      const existingSnapshot = snapshots.find((entry) => entry.proposalId === input.proposalId);
      if (existingSnapshot) {
        if (
          existingSnapshot.snapshotId === input.snapshotId &&
          existingSnapshot.manifestHash === input.manifestHash
        ) {
          proposal.status = BODY_CHANGE_STATUS.SNAPSHOT_READY;
          proposal.stableSnapshotId = existingSnapshot.snapshotId;
          proposal.updatedAt = input.createdAt;
          return Promise.resolve({
            accepted: true,
            deduplicated: true,
            proposal,
            event: null,
            snapshot: existingSnapshot,
          });
        }

        return Promise.resolve({
          accepted: false,
          reason: 'snapshot_conflict',
          proposal,
          snapshot: existingSnapshot,
        });
      }
      if (
        input.expectedCurrentStatuses &&
        input.expectedCurrentStatuses.length > 0 &&
        !input.expectedCurrentStatuses.includes(proposal.status)
      ) {
        return Promise.resolve({
          accepted: false,
          reason: 'invalid_status',
          proposal,
        });
      }

      const snapshot: BodyStableSnapshotRow = {
        snapshotId: input.snapshotId,
        proposalId: input.proposalId,
        gitTag: input.gitTag,
        schemaVersion: input.schemaVersion,
        modelProfileMapJson: input.modelProfileMapJson,
        criticalConfigHash: input.criticalConfigHash,
        evalSummaryJson: input.evalSummaryJson,
        manifestHash: input.manifestHash,
        manifestPath: input.manifestPath,
        createdAt: input.createdAt,
      };
      snapshots.push(snapshot);
      proposal.status = BODY_CHANGE_STATUS.SNAPSHOT_READY;
      proposal.stableSnapshotId = snapshot.snapshotId;
      proposal.updatedAt = input.createdAt;
      const event: BodyChangeEventRow = {
        eventId: input.eventId,
        proposalId: proposal.proposalId,
        eventKind: BODY_CHANGE_EVENT_KIND.STABLE_SNAPSHOT_PUBLISHED,
        status: BODY_CHANGE_STATUS.SNAPSHOT_READY,
        evidenceRefsJson: input.evidenceRefs,
        payloadJson: input.payloadJson ?? {},
        createdAt: input.createdAt,
      };
      events.push(event);
      return Promise.resolve({
        accepted: true,
        deduplicated: false,
        proposal,
        event,
        snapshot,
      });
    },
    getProposal(proposalId) {
      return Promise.resolve(proposals.find((entry) => entry.proposalId === proposalId) ?? null);
    },
    getProposalByRequestId(requestId) {
      return Promise.resolve(proposals.find((entry) => entry.requestId === requestId) ?? null);
    },
    getProposalByOwnerOverrideEvidenceRef(ownerOverrideEvidenceRef) {
      return Promise.resolve(
        proposals.find((entry) => entry.ownerOverrideEvidenceRef === ownerOverrideEvidenceRef) ??
          null,
      );
    },
    getStableSnapshot(snapshotId) {
      return Promise.resolve(snapshots.find((entry) => entry.snapshotId === snapshotId) ?? null);
    },
    getStableSnapshotByProposalId(proposalId) {
      return Promise.resolve(snapshots.find((entry) => entry.proposalId === proposalId) ?? null);
    },
    listProposalEvents(input) {
      return Promise.resolve(events.filter((entry) => entry.proposalId === input.proposalId));
    },
  };
};

void test('AC-F0017-01 / AC-F0017-06 / AC-F0017-09..15 accepts approved governor body change proposals', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: (() => {
      let counter = 0;
      return () => {
        counter += 1;
        return `id-${counter}`;
      };
    })(),
    verifyGovernorApproval: approveGovernor,
  });

  const result = await service.submitBodyChangeRequest(createBodyChangeRequest());

  assert.equal(result.accepted, true);
  assert.equal(result.proposal.status, BODY_CHANGE_STATUS.REQUESTED);
  assert.equal(result.proposal.governorProposalId, 'development-proposal:1');
  assert.equal(result.proposal.governorDecisionRef, 'development-proposal-decision:1');
  assert.equal(result.proposal.ownerOverrideEvidenceRef, null);
  assert.equal(result.proposal.branchName, 'agent/proposals/body-change-request-1-id1');
  assert.equal(result.proposal.requiredEvalSuite, 'body-evolution.boundary');
  assert.deepEqual(result.proposal.evidenceRefs, ['governor:decision:1']);
  assert.equal(path.isAbsolute(result.proposal.worktreePath), true);
  assert.equal(result.proposal.worktreePath.startsWith(config.workspaceBodyPath), true);
  assert.equal(store.proposals.length, 1);
  assert.equal(store.events.length, 1);
  assert.equal(
    store.events[0]?.payloadJson['actorSource'],
    BODY_CHANGE_REQUESTED_BY_OWNER.GOVERNOR,
  );
  assert.equal(store.events[0]?.payloadJson['governorProposalId'], 'development-proposal:1');
  assert.equal(
    store.events[0]?.payloadJson['governorDecisionRef'],
    'development-proposal-decision:1',
  );
  const governorTargetRef = store.events[0]?.payloadJson['governorTargetRef'];
  assert.ok(typeof governorTargetRef === 'string');
  assert.match(governorTargetRef, /^body-change:[a-f0-9]{64}$/);
  assert.equal(store.events[0]?.payloadJson['branchName'], result.proposal.branchName);
  assert.equal(store.events[0]?.payloadJson['worktreePath'], result.proposal.worktreePath);
  assert.equal(store.events[0]?.payloadJson['candidateCommitSha'], null);
  assert.equal(store.events[0]?.payloadJson['stableSnapshotId'], null);
  assert.equal(store.events[0]?.payloadJson['evalResult'], null);
});

void test('AC-F0017-02 accepts owner-approved override evidence without governor refs', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: () => 'override-id',
  });

  const result = await service.submitBodyChangeRequest(
    createBodyChangeRequest({
      requestedByOwner: BODY_CHANGE_REQUESTED_BY_OWNER.HUMAN_OVERRIDE,
      ownerOverrideEvidenceRef: 'owner-override:1',
      governorProposalId: undefined,
      governorDecisionRef: undefined,
      requestId: 'body-change-request:override',
      evidenceRefs: ['owner-override:1'],
    }),
  );

  assert.equal(result.accepted, true);
  assert.equal(result.proposal.requestedByOwner, BODY_CHANGE_REQUESTED_BY_OWNER.HUMAN_OVERRIDE);
  assert.match(result.proposal.governorProposalId ?? '', /^development-proposal:/);
  assert.match(result.proposal.governorDecisionRef ?? '', /^development-proposal-decision:/);
  assert.equal(result.proposal.ownerOverrideEvidenceRef, 'owner-override:1');
  assert.equal(store.events[0]?.payloadJson['governorTargetRef'], 'workspace:body');
});

void test('AC-F0017-03 rejects requests without approved authority before persistence', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: () => 'unauthorized-id',
    verifyGovernorApproval: rejectGovernor,
  });

  const missingGovernorApproval = await service.submitBodyChangeRequest(createBodyChangeRequest());
  const missingOverride = await service.submitBodyChangeRequest(
    createBodyChangeRequest({
      requestedByOwner: BODY_CHANGE_REQUESTED_BY_OWNER.HUMAN_OVERRIDE,
      governorProposalId: undefined,
      governorDecisionRef: undefined,
      ownerOverrideEvidenceRef: undefined,
      requestId: 'body-change-request:missing-override',
    }),
  );

  assert.equal(missingGovernorApproval.accepted, false);
  assert.equal(missingGovernorApproval.reason, 'governor_not_approved');
  assert.equal(missingOverride.accepted, false);
  assert.equal(missingOverride.reason, 'override_not_recorded');
  assert.equal(store.proposals.length, 0);
});

void test('AC-F0018-07 reuses adjacent authority refs read-only when forwarding body-change ingress into perimeter', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  const capturedRequests: Array<Record<string, unknown>> = [];
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: () => 'adjacent-authority',
    perimeterDecisionService: {
      evaluateControlRequest: (input) => {
        capturedRequests.push(input as unknown as Record<string, unknown>);
        return Promise.resolve({
          accepted: true,
          requestId: input.requestId,
          decisionId: `perimeter-decision:${input.requestId}`,
          actionClass: input.actionClass,
          verdict: PERIMETER_VERDICT.ALLOW,
          decisionReason: 'verified_authority',
          deduplicated: false,
          createdAt,
        });
      },
    },
  });

  const result = await service.submitBodyChangeRequest(
    createBodyChangeRequest({
      requestedByOwner: BODY_CHANGE_REQUESTED_BY_OWNER.HUMAN_OVERRIDE,
      governorProposalId: undefined,
      governorDecisionRef: undefined,
      ownerOverrideEvidenceRef: 'owner-override:adjacent',
      requestId: 'body-change-request:adjacent-authority',
      evidenceRefs: ['owner-override:adjacent'],
    }),
  );

  assert.equal(result.accepted, true);
  assert.equal(capturedRequests.length, 1);
  assert.equal(capturedRequests[0]?.['authorityOwner'], 'human_override');
  assert.equal(capturedRequests[0]?.['humanOverrideEvidenceRef'], 'owner-override:adjacent');
  assert.equal('governorProposalId' in (capturedRequests[0] ?? {}), false);
  assert.equal('governorDecisionRef' in (capturedRequests[0] ?? {}), false);
});

void test('AC-F0017-03 rejects governor approvals that were approved for a different body-change target', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: () => 'borrowed-approval',
    verifyGovernorApproval: () =>
      Promise.resolve({
        approved: true,
        targetRef: 'workspace:body:someone-else',
      }),
  });

  const result = await service.submitBodyChangeRequest(createBodyChangeRequest());

  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'governor_not_approved');
  assert.match(result.detail ?? '', /target does not match/i);
  assert.equal(store.proposals.length, 0);
});

void test('AC-F0018-03 / AC-F0018-07 fail closed when perimeter denies the approved body-change ingress', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: () => 'perimeter-submit-deny',
    verifyGovernorApproval: approveGovernor,
    perimeterDecisionService: {
      evaluateControlRequest: (input) =>
        Promise.resolve({
          accepted: true,
          requestId: input.requestId,
          decisionId: 'perimeter-decision:submit-denied',
          actionClass: PERIMETER_ACTION_CLASS.CODE_OR_PROMOTION_CHANGE,
          verdict: PERIMETER_VERDICT.DENY,
          decisionReason: 'trusted_ingress_missing',
          deduplicated: false,
          createdAt,
        }),
    },
  });

  const result = await service.submitBodyChangeRequest(createBodyChangeRequest());

  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'governor_not_approved');
  assert.match(result.detail ?? '', /perimeter refused code_or_promotion_change/i);
  assert.equal(store.proposals.length, 0);
});

void test('AC-F0017-04 / AC-F0017-05 handles request replay idempotency and hash conflicts', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: (() => {
      let counter = 0;
      return () => {
        counter += 1;
        return `replay-id-${counter}`;
      };
    })(),
    verifyGovernorApproval: approveGovernor,
  });

  const first = await service.submitBodyChangeRequest(createBodyChangeRequest());
  const replay = await service.submitBodyChangeRequest(createBodyChangeRequest());
  const conflict = await service.submitBodyChangeRequest(
    createBodyChangeRequest({
      rationale: 'Same request id but different normalized material must conflict.',
    }),
  );

  assert.equal(first.accepted, true);
  assert.equal(replay.accepted, true);
  assert.equal(replay.deduplicated, true);
  assert.equal(replay.proposal.proposalId, first.proposal.proposalId);
  assert.equal(conflict.accepted, false);
  assert.equal(conflict.reason, 'request_hash_conflict');
  assert.equal(store.proposals.length, 1);
  assert.equal(store.events.length, 1);
});

void test('AC-F0017-07 rejects tracked seed body target paths before persistence', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: () => 'seed-id',
    verifyGovernorApproval: approveGovernor,
  });

  const result = await service.submitBodyChangeRequest(
    createBodyChangeRequest({
      targetPaths: [path.join(config.seedBodyPath, 'src', 'body.ts')],
    }),
  );

  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'seed_write_rejected');
  assert.equal(store.proposals.length, 0);
});

void test('AC-F0017-08 rejects symlink traversal escapes before persistence', async () => {
  const { rootPath, config } = await createRuntimeRoots();
  const outsidePath = path.join(rootPath, 'outside-body');
  await mkdir(outsidePath, { recursive: true });
  await symlink(outsidePath, path.join(config.workspaceBodyPath, 'escape'));
  const store = createMemoryStore();
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: () => 'symlink-id',
    verifyGovernorApproval: approveGovernor,
  });

  const result = await service.submitBodyChangeRequest(
    createBodyChangeRequest({
      targetPaths: ['escape/body.ts'],
    }),
  );

  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'worktree_escape_rejected');
  assert.equal(store.proposals.length, 0);
});

void test('AC-F0017-06 rejects worktree root symlink escapes before persistence', async () => {
  const { rootPath, config } = await createRuntimeRoots();
  const outsidePath = path.join(rootPath, 'outside-worktree-root');
  await mkdir(outsidePath, { recursive: true });
  await symlink(outsidePath, path.join(config.workspaceBodyPath, '.yaagi'));
  const store = createMemoryStore();
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: () => 'worktree-root-symlink-id',
    verifyGovernorApproval: approveGovernor,
  });

  const result = await service.submitBodyChangeRequest(createBodyChangeRequest());

  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'worktree_escape_rejected');
  assert.equal(store.proposals.length, 0);
});

void test('AC-F0017-06 assigns collision-resistant worktree paths for distinct requests', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  let counter = 0;
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: () => {
      counter += 1;
      return `feature-a-id-${counter}`;
    },
    verifyGovernorApproval: approveGovernor,
  });

  const first = await service.submitBodyChangeRequest(
    createBodyChangeRequest({
      requestId: 'feature-a',
    }),
  );
  const second = await service.submitBodyChangeRequest(
    createBodyChangeRequest({
      requestId: 'feature-a-2',
    }),
  );

  assert.equal(first.accepted, true);
  assert.equal(second.accepted, true);
  assert.notEqual(first.proposal.worktreePath, second.proposal.worktreePath);
  assert.match(first.proposal.worktreePath, /feature-a-[a-f0-9]{12}$/);
  assert.match(second.proposal.worktreePath, /feature-a-2-[a-f0-9]{12}$/);
});

void test('AC-F0017-16 replays worktree preparation after a transient persistence failure without branch/path conflicts', async () => {
  const { config } = await createRuntimeRoots();
  const baseStore = createMemoryStore();
  let failPreparedPersistence = true;
  const store: BodyEvolutionStore & {
    proposals: BodyChangeProposalRow[];
    events: BodyChangeEventRow[];
    snapshots: BodyStableSnapshotRow[];
  } = {
    ...baseStore,
    recordLifecycleEvent(input) {
      if (input.eventKind === BODY_CHANGE_EVENT_KIND.WORKTREE_PREPARED && failPreparedPersistence) {
        failPreparedPersistence = false;
        return Promise.reject(new Error('transient worktree persistence failure'));
      }

      return baseStore.recordLifecycleEvent(input);
    },
  };
  let worktreeCalls = 0;
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: () => 'prepare-replay',
    verifyGovernorApproval: approveGovernor,
    gitGateway: createGitGateway({
      createWorktree: () => {
        worktreeCalls += 1;
        return Promise.resolve();
      },
    }),
  });

  const submitted = await service.submitBodyChangeRequest(createBodyChangeRequest());
  assert.equal(submitted.accepted, true);

  const firstAttempt = await service.prepareProposalWorktree({
    proposalId: submitted.proposal.proposalId,
    requestId: 'prepare-replay',
    evidenceRefs: ['body-change:worktree:prepare-replay'],
  });

  assert.equal(firstAttempt.accepted, false);
  assert.equal(firstAttempt.reason, 'persistence_unavailable');
  assert.equal(baseStore.proposals[0]?.status, BODY_CHANGE_STATUS.REQUESTED);

  const replayAttempt = await service.prepareProposalWorktree({
    proposalId: submitted.proposal.proposalId,
    requestId: 'prepare-replay',
    evidenceRefs: ['body-change:worktree:prepare-replay'],
  });

  assert.equal(replayAttempt.accepted, true);
  assert.equal(replayAttempt.status, BODY_CHANGE_STATUS.WORKTREE_READY);
  assert.equal(worktreeCalls, 2);
  assert.equal(
    baseStore.events.filter((event) => event.eventKind === BODY_CHANGE_EVENT_KIND.WORKTREE_PREPARED)
      .length,
    1,
  );
});

void test('AC-F0017-16 transitions to worktree_ready and candidate_committed after repo gates and eval suite pass', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  const commandCalls: string[] = [];
  const gitCalls: string[] = [];
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: () => 'candidate-success',
    verifyGovernorApproval: approveGovernor,
    gitGateway: createGitGateway({
      createWorktree: ({ branchName, worktreePath }) => {
        gitCalls.push(`worktree:${branchName}:${worktreePath}`);
        return Promise.resolve();
      },
      commitCandidate: ({ message }) => {
        gitCalls.push(`commit:${message}`);
        return Promise.resolve({
          commitSha: 'abcdef123456',
        });
      },
    }),
    commandRunner: ({ command }) => {
      commandCalls.push(command.label);
      return Promise.resolve({
        kind: command.kind,
        label: command.label,
        ok: true,
        evidenceRef: command.evidenceRef ?? null,
        detail: null,
      });
    },
  });

  const submitted = await service.submitBodyChangeRequest(createBodyChangeRequest());
  assert.equal(submitted.accepted, true);
  const prepared = await service.prepareProposalWorktree({
    proposalId: submitted.proposal.proposalId,
    requestId: 'prepare-success',
    evidenceRefs: ['body-change:worktree:1'],
  });
  const evaluated = await service.evaluateProposalForCandidate({
    proposalId: submitted.proposal.proposalId,
    requestId: 'evaluate-success',
    candidateCommitMessage: 'feat(body): candidate',
    evalCommand: {
      label: 'body-evolution.boundary',
      command: 'pnpm',
      args: ['test'],
    },
    evidenceRefs: ['body-change:evaluate:1'],
  });

  assert.equal(prepared.accepted, true);
  assert.equal(evaluated.accepted, true);
  assert.equal(evaluated.status, BODY_CHANGE_STATUS.CANDIDATE_COMMITTED);
  assert.equal(evaluated.proposal.candidateCommitSha, 'abcdef123456');
  assert.deepEqual(commandCalls, [
    'pnpm format',
    'pnpm typecheck',
    'pnpm lint',
    'body-evolution.boundary',
  ]);
  assert.equal(gitCalls[0]?.startsWith('worktree:'), true);
  assert.match(
    gitCalls[1] ?? '',
    /^commit:feat\(body\): candidate\n\nBody-Change-Proposal: body-change-proposal:candidate-success$/,
  );
});

void test('AC-F0017-16 replays candidate evaluation from the persisted boundary checkpoint without rerunning gates or duplicating commits', async () => {
  const { config } = await createRuntimeRoots();
  const baseStore = createMemoryStore();
  let failCommittedPersistence = true;
  const store: BodyEvolutionStore & {
    proposals: BodyChangeProposalRow[];
    events: BodyChangeEventRow[];
    snapshots: BodyStableSnapshotRow[];
  } = {
    ...baseStore,
    recordLifecycleEvent(input) {
      if (
        input.eventKind === BODY_CHANGE_EVENT_KIND.CANDIDATE_COMMITTED &&
        failCommittedPersistence
      ) {
        failCommittedPersistence = false;
        return Promise.reject(new Error('transient candidate persistence failure'));
      }

      return baseStore.recordLifecycleEvent(input);
    },
  };
  let commandCalls = 0;
  let commitCalls = 0;
  let committedSha: string | null = null;
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: () => 'candidate-replay',
    verifyGovernorApproval: approveGovernor,
    gitGateway: createGitGateway({
      findCommittedCandidate: () =>
        Promise.resolve(committedSha ? { commitSha: committedSha } : null),
      commitCandidate: () => {
        commitCalls += 1;
        committedSha = 'abcdef123456';
        return Promise.resolve({
          commitSha: committedSha,
        });
      },
    }),
    commandRunner: ({ command }) => {
      commandCalls += 1;
      return Promise.resolve({
        kind: command.kind,
        label: command.label,
        ok: true,
        evidenceRef: command.evidenceRef ?? null,
        detail: null,
      } satisfies BodyChangeGateCheck);
    },
  });

  const submitted = await service.submitBodyChangeRequest(createBodyChangeRequest());
  assert.equal(submitted.accepted, true);
  await service.prepareProposalWorktree({
    proposalId: submitted.proposal.proposalId,
    requestId: 'prepare-candidate-replay',
    evidenceRefs: ['body-change:worktree:candidate-replay'],
  });

  const firstAttempt = await service.evaluateProposalForCandidate({
    proposalId: submitted.proposal.proposalId,
    requestId: 'evaluate-candidate-replay',
    candidateCommitMessage: 'feat(body): replay candidate',
    evalCommand: {
      label: 'body-evolution.boundary',
      command: 'pnpm',
      args: ['test'],
    },
    evidenceRefs: ['body-change:evaluate:candidate-replay'],
  });

  assert.equal(firstAttempt.accepted, false);
  assert.equal(firstAttempt.reason, 'persistence_unavailable');
  assert.equal(baseStore.proposals[0]?.status, BODY_CHANGE_STATUS.EVALUATING);
  assert.equal(commitCalls, 1);
  assert.equal(commandCalls, 4);
  assert.deepEqual(
    baseStore.events.map((event) => event.eventKind),
    [
      BODY_CHANGE_EVENT_KIND.PROPOSAL_RECORDED,
      BODY_CHANGE_EVENT_KIND.WORKTREE_PREPARED,
      BODY_CHANGE_EVENT_KIND.EVALUATION_STARTED,
      BODY_CHANGE_EVENT_KIND.BOUNDARY_CHECKED,
    ],
  );

  const replayAttempt = await service.evaluateProposalForCandidate({
    proposalId: submitted.proposal.proposalId,
    requestId: 'evaluate-candidate-replay',
    candidateCommitMessage: 'feat(body): replay candidate',
    evalCommand: {
      label: 'body-evolution.boundary',
      command: 'pnpm',
      args: ['test'],
    },
    evidenceRefs: ['body-change:evaluate:candidate-replay'],
  });

  assert.equal(replayAttempt.accepted, true);
  assert.equal(replayAttempt.status, BODY_CHANGE_STATUS.CANDIDATE_COMMITTED);
  assert.equal(replayAttempt.proposal.candidateCommitSha, 'abcdef123456');
  assert.equal(commitCalls, 1);
  assert.equal(commandCalls, 4);
  assert.deepEqual(
    baseStore.events.map((event) => event.eventKind),
    [
      BODY_CHANGE_EVENT_KIND.PROPOSAL_RECORDED,
      BODY_CHANGE_EVENT_KIND.WORKTREE_PREPARED,
      BODY_CHANGE_EVENT_KIND.EVALUATION_STARTED,
      BODY_CHANGE_EVENT_KIND.BOUNDARY_CHECKED,
      BODY_CHANGE_EVENT_KIND.CANDIDATE_COMMITTED,
    ],
  );
});

void test('AC-F0017-17 records evaluation_failed when the proposal-declared eval suite fails', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: () => 'candidate-fail',
    verifyGovernorApproval: approveGovernor,
    gitGateway: createGitGateway({
      commitCandidate: () => Promise.reject(new Error('commit should not run after failed eval')),
    }),
    commandRunner: ({ command }) =>
      Promise.resolve({
        kind: command.kind,
        label: command.label,
        ok: command.label !== 'body-evolution.boundary',
        evidenceRef: command.evidenceRef ?? null,
        detail: command.label === 'body-evolution.boundary' ? 'eval failed' : null,
      } satisfies BodyChangeGateCheck),
  });

  const submitted = await service.submitBodyChangeRequest(createBodyChangeRequest());
  assert.equal(submitted.accepted, true);
  await service.prepareProposalWorktree({
    proposalId: submitted.proposal.proposalId,
    requestId: 'prepare-fail',
    evidenceRefs: ['body-change:worktree:1'],
  });
  const evaluated = await service.evaluateProposalForCandidate({
    proposalId: submitted.proposal.proposalId,
    requestId: 'evaluate-fail',
    candidateCommitMessage: 'feat(body): failed candidate',
    evalCommand: {
      label: 'body-evolution.boundary',
      command: 'pnpm',
      args: ['test'],
    },
    evidenceRefs: ['body-change:evaluate:1'],
  });

  assert.equal(evaluated.accepted, true);
  assert.equal(evaluated.status, BODY_CHANGE_STATUS.EVALUATION_FAILED);
  assert.equal(
    evaluated.gateReport.some((check) => check.label === 'body-evolution.boundary' && !check.ok),
    true,
  );
  assert.equal(evaluated.proposal.candidateCommitSha, null);
});

void test('AC-F0017-17 rejects mismatched eval commands even when the suite label matches', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: () => 'candidate-contract-mismatch',
    verifyGovernorApproval: approveGovernor,
    gitGateway: createGitGateway({
      commitCandidate: () => Promise.reject(new Error('commit should not run for mismatched eval')),
    }),
    commandRunner: () =>
      Promise.resolve({
        kind: 'repo',
        label: 'unexpected',
        ok: true,
        evidenceRef: null,
        detail: null,
      } satisfies BodyChangeGateCheck),
  });

  const submitted = await service.submitBodyChangeRequest(createBodyChangeRequest());
  assert.equal(submitted.accepted, true);
  await service.prepareProposalWorktree({
    proposalId: submitted.proposal.proposalId,
    requestId: 'prepare-contract-mismatch',
    evidenceRefs: ['body-change:worktree:contract-mismatch'],
  });

  const evaluated = await service.evaluateProposalForCandidate({
    proposalId: submitted.proposal.proposalId,
    requestId: 'evaluate-contract-mismatch',
    candidateCommitMessage: 'feat(body): should be rejected before command execution',
    evalCommand: {
      label: 'body-evolution.boundary',
      command: 'pnpm',
      args: ['exec', 'true'],
    },
    evidenceRefs: ['body-change:evaluate:contract-mismatch'],
  });

  assert.equal(evaluated.accepted, false);
  assert.equal(evaluated.reason, 'invalid_eval_suite');
  assert.match(evaluated.detail ?? '', /requires eval suite contract/);
  assert.equal(store.proposals[0]?.status, BODY_CHANGE_STATUS.WORKTREE_READY);
  assert.equal(
    store.events.some((event) => event.eventKind === BODY_CHANGE_EVENT_KIND.EVALUATION_STARTED),
    false,
  );
});

void test('AC-F0017-18 blocks runtime-sensitive proposals without successful pnpm smoke:cell evidence', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: () => 'runtime-smoke',
    verifyGovernorApproval: approveGovernor,
    gitGateway: createGitGateway({
      commitCandidate: () => Promise.reject(new Error('commit should not run after failed smoke')),
    }),
    commandRunner: ({ command }) =>
      Promise.resolve({
        kind: command.kind,
        label: command.label,
        ok: command.label !== 'pnpm smoke:cell',
        evidenceRef: command.evidenceRef ?? null,
        detail: command.label === 'pnpm smoke:cell' ? 'smoke failed' : null,
      } satisfies BodyChangeGateCheck),
  });

  const submitted = await service.submitBodyChangeRequest(
    createBodyChangeRequest({
      requestId: 'runtime-smoke-request',
      targetPaths: ['src/runtime/runtime-lifecycle.ts'],
    }),
  );
  assert.equal(submitted.accepted, true);
  await service.prepareProposalWorktree({
    proposalId: submitted.proposal.proposalId,
    requestId: 'prepare-runtime-smoke',
    evidenceRefs: ['body-change:worktree:runtime'],
  });
  const evaluated = await service.evaluateProposalForCandidate({
    proposalId: submitted.proposal.proposalId,
    requestId: 'evaluate-runtime-smoke',
    candidateCommitMessage: 'feat(runtime): smoke required',
    evalCommand: {
      label: 'body-evolution.boundary',
      command: 'pnpm',
      args: ['test'],
    },
    evidenceRefs: ['body-change:evaluate:runtime'],
  });

  assert.equal(evaluated.accepted, true);
  assert.equal(evaluated.status, BODY_CHANGE_STATUS.EVALUATION_FAILED);
  assert.equal(
    evaluated.gateReport.some((check) => check.label === 'pnpm smoke:cell' && !check.ok),
    true,
  );
});

void test('AC-F0017-19..24 / AC-F0017-29 publish stable snapshots without boot continuity writes and route execution evidence through F-0016 owner gates', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  const governorOutcomes: Array<Record<string, unknown>> = [];
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: (() => {
      let counter = 0;
      return () => {
        counter += 1;
        return `snapshot-${counter}`;
      };
    })(),
    verifyGovernorApproval: approveGovernor,
    recordGovernorOutcome: (input) => {
      governorOutcomes.push(input as unknown as Record<string, unknown>);
      return Promise.resolve({
        accepted: true,
        requestId: input.requestId,
        proposalId: input.proposalId,
        outcomeId: 'development-proposal-outcome:1',
        state: input.outcomeKind,
        outcomeKind: input.outcomeKind,
        deduplicated: false,
        createdAt: input.recordedAt,
      });
    },
    gitGateway: createGitGateway({
      commitCandidate: () =>
        Promise.resolve({
          commitSha: 'abcdef123456',
        }),
      createStableTag: ({ snapshotId }) =>
        Promise.resolve({
          gitTag: `stable/${snapshotId}`,
        }),
    }),
    commandRunner: ({ command }) =>
      Promise.resolve({
        kind: command.kind,
        label: command.label,
        ok: true,
        evidenceRef: command.evidenceRef ?? null,
        detail: null,
      } satisfies BodyChangeGateCheck),
  });

  const submitted = await service.submitBodyChangeRequest(createBodyChangeRequest());
  assert.equal(submitted.accepted, true);
  await service.prepareProposalWorktree({
    proposalId: submitted.proposal.proposalId,
    requestId: 'prepare-snapshot',
    evidenceRefs: ['body-change:worktree:1'],
  });
  await service.evaluateProposalForCandidate({
    proposalId: submitted.proposal.proposalId,
    requestId: 'evaluate-snapshot',
    candidateCommitMessage: 'feat(body): candidate snapshot',
    evalCommand: {
      label: 'body-evolution.boundary',
      command: 'pnpm',
      args: ['test'],
    },
    evidenceRefs: ['body-change:evaluate:1'],
  });
  const snapshot = await service.publishStableSnapshot({
    proposalId: submitted.proposal.proposalId,
    requestId: 'snapshot-publish',
    schemaVersion: '2026-04-13',
    modelProfileMapJson: {
      reflex: 'model-profile:reflex.fast@baseline',
    },
    criticalConfigJson: {
      bootTimeoutMs: 60_000,
      workspaceBodyPath: config.workspaceBodyPath,
    },
    evalSummaryJson: {
      suite: 'body-evolution.boundary',
      verdict: 'pass',
    },
    evidenceRefs: ['body-change:snapshot:1'],
  });

  assert.equal(snapshot.accepted, true);
  assert.equal(snapshot.status, BODY_CHANGE_STATUS.SNAPSHOT_READY);
  assert.equal(snapshot.snapshot.gitTag.startsWith('stable/'), true);
  assert.equal(snapshot.snapshot.schemaVersion, '2026-04-13');
  assert.equal(
    snapshot.snapshot.modelProfileMapJson['reflex'],
    'model-profile:reflex.fast@baseline',
  );
  assert.equal(typeof snapshot.snapshot.criticalConfigHash, 'string');
  assert.equal(snapshot.snapshot.evalSummaryJson['verdict'], 'pass');
  assert.equal(snapshot.proposal.status, BODY_CHANGE_STATUS.SNAPSHOT_READY);
  assert.equal(snapshot.proposal.stableSnapshotId, snapshot.snapshot.snapshotId);
  assert.equal(
    snapshot.snapshot.manifestPath.startsWith(path.join(config.dataPath, 'snapshots')),
    true,
  );
  assert.equal(governorOutcomes.length, 1);
  assert.equal(governorOutcomes[0]?.['proposalId'], 'development-proposal:1');
  assert.equal(governorOutcomes[0]?.['outcomeKind'], 'executed');
});

void test('AC-F0017-25..28 / AC-F0017-30 record rollback evidence linked to snapshot id and verification result through the owner gate', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  const governorOutcomes: Array<Record<string, unknown>> = [];
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: (() => {
      let counter = 0;
      return () => {
        counter += 1;
        return `rollback-${counter}`;
      };
    })(),
    verifyGovernorApproval: approveGovernor,
    recordGovernorOutcome: (input) => {
      governorOutcomes.push(input as unknown as Record<string, unknown>);
      return Promise.resolve({
        accepted: true,
        requestId: input.requestId,
        proposalId: input.proposalId,
        outcomeId: 'development-proposal-outcome:2',
        state: input.outcomeKind,
        outcomeKind: input.outcomeKind,
        deduplicated: false,
        createdAt: input.recordedAt,
      });
    },
    gitGateway: createGitGateway({
      commitCandidate: () =>
        Promise.resolve({
          commitSha: 'abcdef123456',
        }),
      createStableTag: ({ snapshotId }) =>
        Promise.resolve({
          gitTag: `stable/${snapshotId}`,
        }),
    }),
    commandRunner: ({ command }) =>
      Promise.resolve({
        kind: command.kind,
        label: command.label,
        ok: true,
        evidenceRef: command.evidenceRef ?? null,
        detail: null,
      } satisfies BodyChangeGateCheck),
  });

  const submitted = await service.submitBodyChangeRequest(createBodyChangeRequest());
  assert.equal(submitted.accepted, true);
  await service.prepareProposalWorktree({
    proposalId: submitted.proposal.proposalId,
    requestId: 'prepare-rollback',
    evidenceRefs: ['body-change:worktree:1'],
  });
  await service.evaluateProposalForCandidate({
    proposalId: submitted.proposal.proposalId,
    requestId: 'evaluate-rollback',
    candidateCommitMessage: 'feat(body): rollback candidate',
    evalCommand: {
      label: 'body-evolution.boundary',
      command: 'pnpm',
      args: ['test'],
    },
    evidenceRefs: ['body-change:evaluate:1'],
  });
  const snapshot = await service.publishStableSnapshot({
    proposalId: submitted.proposal.proposalId,
    requestId: 'publish-rollback',
    schemaVersion: '2026-04-13',
    modelProfileMapJson: {
      reflex: 'model-profile:reflex.fast@baseline',
    },
    criticalConfigJson: {
      bootTimeoutMs: 60_000,
    },
    evalSummaryJson: {
      verdict: 'pass',
    },
    evidenceRefs: ['body-change:snapshot:1'],
  });
  assert.equal(snapshot.accepted, true);
  const rollback = await service.recordRollbackEvidence({
    proposalId: submitted.proposal.proposalId,
    requestId: 'rollback-evidence',
    snapshotId: snapshot.snapshot.snapshotId,
    rollbackReason: 'post-audit regression',
    verificationResult: 'rollback verification passed',
    evidenceRefs: ['body-change:rollback:1'],
  });

  assert.equal(rollback.accepted, true);
  assert.equal(rollback.status, BODY_CHANGE_STATUS.ROLLED_BACK);
  assert.equal(rollback.snapshot.snapshotId, snapshot.snapshot.snapshotId);
  assert.equal(governorOutcomes.length, 2);
  assert.equal(governorOutcomes[1]?.['proposalId'], 'development-proposal:1');
  assert.equal(governorOutcomes[1]?.['outcomeKind'], 'rolled_back');
  const rollbackEvent = store.events.at(-1);
  assert.equal(rollbackEvent?.eventKind, BODY_CHANGE_EVENT_KIND.ROLLBACK_EVIDENCE_RECORDED);
  assert.equal(rollbackEvent?.payloadJson['snapshotId'], snapshot.snapshot.snapshotId);
  assert.equal(rollbackEvent?.payloadJson['rollbackReason'], 'post-audit regression');
  assert.equal(rollbackEvent?.payloadJson['verificationResult'], 'rollback verification passed');
});

void test('AC-F0018-05 fails closed when perimeter denies rollback actuation handoff', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  const governorOutcomes: Array<Record<string, unknown>> = [];
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: (() => {
      let call = 0;
      return () => new Date(Date.parse(createdAt) + call++ * 1_000);
    })(),
    createId: (() => {
      let counter = 0;
      return () => `rollback-deny-${++counter}`;
    })(),
    verifyGovernorApproval: approveGovernor,
    recordGovernorOutcome: async (input) => {
      governorOutcomes.push(input as unknown as Record<string, unknown>);
      return acceptGovernorOutcome(input);
    },
    gitGateway: createGitGateway({
      commitCandidate: () =>
        Promise.resolve({
          commitSha: 'abcdef123456',
        }),
      createStableTag: ({ snapshotId }) =>
        Promise.resolve({
          gitTag: `stable/${snapshotId}`,
        }),
    }),
    commandRunner: ({ command }) =>
      Promise.resolve({
        kind: command.kind,
        label: command.label,
        ok: true,
        evidenceRef: command.evidenceRef ?? null,
        detail: null,
      } satisfies BodyChangeGateCheck),
    perimeterDecisionService: {
      evaluateControlRequest: (input) =>
        Promise.resolve({
          accepted: true,
          requestId: input.requestId,
          decisionId: 'perimeter-decision:rollback-denied',
          actionClass: input.actionClass,
          verdict:
            input.actionClass === PERIMETER_ACTION_CLASS.FORCE_ROLLBACK
              ? PERIMETER_VERDICT.REQUIRE_HUMAN_REVIEW
              : PERIMETER_VERDICT.ALLOW,
          decisionReason:
            input.actionClass === PERIMETER_ACTION_CLASS.FORCE_ROLLBACK
              ? 'downstream_owner_required'
              : 'verified_authority',
          deduplicated: false,
          createdAt,
        }),
    },
  });

  const submitted = await service.submitBodyChangeRequest(createBodyChangeRequest());
  assert.equal(submitted.accepted, true);
  const worktree = await service.prepareProposalWorktree({
    proposalId: submitted.proposal.proposalId,
    requestId: 'prepare-rollback-denied',
    evidenceRefs: ['body-change:prepare:rollback-denied'],
  });
  assert.equal(worktree.accepted, true);
  const candidate = await service.evaluateProposalForCandidate({
    proposalId: submitted.proposal.proposalId,
    requestId: 'evaluate-rollback-denied',
    candidateCommitMessage: 'feat(body): rollback denied test',
    evalCommand: {
      label: 'body-evolution.boundary',
      command: 'pnpm',
      args: ['test'],
    },
    evidenceRefs: ['body-change:evaluate:rollback-denied'],
  });
  assert.equal(candidate.accepted, true);
  const snapshot = await service.publishStableSnapshot({
    proposalId: submitted.proposal.proposalId,
    requestId: 'publish-rollback-denied',
    schemaVersion: '2026-04-13',
    modelProfileMapJson: {
      reflex: 'model-profile:reflex.fast@baseline',
    },
    criticalConfigJson: {
      bootTimeoutMs: 60_000,
    },
    evalSummaryJson: {
      verdict: 'pass',
    },
    evidenceRefs: ['body-change:snapshot:rollback-denied'],
  });
  assert.equal(snapshot.accepted, true);

  const rollback = await service.recordRollbackEvidence({
    proposalId: submitted.proposal.proposalId,
    requestId: 'rollback-denied',
    snapshotId: snapshot.snapshot.snapshotId,
    rollbackReason: 'perimeter denial',
    verificationResult: 'rollback blocked',
    evidenceRefs: ['body-change:rollback:denied'],
  });

  assert.equal(rollback.accepted, false);
  assert.equal(rollback.reason, 'perimeter_denied');
  assert.equal(governorOutcomes.length, 1);
  assert.equal(store.proposals[0]?.status, BODY_CHANGE_STATUS.SNAPSHOT_READY);
});

void test('snapshot publication replay fails closed after rollback and does not emit a second executed outcome', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  const governorOutcomes: Array<Record<string, unknown>> = [];
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: (() => {
      let counter = 0;
      return () => {
        counter += 1;
        return `snapshot-after-rollback-${counter}`;
      };
    })(),
    verifyGovernorApproval: approveGovernor,
    recordGovernorOutcome: (input) => {
      governorOutcomes.push(input as unknown as Record<string, unknown>);
      return Promise.resolve({
        accepted: true,
        requestId: input.requestId,
        proposalId: input.proposalId,
        outcomeId: `development-proposal-outcome:${governorOutcomes.length}`,
        state: input.outcomeKind,
        outcomeKind: input.outcomeKind,
        deduplicated: false,
        createdAt: input.recordedAt,
      });
    },
    gitGateway: createGitGateway({
      commitCandidate: () =>
        Promise.resolve({
          commitSha: 'abcdef123456',
        }),
      createStableTag: ({ snapshotId }) =>
        Promise.resolve({
          gitTag: `stable/${snapshotId}`,
        }),
    }),
    commandRunner: ({ command }) =>
      Promise.resolve({
        kind: command.kind,
        label: command.label,
        ok: true,
        evidenceRef: command.evidenceRef ?? null,
        detail: null,
      } satisfies BodyChangeGateCheck),
  });

  const submitted = await service.submitBodyChangeRequest(createBodyChangeRequest());
  assert.equal(submitted.accepted, true);
  await service.prepareProposalWorktree({
    proposalId: submitted.proposal.proposalId,
    requestId: 'prepare-snapshot-after-rollback',
    evidenceRefs: ['body-change:worktree:snapshot-after-rollback'],
  });
  await service.evaluateProposalForCandidate({
    proposalId: submitted.proposal.proposalId,
    requestId: 'evaluate-snapshot-after-rollback',
    candidateCommitMessage: 'feat(body): snapshot after rollback candidate',
    evalCommand: {
      label: 'body-evolution.boundary',
      command: 'pnpm',
      args: ['test'],
    },
    evidenceRefs: ['body-change:evaluate:snapshot-after-rollback'],
  });
  const snapshot = await service.publishStableSnapshot({
    proposalId: submitted.proposal.proposalId,
    requestId: 'publish-snapshot-after-rollback',
    schemaVersion: '2026-04-13',
    modelProfileMapJson: {
      reflex: 'model-profile:reflex.fast@baseline',
    },
    criticalConfigJson: {
      bootTimeoutMs: 60_000,
    },
    evalSummaryJson: {
      verdict: 'pass',
    },
    evidenceRefs: ['body-change:snapshot:after-rollback'],
  });
  assert.equal(snapshot.accepted, true);

  const rollback = await service.recordRollbackEvidence({
    proposalId: submitted.proposal.proposalId,
    requestId: 'rollback-after-snapshot-replay',
    snapshotId: snapshot.snapshot.snapshotId,
    rollbackReason: 'verification rollback',
    verificationResult: 'rollback verified',
    evidenceRefs: ['body-change:rollback:after-snapshot'],
  });
  assert.equal(rollback.accepted, true);

  const replayAttempt = await service.publishStableSnapshot({
    proposalId: submitted.proposal.proposalId,
    requestId: 'publish-snapshot-after-rollback',
    schemaVersion: '2026-04-13',
    modelProfileMapJson: {
      reflex: 'model-profile:reflex.fast@baseline',
    },
    criticalConfigJson: {
      bootTimeoutMs: 60_000,
    },
    evalSummaryJson: {
      verdict: 'pass',
    },
    evidenceRefs: ['body-change:snapshot:after-rollback'],
  });

  assert.equal(replayAttempt.accepted, false);
  assert.equal(replayAttempt.reason, 'invalid_status');
  assert.equal(store.proposals[0]?.status, BODY_CHANGE_STATUS.ROLLED_BACK);
  assert.deepEqual(
    governorOutcomes.map((outcome) => outcome['outcomeKind']),
    ['executed', 'rolled_back'],
  );
});

void test('snapshot publication retries the owner-gate outcome after a transient failure without duplicating local publication state', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  let executionOutcomeCalls = 0;
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: (() => {
      let counter = 0;
      return () => {
        counter += 1;
        return `snapshot-retry-${counter}`;
      };
    })(),
    verifyGovernorApproval: approveGovernor,
    gitGateway: createGitGateway({
      commitCandidate: () =>
        Promise.resolve({
          commitSha: 'abcdef123456',
        }),
      createStableTag: ({ snapshotId }) =>
        Promise.resolve({
          gitTag: `stable/${snapshotId}`,
        }),
    }),
    commandRunner: ({ command }) =>
      Promise.resolve({
        kind: command.kind,
        label: command.label,
        ok: true,
        evidenceRef: command.evidenceRef ?? null,
        detail: null,
      } satisfies BodyChangeGateCheck),
    recordGovernorOutcome: (input) => {
      if (input.outcomeKind === 'executed') {
        executionOutcomeCalls += 1;
        if (executionOutcomeCalls === 1) {
          return Promise.resolve({
            accepted: false,
            requestId: input.requestId,
            reason: 'persistence_unavailable',
          });
        }
      }

      return Promise.resolve({
        accepted: true,
        requestId: input.requestId,
        proposalId: input.proposalId,
        outcomeId: `development-proposal-outcome:${input.outcomeKind}:${executionOutcomeCalls}`,
        state: input.outcomeKind,
        outcomeKind: input.outcomeKind,
        deduplicated: executionOutcomeCalls > 1,
        createdAt: input.recordedAt,
      });
    },
  });

  const submitted = await service.submitBodyChangeRequest(createBodyChangeRequest());
  assert.equal(submitted.accepted, true);
  await service.prepareProposalWorktree({
    proposalId: submitted.proposal.proposalId,
    requestId: 'prepare-snapshot-retry',
    evidenceRefs: ['body-change:worktree:snapshot-retry'],
  });
  await service.evaluateProposalForCandidate({
    proposalId: submitted.proposal.proposalId,
    requestId: 'evaluate-snapshot-retry',
    candidateCommitMessage: 'feat(body): snapshot retry candidate',
    evalCommand: {
      label: 'body-evolution.boundary',
      command: 'pnpm',
      args: ['test'],
    },
    evidenceRefs: ['body-change:evaluate:snapshot-retry'],
  });

  const firstAttempt = await service.publishStableSnapshot({
    proposalId: submitted.proposal.proposalId,
    requestId: 'publish-snapshot-retry',
    schemaVersion: '2026-04-13',
    modelProfileMapJson: {
      reflex: 'model-profile:reflex.fast@baseline',
    },
    criticalConfigJson: {
      bootTimeoutMs: 60_000,
    },
    evalSummaryJson: {
      verdict: 'pass',
    },
    evidenceRefs: ['body-change:snapshot:retry'],
  });

  assert.equal(firstAttempt.accepted, false);
  assert.equal(firstAttempt.reason, 'governor_outcome_unavailable');
  assert.equal(store.proposals[0]?.status, BODY_CHANGE_STATUS.SNAPSHOT_READY);
  assert.equal(
    store.events.filter(
      (event) => event.eventKind === BODY_CHANGE_EVENT_KIND.STABLE_SNAPSHOT_PUBLISHED,
    ).length,
    1,
  );

  const replayAttempt = await service.publishStableSnapshot({
    proposalId: submitted.proposal.proposalId,
    requestId: 'publish-snapshot-retry',
    schemaVersion: '2026-04-13',
    modelProfileMapJson: {
      reflex: 'model-profile:reflex.fast@baseline',
    },
    criticalConfigJson: {
      bootTimeoutMs: 60_000,
    },
    evalSummaryJson: {
      verdict: 'pass',
    },
    evidenceRefs: ['body-change:snapshot:retry'],
  });

  assert.equal(replayAttempt.accepted, true);
  assert.equal(replayAttempt.deduplicated, true);
  assert.equal(executionOutcomeCalls, 2);
  assert.equal(
    store.events.filter(
      (event) => event.eventKind === BODY_CHANGE_EVENT_KIND.STABLE_SNAPSHOT_PUBLISHED,
    ).length,
    1,
  );
});

void test('snapshot publication validates the stable tag before snapshot_ready becomes durable and replays store persistence safely', async () => {
  const { config } = await createRuntimeRoots();
  const baseStore = createMemoryStore();
  let failSnapshotPersistence = true;
  const store: BodyEvolutionStore & {
    proposals: BodyChangeProposalRow[];
    events: BodyChangeEventRow[];
    snapshots: BodyStableSnapshotRow[];
  } = {
    ...baseStore,
    publishStableSnapshot(input) {
      if (failSnapshotPersistence) {
        failSnapshotPersistence = false;
        return Promise.reject(new Error('transient snapshot persistence failure'));
      }

      return baseStore.publishStableSnapshot(input);
    },
  };
  let tagCalls = 0;
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: () => 'snapshot-tag-order',
    verifyGovernorApproval: approveGovernor,
    gitGateway: createGitGateway({
      commitCandidate: () =>
        Promise.resolve({
          commitSha: 'abcdef123456',
        }),
      createStableTag: ({ snapshotId }) => {
        tagCalls += 1;
        return Promise.resolve({
          gitTag: `stable/${snapshotId}`,
        });
      },
    }),
    commandRunner: ({ command }) =>
      Promise.resolve({
        kind: command.kind,
        label: command.label,
        ok: true,
        evidenceRef: command.evidenceRef ?? null,
        detail: null,
      } satisfies BodyChangeGateCheck),
  });

  const submitted = await service.submitBodyChangeRequest(createBodyChangeRequest());
  assert.equal(submitted.accepted, true);
  await service.prepareProposalWorktree({
    proposalId: submitted.proposal.proposalId,
    requestId: 'prepare-snapshot-tag-order',
    evidenceRefs: ['body-change:worktree:snapshot-tag-order'],
  });
  await service.evaluateProposalForCandidate({
    proposalId: submitted.proposal.proposalId,
    requestId: 'evaluate-snapshot-tag-order',
    candidateCommitMessage: 'feat(body): snapshot tag order candidate',
    evalCommand: {
      label: 'body-evolution.boundary',
      command: 'pnpm',
      args: ['test'],
    },
    evidenceRefs: ['body-change:evaluate:snapshot-tag-order'],
  });

  const firstAttempt = await service.publishStableSnapshot({
    proposalId: submitted.proposal.proposalId,
    requestId: 'publish-before-store-persist',
    schemaVersion: '2026-04-13',
    modelProfileMapJson: {
      reflex: 'model-profile:reflex.fast@baseline',
    },
    criticalConfigJson: {
      bootTimeoutMs: 60_000,
    },
    evalSummaryJson: {
      verdict: 'pass',
    },
    evidenceRefs: ['body-change:snapshot:pre-accept'],
  });

  assert.equal(firstAttempt.accepted, false);
  assert.equal(firstAttempt.reason, 'persistence_unavailable');
  assert.equal(baseStore.proposals[0]?.status, BODY_CHANGE_STATUS.CANDIDATE_COMMITTED);
  assert.equal(baseStore.snapshots.length, 0);
  assert.equal(tagCalls, 1);

  const replayAttempt = await service.publishStableSnapshot({
    proposalId: submitted.proposal.proposalId,
    requestId: 'publish-before-store-persist',
    schemaVersion: '2026-04-13',
    modelProfileMapJson: {
      reflex: 'model-profile:reflex.fast@baseline',
    },
    criticalConfigJson: {
      bootTimeoutMs: 60_000,
    },
    evalSummaryJson: {
      verdict: 'pass',
    },
    evidenceRefs: ['body-change:snapshot:pre-accept'],
  });

  assert.equal(replayAttempt.accepted, true);
  assert.equal(replayAttempt.status, BODY_CHANGE_STATUS.SNAPSHOT_READY);
  assert.equal(tagCalls, 2);
  assert.equal(baseStore.snapshots.length, 1);
});

void test('snapshot publication reuses a replayed manifest with no registered snapshot row when the prior write already materialized the same manifest', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  let failAfterManifestWrite = true;
  let tagCalls = 0;
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: () => 'snapshot-manifest-replay',
    verifyGovernorApproval: approveGovernor,
    gitGateway: createGitGateway({
      commitCandidate: () =>
        Promise.resolve({
          commitSha: 'abcdef123456',
        }),
      createStableTag: ({ snapshotId }) => {
        tagCalls += 1;
        return Promise.resolve({
          gitTag: `stable/${snapshotId}`,
        });
      },
    }),
    commandRunner: ({ command }) =>
      Promise.resolve({
        kind: command.kind,
        label: command.label,
        ok: true,
        evidenceRef: command.evidenceRef ?? null,
        detail: null,
      } satisfies BodyChangeGateCheck),
    fileOps: {
      writeFile: async (...args) => {
        await writeFile(...args);
        if (failAfterManifestWrite) {
          failAfterManifestWrite = false;
          throw new Error('manifest write interrupted after file materialization');
        }
      },
      readFile,
    },
  });

  const submitted = await service.submitBodyChangeRequest(createBodyChangeRequest());
  assert.equal(submitted.accepted, true);
  await service.prepareProposalWorktree({
    proposalId: submitted.proposal.proposalId,
    requestId: 'prepare-snapshot-manifest-replay',
    evidenceRefs: ['body-change:worktree:snapshot-manifest-replay'],
  });
  await service.evaluateProposalForCandidate({
    proposalId: submitted.proposal.proposalId,
    requestId: 'evaluate-snapshot-manifest-replay',
    candidateCommitMessage: 'feat(body): snapshot manifest replay candidate',
    evalCommand: {
      label: 'body-evolution.boundary',
      command: 'pnpm',
      args: ['test'],
    },
    evidenceRefs: ['body-change:evaluate:snapshot-manifest-replay'],
  });

  const firstAttempt = await service.publishStableSnapshot({
    proposalId: submitted.proposal.proposalId,
    requestId: 'publish-snapshot-manifest-replay',
    schemaVersion: '2026-04-13',
    modelProfileMapJson: {
      reflex: 'model-profile:reflex.fast@baseline',
    },
    criticalConfigJson: {
      bootTimeoutMs: 60_000,
    },
    evalSummaryJson: {
      verdict: 'pass',
    },
    evidenceRefs: ['body-change:snapshot:manifest-replay'],
  });

  assert.equal(firstAttempt.accepted, false);
  assert.equal(firstAttempt.reason, 'snapshot_manifest_invalid');
  assert.equal(store.snapshots.length, 0);
  assert.equal(tagCalls, 0);

  const replayAttempt = await service.publishStableSnapshot({
    proposalId: submitted.proposal.proposalId,
    requestId: 'publish-snapshot-manifest-replay',
    schemaVersion: '2026-04-13',
    modelProfileMapJson: {
      reflex: 'model-profile:reflex.fast@baseline',
    },
    criticalConfigJson: {
      bootTimeoutMs: 60_000,
    },
    evalSummaryJson: {
      verdict: 'pass',
    },
    evidenceRefs: ['body-change:snapshot:manifest-replay'],
  });

  assert.equal(replayAttempt.accepted, true);
  assert.equal(replayAttempt.status, BODY_CHANGE_STATUS.SNAPSHOT_READY);
  assert.equal(store.snapshots.length, 1);
  assert.equal(tagCalls, 1);
});

void test('rollback evidence retries the owner-gate outcome after a transient failure without duplicating rollback state', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  let rollbackOutcomeCalls = 0;
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: (() => {
      let counter = 0;
      return () => {
        counter += 1;
        return `rollback-retry-${counter}`;
      };
    })(),
    verifyGovernorApproval: approveGovernor,
    gitGateway: createGitGateway({
      commitCandidate: () =>
        Promise.resolve({
          commitSha: 'abcdef123456',
        }),
      createStableTag: ({ snapshotId }) =>
        Promise.resolve({
          gitTag: `stable/${snapshotId}`,
        }),
    }),
    commandRunner: ({ command }) =>
      Promise.resolve({
        kind: command.kind,
        label: command.label,
        ok: true,
        evidenceRef: command.evidenceRef ?? null,
        detail: null,
      } satisfies BodyChangeGateCheck),
    recordGovernorOutcome: (input) => {
      if (input.outcomeKind === 'rolled_back') {
        rollbackOutcomeCalls += 1;
        if (rollbackOutcomeCalls === 1) {
          return Promise.resolve({
            accepted: false,
            requestId: input.requestId,
            reason: 'persistence_unavailable',
          });
        }
      }

      return Promise.resolve({
        accepted: true,
        requestId: input.requestId,
        proposalId: input.proposalId,
        outcomeId: `development-proposal-outcome:${input.outcomeKind}:${rollbackOutcomeCalls}`,
        state: input.outcomeKind,
        outcomeKind: input.outcomeKind,
        deduplicated: rollbackOutcomeCalls > 1,
        createdAt: input.recordedAt,
      });
    },
  });

  const submitted = await service.submitBodyChangeRequest(createBodyChangeRequest());
  assert.equal(submitted.accepted, true);
  await service.prepareProposalWorktree({
    proposalId: submitted.proposal.proposalId,
    requestId: 'prepare-rollback-retry',
    evidenceRefs: ['body-change:worktree:rollback-retry'],
  });
  await service.evaluateProposalForCandidate({
    proposalId: submitted.proposal.proposalId,
    requestId: 'evaluate-rollback-retry',
    candidateCommitMessage: 'feat(body): rollback retry candidate',
    evalCommand: {
      label: 'body-evolution.boundary',
      command: 'pnpm',
      args: ['test'],
    },
    evidenceRefs: ['body-change:evaluate:rollback-retry'],
  });
  const snapshot = await service.publishStableSnapshot({
    proposalId: submitted.proposal.proposalId,
    requestId: 'publish-rollback-retry',
    schemaVersion: '2026-04-13',
    modelProfileMapJson: {
      reflex: 'model-profile:reflex.fast@baseline',
    },
    criticalConfigJson: {
      bootTimeoutMs: 60_000,
    },
    evalSummaryJson: {
      verdict: 'pass',
    },
    evidenceRefs: ['body-change:snapshot:rollback-retry'],
  });
  assert.equal(snapshot.accepted, true);

  const firstAttempt = await service.recordRollbackEvidence({
    proposalId: submitted.proposal.proposalId,
    requestId: 'rollback-retry',
    snapshotId: snapshot.snapshot.snapshotId,
    rollbackReason: 'transient owner gate outage',
    verificationResult: 'rollback verified after retry',
    evidenceRefs: ['body-change:rollback:retry'],
  });

  assert.equal(firstAttempt.accepted, false);
  assert.equal(firstAttempt.reason, 'governor_outcome_unavailable');
  assert.equal(store.proposals[0]?.status, BODY_CHANGE_STATUS.ROLLED_BACK);
  assert.equal(
    store.events.filter(
      (event) => event.eventKind === BODY_CHANGE_EVENT_KIND.ROLLBACK_EVIDENCE_RECORDED,
    ).length,
    1,
  );

  const replayAttempt = await service.recordRollbackEvidence({
    proposalId: submitted.proposal.proposalId,
    requestId: 'rollback-retry',
    snapshotId: snapshot.snapshot.snapshotId,
    rollbackReason: 'transient owner gate outage',
    verificationResult: 'rollback verified after retry',
    evidenceRefs: ['body-change:rollback:retry'],
  });

  assert.equal(replayAttempt.accepted, true);
  assert.equal(rollbackOutcomeCalls, 2);
  assert.equal(
    store.events.filter(
      (event) => event.eventKind === BODY_CHANGE_EVENT_KIND.ROLLBACK_EVIDENCE_RECORDED,
    ).length,
    1,
  );
});

void test('AC-F0017-29 / AC-F0017-30 route human_override execution and rollback outcomes only through the owner gate', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  const governorOutcomes: Array<Record<string, unknown>> = [];
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: (() => {
      let counter = 0;
      return () => {
        counter += 1;
        return `override-outcome-${counter}`;
      };
    })(),
    ensureHumanOverrideGovernorApproval: () =>
      Promise.resolve({
        accepted: true,
        governorProposalId: 'development-proposal:human-override',
        governorDecisionRef: 'development-proposal-decision:human-override',
        targetRef: 'workspace:body:override',
      }),
    gitGateway: createGitGateway({
      commitCandidate: () =>
        Promise.resolve({
          commitSha: 'abcdef123456',
        }),
      createStableTag: ({ snapshotId }) =>
        Promise.resolve({
          gitTag: `stable/${snapshotId}`,
        }),
    }),
    commandRunner: ({ command }) =>
      Promise.resolve({
        kind: command.kind,
        label: command.label,
        ok: true,
        evidenceRef: command.evidenceRef ?? null,
        detail: null,
      } satisfies BodyChangeGateCheck),
    recordGovernorOutcome: (input) => {
      governorOutcomes.push(input as unknown as Record<string, unknown>);
      return Promise.resolve({
        accepted: true,
        requestId: input.requestId,
        proposalId: input.proposalId,
        outcomeId: `development-proposal-outcome:${governorOutcomes.length}`,
        state: input.outcomeKind,
        outcomeKind: input.outcomeKind,
        deduplicated: false,
        createdAt: input.recordedAt,
      });
    },
  });

  const submitted = await service.submitBodyChangeRequest(
    createBodyChangeRequest({
      requestedByOwner: BODY_CHANGE_REQUESTED_BY_OWNER.HUMAN_OVERRIDE,
      governorProposalId: undefined,
      governorDecisionRef: undefined,
      ownerOverrideEvidenceRef: 'owner-override:human',
      requestId: 'body-change-request:human-override',
      evidenceRefs: ['owner-override:human'],
    }),
  );
  assert.equal(submitted.accepted, true);
  assert.equal(submitted.proposal.governorProposalId, 'development-proposal:human-override');

  await service.prepareProposalWorktree({
    proposalId: submitted.proposal.proposalId,
    requestId: 'prepare-human-override',
    evidenceRefs: ['body-change:worktree:human-override'],
  });
  await service.evaluateProposalForCandidate({
    proposalId: submitted.proposal.proposalId,
    requestId: 'evaluate-human-override',
    candidateCommitMessage: 'feat(body): human override candidate',
    evalCommand: {
      label: 'body-evolution.boundary',
      command: 'pnpm',
      args: ['test'],
    },
    evidenceRefs: ['body-change:evaluate:human-override'],
  });
  const snapshot = await service.publishStableSnapshot({
    proposalId: submitted.proposal.proposalId,
    requestId: 'publish-human-override',
    schemaVersion: '2026-04-13',
    modelProfileMapJson: {
      reflex: 'model-profile:reflex.fast@baseline',
    },
    criticalConfigJson: {
      workspaceBodyPath: config.workspaceBodyPath,
    },
    evalSummaryJson: {
      verdict: 'pass',
    },
    evidenceRefs: ['body-change:snapshot:human-override'],
  });
  assert.equal(snapshot.accepted, true);

  const rollback = await service.recordRollbackEvidence({
    proposalId: submitted.proposal.proposalId,
    requestId: 'rollback-human-override',
    snapshotId: snapshot.snapshot.snapshotId,
    rollbackReason: 'human override rollback',
    verificationResult: 'rollback verified',
    evidenceRefs: ['body-change:rollback:human-override'],
  });
  assert.equal(rollback.accepted, true);

  assert.equal(governorOutcomes.length, 2);
  assert.deepEqual(
    governorOutcomes.map((outcome) => ({
      proposalId: outcome['proposalId'],
      outcomeKind: outcome['outcomeKind'],
      outcomeOrigin: outcome['outcomeOrigin'],
      targetRef: outcome['targetRef'],
    })),
    [
      {
        proposalId: 'development-proposal:human-override',
        outcomeKind: 'executed',
        outcomeOrigin: 'human_override',
        targetRef: 'workspace:body:override',
      },
      {
        proposalId: 'development-proposal:human-override',
        outcomeKind: 'rolled_back',
        outcomeOrigin: 'human_override',
        targetRef: 'workspace:body:override',
      },
    ],
  );
});

void test('AC-F0017-19..24 keep the persisted snapshot manifest untouched when a replay conflicts before store acceptance', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  const service = createTestBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: (() => {
      let counter = 0;
      return () => {
        counter += 1;
        return `manifest-conflict-${counter}`;
      };
    })(),
    verifyGovernorApproval: approveGovernor,
    gitGateway: createGitGateway({
      commitCandidate: () =>
        Promise.resolve({
          commitSha: 'abcdef123456',
        }),
      createStableTag: ({ snapshotId }) =>
        Promise.resolve({
          gitTag: `stable/${snapshotId}`,
        }),
    }),
    commandRunner: ({ command }) =>
      Promise.resolve({
        kind: command.kind,
        label: command.label,
        ok: true,
        evidenceRef: command.evidenceRef ?? null,
        detail: null,
      } satisfies BodyChangeGateCheck),
  });

  const submitted = await service.submitBodyChangeRequest(createBodyChangeRequest());
  assert.equal(submitted.accepted, true);
  await service.prepareProposalWorktree({
    proposalId: submitted.proposal.proposalId,
    requestId: 'prepare-manifest-conflict',
    evidenceRefs: ['body-change:worktree:manifest-conflict'],
  });
  await service.evaluateProposalForCandidate({
    proposalId: submitted.proposal.proposalId,
    requestId: 'evaluate-manifest-conflict',
    candidateCommitMessage: 'feat(body): manifest conflict candidate',
    evalCommand: {
      label: 'body-evolution.boundary',
      command: 'pnpm',
      args: ['test'],
    },
    evidenceRefs: ['body-change:evaluate:manifest-conflict'],
  });

  const firstSnapshot = await service.publishStableSnapshot({
    proposalId: submitted.proposal.proposalId,
    requestId: 'publish-manifest-conflict:1',
    schemaVersion: '2026-04-13',
    modelProfileMapJson: {
      reflex: 'model-profile:reflex.fast@baseline',
    },
    criticalConfigJson: {
      bootTimeoutMs: 60_000,
    },
    evalSummaryJson: {
      verdict: 'pass',
    },
    evidenceRefs: ['body-change:snapshot:manifest-conflict:1'],
  });
  assert.equal(firstSnapshot.accepted, true);

  const originalManifest = await import('node:fs/promises').then(({ readFile }) =>
    readFile(firstSnapshot.snapshot.manifestPath, 'utf8'),
  );

  const conflictingReplay = await service.publishStableSnapshot({
    proposalId: submitted.proposal.proposalId,
    requestId: 'publish-manifest-conflict:2',
    schemaVersion: '2026-04-13',
    modelProfileMapJson: {
      reflex: 'model-profile:reflex.fast@baseline',
    },
    criticalConfigJson: {
      bootTimeoutMs: 60_000,
    },
    evalSummaryJson: {
      verdict: 'different',
    },
    evidenceRefs: ['body-change:snapshot:manifest-conflict:2'],
  });

  assert.equal(conflictingReplay.accepted, false);
  assert.equal(conflictingReplay.reason, 'snapshot_manifest_invalid');

  const manifestAfterConflict = await import('node:fs/promises').then(({ readFile }) =>
    readFile(firstSnapshot.snapshot.manifestPath, 'utf8'),
  );
  assert.equal(manifestAfterConflict, originalManifest);
});
