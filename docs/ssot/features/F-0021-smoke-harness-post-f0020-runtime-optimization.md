---
id: F-0021
title: Оптимизация smoke harness после real vLLM/Gemma runtime
status: done
coverage_gate: strict
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
    - "docs/ssot/features/F-0007-deterministic-smoke-harness-and-suite-scoped-cell-lifecycle.md"
    - "docs/ssot/features/F-0020-real-vllm-serving-and-promotion-model-dependencies.md"
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
- **AC-F0021-02:** The direct PostgreSQL channel is created once per smoke run and reused for steady-state harness queries instead of reconnecting through container exec on every poll, while reset/restart/teardown boundaries either preserve a valid channel or fail closed without leaving stale session/handle state for later assertions.
- **AC-F0021-03:** Telegram overlay reuses the same shared deployment cell as the base smoke family.
- **AC-F0021-04:** Telegram overlay reuses the same already-started `vllm-fast` model runtime as the base smoke family.
- **AC-F0021-05:** Telegram overlay activation does not issue redundant `--build` for unchanged services.
- **AC-F0021-06:** Sequential DB waits that guard one domain outcome are collapsed into one predicate wait plus one batched readout without reducing asserted smoke conditions.
- **AC-F0021-07:** Base startup orchestration treats compose/service health as the first readiness barrier and adds domain-specific waits only where Docker health is insufficient.
- **AC-F0021-08:** Telegram overlay orchestration treats compose/service health as the first readiness barrier and adds domain-specific waits only where Docker health is insufficient.
- **AC-F0021-09:** `pnpm smoke:cell` preserves the base-family smoke assertion baseline listed in section `5.5 Preserved smoke assertion baseline`.
- **AC-F0021-10:** `pnpm smoke:cell` preserves the Telegram-family smoke assertion baseline listed in section `5.5 Preserved smoke assertion baseline`.
- **AC-F0021-11:** `pnpm smoke:cell` still completes without orphaned `yaagi-phase0*` resources, leaked harness-owned PostgreSQL client/socket handles, or a dirty smoke-only PostgreSQL port ownership boundary for the next run.
- **AC-F0021-12:** Before/after evidence is recorded on the same machine and workload class in one durable implementation evidence artifact that includes baseline/candidate commit identity, runtime/image identity, warm/cold cache note, run count, and raw timing capture for total `pnpm smoke:cell` plus the targeted orchestration paths. The evidence must show both: total suite wall-clock does not regress by more than 10% versus the current shared-runtime baseline, and at least one targeted orchestration path (`base family startup` or `Telegram overlay activation`) is faster than that baseline.

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
| Base family startup | One shared deployment cell becomes reachable through `GET /health`; PostgreSQL and the phase-0 model runtime are already healthy through compose dependency gates before smoke assertions continue. | Suite fails with explicit startup/readiness error; no scenario may continue on a partially ready base family. | Re-running startup after a clean teardown is allowed; startup is not required to be idempotent over an already running suite in the same process. If a timed-out startup later completes in background, the next startup attempt must detect/fence that stale completion instead of silently treating it as fresh success. |
| Steady-state PostgreSQL query / wait | Harness reads source state through one direct client channel and returns the queried value or predicate success. | Query or predicate wait fails explicitly on connect/query timeout; harness does not silently fall back to `compose exec postgres psql`. | Reused reads are read-only; the client must either remain valid across reset/restart boundaries or fail closed and force re-establishment before later assertions. No stale session/snapshot may survive into a later scenario. |
| Telegram overlay activation | Overlay-specific services become available while reusing the already running shared deployment cell and the existing model runtime. | Overlay activation fails explicitly if health or overlay-specific adapter readiness never converges. | Repeating overlay activation in one run must not materialize a second model runtime or rebuild unchanged services. If an activation attempt times out and later completes, the next retry must detect or fence that late completion instead of attaching to half-mutated overlay state. |
| Inter-scenario runtime reset | Canonical reset clears mutable runtime state and returns the suite to a fresh post-bootstrap condition. | Reset failure blocks the following scenario instead of allowing assertions on stale state. | Sequential resets are allowed and must converge to the same post-bootstrap state. |
| Suite teardown | Compose resources are removed, harness-owned PostgreSQL sockets are closed, and no orphaned `yaagi-phase0*` resources remain. | Teardown failure is reported as smoke failure and must not be hidden as a passing run. | Repeating teardown after resources are already gone is tolerated, but a clean subsequent startup may not depend on leaked sockets or a still-owned smoke-only port. |

#### Operator / agent contract

- Operator entrypoint remains `pnpm smoke:cell`.
- The follow-up must not require a second manual command to prepare PostgreSQL connectivity; any smoke-only port exposure is internal to the harness contract.
- Failures stay machine-actionable through command exit status and existing smoke output; the follow-up does not introduce a second reporting channel.

### 5.2 Runtime / deployment surface

- `infra/docker/compose.smoke-base.yaml` exposes a smoke-only PostgreSQL host port used only by the smoke harness, while `infra/docker/compose.yaml` keeps product runtime surface unchanged.
- `infra/docker/deployment-cell.smoke.ts` and its helpers own one persistent `pg` client lifecycle per smoke run.
- The base family still starts through one shared `yaagi-phase0` project.
- Telegram scenarios remain an overlay over the shared base runtime and keep reuse of the already started `vllm-fast` container.
- Harness-owned PostgreSQL sockets/clients are explicit runtime resources: implementation must revalidate them across reset/restart boundaries and close them during teardown before the next smoke run can claim a clean start.

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
- AC-F0021-12 closes only with one durable timing evidence artifact linked from implementation closure, carrying baseline/candidate commit ids, runtime/image identity, warm/cold note, run count and raw timings for total suite plus targeted orchestration paths.

#### Preserved smoke assertion baseline

Base-family assertions that must remain present after the refactor:

- `readiness and materialization baseline`: the suite still proves base `/health` readiness, PostgreSQL/`pgboss` readiness, phase-0 model availability, and writable/runtime materialization boundaries currently exercised by the startup smoke.
- `model and operator baseline`: the suite still proves bounded `/models` projection and operator state/governor-unavailable assertions currently exercised for baseline model-routing and operator introspection.
- `runtime continuity baseline`: the suite still proves fail-closed startup on unsupported subject-state schema, one completed wake tick after boot, homeostat periodic cadence, stale active-tick reclaim, and subject-state reload after restart.
- `reactive execution baseline`: the suite still proves HTTP ingest, bounded reactive decision, bounded executive outcome, and fail-closed promoted dependency behavior on the shared deployment cell.

Telegram-family assertions that must remain present after the refactor:

- `overlay readiness baseline`: Telegram overlay activation still proves that the telegram adapter becomes healthy on top of the shared deployment cell.
- `telegram ingest baseline`: fake Bot API ingest still proves one telegram stimulus enters `stimulus_inbox`, one reactive tick completes, and the durable envelope/source-kind fields remain consistent with the current telegram smoke path.

#### Delivered implementation evidence

- Реализованный harness перевёл steady-state PostgreSQL polling на один direct `pg` client, сохранил один shared `vllm-fast` runtime и убрал redundant Telegram overlay rebuild path.
- Durable evidence artifact: `.dossier/verification/F-0021/implementation-smoke-timing-c01.json`.
- Финальный same-machine warm-cache smoke verdict после implementation: `pnpm smoke:cell` `real 304.57`, `F-0007 deployment-cell smoke suite` `304276.76881 ms`, `F-0007 base deployment-cell smoke family` `88602.883143 ms`, `F-0007 telegram deployment-cell smoke overlay` `11952.834793 ms`.
- Baseline shared-runtime snapshot из `F-0007`: `321.06s` total, `96.02s` base family, `14.16s` Telegram overlay.
- Следовательно, `AC-F0021-12` закрыт: total suite wall-clock не регрессировал относительно baseline, а оба targeted orchestration path (`base family`, `Telegram overlay`) стали быстрее.
- Warm/cold note: evidence снято на той же машине с warm `models_state`/HF cache и без повторного скачивания model weights.

### 5.6 Adversarial semantics

| Case | Classification | Contract |
| --- | --- | --- |
| Sequential success | specified | `start base family -> reset runtime -> activate Telegram overlay -> teardown` is the canonical successful order. Proof: smoke plus contract tests. |
| Invalid input | N/A | No new operator-facing data payload is introduced; the only new inputs are harness-side config/env details under repo control. |
| Dependency failure / timeout | specified | If direct PostgreSQL connect, compose health, or overlay adapter readiness does not converge before timeout, the suite fails explicitly and does not continue on degraded assumptions. Proof: contract tests and smoke failure assertions. |
| Duplicate or replay after completion | specified | Repeated steady-state reads are read-only; repeated runtime resets converge to the same post-bootstrap state; repeated overlay activation must not create a second model runtime or rebuild unchanged services. Proof: contract tests plus smoke topology assertions. |
| Timeout with late completion / ambiguous retry | specified | If startup or overlay activation times out and later completes in the background, the next retry must detect or fence that stale completion instead of silently treating it as fresh success. Proof: contract tests plus smoke failure-path assertions. |
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

## 6. Planning risk-to-proof map

| Risk / edge case | Spec source | Required proof | Slice | Verification artifact | N/A rationale |
|---|---|---|---|---|---|
| Startup reaches compose health before domain state is durable | `5.4 Edge cases and failure modes`; `AC-F0021-07`; `5.6 Stale read / late completion` | For `base family startup -> first smoke assertion`, prove that compose/service health is only the first barrier and that a domain predicate still gates assertions whose source of truth is PostgreSQL/runtime state. Observable result: no assertion runs on transport-only readiness. Durable invariant: base-family readiness remains honest after every suite boot. | `SL-F0021-02` | contract test for health-first startup helper; base-family smoke path | not_applicable |
| Direct PostgreSQL channel fails, collides, or survives too long across lifecycle boundaries | `AC-F0021-01`; `AC-F0021-02`; `5.4 Edge cases`; `5.6 Dependency failure / timeout` | For `direct pg connect -> steady-state query/wait -> reset/restart/teardown`, prove explicit failure on connect timeout or host-port collision, prove there is no silent fallback to `compose exec postgres psql`, and prove the reused channel either remains valid or fails closed across reset/restart boundaries. Observable result: stale session/snapshot/handle state never leaks into later assertions. Durable invariant: one direct channel per run remains the only steady-state query path and its lifecycle is explicit. | `SL-F0021-01` | mandatory contract test for pg client lifecycle and failure path; mandatory smoke-visible failure proof for unsupported connect state | not_applicable |
| Sequential DB waits observe different snapshots and hide stale state | `AC-F0021-06`; `5.6 Stale read / late completion` | For `predicate wait -> batched readout`, prove one combined predicate guards the domain outcome and the follow-up readout reflects the same converged state. Observable result: assertions no longer depend on interleaved multi-wait timing. Durable invariant: one domain outcome equals one wait boundary. | `SL-F0021-02` | contract test for predicate wait helper; targeted smoke scenario with previous multi-wait chain | not_applicable |
| Duplicate reset or replay after completion corrupts shared runtime assumptions | `5.6 Duplicate or replay after completion`; `AC-F0021-09`; `AC-F0021-11` | For `runtime reset -> next scenario start`, prove reset convergence still lands on the same fresh post-bootstrap state and teardown leaves no orphaned `yaagi-phase0*` resources. Observable result: later scenarios see a clean shared runtime. Durable invariant: one smoke run keeps one shared topology without residue. | `SL-F0021-02` | contract reset test; full smoke teardown audit | not_applicable |
| Timed-out startup or overlay activation completes late and contaminates a retry | `5.6 Timeout with late completion / ambiguous retry`; `5.1 Harness boundary operations` | For `startup timeout -> late completion -> retry` and `overlay timeout -> late completion -> retry`, prove the second attempt detects or fences stale late completion instead of attaching to half-mutated state. Observable result: retry semantics are explicit and fail closed on ambiguity. Durable invariant: one activation boundary owns one observable completion. | `SL-F0021-03` | mandatory contract test for fencing/detection semantics; mandatory smoke failure-path assertion | not_applicable |
| Telegram overlay materializes a second model runtime or rebuilds unchanged services | `AC-F0021-03`; `AC-F0021-04`; `AC-F0021-05`; `5.6 Duplicate or replay after completion` | For `base family running -> Telegram overlay activation`, prove overlay reuses the same deployment cell and the same `vllm-fast` container identity, while unchanged services are not rebuilt. Observable result: exactly one shared model runtime remains alive. Durable invariant: overlay activation is additive, not duplicative. | `SL-F0021-03` | contract test for overlay reuse/no-build path; Telegram overlay smoke assertions | not_applicable |
| Overlay health passes before adapter-specific readiness is true | `AC-F0021-08`; `5.6 Dependency failure / timeout`; `5.6 Stale read / late completion` | For `overlay compose health -> Telegram assertions`, prove overlay-specific adapter readiness still gates telegram ingest assertions where compose health alone is insufficient. Observable result: ingest assertions start only after the adapter is actually ready. Durable invariant: overlay readiness remains explicit and honest. | `SL-F0021-03` | contract test for overlay readiness helper; Telegram smoke path | not_applicable |
| Partial startup or crash leaves the suite in a half-mutated state | `5.6 Partial side effect / crash / restart`; `AC-F0021-11` | For `partial startup/overlay failure -> teardown`, prove canonical teardown still removes compose resources, closes harness-owned `pg` sockets, releases smoke-only port ownership, and the next run can start cleanly. Observable result: no hidden Docker or non-Docker residue survives failed activation. Durable invariant: cleanup remains authoritative after partial failure. | `SL-F0021-03` | mandatory smoke failure-path/teardown audit; mandatory targeted contract test for cleanup ownership | not_applicable |
| Timing win is claimed without stable same-machine evidence | `AC-F0021-12`; `NFR Performance` | For `baseline run -> refactored run`, prove before/after evidence is captured on the same machine/workload class, total wall-clock stays within the regression budget, and at least one targeted orchestration path is faster. Observable result: optimization claim is objective. Durable invariant: performance closure uses measured evidence, not anecdotal impressions. The durable artifact must record baseline/candidate commit ids, runtime/image identity, warm/cold note, run count and raw timings. | `SL-F0021-04` | durable timing evidence artifact linked from implementation closure; full smoke timing capture; closure audit | not_applicable |

## 7. Slicing plan (2–6 increments)

### External dependency gates

- Depends on: `F-0007` (delivered shared-runtime smoke harness).
  Owner/unblock condition: delivered suite-scoped deployment-cell topology and deterministic runtime reset remain the authoritative base for this follow-up; `F-0021` does not reopen or replace that seam.
- Depends on: `F-0020` (delivered real `Gemma`/`vllm-fast` serving seam).
  Owner/unblock condition: one real shared `vllm-fast` runtime remains the canonical smoke substrate; `F-0021` optimizes orchestration around it without changing model/serving ownership.

### Slice SL-F0021-01: Direct PostgreSQL channel and lifecycle boundary
Deliverable: smoke-only PostgreSQL host-port exposure plus one persistent `pg` client lifecycle that becomes the canonical steady-state query/wait channel for the harness, with explicit lifecycle validity and fail-closed behavior across reset/restart/teardown.
Covers: AC-F0021-01, AC-F0021-02, AC-F0021-11
Verification: `test/platform/smoke-harness.contract.test.ts`, `infra/docker/deployment-cell.smoke.ts`
Assumes: smoke-only PostgreSQL host-port exposure remains repo-local and does not alter product runtime contracts.
Fallback: fail closed on connect/query errors and do not keep the legacy `compose exec postgres psql` path alive inside a passing smoke run.
Decision path: README runtime notes, `ADR-2026-03-19 Phase-0 Deployment Cell`, `ADR-2026-04-17 Smoke Harness Follow-up Scope Extraction`.

### Slice SL-F0021-02: Base-family predicate waits and health-first startup cleanup
Deliverable: base-family scenarios stop using sequential DB waits for one domain outcome, and startup waits explicitly separate compose health from domain-specific barriers.
Covers: AC-F0021-06, AC-F0021-07, AC-F0021-09, AC-F0021-11
Verification: `test/platform/smoke-harness.contract.test.ts`, `infra/docker/deployment-cell.smoke.ts`
Depends on: `SL-F0021-01`, because all predicate waits must reuse the canonical direct PostgreSQL channel.
Fallback: keep domain-specific waits explicit even if helper consolidation is incomplete; coverage may not be traded away for speed.
Decision path: `F-0007` delivered shared-runtime topology, `F-0020` real-serving runtime baseline, repo README smoke contract.

### Slice SL-F0021-03: Telegram overlay reuse and readiness cleanup
Deliverable: Telegram overlay activates without redundant rebuilds, keeps the same already-running `vllm-fast` container identity, treats adapter-specific readiness as a separate domain barrier when compose health is not enough, and defines fail-closed retry semantics for timeout with late completion.
Covers: AC-F0021-03, AC-F0021-04, AC-F0021-05, AC-F0021-08, AC-F0021-10, AC-F0021-11
Verification: `test/platform/smoke-harness.contract.test.ts`, `infra/docker/deployment-cell.smoke.ts`
Depends on: `SL-F0021-01` for the direct query substrate and `SL-F0021-02` for shared wait/helper conventions.
Fallback: preserve shared-runtime reuse and existing Telegram coverage even if overlay wait consolidation must remain partially explicit for one cycle.
Decision path: README smoke contract, `ADR-2026-03-19 Phase-0 Deployment Cell`, `ADR-2026-04-17 Smoke Harness Follow-up Scope Extraction`.

### Slice SL-F0021-04: Evidence, drift guard, and closure audit
Deliverable: before/after timing evidence, one durable timing evidence artifact with minimum measurement metadata, real usage audit on the refactored smoke path, and final docs/runtime parity check for the new harness contract.
Covers: AC-F0021-12
Verification: `pnpm smoke:cell`, implementation evidence bundle, closure audit
Depends on: `SL-F0021-01`, `SL-F0021-02`, `SL-F0021-03`
Fallback: no optimization claim is allowed without same-machine evidence, even if functional refactor slices are already green.
Decision path: repo README verification contract, dossier/ADR parity, backlog actualization rules from `dossier-engineer`.

### Allowed stop points

- **ASP-F0021-01:** after `SL-F0021-01`.
  Safe reason: the highest-churn infrastructure change is isolated to the PostgreSQL query substrate while higher-level waits and overlay semantics remain untouched.
  Verification expected: `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm smoke:cell`.
  Remaining outside stop: predicate-wait consolidation, Telegram overlay cleanup, timing evidence.
- **ASP-F0021-02:** after `SL-F0021-02`.
  Safe reason: base-family startup and steady-state wait semantics are already stabilized, while Telegram overlay remains on the pre-refactor orchestration path.
  Verification expected: `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm smoke:cell`.
  Remaining outside stop: Telegram overlay no-build/reuse cleanup and timing closure evidence.
- **ASP-F0021-03:** after `SL-F0021-03`.
  Safe reason: all runtime/topology changes are complete and only evidence capture plus closure audit remain.
  Verification expected: `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm smoke:cell`.
  Remaining outside stop: before/after measurement, usage audit, docs/runtime drift guard, final implementation close-out.

### Real usage audit after implementation

- Audit target: one clean `pnpm smoke:cell` run on the canonical local deployment-cell path after all slices land.
- Audit focus: actual operator entrypoint behavior, same-runtime reuse across scenario families, teardown residue, and timing evidence quality.
- Expected corrective finding classes:
  - `docs-only`: README or dossier wording still lags behind the delivered smoke topology.
  - `runtime`: live smoke reveals a no-build/reuse or readiness mismatch not caught by earlier contract tests.
  - `cross-skill`: implementation uncovers a new backlog/ADR realignment need instead of a pure harness bug.
  - `audit-only`: evidence capture or timing report needs cleanup without changing runtime behavior.

## 8. Task list (implementation units)

- **T-F0021-01 [SL-F0021-01, AC-F0021-01, AC-F0021-02]:** Introduce smoke-only PostgreSQL connection/config plumbing and one lifecycle-managed direct `pg` client.
- **T-F0021-02 [SL-F0021-01, AC-F0021-01, AC-F0021-02, AC-F0021-11]:** Remove steady-state `compose exec postgres psql` from harness query helpers and enforce fail-closed behavior on connect/query failure, stale client state, and teardown cleanup of harness-owned sockets.
- **T-F0021-03 [SL-F0021-02, AC-F0021-06, AC-F0021-07, AC-F0021-09, AC-F0021-11]:** Replace base-family sequential DB wait chains with predicate waits and batched readouts while preserving the existing smoke assertion baseline.
- **T-F0021-04 [SL-F0021-03, AC-F0021-03, AC-F0021-04, AC-F0021-05, AC-F0021-08, AC-F0021-10, AC-F0021-11]:** Remove redundant Telegram overlay rebuilds, preserve shared `vllm-fast` reuse, keep overlay-specific readiness explicit, and define fail-closed retry semantics for timeout with late completion.
- **T-F0021-05 [SL-F0021-04, AC-F0021-12]:** Capture same-machine before/after smoke evidence in one durable timing artifact with commit/runtime metadata and classify any real usage audit findings.
- **T-F0021-06 [SL-F0021-04, AC-F0021-09, AC-F0021-10, AC-F0021-11, AC-F0021-12]:** Run drift guard across dossier, README runtime notes, and smoke contract/tests before implementation closure.
## 9. Test plan & Coverage map

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

## 10. Decision log (ADR blocks)

### ADR-F0021-01: Follow-up remains a new backlog delta instead of reopening F-0007
- Status: Accepted
- Date: 2026-04-17
- Context: `F-0007` already delivered the shared-runtime smoke harness, while the newly observed bottlenecks appeared only after `F-0020` promoted a real `Gemma` runtime.
- Decision: Keep `F-0007` historical and implement the optimization seam as `CF-028` / `F-0021`.
- Alternatives: Reopen `F-0007`; patch historical backlog state as if the original seam was not delivered.
- Consequences: New work can proceed without falsifying delivered smoke-harness history.

## 11. Progress & links

- Backlog item key: CF-028
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Docs:
  - [ADR-2026-04-17 Smoke Harness Follow-up Scope Extraction](../adr/ADR-2026-04-17-smoke-harness-follow-up-scope-extraction.md)
  - [F-0007 Детерминированный smoke harness и suite-scoped lifecycle deployment cell](./F-0007-deterministic-smoke-harness-and-suite-scoped-cell-lifecycle.md)
  - [F-0020 Реальный vLLM-serving и promotion model dependencies](./F-0020-real-vllm-serving-and-promotion-model-dependencies.md)
- Issue:
- PRs:

## 12. Change log

- 2026-04-17: Initial dossier created from backlog item `CF-028` at backlog delivery state `planned`.
- 2026-04-17 [clarification]: `spec-compact` completed for the smoke follow-up with atomic ACs, boundary operations, adversarial semantics and decision triage for the post-`F-0020` runtime path.
- 2026-04-17 [planning]: `plan-slice` completed with an explicit risk-to-proof map, four delivery slices, allowed stop points and a post-implementation usage audit contract.
