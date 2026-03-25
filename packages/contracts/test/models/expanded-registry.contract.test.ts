import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPANDED_MODEL_ROLE,
  EXPANDED_MODEL_SERVICE_ID,
  type ModelOrganHealthReportInput,
  type OperatorRicherRegistryHealthSummary,
} from '../../src/models.ts';

void test('AC-F0014-01 expanded registry is the only canonical richer-model owner surface', () => {
  assert.deepEqual(Object.values(EXPANDED_MODEL_ROLE), [
    'code',
    'embedding',
    'reranker',
    'classifier',
    'safety',
  ]);
  assert.deepEqual(Object.values(EXPANDED_MODEL_SERVICE_ID), ['vllm-deep', 'vllm-pool']);

  const summary: OperatorRicherRegistryHealthSummary = {
    available: true,
    owner: 'F-0014',
    generatedAt: '2026-03-25T20:00:00.000Z',
    organs: [
      {
        modelProfileId: 'code.deep@shared',
        role: 'code',
        serviceId: 'vllm-deep',
        availability: 'available',
        quarantineState: 'clear',
        fallbackTargetProfileId: null,
        errorRate: 0,
        latencyMsP95: 140,
      },
    ],
  };
  const reportInput: ModelOrganHealthReportInput = {
    generatedAt: summary.generatedAt ?? '2026-03-25T20:00:00.000Z',
    profiles: summary.organs.map((organ) => ({ ...organ })),
  };

  assert.equal(summary.owner, 'F-0014');
  assert.ok(
    summary.organs.every((organ) => !['reflex', 'deliberation', 'reflection'].includes(organ.role)),
  );
  assert.deepEqual(reportInput.profiles, summary.organs);
});
