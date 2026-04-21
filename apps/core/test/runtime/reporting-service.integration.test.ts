import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REPORT_AVAILABILITY,
  REPORT_FAMILY,
  REPORT_PUBLICATION_CHANNEL,
  REPORT_PUBLICATION_STATUS,
  REPORT_SOURCE_OWNER,
} from '@yaagi/contracts/reporting';
import { createReportingStore } from '@yaagi/db';
import { createReportingDbHarness } from '../../../../packages/db/testing/reporting-db-harness.ts';
import { createReportingService } from '../../src/runtime/reporting.ts';

const createNowSequence = (...timestamps: string[]) => {
  let index = 0;
  return () =>
    new Date(
      timestamps[Math.min(index++, timestamps.length - 1)] ??
        timestamps[0] ??
        '1970-01-01T00:00:00.000Z',
    );
};

const createIdSequence = () => {
  let index = 0;
  return () => `id-${++index}`;
};

void test('AC-F0023-02 AC-F0023-12 AC-F0023-14 materializes all first-phase report families and deduplicates repeated source snapshots', async () => {
  const harness = createReportingDbHarness();
  const store = createReportingStore(harness.db);
  const service = createReportingService({
    store,
    now: createNowSequence(
      '2026-04-21T18:10:00.000Z',
      '2026-04-21T18:10:01.000Z',
      '2026-04-21T18:10:02.000Z',
      '2026-04-21T18:10:03.000Z',
      '2026-04-21T18:10:04.000Z',
      '2026-04-21T18:11:00.000Z',
      '2026-04-21T18:11:01.000Z',
      '2026-04-21T18:11:02.000Z',
      '2026-04-21T18:11:03.000Z',
      '2026-04-21T18:11:04.000Z',
      '2026-04-21T18:11:05.000Z',
    ),
    createId: createIdSequence(),
    loadIdentityContinuitySource() {
      return Promise.resolve({
        availability: REPORT_AVAILABILITY.FRESH,
        sourceRefs: ['agent_state:polyphony-core', 'tick:tick-1'],
        sourceOwnerRefs: [REPORT_SOURCE_OWNER.TICK_RUNTIME, REPORT_SOURCE_OWNER.BOOT_RECOVERY],
        report: {
          runtimeMode: 'live' as const,
          currentTickRef: 'tick:tick-1',
          lastStableSnapshotRef: 'stable_snapshot:snapshot-1',
          recentRecoveryRefs: ['rollback_incident:rollback-1'],
        },
        signaturePayload: {
          currentTickRef: 'tick:tick-1',
          lastStableSnapshotRef: 'stable_snapshot:snapshot-1',
          recentRecoveryRefs: ['rollback_incident:rollback-1'],
        },
      });
    },
    loadModelHealthSource() {
      return Promise.resolve({
        availability: REPORT_AVAILABILITY.FRESH,
        sourceRefs: ['model_registry:reflex.fast@shared'],
        sourceOwnerRefs: [REPORT_SOURCE_OWNER.BASELINE_MODEL_ROUTING],
        report: [
          {
            organId: 'reflex',
            profileId: 'reflex.fast@shared',
            availability: REPORT_AVAILABILITY.FRESH,
            healthStatus: 'healthy' as const,
            errorRate: 0.02,
            fallbackRef: null,
            sourceSurfaceRefs: ['model_registry:reflex.fast@shared'],
          },
        ],
        signaturePayload: {
          profiles: ['reflex.fast@shared'],
          errorRate: 0.02,
        },
      });
    },
    loadStableSnapshotInventorySource() {
      return Promise.resolve({
        availability: REPORT_AVAILABILITY.FRESH,
        sourceRefs: ['stable_snapshot:snapshot-1'],
        sourceOwnerRefs: [REPORT_SOURCE_OWNER.BODY_EVOLUTION, REPORT_SOURCE_OWNER.BOOT_RECOVERY],
        report: {
          latestStableSnapshotRef: 'stable_snapshot:snapshot-1',
          totalSnapshots: 1,
          snapshots: [
            {
              snapshotRef: 'stable_snapshot:snapshot-1',
              proposalId: 'proposal-1',
              gitTag: 'stable/v1',
              schemaVersion: '2026-04-21',
              isCurrentStable: true,
              createdAt: '2026-04-21T18:00:00.000Z',
              rollbackAnchorRefs: ['stable_snapshot:snapshot-1'],
              modelProfileMap: {
                reflex: 'reflex.fast@shared',
              },
            },
          ],
        },
        signaturePayload: {
          latestStableSnapshotRef: 'stable_snapshot:snapshot-1',
          totalSnapshots: 1,
        },
      });
    },
    loadDevelopmentDiagnosticsSource() {
      return Promise.resolve({
        availability: REPORT_AVAILABILITY.FRESH,
        sourceRefs: ['development_ledger:ledger-1', 'action_log:action-1'],
        sourceOwnerRefs: [
          REPORT_SOURCE_OWNER.ACTION_AUDIT,
          REPORT_SOURCE_OWNER.DEVELOPMENT_GOVERNOR,
        ],
        report: {
          developmentFreezeActive: false,
          ledgerEntryCountLast30d: 2,
          proposalCountLast30d: 1,
          recentLedgerRefs: ['development_ledger:ledger-1'],
          recentFailedActionRefs: ['action_log:action-1'],
        },
        signaturePayload: {
          developmentFreezeActive: false,
          ledgerEntryCountLast30d: 2,
          proposalCountLast30d: 1,
        },
      });
    },
    loadLifecycleDiagnosticsSource() {
      return Promise.resolve({
        availability: REPORT_AVAILABILITY.DEGRADED,
        sourceRefs: ['rollback_incident:rollback-1', 'graceful_shutdown:shutdown-1'],
        sourceOwnerRefs: [REPORT_SOURCE_OWNER.LIFECYCLE],
        report: {
          rollbackIncidentCountLast30d: 1,
          gracefulShutdownCountLast30d: 1,
          recentRollbackRefs: ['rollback_incident:rollback-1'],
          recentGracefulShutdownRefs: ['graceful_shutdown:shutdown-1'],
          recentCompactionRefs: ['retention_compaction:compaction-1'],
        },
        signaturePayload: {
          rollbackIncidentCountLast30d: 1,
          gracefulShutdownCountLast30d: 1,
        },
      });
    },
  });

  const first = await service.getReportingBundle();
  const second = await service.getReportingBundle();

  assert.equal(harness.state.reportRuns.length, 5);
  assert.equal(
    first.reportRuns.identityContinuity?.reportRunId,
    second.reportRuns.identityContinuity?.reportRunId,
  );
  assert.equal(
    first.reports.modelHealth[0]?.reportRunId,
    second.reports.modelHealth[0]?.reportRunId,
  );
  assert.equal(first.reports.stableSnapshotInventory?.totalSnapshots, 1);
  assert.equal(first.reports.developmentDiagnostics?.proposalCountLast30d, 1);
  assert.equal(first.reports.lifecycleDiagnostics?.availability, REPORT_AVAILABILITY.DEGRADED);
});

void test('AC-F0023-10 AC-F0023-11 AC-F0023-13 publishes bounded report artifacts and keeps operator/release/support consumers on the canonical report bundle', async () => {
  const harness = createReportingDbHarness();
  const store = createReportingStore(harness.db);
  let modelHealthVariant: 'initial' | 'changed' = 'initial';
  const service = createReportingService({
    store,
    now: createNowSequence(
      '2026-04-21T18:20:00.000Z',
      '2026-04-21T18:20:01.000Z',
      '2026-04-21T18:20:02.000Z',
      '2026-04-21T18:20:03.000Z',
      '2026-04-21T18:20:04.000Z',
      '2026-04-21T18:20:05.000Z',
      '2026-04-21T18:20:06.000Z',
    ),
    createId: createIdSequence(),
    loadIdentityContinuitySource() {
      return Promise.resolve({
        availability: REPORT_AVAILABILITY.FRESH,
        sourceRefs: ['agent_state:polyphony-core'],
        sourceOwnerRefs: [REPORT_SOURCE_OWNER.TICK_RUNTIME],
        report: {
          runtimeMode: 'live' as const,
          currentTickRef: null,
          lastStableSnapshotRef: 'stable_snapshot:snapshot-2',
          recentRecoveryRefs: [],
        },
        signaturePayload: {
          runtimeMode: 'live',
          lastStableSnapshotRef: 'stable_snapshot:snapshot-2',
        },
      });
    },
    loadModelHealthSource() {
      const changed = modelHealthVariant === 'changed';
      return Promise.resolve({
        availability: changed ? REPORT_AVAILABILITY.FRESH : REPORT_AVAILABILITY.DEGRADED,
        sourceRefs: [
          changed
            ? 'model_profile_health:code.deep.v2@shared'
            : 'model_profile_health:code.deep@shared',
        ],
        sourceOwnerRefs: [REPORT_SOURCE_OWNER.EXPANDED_MODEL_ECOLOGY],
        report: [
          {
            organId: 'code',
            profileId: changed ? 'code.deep.v2@shared' : 'code.deep@shared',
            availability: changed ? REPORT_AVAILABILITY.FRESH : REPORT_AVAILABILITY.DEGRADED,
            healthStatus: changed ? ('healthy' as const) : ('degraded' as const),
            errorRate: changed ? 0.03 : 0.12,
            fallbackRef: 'model_profile:code.deep.fallback@shared',
            sourceSurfaceRefs: [
              changed
                ? 'model_profile_health:code.deep.v2@shared'
                : 'model_profile_health:code.deep@shared',
            ],
          },
        ],
        signaturePayload: {
          profileId: changed ? 'code.deep.v2@shared' : 'code.deep@shared',
          errorRate: changed ? 0.03 : 0.12,
        },
      });
    },
    loadStableSnapshotInventorySource() {
      return Promise.resolve({
        availability: REPORT_AVAILABILITY.FRESH,
        sourceRefs: ['stable_snapshot:snapshot-2'],
        sourceOwnerRefs: [REPORT_SOURCE_OWNER.BODY_EVOLUTION],
        report: {
          latestStableSnapshotRef: 'stable_snapshot:snapshot-2',
          totalSnapshots: 2,
          snapshots: [],
        },
        signaturePayload: {
          latestStableSnapshotRef: 'stable_snapshot:snapshot-2',
          totalSnapshots: 2,
        },
      });
    },
    loadDevelopmentDiagnosticsSource() {
      return Promise.resolve({
        availability: REPORT_AVAILABILITY.FRESH,
        sourceRefs: ['development_ledger:ledger-9'],
        sourceOwnerRefs: [REPORT_SOURCE_OWNER.DEVELOPMENT_GOVERNOR],
        report: {
          developmentFreezeActive: true,
          ledgerEntryCountLast30d: 5,
          proposalCountLast30d: 3,
          recentLedgerRefs: ['development_ledger:ledger-9'],
          recentFailedActionRefs: [],
        },
        signaturePayload: {
          developmentFreezeActive: true,
          proposalCountLast30d: 3,
        },
      });
    },
    loadLifecycleDiagnosticsSource() {
      return Promise.resolve({
        availability: REPORT_AVAILABILITY.FRESH,
        sourceRefs: ['rollback_incident:rollback-9'],
        sourceOwnerRefs: [REPORT_SOURCE_OWNER.LIFECYCLE],
        report: {
          rollbackIncidentCountLast30d: 3,
          gracefulShutdownCountLast30d: 1,
          recentRollbackRefs: ['rollback_incident:rollback-9'],
          recentGracefulShutdownRefs: ['graceful_shutdown:shutdown-9'],
          recentCompactionRefs: [],
        },
        signaturePayload: {
          rollbackIncidentCountLast30d: 3,
        },
      });
    },
  });

  const bundle = await service.getReportingBundle();
  const modelHealthRunId = bundle.reportRuns.modelHealth?.reportRunId;
  assert.ok(modelHealthRunId);
  modelHealthVariant = 'changed';
  const published = await service.publishReportArtifact({
    reportRunId: modelHealthRunId,
    reportFamily: REPORT_FAMILY.MODEL_HEALTH,
    channel: REPORT_PUBLICATION_CHANNEL.METRICS,
    ref: 'metric:model_health',
    detail: 'release-gate',
    status: REPORT_PUBLICATION_STATUS.PUBLISHED,
  });

  const operatorView = {
    generatedAt: bundle.generatedAt,
    modelHealthCount: bundle.reports.modelHealth.length,
    latestSnapshotRef: bundle.reports.identityContinuity?.lastStableSnapshotRef ?? null,
  };
  const releaseView = {
    stableSnapshotCount: bundle.reports.stableSnapshotInventory?.totalSnapshots ?? 0,
    modelHealthAvailability: bundle.reportRuns.modelHealth?.availabilityStatus ?? null,
  };
  const supportView = {
    developmentFreezeActive:
      bundle.reports.developmentDiagnostics?.developmentFreezeActive ?? false,
    rollbackIncidentCountLast30d:
      bundle.reports.lifecycleDiagnostics?.rollbackIncidentCountLast30d ?? 0,
  };

  assert.equal(harness.state.reportRuns.length, 5);
  assert.equal(operatorView.modelHealthCount, 1);
  assert.equal(releaseView.stableSnapshotCount, 2);
  assert.equal(supportView.rollbackIncidentCountLast30d, 3);
  assert.equal(published.reportRunId, modelHealthRunId);
  assert.equal(published.publicationJson.metrics?.status, REPORT_PUBLICATION_STATUS.PUBLISHED);
  assert.equal(published.publicationJson.metrics?.ref, 'metric:model_health');
  assert.equal(published.publicationJson.metrics?.detail, 'release-gate');
});

void test('AC-F0023-05 AC-F0023-12 keeps missing model-health upstream bounded to the affected report family', async () => {
  const harness = createReportingDbHarness();
  const store = createReportingStore(harness.db);
  const service = createReportingService({
    store,
    now: createNowSequence(
      '2026-04-21T18:30:00.000Z',
      '2026-04-21T18:30:01.000Z',
      '2026-04-21T18:30:02.000Z',
      '2026-04-21T18:30:03.000Z',
      '2026-04-21T18:30:04.000Z',
      '2026-04-21T18:30:05.000Z',
    ),
    createId: createIdSequence(),
    loadIdentityContinuitySource() {
      return Promise.resolve({
        availability: REPORT_AVAILABILITY.FRESH,
        sourceRefs: ['agent_state:polyphony-core'],
        sourceOwnerRefs: [REPORT_SOURCE_OWNER.TICK_RUNTIME],
        report: {
          runtimeMode: 'live' as const,
          currentTickRef: 'tick:tick-9',
          lastStableSnapshotRef: 'stable_snapshot:snapshot-9',
          recentRecoveryRefs: [],
        },
        signaturePayload: {
          currentTickRef: 'tick:tick-9',
        },
      });
    },
    loadModelHealthSource() {
      return Promise.resolve({
        availability: REPORT_AVAILABILITY.UNAVAILABLE,
        sourceRefs: [],
        sourceOwnerRefs: [],
        report: [],
        signaturePayload: {
          missingUpstream: true,
        },
      });
    },
    loadStableSnapshotInventorySource() {
      return Promise.resolve({
        availability: REPORT_AVAILABILITY.FRESH,
        sourceRefs: ['stable_snapshot:snapshot-9'],
        sourceOwnerRefs: [REPORT_SOURCE_OWNER.BODY_EVOLUTION],
        report: {
          latestStableSnapshotRef: 'stable_snapshot:snapshot-9',
          totalSnapshots: 1,
          snapshots: [],
        },
        signaturePayload: {
          latestStableSnapshotRef: 'stable_snapshot:snapshot-9',
        },
      });
    },
    loadDevelopmentDiagnosticsSource() {
      return Promise.resolve({
        availability: REPORT_AVAILABILITY.FRESH,
        sourceRefs: ['development_ledger:ledger-12'],
        sourceOwnerRefs: [REPORT_SOURCE_OWNER.DEVELOPMENT_GOVERNOR],
        report: {
          developmentFreezeActive: false,
          ledgerEntryCountLast30d: 1,
          proposalCountLast30d: 0,
          recentLedgerRefs: ['development_ledger:ledger-12'],
          recentFailedActionRefs: [],
        },
        signaturePayload: {
          ledgerEntryCountLast30d: 1,
        },
      });
    },
    loadLifecycleDiagnosticsSource() {
      return Promise.resolve({
        availability: REPORT_AVAILABILITY.FRESH,
        sourceRefs: ['rollback_incident:none'],
        sourceOwnerRefs: [REPORT_SOURCE_OWNER.LIFECYCLE],
        report: {
          rollbackIncidentCountLast30d: 0,
          gracefulShutdownCountLast30d: 0,
          recentRollbackRefs: [],
          recentGracefulShutdownRefs: [],
          recentCompactionRefs: [],
        },
        signaturePayload: {
          rollbackIncidentCountLast30d: 0,
        },
      });
    },
  });

  const bundle = await service.getReportingBundle();

  assert.equal(harness.state.reportRuns.length, 5);
  assert.equal(bundle.reportRuns.identityContinuity?.availabilityStatus, REPORT_AVAILABILITY.FRESH);
  assert.equal(bundle.reportRuns.modelHealth?.availabilityStatus, REPORT_AVAILABILITY.UNAVAILABLE);
  assert.deepEqual(bundle.reportRuns.modelHealth?.sourceRefsJson, ['model_health:none']);
  assert.deepEqual(bundle.reportRuns.modelHealth?.sourceOwnerRefsJson, [
    REPORT_SOURCE_OWNER.BASELINE_MODEL_ROUTING,
    REPORT_SOURCE_OWNER.EXPANDED_MODEL_ECOLOGY,
  ]);
  assert.deepEqual(bundle.reports.modelHealth, []);
  assert.equal(bundle.reports.identityContinuity?.currentTickRef, 'tick:tick-9');
  assert.equal(
    bundle.reports.stableSnapshotInventory?.latestStableSnapshotRef,
    'stable_snapshot:snapshot-9',
  );
});
