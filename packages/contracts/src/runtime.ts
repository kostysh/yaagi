export const TICK_KIND = Object.freeze({
  REACTIVE: 'reactive',
  DELIBERATIVE: 'deliberative',
  CONTEMPLATIVE: 'contemplative',
  CONSOLIDATION: 'consolidation',
  DEVELOPMENTAL: 'developmental',
  WAKE: 'wake',
} as const);

export type TickKind = (typeof TICK_KIND)[keyof typeof TICK_KIND];

export const TICK_TRIGGER = Object.freeze({
  BOOT: 'boot',
  SCHEDULER: 'scheduler',
  SYSTEM: 'system',
} as const);

export type TickTrigger = (typeof TICK_TRIGGER)[keyof typeof TICK_TRIGGER];

export const TICK_STATUS = Object.freeze({
  STARTED: 'started',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const);

export type TickStatus = (typeof TICK_STATUS)[keyof typeof TICK_STATUS];

export const TICK_EVENT_TYPE = Object.freeze({
  STARTED: 'tick.started',
  COMPLETED: 'tick.completed',
  FAILED: 'tick.failed',
  CANCELLED: 'tick.cancelled',
} as const);

export type TickEventType = (typeof TICK_EVENT_TYPE)[keyof typeof TICK_EVENT_TYPE];

export type TickRequest = {
  requestId: string;
  kind: TickKind;
  trigger: TickTrigger;
  requestedAt: string;
  payload: Record<string, unknown>;
};

export type TickRequestRejectionReason = 'boot_inactive' | 'lease_busy' | 'unsupported_tick_kind';

export type TickRequestResult =
  | { accepted: true; tickId: string }
  | {
      accepted: false;
      reason: TickRequestRejectionReason;
    };

export type TickEventEnvelope<TPayload = Record<string, unknown>> = {
  eventId: string;
  eventType: TickEventType;
  occurredAt: string;
  subjectRef: string;
  payload: TPayload;
};

export type TickTerminalResult = {
  status: Extract<TickStatus, 'completed' | 'failed' | 'cancelled'>;
  summary?: string;
  result?: Record<string, unknown>;
  failureDetail?: string;
  continuityFlags?: Record<string, unknown>;
};
