import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const entry = import.meta.resolve('@polyphony/core-types');
let effects = 0;
const forbidden = () => {
  effects++;
  throw new Error('Unexpected I/O, timer, clock or logging');
};
for (const key of [
  'fetch',
  'WebSocket',
  'setTimeout',
  'setInterval',
  'setImmediate',
]) {
  Object.defineProperty(globalThis, key, {
    value: forbidden,
    configurable: true,
  });
}
for (const key of ['log', 'error', 'warn', 'info', 'debug', 'trace']) {
  Object.defineProperty(console, key, { value: forbidden, configurable: true });
}
Object.defineProperty(Date, 'now', { value: forbidden, configurable: true });
const globals = Reflect.ownKeys(globalThis);
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === entry) {
      throw new Error(`Unexpected core-types dependency: ${specifier}`);
    }
    return nextResolve(specifier, context);
  },
});

try {
  const coreTypes = await import('@polyphony/core-types');
  assert.deepEqual(Object.getOwnPropertyNames(coreTypes).sort(), [
    'parseActionId',
    'parseAgentId',
    'parseElapsedMs',
    'parseEvidenceRef',
    'parseRevision',
    'parseTickId',
    'parseWallTimeMs',
  ]);
  for (const parse of Object.values(coreTypes))
    assert.equal(typeof parse, 'function');
  for (const parse of [
    coreTypes.parseAgentId,
    coreTypes.parseTickId,
    coreTypes.parseActionId,
    coreTypes.parseRevision,
  ]) {
    assert.deepEqual(parse('token'), { ok: true, value: 'token' });
    assert.deepEqual(parse(null), {
      ok: false,
      error: { code: 'invalid_input' },
    });
  }
  for (const parse of [coreTypes.parseWallTimeMs, coreTypes.parseElapsedMs]) {
    assert.deepEqual(parse(0), { ok: true, value: 0 });
    assert.deepEqual(parse(null), {
      ok: false,
      error: { code: 'invalid_input' },
    });
  }
  const ref = { sourceKind: 'outcome', id: 'o', revision: 'v' };
  assert.deepEqual(coreTypes.parseEvidenceRef(ref), { ok: true, value: ref });
  assert.deepEqual(coreTypes.parseEvidenceRef(null), {
    ok: false,
    error: { code: 'invalid_input' },
  });
  assert.equal(effects, 0);
  assert.deepEqual(Reflect.ownKeys(globalThis), globals);
} finally {
  hooks.deregister();
}
