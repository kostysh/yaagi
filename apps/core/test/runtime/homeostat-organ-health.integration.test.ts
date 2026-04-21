import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOMEOSTAT_ALERT_SEVERITY,
  HOMEOSTAT_SIGNAL_FAMILY,
  HOMEOSTAT_SIGNAL_STATUS,
} from '@yaagi/contracts/runtime';
import { REPORT_AVAILABILITY } from '@yaagi/contracts/reporting';
import { evaluateHomeostatSignals } from '../../src/runtime/index.ts';
import { createBaseHomeostatContext } from '../../testing/homeostat-fixture.ts';

void test('AC-F0023-05 AC-F0012-03 reads organ_error_rate from the canonical CF-015 model-health report surface when it is fresh', () => {
  const result = evaluateHomeostatSignals(
    createBaseHomeostatContext({
      organErrorRateSource: {
        reportRunId: 'report-run:model-health:1',
        materializedAt: '2026-04-21T18:30:00.000Z',
        availability: REPORT_AVAILABILITY.FRESH,
        metricValue: 0.18,
        evidenceRefs: ['report:model_health:code.deep@shared'],
      },
      futureSourceStates: {
        developmentProposalRate: 'missing',
        organErrorRate: 'available',
        rollbackFrequency: 'missing',
      },
    }),
  );

  const score = result.snapshot.signalScores.find(
    (entry) => entry.signalFamily === HOMEOSTAT_SIGNAL_FAMILY.ORGAN_ERROR_RATE,
  );

  assert.equal(score?.status, HOMEOSTAT_SIGNAL_STATUS.EVALUATED);
  assert.equal(score?.metricValue, 0.18);
  assert.equal(score?.severity, HOMEOSTAT_ALERT_SEVERITY.CRITICAL);
  assert.deepEqual(score?.evidenceRefs, ['report:model_health:code.deep@shared']);
});

void test('AC-F0023-12 keeps organ_error_rate degraded when the canonical report surface is present but not fresh enough for authoritative scoring', () => {
  const result = evaluateHomeostatSignals(
    createBaseHomeostatContext({
      organErrorRateSource: {
        reportRunId: 'report-run:model-health:2',
        materializedAt: '2026-04-21T18:31:00.000Z',
        availability: REPORT_AVAILABILITY.DEGRADED,
        metricValue: 0.07,
        evidenceRefs: ['report:model_health:reflex.fast@shared'],
      },
      futureSourceStates: {
        developmentProposalRate: 'missing',
        organErrorRate: 'available',
        rollbackFrequency: 'missing',
      },
    }),
  );

  const score = result.snapshot.signalScores.find(
    (entry) => entry.signalFamily === HOMEOSTAT_SIGNAL_FAMILY.ORGAN_ERROR_RATE,
  );

  assert.equal(score?.status, HOMEOSTAT_SIGNAL_STATUS.DEGRADED);
  assert.equal(score?.metricValue, 0.07);
  assert.equal(score?.severity, HOMEOSTAT_ALERT_SEVERITY.NONE);
  assert.deepEqual(score?.evidenceRefs, ['report:model_health:reflex.fast@shared']);
});
