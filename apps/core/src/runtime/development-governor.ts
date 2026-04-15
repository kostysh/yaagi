import { createHash, randomUUID } from 'node:crypto';
import {
  DEVELOPMENT_FREEZE_STATE,
  DEVELOPMENT_FREEZE_TRIGGER_KIND,
  DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE,
  DEVELOPMENT_PROPOSAL_KIND,
  type DevelopmentFreezeResult,
  type DevelopmentFreezeTriggerKind,
  type DevelopmentGovernorOriginSurface,
  type DevelopmentProposalDecisionKind,
  type DevelopmentProposalDecisionResult,
  type DevelopmentProposalExecutionOutcomeKind,
  type DevelopmentProposalExecutionOutcomeResult,
  type DevelopmentProposalKind,
  type DevelopmentProposalResult,
} from '@yaagi/contracts/governor';
import {
  PERIMETER_ACTION_CLASS,
  PERIMETER_AUTHORITY_OWNER,
  PERIMETER_INGRESS_OWNER,
  PERIMETER_VERDICT,
} from '@yaagi/contracts/perimeter';
import { WORKSHOP_CANDIDATE_KIND, type WorkshopPromotionPackage } from '@yaagi/contracts/workshop';
import {
  HOMEOSTAT_ALERT_SEVERITY,
  HOMEOSTAT_REQUESTED_ACTION_KIND,
  HOMEOSTAT_SIGNAL_FAMILY,
  type HomeostatReactionRequest,
} from '@yaagi/contracts/runtime';
import {
  createDevelopmentGovernorStore,
  createRuntimeDbClient,
  setRuntimeDevelopmentFreeze,
  type DevelopmentFreezeRow,
} from '@yaagi/db';
import type { CoreRuntimeConfig } from '../platform/core-config.ts';
import {
  createDbBackedPerimeterDecisionService,
  type PerimeterDecisionService,
} from '../perimeter/index.ts';

type FreezeDevelopmentInput = {
  requestId: string;
  reason: string;
  evidenceRefs: string[];
  requestedBy: string;
  requestedAt?: string;
};

type SubmitDevelopmentProposalInput = {
  requestId: string;
  proposalKind: DevelopmentProposalKind;
  problemSignature: string;
  summary: string;
  evidenceRefs: string[];
  rollbackPlanRef: string | null;
  targetRef: string | null;
  requestedAt?: string;
};

type InternalGovernorProposalOwner = 'runtime' | 'recovery' | 'F-0015' | 'human_override';

type SubmitInternalDevelopmentProposalInput = SubmitDevelopmentProposalInput & {
  sourceOwner: InternalGovernorProposalOwner;
  payload?: Record<string, unknown>;
};

type RecordDevelopmentProposalDecisionInput = {
  requestId: string;
  proposalId: string;
  decisionKind: DevelopmentProposalDecisionKind;
  decisionOrigin: DevelopmentGovernorOriginSurface;
  rationale: string;
  evidenceRefs: string[];
  decidedAt?: string;
};

type RecordDevelopmentProposalExecutionOutcomeInput = {
  requestId: string;
  proposalId: string;
  outcomeKind: DevelopmentProposalExecutionOutcomeKind;
  outcomeOrigin: DevelopmentGovernorOriginSurface;
  targetRef: string;
  evidenceRefs: string[];
  recordedAt?: string;
};

type SubmitWorkshopPromotionProposalInput = {
  requestId: string;
  promotionPackage: WorkshopPromotionPackage;
  packageUri: string;
  requestedAt?: string;
};

export type DevelopmentGovernorService = {
  freezeDevelopment(input: FreezeDevelopmentInput): Promise<DevelopmentFreezeResult>;
  submitDevelopmentProposal(
    input: SubmitDevelopmentProposalInput,
  ): Promise<DevelopmentProposalResult>;
  submitInternalDevelopmentProposal(
    input: SubmitInternalDevelopmentProposalInput,
  ): Promise<DevelopmentProposalResult>;
  recordProposalDecision(
    input: RecordDevelopmentProposalDecisionInput,
  ): Promise<DevelopmentProposalDecisionResult>;
  recordProposalExecutionOutcome(
    input: RecordDevelopmentProposalExecutionOutcomeInput,
  ): Promise<DevelopmentProposalExecutionOutcomeResult>;
  submitWorkshopPromotionProposal(
    input: SubmitWorkshopPromotionProposalInput,
  ): Promise<DevelopmentProposalResult>;
  applyHomeostatReaction(request: HomeostatReactionRequest): Promise<DevelopmentFreezeResult>;
  recoverActiveFreeze(): Promise<{ activeFreeze: DevelopmentFreezeRow | null }>;
  loadActiveFreeze(): Promise<DevelopmentFreezeRow | null>;
};

type FreezeCommandMaterial = {
  requestId: string;
  triggerKind: DevelopmentFreezeTriggerKind;
  originSurface: DevelopmentGovernorOriginSurface;
  requestedBy: string;
  reason: string;
  hashEvidenceRefs: string[];
  storeEvidenceRefs: string[];
  createdAt: string;
  payloadJson: Record<string, unknown>;
};

type ProposalCommandMaterial = {
  requestId: string;
  proposalKind: DevelopmentProposalKind;
  originSurface: DevelopmentGovernorOriginSurface;
  submitterOwner: string;
  problemSignature: string;
  summary: string;
  rollbackPlanRef: string | null;
  targetRef: string | null;
  hashEvidenceRefs: string[];
  storeEvidenceRefs: string[];
  createdAt: string;
  payloadJson: Record<string, unknown>;
};

type ProposalDecisionCommandMaterial = {
  requestId: string;
  proposalId: string;
  decisionKind: DevelopmentProposalDecisionKind;
  decisionOrigin: DevelopmentGovernorOriginSurface;
  originSurface: DevelopmentGovernorOriginSurface;
  rationale: string;
  hashEvidenceRefs: string[];
  storeEvidenceRefs: string[];
  createdAt: string;
  payloadJson: Record<string, unknown>;
};

type ProposalExecutionOutcomeCommandMaterial = {
  requestId: string;
  proposalId: string;
  outcomeKind: DevelopmentProposalExecutionOutcomeKind;
  outcomeOrigin: DevelopmentGovernorOriginSurface;
  originSurface: DevelopmentGovernorOriginSurface;
  targetRef: string;
  hashEvidenceRefs: string[];
  storeEvidenceRefs: string[];
  createdAt: string;
  payloadJson: Record<string, unknown>;
};

const withRuntimeClient = async <T>(
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

const uniqueSorted = (values: string[]): string[] =>
  [...new Set(values.filter((value) => value.length > 0))].sort();

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

const hashFreezeCommand = (command: FreezeCommandMaterial): string =>
  createHash('sha256')
    .update(
      stableJson({
        originSurface: command.originSurface,
        reason: command.reason,
        requestId: command.requestId,
        requestedBy: command.requestedBy,
        evidenceRefs: command.hashEvidenceRefs,
        triggerKind: command.triggerKind,
      }),
    )
    .digest('hex');

const hashProposalCommand = (command: ProposalCommandMaterial): string =>
  createHash('sha256')
    .update(
      stableJson({
        evidenceRefs: command.hashEvidenceRefs,
        originSurface: command.originSurface,
        problemSignature: command.problemSignature,
        proposalKind: command.proposalKind,
        requestId: command.requestId,
        rollbackPlanRef: command.rollbackPlanRef,
        submitterOwner: command.submitterOwner,
        summary: command.summary,
        targetRef: command.targetRef,
      }),
    )
    .digest('hex');

const hashProposalDecisionCommand = (command: ProposalDecisionCommandMaterial): string =>
  createHash('sha256')
    .update(
      stableJson({
        decisionKind: command.decisionKind,
        decisionOrigin: command.decisionOrigin,
        evidenceRefs: command.hashEvidenceRefs,
        originSurface: command.originSurface,
        proposalId: command.proposalId,
        rationale: command.rationale,
        requestId: command.requestId,
      }),
    )
    .digest('hex');

const hashProposalExecutionOutcomeCommand = (
  command: ProposalExecutionOutcomeCommandMaterial,
): string =>
  createHash('sha256')
    .update(
      stableJson({
        evidenceRefs: command.hashEvidenceRefs,
        originSurface: command.originSurface,
        outcomeKind: command.outcomeKind,
        outcomeOrigin: command.outcomeOrigin,
        proposalId: command.proposalId,
        requestId: command.requestId,
        targetRef: command.targetRef,
      }),
    )
    .digest('hex');

const toAcceptedResult = (
  storeResult: Extract<
    Awaited<ReturnType<ReturnType<typeof createDevelopmentGovernorStore>['freezeDevelopment']>>,
    { accepted: true }
  >,
): DevelopmentFreezeResult => ({
  accepted: true,
  requestId: storeResult.freeze.requestId,
  freezeId: storeResult.freeze.freezeId,
  state: DEVELOPMENT_FREEZE_STATE.FROZEN,
  triggerKind: storeResult.freeze.triggerKind,
  decisionOrigin: storeResult.freeze.triggerKind,
  deduplicated: storeResult.deduplicated,
  createdAt: storeResult.freeze.createdAt,
});

const toFreezeResult = (
  storeResult: Awaited<
    ReturnType<ReturnType<typeof createDevelopmentGovernorStore>['freezeDevelopment']>
  >,
): DevelopmentFreezeResult => {
  if (storeResult.accepted) {
    return toAcceptedResult(storeResult);
  }

  return {
    accepted: false,
    requestId: storeResult.freeze.requestId,
    reason: storeResult.reason,
  };
};

const toProposalResult = (
  storeResult: Awaited<
    ReturnType<ReturnType<typeof createDevelopmentGovernorStore>['submitDevelopmentProposal']>
  >,
): DevelopmentProposalResult => {
  if (storeResult.accepted) {
    return {
      accepted: true,
      requestId: storeResult.proposal.requestId,
      proposalId: storeResult.proposal.proposalId,
      state: storeResult.proposal.state === 'deferred' ? 'deferred' : 'submitted',
      deduplicated: storeResult.deduplicated,
      createdAt: storeResult.proposal.createdAt,
    };
  }

  if (storeResult.reason === 'development_frozen') {
    return {
      accepted: false,
      reason: 'development_frozen',
    };
  }

  return {
    accepted: false,
    requestId: storeResult.proposal.requestId,
    reason: 'conflicting_request_id',
  };
};

const toProposalDecisionState = (
  decisionKind: DevelopmentProposalDecisionKind,
): 'approved' | 'rejected' | 'deferred' => decisionKind;

const toProposalDecisionResult = (
  storeResult: Awaited<
    ReturnType<ReturnType<typeof createDevelopmentGovernorStore>['recordProposalDecision']>
  >,
  requestId: string,
): DevelopmentProposalDecisionResult => {
  if (storeResult.accepted) {
    return {
      accepted: true,
      requestId: storeResult.decision.requestId,
      proposalId: storeResult.proposal.proposalId,
      decisionId: storeResult.decision.decisionId,
      state: toProposalDecisionState(storeResult.decision.decisionKind),
      decisionKind: storeResult.decision.decisionKind,
      deduplicated: storeResult.deduplicated,
      createdAt: storeResult.decision.createdAt,
    };
  }

  return {
    accepted: false,
    requestId,
    reason: storeResult.reason,
  };
};

const toProposalExecutionOutcomeResult = (
  storeResult: Awaited<
    ReturnType<ReturnType<typeof createDevelopmentGovernorStore>['recordProposalExecutionOutcome']>
  >,
  requestId: string,
): DevelopmentProposalExecutionOutcomeResult => {
  if (storeResult.accepted) {
    return {
      accepted: true,
      requestId: storeResult.outcome.requestId,
      proposalId: storeResult.proposal.proposalId,
      outcomeId: storeResult.outcome.outcomeId,
      state: storeResult.outcome.outcomeKind,
      outcomeKind: storeResult.outcome.outcomeKind,
      deduplicated: storeResult.deduplicated,
      createdAt: storeResult.outcome.createdAt,
    };
  }

  return {
    accepted: false,
    requestId,
    reason: storeResult.reason,
  };
};

const materializeFreezeCommand = (input: FreezeCommandMaterial) => ({
  freezeId: `development-freeze:${randomUUID()}`,
  ledgerId: `development-ledger:${randomUUID()}`,
  triggerKind: input.triggerKind,
  originSurface: input.originSurface,
  requestId: input.requestId,
  normalizedRequestHash: hashFreezeCommand(input),
  reason: input.reason,
  requestedBy: input.requestedBy,
  evidenceRefs: input.storeEvidenceRefs,
  createdAt: input.createdAt,
  payloadJson: input.payloadJson,
});

const materializeProposalCommand = (input: ProposalCommandMaterial) => ({
  proposalId: `development-proposal:${randomUUID()}`,
  ledgerId: `development-ledger:${randomUUID()}`,
  proposalKind: input.proposalKind,
  originSurface: input.originSurface,
  requestId: input.requestId,
  normalizedRequestHash: hashProposalCommand(input),
  submitterOwner: input.submitterOwner,
  problemSignature: input.problemSignature,
  summary: input.summary,
  rollbackPlanRef: input.rollbackPlanRef,
  targetRef: input.targetRef,
  evidenceRefs: input.storeEvidenceRefs,
  createdAt: input.createdAt,
  payloadJson: input.payloadJson,
});

const materializeProposalDecisionCommand = (input: ProposalDecisionCommandMaterial) => ({
  decisionId: `development-proposal-decision:${randomUUID()}`,
  ledgerId: `development-ledger:${randomUUID()}`,
  proposalId: input.proposalId,
  decisionKind: input.decisionKind,
  decisionOrigin: input.decisionOrigin,
  originSurface: input.originSurface,
  requestId: input.requestId,
  normalizedRequestHash: hashProposalDecisionCommand(input),
  rationale: input.rationale,
  evidenceRefs: input.storeEvidenceRefs,
  createdAt: input.createdAt,
  payloadJson: input.payloadJson,
});

const materializeProposalExecutionOutcomeCommand = (
  input: ProposalExecutionOutcomeCommandMaterial,
) => ({
  outcomeId: `development-proposal-outcome:${randomUUID()}`,
  ledgerId: `development-ledger:${randomUUID()}`,
  proposalId: input.proposalId,
  outcomeKind: input.outcomeKind,
  outcomeOrigin: input.outcomeOrigin,
  originSurface: input.originSurface,
  requestId: input.requestId,
  normalizedRequestHash: hashProposalExecutionOutcomeCommand(input),
  targetRef: input.targetRef,
  evidenceRefs: input.storeEvidenceRefs,
  createdAt: input.createdAt,
  payloadJson: input.payloadJson,
});

const isSupportedProposalKind = (kind: DevelopmentProposalKind): boolean =>
  Object.values(DEVELOPMENT_PROPOSAL_KIND).includes(kind);

const proposalKindForWorkshopCandidate = (
  candidateKind: WorkshopPromotionPackage['candidateKind'],
): DevelopmentProposalKind =>
  candidateKind === WORKSHOP_CANDIDATE_KIND.SHARED_ADAPTER
    ? DEVELOPMENT_PROPOSAL_KIND.MODEL_ADAPTER
    : DEVELOPMENT_PROPOSAL_KIND.SPECIALIST_MODEL;

const workshopPromotionEvidenceRefs = (
  promotionPackage: WorkshopPromotionPackage,
  packageUri: string,
): string[] =>
  uniqueSorted([
    `workshop:candidate:${promotionPackage.candidateId}`,
    `workshop:promotion-package:${packageUri}`,
    `workshop:artifact:${promotionPackage.artifactUri}`,
    promotionPackage.lastKnownGoodEvalReportUri
      ? `workshop:eval-report:${promotionPackage.lastKnownGoodEvalReportUri}`
      : '',
  ]);

export const buildWorkshopPromotionProposalCommand = (input: {
  requestId: string;
  promotionPackage: WorkshopPromotionPackage;
  packageUri: string;
  requestedAt: string;
}) => {
  const { promotionPackage } = input;
  const targetRef =
    promotionPackage.targetProfileId ?? `workshop:candidate:${promotionPackage.candidateId}`;

  return {
    requestId: input.requestId,
    proposalKind: proposalKindForWorkshopCandidate(promotionPackage.candidateKind),
    originSurface: DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.WORKSHOP,
    submitterOwner: 'F-0015',
    problemSignature: `workshop promotion package ${promotionPackage.candidateId}`,
    summary: `Review workshop promotion package ${promotionPackage.candidateId} for governor approval.`,
    rollbackPlanRef: promotionPackage.rollbackTarget,
    targetRef,
    hashEvidenceRefs: workshopPromotionEvidenceRefs(promotionPackage, input.packageUri),
    storeEvidenceRefs: workshopPromotionEvidenceRefs(promotionPackage, input.packageUri),
    createdAt: input.requestedAt,
    payloadJson: {
      handoffSource: 'workshop_promotion_package',
      candidateId: promotionPackage.candidateId,
      packageUri: input.packageUri,
      candidateKind: promotionPackage.candidateKind,
    },
  };
};

const originSurfaceForInternalProposalOwner = (
  sourceOwner: InternalGovernorProposalOwner,
): DevelopmentGovernorOriginSurface => {
  switch (sourceOwner) {
    case 'runtime':
      return DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.RUNTIME;
    case 'recovery':
      return DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.RECOVERY;
    case 'F-0015':
      return DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.WORKSHOP;
    case 'human_override':
      return DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.HUMAN_OVERRIDE;
  }
};

export const createDbBackedDevelopmentGovernorService = (
  config: Pick<CoreRuntimeConfig, 'postgresUrl'>,
  options: {
    now?: () => Date;
    perimeterDecisionService?: PerimeterDecisionService;
  } = {},
): DevelopmentGovernorService => {
  const now = options.now ?? (() => new Date());
  const perimeterDecisionService =
    options.perimeterDecisionService ?? createDbBackedPerimeterDecisionService(config);

  const runFreeze = async (command: FreezeCommandMaterial): Promise<DevelopmentFreezeResult> =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createDevelopmentGovernorStore(client);
      const result = await store.freezeDevelopment(materializeFreezeCommand(command));
      return toFreezeResult(result);
    });

  const runProposal = async (
    command: ProposalCommandMaterial,
  ): Promise<DevelopmentProposalResult> =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createDevelopmentGovernorStore(client);
      const result = await store.submitDevelopmentProposal(materializeProposalCommand(command));
      return toProposalResult(result);
    });

  const runProposalDecision = async (
    command: ProposalDecisionCommandMaterial,
  ): Promise<DevelopmentProposalDecisionResult> =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createDevelopmentGovernorStore(client);
      const result = await store.recordProposalDecision(
        materializeProposalDecisionCommand(command),
      );
      return toProposalDecisionResult(result, command.requestId);
    });

  const runProposalExecutionOutcome = async (
    command: ProposalExecutionOutcomeCommandMaterial,
  ): Promise<DevelopmentProposalExecutionOutcomeResult> =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createDevelopmentGovernorStore(client);
      const result = await store.recordProposalExecutionOutcome(
        materializeProposalExecutionOutcomeCommand(command),
      );
      return toProposalExecutionOutcomeResult(result, command.requestId);
    });

  const gateFreezeRequest = async (input: {
    requestId: string;
    ingressOwner:
      | typeof PERIMETER_INGRESS_OWNER.F_0013
      | typeof PERIMETER_INGRESS_OWNER.PLATFORM_RUNTIME;
    evidenceRefs: string[];
  }): Promise<DevelopmentFreezeResult | null> => {
    const result = await perimeterDecisionService.evaluateControlRequest({
      requestId: input.requestId,
      ingressOwner: input.ingressOwner,
      actionClass: PERIMETER_ACTION_CLASS.FREEZE_DEVELOPMENT,
      authorityOwner: PERIMETER_AUTHORITY_OWNER.TRUSTED_INGRESS,
      evidenceRefs: input.evidenceRefs,
    });

    if (!result.accepted) {
      return {
        accepted: false,
        requestId: input.requestId,
        reason: 'persistence_unavailable',
      };
    }

    if (result.verdict !== PERIMETER_VERDICT.ALLOW) {
      return {
        accepted: false,
        requestId: input.requestId,
        reason: 'invalid_request',
      };
    }

    return null;
  };

  const gateProposalRequest = async (input: {
    requestId: string;
    ingressOwner: typeof PERIMETER_INGRESS_OWNER.F_0013 | typeof PERIMETER_INGRESS_OWNER.F_0016;
    evidenceRefs: string[];
    targetRef: string | null;
  }): Promise<DevelopmentProposalResult | null> => {
    const result = await perimeterDecisionService.evaluateControlRequest({
      requestId: input.requestId,
      ingressOwner: input.ingressOwner,
      actionClass: PERIMETER_ACTION_CLASS.CODE_OR_PROMOTION_CHANGE,
      authorityOwner: PERIMETER_AUTHORITY_OWNER.TRUSTED_INGRESS,
      ...(input.targetRef ? { targetRef: input.targetRef } : {}),
      evidenceRefs: input.evidenceRefs,
    });

    if (!result.accepted) {
      return {
        accepted: false,
        requestId: input.requestId,
        reason: 'persistence_unavailable',
      };
    }

    if (result.verdict !== PERIMETER_VERDICT.ALLOW) {
      return {
        accepted: false,
        requestId: input.requestId,
        reason: 'insufficient_evidence',
      };
    }

    return null;
  };

  return {
    freezeDevelopment: async (input) => {
      const createdAt = input.requestedAt ?? now().toISOString();
      const evidenceRefs = uniqueSorted(input.evidenceRefs);
      const gatedResult = await gateFreezeRequest({
        requestId: input.requestId,
        ingressOwner:
          input.requestedBy === 'operator_api'
            ? PERIMETER_INGRESS_OWNER.F_0013
            : PERIMETER_INGRESS_OWNER.PLATFORM_RUNTIME,
        evidenceRefs,
      });
      if (gatedResult) {
        return gatedResult;
      }

      return await runFreeze({
        requestId: input.requestId,
        triggerKind: DEVELOPMENT_FREEZE_TRIGGER_KIND.OPERATOR,
        originSurface: DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.OPERATOR_API,
        requestedBy: input.requestedBy,
        reason: input.reason,
        hashEvidenceRefs: evidenceRefs,
        storeEvidenceRefs: evidenceRefs,
        createdAt,
        payloadJson: {
          route: '/control/freeze-development',
        },
      });
    },

    submitDevelopmentProposal: async (input) => {
      if (!isSupportedProposalKind(input.proposalKind)) {
        return Promise.resolve({
          accepted: false,
          requestId: input.requestId,
          reason: 'unsupported_proposal_kind',
        });
      }

      const evidenceRefs = uniqueSorted(input.evidenceRefs);
      if (evidenceRefs.length === 0 || !input.rollbackPlanRef) {
        return Promise.resolve({
          accepted: false,
          requestId: input.requestId,
          reason: 'insufficient_evidence',
        });
      }

      const createdAt = input.requestedAt ?? now().toISOString();
      const gatedResult = await gateProposalRequest({
        requestId: input.requestId,
        ingressOwner: PERIMETER_INGRESS_OWNER.F_0013,
        evidenceRefs,
        targetRef: input.targetRef,
      });
      if (gatedResult) {
        return gatedResult;
      }

      return await runProposal({
        requestId: input.requestId,
        proposalKind: input.proposalKind,
        originSurface: DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.OPERATOR_API,
        submitterOwner: 'operator_api',
        problemSignature: input.problemSignature,
        summary: input.summary,
        rollbackPlanRef: input.rollbackPlanRef,
        targetRef: input.targetRef,
        hashEvidenceRefs: evidenceRefs,
        storeEvidenceRefs: evidenceRefs,
        createdAt,
        payloadJson: {
          route: '/control/development-proposals',
          rollbackPlanRef: input.rollbackPlanRef,
          ...(input.targetRef ? { targetRef: input.targetRef } : {}),
        },
      });
    },

    submitInternalDevelopmentProposal: async (input) => {
      if (!isSupportedProposalKind(input.proposalKind)) {
        return Promise.resolve({
          accepted: false,
          requestId: input.requestId,
          reason: 'unsupported_proposal_kind',
        });
      }

      const evidenceRefs = uniqueSorted(input.evidenceRefs);
      if (evidenceRefs.length === 0 || !input.rollbackPlanRef) {
        return Promise.resolve({
          accepted: false,
          requestId: input.requestId,
          reason: 'insufficient_evidence',
        });
      }

      const createdAt = input.requestedAt ?? now().toISOString();
      const originSurface = originSurfaceForInternalProposalOwner(input.sourceOwner);
      const gatedResult = await gateProposalRequest({
        requestId: input.requestId,
        ingressOwner: PERIMETER_INGRESS_OWNER.F_0016,
        evidenceRefs,
        targetRef: input.targetRef,
      });
      if (gatedResult) {
        return gatedResult;
      }

      return await runProposal({
        requestId: input.requestId,
        proposalKind: input.proposalKind,
        originSurface,
        submitterOwner: input.sourceOwner,
        problemSignature: input.problemSignature,
        summary: input.summary,
        rollbackPlanRef: input.rollbackPlanRef,
        targetRef: input.targetRef,
        hashEvidenceRefs: evidenceRefs,
        storeEvidenceRefs: evidenceRefs,
        createdAt,
        payloadJson: {
          internalSourceOwner: input.sourceOwner,
          rollbackPlanRef: input.rollbackPlanRef,
          ...(input.targetRef ? { targetRef: input.targetRef } : {}),
          ...(input.payload ?? {}),
        },
      });
    },

    recordProposalDecision: (input) => {
      const evidenceRefs = uniqueSorted(input.evidenceRefs);
      if (evidenceRefs.length === 0) {
        return Promise.resolve({
          accepted: false,
          requestId: input.requestId,
          reason: 'invalid_request',
        });
      }

      const createdAt = input.decidedAt ?? now().toISOString();
      return runProposalDecision({
        requestId: input.requestId,
        proposalId: input.proposalId,
        decisionKind: input.decisionKind,
        decisionOrigin: input.decisionOrigin,
        originSurface: input.decisionOrigin,
        rationale: input.rationale,
        hashEvidenceRefs: evidenceRefs,
        storeEvidenceRefs: evidenceRefs,
        createdAt,
        payloadJson: {
          advisoryOnly: true,
          executionBoundary: 'downstream_owner',
        },
      });
    },

    recordProposalExecutionOutcome: (input) => {
      const evidenceRefs = uniqueSorted(input.evidenceRefs);
      if (evidenceRefs.length === 0 || input.targetRef.trim().length === 0) {
        return Promise.resolve({
          accepted: false,
          requestId: input.requestId,
          reason: 'insufficient_evidence',
        });
      }

      const createdAt = input.recordedAt ?? now().toISOString();
      return runProposalExecutionOutcome({
        requestId: input.requestId,
        proposalId: input.proposalId,
        outcomeKind: input.outcomeKind,
        outcomeOrigin: input.outcomeOrigin,
        originSurface: input.outcomeOrigin,
        targetRef: input.targetRef,
        hashEvidenceRefs: evidenceRefs,
        storeEvidenceRefs: evidenceRefs,
        createdAt,
        payloadJson: {
          evidenceOnly: true,
          executionBoundary: 'downstream_owner',
          targetRef: input.targetRef,
        },
      });
    },

    submitWorkshopPromotionProposal: async (input) => {
      if (!input.promotionPackage.rollbackTarget) {
        return Promise.resolve({
          accepted: false,
          requestId: input.requestId,
          reason: 'insufficient_evidence',
        });
      }

      const createdAt = input.requestedAt ?? now().toISOString();
      const command = buildWorkshopPromotionProposalCommand({
        requestId: input.requestId,
        promotionPackage: input.promotionPackage,
        packageUri: input.packageUri,
        requestedAt: createdAt,
      });
      const gatedResult = await gateProposalRequest({
        requestId: input.requestId,
        ingressOwner: PERIMETER_INGRESS_OWNER.F_0016,
        evidenceRefs: command.storeEvidenceRefs,
        targetRef: command.targetRef,
      });
      if (gatedResult) {
        return gatedResult;
      }

      return await runProposal(command);
    },

    applyHomeostatReaction: async (request) => {
      if (
        request.signalFamily !== HOMEOSTAT_SIGNAL_FAMILY.DEVELOPMENT_PROPOSAL_RATE ||
        request.severity !== HOMEOSTAT_ALERT_SEVERITY.CRITICAL ||
        request.requestedActionKind !== HOMEOSTAT_REQUESTED_ACTION_KIND.FREEZE_DEVELOPMENT_PROPOSALS
      ) {
        return Promise.resolve({
          accepted: false,
          requestId: request.reactionRequestId,
          reason: 'unsupported_reaction',
        });
      }

      const hashEvidenceRefs = uniqueSorted(request.evidenceRefs);
      const storeEvidenceRefs = uniqueSorted([
        ...request.evidenceRefs,
        `homeostat:snapshot:${request.snapshotId}`,
        `homeostat:reaction:${request.reactionRequestId}`,
      ]);
      const gatedResult = await gateFreezeRequest({
        requestId: `homeostat:${request.idempotencyKey}`,
        ingressOwner: PERIMETER_INGRESS_OWNER.PLATFORM_RUNTIME,
        evidenceRefs: storeEvidenceRefs,
      });
      if (gatedResult) {
        return gatedResult;
      }

      return await runFreeze({
        requestId: `homeostat:${request.idempotencyKey}`,
        triggerKind: DEVELOPMENT_FREEZE_TRIGGER_KIND.POLICY_AUTO,
        originSurface: DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.HOMEOSTAT,
        requestedBy: 'homeostat',
        reason: 'critical development_proposal_rate requested development proposal freeze',
        hashEvidenceRefs,
        storeEvidenceRefs,
        createdAt: request.createdAt,
        payloadJson: {
          expiresAt: request.expiresAt,
          reactionRequestId: request.reactionRequestId,
          signalFamily: request.signalFamily,
          snapshotId: request.snapshotId,
        },
      });
    },

    recoverActiveFreeze: () =>
      withRuntimeClient(config.postgresUrl, async (client) => {
        const store = createDevelopmentGovernorStore(client);
        const activeFreeze = await store.loadActiveFreeze();
        if (activeFreeze) {
          await setRuntimeDevelopmentFreeze(client, true);
        }

        return { activeFreeze };
      }),

    loadActiveFreeze: () =>
      withRuntimeClient(config.postgresUrl, async (client) => {
        const store = createDevelopmentGovernorStore(client);
        return await store.loadActiveFreeze();
      }),
  };
};
