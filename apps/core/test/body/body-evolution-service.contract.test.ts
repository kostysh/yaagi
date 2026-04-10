import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, type realpath, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  BODY_CHANGE_EVENT_KIND,
  BODY_CHANGE_REQUESTED_BY_OWNER,
  BODY_CHANGE_SCOPE_KIND,
  BODY_CHANGE_STATUS,
} from '@yaagi/contracts/body-evolution';
import type { BodyChangeEventRow, BodyChangeProposalRow, BodyEvolutionStore } from '@yaagi/db';
import type { CoreRuntimeConfig } from '../../src/platform/core-config.ts';
import { createBodyEvolutionService } from '../../src/body/body-evolution.ts';

// Coverage refs: AC-F0017-01 AC-F0017-02 AC-F0017-03 AC-F0017-04 AC-F0017-05
// Coverage refs: AC-F0017-06 AC-F0017-07 AC-F0017-08 AC-F0017-09 AC-F0017-10
// Coverage refs: AC-F0017-11 AC-F0017-12 AC-F0017-13 AC-F0017-14 AC-F0017-15

const createdAt = '2026-04-10T18:00:00.000Z';

const createConfig = (rootPath: string): CoreRuntimeConfig => ({
  postgresUrl: 'postgres://yaagi:yaagi@127.0.0.1:5432/yaagi',
  fastModelBaseUrl: 'http://127.0.0.1:8000/v1',
  deepModelBaseUrl: 'http://127.0.0.1:8001/v1',
  poolModelBaseUrl: 'http://127.0.0.1:8002/v1',
  telegramEnabled: false,
  telegramBotToken: null,
  telegramAllowedChatIds: [],
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
  host: '127.0.0.1',
  port: 8787,
  bootTimeoutMs: 60_000,
});

const createRuntimeRoots = async (): Promise<{ rootPath: string; config: CoreRuntimeConfig }> => {
  const rootPath = await mkdtemp(path.join(tmpdir(), 'yaagi-body-evolution-'));
  const config = createConfig(rootPath);
  await mkdir(config.seedBodyPath, { recursive: true });
  await mkdir(config.workspaceBodyPath, { recursive: true });
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

const createMemoryStore = (): BodyEvolutionStore & {
  proposals: BodyChangeProposalRow[];
  events: BodyChangeEventRow[];
} => {
  const proposals: BodyChangeProposalRow[] = [];
  const events: BodyChangeEventRow[] = [];

  return {
    proposals,
    events,
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
    getProposal(proposalId) {
      return Promise.resolve(proposals.find((entry) => entry.proposalId === proposalId) ?? null);
    },
    getProposalByRequestId(requestId) {
      return Promise.resolve(proposals.find((entry) => entry.requestId === requestId) ?? null);
    },
    listProposalEvents(input) {
      return Promise.resolve(events.filter((entry) => entry.proposalId === input.proposalId));
    },
  };
};

void test('AC-F0017-01 / AC-F0017-06 / AC-F0017-09..15 accepts approved governor body change proposals', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  const service = createBodyEvolutionService({
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
    verifyGovernorApproval: () => Promise.resolve(true),
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
  assert.equal(store.events[0]?.payloadJson['branchName'], result.proposal.branchName);
  assert.equal(store.events[0]?.payloadJson['worktreePath'], result.proposal.worktreePath);
  assert.equal(store.events[0]?.payloadJson['candidateCommitSha'], null);
  assert.equal(store.events[0]?.payloadJson['stableSnapshotId'], null);
  assert.equal(store.events[0]?.payloadJson['evalResult'], null);
});

void test('AC-F0017-02 accepts owner-approved override evidence without governor refs', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  const service = createBodyEvolutionService({
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
  assert.equal(result.proposal.governorProposalId, null);
  assert.equal(result.proposal.governorDecisionRef, null);
  assert.equal(result.proposal.ownerOverrideEvidenceRef, 'owner-override:1');
});

void test('AC-F0017-03 rejects requests without approved authority before persistence', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  const service = createBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: () => 'unauthorized-id',
    verifyGovernorApproval: () => Promise.resolve(false),
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

void test('AC-F0017-04 / AC-F0017-05 handles request replay idempotency and hash conflicts', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  const service = createBodyEvolutionService({
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
    verifyGovernorApproval: () => Promise.resolve(true),
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
  const service = createBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: () => 'seed-id',
    verifyGovernorApproval: () => Promise.resolve(true),
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
  const service = createBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: () => 'escape-id',
    verifyGovernorApproval: () => Promise.resolve(true),
  });

  const result = await service.submitBodyChangeRequest(
    createBodyChangeRequest({
      targetPaths: ['escape/file.ts'],
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
  const service = createBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: () => 'worktree-root-symlink-id',
    verifyGovernorApproval: () => Promise.resolve(true),
  });

  const result = await service.submitBodyChangeRequest(createBodyChangeRequest());

  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'worktree_escape_rejected');
  assert.equal(store.proposals.length, 0);
});

void test('AC-F0017-08 rejects unverifiable body boundaries before persistence', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  const service = createBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: () => 'unverifiable-id',
    verifyGovernorApproval: () => Promise.resolve(true),
    fileOps: {
      realpath: ((targetPath) => {
        if (targetPath === config.workspaceBodyPath) {
          return Promise.reject(
            Object.assign(new Error('workspace body root is not readable'), {
              code: 'EACCES',
            }),
          );
        }

        return Promise.resolve(String(targetPath));
      }) as typeof realpath,
    },
  });

  const result = await service.submitBodyChangeRequest(createBodyChangeRequest());

  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'worktree_escape_rejected');
  assert.equal(store.proposals.length, 0);
});

void test('AC-F0017-06 assigns collision-resistant worktree paths for distinct requests', async () => {
  const { config } = await createRuntimeRoots();
  const store = createMemoryStore();
  const service = createBodyEvolutionService({
    config,
    store,
    now: () => new Date(createdAt),
    createId: (() => {
      let counter = 0;
      return () => {
        counter += 1;
        return `collision-id-${counter}`;
      };
    })(),
    verifyGovernorApproval: () => Promise.resolve(true),
  });

  const first = await service.submitBodyChangeRequest(
    createBodyChangeRequest({
      requestId: 'Feature/A',
      evidenceRefs: ['governor:decision:feature-a'],
    }),
  );
  const second = await service.submitBodyChangeRequest(
    createBodyChangeRequest({
      requestId: 'feature a',
      evidenceRefs: ['governor:decision:feature-a-second'],
    }),
  );

  assert.equal(first.accepted, true);
  assert.equal(second.accepted, true);
  assert.notEqual(first.proposal.worktreePath, second.proposal.worktreePath);
  assert.match(first.proposal.worktreePath, /feature-a-[a-f0-9]{12}$/);
  assert.match(second.proposal.worktreePath, /feature-a-[a-f0-9]{12}$/);
  assert.equal(store.proposals.length, 2);
});
