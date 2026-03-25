import { randomUUID } from 'node:crypto';
import {
  TICK_KIND,
  TICK_STATUS,
  type TickKind,
  type TickRequest,
  type TickRequestResult,
  type TickStatus,
  type TickTerminalResult,
} from '@yaagi/contracts/runtime';

export type StartedTick = {
  tickId: string;
  kind: TickKind;
  trigger: TickRequest['trigger'];
  requestId: string;
  requestedAt: string;
  payload: Record<string, unknown>;
};

export type StartTickResult =
  | { accepted: true; tickId: string; deduplicated?: boolean }
  | { accepted: false; reason: Extract<TickRequestResult, { accepted: false }>['reason'] };

export type FinishTickInput = {
  tickId: string;
  finishedAt: string;
  terminal: TickTerminalResult;
};

export type TickRuntimeStore = {
  initialize(): Promise<void>;
  startTick(input: StartedTick): Promise<StartTickResult>;
  finishTick(input: FinishTickInput): Promise<void>;
  reclaimStaleTicks(now: string): Promise<number>;
};

export type TickExecutionContext = StartedTick;

export type TickExecutionHandler = (
  context: TickExecutionContext,
) => Promise<TickTerminalResult> | TickTerminalResult;

export type TickRuntimeOptions = {
  store: TickRuntimeStore;
  executeTick?: TickExecutionHandler;
  now?: () => string;
  createId?: () => string;
  supportedKinds?: readonly TickKind[];
  startupWakeRequestId?: string;
};

export type TickRuntime = {
  start(): Promise<void>;
  stop(): Promise<void>;
  requestTick(input: TickRequest): Promise<TickRequestResult>;
  reclaimStaleTicks(): Promise<number>;
};

const DEFAULT_SUPPORTED_KINDS: readonly TickKind[] = [TICK_KIND.WAKE, TICK_KIND.REACTIVE];

const isTerminalStatus = (
  value: TickTerminalResult['status'],
): value is Extract<TickStatus, 'completed' | 'failed' | 'cancelled'> =>
  value === TICK_STATUS.COMPLETED ||
  value === TICK_STATUS.FAILED ||
  value === TICK_STATUS.CANCELLED;

const defaultExecuteTick: TickExecutionHandler = (context) => ({
  status: TICK_STATUS.COMPLETED,
  summary:
    context.kind === TICK_KIND.WAKE
      ? 'Phase-0 wake tick completed'
      : 'Phase-0 reactive tick completed',
  result: {
    kind: context.kind,
    trigger: context.trigger,
  },
});

const toTerminalResult = (error: unknown): TickTerminalResult => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    isTerminalStatus(error.status as TickTerminalResult['status'])
  ) {
    const candidate = error as TickTerminalResult;
    return {
      status: candidate.status,
      ...(candidate.summary ? { summary: candidate.summary } : {}),
      ...(candidate.result ? { result: candidate.result } : {}),
      ...(candidate.failureDetail ? { failureDetail: candidate.failureDetail } : {}),
      ...(candidate.continuityFlags ? { continuityFlags: candidate.continuityFlags } : {}),
      ...(candidate.actionId ? { actionId: candidate.actionId } : {}),
      ...(Object.hasOwn(candidate, 'selectedCoalitionId')
        ? { selectedCoalitionId: candidate.selectedCoalitionId ?? null }
        : {}),
      ...(candidate.narrativeMemeticDelta
        ? { narrativeMemeticDelta: candidate.narrativeMemeticDelta }
        : {}),
    };
  }

  return {
    status: TICK_STATUS.FAILED,
    failureDetail: error instanceof Error ? error.message : String(error),
  };
};

export function createTickRuntime(options: TickRuntimeOptions): TickRuntime {
  const supportedKinds = new Set(options.supportedKinds ?? DEFAULT_SUPPORTED_KINDS);
  const executeTick = options.executeTick ?? defaultExecuteTick;
  const now = options.now ?? (() => new Date().toISOString());
  const createId = options.createId ?? randomUUID;

  let started = false;
  const inFlight = new Set<Promise<unknown>>();

  const runTick = async (
    input: TickRequest,
  ): Promise<{
    admission: TickRequestResult;
    terminal?: TickTerminalResult;
  }> => {
    if (!started) {
      return {
        admission: {
          accepted: false,
          reason: 'boot_inactive',
        },
      };
    }

    if (!supportedKinds.has(input.kind)) {
      return {
        admission: {
          accepted: false,
          reason: 'unsupported_tick_kind',
        },
      };
    }

    const requestedTickId = createId();
    const startedTick: StartedTick = {
      tickId: requestedTickId,
      kind: input.kind,
      trigger: input.trigger,
      requestId: input.requestId,
      requestedAt: input.requestedAt,
      payload: input.payload,
    };

    const admission = await options.store.startTick(startedTick);
    if (!admission.accepted) {
      return {
        admission: {
          accepted: false,
          reason: admission.reason,
        },
      };
    }

    if (admission.deduplicated) {
      return {
        admission: {
          accepted: true,
          tickId: admission.tickId,
        },
      };
    }

    const activeTick: StartedTick = {
      ...startedTick,
      tickId: admission.tickId,
    };

    let terminal: TickTerminalResult;
    try {
      terminal = await executeTick(activeTick);
    } catch (error) {
      terminal = toTerminalResult(error);
    }

    await options.store.finishTick({
      tickId: activeTick.tickId,
      finishedAt: now(),
      terminal,
    });

    return {
      admission: {
        accepted: true,
        tickId: activeTick.tickId,
      },
      terminal,
    };
  };

  const track = <T>(promise: Promise<T>): Promise<T> => {
    inFlight.add(promise);
    void promise.finally(() => {
      inFlight.delete(promise);
    });
    return promise;
  };

  return {
    async start(): Promise<void> {
      if (started) return;

      await options.store.initialize();
      started = true;

      try {
        await options.store.reclaimStaleTicks(now());

        const startupWakeRequestId = options.startupWakeRequestId ?? `startup-wake:${createId()}`;
        const startupResult = await track(
          runTick({
            requestId: startupWakeRequestId,
            kind: TICK_KIND.WAKE,
            trigger: 'boot',
            requestedAt: now(),
            payload: {
              source: 'core-runtime.start',
            },
          }),
        );

        if (!startupResult.admission.accepted) {
          throw new Error(`failed to start mandatory wake tick: ${startupResult.admission.reason}`);
        }

        if (!startupResult.terminal || startupResult.terminal.status !== TICK_STATUS.COMPLETED) {
          throw new Error('mandatory wake tick did not complete successfully');
        }
      } catch (error) {
        started = false;
        throw error;
      }
    },

    async stop(): Promise<void> {
      started = false;
      await Promise.allSettled(inFlight);
    },

    async requestTick(input: TickRequest): Promise<TickRequestResult> {
      const result = await track(runTick(input));
      return result.admission;
    },

    reclaimStaleTicks(): Promise<number> {
      return options.store.reclaimStaleTicks(now());
    },
  };
}
