import path from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import {
  loadSkillPackage,
  type LoadedSkill,
  type SkillTreeValidationResult,
  type SkillValidationResult,
  validateSkillTree,
} from '@yaagi/skills';
import type { CoreRuntimeConfig } from '../platform/core-config.ts';
import { syncRuntimeSkillsFromSeed } from '../platform/runtime-seed.ts';

export type SkillAvailabilityState = {
  skillId: string;
  seedPath: string;
  workspacePath: string;
  packageShape: 'valid' | 'invalid';
  materialization: 'materialized' | 'missing' | 'failed' | 'stale';
  adapterLoad: 'loaded' | 'not_loaded' | 'failed';
  listed: boolean;
  active: boolean;
  reason: string | null;
  validationErrors: string[];
};

export type SkillRuntimeDiagnostics = {
  generatedAt: string;
  seedRootPath: string;
  workspaceRootPath: string;
  rootErrors: {
    seed: string[];
    workspace: string[];
  };
  rootWarnings: {
    seed: string[];
    workspace: string[];
  };
  skills: SkillAvailabilityState[];
  validSkillIds: string[];
  activeSkillIds: string[];
};

export type RuntimeSkillsService = {
  start(): Promise<void>;
  stop(): Promise<void>;
  refresh(): Promise<void>;
  syncFromSeed(): Promise<void>;
  getDiagnostics(): SkillRuntimeDiagnostics;
  getLoadedSkills(): LoadedSkill[];
};

type RefreshSnapshot = {
  diagnostics: SkillRuntimeDiagnostics;
  loadedSkills: Map<string, LoadedSkill>;
};

type SeedBaseline = {
  rootErrors: string[];
  rootWarnings: string[];
  byId: Map<string, SkillValidationResult>;
};

type RefreshMode = 'full' | 'workspace-only';

const EMPTY_DIAGNOSTICS = (config: CoreRuntimeConfig): SkillRuntimeDiagnostics => ({
  generatedAt: new Date(0).toISOString(),
  seedRootPath: config.seedSkillsPath,
  workspaceRootPath: config.workspaceSkillsPath,
  rootErrors: {
    seed: [],
    workspace: [],
  },
  rootWarnings: {
    seed: [],
    workspace: [],
  },
  skills: [],
  validSkillIds: [],
  activeSkillIds: [],
});

const toValidationMap = (result: SkillTreeValidationResult): Map<string, SkillValidationResult> =>
  new Map(result.allSkills.map((entry) => [entry.skillId, entry] as const));

const uniqueSorted = (values: Iterable<string>): string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

const strongerMode = (current: RefreshMode | null, next: RefreshMode): RefreshMode =>
  current === 'full' || next === 'full' ? 'full' : 'workspace-only';

const toSeedBaseline = (seedTree: SkillTreeValidationResult): SeedBaseline => ({
  rootErrors: [...seedTree.rootErrors],
  rootWarnings: [...seedTree.rootWarnings],
  byId: toValidationMap(seedTree),
});

const createState = (
  skillId: string,
  config: CoreRuntimeConfig,
  input: Partial<SkillAvailabilityState>,
): SkillAvailabilityState => ({
  skillId,
  seedPath: path.join(config.seedSkillsPath, skillId),
  workspacePath: path.join(config.workspaceSkillsPath, skillId),
  packageShape: input.packageShape ?? 'invalid',
  materialization: input.materialization ?? 'missing',
  adapterLoad: input.adapterLoad ?? 'not_loaded',
  listed: input.listed ?? false,
  active: input.active ?? false,
  reason: input.reason ?? null,
  validationErrors: input.validationErrors ?? [],
});

const buildSkillSnapshot = async (
  config: CoreRuntimeConfig,
  seedResult: SkillValidationResult | undefined,
  workspaceResult: SkillValidationResult | undefined,
): Promise<{ state: SkillAvailabilityState; loadedSkill: LoadedSkill | null }> => {
  const skillId = seedResult?.skillId ?? workspaceResult?.skillId;
  if (!skillId) {
    throw new Error('skill snapshot requires at least one validation result');
  }

  if (!seedResult) {
    return {
      state: createState(skillId, config, {
        packageShape: workspaceResult?.valid ? 'valid' : 'invalid',
        materialization: 'stale',
        adapterLoad: 'not_loaded',
        reason: 'missing_seed_package',
        validationErrors: workspaceResult?.errors ?? [],
      }),
      loadedSkill: null,
    };
  }

  if (!seedResult.valid) {
    return {
      state: createState(skillId, config, {
        packageShape: 'invalid',
        materialization: workspaceResult ? 'stale' : 'missing',
        adapterLoad: 'not_loaded',
        reason: 'seed_validation_failed',
        validationErrors: [...seedResult.errors],
      }),
      loadedSkill: null,
    };
  }

  if (!workspaceResult) {
    return {
      state: createState(skillId, config, {
        packageShape: 'valid',
        materialization: 'missing',
        adapterLoad: 'not_loaded',
        reason: 'missing_workspace_package',
      }),
      loadedSkill: null,
    };
  }

  if (!workspaceResult.valid) {
    return {
      state: createState(skillId, config, {
        packageShape: 'invalid',
        materialization: 'failed',
        adapterLoad: 'not_loaded',
        reason: 'workspace_validation_failed',
        validationErrors: [...workspaceResult.errors],
      }),
      loadedSkill: null,
    };
  }

  if (seedResult.fingerprint !== workspaceResult.fingerprint) {
    return {
      state: createState(skillId, config, {
        packageShape: 'valid',
        materialization: 'stale',
        adapterLoad: 'not_loaded',
        reason: 'stale_workspace_copy',
      }),
      loadedSkill: null,
    };
  }

  try {
    const loadedSkill = await loadSkillPackage(workspaceResult.path);
    return {
      state: createState(skillId, config, {
        packageShape: 'valid',
        materialization: 'materialized',
        adapterLoad: 'loaded',
        listed: true,
        active: true,
      }),
      loadedSkill,
    };
  } catch (error) {
    return {
      state: createState(skillId, config, {
        packageShape: 'valid',
        materialization: 'materialized',
        adapterLoad: 'failed',
        listed: true,
        reason:
          error instanceof Error ? `adapter_load_failed:${error.message}` : 'adapter_load_failed',
      }),
      loadedSkill: null,
    };
  }
};

const buildRefreshSnapshot = async (
  config: CoreRuntimeConfig,
  now: () => string,
  input: {
    seedBaseline: SeedBaseline;
    workspaceTree: SkillTreeValidationResult;
  },
): Promise<RefreshSnapshot> => {
  const { seedBaseline, workspaceTree } = input;
  const workspaceById = toValidationMap(workspaceTree);
  const skillIds = uniqueSorted([...seedBaseline.byId.keys(), ...workspaceById.keys()]);
  const rootValidationErrors = [...seedBaseline.rootErrors, ...workspaceTree.rootErrors];

  if (rootValidationErrors.length > 0) {
    return {
      diagnostics: {
        generatedAt: now(),
        seedRootPath: config.seedSkillsPath,
        workspaceRootPath: config.workspaceSkillsPath,
        rootErrors: {
          seed: [...seedBaseline.rootErrors],
          workspace: [...workspaceTree.rootErrors],
        },
        rootWarnings: {
          seed: [...seedBaseline.rootWarnings],
          workspace: [...workspaceTree.rootWarnings],
        },
        skills: skillIds.map((skillId) =>
          createState(skillId, config, {
            packageShape: 'invalid',
            materialization: 'failed',
            adapterLoad: 'not_loaded',
            reason: 'skills_root_invalid',
            validationErrors: [...rootValidationErrors],
          }),
        ),
        validSkillIds: [],
        activeSkillIds: [],
      },
      loadedSkills: new Map(),
    };
  }

  const loadedSkills = new Map<string, LoadedSkill>();
  const skills: SkillAvailabilityState[] = [];

  for (const skillId of skillIds) {
    const snapshot = await buildSkillSnapshot(
      config,
      seedBaseline.byId.get(skillId),
      workspaceById.get(skillId),
    );
    skills.push(snapshot.state);
    if (snapshot.loadedSkill) {
      loadedSkills.set(skillId, snapshot.loadedSkill);
    }
  }

  return {
    diagnostics: {
      generatedAt: now(),
      seedRootPath: config.seedSkillsPath,
      workspaceRootPath: config.workspaceSkillsPath,
      rootErrors: {
        seed: [...seedBaseline.rootErrors],
        workspace: [...workspaceTree.rootErrors],
      },
      rootWarnings: {
        seed: [...seedBaseline.rootWarnings],
        workspace: [...workspaceTree.rootWarnings],
      },
      skills,
      validSkillIds: skills.filter((skill) => skill.listed).map((skill) => skill.skillId),
      activeSkillIds: skills.filter((skill) => skill.active).map((skill) => skill.skillId),
    },
    loadedSkills,
  };
};

export function createRuntimeSkillsService(
  config: CoreRuntimeConfig,
  options: {
    now?: () => string;
  } = {},
): RuntimeSkillsService {
  const now = options.now ?? (() => new Date().toISOString());
  let watcher: FSWatcher | null = null;
  let started = false;
  let diagnostics = EMPTY_DIAGNOSTICS(config);
  let loadedSkills = new Map<string, LoadedSkill>();
  let seedBaseline: SeedBaseline | null = null;
  let refreshInFlight = false;
  let pendingRefreshMode: RefreshMode | null = null;
  let refreshWaiters: Array<() => void> = [];
  let requestedRefreshGeneration = 0;
  let suppressWatcherRefresh = false;

  const applySnapshot = (snapshot: RefreshSnapshot): void => {
    diagnostics = snapshot.diagnostics;
    loadedSkills = snapshot.loadedSkills;
  };

  const applyRefreshFailure = (error: unknown, mode: RefreshMode): void => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const knownSkillIds = uniqueSorted([
      ...diagnostics.skills.map((skill) => skill.skillId),
      ...(seedBaseline ? [...seedBaseline.byId.keys()] : []),
    ]);

    diagnostics = {
      ...diagnostics,
      generatedAt: now(),
      rootErrors: {
        ...diagnostics.rootErrors,
        seed: mode === 'full' ? [errorMessage] : [...diagnostics.rootErrors.seed],
        workspace: [...diagnostics.rootErrors.workspace, errorMessage],
      },
      skills: knownSkillIds.map((skillId) =>
        createState(skillId, config, {
          packageShape: 'invalid',
          materialization: 'failed',
          adapterLoad: 'not_loaded',
          reason: `refresh_failed:${errorMessage}`,
          validationErrors: [errorMessage],
        }),
      ),
      validSkillIds: [],
      activeSkillIds: [],
    };
    loadedSkills = new Map();
    if (mode === 'full') {
      seedBaseline = null;
    }
  };

  const flushRefreshWaiters = (): void => {
    const waiters = refreshWaiters;
    refreshWaiters = [];
    for (const resolve of waiters) {
      resolve();
    }
  };

  const drainRefreshQueue = async (): Promise<void> => {
    if (refreshInFlight) {
      return;
    }

    refreshInFlight = true;

    while (pendingRefreshMode) {
      const mode = pendingRefreshMode;
      pendingRefreshMode = null;
      const runGeneration = requestedRefreshGeneration;

      try {
        const workspaceTreePromise = validateSkillTree(config.workspaceSkillsPath);
        const currentSeedBaseline =
          mode === 'full' || !seedBaseline
            ? toSeedBaseline(await validateSkillTree(config.seedSkillsPath))
            : seedBaseline;
        const snapshot = await buildRefreshSnapshot(config, now, {
          seedBaseline: currentSeedBaseline,
          workspaceTree: await workspaceTreePromise,
        });

        if (runGeneration === requestedRefreshGeneration) {
          seedBaseline = currentSeedBaseline;
          applySnapshot(snapshot);
        }
      } catch (error) {
        if (runGeneration === requestedRefreshGeneration) {
          applyRefreshFailure(error, mode);
        }
      }
    }

    refreshInFlight = false;
    if (pendingRefreshMode) {
      void drainRefreshQueue();
      return;
    }
    flushRefreshWaiters();
  };

  const queueRefresh = async (mode: RefreshMode = 'full'): Promise<void> => {
    pendingRefreshMode = strongerMode(pendingRefreshMode, mode);
    requestedRefreshGeneration += 1;

    const waiter = new Promise<void>((resolve) => {
      refreshWaiters.push(resolve);
    });

    void drainRefreshQueue();
    await waiter;
  };

  return {
    async start(): Promise<void> {
      if (started) {
        return;
      }

      await queueRefresh();

      watcher = chokidar.watch(config.workspaceSkillsPath, {
        followSymlinks: false,
        ignoreInitial: true,
        persistent: true,
      });
      watcher.on('all', () => {
        if (suppressWatcherRefresh) {
          return;
        }
        void queueRefresh('workspace-only');
      });
      watcher.on('error', (error) => {
        applyRefreshFailure(error, 'workspace-only');
      });
      await new Promise<void>((resolve) => {
        watcher?.once('ready', () => {
          resolve();
        });
      });
      started = true;
    },

    async stop(): Promise<void> {
      started = false;
      if (watcher) {
        await watcher.close();
        watcher = null;
      }
    },

    async refresh(): Promise<void> {
      await queueRefresh('full');
    },

    async syncFromSeed(): Promise<void> {
      suppressWatcherRefresh = true;
      try {
        await syncRuntimeSkillsFromSeed(config);
        await queueRefresh('full');
      } catch (error) {
        applyRefreshFailure(error, 'full');
        throw error;
      } finally {
        suppressWatcherRefresh = false;
      }
    },

    getDiagnostics(): SkillRuntimeDiagnostics {
      return {
        ...diagnostics,
        rootErrors: {
          seed: [...diagnostics.rootErrors.seed],
          workspace: [...diagnostics.rootErrors.workspace],
        },
        rootWarnings: {
          seed: [...diagnostics.rootWarnings.seed],
          workspace: [...diagnostics.rootWarnings.workspace],
        },
        skills: diagnostics.skills.map((skill) => ({
          ...skill,
          validationErrors: [...skill.validationErrors],
        })),
        validSkillIds: [...diagnostics.validSkillIds],
        activeSkillIds: [...diagnostics.activeSkillIds],
      };
    },

    getLoadedSkills(): LoadedSkill[] {
      return [...loadedSkills.values()].sort((left, right) =>
        left.skillId.localeCompare(right.skillId),
      );
    },
  };
}
