import type { NarrativeMemeticTickDelta } from './cognition.ts';

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

export type TickRequestRejectionReason =
  | 'boot_inactive'
  | 'lease_busy'
  | 'unsupported_tick_kind'
  | 'shutdown_admission_closed';

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

export const HOMEOSTAT_CADENCE_KIND = Object.freeze({
  TICK_COMPLETE: 'tick_complete',
  PERIODIC: 'periodic',
} as const);

export type HomeostatCadenceKind =
  (typeof HOMEOSTAT_CADENCE_KIND)[keyof typeof HOMEOSTAT_CADENCE_KIND];

export const HOMEOSTAT_SIGNAL_STATUS = Object.freeze({
  EVALUATED: 'evaluated',
  DEGRADED: 'degraded',
  NOT_EVALUABLE: 'not_evaluable',
} as const);

export type HomeostatSignalStatus =
  (typeof HOMEOSTAT_SIGNAL_STATUS)[keyof typeof HOMEOSTAT_SIGNAL_STATUS];

export const HOMEOSTAT_ALERT_SEVERITY = Object.freeze({
  NONE: 'none',
  WARNING: 'warning',
  CRITICAL: 'critical',
} as const);

export type HomeostatAlertSeverity =
  (typeof HOMEOSTAT_ALERT_SEVERITY)[keyof typeof HOMEOSTAT_ALERT_SEVERITY];

export const HOMEOSTAT_SIGNAL_FAMILY = Object.freeze({
  AFFECT_VOLATILITY: 'affect_volatility',
  GOAL_CHURN: 'goal_churn',
  COALITION_DOMINANCE: 'coalition_dominance',
  NARRATIVE_REWRITE_RATE: 'narrative_rewrite_rate',
  DEVELOPMENT_PROPOSAL_RATE: 'development_proposal_rate',
  RESOURCE_PRESSURE: 'resource_pressure',
  ORGAN_ERROR_RATE: 'organ_error_rate',
  ROLLBACK_FREQUENCY: 'rollback_frequency',
} as const);

export type HomeostatSignalFamily =
  (typeof HOMEOSTAT_SIGNAL_FAMILY)[keyof typeof HOMEOSTAT_SIGNAL_FAMILY];

export const HOMEOSTAT_REQUESTED_ACTION_KIND = Object.freeze({
  LIMIT_AFFECT_PATCH: 'limit_affect_patch',
  REFLECTIVE_COUNTERWEIGHT: 'reflective_counterweight',
  RESTRICT_GOAL_PROMOTIONS: 'restrict_goal_promotions',
  ANTI_MONOCULTURE_RECALL: 'anti_monoculture_recall',
  FORCE_ALTERNATIVE_SEARCH: 'force_alternative_search',
  FREEZE_NARRATIVE_EDITS: 'freeze_narrative_edits',
  FREEZE_DEVELOPMENT_PROPOSALS: 'freeze_development_proposals',
  LOWER_TICK_AMBITION: 'lower_tick_ambition',
  ROUTER_QUARANTINE_ESCALATION: 'router_quarantine_escalation',
  HUMAN_REVIEW: 'human_review',
} as const);

export type HomeostatRequestedActionKind =
  (typeof HOMEOSTAT_REQUESTED_ACTION_KIND)[keyof typeof HOMEOSTAT_REQUESTED_ACTION_KIND];

export const HOMEOSTAT_REACTION_QUEUE = 'homeostat.reaction-request';
export const HOMEOSTAT_PERIODIC_QUEUE = 'homeostat.periodic-evaluation';
export const HOMEOSTAT_PERIODIC_SCHEDULE_KEY = 'default';
export const HOMEOSTAT_PERIODIC_CRON = '*/5 * * * * *';

export type HomeostatSignalScore = {
  signalFamily: HomeostatSignalFamily;
  status: HomeostatSignalStatus;
  metricValue: number | null;
  warningThreshold: number;
  criticalThreshold: number;
  severity: HomeostatAlertSeverity;
  evidenceRefs: string[];
};

export type HomeostatAlert = {
  signalFamily: HomeostatSignalFamily;
  status: HomeostatSignalStatus;
  severity: Exclude<HomeostatAlertSeverity, 'none'>;
  metricValue: number | null;
  warningThreshold: number;
  criticalThreshold: number;
  evidenceRefs: string[];
  requestedActionKinds: HomeostatRequestedActionKind[];
  idempotencyKeys: string[];
};

export type HomeostatSnapshot = {
  snapshotId: string;
  cadenceKind: HomeostatCadenceKind;
  tickId: string | null;
  overallStability: number;
  signalScores: HomeostatSignalScore[];
  alerts: HomeostatAlert[];
  reactionRequestRefs: string[];
  developmentFreeze: boolean;
  createdAt: string;
};

export type HomeostatReactionRequest = {
  reactionRequestId: string;
  snapshotId: string;
  signalFamily: HomeostatSignalFamily;
  severity: Extract<HomeostatAlertSeverity, 'warning' | 'critical'>;
  requestedActionKind: HomeostatRequestedActionKind;
  evidenceRefs: string[];
  idempotencyKey: string;
  expiresAt: string;
  createdAt: string;
};

export type TickTerminalResult = {
  status: Extract<TickStatus, 'completed' | 'failed' | 'cancelled'>;
  summary?: string;
  result?: Record<string, unknown>;
  failureDetail?: string;
  continuityFlags?: Record<string, unknown>;
  actionId?: string;
  selectedCoalitionId?: string | null;
  narrativeMemeticDelta?: NarrativeMemeticTickDelta;
};
