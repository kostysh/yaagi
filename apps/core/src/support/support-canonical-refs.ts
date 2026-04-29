import { REPORT_AVAILABILITY } from '@yaagi/contracts/reporting';
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

const hasReleaseRef = (inspection: ReleaseInspection, ref: string): boolean =>
  inspection.request.requestId === ref ||
  inspection.rollbackPlan?.rollbackPlanId === ref ||
  inspection.deployAttempts.some((attempt) => attempt.deployAttemptId === ref) ||
  inspection.evidenceBundles.some((bundle) => bundle.evidenceBundleId === ref) ||
  inspection.rollbackExecutions.some((execution) => execution.rollbackExecutionId === ref);

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

  for (const ref of input.bundle.releaseRefs) {
    if (!readers.inspectRelease || !ref.startsWith('release-request:')) {
      states.push({
        owner: SUPPORT_OWNER_REF.RELEASE_AUTOMATION,
        ref,
        freshness: SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.FRESH,
        observedAt: input.observedAt,
      });
      continue;
    }

    const inspection = await readers.inspectRelease(ref);
    states.push({
      owner: SUPPORT_OWNER_REF.RELEASE_AUTOMATION,
      ref,
      freshness:
        inspection && hasReleaseRef(inspection, ref)
          ? SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.FRESH
          : SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.MISSING,
      observedAt: input.observedAt,
    });
  }

  for (const ref of input.bundle.operatorEvidenceRefs) {
    states.push({
      owner: SUPPORT_OWNER_REF.OPERATOR_AUTH,
      ref,
      freshness: ref.startsWith('operator-auth-evidence:')
        ? SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.FRESH
        : SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.MISSING,
      observedAt: input.observedAt,
    });
  }

  return states;
};
