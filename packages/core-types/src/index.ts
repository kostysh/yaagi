export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

declare const brand: unique symbol;
type Branded<T, Name extends string> = T & { readonly [brand]: Name };

export type AgentId = Branded<string, 'AgentId'>;
export type TickId = Branded<string, 'TickId'>;
export type ActionId = Branded<string, 'ActionId'>;
export type Revision = Branded<string, 'Revision'>;
export type WallTimeMs = Branded<number, 'WallTimeMs'>;
export type ElapsedMs = Branded<number, 'ElapsedMs'>;

export type EvidenceRef = {
  readonly sourceKind: string;
  readonly id: string;
  readonly revision: Revision;
};

export type PrimitiveFailure = { readonly code: 'invalid_input' };

const invalidInput = Object.freeze({
  ok: false as const,
  error: Object.freeze({ code: 'invalid_input' as const }),
});

const success = <T>(value: T): Result<T, PrimitiveFailure> =>
  Object.freeze({ ok: true, value });

const isToken = (input: unknown): input is string =>
  typeof input === 'string' && input.length > 0;

export function parseAgentId(
  input: unknown,
): Result<AgentId, PrimitiveFailure> {
  return isToken(input) ? success(input as AgentId) : invalidInput;
}

export function parseTickId(input: unknown): Result<TickId, PrimitiveFailure> {
  return isToken(input) ? success(input as TickId) : invalidInput;
}

export function parseActionId(
  input: unknown,
): Result<ActionId, PrimitiveFailure> {
  return isToken(input) ? success(input as ActionId) : invalidInput;
}

export function parseRevision(
  input: unknown,
): Result<Revision, PrimitiveFailure> {
  return isToken(input) ? success(input as Revision) : invalidInput;
}

export function parseWallTimeMs(
  input: unknown,
): Result<WallTimeMs, PrimitiveFailure> {
  return typeof input === 'number' && Number.isSafeInteger(input)
    ? success(input as WallTimeMs)
    : invalidInput;
}

export function parseElapsedMs(
  input: unknown,
): Result<ElapsedMs, PrimitiveFailure> {
  return typeof input === 'number' && Number.isSafeInteger(input) && input >= 0
    ? success(input as ElapsedMs)
    : invalidInput;
}

export function parseEvidenceRef(
  input: unknown,
): Result<EvidenceRef, PrimitiveFailure> {
  if (typeof input !== 'object' || input === null) return invalidInput;

  try {
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null)
      return invalidInput;

    // Read data descriptors so validation never invokes an input accessor.
    const fields = Object.getOwnPropertyDescriptors(input);
    const keys = Reflect.ownKeys(fields);
    if (
      keys.length !== 3 ||
      !keys.includes('sourceKind') ||
      !keys.includes('id') ||
      !keys.includes('revision')
    ) {
      return invalidInput;
    }

    for (const name of ['sourceKind', 'id', 'revision']) {
      if (!Object.hasOwn(fields[name], 'value')) return invalidInput;
    }

    const sourceKind: unknown = fields.sourceKind.value;
    const id: unknown = fields.id.value;
    const revision: unknown = fields.revision.value;
    if (!isToken(sourceKind) || !isToken(id) || !isToken(revision)) {
      return invalidInput;
    }

    return success(
      Object.freeze({ sourceKind, id, revision: revision as Revision }),
    );
  } catch {
    return invalidInput;
  }
}
