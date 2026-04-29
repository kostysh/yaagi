import test from 'node:test';
import assert from 'node:assert/strict';
import { REPORT_AVAILABILITY } from '@yaagi/contracts/reporting';
import {
  DEPLOY_ATTEMPT_STATUS,
  RELEASE_SMOKE_STATUS,
  ROLLBACK_EXECUTION_STATUS,
  type ReleaseInspection,
} from '@yaagi/contracts/release-automation';
import {
  SUPPORT_CANONICAL_EVIDENCE_FRESHNESS,
  SUPPORT_CLOSURE_STATUS,
  SUPPORT_INCIDENT_CLASS,
  SUPPORT_SEVERITY,
  supportEvidenceBundleSchema,
} from '@yaagi/contracts/support';
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
    releaseRefs: [
      'release-request:1',
      'deploy-attempt:1',
      'release-request:missing',
      'deploy-attempt:missing',
    ],
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
      validateOperatorAuthEvidence: (evidenceRef) =>
        Promise.resolve(evidenceRef === 'operator-auth-evidence:req-1'),
      inspectRelease: (requestId) =>
        Promise.resolve(
          requestId === 'release-request:1'
            ? ({
                request: { requestId: 'release-request:1' },
                rollbackPlan: null,
                deployAttempts: [
                  { deployAttemptId: 'deploy-attempt:1', status: DEPLOY_ATTEMPT_STATUS.SUCCEEDED },
                ],
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
      ['F-0026', 'deploy-attempt:1', SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.FRESH],
      ['F-0026', 'release-request:missing', SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.MISSING],
      ['F-0026', 'deploy-attempt:missing', SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.MISSING],
      ['F-0024', 'operator-auth-evidence:req-1', SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.FRESH],
    ],
  );
});

void test('AC-F0028-07 marks failed release evidence degraded instead of fresh', async () => {
  const bundle = supportEvidenceBundleSchema.parse({
    supportIncidentId: 'support-incident:release-failed',
    incidentClass: SUPPORT_INCIDENT_CLASS.RELEASE_OR_ROLLBACK,
    severity: SUPPORT_SEVERITY.WARNING,
    sourceRefs: ['release-request:failed'],
    reportRunRefs: [],
    releaseRefs: [
      'release-request:failed',
      'deploy-attempt:failed',
      'release-evidence:failed-smoke',
      'rollback-execution:failed',
    ],
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
      inspectRelease: () =>
        Promise.resolve({
          request: { requestId: 'release-request:failed' },
          rollbackPlan: null,
          deployAttempts: [
            { deployAttemptId: 'deploy-attempt:failed', status: DEPLOY_ATTEMPT_STATUS.FAILED },
          ],
          evidenceBundles: [
            {
              evidenceBundleId: 'release-evidence:failed-smoke',
              deployAttemptId: 'deploy-attempt:failed',
              smokeOnDeployResult: { status: RELEASE_SMOKE_STATUS.FAILED },
            },
          ],
          rollbackExecutions: [
            {
              rollbackExecutionId: 'rollback-execution:failed',
              deployAttemptId: 'deploy-attempt:failed',
              status: ROLLBACK_EXECUTION_STATUS.FAILED,
            },
          ],
        } as unknown as ReleaseInspection),
    },
  });

  assert.deepEqual(
    states.map((state) => [state.ref, state.freshness]),
    [
      ['release-request:failed', SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.DEGRADED],
      ['deploy-attempt:failed', SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.DEGRADED],
      ['release-evidence:failed-smoke', SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.DEGRADED],
      ['rollback-execution:failed', SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.DEGRADED],
    ],
  );
});

void test('AC-F0028-05 validates F-0024 operator evidence through owner reader', async () => {
  const bundle = supportEvidenceBundleSchema.parse({
    supportIncidentId: 'support-incident:auth-evidence',
    incidentClass: SUPPORT_INCIDENT_CLASS.OPERATOR_ACCESS,
    severity: SUPPORT_SEVERITY.WARNING,
    sourceRefs: ['operator-route:/support/incidents'],
    reportRunRefs: [],
    releaseRefs: [],
    operatorEvidenceRefs: ['operator-auth-evidence:valid', 'operator-auth-evidence:forged'],
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
      validateOperatorAuthEvidence: (ref) =>
        Promise.resolve(ref === 'operator-auth-evidence:valid'),
    },
  });

  assert.deepEqual(
    states.map((state) => [state.ref, state.freshness]),
    [
      ['operator-auth-evidence:valid', SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.FRESH],
      ['operator-auth-evidence:forged', SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.MISSING],
    ],
  );
});

void test('AC-F0028-05 marks operator evidence unavailable without F-0024 reader', async () => {
  const bundle = supportEvidenceBundleSchema.parse({
    supportIncidentId: 'support-incident:auth-unavailable',
    incidentClass: SUPPORT_INCIDENT_CLASS.OPERATOR_ACCESS,
    severity: SUPPORT_SEVERITY.WARNING,
    sourceRefs: ['operator-route:/support/incidents'],
    reportRunRefs: [],
    releaseRefs: [],
    operatorEvidenceRefs: ['operator-auth-evidence:valid'],
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
    readers: {},
  });

  assert.deepEqual(
    states.map((state) => [state.ref, state.freshness]),
    [['operator-auth-evidence:valid', SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.UNAVAILABLE]],
  );
});

void test('AC-F0028-07 marks release refs unavailable when F-0026 inspection is not wired', async () => {
  const bundle = supportEvidenceBundleSchema.parse({
    supportIncidentId: 'support-incident:release-unavailable',
    incidentClass: SUPPORT_INCIDENT_CLASS.RELEASE_OR_ROLLBACK,
    severity: SUPPORT_SEVERITY.WARNING,
    sourceRefs: ['release-request:1'],
    reportRunRefs: [],
    releaseRefs: ['release-request:1', 'deploy-attempt:1'],
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
    readers: {},
  });

  assert.deepEqual(
    states.map((state) => [state.ref, state.freshness]),
    [
      ['release-request:1', SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.UNAVAILABLE],
      ['deploy-attempt:1', SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.UNAVAILABLE],
    ],
  );
});
