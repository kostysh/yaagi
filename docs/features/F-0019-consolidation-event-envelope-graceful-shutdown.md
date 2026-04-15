---
id: F-0019
title: Консолидация, event envelope и graceful shutdown
status: shaped
coverage_gate: deferred
owners: ["@codex"]
area: lifecycle
depends_on: ["F-0003", "F-0004", "F-0011"]
impacts: ["runtime", "db", "lifecycle", "governance", "reporting"]
created: 2026-04-15
updated: 2026-04-15
links:
  issue: ""
  pr: []
  docs:
    - "docs/architecture/system.md"
    - "docs/polyphony_concept.md"
    - "docs/backlog/feature-candidates.md"
    - "docs/backlog/working-system-roadmap-matrix-2026-03-26.md"
    - "docs/features/F-0003-tick-runtime-scheduler-episodic-timeline.md"
    - "docs/features/F-0004-subject-state-kernel-and-memory-model.md"
    - "docs/features/F-0011-narrative-and-memetic-reasoning-loop.md"
    - "docs/features/F-0012-homeostat-and-operational-guardrails.md"
    - "docs/features/F-0015-workshop-datasets-training-eval-and-promotion.md"
    - "docs/features/F-0016-development-governor-and-change-management.md"
    - "docs/features/F-0017-git-managed-body-evolution-and-stable-snapshots.md"
    - "docs/adr/ADR-2026-03-19-canonical-runtime-toolchain.md"
    - "docs/adr/ADR-2026-03-19-quality-gate-sequence.md"
---

# F-0019 Консолидация, event envelope и graceful shutdown

## 1. Context & Goal

- **Backlog handoff:**
  - Backlog item key: CF-018
  - Backlog delivery state at intake: defined
  - Source traceability:
    - docs/architecture/system.md
    - docs/polyphony_concept.md
    - docs/backlog/feature-candidates.md
    - docs/backlog/working-system-roadmap-matrix-2026-03-26.md
  - Known blockers at intake:
    - none recorded
  - Known dependencies at intake:
    - CF-002
    - CF-003
    - CF-005
- **User problem:** После delivery `F-0003`, `F-0004` и `F-0011` система умеет вести тики, хранить subject-state и писать narrative/memetic state, но durable lifecycle seam для retention, compaction, rollback-frequency evidence и graceful shutdown biography всё ещё отсутствует. В результате Homeostat, governor и future reporting вынуждены либо деградировать, либо рисковать ad hoc proxy evidence вместо канонических lifecycle facts.
- **Goal:** Зафиксировать один canonical owner для consolidation/event-envelope/graceful-shutdown surface, который владеет разрешёнными durable transition classes, retention/compaction semantics, rollback/graceful-shutdown lifecycle evidence и linkage к versioned state surfaces, не передавая себе произвольное право cross-surface mutation.
- **Non-goals:** Этот dossier не переоткрывает tick admission и timeline lifecycle из `F-0003`, subject-state schema ownership из `F-0004`, ordinary narrative/memetic tick writes из `F-0011`, Homeostat scoring/reaction ownership из `F-0012`, governor proposal/freeze semantics из `F-0016`, read-only reporting materialization из `CF-015` или release/rollback orchestration из `CF-025`.
- **Current substrate / baseline:** `F-0003` уже владеет active tick / continuity bridge; `F-0004` уже владеет canonical subject-state store and bounded snapshot compatibility; `F-0011` уже доставил ordinary narrative/memetic writes while deferring durable promotion/compaction to `CF-018`; `F-0012` already consumes future `CF-018` rollback-frequency evidence as degraded/not-evaluable until this seam exists.

### Terms & thresholds

- `event envelope`: canonical lifecycle wrapper that preserves event identity, source owner, causal refs, related tick/state refs and replay/deduplication metadata for lifecycle evidence rows.
- `consolidation transition`: owner-routed durable change that promotes, compacts, retires, quarantines or links lifecycle/narrative evidence without bypassing canonical source owners.
- `graceful shutdown biography`: durable evidence trail for shutdown intent, admitted in-flight work, terminal outcomes and restart/reclaim interpretation.
- `rollback-frequency evidence`: canonical lifecycle evidence consumed read-only by `F-0012`, governor and reporting; it is not invented by those consumers.

## 2. Scope

### In scope

- One canonical lifecycle/consolidation owner for:
  - retention and compaction policy;
  - event-envelope lifecycle rows;
  - graceful-shutdown events;
  - rollback incident evidence used for `rollback_frequency`;
  - allowed durable narrative/memetic transition classes deferred by `F-0011`.
- Explicit read-only downstream contracts for Homeostat, governor and reporting.
- Schema-compatibility guardrails for derived traces that reference canonical versioned state surfaces.
- Dataset/eval candidate preparation boundaries where lifecycle evidence is projected into workshop/reporting consumers without making this seam a workshop owner.

### Out of scope

- Tick admission, active tick terminal state and continuity transaction ownership.
- Subject-state table ownership, migrations and arbitrary backfills.
- Ordinary narrative/memetic cognition writes already owned by `F-0011`.
- Homeostat scoring, threshold policy and reaction-request publication.
- Governor proposal/freeze writes or development policy decisions.
- Read-only diagnostic report materialization and external operator report surfaces.
- Deploy/release automation, rollback execution and environment promotion.

### Constraints

- `F-0019` may own only explicitly allowed lifecycle/consolidation transition classes for its own surfaces; it must not become a generic cross-surface mutation authority.
- Retention, compaction and event-envelope flows must preserve compatibility with `F-0004` subject-state consumers and keep linkage to canonical versioned state refs.
- Homeostat, governor and reporting consume lifecycle evidence read-only and must not write or repair lifecycle history.
- Rollback/graceful-shutdown lifecycle evidence must be canonical enough for `F-0012` `rollback_frequency`; proxy counting from ad hoc logs remains out of bounds.
- Any implementation that changes runtime, startup or deployment behavior must follow the repo quality gate order `pnpm format`, `pnpm typecheck`, `pnpm lint`, and also run `pnpm smoke:cell`.

### Assumptions (optional)

- Current backlog truth marks `CF-018` as `defined`, ready for specification, with no gaps or open todo.
- Delivered prerequisites `F-0003`, `F-0004` and `F-0011` are sufficient for intake and `spec-compact` without reopening earlier backbone seams.
- `CF-015` remains the future owner for report materialization over lifecycle evidence, while `F-0019` owns the lifecycle facts those reports read.

### Open questions

- None after `spec-compact`. Intake questions `OQ-F0019-01` through `OQ-F0019-03` are resolved in `ADR-F0019-01`, `ADR-F0019-02` and `ADR-F0019-03`.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0019-01:** `F-0019` is the canonical writer for its lifecycle/consolidation source surfaces: lifecycle event envelopes, consolidation transitions, rollback incident evidence, graceful-shutdown evidence.
- **AC-F0019-02:** `F-0019` rejects direct writes to tick lifecycle rows, subject-state tables, governor records, workshop lifecycle rows, reporting projections, body-evolution records, release/deploy state.
- **AC-F0019-03:** Every accepted lifecycle event envelope records `eventId`, `eventType`, `occurredAt`, `sourceOwner`, `subjectRef`.
- **AC-F0019-04:** Every accepted lifecycle event envelope records `payload`, `evidenceRefs`, `idempotencyKey`, `schemaVersion`.
- **AC-F0019-05:** Replaying the same lifecycle event with matching `idempotencyKey` plus equivalent normalized payload returns the existing lifecycle event record.
- **AC-F0019-06:** Replaying the same `idempotencyKey` with a different normalized payload fails closed before writing a second lifecycle event.
- **AC-F0019-07:** Consolidation accepts only these first-phase transition classes: `promote_memetic_unit`, `merge_memetic_units`, `split_memetic_unit`, `quarantine_memetic_unit`, `retire_memetic_unit`, `compact_field_journal`, `summarize_repeated_episodes`, `prepare_dataset_candidate`, `retire_stale_tension`.
- **AC-F0019-08:** Unsupported consolidation transition classes fail closed before mutating durable narrative, memetic, lifecycle, projection state.
- **AC-F0019-09:** Durable memetic-unit promotion through consolidation requires abstracted content plus provenance anchors beyond one isolated stimulus.
- **AC-F0019-10:** Retention/compaction preserves permanent biography plus development ledger records.
- **AC-F0019-11:** Retention/compaction deletion/aggregation is limited to derivative technical traces allowed by policy.
- **AC-F0019-12:** Derived traces produced by retention/compaction preserve links to canonical versioned state refs, including the relevant `subject_state_schema_version` when the trace depends on subject-state content.
- **AC-F0019-13:** Graceful shutdown sets lifecycle state to `shutting_down` before active-tick wait/cancel starts.
- **AC-F0019-14:** Graceful shutdown blocks admission of new ticks before active-tick wait/cancel starts.
- **AC-F0019-15:** Graceful shutdown persists shutdown evidence before process exit, including shutdown reason, admitted in-flight work, terminal tick outcome, flushed buffer/lease result, open concerns.
- **AC-F0019-16:** Rollback-incident plus graceful-shutdown evidence from `F-0019` is the canonical read-only source for `F-0012` `rollback_frequency`.
- **AC-F0019-17:** Homeostat/governor/reporting may consume lifecycle evidence read-only but may not invent/repair/mutate rollback/graceful-shutdown lifecycle history.
- **AC-F0019-18:** Dataset/eval candidates prepared by consolidation are bounded projections with source lifecycle refs; workshop remains the canonical owner of dataset, training, eval, model-candidate lifecycle rows.

## 4. Non-functional requirements (NFR)

- **Evidence integrity:** `lifecycle_event_required_field_coverage` threshold: `100%` of accepted lifecycle events include all required envelope fields from AC-F0019-03 plus AC-F0019-04.
- **Idempotency:** `lifecycle_event_duplicate_rows` budget: `0` duplicate lifecycle event rows for the same `idempotencyKey` and equivalent normalized payload.
- **Boundary safety:** `foreign_source_write_violation_count` budget: `0` direct writes from `F-0019` code paths into foreign owner source tables named in AC-F0019-02.
- **Compatibility:** `compaction_version_ref_coverage` threshold: `100%` of retention/compaction traces that depend on subject-state content retain the relevant `subject_state_schema_version`.
- **Shutdown recoverability:** restart/reclaim verification reconstructs the latest shutdown lifecycle state and terminal evidence from durable PostgreSQL records with `0` reliance on process-local cache.

## 5. Design (compact)

### 5.1 API surface

- No public HTTP route is introduced by this dossier.
- The machine-facing surface is an internal lifecycle/consolidation service plus durable event records.

```ts
type LifecycleSourceOwner =
  | "F-0003"
  | "F-0004"
  | "F-0011"
  | "F-0012"
  | "F-0016"
  | "F-0017"
  | "F-0019"
  | "CF-015"
  | "CF-025";

type LifecycleEventEnvelope = {
  eventId: string;
  eventType:
    | "lifecycle.rollback_incident.recorded"
    | "lifecycle.shutdown.requested"
    | "lifecycle.shutdown.completed"
    | "consolidation.transition.accepted"
    | "consolidation.transition.rejected"
    | "retention.compaction.completed";
  occurredAt: string;
  sourceOwner: LifecycleSourceOwner;
  subjectRef: string;
  schemaVersion: string;
  idempotencyKey: string;
  evidenceRefs: string[];
  payload: Record<string, unknown>;
};

type ConsolidationTransitionClass =
  | "promote_memetic_unit"
  | "merge_memetic_units"
  | "split_memetic_unit"
  | "quarantine_memetic_unit"
  | "retire_memetic_unit"
  | "compact_field_journal"
  | "summarize_repeated_episodes"
  | "prepare_dataset_candidate"
  | "retire_stale_tension";
```

Error model:

- `unsupported_transition_class`: transition class is not in the first-phase allowlist.
- `foreign_owner_write_rejected`: request would mutate a foreign source table or lifecycle owner.
- `idempotency_conflict`: same `idempotencyKey` was replayed with a different normalized payload.
- `missing_provenance_anchor`: promotion or compaction lacks required evidence refs.
- `compaction_version_ref_missing`: derived trace would lose versioned state linkage.
- `shutdown_admission_closed`: shutdown already blocks new tick admission.
- `shutdown_terminal_evidence_missing`: process exit requested before durable shutdown evidence exists.

Retry/idempotency:

- same `idempotencyKey` plus equivalent normalized payload reuses the existing lifecycle event;
- same `idempotencyKey` plus different normalized payload rejects before write;
- transition retries never widen the transition class or mutate foreign owner surfaces.

### 5.2 Runtime / deployment surface

- The seam is expected to run inside the existing canonical `Node.js 22 + TypeScript + AI SDK + Hono + PostgreSQL` runtime substrate.
- No new service, container, network or volume topology is introduced.
- Consolidation runs as an owner-routed runtime/job family on the existing PostgreSQL/`pg-boss` substrate.
- Graceful shutdown is a runtime lifecycle path inside the existing `core` process; it must compose with tick admission and scheduler leases from `F-0003`.
- Runtime/startup/deployment-affecting implementation requires the repo quality gate sequence and `pnpm smoke:cell`.

### 5.3 Data model changes

Owned source surfaces:

- `lifecycle_events`: append-only event-envelope rows.
- `consolidation_transitions`: accepted/rejected consolidation transition records with transition class, target refs, source refs and evidence refs.
- `rollback_incidents`: rollback evidence rows suitable for `F-0012` `rollback_frequency`.
- `graceful_shutdown_events`: shutdown request, terminal outcome and open-concern evidence.

Invariants:

- event envelopes do not replace canonical domain tables;
- retention and compaction may aggregate derivative technical traces but may not delete biography or development ledger truth;
- projection rows for workshop/reporting consumers carry source lifecycle refs and do not become a second source of truth;
- `F-0019` never writes governor, workshop, reporting, body-evolution or release/deploy source rows directly.

### 5.4 Edge cases and failure modes

- Unsupported consolidation transition kind.
- Duplicate or replayed lifecycle event envelope.
- Shutdown requested while tick work, narrative writes or governor proposals are in flight.
- Retention or compaction candidate would break versioned subject-state compatibility.
- Rollback evidence lacks a canonical lifecycle ref or conflicts with boot/recovery evidence.
- Lifecycle consumer attempts to backfill missing rollback evidence from ad hoc logs.
- Consolidation candidate has repeated evidence but lacks abstracted durable content.
- Dataset/eval candidate projection is requested before source lifecycle refs are durable.

### 5.5 Verification surface / initial verification plan

- AC-F0019-01, AC-F0019-02, AC-F0019-15, AC-F0019-16: boundary unit/integration tests.
- AC-F0019-03, AC-F0019-04, AC-F0019-05, AC-F0019-06: event-envelope contract tests.
- AC-F0019-07, AC-F0019-08, AC-F0019-09: consolidation transition unit/integration tests.
- AC-F0019-10, AC-F0019-11, AC-F0019-12: retention/compaction policy/compatibility tests.
- AC-F0019-13, AC-F0019-14, AC-F0019-15: graceful-shutdown integration tests; smoke if runtime/startup behavior changes.
- AC-F0019-16: Homeostat integration coverage proving `rollback_frequency` reads lifecycle evidence plus degrades without proxy metrics when absent.
- AC-F0019-17, AC-F0019-18: read-only consumer/projection-boundary tests.

### 5.6 Representation upgrades (triggered only when needed)

#### Boundary operations

| Operation | Success behavior | Invalid / dependency failure | Duplicate / retry behavior |
|---|---|---|---|
| Record lifecycle event | Appends one envelope with required identity, source, schema, evidence and payload fields. | Rejects missing required fields, unknown owner or missing evidence refs. | Same idempotency key and equivalent payload returns existing row; conflict rejects. |
| Execute consolidation transition | Applies an allowed transition class through `F-0019` owner path and records accepted/rejected evidence. | Rejects unsupported transition class, missing provenance, foreign-owner mutation or version-ref loss. | Retry preserves transition class and source refs; no transition widening on retry. |
| Run retention/compaction policy | Aggregates or removes only allowed derivative traces and records compaction evidence. | Rejects deletion of biography/development ledger truth or loss of versioned state linkage. | Reuses policy window/idempotency identity for the same compaction target. |
| Graceful shutdown | Blocks new tick admission, waits/cancels bounded active work and persists terminal shutdown evidence before exit. | Refuses process exit when terminal evidence cannot be persisted. | Replayed shutdown request returns existing shutdown lifecycle state. |
| Expose rollback-frequency source | Provides durable rollback incident/shutdown evidence for read-only consumers. | Consumers receive degraded/not-evaluable state when source evidence is absent or stale. | Consumers do not create replacement evidence. |

#### First-phase transition allowlist

| Transition class | Writes owned by `F-0019` | Foreign writes forbidden |
|---|---|---|
| `promote_memetic_unit` | Consolidation transition, lifecycle event, owner-routed durable memetic promotion request/evidence | Direct subject-state writes, governor writes, reporting projections |
| `merge_memetic_units` | Consolidation transition and lifecycle event | Direct ordinary tick mutation or ad hoc narrative rewrite |
| `split_memetic_unit` | Consolidation transition and lifecycle event | Direct subject-state or reporting writes |
| `quarantine_memetic_unit` | Consolidation transition and lifecycle event | Homeostat freeze state, governor decision state |
| `retire_memetic_unit` | Consolidation transition and lifecycle event | Workshop/model retirement state |
| `compact_field_journal` | Compaction transition and derived trace evidence | Deleting episode biography |
| `summarize_repeated_episodes` | Summary evidence linked to source episodes | Rewriting canonical episode rows |
| `prepare_dataset_candidate` | Bounded projection with lifecycle refs | Workshop dataset/training/eval lifecycle rows |
| `retire_stale_tension` | Consolidation transition and lifecycle event | Governor policy or reporting state |

#### Owner / consumer matrix

| Concern | Canonical owner | `F-0019` relation |
|---|---|---|
| Tick admission and active tick lifecycle | `F-0003` | Reads/coordinates; does not own active tick rows. |
| Subject-state schema and bounded snapshots | `F-0004` | Preserves version refs; does not write subject-state tables directly. |
| Ordinary narrative/memetic writes | `F-0011` | Owns only durable lifecycle transitions deferred from ordinary ticks. |
| Homeostat scoring and reactions | `F-0012` | Provides rollback-frequency source evidence read-only. |
| Governor proposal/freeze state | `F-0016` | Provides lifecycle evidence; does not write governor tables. |
| Body rollback evidence and stable snapshots | `F-0017` | May link to stable snapshot refs; does not execute body rollback. |
| Reporting materialization | `CF-015` | Provides canonical lifecycle facts for reports; does not materialize reports. |
| Release rollback orchestration | `CF-025` | Provides/read links evidence; does not orchestrate releases. |

### 5.7 Definition of Done

- All ACs above are covered by named unit/integration/smoke proof.
- Lifecycle event contract is implemented and rejects missing identity, evidence, schema or idempotency fields.
- Consolidation transition allowlist is enforced fail-closed.
- Retention/compaction policy proves biography and development ledger records are not deleted.
- Graceful shutdown persists terminal evidence before process exit.
- `F-0012` `rollback_frequency` consumes canonical lifecycle evidence or degrades without proxy metrics.
- Backlog state for `CF-018` is actualized through `backlog-engineer` before step closure.
- Dossier verification, independent review and step-close artifacts all pass for `spec-compact`.

### 5.8 Rollout / activation note (triggered only when needed)

- Activation order:
  1. Introduce lifecycle event contract and idempotency without enabling destructive retention.
  2. Enable consolidation transitions behind the allowlist.
  3. Add retention/compaction policy in non-destructive or aggregate-only mode first.
  4. Enable graceful-shutdown lifecycle path.
  5. Wire `F-0012` rollback-frequency reads to lifecycle evidence.
- Rollback limits: once retention/compaction deletes allowed derivative traces, recovery may rely only on preserved biography, lifecycle evidence and source refs; therefore destructive compaction requires explicit verification before activation.
- Backfill note: any migration over existing runtime history must preserve source refs and may not invent rollback incidents for periods where no canonical lifecycle evidence exists.

## 6. Slicing plan (2–6 increments)

- To be forecast in `plan-slice`.

## 7. Task list (implementation units)

- To be forecast in `plan-slice`.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0019-01 | Lifecycle/consolidation boundary tests | planned |
| AC-F0019-02 | Foreign-owner write rejection tests | planned |
| AC-F0019-03 | Lifecycle event envelope contract tests | planned |
| AC-F0019-04 | Lifecycle event envelope contract tests | planned |
| AC-F0019-05 | Lifecycle event idempotency tests | planned |
| AC-F0019-06 | Lifecycle event conflict tests | planned |
| AC-F0019-07 | Consolidation transition allowlist tests | planned |
| AC-F0019-08 | Unsupported transition rejection tests | planned |
| AC-F0019-09 | Memetic promotion provenance tests | planned |
| AC-F0019-10 | Retention/compaction permanence tests | planned |
| AC-F0019-11 | Retention/compaction deletion policy tests | planned |
| AC-F0019-12 | Versioned state linkage tests | planned |
| AC-F0019-13 | Graceful-shutdown state transition tests | planned |
| AC-F0019-14 | Graceful-shutdown admission-closure tests | planned |
| AC-F0019-15 | Graceful-shutdown terminal evidence tests | planned |
| AC-F0019-16 | Homeostat rollback-frequency integration tests | planned |
| AC-F0019-17 | Read-only consumer boundary tests | planned |
| AC-F0019-18 | Workshop projection boundary tests | planned |

## 9. Decision log (ADR blocks)

### ADR-F0019-01: First-phase consolidation transition classes

- Status: Accepted
- Date: 2026-04-15
- Context: Intake left `OQ-F0019-01` open because consolidation could accidentally become a generic mutation surface.
- Decision: First-phase consolidation accepts only the transition classes listed in AC-F0019-07; unsupported transition classes fail closed before write.
- Alternatives: Allow open-ended transition kinds; defer transition taxonomy to implementation.
- Consequences: Implementation can add a narrow allowlist and tests now, while future transition classes require explicit dossier/backlog change.

### ADR-F0019-02: Lifecycle event envelope minimum

- Status: Accepted
- Date: 2026-04-15
- Context: Intake left `OQ-F0019-02` open because rollback/shutdown evidence, duplicate handling and restart/reclaim interpretation need machine-readable identity.
- Decision: The minimum envelope fields are `eventId`, `eventType`, `occurredAt`, `sourceOwner`, `subjectRef`, `payload`, `evidenceRefs`, `idempotencyKey` and `schemaVersion`.
- Alternatives: Use the architecture's minimal envelope only; rely on domain table IDs for idempotency.
- Consequences: Event rows are replay-safe and restart-readable without replacing domain source tables.

### ADR-F0019-03: Lifecycle evidence ownership split

- Status: Accepted
- Date: 2026-04-15
- Context: Intake left `OQ-F0019-03` open because lifecycle evidence, reporting and release rollback can easily blur.
- Decision: `F-0019` owns lifecycle facts and read contracts; `CF-015` owns report materialization; `CF-025` owns release/deploy rollback orchestration.
- Alternatives: Fold lifecycle reporting into `F-0019`; defer rollback evidence entirely to `CF-025`.
- Consequences: Homeostat/governor/reporting consume canonical lifecycle evidence without gaining write access, and release orchestration remains a separate future owner.

## 10. Progress & links

- Backlog item key: CF-018
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Issue:
- PRs:

## 11. Change log

- 2026-04-15: Initial dossier created from backlog item `CF-018` at backlog delivery state `defined`.
- 2026-04-15: [clarification] `spec-compact` shaped `F-0019`: resolved intake open questions, fixed event-envelope fields, first-phase consolidation allowlist, lifecycle owner split, ACs, NFRs, initial coverage plan and activation notes.
