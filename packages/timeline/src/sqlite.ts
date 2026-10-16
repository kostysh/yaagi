import { readFile } from 'node:fs/promises';
import { type AgentId, parseAgentId, type Result } from '@polyphony/core-types';
import type {
  SqlMigration,
  SqlScope,
  SqlValue,
} from '@polyphony/state/adapters/sqlite';
import { and, asc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import type { z } from 'zod';
import {
  DecideInputSchema,
  ReadTickKeySchema,
  ReserveTickInputSchema,
  SettleInputSchema,
  type TickRecord,
  TickRecordSchema,
  type TimelineFailure,
  type TimelineHead,
  type TimelinePort,
} from './contracts.js';
import { ticks } from './schema.js';

const ok = <T>(value: T): Result<T, TimelineFailure> =>
  Object.freeze({ ok: true, value });
const fail = (code: TimelineFailure['code']): Result<never, TimelineFailure> =>
  Object.freeze({ ok: false, error: Object.freeze({ code }) });

function input<T extends object>(
  schema: z.ZodType<T>,
  value: unknown,
): Result<T, TimelineFailure> {
  try {
    const parsed = schema.safeParse(value);
    if (!parsed.success || typeof value !== 'object' || value === null)
      return fail('invalid_input');
    // Zod's enumerable-key strictness alone omits symbol/non-enumerable extras.
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== Reflect.ownKeys(parsed.data).length ||
      keys.some((key) => !Object.hasOwn(parsed.data, key))
    )
      return fail('invalid_input');
    return ok(parsed.data);
  } catch {
    return fail('invalid_input');
  }
}
function parameter(value: unknown): SqlValue {
  if (value === null || typeof value === 'string' || typeof value === 'number')
    return value;
  throw new TypeError('Invalid timeline SQL parameter');
}

// JSON numbers lose signed zero. Only these two numeric fields use this explicit
// storage encoding; ordinary tokens and all other values remain unchanged.
function encode(record: TickRecord): string {
  return JSON.stringify(record, (key, value: unknown) =>
    (key === 'wallTime' || key === 'elapsed') && Object.is(value, -0)
      ? '-0'
      : value,
  );
}
function decode(row: typeof ticks.$inferSelect): TickRecord | null {
  try {
    const value: unknown = JSON.parse(row.body, (key, value: unknown) =>
      (key === 'wallTime' || key === 'elapsed') && value === '-0' ? -0 : value,
    );
    const parsed = TickRecordSchema.safeParse(value);
    if (!parsed.success) return null;
    const record = parsed.data;
    return record.frame.agentId === row.agentId &&
      record.frame.tickId === row.tickId &&
      record.frame.sequence === row.sequence &&
      record.phase === row.phase
      ? record
      : null;
  } catch {
    return null;
  }
}
function head(records: readonly TickRecord[]): TimelineHead {
  const lastTick = records.at(-1) ?? null;
  return Object.freeze({
    lastSequence: lastTick?.frame.sequence ?? 0,
    previousCompleteTick:
      lastTick?.phase === 'settled'
        ? lastTick.frame.tickId
        : (lastTick?.frame.previousCompleteTick ?? null),
    lastTick,
  });
}

export function bindTimeline(scope: SqlScope, agentId: AgentId): TimelinePort {
  const boundAgent = parseAgentId(agentId);
  const db = drizzle(async (sql, params: unknown[], method) => {
    const values = params.map(parameter);
    if (method === 'run') {
      await scope.run(sql, values);
      return { rows: [] };
    }
    return { rows: await scope.all(sql, values) };
  });

  // T1 validates the agent's full technical history rather than maintaining a
  // second mutable head. Gaps are valid; broken links or an older active tick are not.
  async function history(): Promise<
    Result<readonly TickRecord[], TimelineFailure>
  > {
    if (!boundAgent.ok) return fail('invalid_input');
    const rows = await db
      .select()
      .from(ticks)
      .where(eq(ticks.agentId, boundAgent.value))
      .orderBy(asc(ticks.sequence))
      .all();
    const records: TickRecord[] = [];
    let previous: TickRecord['frame']['previousCompleteTick'] = null;
    let sequence = 0;
    let active = false;
    for (const row of rows) {
      const record = decode(row);
      if (
        !record ||
        active ||
        record.frame.sequence <= sequence ||
        record.frame.previousCompleteTick !== previous
      )
        return fail('incompatible');
      records.push(record);
      sequence = record.frame.sequence;
      active = record.phase === 'reserved' || record.phase === 'decided';
      if (record.phase === 'settled') previous = record.frame.tickId;
    }
    return ok(Object.freeze(records));
  }
  async function update(
    before: TickRecord,
    after: TickRecord,
  ): Promise<Result<TickRecord, TimelineFailure>> {
    const rows = await db
      .update(ticks)
      .set({ body: encode(after), phase: after.phase })
      .where(
        and(
          eq(ticks.tickId, before.frame.tickId),
          eq(ticks.agentId, agentId),
          eq(ticks.phase, before.phase),
        ),
      )
      .returning({ tickId: ticks.tickId })
      .all();
    return rows.length === 1 ? ok(after) : fail('conflict');
  }
  return Object.freeze({
    reserveTick: async (raw) => {
      const parsed = input(ReserveTickInputSchema, raw);
      if (!parsed.ok) return parsed;
      const saved = await history();
      if (!saved.ok) return saved;
      const current = head(saved.value);
      if (
        current.lastSequence === Number.MAX_SAFE_INTEGER ||
        current.lastTick?.phase === 'reserved' ||
        current.lastTick?.phase === 'decided'
      )
        return fail('conflict');
      const record = TickRecordSchema.parse({
        schemaVersion: 1,
        phase: 'reserved',
        revision: 0,
        frame: {
          ...parsed.value,
          agentId,
          sequence: current.lastSequence + 1,
          previousCompleteTick: current.previousCompleteTick,
        },
      });
      const rows = await db
        .insert(ticks)
        .values({
          tickId: record.frame.tickId,
          agentId,
          sequence: record.frame.sequence,
          phase: record.phase,
          body: encode(record),
        })
        .onConflictDoNothing()
        .returning({ tickId: ticks.tickId })
        .all();
      return rows.length === 1 ? ok(record) : fail('conflict');
    },
    decide: async (raw) => {
      const parsed = input(DecideInputSchema, raw);
      if (!parsed.ok) return parsed;
      const saved = await history();
      if (!saved.ok) return saved;
      const before = saved.value.find(
        (record) => record.frame.tickId === parsed.value.tickId,
      );
      if (before?.phase !== 'reserved') return fail('conflict');
      return update(
        before,
        TickRecordSchema.parse({
          ...before,
          phase: 'decided',
          revision: 1,
          actionRef: parsed.value.actionRef,
        }),
      );
    },
    settle: async (raw) => {
      const parsed = input(SettleInputSchema, raw);
      if (!parsed.ok) return parsed;
      const saved = await history();
      if (!saved.ok) return saved;
      const before = saved.value.find(
        (record) => record.frame.tickId === parsed.value.tickId,
      );
      if (
        before?.phase !== 'decided' ||
        before.actionRef !== parsed.value.actionRef
      )
        return fail('conflict');
      return update(
        before,
        TickRecordSchema.parse({
          ...before,
          phase: 'settled',
          revision: 2,
          outcomeRef: parsed.value.outcomeRef,
        }),
      );
    },
    resume: async () => {
      const saved = await history();
      if (!saved.ok) return saved;
      const before = saved.value.at(-1);
      if (before?.phase !== 'reserved') return ok(head(saved.value));
      const changed = await update(
        before,
        TickRecordSchema.parse({
          ...before,
          phase: 'interrupted',
          revision: 1,
        }),
      );
      return changed.ok
        ? ok(head([...saved.value.slice(0, -1), changed.value]))
        : changed;
    },
    readTick: async (raw) => {
      const key = input(ReadTickKeySchema, raw);
      if (!key.ok) return key;
      const saved = await history();
      if (!saved.ok) return saved;
      return ok(
        saved.value.find((record) =>
          'tickId' in key.value
            ? record.frame.tickId === key.value.tickId
            : record.frame.sequence === key.value.sequence,
        ) ?? null,
      );
    },
    readHead: async () => {
      const saved = await history();
      return saved.ok ? ok(head(saved.value)) : saved;
    },
  } satisfies TimelinePort);
}

export async function loadTimelineMigrations(): Promise<
  readonly SqlMigration[]
> {
  return [
    {
      id: 'timeline_0000',
      sql: await readFile(
        new URL('./migrations/0000_timeline.sql', import.meta.url),
        'utf8',
      ),
    },
  ];
}
