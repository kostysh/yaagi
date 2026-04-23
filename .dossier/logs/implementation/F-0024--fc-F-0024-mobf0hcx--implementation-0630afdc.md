---
version: 1
stage: implementation
feature_id: F-0024
feature_cycle_id: fc-F-0024-mobf0hcx
cycle_id: implementation-0630afdc
backlog_item_key: CF-024
stage_state: ready_for_close
start_ts: 2026-04-23T12:54:50.776Z
entered_ts: 2026-04-23T12:54:50.776Z
ready_for_close_ts: 2026-04-23T15:16:52.796Z
transition_events:
  - kind: entered
    at: 2026-04-23T12:54:50.776Z
  - kind: ready_for_close
    at: 2026-04-23T14:32:41.793Z
  - kind: ready_for_close
    at: 2026-04-23T14:45:08.223Z
  - kind: ready_for_close
    at: 2026-04-23T15:00:03.746Z
  - kind: ready_for_close
    at: 2026-04-23T15:16:52.796Z
backlog_followup_required: false
backlog_followup_kind: null
backlog_followup_resolved: true
required_audit_classes:
  - spec-conformance-reviewer
  - code-reviewer
  - security-reviewer
executed_audit_classes:
  - spec-conformance-reviewer
  - code-reviewer
  - security-reviewer
required_external_review_pending: false
review_events:
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0024/implementation-spec-conformance-review.json
    audit_class: spec-conformance-reviewer
    event_commit: f82a6242e324377dcc3bc42c7c1caf71cdb10217
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 0
    recorded_at: 2026-04-23T15:24:25.147Z
    review_mode: external
    reviewer: Goodall
    reviewer_agent_id: 019dbaeb-7ab8-7833-ab6a-b3cd2d91c13a
    reviewer_skill: spec-conformance-reviewer
    reviewer_thread_id: 019db9f2-76ae-7f00-90ba-dda2e633f4a5
    security_trigger_reason: null
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0024/implementation-code-review.json
    audit_class: code-reviewer
    event_commit: f82a6242e324377dcc3bc42c7c1caf71cdb10217
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 0
    recorded_at: 2026-04-23T15:24:33.282Z
    review_mode: external
    reviewer: Volta
    reviewer_agent_id: 019dbaeb-7b2f-7a90-9fa2-4c68a2b69490
    reviewer_skill: code-reviewer
    reviewer_thread_id: 019db9f2-76ae-7f00-90ba-dda2e633f4a5
    security_trigger_reason: null
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0024/implementation-security-review.json
    audit_class: security-reviewer
    event_commit: f82a6242e324377dcc3bc42c7c1caf71cdb10217
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 0
    recorded_at: 2026-04-23T15:24:42.233Z
    review_mode: external
    reviewer: Beauvoir
    reviewer_agent_id: 019dbaeb-7c0c-7aa1-8d68-e86df6938e76
    reviewer_skill: security-reviewer
    reviewer_thread_id: 019db9f2-76ae-7f00-90ba-dda2e633f4a5
    security_trigger_reason: authn/authz/rbac/rate-limit/trust-boundary changes in operator API
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0024/implementation-code-review.json
    audit_class: code-reviewer
    event_commit: f82a6242e324377dcc3bc42c7c1caf71cdb10217
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 0
    recorded_at: 2026-04-23T15:27:34.998Z
    review_mode: external
    reviewer: Volta
    reviewer_agent_id: 019dbaeb-7b2f-7a90-9fa2-4c68a2b69490
    reviewer_skill: code-reviewer
    reviewer_thread_id: 019dbaeb-7b2f-7a90-9fa2-4c68a2b69490
    security_trigger_reason: null
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0024/implementation-security-review.json
    audit_class: security-reviewer
    event_commit: f82a6242e324377dcc3bc42c7c1caf71cdb10217
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 0
    recorded_at: 2026-04-23T15:27:35.083Z
    review_mode: external
    reviewer: Beauvoir
    reviewer_agent_id: 019dbaeb-7c0c-7aa1-8d68-e86df6938e76
    reviewer_skill: security-reviewer
    reviewer_thread_id: 019dbaeb-7c0c-7aa1-8d68-e86df6938e76
    security_trigger_reason: authn/authz/rbac/rate-limit/trust-boundary changes in operator API
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0024/implementation-spec-conformance-review.json
    audit_class: spec-conformance-reviewer
    event_commit: f82a6242e324377dcc3bc42c7c1caf71cdb10217
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 0
    recorded_at: 2026-04-23T15:27:37.648Z
    review_mode: external
    reviewer: Goodall
    reviewer_agent_id: 019dbaeb-7ab8-7833-ab6a-b3cd2d91c13a
    reviewer_skill: spec-conformance-reviewer
    reviewer_thread_id: 019dbaeb-7ab8-7833-ab6a-b3cd2d91c13a
    security_trigger_reason: null
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0024/implementation-spec-conformance-review.json
    audit_class: spec-conformance-reviewer
    event_commit: e6a99d451ad176e6aed20dfe2723c9cd686ef1d0
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 0
    recorded_at: 2026-04-23T15:29:49.766Z
    review_mode: external
    reviewer: Goodall
    reviewer_agent_id: 019dbaeb-7ab8-7833-ab6a-b3cd2d91c13a
    reviewer_skill: spec-conformance-reviewer
    reviewer_thread_id: 019dbaeb-7ab8-7833-ab6a-b3cd2d91c13a
    security_trigger_reason: null
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0024/implementation-security-review.json
    audit_class: security-reviewer
    event_commit: e6a99d451ad176e6aed20dfe2723c9cd686ef1d0
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 0
    recorded_at: 2026-04-23T15:29:51.506Z
    review_mode: external
    reviewer: Beauvoir
    reviewer_agent_id: 019dbaeb-7c0c-7aa1-8d68-e86df6938e76
    reviewer_skill: security-reviewer
    reviewer_thread_id: 019dbaeb-7c0c-7aa1-8d68-e86df6938e76
    security_trigger_reason: authn/authz/rbac/rate-limit/trust-boundary changes in operator API
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0024/implementation-code-review.json
    audit_class: code-reviewer
    event_commit: e6a99d451ad176e6aed20dfe2723c9cd686ef1d0
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 0
    recorded_at: 2026-04-23T15:29:54.250Z
    review_mode: external
    reviewer: Volta
    reviewer_agent_id: 019dbaeb-7b2f-7a90-9fa2-4c68a2b69490
    reviewer_skill: code-reviewer
    reviewer_thread_id: 019dbaeb-7b2f-7a90-9fa2-4c68a2b69490
    security_trigger_reason: null
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0024/implementation-spec-conformance-review.json
    audit_class: spec-conformance-reviewer
    event_commit: e6a99d451ad176e6aed20dfe2723c9cd686ef1d0
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 0
    recorded_at: 2026-04-23T15:30:55.167Z
    review_mode: external
    reviewer: Goodall
    reviewer_agent_id: 019dbaeb-7ab8-7833-ab6a-b3cd2d91c13a
    reviewer_skill: spec-conformance-reviewer
    reviewer_thread_id: 019dbaeb-7ab8-7833-ab6a-b3cd2d91c13a
    security_trigger_reason: null
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0024/implementation-code-review.json
    audit_class: code-reviewer
    event_commit: e6a99d451ad176e6aed20dfe2723c9cd686ef1d0
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 0
    recorded_at: 2026-04-23T15:31:10.498Z
    review_mode: external
    reviewer: Volta
    reviewer_agent_id: 019dbaeb-7b2f-7a90-9fa2-4c68a2b69490
    reviewer_skill: code-reviewer
    reviewer_thread_id: 019dbaeb-7b2f-7a90-9fa2-4c68a2b69490
    security_trigger_reason: null
    stale: false
    verdict: PASS
  - artifact_path: .dossier/reviews/F-0024/implementation-security-review.json
    at: 2026-04-23T15:31:27.847Z
    audit_class: security-reviewer
    allowed_by_policy: true
    event_commit: e6a99d451ad176e6aed20dfe2723c9cd686ef1d0
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 0
    recorded_at: 2026-04-23T15:31:27.847Z
    review_mode: external
    reviewer: Beauvoir
    reviewer_agent_id: 019dbaeb-7c0c-7aa1-8d68-e86df6938e76
    reviewer_skill: security-reviewer
    reviewer_thread_id: 019dbaeb-7c0c-7aa1-8d68-e86df6938e76
    security_trigger_reason: authn/authz/rbac/rate-limit/trust-boundary changes in operator API
    stale: false
    verdict: PASS
reviewer_skills:
  - spec-conformance-reviewer
  - code-reviewer
  - security-reviewer
reviewer_agent_ids:
  - 019dbaeb-7ab8-7833-ab6a-b3cd2d91c13a
  - 019dbaeb-7b2f-7a90-9fa2-4c68a2b69490
  - 019dbaeb-7c0c-7aa1-8d68-e86df6938e76
review_trace_commits:
  - f82a6242e324377dcc3bc42c7c1caf71cdb10217
  - e6a99d451ad176e6aed20dfe2723c9cd686ef1d0
degraded_review_present: false
invalidated_review_present: false
stale_review_present: false
session_id: null
trace_runtime: codex
trace_locator_kind: session_id
implementation_review_scope: code-bearing
stage_entry_commit: f82a6242e324377dcc3bc42c7c1caf71cdb10217
required_security_review: true
security_trigger_reasons:
  - authn/authz/rbac/rate-limit/trust-boundary changes in operator API
local_gates_green_ts: 2026-04-23T15:16:52.796Z
step_close_ts: null
step_artifact: null
process_complete_ts: null
intake_process_complete_ts: null
first_review_agent_started_ts: 2026-04-23T15:24:25.147Z
final_pass_ts: 2026-04-23T15:31:27.847Z
---

## Scope

- Реализован полный `F-0024` caller-admission seam для существующей `F-0013` Hono operator route family без второго gateway или отдельного auth server.
- Добавлены shared `operator-auth` contracts: роли, route classes, risk classes, route classifier, permission matrix, principal-file schema, trusted-ingress evidence и audit-event schema.
- Добавлена static/mounted principal-file credential source с SHA-256 bearer-token hashes only, expiry/revocation semantics, duplicate principal/credential/token-hash validation и bounded refs.
- Добавлена PostgreSQL-owned audit surface `operator_auth_audit_events` через migration/store/runtime lifecycle wiring; allow/deny/unavailable decisions audit-ятся до protected handler/downstream invocation.
- Protected routes `/state`, `/timeline`, `/episodes`, `/models`, `/reports`, `/control/tick`, `/control/freeze-development`, `/control/development-proposals` требуют admission; `/health` и `/ingest` остались вне `F-0024` ownership.
- High-risk routes теперь требуют `governor_operator` admission и доступный `F-0016` owner gate; `F-0024` evidence передаётся как ingress proof, но не становится governor approval/perimeter verdict.
- Docker smoke path и тестовые fixtures обновлены на mounted principal file и auth headers for protected operator routes.

## Inputs actually used

- `docs/ssot/features/F-0024-authentication-authorization-operator-rbac.md`
- `docs/architecture/system.md`
- `docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md`
- `docs/ssot/features/F-0013-operator-http-api-and-introspection.md`
- `docs/ssot/features/F-0016-development-governor-and-change-management.md`
- `docs/ssot/features/F-0018-security-and-isolation-profile.md`
- `README.md`
- `apps/core/src/platform/operator-api.ts`
- `apps/core/src/platform/core-runtime.ts`
- `apps/core/src/platform/core-config.ts`
- `apps/core/src/runtime/runtime-lifecycle.ts`
- `apps/core/src/perimeter/service.ts`
- `packages/contracts/src/operator-auth.ts`
- `packages/db/src/operator-auth.ts`
- `infra/docker/deployment-cell.smoke.ts`

## Decisions / reclassifications

### Spec gap decisions

- `/reports` классифицирован как `read_introspection`, потому что `F-0023` уже доставил этот route внутри operator surface, а `F-0024` должен защищать всю delivered operator family.
- `admin` и `breakglass_admin` роли оставлены как explicit reserved capabilities без HTTP admin/bootstrap API в этом pass; это соответствует `PD-F0024-07`.
- `F-0018` принимает `operator-auth-evidence:*` только как caller-admission evidence для `F-0013` owner paths; durable perimeter/governor decisions не дублируются.

### Implementation freedom decisions

- Первый credential source реализован как versioned mounted/static principal file, а не DB-backed principal management API, чтобы не расширять scope за пределы approved first implementation.
- Auth service читает и валидирует principal file per request, чтобы expiry/revocation/config corrections вступали в силу без отдельного lifecycle owner.
- Rate limiting сделан replay-aware: missing, unsupported-version и unknown-credential attempts используют отдельные route-stable buckets; validated principal file кратко кэшируется, чтобы supported-token spray не парсил файл на каждый запрос и не потреблял quota валидных caller buckets; non-tick admitted route classes используют principal-scoped bucket; `tick_control` использует principal-scoped unique-`requestId` bucket, который ограничивает новые tick requests, но пропускает same-`requestId` replay в `F-0013`/`F-0003` idempotency owner path.
- Incoming request/session/evidence/audit refs нормализуются или хэшируются до bounded refs перед audit/store/evidence parsing.

### Temporary assumptions

- Principal-file distribution, token rotation и external edge/proxy volumetric limits остаются deployment/ops responsibility; checked-in examples intentionally contain shape only, not plaintext tokens.
- Prefix-only `F-0018` acceptance of `operator-auth-evidence:*` is sufficient for this owner-composition slice because only `F-0024` operator routes mint those refs; durable evidence lookup can be hardened later when more ingress paths exist.

## Operator feedback

none

## Review events

- Early security audit found a pre-auth rate-limit bypass: unique invalid bearer tokens could evade token-derived buckets. Fixed by using a route-stable pre-auth bucket for bad/unknown credentials and adding regression coverage.
- Code/spec audit found bounded-ref and duplicate-token-hash issues. Fixed by bounding request/session/evidence/audit refs before persistence and by failing closed on duplicate `tokenSha256` in principal files.
- Spec audit found `AC-F0024-13` replay risk: principal limiter could turn an already accepted tick `requestId` replay into `429` before owner idempotency. Fixed first by excluding `tick_control` from the coarse principal limiter, then hardened after security review into a principal-scoped unique-`requestId` limiter with admitted replay escape.
- Final non-forked security audit found two availability blockers: pre-auth limiter ran after principal-file parsing, and admitted `tick_control` unique requests were unbounded. Fixed by adding separate route-stable throttles for missing/unsupported/unknown credentials, caching validated principal-file parses briefly, bounding tick request fields/payload, adding a bounded body reader before replay-key extraction, and adding replay-aware unique tick limiting while preserving per-denial audit coverage.
- Subsequent non-forked security audit found two additional availability risks: route-global pre-auth quota could let invalid supported-token traffic block valid operators, and high-risk governor routes parsed unbounded JSON after admission. Fixed by removing valid supported-token requests from shared pre-auth buckets, preserving unknown-credential throttling separately, and reusing bounded JSON reads for freeze/proposal bodies.
- Final non-forked external audit bundle passed after the latest security hardening:
  - `spec-conformance-reviewer`: Goodall (`019dbaeb-7ab8-7833-ab6a-b3cd2d91c13a`) PASS.
  - `code-reviewer`: Volta (`019dbaeb-7b2f-7a90-9fa2-4c68a2b69490`) PASS.
  - `security-reviewer`: Beauvoir (`019dbaeb-7c0c-7aa1-8d68-e86df6938e76`) PASS.

## Backlog follow-up

- No backlog truth mutation required for implementation closure. Scope remained inside `CF-024` / `F-0024`; residual hardening risks are operational/deployment concerns, not new backlog blockers for this slice.

## Process misses

- Initial external audit execution used forked context; after re-reading audit policy, final blocking audits were rerun as non-forked external reviewer agents.
- First AC-F0024-13 regression attempt put the `rateLimitMaxRequests=1` env override on the wrong tick test. Code review caught the coverage miss; the override was moved to the replay test and targeted/full tests were rerun.

## Transition events

- 2026-04-23T12:54:50.776Z: entered
- 2026-04-23T14:32:41.793Z: ready_for_close
- 2026-04-23T14:45:08.223Z: ready_for_close
- 2026-04-23T15:00:03.746Z: ready_for_close
- 2026-04-23T15:16:52.796Z: ready_for_close

## Close-out

- Local gates after final code/test changes:
  - `pnpm format` passed.
  - `pnpm typecheck` passed.
  - `pnpm lint` passed.
  - Targeted auth/RBAC regression suite passed after final security hardening: 25/25.
  - Final `pnpm test` passed: 374/374.
  - Final `pnpm smoke:cell` passed: 21/21.
- Closure artifacts created:
  - implementation ready-for-close transition refreshed
  - external review artifacts persisted on exact commit `e6a99d4`
  - dossier verification artifact persisted at `.dossier/verification/F-0024/implementation.json`
  - dossier step-close artifact persisted at `.dossier/steps/F-0024/implementation-close.json`
