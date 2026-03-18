export const STARTUP_MODE = Object.freeze({
  NORMAL: "normal",
  DEGRADED: "degraded",
  RECOVERY: "recovery",
});

export const LIFECYCLE_STATE = Object.freeze({
  BOOTING: "booting",
  ACTIVE: "active",
  DEGRADED: "degraded",
  INACTIVE: "inactive",
});

export const SYSTEM_EVENT = Object.freeze({
  BOOT_COMPLETED: "system.boot.completed",
  RECOVERY_COMPLETED: "system.recovery.completed",
});

export const DEPENDENCY = Object.freeze({
  POSTGRES: "postgres",
  MODEL_FAST: "model-fast",
  MODEL_DEEP: "model-deep",
  MODEL_POOL: "model-pool",
});

export const DEFAULT_DEPENDENCY_ORDER = Object.freeze([
  DEPENDENCY.POSTGRES,
  DEPENDENCY.MODEL_FAST,
  DEPENDENCY.MODEL_DEEP,
  DEPENDENCY.MODEL_POOL,
]);
