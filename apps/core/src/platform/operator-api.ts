import type { Hono } from 'hono';
import { ZodError } from 'zod';
import {
  operatorEpisodeCursorSchema,
  operatorEpisodesQuerySchema,
  operatorStateQuerySchema,
  operatorTickControlRequestSchema,
  operatorTimelineCursorSchema,
  operatorTimelineQuerySchema,
  type OperatorEpisodeCursor,
  type OperatorTimelineCursor,
} from '@yaagi/contracts/operator-api';
import type { DevelopmentFreezeResult, DevelopmentProposalResult } from '@yaagi/contracts/governor';
import type {
  OperatorRicherRegistryHealthSummary,
  ServingDependencyState,
} from '@yaagi/contracts/models';
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
import type { ReportingBundle } from '../runtime/reporting.ts';

const PUBLIC_FAST_MODEL_ALIAS = 'model-fast';

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
  getServingDependencyStates?(): Promise<ServingDependencyState[]>;
  peekServingDependencyStates?(): ServingDependencyState[];
  getReportingBundle?(): Promise<ReportingBundle>;
  requestTick?(input: {
    requestId: string;
    kind: 'reactive' | 'deliberative' | 'contemplative' | 'consolidation' | 'developmental';
    trigger: 'system';
    requestedAt: string;
    payload: Record<string, unknown>;
  }): Promise<{
    accepted: boolean;
    reason?:
      | 'boot_inactive'
      | 'lease_busy'
      | 'unsupported_tick_kind'
      | 'shutdown_admission_closed'
      | 'promoted_dependency_unavailable';
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

const redactBaselineProfileDiagnostic = (
  profile: BaselineModelProfileDiagnostic,
): BaselineModelProfileDiagnostic => ({
  ...profile,
  endpoint: '',
  artifactUri: null,
  baseModel: PUBLIC_FAST_MODEL_ALIAS,
  artifactDescriptorPath: null,
  runtimeArtifactRoot: null,
  healthSummary: {
    healthy: profile.healthSummary.healthy,
    detail: profile.healthSummary.healthy
      ? 'model-fast dependency is reachable'
      : 'model-fast dependency is unavailable',
  },
});

const redactServingDependencyState = (state: ServingDependencyState): ServingDependencyState => ({
  ...state,
  endpoint: '',
  artifactUri: null,
  artifactDescriptorPath: '',
  runtimeArtifactRoot: '',
  candidateId: null,
  baseModel: null,
  servedModelName: null,
  detail: null,
});

type OperatorUnavailableControlAction = 'freeze-development' | 'development-proposals';

type OperatorUnavailableControlResponse = {
  available: false;
  action: OperatorUnavailableControlAction;
  owner: 'CF-024';
  reason: 'caller_admission_required';
};

const unavailableControlResponse = (
  action: OperatorUnavailableControlAction,
): OperatorUnavailableControlResponse => ({
  available: false,
  action,
  owner: 'CF-024',
  reason: 'caller_admission_required',
});

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
    runtimeLifecycle.getReportingBundle !== undefined ||
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

    const [baselineProfiles, richerRegistryHealth, servingDependencies] = await Promise.all([
      runtimeLifecycle.getModelRoutingDiagnostics(),
      runtimeLifecycle.getRicherModelRegistryHealthSummary
        ? runtimeLifecycle.getRicherModelRegistryHealthSummary()
        : Promise.resolve({
            available: false,
            owner: 'F-0014' as const,
            reason: 'future_owned',
          }),
      runtimeLifecycle.getServingDependencyStates
        ? runtimeLifecycle.getServingDependencyStates()
        : runtimeLifecycle.peekServingDependencyStates
          ? Promise.resolve(runtimeLifecycle.peekServingDependencyStates())
          : Promise.resolve([]),
    ]);

    return context.json({
      baselineProfiles: baselineProfiles.map((profile) => {
        const redacted = redactBaselineProfileDiagnostic(profile);
        return {
          modelProfileId: redacted.modelProfileId,
          role: redacted.role,
          serviceId: redacted.serviceId,
          status: redacted.status,
          adapterOf: redacted.adapterOf,
          artifactUri: redacted.artifactUri,
          baseModel: redacted.baseModel,
          artifactDescriptorPath: redacted.artifactDescriptorPath,
          runtimeArtifactRoot: redacted.runtimeArtifactRoot,
          bootCritical: redacted.bootCritical,
          optionalUntilPromoted: redacted.optionalUntilPromoted,
          readiness: redacted.readiness,
          readinessBasis: redacted.readinessBasis,
          healthSummary: redacted.healthSummary,
        };
      }),
      richerRegistryHealth,
      servingDependencies: servingDependencies.map(redactServingDependencyState),
    });
  });

  app.get('/reports', async (context) => {
    if (!runtimeLifecycle.getReportingBundle) {
      return context.json({ error: 'reports_unavailable' }, 503);
    }

    try {
      const bundle = await runtimeLifecycle.getReportingBundle();
      return context.json(bundle);
    } catch (error) {
      return context.json({ error: toValidationError(error) }, 500);
    }
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
            : result.reason === 'promoted_dependency_unavailable'
              ? 503
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

  app.post('/control/freeze-development', (context) => {
    return context.json(unavailableControlResponse('freeze-development'), 501);
  });

  app.post('/control/development-proposals', (context) => {
    return context.json(unavailableControlResponse('development-proposals'), 501);
  });
}
