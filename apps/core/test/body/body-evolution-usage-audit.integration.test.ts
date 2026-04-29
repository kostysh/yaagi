import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  BODY_CHANGE_EVENT_KIND,
  BODY_CHANGE_REQUESTED_BY_OWNER,
  BODY_CHANGE_SCOPE_KIND,
  BODY_CHANGE_STATUS,
  type BodyChangeGateCheck,
} from '@yaagi/contracts/body-evolution';
import type { PerimeterDecisionRow } from '@yaagi/contracts/perimeter';
import type {
  BodyChangeEventRow,
  BodyChangeProposalRow,
  BodyEvolutionStore,
  BodyStableSnapshotRow,
} from '@yaagi/db';
import type { CoreRuntimeConfig } from '../../src/platform/core-config.ts';
import { createBodyEvolutionGitGateway, createBodyEvolutionService } from '../../src/body/index.ts';
import { createPerimeterDecisionService } from '../../src/perimeter/index.ts';

const execFileAsync = promisify(execFile);

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

const git = async (cwd: string, args: string[]): Promise<string> => {
  const result = await execFileAsync('git', args, { cwd });
  return result.stdout.trim();
};

const approveHumanOverride = () =>
  Promise.resolve({
    accepted: true as const,
    governorProposalId: 'development-proposal:usage-audit-human-override',
    governorDecisionRef: 'development-proposal-decision:usage-audit-human-override',
    targetRef: 'workspace:body',
  });

const approveGovernor = ({ expectedTargetRef }: { expectedTargetRef: string }) =>
  Promise.resolve({
    approved: true as const,
    targetRef: expectedTargetRef,
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
        proposalId: proposal.proposalId,
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
      events.push({
        eventId: input.eventId,
        proposalId: proposal.proposalId,
        eventKind: BODY_CHANGE_EVENT_KIND.STABLE_SNAPSHOT_PUBLISHED,
        status: BODY_CHANGE_STATUS.SNAPSHOT_READY,
        evidenceRefsJson: input.evidenceRefs,
        payloadJson: input.payloadJson ?? {},
        createdAt: input.createdAt,
      });
      return Promise.resolve({
        accepted: true,
        deduplicated: false,
        proposal,
        event: events.at(-1) ?? null,
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

void test('usage audit exercises the full internal body-evolution flow with a real git worktree and snapshot manifest', async () => {
  const rootPath = await mkdtemp(path.join(tmpdir(), 'yaagi-body-usage-audit-'));
  const config = createConfig(rootPath);
  const store = createMemoryStore();
  await mkdir(config.seedBodyPath, { recursive: true });
  await mkdir(path.join(config.workspaceBodyPath, 'src'), { recursive: true });
  await mkdir(path.join(config.dataPath, 'snapshots'), { recursive: true });
  await writeFile(
    path.join(config.workspaceBodyPath, 'src', 'body.ts'),
    'export const body = 1;\n',
  );
  await git(config.workspaceBodyPath, ['init']);
  await git(config.workspaceBodyPath, ['config', 'user.email', 'test@example.com']);
  await git(config.workspaceBodyPath, ['config', 'user.name', 'YAAGI Test']);
  await git(config.workspaceBodyPath, ['add', '-A']);
  await git(config.workspaceBodyPath, ['commit', '-m', 'init']);

  const governorOutcomes: Array<Record<string, unknown>> = [];
  const perimeterDecisions: PerimeterDecisionRow[] = [];
  const perimeterDecisionService = createPerimeterDecisionService({
    store: {
      recordDecision: (input) => {
        const decision: PerimeterDecisionRow = {
          decisionId: input.decisionId,
          requestId: input.requestId,
          actionClass: input.actionClass,
          ingressOwner: input.ingressOwner,
          authorityOwner: input.authorityOwner,
          governorProposalId: input.governorProposalId,
          governorDecisionRef: input.governorDecisionRef,
          humanOverrideEvidenceRef: input.humanOverrideEvidenceRef,
          targetRef: input.targetRef,
          evidenceRefsJson: input.evidenceRefs,
          verdict: input.verdict,
          decisionReason: input.decisionReason,
          policyVersion: input.policyVersion,
          payloadJson: input.payloadJson ?? {},
          createdAt: input.createdAt,
        };
        perimeterDecisions.push(decision);
        return Promise.resolve({
          accepted: true,
          deduplicated: false,
          decision,
        });
      },
    },
  });
  const service = createBodyEvolutionService({
    config,
    store,
    gitGateway: createBodyEvolutionGitGateway({ config }),
    ensureHumanOverrideGovernorApproval: approveHumanOverride,
    verifyGovernorApproval: approveGovernor,
    perimeterDecisionService,
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

  const submitted = await service.submitBodyChangeRequest({
    requestedByOwner: BODY_CHANGE_REQUESTED_BY_OWNER.GOVERNOR,
    governorProposalId: 'development-proposal:usage-audit',
    governorDecisionRef: 'development-proposal-decision:usage-audit',
    requestId: 'body-change-request:usage-audit',
    scopeKind: BODY_CHANGE_SCOPE_KIND.CODE,
    rationale: 'Exercise the internal body-evolution flow end-to-end.',
    requiredEvalSuite: 'body-evolution.boundary',
    targetPaths: ['src/body.ts'],
    rollbackPlanRef: 'rollback:body-change:usage-audit',
    evidenceRefs: ['governor:decision:usage-audit'],
  });
  assert.equal(submitted.accepted, true);

  const prepared = await service.prepareProposalWorktree({
    proposalId: submitted.proposal.proposalId,
    requestId: 'prepare-usage-audit',
    evidenceRefs: ['body-change:worktree:usage-audit'],
  });
  assert.equal(prepared.accepted, true);

  const worktreeFile = path.join(submitted.proposal.worktreePath, 'src', 'body.ts');
  await writeFile(worktreeFile, 'export const body = 2;\n');

  const candidate = await service.evaluateProposalForCandidate({
    proposalId: submitted.proposal.proposalId,
    requestId: 'evaluate-usage-audit',
    candidateCommitMessage: 'feat(body): usage audit candidate',
    evalCommand: {
      label: 'body-evolution.boundary',
      command: 'pnpm',
      args: ['test'],
    },
    evidenceRefs: ['body-change:evaluate:usage-audit'],
  });
  assert.equal(candidate.accepted, true);
  assert.equal(candidate.status, BODY_CHANGE_STATUS.CANDIDATE_COMMITTED);

  const snapshot = await service.publishStableSnapshot({
    proposalId: submitted.proposal.proposalId,
    requestId: 'publish-usage-audit',
    schemaVersion: '2026-04-13',
    modelProfileMapJson: {
      reflex: 'model-profile:reflex.fast@baseline',
    },
    criticalConfigJson: {
      workspaceBodyPath: config.workspaceBodyPath,
      bootTimeoutMs: config.bootTimeoutMs,
    },
    evalSummaryJson: {
      verdict: 'pass',
      suite: 'body-evolution.boundary',
    },
    evidenceRefs: ['body-change:snapshot:usage-audit'],
  });
  assert.equal(snapshot.accepted, true);

  const rollback = await service.recordRollbackEvidence({
    proposalId: submitted.proposal.proposalId,
    requestId: 'rollback-usage-audit',
    snapshotId: snapshot.snapshot.snapshotId,
    rollbackReason: 'usage-audit verification',
    verificationResult: 'rollback evidence recorded',
    evidenceRefs: ['body-change:rollback:usage-audit'],
  });
  assert.equal(rollback.accepted, true);

  const manifest = JSON.parse(await readFile(snapshot.snapshot.manifestPath, 'utf8')) as Record<
    string,
    unknown
  >;
  assert.equal(manifest['snapshotId'], snapshot.snapshot.snapshotId);
  assert.equal(typeof manifest['criticalConfigHash'], 'string');
  assert.deepEqual(
    store.events.map((event) => event.eventKind),
    [
      BODY_CHANGE_EVENT_KIND.PROPOSAL_RECORDED,
      BODY_CHANGE_EVENT_KIND.WORKTREE_PREPARED,
      BODY_CHANGE_EVENT_KIND.EVALUATION_STARTED,
      BODY_CHANGE_EVENT_KIND.BOUNDARY_CHECKED,
      BODY_CHANGE_EVENT_KIND.CANDIDATE_COMMITTED,
      BODY_CHANGE_EVENT_KIND.STABLE_SNAPSHOT_PUBLISHED,
      BODY_CHANGE_EVENT_KIND.ROLLBACK_EVIDENCE_RECORDED,
    ],
  );
  assert.equal(governorOutcomes.length, 2);
  assert.deepEqual(
    perimeterDecisions.map((decision) => decision.actionClass),
    ['code_or_promotion_change', 'force_rollback'],
  );
});
