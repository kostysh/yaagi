---
id: F-0021
title: Оптимизация smoke harness после real vLLM/Gemma runtime
status: shaped
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
- **Goal:** Упростить и удешевить канонический containerized smoke path без потери функциональности, покрытия и shared-runtime topology. Целевой результат: `smoke:cell` остаётся тем же repo-level verification path, убирает avoidable orchestration work и доказывает измеримый выигрыш хотя бы на одном целевом orchestration path без существенной регрессии полного suite wall-clock.
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

### Decision triage

#### Normative now

- Harness использует один direct PostgreSQL channel для steady-state smoke polling и не возвращается к repeated `compose exec postgres psql`.
- Telegram overlay reuse-ит уже запущенный shared deployment cell и не materialize-ит второй model runtime.
- Compose/service health становится первым readiness barrier для startup и overlay paths; domain-specific waits остаются только там, где health не доказывает нужный инвариант.

#### Implementation freedom

- Конкретное имя и shape нового helper surface (`waitForPostgresPredicate`, batched read helper, тонкая wrapper around `pg`) остаются свободой реализации, если contract по AC и adversarial semantics сохраняется.
- Конкретный env/compose key для smoke-only PostgreSQL host port остаётся свободой реализации, если он остаётся smoke-scoped и не превращается в продуктовый runtime contract.

#### Temporary assumptions

- Текущий smoke run остаётся single-run local workflow; parallel smoke execution не входит в обязательный contract этого dossier, если реализация не захочет закрыть collision story сразу.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0021-01:** Steady-state PostgreSQL polling inside `pnpm smoke:cell` uses a smoke-only direct `pg` client instead of repeated `docker compose exec postgres psql`.
- **AC-F0021-02:** The direct PostgreSQL channel is created once per smoke run and reused for steady-state harness queries instead of reconnecting through container exec on every poll.
- **AC-F0021-03:** Telegram overlay reuses the same shared deployment cell as the base smoke family.
- **AC-F0021-04:** Telegram overlay reuses the same already-started `vllm-fast` model runtime as the base smoke family.
- **AC-F0021-05:** Telegram overlay activation does not issue redundant `--build` for unchanged services.
- **AC-F0021-06:** Sequential DB waits that guard one domain outcome are collapsed into one predicate wait plus one batched readout without reducing asserted smoke conditions.
- **AC-F0021-07:** Base startup orchestration treats compose/service health as the first readiness barrier and adds domain-specific waits only where Docker health is insufficient.
- **AC-F0021-08:** Telegram overlay orchestration treats compose/service health as the first readiness barrier and adds domain-specific waits only where Docker health is insufficient.
- **AC-F0021-09:** `pnpm smoke:cell` preserves the base-family smoke assertion baseline listed in section `5.5 Preserved smoke assertion baseline`.
- **AC-F0021-10:** `pnpm smoke:cell` preserves the Telegram-family smoke assertion baseline listed in section `5.5 Preserved smoke assertion baseline`.
- **AC-F0021-11:** `pnpm smoke:cell` still completes without orphaned `yaagi-phase0*` resources.
- **AC-F0021-12:** Before/after evidence is recorded on the same machine and workload class, and shows both: total `pnpm smoke:cell` wall-clock does not regress by more than 10% versus the current shared-runtime baseline, and at least one targeted orchestration path (`base family startup` or `Telegram overlay activation`) is faster than that baseline.

## 4. Non-functional requirements (NFR)

- **Performance:** The implementation must produce explicit before/after timing evidence against the current shared-runtime smoke baseline on the same machine, keep total suite wall-clock within a 10% regression budget, and improve at least one targeted orchestration path (`base family startup` or `Telegram overlay activation`).
- **Determinism:** The refactored harness must not reintroduce multi-runtime topology or readiness races that `F-0007` already removed.
- **Operability:** The operator entrypoint remains `pnpm smoke:cell`; no parallel manual setup becomes mandatory.
- **Verification integrity:** Coverage retained by the current shared base family plus Telegram overlay must stay explicit in dossier/test ownership.

## 5. Design (compact)

### 5.1 API surface

- Product-facing API surface does not change. This follow-up only changes test-harness orchestration around the existing deployment cell.

#### Harness boundary operations

| Operation | Success behavior | Dependency failure / timeout | Duplicate / replay semantics |
| --- | --- | --- | --- |
| Base family startup | One shared deployment cell becomes reachable through `GET /health`; PostgreSQL and the phase-0 model runtime are already healthy through compose dependency gates before smoke assertions continue. | Suite fails with explicit startup/readiness error; no scenario may continue on a partially ready base family. | Re-running startup after a clean teardown is allowed; startup is not required to be idempotent over an already running suite in the same process. |
| Steady-state PostgreSQL query / wait | Harness reads source state through one direct client channel and returns the queried value or predicate success. | Query or predicate wait fails explicitly on connect/query timeout; harness does not silently fall back to `compose exec postgres psql`. | Repeated reads are allowed; they must not mutate database state. |
| Telegram overlay activation | Overlay-specific services become available while reusing the already running shared deployment cell and the existing model runtime. | Overlay activation fails explicitly if health or overlay-specific adapter readiness never converges. | Repeating overlay activation in one run must not materialize a second model runtime or rebuild unchanged services. |
| Inter-scenario runtime reset | Canonical reset clears mutable runtime state and returns the suite to a fresh post-bootstrap condition. | Reset failure blocks the following scenario instead of allowing assertions on stale state. | Sequential resets are allowed and must converge to the same post-bootstrap state. |
| Suite teardown | Compose resources are removed and no orphaned `yaagi-phase0*` resources remain. | Teardown failure is reported as smoke failure and must not be hidden as a passing run. | Repeating teardown after resources are already gone is tolerated. |

#### Operator / agent contract

- Operator entrypoint remains `pnpm smoke:cell`.
- The follow-up must not require a second manual command to prepare PostgreSQL connectivity; any smoke-only port exposure is internal to the harness contract.
- Failures stay machine-actionable through command exit status and existing smoke output; the follow-up does not introduce a second reporting channel.

### 5.2 Runtime / deployment surface

- `infra/docker/compose.yaml` exposes a smoke-only PostgreSQL host port used only by the smoke harness.
- `infra/docker/deployment-cell.smoke.ts` and its helpers own one persistent `pg` client lifecycle per smoke run.
- The base family still starts through one shared `yaagi-phase0` project.
- Telegram scenarios remain an overlay over the shared base runtime and keep reuse of the already started `vllm-fast` container.

### 5.3 Data model changes

- No product schema changes are expected. Any new state is limited to smoke-harness-side connection/config plumbing.

### 5.4 Edge cases and failure modes

- Host-port collision on the smoke-only PostgreSQL port must fail clearly rather than hanging the suite.
- Compose/service health can pass before domain data reaches the expected state, so domain-specific waits still need explicit ownership.
- Overlay transitions must not leave stale service state that silently reuses wrong assumptions from the previous scenario family.
- Smoke teardown remains the canonical cleanup path after partial startup or partial overlay activation failure.

### 5.5 Verification surface / initial verification plan

- Fast verification path: `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test`.
- Container verification path: `pnpm smoke:cell`.
- Contract proof is expected in `test/platform/smoke-harness.contract.test.ts` plus the live smoke suite under `infra/docker/deployment-cell.smoke.ts`.
- AC-F0021-01..08 should be proven through contract tests plus targeted smoke assertions.
- AC-F0021-09..11 require full `pnpm smoke:cell`.
- AC-F0021-12 closes only with recorded before/after evidence in the dossier and implementation closure artifacts.

#### Preserved smoke assertion baseline

Base-family assertions that must remain present after the refactor:

- `readiness and materialization baseline`: the suite still proves base `/health` readiness, PostgreSQL/`pgboss` readiness, phase-0 model availability, and writable/runtime materialization boundaries currently exercised by the startup smoke.
- `model and operator baseline`: the suite still proves bounded `/models` projection and operator state/governor-unavailable assertions currently exercised for baseline model-routing and operator introspection.
- `runtime continuity baseline`: the suite still proves fail-closed startup on unsupported subject-state schema, one completed wake tick after boot, homeostat periodic cadence, stale active-tick reclaim, and subject-state reload after restart.
- `reactive execution baseline`: the suite still proves HTTP ingest, bounded reactive decision, bounded executive outcome, and fail-closed promoted dependency behavior on the shared deployment cell.

Telegram-family assertions that must remain present after the refactor:

- `overlay readiness baseline`: Telegram overlay activation still proves that the telegram adapter becomes healthy on top of the shared deployment cell.
- `telegram ingest baseline`: fake Bot API ingest still proves one telegram stimulus enters `stimulus_inbox`, one reactive tick completes, and the durable envelope/source-kind fields remain consistent with the current telegram smoke path.

### 5.6 Adversarial semantics

| Case | Classification | Contract |
| --- | --- | --- |
| Sequential success | specified | `start base family -> reset runtime -> activate Telegram overlay -> teardown` is the canonical successful order. Proof: smoke plus contract tests. |
| Invalid input | N/A | No new operator-facing data payload is introduced; the only new inputs are harness-side config/env details under repo control. |
| Dependency failure / timeout | specified | If direct PostgreSQL connect, compose health, or overlay adapter readiness does not converge before timeout, the suite fails explicitly and does not continue on degraded assumptions. Proof: contract tests and smoke failure assertions. |
| Duplicate or replay after completion | specified | Repeated steady-state reads are read-only; repeated runtime resets converge to the same post-bootstrap state; repeated overlay activation must not create a second model runtime or rebuild unchanged services. Proof: contract tests plus smoke topology assertions. |
| Concurrent duplicate or racing request | N/A | The smoke suite remains `concurrency: false`; concurrent helper invocation is outside the mandatory contract of this follow-up. |
| Concurrent conflicting request | N/A | The harness does not expose concurrent competing mutations as a supported operator surface in this dossier. |
| Partial side effect / crash / restart | specified | If startup, overlay activation, or reset fails mid-flight, the suite must fail or recover through the canonical teardown/reset path before any later assertion claims success. Proof: contract tests plus smoke teardown checks. |
| Stale read / stale snapshot / late completion | specified | Compose/service health may become healthy before the required domain state is durable, so the harness must wait on the explicit domain predicate before asserting the dependent outcome. Proof: contract tests and targeted smoke waits. |

### 5.7 Representation upgrades (triggered only when needed)

- If batched waits introduce a new helper contract, the helper should define one explicit predicate/result shape rather than scattering ad hoc SQL snippets per scenario.

### 5.8 Definition of Done

- All `AC-F0021-*` are covered by updated contract tests and the live smoke suite.
- `pnpm smoke:cell` still runs through one shared `Gemma` runtime and one Telegram overlay.
- Before/after evidence is recorded in the dossier during implementation closure.
- Backlog truth for `CF-028` is actualized according to downstream dossier stages.

### 5.9 Rollout / activation note (triggered only when needed)

- No user-facing rollout is expected. Activation happens by merging the harness refactor on the canonical repo path.
- Rollback remains a git-level rollback of the harness changes if the new smoke topology regresses determinism or cost.

## 6. Slicing plan (2–6 increments)

### Slice SL-F0021-01: Direct PostgreSQL channel for steady-state smoke polling
Covers: AC-F0021-01, AC-F0021-02, AC-F0021-11
Verification: test, smoke
Assumes: smoke-only PostgreSQL host-port exposure remains repo-local and does not alter product runtime contracts.
Fallback: fail-closed and keep the legacy path only until the follow-up implementation lands; do not mix both query paths inside one passing smoke run.

### Slice SL-F0021-02: Predicate waits and Telegram overlay cleanup
Covers: AC-F0021-03, AC-F0021-04, AC-F0021-05, AC-F0021-06, AC-F0021-07, AC-F0021-08, AC-F0021-09, AC-F0021-10, AC-F0021-11
Verification: test, smoke
Depends on: SL-F0021-01 for the canonical query/wait substrate.
Fallback: keep domain-specific waits explicit even if helper consolidation is incomplete; coverage may not be traded away for speed.

### Slice SL-F0021-03: Evidence capture and closure
Covers: AC-F0021-12
Verification: smoke, audit
Depends on: SL-F0021-01, SL-F0021-02

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
| AC-F0021-08 | `infra/docker/deployment-cell.smoke.ts`; `test/platform/smoke-harness.contract.test.ts` | planned |
| AC-F0021-09 | `infra/docker/deployment-cell.smoke.ts` | planned |
| AC-F0021-10 | `infra/docker/deployment-cell.smoke.ts` | planned |
| AC-F0021-11 | `infra/docker/deployment-cell.smoke.ts`; teardown audit in smoke contract tests | planned |
| AC-F0021-12 | dossier implementation evidence; `pnpm smoke:cell` timing capture | planned |

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
- 2026-04-17 [clarification]: `spec-compact` completed for the smoke follow-up with atomic ACs, boundary operations, adversarial semantics and decision triage for the post-`F-0020` runtime path.
