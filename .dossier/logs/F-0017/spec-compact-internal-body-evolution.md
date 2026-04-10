```yaml
feature_id: F-0017
backlog_item_key: CF-012
stage: spec-compact
cycle_id: internal-body-evolution
session_id: 019d7490-46d0-7811-b43f-056bb617a7ab
start_ts: 2026-04-10T19:57:11+02:00
ready_for_review_ts: 2026-04-10T20:03:08+02:00
final_pass_ts: 2026-04-10T20:11:22+02:00
source_inputs:
  - AGENTS.md
  - README.md
  - docs/ssot/index.md
  - docs/architecture/system.md
  - docs/polyphony_concept.md
  - docs/backlog/feature-candidates.md
  - docs/backlog/working-system-roadmap-matrix-2026-03-26.md
  - docs/features/F-0017-git-managed-body-evolution-and-stable-snapshots.md
  - docs/features/F-0001-constitutional-boot-recovery.md
  - docs/features/F-0002-canonical-monorepo-deployment-cell.md
  - docs/features/F-0010-executive-center-and-bounded-action-layer.md
  - docs/features/F-0015-workshop-datasets-training-eval-and-promotion.md
  - docs/features/F-0016-development-governor-and-change-management.md
repo_overlays:
  - AGENTS.md
log_required: true
log_required_reason:
  - backlog_actualization
  - open_question_resolution
  - operator_clarification
  - retrospective_process_telemetry
backlog_actualized: true
verification_artifact: .dossier/verification/F-0017/spec-compact-4b45c0da826e.json
review_artifact: .dossier/reviews/F-0017/spec-compact-4b45c0da826e.json
step_artifact: .dossier/steps/F-0017/spec-compact.json
```

# Журнал специфицирования: F-0017 spec-compact

## Область работ

Сформировать compact specification для `CF-012` / `F-0017`: внутренний безопасный механизм body evolution через Git/worktree discipline, stable snapshot contract и governor evidence handoff.

## Фактически использованные входы

- `AGENTS.md`
- `README.md`
- `docs/ssot/index.md`
- `docs/architecture/system.md`
- `docs/polyphony_concept.md`
- `docs/backlog/feature-candidates.md`
- `docs/backlog/working-system-roadmap-matrix-2026-03-26.md`
- `docs/features/F-0017-git-managed-body-evolution-and-stable-snapshots.md`
- Delivered prerequisite dossiers: `F-0001`, `F-0002`, `F-0010`, `F-0015`, `F-0016`

## Решения / реклассификации

- Plan mode assessment: не требуется, потому что scope ограничен одним dossier, решение по `CF-024`/`CF-025` уже принято оператором, а дальнейшая работа выполняется по стандартному dossier workflow.
- Logging required: да; stage меняет dossier truth, должен actualize backlog до `specified`, и сохраняет операторское решение о cap текущего `CF-012`.
- Предварительная классификация `CF-024`/`CF-025`: текущий `CF-012` ограничивается internal safe mechanism; full public/operator RBAC и deploy/release maturity остаются будущими capabilities.
- Terms & thresholds trigger: сработал, потому что spec вводит `materialized writable body`, `body change proposal`, `stable snapshot`, `internal safe mechanism`, `full mechanism`.
- AC changes summary: добавлены `AC-F0017-01`–`AC-F0017-33`; после smell pass AC разделены на атомарные observable obligations.
- Open questions: intake-вопросы по `CF-024`/`CF-025`, stable snapshot ownership и обязательным eval gates закрыты через `PD-F0017-01`–`PD-F0017-04`.
- Normative now: `CF-012` реализует internal safe mechanism; candidate commit требует repo gates плюс proposal eval suite; runtime/startup/deployment changes требуют `pnpm smoke:cell`; `/seed/body` остается immutable input.
- Operator/agent contract: F-0017 публикует только internal service/command surfaces, без public/operator execution route до `CF-024`.

## Обратная связь оператора

- Оператор подтвердил: сейчас нужен внутренний безопасный механизм body evolution без публичного RBAC и без полного deploy pipeline; позднее `CF-024` и `CF-025` должны довести механизм до полноценного.

## События ревью

- 2026-04-10T20:03:08+02:00 `spec-compact` готов к dossier verification и independent review.
- 2026-04-10T20:10:19+02:00 `dossier-verify` pass: `.dossier/verification/F-0017/spec-compact-4b45c0da826e.json`.
- 2026-04-10T20:05:xx+02:00 independent review initial PASS по scope/ownership/AC/design, residual risk по `human_override` authority path.
- 2026-04-10T20:07:xx+02:00 follow-up review FAIL: gate decision list оставался governor-only для missing approval.
- 2026-04-10T20:10:xx+02:00 follow-up fix applied: `human_override` отделен как alternative authority path; gate decision list добавил `override_not_recorded`.
- 2026-04-10T20:10:48+02:00 independent review final PASS: blocker resolved, новых spec-compact blockers нет.

## Актуализация backlog

- 2026-04-10T20:09:12+02:00 `CF-012` актуализирован через `backlog-engineer patch-item` с `defined` до `specified`.
- Patch artifact: `docs/backlog/patches/b961edda66bd--010-patch.template.json`.
- Побочный mutation-managed dependency review todo появился на `CF-014` и `CF-027`, потому что upstream `CF-012` изменился.
- Review результата: `CF-014` уже содержит `CF-012` как prerequisite, `CF-027` зависит от `CF-014`; фактическая task truth не требовала правки.
- 2026-04-10T20:09:46+02:00 mutation-managed todo закрыты через `backlog-engineer patch-item remove_todo`.
- Patch artifact: `docs/backlog/patches/dd536535d944--011-patch.template.json`.
- Финальный backlog status: `specified_count=1`, `needs_attention_count=0`, `open_todo_count=0`; `CF-012.ready_for_next_step=true`.

## Процессные промахи

- Review reround: initial residual risk по `human_override` был устранен до closure; процессный дефект не остается открытым.

## Закрытие

- 2026-04-10T20:11:22+02:00 `dossier-step-close` pass: `.dossier/steps/F-0017/spec-compact.json`.
- Следующий dossier stage: `plan-slice`.
