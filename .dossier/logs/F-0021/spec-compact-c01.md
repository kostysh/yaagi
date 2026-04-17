---
feature_id: F-0021
backlog_item_key: CF-028
stage: spec-compact
cycle_id: c01
session_id: 019d95c3-2088-7a01-88bb-e20d2b203438
start_ts: 2026-04-17T19:58:00+02:00
ready_for_review_ts: 2026-04-17T20:00:00+02:00
final_pass_ts: 2026-04-17T20:13:09+02:00
source_inputs:
  - docs/ssot/index.md
  - AGENTS.md
  - docs/architecture/system.md
  - docs/adr/ADR-2026-04-17-smoke-harness-follow-up-scope-extraction.md
  - docs/features/F-0007-deterministic-smoke-harness-and-suite-scoped-cell-lifecycle.md
  - docs/features/F-0020-real-vllm-serving-and-promotion-model-dependencies.md
repo_overlays:
  - AGENTS.md
log_required: true
log_required_reason:
  - explicit_multi_pass_workflow
backlog_actualized: false
backlog_artifact_integrity: not_applicable
current_checkpoint: checkpoint_only
completion_decision: checkpoint_progress_only
canonical_for_commit: false
generated_after_commit: false
freshness_basis: intended_final_tree
operator_command_refs:
  - "комить и приступай к spec-compact"
review_events:
  - agent_id: 019d9c9c-fad9-7d81-816f-ca57e20547f4
    role: independent
    audit_launch_gate_checked: true
    audit_class: independent-review
    required_skill: dossier-engineer
    model: gpt-5.4
    reasoning_effort: high
    allowed_by_policy: true
    disallowed_reason: ""
    requested_ts: 2026-04-17T20:00:00+02:00
    verdict_ts: 2026-04-17T20:04:00+02:00
    verdict: findings
    rerun_reason: review_findings
    scope: F-0021 spec-compact on commit cdccd7d
    fork_context: false
    read_only_expected: true
    mutation_check: clean
    invalidated: false
    invalidated_reason: not_applicable
    operator_intervention_required: false
    operator_intervention_ref: null
    replacement_event_ref: 019d9ca1-fa1a-7752-97ef-1cced8fb170d
  - agent_id: 019d9ca1-fa1a-7752-97ef-1cced8fb170d
    role: independent
    audit_launch_gate_checked: true
    audit_class: independent-review
    required_skill: dossier-engineer
    model: gpt-5.4
    reasoning_effort: high
    allowed_by_policy: true
    disallowed_reason: ""
    requested_ts: 2026-04-17T20:10:00+02:00
    verdict_ts: 2026-04-17T20:12:00+02:00
    verdict: pass
    rerun_reason: review_findings
    scope: F-0021 spec-compact on commit cfaa933
    fork_context: false
    read_only_expected: true
    mutation_check: clean
    invalidated: false
    invalidated_reason: not_applicable
    operator_intervention_required: false
    operator_intervention_ref: null
    replacement_event_ref: null
review_requested_ts: 2026-04-17T20:00:00+02:00
first_review_agent_started_ts: 2026-04-17T20:00:00+02:00
review_models:
  - gpt-5.4
review_retry_count: 1
review_wait_minutes: 12
transport_failures_total: 0
rerun_reasons:
  - review_findings
operator_review_interventions_total: 0
---

## Scope

- Выполнить `spec-compact` для `F-0021` на основе уже выбранного backlog item `CF-028`.
- Уточнить AC, boundary contract, adversarial semantics и compact design без перехода к planning/implementation.

## Inputs actually used

- `AGENTS.md`
- `docs/ssot/index.md`
- `docs/architecture/system.md`
- `docs/adr/ADR-2026-04-17-smoke-harness-follow-up-scope-extraction.md`
- `docs/features/F-0007-deterministic-smoke-harness-and-suite-scoped-cell-lifecycle.md`
- `docs/features/F-0020-real-vllm-serving-and-promotion-model-dependencies.md`
- canonical backlog card `CF-028`

## Decisions / reclassifications

### Spec gap decisions

- Разделены boundary operations: base startup, direct PostgreSQL reads/waits, Telegram overlay activation, runtime reset и teardown.
- AC разбиты на отдельные обязательства по shared deployment cell reuse, shared model-runtime reuse, redundant build removal, predicate waits, health-first readiness, preserved semantics, teardown cleanliness и evidence capture.
- Добавлен explicit operator/agent contract: единственная operator entrypoint остаётся `pnpm smoke:cell`, а smoke-only PostgreSQL channel скрывается внутри harness contract.
- После первого review FAIL добавлен observable optimization-success contract: total suite regression budget не более 10% и обязательное улучшение хотя бы одного orchestration path.
- После первого review FAIL добавлен explicit preserved smoke assertion baseline для base family и Telegram overlay.

### Implementation freedom decisions

- Имя helper surface для predicate waits и точное имя smoke-only host-port key оставлены свободой реализации.

### Temporary assumptions

- Parallel smoke execution remains out of mandatory contract for this dossier; current follow-up still assumes one local smoke run at a time.

## Operator feedback

- Plan mode assessed before stage start and classified as not needed because the follow-up scope is already bounded to four approved optimization directions.

## Review events

- Первый независимый review вернул два finding'а: отсутствовал measurable optimization-success contract, а preserved smoke semantics были заданы слишком расплывчато.
- Scope reround ограничен dossier-only corrections без изменения backlog truth.
- Второй независимый review подтвердил, что оба finding'а закрыты и dossier готов к `plan-slice`.

## Backlog actualization

- Не требуется на этом шаге по текущей strongest evidence: `CF-028` уже `planned`, новых blocker/dependency/context facts shaping не открыл.

## Process misses

- none

## Close-out

- in progress
