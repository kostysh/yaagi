import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONSULTANT_KIND,
  POLICY_REFUSAL_REASON,
  type ConsultantAdmissionDecisionRow,
  type PerceptionPolicyDecisionRow,
  type Phase6GovernanceEventRow,
  type PolicyProfileActivationRow,
  type PolicyProfileRow,
} from '@yaagi/contracts/policy-governance';
import type {
  PolicyGovernanceStore,
  RecordConsultantAdmissionDecisionInput,
  RecordPerceptionPolicyDecisionInput,
  RecordPhase6GovernanceEventInput,
  RuntimeModelProfileRow,
  RuntimeModelProfileSeedInput,
  RuntimeModelProfileStore,
  RuntimeModelSelectionPersistenceResult,
} from '@yaagi/db';
import {
  createPhase0ModelRouter,
  createPolicyGovernanceService,
  PHASE0_BASELINE_PROFILE_ID,
} from '../../src/runtime/index.ts';

void test('AC-F0025-07 refuses consultant execution without remapping to a local baseline profile', async () => {
  const decisions: ConsultantAdmissionDecisionRow[] = [];
  const store = {
    getPolicyProfile(): Promise<PolicyProfileRow | null> {
      return Promise.resolve(null);
    },
    recordPolicyProfile(): never {
      throw new Error('not used');
    },
    recordPolicyActivation(): never {
      throw new Error('not used');
    },
    resolveActivePolicyActivation(): Promise<PolicyProfileActivationRow | null> {
      return Promise.resolve(null);
    },
    recordConsultantAdmissionDecision(
      input: RecordConsultantAdmissionDecisionInput,
    ): ReturnType<PolicyGovernanceStore['recordConsultantAdmissionDecision']> {
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
      decisions.push(decision);
      return Promise.resolve({
        accepted: true,
        deduplicated: false,
        decision,
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
      return Promise.resolve({
        accepted: true,
        deduplicated: false,
        decision,
      });
    },
    recordPhase6GovernanceEvent(
      input: RecordPhase6GovernanceEventInput,
    ): Promise<Phase6GovernanceEventRow> {
      return Promise.resolve({
        eventId: input.eventId,
        eventKind: input.eventKind,
        sourceRef: input.sourceRef,
        profileId: input.profileId,
        profileVersion: input.profileVersion,
        decisionRef: input.decisionRef,
        payloadJson: { ...(input.payloadJson ?? {}) },
        createdAt: input.createdAt,
      });
    },
    listPhase6GovernanceEvents(): Promise<Phase6GovernanceEventRow[]> {
      return Promise.resolve([]);
    },
  } satisfies Parameters<typeof createPolicyGovernanceService>[0]['store'];

  const service = createPolicyGovernanceService({
    store,
    now: () => '2026-04-24T12:00:00.000Z',
    createId: () => `consultant-decision:${decisions.length + 1}`,
  });
  let invocationCount = 0;

  const result = await service.executeExternalConsultant(
    {
      requestId: 'consultant:no-remap',
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
    () => {
      invocationCount += 1;
      return Promise.resolve({ text: 'must not run' });
    },
  );

  assert.equal(result.accepted, false);
  assert.equal(invocationCount, 0);
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0]?.reasonCode, POLICY_REFUSAL_REASON.MISSING_POLICY_PROFILE);
  assert.equal(decisions[0]?.selectedModelProfileId, 'consultant.external@phase6');
  assert.notEqual(decisions[0]?.selectedModelProfileId, PHASE0_BASELINE_PROFILE_ID.REFLEX);
});

void test('AC-F0025-06 / AC-F0025-07 keeps baseline router selection separate from consultant admission', async () => {
  let listCalls = 0;
  const modelStore: RuntimeModelProfileStore = {
    ensureModelProfiles(
      profiles: RuntimeModelProfileSeedInput[],
    ): Promise<RuntimeModelProfileRow[]> {
      return Promise.resolve(profiles as unknown as RuntimeModelProfileRow[]);
    },
    listModelProfiles(): Promise<RuntimeModelProfileRow[]> {
      listCalls += 1;
      return Promise.resolve([]);
    },
    persistTickModelSelection(): Promise<RuntimeModelSelectionPersistenceResult> {
      throw new Error('selection persistence must not run for unsupported consultant role');
    },
    setCurrentModelProfile(): Promise<void> {
      return Promise.resolve();
    },
  };
  const router = createPhase0ModelRouter({
    fastModelBaseUrl: 'http://127.0.0.1:8000/v1',
    store: modelStore,
  });

  const selection = await router.selectProfile({
    tickMode: 'deliberative',
    taskKind: 'phase6.consultant',
    latencyBudget: 'extended',
    riskLevel: 'high',
    contextSize: 2048,
    requestedRole: 'external_consultant',
  });

  assert.equal(selection.accepted, false);
  if (!selection.accepted) {
    assert.equal(selection.reason, 'unsupported_role');
    assert.match(selection.detail, /external_consultant/);
  }
  assert.equal(listCalls, 0);
});
