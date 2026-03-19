import path from "node:path";
import { stat } from "node:fs/promises";
import {
  LIFECYCLE_STATE,
  STARTUP_MODE,
  SYSTEM_EVENT,
  type BootCompletedPayload,
  type BootPreflightResult,
  type DependencyCheckResult,
  type LifecycleState,
  type RecoveryCompletedPayload,
  type RecoveryResult,
  type StableSnapshotRecord,
  type SystemEvent,
} from "@yaagi/contracts/boot";
import { loadConstitution } from "./constitution-loader.ts";
import { BootInvariantError } from "./errors.ts";
import {
  runDependencyProbes,
  selectStartupMode,
  type DependencyProbeMap,
} from "./startup-policy.ts";

type AsyncVoid = () => Promise<void>;
type Startable = {
  start(): Promise<void>;
};
type FileSystemPort = {
  stat(targetPath: string): Promise<unknown>;
};
type TimelinePort = {
  publish(event: SystemEvent<BootCompletedPayload | RecoveryCompletedPayload>): Promise<void>;
};
type DevelopmentLedgerPort = {
  record(entry: {
    entry_kind: string;
    subject_ref: string;
    summary: string;
    evidence_json: Record<string, unknown>;
  }): Promise<void>;
};
type LifecycleController = {
  setState(nextState: LifecycleState): Promise<void>;
};
type AgentStateStore = {
  getLastStableSnapshotId(): Promise<string | null>;
  setBootState(nextValue: BootCompletedPayload): Promise<void>;
  setDevelopmentFreeze(nextValue: boolean): Promise<void>;
  setLastStableSnapshotId(nextValue: string): Promise<void>;
  setSchemaVersion(nextValue: string): Promise<void>;
};
type SnapshotStore = {
  getLatestValidSnapshotId(preferredSnapshotId: string | null): Promise<string | null>;
  getSnapshotById(snapshotId: string): Promise<StableSnapshotRecord | null>;
};
type BodyGateway = {
  restoreGitTag(gitTag: string): Promise<void>;
};
type ModelRegistry = {
  restoreProfileMap(modelProfileMapJson: Record<string, string>): Promise<void>;
};

export type BootOptions = {
  expectedSchemaVersion: string;
  repoRoot?: string;
  constitutionPath?: string;
  fileSystem?: FileSystemPort;
  dependencyProbes?: DependencyProbeMap;
  timeline?: TimelinePort;
  developmentLedger?: DevelopmentLedgerPort;
  lifecycleController?: LifecycleController;
  agentStateStore?: AgentStateStore;
  snapshotStore?: SnapshotStore;
  bodyGateway?: BodyGateway;
  modelRegistry?: ModelRegistry;
  scheduler?: Startable;
  tickEngine?: Startable;
  sensorAdapters?: Startable[];
};

type BootSuccess = {
  ok: true;
  preflight: BootPreflightResult;
  recovery: RecoveryResult;
};

type BootFailure = {
  ok: false;
  error: unknown;
};

type VolumeCheckResult = {
  ok: boolean;
  missingVolumes: string[];
};

const noopAsync: AsyncVoid = async () => {};

const createNoopPort = <TMethod extends string>(
  methods: readonly TMethod[],
): Record<TMethod, AsyncVoid> =>
  Object.fromEntries(methods.map((method) => [method, noopAsync])) as Record<
    TMethod,
    AsyncVoid
  >;

const DEFAULT_TIMELINE: TimelinePort = createNoopPort(["publish"]) as unknown as TimelinePort;
const DEFAULT_LEDGER: DevelopmentLedgerPort = createNoopPort(["record"]) as unknown as DevelopmentLedgerPort;
const DEFAULT_LIFECYCLE: LifecycleController = createNoopPort(["setState"]) as unknown as LifecycleController;
const DEFAULT_AGENT_STATE: AgentStateStore = {
  ...(createNoopPort([
    "setBootState",
    "setDevelopmentFreeze",
    "setLastStableSnapshotId",
    "setSchemaVersion",
  ]) as unknown as Omit<
    AgentStateStore,
    "getLastStableSnapshotId"
  >),
  getLastStableSnapshotId: async () => null,
};
const DEFAULT_SNAPSHOT_STORE: SnapshotStore = {
  getLatestValidSnapshotId: async () => null,
  getSnapshotById: async () => null,
};
const DEFAULT_BODY_GATEWAY: BodyGateway = createNoopPort([
  "restoreGitTag",
]) as unknown as BodyGateway;
const DEFAULT_MODEL_REGISTRY: ModelRegistry = createNoopPort([
  "restoreProfileMap",
]) as unknown as ModelRegistry;
const DEFAULT_STARTABLE: Startable = createNoopPort(["start"]) as unknown as Startable;

const makeEvent = <TPayload>(
  type: SystemEvent<TPayload>["type"],
  payload: TPayload,
): SystemEvent<TPayload> => ({
  type,
  payload,
  recordedAt: new Date().toISOString(),
});

const summarizeDependencyResults = (
  dependencyResults: DependencyCheckResult[],
): DependencyCheckResult[] =>
  dependencyResults.map((result) => ({
    dependency: result.dependency,
    ok: result.ok,
    requiredForNormal: result.requiredForNormal,
    ...(result.detail ? { detail: result.detail } : {}),
  }));

export class ConstitutionalBootService {
  readonly expectedSchemaVersion: string;
  readonly repoRoot: string;
  readonly constitutionPath: string;
  readonly fileSystem: FileSystemPort;
  readonly dependencyProbes: DependencyProbeMap;
  readonly timeline: TimelinePort;
  readonly developmentLedger: DevelopmentLedgerPort;
  readonly lifecycle: LifecycleController;
  readonly agentState: AgentStateStore;
  readonly snapshotStore: SnapshotStore;
  readonly bodyGateway: BodyGateway;
  readonly modelRegistry: ModelRegistry;
  readonly scheduler: Startable;
  readonly tickEngine: Startable;
  readonly sensorAdapters: Startable[];

  constructor(options: BootOptions) {
    if (!options.expectedSchemaVersion) {
      throw new Error("expectedSchemaVersion is required");
    }

    this.expectedSchemaVersion = options.expectedSchemaVersion;
    this.repoRoot = options.repoRoot ?? process.cwd();
    this.constitutionPath =
      options.constitutionPath ??
      path.join(this.repoRoot, "workspace/constitution/constitution.yaml");
    this.fileSystem = options.fileSystem ?? { stat };
    this.dependencyProbes = options.dependencyProbes ?? {};
    this.timeline = options.timeline ?? DEFAULT_TIMELINE;
    this.developmentLedger = options.developmentLedger ?? DEFAULT_LEDGER;
    this.lifecycle = options.lifecycleController ?? DEFAULT_LIFECYCLE;
    this.agentState = options.agentStateStore ?? DEFAULT_AGENT_STATE;
    this.snapshotStore = options.snapshotStore ?? DEFAULT_SNAPSHOT_STORE;
    this.bodyGateway = options.bodyGateway ?? DEFAULT_BODY_GATEWAY;
    this.modelRegistry = options.modelRegistry ?? DEFAULT_MODEL_REGISTRY;
    this.scheduler = options.scheduler ?? DEFAULT_STARTABLE;
    this.tickEngine = options.tickEngine ?? DEFAULT_STARTABLE;
    this.sensorAdapters = options.sensorAdapters ?? [];
  }

  async boot(): Promise<BootSuccess | BootFailure> {
    await this.lifecycle.setState(LIFECYCLE_STATE.BOOTING);

    try {
      const preflight = await this.preflight();
      const recovery = await this.recover(preflight);
      const activated = await this.activate(preflight, recovery);

      if (!activated) {
        return {
          ok: false,
          error: new Error("runtime activation was blocked"),
        };
      }

      return {
        ok: true,
        preflight,
        recovery,
      };
    } catch (error) {
      await this.lifecycle.setState(LIFECYCLE_STATE.INACTIVE);
      return {
        ok: false,
        error,
      };
    }
  }

  async preflight(): Promise<BootPreflightResult> {
    const constitution = await loadConstitution(this.constitutionPath);

    if (constitution.schemaVersion !== this.expectedSchemaVersion) {
      throw new BootInvariantError(
        "SCHEMA_VERSION_MISMATCH",
        `schema version ${constitution.schemaVersion} does not match expected ${this.expectedSchemaVersion}`,
        {
          expectedSchemaVersion: this.expectedSchemaVersion,
          actualSchemaVersion: constitution.schemaVersion,
        },
      );
    }

    const volumeCheck = await this.checkRequiredVolumes(constitution.requiredVolumes);
    if (!volumeCheck.ok) {
      throw new BootInvariantError(
        "REQUIRED_VOLUME_MISSING",
        "required volumes are missing or inaccessible",
        { missingVolumes: volumeCheck.missingVolumes },
      );
    }

    const dependencyResults = await runDependencyProbes({
      dependencyProbes: this.dependencyProbes,
      dependencyOrder: constitution.requiredDependencies,
    });
    const { selectedMode, degradedDependencies } = selectStartupMode({
      dependencyResults,
      allowedDegradedDependencies: constitution.allowedDegradedDependencies,
    });

    const preferredSnapshotId = await this.agentState.getLastStableSnapshotId();
    const rollbackSnapshotId =
      selectedMode === STARTUP_MODE.RECOVERY
        ? await this.snapshotStore.getLatestValidSnapshotId(preferredSnapshotId)
        : null;

    return {
      constitutionVersion: constitution.version,
      schemaVersion: constitution.schemaVersion,
      requiredVolumesOk: true,
      dependencyResults,
      selectedMode,
      degradedDependencies,
      rollbackSnapshotId,
    };
  }

  async recover(preflight: BootPreflightResult): Promise<RecoveryResult> {
    if (preflight.selectedMode !== STARTUP_MODE.RECOVERY) {
      return {
        attempted: false,
        snapshotId: null,
        outcome: "skipped",
      };
    }

    await this.agentState.setDevelopmentFreeze(true);

    if (!preflight.rollbackSnapshotId) {
      return this.failRecovery("no valid stable snapshot available for recovery", null);
    }

    const snapshot = await this.snapshotStore.getSnapshotById(preflight.rollbackSnapshotId);
    const manifestError = this.validateSnapshotManifest(snapshot);
    if (!snapshot || manifestError) {
      return this.failRecovery(
        manifestError ?? "stable snapshot was not found",
        preflight.rollbackSnapshotId,
      );
    }

    try {
      await this.bodyGateway.restoreGitTag(snapshot.gitTag);
      await this.modelRegistry.restoreProfileMap(snapshot.modelProfileMapJson);
      await this.agentState.setLastStableSnapshotId(snapshot.snapshotId);
      await this.agentState.setSchemaVersion(snapshot.schemaVersion);

      const recoveryResult: RecoveryResult = {
        attempted: true,
        snapshotId: snapshot.snapshotId,
        outcome: "recovered",
        detail: "rollback to stable snapshot completed",
      };

      await this.timeline.publish(
        makeEvent(SYSTEM_EVENT.RECOVERY_COMPLETED, recoveryResult),
      );
      await this.developmentLedger.record({
        entry_kind: "code_rollback",
        subject_ref: snapshot.snapshotId,
        summary: `Recovered boot from stable snapshot ${snapshot.snapshotId}`,
        evidence_json: recoveryResult as unknown as Record<string, unknown>,
      });

      return recoveryResult;
    } catch (error) {
      return this.failRecovery(
        error instanceof Error ? error.message : String(error),
        snapshot.snapshotId,
      );
    }
  }

  async activate(
    preflight: BootPreflightResult,
    recovery: RecoveryResult,
  ): Promise<boolean> {
    if (
      preflight.selectedMode === STARTUP_MODE.RECOVERY &&
      recovery.outcome !== "recovered"
    ) {
      await this.lifecycle.setState(LIFECYCLE_STATE.INACTIVE);
      return false;
    }

    const bootPayload: BootCompletedPayload = {
      mode: preflight.selectedMode,
      schemaVersion: preflight.schemaVersion,
      dependencyResults: summarizeDependencyResults(preflight.dependencyResults),
      degradedDependencies: preflight.degradedDependencies,
      snapshotId:
        recovery.outcome === "recovered" ? recovery.snapshotId : preflight.rollbackSnapshotId,
    };

    await this.timeline.publish(makeEvent(SYSTEM_EVENT.BOOT_COMPLETED, bootPayload));
    await this.agentState.setBootState(bootPayload);

    await this.lifecycle.setState(
      preflight.selectedMode === STARTUP_MODE.DEGRADED
        ? LIFECYCLE_STATE.DEGRADED
        : LIFECYCLE_STATE.ACTIVE,
    );

    for (const adapter of this.sensorAdapters) {
      await adapter.start();
    }

    await this.scheduler.start();
    await this.tickEngine.start();

    return true;
  }

  async checkRequiredVolumes(requiredVolumes: string[]): Promise<VolumeCheckResult> {
    const missingVolumes: string[] = [];

    for (const requiredVolume of requiredVolumes) {
      const absolutePath = path.isAbsolute(requiredVolume)
        ? requiredVolume
        : path.join(this.repoRoot, requiredVolume);
      try {
        await this.fileSystem.stat(absolutePath);
      } catch {
        missingVolumes.push(requiredVolume);
      }
    }

    return {
      ok: missingVolumes.length === 0,
      missingVolumes,
    };
  }

  validateSnapshotManifest(snapshot: StableSnapshotRecord | null): string | null {
    if (!snapshot) return "stable snapshot was not found";
    if (!snapshot.gitTag) return "stable snapshot is missing gitTag";
    if (!snapshot.modelProfileMapJson) {
      return "stable snapshot is missing modelProfileMapJson";
    }
    if (snapshot.schemaVersion !== this.expectedSchemaVersion) {
      return `stable snapshot schema version ${snapshot.schemaVersion} does not match expected ${this.expectedSchemaVersion}`;
    }

    return null;
  }

  async failRecovery(detail: string, snapshotId: string | null): Promise<RecoveryResult> {
    const recoveryResult: RecoveryResult = {
      attempted: true,
      snapshotId,
      outcome: "failed",
      detail,
    };

    await this.timeline.publish(
      makeEvent(SYSTEM_EVENT.RECOVERY_COMPLETED, recoveryResult),
    );
    await this.developmentLedger.record({
      entry_kind: "code_rollback",
      subject_ref: snapshotId ?? "missing-snapshot",
      summary: "Recovery failed during boot",
      evidence_json: recoveryResult as unknown as Record<string, unknown>,
    });

    return recoveryResult;
  }
}
