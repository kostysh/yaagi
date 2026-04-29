import { z } from 'zod';

export const SUPPORT_SCHEMA_VERSION = '2026-04-29.support-operability.v1';

export const SUPPORT_REF_MAX_LENGTH = 240;
export const SUPPORT_NOTE_MAX_LENGTH = 2000;
export const SUPPORT_ACTION_MAX_LENGTH = 500;
export const SUPPORT_CLOSURE_CRITERIA_MAX_LENGTH = 500;
export const SUPPORT_EVIDENCE_REF_MAX_COUNT = 64;
export const SUPPORT_ACTION_REF_MAX_COUNT = 32;
export const SUPPORT_OPERATOR_NOTE_MAX_COUNT = 64;

const isoTimestampSchema = z.string().datetime({ offset: true });
const supportRefSchema = z.string().min(1).max(SUPPORT_REF_MAX_LENGTH);
const boundedRefArray = () =>
  z.array(supportRefSchema).max(SUPPORT_EVIDENCE_REF_MAX_COUNT).default([]);

export const SUPPORT_INCIDENT_CLASS = Object.freeze({
  RUNTIME_AVAILABILITY: 'runtime_availability',
  OPERATOR_ACCESS: 'operator_access',
  REPORTING_FRESHNESS: 'reporting_freshness',
  RELEASE_OR_ROLLBACK: 'release_or_rollback',
  MODEL_READINESS: 'model_readiness',
  GOVERNANCE_OR_SAFETY_ESCALATION: 'governance_or_safety_escalation',
  SUPPORT_PROCESS_GAP: 'support_process_gap',
} as const);

export type SupportIncidentClass =
  (typeof SUPPORT_INCIDENT_CLASS)[keyof typeof SUPPORT_INCIDENT_CLASS];

export const SUPPORT_INCIDENT_CLASSES = [
  SUPPORT_INCIDENT_CLASS.RUNTIME_AVAILABILITY,
  SUPPORT_INCIDENT_CLASS.OPERATOR_ACCESS,
  SUPPORT_INCIDENT_CLASS.REPORTING_FRESHNESS,
  SUPPORT_INCIDENT_CLASS.RELEASE_OR_ROLLBACK,
  SUPPORT_INCIDENT_CLASS.MODEL_READINESS,
  SUPPORT_INCIDENT_CLASS.GOVERNANCE_OR_SAFETY_ESCALATION,
  SUPPORT_INCIDENT_CLASS.SUPPORT_PROCESS_GAP,
] as const;

export const supportIncidentClassSchema = z.enum(SUPPORT_INCIDENT_CLASSES);

export const SUPPORT_SEVERITY = Object.freeze({
  WARNING: 'warning',
  CRITICAL: 'critical',
} as const);

export type SupportSeverity = (typeof SUPPORT_SEVERITY)[keyof typeof SUPPORT_SEVERITY];

export const supportSeveritySchema = z.enum([SUPPORT_SEVERITY.WARNING, SUPPORT_SEVERITY.CRITICAL]);

export const SUPPORT_ACTION_MODE = Object.freeze({
  OWNER_ROUTED: 'owner_routed',
  HUMAN_ONLY: 'human_only',
} as const);

export type SupportActionMode = (typeof SUPPORT_ACTION_MODE)[keyof typeof SUPPORT_ACTION_MODE];

export const supportActionModeSchema = z.enum([
  SUPPORT_ACTION_MODE.OWNER_ROUTED,
  SUPPORT_ACTION_MODE.HUMAN_ONLY,
]);

export const SUPPORT_ACTION_STATUS = Object.freeze({
  REQUESTED: 'requested',
  UNAVAILABLE: 'unavailable',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  DOCUMENTED: 'documented',
} as const);

export type SupportActionStatus =
  (typeof SUPPORT_ACTION_STATUS)[keyof typeof SUPPORT_ACTION_STATUS];

export const supportActionStatusSchema = z.enum([
  SUPPORT_ACTION_STATUS.REQUESTED,
  SUPPORT_ACTION_STATUS.UNAVAILABLE,
  SUPPORT_ACTION_STATUS.SUCCEEDED,
  SUPPORT_ACTION_STATUS.FAILED,
  SUPPORT_ACTION_STATUS.DOCUMENTED,
]);

export const SUPPORT_CLOSURE_STATUS = Object.freeze({
  OPEN: 'open',
  BLOCKED: 'blocked',
  RESOLVED: 'resolved',
  TRANSFERRED: 'transferred',
} as const);

export type SupportClosureStatus =
  (typeof SUPPORT_CLOSURE_STATUS)[keyof typeof SUPPORT_CLOSURE_STATUS];

export const supportClosureStatusSchema = z.enum([
  SUPPORT_CLOSURE_STATUS.OPEN,
  SUPPORT_CLOSURE_STATUS.BLOCKED,
  SUPPORT_CLOSURE_STATUS.RESOLVED,
  SUPPORT_CLOSURE_STATUS.TRANSFERRED,
]);

export const SUPPORT_CANONICAL_EVIDENCE_FRESHNESS = Object.freeze({
  FRESH: 'fresh',
  DEGRADED: 'degraded',
  STALE: 'stale',
  MISSING: 'missing',
  UNAVAILABLE: 'unavailable',
} as const);

export type SupportCanonicalEvidenceFreshness =
  (typeof SUPPORT_CANONICAL_EVIDENCE_FRESHNESS)[keyof typeof SUPPORT_CANONICAL_EVIDENCE_FRESHNESS];

export const supportCanonicalEvidenceFreshnessSchema = z.enum([
  SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.FRESH,
  SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.DEGRADED,
  SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.STALE,
  SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.MISSING,
  SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.UNAVAILABLE,
]);

export const SUPPORT_OWNER_REF = Object.freeze({
  OPERATOR_API: 'F-0013',
  GOVERNOR: 'F-0016',
  REPORTING: 'F-0023',
  OPERATOR_AUTH: 'F-0024',
  RELEASE_AUTOMATION: 'F-0026',
  SUPPORT: 'F-0028',
  HUMAN: 'human',
} as const);

export const SUPPORT_RUNBOOK_REQUIRED_SECTIONS = [
  'detection_signals',
  'triage_reads',
  'allowed_actions',
  'forbidden_shortcuts',
  'escalation_owner',
  'evidence_requirements',
  'closure_criteria',
] as const;

export const SUPPORT_OWNED_WRITE_SURFACE = Object.freeze({
  SUPPORT_INCIDENTS: 'support_incidents',
  SUPPORT_EVIDENCE_REFS: 'support_evidence_refs',
  SUPPORT_ACTION_RECORDS: 'support_action_records',
  SUPPORT_RUNBOOK_VERSIONS: 'support_runbook_versions',
} as const);

export type SupportOwnedWriteSurface =
  (typeof SUPPORT_OWNED_WRITE_SURFACE)[keyof typeof SUPPORT_OWNED_WRITE_SURFACE];

export const SUPPORT_FOREIGN_WRITE_SURFACE = Object.freeze({
  RUNTIME_IDENTITY: 'runtime_identity',
  REPORTING: 'reporting',
  OPERATOR_AUTH: 'operator_auth',
  RELEASE_AUTOMATION: 'release_automation',
  GOVERNOR: 'development_governor',
  LIFECYCLE: 'lifecycle',
  MODEL_SERVING: 'model_serving',
  PERIMETER: 'perimeter',
} as const);

export type SupportForeignWriteSurface =
  (typeof SUPPORT_FOREIGN_WRITE_SURFACE)[keyof typeof SUPPORT_FOREIGN_WRITE_SURFACE];

const SUPPORT_OWNED_WRITE_SURFACES = new Set<string>(Object.values(SUPPORT_OWNED_WRITE_SURFACE));

export const assertSupportOwnedWriteSurface = (
  surface: string,
): asserts surface is SupportOwnedWriteSurface => {
  if (!SUPPORT_OWNED_WRITE_SURFACES.has(surface)) {
    throw new Error(`support write surface is not owned by F-0028: ${surface}`);
  }
};

export const isSupportTerminalClosureStatus = (status: SupportClosureStatus): boolean =>
  status === SUPPORT_CLOSURE_STATUS.RESOLVED || status === SUPPORT_CLOSURE_STATUS.TRANSFERRED;

export const supportActionRecordSchema = z
  .object({
    mode: supportActionModeSchema,
    owner: z.string().min(1).max(SUPPORT_REF_MAX_LENGTH),
    ref: supportRefSchema,
    requestedAction: z.string().min(1).max(SUPPORT_ACTION_MAX_LENGTH),
    status: supportActionStatusSchema,
    evidenceRef: supportRefSchema.nullable().default(null),
    recordedAt: isoTimestampSchema,
  })
  .strict();

export type SupportActionRecord = z.infer<typeof supportActionRecordSchema>;

export const supportOperatorNoteSchema = z
  .object({
    noteId: supportRefSchema,
    body: z.string().max(SUPPORT_NOTE_MAX_LENGTH),
    redacted: z.literal(true),
    operatorPrincipalRef: supportRefSchema.nullable().default(null),
    operatorSessionRef: supportRefSchema.nullable().default(null),
    createdAt: isoTimestampSchema,
  })
  .strict();

export type SupportOperatorNote = z.infer<typeof supportOperatorNoteSchema>;

export const supportEvidenceBundleSchema = z
  .object({
    supportIncidentId: supportRefSchema,
    incidentClass: supportIncidentClassSchema,
    severity: supportSeveritySchema,
    sourceRefs: boundedRefArray(),
    reportRunRefs: boundedRefArray(),
    releaseRefs: boundedRefArray(),
    operatorEvidenceRefs: boundedRefArray(),
    actionRefs: z.array(supportActionRecordSchema).max(SUPPORT_ACTION_REF_MAX_COUNT).default([]),
    escalationRefs: boundedRefArray(),
    closureCriteria: z
      .array(z.string().min(1).max(SUPPORT_CLOSURE_CRITERIA_MAX_LENGTH))
      .max(SUPPORT_EVIDENCE_REF_MAX_COUNT)
      .default([]),
    operatorNotes: z
      .array(supportOperatorNoteSchema)
      .max(SUPPORT_OPERATOR_NOTE_MAX_COUNT)
      .default([]),
    closureStatus: supportClosureStatusSchema.default(SUPPORT_CLOSURE_STATUS.OPEN),
    residualRisk: z.string().min(1).max(SUPPORT_NOTE_MAX_LENGTH).nullable().default(null),
    nextOwnerRef: z.string().min(1).max(SUPPORT_REF_MAX_LENGTH).nullable().default(null),
    createdAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
    closedAt: isoTimestampSchema.nullable().default(null),
  })
  .strict();

export type SupportEvidenceBundle = z.infer<typeof supportEvidenceBundleSchema>;

export const supportCanonicalEvidenceStateSchema = z
  .object({
    owner: z.string().min(1).max(SUPPORT_REF_MAX_LENGTH),
    ref: supportRefSchema,
    freshness: supportCanonicalEvidenceFreshnessSchema,
    observedAt: isoTimestampSchema,
  })
  .strict();

export type SupportCanonicalEvidenceState = z.infer<typeof supportCanonicalEvidenceStateSchema>;

export const supportRunbookContractSchema = z
  .object({
    incidentClass: supportIncidentClassSchema,
    title: z.string().min(1).max(200),
    docPath: z.string().min(1).max(SUPPORT_REF_MAX_LENGTH),
    version: z.string().min(1).max(80),
    ownerSeams: z.array(z.string().min(1).max(SUPPORT_REF_MAX_LENGTH)).min(1),
    detectionSignals: z.array(z.string().min(1)).min(1),
    triageReads: z.array(z.string().min(1)).min(1),
    allowedActions: z.array(z.string().min(1)).min(1),
    forbiddenShortcuts: z.array(z.string().min(1)).min(1),
    escalationOwner: z.string().min(1).max(SUPPORT_REF_MAX_LENGTH),
    evidenceRequirements: z.array(z.string().min(1)).min(1),
    closureCriteria: z.array(z.string().min(1)).min(1),
  })
  .strict();

export type SupportRunbookContract = z.infer<typeof supportRunbookContractSchema>;

export const supportOpenIncidentRequestSchema = z
  .object({
    requestId: supportRefSchema,
    supportIncidentId: supportRefSchema.optional(),
    incidentClass: supportIncidentClassSchema,
    severity: supportSeveritySchema,
    sourceRefs: boundedRefArray().refine((refs) => refs.length > 0, {
      message: 'At least one source ref is required',
    }),
    reportRunRefs: boundedRefArray(),
    releaseRefs: boundedRefArray(),
    operatorEvidenceRefs: boundedRefArray(),
    actionRefs: z.array(supportActionRecordSchema).max(SUPPORT_ACTION_REF_MAX_COUNT).default([]),
    escalationRefs: boundedRefArray(),
    closureCriteria: z
      .array(z.string().min(1).max(SUPPORT_CLOSURE_CRITERIA_MAX_LENGTH))
      .max(SUPPORT_EVIDENCE_REF_MAX_COUNT)
      .default([]),
    note: z.string().min(1).max(SUPPORT_NOTE_MAX_LENGTH).optional(),
  })
  .strict();

export type SupportOpenIncidentRequest = z.infer<typeof supportOpenIncidentRequestSchema>;

export const supportUpdateIncidentRequestSchema = z
  .object({
    requestId: supportRefSchema,
    addSourceRefs: boundedRefArray(),
    addReportRunRefs: boundedRefArray(),
    addReleaseRefs: boundedRefArray(),
    addOperatorEvidenceRefs: boundedRefArray(),
    addActionRefs: z.array(supportActionRecordSchema).max(SUPPORT_ACTION_REF_MAX_COUNT).default([]),
    addEscalationRefs: boundedRefArray(),
    addClosureCriteria: z
      .array(z.string().min(1).max(SUPPORT_CLOSURE_CRITERIA_MAX_LENGTH))
      .max(SUPPORT_EVIDENCE_REF_MAX_COUNT)
      .default([]),
    closureStatus: supportClosureStatusSchema.optional(),
    residualRisk: z.string().min(1).max(SUPPORT_NOTE_MAX_LENGTH).nullable().optional(),
    nextOwnerRef: z.string().min(1).max(SUPPORT_REF_MAX_LENGTH).nullable().optional(),
    note: z.string().min(1).max(SUPPORT_NOTE_MAX_LENGTH).optional(),
  })
  .strict();

export type SupportUpdateIncidentRequest = z.infer<typeof supportUpdateIncidentRequestSchema>;

export type SupportClosureReadinessStatus = 'ready' | 'degraded' | 'blocked';

export type SupportClosureReadiness = {
  status: SupportClosureReadinessStatus;
  reasons: string[];
};

const ownerRoutedTerminalEvidence = (action: SupportActionRecord): boolean =>
  action.mode === SUPPORT_ACTION_MODE.OWNER_ROUTED &&
  action.status === SUPPORT_ACTION_STATUS.SUCCEEDED &&
  action.evidenceRef !== null;

const humanOnlyTerminalDisposition = (
  action: SupportActionRecord,
  bundle: SupportEvidenceBundle,
): boolean =>
  action.mode === SUPPORT_ACTION_MODE.HUMAN_ONLY &&
  action.status === SUPPORT_ACTION_STATUS.DOCUMENTED &&
  bundle.residualRisk !== null &&
  bundle.nextOwnerRef !== null;

export const evaluateSupportClosureReadiness = (input: {
  bundle: SupportEvidenceBundle;
  canonicalEvidenceStates?: readonly SupportCanonicalEvidenceState[];
}): SupportClosureReadiness => {
  const bundle = supportEvidenceBundleSchema.parse(input.bundle);
  const states = input.canonicalEvidenceStates ?? [];
  const reasons: string[] = [];
  let degraded = false;

  if (!isSupportTerminalClosureStatus(bundle.closureStatus)) {
    return { status: 'ready', reasons: [] };
  }

  if (bundle.sourceRefs.length === 0) reasons.push('source_refs_missing');
  if (bundle.actionRefs.length === 0) reasons.push('action_refs_missing');
  if (bundle.escalationRefs.length === 0) reasons.push('escalation_refs_missing');
  if (bundle.closureCriteria.length === 0) reasons.push('closure_criteria_missing');

  for (const state of states) {
    if (
      state.freshness === SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.MISSING ||
      state.freshness === SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.UNAVAILABLE
    ) {
      reasons.push(`canonical_evidence_${state.freshness}:${state.ref}`);
    }
    if (
      state.freshness === SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.STALE ||
      state.freshness === SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.DEGRADED
    ) {
      degraded = true;
      reasons.push(`canonical_evidence_${state.freshness}:${state.ref}`);
    }
  }

  if (bundle.severity === SUPPORT_SEVERITY.CRITICAL) {
    const hasOwnerTerminalEvidence = bundle.actionRefs.some(ownerRoutedTerminalEvidence);
    const hasHumanOnlyDisposition = bundle.actionRefs.some((action) =>
      humanOnlyTerminalDisposition(action, bundle),
    );

    if (!hasOwnerTerminalEvidence && !hasHumanOnlyDisposition) {
      reasons.push('critical_terminal_disposition_missing');
    }
  }

  if (reasons.some((reason) => !reason.includes('canonical_evidence_stale:'))) {
    return { status: 'blocked', reasons };
  }

  return degraded ? { status: 'degraded', reasons } : { status: 'ready', reasons: [] };
};

export const redactSupportText = (value: string): string =>
  value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer <redacted>')
    .replace(/\bopk_v1[A-Za-z0-9._~+/=-]*/g, 'opk_v1<redacted>')
    .replace(/\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|KEY)[A-Z0-9_]*)=([^\s]+)/gi, '$1=<redacted>')
    .replace(/\b(password|passwd|secret|token)=([^\s]+)/gi, '$1=<redacted>');

export const createSupportOperatorNote = (input: {
  noteId: string;
  body: string;
  createdAt: string;
  operatorPrincipalRef?: string | null;
  operatorSessionRef?: string | null;
}): SupportOperatorNote =>
  supportOperatorNoteSchema.parse({
    noteId: input.noteId,
    body: redactSupportText(input.body),
    redacted: true,
    operatorPrincipalRef: input.operatorPrincipalRef ?? null,
    operatorSessionRef: input.operatorSessionRef ?? null,
    createdAt: input.createdAt,
  });
