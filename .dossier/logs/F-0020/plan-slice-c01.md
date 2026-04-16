---
feature_id: F-0020
backlog_item_key: CF-023
stage: plan-slice
cycle_id: c01
session_id: 019d95c3-2088-7a01-88bb-e20d2b203438
start_ts: 2026-04-16T21:53:48+02:00
ready_for_review_ts: 2026-04-16T22:01:31+02:00
review_requested_ts: 2026-04-16T22:28:25+02:00
first_review_agent_started_ts: 2026-04-16T22:28:25+02:00
final_pass_ts: 2026-04-16T22:33:50+02:00
source_inputs:
  - AGENTS.md
  - README.md
  - docs/ssot/index.md
  - docs/architecture/system.md
  - docs/features/F-0020-real-vllm-serving-and-promotion-model-dependencies.md
  - docs/features/F-0002-canonical-monorepo-deployment-cell.md
  - docs/features/F-0008-baseline-model-router-and-organ-profiles.md
  - docs/features/F-0014-expanded-model-ecology-and-registry-health.md
  - docs/features/F-0015-workshop-datasets-training-eval-and-promotion.md
  - docs/backlog/local-vllm-model-shortlist-2026-03-24.md
  - docs/adr/ADR-2026-03-19-phase0-deployment-cell.md
  - docs/adr/ADR-2026-03-19-quality-gate-sequence.md
  - docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md
repo_overlays:
  - AGENTS.md
log_required: true
log_required_reason:
  - backlog_actualization
  - planning_slice_boundaries
  - open_question_resolution
backlog_actualized: true
backlog_artifact_integrity: clean
planned_slices:
  - SL-F0020-01
  - SL-F0020-02
  - SL-F0020-03
  - SL-F0020-04
slice_status:
  SL-F0020-01: not_started
  SL-F0020-02: not_started
  SL-F0020-03: not_started
  SL-F0020-04: not_started
current_checkpoint: checkpoint_only
completion_decision: final_closeout
operator_command_refs:
  - cmd-001: "Комить изменения и приступай к выполнению plan-slice"
  - cmd-002: "План должен будет включать рекомендации по тестированию моделей-кандидатов, чтобы выбор был объективным."
verification_artifact: .dossier/verification/F-0020/plan-slice-aac8139ea9a8.json
review_artifact: .dossier/reviews/F-0020/plan-slice-aac8139ea9a8.json
step_artifact: .dossier/steps/F-0020/plan-slice.json
review_models:
  - gpt-5.4
review_retry_count: 1
review_wait_minutes: 3
transport_failures_total: 0
rerun_reasons:
  - review_findings
operator_review_interventions_total: 1
review_events:
  - agent_id: 019d97fb-578c-7011-8764-9cb6db016e78
    role: independent
    audit_launch_gate_checked: true
    audit_class: independent-review
    required_skill: spec-conformance-reviewer
    model: gpt-5.4
    reasoning_effort: high
    allowed_by_policy: true
    disallowed_reason: ""
    requested_ts: 2026-04-16T22:28:25+02:00
    verdict_ts: 2026-04-16T22:32:10+02:00
    verdict: findings
    rerun_reason: review_findings
    scope: "F-0020 plan-slice dossier, stage log, verification artifact and backlog actualization alignment"
    fork_context: false
    read_only_expected: true
    mutation_check: dirty_worktree
    invalidated: false
    invalidated_reason: none
    operator_intervention_required: false
    operator_intervention_ref: null
    replacement_event_ref: null
  - agent_id: 019d97fb-578c-7011-8764-9cb6db016e78
    role: independent
    audit_launch_gate_checked: true
    audit_class: independent-review
    required_skill: spec-conformance-reviewer
    model: gpt-5.4
    reasoning_effort: high
    allowed_by_policy: true
    disallowed_reason: ""
    requested_ts: 2026-04-16T22:33:07+02:00
    verdict_ts: 2026-04-16T22:33:50+02:00
    verdict: pass
    rerun_reason: review_findings
    scope: "narrow reround for backlog dependency drift and stage-log metadata enums"
    fork_context: false
    read_only_expected: true
    mutation_check: dirty_worktree
    invalidated: false
    invalidated_reason: none
    operator_intervention_required: false
    operator_intervention_ref: null
    replacement_event_ref: null
---

# Журнал планирования: F-0020 plan-slice

## Область работ

Сформировать implementation slices для `CF-023` / `F-0020`, закрыть planning-level ambiguity вокруг выбора fast baseline и явным образом включить objective candidate-testing policy.

## Фактически использованные входы

- `AGENTS.md`
- `README.md`
- `docs/ssot/index.md`
- `docs/architecture/system.md`
- `docs/features/F-0020-real-vllm-serving-and-promotion-model-dependencies.md`
- Delivered prerequisite dossiers: `F-0002`, `F-0008`, `F-0014`, `F-0015`
- Relevant ADRs: phase-0 deployment cell, AI SDK substrate, quality-gate sequence
- Supporting shortlist: `docs/backlog/local-vllm-model-shortlist-2026-03-24.md`

## Решения / реклассификации

### Spec gap decisions

- Plan mode assessment: не требуется; planning scope ограничен одним dossier, исходные owner boundaries уже shaped, а новая развилка сводится к нормативной фиксации candidate-qualification rule, а не к open-ended исследованию.
- Logging required: да; stage меняет backlog truth, закрывает `before_planned` ambiguity и фиксирует slice boundaries.
- Former `before_planned` ambiguity закрыта двумя normative-now решениями: fast baseline выбирается через closed qualification rule, а deep/pool real-serving вынесен в follow-up scope.
- Slice boundary decision: создано 4 implementation slices — `SL-F0020-01` through `SL-F0020-04`.
- Boundary rationale: `SL-F0020-01` убивает главный workstation/model-choice risk раньше boot-critical promotion; `SL-F0020-02` изолирует readiness и artifact materialization; `SL-F0020-03` отдельно закрывает fail-closed startup/admission and workshop handoff; `SL-F0020-04` удерживает deep/pool continuity как explicit optional contract и usage-audit closure.

### Implementation freedom decisions

- Candidate corpus composition, exact prompt texts and serving flags остаются implementation freedom, пока каждый кандидат проходит один и тот же rubric и не меняется canonical provider path.
- Descriptor storage may stay file-backed or DB-backed with file pointers, but only one source of truth per `service_id` is allowed.

### Temporary assumptions

- `google/gemma-4-E4B-it` остаётся preferred first candidate, но только как ordering choice для qualification, а не как заранее доставленный baseline.
- Deep/pool real-serving deliberately stays out of this dossier implementation scope; this stage only preserves the future promotion guard.

## Обратная связь оператора

- `cmd-001`: оператор попросил закоммитить shortlist update и сразу перейти к `plan-slice`.
- `cmd-002`: оператор явно потребовал включить объективные рекомендации по тестированию моделей-кандидатов в сам план.

## События ревью

- `dossier-verify --step plan-slice` уже прошёл успешно; verification artifact refreshed on the current tree at `.dossier/verification/F-0020/plan-slice-aac8139ea9a8.json`.
- Первый independent review (`Banach`, `gpt-5.4`, high reasoning, read-only) вернул `FAIL` с двумя medium findings:
  - backlog truth не отражал новый explicit dependency `CF-011`;
  - metadata block stage-log использовал недопустимые enum values.
- Перед принятием verdict проверены `HEAD` и worktree: `HEAD` не менялся, unauthorized reviewer mutations не обнаружены; tree remained dirty only because the main stage artifacts were still uncommitted.
- После fail выполнен narrow fix-only reround path: backlog dependency actualized, stage-log enums corrected, verify bundle refreshed; следующий шаг — fresh independent reround review по narrowed diff.
- Narrow reround review тем же independent agent вернулся `PASS`; remaining findings отсутствуют.

## Актуализация backlog

- `CF-023` actualized `specified -> planned` через canonical patch artifact `docs/backlog/patches/f3fa3942e516--f0020-plan-slice.patch.json`.
- После первого review finding `CF-023` дополнительно actualized canonical dependency patch `docs/backlog/patches/e1353fb2e89c--f0020-add-cf011-dep.patch.json`, чтобы backlog truth явно включал `CF-011`.
- После planning review of shortlist source выполнен scoped `refresh --source-id 9d061028-1d37-4f85-9919-f6321ed1f995`, который снял self-review todo по `CF-023` без дополнительного backlog field delta.
- Current backlog truth for the selected item: `delivery_state=planned`, `depends_on_keys=[CF-020, CF-006, CF-010, CF-011]`, `needs_attention=false`, `ready_for_next_step=true`.

## Процессные промахи

- Пока нет.

## Закрытие

- `review-artifact`: `.dossier/reviews/F-0020/plan-slice-aac8139ea9a8.json`
- `dossier-step-close`: `.dossier/steps/F-0020/plan-slice.json`
- `next-step`: `implementation`
- `process_complete=yes`
