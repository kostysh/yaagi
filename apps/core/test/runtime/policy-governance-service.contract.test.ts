import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONSULTANT_KIND,
  PERCEPTION_POLICY_OUTCOME,
  PHASE6_GOVERNANCE_EVENT_KIND,
  POLICY_ACTIVATION_DECISION,
  POLICY_GOVERNANCE_SCOPE,
  POLICY_PROFILE_STATUS,
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
import { REPORT_SOURCE_OWNER } from '@yaagi/contracts/reporting';
import { createPolicyGovernanceService } from '../../src/runtime/index.ts';

type MemoryStoreOptions = {
  failConsultantAudit?: boolean;
  failActivationAudit?: boolean;
};

const createPolicyGovernanceMemoryStore = (options: MemoryStoreOptions = {}) => {
  const profiles = new Map<string, PolicyProfileRow>();
  const activations: PolicyProfileActivationRow[] = [];
  const consultantDecisions: ConsultantAdmissionDecisionRow[] = [];
  const perceptionDecisions: PerceptionPolicyDecisionRow[] = [];
  const events: Phase6GovernanceEventRow[] = [];

  const keyFor = (profileId: string, profileVersion: string) => `${profileId}@${profileVersion}`;
  const store = {
    recordPolicyProfile(input: RecordPolicyProfileInput): Promise<PolicyProfileRow> {
      const existing = profiles.get(keyFor(input.profileId, input.profileVersion));
      const profile: PolicyProfileRow = {
        profileId: input.profileId,
        profileVersion: input.profileVersion,
        status: input.status,
        governedScopesJson: [...input.governedScopes],
        activationRequirementsJson: { ...input.activationRequirements },
        rulesJson: {
          externalConsultantsEnabled: input.rules.externalConsultantsEnabled,
          supportedConsultantKinds: [...input.rules.supportedConsultantKinds],
          defaultPerceptionOutcome: input.rules.defaultPerceptionOutcome,
        },
        createdAt: existing?.createdAt ?? input.createdAt,
        updatedAt: input.updatedAt,
      };
      profiles.set(keyFor(input.profileId, input.profileVersion), profile);
      return Promise.resolve(structuredClone(profile));
    },
    getPolicyProfile(input: {
      profileId: string;
      profileVersion: string;
    }): Promise<PolicyProfileRow | null> {
      return Promise.resolve(
        structuredClone(profiles.get(keyFor(input.profileId, input.profileVersion)) ?? null),
      );
    },
    async recordPolicyActivation(
      input: RecordPolicyActivationInput,
    ): ReturnType<PolicyGovernanceStore['recordPolicyActivation']> {
      if (options.failActivationAudit) {
        throw new Error('activation audit unavailable');
      }
      if (input.decision === POLICY_ACTIVATION_DECISION.ACTIVATE) {
        const active = await this.resolveActivePolicyActivation(input.scope);
        if (
          active &&
          (active.profileId !== input.profileId || active.profileVersion !== input.profileVersion)
        ) {
          return {
            accepted: false,
            reason: 'active_scope_conflict',
            activation: active,
          };
        }
      }
      const existing = activations.find((activation) => activation.requestId === input.requestId);
      if (existing) {
        return {
          accepted: true,
          deduplicated: true,
          activation: structuredClone(existing),
        };
      }
      const activation: PolicyProfileActivationRow = {
        activationId: input.activationId,
        requestId: input.requestId,
        normalizedRequestHash: input.normalizedRequestHash,
        profileId: input.profileId,
        profileVersion: input.profileVersion,
        scope: input.scope,
        decision: input.decision,
        reasonCode: input.reasonCode,
        actorRef: input.actorRef,
        evidenceRefsJson: [...input.evidenceRefs],
        activatedAt: input.activatedAt,
        deactivatedAt: input.deactivatedAt,
        createdAt: input.createdAt,
      };
      activations.push(activation);
      return {
        accepted: true,
        deduplicated: false,
        activation: structuredClone(activation),
      };
    },
    resolveActivePolicyActivation(
      scope: PolicyProfileActivationRow['scope'],
    ): Promise<PolicyProfileActivationRow | null> {
      const rows = [...activations]
        .filter((activation) => activation.scope === scope)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      for (const row of rows) {
        if (row.decision === POLICY_ACTIVATION_DECISION.REFUSE) {
          continue;
        }
        return Promise.resolve(
          row.decision === POLICY_ACTIVATION_DECISION.ACTIVATE ? structuredClone(row) : null,
        );
      }
      return Promise.resolve(null);
    },
    recordConsultantAdmissionDecision(
      input: RecordConsultantAdmissionDecisionInput,
    ): ReturnType<PolicyGovernanceStore['recordConsultantAdmissionDecision']> {
      if (options.failConsultantAudit) {
        throw new Error('consultant audit unavailable');
      }
      const decision: ConsultantAdmissionDecisionRow = {
        decisionId: input.decisionId,
        requestId: input.requestId,
        normalizedRequestHash: input.normalizedRequestHash,
        profileId: input.profileId,
        profileVersion: input.profileVersion,
        consultantKind: input.consultantKind,
        targetScope: input.targetScope,
        decision: input.decision,
        reasonCode: input.reasonCode,
        selectedModelProfileId: input.selectedModelProfileId,
        healthRef: input.healthRef,
        evidenceRefsJson: [...input.evidenceRefs],
        payloadJson: { ...(input.payloadJson ?? {}) },
        createdAt: input.createdAt,
      };
      consultantDecisions.push(decision);
      return Promise.resolve({
        accepted: true,
        deduplicated: false,
        decision: structuredClone(decision),
      });
    },
    recordPerceptionPolicyDecision(
      input: RecordPerceptionPolicyDecisionInput,
    ): ReturnType<PolicyGovernanceStore['recordPerceptionPolicyDecision']> {
      const decision: PerceptionPolicyDecisionRow = {
        decisionId: input.decisionId,
        requestId: input.requestId,
        normalizedRequestHash: input.normalizedRequestHash,
        stimulusId: input.stimulusId,
        sourceKind: input.sourceKind,
        priority: input.priority,
        profileId: input.profileId,
        profileVersion: input.profileVersion,
        outcome: input.outcome,
        reasonCode: input.reasonCode,
        evidenceRefsJson: [...input.evidenceRefs],
        payloadJson: { ...(input.payloadJson ?? {}) },
        createdAt: input.createdAt,
      };
      perceptionDecisions.push(decision);
      return Promise.resolve({
        accepted: true,
        deduplicated: false,
        decision: structuredClone(decision),
      });
    },
    recordPhase6GovernanceEvent(
      input: RecordPhase6GovernanceEventInput,
    ): Promise<Phase6GovernanceEventRow> {
      const event: Phase6GovernanceEventRow = {
        eventId: input.eventId,
        eventKind: input.eventKind,
        sourceRef: input.sourceRef,
        profileId: input.profileId,
        profileVersion: input.profileVersion,
        decisionRef: input.decisionRef,
        payloadJson: { ...(input.payloadJson ?? {}) },
        createdAt: input.createdAt,
      };
      events.push(event);
      return Promise.resolve(structuredClone(event));
    },
    listPhase6GovernanceEvents(input?: { limit?: number }): Promise<Phase6GovernanceEventRow[]> {
      return Promise.resolve(structuredClone(events.slice(0, input?.limit ?? events.length)));
    },
  } satisfies Parameters<typeof createPolicyGovernanceService>[0]['store'];

  return { store, profiles, activations, consultantDecisions, perceptionDecisions, events };
};

const activateExternalConsultantProfile = async (
  store: ReturnType<typeof createPolicyGovernanceMemoryStore>['store'],
) => {
  await store.recordPolicyProfile({
    ...CONSERVATIVE_BASELINE_POLICY_PROFILE,
    profileId: 'policy.phase6.external-consultant',
    profileVersion: '2026-04-24.external-consultant',
    rules: {
      externalConsultantsEnabled: true,
      supportedConsultantKinds: [CONSULTANT_KIND.EXTERNAL_LLM],
      defaultPerceptionOutcome: PERCEPTION_POLICY_OUTCOME.ACCEPTED,
    },
  });
  await store.recordPolicyActivation({
    activationId: 'activation:external-consultant',
    requestId: 'activation-request:external-consultant',
    normalizedRequestHash: 'activation-hash',
    profileId: 'policy.phase6.external-consultant',
    profileVersion: '2026-04-24.external-consultant',
    scope: POLICY_GOVERNANCE_SCOPE.CONSULTANT_ADMISSION,
    decision: POLICY_ACTIVATION_DECISION.ACTIVATE,
    reasonCode: 'activated',
    actorRef: 'operator:1',
    evidenceRefs: ['auth:allow:1', 'governor:allow:1', 'perimeter:allow:1'],
    activatedAt: '2026-04-24T12:00:00.000Z',
    deactivatedAt: null,
    createdAt: '2026-04-24T12:00:00.000Z',
  });
};

void test('AC-F0025-02 / AC-F0025-12 seeds a conservative baseline with consultants disabled', async () => {
  const harness = createPolicyGovernanceMemoryStore();
  const service = createPolicyGovernanceService({
    store: harness.store,
    now: () => '2026-04-24T12:00:00.000Z',
    createId: () => `policy-id:${harness.activations.length + harness.events.length}`,
  });

  const profile = await service.ensureConservativeBaselinePolicyProfile();

  assert.equal(profile.status, POLICY_PROFILE_STATUS.ACTIVE);
  assert.equal(profile.rulesJson.externalConsultantsEnabled, false);
  assert.equal(harness.activations.length, 4);
  assert.deepEqual(
    harness.activations.map((activation) => activation.scope).sort(),
    [
      POLICY_GOVERNANCE_SCOPE.CONSULTANT_ADMISSION,
      POLICY_GOVERNANCE_SCOPE.HUMAN_GATE,
      POLICY_GOVERNANCE_SCOPE.PERCEPTION_INTAKE,
      POLICY_GOVERNANCE_SCOPE.PHASE6_AUTONOMY,
    ].sort(),
  );
});

void test('AC-F0025-03 / AC-F0025-09 refuses policy activation without owner evidence', async () => {
  const harness = createPolicyGovernanceMemoryStore();
  const service = createPolicyGovernanceService({
    store: harness.store,
    now: () => '2026-04-24T12:00:00.000Z',
    createId: () => `activation-id:${harness.activations.length + 1}`,
  });
  await harness.store.recordPolicyProfile(CONSERVATIVE_BASELINE_POLICY_PROFILE);

  const result = await service.activatePolicyProfile({
    requestId: 'policy-activation:missing-evidence',
    profileId: CONSERVATIVE_BASELINE_POLICY_PROFILE.profileId,
    profileVersion: CONSERVATIVE_BASELINE_POLICY_PROFILE.profileVersion,
    scope: POLICY_GOVERNANCE_SCOPE.HUMAN_GATE,
    actorRef: 'operator:1',
    evidence: {
      callerAdmissionRef: null,
      governorDecisionRef: 'governor:allow:1',
      perimeterDecisionRef: 'perimeter:allow:1',
      observedAt: '2026-04-24T12:00:00.000Z',
    },
    requestedAt: '2026-04-24T12:00:00.000Z',
  });

  assert.equal(result.accepted, false);
  assert.equal(result.refusal.reason, POLICY_REFUSAL_REASON.CALLER_EVIDENCE_MISSING);
  assert.equal(result.auditPersisted, true);
  assert.equal(harness.activations[0]?.decision, POLICY_ACTIVATION_DECISION.REFUSE);
});

void test('AC-F0025-09 / AC-F0025-10 activates policy profiles from read-only owner evidence refs', async () => {
  const harness = createPolicyGovernanceMemoryStore();
  const service = createPolicyGovernanceService({
    store: harness.store,
    now: () => '2026-04-24T12:00:00.000Z',
    createId: () => `activation-id:${harness.activations.length + 1}`,
  });
  await harness.store.recordPolicyProfile(CONSERVATIVE_BASELINE_POLICY_PROFILE);

  const result = await service.activatePolicyProfile({
    requestId: 'policy-activation:allow',
    profileId: CONSERVATIVE_BASELINE_POLICY_PROFILE.profileId,
    profileVersion: CONSERVATIVE_BASELINE_POLICY_PROFILE.profileVersion,
    scope: POLICY_GOVERNANCE_SCOPE.HUMAN_GATE,
    actorRef: 'operator:1',
    evidence: {
      callerAdmissionRef: 'operator-auth:allow:1',
      governorDecisionRef: 'governor:allow:1',
      perimeterDecisionRef: 'perimeter:allow:1',
      additionalEvidenceRefs: ['router:diagnostic:1', 'report:model-health:1'],
      observedAt: '2026-04-24T12:00:00.000Z',
    },
    requestedAt: '2026-04-24T12:00:00.000Z',
  });

  assert.equal(result.accepted, true);
  assert.equal(result.activation.decision, POLICY_ACTIVATION_DECISION.ACTIVATE);
  assert.deepEqual(result.activation.evidenceRefsJson, [
    'operator-auth:allow:1',
    'governor:allow:1',
    'perimeter:allow:1',
    'router:diagnostic:1',
    'report:model-health:1',
  ]);
});

void test('AC-F0025-04 admits a healthy consultant only after explicit policy admission', async () => {
  const harness = createPolicyGovernanceMemoryStore();
  const service = createPolicyGovernanceService({
    store: harness.store,
    now: () => '2026-04-24T12:00:00.000Z',
    createId: () => `consultant-id:${harness.consultantDecisions.length + 1}`,
  });
  await activateExternalConsultantProfile(harness.store);

  const result = await service.executeExternalConsultant(
    {
      requestId: 'consultant:allow',
      consultantKind: CONSULTANT_KIND.EXTERNAL_LLM,
      targetScope: 'phase6.consult',
      selectedModelProfileId: 'consultant.external@phase6',
      explicitAdmissionRef: 'policy-admission:allow:1',
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
    },
    () => Promise.resolve({ text: 'consultant result' }),
  );

  assert.equal(result.accepted, true);
  assert.equal(result.consultantInvoked, true);
  assert.equal(result.admission.decision.decision, 'allow');
});

void test('AC-F0025-11 records bounded phase-6 governance events for reporting consumers', async () => {
  const harness = createPolicyGovernanceMemoryStore();
  const service = createPolicyGovernanceService({
    store: harness.store,
    now: () => '2026-04-24T12:00:00.000Z',
    createId: () => `phase6-event:${harness.events.length + 1}`,
  });

  await service.recordGovernanceEvent({
    eventKind: PHASE6_GOVERNANCE_EVENT_KIND.CONSULTANT_ADMISSION_DECIDED,
    sourceRef: 'consultant-decision:1',
    profileId: null,
    profileVersion: null,
    decisionRef: 'consultant-decision:1',
    payloadJson: { readableBy: 'F-0023' },
    createdAt: '2026-04-24T12:00:00.000Z',
  });
  const events = await service.listPhase6GovernanceEvents({ limit: 5 });

  assert.equal(events.length, 1);
  assert.equal(events[0]?.payloadJson['readableBy'], 'F-0023');
  assert.equal(REPORT_SOURCE_OWNER.PHASE6_POLICY_GOVERNANCE, 'F-0025');
});
