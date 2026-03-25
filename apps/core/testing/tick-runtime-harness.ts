import {
  TICK_EVENT_TYPE,
  TICK_STATUS,
  type TickEventEnvelope,
  type TickRequest,
  type TickStatus,
} from '@yaagi/contracts/runtime';
import {
  createTickRuntime,
  type FinishTickInput,
  type StartedTick,
  type TickExecutionHandler,
  type TickRuntime,
  type TickRuntimeStore,
} from '../src/runtime/index.ts';

type TickRecord = {
  tickId: string;
  requestId: string;
  kind: TickRequest['kind'];
  trigger: TickRequest['trigger'];
  startedAt: string;
  endedAt: string | null;
  status: TickStatus;
  continuityFlags: Record<string, unknown>;
  failureDetail: string | null;
  actionId: string | null;
  selectedCoalitionId: string | null;
};

type EpisodeRecord = {
  episodeId: string;
  tickId: string;
  summary: string;
  result: Record<string, unknown>;
  createdAt: string;
};

type HarnessOptions = {
  executeTick?: TickExecutionHandler;
  now?: () => string;
  createId?: () => string;
  startupWakeRequestId?: string;
  seedStartedTick?: StartedTick;
};

type TickRuntimeHarness = {
  runtime: TickRuntime;
  store: TickRuntimeStore;
  ticks: Map<string, TickRecord>;
  episodes: EpisodeRecord[];
  events: TickEventEnvelope[];
  agentState: {
    currentTick: string | null;
  };
};

const toTickEventType = (
  status: Extract<TickStatus, 'started' | 'completed' | 'failed' | 'cancelled'>,
): TickEventEnvelope['eventType'] => {
  switch (status) {
    case TICK_STATUS.STARTED:
      return TICK_EVENT_TYPE.STARTED;
    case TICK_STATUS.COMPLETED:
      return TICK_EVENT_TYPE.COMPLETED;
    case TICK_STATUS.FAILED:
      return TICK_EVENT_TYPE.FAILED;
    case TICK_STATUS.CANCELLED:
      return TICK_EVENT_TYPE.CANCELLED;
  }
};

export function createTickRuntimeHarness(options: HarnessOptions = {}): TickRuntimeHarness {
  const ticks = new Map<string, TickRecord>();
  const episodes: EpisodeRecord[] = [];
  const events: TickEventEnvelope[] = [];
  const agentState = {
    currentTick: null as string | null,
  };

  if (options.seedStartedTick) {
    ticks.set(options.seedStartedTick.tickId, {
      tickId: options.seedStartedTick.tickId,
      requestId: options.seedStartedTick.requestId,
      kind: options.seedStartedTick.kind,
      trigger: options.seedStartedTick.trigger,
      startedAt: options.seedStartedTick.requestedAt,
      endedAt: null,
      status: TICK_STATUS.STARTED,
      continuityFlags: {},
      failureDetail: null,
      actionId: null,
      selectedCoalitionId: null,
    });
    agentState.currentTick = options.seedStartedTick.tickId;
  }

  let nextNumericId = 1;
  const createId =
    options.createId ??
    (() => {
      const value = `tick-${nextNumericId}`;
      nextNumericId += 1;
      return value;
    });
  const now = options.now ?? (() => new Date().toISOString());

  const store: TickRuntimeStore = {
    initialize: (): Promise<void> => Promise.resolve(),

    startTick: (input: StartedTick) => {
      if (agentState.currentTick) {
        return Promise.resolve({
          accepted: false as const,
          reason: 'lease_busy' as const,
        });
      }

      ticks.set(input.tickId, {
        tickId: input.tickId,
        requestId: input.requestId,
        kind: input.kind,
        trigger: input.trigger,
        startedAt: input.requestedAt,
        endedAt: null,
        status: TICK_STATUS.STARTED,
        continuityFlags: {},
        failureDetail: null,
        actionId: null,
        selectedCoalitionId: null,
      });
      agentState.currentTick = input.tickId;
      events.push({
        eventId: `event-${input.tickId}-started`,
        eventType: TICK_EVENT_TYPE.STARTED,
        occurredAt: input.requestedAt,
        subjectRef: input.tickId,
        payload: {
          kind: input.kind,
          trigger: input.trigger,
        },
      });

      return Promise.resolve({
        accepted: true as const,
        tickId: input.tickId,
        deduplicated: false as const,
      });
    },

    finishTick: (input: FinishTickInput): Promise<void> => {
      const tick = ticks.get(input.tickId);
      if (!tick) {
        throw new Error(`tick ${input.tickId} not found`);
      }

      tick.status = input.terminal.status;
      tick.endedAt = input.finishedAt;
      tick.failureDetail = input.terminal.failureDetail ?? null;
      tick.continuityFlags = input.terminal.continuityFlags ?? {};
      tick.actionId = input.terminal.actionId ?? null;
      tick.selectedCoalitionId = input.terminal.selectedCoalitionId ?? null;
      agentState.currentTick = null;
      events.push({
        eventId: `event-${input.tickId}-${input.terminal.status}`,
        eventType: toTickEventType(input.terminal.status),
        occurredAt: input.finishedAt,
        subjectRef: input.tickId,
        payload: {
          ...(input.terminal.summary ? { summary: input.terminal.summary } : {}),
          ...(input.terminal.result ? { result: input.terminal.result } : {}),
          ...(input.terminal.failureDetail ? { failureDetail: input.terminal.failureDetail } : {}),
        },
      });

      if (input.terminal.status === TICK_STATUS.COMPLETED) {
        episodes.push({
          episodeId: `episode-${input.tickId}`,
          tickId: input.tickId,
          summary: input.terminal.summary ?? 'tick completed',
          result: input.terminal.result ?? {},
          createdAt: input.finishedAt,
        });
      }
      return Promise.resolve();
    },

    reclaimStaleTicks: (reclaimedAt: string): Promise<number> => {
      let reclaimed = 0;
      for (const tick of ticks.values()) {
        if (tick.status !== TICK_STATUS.STARTED) continue;

        tick.status = TICK_STATUS.FAILED;
        tick.endedAt = reclaimedAt;
        tick.failureDetail = 'stale_tick_reclaimed';
        tick.continuityFlags = { staleTickReclaimed: true };
        events.push({
          eventId: `event-${tick.tickId}-failed`,
          eventType: TICK_EVENT_TYPE.FAILED,
          occurredAt: reclaimedAt,
          subjectRef: tick.tickId,
          payload: {
            failureDetail: 'stale_tick_reclaimed',
          },
        });
        reclaimed += 1;
      }

      if (reclaimed > 0) {
        agentState.currentTick = null;
      }

      return Promise.resolve(reclaimed);
    },
  };

  return {
    runtime: createTickRuntime({
      store,
      now,
      createId,
      ...(options.executeTick ? { executeTick: options.executeTick } : {}),
      ...(options.startupWakeRequestId
        ? { startupWakeRequestId: options.startupWakeRequestId }
        : {}),
    }),
    store,
    ticks,
    episodes,
    events,
    agentState,
  };
}
