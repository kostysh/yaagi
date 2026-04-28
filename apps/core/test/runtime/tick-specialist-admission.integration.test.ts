import test from 'node:test';
import assert from 'node:assert/strict';
import { createTickRuntimeStore, TICK_STATUS } from '@yaagi/db';
import { createPhase0TickExecution } from '../../src/runtime/index.ts';
import { createSpecialistPolicyTestHarness } from '../../testing/specialist-policy-fixture.ts';
import { createTickRuntimeHarness } from '../../testing/tick-runtime-harness.ts';
import { createSubjectStateDbHarness } from '../../../../packages/db/testing/subject-state-db-harness.ts';

void test('AC-F0027-07 / AC-F0027-08 records specialist admission outcome before tick completion', async () => {
  const specialist = await createSpecialistPolicyTestHarness({ policy: { trafficLimit: 2 } });
  const tickHarness = createTickRuntimeHarness({
    now: () => '2026-04-28T10:00:00.000Z',
    executeTick: async (tick) => {
      const admission = await specialist.service.admitSpecialist(
        specialist.admissionInput({
          requestId: `specialist-admission:${tick.tickId}`,
        }),
      );

      return {
        status: 'completed',
        summary: 'tick evaluated specialist admission',
        result: {
          specialistAdmissionAccepted: admission.accepted,
          admissionDecisionId: admission.decision.decisionId,
        },
      };
    },
  });
  await tickHarness.runtime.start();

  const tick = await tickHarness.runtime.requestTick({
    requestId: 'tick-specialist-admission',
    kind: 'reactive',
    trigger: 'system',
    requestedAt: '2026-04-28T10:00:00.000Z',
    payload: { taskSignature: 'summarize.incident' },
  });

  assert.equal(tick.accepted, true);
  assert.equal(tickHarness.episodes.length, 2);
  assert.equal(tickHarness.episodes.at(-1)?.result['specialistAdmissionAccepted'], true);
  assert.equal(Object.values(specialist.dbHarness.state.admissionsById).length, 2);
});

void test('AC-F0027-02 wires specialist admission into tick execution before decision invocation', async () => {
  const specialist = await createSpecialistPolicyTestHarness({ policy: { trafficLimit: 2 } });
  const subject = createSubjectStateDbHarness();
  const tickStore = createTickRuntimeStore(subject.db);
  let decisionProfileId: string | null = null;
  let persistedProfileId: string | null = null;
  const executeTick = createPhase0TickExecution({
    selectProfile: () =>
      Promise.resolve({
        accepted: true,
        modelProfileId: 'deliberation.fast@baseline',
        role: 'deliberation',
        endpoint: 'http://vllm-fast:8000/v1',
        adapterOf: null,
        selectionReason: {
          tickMode: 'deliberative',
          taskKind: 'summarize.incident',
          latencyBudget: 'normal',
          riskLevel: 'low',
          contextSize: 64,
          requiredCapabilities: [],
          lastEvalScore: null,
          health: { healthy: true },
        },
      }),
    admitSpecialistSelection: (input) =>
      specialist.service.admitSpecialist(input).then((admission) =>
        admission.accepted && !admission.deduplicated
          ? {
              accepted: true as const,
              specialistId: input.specialistId,
              modelProfileId: admission.decision.selectedModelProfileId ?? input.specialistId,
              admissionDecisionId: admission.decision.decisionId,
              stage: admission.decision.stage ?? admission.policy.allowedStage,
              selectionReason: {
                taskSignature: input.taskSignature,
                policyId: admission.policy.policyId,
                admissionDecisionId: admission.decision.decisionId,
              },
            }
          : {
              accepted: false as const,
              reason: 'specialist_admission_refused',
              detail: admission.accepted ? 'replayed admission' : admission.refusal.detail,
              specialistId: input.specialistId,
              remapped: false as const,
              fallbackTargetProfileId: admission.decision.fallbackTargetProfileId,
              admissionDecisionId: admission.decision.decisionId,
            },
      ),
    resolveModelProfileById: (modelProfileId) =>
      Promise.resolve({
        modelProfileId,
        role: 'deliberation',
        serviceId: 'vllm-fast',
        endpoint: 'http://vllm-fast:8000/v1',
        artifactUri: 'file:///tmp/models/summary-specialist/artifact.json',
        baseModel: 'model-fast',
        adapterOf: null,
        capabilitiesJson: ['summarization'],
        costJson: {},
        healthJson: {},
        status: 'active',
        createdAt: '2026-04-28T10:00:00.000Z',
        updatedAt: '2026-04-28T10:00:00.000Z',
      }),
    persistTickModelSelection: (input) => {
      persistedProfileId = input.modelProfileId;
      return Promise.resolve();
    },
    prepareReactiveTick: (tickId) =>
      Promise.resolve({
        claimedStimulusIds: [],
        highestPriority: null,
        items: [],
        sourceKinds: [],
        requiresImmediateTick: false,
        tickId,
      }),
    loadSubjectStateSnapshot: (input) => tickStore.loadSubjectStateSnapshot(input),
    listRecentEpisodes: (input) => tickStore.listRecentEpisodes(input),
    runDecision: (input) => {
      decisionProfileId = input.selectedProfile.modelProfileId;
      return Promise.resolve({
        accepted: true,
        decision: {
          observations: ['specialist admitted before decision'],
          interpretations: ['tick execution used the admitted specialist profile'],
          action: { type: 'none', summary: 'no action' },
          episode: { summary: 'specialist admission executed', importance: 0.2 },
          developmentHints: [],
        },
      });
    },
    handleDecisionAction: () =>
      Promise.resolve({
        accepted: true as const,
        actionId: 'action-specialist-admission',
        verdictKind: 'conscious_inaction',
        boundaryCheck: {
          allowed: true,
          reason: 'test executive accepted no-op',
        },
        resultJson: {},
      }),
  });

  const terminal = await executeTick({
    tickId: 'tick-specialist-execution',
    kind: 'deliberative',
    trigger: 'system',
    requestId: 'request-specialist-execution',
    requestedAt: '2026-04-28T10:00:00.000Z',
    payload: {
      taskKind: 'summarize.incident',
      specialistAdmission: {
        requestId: 'admission-tick-execution',
        specialistId: 'specialist.summary@v1',
        taskSignature: 'summarize.incident',
        selectedModelProfileId: 'summary.specialist@v1',
        evidenceRefs: {
          governorDecisionRef: 'governor:allow:1',
          servingReadinessRef: 'serving:vllm-fast:ready:1',
          releaseEvidenceRef: 'release:evidence:1',
          healthRef: 'health:ready:1',
          fallbackReadinessRef: 'fallback:ready:1',
        },
      },
    },
  });

  assert.equal(terminal.status, TICK_STATUS.COMPLETED);
  assert.equal(persistedProfileId, 'summary.specialist@v1');
  assert.equal(decisionProfileId, 'summary.specialist@v1');
  assert.equal(Object.values(specialist.dbHarness.state.admissionsById).length, 1);
});
