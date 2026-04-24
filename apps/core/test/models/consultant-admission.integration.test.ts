import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONSULTANT_ADMISSION_DECISION,
  CONSULTANT_KIND,
  PERCEPTION_POLICY_OUTCOME,
  POLICY_ACTIVATION_DECISION,
  POLICY_GOVERNANCE_SCOPE,
  POLICY_REFUSAL_REASON,
  type ConsultantAdmissionDecisionRow,
  type PerceptionPolicyDecisionRow,
  type Phase6GovernanceEventRow,
  type PolicyProfileActivationRow,
  type PolicyProfileRow,
} from '@yaagi/contracts/policy-governance';
import {
  CONSERVATIVE_BASELINE_POLICY_PROFILE,
  type PolicyGovernanceStore,
  type RecordConsultantAdmissionDecisionInput,
  type RecordPerceptionPolicyDecisionInput,
  type RecordPhase6GovernanceEventInput,
  type RecordPolicyActivationInput,
  type RecordPolicyProfileInput,
} from '@yaagi/db';
import {
  createPolicyGovernanceService,
  type ConsultantAdmissionInput,
} from '../../src/runtime/index.ts';

const createConsultantPolicyStore = (input?: { failConsultantAudit?: boolean }) => {
  const profiles = new Map<string, PolicyProfileRow>();
  const activations: PolicyProfileActivationRow[] = [];
  const consultantDecisions: ConsultantAdmissionDecisionRow[] = [];
  const keyFor = (profileId: string, profileVersion: string) => `${profileId}@${profileVersion}`;

  const store = {
    recordPolicyProfile(profileInput: RecordPolicyProfileInput): Promise<PolicyProfileRow> {
      const profile: PolicyProfileRow = {
        profileId: profileInput.profileId,
        profileVersion: profileInput.profileVersion,
        status: profileInput.status,
        governedScopesJson: [...profileInput.governedScopes],
        activationRequirementsJson: { ...profileInput.activationRequirements },
        rulesJson: {
          externalConsultantsEnabled: profileInput.rules.externalConsultantsEnabled,
          supportedConsultantKinds: [...profileInput.rules.supportedConsultantKinds],
          defaultPerceptionOutcome: profileInput.rules.defaultPerceptionOutcome,
        },
        createdAt: profileInput.createdAt,
        updatedAt: profileInput.updatedAt,
      };
      profiles.set(keyFor(profile.profileId, profile.profileVersion), profile);
      return Promise.resolve(structuredClone(profile));
    },
    getPolicyProfile(profileInput: {
      profileId: string;
      profileVersion: string;
    }): Promise<PolicyProfileRow | null> {
      return Promise.resolve(
        structuredClone(
          profiles.get(keyFor(profileInput.profileId, profileInput.profileVersion)) ?? null,
        ),
      );
    },
    recordPolicyActivation(
      activationInput: RecordPolicyActivationInput,
    ): ReturnType<PolicyGovernanceStore['recordPolicyActivation']> {
      const activation: PolicyProfileActivationRow = {
        activationId: activationInput.activationId,
        requestId: activationInput.requestId,
        normalizedRequestHash: activationInput.normalizedRequestHash,
        profileId: activationInput.profileId,
        profileVersion: activationInput.profileVersion,
        scope: activationInput.scope,
        decision: activationInput.decision,
        reasonCode: activationInput.reasonCode,
        actorRef: activationInput.actorRef,
        evidenceRefsJson: [...activationInput.evidenceRefs],
        activatedAt: activationInput.activatedAt,
        deactivatedAt: activationInput.deactivatedAt,
        createdAt: activationInput.createdAt,
      };
      activations.push(activation);
      return Promise.resolve({
        accepted: true,
        deduplicated: false,
        activation: structuredClone(activation),
      });
    },
    resolveActivePolicyActivation(
      scope: PolicyProfileActivationRow['scope'],
    ): Promise<PolicyProfileActivationRow | null> {
      const activation = [...activations]
        .filter(
          (entry) =>
            entry.scope === scope && entry.decision === POLICY_ACTIVATION_DECISION.ACTIVATE,
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
      return Promise.resolve(structuredClone(activation ?? null));
    },
    recordConsultantAdmissionDecision(
      decisionInput: RecordConsultantAdmissionDecisionInput,
    ): ReturnType<PolicyGovernanceStore['recordConsultantAdmissionDecision']> {
      if (input?.failConsultantAudit) {
        throw new Error('consultant audit unavailable');
      }
      const decision: ConsultantAdmissionDecisionRow = {
        decisionId: decisionInput.decisionId,
        requestId: decisionInput.requestId,
        normalizedRequestHash: decisionInput.normalizedRequestHash,
        profileId: decisionInput.profileId,
        profileVersion: decisionInput.profileVersion,
        consultantKind: decisionInput.consultantKind,
        targetScope: decisionInput.targetScope,
        decision: decisionInput.decision,
        reasonCode: decisionInput.reasonCode,
        selectedModelProfileId: decisionInput.selectedModelProfileId,
        healthRef: decisionInput.healthRef,
        evidenceRefsJson: [...decisionInput.evidenceRefs],
        payloadJson: { ...(decisionInput.payloadJson ?? {}) },
        createdAt: decisionInput.createdAt,
      };
      consultantDecisions.push(decision);
      return Promise.resolve({
        accepted: true,
        deduplicated: false,
        decision: structuredClone(decision),
      });
    },
    recordPerceptionPolicyDecision(
      decisionInput: RecordPerceptionPolicyDecisionInput,
    ): ReturnType<PolicyGovernanceStore['recordPerceptionPolicyDecision']> {
      const decision: PerceptionPolicyDecisionRow = {
        decisionId: decisionInput.decisionId,
        requestId: decisionInput.requestId,
        normalizedRequestHash: decisionInput.normalizedRequestHash,
        stimulusId: decisionInput.stimulusId,
        sourceKind: decisionInput.sourceKind,
        priority: decisionInput.priority,
        profileId: decisionInput.profileId,
        profileVersion: decisionInput.profileVersion,
        outcome: decisionInput.outcome,
        reasonCode: decisionInput.reasonCode,
        evidenceRefsJson: [...decisionInput.evidenceRefs],
        payloadJson: { ...(decisionInput.payloadJson ?? {}) },
        createdAt: decisionInput.createdAt,
      };
      return Promise.resolve({
        accepted: true,
        deduplicated: false,
        decision,
      });
    },
    recordPhase6GovernanceEvent(
      eventInput: RecordPhase6GovernanceEventInput,
    ): Promise<Phase6GovernanceEventRow> {
      return Promise.resolve({
        eventId: eventInput.eventId,
        eventKind: eventInput.eventKind,
        sourceRef: eventInput.sourceRef,
        profileId: eventInput.profileId,
        profileVersion: eventInput.profileVersion,
        decisionRef: eventInput.decisionRef,
        payloadJson: { ...(eventInput.payloadJson ?? {}) },
        createdAt: eventInput.createdAt,
      });
    },
    listPhase6GovernanceEvents(): Promise<Phase6GovernanceEventRow[]> {
      return Promise.resolve([]);
    },
  } satisfies Parameters<typeof createPolicyGovernanceService>[0]['store'];

  return { store, consultantDecisions };
};

const externalConsultantProfile = {
  ...CONSERVATIVE_BASELINE_POLICY_PROFILE,
  profileId: 'policy.phase6.external-consultant',
  profileVersion: '2026-04-24.external-consultant',
  rules: {
    externalConsultantsEnabled: true,
    supportedConsultantKinds: [CONSULTANT_KIND.EXTERNAL_LLM],
    defaultPerceptionOutcome: PERCEPTION_POLICY_OUTCOME.ACCEPTED,
  },
};

const activateProfile = async (
  store: ReturnType<typeof createConsultantPolicyStore>['store'],
  profile: RecordPolicyProfileInput,
) => {
  await store.recordPolicyProfile(profile);
  await store.recordPolicyActivation({
    activationId: `activation:${profile.profileId}`,
    requestId: `activation-request:${profile.profileId}`,
    normalizedRequestHash: `activation-hash:${profile.profileId}`,
    profileId: profile.profileId,
    profileVersion: profile.profileVersion,
    scope: POLICY_GOVERNANCE_SCOPE.CONSULTANT_ADMISSION,
    decision: POLICY_ACTIVATION_DECISION.ACTIVATE,
    reasonCode: 'activated',
    actorRef: 'operator:1',
    evidenceRefs: ['operator-auth:allow:1', 'governor:allow:1', 'perimeter:allow:1'],
    activatedAt: '2026-04-24T12:00:00.000Z',
    deactivatedAt: null,
    createdAt: '2026-04-24T12:00:00.000Z',
  });
};

const baseAdmissionInput = (requestId: string): ConsultantAdmissionInput => ({
  requestId,
  consultantKind: CONSULTANT_KIND.EXTERNAL_LLM,
  targetScope: 'phase6.consult',
  selectedModelProfileId: 'consultant.external@phase6',
  explicitAdmissionRef: 'policy-admission:allow:1',
  explicitAdmissionDecision: CONSULTANT_ADMISSION_DECISION.ALLOW,
  health: {
    status: 'healthy',
    healthRef: 'consultant-health:healthy:1',
  },
  evidence: {
    callerAdmissionRef: 'operator-auth:allow:1',
    governorDecisionRef: 'governor:allow:1',
    perimeterDecisionRef: 'perimeter:allow:1',
    observedAt: '2026-04-24T12:00:00.000Z',
  },
  requestedAt: '2026-04-24T12:00:00.000Z',
});

const expectConsultantRefusal = async (input: {
  name: string;
  setup?: (store: ReturnType<typeof createConsultantPolicyStore>['store']) => Promise<void>;
  admissionPatch: Partial<ConsultantAdmissionInput>;
  reason: string;
  expectedDecision?: ConsultantAdmissionDecisionRow['decision'];
  failConsultantAudit?: boolean;
}) => {
  await test(input.name, async () => {
    const harness = createConsultantPolicyStore(
      input.failConsultantAudit ? { failConsultantAudit: true } : undefined,
    );
    await input.setup?.(harness.store);
    const service = createPolicyGovernanceService({
      store: harness.store,
      now: () => '2026-04-24T12:00:00.000Z',
      createId: () => `consultant-decision:${harness.consultantDecisions.length + 1}`,
    });
    let invocationCount = 0;

    const result = await service.executeExternalConsultant(
      {
        ...baseAdmissionInput(`consultant:${input.name}`),
        ...input.admissionPatch,
      },
      () => {
        invocationCount += 1;
        return Promise.resolve({ text: 'must not run' });
      },
    );

    assert.equal(result.accepted, false);
    assert.equal(result.consultantInvoked, false);
    assert.equal(invocationCount, 0);
    assert.equal(result.admission.accepted, false);
    if (!result.admission.accepted) {
      assert.equal(result.admission.refusal.reason, input.reason);
    }
    if (input.expectedDecision) {
      assert.equal(harness.consultantDecisions[0]?.decision, input.expectedDecision);
    }
  });
};

void test('AC-F0025-13 blocks every unsupported consultant path before invocation', async () => {
  await expectConsultantRefusal({
    name: 'missing-policy-profile',
    admissionPatch: {},
    reason: POLICY_REFUSAL_REASON.MISSING_POLICY_PROFILE,
  });
  await expectConsultantRefusal({
    name: 'disabled-baseline-profile',
    setup: (store) => activateProfile(store, CONSERVATIVE_BASELINE_POLICY_PROFILE),
    admissionPatch: {},
    reason: POLICY_REFUSAL_REASON.EXTERNAL_CONSULTANT_DISABLED,
  });
  await expectConsultantRefusal({
    name: 'missing-admission-state',
    setup: (store) => activateProfile(store, externalConsultantProfile),
    admissionPatch: { explicitAdmissionRef: null },
    reason: POLICY_REFUSAL_REASON.MISSING_ADMISSION_DECISION,
  });
  await expectConsultantRefusal({
    name: 'explicit-denied-admission',
    setup: (store) => activateProfile(store, externalConsultantProfile),
    admissionPatch: {
      explicitAdmissionRef: 'policy-admission:deny:1',
      explicitAdmissionDecision: CONSULTANT_ADMISSION_DECISION.DENY,
    },
    reason: POLICY_REFUSAL_REASON.CONSULTANT_ADMISSION_DENIED,
    expectedDecision: CONSULTANT_ADMISSION_DECISION.DENY,
  });
  await expectConsultantRefusal({
    name: 'unsupported-consultant-kind',
    setup: (store) => activateProfile(store, externalConsultantProfile),
    admissionPatch: { consultantKind: 'side_channel_vendor' },
    reason: POLICY_REFUSAL_REASON.UNSUPPORTED_CONSULTANT_KIND,
  });
  await expectConsultantRefusal({
    name: 'unhealthy-consultant',
    setup: (store) => activateProfile(store, externalConsultantProfile),
    admissionPatch: {
      health: {
        status: 'unavailable',
        healthRef: 'consultant-health:unavailable:1',
      },
    },
    reason: POLICY_REFUSAL_REASON.CONSULTANT_UNHEALTHY,
  });
  await expectConsultantRefusal({
    name: 'stale-owner-evidence',
    setup: (store) => activateProfile(store, externalConsultantProfile),
    admissionPatch: {
      evidence: {
        ...baseAdmissionInput('unused').evidence,
        observedAt: '2026-04-24T11:00:00.000Z',
      },
    },
    reason: POLICY_REFUSAL_REASON.STALE_EVIDENCE,
  });
  await expectConsultantRefusal({
    name: 'audit-unavailable',
    setup: (store) => activateProfile(store, externalConsultantProfile),
    admissionPatch: {},
    reason: POLICY_REFUSAL_REASON.AUDIT_UNAVAILABLE,
    failConsultantAudit: true,
  });
});
