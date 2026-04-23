import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OPERATOR_TICK_NOTE_MAX_LENGTH,
  OPERATOR_TICK_PAYLOAD_MAX_BYTES,
  OPERATOR_TICK_REQUEST_ID_MAX_LENGTH,
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
