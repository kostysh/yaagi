```yaml
feature_id: F-0022
backlog_item_key: CF-013
stage: spec-compact
cycle_id: c01
session_id: 019d9df5-7cf1-74a0-bb4e-dfe87c748690
start_ts: 2026-04-18T03:00:47+02:00
ready_for_review_ts: 2026-04-18T03:05:40+02:00
final_pass_ts: 2026-04-18T03:15:20+02:00
source_inputs:
  - AGENTS.md
  - README.md
  - docs/ssot/index.md
  - docs/architecture/system.md
  - docs/polyphony_concept.md
  - docs/features/F-0022-skills-and-procedural-layer.md
  - docs/features/F-0002-canonical-monorepo-deployment-cell.md
  - docs/features/F-0010-executive-center-and-bounded-action-layer.md
  - docs/features/F-0020-real-vllm-serving-and-promotion-model-dependencies.md
  - docs/adr/ADR-2026-03-19-canonical-runtime-toolchain.md
  - docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md
repo_overlays:
  - AGENTS.md
log_required: true
log_required_reason:
  - backlog_actualization
  - operator_clarification
  - explicit_plan
  - review_reround
backlog_actualized: true
backlog_artifact_integrity: clean
verification_artifact: .dossier/verification/F-0022/spec-compact-64acbf62f0eb.json
review_artifact: .dossier/reviews/F-0022/spec-compact-64acbf62f0eb.json
step_artifact: .dossier/steps/F-0022/spec-compact.json
review_requested_ts: 2026-04-18T03:06:30+02:00
first_review_agent_started_ts: 2026-04-18T03:06:30+02:00
review_models:
  - gpt-5.4
review_retry_count: 2
rerun_reasons:
  - review_findings
current_checkpoint: allowed_stop_point
completion_decision: final_closeout
operator_command_refs:
  - user-2026-04-18-implement-the-plan
process_miss_refs:
  - miss_id: PM-001
    severity: low
    operator_command_ref: user-2026-04-18-implement-the-plan
    stage_log_ref: .dossier/logs/F-0022/spec-compact-c01.md
    decision_ref: .dossier/logs/F-0022/spec-compact-c01.md#промахи-процесса
    resolution_ref: .dossier/logs/F-0022/spec-compact-c01.md#события-ревью
operator_review_interventions_total: 0
transport_failures_total: 0
review_events:
  - agent_id: 019d9e1f-c44b-78f1-a7e9-459d23bacca0
    role: independent
    audit_launch_gate_checked: true
    audit_class: spec-conformance
    required_skill: spec-conformance-reviewer
    model: gpt-5.4
    reasoning_effort: high
    allowed_by_policy: true
    disallowed_reason: ""
    requested_ts: 2026-04-18T03:06:30+02:00
    verdict_ts: 2026-04-18T03:10:56+02:00
    verdict: findings
    rerun_reason: review_findings
    scope: текущая spec-compact спека, stage-log и backlog actualization для F-0022
    fork_context: false
    read_only_expected: true
    mutation_check: not_checked
    invalidated: false
    invalidated_reason: none
    operator_intervention_required: false
    operator_intervention_ref: null
    replacement_event_ref: null
  - agent_id: 019d9e1f-c44b-78f1-a7e9-459d23bacca0
    role: independent
    audit_launch_gate_checked: true
    audit_class: spec-conformance
    required_skill: spec-conformance-reviewer
    model: gpt-5.4
    reasoning_effort: high
    allowed_by_policy: true
    disallowed_reason: ""
    requested_ts: 2026-04-18T03:12:00+02:00
    verdict_ts: 2026-04-18T03:12:54+02:00
    verdict: pass
    rerun_reason: none
    scope: reround по обновлённым architecture map, stage-log и verification artifact для F-0022
    fork_context: false
    read_only_expected: true
    mutation_check: not_checked
    invalidated: false
    invalidated_reason: none
    operator_intervention_required: false
    operator_intervention_ref: null
    replacement_event_ref: null
  - agent_id: 019d9e1f-c44b-78f1-a7e9-459d23bacca0
    role: independent
    audit_launch_gate_checked: true
    audit_class: spec-conformance
    required_skill: spec-conformance-reviewer
    model: gpt-5.4
    reasoning_effort: high
    allowed_by_policy: true
    disallowed_reason: ""
    requested_ts: 2026-04-18T03:14:30+02:00
    verdict_ts: 2026-04-18T03:15:20+02:00
    verdict: pass
    rerun_reason: none
    scope: финальный smell-pass по closure tree после обновления stage-log и step artifact
    fork_context: false
    read_only_expected: true
    mutation_check: not_checked
    invalidated: false
    invalidated_reason: none
    operator_intervention_required: false
    operator_intervention_ref: null
    replacement_event_ref: null
```

# Журнал spec-compact: F-0022 c01

## Объём этапа

Сформировать compact specification для `F-0022` на основе уже закрытого intake, не переходя к `plan-slice`.

## Фактически использованные входы

- `AGENTS.md`
- `README.md`
- `docs/ssot/index.md`
- `docs/architecture/system.md`
- `docs/polyphony_concept.md`
- `docs/features/F-0022-skills-and-procedural-layer.md`
- `docs/features/F-0002-canonical-monorepo-deployment-cell.md`
- `docs/features/F-0010-executive-center-and-bounded-action-layer.md`
- `docs/features/F-0020-real-vllm-serving-and-promotion-model-dependencies.md`
- `docs/adr/ADR-2026-03-19-canonical-runtime-toolchain.md`
- `docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md`

## Решения / переклассификации

### Решения по пробелам спеки

- Оператор явно отверг lifecycle-state модель для skills: skill трактуется как структурированный пакет документов по своей спецификации, без `draft/active/deprecated` и без отдельного state-machine ownership.
- Activation proof для первой версии зафиксирован как `seed package -> materialization в workspace -> успешная загрузка runtime adapter`.
- Фича остаётся минимальным seam для packaging/materialization/adapter-consumption и не поглощает workshop/governor lifecycle.
- После review findings architecture coverage map был realign-нут: backlog-only формулировка про `candidate` и `skill lifecycle ownership` заменена на текущую truth для `F-0022 / CF-013`.

### Решения по свободе реализации

- Конкретная внутренняя структура skill package может уточняться в рамках канонического format contract, пока она не ломает repo-owned boundary `seed/skills` и runtime-owned boundary `workspace/skills`.
- Конкретная форма adapter projection остаётся implementation freedom, пока ownership над skill package не уходит framework-слою и activation proof остаётся проверяемым.

### Временные допущения

- Для первой версии не вводится отдельный DB/runtime registry для skills.
- Нормативный proof usable-skill строится на наличии корректного пакета, materialization и успешной загрузке adapter'ом, а не на дополнительной approval/state поверхности.

## Обратная связь оператора

- Оператор отдельно уточнил, что термины про lifecycle stages были не частью исходной концепции и не должны попадать в canonical contract этой фичи.
- Plan mode уже был использован до этого цикла; текущий этап реализует согласованный план без повторного plan-gate.

## События ревью

- Первый внешний независимый review от `019d9e1f-c44b-78f1-a7e9-459d23bacca0` (`gpt-5.4`, `high`, `spec-conformance-reviewer`) вернул два Major findings.
- Findings касались не самой shaped-спеки как таковой, а stale architecture coverage map и stale stage-log telemetry.
- После этих findings stage переходит в reround: нужно выровнять canonical architecture map и обновить stage-log под уже созданные actualization/verification artifacts.
- Второй review-раунд по обновлённому дереву вернул `PASS`; blocking findings больше не осталось.
- После этого был сделан ещё один короткий final smell-pass на уже полном closure tree, потому что stage-log и step artifact были дополнены после предыдущего PASS; финальный reround тоже вернул `PASS`.

## Актуализация беклога

- `CF-013` actualize-нут из `defined` в `specified` через authored patch `docs/backlog/patches/55a81e106ce4--f0022-spec-compact.patch.json`.
- Canonical immutable replay artifact: `docs/backlog/patches/1422085fe5e8--55a81e106ce4--f0022-spec-compact.patch.json`.
- Backlog state после apply показывает `delivery_state = specified`; новых blockers, dependencies или todo этот patch не создал.

## Промахи процесса

- `PM-001` (low): stage-log не был обновлён после backlog actualization и `dossier-verify` до первого внешнего review, из-за чего review справедливо вернул stale audit-trail finding.

## Закрытие этапа

- `dossier-verify` на финальном дереве прошёл повторно.
- PASS verdict зафиксирован в `.dossier/reviews/F-0022/spec-compact-64acbf62f0eb.json`.
- Шаг закрыт через `.dossier/steps/F-0022/spec-compact.json` с `process_complete=yes`.
- `dossier-step-close` запускался с `--allow-dirty`, потому что closure шёл по текущему mutating tree до commit; это trace-only bypass для worktree cleanliness gate, а не пропуск verification/review.
