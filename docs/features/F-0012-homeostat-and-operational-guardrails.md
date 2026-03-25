---
id: F-0012
title: Гомеостат и операционные guardrails
status: proposed
coverage_gate: deferred
owners: ["@codex"]
area: governance
depends_on: [F-0004, F-0010, F-0011]
impacts: [runtime, db, governance, safety, observability]
created: 2026-03-25
updated: 2026-03-25
links:
  issue: ""
  pr: []
  docs:
    - "docs/architecture/system.md"
    - "docs/features/F-0004-subject-state-kernel-and-memory-model.md"
    - "docs/features/F-0010-executive-center-and-bounded-action-layer.md"
    - "docs/features/F-0011-narrative-and-memetic-reasoning-loop.md"
---

# F-0012 Гомеостат и операционные guardrails

## 1. Context & Goal

- **User problem:** После `F-0004`, `F-0010` и `F-0011` система уже умеет хранить bounded subject-state, вести narrative/memetic continuity и принимать bounded executive outcomes, но у неё всё ещё нет канонического owner-а для operational sanity checks и early safety reactions. Без явного intake такого seam-а oscillation/continuity risks начинают расползаться между runtime, reporting и будущим governor-слоем, а автоматические реакции рискуют превратиться в ad hoc direct writes или неаудируемые freeze shortcuts.
- **Goal:** Зафиксировать один канонический dossier-owner для `Homeostat` и `homeostat_snapshots`, который вычисляет baseline stability/risk signals из уже committed canonical surfaces, хранит bounded snapshot history и выпускает bounded guardrail/reaction requests без захвата чужих write authorities.
- **Non-goals:** Полный observability/reporting perimeter, operator API, mature development-governor policy execution, consolidation/biographical retention semantics, expanded model registry health и direct tool execution в этот intake не входят.
- **Current substrate / baseline:** Delivered prerequisites already exist as `F-0004` bounded subject-state store, `F-0011` narrative/memetic read-write seam and `F-0010` executive/action audit boundary. `F-0012` must sit on top of those committed surfaces and stay separate from future `CF-015` reporting, `CF-016` governor policy gates and `CF-018` lifecycle/consolidation ownership.

## 2. Scope

### In scope

- Канонический owner для `Homeostat` loop и durable `homeostat_snapshots`.
- Early safety signal set для already delivered substrates: oscillation risk, coalition dominance, affect volatility, continuity risk, resource pressure and a bounded development-churn proxy, each with default warning/critical thresholds and alert payload shape.
- Bounded automatic reaction contract, через который homeostat может запросить counterweight, ограничение affect/tick ambition, proposal-freeze request или incident annotation через canonical owner gates.
- Internal runtime integration inside the existing `core` monolith without a new public API or sidecar topology.
- Intake-level partition between signals/reactions that belong to the early homeostat seam now and richer reporting/governor/consolidation concerns that stay future-owned.

### Out of scope

- Dedicated reports, dashboards, tracing pipelines and operator-facing observability APIs; those stay with `CF-015`.
- Ownership of `development_ledger`, policy profiles, rollout/rollback policy execution and mature freeze conditions; those stay with `CF-016`.
- Consolidation retention, event-envelope biography and graceful shutdown history ownership; those stay with `CF-018`.
- Expanded organ health/fallback policy that depends on future model-registry ecology from `CF-010`.
- Direct execution of tools, direct tick admission, or direct SQL writes into foreign identity-bearing tables.

### Constraints

- Homeostat reads only committed canonical state; it must not depend on uncommitted in-flight tick state or private process-local caches.
- `F-0012` owns `homeostat_snapshots` and bounded guardrail outputs only. It must not directly mutate `psm_json`, `goals`, `beliefs`, `entities`, `relationships`, `memetic_units`, `memetic_edges`, `coalitions`, `narrative_spine_versions`, `field_journal_entries`, `action_log` or future governor proposal tables.
- Automatic reactions must route through canonical owners (`F-0003`, `F-0008`, `F-0010`, future `CF-016`) rather than bypassing them with helper writes or hidden imperative shortcuts.
- Signals whose canonical source seam is not yet delivered must stay explicit future extensions, not silently approximated with ad hoc proxies that would blur ownership.
- The early homeostat seam remains internal to the existing `core` monolith; it may not require a new sidecar, worker topology or public route just to evaluate guardrails.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0012-01:** `F-0012` establishes one canonical owner seam for `Homeostat` and `homeostat_snapshots`: it evaluates operational stability from already committed runtime, subject-state, narrative/memetic and executive evidence, and it does not create a parallel hidden control state outside canonical durable surfaces.
- **AC-F0012-02:** The early homeostat signal set covers at least oscillation risk, coalition dominance, affect volatility, continuity risk, resource pressure and a bounded development-churn proxy, each with explicit warning and critical thresholds plus machine-readable alert payloads; signals that require not-yet-delivered canonical inputs remain explicitly deferred to future seams instead of being silently fabricated.
- **AC-F0012-03:** Automatic reactions are bounded and route only through canonical owner gates: homeostat may emit guardrail/reaction requests such as affect limiting, reflective counterweight request, lower tick ambition, goal-promotion restriction request or development-freeze request, but it must not directly mutate foreign source tables, perform direct tool execution or bypass executive/governor/runtime boundaries.
- **AC-F0012-04:** `homeostat_snapshots` is the canonical durable surface for this seam and records at least `snapshot_id`, `tick_id` (when present), stability metrics, `development_freeze`, `alerts_json` and creation time, so downstream reporting and governance seams can consume snapshots read-only without turning homeostat into a reporting or policy-ownership shortcut.
- **AC-F0012-05:** The feature remains internal to the existing `core` monolith with no new public API, and it degrades gracefully when optional future inputs are absent by producing bounded partial-signal snapshots rather than blocking runtime startup or active tick processing.
- **AC-F0012-06:** Intake fixes the ownership split with adjacent seams: `F-0012` owns detection and bounded reaction requests, `CF-015` owns richer reports/derived observability surfaces, `CF-016` owns policy execution and ledger/freeze state, and `CF-018` owns lifecycle/retention semantics.

## 4. Non-functional requirements (NFR)

- **Operational safety:** Early guardrails must exist from the first delivered homeostat slice; the system should not rely on “later calibration” as an excuse for missing baseline thresholds.
- **Auditability:** Snapshot rows and emitted alerts must be durable and attributable to canonical tick/runtime context rather than ephemeral console-only warnings.
- **Determinism:** Given the same committed source state and threshold profile, homeostat scoring should produce the same snapshot and alert set.
- **Graceful degradation:** Absence of optional future sources must reduce fidelity, not availability.
- **Ownership discipline:** Homeostat may coordinate reactions, but it must not become a convenience backdoor writer into state, narrative, executive or governor surfaces.

## 5. Design (compact)

### 5.1 API and internal contract surface

- `F-0012` does not add a public HTTP/operator API at intake time.
- The seam owns one internal contract surface:
  - `HomeostatSnapshot`: bounded durable summary of current risk metrics and alerts.
  - `GuardrailReactionRequest`: bounded internal request payload consumed by canonical owners that decide whether and how to enforce a reaction.
- Shaping must decide whether reaction requests stay ephemeral inside the runtime path or require their own durable/request surface; this intake does not pre-authorize a generic mutable control table.

### 5.2 Runtime and deployment surface

- Homeostat lives inside the existing `core` monolith and evaluates committed state after canonical runtime/executive/narrative updates, or on a bounded internal monitoring cadence derived from the same committed surfaces.
- Early canonical read inputs come from:
  - `F-0003` runtime continuity and tick history;
  - `F-0004` bounded subject-state snapshots;
  - `F-0011` narrative/memetic read model and durable narrative surfaces;
  - `F-0010` executive/action audit evidence.
- Early bounded outputs are:
  - durable `homeostat_snapshots`;
  - bounded reaction requests toward canonical owners.
- Shaping must keep the seam separate from dedicated reporting jobs and from full governor policy execution.

### 5.3 Data model changes

- Canonical durable surface for this dossier is `homeostat_snapshots`.
- Intake-fixed baseline fields are the architectural ones already described in `docs/architecture/system.md`:
  - `snapshot_id`
  - `tick_id`
  - `overall_stability`
  - `affect_volatility`
  - `goal_churn`
  - `coalition_dominance`
  - `resource_pressure`
  - `development_freeze`
  - `alerts_json`
  - `created_at`
- Shaping may refine metric derivation and additional non-owning metadata, but must not turn this seam into an alternate writer for identity-bearing sources.

### 5.4 Edge cases and failure modes

- Startup with no prior snapshots must still produce a bounded baseline instead of failing closed.
- Missing future signal sources must stay visible as “not yet available” rather than being replaced with hidden heuristics that look authoritative.
- Alert storms and repeated critical snapshots must not trigger unbounded repeated side effects; shaping must define idempotency/coalescing rules for reaction requests.
- Homeostat may recommend a development freeze before `CF-016` is delivered, but it may not silently self-authorize policy execution in its absence.
- Stale or delayed snapshots must never be treated as authority to back-write already committed source state.

### 5.5 Verification surface

- `feature-intake` closes on dossier/backlog/architecture alignment only.
- Later delivery will require:
  - contract coverage for signal scoring and threshold evaluation;
  - integration coverage for bounded reaction routing through canonical owners;
  - persistence coverage for `homeostat_snapshots`;
  - runtime verification that partial-signal mode does not block startup or active tick flow.
- Whether deployment-cell smoke is required will be decided during implementation based on the actual runtime-path changes.

## 6. Definition of Done

- `F-0012` is the canonical owner for homeostat detection and bounded operational reaction requests.
- `homeostat_snapshots` ownership is fixed to this dossier and remains separate from reporting, governor and consolidation seams.
- Early signal set and default-threshold responsibility are explicit, and future-signal gaps are recorded as future-seam scope rather than hidden technical debt.
- Direct write access to foreign identity-bearing or action/governor surfaces remains forbidden.
- Architecture coverage, backlog status and the global index stay aligned with the intake decision.

## 7. Slicing plan

### Slice SL-F0012-01: Snapshot contract and baseline signal set
Delivers: canonical `HomeostatSnapshot` contract, early signal catalog and threshold profile for already delivered source seams.
Covers: AC-F0012-01, AC-F0012-02, AC-F0012-04
Verification: `contract`

### Slice SL-F0012-02: Bounded reaction requests and owner-gate routing
Delivers: canonical reaction-request surface and routing rules toward runtime/router/executive/governor owners without direct side writes.
Covers: AC-F0012-03, AC-F0012-06
Verification: `contract`, `integration`

### Slice SL-F0012-03: Partial-signal degradation and runtime integration
Delivers: internal runtime wiring, partial-input fallback rules and startup/runtime non-blocking behavior for early homeostat operation.
Covers: AC-F0012-01, AC-F0012-05
Verification: `integration`

## 8. Task list

- **T-F0012-01:** Shape the baseline signal set, threshold profile and alert payload contract for `SL-F0012-01`. Covers: AC-F0012-01, AC-F0012-02, AC-F0012-04.
- **T-F0012-02:** Define canonical `homeostat_snapshots` ownership, persistence boundary and read-only downstream consumption for `SL-F0012-01`. Covers: AC-F0012-01, AC-F0012-04, AC-F0012-06.
- **T-F0012-03:** Specify bounded reaction requests and owner-gate routing rules for `SL-F0012-02`. Covers: AC-F0012-03, AC-F0012-06.
- **T-F0012-04:** Plan partial-signal degradation, startup/runtime behavior and verification path for `SL-F0012-03`. Covers: AC-F0012-05.

## 9. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0012-01 | To be defined during `spec-compact` / `plan-slice` | planned |
| AC-F0012-02 | To be defined during `spec-compact` / `plan-slice` | planned |
| AC-F0012-03 | To be defined during `spec-compact` / `plan-slice` | planned |
| AC-F0012-04 | To be defined during `spec-compact` / `plan-slice` | planned |
| AC-F0012-05 | To be defined during `spec-compact` / `plan-slice` | planned |
| AC-F0012-06 | To be defined during `spec-compact` / `plan-slice` | planned |

## 10. Decision log (ADR blocks)

### ADR-F0012-01: Homeostat owns detection and bounded reaction requests, not policy execution
- Status: Accepted
- Date: 2026-03-25
- Context: Architecture already requires early safety reactions, but adjacent seams also claim related concerns: `CF-015` owns richer observability/reporting, `CF-016` owns policy execution and `development_ledger`, while runtime/narrative/state seams own the source tables that homeostat must inspect.
- Decision: Keep `F-0012` as the owner of signal detection, threshold evaluation, durable `homeostat_snapshots` and bounded reaction requests only. Do not grant it direct policy execution or direct write access to foreign surfaces.
- Alternatives: Fold reactions into reporting; make homeostat a direct freeze/policy writer; wait for `CF-016` and leave early guardrails ownerless.
- Consequences: Early safety can be delivered without collapsing reporting, governor and source-surface ownership into one seam.

### ADR-F0012-02: Early homeostat baseline uses only delivered canonical inputs
- Status: Accepted
- Date: 2026-03-25
- Context: The architecture threshold table includes signals such as organ error rate and rollback frequency, but their richest canonical sources belong to future seams (`CF-010`, `CF-015`, `CF-016`, `CF-018`). An intake decision is needed so early homeostat scope does not silently rely on unavailable sources.
- Decision: Intake the early homeostat seam on top of already delivered inputs from `F-0004`, `F-0010` and `F-0011`, plus runtime continuity from `F-0003`. Keep richer thresholds and signal families as explicit future extensions instead of approximating them with hidden proxies.
- Alternatives: Block homeostat until every planned signal source exists; approximate unavailable signals from unrelated tables now.
- Consequences: `F-0012` can start with a bounded, auditable early-safety core while preserving honest scope boundaries toward future seams.

## 11. Progress & links

- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Candidate source: `CF-008`
- Delivered prerequisites: `F-0004`, `F-0010`, `F-0011`
- Code:
  - None yet; `feature-intake` only.
- Verification:
  - `node scripts/index-refresh.mjs`
  - `node scripts/lint-dossiers.mjs`
  - `node scripts/coverage-audit.mjs --dossier docs/features/F-0012-homeostat-and-operational-guardrails.md --orphans-scope=dossier`
  - `pnpm debt:audit:changed`
  - `node scripts/dossier-verify.mjs --dossier docs/features/F-0012-homeostat-and-operational-guardrails.md --step feature-intake`

## 12. Change log

- **v1.0 (2026-03-25):** Initial feature-intake dossier created from `CF-008`; intake fixes `Homeostat` and `homeostat_snapshots` as one early-safety seam, keeps reactions bounded, and explicitly separates reporting, governor policy execution and consolidation/lifecycle ownership.
