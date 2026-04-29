---
version: 1
stage: implementation
feature_id: F-0027
feature_cycle_id: fc-F-0027-moiesegc
cycle_id: implementation-16991364
backlog_item_key: CF-019
primary_feature_id: F-0027
primary_backlog_item_key: CF-019
phase_scope: implementation для CF-019 specialist organ rollout and retirement policy
stage_state: ready_for_close
start_ts: 2026-04-28T11:04:21.575Z
entered_ts: 2026-04-28T11:04:21.575Z
ready_for_close_ts: 2026-04-28T13:44:12.307Z
transition_events:
  - kind: entered
    at: 2026-04-28T11:04:21.575Z
  - kind: resumed
    at: 2026-04-28T11:33:45.291Z
  - kind: ready_for_close
    at: 2026-04-28T11:34:05.827Z
  - kind: ready_for_close
    at: 2026-04-28T11:36:24.437Z
  - kind: ready_for_close
    at: 2026-04-28T12:02:14.220Z
  - kind: ready_for_close
    at: 2026-04-28T12:20:55.921Z
  - kind: ready_for_close
    at: 2026-04-28T13:03:11.959Z
  - kind: ready_for_close
    at: 2026-04-28T13:28:17.399Z
  - kind: ready_for_close
    at: 2026-04-28T13:44:12.307Z
backlog_followup_required: false
backlog_followup_kind: null
backlog_followup_resolved: false
backlog_lifecycle_target: implemented
backlog_lifecycle_current: implemented
backlog_lifecycle_reconciled: true
backlog_actualization_artifacts:
  - .dossier/backlog/patches/e1adf0b55e5f--f0027-implementation-actualization.patch.json
backlog_actualization_verdict: actualized_by_backlog_artifact
review_artifacts:
  - .dossier/reviews/F-0027/implementation--spec-conformance-reviewer--r01--pass--f1e87bafa76f.json
  - .dossier/reviews/F-0027/implementation--code-reviewer--r01--pass--f1e87bafa76f.json
  - .dossier/reviews/F-0027/implementation--security-reviewer--r01--pass--f1e87bafa76f.json
  - .dossier/reviews/F-0027/implementation--code-reviewer--r02--pass--f1e87bafa76f.json
  - .dossier/reviews/F-0027/implementation--spec-conformance-reviewer--r02--pass--f1e87bafa76f.json
  - .dossier/reviews/F-0027/implementation--security-reviewer--r02--pass--f1e87bafa76f.json
  - .dossier/reviews/F-0027/implementation--spec-conformance-reviewer--r03--pass--f1e87bafa76f.json
  - .dossier/reviews/F-0027/implementation--code-reviewer--r03--pass--f1e87bafa76f.json
  - .dossier/reviews/F-0027/implementation--security-reviewer--r03--pass--f1e87bafa76f.json
verification_artifacts:
  - .dossier/verification/F-0027/implementation-f1e87bafa76f.json
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
    artifact_path: .dossier/reviews/F-0027/implementation--spec-conformance-reviewer--r01--pass--f1e87bafa76f.json
    audit_class: spec-conformance-reviewer
    evidence_count: null
    event_commit: f1e87bafa76fc561a437e3bc46fedf3ab2b7b6ff
    implementation_scope: code-bearing
    invalidated: false
    latest_copy_path: .dossier/reviews/F-0027/implementation--spec-conformance-reviewer--latest.json
    must_fix_count: 0
    recorded_at: 2026-04-28T13:52:32.278Z
    review_mode: external
    review_attempt_id: implementation--spec-conformance-reviewer--r01
    review_round_id: r01
    review_round_number: 1
    reviewer: Arendt
    reviewer_agent_id: 019dd455-df82-7ce2-8f3d-365c84114d39
    reviewer_skill: spec-conformance-reviewer
    reviewer_thread_id: 019dd354-e429-7961-a9f5-a93d47eaaf96
    security_trigger_reason: null
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0027/implementation--code-reviewer--r01--pass--f1e87bafa76f.json
    audit_class: code-reviewer
    evidence_count: null
    event_commit: f1e87bafa76fc561a437e3bc46fedf3ab2b7b6ff
    implementation_scope: code-bearing
    invalidated: false
    latest_copy_path: .dossier/reviews/F-0027/implementation--code-reviewer--latest.json
    must_fix_count: 0
    recorded_at: 2026-04-28T13:52:41.345Z
    review_mode: external
    review_attempt_id: implementation--code-reviewer--r01
    review_round_id: r01
    review_round_number: 1
    reviewer: Godel
    reviewer_agent_id: 019dd455-e1f3-7062-beb4-6e12a11d2070
    reviewer_skill: code-reviewer
    reviewer_thread_id: 019dd354-e429-7961-a9f5-a93d47eaaf96
    security_trigger_reason: null
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0027/implementation--security-reviewer--r01--pass--f1e87bafa76f.json
    audit_class: security-reviewer
    evidence_count: null
    event_commit: f1e87bafa76fc561a437e3bc46fedf3ab2b7b6ff
    implementation_scope: code-bearing
    invalidated: false
    latest_copy_path: .dossier/reviews/F-0027/implementation--security-reviewer--latest.json
    must_fix_count: 0
    recorded_at: 2026-04-28T13:52:59.730Z
    review_mode: external
    review_attempt_id: implementation--security-reviewer--r01
    review_round_id: r01
    review_round_number: 1
    reviewer: Pauli
    reviewer_agent_id: 019dd455-e4f9-7620-bc4b-180000c801a5
    reviewer_skill: security-reviewer
    reviewer_thread_id: 019dd354-e429-7961-a9f5-a93d47eaaf96
    security_trigger_reason: runtime specialist admission and retirement gate live
      model use from caller-controlled policy/evidence refs and protected
      rollback/release evidence
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0027/implementation--code-reviewer--r02--pass--f1e87bafa76f.json
    audit_class: code-reviewer
    evidence_count: null
    event_commit: f1e87bafa76fc561a437e3bc46fedf3ab2b7b6ff
    implementation_scope: code-bearing
    invalidated: false
    latest_copy_path: .dossier/reviews/F-0027/implementation--code-reviewer--latest.json
    must_fix_count: 0
    recorded_at: 2026-04-28T13:55:32.678Z
    review_mode: external
    review_attempt_id: implementation--code-reviewer--r02
    review_round_id: r02
    review_round_number: 2
    reviewer: Godel
    reviewer_agent_id: 019dd455-e1f3-7062-beb4-6e12a11d2070
    reviewer_skill: code-reviewer
    reviewer_thread_id: 019dd455-e1f3-7062-beb4-6e12a11d2070
    security_trigger_reason: null
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0027/implementation--spec-conformance-reviewer--r02--pass--f1e87bafa76f.json
    audit_class: spec-conformance-reviewer
    evidence_count: null
    event_commit: f1e87bafa76fc561a437e3bc46fedf3ab2b7b6ff
    implementation_scope: code-bearing
    invalidated: false
    latest_copy_path: .dossier/reviews/F-0027/implementation--spec-conformance-reviewer--latest.json
    must_fix_count: 0
    recorded_at: 2026-04-28T13:55:57.272Z
    review_mode: external
    review_attempt_id: implementation--spec-conformance-reviewer--r02
    review_round_id: r02
    review_round_number: 2
    reviewer: Arendt
    reviewer_agent_id: 019dd455-df82-7ce2-8f3d-365c84114d39
    reviewer_skill: spec-conformance-reviewer
    reviewer_thread_id: 019dd455-df82-7ce2-8f3d-365c84114d39
    security_trigger_reason: null
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0027/implementation--security-reviewer--r02--pass--f1e87bafa76f.json
    audit_class: security-reviewer
    evidence_count: null
    event_commit: f1e87bafa76fc561a437e3bc46fedf3ab2b7b6ff
    implementation_scope: code-bearing
    invalidated: false
    latest_copy_path: .dossier/reviews/F-0027/implementation--security-reviewer--latest.json
    must_fix_count: 0
    recorded_at: 2026-04-28T13:56:00.803Z
    review_mode: external
    review_attempt_id: implementation--security-reviewer--r02
    review_round_id: r02
    review_round_number: 2
    reviewer: Pauli
    reviewer_agent_id: 019dd455-e4f9-7620-bc4b-180000c801a5
    reviewer_skill: security-reviewer
    reviewer_thread_id: 019dd455-e4f9-7620-bc4b-180000c801a5
    security_trigger_reason: runtime specialist admission and retirement gate live
      model use from caller-controlled policy/evidence refs and protected
      rollback/release evidence
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0027/implementation--spec-conformance-reviewer--r03--pass--f1e87bafa76f.json
    audit_class: spec-conformance-reviewer
    evidence_count: null
    event_commit: f1e87bafa76fc561a437e3bc46fedf3ab2b7b6ff
    implementation_scope: code-bearing
    invalidated: false
    latest_copy_path: .dossier/reviews/F-0027/implementation--spec-conformance-reviewer--latest.json
    must_fix_count: 0
    recorded_at: 2026-04-28T13:57:56.333Z
    review_mode: external
    review_attempt_id: implementation--spec-conformance-reviewer--r03
    review_round_id: r03
    review_round_number: 3
    reviewer: Arendt
    reviewer_agent_id: 019dd455-df82-7ce2-8f3d-365c84114d39
    reviewer_skill: spec-conformance-reviewer
    reviewer_thread_id: 019dd455-df82-7ce2-8f3d-365c84114d39
    security_trigger_reason: null
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0027/implementation--code-reviewer--r03--pass--f1e87bafa76f.json
    audit_class: code-reviewer
    evidence_count: null
    event_commit: f1e87bafa76fc561a437e3bc46fedf3ab2b7b6ff
    implementation_scope: code-bearing
    invalidated: false
    latest_copy_path: .dossier/reviews/F-0027/implementation--code-reviewer--latest.json
    must_fix_count: 0
    recorded_at: 2026-04-28T13:58:35.630Z
    review_mode: external
    review_attempt_id: implementation--code-reviewer--r03
    review_round_id: r03
    review_round_number: 3
    reviewer: Godel
    reviewer_agent_id: 019dd455-e1f3-7062-beb4-6e12a11d2070
    reviewer_skill: code-reviewer
    reviewer_thread_id: 019dd455-e1f3-7062-beb4-6e12a11d2070
    security_trigger_reason: null
    stale: false
    verdict: PASS
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0027/implementation--security-reviewer--r03--pass--f1e87bafa76f.json
    audit_class: security-reviewer
    evidence_count: null
    event_commit: f1e87bafa76fc561a437e3bc46fedf3ab2b7b6ff
    implementation_scope: code-bearing
    invalidated: false
    latest_copy_path: .dossier/reviews/F-0027/implementation--security-reviewer--latest.json
    must_fix_count: 0
    recorded_at: 2026-04-28T13:59:10.747Z
    review_mode: external
    review_attempt_id: implementation--security-reviewer--r03
    review_round_id: r03
    review_round_number: 3
    reviewer: Pauli
    reviewer_agent_id: 019dd455-e4f9-7620-bc4b-180000c801a5
    reviewer_skill: security-reviewer
    reviewer_thread_id: 019dd455-e4f9-7620-bc4b-180000c801a5
    security_trigger_reason: runtime specialist admission and retirement gate live
      model use from caller-controlled policy/evidence refs and protected
      rollback/release evidence
    stale: false
    verdict: PASS
reviewer_skills:
  - spec-conformance-reviewer
  - code-reviewer
  - security-reviewer
reviewer_agent_ids:
  - 019dd455-df82-7ce2-8f3d-365c84114d39
  - 019dd455-e1f3-7062-beb4-6e12a11d2070
  - 019dd455-e4f9-7620-bc4b-180000c801a5
review_trace_commits:
  - f1e87bafa76fc561a437e3bc46fedf3ab2b7b6ff
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
session_id: ce9c2d32-4895-434d-b355-9a23d42174e2
trace_runtime: codex
trace_locator_kind: session_id
final_delivery_commit: f1e87bafa76fc561a437e3bc46fedf3ab2b7b6ff
final_closure_commit: f1e87bafa76fc561a437e3bc46fedf3ab2b7b6ff
implementation_review_scope: code-bearing
stage_entry_commit: 97a2358b907059adc89472147fbe3005c42b7fe7
required_security_review: true
security_trigger_reasons:
  - runtime specialist admission and retirement gate live model use from
    caller-controlled policy/evidence refs and protected rollback/release
    evidence
pre_review_risk_families:
  - policy-admission-governance
pre_review_checklists:
  - risk_family: policy-admission-governance
    id: explicit-allow-deny
    status: pass
    summary: Admission service returns explicit allow or structured refusal for
      every specialist request.
    evidence: apps/core/src/runtime/specialist-policy.ts
    test_refs:
      - apps/core/test/runtime/specialist-policy-service.contract.test.ts
      - apps/core/test/models/specialist-admission.integration.test.ts
  - risk_family: policy-admission-governance
    id: deny-or-failed-admission-no-invocation
    status: pass
    summary: Specialist execution helper persists admission before invocation and
      does not call the callback on denial.
    evidence: apps/core/src/runtime/specialist-policy.ts
    test_refs:
      - apps/core/test/models/specialist-admission.integration.test.ts
      - apps/core/test/models/specialist-no-remap.contract.test.ts
  - risk_family: policy-admission-governance
    id: conflicting-request-replay-fail-closed
    status: pass
    summary: Store replays equivalent request ids and rejects conflicting request
      hash reuse.
    evidence: packages/db/src/specialists.ts
    test_refs:
      - packages/db/test/specialists/specialist-policy-store.integration.test.ts
  - risk_family: policy-admission-governance
    id: ambiguous-stale-unsupported-evidence
    status: pass
    summary: Missing, stale, denied, unhealthy or unsupported upstream evidence
      fails closed with a recorded refusal reason.
    evidence: apps/core/src/runtime/specialist-policy.ts
    test_refs:
      - apps/core/test/models/specialist-missing-evidence.contract.test.ts
      - apps/core/test/models/specialist-upstream-evidence.integration.test.ts
  - risk_family: policy-admission-governance
    id: freshness-timestamp-required
    status: pass
    summary: Governor, serving, release, health and fallback evidence are checked
      against decision-time freshness windows.
    evidence: apps/core/src/runtime/specialist-policy.ts
    test_refs:
      - apps/core/test/runtime/specialist-policy-service.contract.test.ts
      - apps/core/test/models/specialist-upstream-evidence.integration.test.ts
  - risk_family: policy-admission-governance
    id: active-scope-concurrency-model
    status: pass
    summary: Policy store serializes specialist rollout and retirement mutations
      through specialist-scoped advisory locks.
    evidence: packages/db/src/specialists.ts
    test_refs:
      - packages/db/test/specialists/specialist-policy-store.integration.test.ts
  - risk_family: policy-admission-governance
    id: append-only-decision-audit-facts
    status: pass
    summary: Rollout, admission and retirement decisions are append-only rows
      preserving evidence refs, fallback refs and lineage.
    evidence: infra/migrations/027_specialist_policy.sql
    test_refs:
      - packages/db/test/specialists/specialist-policy-store.integration.test.ts
      - apps/core/test/models/specialist-lineage.contract.test.ts
  - risk_family: policy-admission-governance
    id: regression-test-paths
    status: pass
    summary: Regression tests cover contracts, store, admission, retirement,
      upstream evidence, no-remap and owner/deployment/registry boundaries.
    evidence: docs/ssot/features/F-0027-specialist-organs-rollout-retirement-policy.md
    test_refs:
      - packages/contracts/test/specialists.contract.test.ts
      - apps/core/test/models/specialist-owner-boundary.contract.test.ts
      - apps/core/test/models/specialist-deployment-boundary.contract.test.ts
pre_review_checklist_status: complete
pre_review_checklist_blockers: []
local_gates_green_ts: 2026-04-28T13:44:12.307Z
step_artifact: .dossier/steps/F-0027/implementation.json
post_close_backlog_hygiene_required: true
post_close_backlog_hygiene_status: clean
post_close_backlog_hygiene_artifact: .dossier/verification/F-0027/implementation-post-close-backlog-hygiene.json
post_close_backlog_hygiene_checked_at: 2026-04-29T10:40:54.792Z
post_close_backlog_hygiene_refresh_at: 2026-04-29T10:40:54.537Z
post_close_open_source_review_count: 0
post_close_source_review_blocked_item_count: 0
post_close_lifecycle_reconciliation_drift_count: 0
post_close_unresolved_attention_present: false
post_close_backlog_hygiene_blockers: []
step_close_ts: 2026-04-28T14:00:31.377Z
process_complete_ts: 2026-04-28T14:00:31.377Z
intake_process_complete_ts: null
first_review_agent_started_ts: 2026-04-28T13:52:32.278Z
final_pass_ts: 2026-04-28T13:59:10.747Z
verification_trace_commit: f1e87bafa76fc561a437e3bc46fedf3ab2b7b6ff
closure_bundle_id: null
closure_bundle_round: null
closure_bundle_rounds_by_audit_class: {}
selected_review_artifacts: []
selected_verification_artifact: null
selected_step_artifact: null
selected_closure_ts: null
rpa_source_identity: null
rpa_source_quality: null
non_pass_review_events: []
post_close_backlog_hygiene_global_refresh_artifact: .dossier/verification/post-close-hygiene/global-refresh-post-close-hygiene-2026-04-29T10-40-54-288Z.json
post_close_affected_feature_ids:
  - F-0026
  - F-0027
post_close_pre_status_summary:
  total_items: 28
  last_refresh_at: 2026-04-29T10:29:08.469Z
  defined_count: 0
  intaken_count: 0
  specified_count: 1
  planned_count: 0
  implemented_count: 27
  gaps_count: 0
  needs_attention_count: 0
  ready_for_next_step_count: 1
  open_todo_count: 0
  artifact_integrity:
    applied_canonical_paths_exist: true
    missing_canonical_paths: []
  open_source_review_count: 0
  source_review_blocked_item_count: 0
  lifecycle_reconciliation_drift_count: 0
  lifecycle_reconciliation_drifts: []
  post_close_hygiene_missing_count: 0
  post_close_hygiene_stale_count: 2
  post_close_hygiene_blocked_count: 0
  post_close_hygiene_missing_feature_ids: []
  post_close_hygiene_stale_feature_ids:
    - F-0026
    - F-0027
  post_close_hygiene_blocked_feature_ids: []
post_close_post_status_summary:
  total_items: 28
  last_refresh_at: 2026-04-29T10:40:54.537Z
  defined_count: 0
  intaken_count: 0
  specified_count: 1
  planned_count: 0
  implemented_count: 27
  gaps_count: 0
  needs_attention_count: 0
  ready_for_next_step_count: 1
  open_todo_count: 0
  artifact_integrity:
    applied_canonical_paths_exist: true
    missing_canonical_paths: []
  open_source_review_count: 0
  source_review_blocked_item_count: 0
  lifecycle_reconciliation_drift_count: 0
  lifecycle_reconciliation_drifts: []
  post_close_hygiene_missing_count: 0
  post_close_hygiene_stale_count: 2
  post_close_hygiene_blocked_count: 0
  post_close_hygiene_missing_feature_ids: []
  post_close_hygiene_stale_feature_ids:
    - F-0026
    - F-0027
  post_close_hygiene_blocked_feature_ids: []
post_close_hygiene_schema_version: 2
---

## Scope

Реализация `CF-019` / `F-0027`: единый `specialist-policy` owner surface для контрактов, PostgreSQL policy facts, runtime admission после router selection, retirement/lineage и boundary coverage.

## Inputs actually used

- `docs/ssot/features/F-0027-specialist-organs-rollout-retirement-policy.md`
- `docs/architecture/system.md`
- `docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md`
- `docs/adr/ADR-2026-03-19-phase0-deployment-cell.md`
- `README.md`
- Repo overlay `AGENTS.md`

## Decisions / reclassifications

### Spec gap decisions

- Нового repo-level ADR не потребовалось: реализация осталась feature-local policy overlay и не ввела второй serving/runtime stack, новый boot-critical dependency или foreign write authority.

### Implementation freedom decisions

- Operator API routes не добавлялись, потому что первый implementation target закрывается internal runtime service + router admission seam.
- Release/deploy/rollback execution не добавлялся: `F-0027` только потребляет release evidence и fallback refs, а execution остается у `F-0026`.

### Temporary assumptions

- Upstream evidence ports реализованы как typed read-only adapters, чтобы не брать ownership над workshop, governor, serving readiness, release и registry truth.

## Operator feedback

- Пользователь ранее подтвердил, что canonical lifecycle должен мутировать backlog state; implementation actualization выполнена явным patch artifact `2026-04-28-058-f0027-implementation-actualization`.

## Review events

Первый material freeze `67a34a82678bcd4a8260c6d81b918996dada09d4` получил независимые FAIL verdicts:

- `spec-conformance-reviewer`: admission replay conflict, task-scope check, current-stage enforcement, retired overwrite and live rollout release evidence.
- `code-reviewer`: current-stage enforcement, replay conflict before invocation and commit-safe rollout/retirement/admission serialization.
- `security-reviewer`: caller-controlled freshness timestamp, replay conflict, caller-supplied traffic/scope, release binding and admission/retirement serialization.

Correction freeze `f97b0ba` addressed the blockers with service-time freshness, authoritative persisted traffic counting, stage/scope/release binding checks, transaction-scoped stage locks, terminal register guard, admission stage guard and regression tests.

Повторный audit для `f97b0ba` закрыл spec-conformance, но оставил два blocking пункта:

- `code-reviewer`: финальная `ALLOW` recheck в store была слишком узкой и проверяла не все organ/current policy факты перед persistence.
- `security-reviewer`: release evidence была привязана к логическим refs, но не к фактической deployment/runtime artifact identity.

Second correction freeze `7871faf18b5e0f220216f9c531ab3338ca23e759` addressed these blockers:

- `SpecialistReleaseEvidence` теперь включает `deploymentIdentity`, `artifactUri`, `artifactDescriptorPath` и `runtimeArtifactRoot`; admission отказывает release evidence, если runtime artifact path не совпадает с promoted serving dependency.
- Финальная DB-проверка `ALLOW` выполняется под specialist advisory lock и повторно сверяет organ stage/task/model/service/rollback refs, current policy id, governed scope, allowed stage и traffic limit перед записью allow decision.
- Добавлены regression tests для runtime artifact mismatch и stale current-policy identity.

Третий audit для `7871faf` закрыл spec-conformance, но оставил blocking пункты:

- `security-reviewer`: replay уже разрешенного admission продолжал возвращать specialist selection и мог быть повторно использован как право на invocation.
- `code-reviewer`: production lifecycle создавал model router без `specialistPolicy`, tick execution не выполнял admission перед decision invocation, refused rollout events были синтетическими и не попадали в canonical list/replay, а request-id idempotency lock был specialist-scoped при глобально уникальных request ids.

Third correction freeze `6899ecb7c070b62bb41735efeb27968aebe2afee` addressed these blockers:

- Router treats deduplicated specialist admission as `specialist_admission_replayed`: refused, non-remapped and non-invocable.
- Runtime lifecycle now wires DB-backed specialist policy store/evidence ports into the production model router and tick execution performs specialist admission before decision invocation.
- DB-backed evidence ports fail closed on missing workshop/governor/serving/release/health/fallback evidence and bind release evidence to release, specialist, model profile, service, policy, rollout stage and runtime artifact refs from canonical release rows.
- Refused rollout events are persisted as append-only facts and are replayable through the canonical request-id path.
- Rollout policy, rollout event, admission and retirement writes acquire a request-id advisory lock before the specialist stage lock to serialize globally unique request ids across specialists.
- Added regression coverage for replayed router admission, production tick admission wiring and persisted refused rollout replay.

Четвертый audit для `6899ecb` вернул три blocking пункта:

- `security-reviewer` и `spec-conformance-reviewer`: baseline router мог выбрать active specialist model profile с обычной baseline role без `specialistAdmission`, обходя F-0027 admission gates.
- `spec-conformance-reviewer`: release evidence binding не содержал явной привязки к fallback target.
- `code-reviewer`: DB-backed release evidence adapter требовал неканонические artifact refs из F-0026 file/diagnostic arrays и не принимал canonical F-0026 model readiness refs (`model_profile_health:*`, `report:model_health:*`), поэтому production admission мог fail-closed на валидных release rows.

Fourth correction freeze `2ded8decd5bf175e92f6f67590d5f09a82f07273` addressed these blockers:

- Baseline router now filters loaded decision profiles to exact canonical phase-0 baseline profile ids, so specialist-owned profiles with `reflex`/`deliberation`/`reflection` roles cannot be selected through baseline routing.
- Specialist release evidence now includes `fallbackTargetProfileId`, and admission refuses release evidence bound to a different fallback target.
- DB-backed release evidence adapter now reads canonical F-0026 `release_evidence` joined with `release_requests`, accepts canonical model-readiness refs, derives model/service/artifact binding from `model_registry` plus current serving dependency state, and reads F-0027 supplemental binding refs from release request evidence refs rather than requiring them in materialized file artifacts.
- Added regression coverage for baseline specialist profile exclusion and release fallback-target mismatch.

Пятый audit для `2ded8de` получил PASS от `spec-conformance-reviewer` и `security-reviewer`, но `code-reviewer` оставил один blocking пункт:

- `code-reviewer`: admission сравнивал release evidence с hard-coded `deployment-cell:local`; canonical F-0026 deploy attempts могут иметь per-request deployment identity, поэтому валидное release evidence могло fail-closed в production.

Fifth correction freeze `f1e87ba4a5af3d7d14629a8c7446ef8768f1ff43` addressed this blocker:

- Removed service-level hard-coded deployment identity from specialist policy.
- Release evidence now carries `deploymentIdentityRef`; service requires it to match the F-0026 release evidence `deploymentIdentity`.
- DB-backed release evidence adapter requires explicit `deployment-identity:<id>` F-0027 supplemental release-request ref and verifies it equals canonical `release_evidence.deployment_identity`.
- Added regression coverage for accepting a per-request deployment identity and refusing mismatched deployment identity binding.

Финальный audit для `f1e87bafa76fc561a437e3bc46fedf3ab2b7b6ff`:

- `spec-conformance-reviewer`: PASS (`019dd455-df82-7ce2-8f3d-365c84114d39` / Arendt).
- `code-reviewer`: PASS (`019dd455-e1f3-7062-beb4-6e12a11d2070` / Godel).
- `security-reviewer`: PASS (`019dd455-e4f9-7620-bc4b-180000c801a5` / Pauli).

Closure использовал ordered immutable bundle `r03`: spec-conformance, затем code-review, затем security-review. Ранние `r01`/`r02` review-artifact attempts сохранены как provenance, но не являются выбранным closure bundle.

## Backlog follow-up

- `CF-019` actualized from `planned` to `implemented` via `.dossier/backlog/patches/e1adf0b55e5f--f0027-implementation-actualization.patch.json`.

## Process misses

none

## Transition events

- 2026-04-28T11:04:21.575Z: entered
- 2026-04-28T11:33:45.291Z: resumed
- 2026-04-28T11:34:05.827Z: ready_for_close
- 2026-04-28T11:36:24.437Z: ready_for_close
- 2026-04-28T12:02:14.220Z: ready_for_close
- 2026-04-28T12:20:55.921Z: ready_for_close
- 2026-04-28T13:03:11.959Z: ready_for_close
- 2026-04-28T13:28:17.399Z: ready_for_close
- 2026-04-28T13:44:12.307Z: ready_for_close

## Close-out

Pre-review state: `ready_for_close`.

Local verification already run before external reviews:

- `pnpm format`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm smoke:cell`
- `dossier-engineer coverage-audit --dossier docs/ssot/features/F-0027-specialist-organs-rollout-retirement-policy.md`

Correction verification after audit FAIL:

- `pnpm format`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm smoke:cell`
- `dossier-engineer coverage-audit --dossier docs/ssot/features/F-0027-specialist-organs-rollout-retirement-policy.md`

Second correction verification after re-audit FAIL:

- `pnpm format`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm smoke:cell`
- `dossier-engineer coverage-audit --dossier docs/ssot/features/F-0027-specialist-organs-rollout-retirement-policy.md`

Third correction verification after final pre-audit fixes:

- `pnpm format`
- `pnpm typecheck`
- `pnpm lint`
- targeted F-0027 specialist runtime/store/router tests
- full F-0027 specialist contract/integration suite
- `pnpm test`
- `pnpm smoke:cell`
- `dossier-engineer coverage-audit --dossier docs/ssot/features/F-0027-specialist-organs-rollout-retirement-policy.md`
- `git diff --check`

Fourth correction verification after audit FAIL:

- `pnpm format`
- `pnpm typecheck`
- `pnpm lint`
- targeted router/specialist policy/runtime/store tests
- full F-0027 specialist contract/integration suite
- `pnpm test`
- `pnpm smoke:cell`
- `dossier-engineer coverage-audit --dossier docs/ssot/features/F-0027-specialist-organs-rollout-retirement-policy.md`
- `git diff --check`

Fifth correction verification after code-review FAIL:

- `pnpm format`
- `pnpm typecheck`
- `pnpm lint`
- targeted specialist policy/router/tick tests
- full F-0027 specialist contract/integration suite
- `pnpm test`
- `pnpm smoke:cell`
- `dossier-engineer coverage-audit --dossier docs/ssot/features/F-0027-specialist-organs-rollout-retirement-policy.md`
- `git diff --check`

Implementation summary:

- Added shared specialist contracts and package export.
- Added PostgreSQL migration and DB store for specialist organs, rollout policies/events, admission decisions and retirement decisions.
- Added specialist policy service with fail-closed workshop/governor/serving/release/health/fallback gates.
- Added router admission hook that preserves selection/admission separation and no silent remap.
- Added retirement and lineage behavior with idempotent replay/conflict handling.
- Hardened admission after audit: equivalent replay no longer re-invokes, conflicting replay fails closed, live admission uses service time, stage/scope/release binding is explicit and admission is serialized with retirement through the store.
- Hardened admission after re-audit: release evidence is bound to runtime artifact identity, and final `ALLOW` persistence rechecks current organ/policy state under lock before writing an allow decision.
- Hardened admission after third audit: production runtime now wires specialist admission before decision invocation, replayed allows are non-invocable, refused rollout facts persist canonically, and request-id locking is global across specialist policy write paths.
- Hardened admission after fourth audit: baseline routing cannot select specialist profiles without admission, release evidence binds fallback target, and DB-backed release evidence consumption aligns with canonical F-0026 release rows plus F-0027 supplemental request evidence refs.
- Hardened admission after fifth audit: release deployment identity is explicit release evidence binding instead of a hard-coded local deployment identity.
- Added contract, DB, runtime, router, upstream-evidence, owner-boundary, deployment-boundary and registry-boundary tests.
