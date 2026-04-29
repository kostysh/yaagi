import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OPERATOR_RELEASE_CONTROL_BODY_MAX_BYTES,
  OPERATOR_SUPPORT_BODY_MAX_BYTES,
  OPERATOR_TICK_NOTE_MAX_LENGTH,
  OPERATOR_TICK_PAYLOAD_MAX_BYTES,
  OPERATOR_TICK_REQUEST_ID_MAX_LENGTH,
  operatorReleaseDeployAttemptRequestSchema,
  operatorReleasePrepareRequestSchema,
  operatorReleaseRollbackRequestSchema,
  supportOpenIncidentRequestSchema,
  supportUpdateIncidentRequestSchema,
  operatorTickControlRequestSchema,
} from '../src/operator-api.ts';

void test('AC-F0024-13 bounds operator tick-control request ids, notes and payload size', () => {
  assert.equal(
    operatorTickControlRequestSchema.safeParse({
      requestId: 'r'.repeat(OPERATOR_TICK_REQUEST_ID_MAX_LENGTH + 1),
      kind: 'reactive',
    }).success,
    false,
  );
  assert.equal(
    operatorTickControlRequestSchema.safeParse({
      requestId: 'operator-request-1',
      kind: 'reactive',
      note: 'n'.repeat(OPERATOR_TICK_NOTE_MAX_LENGTH + 1),
    }).success,
    false,
  );
  assert.equal(
    operatorTickControlRequestSchema.safeParse({
      requestId: 'operator-request-1',
      kind: 'reactive',
      payload: {
        oversized: 'x'.repeat(OPERATOR_TICK_PAYLOAD_MAX_BYTES + 1),
      },
    }).success,
    false,
  );
});

void test('AC-F0026-02 AC-F0026-08 bounds protected release-control payloads', () => {
  const prepared = operatorReleasePrepareRequestSchema.parse({
    requestId: 'release-request:operator',
    targetEnvironment: 'release_cell',
    gitRef: 'git:main',
    rollbackTargetRef: 'git:stable',
    governorEvidenceRef: 'development-proposal-decision:1',
    lifecycleRollbackTargetRef: 'graceful_shutdown:shutdown-1',
    modelServingReadinessRef: 'model_profile_health:code.deep@shared',
    diagnosticReportRefs: ['report-run:development'],
  });

  assert.deepEqual(prepared.diagnosticReportRefs, ['report-run:development']);
  assert.deepEqual(prepared.evidenceRefs, []);
  assert.equal(
    operatorReleasePrepareRequestSchema.safeParse({
      ...prepared,
      diagnosticReportRefs: [],
    }).success,
    false,
  );
  assert.equal(
    operatorReleasePrepareRequestSchema.safeParse({
      ...prepared,
      targetEnvironment: 'production',
    }).success,
    false,
  );
  assert.equal(
    operatorReleasePrepareRequestSchema.safeParse({
      ...prepared,
      evidenceRefs: ['x'.repeat(OPERATOR_RELEASE_CONTROL_BODY_MAX_BYTES)],
    }).success,
    false,
  );
  assert.equal(
    operatorReleaseDeployAttemptRequestSchema.safeParse({
      requestId: 'release-request:operator',
      deployAttemptId: 'deploy-attempt:operator',
    }).success,
    true,
  );
  assert.equal(
    operatorReleaseDeployAttemptRequestSchema.safeParse({
      requestId: 'release-request:operator',
      smokeCommand: 'pnpm test',
    }).success,
    false,
  );
  assert.equal(
    operatorReleaseRollbackRequestSchema.safeParse({
      requestId: 'release-request:operator',
      deployAttemptId: 'deploy-attempt:operator',
      rollbackPlanId: 'rollback-plan:operator',
    }).success,
    true,
  );
  assert.equal(
    operatorReleaseRollbackRequestSchema.safeParse({
      requestId: 'release-request:operator',
      deployAttemptId: 'deploy-attempt:operator',
      trigger: 'operator_manual',
    }).success,
    false,
  );
});

void test('AC-F0028-08 bounds protected support incident payloads', () => {
  const opened = supportOpenIncidentRequestSchema.parse({
    requestId: 'support-request:operator',
    incidentClass: 'runtime_availability',
    severity: 'warning',
    sourceRefs: ['operator-route:/health'],
  });

  assert.deepEqual(opened.reportRunRefs, []);
  assert.equal(
    supportOpenIncidentRequestSchema.safeParse({
      ...opened,
      sourceRefs: [],
    }).success,
    false,
  );
  assert.equal(
    supportUpdateIncidentRequestSchema.safeParse({
      requestId: 'support-request:update',
      addClosureCriteria: ['x'.repeat(OPERATOR_SUPPORT_BODY_MAX_BYTES)],
    }).success,
    false,
  );
  assert.equal(
    supportUpdateIncidentRequestSchema.safeParse({
      requestId: 'support-request:update',
      closureStatus: 'resolved',
      addActionRefs: [
        {
          mode: 'human_only',
          owner: 'human',
          ref: 'support-action:1',
          requestedAction: 'manual escalation',
          status: 'documented',
          evidenceRef: null,
          recordedAt: '2026-04-29T12:00:00.000Z',
        },
      ],
    }).success,
    true,
  );
});
