---
id: F-0026
title: Deploy/release automation и rollback orchestration
status: proposed
coverage_gate: deferred
backlog_item_key: CF-025
owners: ["@codex"]
area: platform
depends_on: ["F-0002", "F-0007", "F-0020", "F-0023", "F-0016", "F-0019"]
impacts: ["platform", "deployment", "release", "rollback", "operations"]
created: 2026-04-24
updated: 2026-04-24
links:
  issue: ""
  pr: []
  docs:
    - "docs/architecture/system.md"
    - "docs/polyphony_concept.md"
    - "docs/notes/backlog-legacy/feature-candidates.md"
    - "docs/notes/backlog-legacy/working-system-roadmap-matrix-2026-03-26.md"
---

## 1. Context & Goal

- **Backlog handoff:**
  - Backlog item key: CF-025
  - Backlog delivery state at intake: defined
  - Source traceability:
    - docs/architecture/system.md
    - docs/polyphony_concept.md
    - docs/notes/backlog-legacy/feature-candidates.md
    - docs/notes/backlog-legacy/working-system-roadmap-matrix-2026-03-26.md
  - Known blockers at intake:
    - none recorded
  - Known dependencies at intake:
    - CF-020
    - CF-022
    - CF-023
    - CF-015
    - CF-016
    - CF-018
- **User problem:** Minimum CI, canonical local deployment cell, deterministic smoke harness, real `vLLM` serving, observability, governor and lifecycle evidence already have owners, but release/deploy/rollback is still not a canonical operational path. Without `CF-025`, rollout of the real runtime/model stack, environment promotion, smoke-on-deploy, release evidence and rollback orchestration remain manual or implicit, so workshop, governor and model-serving work cannot truthfully be claimed as operationally deployable.
- **Goal:** Open one canonical feature owner for `CF-025` that will shape deploy/release automation and rollback orchestration on top of the existing root quality/smoke contract and canonical deployment cell. The feature must define how release automation consumes readiness and evidence from `CF-023`, `CF-015`, `CF-016` and `CF-018`, how release evidence is persisted, and how rollback is orchestrated without relying on placeholder providers, raw ad hoc logs or hidden manual steps.
- **Non-goals:** This feature does not reimplement the canonical deployment cell (`CF-020` / `F-0002`), deterministic smoke harness (`CF-022` / `F-0007`), real model-serving path (`CF-023` / `F-0020`), observability/report materialization (`CF-015` / `F-0023`), development-governor decision surfaces (`CF-016` / `F-0016`) or lifecycle/rollback evidence ownership (`CF-018` / `F-0019`). It does not deliver support runbooks or incident discipline (`CF-026`), specialist rollout/retirement (`CF-019`) or runtime code during intake.
- **Current substrate / baseline:** `F-0002` owns the canonical monorepo/deployment cell, `F-0007` owns deterministic smoke lifecycle, `F-0020` owns real local-model serving, `F-0023` owns diagnostic/report evidence, `F-0016` owns governor/change-management gates, and `F-0019` owns lifecycle and rollback-frequency evidence.

## 2. Scope

### In scope

- Durable intake of `CF-025` as `F-0026` and preservation of the single backlog-item handoff.
- Initial owner boundary for environment promotion, release evidence, smoke-on-deploy and rollback orchestration.
- Explicit reuse of the root quality/smoke contract and canonical deployment cell as the release substrate.
- Shaping input for how deploy/release automation consumes canonical readiness and evidence from real serving, observability, governor and lifecycle owners.
- Identification of open environment-strategy, release-evidence and rollback-control decisions that may need ADR or backlog actualization during later `spec-compact` / change-proposal work.

### Out of scope

- Changing backlog truth during intake; `CF-025` has no recorded blockers and no intake follow-up is required.
- Creating a second release runtime, parallel Compose stack, environment-specific source of truth or hidden manual release checklist.
- Reowning `F-0002` deployment-cell primitives, `F-0007` smoke harness mechanics, `F-0020` model-serving readiness, `F-0023` report generation, `F-0016` governor decisions or `F-0019` lifecycle evidence.
- Counting placeholder providers, synthetic logs, raw ad hoc logs or operator memory as release closure evidence.
- Delivering support/operability runbooks (`CF-026`) or specialist rollout policy (`CF-019`).
- Implementing code, migrations, CI changes or runtime deployment behavior during intake.

### Constraints

- Preserve `one feature = one backlog item`: `F-0026` maps only to `CF-025`.
- Keep release automation on the repository's canonical runtime and toolchain path from `README.md` and the platform ADRs.
- Any future runtime/startup/deployment change must run the root quality gates (`pnpm format`, `pnpm typecheck`, `pnpm lint`, and applicable `pnpm test`) and the containerized `pnpm smoke:cell` path before implementation closure.
- Release closure must be evidence-backed: canonical readiness, smoke result, governor/lifecycle evidence and rollback target must be inspectable.
- Before entering `spec-compact` or `plan-slice`, perform the repo-required Plan mode assessment from `ADR-2026-03-23-plan-mode-decision-gate.md`.
- If shaping reveals a missing prerequisite owner or cross-cutting invariant, use the unified backlog/change-proposal path instead of silently widening this dossier.

### Assumptions (optional)

- The listed prerequisites are delivered enough for intake: `CF-020`, `CF-022`, `CF-023`, `CF-015`, `CF-016` and `CF-018` are `implemented` in backlog state.
- `feature-intake` records the owner boundary only; acceptance criteria, data model and implementation slicing remain deferred to `spec-compact` and `plan-slice`.

### Open questions (optional)

- What environment vocabulary is canonical for this repository: local, CI smoke cell, staging-like cell, production-like cell, or a smaller set?
- What is the minimum release evidence bundle: commit/ref, image/artifact identity, migration state, smoke result, model-serving readiness, governor decision, lifecycle rollback target and diagnostic report refs?
- Which rollback actions can be automated immediately, and which must stay human-gated or governor-gated?
- Should release evidence live in existing operational stores, new deployment tables, generated artifacts, or both?
- Does deploy/release/rollback orchestration require a repo-level ADR during `spec-compact`?
## 3. Requirements & Acceptance Criteria (SSoT)

## 4. Non-functional requirements (NFR)

## 5. Design (compact)

### 5.1 API surface

### 5.2 Runtime / deployment surface

### 5.3 Data model changes

### 5.4 Edge cases and failure modes

### 5.5 Verification surface / initial verification plan

### 5.6 Representation upgrades (triggered only when needed)

### 5.7 Definition of Done

### 5.8 Rollout / activation note (triggered only when needed)

## 6. Slicing plan (2–6 increments)

## 7. Task list (implementation units)

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|

## 9. Decision log (ADR blocks)

## 10. Progress & links

- Backlog item key: CF-025
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Issue:
- PRs:

## 11. Change log

- 2026-04-24: Initial dossier created from backlog item `CF-025` at backlog delivery state `defined`.
