import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseActionId,
  parseAgentId,
  parseElapsedMs,
  parseEvidenceRef,
  parseRevision,
  parseTickId,
  parseWallTimeMs,
  type PrimitiveFailure,
  type Result,
} from '@polyphony/core-types';

function expectFailure(result: Result<unknown, PrimitiveFailure>): void {
  assert.deepEqual(result, { ok: false, error: { code: 'invalid_input' } });
  assert.ok(Object.isFrozen(result));
  if (!result.ok) assert.ok(Object.isFrozen(result.error));
}

for (const [name, parse] of Object.entries({
  parseAgentId,
  parseTickId,
  parseActionId,
  parseRevision,
})) {
  test(`${name} preserves opaque strings without conversion`, () => {
    for (const input of [
      'id/1',
      ' ',
      '  Mixed Case\t',
      'é',
      'e\u0301',
      '0001',
    ]) {
      const result = parse(input);
      assert.deepEqual(result, { ok: true, value: input });
      assert.ok(Object.isFrozen(result));
    }
  });

  test(`${name} rejects empty and non-string values without coercion`, () => {
    let conversions = 0;
    const convertible = {
      [Symbol.toPrimitive]() {
        conversions++;
        throw new Error('private input');
      },
    };
    for (const input of [
      '',
      undefined,
      null,
      0,
      true,
      1n,
      {},
      [],
      Symbol('private'),
      Object('id/1'),
      convertible,
      () => 'id/1',
    ])
      expectFailure(parse(input));
    assert.equal(conversions, 0);
    assert.deepEqual(parse('corrected'), { ok: true, value: 'corrected' });
  });
}

for (const [name, parse, valid] of [
  [
    'wall',
    parseWallTimeMs,
    [Number.MIN_SAFE_INTEGER, -1, -0, 0, 1, Number.MAX_SAFE_INTEGER],
  ],
  ['elapsed', parseElapsedMs, [-0, 0, 1, Number.MAX_SAFE_INTEGER]],
] as const) {
  test(`${name} time preserves every accepted boundary, including signed zero`, () => {
    for (const input of valid) {
      const result = parse(input);
      assert.ok(result.ok);
      assert.ok(Object.is(result.value, input));
      assert.ok(Object.isFrozen(result));
    }
  });

  test(`${name} time rejects invalid numbers and coercible inputs`, () => {
    for (const input of [
      Number.MIN_SAFE_INTEGER - 1,
      Number.MAX_SAFE_INTEGER + 1,
      NaN,
      Infinity,
      -Infinity,
      0.5,
      -0.5,
      '0',
      0n,
      Object(0),
      null,
      undefined,
      true,
      {},
      [],
      Symbol('private'),
    ])
      expectFailure(parse(input));
  });
}

test('elapsed rejects negative integers while wall time can move backward', () => {
  expectFailure(parseElapsedMs(-1));
  assert.deepEqual(parseElapsedMs(0), { ok: true, value: 0 });
  assert.deepEqual(
    [parseWallTimeMs(100), parseWallTimeMs(-1)],
    [
      { ok: true, value: 100 },
      { ok: true, value: -1 },
    ],
  );
});

const ref = () => ({
  sourceKind: ' outcome ',
  id: 'source/1',
  revision: ' hash:00 ',
});

test('evidence ref accepts exact data records, including frozen and null prototypes', () => {
  const hidden = Object.defineProperties(
    {},
    {
      sourceKind: { value: ' outcome ' },
      id: { value: 'source/1' },
      revision: { value: ' hash:00 ' },
    },
  );
  for (const input of [
    ref(),
    Object.freeze(ref()),
    Object.assign(Object.create(null), ref()),
    hidden,
  ]) {
    const before = Object.getOwnPropertyDescriptors(input);
    const result = parseEvidenceRef(input);
    assert.deepEqual(result, { ok: true, value: ref() });
    assert.deepEqual(Object.getOwnPropertyDescriptors(input), before);
    assert.ok(result.ok);
    assert.notEqual(result.value, input);
    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result.value));
  }
});

test('evidence ref rejects malformed, inherited, extra and symbol fields', () => {
  class RefRecord {
    sourceKind = 'outcome';
    id = 'source/1';
    revision = 'v1';
  }
  for (const input of [
    null,
    undefined,
    'ref',
    1,
    [],
    new Date(0),
    new RefRecord(),
    {},
    { ...ref(), extra: true },
    { ...ref(), [Symbol('extra')]: true },
    Object.defineProperty(ref(), 'hidden', { value: true }),
    Object.create(ref()),
  ])
    expectFailure(parseEvidenceRef(input));
  for (const field of ['sourceKind', 'id', 'revision']) {
    const missing: Record<string, unknown> = ref();
    delete missing[field];
    expectFailure(parseEvidenceRef(missing));
    for (const value of ['', undefined, null, 0, false, {}, Object('token')]) {
      expectFailure(parseEvidenceRef({ ...ref(), [field]: value }));
    }
  }
});

test('evidence ref never invokes accessors', () => {
  let reads = 0;
  for (const field of ['sourceKind', 'id', 'revision']) {
    const input = Object.defineProperty(ref(), field, {
      get() {
        reads++;
        throw new Error('private accessor data');
      },
    });
    expectFailure(parseEvidenceRef(input));
  }
  assert.equal(reads, 0);
});

test('throwing reflection and revoked proxies return only the safe failure', () => {
  const fail = () => {
    throw new Error('private reflection data');
  };
  for (const handler of [
    { getPrototypeOf: fail },
    { ownKeys: fail },
    { getOwnPropertyDescriptor: fail },
  ])
    expectFailure(parseEvidenceRef(new Proxy(ref(), handler)));
  const revoked = Proxy.revocable(ref(), {});
  revoked.revoke();
  expectFailure(parseEvidenceRef(revoked.proxy));
  assert.deepEqual(parseEvidenceRef(ref()), { ok: true, value: ref() });
});

test('parser results are immutable and detached from caller mutation', () => {
  const input = ref();
  const result = parseEvidenceRef(input);
  assert.ok(result.ok);
  input.id = 'changed';
  input.revision = 'changed';
  assert.deepEqual(result.value, ref());
  assert.equal(Reflect.set(result, 'ok', false), false);
  assert.equal(Reflect.set(result, 'value', input), false);
  for (const field of ['sourceKind', 'id', 'revision']) {
    assert.equal(Reflect.set(result.value, field, 'changed'), false);
  }
  const failure = parseEvidenceRef(null);
  assert.ok(!failure.ok);
  assert.equal(Reflect.set(failure, 'error', {}), false);
  assert.equal(Reflect.set(failure.error, 'code', 'private'), false);
  assert.deepEqual(parseEvidenceRef(input), { ok: true, value: input });
  assert.deepEqual(result.value, ref());
});
