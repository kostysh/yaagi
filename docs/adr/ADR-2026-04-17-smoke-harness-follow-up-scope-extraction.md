# ADR-2026-04-17 Smoke Harness Follow-up Scope Extraction

- Status: Accepted
- Date: 2026-04-17
- Related:
  - [F-0007](../features/F-0007-deterministic-smoke-harness-and-suite-scoped-cell-lifecycle.md)
  - [F-0020](../features/F-0020-real-vllm-serving-and-promotion-model-dependencies.md)
  - [ADR-2026-03-19 Phase-0 Deployment Cell](./ADR-2026-03-19-phase0-deployment-cell.md)

## Context

`F-0007` уже delivered: suite-scoped smoke harness, deterministic reset barriers и shared Telegram overlay были реализованы и закрыты как исторический seam `CF-022`.

После `F-0020`, где `vllm-fast` стал реальным `Gemma`-backed runtime, обнаружился новый класс bottleneck'ов. Это не отменяет delivered truth `F-0007`, но делает необходимым отдельный follow-up на orchestration costs вокруг уже существующего smoke harness.

Ключевая проблема в том, что новые bottleneck'и относятся не к самому факту suite-scoped smoke harness, а к post-`F-0020` runtime path:

- steady-state DB polling всё ещё идёт через `docker compose exec postgres psql`;
- часть сценариев ждёт составное DB состояние серией последовательных polling calls;
- Telegram overlay допускает redundant rebuild path;
- startup/overlay readiness держит лишние waits поверх уже существующего compose/service health.

Если reopen-ить `F-0007` как будто delivered seam снова стал `planned`, backlog потеряет честную историю `CF-022`. Нужен отдельный backlog delta, который опирается на already delivered smoke harness и на already delivered real-serving seam.

## Decision

Post-`F-0020` smoke-harness optimization живёт как отдельный backlog delta поверх delivered `F-0007`, а не как reopen старого seam.

Carrier decision:

- `F-0007` остаётся delivered feature dossier и историческим описанием уже поставленного smoke harness;
- backlog follow-up uses this ADR plus `docs/architecture/system.md` as canonical registered sources;
- отдельный backlog item owns the new work; existing `CF-022` history is not rewritten.

Canonical follow-up scope is limited to four points:

1. Заменить steady-state `docker compose exec postgres psql` на smoke-only published PostgreSQL port и один direct `pg` client.
2. Схлопнуть последовательные DB waits в predicate waits и batched readouts.
3. Убрать redundant `--build` из Telegram overlay и сохранить reuse того же shared model runtime.
4. Подчистить startup/overlay readiness вокруг compose/service health и оставить только domain-specific waits.

Explicit exclusions:

- profiling counters и отдельная instrumentation не входят в follow-up scope;
- `Gemma`/`vLLM` selection или serving contract не пересматриваются;
- `CF-022` delivery state не возвращается в `planned`.

## Consequences

- Backlog actualization for the follow-up should create a new item instead of reopening `CF-022`.
- `F-0007` change-proposal may document the extracted delta, but the authoritative backlog source for that delta is this ADR, not the historical dossier itself.
- Any future implementation on this seam must depend on both the delivered smoke harness (`CF-022`) and the delivered real-serving seam (`CF-023`).
