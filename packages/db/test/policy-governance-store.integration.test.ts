import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONSULTANT_ADMISSION_DECISION,
  CONSULTANT_KIND,
  PERCEPTION_POLICY_OUTCOME,
  PHASE6_GOVERNANCE_EVENT_KIND,
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
  createPolicyGovernanceStore,
  type PolicyGovernanceDbExecutor,
} from '../src/policy-governance.ts';

const sortDesc = <T extends { createdAt: string }>(rows: T[]): T[] =>
  [...rows].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

type PolicyGovernanceDbHarnessOptions = {
  requireActiveScopeLock?: boolean;
};

const createPolicyGovernanceDbHarness = (
  options: PolicyGovernanceDbHarnessOptions = {},
): {
  db: PolicyGovernanceDbExecutor;
  profiles: PolicyProfileRow[];
  activations: PolicyProfileActivationRow[];
  consultantDecisions: ConsultantAdmissionDecisionRow[];
  perceptionDecisions: PerceptionPolicyDecisionRow[];
  events: Phase6GovernanceEventRow[];
  activationLockTrace: string[];
} => {
  const profiles: PolicyProfileRow[] = [];
  const activations: PolicyProfileActivationRow[] = [];
  const consultantDecisions: ConsultantAdmissionDecisionRow[] = [];
  const perceptionDecisions: PerceptionPolicyDecisionRow[] = [];
  const events: Phase6GovernanceEventRow[] = [];
  const activeScopeLocks = new Set<string>();
  const activationLockTrace: string[] = [];

  const query = ((sqlText: unknown, params: unknown[] = []) => {
    if (typeof sqlText !== 'string') {
      throw new Error('policy governance harness supports only text queries');
    }

    const sql = sqlText.replace(/\s+/g, ' ').trim().toLowerCase();

    if (sql.startsWith('select pg_advisory_lock')) {
      const scope = String(params[1]);
      activeScopeLocks.add(scope);
      activationLockTrace.push(`lock:${scope}`);
      return Promise.resolve({ rows: [] });
    }

    if (sql.startsWith('select pg_advisory_unlock')) {
      const scope = String(params[1]);
      activeScopeLocks.delete(scope);
      activationLockTrace.push(`unlock:${scope}`);
      return Promise.resolve({ rows: [{ pg_advisory_unlock: true }] });
    }

    if (sql.startsWith('insert into polyphony_runtime.policy_profiles')) {
      const existingIndex = profiles.findIndex(
        (profile) => profile.profileId === params[0] && profile.profileVersion === params[1],
      );
      const row: PolicyProfileRow = {
        profileId: String(params[0]),
        profileVersion: String(params[1]),
        status: params[2] as PolicyProfileRow['status'],
        governedScopesJson: JSON.parse(String(params[3])) as PolicyProfileRow['governedScopesJson'],
        activationRequirementsJson: JSON.parse(
          String(params[4]),
        ) as PolicyProfileRow['activationRequirementsJson'],
        rulesJson: JSON.parse(String(params[5])) as PolicyProfileRow['rulesJson'],
        createdAt:
          existingIndex >= 0
            ? (profiles[existingIndex]?.createdAt ?? String(params[6]))
            : String(params[6]),
        updatedAt: String(params[7]),
      };
      if (existingIndex >= 0) {
        profiles[existingIndex] = row;
      } else {
        profiles.push(row);
      }
      return Promise.resolve({ rows: [row] });
    }

    if (
      sql.includes('from polyphony_runtime.policy_profiles') &&
      sql.includes('where profile_id = $1') &&
      sql.includes('and profile_version = $2')
    ) {
      const row = profiles.find(
        (profile) => profile.profileId === params[0] && profile.profileVersion === params[1],
      );
      return Promise.resolve({ rows: row ? [row] : [] });
    }

    if (
      sql.includes('from polyphony_runtime.policy_profiles') &&
      sql.includes('where status = $1')
    ) {
      return Promise.resolve({ rows: profiles.filter((profile) => profile.status === params[0]) });
    }

    if (sql.includes('from polyphony_runtime.policy_profiles')) {
      return Promise.resolve({ rows: [...profiles] });
    }

    if (
      sql.includes('from polyphony_runtime.policy_profile_activations') &&
      sql.includes('where scope = $1')
    ) {
      const scope = String(params[0]);
      if (options.requireActiveScopeLock && !activeScopeLocks.has(scope)) {
        throw new Error(`active policy activation read for ${scope} must hold advisory lock`);
      }
      activationLockTrace.push(`active-read:${scope}`);
      return Promise.resolve({
        rows: sortDesc(activations.filter((activation) => activation.scope === params[0])).slice(
          0,
          32,
        ),
      });
    }

    if (sql.startsWith('insert into polyphony_runtime.policy_profile_activations')) {
      const existing = activations.find((activation) => activation.requestId === params[1]);
      if (existing) {
        return Promise.resolve({ rows: [] });
      }
      if (
        options.requireActiveScopeLock &&
        params[6] === POLICY_ACTIVATION_DECISION.ACTIVATE &&
        !activeScopeLocks.has(String(params[5]))
      ) {
        throw new Error(
          `active policy activation insert for ${String(params[5])} must hold advisory lock`,
        );
      }
      activationLockTrace.push(`insert:${String(params[5])}`);
      const row: PolicyProfileActivationRow = {
        activationId: String(params[0]),
        requestId: String(params[1]),
        normalizedRequestHash: String(params[2]),
        profileId: String(params[3]),
        profileVersion: String(params[4]),
        scope: params[5] as PolicyProfileActivationRow['scope'],
        decision: params[6] as PolicyProfileActivationRow['decision'],
        reasonCode: params[7] as PolicyProfileActivationRow['reasonCode'],
        actorRef: typeof params[8] === 'string' ? String(params[8]) : null,
        evidenceRefsJson: JSON.parse(String(params[9])) as string[],
        activatedAt: typeof params[10] === 'string' ? String(params[10]) : null,
        deactivatedAt: typeof params[11] === 'string' ? String(params[11]) : null,
        createdAt: String(params[12]),
      };
      activations.push(row);
      return Promise.resolve({ rows: [row] });
    }

    if (
      sql.includes('from polyphony_runtime.policy_profile_activations') &&
      sql.includes('where request_id = $1')
    ) {
      const row = activations.find((activation) => activation.requestId === params[0]);
      return Promise.resolve({ rows: row ? [row] : [] });
    }

    if (sql.startsWith('insert into polyphony_runtime.consultant_admission_decisions')) {
      const existing = consultantDecisions.find((decision) => decision.requestId === params[1]);
      if (existing) {
        return Promise.resolve({ rows: [] });
      }
      const row: ConsultantAdmissionDecisionRow = {
        decisionId: String(params[0]),
        requestId: String(params[1]),
        normalizedRequestHash: String(params[2]),
        profileId: typeof params[3] === 'string' ? String(params[3]) : null,
        profileVersion: typeof params[4] === 'string' ? String(params[4]) : null,
        consultantKind: String(params[5]),
        targetScope: String(params[6]),
        decision: params[7] as ConsultantAdmissionDecisionRow['decision'],
        reasonCode: params[8] as ConsultantAdmissionDecisionRow['reasonCode'],
        selectedModelProfileId: typeof params[9] === 'string' ? String(params[9]) : null,
        healthRef: typeof params[10] === 'string' ? String(params[10]) : null,
        evidenceRefsJson: JSON.parse(String(params[11])) as string[],
        payloadJson: JSON.parse(String(params[12])) as Record<string, unknown>,
        createdAt: String(params[13]),
      };
      consultantDecisions.push(row);
      return Promise.resolve({ rows: [row] });
    }

    if (
      sql.includes('from polyphony_runtime.consultant_admission_decisions') &&
      sql.includes('where request_id = $1')
    ) {
      const row = consultantDecisions.find((decision) => decision.requestId === params[0]);
      return Promise.resolve({ rows: row ? [row] : [] });
    }

    if (sql.startsWith('insert into polyphony_runtime.perception_policy_decisions')) {
      const existing = perceptionDecisions.find((decision) => decision.requestId === params[1]);
      if (existing) {
        return Promise.resolve({ rows: [] });
      }
      const row: PerceptionPolicyDecisionRow = {
        decisionId: String(params[0]),
        requestId: String(params[1]),
        normalizedRequestHash: String(params[2]),
        stimulusId: String(params[3]),
        sourceKind: params[4] as PerceptionPolicyDecisionRow['sourceKind'],
        priority: params[5] as PerceptionPolicyDecisionRow['priority'],
        profileId: typeof params[6] === 'string' ? String(params[6]) : null,
        profileVersion: typeof params[7] === 'string' ? String(params[7]) : null,
        outcome: params[8] as PerceptionPolicyDecisionRow['outcome'],
        reasonCode: params[9] as PerceptionPolicyDecisionRow['reasonCode'],
        evidenceRefsJson: JSON.parse(String(params[10])) as string[],
        payloadJson: JSON.parse(String(params[11])) as Record<string, unknown>,
        createdAt: String(params[12]),
      };
      perceptionDecisions.push(row);
      return Promise.resolve({ rows: [row] });
    }

    if (
      sql.includes('from polyphony_runtime.perception_policy_decisions') &&
      sql.includes('where request_id = $1')
    ) {
      const row = perceptionDecisions.find((decision) => decision.requestId === params[0]);
      return Promise.resolve({ rows: row ? [row] : [] });
    }

    if (sql.startsWith('insert into polyphony_runtime.phase6_governance_events')) {
      const row: Phase6GovernanceEventRow = {
        eventId: String(params[0]),
        eventKind: params[1] as Phase6GovernanceEventRow['eventKind'],
        sourceRef: String(params[2]),
        profileId: typeof params[3] === 'string' ? String(params[3]) : null,
        profileVersion: typeof params[4] === 'string' ? String(params[4]) : null,
        decisionRef: typeof params[5] === 'string' ? String(params[5]) : null,
        payloadJson: JSON.parse(String(params[6])) as Record<string, unknown>,
        createdAt: String(params[7]),
      };
      events.push(row);
      return Promise.resolve({ rows: [row] });
    }

    if (sql.includes('from polyphony_runtime.phase6_governance_events')) {
      return Promise.resolve({ rows: sortDesc(events).slice(0, Number(params[0])) });
    }

    throw new Error(`unsupported sql in policy governance harness: ${sqlText}`);
  }) as PolicyGovernanceDbExecutor['query'];

  return {
    db: { query },
    profiles,
    activations,
    consultantDecisions,
    perceptionDecisions,
    events,
    activationLockTrace,
  };
};

void test('AC-F0025-01 / AC-F0025-02 records the conservative baseline policy profile', async () => {
  const harness = createPolicyGovernanceDbHarness();
  const store = createPolicyGovernanceStore(harness.db);

  const profile = await store.recordPolicyProfile(CONSERVATIVE_BASELINE_POLICY_PROFILE);

  assert.equal(profile.status, 'active');
  assert.equal(profile.rulesJson.externalConsultantsEnabled, false);
  assert.deepEqual(profile.governedScopesJson, [
    POLICY_GOVERNANCE_SCOPE.CONSULTANT_ADMISSION,
    POLICY_GOVERNANCE_SCOPE.PERCEPTION_INTAKE,
    POLICY_GOVERNANCE_SCOPE.HUMAN_GATE,
    POLICY_GOVERNANCE_SCOPE.PHASE6_AUTONOMY,
  ]);
});

void test('AC-F0025-03 keeps activation decisions append-only and refuses active-scope ambiguity', async () => {
  const harness = createPolicyGovernanceDbHarness();
  const store = createPolicyGovernanceStore(harness.db);
  await store.recordPolicyProfile(CONSERVATIVE_BASELINE_POLICY_PROFILE);

  const activation = await store.recordPolicyActivation({
    activationId: 'policy-activation:1',
    requestId: 'policy-activation-request:1',
    normalizedRequestHash: 'hash-1',
    profileId: CONSERVATIVE_BASELINE_POLICY_PROFILE.profileId,
    profileVersion: CONSERVATIVE_BASELINE_POLICY_PROFILE.profileVersion,
    scope: POLICY_GOVERNANCE_SCOPE.CONSULTANT_ADMISSION,
    decision: POLICY_ACTIVATION_DECISION.ACTIVATE,
    reasonCode: 'activated',
    actorRef: 'operator:1',
    evidenceRefs: ['auth:allow:1', 'governor:allow:1', 'perimeter:allow:1'],
    activatedAt: '2026-04-24T00:00:00.000Z',
    deactivatedAt: null,
    createdAt: '2026-04-24T00:00:00.000Z',
  });
  const replay = await store.recordPolicyActivation({
    activationId: 'policy-activation:2',
    requestId: 'policy-activation-request:1',
    normalizedRequestHash: 'hash-1',
    profileId: CONSERVATIVE_BASELINE_POLICY_PROFILE.profileId,
    profileVersion: CONSERVATIVE_BASELINE_POLICY_PROFILE.profileVersion,
    scope: POLICY_GOVERNANCE_SCOPE.CONSULTANT_ADMISSION,
    decision: POLICY_ACTIVATION_DECISION.ACTIVATE,
    reasonCode: 'activated',
    actorRef: 'operator:1',
    evidenceRefs: ['auth:allow:1', 'governor:allow:1', 'perimeter:allow:1'],
    activatedAt: '2026-04-24T00:00:00.000Z',
    deactivatedAt: null,
    createdAt: '2026-04-24T00:00:00.000Z',
  });

  await store.recordPolicyProfile({
    ...CONSERVATIVE_BASELINE_POLICY_PROFILE,
    profileId: 'policy.phase6.other',
    profileVersion: '2026-04-24.other',
  });
  const conflict = await store.recordPolicyActivation({
    activationId: 'policy-activation:3',
    requestId: 'policy-activation-request:2',
    normalizedRequestHash: 'hash-2',
    profileId: 'policy.phase6.other',
    profileVersion: '2026-04-24.other',
    scope: POLICY_GOVERNANCE_SCOPE.CONSULTANT_ADMISSION,
    decision: POLICY_ACTIVATION_DECISION.ACTIVATE,
    reasonCode: 'activated',
    actorRef: 'operator:1',
    evidenceRefs: ['auth:allow:1'],
    activatedAt: '2026-04-24T00:01:00.000Z',
    deactivatedAt: null,
    createdAt: '2026-04-24T00:01:00.000Z',
  });

  assert.equal(activation.accepted, true);
  assert.equal(replay.accepted, true);
  assert.equal(replay.deduplicated, true);
  assert.equal(conflict.accepted, false);
  assert.equal(conflict.reason, 'active_scope_conflict');
  assert.equal(harness.activations.length, 1);
});

void test('AC-F0025-03 serializes active-scope activation with a DB advisory lock', async () => {
  const harness = createPolicyGovernanceDbHarness({ requireActiveScopeLock: true });
  const store = createPolicyGovernanceStore(harness.db);
  await store.recordPolicyProfile(CONSERVATIVE_BASELINE_POLICY_PROFILE);

  const activation = await store.recordPolicyActivation({
    activationId: 'policy-activation:serialized',
    requestId: 'policy-activation-request:serialized',
    normalizedRequestHash: 'hash-serialized',
    profileId: CONSERVATIVE_BASELINE_POLICY_PROFILE.profileId,
    profileVersion: CONSERVATIVE_BASELINE_POLICY_PROFILE.profileVersion,
    scope: POLICY_GOVERNANCE_SCOPE.CONSULTANT_ADMISSION,
    decision: POLICY_ACTIVATION_DECISION.ACTIVATE,
    reasonCode: 'activated',
    actorRef: 'operator:1',
    evidenceRefs: ['auth:allow:1'],
    activatedAt: '2026-04-24T00:00:00.000Z',
    deactivatedAt: null,
    createdAt: '2026-04-24T00:00:00.000Z',
  });

  await store.recordPolicyProfile({
    ...CONSERVATIVE_BASELINE_POLICY_PROFILE,
    profileId: 'policy.phase6.racing',
    profileVersion: '2026-04-24.racing',
  });
  const conflict = await store.recordPolicyActivation({
    activationId: 'policy-activation:racing',
    requestId: 'policy-activation-request:racing',
    normalizedRequestHash: 'hash-racing',
    profileId: 'policy.phase6.racing',
    profileVersion: '2026-04-24.racing',
    scope: POLICY_GOVERNANCE_SCOPE.CONSULTANT_ADMISSION,
    decision: POLICY_ACTIVATION_DECISION.ACTIVATE,
    reasonCode: 'activated',
    actorRef: 'operator:2',
    evidenceRefs: ['auth:allow:2'],
    activatedAt: '2026-04-24T00:01:00.000Z',
    deactivatedAt: null,
    createdAt: '2026-04-24T00:01:00.000Z',
  });

  assert.equal(activation.accepted, true);
  assert.equal(conflict.accepted, false);
  assert.equal(conflict.reason, 'active_scope_conflict');
  assert.equal(conflict.activation.requestId, 'policy-activation-request:serialized');
  assert.deepEqual(harness.activationLockTrace, [
    `lock:${POLICY_GOVERNANCE_SCOPE.CONSULTANT_ADMISSION}`,
    `active-read:${POLICY_GOVERNANCE_SCOPE.CONSULTANT_ADMISSION}`,
    `insert:${POLICY_GOVERNANCE_SCOPE.CONSULTANT_ADMISSION}`,
    `unlock:${POLICY_GOVERNANCE_SCOPE.CONSULTANT_ADMISSION}`,
    `lock:${POLICY_GOVERNANCE_SCOPE.CONSULTANT_ADMISSION}`,
    `active-read:${POLICY_GOVERNANCE_SCOPE.CONSULTANT_ADMISSION}`,
    `unlock:${POLICY_GOVERNANCE_SCOPE.CONSULTANT_ADMISSION}`,
  ]);
  assert.equal(harness.activations.length, 1);
});

void test('AC-F0025-05 / AC-F0025-08 audits consultant and perception refusals on owned F-0025 tables', async () => {
  const harness = createPolicyGovernanceDbHarness();
  const store = createPolicyGovernanceStore(harness.db);

  const consultant = await store.recordConsultantAdmissionDecision({
    decisionId: 'consultant-decision:1',
    requestId: 'consultant-request:1',
    normalizedRequestHash: 'hash-consultant-1',
    profileId: null,
    profileVersion: null,
    consultantKind: CONSULTANT_KIND.EXTERNAL_LLM,
    targetScope: 'phase6.consult',
    decision: CONSULTANT_ADMISSION_DECISION.REFUSAL,
    reasonCode: POLICY_REFUSAL_REASON.MISSING_POLICY_PROFILE,
    selectedModelProfileId: null,
    healthRef: null,
    evidenceRefs: ['router:selection:1'],
    payloadJson: { target: 'phase6.consult' },
    createdAt: '2026-04-24T00:02:00.000Z',
  });
  const perception = await store.recordPerceptionPolicyDecision({
    decisionId: 'perception-policy:1',
    requestId: 'perception-policy-request:1',
    normalizedRequestHash: 'hash-perception-1',
    stimulusId: 'stimulus-1',
    sourceKind: 'system',
    priority: 'critical',
    profileId: null,
    profileVersion: null,
    outcome: PERCEPTION_POLICY_OUTCOME.HUMAN_GATED,
    reasonCode: POLICY_REFUSAL_REASON.MISSING_POLICY_PROFILE,
    evidenceRefs: ['stimulus:stimulus-1'],
    payloadJson: { canonicalIntakeRef: 'stimulus:stimulus-1' },
    createdAt: '2026-04-24T00:03:00.000Z',
  });

  assert.equal(consultant.accepted, true);
  assert.equal(consultant.decision.decision, 'refusal');
  assert.equal(perception.accepted, true);
  assert.equal(perception.decision.outcome, 'human_gated');
  assert.equal(harness.consultantDecisions.length, 1);
  assert.equal(harness.perceptionDecisions.length, 1);
});

void test('AC-F0025-11 exposes bounded phase-6 governance events for reporting consumers', async () => {
  const harness = createPolicyGovernanceDbHarness();
  const store = createPolicyGovernanceStore(harness.db);

  await store.recordPhase6GovernanceEvent({
    eventId: 'phase6-event:1',
    eventKind: PHASE6_GOVERNANCE_EVENT_KIND.CONSULTANT_ADMISSION_DECIDED,
    sourceRef: 'consultant-decision:1',
    profileId: null,
    profileVersion: null,
    decisionRef: 'consultant-decision:1',
    payloadJson: { reportConsumer: 'F-0023' },
    createdAt: '2026-04-24T00:04:00.000Z',
  });

  const events = await store.listPhase6GovernanceEvents({ limit: 10 });

  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventKind, 'consultant_admission_decided');
  assert.equal(events[0]?.payloadJson['reportConsumer'], 'F-0023');
});
