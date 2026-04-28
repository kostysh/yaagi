import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPECIALIST_FOREIGN_WRITE_SURFACE,
  SPECIALIST_OWNED_WRITE_SURFACE,
} from '@yaagi/contracts/specialists';

void test('AC-F0027-13 / AC-F0027-19 specialist policy does not define a shadow model registry', () => {
  assert.ok(
    !Object.values(SPECIALIST_OWNED_WRITE_SURFACE).includes(
      'polyphony_runtime.model_registry' as never,
    ),
  );
  assert.equal(SPECIALIST_FOREIGN_WRITE_SURFACE.MODEL_REGISTRY, 'polyphony_runtime.model_registry');
  assert.ok(
    Object.values(SPECIALIST_OWNED_WRITE_SURFACE).every((surface) =>
      surface.includes('specialist_'),
    ),
  );
});
