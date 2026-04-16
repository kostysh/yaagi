```yaml
feature_id: F-0020
backlog_item_key: CF-023
stage: spec-compact
cycle_id: c01
session_id: 019d95c3-2088-7a01-88bb-e20d2b203438
start_ts: 2026-04-16T21:13:18+02:00
ready_for_review_ts: 2026-04-16T21:22:08+02:00
final_pass_ts: 2026-04-16T21:33:08+02:00
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
  - docs/adr/ADR-2026-03-19-phase0-deployment-cell.md
  - docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md
  - docs/backlog/reports/backlog-report.md
repo_overlays:
  - AGENTS.md
log_required: true
log_required_reason:
  - backlog_actualization
  - review_reround
backlog_actualized: true
backlog_artifact_integrity: clean
verification_artifact: .dossier/verification/F-0020/spec-compact-1703e9fc810d.json
review_artifact: .dossier/reviews/F-0020/spec-compact-1703e9fc810d.json
step_artifact: .dossier/steps/F-0020/spec-compact.json
review_requested_ts: 2026-04-16T21:22:08+02:00
first_review_agent_started_ts: 2026-04-16T21:22:08+02:00
review_models:
  - gpt-5.4
review_retry_count: 2
rerun_reasons:
  - review_findings
operator_review_interventions_total: 0
review_events:
  - agent_id: 019d97be-2821-7b02-8588-7707936f36e5
    role: independent
    audit_launch_gate_checked: true
    audit_class: spec-conformance
    required_skill: spec-conformance-reviewer
    model: gpt-5.4
    reasoning_effort: high
    allowed_by_policy: true
    disallowed_reason: ""
    requested_ts: 2026-04-16T21:22:08+02:00
    verdict_ts: 2026-04-16T21:24:30+02:00
    verdict: findings
    rerun_reason: review_findings
    scope: F-0020 spec-compact dossier + журнал этапа + актуализация беклога
    fork_context: false
    read_only_expected: true
    mutation_check: not_checked
    invalidated: false
    invalidated_reason: none
    operator_intervention_required: false
    operator_intervention_ref: null
    replacement_event_ref: null
  - agent_id: 019d97be-2821-7b02-8588-7707936f36e5
    role: independent
    audit_launch_gate_checked: true
    audit_class: spec-conformance
    required_skill: spec-conformance-reviewer
    model: gpt-5.4
    reasoning_effort: high
    allowed_by_policy: true
    disallowed_reason: ""
    requested_ts: 2026-04-16T21:28:31+02:00
    verdict_ts: 2026-04-16T21:30:40+02:00
    verdict: findings
    rerun_reason: review_findings
    scope: финальный smell-pass по обновлённой спеке и журналу этапа
    fork_context: false
    read_only_expected: true
    mutation_check: not_checked
    invalidated: false
    invalidated_reason: none
    operator_intervention_required: false
    operator_intervention_ref: null
    replacement_event_ref: null
  - agent_id: 019d97be-2821-7b02-8588-7707936f36e5
    role: independent
    audit_launch_gate_checked: true
    audit_class: spec-conformance
    required_skill: spec-conformance-reviewer
    model: gpt-5.4
    reasoning_effort: high
    allowed_by_policy: true
    disallowed_reason: ""
    requested_ts: 2026-04-16T21:31:40+02:00
    verdict_ts: 2026-04-16T21:32:53+02:00
    verdict: pass
    rerun_reason: none
    scope: финальный PASS-check перед review-artifact и dossier-step-close
    fork_context: false
    read_only_expected: true
    mutation_check: not_checked
    invalidated: false
    invalidated_reason: none
    operator_intervention_required: false
    operator_intervention_ref: null
    replacement_event_ref: null
```

# Журнал spec-compact: F-0020 c01

## Объём этапа

Сформировать compact specification для `F-0020` на основе уже закрытого intake, не переходя к `plan-slice`.

## Фактически использованные входы

- `AGENTS.md`
- `README.md`
- `docs/ssot/index.md`
- `docs/architecture/system.md`
- `docs/features/F-0020-real-vllm-serving-and-promotion-model-dependencies.md`
- `docs/features/F-0002-canonical-monorepo-deployment-cell.md`
- `docs/features/F-0008-baseline-model-router-and-organ-profiles.md`
- `docs/features/F-0014-expanded-model-ecology-and-registry-health.md`
- `docs/features/F-0015-workshop-datasets-training-eval-and-promotion.md`
- `docs/adr/ADR-2026-03-19-phase0-deployment-cell.md`
- `docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md`
- канонический backlog report/context для `CF-023`

## Решения / переклассификации

### Решения по пробелам спеки

- Separated the real-serving seam from adjacent owners so `F-0020` owns fast-first real `vllm-fast` serving, while `F-0002`, `F-0008`, `F-0014`, and `F-0015` keep deployment-cell, routing, diagnostics, and workshop lifecycle boundaries.
- Replaced generic “real serving” prose with explicit artifact, readiness, and fail-closed dependency rules backed by a compact machine-facing `ServingDependencyState` contract.
- Classified adversarial semantics for startup/readiness, duplicate replay, race windows, crash/restart, and stale projection reads instead of leaving failure behavior implicit.
- После первого внешнего review разложил составные AC на атомарные и сделал trigger для promotion `vllm-deep` / `vllm-pool` явным, чтобы `specified` опирался на истину из dossier, а не только на bookkeeping в backlog.

### Решения по свободе реализации

- Left CPU-only versus ROCm-enabled serving posture as implementation freedom as long as the canonical `vllm-fast` service/protocol continuity and real inference proof stay intact.
- Left the exact canonical readiness-probe prompt payload as implementation freedom as long as it executes real inference rather than transport-only liveness.
- Left descriptor storage form as implementation freedom, but constrained it to one canonical source of truth per `service_id`.

### Временные допущения

- Для этого цикла формализации только `vllm-fast` считается boot-critical real-serving scope; `vllm-deep` и `vllm-pool` остаются optional до тех пор, пока более поздний seam явно не задействует trigger promotion, определённый в этой спеке.
- Более богатые registry/health surfaces из `F-0014` используются как upstream diagnostics и не заменяются вторым serving registry.

## Обратная связь оператора

- Перед стартом `spec-compact` явная проверка repo overlays показала, что Codex Plan mode для этого цикла не требуется.
- Intake был закоммичен отдельно до старта `spec-compact`, поэтому этот цикл меняет только dossier/log/backlog surfaces, нужные для формализации спеки и актуализации backlog truth.
- После закрытия этапа narrative-часть stage-log была приведена к языку оператора; machine-friendly metadata оставлена в канонической схеме инструмента.

## События ревью

- Первый внешний независимый ревью-раунд от `019d97be-2821-7b02-8588-7707936f36e5` (`gpt-5.4`, `high`, `spec-conformance-reviewer`) вернул findings.
- Первый reround потребовал: явно определить trigger для deep/pool promotion, разложить составные AC и синхронизировать stage-log с уже выполненными actualization / verification артефактами.
- Второй reround нашёл один локальный разрыв в формулировке temporary assumptions; после его исправления тот же reviewer вернул финальный `PASS`.

## Актуализация беклога

- `CF-023` был канонически actualize-нут из `planned` в `specified` через `docs/backlog/patches/2aae81868b8b--cf023-spec-compact.patch.json`.
- Целостность backlog artifacts после apply чистая: `docs/backlog/.backlog/applied.json` и `docs/backlog/.backlog/state.json` корректно ссылаются на применённый patch.
- Мутация создала downstream dependency-review todo для `CF-013`, `CF-019`, `CF-025` и `CF-026`; это ожидаемый follow-up, а не блокер для закрытия `spec-compact`.

## Промахи процесса

- `PM-001` (low): stage-log не был обновлён после backlog actualization и `dossier-verify` до первого внешнего ревью-раунда. Этот reround исправил телеметрию до closure.

## Закрытие этапа

- `dossier-verify` для финального дерева прошёл повторно.
- PASS verdict зафиксирован в `.dossier/reviews/F-0020/spec-compact-1703e9fc810d.json`.
- Шаг закрыт через `.dossier/steps/F-0020/spec-compact.json` с `process_complete=yes`.
- Следующий workflow stage: `plan-slice`.
