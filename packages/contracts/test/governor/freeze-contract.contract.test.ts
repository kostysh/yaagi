import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVELOPMENT_FREEZE_STATE,
  DEVELOPMENT_FREEZE_TRIGGER_KIND,
  DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE,
  developmentFreezeCommandSchema,
  developmentFreezeResultSchema,
} from '../../src/governor.ts';
import { operatorFreezeDevelopmentRequestSchema } from '../../src/operator-api.ts';

void test('AC-F0016-01 defines the canonical development freeze command contract', () => {
  const command = developmentFreezeCommandSchema.parse({
    requestId: 'freeze-request-1',
    triggerKind: DEVELOPMENT_FREEZE_TRIGGER_KIND.OPERATOR,
    originSurface: DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.OPERATOR_API,
    requestedBy: 'operator_api',
    reason: 'pause development proposal intake',
    evidenceRefs: ['operator:manual-control'],
    requestedAt: '2026-04-10T12:00:00.000Z',
  });

  assert.deepEqual(command, {
    requestId: 'freeze-request-1',
    triggerKind: 'operator',
    originSurface: 'operator_api',
    requestedBy: 'operator_api',
    reason: 'pause development proposal intake',
    evidenceRefs: ['operator:manual-control'],
    requestedAt: '2026-04-10T12:00:00.000Z',
  });
});

void test('AC-F0016-02 keeps the operator freeze request payload small and replayable', () => {
  const parsed = operatorFreezeDevelopmentRequestSchema.parse({
    requestId: 'operator-freeze-1',
    reason: 'manual freeze',
  });

  assert.deepEqual(parsed, {
    requestId: 'operator-freeze-1',
    reason: 'manual freeze',
    evidenceRefs: [],
  });
});

void test('AC-F0016-01 exposes deterministic freeze result shapes for downstream callers', () => {
  const accepted = developmentFreezeResultSchema.parse({
    accepted: true,
    requestId: 'freeze-request-1',
    freezeId: 'development-freeze:1',
    state: DEVELOPMENT_FREEZE_STATE.FROZEN,
    triggerKind: DEVELOPMENT_FREEZE_TRIGGER_KIND.POLICY_AUTO,
    decisionOrigin: DEVELOPMENT_FREEZE_TRIGGER_KIND.POLICY_AUTO,
    deduplicated: false,
    createdAt: '2026-04-10T12:00:00.000Z',
  });
  const rejected = developmentFreezeResultSchema.parse({
    accepted: false,
    requestId: 'freeze-request-1',
    reason: 'conflicting_request_id',
  });

  assert.ok(accepted.accepted);
  assert.ok(!rejected.accepted);
  assert.equal(accepted.state, 'frozen');
  assert.equal(accepted.triggerKind, 'policy_auto');
  assert.equal(accepted.decisionOrigin, 'policy_auto');
  assert.equal(rejected.reason, 'conflicting_request_id');
});
