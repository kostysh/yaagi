import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIFECYCLE_EVENT_TYPE,
  LIFECYCLE_FOREIGN_WRITE_SURFACE,
  LIFECYCLE_OWNED_WRITE_SURFACE,
  LIFECYCLE_SOURCE_OWNER,
  assertLifecycleOwnedWriteSurface,
  assertValidLifecycleEventEnvelope,
  isConsolidationTransitionClass,
} from '../src/lifecycle.ts';

void test('AC-F0019-03 AC-F0019-04 validates required lifecycle event envelope fields', () => {
  assert.doesNotThrow(() =>
    assertValidLifecycleEventEnvelope({
      eventId: 'event-1',
      eventType: LIFECYCLE_EVENT_TYPE.ROLLBACK_INCIDENT_RECORDED,
      occurredAt: '2026-04-15T12:00:00.000Z',
      sourceOwner: LIFECYCLE_SOURCE_OWNER.CONSOLIDATION,
      subjectRef: 'runtime:polyphony-core',
      schemaVersion: '018_lifecycle_consolidation.sql',
      idempotencyKey: 'event-1',
      evidenceRefs: ['tick:tick-1'],
      payload: { rollbackRef: 'body:snapshot-1' },
    }),
  );

  assert.throws(
    () =>
      assertValidLifecycleEventEnvelope({
        eventId: 'event-2',
        eventType: LIFECYCLE_EVENT_TYPE.ROLLBACK_INCIDENT_RECORDED,
        occurredAt: '2026-04-15T12:00:00.000Z',
        sourceOwner: LIFECYCLE_SOURCE_OWNER.CONSOLIDATION,
        subjectRef: 'runtime:polyphony-core',
        schemaVersion: '018_lifecycle_consolidation.sql',
        idempotencyKey: 'event-2',
        evidenceRefs: [],
        payload: {},
      }),
    /requires evidenceRefs/,
  );
});

void test('AC-F0019-02 distinguishes F-0019 owned write surfaces from foreign owner surfaces', () => {
  assert.doesNotThrow(() =>
    assertLifecycleOwnedWriteSurface(LIFECYCLE_OWNED_WRITE_SURFACE.LIFECYCLE_EVENTS),
  );

  assert.throws(
    () => assertLifecycleOwnedWriteSurface(LIFECYCLE_FOREIGN_WRITE_SURFACE.TICKS),
    /foreign_owner_write_rejected/,
  );
});

void test('AC-F0019-07 exposes the first-phase consolidation transition allowlist', () => {
  assert.equal(isConsolidationTransitionClass('promote_memetic_unit'), true);
  assert.equal(isConsolidationTransitionClass('rewrite_subject_state'), false);
});
