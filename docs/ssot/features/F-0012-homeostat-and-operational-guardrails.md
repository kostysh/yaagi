---
id: F-0012
title: Гомеостат и операционные guardrails
status: done
coverage_gate: strict
owners: ["@codex"]
area: governance
depends_on: [F-0003, F-0004, F-0010, F-0011]
impacts: [runtime, db, governance, safety, observability, jobs]
created: 2026-03-25
updated: 2026-03-25
links:
  issue: ""
  pr: []
  docs:
    - "docs/architecture/system.md"
    - "docs/ssot/features/F-0003-tick-runtime-scheduler-episodic-timeline.md"
    - "docs/ssot/features/F-0004-subject-state-kernel-and-memory-model.md"
    - "docs/ssot/features/F-0010-executive-center-and-bounded-action-layer.md"
    - "docs/ssot/features/F-0011-narrative-and-memetic-reasoning-loop.md"
---

# F-0012 Гомеостат и операционные guardrails

## 1. Context & Goal

- **User problem:** После `F-0004`, `F-0010` и `F-0011` система уже умеет хранить bounded subject-state, вести narrative/memetic continuity и принимать bounded executive outcomes, но у неё всё ещё нет канонического owner-а для operational sanity checks и early safety reactions. Без explicit owner-а oscillation/continuity risk, development freeze logic и rollback-sensitive guardrails расползаются между runtime, reporting, governor и lifecycle seams, а автоматические реакции рискуют превратиться в direct writes или неаудируемые shortcuts.
- **Goal:** Зафиксировать один canonical dossier-owner для `Homeostat`, который вычисляет всю архитектурную стартовую матрицу guardrail-сигналов, пишет durable `homeostat_snapshots`, публикует bounded reaction requests через typed `pg-boss` family и при этом не захватывает policy execution или foreign write authority.
- **Non-goals:** Полный observability/reporting perimeter, operator API, mature governor policy execution, detailed implementation future source seams, expanded organ ecology и direct tool execution не входят в текущий feature scope.
- **Current substrate / baseline:** Delivered prerequisites already exist as `F-0003` runtime/scheduler continuity, `F-0004` bounded subject-state store, `F-0010` executive/action audit boundary and `F-0011` narrative/memetic seam. Full guardrail shaping additionally depends on future canonical source surfaces owned by `CF-015`, `CF-016` and `CF-018`; the dossier must realign those boundaries explicitly instead of inventing proxy metrics.

## 2. Scope

### In scope

- Canonical owner for `Homeostat`, `homeostat_snapshots` and the typed `homeostat.reaction-request` queue family on the existing PostgreSQL/`pg-boss` substrate.
- Full architectural starter signal matrix from `docs/architecture/system.md#15.4`:
  - `affect_volatility`
  - `goal_churn`
  - `coalition_dominance`
  - `narrative_rewrite_rate`
  - `development_proposal_rate`
  - `resource_pressure`
  - `organ_error_rate`
  - `rollback_frequency`
- Explicit warning/critical thresholds, machine-readable alert payloads and reaction kinds for every signal family.
- Dual evaluation cadence:
  - completed-tick evaluation on committed source state;
  - scheduled periodic evaluation through a dedicated homeostat job family on canonical `pg-boss`.
- Signal status semantics for every family: `evaluated`, `degraded`, `not_evaluable`.
- Cross-cutting source-contract realignment for future-owned signal inputs in `CF-015`, `CF-016` and `CF-018`.

### Out of scope

- Direct policy execution, direct freeze writes, direct rollback/quarantine enforcement and direct tool invocation.
- Dedicated operator-facing reports, dashboards, tracing pipelines and HTTP routes.
- Delivery of the future source seams themselves; this dossier shapes their contracts and schema expectations only.
- A separate worker service, sidecar topology or process-local timer loop as a new canonical scheduler path.

### Constraints

- Homeostat reads only committed canonical state. It must not depend on in-flight tick-local drafts or private process-local caches.
- `F-0012` owns `homeostat_snapshots` and the typed reaction-request queue family only. It must not directly mutate `psm_json`, `goals`, `beliefs`, `entities`, `relationships`, `memetic_units`, `memetic_edges`, `coalitions`, `narrative_spine_versions`, `field_journal_entries`, `action_log`, `development_ledger`, rollback/lifecycle tables or future governor proposal surfaces.
- Automatic reactions must route through canonical owners (`F-0003`, `F-0008`, `F-0010`, `F-0011`, future `CF-016`) rather than helper writes or hidden imperative shortcuts.
- Missing canonical sources must surface as `degraded` or `not_evaluable`; hidden proxy metrics are forbidden.
- Tick-complete and periodic evaluation must share the same scoring contract, threshold profile and reaction payload shape.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0012-01:** `F-0012` establishes one canonical owner seam for `Homeostat`, durable `homeostat_snapshots` and a typed `homeostat.reaction-request` queue family: it evaluates operational stability from committed canonical evidence and does not create a parallel hidden control state outside these durable surfaces.
- **AC-F0012-02:** `F-0012` shapes the full starter guardrail matrix from architecture section `15.4` with explicit warning and critical thresholds, alert payload fields and source-surface mapping for `affect_volatility`, `goal_churn`, `coalition_dominance`, `narrative_rewrite_rate`, `development_proposal_rate`, `resource_pressure`, `organ_error_rate` and `rollback_frequency`.
- **AC-F0012-03:** For signal families whose richest canonical sources belong to future seams, `F-0012` fixes explicit source contracts instead of deferring the signal itself: `CF-015` must own read-only model/organ health report surfaces for `organ_error_rate`, `CF-016` must own `development_ledger` and freeze/policy evidence for `development_proposal_rate`, and `CF-018` must own rollback/graceful-shutdown lifecycle evidence for `rollback_frequency`.
- **AC-F0012-04:** Homeostat evaluation has dual cadence: the same evaluator runs after committed tick completion and on a scheduled periodic path through the canonical PostgreSQL/`pg-boss` substrate; both cadences emit the same snapshot shape and the same typed reaction-request contract.
- **AC-F0012-05:** Automatic reactions remain bounded and owner-routed: homeostat may request affect limiting, reflective counterweight, lower tick ambition, narrative-edit freeze, goal-promotion restriction, development freeze, router quarantine escalation or human review, but it must publish only typed reaction requests and must never directly mutate foreign source tables or execute tools.
- **AC-F0012-06:** `homeostat_snapshots` is the canonical durable read model for this seam and records enough detail for deterministic replay and downstream read-only consumption: snapshot identity, cadence/tick anchors, per-signal metrics, per-signal evaluation status, effective alert set, derived stability summary, requested reaction refs and creation time.
- **AC-F0012-07:** When some future-owned canonical source is absent, stale or not yet delivered, homeostat remains available by emitting bounded snapshots with explicit `degraded` or `not_evaluable` status for the affected family; it must not fabricate proxy values that appear authoritative.
- **AC-F0012-08:** Ownership separation stays explicit after shaping: `F-0012` owns detection/scoring/snapshotting/reaction publication, `CF-015` owns read-only reports and health diagnostics, `CF-016` owns policy execution and freeze state, and `CF-018` owns lifecycle/rollback evidence plus retention semantics.

## 4. Non-functional requirements (NFR)

- **Operational safety:** The system must not start without a complete threshold matrix, even if some families initially evaluate as `degraded` or `not_evaluable`.
- **Auditability:** Snapshots and reaction requests must be durable, attributable to explicit cadence/tick context and suitable for later reporting/governor review.
- **Determinism:** The same committed source state and threshold profile must produce the same snapshot, statuses and reaction payloads.
- **Graceful degradation:** Optional future inputs reduce fidelity, not availability.
- **Ownership discipline:** Homeostat may recommend or escalate reactions, but it must not become a convenience backdoor for business/state writes.

## 5. Design (compact)

### 5.1 API and internal contract surface

- `F-0012` does not add a public HTTP/operator API.
- The seam owns three internal contracts:
  - `HomeostatSignalScore`
  - `HomeostatSnapshot`
  - `HomeostatReactionRequest`
- `HomeostatSignalScore` must minimally carry:
  - `signalFamily`
  - `status` as `evaluated | degraded | not_evaluable`
  - `metricValue`
  - `warningThreshold`
  - `criticalThreshold`
  - `severity`
  - `evidenceRefs`
- `HomeostatSnapshot` must minimally carry:
  - `snapshotId`
  - `cadenceKind` as `tick_complete | periodic`
  - `tickId` when present
  - `overallStability`
  - `signalScores`
  - `alerts`
  - `reactionRequestRefs`
  - `createdAt`
- `HomeostatReactionRequest` must minimally carry:
  - `reactionRequestId`
  - `snapshotId`
  - `signalFamily`
  - `severity`
  - `requestedActionKind`
  - `evidenceRefs`
  - `idempotencyKey`
  - `expiresAt`
  - `createdAt`

### 5.2 Runtime and deployment surface

- Homeostat lives inside the existing `core` monolith.
- Tick-complete evaluation runs only after committed runtime/state/narrative/executive writes are durable.
- Periodic evaluation runs through the dedicated `homeostat.periodic-evaluation` scheduler/job family on the already delivered PostgreSQL/`pg-boss` substrate; it is not an ad hoc in-memory timer.
- Early delivered read inputs come from:
  - `F-0003` runtime continuity, tick history and scheduler posture;
  - `F-0004` bounded subject-state snapshots and goal state;
  - `F-0011` narrative/memetic surfaces for affect, coalition and narrative continuity signals;
  - `F-0010` executive/action audit evidence.
- Future canonical read inputs are fixed now as:
  - `CF-015` read-only model/organ health reports for `organ_error_rate`;
  - `CF-016` `development_ledger`, proposal-rate counters and freeze-policy evidence for `development_proposal_rate`;
  - `CF-018` rollback/graceful-shutdown/event-envelope evidence for `rollback_frequency`.
- Bounded outputs are:
  - durable `homeostat_snapshots`;
  - typed `homeostat.reaction-request` queue jobs consumed by canonical owner gates.

### 5.3 Data model changes

- Canonical durable table owned by this dossier is `homeostat_snapshots`.
- `homeostat_snapshots` must preserve the baseline architectural fields and expand them to the shaped contract:
  - `snapshot_id`
  - `cadence_kind`
  - `tick_id`
  - `overall_stability`
  - `affect_volatility`
  - `goal_churn`
  - `coalition_dominance`
  - `narrative_rewrite_rate`
  - `development_proposal_rate`
  - `resource_pressure`
  - `organ_error_rate`
  - `rollback_frequency`
  - `development_freeze`
  - `signal_status_json`
  - `alerts_json`
  - `reaction_request_refs_json`
  - `created_at`
- Reaction publication uses an allowlisted `pg-boss` family rather than a new domain queue table. The shaped canonical family name is `homeostat.reaction-request`.
- The internal cadence trigger also uses a dedicated allowlisted `pg-boss` family named `homeostat.periodic-evaluation` with the canonical schedule key `default`; it is runtime-owned infrastructure for periodic evaluation, not a downstream reaction contract.
- This shaping step also fixes future schema expectations outside `F-0012`:
  - `CF-015` must expose a durable read model for organ/profile health diagnostics;
  - `CF-016` must expose durable development-governor evidence for proposal-rate and freeze decisions;
  - `CF-018` must expose durable rollback and shutdown/lifecycle evidence suitable for frequency scoring.

### 5.4 Source mapping and ownership boundaries

- `affect_volatility`, `coalition_dominance` and `narrative_rewrite_rate` derive from `F-0011` narrative/memetic surfaces.
- `goal_churn` derives from `F-0004` subject-state goal/version history.
- `resource_pressure` derives from committed runtime/resource posture already normalized into canonical runtime/perception surfaces.
- `development_proposal_rate` reads only governor-owned evidence from `CF-016`; homeostat may request a freeze but never writes governor state itself.
- `organ_error_rate` reads only reporting/health surfaces from `CF-015` backed by model-routing and execution evidence; homeostat does not infer this metric from arbitrary raw tool failures.
- `rollback_frequency` reads only lifecycle evidence from `CF-018`; homeostat does not count ad hoc local incidents as rollbacks.

### 5.5 Edge cases and failure modes

- Startup with no prior snapshots must still produce a bounded baseline snapshot.
- Periodic evaluation may run without an active tick; in that case it still emits canonical snapshots with `cadenceKind = periodic`.
- Missing or stale future-owned source surfaces must mark only the affected families as `degraded` or `not_evaluable`, not block the whole evaluator.
- Repeated critical evaluations must not fan out into unbounded duplicate reactions; idempotency/coalescing is part of the reaction-request contract.
- Homeostat may emit a development-freeze request before `CF-016` is delivered, but it may not self-authorize freeze execution.

### 5.6 Verification surface

- This dossier defines:
  - contract tests for signal scoring, status semantics and threshold evaluation;
  - integration tests for tick-complete and periodic cadence using the same evaluator;
  - persistence coverage for `homeostat_snapshots`;
  - routing coverage for typed reaction requests through canonical owner gates;
  - degradation coverage for missing future-owned sources.
- Runtime/startup behavior changed in implementation, so the canonical deployment-cell smoke path is mandatory and part of feature closure.

## 6. Definition of Done

- `F-0012` is the canonical owner for homeostat detection, scoring, snapshotting and bounded reaction publication.
- The full architectural starter signal matrix is fixed with thresholds, status semantics and canonical source ownership.
- `homeostat_snapshots` and the typed `homeostat.reaction-request` family are separated from reporting, governor execution and lifecycle retention seams.
- Missing future source surfaces have explicit canonical owners and schema expectations recorded in SSoT/backlog artifacts.
- Direct write access to foreign identity-bearing, action, governor or lifecycle surfaces remains forbidden.
- Architecture coverage, backlog watchpoints and the global index stay aligned with the delivered implementation.

## 7. Slicing plan

### Slice SL-F0012-01: Contracts, threshold catalog and snapshot persistence boundary
Delivers: canonical `HomeostatSignalScore` / `HomeostatSnapshot` / `HomeostatReactionRequest` contracts, the full starter threshold matrix and the `homeostat_snapshots` persistence boundary for deterministic read-back.
Covers: AC-F0012-01, AC-F0012-02, AC-F0012-06
Verification: `contract`, `db`
Exit criteria:
- Signal catalog, warning/critical thresholds and alert payload fields are fixed in one canonical contract surface without parallel shadow enums.
- `homeostat_snapshots` persistence shape is explicit enough for deterministic replay and read-only downstream consumption.
- Planned storage/tests stay on the canonical runtime stack: `packages/contracts`, `packages/db`, `node:test`.

### Slice SL-F0012-02: Evaluator on committed state and degraded source semantics
Delivers: one evaluator over committed canonical evidence, source-reader boundaries for delivered and future-owned surfaces, and explicit `evaluated | degraded | not_evaluable` behavior per signal family.
Covers: AC-F0012-02, AC-F0012-03, AC-F0012-06, AC-F0012-07
Verification: `contract`, `integration`
Exit criteria:
- Delivered inputs from `F-0003`, `F-0004`, `F-0010` and `F-0011` are mapped to signal families through explicit adapters instead of ad hoc runtime reads.
- `CF-015`, `CF-016` and `CF-018` source expectations are consumed only through declared read contracts and degrade cleanly when absent or stale.
- The evaluator produces one stable score/status shape regardless of which source families are currently unavailable.

### Slice SL-F0012-03: Reaction publication and owner-gate routing
Delivers: typed `homeostat.reaction-request` publication on canonical `pg-boss`, idempotency/coalescing rules and owner-routed reaction semantics that remain advisory until canonical consumers act.
Covers: AC-F0012-01, AC-F0012-04, AC-F0012-05, AC-F0012-08
Verification: `contract`, `integration`, `db`
Exit criteria:
- Reaction publication uses an allowlisted `homeostat.reaction-request` family on the existing `packages/db/src/jobs.ts` substrate.
- Payloads carry stable identity, severity, evidence refs, TTL and idempotency data sufficient for retry-safe routing.
- Write-authority guards prove that homeostat publishes advisory requests only and never mutates governor, lifecycle, subject-state, narrative or action tables directly.

### Slice SL-F0012-04: Dual cadence wiring, runtime closure and smoke gate
Delivers: post-commit tick wiring, scheduled periodic evaluation, duplicate-suppression rules, final runtime verification and conditional deployment-cell smoke closure.
Covers: AC-F0012-03, AC-F0012-04, AC-F0012-07, AC-F0012-08
Verification: `integration`, `smoke-if-runtime-path-changes`
Exit criteria:
- The same evaluator runs on the completed-tick path and on scheduled periodic jobs without diverging payload or threshold semantics.
- Repeated scheduler invocations coalesce duplicate reactions by explicit idempotency/evidence rules rather than incidental timing.
- If implementation changes runtime/startup/deployment behavior, the canonical deployment-cell smoke path is added before feature closure.

## 8. Task list

- **T-F0012-01:** Materialize the threshold catalog and contract types for `SL-F0012-01` in the canonical contract surface used by runtime and persistence layers. Covers: AC-F0012-01, AC-F0012-02, AC-F0012-06.
- **T-F0012-02:** Add the `homeostat_snapshots` store boundary, indexes and deterministic read-model mapping for `SL-F0012-01`. Covers: AC-F0012-01, AC-F0012-06.
- **T-F0012-03:** Implement committed-state source readers and score assembly for `SL-F0012-02`, using delivered seams first and future-source adapters second. Covers: AC-F0012-02, AC-F0012-06, AC-F0012-07.
- **T-F0012-04:** Add degradation and `not_evaluable` guards for `CF-015` / `CF-016` / `CF-018` source gaps in `SL-F0012-02`. Covers: AC-F0012-03, AC-F0012-07, AC-F0012-08.
- **T-F0012-05:** Implement typed `homeostat.reaction-request` publication and payload/idempotency rules for `SL-F0012-03`. Covers: AC-F0012-01, AC-F0012-04, AC-F0012-05.
- **T-F0012-06:** Add owner-gate routing and write-authority guards for `SL-F0012-03`, proving reactions remain advisory. Covers: AC-F0012-05, AC-F0012-08.
- **T-F0012-07:** Wire the shared evaluator into completed-tick and scheduled periodic execution paths for `SL-F0012-04`. Covers: AC-F0012-04, AC-F0012-07.
- **T-F0012-08:** Add final runtime integration coverage, duplicate-reaction suppression checks and conditional deployment-cell smoke closure for `SL-F0012-04`. Covers: AC-F0012-03, AC-F0012-04, AC-F0012-08.

## 9. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0012-01 | `packages/db/test/homeostat-store.integration.test.ts` → `test("AC-F0012-01 snapshot/reaction persistence boundary keeps advisory reaction refs separate from signal scores")`; `apps/core/test/runtime/homeostat-write-authority.contract.test.ts` → advisory-only publication guard `// Covers: AC-F0012-01` | done |
| AC-F0012-02 | `apps/core/test/runtime/homeostat-evaluator.contract.test.ts` → `test("AC-F0012-02 evaluates the full starter guardrail matrix from canonical source mappings")` | done |
| AC-F0012-03 | `apps/core/test/runtime/homeostat-degraded-sources.integration.test.ts` → `test("AC-F0012-03 degrades CF-015 / CF-016 / CF-018-backed signals without fabricating proxy metrics")`; `infra/docker/deployment-cell.smoke.ts` → wake-tick plus periodic runtime cadence smoke `// Covers: AC-F0012-03` | done |
| AC-F0012-04 | `apps/core/test/runtime/homeostat-cadence.integration.test.ts` → `test("AC-F0012-04 runs the same homeostat evaluator on completed-tick and periodic cadence paths")`; `infra/docker/deployment-cell.smoke.ts` → `test("AC-F0012-04 runs homeostat on the committed wake tick and on scheduled periodic cadence inside the deployment cell")` | done |
| AC-F0012-05 | `apps/core/test/runtime/homeostat-reaction-routing.integration.test.ts` → `test("AC-F0012-05 publishes bounded homeostat reaction requests through owner gates without direct execution")`; `apps/core/test/runtime/homeostat-write-authority.contract.test.ts` → foreign-write prohibition `// Covers: AC-F0012-05` | done |
| AC-F0012-06 | `packages/db/test/homeostat-store.integration.test.ts` → `test("AC-F0012-06 persists deterministic homeostat snapshots for replay and read-only downstream consumption")`; `apps/core/test/runtime/homeostat-evaluator.contract.test.ts` → `test("AC-F0012-06 persists a stable snapshot shape for replay and read-only downstream consumption")` | done |
| AC-F0012-07 | `apps/core/test/runtime/homeostat-degraded-sources.integration.test.ts` → degraded/not-evaluable semantics `// Covers: AC-F0012-07`; `apps/core/test/runtime/homeostat-cadence.integration.test.ts` → `test("AC-F0012-07 periodic homeostat evaluation does not require an active tick to emit a bounded snapshot")` | done |
| AC-F0012-08 | `apps/core/test/runtime/homeostat-write-authority.contract.test.ts` → `test("AC-F0012-08 keeps homeostat outputs advisory and does not encode direct foreign-table mutations")`; `apps/core/test/runtime/homeostat-reaction-routing.integration.test.ts` → owner-gate routing `// Covers: AC-F0012-08` | done |

## 10. Decision log (ADR blocks)

### ADR-F0012-01: Homeostat owns detection and bounded reaction publication, not policy execution
- Status: Accepted
- Date: 2026-03-25
- Context: Architecture already requires early safety reactions, but adjacent seams also claim related concerns: `CF-015` owns richer observability/reporting, `CF-016` owns policy execution and `development_ledger`, while runtime/narrative/state seams own the source tables that homeostat must inspect.
- Decision: Keep `F-0012` as the owner of signal detection, threshold evaluation, durable `homeostat_snapshots` and typed `homeostat.reaction-request` publication only. Do not grant it direct policy execution or direct write access to foreign surfaces.
- Alternatives: Fold reactions into reporting; make homeostat a direct freeze/policy writer; wait for `CF-016` and leave early guardrails ownerless.
- Consequences: Early safety can be delivered without collapsing reporting, governor and source-surface ownership into one seam.

### ADR-F0012-02: Full-signal shaping uses cross-cutting canonical-source realignment, never hidden proxies
- Status: Accepted
- Date: 2026-03-25
- Context: Architecture section `15.4` already defines the full starter threshold matrix, but some of its richest source surfaces belong to future seams (`CF-015`, `CF-016`, `CF-018`). Leaving those signals "for later" would keep the guardrail matrix incomplete, while fabricating proxy metrics would blur ownership.
- Decision: Shape the entire signal matrix now and realign future seams so their canonical source surfaces are explicit in backlog/architecture artifacts. Until those sources are delivered, homeostat emits `degraded` or `not_evaluable` status for the affected families rather than proxy values.
- Alternatives: Restrict `F-0012` to already delivered signals only; fabricate temporary proxy metrics from unrelated tables.
- Consequences: The guardrail contract becomes complete and implementation-safe without silently reassigning ownership or inventing false certainty.

### ADR-F0012-03: Homeostat uses one evaluator across completed-tick and scheduled periodic cadence
- Status: Accepted
- Date: 2026-03-25
- Context: Some operational risks become visible only when a tick commits new state, while others must still be monitored even without a fresh tick. Divergent evaluators would create inconsistent alerts and reaction semantics.
- Decision: Run the same evaluator on two canonical paths: post-commit tick evaluation and a dedicated scheduled job family on the existing PostgreSQL/`pg-boss` substrate. Both paths produce the same snapshot and reaction-request contracts.
- Alternatives: Tick-only evaluation; periodic in-memory timer; separate read-only monitor that cannot publish reactions.
- Consequences: Homeostat keeps one canonical scoring model and one canonical reaction path while remaining compatible with the already delivered scheduler substrate.

## 11. Progress & links

- Status progression: `proposed -> shaped -> planned -> done`
- Candidate source: `CF-008`
- Delivered prerequisites: `F-0003`, `F-0004`, `F-0010`, `F-0011`
- Code:
  - `apps/core/src/runtime/homeostat.ts`
  - `apps/core/src/runtime/index.ts`
  - `apps/core/src/runtime/runtime-lifecycle.ts`
  - `apps/core/testing/homeostat-fixture.ts`
  - `apps/core/test/runtime/homeostat-cadence.integration.test.ts`
  - `apps/core/test/runtime/homeostat-degraded-sources.integration.test.ts`
  - `apps/core/test/runtime/homeostat-evaluator.contract.test.ts`
  - `apps/core/test/runtime/homeostat-reaction-routing.integration.test.ts`
  - `apps/core/test/runtime/homeostat-write-authority.contract.test.ts`
  - `infra/docker/deployment-cell.smoke.ts`
  - `infra/migrations/008_homeostat_runtime.sql`
  - `packages/contracts/src/runtime.ts`
  - `packages/db/src/homeostat.ts`
  - `packages/db/src/index.ts`
  - `packages/db/src/jobs.ts`
  - `packages/db/test/homeostat-store.integration.test.ts`
- Verification:
  - `pnpm format`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm smoke:cell`
  - `dossier-engineer index-refresh`
  - `dossier-engineer contract-drift-audit --dossier docs/ssot/features/F-0012-homeostat-and-operational-guardrails.md --base HEAD~1`
  - `dossier-engineer lint-dossiers`
  - `dossier-engineer coverage-audit --dossier docs/ssot/features/F-0012-homeostat-and-operational-guardrails.md --orphans-scope=dossier`
  - `dossier-engineer debt-audit --changed-only`
  - `dossier-engineer dossier-verify --dossier docs/ssot/features/F-0012-homeostat-and-operational-guardrails.md --step implementation`

## 12. Change log

- **v1.0 (2026-03-25):** Initial feature-intake dossier created from `CF-008`; intake fixed `Homeostat` and `homeostat_snapshots` as one early-safety seam and separated reporting, governor policy execution and lifecycle ownership.
- **v1.1 (2026-03-25):** `spec-compact` completed: full starter signal matrix fixed, dual cadence aligned on canonical `pg-boss`, typed reaction-request queue contract introduced, and cross-cutting source contracts for `CF-015`, `CF-016` and `CF-018` made explicit.
- **v1.2 (2026-03-25):** `plan-slice` moved the dossier to `planned`; delivery is now split into four implementation slices covering contract/persistence surfaces, committed-state evaluator and degraded source handling, advisory reaction publication, and dual-cadence runtime closure.
- **v1.3 (2026-03-25):** Completed `implementation`: delivered canonical homeostat contracts and persistence, added the `homeostat_snapshots` runtime schema, wired post-commit and periodic evaluation through the canonical `pg-boss` substrate, emitted advisory `homeostat.reaction-request` jobs with explicit idempotency keys, and closed AC-linked contract/integration/DB/smoke coverage without granting direct write authority over foreign seams.
