```yaml
feature_id: F-0018
backlog_item_key: CF-014
stage: spec-compact
cycle_id: security-perimeter
session_id: 019d8db3-3b85-7153-ae96-2aed5f70c721
start_ts: 2026-04-14T22:57:43+02:00
ready_for_review_ts: 2026-04-14T23:06:52+02:00
final_pass_ts: 2026-04-14T23:14:04+02:00
source_inputs:
  - AGENTS.md
  - README.md
  - docs/ssot/index.md
  - docs/architecture/system.md
  - docs/polyphony_concept.md
  - docs/backlog/feature-candidates.md
  - docs/backlog/working-system-roadmap-matrix-2026-03-26.md
  - docs/features/F-0018-security-and-isolation-profile.md
  - docs/features/F-0002-canonical-monorepo-deployment-cell.md
  - docs/features/F-0010-executive-center-and-bounded-action-layer.md
  - docs/features/F-0013-operator-http-api-and-introspection.md
  - docs/features/F-0016-development-governor-and-change-management.md
  - docs/features/F-0017-git-managed-body-evolution-and-stable-snapshots.md
  - docs/adr/ADR-2026-03-19-phase0-deployment-cell.md
  - docs/adr/ADR-2026-03-19-canonical-runtime-toolchain.md
  - docs/adr/ADR-2026-03-19-quality-gate-sequence.md
  - docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md
repo_overlays:
  - AGENTS.md
log_required: true
log_required_reason:
  - backlog_actualization
  - open_question_resolution
backlog_actualized: true
verification_artifact: .dossier/verification/F-0018/spec-compact-2c0afcee7249.json
review_artifact: .dossier/reviews/F-0018/spec-compact-2c0afcee7249.json
step_artifact: .dossier/steps/F-0018/spec-compact.json
review_requested_ts: 2026-04-14T23:06:52+02:00
first_review_agent_started_ts: 2026-04-14T23:06:52+02:00
review_models:
  - gpt-5.4
review_retry_count: 1
review_wait_minutes: 7
transport_failures_total: 0
rerun_reasons:
  - review_findings
operator_review_interventions_total: 1
```

# Журнал специфицирования: F-0018 spec-compact

## Область работ

Сформировать compact specification для `CF-014` / `F-0018`: mature security/perimeter hardening как отдельный owner seam поверх уже delivered platform, API, governor и body-evolution substrate.

## Фактически использованные входы

- `AGENTS.md`
- `README.md`
- `docs/ssot/index.md`
- `docs/architecture/system.md`
- `docs/polyphony_concept.md`
- `docs/backlog/feature-candidates.md`
- `docs/backlog/working-system-roadmap-matrix-2026-03-26.md`
- `docs/features/F-0018-security-and-isolation-profile.md`
- Delivered prerequisite dossiers: `F-0002`, `F-0010`, `F-0013`, `F-0016`, `F-0017`
- Relevant ADRs: deployment cell, runtime substrate, quality gates

## Решения / реклассификации

- Plan mode assessment: не требуется; shaping ограничен одним dossier с уже выявленными owner seams и явным intake context.
- `Terms & thresholds` block обязателен и добавлен: без него `safety kernel`, `trusted control path` и `stronger human gate` читались бы неоднозначно.
- Authority split зафиксирован как `normative now`: `CF-014` hardens only trusted control paths; `CF-024` остаётся owner of caller admission; `F-0016` — owner of governor decision/evidence lifecycle; `F-0017` / `CF-025` / platform-runtime owners — owner of rollback/network actuation.
- Implementation freedom ограничена storage/evaluator shape и internal integration points, если AC/NFR/authority split не нарушены.
- Temporary assumptions before `plan-slice`: отсутствуют.

## Обратная связь оператора

- Пока нет на этой стадии.

## События ревью

- Независимый review cycle запрошен после `dossier-verify pass`.
- Reviewer A: содержательная проверка dossier и boundary semantics.
- Reviewer B: process/backlog/closure проверка.
- Round 1 verdict: `FAIL`.
- Reviewer A must-fix: явный source-of-truth для `human_override`, explicit ingress/authority contract для `force_rollback` и `disable_external_network`, более атомарный secret AC split.
- Reviewer B must-fix: stage log не был доведён до closure-ready telemetry; также reviewer трактовал internal verify artifact command strings как repo-local wrapper usage.
- Ответ на process finding зафиксирован здесь же: outer verification command был вызван через canonical installed runtime `/home/kostysh/.codex/skills/custom/skills/dossier-engineer/scripts/dossier.mjs`; строки вида `node scripts/dossier.mjs ...` внутри verification artifact — это self-reported inner commands инструмента, а не отдельный вызов repo-local wrapper из рабочей сессии.
- После round 1 dossier был доработан: human-override ownership clarified, ingress/authority contract added, secrets obligations split into separate ACs, verification artifact rebuilt, stage log refreshed. Выполняется reround.
- Reround verdict: `PASS` from both reviewers (`Averroes`, `Sagan`).
- Residual notes carried into `plan-slice`: keep `disable_external_network` integration early and fail-closed; preserve the no-second-ledger rule for perimeter audit/storage slices.

## Актуализация backlog

- Выполнена через `backlog-engineer patch-item`.
- `CF-014` переведён `defined -> specified` как dossier-backed shaping result.
- `CF-027` reread выполнен после dependency change: backlog field delta не требуется, mutation-managed `review_dependency_change` todo снят отдельным patch.

## Процессные промахи

- Пока нет.

## Закрытие

- `spec-compact` закрыт машинным `dossier-step-close`.
- `process_complete: true`.
- Следующий workflow stage: `plan-slice`.
