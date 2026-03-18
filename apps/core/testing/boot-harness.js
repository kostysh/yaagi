import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { ConstitutionalBootService } from "../src/boot/index.js";
import { DEPENDENCY } from "@yaagi/contracts/boot";

const DEFAULT_SCHEMA_VERSION = "2026-03-19";

const DEFAULT_SNAPSHOT = {
  snapshotId: "snapshot-41",
  gitTag: "stable/snapshot-41",
  modelProfileMapJson: {
    reflex: "model-fast@stable",
    deliberation: "model-deep@stable",
    embedding: "model-pool@stable",
  },
  schemaVersion: DEFAULT_SCHEMA_VERSION,
};

const DEFAULT_DEPENDENCY_RESULTS = {
  [DEPENDENCY.POSTGRES]: { ok: true },
  [DEPENDENCY.MODEL_FAST]: { ok: true },
  [DEPENDENCY.MODEL_DEEP]: { ok: true },
  [DEPENDENCY.MODEL_POOL]: { ok: true },
};

const toYamlList = (items) => items.map((item) => `  - ${item}`).join("\n");

export async function createBootHarness(options = {}) {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "yaagi-boot-"));
  const missingVolumes = new Set(options.missingVolumes ?? []);
  const requiredVolumes = [
    "workspace/body",
    "workspace/skills",
    "workspace/constitution",
    "data",
    "models",
  ];

  for (const volume of requiredVolumes) {
    if (missingVolumes.has(volume)) continue;
    await mkdir(path.join(repoRoot, volume), { recursive: true });
  }

  await mkdir(path.join(repoRoot, "workspace/constitution"), { recursive: true });

  const constitutionPath = path.join(repoRoot, "workspace/constitution/constitution.yaml");
  const constitution = {
    version: options.constitutionVersion ?? "1.0.0",
    schemaVersion: options.constitutionSchemaVersion ?? DEFAULT_SCHEMA_VERSION,
    requiredVolumes,
    allowedDegradedDependencies:
      options.allowedDegradedDependencies ?? [
        DEPENDENCY.MODEL_FAST,
        DEPENDENCY.MODEL_DEEP,
        DEPENDENCY.MODEL_POOL,
      ],
  };

  await writeFile(
    constitutionPath,
    [
      `version: "${constitution.version}"`,
      `schemaVersion: "${constitution.schemaVersion}"`,
      "requiredVolumes:",
      toYamlList(constitution.requiredVolumes),
      "allowedDegradedDependencies:",
      toYamlList(constitution.allowedDegradedDependencies),
      "",
    ].join("\n"),
    "utf8",
  );

  const events = [];
  const ledgerEntries = [];
  const restoredTags = [];
  const restoredProfileMaps = [];

  const lifecycle = {
    state: "idle",
    async setState(nextState) {
      this.state = nextState;
    },
  };

  const agentState = {
    mode: null,
    schemaVersion: null,
    degradedDependencies: [],
    dependencyResults: [],
    developmentFreeze: false,
    lastStableSnapshotId: options.lastStableSnapshotId ?? DEFAULT_SNAPSHOT.snapshotId,
    async getLastStableSnapshotId() {
      return this.lastStableSnapshotId;
    },
    async setDevelopmentFreeze(nextValue) {
      this.developmentFreeze = nextValue;
    },
    async setLastStableSnapshotId(nextValue) {
      this.lastStableSnapshotId = nextValue;
    },
    async setSchemaVersion(nextValue) {
      this.schemaVersion = nextValue;
    },
    async setBootState(nextValue) {
      this.mode = nextValue.mode;
      this.schemaVersion = nextValue.schemaVersion;
      this.degradedDependencies = nextValue.degradedDependencies;
      this.dependencyResults = nextValue.dependencyResults;
      this.snapshotId = nextValue.snapshotId;
    },
  };

  const timeline = {
    async publish(event) {
      events.push(event);
    },
  };

  const developmentLedger = {
    async record(entry) {
      ledgerEntries.push(entry);
    },
  };

  const snapshots = new Map(
    (options.snapshots ?? [DEFAULT_SNAPSHOT]).map((snapshot) => [snapshot.snapshotId, snapshot]),
  );

  const snapshotStore = {
    async getLatestValidSnapshotId(preferredSnapshotId) {
      if (preferredSnapshotId && snapshots.has(preferredSnapshotId)) {
        return preferredSnapshotId;
      }

      return snapshots.keys().next().value ?? null;
    },
    async getSnapshotById(snapshotId) {
      return snapshots.get(snapshotId) ?? null;
    },
  };

  const bodyGateway = {
    async restoreGitTag(gitTag) {
      if (options.restoreGitTagError) throw options.restoreGitTagError;
      restoredTags.push(gitTag);
    },
  };

  const modelRegistry = {
    async restoreProfileMap(modelProfileMapJson) {
      if (options.restoreProfileMapError) throw options.restoreProfileMapError;
      restoredProfileMaps.push(modelProfileMapJson);
    },
  };

  const scheduler = {
    startCalls: 0,
    async start() {
      this.startCalls += 1;
    },
  };

  const tickEngine = {
    startCalls: 0,
    async start() {
      this.startCalls += 1;
    },
  };

  const sensorAdapter = {
    startCalls: 0,
    async start() {
      this.startCalls += 1;
    },
  };

  const dependencyResults = {
    ...DEFAULT_DEPENDENCY_RESULTS,
    ...(options.dependencyResults ?? {}),
  };

  const dependencyProbes = Object.fromEntries(
    Object.entries(dependencyResults).map(([dependency, result]) => [
      dependency,
      async () => {
        if (result instanceof Error) throw result;
        if (typeof result === "function") return result();
        return result;
      },
    ]),
  );

  const service = new ConstitutionalBootService({
    repoRoot,
    constitutionPath,
    expectedSchemaVersion: options.expectedSchemaVersion ?? DEFAULT_SCHEMA_VERSION,
    dependencyProbes,
    timeline,
    developmentLedger,
    lifecycleController: lifecycle,
    agentStateStore: agentState,
    snapshotStore,
    bodyGateway,
    modelRegistry,
    scheduler,
    tickEngine,
    sensorAdapters: [sensorAdapter],
  });

  return {
    service,
    events,
    ledgerEntries,
    lifecycle,
    agentState,
    restoredTags,
    restoredProfileMaps,
    scheduler,
    tickEngine,
    sensorAdapter,
    async cleanup() {
      await rm(repoRoot, { recursive: true, force: true });
    },
  };
}
