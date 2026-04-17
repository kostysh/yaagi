import test from 'node:test';
import assert from 'node:assert/strict';
import { qualificationJsonChecksPass } from '../qualify-vllm-fast.ts';

void test('F-0020 qualification JSON gate rejects false ok even when echo matches', () => {
  const verdict = qualificationJsonChecksPass({
    parsed: {
      ok: false,
      echo: 'gate',
    },
    task: {
      taskId: 'structured-json-gate',
      kind: 'json',
      messages: [],
      maxTokens: 48,
      checks: {
        requiredKeys: ['ok', 'echo'],
        requiredTrueKeys: ['ok'],
        expectedEcho: 'gate',
      },
    },
  });

  assert.deepEqual(verdict, {
    ok: false,
    detail: 'task structured-json-gate returned a non-true guard field',
  });
});

void test('F-0020 qualification JSON gate rejects non-string status values', () => {
  const verdict = qualificationJsonChecksPass({
    parsed: {
      status: true,
      rationale: 'probe succeeded',
    },
    task: {
      taskId: 'structured-json-1',
      kind: 'json',
      messages: [],
      maxTokens: 64,
      checks: {
        requiredKeys: ['status', 'rationale'],
        requiredStringKeys: ['status', 'rationale'],
        allowedStatusValues: ['ok', 'blocked'],
      },
    },
  });

  assert.deepEqual(verdict, {
    ok: false,
    detail: 'task structured-json-1 returned a non-string status',
  });
});

void test('F-0020 qualification JSON gate rejects malformed structured string fields', () => {
  const verdict = qualificationJsonChecksPass({
    parsed: {
      service_id: 42,
      readiness_basis: {},
      recommended_action: [],
    },
    task: {
      taskId: 'structured-json-2',
      kind: 'json',
      messages: [],
      maxTokens: 96,
      checks: {
        requiredKeys: ['service_id', 'readiness_basis', 'recommended_action'],
        requiredStringKeys: ['service_id', 'readiness_basis', 'recommended_action'],
      },
    },
  });

  assert.deepEqual(verdict, {
    ok: false,
    detail: 'task structured-json-2 returned a non-string field',
  });
});

void test('F-0020 qualification JSON gate accepts the canonical Gemma structured-output payload', () => {
  const verdict = qualificationJsonChecksPass({
    parsed: {
      ok: true,
      echo: 'gate',
    },
    task: {
      taskId: 'structured-json-gate',
      kind: 'json',
      messages: [],
      maxTokens: 48,
      checks: {
        requiredKeys: ['ok', 'echo'],
        requiredBooleanKeys: ['ok'],
        requiredStringKeys: ['echo'],
        requiredTrueKeys: ['ok'],
        expectedEcho: 'gate',
      },
    },
  });

  assert.deepEqual(verdict, {
    ok: true,
    detail: null,
  });
});
