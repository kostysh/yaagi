---
feature_id: F-0019
backlog_item_key: CF-018
stage: plan-slice
cycle_id: c01
session_id: 019d919b-5b39-7992-b92a-a4b3c75fdfc8
start_ts: 2026-04-15T17:48:34+02:00
source_inputs:
  - AGENTS.md
  - docs/AGENTS.md
  - README.md
  - docs/ssot/index.md
  - docs/architecture/system.md
  - docs/backlog/feature-candidates.md
  - docs/features/F-0019-consolidation-event-envelope-graceful-shutdown.md
  - docs/features/F-0011-narrative-and-memetic-reasoning-loop.md
  - docs/features/F-0012-homeostat-and-operational-guardrails.md
  - docs/features/F-0015-workshop-datasets-training-eval-and-promotion.md
  - docs/features/F-0016-development-governor-and-change-management.md
  - docs/features/F-0017-git-managed-body-evolution-and-stable-snapshots.md
  - docs/adr/ADR-2026-03-19-canonical-runtime-toolchain.md
  - docs/adr/ADR-2026-03-19-quality-gate-sequence.md
  - docs/adr/ADR-2026-03-23-no-technical-debt-rule.md
  - docs/adr/ADR-2026-03-23-plan-mode-decision-gate.md
repo_overlays:
  - AGENTS.md
  - docs/AGENTS.md
log_required: true
log_required_reason:
  - backlog_actualization
  - multi_slice_planning
  - runtime_boundary_planning
backlog_actualized: true
backlog_artifact_integrity: pass
planned_slices:
  - SL-F0019-01
  - SL-F0019-02
  - SL-F0019-03
  - SL-F0019-04
  - SL-F0019-05
slice_status:
  SL-F0019-01: planned
  SL-F0019-02: planned
  SL-F0019-03: planned
  SL-F0019-04: planned
  SL-F0019-05: planned
current_checkpoint: plan_slice_closed
completion_decision: process_complete
operator_command_refs:
  - cmd-001: "Ок, Делай комит и приступай к plan-slice"
process_miss_refs:
  - pm-001
review_events:
  - .dossier/reviews/F-0019/plan-slice-66d9aae50aad.json
---

# plan-slice c01

## Область

`plan-slice` для `F-0019`. Цель цикла: превратить shaped spec в проверяемую последовательность implementation slices, зафиксировать allowed stop points и актуализировать backlog state до `planned`.

## Фактически использованные входы

- `F-0019` уже `shaped`, `coverage_gate: deferred`, открытых вопросов после `spec-compact` нет.
- Backlog truth: `CF-018` = `specified`, gaps/todo отсутствуют, задача готова к планированию.
- Repo overlays требуют Plan mode assessment до `plan-slice`, русский язык для logs и docs, installed skill runtimes для automation.
- План активации из `spec-compact` уже задаёт естественную последовательность: event contract -> consolidation allowlist -> retention/compaction -> graceful shutdown -> downstream reads.

## Решения / реклассификации

### Решения по slice boundary

- `SL-F0019-01` убивает самый ранний machine-contract risk: envelope fields, idempotency и foreign-owner write rejection до любых lifecycle side effects.
- `SL-F0019-02` отделяет consolidation transition allowlist от retention/shutdown, чтобы durable narrative/memetic transitions не расширяли scope.
- `SL-F0019-03` ставит retention/compaction до graceful shutdown, но только в non-destructive/aggregate-first режиме.
- `SL-F0019-04` изолирует runtime shutdown behavior, потому что он может потребовать container smoke.
- `SL-F0019-05` оставляет downstream read contracts и usage audit на финальный срез, когда lifecycle facts уже существуют.

### Решения по implementation freedom

- Physical table names, internal service/module names и конкретная job scheduling форма остаются implementation freedom, если сохраняются source surfaces, event contract и repo runtime path.
- `prepare_dataset_candidate` может быть сначала disabled/fallback path, если workshop projection contract окажется недостаточным.

### Временные предположения

- Первый delivery может идти без destructive compaction; если это неверно, implementation должна остановиться на allowed stop point и realign dossier/backlog до активации.
- `CF-015` и `CF-025` остаются future-owned: `F-0019` поставляет canonical facts/read contracts, но не materializes reports и не orchestrates release rollback.

## Обратная связь оператора

- `cmd-001`: оператор попросил сделать commit и начать `plan-slice`.
- Commit для предыдущего исправления уже был сделан как `66d9aae`; новых релевантных изменений перед стартом `plan-slice` не было.
- Plan mode assessment вынесен в user update: Plan mode не требуется, потому что open questions нет, порядок активации уже задан в `F-0019`, а новая пользовательская развилка не выявлена.

## События ревью

- Independent reviewer `Archimedes-019d91ec`: PASS after semantic-preserving Russian localization.
- Review artifact: `.dossier/reviews/F-0019/plan-slice-66d9aae50aad.json`.
- Blocking findings: none.
- Residual risk: 18 informational missing AC references remain expected for `coverage_gate: deferred`.
- Review scope included dossier, stage log, verification artifact, `CF-018` backlog state, canonical patch and prior review artifact.

## Верификация

- `dossier-verify --step plan-slice --coverage-orphans-scope auto`: pass.
- Verification artifact: `.dossier/verification/F-0019/plan-slice-66d9aae50aad.json`.
- Included checks: `index-refresh`, `lint-dossiers`, `coverage-audit`, `debt-audit`, `git-diff-check`.

## Актуализация backlog

- Patch dry-run: `counts.updated=1`, `todo_created=0`, `todo_updated=0`, `todo_removed=0`.
- Applied patch: `docs/backlog/patches/2026-04-15-026-f-0019-plan-slice-actualization.template.json`.
- Canonical replay artifact: `docs/backlog/patches/6a3f1ca0a474--2026-04-15-026-f-0019-plan-slice-actualization.template.json`.
- Backlog status after apply: `planned_count=2`, `artifact_integrity.applied_canonical_paths_exist=true`.
- `CF-018` actualized from `specified` to `planned`.
- New TODO from this patch: none.
- Backlog attention after apply still shows dependency review for `CF-014`, `CF-015`, `CF-019`, `CF-025`, `CF-026`, `CF-027` because they depend on `CF-018`.

## Процессные сбои

- `pm-001`: pre-commit review обнаружил, что первый вариант `plan-slice` section в dossier был слишком англоязычным для repo rule о русском основном языке docs/logs.
- Correction: локализован planning text без изменения slice order, AC mapping, backlog state или verification contract.

## Закрытие

- Step closure artifact: `.dossier/steps/F-0019/plan-slice.json`.
- `dossier-step-close --step plan-slice`: `process_complete=yes`.
- Debt review: explicit marker audit passed; no unresolved debt markers in changed scope.
- Dependency/seam re-check: `CF-018` dependencies surfaced through backlog attention for downstream review; no new prerequisite seam blocks implementation planning.
- Review freshness: PASS review remains fresh; edits after review only record review/closure process artifacts and do not change executable dossier sections, backlog state, architecture, ADRs, code or tests.
