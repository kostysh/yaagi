import path from "node:path";
import { stat } from "node:fs/promises";
import {
  LIFECYCLE_STATE,
  STARTUP_MODE,
  SYSTEM_EVENT,
} from "@yaagi/contracts/boot";
import { loadConstitution } from "./constitution-loader.js";
import { BootInvariantError } from "./errors.js";
import { runDependencyProbes, selectStartupMode } from "./startup-policy.js";

const noopAsync = async () => {};

const createNoopPort = (methods) =>
  Object.fromEntries(methods.map((method) => [method, noopAsync]));

const DEFAULT_TIMELINE = createNoopPort(["publish"]);
const DEFAULT_LEDGER = createNoopPort(["record"]);
const DEFAULT_LIFECYCLE = createNoopPort(["setState"]);
const DEFAULT_AGENT_STATE = {
  ...createNoopPort([
    "setBootState",
    "setDevelopmentFreeze",
    "setLastStableSnapshotId",
    "setSchemaVersion",
  ]),
  getLastStableSnapshotId: async () => null,
};
const DEFAULT_SNAPSHOT_STORE = {
  getLatestValidSnapshotId: async () => null,
  getSnapshotById: async () => null,
};
const DEFAULT_BODY_GATEWAY = createNoopPort(["restoreGitTag"]);
const DEFAULT_MODEL_REGISTRY = createNoopPort(["restoreProfileMap"]);
const DEFAULT_STARTABLE = createNoopPort(["start"]);

const makeEvent = (type, payload) => ({
  type,
  payload,
  recordedAt: new Date().toISOString(),
});

const summarizeDependencyResults = (dependencyResults) =>
  dependencyResults.map((result) => ({
    dependency: result.dependency,
    ok: result.ok,
    requiredForNormal: result.requiredForNormal,
    detail: result.detail,
  }));

export class ConstitutionalBootService {
  constructor(options) {
    if (!options?.expectedSchemaVersion) {
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

  async boot() {
    await this.lifecycle.setState(LIFECYCLE_STATE.BOOTING);

    try {
      const preflight = await this.preflight();
      const recovery = await this.recover(preflight);
      const activated = await this.activate(preflight, recovery);

      return {
        ok: activated,
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

  async preflight() {
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

  async recover(preflight) {
    if (preflight.selectedMode !== STARTUP_MODE.RECOVERY) {
      return {
        attempted: false,
        snapshotId: null,
        outcome: "skipped",
      };
    }

    await this.agentState.setDevelopmentFreeze(true);

    if (!preflight.rollbackSnapshotId) {
      return this.failRecovery(
        "no valid stable snapshot available for recovery",
        null,
      );
    }

    const snapshot = await this.snapshotStore.getSnapshotById(preflight.rollbackSnapshotId);
    const manifestError = this.validateSnapshotManifest(snapshot);
    if (manifestError) {
      return this.failRecovery(manifestError, preflight.rollbackSnapshotId);
    }

    try {
      await this.bodyGateway.restoreGitTag(snapshot.gitTag);
      await this.modelRegistry.restoreProfileMap(snapshot.modelProfileMapJson);
      await this.agentState.setLastStableSnapshotId(snapshot.snapshotId);
      await this.agentState.setSchemaVersion(snapshot.schemaVersion);

      const recoveryResult = {
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
        evidence_json: recoveryResult,
      });

      return recoveryResult;
    } catch (error) {
      return this.failRecovery(error instanceof Error ? error.message : String(error), snapshot.snapshotId);
    }
  }

  async activate(preflight, recovery) {
    if (
      preflight.selectedMode === STARTUP_MODE.RECOVERY &&
      recovery.outcome !== "recovered"
    ) {
      await this.lifecycle.setState(LIFECYCLE_STATE.INACTIVE);
      return false;
    }

    const bootPayload = {
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

  async checkRequiredVolumes(requiredVolumes) {
    const missingVolumes = [];

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

  validateSnapshotManifest(snapshot) {
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

  async failRecovery(detail, snapshotId) {
    const recoveryResult = {
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
      evidence_json: recoveryResult,
    });

    return recoveryResult;
  }
}
