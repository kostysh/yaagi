---
feature_id: F-0021
backlog_item_key: CF-028
stage: implementation
cycle_id: c01
session_id: 019d95c3-2088-7a01-88bb-e20d2b203438
start_ts: 2026-04-17T20:36:06+02:00
source_inputs:
  - AGENTS.md
  - README.md
  - docs/ssot/index.md
  - docs/architecture/system.md
  - docs/features/F-0021-smoke-harness-post-f0020-runtime-optimization.md
  - docs/adr/ADR-2026-04-17-smoke-harness-follow-up-scope-extraction.md
  - docs/adr/ADR-2026-03-19-phase0-deployment-cell.md
repo_overlays:
  - AGENTS.md
log_required: true
log_required_reason:
  - multi_slice_implementation
  - source_and_test_changes
  - runtime_contract_changes
planned_slices:
  - SL-F0021-01
  - SL-F0021-02
  - SL-F0021-03
  - SL-F0021-04
slice_status:
  SL-F0021-01: implemented
  SL-F0021-02: implemented
  SL-F0021-03: implemented
  SL-F0021-04: implemented
current_checkpoint: implementation_close_ready
completion_decision: closeout_ready
canonical_for_commit: false
generated_after_commit: false
freshness_basis: not_applicable
operator_command_refs:
  - cmd-001: "Выполни имплементацию"
review_events: []
review_retry_count: 0
review_wait_minutes: 0
transport_failures_total: 0
rerun_reasons:
  - full_container_smoke_interrupted_by_host_reset
  - direct_pg_host_port_unpublished_until_core_net_attach
  - periodic_snapshot_race_and_reset_wait_regression_corrected
  - telegram_overlay_ingest_predicate_timeout_window_tuned
operator_review_interventions_total: 0
---

# Журнал implementation: F-0021 c01

## Scope

Реализую полный implementation scope `F-0021`: direct `pg` query substrate, base-family predicate waits, Telegram overlay cleanup, timing-evidence closure и docs/runtime drift guard.

## Inputs actually used

- Repo overlays из `AGENTS.md` требуют canonical `pnpm format -> pnpm typecheck -> pnpm lint`, обязательный `pnpm test` и `pnpm smoke:cell` для runtime/deployment changes, а также русский язык для stage-log.
- `F-0021` стартует из `planned` с четырьмя slices и явно разрешёнными stop points.
- `README.md` уже фиксирует shared-runtime smoke contract после `F-0020`; реализация должна сохранить этот contract, а не переизобрести topology.

## Closeout intent

- Закрыть все четыре implementation slices в одном cycle, если не возникнет новая prerequisite seam или blocker.
- Не объявлять step complete до quality gates, smoke, внешних audits, backlog verdict и `dossier-step-close`.

## Planned implementation focus

- Вынести steady-state PostgreSQL polling из `compose exec psql` в один persistent direct `pg` client с явным lifecycle management.
- Схлопнуть последовательные wait chains в predicate/batched waits и сократить лишние readiness loops.
- Убрать redundant Telegram overlay rebuild path, сохранив reuse того же shared `vllm-fast` runtime.
- Зафиксировать before/after evidence protocol и docs/runtime parity к closure.

## Выполненная реализация

- В `infra/docker/deployment-cell.smoke.ts` заменён steady-state PostgreSQL path: repeated `docker compose exec postgres psql` убран, вместо него используется один direct `pg` client с явным connect/close lifecycle и fail-closed поведением.
- В `infra/docker/compose.smoke-base.yaml` вынесен smoke-only published PostgreSQL port для локального harness-side query channel, без расширения product runtime surface базового `compose.yaml`.
- В base-family и Telegram smoke сценариях последовательные DB waits для одного доменного outcome схлопнуты в `waitForPostgresPredicate(...)` + batched JSON readout.
- В Telegram overlay orchestration убран redundant `--build`; overlay теперь идёт по `--no-build --force-recreate --wait` path и сохраняет reuse того же shared `vllm-fast` runtime.
- В `README.md` зафиксирован обновлённый smoke contract, а contract tests синхронизированы с новым harness поведением.
- В `test/platform/dependency-refresh.test.ts` зафиксирована новая root devDependency `pg`.

## Состояние slices

- `SL-F0021-01`: implemented.
- `SL-F0021-02`: implemented.
- `SL-F0021-03`: implemented.
- `SL-F0021-04`: implemented.

## Проверки final tree

- `pnpm format`: pass.
- `pnpm typecheck`: pass.
- `pnpm lint`: pass.
- `pnpm test`: pass.
- `pnpm smoke:cell`: pass.

## Финальное timing evidence

- Durable artifact: `.dossier/evidence/F-0021/implementation-smoke-timing-c01.json`.
- Baseline shared-runtime snapshot из `F-0007`: total `321.06s`, base family `96.02s`, Telegram overlay `14.16s`.
- Candidate implementation run на той же машине и с warm `models_state`/HF cache:
  - `pnpm smoke:cell`: `real 304.57`
  - `F-0007 deployment-cell smoke suite`: `304276.76881 ms`
  - `F-0007 base deployment-cell smoke family`: `88602.883143 ms`
  - `F-0007 telegram deployment-cell smoke overlay`: `11952.834793 ms`
- Budget verdict:
  - total suite не регрессировал относительно baseline;
  - base family стал быстрее (`88.60s` против `96.02s`);
  - Telegram overlay стал быстрее (`11.95s` против `14.16s`).

## Процессные наблюдения

- Полный `smoke:cell` после рефакторинга был запущен с wall-clock capture, но хост завис во время containerized прогона и потребовал аппаратный reset. После перезагрузки в Docker остались residue containers `yaagi-phase0-*`; они были сняты вручную через `docker compose ... down --remove-orphans`.
- Root cause первого regression/failure цикла оказался не в модели, а в smoke harness:
  - direct `pg` path сначала не публиковался наружу, пока `postgres` висел только на `internal` сети;
  - usage-audit assertion читала `latest periodic snapshot`, а не конкретный `snapshot_id`, из-за чего ловила фоновый periodic worker;
  - reset path через `compose up --wait core` реинициализировал `core` по Docker health contract с лишним `start_period`, что ухудшало общий wall-clock.
- После исправления этих точек containerized smoke больше не вешает хост в safe-run режиме с выводом в файл и даёт валидный final verdict.
- После введения explicit `pg` timeout boundary один rerun словил Telegram overlay flake на `20s` predicate window; после расширения этого окна до `45s` финальный full smoke снова завершился зелёно на том же tree.
