import assert from 'node:assert/strict';
import {
  actualManifest,
  policyFixture,
  registeredSchemas,
} from './fixtures.js';

const forbidden = () => {
  throw new Error('unexpected I/O, timer or logging');
};
for (const key of [
  'fetch',
  'WebSocket',
  'setTimeout',
  'setInterval',
  'setImmediate',
])
  Object.defineProperty(globalThis, key, {
    value: forbidden,
    configurable: true,
  });
for (const key of ['log', 'error', 'warn', 'info', 'debug', 'trace'])
  Object.defineProperty(console, key, { value: forbidden, configurable: true });

const contracts = await import('@polyphony/constitution/contracts');
assert.deepEqual(Object.keys(contracts), []);
const implementation = await import('@polyphony/constitution');
assert.deepEqual(Object.keys(implementation), ['createConstitution']);
assert.equal(implementation.createConstitution(null).ok, false);
const created = implementation.createConstitution(policyFixture());
assert.ok(created.ok);
assert.ok(created.value.checkBoot(actualManifest(), registeredSchemas()).ok);
assert.equal(created.value.checkBoot(null, null).ok, false);
