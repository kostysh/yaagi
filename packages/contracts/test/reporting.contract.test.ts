import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REPORTING_FOREIGN_WRITE_SURFACE,
  REPORTING_OWNED_WRITE_SURFACE,
  REPORT_AVAILABILITY,
  REPORT_FAMILY,
  REPORT_PUBLICATION_STATUS,
  REPORT_SOURCE_OWNER,
  assertReportingOwnedWriteSurface,
  assertValidReportRun,
  type IdentityContinuityReport,
  type ModelHealthReport,
} from '../src/reporting.ts';

void test('AC-F0023-01 AC-F0023-10 exposes the canonical report family and availability taxonomy', () => {
  assert.deepEqual(Object.values(REPORT_FAMILY), [
    'identity_continuity',
    'model_health',
    'stable_snapshot_inventory',
    'development_diagnostics',
    'lifecycle_diagnostics',
  ]);
  assert.deepEqual(Object.values(REPORT_AVAILABILITY), [
    'fresh',
    'degraded',
    'not_evaluable',
    'unavailable',
  ]);
});

void test('AC-F0023-01 AC-F0023-03 distinguishes CF-015 owned write surfaces from foreign source tables', () => {
  assert.doesNotThrow(() =>
    assertReportingOwnedWriteSurface(REPORTING_OWNED_WRITE_SURFACE.REPORT_RUNS),
  );

  assert.throws(
    () => assertReportingOwnedWriteSurface(REPORTING_FOREIGN_WRITE_SURFACE.SUBJECT_STATE),
    /foreign_owner_write_rejected/,
  );
  assert.throws(
    () =>
      assertReportingOwnedWriteSurface(REPORTING_FOREIGN_WRITE_SURFACE.TELEGRAM_EGRESS_MESSAGES),
    /foreign_owner_write_rejected/,
  );
});

void test('AC-F0023-10 AC-F0023-15 validates report-run provenance and publication metadata', () => {
  assert.doesNotThrow(() =>
    assertValidReportRun({
      reportRunId: 'report-run-1',
      reportFamily: REPORT_FAMILY.IDENTITY_CONTINUITY,
      sourceRefs: ['tick:tick-1', 'snapshot:snapshot-1', 'telegram-egress:action-1'],
      sourceOwnerRefs: [
        REPORT_SOURCE_OWNER.TICK_RUNTIME,
        REPORT_SOURCE_OWNER.BODY_EVOLUTION,
        REPORT_SOURCE_OWNER.TELEGRAM_EGRESS,
      ],
      sourceSnapshotSignature: 'sig:identity:1',
      materializedAt: '2026-04-21T16:30:00.000Z',
      availabilityStatus: REPORT_AVAILABILITY.FRESH,
      schemaVersion: '019_reporting_foundation.sql',
      publication: {
        metrics: {
          status: REPORT_PUBLICATION_STATUS.PUBLISHED,
          publishedAt: '2026-04-21T16:30:01.000Z',
          ref: 'metric:identity_continuity',
          detail: null,
        },
      },
    }),
  );

  assert.throws(
    () =>
      assertValidReportRun({
        reportRunId: 'report-run-2',
        reportFamily: REPORT_FAMILY.MODEL_HEALTH,
        sourceRefs: ['model:profile-health-1'],
        sourceOwnerRefs: [
          'CF-015' as (typeof REPORT_SOURCE_OWNER)[keyof typeof REPORT_SOURCE_OWNER],
        ],
        sourceSnapshotSignature: 'sig:model:1',
        materializedAt: '2026-04-21T16:31:00.000Z',
        availabilityStatus: REPORT_AVAILABILITY.DEGRADED,
        schemaVersion: '019_reporting_foundation.sql',
        publication: {},
      }),
    /sourceOwnerRefs must contain only canonical owners/,
  );
});

void test('AC-F0023-01 AC-F0023-15 defines typed compact read contracts for identity continuity and model health', () => {
  const identityReport: IdentityContinuityReport = {
    reportRunId: 'report-run-identity-1',
    reportFamily: REPORT_FAMILY.IDENTITY_CONTINUITY,
    sourceRefs: ['tick:tick-1', 'snapshot:snapshot-1'],
    sourceOwnerRefs: [REPORT_SOURCE_OWNER.TICK_RUNTIME, REPORT_SOURCE_OWNER.BODY_EVOLUTION],
    availability: REPORT_AVAILABILITY.FRESH,
    materializedAt: '2026-04-21T16:30:00.000Z',
    runtimeMode: 'live',
    currentTickRef: 'tick:tick-1',
    lastStableSnapshotRef: 'snapshot:snapshot-1',
    recentRecoveryRefs: ['recovery:incident-1'],
  };

  const modelHealthReport: ModelHealthReport = {
    reportRunId: 'report-run-model-1',
    reportFamily: REPORT_FAMILY.MODEL_HEALTH,
    sourceRefs: ['model-health:model-1'],
    sourceOwnerRefs: [
      REPORT_SOURCE_OWNER.BASELINE_MODEL_ROUTING,
      REPORT_SOURCE_OWNER.EXPANDED_MODEL_ECOLOGY,
    ],
    availability: REPORT_AVAILABILITY.DEGRADED,
    materializedAt: '2026-04-21T16:31:00.000Z',
    organId: 'reflection',
    profileId: 'reflection.deep@shared',
    healthStatus: 'degraded',
    errorRate: 0.12,
    fallbackRef: 'fallback:reflection->deliberation',
    sourceSurfaceRefs: ['profile-health:reflection.deep@shared'],
  };

  assert.equal(identityReport.runtimeMode, 'live');
  assert.equal(modelHealthReport.healthStatus, 'degraded');
});
