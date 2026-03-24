import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeModelProfileStore } from '@yaagi/db';
import { createPhase0ModelRouter, PHASE0_BASELINE_PROFILE_ID } from '../../src/runtime/index.ts';
import { createSubjectStateDbHarness } from '../../../../packages/db/testing/subject-state-db-harness.ts';

void test('AC-F0008-03 selects baseline profiles deterministically for reactive, deliberative and contemplative modes', async () => {
  const harness = createSubjectStateDbHarness();
  const store = createRuntimeModelProfileStore(harness.db);
  const router = createPhase0ModelRouter({
    fastModelBaseUrl: 'http://vllm-fast:8000/v1',
    store,
  });

  await router.ensureBaselineProfiles();

  const reactive = await router.selectProfile({
    tickMode: 'reactive',
    taskKind: 'reactive.signal',
    latencyBudget: 'tight',
    riskLevel: 'low',
    contextSize: 128,
    requiredCapabilities: ['reactive'],
    lastEvalScore: 0.92,
  });
  const deliberative = await router.selectProfile({
    tickMode: 'deliberative',
    taskKind: 'deliberative.plan',
    latencyBudget: 'normal',
    riskLevel: 'medium',
    contextSize: 2048,
    requiredCapabilities: ['deliberation'],
    lastEvalScore: 0.71,
  });
  const contemplative = await router.selectProfile({
    tickMode: 'contemplative',
    taskKind: 'contemplative.review',
    latencyBudget: 'extended',
    riskLevel: 'high',
    contextSize: 4096,
    requiredCapabilities: ['reflection'],
    lastEvalScore: 0.63,
  });

  assert.deepEqual(
    [reactive, deliberative, contemplative].map((selection) =>
      selection.accepted ? selection.modelProfileId : selection.reason,
    ),
    [
      PHASE0_BASELINE_PROFILE_ID.REFLEX,
      PHASE0_BASELINE_PROFILE_ID.DELIBERATION,
      PHASE0_BASELINE_PROFILE_ID.REFLECTION,
    ],
  );
  assert.equal(reactive.accepted && reactive.selectionReason.latencyBudget, 'tight');
  assert.equal(deliberative.accepted && deliberative.selectionReason.riskLevel, 'medium');
  assert.equal(
    contemplative.accepted && contemplative.adapterOf,
    PHASE0_BASELINE_PROFILE_ID.DELIBERATION,
  );
});

void test('AC-F0008-05 rejects unsupported or unavailable roles without silent fallback', async () => {
  const unsupportedHarness = createSubjectStateDbHarness();
  const unsupportedStore = createRuntimeModelProfileStore(unsupportedHarness.db);
  const unsupportedRouter = createPhase0ModelRouter({
    fastModelBaseUrl: 'http://vllm-fast:8000/v1',
    store: unsupportedStore,
  });

  await unsupportedRouter.ensureBaselineProfiles();

  const unsupported = await unsupportedRouter.selectProfile({
    tickMode: 'reactive',
    taskKind: 'reactive.signal',
    latencyBudget: 'tight',
    riskLevel: 'low',
    contextSize: 32,
    requestedRole: 'embedding',
  });

  assert.deepEqual(unsupported, {
    accepted: false,
    reason: 'unsupported_role',
    detail: 'requested baseline role "embedding" is not delivered in phase 0',
  });

  const unhealthyHarness = createSubjectStateDbHarness();
  const unhealthyStore = createRuntimeModelProfileStore(unhealthyHarness.db);
  const unhealthyRouter = createPhase0ModelRouter({
    fastModelBaseUrl: 'http://vllm-fast:8000/v1',
    store: unhealthyStore,
    resolveBaselineHealth: () =>
      Promise.resolve({
        reflex: { healthy: true },
        deliberation: { healthy: false, detail: 'model-fast is degraded' },
        reflection: { healthy: false, detail: 'model-fast is degraded' },
      }),
  });

  await unhealthyRouter.ensureBaselineProfiles();

  const unhealthy = await unhealthyRouter.selectProfile({
    tickMode: 'contemplative',
    taskKind: 'contemplative.review',
    latencyBudget: 'extended',
    riskLevel: 'medium',
    contextSize: 512,
  });

  assert.deepEqual(unhealthy, {
    accepted: false,
    reason: 'profile_unhealthy',
    detail: 'model-fast is degraded',
  });
});

void test('AC-F0008-06 reuses caller-provided health summaries without re-probing baseline dependencies', async () => {
  const harness = createSubjectStateDbHarness();
  const store = createRuntimeModelProfileStore(harness.db);
  let resolveBaselineHealthCalls = 0;
  const router = createPhase0ModelRouter({
    fastModelBaseUrl: 'http://vllm-fast:8000/v1',
    store,
    resolveBaselineHealth: () => {
      resolveBaselineHealthCalls += 1;
      return Promise.resolve({
        reflex: { healthy: true, detail: 'resolved reflex health' },
        deliberation: { healthy: true, detail: 'resolved deliberation health' },
        reflection: { healthy: true, detail: 'resolved reflection health' },
      });
    },
  });

  await router.ensureBaselineProfiles();
  resolveBaselineHealthCalls = 0;

  const sharedHealth = {
    healthy: true,
    detail: 'reused health verdict',
  };
  const diagnostics = await router.getBaselineDiagnostics({
    organHealth: {
      reflex: sharedHealth,
      deliberation: sharedHealth,
      reflection: sharedHealth,
    },
  });
  const selection = await router.selectProfile({
    tickMode: 'reactive',
    taskKind: 'reactive.signal',
    latencyBudget: 'tight',
    riskLevel: 'low',
    contextSize: 64,
    organHealth: {
      reflex: sharedHealth,
    },
  });

  assert.equal(resolveBaselineHealthCalls, 0);
  assert.ok(
    diagnostics.every((profile) => profile.healthSummary.detail === 'reused health verdict'),
  );
  assert.equal(selection.accepted, true);
  assert.equal(
    selection.accepted ? selection.selectionReason.health.detail : null,
    'reused health verdict',
  );
});
