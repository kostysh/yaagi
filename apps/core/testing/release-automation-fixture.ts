import { createHash } from 'node:crypto';
import {
  DEPLOY_ATTEMPT_STATUS,
  RELEASE_AUTOMATION_REJECTION_REASON,
  ROLLBACK_EXECUTION_MODE,
  ROLLBACK_EXECUTION_STATUS,
  ROLLBACK_PLAN_PREFLIGHT_STATUS,
  assertReleaseAutomationOwnedWriteSurface,
  releaseRequestRowSchema,
  type DeployAttempt,
  type ReleaseEvidenceBundle,
  type ReleaseInspection,
  type ReleaseRequest,
  type ReleaseRequestRow,
  type RollbackExecution,
  type RollbackPlan,
} from '@yaagi/contracts/release-automation';
import type { ReleaseAutomationStore } from '@yaagi/db';

type StoreState = {
  releaseRequests: ReleaseRequestRow[];
  rollbackPlans: RollbackPlan[];
  deployAttempts: DeployAttempt[];
  evidenceBundles: ReleaseEvidenceBundle[];
  rollbackExecutions: RollbackExecution[];
};

const stableHash = (request: ReleaseRequest): string =>
  createHash('sha256')
    .update(
      JSON.stringify({
        actorRef: request.actorRef,
        evidenceRefs: [...request.evidenceRefs]
          .filter((ref) => !ref.startsWith('operator-auth-evidence:'))
          .sort(),
        gitRef: request.gitRef,
        rollbackTargetRef: request.rollbackTargetRef,
        requestedAction: request.requestedAction,
        source: request.source,
        targetEnvironment: request.targetEnvironment,
      }),
    )
    .digest('hex');

const equalStringSet = (left: readonly string[], right: readonly string[]): boolean => {
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return (
    sortedLeft.length === sortedRight.length &&
    sortedLeft.every((value, index) => value === sortedRight[index])
  );
};

const equivalentEvidenceBundle = (
  existing: ReleaseEvidenceBundle,
  input: ReleaseEvidenceBundle,
): boolean =>
  existing.releaseRequestId === input.releaseRequestId &&
  existing.deployAttemptId === input.deployAttemptId &&
  existing.commitRef === input.commitRef &&
  existing.deploymentIdentity === input.deploymentIdentity &&
  existing.migrationState === input.migrationState &&
  JSON.stringify(existing.smokeOnDeployResult) === JSON.stringify(input.smokeOnDeployResult) &&
  existing.modelServingReadinessRef === input.modelServingReadinessRef &&
  existing.governorEvidenceRef === input.governorEvidenceRef &&
  existing.lifecycleRollbackTargetRef === input.lifecycleRollbackTargetRef &&
  equalStringSet(existing.diagnosticReportRefs, input.diagnosticReportRefs) &&
  equalStringSet(existing.fileArtifactRefs, input.fileArtifactRefs) &&
  existing.materializedAt === input.materializedAt;

const equivalentRollbackExecution = (
  existing: RollbackExecution,
  input: RollbackExecution,
): boolean =>
  existing.rollbackPlanId === input.rollbackPlanId &&
  existing.deployAttemptId === input.deployAttemptId &&
  existing.trigger === input.trigger &&
  existing.status === input.status &&
  equalStringSet(existing.evidenceRefs, input.evidenceRefs) &&
  equalStringSet(existing.diagnosticReportRefs, input.diagnosticReportRefs) &&
  existing.executedAt === input.executedAt &&
  existing.failureReason === input.failureReason;

const equivalentDeployCompletion = (
  existing: DeployAttempt,
  input: {
    status: DeployAttempt['status'];
    failureReason?: string | null;
  },
): boolean =>
  existing.status === input.status &&
  (existing.failureReason ?? null) === (input.failureReason ?? null);

export const createInMemoryReleaseAutomationStore = (): {
  store: ReleaseAutomationStore;
  state: StoreState;
} => {
  const state: StoreState = {
    releaseRequests: [],
    rollbackPlans: [],
    deployAttempts: [],
    evidenceBundles: [],
    rollbackExecutions: [],
  };

  const store: ReleaseAutomationStore = {
    assertOwnedWriteSurface(surface): void {
      assertReleaseAutomationOwnedWriteSurface(surface);
    },

    async createReleaseRequest(input) {
      await Promise.resolve();
      const hash = stableHash(input);
      const existing = state.releaseRequests.find((row) => row.requestId === input.requestId);
      if (existing) {
        if (existing.normalizedRequestHash === hash) {
          return { accepted: true, deduplicated: true, request: existing };
        }
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
          existingRequest: existing,
        };
      }

      const row = releaseRequestRowSchema.parse({
        ...input,
        normalizedRequestHash: hash,
        createdAt: input.requestedAt,
      });
      state.releaseRequests.push(row);
      return { accepted: true, deduplicated: false, request: row };
    },

    async getReleaseRequest(requestId) {
      await Promise.resolve();
      return state.releaseRequests.find((row) => row.requestId === requestId) ?? null;
    },

    async createRollbackPlan(input) {
      await Promise.resolve();
      if (!state.releaseRequests.some((row) => row.requestId === input.releaseRequestId)) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.RELEASE_REQUEST_MISSING,
        };
      }
      const existing = state.rollbackPlans.find(
        (row) => row.rollbackPlanId === input.rollbackPlanId,
      );
      if (existing) {
        const expectedRequiredEvidenceRefs = [...input.requiredEvidenceRefs].sort();
        const equivalent =
          existing.releaseRequestId === input.releaseRequestId &&
          existing.deployAttemptId === (input.deployAttemptId ?? null) &&
          existing.rollbackTargetRef === input.rollbackTargetRef &&
          existing.executionMode === (input.executionMode ?? ROLLBACK_EXECUTION_MODE.AUTOMATIC) &&
          existing.preflightStatus ===
            (input.preflightStatus ?? ROLLBACK_PLAN_PREFLIGHT_STATUS.READY) &&
          existing.requiredEvidenceRefs.length === expectedRequiredEvidenceRefs.length &&
          existing.requiredEvidenceRefs.every(
            (ref, index) => ref === expectedRequiredEvidenceRefs[index],
          );
        if (!equivalent) {
          return {
            accepted: false,
            reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
          };
        }
        return { accepted: true, deduplicated: true, plan: existing };
      }
      const plan: RollbackPlan = {
        rollbackPlanId: input.rollbackPlanId,
        releaseRequestId: input.releaseRequestId,
        deployAttemptId: input.deployAttemptId ?? null,
        rollbackTargetRef: input.rollbackTargetRef,
        requiredEvidenceRefs: [...input.requiredEvidenceRefs],
        executionMode: input.executionMode ?? ROLLBACK_EXECUTION_MODE.AUTOMATIC,
        preflightStatus: input.preflightStatus ?? ROLLBACK_PLAN_PREFLIGHT_STATUS.READY,
        createdAt: input.createdAt,
      };
      state.rollbackPlans.push(plan);
      return { accepted: true, deduplicated: false, plan };
    },

    async getRollbackPlan(rollbackPlanId) {
      await Promise.resolve();
      return state.rollbackPlans.find((row) => row.rollbackPlanId === rollbackPlanId) ?? null;
    },

    async getRollbackPlanForRequest(releaseRequestId) {
      await Promise.resolve();
      return (
        state.rollbackPlans
          .filter((row) => row.releaseRequestId === releaseRequestId)
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
      );
    },

    async startDeployAttempt(input) {
      await Promise.resolve();
      if (!state.releaseRequests.some((row) => row.requestId === input.releaseRequestId)) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.RELEASE_REQUEST_MISSING,
        };
      }
      const plan = state.rollbackPlans.find((row) => row.rollbackPlanId === input.rollbackPlanId);
      if (!plan || plan.preflightStatus !== ROLLBACK_PLAN_PREFLIGHT_STATUS.READY) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.MISSING_ROLLBACK_PLAN,
        };
      }
      const existing = state.deployAttempts.find(
        (row) => row.deployAttemptId === input.deployAttemptId,
      );
      if (existing) {
        if (
          existing.releaseRequestId !== input.releaseRequestId ||
          existing.rollbackPlanId !== input.rollbackPlanId ||
          existing.targetEnvironment !== input.targetEnvironment ||
          existing.deploymentIdentity !== input.deploymentIdentity ||
          existing.migrationState !== input.migrationState
        ) {
          return {
            accepted: false,
            reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
          };
        }
        return { accepted: true, deduplicated: true, attempt: existing };
      }
      if (!input.evidenceStorageWritable) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.EVIDENCE_STORAGE_UNAVAILABLE,
        };
      }
      const attempt: DeployAttempt = {
        deployAttemptId: input.deployAttemptId,
        releaseRequestId: input.releaseRequestId,
        rollbackPlanId: input.rollbackPlanId,
        targetEnvironment: input.targetEnvironment,
        deploymentIdentity: input.deploymentIdentity,
        migrationState: input.migrationState,
        status: DEPLOY_ATTEMPT_STATUS.RUNNING,
        failureReason: null,
        startedAt: input.startedAt,
        finishedAt: null,
        createdAt: input.startedAt,
      };
      state.deployAttempts.push(attempt);
      return { accepted: true, deduplicated: false, attempt };
    },

    async completeDeployAttempt(input) {
      await Promise.resolve();
      const attempt = state.deployAttempts.find(
        (row) => row.deployAttemptId === input.deployAttemptId,
      );
      if (!attempt) {
        return null;
      }
      if (attempt.status !== DEPLOY_ATTEMPT_STATUS.RUNNING) {
        return equivalentDeployCompletion(attempt, input) ? attempt : null;
      }
      attempt.status = input.status;
      attempt.failureReason = input.failureReason ?? null;
      attempt.finishedAt = input.finishedAt;
      return attempt;
    },

    async recordReleaseEvidence(input) {
      await Promise.resolve();
      const existing = state.evidenceBundles.find(
        (row) => row.evidenceBundleId === input.evidenceBundleId,
      );
      if (existing) {
        if (!equivalentEvidenceBundle(existing, input)) {
          return {
            accepted: false,
            reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
            existingBundle: existing,
          };
        }
        return { accepted: true, deduplicated: true, bundle: existing };
      }
      state.evidenceBundles.push(input);
      return { accepted: true, deduplicated: false, bundle: input };
    },

    async recordRollbackExecution(input) {
      await Promise.resolve();
      const existing = state.rollbackExecutions.find(
        (row) =>
          row.rollbackExecutionId === input.rollbackExecutionId ||
          (row.rollbackPlanId === input.rollbackPlanId &&
            row.deployAttemptId === input.deployAttemptId),
      );
      if (existing) {
        if (!equivalentRollbackExecution(existing, input)) {
          return {
            accepted: false,
            reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
            existingExecution: existing,
          };
        }
        return { accepted: true, deduplicated: true, execution: existing };
      }
      state.rollbackExecutions.push(input);
      return { accepted: true, deduplicated: false, execution: input };
    },

    async completeRollbackExecution(input) {
      await Promise.resolve();
      const existing = state.rollbackExecutions.find(
        (row) => row.rollbackExecutionId === input.rollbackExecutionId,
      );
      if (!existing) {
        throw new Error(
          `rollback execution ${input.rollbackExecutionId} disappeared before completion`,
        );
      }
      if (existing.status !== ROLLBACK_EXECUTION_STATUS.RUNNING) {
        if (!equivalentRollbackExecution(existing, input)) {
          return {
            accepted: false,
            reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
            existingExecution: existing,
          };
        }
        return { accepted: true, deduplicated: true, execution: existing };
      }
      if (
        existing.rollbackPlanId !== input.rollbackPlanId ||
        existing.deployAttemptId !== input.deployAttemptId ||
        existing.trigger !== input.trigger
      ) {
        return {
          accepted: false,
          reason: RELEASE_AUTOMATION_REJECTION_REASON.IDEMPOTENCY_CONFLICT,
          existingExecution: existing,
        };
      }
      existing.status = input.status;
      existing.evidenceRefs = input.evidenceRefs;
      existing.diagnosticReportRefs = input.diagnosticReportRefs;
      existing.executedAt = input.executedAt;
      existing.failureReason = input.failureReason;
      return { accepted: true, deduplicated: false, execution: existing };
    },

    async getRollbackExecution(rollbackExecutionId) {
      await Promise.resolve();
      return (
        state.rollbackExecutions.find((row) => row.rollbackExecutionId === rollbackExecutionId) ??
        null
      );
    },

    async inspectReleaseRequest(requestId) {
      await Promise.resolve();
      const request = state.releaseRequests.find((row) => row.requestId === requestId);
      if (!request) {
        return null;
      }
      const attempts = state.deployAttempts.filter((row) => row.releaseRequestId === requestId);
      const attemptIds = new Set(attempts.map((row) => row.deployAttemptId));
      const inspection: ReleaseInspection = {
        request,
        rollbackPlan: state.rollbackPlans.find((row) => row.releaseRequestId === requestId) ?? null,
        deployAttempts: attempts,
        evidenceBundles: state.evidenceBundles.filter((row) => row.releaseRequestId === requestId),
        rollbackExecutions: state.rollbackExecutions.filter((row) =>
          attemptIds.has(row.deployAttemptId),
        ),
      };
      return inspection;
    },
  };

  return { store, state };
};
