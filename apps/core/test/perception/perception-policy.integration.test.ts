import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PERCEPTION_POLICY_OUTCOME,
  POLICY_REFUSAL_REASON,
  type PerceptionPolicyDecisionRow,
} from '@yaagi/contracts/policy-governance';
import { createPerceptionController } from '../../src/perception/index.ts';
import {
  buildPerceptionTestConfig,
  createPerceptionTestWorkspace,
} from '../../testing/perception-config.ts';
import { createPerceptionStoreHarness } from '../../testing/perception-store-harness.ts';

const policyDecisionFor = (
  stimulusId: string,
  outcome: PerceptionPolicyDecisionRow['outcome'],
): PerceptionPolicyDecisionRow => ({
  decisionId: `perception-policy:${stimulusId}`,
  requestId: `perception-policy:${stimulusId}`,
  normalizedRequestHash: `hash:${stimulusId}:${outcome}`,
  stimulusId,
  sourceKind: 'http',
  priority: 'critical',
  profileId: outcome === PERCEPTION_POLICY_OUTCOME.ACCEPTED ? 'policy.phase6.baseline' : null,
  profileVersion:
    outcome === PERCEPTION_POLICY_OUTCOME.ACCEPTED ? '2026-04-24.phase6-conservative' : null,
  outcome,
  reasonCode:
    outcome === PERCEPTION_POLICY_OUTCOME.ACCEPTED
      ? 'policy_matched'
      : POLICY_REFUSAL_REASON.MISSING_POLICY_PROFILE,
  evidenceRefsJson: [`stimulus:${stimulusId}`],
  payloadJson: {
    canonicalIntakeRef: `stimulus:${stimulusId}`,
  },
  createdAt: '2026-04-24T12:00:00.000Z',
});

void test('AC-F0025-08 records perception policy classification over canonical stimulus_inbox refs before reactive tick', async () => {
  const workspace = await createPerceptionTestWorkspace();
  const storeHarness = createPerceptionStoreHarness();
  const admissions: Array<Record<string, unknown>> = [];
  const policyDecisions: PerceptionPolicyDecisionRow[] = [];
  const controller = createPerceptionController({
    config: buildPerceptionTestConfig(workspace.root),
    store: storeHarness.store,
    requestReactiveTick: (input) => {
      admissions.push(input);
      return Promise.resolve({
        accepted: true,
        tickId: 'tick-reactive-1',
      });
    },
    policyGovernance: {
      enforcePerceptionPolicy: (input) => {
        const decision = policyDecisionFor(
          input.stimulus.stimulusId,
          PERCEPTION_POLICY_OUTCOME.HUMAN_GATED,
        );
        policyDecisions.push(decision);
        return Promise.resolve(decision);
      },
    },
    now: () => '2026-04-24T12:00:00.000Z',
    createId: () => 'stimulus-policy-1',
  });

  try {
    const result = await controller.ingestHttpStimulus({
      signalType: 'http.operator.message',
      priority: 'critical',
      requiresImmediateTick: true,
      payload: {
        text: 'policy gated',
      },
      dedupeKey: 'http:policy:gated',
    });

    assert.equal(result.stimulusId, 'stimulus-policy-1');
    assert.equal(result.policyDecision?.outcome, PERCEPTION_POLICY_OUTCOME.HUMAN_GATED);
    assert.equal(result.tickAdmission, undefined);
    assert.equal(admissions.length, 0);
    assert.equal(policyDecisions.length, 1);
    assert.ok(storeHarness.stimuli.get('stimulus-policy-1'));
    assert.equal(storeHarness.stimuli.get('stimulus-policy-1')?.status, 'queued');
  } finally {
    await controller.stop();
    await workspace.cleanup();
  }
});

void test('AC-F0025-08 permits reactive tick only when perception policy accepts canonical intake', async () => {
  const workspace = await createPerceptionTestWorkspace();
  const storeHarness = createPerceptionStoreHarness();
  const admissions: Array<Record<string, unknown>> = [];
  const controller = createPerceptionController({
    config: buildPerceptionTestConfig(workspace.root),
    store: storeHarness.store,
    requestReactiveTick: (input) => {
      admissions.push(input);
      return Promise.resolve({
        accepted: true,
        tickId: 'tick-reactive-accepted',
      });
    },
    policyGovernance: {
      enforcePerceptionPolicy: (input) =>
        Promise.resolve(
          policyDecisionFor(input.stimulus.stimulusId, PERCEPTION_POLICY_OUTCOME.ACCEPTED),
        ),
    },
    now: () => '2026-04-24T12:01:00.000Z',
    createId: () => 'stimulus-policy-2',
  });

  try {
    const result = await controller.ingestHttpStimulus({
      signalType: 'http.operator.message',
      priority: 'critical',
      requiresImmediateTick: true,
      payload: {
        text: 'policy accepted',
      },
      dedupeKey: 'http:policy:accepted',
    });

    assert.equal(result.policyDecision?.outcome, PERCEPTION_POLICY_OUTCOME.ACCEPTED);
    assert.equal(result.tickAdmission?.accepted, true);
    assert.equal(admissions.length, 1);
    assert.deepEqual(admissions[0]?.['payload'], {
      source: 'perception',
      rootStimulusId: 'stimulus-policy-2',
      sourceKinds: ['http'],
    });
  } finally {
    await controller.stop();
    await workspace.cleanup();
  }
});
