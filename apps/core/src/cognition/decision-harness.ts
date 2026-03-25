import {
  type DecisionContext,
  type NarrativeMemeticOutputs,
  tickDecisionV1Schema,
  type DecisionResult,
  type DecisionMode,
  type DecisionRole,
  type TickDecisionV1,
} from '@yaagi/contracts/cognition';
import type { PerceptionBatch } from '@yaagi/contracts/perception';
import type { RuntimeEpisodeRow, SubjectStateSnapshot } from '@yaagi/db';
import { buildDecisionContext, type DecisionContextLimits } from './context-builder.ts';

export type DecisionHarnessSelectedProfile = {
  modelProfileId: string;
  role: DecisionRole;
  endpoint: string;
  adapterOf: string | null;
  eligibility?: 'eligible' | 'profile_unavailable' | 'profile_unhealthy';
};

export type DecisionAgentInvoker = (input: {
  context: DecisionContext;
  selectedProfile: DecisionHarnessSelectedProfile;
}) => Promise<unknown>;

export type DecisionHarnessInput = {
  tickId: string;
  decisionMode: DecisionMode;
  selectedProfile?: DecisionHarnessSelectedProfile | null;
  subjectStateSnapshot: SubjectStateSnapshot;
  recentEpisodes: RuntimeEpisodeRow[];
  perceptionBatch?: PerceptionBatch;
  narrativeMemeticOutputs?: NarrativeMemeticOutputs;
  narrativeMemeticMeta?: {
    truncated: boolean;
    sourceIds: string[];
    conflictMarkers: string[];
  };
  requiredSubjectStateSchemaVersion?: string;
};

export type DecisionHarness = {
  run(input: DecisionHarnessInput): Promise<DecisionResult>;
};

const refusal = (
  reason: Extract<DecisionResult, { accepted: false }>['reason'],
  detail: string,
): DecisionResult => ({
  accepted: false,
  reason,
  detail,
});

const toSchemaErrorDetail = (error: unknown): string => {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return 'decision agent did not return a valid TickDecisionV1 payload';
};

export function createDecisionHarness(options: {
  invokeAgent: DecisionAgentInvoker;
  limits?: Partial<DecisionContextLimits>;
}): DecisionHarness {
  return {
    async run(input: DecisionHarnessInput): Promise<DecisionResult> {
      const selectedProfile = input.selectedProfile;
      if (!selectedProfile) {
        return refusal(
          'selected_profile_missing',
          'the runtime did not hand a selected baseline profile to the decision harness',
        );
      }

      if (selectedProfile.eligibility && selectedProfile.eligibility !== 'eligible') {
        return refusal(
          'selected_profile_ineligible',
          `selected profile ${selectedProfile.modelProfileId} is ${selectedProfile.eligibility}`,
        );
      }

      const contextResult = buildDecisionContext({
        tickId: input.tickId,
        decisionMode: input.decisionMode,
        selectedModelProfileId: selectedProfile.modelProfileId,
        selectedRole: selectedProfile.role,
        subjectStateSnapshot: input.subjectStateSnapshot,
        recentEpisodes: input.recentEpisodes,
        ...(input.perceptionBatch ? { perceptionBatch: input.perceptionBatch } : {}),
        ...(input.narrativeMemeticOutputs
          ? { narrativeMemeticOutputs: input.narrativeMemeticOutputs }
          : {}),
        ...(input.narrativeMemeticMeta ? { narrativeMemeticMeta: input.narrativeMemeticMeta } : {}),
        ...(input.requiredSubjectStateSchemaVersion
          ? { requiredSubjectStateSchemaVersion: input.requiredSubjectStateSchemaVersion }
          : {}),
        ...(options.limits ? { limits: options.limits } : {}),
      });

      if (!contextResult.accepted) {
        return contextResult.refusal;
      }

      let rawDecision: unknown;
      try {
        rawDecision = await options.invokeAgent({
          context: contextResult.context,
          selectedProfile,
        });
      } catch (error) {
        return refusal(
          'decision_schema_invalid',
          `decision agent call failed: ${toSchemaErrorDetail(error)}`,
        );
      }

      let decision: TickDecisionV1;
      try {
        decision = tickDecisionV1Schema.parse(rawDecision);
      } catch (error) {
        return refusal('decision_schema_invalid', toSchemaErrorDetail(error));
      }

      return {
        accepted: true,
        decision,
      };
    },
  };
}
