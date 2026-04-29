import { createHash } from 'node:crypto';
import type { z } from 'zod';
import {
  SUPPORT_CLOSURE_STATUS,
  SUPPORT_INCIDENT_CLASS,
  SUPPORT_OWNED_WRITE_SURFACE,
  SUPPORT_OWNER_REF,
  createSupportOperatorNote,
  isSupportTerminalClosureStatus,
  supportEvidenceBundleSchema,
  supportOpenIncidentRequestSchema,
  supportRunbookContractSchema,
  supportUpdateIncidentRequestSchema,
  type SupportEvidenceBundle,
  type SupportRunbookContract,
} from '@yaagi/contracts/support';
import {
  createRuntimeDbClient,
  createSupportStore,
  type SupportIncidentRecordResult,
  type SupportIncidentRow,
  type SupportStore,
} from '@yaagi/db';
import type { CoreRuntimeConfig } from '../platform/core-config.ts';
import {
  resolveSupportCanonicalEvidenceStates,
  type SupportCanonicalEvidenceReaders,
} from './support-canonical-refs.ts';

const supportOwnedWriteSurfaces = new Set<string>(Object.values(SUPPORT_OWNED_WRITE_SURFACE));

export type SupportOperatorProvenance = {
  operatorPrincipalRef?: string | null;
  operatorSessionRef?: string | null;
  operatorEvidenceRef?: string | null;
};

type SupportOpenIncidentRequestInput = z.input<typeof supportOpenIncidentRequestSchema>;
type SupportUpdateIncidentRequestInput = z.input<typeof supportUpdateIncidentRequestSchema>;

export type OpenSupportIncidentInput = SupportOpenIncidentRequestInput & SupportOperatorProvenance;
export type UpdateSupportIncidentInput = SupportUpdateIncidentRequestInput &
  SupportOperatorProvenance & {
    supportIncidentId: string;
  };

export type SupportEvidenceService = {
  listRunbooks(): Promise<SupportRunbookContract[]>;
  listIncidents(input?: { limit?: number }): Promise<SupportIncidentRow[]>;
  openIncident(input: OpenSupportIncidentInput): Promise<SupportIncidentRecordResult>;
  updateIncident(input: UpdateSupportIncidentInput): Promise<SupportIncidentRecordResult>;
};

export const DEFAULT_SUPPORT_RUNBOOKS: readonly SupportRunbookContract[] = [
  {
    incidentClass: SUPPORT_INCIDENT_CLASS.RUNTIME_AVAILABILITY,
    title: 'Runtime availability',
    docPath: 'docs/support/runbooks/runtime_availability.md',
    version: '2026-04-29',
    ownerSeams: [SUPPORT_OWNER_REF.OPERATOR_API, SUPPORT_OWNER_REF.REPORTING],
    detectionSignals: ['operator health or state route fails'],
    triageReads: ['GET /health', 'GET /state', 'GET /reports'],
    allowedActions: ['record owner-routed runtime inspection evidence'],
    forbiddenShortcuts: ['direct writes to runtime identity tables'],
    escalationOwner: SUPPORT_OWNER_REF.OPERATOR_API,
    evidenceRequirements: ['operator route ref and reporting ref when available'],
    closureCriteria: ['runtime owner evidence or explicit residual-risk transfer is attached'],
  },
  {
    incidentClass: SUPPORT_INCIDENT_CLASS.OPERATOR_ACCESS,
    title: 'Operator access',
    docPath: 'docs/support/runbooks/operator_access.md',
    version: '2026-04-29',
    ownerSeams: [SUPPORT_OWNER_REF.OPERATOR_API, SUPPORT_OWNER_REF.OPERATOR_AUTH],
    detectionSignals: ['authenticated operator route returns 401, 403, 429 or 503'],
    triageReads: ['F-0024 trusted ingress evidence and audit result refs'],
    allowedActions: ['record owner-routed auth evidence or human-only credential escalation'],
    forbiddenShortcuts: ['plain token sharing or bypassing caller admission'],
    escalationOwner: SUPPORT_OWNER_REF.OPERATOR_AUTH,
    evidenceRequirements: ['operator-auth evidence ref and bounded operator note'],
    closureCriteria: ['admission evidence is fresh or residual risk is transferred'],
  },
  {
    incidentClass: SUPPORT_INCIDENT_CLASS.REPORTING_FRESHNESS,
    title: 'Reporting freshness',
    docPath: 'docs/support/runbooks/reporting_freshness.md',
    version: '2026-04-29',
    ownerSeams: [SUPPORT_OWNER_REF.REPORTING],
    detectionSignals: ['report bundle is degraded, stale or unavailable'],
    triageReads: ['GET /reports through the operator API'],
    allowedActions: ['attach report-run refs and route remediation to the reporting owner'],
    forbiddenShortcuts: ['raw reads from reporting owner tables as support truth'],
    escalationOwner: SUPPORT_OWNER_REF.REPORTING,
    evidenceRequirements: ['report-run ref with freshness state'],
    closureCriteria: ['fresh or explicitly degraded report evidence is attached'],
  },
  {
    incidentClass: SUPPORT_INCIDENT_CLASS.RELEASE_OR_ROLLBACK,
    title: 'Release or rollback',
    docPath: 'docs/support/runbooks/release_or_rollback.md',
    version: '2026-04-29',
    ownerSeams: [SUPPORT_OWNER_REF.OPERATOR_API, SUPPORT_OWNER_REF.RELEASE_AUTOMATION],
    detectionSignals: ['release inspection shows failed smoke, deploy or rollback evidence'],
    triageReads: ['GET /control/releases through F-0013/F-0024'],
    allowedActions: ['route release or rollback action through F-0026 only'],
    forbiddenShortcuts: ['manual release table mutation or direct rollback shell execution'],
    escalationOwner: SUPPORT_OWNER_REF.RELEASE_AUTOMATION,
    evidenceRequirements: ['release request, deploy attempt, evidence bundle or rollback ref'],
    closureCriteria: ['terminal F-0026 evidence or residual-risk transfer is attached'],
  },
  {
    incidentClass: SUPPORT_INCIDENT_CLASS.MODEL_READINESS,
    title: 'Model readiness',
    docPath: 'docs/support/runbooks/model_readiness.md',
    version: '2026-04-29',
    ownerSeams: [SUPPORT_OWNER_REF.OPERATOR_API, SUPPORT_OWNER_REF.REPORTING],
    detectionSignals: ['model diagnostics or model health report degraded'],
    triageReads: ['GET /models and model-health report refs'],
    allowedActions: ['attach model readiness evidence and escalate to model/reporting owner'],
    forbiddenShortcuts: ['direct mutation of model serving profiles'],
    escalationOwner: SUPPORT_OWNER_REF.REPORTING,
    evidenceRequirements: ['model diagnostic route ref or model-health report-run ref'],
    closureCriteria: ['fresh model readiness evidence is attached'],
  },
  {
    incidentClass: SUPPORT_INCIDENT_CLASS.GOVERNANCE_OR_SAFETY_ESCALATION,
    title: 'Governance or safety escalation',
    docPath: 'docs/support/runbooks/governance_or_safety_escalation.md',
    version: '2026-04-29',
    ownerSeams: [SUPPORT_OWNER_REF.GOVERNOR, SUPPORT_OWNER_REF.OPERATOR_AUTH],
    detectionSignals: ['governor, policy or safety decision blocks operation'],
    triageReads: ['governor decision refs and operator-auth provenance refs'],
    allowedActions: ['record human-only disposition or route through governor owner seam'],
    forbiddenShortcuts: ['support-owned governor or perimeter decision writes'],
    escalationOwner: SUPPORT_OWNER_REF.GOVERNOR,
    evidenceRequirements: ['governor decision or human-only disposition evidence'],
    closureCriteria: ['decision owner evidence or residual-risk transfer is attached'],
  },
  {
    incidentClass: SUPPORT_INCIDENT_CLASS.SUPPORT_PROCESS_GAP,
    title: 'Support process gap',
    docPath: 'docs/support/runbooks/support_process_gap.md',
    version: '2026-04-29',
    ownerSeams: [SUPPORT_OWNER_REF.SUPPORT],
    detectionSignals: ['no existing runbook covers the incident'],
    triageReads: ['support incident evidence and current runbook refs'],
    allowedActions: ['open a support process gap and route backlog/source-review updates'],
    forbiddenShortcuts: ['inventing hidden procedure truth in chat or shell logs'],
    escalationOwner: SUPPORT_OWNER_REF.SUPPORT,
    evidenceRequirements: ['support evidence bundle and backlog/source-review ref when applicable'],
    closureCriteria: ['new runbook or explicit backlog follow-up is linked'],
  },
].map((runbook) => supportRunbookContractSchema.parse(runbook));

const defaultNow = (): string => new Date().toISOString();

const uniqueSorted = (values: readonly string[]): string[] =>
  Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
  ).sort();

const uniqueActions = (
  values: readonly SupportEvidenceBundle['actionRefs'][number][],
): SupportEvidenceBundle['actionRefs'] =>
  Array.from(new Map(values.map((action) => [action.ref, action])).values()).sort((left, right) =>
    left.ref.localeCompare(right.ref),
  );

const uniqueNotes = (
  values: readonly SupportEvidenceBundle['operatorNotes'][number][],
): SupportEvidenceBundle['operatorNotes'] =>
  Array.from(new Map(values.map((note) => [note.noteId, note])).values()).sort((left, right) =>
    left.noteId.localeCompare(right.noteId),
  );

const stableNormalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stableNormalize);
  }

  if (value && typeof value === 'object') {
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      normalized[key] = stableNormalize((value as Record<string, unknown>)[key]);
    }
    return normalized;
  }

  return value;
};

const stableHash = (value: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify(stableNormalize(value)))
    .digest('hex');

const supportIncidentIdForRequest = (requestId: string): string =>
  `support-incident:${stableHash(requestId).slice(0, 40)}`;

const noteIdForRequest = (requestId: string): string =>
  `support-note:${stableHash(requestId).slice(0, 40)}`;

const withSupportStore = async <T>(
  connectionString: string,
  run: (store: SupportStore) => Promise<T>,
): Promise<T> => {
  const client = createRuntimeDbClient(connectionString);
  await client.connect();
  try {
    return await run(createSupportStore(client));
  } finally {
    await client.end();
  }
};

export const createSupportEvidenceService = (input: {
  store: SupportStore;
  readers?: SupportCanonicalEvidenceReaders;
  runbooks?: readonly SupportRunbookContract[];
  now?: () => string;
}): SupportEvidenceService => {
  const now = input.now ?? defaultNow;
  const runbooks = [...(input.runbooks ?? DEFAULT_SUPPORT_RUNBOOKS)];

  return {
    listRunbooks() {
      return Promise.resolve(runbooks.map((runbook) => ({ ...runbook })));
    },

    listIncidents(query) {
      return input.store.listIncidents({ limit: query?.limit ?? 50 });
    },

    async openIncident(rawInput) {
      const { operatorPrincipalRef, operatorSessionRef, operatorEvidenceRef, ...requestInput } =
        rawInput;
      const parsed = supportOpenIncidentRequestSchema.parse(requestInput);
      const observedAt = now();
      const supportIncidentId =
        parsed.supportIncidentId ?? supportIncidentIdForRequest(parsed.requestId);
      const note = parsed.note
        ? createSupportOperatorNote({
            noteId: noteIdForRequest(parsed.requestId),
            body: parsed.note,
            operatorPrincipalRef: operatorPrincipalRef ?? null,
            operatorSessionRef: operatorSessionRef ?? null,
            createdAt: observedAt,
          })
        : null;
      const operatorEvidenceRefs = uniqueSorted([
        ...parsed.operatorEvidenceRefs,
        ...(operatorEvidenceRef ? [operatorEvidenceRef] : []),
      ]);
      const bundle = supportEvidenceBundleSchema.parse({
        supportIncidentId,
        incidentClass: parsed.incidentClass,
        severity: parsed.severity,
        sourceRefs: uniqueSorted(parsed.sourceRefs),
        reportRunRefs: uniqueSorted(parsed.reportRunRefs),
        releaseRefs: uniqueSorted(parsed.releaseRefs),
        operatorEvidenceRefs,
        actionRefs: uniqueActions(parsed.actionRefs),
        escalationRefs: uniqueSorted(parsed.escalationRefs),
        closureCriteria: uniqueSorted(parsed.closureCriteria),
        operatorNotes: note ? [note] : [],
        closureStatus: SUPPORT_CLOSURE_STATUS.OPEN,
        residualRisk: null,
        nextOwnerRef: null,
        createdAt: observedAt,
        updatedAt: observedAt,
        closedAt: null,
      });
      const canonicalEvidenceStates = await resolveSupportCanonicalEvidenceStates({
        bundle,
        observedAt,
        ...(input.readers ? { readers: input.readers } : {}),
      });

      return input.store.openIncident({
        ...bundle,
        requestId: parsed.requestId,
        normalizedRequestHash: stableHash({
          ...parsed,
          supportIncidentId,
          operatorEvidenceRefs: parsed.operatorEvidenceRefs,
        }),
        canonicalEvidenceStates,
      });
    },

    async updateIncident(rawInput) {
      const {
        supportIncidentId,
        operatorPrincipalRef,
        operatorSessionRef,
        operatorEvidenceRef,
        ...requestInput
      } = rawInput;
      const parsed = supportUpdateIncidentRequestSchema.parse(requestInput);
      const existing = await input.store.getIncident(supportIncidentId);
      if (!existing) {
        return {
          accepted: false,
          reason: 'incident_missing',
        };
      }
      const {
        requestId: existingRequestId,
        normalizedRequestHash: existingNormalizedRequestHash,
        ...existingBundle
      } = existing;
      void existingRequestId;
      void existingNormalizedRequestHash;

      const observedAt = now();
      const note = parsed.note
        ? createSupportOperatorNote({
            noteId: noteIdForRequest(parsed.requestId),
            body: parsed.note,
            operatorPrincipalRef: operatorPrincipalRef ?? null,
            operatorSessionRef: operatorSessionRef ?? null,
            createdAt: observedAt,
          })
        : null;
      const closureStatus = parsed.closureStatus ?? existing.closureStatus;
      const bundle = supportEvidenceBundleSchema.parse({
        ...existingBundle,
        sourceRefs: uniqueSorted([...existing.sourceRefs, ...parsed.addSourceRefs]),
        reportRunRefs: uniqueSorted([...existing.reportRunRefs, ...parsed.addReportRunRefs]),
        releaseRefs: uniqueSorted([...existing.releaseRefs, ...parsed.addReleaseRefs]),
        operatorEvidenceRefs: uniqueSorted([
          ...existing.operatorEvidenceRefs,
          ...parsed.addOperatorEvidenceRefs,
          ...(operatorEvidenceRef ? [operatorEvidenceRef] : []),
        ]),
        actionRefs: uniqueActions([...existing.actionRefs, ...parsed.addActionRefs]),
        escalationRefs: uniqueSorted([...existing.escalationRefs, ...parsed.addEscalationRefs]),
        closureCriteria: uniqueSorted([...existing.closureCriteria, ...parsed.addClosureCriteria]),
        operatorNotes: uniqueNotes([...existing.operatorNotes, ...(note ? [note] : [])]),
        closureStatus,
        residualRisk:
          parsed.residualRisk === undefined ? existing.residualRisk : parsed.residualRisk,
        nextOwnerRef:
          parsed.nextOwnerRef === undefined ? existing.nextOwnerRef : parsed.nextOwnerRef,
        updatedAt: observedAt,
        closedAt: isSupportTerminalClosureStatus(closureStatus)
          ? (existing.closedAt ?? observedAt)
          : null,
      });
      const canonicalEvidenceStates = await resolveSupportCanonicalEvidenceStates({
        bundle,
        observedAt,
        ...(input.readers ? { readers: input.readers } : {}),
      });

      return input.store.updateIncident({
        ...bundle,
        requestId: parsed.requestId,
        normalizedRequestHash: stableHash(parsed),
        canonicalEvidenceStates,
      });
    },
  };
};

export const createDbBackedSupportEvidenceService = (
  config: Pick<CoreRuntimeConfig, 'postgresUrl'>,
  readers: SupportCanonicalEvidenceReaders = {},
): SupportEvidenceService => {
  const store: SupportStore = {
    assertOwnedWriteSurface(surface) {
      if (!supportOwnedWriteSurfaces.has(surface)) {
        throw new Error(`support write surface is not owned by F-0028: ${surface}`);
      }
    },
    upsertRunbookVersion(input) {
      return withSupportStore(config.postgresUrl, (supportStore) =>
        supportStore.upsertRunbookVersion(input),
      );
    },
    listRunbookVersions() {
      return withSupportStore(config.postgresUrl, (supportStore) =>
        supportStore.listRunbookVersions(),
      );
    },
    openIncident(input) {
      return withSupportStore(config.postgresUrl, (supportStore) =>
        supportStore.openIncident(input),
      );
    },
    updateIncident(input) {
      return withSupportStore(config.postgresUrl, (supportStore) =>
        supportStore.updateIncident(input),
      );
    },
    getIncident(supportIncidentId) {
      return withSupportStore(config.postgresUrl, (supportStore) =>
        supportStore.getIncident(supportIncidentId),
      );
    },
    listIncidents(input) {
      return withSupportStore(config.postgresUrl, (supportStore) =>
        supportStore.listIncidents(input),
      );
    },
  };

  return createSupportEvidenceService({
    store,
    readers,
    now: defaultNow,
  });
};
