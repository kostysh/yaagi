import type { Hono } from 'hono';
import { ZodError } from 'zod';
import {
  operatorDevelopmentProposalRequestSchema,
  operatorEpisodeCursorSchema,
  operatorEpisodesQuerySchema,
  operatorFreezeDevelopmentRequestSchema,
  operatorStateQuerySchema,
  operatorTickControlRequestSchema,
  operatorTimelineCursorSchema,
  operatorTimelineQuerySchema,
  type OperatorDevelopmentProposalRequest,
  type OperatorEpisodeCursor,
  type OperatorFreezeDevelopmentRequest,
  type OperatorTimelineCursor,
} from '@yaagi/contracts/operator-api';
import {
  DEVELOPMENT_PROPOSAL_KIND,
  type DevelopmentFreezeResult,
  type DevelopmentProposalResult,
} from '@yaagi/contracts/governor';
import type { OperatorRicherRegistryHealthSummary } from '@yaagi/contracts/models';
import type {
  RuntimeEpisodePageInput,
  RuntimeEpisodeRow,
  RuntimeTimelineEventPageInput,
  RuntimeTimelineEventRow,
  SubjectStateSnapshot,
  SubjectStateSnapshotInput,
} from '@yaagi/db';
import type {
  BaselineModelProfileDiagnostic,
  ModelHealthSummary,
} from '../runtime/model-router.ts';

export type OperatorRuntimeLifecycle = {
  getSubjectStateSnapshot?(input?: SubjectStateSnapshotInput): Promise<SubjectStateSnapshot>;
  listTimelineEvents?(input?: RuntimeTimelineEventPageInput): Promise<RuntimeTimelineEventRow[]>;
  listEpisodes?(input?: RuntimeEpisodePageInput): Promise<RuntimeEpisodeRow[]>;
  getModelRoutingDiagnostics?(input?: {
    reflex?: ModelHealthSummary;
    deliberation?: ModelHealthSummary;
    reflection?: ModelHealthSummary;
  }): Promise<BaselineModelProfileDiagnostic[]>;
  getRicherModelRegistryHealthSummary?(): Promise<OperatorRicherRegistryHealthSummary>;
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
  freezeDevelopment?(input: {
    requestId: string;
    reason: string;
    evidenceRefs: string[];
    requestedBy: 'operator_api';
    requestedAt: string;
  }): Promise<DevelopmentFreezeResult>;
  submitDevelopmentProposal?(input: {
    requestId: string;
    proposalKind: 'model_adapter' | 'specialist_model' | 'code_change' | 'policy_change';
    problemSignature: string;
    summary: string;
    evidenceRefs: string[];
    rollbackPlanRef: string | null;
    targetRef: string | null;
    requestedAt: string;
  }): Promise<DevelopmentProposalResult>;
};

const encodeCursor = (value: OperatorTimelineCursor | OperatorEpisodeCursor): string =>
  Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

const decodeCursor = <T>(cursor: string | undefined, parse: (value: unknown) => T): T | null => {
  if (!cursor) {
    return null;
  }

  const raw = Buffer.from(cursor, 'base64url').toString('utf8');
  return parse(JSON.parse(raw));
};

const toValidationError = (error: unknown): string => {
  if (error instanceof ZodError) {
    return error.message;
  }

  return error instanceof Error ? error.message : String(error);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const hasUnsupportedProposalKind = (payload: unknown): boolean =>
  isRecord(payload) &&
  typeof payload['proposalKind'] === 'string' &&
  !Object.values(DEVELOPMENT_PROPOSAL_KIND).includes(
    payload[
      'proposalKind'
    ] as (typeof DEVELOPMENT_PROPOSAL_KIND)[keyof typeof DEVELOPMENT_PROPOSAL_KIND],
  );

const proposalStatusForReason = (
  reason: Exclude<DevelopmentProposalResult, { accepted: true }>['reason'],
): 400 | 409 | 422 | 503 => {
  switch (reason) {
    case 'invalid_request':
      return 400;
    case 'conflicting_request_id':
    case 'development_frozen':
      return 409;
    case 'insufficient_evidence':
    case 'unsupported_proposal_kind':
      return 422;
    case 'persistence_unavailable':
      return 503;
  }
};

const buildPage = <TItem extends RuntimeTimelineEventRow | RuntimeEpisodeRow>(
  rows: TItem[],
  limit: number,
  selectCursor: (row: TItem) => OperatorTimelineCursor | OperatorEpisodeCursor,
): {
  items: TItem[];
  page: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
} => {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const lastVisible = items.at(-1);

  return {
    items,
    page: {
      limit,
      nextCursor: hasMore && lastVisible ? encodeCursor(selectCursor(lastVisible)) : null,
      hasMore,
    },
  };
};

export function registerOperatorApiRoutes(
  app: Hono,
  runtimeLifecycle: OperatorRuntimeLifecycle,
): void {
  const operatorApiEnabled =
    runtimeLifecycle.getSubjectStateSnapshot !== undefined ||
    runtimeLifecycle.listTimelineEvents !== undefined ||
    runtimeLifecycle.listEpisodes !== undefined ||
    runtimeLifecycle.getModelRoutingDiagnostics !== undefined ||
    runtimeLifecycle.requestTick !== undefined ||
    runtimeLifecycle.freezeDevelopment !== undefined ||
    runtimeLifecycle.submitDevelopmentProposal !== undefined;

  if (!operatorApiEnabled) {
    return;
  }

  app.get('/state', async (context) => {
    if (!runtimeLifecycle.getSubjectStateSnapshot) {
      return context.json({ error: 'state_unavailable' }, 503);
    }

    try {
      const query = operatorStateQuerySchema.parse(context.req.query());
      const snapshot = await runtimeLifecycle.getSubjectStateSnapshot({
        goalLimit: query.goalLimit,
        beliefLimit: query.beliefLimit,
        entityLimit: query.entityLimit,
        relationshipLimit: query.relationshipLimit,
      });

      return context.json({
        generatedAt: new Date().toISOString(),
        snapshot,
        bounds: {
          goalLimit: query.goalLimit,
          beliefLimit: query.beliefLimit,
          entityLimit: query.entityLimit,
          relationshipLimit: query.relationshipLimit,
        },
      });
    } catch (error) {
      return context.json({ error: toValidationError(error) }, 400);
    }
  });

  app.get('/timeline', async (context) => {
    if (!runtimeLifecycle.listTimelineEvents) {
      return context.json({ error: 'timeline_unavailable' }, 503);
    }

    try {
      const query = operatorTimelineQuerySchema.parse(context.req.query());
      const cursor = decodeCursor(query.cursor, (value) =>
        operatorTimelineCursorSchema.parse(value),
      );
      const rows = await runtimeLifecycle.listTimelineEvents({
        limit: query.limit + 1,
        ...(cursor ? { after: cursor } : {}),
      });
      const page = buildPage(rows, query.limit, (row) => ({
        occurredAt: row.occurredAt,
        sequenceId: row.sequenceId,
      }));

      return context.json({
        items: page.items.map((row) => ({
          sequenceId: row.sequenceId,
          eventId: row.eventId,
          eventType: row.eventType,
          occurredAt: row.occurredAt,
          subjectRef: row.subjectRef,
          payload: row.payloadJson,
        })),
        page: page.page,
      });
    } catch (error) {
      return context.json({ error: toValidationError(error) }, 400);
    }
  });

  app.get('/episodes', async (context) => {
    if (!runtimeLifecycle.listEpisodes) {
      return context.json({ error: 'episodes_unavailable' }, 503);
    }

    try {
      const query = operatorEpisodesQuerySchema.parse(context.req.query());
      const cursor = decodeCursor(query.cursor, (value) =>
        operatorEpisodeCursorSchema.parse(value),
      );
      const rows = await runtimeLifecycle.listEpisodes({
        limit: query.limit + 1,
        ...(cursor ? { after: cursor } : {}),
      });
      const page = buildPage(rows, query.limit, (row) => ({
        createdAt: row.createdAt,
        episodeId: row.episodeId,
      }));

      return context.json({
        items: page.items,
        page: page.page,
      });
    } catch (error) {
      return context.json({ error: toValidationError(error) }, 400);
    }
  });

  app.get('/models', async (context) => {
    if (!runtimeLifecycle.getModelRoutingDiagnostics) {
      return context.json({ error: 'models_unavailable' }, 503);
    }

    const [baselineProfiles, richerRegistryHealth] = await Promise.all([
      runtimeLifecycle.getModelRoutingDiagnostics(),
      runtimeLifecycle.getRicherModelRegistryHealthSummary
        ? runtimeLifecycle.getRicherModelRegistryHealthSummary()
        : Promise.resolve({
            available: false,
            owner: 'F-0014' as const,
            reason: 'future_owned',
          }),
    ]);

    return context.json({
      baselineProfiles: baselineProfiles.map((profile) => ({
        modelProfileId: profile.modelProfileId,
        role: profile.role,
        status: profile.status,
        adapterOf: profile.adapterOf,
        baseModel: profile.baseModel,
        healthSummary: profile.healthSummary,
      })),
      richerRegistryHealth,
    });
  });

  app.post('/control/tick', async (context) => {
    if (!runtimeLifecycle.requestTick) {
      return context.json({ error: 'tick_control_unavailable' }, 503);
    }

    let payload: unknown;
    try {
      payload = await context.req.json();
    } catch (error) {
      return context.json({ accepted: false, error: toValidationError(error) }, 400);
    }

    try {
      const parsed = operatorTickControlRequestSchema.parse(payload);
      const result = await runtimeLifecycle.requestTick({
        requestId: parsed.requestId,
        kind: parsed.kind,
        trigger: 'system',
        requestedAt: new Date().toISOString(),
        payload: {
          ...parsed.payload,
          operatorControl: {
            requestedBy: 'operator_api',
            route: '/control/tick',
            ...(parsed.note ? { note: parsed.note } : {}),
          },
        },
      });

      if (result.accepted) {
        return context.json(
          {
            accepted: true,
            requestId: parsed.requestId,
            requestedKind: parsed.kind,
            routedTrigger: 'system',
          },
          202,
        );
      }

      const status =
        result.reason === 'lease_busy'
          ? 409
          : result.reason === 'unsupported_tick_kind'
            ? 422
            : 503;

      return context.json(
        {
          accepted: false,
          requestId: parsed.requestId,
          requestedKind: parsed.kind,
          reason: result.reason,
        },
        status,
      );
    } catch (error) {
      return context.json({ accepted: false, error: toValidationError(error) }, 400);
    }
  });

  app.post('/control/freeze-development', async (context) => {
    if (!runtimeLifecycle.freezeDevelopment) {
      return context.json(
        {
          accepted: false,
          reason: 'persistence_unavailable',
        },
        503,
      );
    }

    let payload: unknown;
    try {
      payload = await context.req.json();
    } catch (error) {
      return context.json(
        { accepted: false, reason: 'invalid_request', error: toValidationError(error) },
        400,
      );
    }

    let parsed: OperatorFreezeDevelopmentRequest;
    try {
      parsed = operatorFreezeDevelopmentRequestSchema.parse(payload);
    } catch (error) {
      return context.json(
        { accepted: false, reason: 'invalid_request', error: toValidationError(error) },
        400,
      );
    }

    try {
      const result = await runtimeLifecycle.freezeDevelopment({
        requestId: parsed.requestId,
        reason: parsed.reason,
        evidenceRefs: parsed.evidenceRefs,
        requestedBy: 'operator_api',
        requestedAt: new Date().toISOString(),
      });

      if (result.accepted) {
        return context.json(result, 202);
      }

      const status =
        result.reason === 'conflicting_request_id'
          ? 409
          : result.reason === 'unsupported_reaction'
            ? 422
            : 503;
      return context.json(result, status);
    } catch (error) {
      return context.json(
        {
          accepted: false,
          requestId: parsed.requestId,
          reason: 'persistence_unavailable',
          error: toValidationError(error),
        },
        503,
      );
    }
  });

  app.post('/control/development-proposals', async (context) => {
    if (!runtimeLifecycle.submitDevelopmentProposal) {
      return context.json(
        {
          accepted: false,
          reason: 'persistence_unavailable',
        },
        503,
      );
    }

    let payload: unknown;
    try {
      payload = await context.req.json();
    } catch (error) {
      return context.json(
        { accepted: false, reason: 'invalid_request', error: toValidationError(error) },
        400,
      );
    }

    if (hasUnsupportedProposalKind(payload)) {
      return context.json(
        {
          accepted: false,
          reason: 'unsupported_proposal_kind',
        },
        422,
      );
    }

    let parsed: OperatorDevelopmentProposalRequest;
    try {
      parsed = operatorDevelopmentProposalRequestSchema.parse(payload);
    } catch (error) {
      return context.json(
        { accepted: false, reason: 'invalid_request', error: toValidationError(error) },
        400,
      );
    }

    try {
      const result = await runtimeLifecycle.submitDevelopmentProposal({
        requestId: parsed.requestId,
        proposalKind: parsed.proposalKind,
        problemSignature: parsed.problemSignature,
        summary: parsed.summary,
        evidenceRefs: parsed.evidenceRefs,
        rollbackPlanRef: parsed.rollbackPlanRef,
        targetRef: parsed.targetRef,
        requestedAt: new Date().toISOString(),
      });

      if (result.accepted) {
        return context.json(result, 202);
      }

      return context.json(result, proposalStatusForReason(result.reason));
    } catch (error) {
      return context.json(
        {
          accepted: false,
          requestId: parsed.requestId,
          reason: 'persistence_unavailable',
          error: toValidationError(error),
        },
        503,
      );
    }
  });
}
