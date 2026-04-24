import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PHASE6_GOVERNANCE_EVENT_KIND,
  type ConsultantAdmissionDecisionRow,
  type PerceptionPolicyDecisionRow,
  type Phase6GovernanceEventRow,
  type PolicyProfileActivationRow,
  type PolicyProfileRow,
} from '@yaagi/contracts/policy-governance';
import { REPORT_SOURCE_OWNER } from '@yaagi/contracts/reporting';
import type {
  PolicyGovernanceStore,
  RecordConsultantAdmissionDecisionInput,
  RecordPerceptionPolicyDecisionInput,
  RecordPhase6GovernanceEventInput,
} from '@yaagi/db';
import { createPolicyGovernanceService } from '../../src/runtime/index.ts';

void test('AC-F0025-11 exposes bounded phase-6 governance evidence while F-0023 owns report materialization', async () => {
  const events: Phase6GovernanceEventRow[] = [];
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
      return Promise.resolve({ accepted: true, deduplicated: false, decision });
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
      return Promise.resolve({ accepted: true, deduplicated: false, decision });
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

  const service = createPolicyGovernanceService({
    store,
    now: () => '2026-04-24T12:00:00.000Z',
    createId: () => `phase6-event:${events.length + 1}`,
  });

  await service.recordGovernanceEvent({
    eventKind: PHASE6_GOVERNANCE_EVENT_KIND.GOVERNANCE_EVIDENCE_RECORDED,
    sourceRef: 'phase6:evidence:1',
    profileId: 'policy.phase6.baseline',
    profileVersion: '2026-04-24.phase6-conservative',
    decisionRef: 'consultant-decision:1',
    payloadJson: {
      sourceOwner: REPORT_SOURCE_OWNER.PHASE6_POLICY_GOVERNANCE,
      reportOwner: 'F-0023',
    },
    createdAt: '2026-04-24T12:00:00.000Z',
  });
  const [event] = await service.listPhase6GovernanceEvents({ limit: 1 });

  assert.equal(event?.payloadJson['sourceOwner'], 'F-0025');
  assert.equal(event?.payloadJson['reportOwner'], 'F-0023');
});
