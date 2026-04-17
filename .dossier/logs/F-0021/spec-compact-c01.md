---
feature_id: F-0021
backlog_item_key: CF-028
stage: spec-compact
cycle_id: c01
session_id: 019d95c3-2088-7a01-88bb-e20d2b203438
start_ts: 2026-04-17T19:58:00+02:00
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
review_events: []
review_retry_count: 0
review_wait_minutes: 0
transport_failures_total: 0
rerun_reasons: []
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

### Implementation freedom decisions

- Имя helper surface для predicate waits и точное имя smoke-only host-port key оставлены свободой реализации.

### Temporary assumptions

- Parallel smoke execution remains out of mandatory contract for this dossier; current follow-up still assumes one local smoke run at a time.

## Operator feedback

- Plan mode assessed before stage start and classified as not needed because the follow-up scope is already bounded to four approved optimization directions.

## Review events

- pending

## Backlog actualization

- Не требуется на этом шаге по текущей strongest evidence: `CF-028` уже `planned`, новых blocker/dependency/context facts shaping не открыл.

## Process misses

- none

## Close-out

- in progress
