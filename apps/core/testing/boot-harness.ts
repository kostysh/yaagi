import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { ConstitutionalBootService } from "../src/boot/index.js";
import {
  DEPENDENCY,
  type BootCompletedPayload,
  type DependencyId,
  type DependencyProbeResult,
  type RecoveryCompletedPayload,
  type StableSnapshotRecord,
  type SystemEvent,
} from "@yaagi/contracts/boot";

const DEFAULT_SCHEMA_VERSION = "2026-03-19";

const DEFAULT_SNAPSHOT: StableSnapshotRecord = {
  snapshotId: "snapshot-41",
  gitTag: "stable/snapshot-41",
  modelProfileMapJson: {
    reflex: "model-fast@stable",
    deliberation: "model-deep@stable",
    embedding: "model-pool@stable",
  },
  schemaVersion: DEFAULT_SCHEMA_VERSION,
};

const DEFAULT_DEPENDENCY_RESULTS: Record<DependencyId, DependencyProbeResult> = {
  [DEPENDENCY.POSTGRES]: { ok: true },
  [DEPENDENCY.MODEL_FAST]: { ok: true },
  [DEPENDENCY.MODEL_DEEP]: { ok: true },
  [DEPENDENCY.MODEL_POOL]: { ok: true },
};

type HarnessOptions = {
  missingVolumes?: string[];
  constitutionVersion?: string;
  constitutionSchemaVersion?: string;
  expectedSchemaVersion?: string;
  allowedDegradedDependencies?: string[];
  dependencyResults?: Partial<Record<DependencyId, DependencyProbeResult | Error>>;
  snapshots?: StableSnapshotRecord[];
  lastStableSnapshotId?: string;
  restoreGitTagError?: Error;
  restoreProfileMapError?: Error;
};

type Harness = {
  service: ConstitutionalBootService;
  events: Array<SystemEvent<BootCompletedPayload | RecoveryCompletedPayload>>;
  ledgerEntries: Array<Record<string, unknown>>;
  lifecycle: {
    state: string;
    setState(nextState: string): Promise<void>;
  };
  agentState: {
    mode: string | null;
    schemaVersion: string | null;
    degradedDependencies: DependencyId[];
    dependencyResults: BootCompletedPayload["dependencyResults"];
    developmentFreeze: boolean;
    lastStableSnapshotId: string;
    snapshotId?: string | null;
    getLastStableSnapshotId(): Promise<string | null>;
    setDevelopmentFreeze(nextValue: boolean): Promise<void>;
    setLastStableSnapshotId(nextValue: string): Promise<void>;
    setSchemaVersion(nextValue: string): Promise<void>;
    setBootState(nextValue: BootCompletedPayload): Promise<void>;
  };
  restoredTags: string[];
  restoredProfileMaps: Array<Record<string, string>>;
  scheduler: {
    startCalls: number;
    start(): Promise<void>;
  };
  tickEngine: {
    startCalls: number;
    start(): Promise<void>;
  };
  sensorAdapter: {
    startCalls: number;
    start(): Promise<void>;
  };
  cleanup(): Promise<void>;
};

const toYamlList = (items: string[]): string => items.map((item) => `  - ${item}`).join("\n");

export async function createBootHarness(options: HarnessOptions = {}): Promise<Harness> {
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

  const events: Array<SystemEvent<BootCompletedPayload | RecoveryCompletedPayload>> = [];
  const ledgerEntries: Array<Record<string, unknown>> = [];
  const restoredTags: string[] = [];
  const restoredProfileMaps: Array<Record<string, string>> = [];

  const lifecycle = {
    state: "idle",
    async setState(nextState: string) {
      this.state = nextState;
    },
  };

  const agentState = {
    mode: null as string | null,
    schemaVersion: null as string | null,
    degradedDependencies: [] as DependencyId[],
    dependencyResults: [] as BootCompletedPayload["dependencyResults"],
    developmentFreeze: false,
    lastStableSnapshotId: options.lastStableSnapshotId ?? DEFAULT_SNAPSHOT.snapshotId,
    snapshotId: null as string | null,
    async getLastStableSnapshotId() {
      return this.lastStableSnapshotId;
    },
    async setDevelopmentFreeze(nextValue: boolean) {
      this.developmentFreeze = nextValue;
    },
    async setLastStableSnapshotId(nextValue: string) {
      this.lastStableSnapshotId = nextValue;
    },
    async setSchemaVersion(nextValue: string) {
      this.schemaVersion = nextValue;
    },
    async setBootState(nextValue: BootCompletedPayload) {
      this.mode = nextValue.mode;
      this.schemaVersion = nextValue.schemaVersion;
      this.degradedDependencies = nextValue.degradedDependencies;
      this.dependencyResults = nextValue.dependencyResults;
      this.snapshotId = nextValue.snapshotId;
    },
  };

  const timeline = {
    async publish(event: SystemEvent<BootCompletedPayload | RecoveryCompletedPayload>) {
      events.push(event);
    },
  };

  const developmentLedger = {
    async record(entry: Record<string, unknown>) {
      ledgerEntries.push(entry);
    },
  };

  const snapshots = new Map<string, StableSnapshotRecord>(
    (options.snapshots ?? [DEFAULT_SNAPSHOT]).map((snapshot) => [snapshot.snapshotId, snapshot]),
  );

  const snapshotStore = {
    async getLatestValidSnapshotId(preferredSnapshotId: string | null) {
      if (preferredSnapshotId && snapshots.has(preferredSnapshotId)) {
        return preferredSnapshotId;
      }

      return snapshots.keys().next().value ?? null;
    },
    async getSnapshotById(snapshotId: string) {
      return snapshots.get(snapshotId) ?? null;
    },
  };

  const bodyGateway = {
    async restoreGitTag(gitTag: string) {
      if (options.restoreGitTagError) throw options.restoreGitTagError;
      restoredTags.push(gitTag);
    },
  };

  const modelRegistry = {
    async restoreProfileMap(modelProfileMapJson: Record<string, string>) {
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

  const dependencyResults: Partial<Record<DependencyId, DependencyProbeResult | Error>> = {
    ...DEFAULT_DEPENDENCY_RESULTS,
    ...(options.dependencyResults ?? {}),
  };

  const dependencyProbes = Object.fromEntries(
    Object.entries(dependencyResults).map(([dependency, result]) => [
      dependency,
      async () => {
        if (result instanceof Error) throw result;
        return result ?? { ok: false, detail: "missing dependency result" };
      },
    ]),
  ) as Partial<Record<DependencyId, () => Promise<DependencyProbeResult>>>;

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
