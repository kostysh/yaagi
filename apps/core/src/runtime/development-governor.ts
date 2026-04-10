import { createHash, randomUUID } from 'node:crypto';
import {
  DEVELOPMENT_FREEZE_STATE,
  DEVELOPMENT_FREEZE_TRIGGER_KIND,
  DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE,
  type DevelopmentFreezeResult,
  type DevelopmentFreezeTriggerKind,
  type DevelopmentGovernorOriginSurface,
} from '@yaagi/contracts/governor';
import {
  HOMEOSTAT_ALERT_SEVERITY,
  HOMEOSTAT_REQUESTED_ACTION_KIND,
  HOMEOSTAT_SIGNAL_FAMILY,
  type HomeostatReactionRequest,
} from '@yaagi/contracts/runtime';
import {
  createDevelopmentGovernorStore,
  createRuntimeDbClient,
  setRuntimeDevelopmentFreeze,
  type DevelopmentFreezeRow,
} from '@yaagi/db';
import type { CoreRuntimeConfig } from '../platform/core-config.ts';

type FreezeDevelopmentInput = {
  requestId: string;
  reason: string;
  evidenceRefs: string[];
  requestedBy: string;
  requestedAt?: string;
};

export type DevelopmentGovernorService = {
  freezeDevelopment(input: FreezeDevelopmentInput): Promise<DevelopmentFreezeResult>;
  applyHomeostatReaction(request: HomeostatReactionRequest): Promise<DevelopmentFreezeResult>;
  recoverActiveFreeze(): Promise<{ activeFreeze: DevelopmentFreezeRow | null }>;
  loadActiveFreeze(): Promise<DevelopmentFreezeRow | null>;
};

type FreezeCommandMaterial = {
  requestId: string;
  triggerKind: DevelopmentFreezeTriggerKind;
  originSurface: DevelopmentGovernorOriginSurface;
  requestedBy: string;
  reason: string;
  hashEvidenceRefs: string[];
  storeEvidenceRefs: string[];
  createdAt: string;
  payloadJson: Record<string, unknown>;
};

const withRuntimeClient = async <T>(
  connectionString: string,
  run: (client: ReturnType<typeof createRuntimeDbClient>) => Promise<T>,
): Promise<T> => {
  const client = createRuntimeDbClient(connectionString);
  await client.connect();

  try {
    return await run(client);
  } finally {
    await client.end();
  }
};

const uniqueSorted = (values: string[]): string[] =>
  [...new Set(values.filter((value) => value.length > 0))].sort();

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableJson(entryValue)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
};

const hashFreezeCommand = (command: FreezeCommandMaterial): string =>
  createHash('sha256')
    .update(
      stableJson({
        originSurface: command.originSurface,
        reason: command.reason,
        requestId: command.requestId,
        requestedBy: command.requestedBy,
        evidenceRefs: command.hashEvidenceRefs,
        triggerKind: command.triggerKind,
      }),
    )
    .digest('hex');

const toAcceptedResult = (
  storeResult: Extract<
    Awaited<ReturnType<ReturnType<typeof createDevelopmentGovernorStore>['freezeDevelopment']>>,
    { accepted: true }
  >,
): DevelopmentFreezeResult => ({
  accepted: true,
  requestId: storeResult.freeze.requestId,
  freezeId: storeResult.freeze.freezeId,
  state: DEVELOPMENT_FREEZE_STATE.FROZEN,
  triggerKind: storeResult.freeze.triggerKind,
  decisionOrigin: storeResult.freeze.triggerKind,
  deduplicated: storeResult.deduplicated,
  createdAt: storeResult.freeze.createdAt,
});

const toFreezeResult = (
  storeResult: Awaited<
    ReturnType<ReturnType<typeof createDevelopmentGovernorStore>['freezeDevelopment']>
  >,
): DevelopmentFreezeResult => {
  if (storeResult.accepted) {
    return toAcceptedResult(storeResult);
  }

  return {
    accepted: false,
    requestId: storeResult.freeze.requestId,
    reason: storeResult.reason,
  };
};

const materializeFreezeCommand = (input: FreezeCommandMaterial) => ({
  freezeId: `development-freeze:${randomUUID()}`,
  ledgerId: `development-ledger:${randomUUID()}`,
  triggerKind: input.triggerKind,
  originSurface: input.originSurface,
  requestId: input.requestId,
  normalizedRequestHash: hashFreezeCommand(input),
  reason: input.reason,
  requestedBy: input.requestedBy,
  evidenceRefs: input.storeEvidenceRefs,
  createdAt: input.createdAt,
  payloadJson: input.payloadJson,
});

export const createDbBackedDevelopmentGovernorService = (
  config: Pick<CoreRuntimeConfig, 'postgresUrl'>,
  options: { now?: () => Date } = {},
): DevelopmentGovernorService => {
  const now = options.now ?? (() => new Date());

  const runFreeze = async (command: FreezeCommandMaterial): Promise<DevelopmentFreezeResult> =>
    withRuntimeClient(config.postgresUrl, async (client) => {
      const store = createDevelopmentGovernorStore(client);
      const result = await store.freezeDevelopment(materializeFreezeCommand(command));
      return toFreezeResult(result);
    });

  return {
    freezeDevelopment: (input) => {
      const createdAt = input.requestedAt ?? now().toISOString();
      const evidenceRefs = uniqueSorted(input.evidenceRefs);

      return runFreeze({
        requestId: input.requestId,
        triggerKind: DEVELOPMENT_FREEZE_TRIGGER_KIND.OPERATOR,
        originSurface: DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.OPERATOR_API,
        requestedBy: input.requestedBy,
        reason: input.reason,
        hashEvidenceRefs: evidenceRefs,
        storeEvidenceRefs: evidenceRefs,
        createdAt,
        payloadJson: {
          route: '/control/freeze-development',
        },
      });
    },

    applyHomeostatReaction: (request) => {
      if (
        request.signalFamily !== HOMEOSTAT_SIGNAL_FAMILY.DEVELOPMENT_PROPOSAL_RATE ||
        request.severity !== HOMEOSTAT_ALERT_SEVERITY.CRITICAL ||
        request.requestedActionKind !== HOMEOSTAT_REQUESTED_ACTION_KIND.FREEZE_DEVELOPMENT_PROPOSALS
      ) {
        return Promise.resolve({
          accepted: false,
          requestId: request.reactionRequestId,
          reason: 'unsupported_reaction',
        });
      }

      const hashEvidenceRefs = uniqueSorted(request.evidenceRefs);
      const storeEvidenceRefs = uniqueSorted([
        ...request.evidenceRefs,
        `homeostat:snapshot:${request.snapshotId}`,
        `homeostat:reaction:${request.reactionRequestId}`,
      ]);

      return runFreeze({
        requestId: `homeostat:${request.idempotencyKey}`,
        triggerKind: DEVELOPMENT_FREEZE_TRIGGER_KIND.POLICY_AUTO,
        originSurface: DEVELOPMENT_GOVERNOR_ORIGIN_SURFACE.HOMEOSTAT,
        requestedBy: 'homeostat',
        reason: 'critical development_proposal_rate requested development proposal freeze',
        hashEvidenceRefs,
        storeEvidenceRefs,
        createdAt: request.createdAt,
        payloadJson: {
          expiresAt: request.expiresAt,
          reactionRequestId: request.reactionRequestId,
          signalFamily: request.signalFamily,
          snapshotId: request.snapshotId,
        },
      });
    },

    recoverActiveFreeze: () =>
      withRuntimeClient(config.postgresUrl, async (client) => {
        const store = createDevelopmentGovernorStore(client);
        const activeFreeze = await store.loadActiveFreeze();
        if (activeFreeze) {
          await setRuntimeDevelopmentFreeze(client, true);
        }

        return { activeFreeze };
      }),

    loadActiveFreeze: () =>
      withRuntimeClient(config.postgresUrl, async (client) => {
        const store = createDevelopmentGovernorStore(client);
        return await store.loadActiveFreeze();
      }),
  };
};
