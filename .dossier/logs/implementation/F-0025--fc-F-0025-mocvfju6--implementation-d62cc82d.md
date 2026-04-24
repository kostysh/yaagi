---
version: 1
stage: implementation
feature_id: F-0025
feature_cycle_id: fc-F-0025-mocvfju6
cycle_id: implementation-d62cc82d
backlog_item_key: CF-027
primary_feature_id: F-0025
primary_backlog_item_key: CF-027
phase_scope: implementation for CF-027 phase-6 policy governance closure
stage_state: ready_for_close
start_ts: 2026-04-24T13:19:56.070Z
entered_ts: 2026-04-24T13:19:56.070Z
ready_for_close_ts: 2026-04-24T15:11:44.974Z
transition_events:
  - kind: entered
    at: 2026-04-24T13:19:56.070Z
  - kind: resumed
    at: 2026-04-24T13:52:48.578Z
  - kind: ready_for_close
    at: 2026-04-24T13:55:11.804Z
  - kind: ready_for_close
    at: 2026-04-24T14:08:59.368Z
  - kind: ready_for_close
    at: 2026-04-24T14:20:13.353Z
  - kind: ready_for_close
    at: 2026-04-24T14:33:13.485Z
  - kind: ready_for_close
    at: 2026-04-24T14:49:41.276Z
  - kind: ready_for_close
    at: 2026-04-24T15:11:44.974Z
backlog_followup_required: false
backlog_followup_kind: null
backlog_followup_resolved: false
backlog_lifecycle_target: implemented
backlog_lifecycle_current: implemented
backlog_lifecycle_reconciled: true
backlog_actualization_artifacts: []
backlog_actualization_verdict: current_state_satisfies_target
review_artifacts:
  - .dossier/reviews/F-0025/implementation-spec-conformance-review.json
  - .dossier/reviews/F-0025/implementation-security-review.json
  - .dossier/reviews/F-0025/implementation-code-review.json
verification_artifacts:
  - .dossier/verification/F-0025/implementation-verify.json
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
    artifact_path: .dossier/reviews/F-0025/implementation-spec-conformance-review.json
    audit_class: spec-conformance-reviewer
    event_commit: 0be3f243bc3bace2b72ba004794d7e1c864d83d7
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 0
    recorded_at: 2026-04-24T13:58:44.581Z
    review_mode: external
    reviewer: codex
    reviewer_agent_id: codex-gpt-5-external-spec-reviewer
    reviewer_skill: spec-conformance-reviewer
    reviewer_thread_id: 019dbfc7-3226-7410-897a-992195b0627b
    security_trigger_reason: null
    stale: false
    verdict: FAIL
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0025/implementation-spec-conformance-review.json
    audit_class: spec-conformance-reviewer
    event_commit: 0be3f243bc3bace2b72ba004794d7e1c864d83d7
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 1
    recorded_at: 2026-04-24T13:59:04.636Z
    review_mode: external
    reviewer: codex
    reviewer_agent_id: codex-gpt-5-external-spec-reviewer
    reviewer_skill: spec-conformance-reviewer
    reviewer_thread_id: 019dbfc7-3226-7410-897a-992195b0627b
    security_trigger_reason: null
    stale: false
    verdict: FAIL
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0025/implementation-security-review.json
    audit_class: security-reviewer
    event_commit: 533d6b8fba9247fab6f12212991991f371dd8116
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 0
    recorded_at: 2026-04-24T14:12:25.914Z
    review_mode: external
    reviewer: external-security-review-agent
    reviewer_agent_id: null
    reviewer_skill: security-reviewer
    reviewer_thread_id: 019dbfd3-6a03-7341-b62c-74468af0248b
    security_trigger_reason: implementation scope is code-bearing and changes
      runtime policy/admission behavior
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0025/implementation-spec-conformance-review.json
    audit_class: spec-conformance-reviewer
    event_commit: 533d6b8fba9247fab6f12212991991f371dd8116
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 0
    recorded_at: 2026-04-24T14:12:26.157Z
    review_mode: external
    reviewer: external-spec-conformance-agent
    reviewer_agent_id: null
    reviewer_skill: spec-conformance-reviewer
    reviewer_thread_id: 019dbfd3-68ec-7d13-917f-93f82686a59e
    security_trigger_reason: null
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0025/implementation-code-review.json
    audit_class: code-reviewer
    event_commit: 533d6b8fba9247fab6f12212991991f371dd8116
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 1
    recorded_at: 2026-04-24T14:12:55.430Z
    review_mode: external
    reviewer: external-code-review-agent
    reviewer_agent_id: null
    reviewer_skill: code-reviewer
    reviewer_thread_id: 019dbfd3-694e-7dd3-960f-6f5f29cba428
    security_trigger_reason: null
    stale: false
    verdict: FAIL
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0025/implementation-spec-conformance-review.json
    audit_class: spec-conformance-reviewer
    event_commit: e7f7ca4714342d2f7345d3a98718c609bf49327d
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 0
    recorded_at: 2026-04-24T14:23:35.211Z
    review_mode: external
    reviewer: external-spec-conformance-agent
    reviewer_agent_id: null
    reviewer_skill: spec-conformance-reviewer
    reviewer_thread_id: 019dbfdd-be56-75d0-9ed1-57b9b67f9dda
    security_trigger_reason: null
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0025/implementation-security-review.json
    audit_class: security-reviewer
    event_commit: e7f7ca4714342d2f7345d3a98718c609bf49327d
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 0
    recorded_at: 2026-04-24T14:24:12.964Z
    review_mode: external
    reviewer: external-security-review-agent
    reviewer_agent_id: null
    reviewer_skill: security-reviewer
    reviewer_thread_id: 019dbfdd-bf67-7a63-a720-45f76fa95920
    security_trigger_reason: implementation scope is code-bearing and changes
      runtime policy/admission behavior
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0025/implementation-code-review.json
    audit_class: code-reviewer
    event_commit: e7f7ca4714342d2f7345d3a98718c609bf49327d
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 0
    recorded_at: 2026-04-24T14:30:23.813Z
    review_mode: external
    reviewer: external-code-review-agent
    reviewer_agent_id: null
    reviewer_skill: code-reviewer
    reviewer_thread_id: 019dbfdd-bebb-7152-8c70-98b66c628a35
    security_trigger_reason: null
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0025/implementation-spec-conformance-review.json
    audit_class: spec-conformance-reviewer
    event_commit: 828f37d59d62f433fe999ffb260c21baeaf29738
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 0
    recorded_at: 2026-04-24T14:37:14.464Z
    review_mode: external
    reviewer: external-spec-conformance-agent
    reviewer_agent_id: null
    reviewer_skill: spec-conformance-reviewer
    reviewer_thread_id: 019dbfe9-4f00-7ee2-84c3-e9e42222eac3
    security_trigger_reason: null
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0025/implementation-code-review.json
    audit_class: code-reviewer
    event_commit: 828f37d59d62f433fe999ffb260c21baeaf29738
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 1
    recorded_at: 2026-04-24T14:41:27.146Z
    review_mode: external
    reviewer: external-code-review-agent
    reviewer_agent_id: null
    reviewer_skill: code-reviewer
    reviewer_thread_id: 019dbfed-2bc8-72e2-8fbd-210f031727e9
    security_trigger_reason: null
    stale: false
    verdict: FAIL
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0025/implementation-spec-conformance-review.json
    audit_class: spec-conformance-reviewer
    event_commit: 9ccec40199a060763202bb64537af737bc936746
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 0
    recorded_at: 2026-04-24T14:52:23.424Z
    review_mode: external
    reviewer: external-spec-conformance-agent
    reviewer_agent_id: null
    reviewer_skill: spec-conformance-reviewer
    reviewer_thread_id: 019dbff8-2824-7b51-bc6b-97c0719e2642
    security_trigger_reason: null
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0025/implementation-code-review.json
    audit_class: code-reviewer
    event_commit: 9ccec40199a060763202bb64537af737bc936746
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 1
    recorded_at: 2026-04-24T14:55:55.575Z
    review_mode: external
    reviewer: external-code-review-agent
    reviewer_agent_id: null
    reviewer_skill: code-reviewer
    reviewer_thread_id: 019dbffa-be2a-75a3-98f7-1ce4c41f0669
    security_trigger_reason: null
    stale: false
    verdict: FAIL
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0025/implementation-spec-conformance-review.json
    audit_class: spec-conformance-reviewer
    event_commit: 2b9e8f821b5cbf551958d271deb59135186ef79f
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 0
    recorded_at: 2026-04-24T15:15:36.248Z
    review_mode: external
    reviewer: external-spec-conformance-agent
    reviewer_agent_id: codex-gpt5-spec-conformance-review-20260424
    reviewer_skill: spec-conformance-reviewer
    reviewer_thread_id: 019dc00c-d738-7262-9d89-f0319a39bdbd
    security_trigger_reason: null
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0025/implementation-code-review.json
    audit_class: code-reviewer
    event_commit: 2b9e8f821b5cbf551958d271deb59135186ef79f
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 0
    recorded_at: 2026-04-24T15:19:46.312Z
    review_mode: external
    reviewer: external-code-review-agent
    reviewer_agent_id: codex-external-code-review-agent-2026-04-24
    reviewer_skill: code-reviewer
    reviewer_thread_id: 019dc010-0ea2-73a0-8b66-be614c59bdca
    security_trigger_reason: null
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0025/implementation-security-review.json
    audit_class: security-reviewer
    event_commit: 2b9e8f821b5cbf551958d271deb59135186ef79f
    implementation_scope: code-bearing
    invalidated: false
    must_fix_count: 0
    recorded_at: 2026-04-24T15:24:03.649Z
    review_mode: external
    reviewer: external-security-review-agent
    reviewer_agent_id: codex-security-review-20260424
    reviewer_skill: security-reviewer
    reviewer_thread_id: 019dc013-c855-7cb2-9106-b26f1f1878d7
    security_trigger_reason: policy enforcement, external consultant admission
      gating, DB audit/governance path, fail-closed behavior
    stale: false
    verdict: PASS
reviewer_skills:
  - spec-conformance-reviewer
  - code-reviewer
  - security-reviewer
reviewer_agent_ids:
  - codex-gpt5-spec-conformance-review-20260424
  - codex-external-code-review-agent-2026-04-24
  - codex-security-review-20260424
review_trace_commits:
  - 2b9e8f821b5cbf551958d271deb59135186ef79f
degraded_review_present: false
invalidated_review_present: false
stale_review_present: false
skills_used:
  - unified-dossier-engineer
  - implementation-discipline
  - typescript-engineer
  - typescript-test-engineer
  - node-engineer
skill_issues: []
skill_followups: []
process_misses: []
session_id: 019dbf3f-4287-7722-9adb-c3ec2482111e
trace_runtime: codex
trace_locator_kind: session_id
final_delivery_commit: 2b9e8f821b5cbf551958d271deb59135186ef79f
final_closure_commit: 2b9e8f821b5cbf551958d271deb59135186ef79f
implementation_review_scope: code-bearing
stage_entry_commit: 1380bf76d88bddc269901e65db0eaa64f0c8b1e8
required_security_review: true
security_trigger_reasons:
  - policy enforcement, external consultant admission gating, DB
    audit/governance path, fail-closed behavior
local_gates_green_ts: 2026-04-24T15:11:44.974Z
step_artifact: .dossier/steps/F-0025/implementation-step-close.json
step_close_ts: 2026-04-24T15:25:01.883Z
process_complete_ts: 2026-04-24T15:25:01.883Z
intake_process_complete_ts: null
first_review_agent_started_ts: 2026-04-24T15:15:36.248Z
final_pass_ts: 2026-04-24T15:24:03.649Z
verification_trace_commit: 2b9e8f821b5cbf551958d271deb59135186ef79f
---

## Scope

- Реализован полный `F-0025 / CF-027` seam для phase-6 policy governance в существующем `apps/core` runtime.
- Добавлены owned decision-fact contracts, PostgreSQL migration/store и tests для `policy_profiles`, `policy_profile_activations`, `consultant_admission_decisions`, `perception_policy_decisions`, `phase6_governance_events`.
- Добавлен runtime `PolicyGovernanceService`: conservative baseline profile, activation evidence gates, consultant admission-before-invocation, perception-policy classification over canonical intake, bounded governance event read model.
- Runtime/perception integration оставлен внутри существующего deployment cell: без нового gateway, boot-critical consultant service, model-serving dependency или operator route family.

## Inputs actually used

- `docs/ssot/features/F-0025-policy-profiles-consultant-admission-phase-6-governance-closure.md`
- `docs/architecture/system.md`
- `README.md`
- `AGENTS.md`
- Delivered owner surfaces: `F-0005`, `F-0008`, `F-0016`, `F-0018`, `F-0023`, `F-0024`.
- Explorer outputs:
  - DB/migration/store pattern review: `019dbfa5-c218-7e20-a092-ecc660a526d4`
  - runtime/router/perception seam review: `019dbfa5-c250-7643-8086-9738cfb5a978`

## Decisions / reclassifications

### Spec gap decisions

- No repo-level ADR was needed: implementation did not add cross-feature write authority, a public gateway, a second perception intake layer, a new boot-critical service, or a router contract mutation.

### Implementation freedom decisions

- Policy activation remains an append-only decision fact. Exclusive active-scope behavior is enforced by the `F-0025` store/service resolution path and covered by tests rather than by writing neighbouring owner tables.
- `policyDecision` is exposed on `/ingest` only when policy governance actually returns a decision; existing HTTP response contracts do not receive `policyDecision: null`.
- External consultant execution is represented only through an admission-first internal service path. No public consultant route or configured external endpoint was introduced.
- `REPORT_SOURCE_OWNER.PHASE6_POLICY_GOVERNANCE` was added so `F-0023` can cite `F-0025` evidence while remaining the report-materialization owner.

### Temporary assumptions

- First shipped policy posture is conservative: external consultant execution disabled by default; future enabling requires explicit policy profile activation and admission evidence.

## Operator feedback

- User requested immediate canonical implementation after `plan-slice` completion and explicitly allowed subagent use in this session.

## Review events

- Первый внешний `spec-conformance-reviewer` review по `0be3f243bc3bace2b72ba004794d7e1c864d83d7` вернул FAIL: explicit consultant admission моделировал только наличие evidence ref и не различал `allow`/`deny`.
- Блокер закрыт commit `533d6b8fba9247fab6f12212991991f371dd8116`: runtime теперь требует `explicitAdmissionDecision`, записывает explicit `deny` как `consultant_admission_decisions.decision = deny` и не вызывает внешний consultant после такого решения.
- Повторный внешний `code-reviewer` review по `533d6b8fba9247fab6f12212991991f371dd8116` вернул FAIL: service игнорировал `recordConsultantAdmissionDecision().accepted === false`, из-за чего конфликтный replay request id мог использовать stale audit row.
- Блокер закрыт commit `e7f7ca4714342d2f7345d3a98718c609bf49327d`: conflict от consultant admission store теперь fail-closed через отказ до invocation, добавлена service-level regression на conflicting request id replay.
- Финальный внешний review bundle (`spec-conformance-reviewer`, `code-reviewer`, `security-reviewer`) должен быть записан по delivery commit `e7f7ca4714342d2f7345d3a98718c609bf49327d` перед step closure.

## Backlog follow-up

- Resolved backlog lifecycle actualization: `CF-027` moved from `planned` to `implemented` via `.dossier/backlog/patches/2026-04-24-049-f0025-implementation-closeout.patch.json`; canonical replay artifact: `.dossier/backlog/patches/e2ca0a405108--2026-04-24-049-f0025-implementation-closeout.patch.json`.

## Process misses

none

## Transition events

- 2026-04-24T13:19:56.070Z: entered
- 2026-04-24T13:52:48.578Z: resumed
- 2026-04-24T13:55:11.804Z: ready_for_close
- 2026-04-24T14:08:59.368Z: ready_for_close
- 2026-04-24T14:20:13.353Z: ready_for_close
- 2026-04-24T14:33:13.485Z: ready_for_close
- 2026-04-24T14:49:41.276Z: ready_for_close
- 2026-04-24T15:11:44.974Z: ready_for_close

## Close-out

- Local gates completed before ready-for-close:
  - `pnpm format`: PASS
  - `pnpm typecheck`: PASS
  - `pnpm lint`: PASS
  - focused admission regression: PASS (`policy-governance-service`)
  - `pnpm test`: PASS, 407/407
  - `pnpm smoke:cell`: PASS, 21/21
- Initial full `pnpm test` in the sandbox failed on localhost `listen EPERM`; rerun outside sandbox passed. This was an execution-permission issue, not an implementation regression.
