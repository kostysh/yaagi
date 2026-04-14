import { createHash, randomUUID } from 'node:crypto';
import {
  BODY_CHANGE_REQUESTED_BY_OWNER,
  type BodyChangeRequestedByOwner,
} from '@yaagi/contracts/body-evolution';
import { DEVELOPMENT_PROPOSAL_DECISION_KIND } from '@yaagi/contracts/governor';
import {
  PERIMETER_ACTION_CLASS,
  PERIMETER_DECISION_REASON,
  PERIMETER_VERDICT,
  perimeterControlRequestSchema,
  type PerimeterControlRequest,
  type PerimeterDecisionReason,
  type PerimeterDecisionResult,
  type PerimeterVerdict,
  type SafetyKernel,
} from '@yaagi/contracts/perimeter';
import {
  createBodyEvolutionStore,
  createDevelopmentGovernorStore,
  createPerimeterStore,
  createRuntimeDbClient,
  type BodyEvolutionDbExecutor,
  type DevelopmentGovernorDbExecutor,
  type PerimeterStore,
} from '@yaagi/db';
import type { CoreRuntimeConfig } from '../platform/core-config.ts';
import { F0018_SAFETY_KERNEL } from './safety-kernel.ts';

type PerimeterDecisionPayload = {
  policyFamily: 'forbiddenActions' | 'promotionChangeGates';
  authorityValidated: boolean;
  explicitUnavailable?: boolean;
};

export type PerimeterDecisionService = {
  evaluateControlRequest(input: PerimeterControlRequest): Promise<PerimeterDecisionResult>;
};

type AuthorityValidationSuccess = {
  accepted: true;
};

type AuthorityValidationFailure = {
  accepted: false;
  decisionReason:
    | typeof PERIMETER_DECISION_REASON.GOVERNOR_AUTHORITY_MISSING
    | typeof PERIMETER_DECISION_REASON.HUMAN_OVERRIDE_EVIDENCE_MISSING;
};

type AuthorityValidationResult = AuthorityValidationSuccess | AuthorityValidationFailure;

type PerimeterAuthorityValidator = {
  validate(input: PerimeterControlRequest): Promise<AuthorityValidationResult>;
};

type PerimeterDecisionServiceOptions = {
  store: Pick<PerimeterStore, 'recordDecision'>;
  safetyKernel?: SafetyKernel;
  authorityValidator?: PerimeterAuthorityValidator;
  now?: () => Date;
  createDecisionId?: () => string;
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

const hashRequest = (input: PerimeterControlRequest): string =>
  createHash('sha256')
    .update(
      stableJson({
        requestId: input.requestId,
        ingressOwner: input.ingressOwner,
        actionClass: input.actionClass,
        authorityOwner: input.authorityOwner,
        governorProposalId: 'governorProposalId' in input ? input.governorProposalId : null,
        governorDecisionRef: 'governorDecisionRef' in input ? input.governorDecisionRef : null,
        humanOverrideEvidenceRef:
          'humanOverrideEvidenceRef' in input ? input.humanOverrideEvidenceRef : null,
        targetRef: input.targetRef ?? null,
        evidenceRefs: uniqueSorted(input.evidenceRefs),
      }),
    )
    .digest('hex');

const evaluateRequestAgainstKernel = (
  safetyKernel: SafetyKernel,
  input: PerimeterControlRequest,
): {
  verdict: PerimeterVerdict;
  decisionReason: PerimeterDecisionReason;
  payload: PerimeterDecisionPayload;
} => {
  if (safetyKernel.forbiddenActions.explicitUnavailableActionClasses.includes(input.actionClass)) {
    const decisionReason =
      input.actionClass === PERIMETER_ACTION_CLASS.FORCE_ROLLBACK
        ? PERIMETER_DECISION_REASON.DOWNSTREAM_OWNER_REQUIRED
        : PERIMETER_DECISION_REASON.EXPLICIT_UNAVAILABLE;

    return {
      verdict: PERIMETER_VERDICT.REQUIRE_HUMAN_REVIEW,
      decisionReason,
      payload: {
        policyFamily: 'forbiddenActions',
        authorityValidated: false,
        explicitUnavailable: true,
      },
    };
  }

  const actionPolicy = safetyKernel.promotionChangeGates.actionPolicies[input.actionClass];
  if (!actionPolicy?.allowedIngressOwners.includes(input.ingressOwner)) {
    return {
      verdict: PERIMETER_VERDICT.DENY,
      decisionReason: PERIMETER_DECISION_REASON.TRUSTED_INGRESS_MISSING,
      payload: {
        policyFamily: 'promotionChangeGates',
        authorityValidated: false,
      },
    };
  }

  if (!actionPolicy.allowedAuthorityOwners.includes(input.authorityOwner)) {
    return {
      verdict: PERIMETER_VERDICT.DENY,
      decisionReason:
        input.authorityOwner === 'governor'
          ? PERIMETER_DECISION_REASON.GOVERNOR_AUTHORITY_MISSING
          : PERIMETER_DECISION_REASON.HUMAN_OVERRIDE_EVIDENCE_MISSING,
      payload: {
        policyFamily: 'promotionChangeGates',
        authorityValidated: false,
      },
    };
  }

  if (input.authorityOwner === 'governor') {
    if (!input.governorProposalId || !input.governorDecisionRef) {
      return {
        verdict: PERIMETER_VERDICT.DENY,
        decisionReason: PERIMETER_DECISION_REASON.GOVERNOR_AUTHORITY_MISSING,
        payload: {
          policyFamily: 'promotionChangeGates',
          authorityValidated: false,
        },
      };
    }
  } else if (!input.humanOverrideEvidenceRef) {
    return {
      verdict: PERIMETER_VERDICT.DENY,
      decisionReason: PERIMETER_DECISION_REASON.HUMAN_OVERRIDE_EVIDENCE_MISSING,
      payload: {
        policyFamily: 'promotionChangeGates',
        authorityValidated: false,
      },
    };
  }

  return {
    verdict: PERIMETER_VERDICT.ALLOW,
    decisionReason: PERIMETER_DECISION_REASON.VERIFIED_AUTHORITY,
    payload: {
      policyFamily: 'promotionChangeGates',
      authorityValidated: true,
    },
  };
};

const createPassThroughAuthorityValidator = (): PerimeterAuthorityValidator => ({
  validate(): Promise<AuthorityValidationResult> {
    return Promise.resolve({
      accepted: true,
    });
  },
});

type PerimeterAuthorityValidatorDb = Pick<DevelopmentGovernorDbExecutor, 'query'> &
  Pick<BodyEvolutionDbExecutor, 'query'>;

const createDbBackedPerimeterAuthorityValidator = (
  db: PerimeterAuthorityValidatorDb,
): PerimeterAuthorityValidator => {
  const developmentGovernorStore = createDevelopmentGovernorStore(db);
  const bodyEvolutionStore = createBodyEvolutionStore(db);

  return {
    async validate(input: PerimeterControlRequest): Promise<AuthorityValidationResult> {
      if (input.authorityOwner === 'governor') {
        const decision = await developmentGovernorStore.getProposalDecision(
          input.governorDecisionRef,
        );
        if (
          !decision ||
          decision.proposalId !== input.governorProposalId ||
          decision.decisionKind !== DEVELOPMENT_PROPOSAL_DECISION_KIND.APPROVED
        ) {
          return {
            accepted: false,
            decisionReason: PERIMETER_DECISION_REASON.GOVERNOR_AUTHORITY_MISSING,
          };
        }

        return {
          accepted: true,
        };
      }

      const proposal = await bodyEvolutionStore.getProposalByOwnerOverrideEvidenceRef(
        input.humanOverrideEvidenceRef,
      );
      if (!proposal || proposal.requestedByOwner !== humanOverrideRequestedByOwner) {
        return {
          accepted: false,
          decisionReason: PERIMETER_DECISION_REASON.HUMAN_OVERRIDE_EVIDENCE_MISSING,
        };
      }

      return {
        accepted: true,
      };
    },
  };
};

const humanOverrideRequestedByOwner: BodyChangeRequestedByOwner =
  BODY_CHANGE_REQUESTED_BY_OWNER.HUMAN_OVERRIDE;

export function createPerimeterDecisionService(
  options: PerimeterDecisionServiceOptions,
): PerimeterDecisionService {
  const safetyKernel = options.safetyKernel ?? F0018_SAFETY_KERNEL;
  const authorityValidator = options.authorityValidator ?? createPassThroughAuthorityValidator();
  const now = options.now ?? (() => new Date());
  const createDecisionId = options.createDecisionId ?? (() => `perimeter-decision:${randomUUID()}`);

  return {
    async evaluateControlRequest(
      rawInput: PerimeterControlRequest,
    ): Promise<PerimeterDecisionResult> {
      const input = perimeterControlRequestSchema.parse(rawInput);
      const evaluation = evaluateRequestAgainstKernel(safetyKernel, input);
      const evidenceRefs = uniqueSorted(input.evidenceRefs);

      if (evaluation.verdict === PERIMETER_VERDICT.ALLOW) {
        const authorityValidation = await authorityValidator.validate(input);
        if (!authorityValidation.accepted) {
          evaluation.verdict = PERIMETER_VERDICT.DENY;
          evaluation.decisionReason = authorityValidation.decisionReason;
          evaluation.payload.authorityValidated = false;
        }
      }

      try {
        const result = await options.store.recordDecision({
          decisionId: createDecisionId(),
          requestId: input.requestId,
          normalizedRequestHash: hashRequest({
            ...input,
            evidenceRefs,
          }),
          actionClass: input.actionClass,
          ingressOwner: input.ingressOwner,
          authorityOwner: input.authorityOwner,
          governorProposalId: input.authorityOwner === 'governor' ? input.governorProposalId : null,
          governorDecisionRef:
            input.authorityOwner === 'governor' ? input.governorDecisionRef : null,
          humanOverrideEvidenceRef:
            input.authorityOwner === 'human_override' ? input.humanOverrideEvidenceRef : null,
          targetRef: input.targetRef ?? null,
          evidenceRefs,
          verdict: evaluation.verdict,
          decisionReason: evaluation.decisionReason,
          policyVersion: safetyKernel.version,
          payloadJson: evaluation.payload,
          createdAt: now().toISOString(),
        });

        if (!result.accepted) {
          return {
            accepted: false,
            requestId: input.requestId,
            reason: result.reason,
          };
        }

        return {
          accepted: true,
          requestId: result.decision.requestId,
          decisionId: result.decision.decisionId,
          actionClass: result.decision.actionClass,
          verdict: result.decision.verdict,
          decisionReason: result.decision.decisionReason,
          deduplicated: result.deduplicated,
          createdAt: result.decision.createdAt,
        };
      } catch {
        return {
          accepted: false,
          requestId: input.requestId,
          reason: 'persistence_unavailable',
        };
      }
    },
  };
}

export const createDbBackedPerimeterDecisionService = (
  config: Pick<CoreRuntimeConfig, 'postgresUrl'>,
  options: Omit<PerimeterDecisionServiceOptions, 'store'> = {},
): PerimeterDecisionService => {
  const authorityValidator: PerimeterAuthorityValidator = {
    async validate(input) {
      const client = createRuntimeDbClient(config.postgresUrl);
      await client.connect();

      try {
        return await createDbBackedPerimeterAuthorityValidator(client).validate(input);
      } finally {
        await client.end();
      }
    },
  };

  const store: Pick<PerimeterStore, 'recordDecision'> = {
    async recordDecision(input) {
      const client = createRuntimeDbClient(config.postgresUrl);
      await client.connect();

      try {
        return await createPerimeterStore(client).recordDecision(input);
      } finally {
        await client.end();
      }
    },
  };

  return createPerimeterDecisionService({
    ...options,
    authorityValidator: options.authorityValidator ?? authorityValidator,
    store,
  });
};
