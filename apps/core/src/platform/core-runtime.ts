import { createServer, type Server } from 'node:http';
import { access } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import net from 'node:net';
import { Hono } from 'hono';
import { ZodError } from 'zod';
import {
  DEFAULT_PERCEPTION_HEALTH,
  httpIngestStimulusSchema,
  type HttpIngestStimulusInput,
  type PerceptionHealthSnapshot,
} from '@yaagi/contracts/perception';
import type { OperatorRicherRegistryHealthSummary } from '@yaagi/contracts/models';
import { checkPostgresConnectivity, ensureDatabaseReady } from '@yaagi/db/bootstrap';
import { type CoreRuntimeConfig, loadCoreRuntimeConfig } from './core-config.ts';
import { createPhase0DecisionInvoker, PHASE0_AGENT_KEYS } from './phase0-ai.ts';
import { registerOperatorApiRoutes, type OperatorRuntimeLifecycle } from './operator-api.ts';
import { materializeRuntimeSeed } from './runtime-seed.ts';
import { createPhase0RuntimeLifecycle } from '../runtime/runtime-lifecycle.ts';
import type {
  BaselineModelProfileDiagnostic,
  ModelHealthSummary,
} from '../runtime/model-router.ts';

const BOOT_POLL_INTERVAL_MS = 1_000;

export type CoreRuntimeHealth = {
  ok: boolean;
  postgres: boolean;
  fastModel: boolean;
  configuration: boolean;
  agents: string[];
  perception: PerceptionHealthSnapshot;
  modelRouting: {
    profiles: BaselineModelProfileDiagnostic[];
  };
  checks: Array<{
    name: 'configuration' | 'postgres' | 'fastModel';
    ok: boolean;
    detail?: string;
  }>;
};

export type CoreRuntimeDependencies = {
  bootstrapDatabase?: () => Promise<void>;
  materializeRuntimeState?: () => Promise<void>;
  probeConfiguration?: () => Promise<boolean>;
  probePostgres?: () => Promise<boolean>;
  probeFastModel?: () => Promise<boolean>;
  createRuntimeLifecycle?: (config: CoreRuntimeConfig) => OperatorRuntimeLifecycle & {
    start(): Promise<void>;
    stop(): Promise<void>;
    health?(): Promise<PerceptionHealthSnapshot>;
    getModelRoutingDiagnostics?(input?: {
      reflex?: ModelHealthSummary;
      deliberation?: ModelHealthSummary;
      reflection?: ModelHealthSummary;
    }): Promise<BaselineModelProfileDiagnostic[]>;
    getRicherModelRegistryHealthSummary?(): Promise<OperatorRicherRegistryHealthSummary>;
    ingestHttpStimulus?(input: unknown): Promise<{
      stimulusId: string;
      deduplicated: boolean;
      tickAdmission?: { accepted: boolean; reason?: string };
    }>;
    requestTick?(input: {
      requestId: string;
      kind: 'reactive' | 'deliberative' | 'contemplative' | 'consolidation' | 'developmental';
      trigger: 'system';
      requestedAt: string;
      payload: Record<string, unknown>;
    }): Promise<{
      accepted: boolean;
      reason?: 'boot_inactive' | 'lease_busy' | 'unsupported_tick_kind';
    }>;
  };
};

export type CoreRuntime = {
  readonly config: CoreRuntimeConfig;
  readonly app: Hono;
  readonly reasoningAgents: readonly string[];
  health(): Promise<CoreRuntimeHealth>;
  start(): Promise<{ url: string }>;
  stop(): Promise<void>;
  fetch(request: Request): Promise<Response>;
};

const withTrailingSlash = (value: string): string => (value.endsWith('/') ? value : `${value}/`);

const createFileSystemProbe = (config: CoreRuntimeConfig) => async (): Promise<boolean> => {
  const paths = [
    config.seedRootPath,
    config.seedConstitutionPath,
    config.seedBodyPath,
    config.seedSkillsPath,
    config.seedModelsPath,
    config.seedDataPath,
    config.workspaceBodyPath,
    config.workspaceSkillsPath,
    config.modelsPath,
    config.dataPath,
  ];

  for (const targetPath of paths) {
    try {
      await access(targetPath);
    } catch {
      return false;
    }
  }

  return true;
};

const createDatabaseBootstrap = (config: CoreRuntimeConfig) => async (): Promise<void> => {
  await ensureDatabaseReady({
    connectionString: config.postgresUrl,
    migrationsDir: config.migrationsDir,
    bossSchema: config.pgBossSchema,
  });
};

const createPostgresProbe = (config: CoreRuntimeConfig) => async (): Promise<boolean> => {
  try {
    await checkPostgresConnectivity(config.postgresUrl);
    return true;
  } catch {
    // Fall back to a low-level socket probe while Postgres is still booting.
  }

  const postgresUrl = new URL(config.postgresUrl);
  const port = postgresUrl.port ? Number(postgresUrl.port) : 5432;
  const host = postgresUrl.hostname || '127.0.0.1';

  return await new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host, port });
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 1_500);

    socket.once('connect', () => {
      clearTimeout(timeout);
      socket.end();
      resolve(true);
    });

    socket.once('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
};

const createFastModelProbe = (config: CoreRuntimeConfig) => async (): Promise<boolean> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_500);

  try {
    const response = await fetch(new URL('models', withTrailingSlash(config.fastModelBaseUrl)), {
      method: 'GET',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

const toNodeResponse = async (response: Response) => {
  const headers = Object.fromEntries(response.headers.entries());
  const body = response.body ? Buffer.from(await response.arrayBuffer()) : undefined;
  return { headers, body, status: response.status };
};

const handleRequestError = (
  response: import('node:http').ServerResponse<import('node:http').IncomingMessage>,
  error: unknown,
): void => {
  console.error(error);
  if (!response.headersSent) {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
  }
  response.end('internal server error');
};

export function createCoreRuntime(
  config: CoreRuntimeConfig = loadCoreRuntimeConfig(),
  dependencies: CoreRuntimeDependencies = {},
): CoreRuntime {
  const app = new Hono();
  let server: Server | null = null;
  let listeningUrl: string | null = null;

  const bootstrapDatabase = dependencies.bootstrapDatabase ?? createDatabaseBootstrap(config);
  const materializeRuntimeState =
    dependencies.materializeRuntimeState ?? (() => materializeRuntimeSeed(config).then(() => {}));
  const probeConfiguration = dependencies.probeConfiguration ?? createFileSystemProbe(config);
  const probePostgres = dependencies.probePostgres ?? createPostgresProbe(config);
  const probeFastModel = dependencies.probeFastModel ?? createFastModelProbe(config);
  const reasoningAgents = [...PHASE0_AGENT_KEYS];
  const runtimeLifecycle =
    dependencies.createRuntimeLifecycle?.(config) ??
    createPhase0RuntimeLifecycle(config, {
      invokeDecision: createPhase0DecisionInvoker(),
    });

  const health = async (): Promise<CoreRuntimeHealth> => {
    const [configuration, postgres, fastModel] = await Promise.all([
      probeConfiguration(),
      probePostgres(),
      probeFastModel(),
    ]);
    let perception = DEFAULT_PERCEPTION_HEALTH;
    let modelRoutingProfiles: BaselineModelProfileDiagnostic[] = [];
    const baselineHealthSummary: ModelHealthSummary = fastModel
      ? {
          healthy: true,
          detail: 'model-fast dependency is reachable',
        }
      : {
          healthy: false,
          detail: 'model-fast dependency is unavailable',
        };
    if (postgres && runtimeLifecycle.health) {
      try {
        perception = await runtimeLifecycle.health();
      } catch {
        perception = DEFAULT_PERCEPTION_HEALTH;
      }
    }
    if (postgres && runtimeLifecycle.getModelRoutingDiagnostics) {
      try {
        modelRoutingProfiles = await runtimeLifecycle.getModelRoutingDiagnostics({
          reflex: baselineHealthSummary,
          deliberation: baselineHealthSummary,
          reflection: baselineHealthSummary,
        });
      } catch {
        modelRoutingProfiles = [];
      }
    }

    return {
      ok: configuration && postgres && fastModel,
      configuration,
      postgres,
      fastModel,
      agents: reasoningAgents,
      perception,
      modelRouting: {
        profiles: modelRoutingProfiles,
      },
      checks: [
        { name: 'configuration', ok: configuration },
        { name: 'postgres', ok: postgres },
        { name: 'fastModel', ok: fastModel },
      ],
    };
  };

  app.get('/health', async (context) => {
    const snapshot = await health();
    return context.json(snapshot, snapshot.ok ? 200 : 503);
  });

  app.post('/ingest', async (context) => {
    let payload: unknown;

    try {
      payload = await context.req.json();
    } catch (error) {
      return context.json(
        {
          accepted: false,
          error: error instanceof Error ? error.message : 'invalid_json',
        },
        400,
      );
    }

    let parsedPayload: HttpIngestStimulusInput;
    try {
      parsedPayload = httpIngestStimulusSchema.parse(payload);
    } catch (error) {
      return context.json(
        {
          accepted: false,
          error: error instanceof ZodError ? error.message : String(error),
        },
        400,
      );
    }

    if (!runtimeLifecycle.ingestHttpStimulus) {
      return context.json({ error: 'ingest_unavailable' }, 503);
    }

    try {
      const result = await runtimeLifecycle.ingestHttpStimulus(parsedPayload);
      return context.json(
        {
          accepted: true,
          stimulusId: result.stimulusId,
          deduplicated: result.deduplicated,
          tickAdmission: result.tickAdmission ?? null,
        },
        202,
      );
    } catch (error) {
      return context.json(
        {
          accepted: false,
          error: error instanceof Error ? error.message : 'ingest_failed',
        },
        503,
      );
    }
  });

  registerOperatorApiRoutes(app, runtimeLifecycle);

  const waitForDependencies = async (): Promise<void> => {
    const deadline = Date.now() + config.bootTimeoutMs;
    let lastSnapshot: Pick<CoreRuntimeHealth, 'configuration' | 'postgres' | 'fastModel'> | null =
      null;

    while (Date.now() <= deadline) {
      const configuration = await probeConfiguration();
      let postgres = false;

      if (configuration) {
        try {
          await bootstrapDatabase();
          postgres = true;
        } catch {
          postgres = false;
        }
      }

      const fastModel = configuration ? await probeFastModel() : false;
      lastSnapshot = { configuration, postgres, fastModel };

      if (configuration && postgres && fastModel) {
        return;
      }

      await sleep(BOOT_POLL_INTERVAL_MS);
    }

    throw new Error(
      `phase-0 runtime preflight timed out after ${config.bootTimeoutMs}ms: ${JSON.stringify(
        lastSnapshot,
      )}`,
    );
  };

  const start = async (): Promise<{ url: string }> => {
    if (server) {
      return { url: listeningUrl ?? `http://${config.host}:${config.port}` };
    }

    await materializeRuntimeState();
    await waitForDependencies();
    await runtimeLifecycle.start();

    const nextServer = createServer((request, response) => {
      void (async () => {
        const requestUrl = new URL(
          request.url ?? '/',
          `http://${request.headers.host ?? `${config.host}:${config.port}`}`,
        );
        const requestHeaders = new Headers();
        for (const [headerName, headerValue] of Object.entries(request.headers)) {
          if (typeof headerValue === 'string') {
            requestHeaders.set(headerName, headerValue);
            continue;
          }

          if (Array.isArray(headerValue)) {
            for (const value of headerValue) {
              requestHeaders.append(headerName, value);
            }
          }
        }

        const requestInit: RequestInit = {
          method: request.method ?? 'GET',
          headers: requestHeaders,
        };

        if (request.method && request.method !== 'GET' && request.method !== 'HEAD') {
          requestInit.body = request as unknown as NonNullable<RequestInit['body']>;
          (requestInit as RequestInit & { duplex: 'half' }).duplex = 'half';
        }

        const fetchRequest = new Request(requestUrl, requestInit);
        const fetchResponse = await app.fetch(fetchRequest);
        const nodeResponse = await toNodeResponse(fetchResponse);

        response.writeHead(nodeResponse.status, nodeResponse.headers);
        response.end(nodeResponse.body);
      })().catch((error: unknown) => {
        handleRequestError(response, error);
      });
    });
    server = nextServer;

    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        nextServer.off('listening', onListening);
        reject(error);
      };
      const onListening = () => {
        nextServer.off('error', onError);
        resolve();
      };

      nextServer.once('error', onError);
      nextServer.once('listening', onListening);
      nextServer.listen(config.port, config.host);
    });

    const address = nextServer.address();
    const port = typeof address === 'object' && address ? address.port : config.port;
    const host = config.host === '0.0.0.0' ? '127.0.0.1' : config.host;
    listeningUrl = `http://${host}:${port}`;

    return { url: listeningUrl };
  };

  const stop = async (): Promise<void> => {
    if (!server) {
      await runtimeLifecycle.stop();
      return;
    }

    const activeServer = server;
    server = null;
    listeningUrl = null;

    await new Promise<void>((resolve, reject) => {
      activeServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    await runtimeLifecycle.stop();
  };

  return {
    config,
    app,
    reasoningAgents,
    health,
    start,
    stop,
    fetch: async (request: Request) => app.fetch(request),
  };
}

export async function waitForCoreRuntime(runtime: CoreRuntime): Promise<{ url: string }> {
  const started = await runtime.start();
  await sleep(0);
  return started;
}
