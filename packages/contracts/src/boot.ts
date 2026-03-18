export const STARTUP_MODE = Object.freeze({
  NORMAL: "normal",
  DEGRADED: "degraded",
  RECOVERY: "recovery",
} as const);

export type StartupMode = (typeof STARTUP_MODE)[keyof typeof STARTUP_MODE];

export const LIFECYCLE_STATE = Object.freeze({
  BOOTING: "booting",
  ACTIVE: "active",
  DEGRADED: "degraded",
  INACTIVE: "inactive",
} as const);

export type LifecycleState = (typeof LIFECYCLE_STATE)[keyof typeof LIFECYCLE_STATE];

export const SYSTEM_EVENT = Object.freeze({
  BOOT_COMPLETED: "system.boot.completed",
  RECOVERY_COMPLETED: "system.recovery.completed",
} as const);

export type SystemEventType = (typeof SYSTEM_EVENT)[keyof typeof SYSTEM_EVENT];

export const DEPENDENCY = Object.freeze({
  POSTGRES: "postgres",
  MODEL_FAST: "model-fast",
  MODEL_DEEP: "model-deep",
  MODEL_POOL: "model-pool",
} as const);

export type DependencyId = (typeof DEPENDENCY)[keyof typeof DEPENDENCY];

export const DEFAULT_DEPENDENCY_ORDER = Object.freeze([
  DEPENDENCY.POSTGRES,
  DEPENDENCY.MODEL_FAST,
  DEPENDENCY.MODEL_DEEP,
  DEPENDENCY.MODEL_POOL,
] as const);

export type DependencyCheckResult = {
  dependency: DependencyId;
  ok: boolean;
  requiredForNormal: boolean;
  detail?: string;
};

export type BootPreflightResult = {
  constitutionVersion: string;
  schemaVersion: string;
  requiredVolumesOk: boolean;
  dependencyResults: DependencyCheckResult[];
  selectedMode: StartupMode;
  degradedDependencies: DependencyId[];
  rollbackSnapshotId: string | null;
};

export type RecoveryResult = {
  attempted: boolean;
  snapshotId: string | null;
  outcome: "skipped" | "recovered" | "failed";
  detail?: string;
};

export type SystemEvent<TPayload> = {
  type: SystemEventType;
  payload: TPayload;
  recordedAt: string;
};

export type BootCompletedPayload = {
  mode: StartupMode;
  schemaVersion: string;
  dependencyResults: DependencyCheckResult[];
  degradedDependencies: DependencyId[];
  snapshotId: string | null;
};

export type RecoveryCompletedPayload = RecoveryResult;

export type StableSnapshotRecord = {
  snapshotId: string;
  gitTag: string;
  modelProfileMapJson: Record<string, string>;
  schemaVersion: string;
};

export type DependencyProbeResult = {
  ok: boolean;
  detail?: string;
};
