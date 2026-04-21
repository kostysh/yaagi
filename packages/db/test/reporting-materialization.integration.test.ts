import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REPORT_AVAILABILITY,
  REPORT_FAMILY,
  REPORT_PUBLICATION_STATUS,
  REPORT_SOURCE_OWNER,
} from '@yaagi/contracts/reporting';
import { createReportingDbHarness } from '../testing/reporting-db-harness.ts';
import { createReportingStore } from '../src/reporting.ts';

void test('AC-F0023-04 AC-F0023-07 AC-F0023-08 AC-F0023-09 materializes and reads the first-phase report families through report-run provenance', async () => {
  const harness = createReportingDbHarness();
  const store = createReportingStore(harness.db);

  const identityRun = await store.recordReportRun({
    reportRunId: 'report-run:identity',
    reportFamily: REPORT_FAMILY.IDENTITY_CONTINUITY,
    sourceRefs: ['agent_state:polyphony-core', 'tick:tick-1'],
    sourceOwnerRefs: [REPORT_SOURCE_OWNER.TICK_RUNTIME, REPORT_SOURCE_OWNER.BOOT_RECOVERY],
    sourceSnapshotSignature: 'sig:identity',
    materializedAt: '2026-04-21T18:00:00.000Z',
    availabilityStatus: REPORT_AVAILABILITY.FRESH,
    schemaVersion: '019_reporting_foundation.sql',
    publication: {},
  });
  assert.equal(identityRun.accepted, true);
  if (!identityRun.accepted) {
    return;
  }

  await store.upsertIdentityContinuityReport({
    reportRunId: identityRun.reportRun.reportRunId,
    reportFamily: REPORT_FAMILY.IDENTITY_CONTINUITY,
    sourceRefs: identityRun.reportRun.sourceRefsJson,
    sourceOwnerRefs: identityRun.reportRun.sourceOwnerRefsJson,
    availability: REPORT_AVAILABILITY.FRESH,
    materializedAt: identityRun.reportRun.materializedAt,
    runtimeMode: 'live',
    currentTickRef: 'tick:tick-1',
    lastStableSnapshotRef: 'stable_snapshot:snapshot-1',
    recentRecoveryRefs: ['rollback_incident:rollback-1'],
  });

  const stableRun = await store.recordReportRun({
    reportRunId: 'report-run:stable',
    reportFamily: REPORT_FAMILY.STABLE_SNAPSHOT_INVENTORY,
    sourceRefs: ['stable_snapshot:snapshot-1'],
    sourceOwnerRefs: [REPORT_SOURCE_OWNER.BODY_EVOLUTION, REPORT_SOURCE_OWNER.BOOT_RECOVERY],
    sourceSnapshotSignature: 'sig:stable',
    materializedAt: '2026-04-21T18:01:00.000Z',
    availabilityStatus: REPORT_AVAILABILITY.FRESH,
    schemaVersion: '019_reporting_foundation.sql',
    publication: {},
  });
  assert.equal(stableRun.accepted, true);
  if (!stableRun.accepted) {
    return;
  }

  await store.upsertStableSnapshotInventoryReport({
    reportRunId: stableRun.reportRun.reportRunId,
    reportFamily: REPORT_FAMILY.STABLE_SNAPSHOT_INVENTORY,
    sourceRefs: stableRun.reportRun.sourceRefsJson,
    sourceOwnerRefs: stableRun.reportRun.sourceOwnerRefsJson,
    availability: REPORT_AVAILABILITY.FRESH,
    materializedAt: stableRun.reportRun.materializedAt,
    latestStableSnapshotRef: 'stable_snapshot:snapshot-1',
    totalSnapshots: 1,
    snapshots: [
      {
        snapshotRef: 'stable_snapshot:snapshot-1',
        proposalId: 'proposal-1',
        gitTag: 'stable/v1',
        schemaVersion: '2026-04-21',
        isCurrentStable: true,
        createdAt: '2026-04-21T17:59:00.000Z',
        rollbackAnchorRefs: ['stable_snapshot:snapshot-1'],
        modelProfileMap: {
          reflex: 'reflex.fast@shared',
        },
      },
    ],
  });

  const developmentRun = await store.recordReportRun({
    reportRunId: 'report-run:development',
    reportFamily: REPORT_FAMILY.DEVELOPMENT_DIAGNOSTICS,
    sourceRefs: ['development_ledger:ledger-1', 'action_log:action-1'],
    sourceOwnerRefs: [REPORT_SOURCE_OWNER.ACTION_AUDIT, REPORT_SOURCE_OWNER.DEVELOPMENT_GOVERNOR],
    sourceSnapshotSignature: 'sig:development',
    materializedAt: '2026-04-21T18:02:00.000Z',
    availabilityStatus: REPORT_AVAILABILITY.FRESH,
    schemaVersion: '019_reporting_foundation.sql',
    publication: {},
  });
  assert.equal(developmentRun.accepted, true);
  if (!developmentRun.accepted) {
    return;
  }

  await store.upsertDevelopmentDiagnosticsReport({
    reportRunId: developmentRun.reportRun.reportRunId,
    reportFamily: REPORT_FAMILY.DEVELOPMENT_DIAGNOSTICS,
    sourceRefs: developmentRun.reportRun.sourceRefsJson,
    sourceOwnerRefs: developmentRun.reportRun.sourceOwnerRefsJson,
    availability: REPORT_AVAILABILITY.FRESH,
    materializedAt: developmentRun.reportRun.materializedAt,
    developmentFreezeActive: true,
    ledgerEntryCountLast30d: 3,
    proposalCountLast30d: 2,
    recentLedgerRefs: ['development_ledger:ledger-1'],
    recentFailedActionRefs: ['action_log:action-1'],
  });

  const lifecycleRun = await store.recordReportRun({
    reportRunId: 'report-run:lifecycle',
    reportFamily: REPORT_FAMILY.LIFECYCLE_DIAGNOSTICS,
    sourceRefs: ['rollback_incident:rollback-1', 'graceful_shutdown:shutdown-1'],
    sourceOwnerRefs: [REPORT_SOURCE_OWNER.LIFECYCLE],
    sourceSnapshotSignature: 'sig:lifecycle',
    materializedAt: '2026-04-21T18:03:00.000Z',
    availabilityStatus: REPORT_AVAILABILITY.DEGRADED,
    schemaVersion: '019_reporting_foundation.sql',
    publication: {},
  });
  assert.equal(lifecycleRun.accepted, true);
  if (!lifecycleRun.accepted) {
    return;
  }

  await store.upsertLifecycleDiagnosticsReport({
    reportRunId: lifecycleRun.reportRun.reportRunId,
    reportFamily: REPORT_FAMILY.LIFECYCLE_DIAGNOSTICS,
    sourceRefs: lifecycleRun.reportRun.sourceRefsJson,
    sourceOwnerRefs: lifecycleRun.reportRun.sourceOwnerRefsJson,
    availability: REPORT_AVAILABILITY.DEGRADED,
    materializedAt: lifecycleRun.reportRun.materializedAt,
    rollbackIncidentCountLast30d: 2,
    gracefulShutdownCountLast30d: 1,
    recentRollbackRefs: ['rollback_incident:rollback-1', 'rollback_incident:rollback-2'],
    recentGracefulShutdownRefs: ['graceful_shutdown:shutdown-1'],
    recentCompactionRefs: ['retention_compaction:compaction-1'],
  });

  const [latestIdentity, latestStable, latestDevelopment, latestLifecycle] = await Promise.all([
    store.getLatestIdentityContinuityReport(),
    store.getLatestStableSnapshotInventoryReport(),
    store.getLatestDevelopmentDiagnosticsReport(),
    store.getLatestLifecycleDiagnosticsReport(),
  ]);

  assert.equal(latestIdentity?.lastStableSnapshotRef, 'stable_snapshot:snapshot-1');
  assert.equal(latestStable?.totalSnapshots, 1);
  assert.equal(latestDevelopment?.developmentFreezeActive, true);
  assert.equal(latestLifecycle?.availability, REPORT_AVAILABILITY.DEGRADED);
});

void test('AC-F0023-05 AC-F0023-10 AC-F0023-15 updates publication metadata and feeds the Homeostat organ_error_rate source from the latest model-health report family', async () => {
  const harness = createReportingDbHarness();
  const store = createReportingStore(harness.db);

  const first = await store.recordReportRun({
    reportRunId: 'report-run:model-health:old',
    reportFamily: REPORT_FAMILY.MODEL_HEALTH,
    sourceRefs: ['model_registry:reflex.fast@shared'],
    sourceOwnerRefs: [REPORT_SOURCE_OWNER.BASELINE_MODEL_ROUTING],
    sourceSnapshotSignature: 'sig:model:old',
    materializedAt: '2026-04-21T17:00:00.000Z',
    availabilityStatus: REPORT_AVAILABILITY.FRESH,
    schemaVersion: '019_reporting_foundation.sql',
    publication: {},
  });
  assert.equal(first.accepted, true);
  if (!first.accepted) {
    return;
  }

  await store.replaceModelHealthReports({
    reportRunId: first.reportRun.reportRunId,
    reports: [
      {
        reportRunId: first.reportRun.reportRunId,
        reportFamily: REPORT_FAMILY.MODEL_HEALTH,
        sourceRefs: first.reportRun.sourceRefsJson,
        sourceOwnerRefs: first.reportRun.sourceOwnerRefsJson,
        availability: REPORT_AVAILABILITY.FRESH,
        materializedAt: first.reportRun.materializedAt,
        organId: 'reflex',
        profileId: 'reflex.fast@shared',
        healthStatus: 'healthy',
        errorRate: 0.01,
        fallbackRef: null,
        sourceSurfaceRefs: ['model_registry:reflex.fast@shared'],
      },
    ],
  });

  const second = await store.recordReportRun({
    reportRunId: 'report-run:model-health:new',
    reportFamily: REPORT_FAMILY.MODEL_HEALTH,
    sourceRefs: ['model_profile_health:code.deep@shared', 'model_registry:code.deep@shared'],
    sourceOwnerRefs: [REPORT_SOURCE_OWNER.EXPANDED_MODEL_ECOLOGY],
    sourceSnapshotSignature: 'sig:model:new',
    materializedAt: '2026-04-21T18:05:00.000Z',
    availabilityStatus: REPORT_AVAILABILITY.DEGRADED,
    schemaVersion: '019_reporting_foundation.sql',
    publication: {},
  });
  assert.equal(second.accepted, true);
  if (!second.accepted) {
    return;
  }

  await store.replaceModelHealthReports({
    reportRunId: second.reportRun.reportRunId,
    reports: [
      {
        reportRunId: second.reportRun.reportRunId,
        reportFamily: REPORT_FAMILY.MODEL_HEALTH,
        sourceRefs: second.reportRun.sourceRefsJson,
        sourceOwnerRefs: second.reportRun.sourceOwnerRefsJson,
        availability: REPORT_AVAILABILITY.DEGRADED,
        materializedAt: second.reportRun.materializedAt,
        organId: 'code',
        profileId: 'code.deep@shared',
        healthStatus: 'degraded',
        errorRate: 0.18,
        fallbackRef: 'model_profile:code.deep.fallback@shared',
        sourceSurfaceRefs: ['model_profile_health:code.deep@shared'],
      },
      {
        reportRunId: second.reportRun.reportRunId,
        reportFamily: REPORT_FAMILY.MODEL_HEALTH,
        sourceRefs: second.reportRun.sourceRefsJson,
        sourceOwnerRefs: second.reportRun.sourceOwnerRefsJson,
        availability: REPORT_AVAILABILITY.FRESH,
        materializedAt: second.reportRun.materializedAt,
        organId: 'safety',
        profileId: 'safety.deep@shared',
        healthStatus: 'healthy',
        errorRate: 0.04,
        fallbackRef: null,
        sourceSurfaceRefs: ['model_profile_health:safety.deep@shared'],
      },
    ],
  });

  const updated = await store.updateReportPublication({
    reportRunId: second.reportRun.reportRunId,
    publication: {
      metrics: {
        status: REPORT_PUBLICATION_STATUS.PUBLISHED,
        publishedAt: '2026-04-21T18:05:10.000Z',
        ref: 'metric:model_health',
        detail: null,
      },
    },
  });

  const latestReports = await store.listModelHealthReports({ latest: true });
  const organErrorRate = await store.loadOrganErrorRateSource();

  assert.equal(updated.publicationJson.metrics?.status, REPORT_PUBLICATION_STATUS.PUBLISHED);
  assert.deepEqual(
    latestReports.map((report) => report.profileId),
    ['code.deep@shared', 'safety.deep@shared'],
  );
  assert.deepEqual(organErrorRate, {
    reportRunId: second.reportRun.reportRunId,
    materializedAt: second.reportRun.materializedAt,
    availability: REPORT_AVAILABILITY.DEGRADED,
    metricValue: 0.18,
    evidenceRefs: [
      'report:model_health:code.deep@shared',
      'report:model_health:safety.deep@shared',
    ],
  });
});
