import test from 'node:test';
import assert from 'node:assert/strict';
import { REPORT_AVAILABILITY } from '@yaagi/contracts/reporting';
import {
  SUPPORT_CANONICAL_EVIDENCE_FRESHNESS,
  SUPPORT_CLOSURE_STATUS,
  SUPPORT_INCIDENT_CLASS,
  SUPPORT_SEVERITY,
  supportEvidenceBundleSchema,
} from '@yaagi/contracts/support';
import type { ReleaseInspection } from '@yaagi/contracts/release-automation';
import type { ReportingBundle } from '../../src/runtime/reporting.ts';
import { resolveSupportCanonicalEvidenceStates } from '../../src/support/support-canonical-refs.ts';

const now = '2026-04-29T12:00:00.000Z';

void test('AC-F0028-06 AC-F0028-12 consumes F-0023 report-run refs read-only with freshness state', async () => {
  const bundle = supportEvidenceBundleSchema.parse({
    supportIncidentId: 'support-incident:reporting',
    incidentClass: SUPPORT_INCIDENT_CLASS.REPORTING_FRESHNESS,
    severity: SUPPORT_SEVERITY.WARNING,
    sourceRefs: ['report-run:identity'],
    reportRunRefs: ['report-run:identity', 'report-run:missing'],
    releaseRefs: [],
    operatorEvidenceRefs: [],
    actionRefs: [],
    escalationRefs: [],
    closureCriteria: [],
    operatorNotes: [],
    closureStatus: SUPPORT_CLOSURE_STATUS.OPEN,
    residualRisk: null,
    nextOwnerRef: null,
    createdAt: now,
    updatedAt: now,
    closedAt: null,
  });

  const states = await resolveSupportCanonicalEvidenceStates({
    bundle,
    observedAt: now,
    readers: {
      getReportingBundle: () =>
        Promise.resolve({
          generatedAt: now,
          reportRuns: {
            identityContinuity: {
              reportRunId: 'report-run:identity',
              availabilityStatus: REPORT_AVAILABILITY.DEGRADED,
            },
            modelHealth: null,
            stableSnapshotInventory: null,
            developmentDiagnostics: null,
            lifecycleDiagnostics: null,
          },
          reports: {},
        } as unknown as ReportingBundle),
    },
  });

  assert.deepEqual(
    states.map((state) => [state.ref, state.freshness]),
    [
      ['report-run:identity', SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.DEGRADED],
      ['report-run:missing', SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.MISSING],
    ],
  );
});

void test('AC-F0028-07 consumes F-0026 release refs through release inspection only', async () => {
  const bundle = supportEvidenceBundleSchema.parse({
    supportIncidentId: 'support-incident:release',
    incidentClass: SUPPORT_INCIDENT_CLASS.RELEASE_OR_ROLLBACK,
    severity: SUPPORT_SEVERITY.WARNING,
    sourceRefs: ['release-request:1'],
    reportRunRefs: [],
    releaseRefs: ['release-request:1', 'release-request:missing'],
    operatorEvidenceRefs: ['operator-auth-evidence:req-1'],
    actionRefs: [],
    escalationRefs: [],
    closureCriteria: [],
    operatorNotes: [],
    closureStatus: SUPPORT_CLOSURE_STATUS.OPEN,
    residualRisk: null,
    nextOwnerRef: null,
    createdAt: now,
    updatedAt: now,
    closedAt: null,
  });

  const states = await resolveSupportCanonicalEvidenceStates({
    bundle,
    observedAt: now,
    readers: {
      inspectRelease: (requestId) =>
        Promise.resolve(
          requestId === 'release-request:1'
            ? ({
                request: { requestId: 'release-request:1' },
                rollbackPlan: null,
                deployAttempts: [],
                evidenceBundles: [],
                rollbackExecutions: [],
              } as unknown as ReleaseInspection)
            : null,
        ),
    },
  });

  assert.deepEqual(
    states.map((state) => [state.owner, state.ref, state.freshness]),
    [
      ['F-0026', 'release-request:1', SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.FRESH],
      ['F-0026', 'release-request:missing', SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.MISSING],
      ['F-0024', 'operator-auth-evidence:req-1', SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.FRESH],
    ],
  );
});
