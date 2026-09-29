import type { Result } from '@polyphony/core-types';

type Failure = { readonly code: 'failed' };

const preserve = <T, E>(result: Result<T, E>): Result<T, E> => result;

const success: Result<{ readonly id: number }, Failure> = {
  ok: true,
  value: { id: 1 },
};
const failure: Result<{ readonly id: number }, Failure> = {
  ok: false,
  error: { code: 'failed' },
};

const preservedSuccess: Result<{ readonly id: number }, Failure> =
  preserve(success);
const preservedFailure: Result<{ readonly id: number }, Failure> =
  preserve(failure);

const read = <T, E>(result: Result<T, E>): T | E => {
  if (result.ok) {
    const value: T = result.value;

    // @ts-expect-error -- the error branch is unavailable after success narrowing.
    void result.error;

    return value;
  }

  const error: E = result.error;

  // @ts-expect-error -- the value branch is unavailable after failure narrowing.
  void result.value;

  return error;
};

const zero: Result<0, Failure> = { ok: true, value: 0 };
const empty: Result<'', Failure> = { ok: true, value: '' };
const falseValue: Result<false, Failure> = { ok: true, value: false };
const undefinedValue: Result<undefined, Failure> = {
  ok: true,
  value: undefined,
};
const undefinedError: Result<number, undefined> = {
  ok: false,
  error: undefined,
};

// @ts-expect-error -- a success result requires its value payload.
const missingValue: Result<number, Failure> = { ok: true };

// @ts-expect-error -- a failure result requires its error payload.
const missingError: Result<number, Failure> = { ok: false };

const invalidDiscriminant: Result<number, Failure> = {
  // @ts-expect-error -- the discriminant must be the literal true or false.
  ok: 'true',
  value: 1,
};

if (success.ok) {
  // @ts-expect-error -- public fields are readonly.
  success.value = { id: 2 };
}

if (!failure.ok) {
  // @ts-expect-error -- both branch payloads are readonly.
  failure.error = { code: 'failed' };
}

// @ts-expect-error -- the discriminant is readonly as well.
success.ok = false;

void [
  preservedSuccess,
  preservedFailure,
  read(success),
  read(failure),
  zero,
  empty,
  falseValue,
  undefinedValue,
  undefinedError,
  missingValue,
  missingError,
  invalidDiscriminant,
];
