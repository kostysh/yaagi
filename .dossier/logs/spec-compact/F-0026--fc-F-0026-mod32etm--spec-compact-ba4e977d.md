---
version: 1
stage: spec-compact
feature_id: F-0026
feature_cycle_id: fc-F-0026-mod32etm
cycle_id: spec-compact-ba4e977d
backlog_item_key: CF-025
primary_feature_id: F-0026
primary_backlog_item_key: CF-025
phase_scope: spec-compact for CF-025 deploy release automation and rollback orchestration
stage_state: ready_for_close
start_ts: 2026-04-24T16:32:43.331Z
entered_ts: 2026-04-24T16:32:43.331Z
ready_for_close_ts: 2026-04-24T16:37:05.152Z
transition_events:
  - kind: entered
    at: 2026-04-24T16:32:43.331Z
  - kind: ready_for_close
    at: 2026-04-24T16:37:05.152Z
backlog_followup_required: false
backlog_followup_kind: null
backlog_followup_resolved: true
backlog_lifecycle_target: specified
backlog_lifecycle_current: specified
backlog_lifecycle_reconciled: true
backlog_actualization_artifacts: []
backlog_actualization_verdict: current_state_satisfies_target
review_artifacts: []
verification_artifacts: []
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
skills_used:
  - unified-dossier-engineer
skill_issues: []
skill_followups: []
process_misses: []
session_id: 019dc028-2688-7791-a888-53c3018aa4d8
trace_runtime: codex
trace_locator_kind: session_id
final_delivery_commit: 14ee936132f50fef5cfbf0ac8c0d250ed0e15184
final_closure_commit: null
step_artifact: null
---

## Scope

- Сформирована компактная спецификация `F-0026` для backlog item `CF-025`.
- Область ограничена deploy/release automation и rollback orchestration: release request, deploy attempt, release evidence bundle, rollback plan и rollback execution.
- Код, миграции, CI и runtime-поведение в этой стадии не менялись.

## Inputs actually used

- Repo overlay: `AGENTS.md`.
- Plan mode assessment: Plan mode был нужен и использован, потому что перед `spec-compact` оставались пользовательские развилки по средам, хранилищу доказательств, праву rollback и поверхности управления.
- Решения оператора из Plan mode: `local + release cell`; `PostgreSQL + files`; automatic rollback on failed smoke; `CLI + API`; feature-local ADR first.
- Backlog card: `dossier-engineer items --item-keys CF-025`.
- Архитектура и runtime: `README.md`, `docs/architecture/system.md`, `docs/polyphony_concept.md`.
- Legacy backlog sources: `docs/notes/backlog-legacy/feature-candidates.md`, `docs/notes/backlog-legacy/working-system-roadmap-matrix-2026-03-26.md`.
- Repo ADRs: `ADR-2026-03-19-canonical-runtime-toolchain`, `ADR-2026-03-19-phase0-deployment-cell`, `ADR-2026-03-19-quality-gate-sequence`.
- Соседние dossiers: `F-0002`, `F-0007`, `F-0016`, `F-0019`, `F-0020`, `F-0023`, `F-0024`.

## Decisions / reclassifications

### Spec gap decisions

- `F-0026` является единственным владельцем release/deploy/rollback фактов: release requests, deploy attempts, release evidence, rollback plans и rollback execution records.
- `F-0026` не владеет deployment cell, smoke harness, model-serving readiness, governor decisions, lifecycle evidence или diagnostic report materialization; эти поверхности потребляются read-only.
- Первая средовая модель ограничена `local` и `release_cell`; новый orchestration substrate не вводится.
- PostgreSQL является источником release decisions/state; файлы допустимы только как связанные evidence artifacts.
- Failed smoke-on-deploy должен запускать automatic rollback, если есть записанный rollback plan и rollback можно записать.
- Repo-level ADR пока не нужен; он станет обязательным только при изменении общих startup/deployment контрактов, новом orchestration substrate или смене owner write boundaries.

### Implementation freedom decisions

- `plan-slice` может выбрать точные имена таблиц, модулей и команд, если сохранены отдельные semantic surfaces из секции 5.3.
- CLI и protected Operator API должны вызывать один и тот же release service; различаться может только транспорт и способ допуска.
- `release_cell` можно реализовывать как production-like контур поверх существующего deployment-cell контракта, но не как отдельную скрытую stack-топологию.
- File evidence layout можно уточнить позже, если PostgreSQL records остаются авторитетными для решений и состояния.

### Temporary assumptions

- Зависимости `F-0002`, `F-0007`, `F-0016`, `F-0019`, `F-0020`, `F-0023` и `F-0024` достаточно реализованы для стадии `spec-compact`.
- `CF-025` не требует разделения backlog item на несколько features на этой стадии.
- Первое включение release path должно начинаться с `local` и не менять внешнюю доступность до появления достаточной evidence bundle.

## Operator feedback

- Оператор попросил выполнять workflow канонически.
- Оператор уточнил, что вопросы в режиме планирования должны быть проще и яснее, с меньшим количеством англицизмов.
- Оператор одобрил выбранные Plan mode решения для этой спецификации.

## Review events

none

## Backlog follow-up

- `spec-compact` выявил обязательную backlog actualization: `CF-025` должен перейти из `defined` в `specified`.
- Applied canonical backlog patch `.dossier/backlog/patches/9cff4f89b443--2026-04-24-050-f0026-spec-compact-actualization.patch.json`.
- Re-ran `spec-compact --ready-for-close --backlog-followup-resolved`; stage state records `backlog_lifecycle_current: specified`, `backlog_lifecycle_reconciled: true`, `backlog_followup_required: false`.
- Patch created dependency-change review TODOs for dependent backlog items `CF-019` and `CF-026`; they are visible through `dossier-engineer attention`.

## Process misses

none

## Transition events

- 2026-04-24T16:32:43.331Z: entered
- 2026-04-24T16:37:05.152Z: ready_for_close

## Close-out

- Stage is ready for dossier verification and independent `spec-conformance-reviewer` review.
- Truthful closure still requires `dossier-verify`, a PASS review artifact from an independent reviewer, and `dossier-step-close`.
