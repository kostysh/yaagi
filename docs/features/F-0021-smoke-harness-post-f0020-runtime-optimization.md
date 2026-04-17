---
id: F-0021
title: Оптимизация smoke harness после real vLLM/Gemma runtime
status: proposed
coverage_gate: deferred
owners: ["@codex"]
area: platform
depends_on: ["F-0007", "F-0020"]
impacts: ["runtime", "infra", "verification", "smoke", "db"]
created: 2026-04-17
updated: 2026-04-17
links:
  issue: ""
  pr: []
  docs:
    - "README.md"
    - "docs/architecture/system.md"
    - "docs/adr/ADR-2026-04-17-smoke-harness-follow-up-scope-extraction.md"
    - "docs/features/F-0007-deterministic-smoke-harness-and-suite-scoped-cell-lifecycle.md"
    - "docs/features/F-0020-real-vllm-serving-and-promotion-model-dependencies.md"
---

## 1. Context & Goal

- **Backlog handoff:**
  - Backlog item key: CF-028
  - Backlog delivery state at intake: planned
  - Source traceability:
    - ../adr/ADR-2026-04-17-smoke-harness-follow-up-scope-extraction.md
    - ../architecture/system.md
  - Known blockers at intake:
    - none recorded
  - Known dependencies at intake:
    - CF-022
    - CF-023
- **User problem:** После `F-0020` smoke harness работает поверх реального `Gemma`/`vLLM` runtime, и orchestration overhead вокруг него стал отдельной проблемой. Текущий `pnpm smoke:cell` сохраняет покрытие, но часть стоимости и нестабильности создают не сами сценарии, а способ общения harness с PostgreSQL, лишние readiness loops и redundant overlay orchestration.
- **Goal:** Упростить и удешевить канонический containerized smoke path без потери функциональности, покрытия и shared-runtime topology. Целевой результат: `smoke:cell` остаётся тем же repo-level verification path, но перестаёт тратить время и ресурсы на avoidable orchestration work.
- **Non-goals:** Эта фича не меняет выбор `Gemma`/`vLLM`, не ослабляет smoke coverage, не добавляет profiling counters как обязательный deliverable и не меняет продуктовый runtime вне smoke harness.
- **Current substrate / baseline:** Базовый substrate уже delivered через `F-0007` и `F-0020`: один shared deployment cell, Telegram overlay поверх него и один реальный `vllm-fast`/`Gemma` runtime. Follow-up работает поверх этого delivered baseline, а не переоткрывает его.

### Terms & thresholds

- `shared runtime`: один `vllm-fast`/`Gemma` container, который reuse-ится базовой smoke family и Telegram overlay.
- `steady-state DB polling`: повторяющиеся harness-side SQL checks после suite startup, не относящиеся к initial compose bootstrap.
- `domain-specific wait`: wait за runtime/DB condition, которую нельзя честно заменить только Docker/Compose health barrier.

## 2. Scope

### In scope

- Замена steady-state PostgreSQL polling path с `docker compose exec postgres psql` на smoke-only direct `pg` client.
- Схлопывание последовательных DB waits в predicate waits и batched readouts там, где проверяется одно доменное состояние.
- Удаление redundant `--build` из Telegram overlay при сохранении shared-runtime reuse.
- Health-first cleanup startup/overlay waits с сохранением только domain-specific barriers поверх compose/service health.
- Снятие before/after evidence по времени и cost profile `pnpm smoke:cell` после реализации follow-up.

### Out of scope

- Любая смена model/runtime contract, включая выбор `Gemma`, `vLLM` image, manifest или serving flags.
- Снижение AC coverage за счёт выноса smoke scenarios из канонического container path без явной replacement ownership.
- Общая оптимизация всего test/tooling stack репозитория вне `pnpm smoke:cell`.
- Обязательное добавление универсальной runtime instrumentation или profiling counters в harness.

### Constraints

- `pnpm smoke:cell` остаётся каноническим containerized smoke path из repo overlay.
- Telegram overlay не должен снова материализовать второй `vllm-fast` runtime или второй `Gemma` stack.
- Follow-up не должен возвращать `F-0007` / `CF-022` в активный delivery lifecycle.
- Изменения в harness должны проходить canonical quality gate order `format -> typecheck -> lint`, а затем `pnpm test` и `pnpm smoke:cell`.

### Assumptions (optional)

- Smoke-only published PostgreSQL port можно открыть без нового product-facing security surface, потому что он живёт внутри local deployment-cell workflow.
- Compose/service health already exists and can serve as the first readiness barrier before domain-specific waits.
- Основной выигрыш времени лежит в harness orchestration, а не в повторном подборе model runtime.

### Open questions (optional)

- Нужен ли отдельный smoke-local port allocation contract, чтобы гарантировать отсутствие локальных collisions при параллельных runs?
- Нужен ли отдельный helper для batched predicate waits, или достаточно сузить существующие wait helpers без новой abstraction surface?

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0021-01:** Steady-state PostgreSQL polling inside `pnpm smoke:cell` uses a smoke-only direct `pg` client instead of repeated `docker compose exec postgres psql`.
- **AC-F0021-02:** Telegram overlay reuses the same shared deployment cell and the same already-started `vllm-fast` runtime as the base smoke family.
- **AC-F0021-03:** Telegram overlay activation does not issue redundant `--build` for unchanged services.
- **AC-F0021-04:** Sequential DB waits that guard one domain outcome are collapsed into predicate waits and batched readouts without reducing asserted smoke conditions.
- **AC-F0021-05:** Startup and Telegram overlay orchestration treat compose/service health as the first readiness barrier and keep only explicit domain-specific waits above it.
- **AC-F0021-06:** `pnpm smoke:cell` preserves current base-family and Telegram-family verification semantics after the harness refactor.
- **AC-F0021-07:** `pnpm smoke:cell` still completes without orphaned `yaagi-phase0*` resources.
- **AC-F0021-08:** The follow-up records before/after execution evidence for the same machine and workload class, so the resulting cost change is explicit rather than anecdotal.

## 4. Non-functional requirements (NFR)

- **Performance:** The implementation must produce explicit before/after timing evidence against the current shared-runtime smoke baseline on the same machine.
- **Determinism:** The refactored harness must not reintroduce multi-runtime topology or readiness races that `F-0007` already removed.
- **Operability:** The operator entrypoint remains `pnpm smoke:cell`; no parallel manual setup becomes mandatory.
- **Verification integrity:** Coverage retained by the current shared base family plus Telegram overlay must stay explicit in dossier/test ownership.

## 5. Design (compact)

### 5.1 API surface

- Product-facing API surface does not change. This follow-up only changes test-harness orchestration around the existing deployment cell.

### 5.2 Runtime / deployment surface

- `infra/docker/compose.yaml` may expose a smoke-only PostgreSQL port for harness-side direct access.
- `infra/docker/deployment-cell.smoke.ts` and its helpers become the canonical owner of one persistent `pg` client lifecycle for smoke runs.
- Telegram overlay remains an overlay over the shared `yaagi-phase0` runtime and must keep reuse of the already started `vllm-fast` container.

### 5.3 Data model changes

- No product schema changes are expected. Any new state is limited to smoke-harness-side connection/config plumbing.

### 5.4 Edge cases and failure modes

- Host-port collision on the smoke-only PostgreSQL port must fail clearly rather than hanging the suite.
- Compose/service health can pass before domain data reaches the expected state, so domain-specific waits still need explicit ownership.
- Overlay transitions must not leave stale service state that silently reuses wrong assumptions from the previous scenario family.

### 5.5 Verification surface / initial verification plan

- Fast verification path: `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test`.
- Container verification path: `pnpm smoke:cell`.
- Contract proof is expected in `test/platform/smoke-harness.contract.test.ts` plus the live smoke suite under `infra/docker/deployment-cell.smoke.ts`.

### 5.6 Representation upgrades (triggered only when needed)

- If batched waits introduce a new helper contract, the helper should define one explicit predicate/result shape rather than scattering ad hoc SQL snippets per scenario.

### 5.7 Definition of Done

- All `AC-F0021-*` are covered by updated contract tests and the live smoke suite.
- `pnpm smoke:cell` still runs through one shared `Gemma` runtime and one Telegram overlay.
- Before/after evidence is recorded in the dossier during implementation closure.
- Backlog truth for `CF-028` is actualized according to downstream dossier stages.

### 5.8 Rollout / activation note (triggered only when needed)

- No user-facing rollout is expected. Activation happens by merging the harness refactor on the canonical repo path.
- Rollback remains a git-level rollback of the harness changes if the new smoke topology regresses determinism or cost.

## 6. Slicing plan (2–6 increments)

### Slice SL-F0021-01: Direct PostgreSQL channel for steady-state smoke polling
Covers: AC-F0021-01, AC-F0021-07
Verification: test, smoke

### Slice SL-F0021-02: Predicate waits and Telegram overlay cleanup
Covers: AC-F0021-02, AC-F0021-03, AC-F0021-04, AC-F0021-05, AC-F0021-06, AC-F0021-07
Verification: test, smoke

### Slice SL-F0021-03: Evidence capture and closure
Covers: AC-F0021-08
Verification: smoke, audit

## 7. Task list (implementation units)

- **T-F0021-01:** Introduce smoke-only PostgreSQL connection path for harness-side direct queries.
- **T-F0021-02:** Replace sequential DB wait chains with predicate/batched waits in the affected smoke scenarios.
- **T-F0021-03:** Remove redundant Telegram overlay build path while preserving shared `vllm-fast` reuse.
- **T-F0021-04:** Refresh readiness/wait ownership and capture comparative timing evidence.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0021-01 | `infra/docker/deployment-cell.smoke.ts`; `test/platform/smoke-harness.contract.test.ts` | planned |
| AC-F0021-02 | `infra/docker/deployment-cell.smoke.ts`; `test/platform/smoke-harness.contract.test.ts` | planned |
| AC-F0021-03 | `infra/docker/deployment-cell.smoke.ts`; `test/platform/smoke-harness.contract.test.ts` | planned |
| AC-F0021-04 | `infra/docker/deployment-cell.smoke.ts`; `test/platform/smoke-harness.contract.test.ts` | planned |
| AC-F0021-05 | `infra/docker/deployment-cell.smoke.ts`; `test/platform/smoke-harness.contract.test.ts` | planned |
| AC-F0021-06 | `infra/docker/deployment-cell.smoke.ts`; `test/platform/smoke-harness.contract.test.ts` | planned |
| AC-F0021-07 | `infra/docker/deployment-cell.smoke.ts`; `test/platform/smoke-harness.contract.test.ts` | planned |
| AC-F0021-08 | dossier implementation evidence; `pnpm smoke:cell` timing capture | planned |

## 9. Decision log (ADR blocks)

### ADR-F0021-01: Follow-up remains a new backlog delta instead of reopening F-0007
- Status: Accepted
- Date: 2026-04-17
- Context: `F-0007` already delivered the shared-runtime smoke harness, while the newly observed bottlenecks appeared only after `F-0020` promoted a real `Gemma` runtime.
- Decision: Keep `F-0007` historical and implement the optimization seam as `CF-028` / `F-0021`.
- Alternatives: Reopen `F-0007`; patch historical backlog state as if the original seam was not delivered.
- Consequences: New work can proceed without falsifying delivered smoke-harness history.

## 10. Progress & links

- Backlog item key: CF-028
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Docs:
  - [ADR-2026-04-17 Smoke Harness Follow-up Scope Extraction](../adr/ADR-2026-04-17-smoke-harness-follow-up-scope-extraction.md)
  - [F-0007 Детерминированный smoke harness и suite-scoped lifecycle deployment cell](./F-0007-deterministic-smoke-harness-and-suite-scoped-cell-lifecycle.md)
  - [F-0020 Реальный vLLM-serving и promotion model dependencies](./F-0020-real-vllm-serving-and-promotion-model-dependencies.md)
- Issue:
- PRs:

## 11. Change log

- 2026-04-17: Initial dossier created from backlog item `CF-028` at backlog delivery state `planned`.
