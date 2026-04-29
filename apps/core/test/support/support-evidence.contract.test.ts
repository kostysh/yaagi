import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORT_ACTION_MODE,
  SUPPORT_ACTION_STATUS,
  SUPPORT_CLOSURE_STATUS,
  SUPPORT_INCIDENT_CLASS,
  SUPPORT_SEVERITY,
  evaluateSupportClosureReadiness,
} from '@yaagi/contracts/support';
import type { ReleaseInspection } from '@yaagi/contracts/release-automation';
import type { SupportIncidentRecordResult, SupportIncidentRow, SupportStore } from '@yaagi/db';
import { createSupportEvidenceService } from '../../src/support/support-evidence.ts';

const now = '2026-04-29T12:00:00.000Z';
type SupportRejectionReason = Extract<SupportIncidentRecordResult, { accepted: false }>['reason'];

const createMemoryStore = (): {
  store: SupportStore;
  incidents: Record<string, SupportIncidentRow>;
} => {
  const incidents: Record<string, SupportIncidentRow> = {};
  const updateRequests: Record<
    string,
    {
      supportIncidentId: string;
      normalizedRequestHash: string;
      status: 'pending' | 'applied' | 'rejected';
      rejectionReason: SupportRejectionReason | null;
      closureReasons: string[];
    }
  > = {};

  const store: SupportStore = {
    assertOwnedWriteSurface: () => undefined,
    upsertRunbookVersion: (input) =>
      Promise.resolve({
        runbookId: input.runbookId,
        incidentClass: input.incidentClass,
        docPath: input.docPath,
        version: input.version,
        requiredSectionsJson: input.requiredSectionsJson,
        sourceRefsJson: input.sourceRefsJson,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
      }),
    listRunbookVersions: () => Promise.resolve([]),
    openIncident: (input): Promise<SupportIncidentRecordResult> => {
      const {
        requestId,
        normalizedRequestHash,
        canonicalEvidenceStates,
        requestedWriteSurfaces,
        ...bundle
      } = input;
      void canonicalEvidenceStates;
      void requestedWriteSurfaces;
      const existing = Object.values(incidents).find(
        (incident) => incident.requestId === requestId,
      );
      if (existing) {
        if (existing.normalizedRequestHash !== normalizedRequestHash) {
          return Promise.resolve({
            accepted: false,
            reason: 'conflicting_request_id',
            existingIncident: existing,
          });
        }

        return Promise.resolve({
          accepted: true,
          deduplicated: true,
          incident: existing,
          closureReadiness: {
            status: existing.closureReadinessStatus,
            reasons: existing.closureReadinessReasons,
          },
        });
      }

      const row: SupportIncidentRow = {
        ...bundle,
        requestId,
        normalizedRequestHash,
        closureReadinessStatus: 'ready',
        closureReadinessReasons: [],
      };
      incidents[row.supportIncidentId] = row;
      return Promise.resolve({
        accepted: true,
        deduplicated: false,
        incident: row,
        closureReadiness: { status: 'ready', reasons: [] },
      });
    },
    claimIncidentUpdate: (input): Promise<SupportIncidentRecordResult> => {
      const existingRequest = updateRequests[input.requestId];
      if (existingRequest) {
        const incident = incidents[existingRequest.supportIncidentId];
        if (
          existingRequest.supportIncidentId !== input.supportIncidentId ||
          existingRequest.normalizedRequestHash !== input.normalizedRequestHash
        ) {
          return Promise.resolve({
            accepted: false,
            reason: 'conflicting_request_id',
            ...(incident ? { existingIncident: incident } : {}),
          });
        }

        if (existingRequest.status === 'pending') {
          return Promise.resolve({
            accepted: false,
            reason: 'request_in_progress',
            ...(incident ? { existingIncident: incident } : {}),
          });
        }

        if (existingRequest.status === 'rejected') {
          return Promise.resolve({
            accepted: false,
            reason: existingRequest.rejectionReason ?? 'conflicting_request_id',
            ...(incident ? { existingIncident: incident } : {}),
            ...(existingRequest.closureReasons.length > 0
              ? { closureReasons: existingRequest.closureReasons }
              : {}),
          });
        }

        if (!incident) {
          return Promise.resolve({ accepted: false, reason: 'incident_missing' });
        }

        return Promise.resolve({
          accepted: true,
          deduplicated: true,
          incident,
          closureReadiness: {
            status: incident.closureReadinessStatus,
            reasons: incident.closureReadinessReasons,
          },
        });
      }

      const incident = incidents[input.supportIncidentId];
      if (!incident) {
        return Promise.resolve({ accepted: false, reason: 'incident_missing' });
      }

      updateRequests[input.requestId] = {
        supportIncidentId: input.supportIncidentId,
        normalizedRequestHash: input.normalizedRequestHash,
        status: 'pending',
        rejectionReason: null,
        closureReasons: [],
      };

      return Promise.resolve({
        accepted: true,
        deduplicated: false,
        incident,
        closureReadiness: {
          status: incident.closureReadinessStatus,
          reasons: incident.closureReadinessReasons,
        },
      });
    },
    rejectIncidentUpdate: (input): Promise<void> => {
      const existingRequest = updateRequests[input.requestId];
      if (
        existingRequest &&
        existingRequest.status === 'pending' &&
        existingRequest.supportIncidentId === input.supportIncidentId &&
        existingRequest.normalizedRequestHash === input.normalizedRequestHash
      ) {
        updateRequests[input.requestId] = {
          ...existingRequest,
          status: 'rejected',
          rejectionReason: input.reason ?? 'request_failed',
          closureReasons: [...(input.closureReasons ?? [])],
        };
      }
      return Promise.resolve();
    },
    updateIncident: (input): Promise<SupportIncidentRecordResult> => {
      const {
        requestId,
        normalizedRequestHash,
        canonicalEvidenceStates,
        requestedWriteSurfaces,
        requestClaimed,
        scalarFieldUpdates,
        ...bundle
      } = input;
      void requestedWriteSurfaces;
      void requestClaimed;
      void scalarFieldUpdates;
      const readiness = evaluateSupportClosureReadiness({
        bundle,
        ...(canonicalEvidenceStates ? { canonicalEvidenceStates } : {}),
      });
      if (readiness.status === 'blocked') {
        updateRequests[input.requestId] = {
          supportIncidentId: input.supportIncidentId,
          normalizedRequestHash,
          status: 'rejected',
          rejectionReason: 'closure_blocked',
          closureReasons: readiness.reasons,
        };
        const existingIncident = incidents[input.supportIncidentId];
        return Promise.resolve({
          accepted: false,
          reason: 'closure_blocked',
          ...(existingIncident ? { existingIncident } : {}),
          closureReasons: readiness.reasons,
        });
      }
      const row: SupportIncidentRow = {
        ...bundle,
        requestId: incidents[input.supportIncidentId]?.requestId ?? requestId,
        normalizedRequestHash:
          incidents[input.supportIncidentId]?.normalizedRequestHash ?? normalizedRequestHash,
        closureReadinessStatus: readiness.status,
        closureReadinessReasons: readiness.reasons,
      };
      incidents[row.supportIncidentId] = row;
      updateRequests[input.requestId] = {
        supportIncidentId: row.supportIncidentId,
        normalizedRequestHash,
        status: 'applied',
        rejectionReason: null,
        closureReasons: [],
      };
      return Promise.resolve({
        accepted: true,
        deduplicated: false,
        incident: row,
        closureReadiness: readiness,
      });
    },
    getIncident: (supportIncidentId) => Promise.resolve(incidents[supportIncidentId] ?? null),
    listIncidents: () => Promise.resolve(Object.values(incidents)),
  };

  return { store, incidents };
};

void test('AC-F0028-08 AC-F0028-09 opens support evidence with operator provenance and redacted notes', async () => {
  const { store } = createMemoryStore();
  const service = createSupportEvidenceService({
    store,
    now: () => now,
    readers: {
      inspectRelease: () =>
        Promise.resolve({
          request: { requestId: 'release-request:1' },
          rollbackPlan: null,
          deployAttempts: [],
          evidenceBundles: [],
          rollbackExecutions: [],
        } as unknown as ReleaseInspection),
    },
    ownerSeams: {
      'F-0026': () => Promise.resolve({ accepted: true, evidenceRef: 'release-request:1' }),
    },
  });

  const result = await service.openIncident({
    requestId: 'support-request-open-service',
    incidentClass: SUPPORT_INCIDENT_CLASS.OPERATOR_ACCESS,
    severity: SUPPORT_SEVERITY.WARNING,
    sourceRefs: ['operator-route:/state'],
    closureCriteria: ['operator password: swordfish removed'],
    actionRefs: [
      {
        mode: SUPPORT_ACTION_MODE.HUMAN_ONLY,
        owner: 'human',
        ref: 'support-action:redact',
        requestedAction: 'rotate api_key: key-1',
      },
    ],
    note: 'observed Bearer abc.def PASSWORD=hunter2',
    operatorPrincipalRef: 'operator:test-support',
    operatorSessionRef: 'operator-session:1',
    operatorEvidenceRef: 'operator-auth-evidence:req-1',
  });

  assert.equal(result.accepted, true);
  if (!result.accepted) return;

  assert.equal(result.incident.operatorEvidenceRefs.includes('operator-auth-evidence:req-1'), true);
  assert.equal(result.incident.operatorNotes[0]?.operatorPrincipalRef, 'operator:test-support');
  assert.equal(result.incident.operatorNotes[0]?.body.includes('hunter2'), false);
  assert.equal(result.incident.operatorNotes[0]?.redacted, true);
  assert.equal(result.incident.closureCriteria[0]?.includes('swordfish'), false);
  assert.equal(result.incident.actionRefs[0]?.requestedAction.includes('key-1'), false);
});

void test('AC-F0028-02 AC-F0028-10 does not reroute owner actions on update replay', async () => {
  const { store } = createMemoryStore();
  let ownerSeamCalls = 0;
  const service = createSupportEvidenceService({
    store,
    now: () => now,
    ownerSeams: {
      'F-0023': () => {
        ownerSeamCalls += 1;
        return Promise.resolve({ accepted: true, evidenceRef: 'report-run:owner-evidence' });
      },
    },
  });

  const opened = await service.openIncident({
    requestId: 'support-request-action-replay-open',
    incidentClass: SUPPORT_INCIDENT_CLASS.REPORTING_FRESHNESS,
    severity: SUPPORT_SEVERITY.WARNING,
    sourceRefs: ['report-run:source'],
  });
  assert.equal(opened.accepted, true);
  if (!opened.accepted) return;

  const update = {
    supportIncidentId: opened.incident.supportIncidentId,
    requestId: 'support-request-action-replay-update',
    addActionRefs: [
      {
        mode: SUPPORT_ACTION_MODE.OWNER_ROUTED,
        owner: 'F-0023',
        ref: 'support-action:report-owner',
        requestedAction: 'inspect reporting owner evidence',
      },
    ],
  };

  const first = await service.updateIncident(update);
  const replay = await service.updateIncident(update);

  assert.equal(first.accepted, true);
  assert.equal(replay.accepted, true);
  assert.equal(ownerSeamCalls, 1);
});

void test('AC-F0028-02 AC-F0028-10 does not reroute owner actions on open replay', async () => {
  const { store } = createMemoryStore();
  let ownerSeamCalls = 0;
  const service = createSupportEvidenceService({
    store,
    now: () => now,
    ownerSeams: {
      'F-0023': () => {
        ownerSeamCalls += 1;
        return Promise.resolve({ accepted: true, evidenceRef: 'report-run:open-owner-evidence' });
      },
    },
  });

  const open = {
    requestId: 'support-request-open-action-replay',
    incidentClass: SUPPORT_INCIDENT_CLASS.REPORTING_FRESHNESS,
    severity: SUPPORT_SEVERITY.WARNING,
    sourceRefs: ['report-run:source'],
    actionRefs: [
      {
        mode: SUPPORT_ACTION_MODE.OWNER_ROUTED,
        owner: 'F-0023',
        ref: 'support-action:open-report-owner',
        requestedAction: 'inspect reporting owner evidence',
      },
    ],
  };

  const first = await service.openIncident(open);
  const replay = await service.openIncident(open);

  assert.equal(first.accepted, true);
  assert.equal(replay.accepted, true);
  assert.equal(ownerSeamCalls, 1);
});

void test('AC-F0028-02 records failed open action routing without rerouting on replay', async () => {
  const { store } = createMemoryStore();
  let ownerSeamCalls = 0;
  const service = createSupportEvidenceService({
    store,
    now: () => now,
    ownerSeams: {
      'F-0023': () => {
        ownerSeamCalls += 1;
        throw new Error('report owner down');
      },
    },
  });

  const open = {
    requestId: 'support-request-open-action-failure',
    incidentClass: SUPPORT_INCIDENT_CLASS.REPORTING_FRESHNESS,
    severity: SUPPORT_SEVERITY.WARNING,
    sourceRefs: ['report-run:source'],
    actionRefs: [
      {
        mode: SUPPORT_ACTION_MODE.OWNER_ROUTED,
        owner: 'F-0023',
        ref: 'support-action:open-report-owner-failure',
        requestedAction: 'inspect reporting owner evidence',
      },
    ],
  };

  const first = await service.openIncident(open);
  const replay = await service.openIncident(open);

  assert.equal(first.accepted, true);
  assert.equal(replay.accepted, true);
  if (replay.accepted) {
    assert.equal(replay.incident.actionRefs[0]?.status, SUPPORT_ACTION_STATUS.FAILED);
  }
  assert.equal(ownerSeamCalls, 1);
});

void test('AC-F0028-02 records failed update action routing after the support update is durable', async () => {
  const { store } = createMemoryStore();
  let ownerSeamCalls = 0;
  const service = createSupportEvidenceService({
    store,
    now: () => now,
    ownerSeams: {
      'F-0023': () => {
        ownerSeamCalls += 1;
        throw new Error('report owner down');
      },
    },
  });

  const opened = await service.openIncident({
    requestId: 'support-request-owner-failure-open',
    incidentClass: SUPPORT_INCIDENT_CLASS.REPORTING_FRESHNESS,
    severity: SUPPORT_SEVERITY.WARNING,
    sourceRefs: ['report-run:source'],
  });
  assert.equal(opened.accepted, true);
  if (!opened.accepted) return;

  const update = {
    supportIncidentId: opened.incident.supportIncidentId,
    requestId: 'support-request-owner-failure-update',
    addActionRefs: [
      {
        mode: SUPPORT_ACTION_MODE.OWNER_ROUTED,
        owner: 'F-0023',
        ref: 'support-action:report-owner-failure',
        requestedAction: 'inspect reporting owner evidence',
      },
    ],
  };

  const first = await service.updateIncident(update);
  const replay = await service.updateIncident(update);

  assert.equal(first.accepted, true);
  assert.equal(replay.accepted, true);
  if (replay.accepted) {
    assert.equal(replay.incident.actionRefs[0]?.status, SUPPORT_ACTION_STATUS.FAILED);
  }
  assert.equal(ownerSeamCalls, 1);
});

void test('AC-F0028-02 keeps open replay independent from unavailable canonical readers', async () => {
  const { store } = createMemoryStore();
  let readerCalls = 0;
  const service = createSupportEvidenceService({
    store,
    now: () => now,
    readers: {
      validateOperatorAuthEvidence: () => {
        readerCalls += 1;
        return Promise.reject(new Error('auth reader down'));
      },
    },
  });

  const open = {
    requestId: 'support-request-reader-open-replay',
    incidentClass: SUPPORT_INCIDENT_CLASS.OPERATOR_ACCESS,
    severity: SUPPORT_SEVERITY.WARNING,
    sourceRefs: ['operator-route:/state'],
    operatorEvidenceRefs: ['operator-auth-evidence:reader-open-replay'],
  };

  const first = await service.openIncident(open);
  const replay = await service.openIncident(open);

  assert.equal(first.accepted, true);
  assert.equal(replay.accepted, true);
  assert.equal(readerCalls, 0);
});

void test('AC-F0028-02 marks unavailable canonical readers as closure blockers before replay', async () => {
  const { store } = createMemoryStore();
  let readerCalls = 0;
  const service = createSupportEvidenceService({
    store,
    now: () => now,
    readers: {
      validateOperatorAuthEvidence: () => {
        readerCalls += 1;
        return Promise.reject(new Error('auth reader down'));
      },
    },
  });

  const opened = await service.openIncident({
    requestId: 'support-request-reader-failure-open',
    incidentClass: SUPPORT_INCIDENT_CLASS.OPERATOR_ACCESS,
    severity: SUPPORT_SEVERITY.WARNING,
    sourceRefs: ['operator-route:/state'],
  });
  assert.equal(opened.accepted, true);
  if (!opened.accepted) return;

  const update = {
    supportIncidentId: opened.incident.supportIncidentId,
    requestId: 'support-request-reader-failure-update',
    closureStatus: SUPPORT_CLOSURE_STATUS.RESOLVED,
    addOperatorEvidenceRefs: ['operator-auth-evidence:reader-failure'],
    addEscalationRefs: ['escalation:auth-owner'],
    addClosureCriteria: ['operator auth evidence must be fresh'],
  };

  const first = await service.updateIncident(update);
  const replay = await service.updateIncident(update);

  assert.equal(first.accepted, false);
  assert.equal(replay.accepted, false);
  if (!first.accepted && !replay.accepted) {
    assert.equal(first.reason, 'closure_blocked');
    assert.equal(replay.reason, 'closure_blocked');
    assert.deepEqual(first.closureReasons, [
      'action_refs_missing',
      'canonical_evidence_unavailable:operator-auth-evidence:reader-failure',
    ]);
    assert.deepEqual(replay.closureReasons, first.closureReasons);
  }
  assert.equal(readerCalls, 1);
});

void test('AC-F0028-11 blocks critical terminal closure until owner evidence or human disposition exists', async () => {
  const { store } = createMemoryStore();
  const service = createSupportEvidenceService({
    store,
    now: () => now,
    readers: {
      inspectRelease: () =>
        Promise.resolve({
          request: { requestId: 'release-request:1' },
          rollbackPlan: null,
          deployAttempts: [],
          evidenceBundles: [],
          rollbackExecutions: [],
        } as unknown as ReleaseInspection),
    },
    ownerSeams: {
      'F-0026': () => Promise.resolve({ accepted: true, evidenceRef: 'release-request:1' }),
    },
  });
  const opened = await service.openIncident({
    requestId: 'support-request-critical-service',
    incidentClass: SUPPORT_INCIDENT_CLASS.RELEASE_OR_ROLLBACK,
    severity: SUPPORT_SEVERITY.CRITICAL,
    sourceRefs: ['release-request:1'],
    releaseRefs: ['release-request:1'],
  });
  assert.equal(opened.accepted, true);
  if (!opened.accepted) return;

  const blocked = await service.updateIncident({
    supportIncidentId: opened.incident.supportIncidentId,
    requestId: 'support-request-critical-close-blocked',
    closureStatus: SUPPORT_CLOSURE_STATUS.RESOLVED,
    addEscalationRefs: ['escalation:release-owner'],
    addClosureCriteria: ['release owner evidence must be attached'],
  });

  assert.equal(blocked.accepted, false);
  if (!blocked.accepted) {
    assert.equal(blocked.reason, 'closure_blocked');
  }

  const resolved = await service.updateIncident({
    supportIncidentId: opened.incident.supportIncidentId,
    requestId: 'support-request-critical-close-resolved',
    closureStatus: SUPPORT_CLOSURE_STATUS.RESOLVED,
    addEscalationRefs: ['escalation:release-owner'],
    addClosureCriteria: ['release owner evidence attached'],
    addActionRefs: [
      {
        mode: SUPPORT_ACTION_MODE.OWNER_ROUTED,
        owner: 'F-0026',
        ref: 'support-action:release-owner',
        requestedAction: 'inspect release owner evidence',
      },
    ],
  });

  assert.equal(resolved.accepted, true);
  if (resolved.accepted) {
    assert.equal(resolved.incident.closureStatus, SUPPORT_CLOSURE_STATUS.RESOLVED);
  }
});

void test('AC-F0028-10 rejects forged owner-routed terminal evidence without owner seam', async () => {
  const { store } = createMemoryStore();
  const service = createSupportEvidenceService({ store, now: () => now });
  const opened = await service.openIncident({
    requestId: 'support-request-forged-action-open',
    incidentClass: SUPPORT_INCIDENT_CLASS.RELEASE_OR_ROLLBACK,
    severity: SUPPORT_SEVERITY.CRITICAL,
    sourceRefs: ['release-request:1'],
    releaseRefs: ['release-request:1'],
  });
  assert.equal(opened.accepted, true);
  if (!opened.accepted) return;

  const forged = await service.updateIncident({
    supportIncidentId: opened.incident.supportIncidentId,
    requestId: 'support-request-forged-action-close',
    closureStatus: SUPPORT_CLOSURE_STATUS.RESOLVED,
    addEscalationRefs: ['escalation:release-owner'],
    addClosureCriteria: ['release owner evidence attached'],
    addActionRefs: [
      {
        mode: SUPPORT_ACTION_MODE.OWNER_ROUTED,
        owner: 'F-0026',
        ref: 'support-action:forged-release-owner',
        requestedAction: 'inspect release owner evidence',
      },
    ],
  });

  assert.equal(forged.accepted, false);
  if (!forged.accepted) {
    assert.equal(forged.reason, 'closure_blocked');
    assert.equal(forged.closureReasons?.includes('critical_terminal_disposition_missing'), true);
  }
});
