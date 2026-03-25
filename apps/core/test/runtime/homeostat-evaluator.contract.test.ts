import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOMEOSTAT_ALERT_SEVERITY,
  HOMEOSTAT_SIGNAL_FAMILY,
  HOMEOSTAT_SIGNAL_STATUS,
} from '@yaagi/contracts/runtime';
import { evaluateHomeostatSignals } from '../../src/runtime/index.ts';
import { createBaseHomeostatContext } from '../../testing/homeostat-fixture.ts';

void test('AC-F0012-02 evaluates the full starter guardrail matrix from canonical source mappings', () => {
  const result = evaluateHomeostatSignals(createBaseHomeostatContext());

  assert.equal(result.snapshot.signalScores.length, 8);
  assert.deepEqual(
    result.snapshot.signalScores.map((score) => score.signalFamily),
    [
      HOMEOSTAT_SIGNAL_FAMILY.AFFECT_VOLATILITY,
      HOMEOSTAT_SIGNAL_FAMILY.GOAL_CHURN,
      HOMEOSTAT_SIGNAL_FAMILY.COALITION_DOMINANCE,
      HOMEOSTAT_SIGNAL_FAMILY.NARRATIVE_REWRITE_RATE,
      HOMEOSTAT_SIGNAL_FAMILY.DEVELOPMENT_PROPOSAL_RATE,
      HOMEOSTAT_SIGNAL_FAMILY.RESOURCE_PRESSURE,
      HOMEOSTAT_SIGNAL_FAMILY.ORGAN_ERROR_RATE,
      HOMEOSTAT_SIGNAL_FAMILY.ROLLBACK_FREQUENCY,
    ],
  );

  const affectVolatility = result.snapshot.signalScores.find(
    (score) => score.signalFamily === HOMEOSTAT_SIGNAL_FAMILY.AFFECT_VOLATILITY,
  );
  const resourcePressure = result.snapshot.signalScores.find(
    (score) => score.signalFamily === HOMEOSTAT_SIGNAL_FAMILY.RESOURCE_PRESSURE,
  );
  const developmentProposalRate = result.snapshot.signalScores.find(
    (score) => score.signalFamily === HOMEOSTAT_SIGNAL_FAMILY.DEVELOPMENT_PROPOSAL_RATE,
  );

  assert.equal(affectVolatility?.status, HOMEOSTAT_SIGNAL_STATUS.EVALUATED);
  assert.equal(affectVolatility?.severity, HOMEOSTAT_ALERT_SEVERITY.CRITICAL);
  assert.ok((affectVolatility?.metricValue ?? 0) > 0.7);
  assert.equal(resourcePressure?.status, HOMEOSTAT_SIGNAL_STATUS.EVALUATED);
  assert.equal(resourcePressure?.severity, HOMEOSTAT_ALERT_SEVERITY.WARNING);
  assert.equal(developmentProposalRate?.status, HOMEOSTAT_SIGNAL_STATUS.NOT_EVALUABLE);
  assert.equal(developmentProposalRate?.metricValue, null);
});

void test('AC-F0012-06 persists a stable snapshot shape for replay and read-only downstream consumption', () => {
  const result = evaluateHomeostatSignals(createBaseHomeostatContext());

  assert.equal(result.snapshot.cadenceKind, 'tick_complete');
  assert.equal(result.snapshot.tickId, 'tick-homeostat-1');
  assert.equal(typeof result.snapshot.overallStability, 'number');
  assert.equal(typeof result.snapshot.createdAt, 'string');
  assert.ok(result.snapshot.overallStability >= 0);
  assert.ok(result.snapshot.overallStability <= 1);
  assert.ok(result.snapshot.alerts.length >= 1);
  assert.ok(result.reactions.length >= 1);
});
