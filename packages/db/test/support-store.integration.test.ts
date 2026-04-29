import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORT_ACTION_MODE,
  SUPPORT_ACTION_STATUS,
  SUPPORT_CLOSURE_STATUS,
  SUPPORT_FOREIGN_WRITE_SURFACE,
  SUPPORT_INCIDENT_CLASS,
  SUPPORT_OWNED_WRITE_SURFACE,
  SUPPORT_SEVERITY,
  type SupportEvidenceBundle,
  type SupportRunbookContract,
} from '@yaagi/contracts/support';
import { createSupportStore, type SupportDbExecutor } from '../src/support.ts';

const now = '2026-04-29T12:00:00.000Z';

type HarnessIncidentRow = {
  supportIncidentId: string;
  requestId: string;
  normalizedRequestHash: string;
  incidentClass: string;
  severity: string;
  sourceRefsJson: string[];
  reportRunRefsJson: string[];
  releaseRefsJson: string[];
  operatorEvidenceRefsJson: string[];
  actionRefsJson: SupportEvidenceBundle['actionRefs'];
  escalationRefsJson: string[];
  closureCriteriaJson: string[];
  operatorNotesJson: SupportEvidenceBundle['operatorNotes'];
  closureStatus: string;
  closureReadinessStatus: string;
  closureReadinessReasonsJson: string[];
  residualRisk: string | null;
  nextOwnerRef: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
};

type HarnessRunbookRow = {
  runbookId: string;
  incidentClass: string;
  docPath: string;
  version: string;
  requiredSectionsJson: string[];
  sourceRefsJson: string[];
  createdAt: string;
  updatedAt: string;
};

const parseJson = <T>(value: unknown): T =>
  typeof value === 'string' ? (JSON.parse(value) as T) : (value as T);

const normalizeSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim().toLowerCase();

const createHarness = (): {
  db: SupportDbExecutor;
  incidentsById: Record<string, HarnessIncidentRow>;
  incidentRequestIndex: Record<string, string>;
  runbooksByClass: Record<string, HarnessRunbookRow>;
} => {
  const incidentsById: Record<string, HarnessIncidentRow> = {};
  const incidentRequestIndex: Record<string, string> = {};
  const updateRequestsById: Record<
    string,
    {
      supportIncidentId: string;
      normalizedRequestHash: string;
      status: string;
      rejectionReason: string | null;
      closureReasonsJson: string[];
    }
  > = {};
  const runbooksByClass: Record<string, HarnessRunbookRow> = {};

  const query = async (sqlText: string, params: unknown[] = []) => {
    await Promise.resolve();
    const sql = normalizeSql(sqlText);

    if (sql === 'begin' || sql === 'commit' || sql === 'rollback') {
      return { rows: [] };
    }

    if (sql.includes('insert into polyphony_runtime.support_runbook_versions')) {
      const row: HarnessRunbookRow = {
        runbookId: String(params[0]),
        incidentClass: String(params[1]),
        docPath: String(params[2]),
        version: String(params[3]),
        requiredSectionsJson: parseJson<string[]>(params[4]),
        sourceRefsJson: parseJson<string[]>(params[5]),
        createdAt: String(params[6]),
        updatedAt: String(params[7]),
      };
      runbooksByClass[row.incidentClass] = row;
      return { rows: [row] };
    }

    if (sql.includes('from polyphony_runtime.support_runbook_versions')) {
      return {
        rows: Object.values(runbooksByClass).sort((left, right) =>
          left.incidentClass.localeCompare(right.incidentClass),
        ),
      };
    }

    if (
      sql.includes('from polyphony_runtime.support_incidents') &&
      sql.includes('where request_id = $1')
    ) {
      const supportIncidentId = incidentRequestIndex[String(params[0])];
      return { rows: supportIncidentId ? [incidentsById[supportIncidentId]] : [] };
    }

    if (
      sql.includes('from polyphony_runtime.support_incidents') &&
      sql.includes('where support_incident_id = $1')
    ) {
      const row = incidentsById[String(params[0])];
      return { rows: row ? [row] : [] };
    }

    if (sql.includes('insert into polyphony_runtime.support_incident_update_requests')) {
      const requestId = String(params[0]);
      if (updateRequestsById[requestId]) {
        return { rows: [] };
      }
      updateRequestsById[requestId] = {
        supportIncidentId: String(params[1]),
        normalizedRequestHash: String(params[2]),
        status: 'pending',
        rejectionReason: null,
        closureReasonsJson: [],
      };
      return { rows: [{ request_id: requestId }] };
    }

    if (sql.startsWith('update polyphony_runtime.support_incident_update_requests')) {
      const requestId = String(params[0]);
      const row = updateRequestsById[requestId];
      if (row) {
        row.status = String(params[1]);
        row.rejectionReason = (params[2] as string | null) ?? null;
        row.closureReasonsJson = parseJson<string[]>(params[3]);
      }
      return { rows: [] };
    }

    if (sql.includes('from polyphony_runtime.support_incident_update_requests')) {
      const row = updateRequestsById[String(params[0])];
      return {
        rows: row
          ? [
              {
                supportIncidentId: row.supportIncidentId,
                normalizedRequestHash: row.normalizedRequestHash,
                status: row.status,
                rejectionReason: row.rejectionReason,
                closureReasonsJson: row.closureReasonsJson,
              },
            ]
          : [],
      };
    }

    if (sql.includes('insert into polyphony_runtime.support_incidents')) {
      if (incidentRequestIndex[String(params[1])]) {
        return { rows: [] };
      }
      const row: HarnessIncidentRow = {
        supportIncidentId: String(params[0]),
        requestId: String(params[1]),
        normalizedRequestHash: String(params[2]),
        incidentClass: String(params[3]),
        severity: String(params[4]),
        sourceRefsJson: parseJson<string[]>(params[5]),
        reportRunRefsJson: parseJson<string[]>(params[6]),
        releaseRefsJson: parseJson<string[]>(params[7]),
        operatorEvidenceRefsJson: parseJson<string[]>(params[8]),
        actionRefsJson: parseJson<SupportEvidenceBundle['actionRefs']>(params[9]),
        escalationRefsJson: parseJson<string[]>(params[10]),
        closureCriteriaJson: parseJson<string[]>(params[11]),
        operatorNotesJson: parseJson<SupportEvidenceBundle['operatorNotes']>(params[12]),
        closureStatus: String(params[13]),
        closureReadinessStatus: String(params[14]),
        closureReadinessReasonsJson: parseJson<string[]>(params[15]),
        residualRisk: (params[16] as string | null) ?? null,
        nextOwnerRef: (params[17] as string | null) ?? null,
        createdAt: String(params[18]),
        updatedAt: String(params[19]),
        closedAt: (params[20] as string | null) ?? null,
      };
      incidentsById[row.supportIncidentId] = row;
      incidentRequestIndex[row.requestId] = row.supportIncidentId;
      return { rows: [row] };
    }

    if (sql.startsWith('update polyphony_runtime.support_incidents')) {
      const supportIncidentId = String(params[0]);
      const current = incidentsById[supportIncidentId];
      if (!current) {
        return { rows: [] };
      }
      const row: HarnessIncidentRow = {
        ...current,
        sourceRefsJson: parseJson<string[]>(params[1]),
        reportRunRefsJson: parseJson<string[]>(params[2]),
        releaseRefsJson: parseJson<string[]>(params[3]),
        operatorEvidenceRefsJson: parseJson<string[]>(params[4]),
        actionRefsJson: parseJson<SupportEvidenceBundle['actionRefs']>(params[5]),
        escalationRefsJson: parseJson<string[]>(params[6]),
        closureCriteriaJson: parseJson<string[]>(params[7]),
        operatorNotesJson: parseJson<SupportEvidenceBundle['operatorNotes']>(params[8]),
        closureStatus: String(params[9]),
        closureReadinessStatus: String(params[10]),
        closureReadinessReasonsJson: parseJson<string[]>(params[11]),
        residualRisk: (params[12] as string | null) ?? null,
        nextOwnerRef: (params[13] as string | null) ?? null,
        updatedAt: String(params[14]),
        closedAt: (params[15] as string | null) ?? null,
      };
      incidentsById[supportIncidentId] = row;
      return { rows: [row] };
    }

    if (sql.includes('from polyphony_runtime.support_incidents')) {
      return {
        rows: Object.values(incidentsById)
          .sort(
            (left, right) =>
              right.updatedAt.localeCompare(left.updatedAt) ||
              right.supportIncidentId.localeCompare(left.supportIncidentId),
          )
          .slice(0, Number(params[0])),
      };
    }

    throw new Error(`support harness does not support SQL: ${sqlText}`);
  };

  return {
    db: { query } as unknown as SupportDbExecutor,
    incidentsById,
    incidentRequestIndex,
    runbooksByClass,
  };
};

const baseIncident = (patch: Partial<SupportEvidenceBundle> = {}): SupportEvidenceBundle => ({
  supportIncidentId: 'support-incident:runtime-1',
  incidentClass: SUPPORT_INCIDENT_CLASS.RUNTIME_AVAILABILITY,
  severity: SUPPORT_SEVERITY.WARNING,
  sourceRefs: ['operator-route:/health'],
  reportRunRefs: [],
  releaseRefs: [],
  operatorEvidenceRefs: ['operator-auth-evidence:req-1'],
  actionRefs: [
    {
      mode: SUPPORT_ACTION_MODE.OWNER_ROUTED,
      owner: 'F-0013',
      ref: 'support-action:inspect-health',
      requestedAction: 'inspect operator health route',
      status: SUPPORT_ACTION_STATUS.SUCCEEDED,
      evidenceRef: 'operator-route:/health',
      recordedAt: now,
    },
  ],
  escalationRefs: ['escalation:runtime-owner'],
  closureCriteria: ['health route and report evidence are attached'],
  operatorNotes: [],
  closureStatus: SUPPORT_CLOSURE_STATUS.OPEN,
  residualRisk: null,
  nextOwnerRef: null,
  createdAt: now,
  updatedAt: now,
  closedAt: null,
  ...patch,
});

void test('AC-F0028-08 records support incidents as support-owned evidence bundles', async () => {
  const harness = createHarness();
  const store = createSupportStore(harness.db);

  const result = await store.openIncident({
    ...baseIncident(),
    requestId: 'support-request-open-1',
    normalizedRequestHash: 'hash-open-1',
  });

  assert.equal(result.accepted, true);
  if (!result.accepted) return;

  assert.equal(result.incident.supportIncidentId, 'support-incident:runtime-1');
  assert.deepEqual(result.incident.sourceRefs, ['operator-route:/health']);
  assert.equal(
    harness.incidentsById['support-incident:runtime-1']?.incidentClass,
    'runtime_availability',
  );
});

void test('AC-F0028-02 keeps open incident requests idempotent and rejects conflicting replay', async () => {
  const harness = createHarness();
  const store = createSupportStore(harness.db);
  const first = await store.openIncident({
    ...baseIncident(),
    requestId: 'support-request-replay',
    normalizedRequestHash: 'hash-replay',
  });
  const replay = await store.openIncident({
    ...baseIncident({ supportIncidentId: 'support-incident:runtime-replay' }),
    requestId: 'support-request-replay',
    normalizedRequestHash: 'hash-replay',
  });
  const conflict = await store.openIncident({
    ...baseIncident({ severity: SUPPORT_SEVERITY.CRITICAL }),
    requestId: 'support-request-replay',
    normalizedRequestHash: 'different-hash',
  });

  assert.equal(first.accepted, true);
  assert.deepEqual([replay.accepted, replay.accepted ? replay.deduplicated : null], [true, true]);
  assert.equal(conflict.accepted, false);
  if (!conflict.accepted) {
    assert.equal(conflict.reason, 'conflicting_request_id');
  }
  assert.equal(Object.keys(harness.incidentsById).length, 1);
});

void test('AC-F0028-02 keeps update requests idempotent and rejects conflicting replay', async () => {
  const harness = createHarness();
  const store = createSupportStore(harness.db);
  await store.openIncident({
    ...baseIncident(),
    requestId: 'support-request-update-open',
    normalizedRequestHash: 'hash-update-open',
  });

  const first = await store.updateIncident({
    ...baseIncident({ sourceRefs: ['operator-route:/health', 'support-source:first'] }),
    requestId: 'support-request-update-replay',
    normalizedRequestHash: 'hash-update-replay',
  });
  const replay = await store.updateIncident({
    ...baseIncident({ closureStatus: SUPPORT_CLOSURE_STATUS.RESOLVED, closedAt: now }),
    requestId: 'support-request-update-replay',
    normalizedRequestHash: 'hash-update-replay',
  });
  const conflict = await store.updateIncident({
    ...baseIncident({ releaseRefs: ['release-request:conflict'] }),
    requestId: 'support-request-update-replay',
    normalizedRequestHash: 'different-update-hash',
  });

  assert.equal(first.accepted, true);
  assert.deepEqual([replay.accepted, replay.accepted ? replay.deduplicated : null], [true, true]);
  assert.equal(conflict.accepted, false);
  if (!conflict.accepted) {
    assert.equal(conflict.reason, 'conflicting_request_id');
  }
  assert.deepEqual(harness.incidentsById['support-incident:runtime-1']?.sourceRefsJson, [
    'operator-route:/health',
    'support-source:first',
  ]);
  assert.equal(
    harness.incidentsById['support-incident:runtime-1']?.closureStatus,
    SUPPORT_CLOSURE_STATUS.OPEN,
  );
});

void test('AC-F0028-02 rejects replay after a claimed update fails before application', async () => {
  const harness = createHarness();
  const store = createSupportStore(harness.db);
  await store.openIncident({
    ...baseIncident(),
    requestId: 'support-request-failed-claim-open',
    normalizedRequestHash: 'hash-failed-claim-open',
  });

  const claimed = await store.claimIncidentUpdate({
    supportIncidentId: 'support-incident:runtime-1',
    requestId: 'support-request-failed-claim-update',
    normalizedRequestHash: 'hash-failed-claim-update',
    createdAt: now,
  });
  assert.equal(claimed.accepted, true);

  await store.rejectIncidentUpdate({
    supportIncidentId: 'support-incident:runtime-1',
    requestId: 'support-request-failed-claim-update',
    normalizedRequestHash: 'hash-failed-claim-update',
    completedAt: now,
    reason: 'request_failed',
    closureReasons: ['post_claim_update_failed'],
  });

  const replay = await store.claimIncidentUpdate({
    supportIncidentId: 'support-incident:runtime-1',
    requestId: 'support-request-failed-claim-update',
    normalizedRequestHash: 'hash-failed-claim-update',
    createdAt: now,
  });

  assert.equal(replay.accepted, false);
  if (!replay.accepted) {
    assert.equal(replay.reason, 'request_failed');
    assert.deepEqual(replay.closureReasons, ['post_claim_update_failed']);
  }
});

void test('AC-F0028-02 rejects update replay when the request id targets another incident', async () => {
  const harness = createHarness();
  const store = createSupportStore(harness.db);
  await store.openIncident({
    ...baseIncident({ supportIncidentId: 'support-incident:runtime-1' }),
    requestId: 'support-request-target-open-1',
    normalizedRequestHash: 'hash-target-open-1',
  });
  await store.openIncident({
    ...baseIncident({ supportIncidentId: 'support-incident:runtime-2' }),
    requestId: 'support-request-target-open-2',
    normalizedRequestHash: 'hash-target-open-2',
  });

  const first = await store.updateIncident({
    ...baseIncident({
      supportIncidentId: 'support-incident:runtime-1',
      sourceRefs: ['operator-route:/health', 'support-source:first'],
    }),
    requestId: 'support-request-target-update',
    normalizedRequestHash: 'same-body-hash',
  });
  const conflict = await store.updateIncident({
    ...baseIncident({
      supportIncidentId: 'support-incident:runtime-2',
      sourceRefs: ['operator-route:/health', 'support-source:first'],
    }),
    requestId: 'support-request-target-update',
    normalizedRequestHash: 'same-body-hash',
  });

  assert.equal(first.accepted, true);
  assert.equal(conflict.accepted, false);
  if (!conflict.accepted) {
    assert.equal(conflict.reason, 'conflicting_request_id');
  }
});

void test('AC-F0028-08 serializes support updates without dropping prior evidence refs', async () => {
  const harness = createHarness();
  const store = createSupportStore(harness.db);
  await store.openIncident({
    ...baseIncident(),
    requestId: 'support-request-merge-open',
    normalizedRequestHash: 'hash-merge-open',
  });

  await store.updateIncident({
    ...baseIncident({ sourceRefs: ['operator-route:/health', 'support-source:first'] }),
    requestId: 'support-request-merge-first',
    normalizedRequestHash: 'hash-merge-first',
  });
  const second = await store.updateIncident({
    ...baseIncident({ releaseRefs: ['release-request:second'] }),
    requestId: 'support-request-merge-second',
    normalizedRequestHash: 'hash-merge-second',
  });

  assert.equal(second.accepted, true);
  if (!second.accepted) return;
  assert.deepEqual(second.incident.sourceRefs, ['operator-route:/health', 'support-source:first']);
  assert.deepEqual(second.incident.releaseRefs, ['release-request:second']);
});

void test('AC-F0028-11 AC-F0028-12 refuses blocked critical terminal closure', async () => {
  const harness = createHarness();
  const store = createSupportStore(harness.db);
  await store.openIncident({
    ...baseIncident({ severity: SUPPORT_SEVERITY.CRITICAL, actionRefs: [] }),
    requestId: 'support-request-critical-open',
    normalizedRequestHash: 'hash-critical-open',
  });

  const result = await store.updateIncident({
    ...baseIncident({
      severity: SUPPORT_SEVERITY.CRITICAL,
      actionRefs: [],
      closureStatus: SUPPORT_CLOSURE_STATUS.RESOLVED,
      closedAt: now,
    }),
    requestId: 'support-request-critical-close',
    normalizedRequestHash: 'hash-critical-close',
    scalarFieldUpdates: { closureStatus: true },
  });

  assert.equal(result.accepted, false);
  if (!result.accepted) {
    assert.equal(result.reason, 'closure_blocked');
    assert.deepEqual(result.closureReasons, [
      'action_refs_missing',
      'critical_terminal_disposition_missing',
    ]);
  }
  assert.equal(
    harness.incidentsById['support-incident:runtime-1']?.closureStatus,
    SUPPORT_CLOSURE_STATUS.OPEN,
  );
});

void test('AC-F0028-12 persists degraded closure readiness for stale canonical evidence', async () => {
  const harness = createHarness();
  const store = createSupportStore(harness.db);
  await store.openIncident({
    ...baseIncident(),
    requestId: 'support-request-degraded-open',
    normalizedRequestHash: 'hash-degraded-open',
  });

  const result = await store.updateIncident({
    ...baseIncident({
      closureStatus: SUPPORT_CLOSURE_STATUS.RESOLVED,
      closedAt: now,
    }),
    requestId: 'support-request-degraded-close',
    normalizedRequestHash: 'hash-degraded-close',
    scalarFieldUpdates: { closureStatus: true },
    canonicalEvidenceStates: [
      {
        owner: 'F-0023',
        ref: 'report-run:stale',
        freshness: 'stale',
        observedAt: now,
      },
    ],
  });

  assert.equal(result.accepted, true);
  if (!result.accepted) return;
  assert.equal(result.closureReadiness.status, 'degraded');
  assert.deepEqual(result.incident.closureReadinessReasons, [
    'canonical_evidence_stale:report-run:stale',
  ]);
});

void test('AC-F0028-08 preserves current scalar state when a stale update only adds evidence', async () => {
  const harness = createHarness();
  const store = createSupportStore(harness.db);
  await store.openIncident({
    ...baseIncident(),
    requestId: 'support-request-scalar-open',
    normalizedRequestHash: 'hash-scalar-open',
  });
  const closed = await store.updateIncident({
    ...baseIncident({
      closureStatus: SUPPORT_CLOSURE_STATUS.RESOLVED,
      residualRisk: 'accepted by owner',
      nextOwnerRef: 'F-0013',
      closedAt: now,
    }),
    requestId: 'support-request-scalar-close',
    normalizedRequestHash: 'hash-scalar-close',
    scalarFieldUpdates: { closureStatus: true, residualRisk: true, nextOwnerRef: true },
  });
  assert.equal(closed.accepted, true);

  const staleEvidenceUpdate = await store.updateIncident({
    ...baseIncident({ sourceRefs: ['operator-route:/health', 'support-source:late'] }),
    requestId: 'support-request-scalar-stale-evidence',
    normalizedRequestHash: 'hash-scalar-stale-evidence',
  });

  assert.equal(staleEvidenceUpdate.accepted, true);
  if (!staleEvidenceUpdate.accepted) return;
  assert.equal(staleEvidenceUpdate.incident.closureStatus, SUPPORT_CLOSURE_STATUS.RESOLVED);
  assert.equal(staleEvidenceUpdate.incident.residualRisk, 'accepted by owner');
  assert.equal(staleEvidenceUpdate.incident.nextOwnerRef, 'F-0013');
  assert.deepEqual(staleEvidenceUpdate.incident.sourceRefs, [
    'operator-route:/health',
    'support-source:late',
  ]);
});

void test('AC-F0028-13 rejects foreign owner writes without mutating support rows', async () => {
  const harness = createHarness();
  const store = createSupportStore(harness.db);

  const result = await store.openIncident({
    ...baseIncident(),
    requestId: 'support-request-foreign-write',
    normalizedRequestHash: 'hash-foreign-write',
    requestedWriteSurfaces: [SUPPORT_FOREIGN_WRITE_SURFACE.RELEASE_AUTOMATION],
  });

  assert.deepEqual(result, {
    accepted: false,
    reason: 'foreign_owner_write_rejected',
    rejectedWriteSurface: SUPPORT_FOREIGN_WRITE_SURFACE.RELEASE_AUTOMATION,
  });
  assert.equal(Object.keys(harness.incidentsById).length, 0);
});

void test('AC-F0028-04 persists runbook version metadata on the support-owned surface only', async () => {
  const harness = createHarness();
  const store = createSupportStore(harness.db);
  const runbook: SupportRunbookContract = {
    incidentClass: SUPPORT_INCIDENT_CLASS.MODEL_READINESS,
    title: 'Model readiness',
    docPath: 'docs/support/runbooks/model_readiness.md',
    version: '2026-04-29',
    ownerSeams: ['F-0013', 'F-0023'],
    detectionSignals: ['model health report degraded'],
    triageReads: ['GET /models'],
    allowedActions: ['record owner-routed model readiness evidence'],
    forbiddenShortcuts: ['direct model service mutation'],
    escalationOwner: 'F-0023',
    evidenceRequirements: ['model health report ref'],
    closureCriteria: ['fresh model health evidence attached'],
  };

  const row = await store.upsertRunbookVersion({
    runbookId: 'support-runbook:model-readiness',
    incidentClass: runbook.incidentClass,
    docPath: runbook.docPath,
    version: runbook.version,
    requiredSectionsJson: [
      'detection_signals',
      'triage_reads',
      'allowed_actions',
      'forbidden_shortcuts',
      'escalation_owner',
      'evidence_requirements',
      'closure_criteria',
    ],
    sourceRefsJson: runbook.ownerSeams,
    createdAt: now,
    updatedAt: now,
    requestedWriteSurfaces: [SUPPORT_OWNED_WRITE_SURFACE.SUPPORT_RUNBOOK_VERSIONS],
  });

  assert.equal(row.incidentClass, SUPPORT_INCIDENT_CLASS.MODEL_READINESS);
  assert.equal((await store.listRunbookVersions()).length, 1);
});
