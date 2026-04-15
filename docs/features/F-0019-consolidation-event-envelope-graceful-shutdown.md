---
id: F-0019
title: Консолидация, event envelope и graceful shutdown
status: done
coverage_gate: strict
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
- `retention_compaction_runs`: retention/compaction evidence rows preserving derivative-trace policy, preserved refs and subject-state schema-version linkage.

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
- Dossier verification, independent review and step-close artifacts all pass for `implementation`.

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

Срезы ниже являются forecast-планом. Commitment остаётся в AC, Definition of Done, verification gates и rollout constraints.

### План контрактных рисков до implementation close-out

- **Риск event contract:** закрывается в `SL-F0019-01` через schema/contract/idempotency tests до любых destructive retention paths.
- **Риск foreign-owner mutation:** закрывается в `SL-F0019-01` и `SL-F0019-02` через fail-closed guards против таблиц и source surfaces из AC-F0019-02.
- **Риск version linkage:** закрывается в `SL-F0019-03` до включения deletion/aggregation mode.
- **Риск runtime shutdown:** закрывается в `SL-F0019-04`; если меняется startup/shutdown behavior, обязательны root quality gates и `pnpm smoke:cell`.
- **Риск consumer proxy:** закрывается в `SL-F0019-05`; Homeostat/governor/reporting не создают replacement evidence.

### SL-F0019-01: Lifecycle event envelope и owner boundary foundation

- **Результат:** PostgreSQL-backed lifecycle event store плюс internal service contract для обязательных envelope fields, idempotency, conflict handling и foreign-owner write rejection.
- **Покрывает:** AC-F0019-01, AC-F0019-02, AC-F0019-03, AC-F0019-04, AC-F0019-05, AC-F0019-06.
- **Проверка:** lifecycle event contract tests, idempotency/conflict tests, foreign-owner write rejection tests, migration tests.
- Depends on: `F-0003`, `F-0004`, `F-0011`; owner `@codex`; unblock condition: delivered tick refs, subject-state refs и narrative/memetic source refs остаются readable через canonical boundaries.
- **Предположение:** первый implementation может добавить append-only lifecycle tables без переписывания существующих timeline rows.
- **Fallback:** если нужна migration существующей timeline, остановиться на этом срезе и добавить migration/backfill note до включения downstream slices.

### SL-F0019-02: Consolidation transition allowlist и provenance guards

- **Результат:** consolidation transition ledger плюс owner-routed execution path: принимает только классы из AC-F0019-07, отклоняет unsupported classes и записывает accepted/rejected evidence.
- **Покрывает:** AC-F0019-07, AC-F0019-08, AC-F0019-09, AC-F0019-18.
- **Проверка:** transition allowlist tests, unsupported-transition rejection tests, memetic promotion provenance tests, workshop projection boundary tests.
- Depends on: `F-0011`, `F-0015`; owner `@codex`; unblock condition: durable memetic source refs и workshop candidate handoff contract видимы без передачи `F-0019` workshop ownership.
- **Предположение:** `prepare_dataset_candidate` может выпускать bounded candidate projections с lifecycle refs до их потребления workshop.
- **Fallback:** держать `prepare_dataset_candidate` disabled, если workshop projection contract недостаточен; остальные transition classes сохранить.

### SL-F0019-03: Retention/compaction policy и versioned-state compatibility

- **Результат:** retention/compaction policy runner сначала в non-destructive или aggregate-only mode, с evidence rows и сохранением version refs.
- **Покрывает:** AC-F0019-10, AC-F0019-11, AC-F0019-12.
- **Проверка:** permanence tests для biography/development ledger records, deletion-policy tests, versioned state linkage tests.
- Depends on: `F-0004`, `F-0011`, `F-0016`, `F-0017`; owner `@codex`; unblock condition: subject-state schema version refs, narrative evidence refs, governor/development ledger refs и stable snapshot refs остаются linkable.
- **Предположение:** destructive compaction не требуется для первого delivered increment.
- **Fallback:** если destructive compaction станет необходимой, остановиться до activation и добавить явное dossier/backlog realignment для rollout limits.

### SL-F0019-04: Graceful shutdown biography

- **Результат:** graceful shutdown lifecycle path внутри `core`: выставляет `shutting_down`, закрывает tick admission, bounded образом ждёт/cancel active work, сохраняет terminal shutdown evidence перед exit.
- **Покрывает:** AC-F0019-13, AC-F0019-14, AC-F0019-15.
- **Проверка:** graceful-shutdown state transition tests, admission-closure tests, terminal-evidence integration tests, `pnpm smoke:cell` при изменении runtime/startup behavior.
- Depends on: `F-0003`; owner `@codex`; unblock condition: tick admission плюс scheduler lease APIs остаются canonical active tick boundary.
- **Предположение:** shutdown может использовать existing lease reclaim без введения второго scheduler/runtime.
- **Fallback:** если current runtime не может сохранить evidence перед exit, держать shutdown activation за feature gate и realign runtime boundary до close-out.

### SL-F0019-05: Downstream read contracts, rollback-frequency source и usage audit

- **Результат:** read-only lifecycle evidence queries для `F-0012` `rollback_frequency`, governor/reporting consumers и bounded candidate/projection checks; финальный usage audit consumer behavior.
- **Покрывает:** AC-F0019-16, AC-F0019-17, AC-F0019-18.
- **Проверка:** Homeostat rollback-frequency integration tests, degraded/not-evaluable tests для missing lifecycle evidence, read-only consumer boundary tests, projection-boundary tests, real usage audit.
- Depends on: `F-0012`, `CF-015`, `CF-025`; owner `@codex`; unblock condition: consumers сохраняют read-only contracts без требования, чтобы `F-0019` materialize reports или orchestrate releases.
- **Предположение:** `CF-015` и `CF-025` могут оставаться future-owned, пока `F-0019` уже раскрывает canonical facts.
- **Fallback:** раскрыть только durable read contracts и держать report/release consumers degraded до планирования их owner seams.

### Allowed stop points

| Stop point | Безопасная причина остановки | Ожидаемая проверка | Вне остановки |
|---|---|---|---|
| After `SL-F0019-01` | Append-only event contract существует без включения consolidation, compaction и shutdown behavior. | Event contract, idempotency и foreign-owner rejection tests pass. | Consolidation, retention/compaction, graceful shutdown и downstream reads remain disabled. |
| After `SL-F0019-03` | Lifecycle events, consolidation и non-destructive compaction доступны без runtime shutdown changes. | Slices `SL-F0019-01` through `SL-F0019-03` pass their tests; destructive compaction remains off. | Graceful shutdown biography и rollback-frequency consumer wiring remain pending. |
| After `SL-F0019-04` | Shutdown lifecycle durable до раскрытия downstream consumer reads. | Graceful-shutdown integration tests и required smoke path pass. | Homeostat/governor/reporting read contracts remain pending. |
| After `SL-F0019-05` | Весь planned feature scope implemented, а consumer behavior прошёл audit. | Full AC coverage, usage audit и step-close artifacts pass. | Future report materialization и release orchestration остаются за `CF-015` и `CF-025`. |

### Аудит реального использования

- Запустить после `SL-F0019-05` на real lifecycle evidence records, не только на mocked unit paths.
- Audit categories: `docs-only`, `runtime`, `schema/help`, `cross-skill`, `audit-only`.
- Ожидаемые проверки: missing lifecycle evidence degrades cleanly, duplicate events reuse или reject корректно, consumers не создают rollback/shutdown evidence, workshop/reporting/release boundaries остаются read-only или future-owned.

## 7. Task list (implementation units)

- **T-F0019-01:** Добавить lifecycle event storage, envelope validation плюс idempotency conflict handling для `SL-F0019-01`. Covers: AC-F0019-01, AC-F0019-03, AC-F0019-04, AC-F0019-05, AC-F0019-06.
- **T-F0019-02:** Добавить foreign-owner write rejection guards для `SL-F0019-01`. Covers: AC-F0019-02.
- **T-F0019-03:** Добавить consolidation transition ledger плюс allowlist execution для `SL-F0019-02`. Covers: AC-F0019-07, AC-F0019-08.
- **T-F0019-04:** Добавить provenance checks для durable memetic promotion плюс bounded dataset/eval candidate projection для `SL-F0019-02`. Covers: AC-F0019-09, AC-F0019-18.
- **T-F0019-05:** Добавить retention/compaction policy runner с permanence guards плюс deletion-policy guards для `SL-F0019-03`. Covers: AC-F0019-10, AC-F0019-11.
- **T-F0019-06:** Добавить versioned state linkage checks для retention/compaction traces в `SL-F0019-03`. Covers: AC-F0019-12.
- **T-F0019-07:** Добавить graceful-shutdown lifecycle state transition плюс tick-admission closure для `SL-F0019-04`. Covers: AC-F0019-13, AC-F0019-14.
- **T-F0019-08:** Добавить graceful-shutdown terminal evidence persistence плюс restart/reclaim interpretation для `SL-F0019-04`. Covers: AC-F0019-15.
- **T-F0019-09:** Добавить read-only lifecycle evidence queries для rollback-frequency consumers в `SL-F0019-05`. Covers: AC-F0019-16, AC-F0019-17.
- **T-F0019-10:** Запустить real usage audit и классифицировать corrective findings для `SL-F0019-05`. Covers: SL-F0019-05.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0019-01 | `packages/contracts/test/lifecycle.contract.test.ts`; `packages/db/test/lifecycle-store.integration.test.ts` | covered |
| AC-F0019-02 | `packages/contracts/test/lifecycle.contract.test.ts`; `packages/db/test/lifecycle-store.integration.test.ts` | covered |
| AC-F0019-03 | `packages/contracts/test/lifecycle.contract.test.ts`; `packages/db/test/lifecycle-store.integration.test.ts` | covered |
| AC-F0019-04 | `packages/contracts/test/lifecycle.contract.test.ts`; `packages/db/test/lifecycle-store.integration.test.ts` | covered |
| AC-F0019-05 | `packages/db/test/lifecycle-store.integration.test.ts` | covered |
| AC-F0019-06 | `packages/db/test/lifecycle-store.integration.test.ts` | covered |
| AC-F0019-07 | `packages/contracts/test/lifecycle.contract.test.ts`; `packages/db/test/lifecycle-store.integration.test.ts` | covered |
| AC-F0019-08 | `packages/db/test/lifecycle-store.integration.test.ts` | covered |
| AC-F0019-09 | `packages/db/test/lifecycle-store.integration.test.ts` | covered |
| AC-F0019-10 | `packages/db/test/lifecycle-store.integration.test.ts` | covered |
| AC-F0019-11 | `packages/db/test/lifecycle-store.integration.test.ts` | covered |
| AC-F0019-12 | `packages/db/test/lifecycle-store.integration.test.ts` | covered |
| AC-F0019-13 | `apps/core/test/runtime/graceful-shutdown-sequence.integration.test.ts` | covered |
| AC-F0019-14 | `apps/core/test/runtime/graceful-shutdown-sequence.integration.test.ts` | covered |
| AC-F0019-15 | `apps/core/test/runtime/graceful-shutdown-sequence.integration.test.ts`; `packages/db/test/lifecycle-store.integration.test.ts`; `pnpm smoke:cell` | covered |
| AC-F0019-16 | `packages/db/test/lifecycle-store.integration.test.ts`; `apps/core/test/runtime/homeostat-rollback-frequency.integration.test.ts` | covered |
| AC-F0019-17 | `apps/core/test/runtime/homeostat-rollback-frequency.integration.test.ts` | covered |
| AC-F0019-18 | `packages/db/test/lifecycle-store.integration.test.ts` | covered |

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

### Implementation result

- `SL-F0019-01` delivered: lifecycle event contract, required field validation, sequential and concurrent idempotency replay/conflict handling, owned/foreign write surface guard.
- `SL-F0019-02` delivered: first-phase consolidation transition allowlist, unsupported-class fail-closed behavior, promotion provenance guard, bounded dataset-candidate projection evidence without workshop source writes.
- `SL-F0019-03` delivered: retention/compaction evidence storage with permanence, derivative-trace and subject-state schema-version guards.
- `SL-F0019-04` delivered: graceful shutdown sequence closes public and tick-runtime admission, waits for in-progress admission writes before snapshot, records `shutting_down`, waits/stops runtime work, then persists terminal shutdown evidence.
- `SL-F0019-05` delivered: read-only rollback-frequency source query and Homeostat integration that evaluates from lifecycle evidence or degrades without proxy metrics.

### Verification

- `pnpm format`: pass.
- `pnpm typecheck`: pass.
- `pnpm lint`: pass.
- Focused F-0019 race tests: pass, 8 tests.
- `pnpm test`: pass, 281 tests.
- `pnpm smoke:cell`: pass, 19 smoke tests, including `AC-F0019-16 AC-F0019-17` real lifecycle evidence usage audit on containerized PostgreSQL.

## 11. Change log

- 2026-04-15: Initial dossier created from backlog item `CF-018` at backlog delivery state `defined`.
- 2026-04-15: [clarification] `spec-compact` shaped `F-0019`: resolved intake open questions, fixed event-envelope fields, first-phase consolidation allowlist, lifecycle owner split, ACs, NFRs, initial coverage plan and activation notes.
- 2026-04-15: [clarification] `plan-slice` forecasted five implementation slices, allowed stop points, consumer usage audit and backlog actualization path.
- 2026-04-15: [implementation] Delivered lifecycle/consolidation store, migration `018_lifecycle_consolidation.sql`, runtime graceful-shutdown biography, Homeostat rollback-frequency read contract and strict executable coverage for all ACs.
