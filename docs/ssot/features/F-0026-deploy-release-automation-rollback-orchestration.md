---
id: F-0026
title: Deploy/release automation и rollback orchestration
status: shaped
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
    - "README.md"
    - "docs/architecture/system.md"
    - "docs/polyphony_concept.md"
    - "docs/notes/backlog-legacy/feature-candidates.md"
    - "docs/notes/backlog-legacy/working-system-roadmap-matrix-2026-03-26.md"
    - "docs/ssot/features/F-0002-canonical-monorepo-deployment-cell.md"
    - "docs/ssot/features/F-0007-deterministic-smoke-harness-and-suite-scoped-cell-lifecycle.md"
    - "docs/ssot/features/F-0016-development-governor-and-change-management.md"
    - "docs/ssot/features/F-0019-consolidation-event-envelope-graceful-shutdown.md"
    - "docs/ssot/features/F-0020-real-vllm-serving-and-promotion-model-dependencies.md"
    - "docs/ssot/features/F-0023-observability-and-diagnostic-reporting.md"
    - "docs/adr/ADR-2026-03-19-canonical-runtime-toolchain.md"
    - "docs/adr/ADR-2026-03-19-phase0-deployment-cell.md"
    - "docs/adr/ADR-2026-03-19-quality-gate-sequence.md"
    - "docs/adr/ADR-2026-03-23-plan-mode-decision-gate.md"
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

### Terms & thresholds

- `local`: the existing repository-local Docker Compose and `pnpm smoke:cell` contour.
- `release cell`: a production-like release contour that uses the same canonical deployment-cell contract instead of a second orchestration stack.
- `release request`: an operator or CI request to release one git ref into one target environment.
- `deploy attempt`: one concrete attempt to apply a release request to `local` or `release_cell`.
- `smoke-on-deploy`: the required post-deploy verification run tied to a deploy attempt.
- `release evidence bundle`: durable release proof linking commit/ref, deployment identity, migration state, smoke result, model-serving readiness, governor evidence, lifecycle rollback target and diagnostic report refs.
- `rollback plan`: the precomputed rollback target and execution plan required before a deploy attempt starts.
- `rollback execution`: a recorded rollback action, whether triggered automatically by failed smoke-on-deploy or manually by an admitted operator action.

### Policy decisions

- **PD-F0026-01:** `F-0026` owns release/deploy/rollback orchestration facts only: release requests, deploy attempts, release evidence, rollback plans and rollback execution records.
- **PD-F0026-02:** `F-0026` reuses `F-0002` deployment cell, `F-0007` smoke lifecycle, `F-0020` real model-serving readiness, `F-0023` reporting evidence, `F-0016` governor evidence and `F-0019` lifecycle rollback evidence; it does not write their source surfaces.
- **PD-F0026-03:** The first implementation must support both CLI and protected Operator API entrypoints for the same owner service. The CLI is suitable for CI/operator scripts; the API must stay inside the existing `F-0013` Hono operator boundary and use `F-0024` caller admission/RBAC.
- **PD-F0026-04:** A deploy attempt may start only after a rollback plan exists and evidence storage is writable.
- **PD-F0026-05:** Failed smoke-on-deploy triggers automatic rollback when the rollback plan is available and admitted. If rollback cannot execute or cannot be recorded, the deploy attempt fails closed and writes critical rollback-failure evidence.
- **PD-F0026-06:** PostgreSQL is the source for release decisions and state. File artifacts may hold larger reports/logs/snapshots and must be linked from PostgreSQL evidence refs.
- **PD-F0026-07:** A feature-local decision log is sufficient for this spec. A repo-level ADR is required only if implementation later changes shared startup/deployment contracts, introduces a new orchestration substrate or changes cross-feature write ownership.

### Acceptance criteria

- **AC-F0026-01:** `F-0026` is the only canonical owner for release requests, deploy attempts, release evidence bundles, rollback plans, rollback execution records.
- **AC-F0026-02:** Each release request records target environment (`local` / `release_cell`), git ref, actor, request source (`cli`, `operator_api`, `ci`), evidence refs.
- **AC-F0026-03:** Release requests are idempotent by request id; equivalent replay returns the existing release request; conflicting replay fails before writing a new request.
- **AC-F0026-04:** A deploy attempt cannot start unless the release request has a rollback plan plus writable release-evidence storage.
- **AC-F0026-05:** A release evidence bundle records commit/ref, deployment identity, migration state, smoke-on-deploy result, model-serving readiness, governor decision/evidence ref, lifecycle rollback target/ref, diagnostic report refs.
- **AC-F0026-06:** Release evidence may link file artifacts; authoritative decision/state facts must be queryable from PostgreSQL.
- **AC-F0026-07:** CLI/API entrypoints call the same release service; produced release request, deploy attempt, evidence, rollback records are equivalent.
- **AC-F0026-08:** Operator API entrypoints are protected by `F-0024` caller admission/RBAC before invoking any release service behavior.
- **AC-F0026-09:** Failing smoke-on-deploy automatically triggers rollback using the precomputed rollback plan.
- **AC-F0026-10:** Automatic rollback records rollback execution evidence linked to the failed deploy attempt, rollback plan, lifecycle evidence, diagnostic report refs.
- **AC-F0026-11:** Deploy attempt fails before activation when any required prerequisite is missing: rollback plan, evidence storage, governor evidence, lifecycle rollback target, model-serving readiness, smoke harness availability.
- **AC-F0026-12:** `F-0026` does not create a second Compose stack, second release runtime, Kubernetes path, environment-specific hidden source of truth.
- **AC-F0026-13:** Placeholder providers, synthetic responses, raw ad hoc logs, hidden manual steps cannot satisfy release closure.
- **AC-F0026-14:** `F-0026` consumes `F-0016` governor evidence read-only; it does not execute/mutate governor decisions.
- **AC-F0026-15:** `F-0026` consumes `F-0019` lifecycle/rollback evidence read-only; it does not invent rollback-frequency/graceful-shutdown history.
- **AC-F0026-16:** Release reports from `F-0023` remain reporting projections; `F-0026` owns release facts plus evidence links, not report materialization.
- **AC-F0026-17:** Runtime/startup/deployment-affecting implementation must pass root quality gates plus `pnpm smoke:cell` before implementation closure.

## 4. Non-functional requirements (NFR)

- **Evidence completeness:** `100%` of successful deploy attempts have a release evidence bundle with every field required by `AC-F0026-05`.
- **Rollback preparedness:** deploy attempts without a persisted rollback plan budget: `0`.
- **Smoke gate strictness:** deploy activation after failed or unavailable smoke-on-deploy budget: `0`.
- **Automatic rollback reliability:** every failed smoke-on-deploy must either record successful rollback execution or a critical rollback-failure evidence record before the attempt reaches terminal state.
- **Owner-boundary safety:** release orchestration direct writes to governor, lifecycle, reporting, model-serving or smoke-harness owner tables budget: `0`.
- **Hidden manual-step budget:** release closure based only on undocumented operator memory, unlinked shell logs or untracked files budget: `0`.
- **Idempotency:** duplicate release request rows for the same equivalent request id budget: `0`.

## 5. Design (compact)

### 5.1 API surface

- CLI surface for CI/operator use:
  - create/prepare release request;
  - run deploy attempt;
  - attach or materialize release evidence;
  - execute or inspect rollback.
- Operator API surface for protected human/operator use:
  - same semantic operations as CLI;
  - routed through the existing Hono operator namespace;
  - guarded by `F-0024` caller admission and role checks before release service invocation.
- No public unauthenticated release, deploy or rollback route is allowed.

### 5.2 Runtime / deployment surface

- The first implementation stays inside the existing `apps/core` runtime and repository scripts.
- It uses the canonical `Node.js 22 + TypeScript + Hono + PostgreSQL + Docker Compose` path.
- `local` uses the existing compose/smoke path.
- `release_cell` is a production-like contour over the same deployment-cell contract, not a new orchestration platform.
- No Kubernetes, second compose topology, new gateway or new model-serving runtime is introduced by this feature.

### 5.3 Data model changes

Exact table/module names are planning choices, but implementation must preserve these semantic surfaces:

- `release_requests`: target environment, git ref, actor, source, request id, requested action and evidence refs.
- `deploy_attempts`: release request ref, environment, deployment identity, migration state, status, timestamps and failure reason.
- `release_evidence`: release request/deploy attempt refs, smoke result refs, readiness refs, governor refs, lifecycle refs, reporting refs and file artifact refs.
- `rollback_plans`: release request/deploy attempt refs, rollback target, required evidence, execution mode and preflight status.
- `rollback_executions`: rollback plan ref, trigger (`auto_smoke_failure`, `operator_manual`, `ci_manual`), result, evidence refs and terminal status.

PostgreSQL rows are authoritative for state and decisions. File artifacts are referenced evidence, not independent release state.

### 5.4 Edge cases and failure modes

- Missing rollback plan before deploy.
- Failed or unavailable smoke-on-deploy.
- Rollback plan exists but rollback execution fails.
- Evidence storage is unavailable before deploy or during terminal recording.
- Governor evidence is missing, stale, denied or unavailable.
- Lifecycle rollback target is missing or conflicts with release request target.
- Model-serving readiness is unavailable or reports placeholder/non-real serving.
- Operator API caller is unauthenticated, unauthorized or lacks release role.
- CLI and Operator API submit conflicting request ids.
- Release evidence file artifact is missing after PostgreSQL record points to it.

### 5.5 Verification surface / initial verification plan

- Contract tests for release request, deploy attempt, release evidence, rollback plan and rollback execution schemas.
- DB integration tests for idempotency, conflicting replay and failure-before-write behavior.
- CLI tests for successful release, failed smoke, automatic rollback, missing rollback plan and unavailable evidence storage.
- Operator API tests for caller admission/RBAC and parity with CLI behavior.
- Boundary tests proving no direct writes to governor, lifecycle, reporting, model-serving or smoke-harness owner surfaces.
- Smoke coverage proving deploy attempt plus smoke-on-deploy plus automatic rollback on smoke failure.
- Dossier verification: `dossier-engineer dossier-verify --step spec-compact --dossier docs/ssot/features/F-0026-deploy-release-automation-rollback-orchestration.md`.

### 5.6 Representation upgrades (triggered only when needed)

- Feature-local decision log is enough for this spec.
- Repo-level ADR is triggered if implementation introduces a new release environment taxonomy beyond `local`/`release_cell`, changes the canonical compose/deployment-cell contract, changes startup behavior for all features or gives `F-0026` write ownership over neighbouring owner surfaces.
- Backlog actualization is expected for `CF-025` from `defined` to `specified` when this spec closes.

### 5.7 Definition of Done

- `F-0026` owns durable release/deploy/rollback state and evidence surfaces.
- CLI and protected Operator API call the same release service.
- Deploy cannot start without rollback plan and writable evidence storage.
- Failed smoke-on-deploy triggers automatic rollback or records critical rollback-failure evidence.
- Release evidence links canonical readiness, smoke, governor, lifecycle and reporting refs.
- Owner-boundary tests prove neighbouring source surfaces remain read-only.
- `dossier-verify`, external `spec-conformance-reviewer`, implementation review stack and local quality/smoke gates are green for the relevant stage.

### 5.8 Rollout / activation note (triggered only when needed)

- First activation should run in `local` mode and write release evidence without changing external availability.
- Next activation may enable `release_cell` deploy attempts with auto rollback on failed smoke-on-deploy.
- Operator API activation must stay fail-closed until `F-0024` caller admission/RBAC is configured.
- Rollback must always target the precomputed rollback plan; ad hoc rollback target selection during failure handling is forbidden.

## 6. Slicing plan (2-6 increments)

### SL-F0026-01: Release state contracts and store

- **Result:** contracts and PostgreSQL-backed store for release requests, deploy attempts, release evidence, rollback plans and rollback executions.
- **Depends on:** `F-0002`, `F-0016`, `F-0019`; owner `@codex`; unblock condition: deployment identity, governor evidence refs and lifecycle rollback refs are linkable.
- **Verification:** contract tests, DB idempotency tests, missing required evidence rejection tests, boundary tests for foreign-owner write rejection.

### SL-F0026-02: CLI release path and evidence bundle

- **Result:** CLI/operator script path that prepares release request, verifies rollback plan, runs deploy attempt, attaches release evidence and refuses incomplete evidence.
- **Depends on:** `SL-F0026-01`, `F-0007`, `F-0020`, `F-0023`; owner `@codex`; unblock condition: smoke command, model readiness refs and diagnostic report refs are available.
- **Verification:** CLI command tests, missing rollback/evidence tests, release evidence bundle tests.

### SL-F0026-03: Smoke-on-deploy and automatic rollback

- **Result:** deploy attempt runner that executes smoke-on-deploy and automatically rolls back on smoke failure using the precomputed rollback plan.
- **Depends on:** `SL-F0026-01`, `SL-F0026-02`; owner `@codex`; unblock condition: rollback plan can be executed and terminal evidence can be persisted.
- **Verification:** failed-smoke auto-rollback tests, rollback-failure critical evidence tests, `pnpm smoke:cell` when runtime/deployment behavior changes.

### SL-F0026-04: Protected Operator API

- **Result:** protected Operator API endpoints for release request, deploy attempt inspection/action and rollback inspection/action, all delegating to the same service as CLI.
- **Depends on:** `SL-F0026-01`, `SL-F0026-02`, `F-0024`; owner `@codex`; unblock condition: caller admission and release/operator role checks are enforceable.
- **Verification:** API auth/RBAC tests, CLI/API parity tests, unauthorized/unauthenticated failure tests.

### SL-F0026-05: Release readiness audit and final closure

- **Result:** full owner-boundary audit, report/evidence linkage audit, backlog actualization and final quality/smoke proof.
- **Depends on:** `SL-F0026-01` through `SL-F0026-04`; owner `@codex`; unblock condition: release evidence can be traced across release, governor, lifecycle, reporting and smoke surfaces.
- **Verification:** usage audit, boundary audit, root quality gates, `pnpm test`, `pnpm smoke:cell`.

## 7. Task list (implementation units)

- **T-F0026-01:** Add release/rollback contracts plus test schema validation. Covers: AC-F0026-01, AC-F0026-02, AC-F0026-05.
- **T-F0026-02:** Add PostgreSQL migration/store for release requests, deploy attempts, release evidence, rollback plans, rollback executions. Covers: AC-F0026-01, AC-F0026-03, AC-F0026-06.
- **T-F0026-03:** Add release service that enforces rollback-plan plus evidence-storage preconditions. Covers: AC-F0026-04, AC-F0026-11.
- **T-F0026-04:** Add CLI path for prepare/deploy/evidence/rollback. Covers: AC-F0026-07, AC-F0026-13.
- **T-F0026-05:** Wire smoke-on-deploy plus automatic rollback on smoke failure. Covers: AC-F0026-09, AC-F0026-10, AC-F0026-17.
- **T-F0026-06:** Add protected Operator API routes delegating to the release service. Covers: AC-F0026-07, AC-F0026-08.
- **T-F0026-07:** Add owner-boundary plus evidence-linkage audit. Covers: AC-F0026-12, AC-F0026-14, AC-F0026-15, AC-F0026-16.
- **T-F0026-08:** Run final quality, smoke, dossier closure. Covers: AC-F0026-01 through AC-F0026-17.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0026-01 | contracts + DB store ownership tests; owner-boundary audit | planned |
| AC-F0026-02 | release request contract tests; CLI/API request tests | planned |
| AC-F0026-03 | DB idempotency plus conflicting replay tests | planned |
| AC-F0026-04 | release service preflight tests | planned |
| AC-F0026-05 | release evidence bundle tests | planned |
| AC-F0026-06 | DB/file artifact reference integration tests | planned |
| AC-F0026-07 | CLI/API parity tests | planned |
| AC-F0026-08 | Operator API auth/RBAC tests | planned |
| AC-F0026-09 | failed-smoke auto-rollback tests | planned |
| AC-F0026-10 | rollback execution evidence tests | planned |
| AC-F0026-11 | missing evidence/readiness rejection tests | planned |
| AC-F0026-12 | no-second-runtime/compose drift tests | planned |
| AC-F0026-13 | placeholder/manual evidence rejection tests | planned |
| AC-F0026-14 | governor read-only boundary tests | planned |
| AC-F0026-15 | lifecycle read-only boundary tests | planned |
| AC-F0026-16 | reporting read-only boundary tests | planned |
| AC-F0026-17 | root quality gates plus `pnpm smoke:cell` evidence | planned |

## 9. Decision log (ADR blocks)

### 2026-04-24: Plan mode assessment

- Decision: Plan mode was required and used before this `spec-compact`.
- Rationale: `CF-025` had several user-visible policy choices that affected environment vocabulary, evidence storage, rollback authority and release control surface. The operator selected `local + release cell`, `PostgreSQL + files`, automatic rollback on failed smoke, `CLI + API`, and feature-local ADR scope.
- ADR impact: feature-local decision; repo-level ADR remains deferred unless implementation changes shared deployment/startup contracts.

### 2026-04-24: Environment vocabulary

- Decision: `F-0026` shapes exactly two target environments for the first implementation: `local` and `release_cell`.
- Rationale: this matches the existing local compose/smoke path while giving release automation a production-like target without introducing staging/prod taxonomy prematurely.
- ADR impact: feature-local decision; no repo-level ADR yet.

### 2026-04-24: Release evidence storage

- Decision: PostgreSQL stores release decisions and state; files store larger reports/logs/snapshots linked by evidence refs.
- Rationale: runtime and API need queryable state, while smoke/report artifacts may be too large or file-shaped for relational-only storage.
- ADR impact: feature-local decision; repo-level ADR only if implementation changes global evidence storage policy.

### 2026-04-24: Automatic rollback

- Decision: failed smoke-on-deploy triggers automatic rollback when a precomputed rollback plan exists and can be recorded.
- Rationale: release automation must be safer than a manual checklist; deploy without rollback readiness remains forbidden.
- ADR impact: feature-local decision; no repo-level ADR yet.

### 2026-04-24: Control surface

- Decision: first implementation supports both CLI and protected Operator API over one release service.
- Rationale: CI/operator scripts need CLI, while runtime operators need API access through existing auth/RBAC.
- ADR impact: feature-local decision; API must stay inside existing `F-0013`/`F-0024` boundaries.

## 10. Progress & links

- Backlog item key: CF-025
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Issue:
- PRs:

## 11. Change log

- 2026-04-24: Initial dossier created from backlog item `CF-025` at backlog delivery state `defined`.
- 2026-04-24: [spec-compact] Expanded `CF-025` into a shaped deploy/release/rollback spec with `local` + `release_cell` environments, PostgreSQL plus file evidence, automatic rollback on failed smoke-on-deploy, and CLI plus protected Operator API control surfaces.
- 2026-04-24: [verification realignment] Deferred coverage gate for `spec-compact`; strict executable AC coverage is expected during implementation once tests can reference `AC-F0026-*`.
