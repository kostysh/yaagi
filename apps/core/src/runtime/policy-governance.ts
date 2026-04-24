import { createHash, randomUUID } from 'node:crypto';
import {
  CONSULTANT_ADMISSION_DECISION,
  CONSULTANT_KIND,
  PERCEPTION_POLICY_OUTCOME,
  PHASE6_GOVERNANCE_EVENT_KIND,
  POLICY_ACTIVATION_DECISION,
  POLICY_GOVERNANCE_SCOPE,
  POLICY_PROFILE_STATUS,
  POLICY_REFUSAL_REASON,
  type ConsultantAdmissionDecisionRow,
  type ConsultantKind,
  type PerceptionPolicyDecisionRow,
  type Phase6GovernanceEventRow,
  type PolicyGovernanceScope,
  type PolicyProfileActivationRow,
  type PolicyProfileRow,
  type PolicyRefusalReason,
  type StructuredPolicyRefusal,
} from '@yaagi/contracts/policy-governance';
import type { StimulusInboxRecord } from '@yaagi/contracts/perception';
import {
  CONSERVATIVE_BASELINE_POLICY_PROFILE,
  createPolicyGovernanceStore,
  createRuntimeDbClient,
  type PolicyGovernanceStore,
} from '@yaagi/db';
import type { CoreRuntimeConfig } from '../platform/core-config.ts';

const SUPPORTED_CONSULTANT_KINDS = new Set<string>([CONSULTANT_KIND.EXTERNAL_LLM]);

export type PolicyEvidenceBundle = {
  callerAdmissionRef?: string | null;
  governorDecisionRef?: string | null;
  perimeterDecisionRef?: string | null;
  reportingEvidenceRefs?: string[];
  additionalEvidenceRefs?: string[];
  observedAt?: string | null;
};

export type PolicyActivationServiceInput = {
  requestId: string;
  profileId: string;
  profileVersion: string;
  scope: PolicyGovernanceScope;
  actorRef: string | null;
  evidence: PolicyEvidenceBundle;
  requestedAt: string;
};

export type PolicyActivationServiceResult =
  | {
      accepted: true;
      activation: PolicyProfileActivationRow;
      profile: PolicyProfileRow;
      auditPersisted: true;
    }
  | {
      accepted: false;
      activation: PolicyProfileActivationRow | null;
      profile: PolicyProfileRow | null;
      refusal: StructuredPolicyRefusal;
      auditPersisted: boolean;
    };

export type ConsultantHealthInput = {
  status: 'healthy' | 'degraded' | 'unavailable';
  healthRef: string | null;
};

export type ConsultantAdmissionInput = {
  requestId: string;
  consultantKind: string;
  targetScope: string;
  selectedModelProfileId: string | null;
  explicitAdmissionRef: string | null;
  health: ConsultantHealthInput;
  evidence: PolicyEvidenceBundle;
  requestedAt: string;
};

export type ConsultantAdmissionResult =
  | {
      accepted: true;
      decision: ConsultantAdmissionDecisionRow;
      profile: PolicyProfileRow;
      auditPersisted: true;
    }
  | {
      accepted: false;
      decision: ConsultantAdmissionDecisionRow | null;
      profile: PolicyProfileRow | null;
      refusal: StructuredPolicyRefusal;
      auditPersisted: boolean;
    };

export type ConsultantExecutionResult<T> =
  | {
      accepted: true;
      consultantInvoked: true;
      admission: ConsultantAdmissionResult & { accepted: true };
      result: T;
    }
  | {
      accepted: false;
      consultantInvoked: false;
      admission: ConsultantAdmissionResult;
    };

export type PerceptionPolicyEnforcementInput = {
  stimulus: StimulusInboxRecord;
  requestedAt: string;
};

export type PolicyGovernanceService = {
  ensureConservativeBaselinePolicyProfile(): Promise<PolicyProfileRow>;
  activatePolicyProfile(
    input: PolicyActivationServiceInput,
  ): Promise<PolicyActivationServiceResult>;
  admitConsultant(input: ConsultantAdmissionInput): Promise<ConsultantAdmissionResult>;
  executeExternalConsultant<T>(
    input: ConsultantAdmissionInput,
    invokeConsultant: () => Promise<T>,
  ): Promise<ConsultantExecutionResult<T>>;
  enforcePerceptionPolicy(
    input: PerceptionPolicyEnforcementInput,
  ): Promise<PerceptionPolicyDecisionRow>;
  recordGovernanceEvent(input: {
    eventKind: Phase6GovernanceEventRow['eventKind'];
    sourceRef: string;
    profileId: string | null;
    profileVersion: string | null;
    decisionRef: string | null;
    payloadJson?: Record<string, unknown>;
    createdAt: string;
  }): Promise<Phase6GovernanceEventRow>;
  listPhase6GovernanceEvents(input?: { limit?: number }): Promise<Phase6GovernanceEventRow[]>;
};

type PolicyGovernanceServiceOptions = {
  store: Pick<
    PolicyGovernanceStore,
    | 'getPolicyProfile'
    | 'listPhase6GovernanceEvents'
    | 'recordConsultantAdmissionDecision'
    | 'recordPerceptionPolicyDecision'
    | 'recordPhase6GovernanceEvent'
    | 'recordPolicyActivation'
    | 'recordPolicyProfile'
    | 'resolveActivePolicyActivation'
  >;
  now?: () => string;
  createId?: () => string;
};

const stableJson = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
};

const normalizedHash = (value: unknown): string =>
  createHash('sha256').update(stableJson(value)).digest('hex');

const policyProfileRef = (
  profile: Pick<PolicyProfileRow, 'profileId' | 'profileVersion'> | null,
) => (profile ? `${profile.profileId}@${profile.profileVersion}` : null);

const evidenceRefs = (evidence: PolicyEvidenceBundle): string[] =>
  [
    evidence.callerAdmissionRef,
    evidence.governorDecisionRef,
    evidence.perimeterDecisionRef,
    ...(evidence.reportingEvidenceRefs ?? []),
    ...(evidence.additionalEvidenceRefs ?? []),
  ].filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);

const buildRefusal = (input: {
  reason: PolicyRefusalReason;
  targetPath: string;
  profile: PolicyProfileRow | null;
  evidence: PolicyEvidenceBundle;
  detail: string;
}): StructuredPolicyRefusal => ({
  reason: input.reason,
  targetPath: input.targetPath,
  policyProfileRef: policyProfileRef(input.profile),
  evidenceRefs: evidenceRefs(input.evidence),
  detail: input.detail,
});

const evaluateEvidence = (
  profile: PolicyProfileRow,
  evidence: PolicyEvidenceBundle,
  now: string,
): PolicyRefusalReason | null => {
  const requirements = profile.activationRequirementsJson;
  if (requirements.callerAdmissionEvidence && !evidence.callerAdmissionRef) {
    return POLICY_REFUSAL_REASON.CALLER_EVIDENCE_MISSING;
  }
  if (requirements.governorEvidence && !evidence.governorDecisionRef) {
    return POLICY_REFUSAL_REASON.GOVERNOR_EVIDENCE_MISSING;
  }
  if (requirements.perimeterEvidence && !evidence.perimeterDecisionRef) {
    return POLICY_REFUSAL_REASON.PERIMETER_EVIDENCE_MISSING;
  }
  if (requirements.reportingEvidence && (evidence.reportingEvidenceRefs ?? []).length === 0) {
    return POLICY_REFUSAL_REASON.REPORTING_EVIDENCE_MISSING;
  }
  if (requirements.maxEvidenceAgeMs && evidence.observedAt) {
    const ageMs = Date.parse(now) - Date.parse(evidence.observedAt);
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > requirements.maxEvidenceAgeMs) {
      return POLICY_REFUSAL_REASON.STALE_EVIDENCE;
    }
  }

  return null;
};

export function createPolicyGovernanceService(
  options: PolicyGovernanceServiceOptions,
): PolicyGovernanceService {
  const now = options.now ?? (() => new Date().toISOString());
  const createId = options.createId ?? (() => `policy-governance:${randomUUID()}`);

  const recordActivationRefusal = async (input: {
    requestId: string;
    profileId: string;
    profileVersion: string;
    scope: PolicyGovernanceScope;
    actorRef: string | null;
    evidence: PolicyEvidenceBundle;
    requestedAt: string;
    reason: PolicyRefusalReason;
  }): Promise<PolicyProfileActivationRow | null> => {
    const result = await options.store.recordPolicyActivation({
      activationId: createId(),
      requestId: input.requestId,
      normalizedRequestHash: normalizedHash({
        profileId: input.profileId,
        profileVersion: input.profileVersion,
        scope: input.scope,
        reason: input.reason,
        evidenceRefs: evidenceRefs(input.evidence),
      }),
      profileId: input.profileId,
      profileVersion: input.profileVersion,
      scope: input.scope,
      decision: POLICY_ACTIVATION_DECISION.REFUSE,
      reasonCode: input.reason,
      actorRef: input.actorRef,
      evidenceRefs: evidenceRefs(input.evidence),
      activatedAt: null,
      deactivatedAt: null,
      createdAt: input.requestedAt,
    });

    return result.activation;
  };

  const recordConsultantDecision = async (input: {
    admission: ConsultantAdmissionInput;
    profile: PolicyProfileRow | null;
    decision:
      | typeof CONSULTANT_ADMISSION_DECISION.ALLOW
      | typeof CONSULTANT_ADMISSION_DECISION.REFUSAL;
    reason: ConsultantAdmissionDecisionRow['reasonCode'];
    payloadJson?: Record<string, unknown>;
  }): Promise<ConsultantAdmissionDecisionRow> => {
    const result = await options.store.recordConsultantAdmissionDecision({
      decisionId: createId(),
      requestId: input.admission.requestId,
      normalizedRequestHash: normalizedHash({
        consultantKind: input.admission.consultantKind,
        targetScope: input.admission.targetScope,
        selectedModelProfileId: input.admission.selectedModelProfileId,
        explicitAdmissionRef: input.admission.explicitAdmissionRef,
        health: input.admission.health,
        evidenceRefs: evidenceRefs(input.admission.evidence),
        decision: input.decision,
        reason: input.reason,
      }),
      profileId: input.profile?.profileId ?? null,
      profileVersion: input.profile?.profileVersion ?? null,
      consultantKind: input.admission.consultantKind,
      targetScope: input.admission.targetScope,
      decision: input.decision,
      reasonCode: input.reason,
      selectedModelProfileId: input.admission.selectedModelProfileId,
      healthRef: input.admission.health.healthRef,
      evidenceRefs: evidenceRefs(input.admission.evidence),
      payloadJson: {
        explicitAdmissionRef: input.admission.explicitAdmissionRef,
        ...input.payloadJson,
      },
      createdAt: input.admission.requestedAt,
    });

    return result.decision;
  };

  const loadActiveProfile = async (
    scope: PolicyGovernanceScope,
  ): Promise<{ activation: PolicyProfileActivationRow; profile: PolicyProfileRow } | null> => {
    const activation = await options.store.resolveActivePolicyActivation(scope);
    if (!activation) {
      return null;
    }

    const profile = await options.store.getPolicyProfile({
      profileId: activation.profileId,
      profileVersion: activation.profileVersion,
    });
    if (!profile || profile.status !== POLICY_PROFILE_STATUS.ACTIVE) {
      return null;
    }

    return { activation, profile };
  };

  return {
    async ensureConservativeBaselinePolicyProfile(): Promise<PolicyProfileRow> {
      const observedAt = now();
      const profile = await options.store.recordPolicyProfile({
        ...CONSERVATIVE_BASELINE_POLICY_PROFILE,
        createdAt: CONSERVATIVE_BASELINE_POLICY_PROFILE.createdAt,
        updatedAt: observedAt,
      });

      for (const scope of profile.governedScopesJson) {
        const active = await options.store.resolveActivePolicyActivation(scope);
        if (active) {
          continue;
        }

        await options.store.recordPolicyActivation({
          activationId: createId(),
          requestId: `policy-baseline:${scope}`,
          normalizedRequestHash: normalizedHash({
            profileId: profile.profileId,
            profileVersion: profile.profileVersion,
            scope,
            baseline: true,
          }),
          profileId: profile.profileId,
          profileVersion: profile.profileVersion,
          scope,
          decision: POLICY_ACTIVATION_DECISION.ACTIVATE,
          reasonCode: 'activated',
          actorRef: 'runtime:policy-baseline',
          evidenceRefs: ['policy:baseline:phase6-conservative'],
          activatedAt: observedAt,
          deactivatedAt: null,
          createdAt: observedAt,
        });
      }

      return profile;
    },

    async activatePolicyProfile(
      input: PolicyActivationServiceInput,
    ): Promise<PolicyActivationServiceResult> {
      let profile: PolicyProfileRow | null = null;
      try {
        profile = await options.store.getPolicyProfile({
          profileId: input.profileId,
          profileVersion: input.profileVersion,
        });
        if (!profile) {
          const activation = await recordActivationRefusal({
            ...input,
            reason: POLICY_REFUSAL_REASON.MISSING_POLICY_PROFILE,
          });
          return {
            accepted: false,
            activation,
            profile,
            refusal: buildRefusal({
              reason: POLICY_REFUSAL_REASON.MISSING_POLICY_PROFILE,
              targetPath: `policy-profile:${input.profileId}@${input.profileVersion}`,
              profile,
              evidence: input.evidence,
              detail: 'policy profile is not registered',
            }),
            auditPersisted: activation !== null,
          };
        }

        if (profile.status !== POLICY_PROFILE_STATUS.ACTIVE) {
          const activation = await recordActivationRefusal({
            ...input,
            reason: POLICY_REFUSAL_REASON.POLICY_PROFILE_NOT_ACTIVE,
          });
          return {
            accepted: false,
            activation,
            profile,
            refusal: buildRefusal({
              reason: POLICY_REFUSAL_REASON.POLICY_PROFILE_NOT_ACTIVE,
              targetPath: `policy-profile:${profile.profileId}@${profile.profileVersion}`,
              profile,
              evidence: input.evidence,
              detail: `policy profile status is ${profile.status}`,
            }),
            auditPersisted: activation !== null,
          };
        }

        const evidenceFailure = evaluateEvidence(profile, input.evidence, input.requestedAt);
        if (evidenceFailure) {
          const activation = await recordActivationRefusal({
            ...input,
            reason: evidenceFailure,
          });
          return {
            accepted: false,
            activation,
            profile,
            refusal: buildRefusal({
              reason: evidenceFailure,
              targetPath: `policy-profile:${profile.profileId}@${profile.profileVersion}`,
              profile,
              evidence: input.evidence,
              detail: 'required owner evidence is missing or stale',
            }),
            auditPersisted: activation !== null,
          };
        }

        const result = await options.store.recordPolicyActivation({
          activationId: createId(),
          requestId: input.requestId,
          normalizedRequestHash: normalizedHash({
            profileId: input.profileId,
            profileVersion: input.profileVersion,
            scope: input.scope,
            decision: POLICY_ACTIVATION_DECISION.ACTIVATE,
            evidenceRefs: evidenceRefs(input.evidence),
          }),
          profileId: input.profileId,
          profileVersion: input.profileVersion,
          scope: input.scope,
          decision: POLICY_ACTIVATION_DECISION.ACTIVATE,
          reasonCode: 'activated',
          actorRef: input.actorRef,
          evidenceRefs: evidenceRefs(input.evidence),
          activatedAt: input.requestedAt,
          deactivatedAt: null,
          createdAt: input.requestedAt,
        });

        if (!result.accepted) {
          return {
            accepted: false,
            activation: result.activation,
            profile,
            refusal: buildRefusal({
              reason:
                result.reason === 'active_scope_conflict'
                  ? POLICY_REFUSAL_REASON.AMBIGUOUS_ACTIVE_PROFILE
                  : POLICY_REFUSAL_REASON.EVIDENCE_UNAVAILABLE,
              targetPath: `policy-scope:${input.scope}`,
              profile,
              evidence: input.evidence,
              detail: result.reason,
            }),
            auditPersisted: true,
          };
        }

        return {
          accepted: true,
          activation: result.activation,
          profile,
          auditPersisted: true,
        };
      } catch (error) {
        return {
          accepted: false,
          activation: null,
          profile,
          refusal: buildRefusal({
            reason: POLICY_REFUSAL_REASON.AUDIT_UNAVAILABLE,
            targetPath: `policy-scope:${input.scope}`,
            profile,
            evidence: input.evidence,
            detail: error instanceof Error ? error.message : 'policy activation audit unavailable',
          }),
          auditPersisted: false,
        };
      }
    },

    async admitConsultant(input: ConsultantAdmissionInput): Promise<ConsultantAdmissionResult> {
      let profile: PolicyProfileRow | null = null;
      const refuse = async (
        reason: PolicyRefusalReason,
        detail: string,
      ): Promise<ConsultantAdmissionResult> => {
        try {
          const decision = await recordConsultantDecision({
            admission: input,
            profile,
            decision: CONSULTANT_ADMISSION_DECISION.REFUSAL,
            reason,
            payloadJson: { refusalDetail: detail },
          });
          return {
            accepted: false,
            decision,
            profile,
            refusal: buildRefusal({
              reason,
              targetPath: `consultant:${input.targetScope}`,
              profile,
              evidence: input.evidence,
              detail,
            }),
            auditPersisted: true,
          };
        } catch (error) {
          return {
            accepted: false,
            decision: null,
            profile,
            refusal: buildRefusal({
              reason: POLICY_REFUSAL_REASON.AUDIT_UNAVAILABLE,
              targetPath: `consultant:${input.targetScope}`,
              profile,
              evidence: input.evidence,
              detail:
                error instanceof Error ? error.message : 'consultant admission audit unavailable',
            }),
            auditPersisted: false,
          };
        }
      };

      if (!SUPPORTED_CONSULTANT_KINDS.has(input.consultantKind)) {
        return await refuse(
          POLICY_REFUSAL_REASON.UNSUPPORTED_CONSULTANT_KIND,
          `consultant kind ${input.consultantKind} is unsupported`,
        );
      }

      try {
        const active = await loadActiveProfile(POLICY_GOVERNANCE_SCOPE.CONSULTANT_ADMISSION);
        if (!active) {
          return await refuse(
            POLICY_REFUSAL_REASON.MISSING_POLICY_PROFILE,
            'no active consultant-admission policy profile is available',
          );
        }
        profile = active.profile;

        if (!profile.rulesJson.externalConsultantsEnabled) {
          return await refuse(
            POLICY_REFUSAL_REASON.EXTERNAL_CONSULTANT_DISABLED,
            'active policy profile disables external consultant execution',
          );
        }

        if (
          !profile.rulesJson.supportedConsultantKinds.includes(
            input.consultantKind as ConsultantKind,
          )
        ) {
          return await refuse(
            POLICY_REFUSAL_REASON.UNSUPPORTED_CONSULTANT_KIND,
            `active policy profile does not support consultant kind ${input.consultantKind}`,
          );
        }

        if (input.health.status !== 'healthy') {
          return await refuse(
            POLICY_REFUSAL_REASON.CONSULTANT_UNHEALTHY,
            `consultant health is ${input.health.status}`,
          );
        }

        const evidenceFailure = evaluateEvidence(profile, input.evidence, input.requestedAt);
        if (evidenceFailure) {
          return await refuse(evidenceFailure, 'required owner evidence is missing or stale');
        }

        if (!input.explicitAdmissionRef) {
          return await refuse(
            POLICY_REFUSAL_REASON.MISSING_ADMISSION_DECISION,
            'explicit consultant admission evidence is missing',
          );
        }

        const decision = await recordConsultantDecision({
          admission: input,
          profile,
          decision: CONSULTANT_ADMISSION_DECISION.ALLOW,
          reason: 'admitted',
        });

        return {
          accepted: true,
          decision,
          profile,
          auditPersisted: true,
        };
      } catch (error) {
        return {
          accepted: false,
          decision: null,
          profile,
          refusal: buildRefusal({
            reason: POLICY_REFUSAL_REASON.AUDIT_UNAVAILABLE,
            targetPath: `consultant:${input.targetScope}`,
            profile,
            evidence: input.evidence,
            detail:
              error instanceof Error ? error.message : 'consultant admission audit unavailable',
          }),
          auditPersisted: false,
        };
      }
    },

    async executeExternalConsultant<T>(
      input: ConsultantAdmissionInput,
      invokeConsultant: () => Promise<T>,
    ): Promise<ConsultantExecutionResult<T>> {
      const admission = await this.admitConsultant(input);
      if (!admission.accepted) {
        return {
          accepted: false,
          consultantInvoked: false,
          admission,
        };
      }

      return {
        accepted: true,
        consultantInvoked: true,
        admission,
        result: await invokeConsultant(),
      };
    },

    async enforcePerceptionPolicy(
      input: PerceptionPolicyEnforcementInput,
    ): Promise<PerceptionPolicyDecisionRow> {
      let profile: PolicyProfileRow | null = null;
      let outcome: PerceptionPolicyDecisionRow['outcome'] = PERCEPTION_POLICY_OUTCOME.HUMAN_GATED;
      let reason: PerceptionPolicyDecisionRow['reasonCode'] =
        POLICY_REFUSAL_REASON.MISSING_POLICY_PROFILE;
      const evidence = {
        additionalEvidenceRefs: [`stimulus:${input.stimulus.stimulusId}`],
        observedAt: input.stimulus.occurredAt,
      } satisfies PolicyEvidenceBundle;

      try {
        const active = await loadActiveProfile(POLICY_GOVERNANCE_SCOPE.PERCEPTION_INTAKE);
        if (active) {
          profile = active.profile;
          outcome = profile.rulesJson.defaultPerceptionOutcome;
          reason = 'policy_matched';
        }

        const result = await options.store.recordPerceptionPolicyDecision({
          decisionId: createId(),
          requestId: `perception-policy:${input.stimulus.stimulusId}`,
          normalizedRequestHash: normalizedHash({
            stimulusId: input.stimulus.stimulusId,
            sourceKind: input.stimulus.sourceKind,
            priority: input.stimulus.priority,
            profile: policyProfileRef(profile),
            outcome,
            reason,
          }),
          stimulusId: input.stimulus.stimulusId,
          sourceKind: input.stimulus.sourceKind,
          priority: input.stimulus.priority,
          profileId: profile?.profileId ?? null,
          profileVersion: profile?.profileVersion ?? null,
          outcome,
          reasonCode: reason,
          evidenceRefs: evidenceRefs(evidence),
          payloadJson: {
            canonicalIntakeRef: `stimulus:${input.stimulus.stimulusId}`,
            signalType: input.stimulus.normalizedJson.signalType,
            dedupeKey: input.stimulus.dedupeKey,
          },
          createdAt: input.requestedAt,
        });

        return result.decision;
      } catch (error) {
        return {
          decisionId: createId(),
          requestId: `perception-policy:${input.stimulus.stimulusId}`,
          normalizedRequestHash: normalizedHash({
            stimulusId: input.stimulus.stimulusId,
            auditUnavailable: true,
          }),
          stimulusId: input.stimulus.stimulusId,
          sourceKind: input.stimulus.sourceKind,
          priority: input.stimulus.priority,
          profileId: profile?.profileId ?? null,
          profileVersion: profile?.profileVersion ?? null,
          outcome: PERCEPTION_POLICY_OUTCOME.HUMAN_GATED,
          reasonCode: POLICY_REFUSAL_REASON.AUDIT_UNAVAILABLE,
          evidenceRefsJson: evidenceRefs(evidence),
          payloadJson: {
            canonicalIntakeRef: `stimulus:${input.stimulus.stimulusId}`,
            error: error instanceof Error ? error.message : 'perception policy audit unavailable',
          },
          createdAt: input.requestedAt,
        };
      }
    },

    async recordGovernanceEvent(input: {
      eventKind: Phase6GovernanceEventRow['eventKind'];
      sourceRef: string;
      profileId: string | null;
      profileVersion: string | null;
      decisionRef: string | null;
      payloadJson?: Record<string, unknown>;
      createdAt: string;
    }): Promise<Phase6GovernanceEventRow> {
      return await options.store.recordPhase6GovernanceEvent({
        eventId: createId(),
        eventKind: input.eventKind,
        sourceRef: input.sourceRef,
        profileId: input.profileId,
        profileVersion: input.profileVersion,
        decisionRef: input.decisionRef,
        createdAt: input.createdAt,
        ...(input.payloadJson ? { payloadJson: input.payloadJson } : {}),
      });
    },

    listPhase6GovernanceEvents(input?: { limit?: number }): Promise<Phase6GovernanceEventRow[]> {
      return options.store.listPhase6GovernanceEvents(input);
    },
  };
}

export const createDbBackedPolicyGovernanceService = (
  config: CoreRuntimeConfig,
): PolicyGovernanceService =>
  createPolicyGovernanceService({
    store: {
      async recordPolicyProfile(input) {
        const client = createRuntimeDbClient(config.postgresUrl);
        await client.connect();
        try {
          return await createPolicyGovernanceStore(client).recordPolicyProfile(input);
        } finally {
          await client.end();
        }
      },
      async getPolicyProfile(input) {
        const client = createRuntimeDbClient(config.postgresUrl);
        await client.connect();
        try {
          return await createPolicyGovernanceStore(client).getPolicyProfile(input);
        } finally {
          await client.end();
        }
      },
      async recordPolicyActivation(input) {
        const client = createRuntimeDbClient(config.postgresUrl);
        await client.connect();
        try {
          return await createPolicyGovernanceStore(client).recordPolicyActivation(input);
        } finally {
          await client.end();
        }
      },
      async resolveActivePolicyActivation(scope) {
        const client = createRuntimeDbClient(config.postgresUrl);
        await client.connect();
        try {
          return await createPolicyGovernanceStore(client).resolveActivePolicyActivation(scope);
        } finally {
          await client.end();
        }
      },
      async recordConsultantAdmissionDecision(input) {
        const client = createRuntimeDbClient(config.postgresUrl);
        await client.connect();
        try {
          return await createPolicyGovernanceStore(client).recordConsultantAdmissionDecision(input);
        } finally {
          await client.end();
        }
      },
      async recordPerceptionPolicyDecision(input) {
        const client = createRuntimeDbClient(config.postgresUrl);
        await client.connect();
        try {
          return await createPolicyGovernanceStore(client).recordPerceptionPolicyDecision(input);
        } finally {
          await client.end();
        }
      },
      async recordPhase6GovernanceEvent(input) {
        const client = createRuntimeDbClient(config.postgresUrl);
        await client.connect();
        try {
          return await createPolicyGovernanceStore(client).recordPhase6GovernanceEvent(input);
        } finally {
          await client.end();
        }
      },
      async listPhase6GovernanceEvents(input) {
        const client = createRuntimeDbClient(config.postgresUrl);
        await client.connect();
        try {
          return await createPolicyGovernanceStore(client).listPhase6GovernanceEvents(input);
        } finally {
          await client.end();
        }
      },
    },
  });

export const PHASE6_POLICY_GOVERNANCE_EVENT_KIND = PHASE6_GOVERNANCE_EVENT_KIND;
