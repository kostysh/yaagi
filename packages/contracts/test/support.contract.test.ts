import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  SUPPORT_ACTION_MODE,
  SUPPORT_ACTION_STATUS,
  SUPPORT_CANONICAL_EVIDENCE_FRESHNESS,
  SUPPORT_CLOSURE_STATUS,
  SUPPORT_FOREIGN_WRITE_SURFACE,
  SUPPORT_INCIDENT_CLASS,
  SUPPORT_INCIDENT_CLASSES,
  SUPPORT_RUNBOOK_REQUIRED_SECTIONS,
  SUPPORT_SEVERITY,
  assertSupportOwnedWriteSurface,
  createSupportOperatorNote,
  evaluateSupportClosureReadiness,
  redactSupportText,
  supportEvidenceBundleSchema,
  supportOpenIncidentRequestSchema,
  supportUpdateIncidentRequestSchema,
  supportRunbookContractSchema,
} from '../src/support.ts';

const now = '2026-04-29T12:00:00.000Z';
const runbookRoot = new URL('../../../docs/support/runbooks/', import.meta.url);

void test('AC-F0028-01 AC-F0028-03 defines the first support taxonomy and action vocabulary', () => {
  assert.deepEqual([...SUPPORT_INCIDENT_CLASSES].sort(), [
    SUPPORT_INCIDENT_CLASS.GOVERNANCE_OR_SAFETY_ESCALATION,
    SUPPORT_INCIDENT_CLASS.MODEL_READINESS,
    SUPPORT_INCIDENT_CLASS.OPERATOR_ACCESS,
    SUPPORT_INCIDENT_CLASS.RELEASE_OR_ROLLBACK,
    SUPPORT_INCIDENT_CLASS.REPORTING_FRESHNESS,
    SUPPORT_INCIDENT_CLASS.RUNTIME_AVAILABILITY,
    SUPPORT_INCIDENT_CLASS.SUPPORT_PROCESS_GAP,
  ]);

  const opened = supportOpenIncidentRequestSchema.parse({
    requestId: 'support-request-1',
    incidentClass: SUPPORT_INCIDENT_CLASS.RUNTIME_AVAILABILITY,
    severity: SUPPORT_SEVERITY.WARNING,
    sourceRefs: ['operator-route:/health'],
  });

  assert.equal(opened.incidentClass, SUPPORT_INCIDENT_CLASS.RUNTIME_AVAILABILITY);
  assert.equal(SUPPORT_ACTION_MODE.OWNER_ROUTED, 'owner_routed');
  assert.equal(SUPPORT_ACTION_MODE.HUMAN_ONLY, 'human_only');
});

void test('AC-F0028-04 validates the runbook contract required for every first incident class', () => {
  const parsed = supportRunbookContractSchema.parse({
    incidentClass: SUPPORT_INCIDENT_CLASS.RELEASE_OR_ROLLBACK,
    title: 'Release or rollback incident',
    docPath: 'docs/support/runbooks/release_or_rollback.md',
    version: '2026-04-29',
    ownerSeams: ['F-0013', 'F-0024', 'F-0026'],
    detectionSignals: ['operator release inspection reports failure'],
    triageReads: ['GET /control/releases through F-0013/F-0024'],
    allowedActions: ['record owner-routed F-0026 release request evidence'],
    forbiddenShortcuts: ['direct writes to release tables'],
    escalationOwner: 'F-0026',
    evidenceRequirements: ['release request or rollback execution ref'],
    closureCriteria: ['terminal F-0026 evidence is attached'],
  });

  assert.equal(parsed.incidentClass, SUPPORT_INCIDENT_CLASS.RELEASE_OR_ROLLBACK);
  assert.deepEqual(SUPPORT_RUNBOOK_REQUIRED_SECTIONS, [
    'detection_signals',
    'triage_reads',
    'allowed_actions',
    'forbidden_shortcuts',
    'escalation_owner',
    'evidence_requirements',
    'closure_criteria',
  ]);
});

void test('AC-F0028-04 provides runbook docs for every first incident class', () => {
  for (const incidentClass of SUPPORT_INCIDENT_CLASSES) {
    const content = readFileSync(path.join(runbookRoot.pathname, `${incidentClass}.md`), 'utf8');
    for (const heading of [
      '## Detection signals',
      '## Triage reads',
      '## Allowed actions',
      '## Forbidden shortcuts',
      '## Escalation owner',
      '## Evidence requirements',
      '## Closure criteria',
    ]) {
      assert.equal(
        content.includes(heading),
        true,
        `${incidentClass} runbook must include ${heading}`,
      );
    }
  }
});

void test('AC-F0028-08 AC-F0028-11 blocks critical closure without terminal owner evidence or human disposition', () => {
  const bundle = supportEvidenceBundleSchema.parse({
    supportIncidentId: 'support-incident:critical-1',
    incidentClass: SUPPORT_INCIDENT_CLASS.OPERATOR_ACCESS,
    severity: SUPPORT_SEVERITY.CRITICAL,
    sourceRefs: ['operator-route:/state'],
    reportRunRefs: [],
    releaseRefs: [],
    operatorEvidenceRefs: ['operator-auth-evidence:req-1'],
    actionRefs: [],
    escalationRefs: ['escalation:on-call'],
    closureCriteria: ['operator access restored or transferred with residual risk'],
    operatorNotes: [],
    closureStatus: SUPPORT_CLOSURE_STATUS.RESOLVED,
    residualRisk: null,
    nextOwnerRef: null,
    createdAt: now,
    updatedAt: now,
    closedAt: now,
  });

  assert.deepEqual(evaluateSupportClosureReadiness({ bundle }), {
    status: 'blocked',
    reasons: ['action_refs_missing', 'critical_terminal_disposition_missing'],
  });

  const humanDisposition = supportEvidenceBundleSchema.parse({
    ...bundle,
    actionRefs: [
      {
        mode: SUPPORT_ACTION_MODE.HUMAN_ONLY,
        owner: 'human',
        ref: 'support-action:human-1',
        requestedAction: 'escalated to duty owner',
        status: SUPPORT_ACTION_STATUS.DOCUMENTED,
        evidenceRef: null,
        recordedAt: now,
      },
    ],
    residualRisk: 'operator key rotation is still pending',
    nextOwnerRef: 'F-0024',
  });

  assert.deepEqual(evaluateSupportClosureReadiness({ bundle: humanDisposition }), {
    status: 'ready',
    reasons: [],
  });
});

void test('AC-F0028-09 redacts reusable secrets from support notes', () => {
  const note = createSupportOperatorNote({
    noteId: 'support-note:1',
    body: 'Bearer abc.def token=opk_v1_secret PASSWORD=hunter2 password: swordfish "token":"json-secret" api_key: key-1',
    operatorPrincipalRef: 'operator:support',
    operatorSessionRef: 'operator-session:1',
    createdAt: now,
  });

  assert.equal(note.redacted, true);
  assert.equal(note.body.includes('abc.def'), false);
  assert.equal(note.body.includes('hunter2'), false);
  assert.equal(note.body.includes('swordfish'), false);
  assert.equal(note.body.includes('json-secret'), false);
  assert.equal(note.body.includes('key-1'), false);
  assert.equal(redactSupportText('YAAGI_SECRET=value'), 'YAAGI_SECRET=<redacted>');
});

void test('AC-F0028-10 rejects client-supplied owner-routed terminal action evidence', () => {
  assert.equal(
    supportUpdateIncidentRequestSchema.safeParse({
      requestId: 'support-request:forged-action',
      addActionRefs: [
        {
          mode: SUPPORT_ACTION_MODE.OWNER_ROUTED,
          owner: 'F-0026',
          ref: 'support-action:forged',
          requestedAction: 'claim release owner success',
          status: SUPPORT_ACTION_STATUS.SUCCEEDED,
          evidenceRef: 'release-request:forged',
          recordedAt: now,
        },
      ],
    }).success,
    false,
  );
});

void test('AC-F0028-12 marks stale canonical evidence as degraded and missing evidence as blocked', () => {
  const bundle = supportEvidenceBundleSchema.parse({
    supportIncidentId: 'support-incident:warning-1',
    incidentClass: SUPPORT_INCIDENT_CLASS.REPORTING_FRESHNESS,
    severity: SUPPORT_SEVERITY.WARNING,
    sourceRefs: ['report-run:identity'],
    reportRunRefs: ['report-run:identity'],
    releaseRefs: [],
    operatorEvidenceRefs: [],
    actionRefs: [
      {
        mode: SUPPORT_ACTION_MODE.OWNER_ROUTED,
        owner: 'F-0023',
        ref: 'support-action:report-check',
        requestedAction: 'inspect report freshness',
        status: SUPPORT_ACTION_STATUS.SUCCEEDED,
        evidenceRef: 'report-run:identity',
        recordedAt: now,
      },
    ],
    escalationRefs: ['escalation:reporting-owner'],
    closureCriteria: ['fresh report evidence is attached'],
    operatorNotes: [],
    closureStatus: SUPPORT_CLOSURE_STATUS.RESOLVED,
    residualRisk: null,
    nextOwnerRef: null,
    createdAt: now,
    updatedAt: now,
    closedAt: now,
  });

  assert.deepEqual(
    evaluateSupportClosureReadiness({
      bundle,
      canonicalEvidenceStates: [
        {
          owner: 'F-0023',
          ref: 'report-run:identity',
          freshness: SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.STALE,
          observedAt: now,
        },
      ],
    }),
    {
      status: 'degraded',
      reasons: ['canonical_evidence_stale:report-run:identity'],
    },
  );

  assert.equal(
    evaluateSupportClosureReadiness({
      bundle,
      canonicalEvidenceStates: [
        {
          owner: 'F-0026',
          ref: 'release-request:missing',
          freshness: SUPPORT_CANONICAL_EVIDENCE_FRESHNESS.MISSING,
          observedAt: now,
        },
      ],
    }).status,
    'blocked',
  );
});

void test('AC-F0028-13 rejects foreign write surfaces from the support owner', () => {
  assert.doesNotThrow(() => assertSupportOwnedWriteSurface('support_incidents'));
  assert.throws(() => assertSupportOwnedWriteSurface(SUPPORT_FOREIGN_WRITE_SURFACE.REPORTING));
});
