import test from 'node:test';
import assert from 'node:assert/strict';
import { REPORT_AVAILABILITY, REPORT_FAMILY } from '@yaagi/contracts/reporting';
import { createPlatformTestRuntime } from '../../testing/platform-test-fixture.ts';

void test('AC-F0023-11 exposes canonical report reads only through the F-0013 operator boundary', async () => {
  const { runtime, cleanup } = await createPlatformTestRuntime({
    dependencies: {
      createRuntimeLifecycle: () => ({
        start: () => Promise.resolve(),
        stop: () => Promise.resolve(),
        getReportingBundle: () =>
          Promise.resolve({
            generatedAt: '2026-04-21T18:40:00.000Z',
            reportRuns: {
              identityContinuity: {
                reportRunId: 'report-run:identity',
                reportFamily: REPORT_FAMILY.IDENTITY_CONTINUITY,
                sourceRefsJson: ['agent_state:polyphony-core'],
                sourceOwnerRefsJson: ['F-0003'],
                sourceSnapshotSignature: 'sig:identity',
                materializedAt: '2026-04-21T18:39:00.000Z',
                availabilityStatus: REPORT_AVAILABILITY.FRESH,
                schemaVersion: '019_reporting_foundation.sql',
                publicationJson: {},
                createdAt: '2026-04-21T18:39:00.000Z',
              },
              modelHealth: null,
              stableSnapshotInventory: null,
              developmentDiagnostics: null,
              lifecycleDiagnostics: null,
            },
            reports: {
              identityContinuity: {
                reportRunId: 'report-run:identity',
                reportFamily: REPORT_FAMILY.IDENTITY_CONTINUITY,
                sourceRefs: ['agent_state:polyphony-core'],
                sourceOwnerRefs: ['F-0003'],
                availability: REPORT_AVAILABILITY.FRESH,
                materializedAt: '2026-04-21T18:39:00.000Z',
                runtimeMode: 'live',
                currentTickRef: 'tick:tick-1',
                lastStableSnapshotRef: 'stable_snapshot:snapshot-1',
                recentRecoveryRefs: [],
              },
              modelHealth: [],
              stableSnapshotInventory: null,
              developmentDiagnostics: null,
              lifecycleDiagnostics: null,
            },
          }),
      }),
    },
  });

  try {
    const response = await runtime.fetch(new Request('http://yaagi/reports'));
    assert.equal(response.status, 200);

    const payload = (await response.json()) as {
      generatedAt: string;
      reportRuns: {
        identityContinuity: {
          reportRunId: string;
          reportFamily: string;
          availabilityStatus: string;
        } | null;
      };
      reports: {
        identityContinuity: {
          runtimeMode: string;
          currentTickRef: string | null;
          lastStableSnapshotRef: string | null;
        } | null;
      };
    };

    assert.equal(payload.generatedAt, '2026-04-21T18:40:00.000Z');
    assert.equal(payload.reportRuns.identityContinuity?.reportRunId, 'report-run:identity');
    assert.equal(
      payload.reportRuns.identityContinuity?.availabilityStatus,
      REPORT_AVAILABILITY.FRESH,
    );
    assert.equal(payload.reports.identityContinuity?.runtimeMode, 'live');
    assert.equal(
      payload.reports.identityContinuity?.lastStableSnapshotRef,
      'stable_snapshot:snapshot-1',
    );
  } finally {
    await cleanup();
  }
});
