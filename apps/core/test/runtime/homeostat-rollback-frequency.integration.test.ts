import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOMEOSTAT_ALERT_SEVERITY,
  HOMEOSTAT_SIGNAL_FAMILY,
  HOMEOSTAT_SIGNAL_STATUS,
} from '@yaagi/contracts/runtime';
import { evaluateHomeostatSignals } from '../../src/runtime/index.ts';
import { createBaseHomeostatContext } from '../../testing/homeostat-fixture.ts';

void test('AC-F0019-16 evaluates rollback_frequency from canonical lifecycle evidence', () => {
  const result = evaluateHomeostatSignals(
    createBaseHomeostatContext({
      rollbackFrequencySource: {
        metricValue: 3,
        rollbackIncidentCount: 3,
        gracefulShutdownEvidenceCount: 1,
        evidenceRefs: [
          'rollback_incident:rollback-1',
          'rollback_incident:rollback-2',
          'rollback_incident:rollback-3',
          'graceful_shutdown:shutdown-1',
        ],
      },
    }),
  );

  const score = result.snapshot.signalScores.find(
    (entry) => entry.signalFamily === HOMEOSTAT_SIGNAL_FAMILY.ROLLBACK_FREQUENCY,
  );

  assert.equal(score?.status, HOMEOSTAT_SIGNAL_STATUS.EVALUATED);
  assert.equal(score?.metricValue, 3);
  assert.equal(score?.severity, HOMEOSTAT_ALERT_SEVERITY.WARNING);
  assert.deepEqual(score?.evidenceRefs.sort(), [
    'graceful_shutdown:shutdown-1',
    'rollback_incident:rollback-1',
    'rollback_incident:rollback-2',
    'rollback_incident:rollback-3',
  ]);
});

void test('AC-F0019-17 keeps rollback_frequency degraded instead of inventing proxy evidence', () => {
  const result = evaluateHomeostatSignals(
    createBaseHomeostatContext({
      rollbackFrequencySource: null,
      futureSourceStates: {
        developmentProposalRate: 'missing',
        organErrorRate: 'missing',
        rollbackFrequency: 'available',
      },
    }),
  );

  const score = result.snapshot.signalScores.find(
    (entry) => entry.signalFamily === HOMEOSTAT_SIGNAL_FAMILY.ROLLBACK_FREQUENCY,
  );

  assert.equal(score?.status, HOMEOSTAT_SIGNAL_STATUS.DEGRADED);
  assert.equal(score?.metricValue, null);
  assert.deepEqual(score?.evidenceRefs, ['future:CF-018:rollback-evidence']);
});
