import { REPORT_AVAILABILITY } from '@yaagi/contracts/reporting';
import {
  DEPLOY_ATTEMPT_STATUS,
  RELEASE_SMOKE_STATUS,
  ROLLBACK_EXECUTION_STATUS,
  ROLLBACK_PLAN_PREFLIGHT_STATUS,
} from '@yaagi/contracts/release-automation';
import {
  SUPPORT_CANONICAL_EVIDENCE_FRESHNESS,
  SUPPORT_OWNER_REF,
  type SupportCanonicalEvidenceState,
  type SupportEvidenceBundle,
} from '@yaagi/contracts/support';
import type { ReleaseInspection } from '@yaagi/contracts/release-automation';
import type { ReportingBundle } from '../runtime/reporting.ts';

export type SupportCanonicalEvidenceReaders = {
  getReportingBundle?: () => Promise<ReportingBundle>;
  inspectRelease?: (requestId: string) => Promise<ReleaseInspection | null>;
  validateOperatorAuthEvidence?: (evidenceRef: string) => Promise<boolean>;
};

export type SupportCanonicalSurfaceAuditRow = {
  owner: string;
  surface: string;
  accessMode: 'read_contract' | 'owner_routed_action' | 'support_owned_write';
  rawForeignRead: boolean;
  rawForeignWrite: boolean;
};

export const SUPPORT_CANONICAL_SURFACE_AUDIT: readonly SupportCanonicalSurfaceAuditRow[] = [
  {
    owner: SUPPORT_OWNER_REF.OPERATOR_API,
    surface: 'F-0013 Hono operator namespace',
    accessMode: 'read_contract',
    rawForeignRead: false,
    rawForeignWrite: false,
  },
  {
    owner: SUPPORT_OWNER_REF.REPORTING,
    surface: 'F-0023 reporting bundle/report-run refs',
    accessMode: 'read_contract',
    rawForeignRead: false,
    rawForeignWrite: false,
  },
  {
    owner: SUPPORT_OWNER_REF.OPERATOR_AUTH,
    surface: 'F-0024 trusted ingress evidence refs',
    accessMode: 'read_contract',
    rawForeignRead: false,
    rawForeignWrite: false,
  },
  {
    owner: SUPPORT_OWNER_REF.RELEASE_AUTOMATION,
    surface: 'F-0026 release inspection/evidence refs',
    accessMode: 'read_contract',
    rawForeignRead: false,
    rawForeignWrite: false,
  },
];

export const assertSupportCanonicalSurfaceAudit = (
  rows: readonly SupportCanonicalSurfaceAuditRow[],
): void => {
  const unsafe = rows.find((row) => row.rawForeignRead || row.rawForeignWrite);
  if (unsafe) {
    throw new Error(`support canonical surface audit failed for ${unsafe.owner}:${unsafe.surface}`);
  }
};

const reportFreshness = (availability: string): SupportCanonicalEvidenceState['freshness'] => {
  switch (availability) {
    case REPORT_AVAILABILITY.FRESH:
      return SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.FRESH;
    case REPORT_AVAILABILITY.DEGRADED:
    case REPORT_AVAILABILITY.NOT_EVALUABLE:
      return SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.DEGRADED;
    case REPORT_AVAILABILITY.UNAVAILABLE:
      return SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.UNAVAILABLE;
    default:
      return SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.MISSING;
  }
};

const flattenReportRuns = (
  bundle: ReportingBundle,
): Array<NonNullable<ReportingBundle['reportRuns'][keyof ReportingBundle['reportRuns']]>> =>
  Object.values(bundle.reportRuns).filter(
    (row): row is NonNullable<ReportingBundle['reportRuns'][keyof ReportingBundle['reportRuns']]> =>
      row !== null,
  );

const mostSevereFreshness = (
  values: readonly SupportCanonicalEvidenceState['freshness'][],
): SupportCanonicalEvidenceState['freshness'] => {
  if (values.includes(SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.UNAVAILABLE)) {
    return SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.UNAVAILABLE;
  }
  if (values.includes(SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.MISSING)) {
    return SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.MISSING;
  }
  if (values.includes(SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.STALE)) {
    return SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.STALE;
  }
  if (values.includes(SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.DEGRADED)) {
    return SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.DEGRADED;
  }

  return SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.FRESH;
};

const releaseInspectionFreshness = (
  inspection: ReleaseInspection,
  ref: string,
): SupportCanonicalEvidenceState['freshness'] => {
  const matchingStates: SupportCanonicalEvidenceState['freshness'][] = [];

  if (inspection.request.requestId === ref) {
    matchingStates.push(SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.FRESH);
  }

  if (inspection.rollbackPlan?.rollbackPlanId === ref) {
    matchingStates.push(
      inspection.rollbackPlan.preflightStatus === ROLLBACK_PLAN_PREFLIGHT_STATUS.BLOCKED
        ? SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.DEGRADED
        : SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.FRESH,
    );
  }

  for (const attempt of inspection.deployAttempts) {
    const attemptFreshness =
      attempt.status === DEPLOY_ATTEMPT_STATUS.FAILED ||
      attempt.status === DEPLOY_ATTEMPT_STATUS.SMOKE_FAILED ||
      attempt.status === DEPLOY_ATTEMPT_STATUS.ROLLED_BACK
        ? SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.DEGRADED
        : SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.FRESH;
    if (attempt.deployAttemptId === ref) {
      matchingStates.push(attemptFreshness);
    }
    if (inspection.request.requestId === ref) {
      matchingStates.push(attemptFreshness);
    }
  }

  for (const bundle of inspection.evidenceBundles) {
    const smokeFreshness =
      bundle.smokeOnDeployResult.status === RELEASE_SMOKE_STATUS.PASSED
        ? SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.FRESH
        : bundle.smokeOnDeployResult.status === RELEASE_SMOKE_STATUS.UNAVAILABLE
          ? SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.UNAVAILABLE
          : SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.DEGRADED;
    if (bundle.evidenceBundleId === ref) {
      matchingStates.push(smokeFreshness);
    }
    if (bundle.deployAttemptId === ref || inspection.request.requestId === ref) {
      matchingStates.push(smokeFreshness);
    }
  }

  for (const execution of inspection.rollbackExecutions) {
    const executionFreshness =
      execution.status === ROLLBACK_EXECUTION_STATUS.SUCCEEDED
        ? SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.FRESH
        : execution.status === ROLLBACK_EXECUTION_STATUS.RUNNING
          ? SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.STALE
          : SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.DEGRADED;
    if (execution.rollbackExecutionId === ref) {
      matchingStates.push(executionFreshness);
    }
    if (execution.deployAttemptId === ref || inspection.request.requestId === ref) {
      matchingStates.push(executionFreshness);
    }
  }

  return matchingStates.length > 0
    ? mostSevereFreshness(matchingStates)
    : SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.MISSING;
};

const releaseFreshnessAcrossInspections = (
  values: readonly SupportCanonicalEvidenceState['freshness'][],
): SupportCanonicalEvidenceState['freshness'] => {
  const foundValues = values.filter(
    (value) => value !== SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.MISSING,
  );

  return foundValues.length > 0
    ? mostSevereFreshness(foundValues)
    : SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.MISSING;
};

export const resolveSupportCanonicalEvidenceStates = async (input: {
  bundle: Pick<
    SupportEvidenceBundle,
    'reportRunRefs' | 'releaseRefs' | 'operatorEvidenceRefs' | 'sourceRefs'
  >;
  readers?: SupportCanonicalEvidenceReaders;
  observedAt: string;
}): Promise<SupportCanonicalEvidenceState[]> => {
  const readers = input.readers ?? {};
  const states: SupportCanonicalEvidenceState[] = [];

  if (input.bundle.reportRunRefs.length > 0) {
    const reportingBundle = readers.getReportingBundle ? await readers.getReportingBundle() : null;
    const reportRuns = reportingBundle ? flattenReportRuns(reportingBundle) : [];
    for (const ref of input.bundle.reportRunRefs) {
      const row = reportRuns.find((candidate) => candidate.reportRunId === ref);
      states.push({
        owner: SUPPORT_OWNER_REF.REPORTING,
        ref,
        freshness: row
          ? reportFreshness(row.availabilityStatus)
          : SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.MISSING,
        observedAt: input.observedAt,
      });
    }
  }

  const releaseRequestRefs = input.bundle.releaseRefs.filter((ref) =>
    ref.startsWith('release-request:'),
  );
  const releaseInspections = new Map<string, ReleaseInspection | null>();
  const inspectReleaseRef = async (requestId: string): Promise<ReleaseInspection | null> => {
    if (!releaseInspections.has(requestId)) {
      releaseInspections.set(
        requestId,
        readers.inspectRelease ? await readers.inspectRelease(requestId) : null,
      );
    }

    return releaseInspections.get(requestId) ?? null;
  };

  for (const ref of input.bundle.releaseRefs) {
    if (!readers.inspectRelease) {
      states.push({
        owner: SUPPORT_OWNER_REF.RELEASE_AUTOMATION,
        ref,
        freshness: SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.UNAVAILABLE,
        observedAt: input.observedAt,
      });
      continue;
    }

    const candidateRequestRefs = ref.startsWith('release-request:') ? [ref] : releaseRequestRefs;
    const candidateInspections = await Promise.all(candidateRequestRefs.map(inspectReleaseRef));
    const freshness = candidateInspections
      .filter((inspection): inspection is ReleaseInspection => inspection !== null)
      .map((inspection) => releaseInspectionFreshness(inspection, ref));

    states.push({
      owner: SUPPORT_OWNER_REF.RELEASE_AUTOMATION,
      ref,
      freshness:
        freshness.length > 0
          ? releaseFreshnessAcrossInspections(freshness)
          : SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.MISSING,
      observedAt: input.observedAt,
    });
  }

  for (const ref of input.bundle.operatorEvidenceRefs) {
    const valid = readers.validateOperatorAuthEvidence
      ? await readers.validateOperatorAuthEvidence(ref)
      : null;
    states.push({
      owner: SUPPORT_OWNER_REF.OPERATOR_AUTH,
      ref,
      freshness:
        valid === null
          ? SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.UNAVAILABLE
          : valid
            ? SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.FRESH
            : SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.MISSING,
      observedAt: input.observedAt,
    });
  }

  return states;
};
