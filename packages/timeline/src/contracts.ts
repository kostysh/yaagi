import {
  type Result,
  parseActionId,
  parseAgentId,
  parseElapsedMs,
  parseEvidenceRef,
  parseRevision,
  parseTickId,
  parseWallTimeMs,
} from '@polyphony/core-types';
import { z } from 'zod';

function primitive<T>(parse: (input: unknown) => Result<T, unknown>) {
  return z.unknown().transform((input, context) => {
    const parsed = parse(input);
    if (parsed.ok) return parsed.value;
    context.addIssue({ code: 'custom', message: 'Invalid value' });
    return z.NEVER;
  });
}

const Agent = primitive(parseAgentId);
const Tick = primitive(parseTickId);
const Action = primitive(parseActionId);
const Revision = primitive(parseRevision);
const WallTime = primitive(parseWallTimeMs);
const Elapsed = primitive(parseElapsedMs);
const Evidence = primitive(parseEvidenceRef);
const Sequence = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);

export const TickModeSchema = z.enum([
  'REACTIVE',
  'DELIBERATIVE',
  'CONTEMPLATIVE',
  'CONSOLIDATION',
  'DEVELOPMENTAL',
  'DORMANT',
]);
export const ReserveTickInputSchema = z
  .strictObject({
    tickId: Tick,
    epoch: z.string().min(1),
    wallTime: WallTime,
    elapsed: Elapsed,
    mode: TickModeSchema,
    policyRevision: Revision,
    snapshotRevision: Revision,
  })
  .readonly();
export const TickFrameSchema = z
  .strictObject({
    ...ReserveTickInputSchema.unwrap().shape,
    agentId: Agent,
    sequence: Sequence,
    previousCompleteTick: Tick.nullable(),
  })
  .readonly();
const record = { schemaVersion: z.literal(1), frame: TickFrameSchema };
export const TickRecordSchema = z
  .discriminatedUnion('phase', [
    z.strictObject({
      ...record,
      phase: z.literal('reserved'),
      revision: z.literal(0),
    }),
    z.strictObject({
      ...record,
      phase: z.literal('decided'),
      revision: z.literal(1),
      actionRef: Action,
    }),
    z.strictObject({
      ...record,
      phase: z.literal('settled'),
      revision: z.literal(2),
      actionRef: Action,
      outcomeRef: Evidence,
    }),
    z.strictObject({
      ...record,
      phase: z.literal('interrupted'),
      revision: z.literal(1),
    }),
  ])
  .readonly();
export const DecideInputSchema = z
  .strictObject({
    tickId: Tick,
    expectedRevision: z.literal(0),
    actionRef: Action,
  })
  .readonly();
export const SettleInputSchema = z
  .strictObject({
    tickId: Tick,
    expectedRevision: z.literal(1),
    actionRef: Action,
    outcomeRef: Evidence,
  })
  .readonly();
export const ReadTickKeySchema = z
  .union([
    z.strictObject({ tickId: Tick }),
    z.strictObject({ sequence: Sequence }),
  ])
  .readonly();

export type TickMode = z.output<typeof TickModeSchema>;
export type ReserveTickInput = z.output<typeof ReserveTickInputSchema>;
export type TickFrame = z.output<typeof TickFrameSchema>;
export type TickRecord = z.output<typeof TickRecordSchema>;
export type TickRevision = TickRecord['revision'];
export type DecideInput = z.output<typeof DecideInputSchema>;
export type SettleInput = z.output<typeof SettleInputSchema>;
export type ReadTickKey =
  | { readonly tickId: TickFrame['tickId']; readonly sequence?: never }
  | { readonly sequence: number; readonly tickId?: never };
export type TimelineHead = {
  readonly lastSequence: number;
  readonly previousCompleteTick: TickFrame['previousCompleteTick'];
  readonly lastTick: TickRecord | null;
};
export type TimelineFailure = {
  readonly code: 'invalid_input' | 'conflict' | 'incompatible';
};
export interface TimelinePort {
  reserveTick(
    input: ReserveTickInput,
  ): Promise<Result<TickRecord, TimelineFailure>>;
  decide(input: DecideInput): Promise<Result<TickRecord, TimelineFailure>>;
  settle(input: SettleInput): Promise<Result<TickRecord, TimelineFailure>>;
  resume(): Promise<Result<TimelineHead, TimelineFailure>>;
  readTick(
    key: ReadTickKey,
  ): Promise<Result<TickRecord | null, TimelineFailure>>;
  readHead(): Promise<Result<TimelineHead, TimelineFailure>>;
}
