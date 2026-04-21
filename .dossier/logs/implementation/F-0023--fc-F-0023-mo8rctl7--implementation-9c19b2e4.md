---
version: 1
stage: implementation
feature_id: F-0023
feature_cycle_id: fc-F-0023-mo8rctl7
cycle_id: implementation-9c19b2e4
backlog_item_key: CF-015
stage_state: ready_for_close
start_ts: 2026-04-21T16:22:01.157Z
entered_ts: 2026-04-21T16:22:01.157Z
ready_for_close_ts: 2026-04-21T21:58:55.802Z
transition_events:
  - kind: entered
    at: 2026-04-21T16:22:01.157Z
  - kind: ready_for_close
    at: 2026-04-21T21:58:55.802Z
backlog_followup_required: true
backlog_followup_kind: patch existing item
backlog_followup_resolved: true
session_id: null
trace_runtime: codex
trace_locator_kind: session_id
local_gates_green_ts: 2026-04-21T21:58:55.802Z
---

## Scope

- Завершить весь `F-0023` scope без открытия follow-up dossier: canonical `report_runs`, все first-phase report families, Homeostat read contract для `organ_error_rate`, read-only operator exposure и usage-audit proof.
- Довести implementation до canonical closure bundle после обязательных repo gates и container smoke.

## Inputs actually used

- `docs/ssot/features/F-0023-observability-and-diagnostic-reporting.md`
- `docs/architecture/system.md`
- `apps/core/src/runtime/homeostat.ts`
- `apps/core/src/runtime/runtime-lifecycle.ts`
- `apps/core/src/platform/operator-api.ts`
- `apps/core/src/runtime/reporting.ts`
- `packages/contracts/src/reporting.ts`
- `packages/db/src/reporting.ts`
- `infra/migrations/019_reporting_foundation.sql`

## Decisions / reclassifications

### Spec gap decisions

- none

### Implementation freedom decisions

- Вместо поочередного multi-commit closure по каждому planned slice реализация была сведена в один cohesive implementation cycle, потому что `report_runs`, store, runtime materialization, Homeostat consumer и operator read boundary образуют один shared executable contract и дают более честную verification surface только вместе.
- Public read exposure ограничен одним read-only `GET /reports` внутри уже delivered `F-0013` boundary; отдельный gateway, file export server или write-capable reporting route не вводились.
- Post-commit materialization закреплена как lifecycle hook после committed tick, чтобы `CF-015` читал только committed source state и не становился owner-ом tick-local draft semantics.

### Temporary assumptions

- Существующие source-owner seams (`F-0001`, `F-0003`, `F-0008`, `F-0010`, `F-0014`, `F-0016`, `F-0017`, `F-0019`) уже достаточно delivered, чтобы first-phase report families materialize-ились без нового backlog realignment.
- Existing container smoke path остается обязательным финальным runtime proof, потому что implementation меняет runtime lifecycle and operator read behavior.

## Operator feedback

none

## Review events

- Implementation self-review и canonical review-artifact будут записаны только после прохождения root quality bundle, `pnpm smoke:cell` и backlog actualization для `CF-015`.

## Backlog follow-up

- Truthful implementation closure требует `patch existing item` для `CF-015`: delivery state должен перейти из `planned` в `implemented` без изменения dependency graph и source-review truth.

## Process misses

- В ходе первой smoke replay surfaced runtime SQL defect в reporting store: aliased `RETURNING` clauses на derived report tables ломали post-commit materialization и оставляли `homeostat_snapshots` без tick-complete evidence. Дефект был исправлен внутри того же implementation cycle до финального green smoke verdict.

## Transition events

- 2026-04-21T16:22:01.157Z: entered
- 2026-04-21T21:58:55.802Z: ready_for_close

## Close-out

- pending canonical `implementation -> patch-item -> dossier-verify -> review-artifact -> dossier-step-close -> lifecycle-refresh`

## Notes

- Реально delivered scope вышел за исходный `SL-F0023-01`: в одном cycle закрыты `SL-F0023-01`..`SL-F0023-05`, потому что store/runtime/operator boundary оказались одним executable seam и раздельные partial closures не давали truthful smoke/runtime proof.

- Backlog actualization for CF-015 completed; dependent review todos cleared without additional backlog mutations.
