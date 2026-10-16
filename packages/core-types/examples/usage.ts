import assert from 'node:assert/strict';
import {
  parseAgentId,
  parseElapsedMs,
  parseEvidenceRef,
  parseRevision,
  parseWallTimeMs,
} from '@polyphony/core-types';

const agent = parseAgentId('agent/1');
const policy = parseRevision(' policy:001 ');
const wall = parseWallTimeMs(-1);
const elapsed = parseElapsedMs(0);
const evidence = parseEvidenceRef({
  sourceKind: 'outcome',
  id: 'outcome/1',
  revision: 'hash:abc',
});
assert.ok(agent.ok && policy.ok && wall.ok && elapsed.ok && evidence.ok);
assert.equal(agent.value, 'agent/1');
assert.equal(policy.value, ' policy:001 ');
assert.equal(wall.value, -1);
assert.equal(elapsed.value, 0);
assert.equal(evidence.value.revision, 'hash:abc');
assert.ok(Object.isFrozen(evidence.value));
console.log('success: exact IDs, revision, wall time, elapsed and evidence');

const invalid = parseElapsedMs(-1);
assert.deepEqual(invalid, { ok: false, error: { code: 'invalid_input' } });
console.log('error: invalid_input');

const corrected = parseElapsedMs(1);
assert.deepEqual(corrected, { ok: true, value: 1 });
console.log('recovery: corrected elapsed accepted');
