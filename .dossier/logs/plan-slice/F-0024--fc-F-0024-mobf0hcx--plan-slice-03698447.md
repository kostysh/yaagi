---
version: 1
stage: plan-slice
feature_id: F-0024
feature_cycle_id: fc-F-0024-mobf0hcx
cycle_id: plan-slice-03698447
backlog_item_key: CF-024
stage_state: ready_for_close
start_ts: 2026-04-23T12:43:24.026Z
entered_ts: 2026-04-23T12:43:24.026Z
ready_for_close_ts: 2026-04-23T12:49:06.884Z
transition_events:
  - kind: entered
    at: 2026-04-23T12:43:24.026Z
  - kind: resumed
    at: 2026-04-23T12:47:39.175Z
  - kind: ready_for_close
    at: 2026-04-23T12:49:06.884Z
backlog_followup_required: true
backlog_followup_kind: patch existing item
backlog_followup_resolved: true
required_audit_classes:
  - spec-conformance-reviewer
executed_audit_classes: []
required_external_review_pending: true
review_events: []
reviewer_skills: []
reviewer_agent_ids: []
review_trace_commits: []
degraded_review_present: false
invalidated_review_present: false
stale_review_present: false
session_id: null
trace_runtime: codex
trace_locator_kind: session_id
---

## Scope

- Этап `plan-slice` для `F-0024 / CF-024`.
- Цель планирования: подготовить implementation-ready handoff для fail-closed auth/authz/RBAC seam на существующей Hono operator route family.
- Код на этом этапе не менялся; менялись только dossier/backlog/process artifacts.
- Plan mode assessment: Plan mode не требуется, потому что `spec-compact` уже зафиксировал единственную owner boundary (`F-0024` wraps existing `F-0013` Hono routes), новый ADR не ожидается, а оставшаяся развилка находится внутри implementation sequencing и credential/audit strategy.

## Inputs actually used

- `AGENTS.md`: repo overlay, Plan mode gate для `plan-slice`, canonical runtime requirement, operator-language logs.
- `README.md`: canonical stack and root quality commands.
- `docs/architecture/system.md`: Hono/API boundary, identity-bearing write authority, high-risk route availability, `F-0016` / `F-0018` status.
- `docs/adr/ADR-2026-03-23-plan-mode-decision-gate.md`: pre-step Plan mode decision rule.
- `docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md`: `Node 22 + TypeScript + AI SDK + Hono + PostgreSQL` runtime substrate.
- `docs/notes/backlog-legacy/feature-candidates.md`: `CF-024` owner seam and route-permission warnings.
- `docs/notes/backlog-legacy/working-system-roadmap-matrix-2026-03-26.md`: `CF-024` roadmap positioning before safe operator exposure.
- `docs/ssot/features/F-0024-authentication-authorization-operator-rbac.md`: shaped spec and acceptance criteria.
- `docs/ssot/features/F-0013-operator-http-api-and-introspection.md`: operator route ownership and reserved high-risk routes.
- `docs/ssot/features/F-0016-development-governor-and-change-management.md`: governor owner gates for freeze/proposal semantics.
- `docs/ssot/features/F-0018-security-and-isolation-profile.md`: trusted-ingress/perimeter separation.
- `apps/core/src/platform/operator-api.ts`, `apps/core/src/platform/core-runtime.ts`, `apps/core/src/platform/core-config.ts`, `packages/contracts/src/operator-api.ts`: current implementation seams.
- Existing operator/platform/governor/perimeter tests under `apps/core/test/platform`, `apps/core/test/perimeter`, `apps/core/test/runtime`, `packages/contracts/test`, `packages/db/test`.

## Decisions / reclassifications

### Spec gap decisions

- `F-0016` добавлен в explicit traceability для `F-0024`, потому что high-risk route admission делает нормативные утверждения о governor owner gate.
- `/reports`, delivered through `F-0023`, классифицирован как protected read-only operator route for `F-0024`; это не backlog truth change, а route-classification decision для уже существующей operator-facing surface.
- Первый credential strategy выбран как static/mounted principal file plus PostgreSQL auth audit events. Это закрывает open question без добавления public admin/bootstrap API.
- Auth audit unavailable считается fail-closed condition: protected route cannot call downstream owner unless the auth decision is durably recorded.

### Implementation freedom decisions

- Implementation may choose exact file schema names and hash algorithm details, but raw credentials/tokens must never be persisted or emitted.
- Implementation may use route-level middleware wrappers rather than global Hono middleware if it preserves "before handler execution" semantics and keeps `GET /health` outside `F-0024`.
- Rate limiting may start as deterministic process-local fixed window keyed by caller/request dimensions, provided tests prove it does not break accepted tick `requestId` idempotency.
- Admin role remains reserved; no public admin credential-management route is required for this implementation pass.

### Temporary assumptions

- Existing `F-0016` owner functions are available enough to wire high-risk routes when caller admission succeeds; if a runtime lifecycle dependency is absent, the route must return bounded unavailable and produce auth audit evidence.
- Existing platform tests can be adjusted to provide auth fixtures for admitted cases and to expect fail-closed responses for missing auth config.
- Because route protection and config/startup behavior change, implementation closure must include `pnpm smoke:cell`.

## Operator feedback

- User explicitly instructed to proceed with `plan-slice`.

## Review events

none

## Backlog follow-up

- Required: yes.
- Kind: patch existing item.
- Reason: `CF-024` delivery state must move from `defined` to `planned` after implementation-ready slicing is materialized.
- Expected patch: `.dossier/backlog/patches/2026-04-23-044-f0024-plan-slice-actualization.patch.json`.
- Applied patch: `.dossier/backlog/patches/e9e6d6c87c0f--2026-04-23-044-f0024-plan-slice-actualization.patch.json`.
- Result: `CF-024` delivery state is `planned`.
- Dependent review TODOs created by runtime: `CF-014`, `CF-026`, `CF-027` because they depend on `CF-024`.

## Process misses

- none.

## Transition events

- 2026-04-23T12:43:24.026Z: entered
- 2026-04-23T12:47:39.175Z: resumed
- 2026-04-23T12:49:06.884Z: ready_for_close

## Close-out

- Pending until backlog patch, verification, external `spec-conformance-reviewer` audit and `dossier-step-close` complete.
