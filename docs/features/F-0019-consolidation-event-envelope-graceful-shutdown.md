---
id: F-0019
title: Консолидация, event envelope и graceful shutdown
status: proposed
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
    - "docs/features/F-0016-development-governor-and-change-management.md"
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

### Open questions (optional)

- **OQ-F0019-01:** Owner: `@codex`; date: 2026-04-15; needed_by: `before_planned`; next decision path: `spec-compact` must enumerate the exact first-phase consolidation transition classes and reject all unsupported transition kinds fail-closed.
- **OQ-F0019-02:** Owner: `@codex`; date: 2026-04-15; needed_by: `before_planned`; next decision path: `spec-compact` must decide the minimum event-envelope fields needed for rollback/shutdown evidence, duplicate handling and restart/reclaim interpretation.
- **OQ-F0019-03:** Owner: `@codex`; date: 2026-04-15; needed_by: `before_planned`; next decision path: `spec-compact` must separate lifecycle evidence ownership from `CF-015` reporting and `CF-025` rollback orchestration.

## 3. Requirements & Acceptance Criteria (SSoT)

- To be shaped in `spec-compact`. Intake currently preserves backlog handoff, ownership boundary, source traceability and planning blockers only.

## 4. Non-functional requirements (NFR)

- To be shaped in `spec-compact`, with observable budgets for lifecycle evidence integrity, replay/deduplication safety, schema compatibility and shutdown/restart recoverability.

## 5. Design (compact)

### 5.1 API surface

- To be shaped in `spec-compact`.
- Expected boundary changes are likely internal service/event contracts rather than public HTTP routes.

### 5.2 Runtime / deployment surface

- The seam is expected to run inside the existing canonical `Node.js 22 + TypeScript + AI SDK + Hono + PostgreSQL` runtime substrate.
- No new service, container or deployment topology is committed at intake.

### 5.3 Data model changes

- To be shaped in `spec-compact`.
- Candidate owned surfaces include rollback incidents, graceful-shutdown events and event-envelope lifecycle rows.

### 5.4 Edge cases and failure modes

- Unsupported consolidation transition kind.
- Duplicate or replayed lifecycle event envelope.
- Shutdown requested while tick work, narrative writes or governor proposals are in flight.
- Retention or compaction candidate would break versioned subject-state compatibility.
- Rollback evidence lacks a canonical lifecycle ref or conflicts with boot/recovery evidence.

### 5.5 Verification surface / initial verification plan

- `spec-compact` must map each future AC to unit/integration proof and add smoke verification when runtime/startup/deployment behavior changes.
- Lifecycle evidence consumed by `F-0012` must be verified against degraded/not-evaluable fallback semantics before and after the source exists.

### 5.6 Representation upgrades (triggered only when needed)

- Expected for `spec-compact`:
  - event-envelope contract sketch;
  - lifecycle transition table;
  - owner/consumer matrix for lifecycle evidence, reporting, governor and rollback orchestration.

### 5.7 Definition of Done

- To be shaped in `spec-compact`.

### 5.8 Rollout / activation note (triggered only when needed)

- Required during `spec-compact` if lifecycle evidence backfill, retention cutover or shutdown activation order affects existing runtime state.

## 6. Slicing plan (2–6 increments)

- To be forecast in `plan-slice` after open questions marked `needed_by: before_planned` are resolved.

## 7. Task list (implementation units)

- To be forecast in `plan-slice`.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|

## 9. Decision log (ADR blocks)

## 10. Progress & links

- Backlog item key: CF-018
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Issue:
- PRs:

## 11. Change log

- 2026-04-15: Initial dossier created from backlog item `CF-018` at backlog delivery state `defined`.
