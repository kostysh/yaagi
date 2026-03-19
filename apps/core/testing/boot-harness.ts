import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { ConstitutionalBootService } from '../src/boot/index.ts';
import {
  DEPENDENCY,
  type BootCompletedPayload,
  type DependencyId,
  type DependencyProbeResult,
  type RecoveryCompletedPayload,
  type StableSnapshotRecord,
  type SystemEvent,
} from '@yaagi/contracts/boot';

const DEFAULT_SCHEMA_VERSION = '2026-03-19';

const DEFAULT_SNAPSHOT: StableSnapshotRecord = {
  snapshotId: 'snapshot-41',
  gitTag: 'stable/snapshot-41',
  modelProfileMapJson: {
    reflex: 'model-fast@stable',
    deliberation: 'model-deep@stable',
    embedding: 'model-pool@stable',
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
  requiredDependencies?: DependencyId[];
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
    dependencyResults: BootCompletedPayload['dependencyResults'];
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

const toYamlList = (items: string[]): string => items.map((item) => `  - ${item}`).join('\n');
const resolved = <T>(value: T): Promise<T> => Promise.resolve(value);
const resolvedVoid = (): Promise<void> => Promise.resolve();

export async function createBootHarness(options: HarnessOptions = {}): Promise<Harness> {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'yaagi-boot-'));
  const missingVolumes = new Set(options.missingVolumes ?? []);
  const requiredVolumes = [
    'workspace/body',
    'workspace/skills',
    'workspace/constitution',
    'data',
    'models',
  ];

  for (const volume of requiredVolumes) {
    if (missingVolumes.has(volume)) continue;
    await mkdir(path.join(repoRoot, volume), { recursive: true });
  }

  await mkdir(path.join(repoRoot, 'workspace/constitution'), {
    recursive: true,
  });

  const constitutionPath = path.join(repoRoot, 'workspace/constitution/constitution.yaml');
  const constitution = {
    version: options.constitutionVersion ?? '1.0.0',
    schemaVersion: options.constitutionSchemaVersion ?? DEFAULT_SCHEMA_VERSION,
    requiredVolumes,
    requiredDependencies: options.requiredDependencies ?? [
      DEPENDENCY.POSTGRES,
      DEPENDENCY.MODEL_FAST,
      DEPENDENCY.MODEL_DEEP,
      DEPENDENCY.MODEL_POOL,
    ],
    allowedDegradedDependencies: options.allowedDegradedDependencies ?? [
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
      'requiredVolumes:',
      toYamlList(constitution.requiredVolumes),
      'requiredDependencies:',
      toYamlList(constitution.requiredDependencies),
      'allowedDegradedDependencies:',
      toYamlList(constitution.allowedDegradedDependencies),
      '',
    ].join('\n'),
    'utf8',
  );

  const events: Array<SystemEvent<BootCompletedPayload | RecoveryCompletedPayload>> = [];
  const ledgerEntries: Array<Record<string, unknown>> = [];
  const restoredTags: string[] = [];
  const restoredProfileMaps: Array<Record<string, string>> = [];

  const lifecycle = {
    state: 'idle',
    setState(nextState: string) {
      this.state = nextState;
      return resolvedVoid();
    },
  };

  const agentState = {
    mode: null as string | null,
    schemaVersion: null as string | null,
    degradedDependencies: [] as DependencyId[],
    dependencyResults: [] as BootCompletedPayload['dependencyResults'],
    developmentFreeze: false,
    lastStableSnapshotId: options.lastStableSnapshotId ?? DEFAULT_SNAPSHOT.snapshotId,
    snapshotId: null as string | null,
    getLastStableSnapshotId() {
      return resolved(this.lastStableSnapshotId);
    },
    setDevelopmentFreeze(nextValue: boolean) {
      this.developmentFreeze = nextValue;
      return resolvedVoid();
    },
    setLastStableSnapshotId(nextValue: string) {
      this.lastStableSnapshotId = nextValue;
      return resolvedVoid();
    },
    setSchemaVersion(nextValue: string) {
      this.schemaVersion = nextValue;
      return resolvedVoid();
    },
    setBootState(nextValue: BootCompletedPayload) {
      this.mode = nextValue.mode;
      this.schemaVersion = nextValue.schemaVersion;
      this.degradedDependencies = nextValue.degradedDependencies;
      this.dependencyResults = nextValue.dependencyResults;
      this.snapshotId = nextValue.snapshotId;
      return resolvedVoid();
    },
  };

  const timeline = {
    publish(event: SystemEvent<BootCompletedPayload | RecoveryCompletedPayload>) {
      events.push(event);
      return resolvedVoid();
    },
  };

  const developmentLedger = {
    record(entry: Record<string, unknown>) {
      ledgerEntries.push(entry);
      return resolvedVoid();
    },
  };

  const snapshots = new Map<string, StableSnapshotRecord>(
    (options.snapshots ?? [DEFAULT_SNAPSHOT]).map((snapshot) => [snapshot.snapshotId, snapshot]),
  );

  const snapshotStore = {
    getLatestValidSnapshotId(preferredSnapshotId: string | null) {
      if (preferredSnapshotId && snapshots.has(preferredSnapshotId)) {
        return resolved(preferredSnapshotId);
      }

      return resolved(snapshots.keys().next().value ?? null);
    },
    getSnapshotById(snapshotId: string) {
      return resolved(snapshots.get(snapshotId) ?? null);
    },
  };

  const bodyGateway = {
    restoreGitTag(gitTag: string) {
      if (options.restoreGitTagError) throw options.restoreGitTagError;
      restoredTags.push(gitTag);
      return resolvedVoid();
    },
  };

  const modelRegistry = {
    restoreProfileMap(modelProfileMapJson: Record<string, string>) {
      if (options.restoreProfileMapError) throw options.restoreProfileMapError;
      restoredProfileMaps.push(modelProfileMapJson);
      return resolvedVoid();
    },
  };

  const scheduler = {
    startCalls: 0,
    start() {
      this.startCalls += 1;
      return resolvedVoid();
    },
  };

  const tickEngine = {
    startCalls: 0,
    start() {
      this.startCalls += 1;
      return resolvedVoid();
    },
  };

  const sensorAdapter = {
    startCalls: 0,
    start() {
      this.startCalls += 1;
      return resolvedVoid();
    },
  };

  const dependencyResults: Partial<Record<DependencyId, DependencyProbeResult | Error>> = {
    ...DEFAULT_DEPENDENCY_RESULTS,
    ...(options.dependencyResults ?? {}),
  };

  const dependencyProbes = Object.fromEntries(
    Object.entries(dependencyResults).map(([dependency, result]) => [
      dependency,
      () => {
        if (result instanceof Error) throw result;
        return resolved(result ?? { ok: false, detail: 'missing dependency result' });
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
