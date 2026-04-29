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
import type { SupportIncidentRecordResult, SupportIncidentRow, SupportStore } from '@yaagi/db';
import { createSupportEvidenceService } from '../../src/support/support-evidence.ts';

const now = '2026-04-29T12:00:00.000Z';

const createMemoryStore = (): {
  store: SupportStore;
  incidents: Record<string, SupportIncidentRow>;
} => {
  const incidents: Record<string, SupportIncidentRow> = {};

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
      const row: SupportIncidentRow = {
        ...bundle,
        requestId,
        normalizedRequestHash,
      };
      incidents[row.supportIncidentId] = row;
      return Promise.resolve({ accepted: true, deduplicated: false, incident: row });
    },
    updateIncident: (input): Promise<SupportIncidentRecordResult> => {
      const {
        requestId,
        normalizedRequestHash,
        canonicalEvidenceStates,
        requestedWriteSurfaces,
        ...bundle
      } = input;
      void requestedWriteSurfaces;
      const readiness = evaluateSupportClosureReadiness({
        bundle,
        ...(canonicalEvidenceStates ? { canonicalEvidenceStates } : {}),
      });
      if (readiness.status === 'blocked') {
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
        requestId,
        normalizedRequestHash,
      };
      incidents[row.supportIncidentId] = row;
      return Promise.resolve({ accepted: true, deduplicated: false, incident: row });
    },
    getIncident: (supportIncidentId) => Promise.resolve(incidents[supportIncidentId] ?? null),
    listIncidents: () => Promise.resolve(Object.values(incidents)),
  };

  return { store, incidents };
};

void test('AC-F0028-08 AC-F0028-09 opens support evidence with operator provenance and redacted notes', async () => {
  const { store } = createMemoryStore();
  const service = createSupportEvidenceService({ store, now: () => now });

  const result = await service.openIncident({
    requestId: 'support-request-open-service',
    incidentClass: SUPPORT_INCIDENT_CLASS.OPERATOR_ACCESS,
    severity: SUPPORT_SEVERITY.WARNING,
    sourceRefs: ['operator-route:/state'],
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
});

void test('AC-F0028-11 blocks critical terminal closure until owner evidence or human disposition exists', async () => {
  const { store } = createMemoryStore();
  const service = createSupportEvidenceService({ store, now: () => now });
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
        status: SUPPORT_ACTION_STATUS.SUCCEEDED,
        evidenceRef: 'release-request:1',
        recordedAt: now,
      },
    ],
  });

  assert.equal(resolved.accepted, true);
  if (resolved.accepted) {
    assert.equal(resolved.incident.closureStatus, SUPPORT_CLOSURE_STATUS.RESOLVED);
  }
});
