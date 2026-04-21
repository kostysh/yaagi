---
id: F-0023
title: Наблюдаемость и диагностические отчёты
status: planned
coverage_gate: deferred
backlog_item_key: CF-015
owners: ["@codex"]
area: observability
depends_on: ["F-0003", "F-0004", "F-0010", "F-0014", "F-0016", "F-0019"]
impacts: ["runtime", "db", "observability", "api", "governance"]
created: 2026-04-21
updated: 2026-04-21
links:
  issue: ""
  pr: []
  docs:
    - "docs/architecture/system.md"
    - "docs/polyphony_concept.md"
    - "docs/notes/backlog-legacy/feature-candidates.md"
    - "docs/notes/backlog-legacy/working-system-roadmap-matrix-2026-03-26.md"
    - "docs/ssot/features/F-0001-constitutional-boot-recovery.md"
    - "docs/ssot/features/F-0003-tick-runtime-scheduler-episodic-timeline.md"
    - "docs/ssot/features/F-0008-baseline-model-router-and-organ-profiles.md"
    - "docs/ssot/features/F-0010-executive-center-and-bounded-action-layer.md"
    - "docs/ssot/features/F-0012-homeostat-and-operational-guardrails.md"
    - "docs/ssot/features/F-0014-expanded-model-ecology-and-registry-health.md"
    - "docs/ssot/features/F-0016-development-governor-and-change-management.md"
    - "docs/ssot/features/F-0017-git-managed-body-evolution-and-stable-snapshots.md"
    - "docs/ssot/features/F-0019-consolidation-event-envelope-graceful-shutdown.md"
---

# F-0023 Наблюдаемость и диагностические отчёты

## 1. Context & Goal

- **Backlog handoff:**
  - Backlog item key: CF-015
  - Backlog delivery state at intake: defined
  - Source traceability:
    - docs/architecture/system.md
    - docs/polyphony_concept.md
    - docs/notes/backlog-legacy/feature-candidates.md
    - docs/notes/backlog-legacy/working-system-roadmap-matrix-2026-03-26.md
  - Known blockers at intake:
    - none recorded
  - Known dependencies at intake:
    - CF-002
    - CF-003
    - CF-007
    - CF-010
    - CF-016
    - CF-018
- **User problem:** После доставки `F-0003`, `F-0008`, `F-0010`, `F-0012`, `F-0014`, `F-0016` и `F-0019` репозиторий уже имеет bounded runtime evidence, baseline/richer model health source state, advisory homeostat, governor evidence и lifecycle evidence, но у него всё ещё нет одного canonical owner-а для операторских отчётов и diagnostic read models. В результате оператор, Homeostat, future release/support seams и human audit либо читают сырые owner tables напрямую, либо остаются на degraded signals без канонических report surfaces.
- **Goal:** Зафиксировать один canonical dossier-owner для read-only observability/reporting seam, который материализует identity continuity reports, model/organ health reports, development diagnostics, stable snapshot inventory и lifecycle diagnostic summaries из committed source state, публикует bounded metrics/log/tracing export contracts и при этом не забирает ownership над control routes, governor execution, lifecycle writes, router state или identity-bearing tables.
- **Non-goals:** Эта фича не реализует auth/RBAC (`CF-024`), deploy/release/rollback orchestration (`CF-025`), support/runbook contract (`CF-026`), mature policy profiles (`CF-027`), direct Homeostat scoring ownership (`F-0012`), governor freeze/proposal writes (`F-0016`), lifecycle evidence writes (`F-0019`) или direct registry/router writes (`F-0008` / `F-0014`).
- **Current substrate / baseline:** `F-0003` already owns active tick and continuity state, `F-0004` owns bounded subject-state storage, `F-0008` owns baseline organ/profile diagnostics, `F-0010` owns action audit evidence, `F-0012` already declares `CF-015` as the future canonical source family for `organ_error_rate`, `F-0014` owns richer `model_profile_health` and `model_fallback_links`, `F-0016` owns `development_ledger` and freeze/proposal evidence, `F-0017` / `F-0001` already expose stable snapshot and recovery anchors, and `F-0019` owns rollback/graceful-shutdown lifecycle facts. What is still missing is one report-materialization seam over those sources.

### Terms & thresholds

- `report surface`: one canonical read-only family materialized from committed source state and carrying explicit source refs, freshness state and publication timestamps.
- `identity continuity report`: bounded summary of runtime mode, tick continuity anchors, recent recovery incidents and last stable snapshot linkage for operator and audit consumption.
- `model/organ health report`: canonical read-only source for baseline and richer organ/profile health, including the source surface that `F-0012` must read for `organ_error_rate`.
- `stable snapshot inventory`: report family summarizing available stable snapshots, creation provenance, rollback anchors and consumption readiness without mutating body-evolution or recovery state.
- `report freshness`: report family state is considered fresh only when its `materialized_at` is newer than the latest source change included in that run; stale families must surface explicit degraded status rather than silently serving older payloads as current truth.

## 2. Scope

### In scope

- Canonical read-only report materialization for these first-phase families:
  - identity continuity reports;
  - model/organ health reports;
  - development diagnostics reports;
  - stable snapshot inventory;
  - lifecycle diagnostic summaries over rollback/graceful-shutdown evidence.
- Canonical metrics/log/tracing export contract for this seam, including report run identity, source refs, freshness/availability status and downstream publication metadata.
- Explicit owner split between report materialization and the underlying source seams from `F-0001`, `F-0003`, `F-0008`, `F-0010`, `F-0014`, `F-0016`, `F-0017` and `F-0019`.
- Canonical read contract for `F-0012` `organ_error_rate`, which must consume `CF-015` model/organ health reports rather than raw source tables from `F-0014`.
- Bounded operator/report consumption through the already delivered `F-0013` API boundary or offline artifacts, without creating a second gateway or shadow API surface.
- Explicit early baseline versus later richer observability slices, so first-working operability is not accidentally hidden behind phase-6 maturity.

### Out of scope

- Direct writes to owner source tables, identity-bearing state, router state, governor state, lifecycle evidence, release state or body-evolution state.
- Public auth/authz, RBAC or caller admission.
- Release promotion, smoke-on-deploy and rollback execution.
- Support/runbook ownership, incident taxonomy or operational escalation policy.
- Homeostat scoring thresholds and policy execution.
- External telemetry vendor selection or a second telemetry runtime outside the canonical `core + PostgreSQL + pg-boss` path.

### Constraints

- `CF-015` report workers are read-only consumers of committed source state and may not mutate `agent_state`, tick rows, subject-state tables, `model_registry`, `model_profile_health`, `model_fallback_links`, `development_ledger`, lifecycle evidence rows or stable snapshot source rows.
- `F-0013` remains the owner of the Hono API boundary. Any operator-facing report exposure must be implemented through that boundary, never through a parallel gateway or ad hoc file server.
- `F-0012` must read `CF-015` model/organ health reports for `organ_error_rate`; it may not treat raw `F-0014` source tables as a substitute report surface once this seam exists.
- `F-0019` remains the canonical owner for rollback/graceful-shutdown/event-envelope lifecycle truth. `CF-015` may summarize that evidence, but it may not become the source of record for lifecycle facts.
- Stable snapshot inventory must consume the already delivered stable snapshot and recovery evidence without taking ownership of body mutation or recovery execution.
- Missing upstream source families must degrade the affected report family explicitly. Hidden proxy metrics, fabricated default values or silent reuse of stale payloads are forbidden.

### Assumptions

- `F-0013` can later expose read-only report endpoints over `CF-015` payloads without changing the report owner split.
- The delivered stable snapshot surfaces from `F-0001` and `F-0017` are sufficient for inventory shaping without reopening `CF-012`.
- No backlog actualization is required during this shaping pass because `CF-015` already exists as the canonical selected backlog item and the current spec keeps its dependency set intact.

### Open questions

- None after `spec-compact`. Intake questions about materialization mode, Homeostat read contract and reporting/control boundary are resolved in `ADR-F0023-01` through `ADR-F0023-03`.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0023-01:** `CF-015` is the canonical writer for report families and report-run metadata only; it is not a writer for identity-bearing, router, governor, lifecycle or release source tables.
- **AC-F0023-02:** Every `CF-015` report family is materialized only from committed canonical source state; in-flight tick-local drafts and process-local caches are out of bounds.
- **AC-F0023-03:** `CF-015` rejects any implementation path that writes back to `agent_state`, tick lifecycle rows, `psm_json`, `goals`, `beliefs`, `model_registry`, `model_profile_health`, `model_fallback_links`, `development_ledger`, lifecycle evidence or stable snapshot source rows.
- **AC-F0023-04:** `CF-015` delivers a canonical identity continuity report family that summarizes runtime mode, continuity anchors, recent recovery/rollback linkage and the latest stable snapshot reference for operator/audit reads.
- **AC-F0023-05:** `CF-015` delivers a canonical model/organ health report family that is the read-only source for organ/profile health and for `F-0012` `organ_error_rate`.
- **AC-F0023-06:** The model/organ health report derives baseline diagnostics from `F-0008` and richer health/fallback sources from `F-0014` without writing back registry or health source state.
- **AC-F0023-07:** `CF-015` delivers a stable snapshot inventory report family over canonical stable snapshot and recovery evidence without depending on `CF-012` body-evolution ownership.
- **AC-F0023-08:** `CF-015` delivers a development diagnostics report family that summarizes actionable development evidence from `F-0010` and `F-0016` without writing governor or action source rows.
- **AC-F0023-09:** `CF-015` may deliver lifecycle diagnostic summaries over rollback/graceful-shutdown evidence from `F-0019`, but those summaries do not become lifecycle truth of record.
- **AC-F0023-10:** `CF-015` defines one canonical report-run/export contract carrying `report_run_id`, `report_family`, `source_refs`, `materialized_at`, `availability_status` and publication metadata for metrics/log/tracing exports.
- **AC-F0023-11:** Any operator-facing or human-audit report exposure goes only through the `F-0013` boundary or offline artifacts; `CF-015` does not create a second gateway.
- **AC-F0023-12:** If an upstream source family is absent, stale or not yet delivered, only the affected report family is marked `degraded`, `not_evaluable` or `unavailable`; `CF-015` must not fabricate proxy metrics or silently relabel stale data as fresh.
- **AC-F0023-13:** `CF-025` and `CF-026` must be able to consume `CF-015` report surfaces and report-run evidence read-only for deployment/support closure without requiring raw foreign table reads.
- **AC-F0023-14:** The first delivered `CF-015` slice must include identity continuity, model/organ health, development diagnostics and stable snapshot inventory before richer tracing/export slices are claimed.
- **AC-F0023-15:** Every report row or payload family emitted by `CF-015` carries source-owner refs and a `materialized_at` timestamp sufficient for audit and freshness checks.

## 4. Non-functional requirements (NFR)

Observable NFR signals and budgets:

- `report_boundary_violation_count` budget: `0` direct non-report writes into source-owner tables from reporting code paths.
- `report_provenance_coverage` threshold: `100%` of materialized report rows carry `report_run_id`, `source_refs` and `materialized_at`.
- `stale_report_family_served_without_status` budget: `0` report responses may omit explicit degraded/unavailable status when source freshness is insufficient.
- `duplicate_report_run_identity_rows` budget: `0` duplicate durable rows for the same normalized `(report_family, source_snapshot_signature)` run identity.

- **Boundary safety:** Reporting remains a read-only consumer; any detected back-write into foreign source tables is a release blocker.
- **Auditability:** Every report family and export record is attributable to a bounded run identity and explicit source refs.
- **Determinism:** The same committed source snapshot signature must produce the same canonical report payload for a given family.
- **Freshness signaling:** Stale or incomplete report families must emit explicit availability/freshness state, not implicit best-effort output.
- **Runtime containment:** All report materialization lives on the canonical `core + PostgreSQL + pg-boss` path; no separate telemetry sidecar or shadow runtime becomes the source of truth.

## 5. Design (compact)

### 5.1 API surface

- `CF-015` does not own a public API framework boundary.
- Read-only operator exposure, when enabled, must be projected through the already delivered `F-0013` Hono boundary.
- Reserved read families to expose through that boundary or equivalent offline artifacts:
  - `identity-continuity`
  - `model-health`
  - `stable-snapshots`
  - `development-diagnostics`
  - `lifecycle-diagnostics`
- No write route, acknowledge route, freeze route or deployment-control route belongs to `CF-015`.

Compact read contracts:

```ts
type ReportAvailability = "fresh" | "degraded" | "not_evaluable" | "unavailable";

type ReportRun = {
  reportRunId: string;
  reportFamily:
    | "identity_continuity"
    | "model_health"
    | "stable_snapshot_inventory"
    | "development_diagnostics"
    | "lifecycle_diagnostics";
  sourceRefs: string[];
  materializedAt: string;
  availability: ReportAvailability;
};

type IdentityContinuityReport = {
  reportRunId: string;
  runtimeMode: "booting" | "live" | "recovery" | "degraded" | "stopped";
  currentTickRef: string | null;
  lastStableSnapshotRef: string | null;
  recentRecoveryRefs: string[];
  availability: ReportAvailability;
  materializedAt: string;
};

type ModelHealthReport = {
  reportRunId: string;
  organId: string;
  profileId: string | null;
  healthStatus: "healthy" | "degraded" | "unavailable";
  errorRate: number | null;
  fallbackRef: string | null;
  sourceSurfaceRefs: string[];
  availability: ReportAvailability;
  materializedAt: string;
};
```

### 5.2 Runtime / deployment surface

- Report materialization runs inside the existing `core` runtime on the canonical PostgreSQL/`pg-boss` substrate.
- `CF-015` owns one allowlisted internal materialization job family `reporting.materialize`; `report_family` is part of the payload and no second scheduler/runtime is introduced.
- First-phase source readers:
  - `F-0001` / `F-0003` for continuity anchors and recovery linkage;
  - `F-0008` / `F-0014` for baseline/richer model health and fallback surfaces;
  - `F-0010` / `F-0016` for development diagnostics evidence;
  - `F-0017` plus boot/recovery evidence for stable snapshot inventory;
  - `F-0019` for rollback/graceful-shutdown lifecycle summaries.
- Export publication for logs/metrics/tracing remains bounded:
  - exports may publish derived payloads or pointers;
  - exports may not become a second source of truth;
  - export failure degrades report publication state but may not mutate source-owner tables.

### 5.3 Data model changes

- `CF-015` owns read-only report materialization storage only.
- Canonical durable tables or materialized views in first phase:
  - `report_runs`
  - `identity_continuity_reports`
  - `model_health_reports`
  - `stable_snapshot_inventory_reports`
  - `development_diagnostics_reports`
  - `lifecycle_diagnostics_reports`
- Minimum durable fields:
  - `report_run_id`
  - `report_family`
  - `source_refs_json`
  - `materialized_at`
  - `availability_status`
  - family-specific payload columns or `payload_json`
- Representation rule:
  - report storage may use materialized tables or materialized views behind one canonical contract;
  - raw source-owner tables remain the only source of truth for their domains;
  - `CF-015` storage is always derivative.

### 5.4 Edge cases and failure modes

- Baseline model diagnostics exist, but richer `F-0014` rows are absent or degraded.
- No stable snapshot exists yet, so inventory remains available but empty rather than failing closed.
- Lifecycle evidence exists only partially, so lifecycle diagnostics must degrade specific fields without inventing rollback events.
- Development diagnostics source rows exist, but publication/export of the derived report fails.
- A materialization job is replayed for the same source snapshot signature and must deduplicate to one canonical report run.
- Operator or support consumers request report families before upstream owner seams are fresh enough for a `fresh` status.

### 5.5 Verification surface / initial verification plan

- Contract tests for report family schemas, availability states and run identity semantics.
- Integration tests proving materialization from committed source state only.
- Boundary tests proving zero write paths from `CF-015` into foreign source-owner tables.
- Homeostat integration coverage proving `organ_error_rate` reads `CF-015` model health reports rather than raw `F-0014` state once the seam is delivered.
- Deduplication tests for repeated `reporting.materialize` runs over the same normalized source snapshot signature.
- If implementation later changes runtime startup, scheduler topology or public read routes, root quality gates plus `pnpm smoke:cell` are mandatory.

### 5.6 Representation upgrades (triggered only when needed)

#### Boundary operations

| Operation | Success behavior | Invalid / dependency failure | Duplicate / retry behavior |
|---|---|---|---|
| Materialize report family | Produces or refreshes one canonical report run and one family payload set from committed source refs. | Marks the family degraded/unavailable when required sources are absent or publication fails. | Same normalized source snapshot signature reuses one report-run identity. |
| Read report family | Returns the latest canonical report payload with explicit availability/freshness metadata. | Returns bounded unavailable/degraded status instead of raw foreign-table fallback. | Repeated reads are idempotent and do not create new materialization rows. |
| Publish metrics/log/tracing export | Emits one derived export record or pointer tied to a report run. | Degrades export status without mutating source-owner truth. | Replayed publish for the same report run deduplicates. |

#### Owner / consumer matrix

| Concern | Canonical owner | `CF-015` relation |
|---|---|---|
| Runtime/tick continuity anchors | `F-0003` | Reads and summarizes only. |
| Subject-state / identity core | `F-0004` | Reads bounded state, never writes source state. |
| Baseline model/profile diagnostics | `F-0008` | Reads as part of model health reports. |
| Richer model health/fallback | `F-0014` | Reads as part of model health reports. |
| Action audit evidence | `F-0010` | Reads for diagnostics only. |
| Governor evidence and freeze/proposal truth | `F-0016` | Reads for development diagnostics only. |
| Stable snapshots and rollback anchors | `F-0001` / `F-0017` | Reads for inventory only. |
| Lifecycle rollback/shutdown truth | `F-0019` | Reads for lifecycle diagnostics only. |
| Operator HTTP boundary | `F-0013` | May expose `CF-015` read models, but stays the API owner. |
| Release/support closure | `CF-025` / `CF-026` | Consume reports/evidence read-only. |

### 5.7 Definition of Done

- All ACs above are covered by named contract, integration, boundary or smoke proof.
- `CF-015` owns canonical report materialization and report-run metadata, and no foreign source writes remain.
- The first-phase report families are delivered with explicit availability/freshness semantics.
- `F-0012` `organ_error_rate` consumes the canonical `CF-015` model health surface or degrades explicitly when that surface is unavailable.
- `CF-025` / `CF-026` can consume `CF-015` reports/evidence without raw foreign-table requirements.
- Global index and dossier coverage map stay aligned with the shaped dossier.

### 5.8 Rollout / activation note (triggered only when needed)

- Activation order:
  1. Land report family contracts plus `report_runs`.
  2. Materialize identity continuity and stable snapshot inventory.
  3. Materialize model/organ health and wire `F-0012` `organ_error_rate` to the canonical report surface.
  4. Materialize development/lifecycle diagnostics.
  5. Expose read-only operator/report routes or offline exports if needed.
- Rollback limits:
  - stale or unavailable report families must degrade explicitly;
  - rollback may disable report publication, but may not push consumers back to silent raw-table reads as the new normal;
  - report storage rollback does not change source-owner truth.

## 6. Slicing plan (2–6 increments)

### Spec-compact decisions

- **SD-F0023-01:** `CF-015` uses materialized derivative read models plus `report_runs` as the canonical first-phase representation. Raw owner-table joins remain implementation helpers only and may not become the user-facing source of truth.
- **SD-F0023-02:** `F-0012` `organ_error_rate` must read `CF-015` model/organ health reports once this seam is delivered; direct reads from raw `F-0014` source state are forbidden after activation.
- **SD-F0023-03:** `CF-015` may publish diagnostic severity and export pointers, but it does not own any control or policy execution path.

### SL-F0023-01: Report contracts and owner boundary foundation

- **Result:** canonical report family taxonomy, `report_runs` identity contract, owner/consumer matrix and family availability semantics.
- **Covers:** AC-F0023-01, AC-F0023-02, AC-F0023-10, AC-F0023-15.
- **Verification:** contract tests for report family schemas and run identity semantics.
- Depends on: `F-0003`, `F-0008`, `F-0010`; owner `@codex`; unblock condition: source-owner refs for continuity, diagnostics and model health are already readable through canonical boundaries.

### SL-F0023-02: Identity continuity and stable snapshot inventory

- **Result:** materialized identity continuity reports plus stable snapshot inventory with explicit freshness and empty-inventory handling.
- **Covers:** AC-F0023-04, AC-F0023-07, AC-F0023-12, AC-F0023-14.
- **Verification:** integration tests over recovery/continuity anchors and stable snapshot inventory states.
- Depends on: `F-0001`, `F-0003`, `F-0017`; owner `@codex`; unblock condition: canonical continuity and stable snapshot evidence are durable and queryable without reopening body-evolution ownership.

### SL-F0023-03: Model/organ health reports and Homeostat contract

- **Result:** canonical model/organ health report family combining baseline and richer source surfaces plus explicit Homeostat read contract for `organ_error_rate`.
- **Covers:** AC-F0023-05, AC-F0023-06, AC-F0023-12.
- **Verification:** integration tests for baseline/richer health aggregation and Homeostat consumer tests.
- Depends on: `F-0008`, `F-0012`, `F-0014`; owner `@codex`; unblock condition: baseline and richer source diagnostics remain readable without allowing Homeostat or reporting to write them.

### SL-F0023-04: Development and lifecycle diagnostics

- **Result:** development diagnostics and lifecycle diagnostic summaries over governor/action/lifecycle evidence with explicit degraded semantics for partial source availability.
- **Covers:** AC-F0023-08, AC-F0023-09, AC-F0023-12, AC-F0023-13.
- **Verification:** integration and boundary tests over governor/action/lifecycle evidence summaries.
- Depends on: `F-0010`, `F-0016`, `F-0019`; owner `@codex`; unblock condition: canonical evidence rows exist without requiring `CF-015` to own governor or lifecycle truth.

### SL-F0023-05: Report publication and downstream usage audit

- **Result:** bounded publication/export contract plus usage audit proving operator/release/support consumers use the canonical report surfaces rather than raw foreign tables.
- **Covers:** AC-F0023-03, AC-F0023-11, AC-F0023-13.
- **Verification:** boundary tests, usage audit, smoke if public read routes or runtime topology change.
- Depends on: `F-0013`, `CF-025`, `CF-026`; owner `@codex`; unblock condition: public read exposure and downstream operational consumers remain read-only over `CF-015`.

### Plan-slice commitments

- **PL-F0023-01:** `SL-F0023-01` is the mandatory first implementation package because `report_runs`, report family enums and boundary ownership are the contract substrate for every later slice and for backlog actualization to `planned`.
- **PL-F0023-02:** `SL-F0023-02` and `SL-F0023-03` may execute only after `SL-F0023-01` lands, because identity continuity, stable snapshot inventory and Homeostat health consumption all depend on the canonical run/freshness contract instead of ad hoc direct reads.
- **PL-F0023-03:** `SL-F0023-04` stays blocked until both the foundational contract slice and at least one canonical report-family materialization slice are live, so development/lifecycle diagnostics inherit the same availability/degraded semantics.
- **PL-F0023-04:** `SL-F0023-05` is the last slice because downstream publication and usage audit are only truthful after the underlying report families, freshness semantics and read-only owner boundaries already exist.

### Planned implementation order

1. `SL-F0023-01` to land `report_runs`, report-family contracts and the no-foreign-write boundary proof.
2. `SL-F0023-02` to materialize identity continuity plus stable snapshot inventory on top of the canonical run contract.
3. `SL-F0023-03` to materialize model/organ health and wire the `F-0012` `organ_error_rate` read path.
4. `SL-F0023-04` to add development and lifecycle diagnostic summaries with explicit degraded semantics.
5. `SL-F0023-05` to expose bounded publication/export plus usage audit over the already delivered report families.

## 7. Task list (implementation units)

- **T-F0023-01:** Define `report_runs` contract, report family enums and family-specific payload contracts. Covers: AC-F0023-01, AC-F0023-10, AC-F0023-15.
- **T-F0023-02:** Materialize identity continuity and stable snapshot inventory families. Covers: AC-F0023-04, AC-F0023-07, AC-F0023-14.
- **T-F0023-03:** Materialize model/organ health reports over `F-0008` / `F-0014` and add `organ_error_rate` consumer contract. Covers: AC-F0023-05, AC-F0023-06.
- **T-F0023-04:** Materialize development and lifecycle diagnostics over `F-0010`, `F-0016`, `F-0019`. Covers: AC-F0023-08, AC-F0023-09.
- **T-F0023-05:** Add availability/freshness/degraded semantics and duplicate-run deduplication. Covers: AC-F0023-02, AC-F0023-12.
- **T-F0023-06:** Add read-only publication/export path and downstream usage audit for `F-0013`, `CF-025` and `CF-026` consumers. Covers: AC-F0023-11, AC-F0023-13.
- **T-F0023-07:** Add boundary tests proving `CF-015` never writes foreign source-owner tables. Covers: AC-F0023-03.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0023-01 | `packages/contracts/test/reporting.contract.test.ts`; `packages/db/test/reporting-materialization.integration.test.ts` | planned |
| AC-F0023-02 | `packages/db/test/reporting-materialization.integration.test.ts` | planned |
| AC-F0023-03 | `packages/db/test/reporting-boundary.integration.test.ts` | planned |
| AC-F0023-04 | `packages/db/test/reporting-materialization.integration.test.ts`; `apps/core/test/runtime/identity-continuity-report.integration.test.ts` | planned |
| AC-F0023-05 | `apps/core/test/runtime/homeostat-organ-health.integration.test.ts`; `packages/db/test/reporting-materialization.integration.test.ts` | planned |
| AC-F0023-06 | `packages/db/test/reporting-materialization.integration.test.ts` | planned |
| AC-F0023-07 | `packages/db/test/stable-snapshot-inventory.integration.test.ts` | planned |
| AC-F0023-08 | `packages/db/test/reporting-materialization.integration.test.ts`; `apps/core/test/runtime/development-diagnostics.integration.test.ts` | planned |
| AC-F0023-09 | `packages/db/test/reporting-materialization.integration.test.ts`; `apps/core/test/runtime/lifecycle-diagnostics.integration.test.ts` | planned |
| AC-F0023-10 | `packages/contracts/test/reporting.contract.test.ts` | planned |
| AC-F0023-11 | `apps/api/test/reporting-read-routes.integration.test.ts` | planned |
| AC-F0023-12 | `packages/db/test/reporting-materialization.integration.test.ts`; `packages/contracts/test/reporting.contract.test.ts` | planned |
| AC-F0023-13 | `apps/core/test/runtime/reporting-usage-audit.integration.test.ts` | planned |
| AC-F0023-14 | `packages/db/test/reporting-materialization.integration.test.ts` | planned |
| AC-F0023-15 | `packages/contracts/test/reporting.contract.test.ts`; `packages/db/test/reporting-materialization.integration.test.ts` | planned |

## 9. Decision log (ADR blocks)

### ADR-F0023-01: Materialized derivative reports are canonical

- Status: Accepted
- Date: 2026-04-21
- Context: Intake left open whether reporting should remain a thin live-join layer over foreign owner tables or become a materialized derivative read model.
- Decision: `CF-015` owns materialized derivative report families plus `report_runs`; raw owner-table joins may exist internally but are not the canonical user-facing source of truth.
- Alternatives: Read raw owner tables directly; delay any durable report storage until later phases.
- Consequences: Reporting gains explicit freshness/provenance semantics and a stable read surface for downstream consumers.

### ADR-F0023-02: Homeostat reads report surfaces, not raw richer health tables

- Status: Accepted
- Date: 2026-04-21
- Context: `F-0012` already names `CF-015` as the future canonical source family for `organ_error_rate`, but `F-0014` also exposes richer raw health state.
- Decision: Once `CF-015` is delivered, `F-0012` `organ_error_rate` reads the canonical model/organ health report surface instead of raw `F-0014` source tables.
- Alternatives: Let Homeostat continue reading raw richer health state directly; use ad hoc fallbacks depending on which sources are available.
- Consequences: Reporting becomes the explicit aggregation layer for operator and Homeostat health reads while `F-0014` remains the source owner.

### ADR-F0023-03: Reporting is read-only even when it emits alerts or exports

- Status: Accepted
- Date: 2026-04-21
- Context: Candidate notes and architecture both warn against turning observability into a convenience backdoor for control or state mutation.
- Decision: `CF-015` may emit derived severity, metrics/log/tracing exports and diagnostic payloads, but it never owns control execution, governor writes, lifecycle writes or router writes.
- Alternatives: Let reporting trigger reactions directly; treat exports as a control-plane shortcut.
- Consequences: Control, governor and lifecycle ownership boundaries stay explicit while observability still becomes operationally useful.

## 10. Progress & links

- Backlog item key: CF-015
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Issue:
- PRs:

### Backlog actualization verdict

- Verdict: `patch existing item`
- Target: `CF-015`
- Patch intent: advance backlog delivery state from `defined` to `planned` without changing dependencies, blockers or source-review truth.

### Coverage gate note

- `coverage_gate` remains `deferred` at `spec-compact` close because this stage shaped executable ACs and a forecast coverage map before any implementation-owned tests exist. The gate must move to `strict` no later than the first implementation slice that claims delivered report surfaces.

### Plan mode assessments

- `spec-compact`: `not required` because `CF-015` remained a bounded single-item shaping task with a known source set (`docs/architecture/system.md`, legacy candidate notes, backlog state and the selected dossier shell), so `spec-compact` did not require multi-track decomposition, unresolved cross-repo planning or user-facing plan branching that would justify Codex Plan mode before shaping.
- `plan-slice`: `not required` because the shaped dossier already fixed one bounded five-slice sequence, the dependency graph was stable, and this step only had to translate those slices into executable implementation order, backlog actualization intent and proof obligations rather than branch into a user-facing planning tree.

## 11. Change log

- 2026-04-21: [feature-intake] Initial dossier created from backlog item `CF-015` at backlog delivery state `defined`.
- 2026-04-21: [spec-compact] Shaped `CF-015` into a canonical observability/reporting seam with explicit report families, Homeostat read contract, owner boundaries, first-phase slices and no-op backlog actualization verdict.
- 2026-04-21: [process-fix] Surfaced the explicit pre-`spec-compact` Plan mode decision in the dossier so the stage bundle stays externally auditable.
- 2026-04-21: [plan-slice] Promoted `CF-015` to `planned`, fixed the five-slice implementation order, recorded the backlog patch intent for `CF-015`, and surfaced the explicit pre-`plan-slice` Plan mode decision.
