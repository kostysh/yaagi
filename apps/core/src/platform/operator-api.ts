import { createHash, randomUUID } from 'node:crypto';
import type { Context, Hono } from 'hono';
import { ZodError } from 'zod';
import {
  OPERATOR_GOVERNOR_CONTROL_BODY_MAX_BYTES,
  OPERATOR_TICK_BODY_MAX_BYTES,
  operatorDevelopmentProposalRequestSchema,
  operatorEpisodeCursorSchema,
  operatorEpisodesQuerySchema,
  operatorFreezeDevelopmentRequestSchema,
  operatorStateQuerySchema,
  operatorTickControlRequestSchema,
  operatorTimelineCursorSchema,
  operatorTimelineQuerySchema,
  type OperatorEpisodeCursor,
  type OperatorTickControlRequest,
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
  RecordOperatorAuthAuditEventInput,
  RecordOperatorAuthAuditEventResult,
  SubjectStateSnapshot,
  SubjectStateSnapshotInput,
} from '@yaagi/db';
import {
  OPERATOR_AUTH_DENIAL_REASON,
  OPERATOR_AUTH_UNAVAILABLE_REASON,
  OPERATOR_REF_MAX_LENGTH,
  classifyOperatorRoute,
  type OperatorRouteDescriptor,
  type OperatorTrustedIngressEvidence,
} from '@yaagi/contracts/operator-auth';
import type {
  BaselineModelProfileDiagnostic,
  ModelHealthSummary,
} from '../runtime/model-router.ts';
import type { ReportingBundle } from '../runtime/reporting.ts';
import type { OperatorAdmissionResult, OperatorAuthService } from '../security/operator-auth.ts';

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
  recordOperatorAuthAuditEvent?(
    input: RecordOperatorAuthAuditEventInput,
  ): Promise<RecordOperatorAuthAuditEventResult>;
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

const readBoundedJson = async (request: Request, maxBytes: number): Promise<unknown> => {
  const contentLength = request.headers.get('content-length');
  if (contentLength && Number.parseInt(contentLength, 10) > maxBytes) {
    throw new Error(`request body exceeds ${maxBytes} bytes`);
  }

  const body = request.body as ReadableStream<Uint8Array> | null;
  const reader = body?.getReader();
  if (!reader) {
    return JSON.parse(await request.text());
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      void reader.cancel().catch(() => undefined);
      throw new Error(`request body exceeds ${maxBytes} bytes`);
    }
    chunks.push(value);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
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

const requireOperatorRoute = (method: string, path: string): OperatorRouteDescriptor => {
  const route = classifyOperatorRoute(method, path);
  if (!route) {
    throw new Error(`operator route is not classified: ${method} ${path}`);
  }

  return route;
};

const OPERATOR_ROUTE = Object.freeze({
  STATE: requireOperatorRoute('GET', '/state'),
  TIMELINE: requireOperatorRoute('GET', '/timeline'),
  EPISODES: requireOperatorRoute('GET', '/episodes'),
  MODELS: requireOperatorRoute('GET', '/models'),
  REPORTS: requireOperatorRoute('GET', '/reports'),
  TICK: requireOperatorRoute('POST', '/control/tick'),
  FREEZE_DEVELOPMENT: requireOperatorRoute('POST', '/control/freeze-development'),
  DEVELOPMENT_PROPOSALS: requireOperatorRoute('POST', '/control/development-proposals'),
});

type OperatorAdmissionResponse =
  | { accepted: true; evidence: OperatorTrustedIngressEvidence }
  | { accepted: false; response: Response };

type OperatorAdmissionFailure = Exclude<OperatorAdmissionResult, { outcome: 'allow' }>;

type OperatorAuthErrorBody = {
  accepted: false;
  error:
    | 'operator_auth_required'
    | 'operator_forbidden'
    | 'operator_rate_limited'
    | 'operator_auth_unavailable';
  requestId: string;
};

const respondAuthError = (
  context: Context,
  status: 401 | 403 | 429 | 503,
  body: OperatorAuthErrorBody,
): Response => {
  switch (status) {
    case 401:
      return context.json(body, 401);
    case 403:
      return context.json(body, 403);
    case 429:
      return context.json(body, 429);
    case 503:
      return context.json(body, 503);
  }
};

const boundedRequestId = (requestId: string): string => {
  const trimmed = requestId.trim();
  if (trimmed.length > 0 && trimmed.length <= OPERATOR_REF_MAX_LENGTH) {
    return trimmed;
  }

  const source = trimmed || randomUUID();
  return `operator-request:${createHash('sha256').update(source).digest('hex').slice(0, 48)}`;
};

const admissionRequestId = (context: Context): string =>
  boundedRequestId(context.req.header('x-request-id') ?? '');

const admissionFailureResponse = (
  context: Context,
  decision: OperatorAdmissionFailure,
): Response => {
  if (decision.outcome === 'unavailable') {
    return respondAuthError(context, 503, {
      accepted: false,
      error: 'operator_auth_unavailable',
      requestId: decision.requestId,
    });
  }

  if (decision.reason === OPERATOR_AUTH_DENIAL_REASON.FORBIDDEN) {
    return respondAuthError(context, 403, {
      accepted: false,
      error: 'operator_forbidden',
      requestId: decision.requestId,
    });
  }

  if (decision.reason === OPERATOR_AUTH_DENIAL_REASON.RATE_LIMITED) {
    return respondAuthError(context, 429, {
      accepted: false,
      error: 'operator_rate_limited',
      requestId: decision.requestId,
    });
  }

  return respondAuthError(context, 401, {
    accepted: false,
    error: 'operator_auth_required',
    requestId: decision.requestId,
  });
};

const requireAdmission = async (
  context: Context,
  operatorAuth: OperatorAuthService | null,
  route: OperatorRouteDescriptor,
  rateLimitReplayKey?: string | null,
): Promise<OperatorAdmissionResponse> => {
  const requestId = admissionRequestId(context);
  if (!operatorAuth) {
    return {
      accepted: false,
      response: respondAuthError(context, 503, {
        accepted: false,
        error: 'operator_auth_unavailable',
        requestId,
      }),
    };
  }

  const admissionInput = {
    request: context.req.raw,
    route,
    requestId,
    requestedAt: new Date().toISOString(),
    ...(rateLimitReplayKey !== undefined ? { rateLimitReplayKey } : {}),
  };
  const decision = await operatorAuth.admit(admissionInput);

  if (decision.outcome === 'allow') {
    return { accepted: true, evidence: decision.evidence };
  }

  return {
    accepted: false,
    response: admissionFailureResponse(context, decision),
  };
};

type OperatorUnavailableControlAction = 'freeze-development' | 'development-proposals';

type OperatorUnavailableControlResponse = {
  available: false;
  action: OperatorUnavailableControlAction;
  owner: 'F-0016';
  reason: 'downstream_owner_unavailable';
};

const unavailableControlResponse = (
  action: OperatorUnavailableControlAction,
): OperatorUnavailableControlResponse => ({
  available: false,
  action,
  owner: 'F-0016',
  reason: OPERATOR_AUTH_UNAVAILABLE_REASON.DOWNSTREAM_OWNER_UNAVAILABLE,
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
  options: { operatorAuth?: OperatorAuthService | null } = {},
): void {
  const operatorAuth = options.operatorAuth ?? null;
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
    const admission = await requireAdmission(context, operatorAuth, OPERATOR_ROUTE.STATE);
    if (!admission.accepted) {
      return admission.response;
    }

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
    const admission = await requireAdmission(context, operatorAuth, OPERATOR_ROUTE.TIMELINE);
    if (!admission.accepted) {
      return admission.response;
    }

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
    const admission = await requireAdmission(context, operatorAuth, OPERATOR_ROUTE.EPISODES);
    if (!admission.accepted) {
      return admission.response;
    }

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
    const admission = await requireAdmission(context, operatorAuth, OPERATOR_ROUTE.MODELS);
    if (!admission.accepted) {
      return admission.response;
    }

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
    const admission = await requireAdmission(context, operatorAuth, OPERATOR_ROUTE.REPORTS);
    if (!admission.accepted) {
      return admission.response;
    }

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
    let parsed: OperatorTickControlRequest | null = null;
    let payloadError: unknown = null;
    try {
      parsed = operatorTickControlRequestSchema.parse(
        await readBoundedJson(context.req.raw.clone(), OPERATOR_TICK_BODY_MAX_BYTES),
      );
    } catch (error) {
      payloadError = error;
    }

    const admission = await requireAdmission(
      context,
      operatorAuth,
      OPERATOR_ROUTE.TICK,
      parsed?.requestId,
    );
    if (!admission.accepted) {
      return admission.response;
    }

    if (!runtimeLifecycle.requestTick) {
      return context.json({ error: 'tick_control_unavailable' }, 503);
    }

    if (!parsed) {
      return context.json({ accepted: false, error: toValidationError(payloadError) }, 400);
    }

    try {
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
            principalRef: admission.evidence.principalRef,
            sessionRef: admission.evidence.sessionRef,
            admissionEvidenceRef: admission.evidence.evidenceRef,
            riskClass: admission.evidence.riskClass,
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

  app.post('/control/freeze-development', async (context) => {
    const admission = await requireAdmission(
      context,
      operatorAuth,
      OPERATOR_ROUTE.FREEZE_DEVELOPMENT,
    );
    if (!admission.accepted) {
      return admission.response;
    }

    if (!runtimeLifecycle.freezeDevelopment) {
      return context.json(unavailableControlResponse('freeze-development'), 503);
    }

    let payload: unknown;
    try {
      payload = await readBoundedJson(
        context.req.raw.clone(),
        OPERATOR_GOVERNOR_CONTROL_BODY_MAX_BYTES,
      );
    } catch (error) {
      return context.json({ accepted: false, error: toValidationError(error) }, 400);
    }

    try {
      const parsed = operatorFreezeDevelopmentRequestSchema.parse(payload);
      const result = await runtimeLifecycle.freezeDevelopment({
        requestId: parsed.requestId,
        reason: parsed.reason,
        evidenceRefs: [...parsed.evidenceRefs, admission.evidence.evidenceRef],
        requestedBy: 'operator_api',
        requestedAt: new Date().toISOString(),
      });

      if (result.accepted) {
        return context.json(result, 202);
      }

      const status =
        result.reason === 'conflicting_request_id'
          ? 409
          : result.reason === 'persistence_unavailable'
            ? 503
            : 400;
      return context.json(result, status);
    } catch (error) {
      return context.json({ accepted: false, error: toValidationError(error) }, 400);
    }
  });

  app.post('/control/development-proposals', async (context) => {
    const admission = await requireAdmission(
      context,
      operatorAuth,
      OPERATOR_ROUTE.DEVELOPMENT_PROPOSALS,
    );
    if (!admission.accepted) {
      return admission.response;
    }

    if (!runtimeLifecycle.submitDevelopmentProposal) {
      return context.json(unavailableControlResponse('development-proposals'), 503);
    }

    let payload: unknown;
    try {
      payload = await readBoundedJson(
        context.req.raw.clone(),
        OPERATOR_GOVERNOR_CONTROL_BODY_MAX_BYTES,
      );
    } catch (error) {
      return context.json({ accepted: false, error: toValidationError(error) }, 400);
    }

    try {
      const parsed = operatorDevelopmentProposalRequestSchema.parse(payload);
      const result = await runtimeLifecycle.submitDevelopmentProposal({
        requestId: parsed.requestId,
        proposalKind: parsed.proposalKind,
        problemSignature: parsed.problemSignature,
        summary: parsed.summary,
        evidenceRefs: [...parsed.evidenceRefs, admission.evidence.evidenceRef],
        rollbackPlanRef: parsed.rollbackPlanRef,
        targetRef: parsed.targetRef,
        requestedAt: new Date().toISOString(),
      });

      if (result.accepted) {
        return context.json(result, 202);
      }

      const status =
        result.reason === 'conflicting_request_id' || result.reason === 'development_frozen'
          ? 409
          : result.reason === 'unsupported_proposal_kind'
            ? 422
            : result.reason === 'persistence_unavailable'
              ? 503
              : result.reason === 'insufficient_evidence'
                ? 403
                : 400;
      return context.json(result, status);
    } catch (error) {
      return context.json({ accepted: false, error: toValidationError(error) }, 400);
    }
  });
}
