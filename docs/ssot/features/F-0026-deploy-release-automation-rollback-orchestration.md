---
id: F-0026
title: Deploy/release automation и rollback orchestration
status: done
coverage_gate: strict
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
    - "docs/ssot/features/F-0024-authentication-authorization-operator-rbac.md"
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

- None after `plan-slice`.
- Resolved by `spec-compact`: first environment vocabulary is `local` plus `release_cell`.
- Resolved by `spec-compact`: PostgreSQL owns release decisions/state, while files may hold linked larger evidence artifacts.
- Resolved by `spec-compact`: failed smoke-on-deploy triggers automatic rollback when a precomputed rollback plan exists and rollback evidence can be recorded.
- Resolved by `spec-compact`: CLI and protected Operator API both delegate to one release service; implementation realignment keeps host-only deploy/rollback executors explicit instead of wiring them into the container runtime by default.
- Resolved by `plan-slice`: repo-level ADR is still not required before implementation; one is required only if implementation changes shared startup/deployment contracts, introduces a new orchestration substrate or changes cross-feature write ownership.

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
- **PD-F0026-03:** The first implementation must support both CLI and protected Operator API entrypoints for the same owner service. The CLI is the host/CI execution path for `pnpm smoke:cell` and rollback orchestration. The API must stay inside the existing `F-0013` Hono operator boundary, use `F-0024` caller admission/RBAC and fail closed for deploy/rollback actions when no explicit host-capable executor is configured in that runtime.
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
- **AC-F0026-07:** CLI/API entrypoints call the same release service; produced release request, deploy attempt, evidence and rollback records are equivalent when the runtime has the same executor capabilities. A runtime without an explicit smoke or rollback executor must fail closed before claiming deploy/rollback success.
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
- Host-only smoke/rollback executors are not implicit inside the container Operator API runtime. They must be explicitly supplied by a host/CI path; otherwise deploy and rollback actions return fail-closed unavailable results through the shared release service.
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
- Dossier verification during `plan-slice`: `dossier-engineer dossier-verify --step plan-slice --dossier docs/ssot/features/F-0026-deploy-release-automation-rollback-orchestration.md`.
- Implementation verification must include root quality gates and `pnpm smoke:cell` when runtime/startup/deployment behavior changes.

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
- Operator API activation must stay fail-closed until `F-0024` caller admission/RBAC is configured and must also fail closed for deploy/rollback actions unless that runtime has explicit smoke/rollback executors.
- Rollback must always target the precomputed rollback plan; ad hoc rollback target selection during failure handling is forbidden.

## 6. Slicing plan (2-6 increments)

### Implementation boundary for plan-slice

- First implementation creates one `release-automation` owner surface for contracts, store, service, CLI and protected API routing.
- The owner surface may add `release_cell` vocabulary and release evidence configuration, but it must keep the existing Docker Compose deployment-cell contract as the substrate.
- CLI and protected Operator API must use the same release service. Transport-specific code may validate input, but release facts and rollback decisions are owned by the service/store. Executor capability is an explicit runtime dependency: the host CLI supplies host-capable smoke/rollback executors, while the container Operator API may fail closed for deploy/rollback until a safe executor seam is configured.
- Release evidence files must be linked from PostgreSQL rows and may not become independent release state.
- Implementation may change exact file names only if it preserves the semantic owner boundary, test coverage and single-service call path below.

### SL-F0026-01: Release state contracts and store

- **Result:** shared release-automation contracts, PostgreSQL migration/store and writable evidence-artifact root handling for release requests, deploy attempts, release evidence, rollback plans and rollback executions.
- **Primary files:** `packages/contracts/src/release-automation.ts`, `packages/contracts/package.json`, `packages/db/src/release-automation.ts`, `packages/db/src/index.ts`, `infra/migrations/022_release_automation.sql`, `infra/migrations/023_release_request_rollback_target_ref.sql`, `infra/migrations/024_release_rollback_execution_running_status.sql`, `infra/migrations/025_release_rollback_execution_plan_deploy_unique.sql`, `apps/core/src/platform/release-automation.ts`, `apps/core/src/platform/core-config.ts`.
- **Tests:** `packages/contracts/test/release-automation.contract.test.ts`, `packages/db/test/release-automation-store.integration.test.ts`, `apps/core/test/platform/release-automation-service.contract.test.ts`.
- **Covers:** AC-F0026-01, AC-F0026-02, AC-F0026-03, AC-F0026-04, AC-F0026-05, AC-F0026-06, AC-F0026-11.
- Depends on: delivered `F-0002` deployment identity, delivered `F-0016` governor evidence refs and delivered `F-0019` lifecycle rollback refs; owner `@codex`; unblock condition: the implementation can link those refs read-only without writing neighbouring owner tables.
- **Unblock condition:** contract/store tests prove idempotent release requests, conflicting replay rejection, required rollback-plan/evidence preconditions and PostgreSQL-first release state before CLI or API wiring starts.

### SL-F0026-02: CLI release path and evidence bundle

- **Result:** root `pnpm` CLI/operator script path that prepares release request, verifies rollback plan, runs a deploy attempt in `local`, attaches release evidence and refuses incomplete evidence.
- **Primary files:** `scripts/release-cell.ts`, `package.json`, `apps/core/src/platform/release-automation.ts`, `apps/core/src/platform/core-config.ts`, `.env.example`.
- **Tests:** `test/release-cell.command.test.ts`, `apps/core/test/platform/release-evidence-bundle.contract.test.ts`, `apps/core/test/platform/release-preflight.integration.test.ts`.
- **Covers:** AC-F0026-02, AC-F0026-04, AC-F0026-05, AC-F0026-06, AC-F0026-07, AC-F0026-11, AC-F0026-13.
- Depends on: `SL-F0026-01`, delivered `F-0007` smoke command, delivered `F-0020` model-serving readiness and delivered `F-0023` diagnostic report refs; owner `@codex`; unblock condition: CLI can collect all required refs without hidden manual steps.
- **Unblock condition:** CLI tests prove success, missing rollback plan, missing evidence storage, missing readiness refs and conflicting request ids before smoke/rollback automation starts.

### SL-F0026-03: Smoke-on-deploy and automatic rollback

- **Result:** deploy attempt runner that executes smoke-on-deploy and automatically rolls back on smoke failure using the precomputed rollback plan.
- **Primary files:** `apps/core/src/platform/release-automation.ts`, `packages/db/src/release-automation.ts`, `infra/docker/deployment-cell.smoke.ts`, `infra/docker/helpers.ts`.
- **Tests:** `apps/core/test/platform/release-smoke-rollback.integration.test.ts`, `apps/core/test/platform/release-rollback-failure.contract.test.ts`, `infra/docker/test/release-cell-smoke.test.ts`.
- **Covers:** AC-F0026-04, AC-F0026-09, AC-F0026-10, AC-F0026-11, AC-F0026-17.
- Depends on: `SL-F0026-01`, `SL-F0026-02` and executable rollback/evidence persistence; owner `@codex`; unblock condition: rollback plan can be executed and terminal evidence can be persisted even on failed smoke.
- **Unblock condition:** failed-smoke tests prove automatic rollback, rollback-failure critical evidence and no deploy activation after failed or unavailable smoke.

### SL-F0026-04: Protected Operator API

- **Result:** protected Operator API endpoints for release request, deploy attempt inspection/action and rollback inspection/action, all delegating to the same release service as CLI and failing closed for deploy/rollback when the container runtime has no explicit host-capable executor.
- **Primary files:** `packages/contracts/src/operator-api.ts`, `packages/contracts/src/operator-auth.ts`, `apps/core/src/platform/operator-api.ts`, `apps/core/src/runtime/runtime-lifecycle.ts`, `apps/core/testing/platform-test-fixture.ts`, `apps/core/src/platform/release-automation.ts`.
- **Tests:** `packages/contracts/test/operator-api.contract.test.ts`, `packages/contracts/test/operator-auth.contract.test.ts`, `apps/core/test/platform/operator-release-automation.integration.test.ts`, `apps/core/test/platform/operator-auth-rbac.integration.test.ts`.
- **Covers:** AC-F0026-07, AC-F0026-08, AC-F0026-11, AC-F0026-13.
- Depends on: `SL-F0026-01`, `SL-F0026-02` and delivered `F-0024`; owner `@codex`; unblock condition: caller admission and release/operator route permissions are enforceable before release service invocation.
- **Unblock condition:** API tests prove unauthenticated, unauthorized, missing-downstream-owner and missing-executor paths fail closed, while admitted API and CLI requests produce equivalent release facts when executor capability is present.

### SL-F0026-05: Release readiness audit and final closure

- **Result:** owner-boundary hardening, report/evidence linkage audit, docs/config updates, backlog actualization and final quality/smoke proof.
- **Primary files:** `apps/core/src/platform/release-automation.ts`, `apps/core/src/runtime/reporting.ts`, `packages/contracts/src/reporting.ts`, `README.md`, `.env.example`, `docs/ssot/features/F-0026-deploy-release-automation-rollback-orchestration.md`.
- **Tests:** `apps/core/test/platform/release-owner-boundary.contract.test.ts`, `apps/core/test/runtime/reporting-service.integration.test.ts`, `apps/core/test/platform/release-automation-usage-audit.integration.test.ts`.
- **Covers:** AC-F0026-01, AC-F0026-12, AC-F0026-14, AC-F0026-15, AC-F0026-16, AC-F0026-17.
- Depends on: `SL-F0026-01` through `SL-F0026-04`; owner `@codex`; unblock condition: release evidence can be traced across release, governor, lifecycle, reporting and smoke surfaces without foreign owner writes.
- **Unblock condition:** root quality gates and `pnpm smoke:cell` pass, or a truthful blocker is recorded before implementation closure.

### Plan-slice commitments

- **PL-F0026-01:** `SL-F0026-01` lands first so release state, idempotency, rollback-plan preconditions and evidence storage are explicit before any transport or smoke runner exists.
- **PL-F0026-02:** `SL-F0026-02` lands before Operator API because CLI provides the first low-surface release path and proves the service contract without widening public control routes.
- **PL-F0026-03:** `SL-F0026-03` lands before protected API because automatic rollback semantics must be service-owned and tested before human/operator routes can trigger or inspect deploy attempts.
- **PL-F0026-04:** `SL-F0026-04` must stay inside the existing `F-0013` Hono namespace and `F-0024` caller admission/RBAC; no second gateway or public unauthenticated route may appear.
- **PL-F0026-05:** `SL-F0026-05` is last because boundary scans, report projection checks, docs and final smoke are only truthful after all release facts and control paths exist.

### Planned implementation order

1. Add release-automation contracts, migration, store, config and evidence root handling.
2. Add the release service and root CLI path for local release preparation/deploy/evidence/rollback.
3. Add smoke-on-deploy execution and automatic rollback on failed smoke.
4. Add protected Operator API routes over the same release service.
5. Add owner-boundary/reporting audits, docs, final coverage refs, root quality gates and `pnpm smoke:cell`.

## 7. Task list (implementation units)

- **T-F0026-01** (`SL-F0026-01`): Add `release-automation` contract types and schemas for release request, deploy attempt, evidence bundle, rollback plan and rollback execution. Covers: AC-F0026-01, AC-F0026-02, AC-F0026-05.
- **T-F0026-02** (`SL-F0026-01`): Add package export for `@yaagi/contracts/release-automation` and contract tests for environment/source/status/ref vocabulary. Covers: AC-F0026-01, AC-F0026-02.
- **T-F0026-03** (`SL-F0026-01`): Add PostgreSQL migration/store for release requests, deploy attempts, release evidence, rollback plans and rollback executions. Covers: AC-F0026-01, AC-F0026-03, AC-F0026-06.
- **T-F0026-04** (`SL-F0026-01`): Add release service preflight that rejects missing rollback plan, missing evidence storage, missing governor evidence, missing lifecycle target, missing model readiness and missing smoke harness. Covers: AC-F0026-04, AC-F0026-11.
- **T-F0026-05** (`SL-F0026-02`): Add root `pnpm` CLI/operator script for prepare, deploy, evidence and rollback actions over the release service. Covers: AC-F0026-07, AC-F0026-13.
- **T-F0026-06** (`SL-F0026-02`): Add release evidence bundle materialization and file-artifact linking with PostgreSQL as the authoritative decision/state source. Covers: AC-F0026-05, AC-F0026-06.
- **T-F0026-07** (`SL-F0026-03`): Wire smoke-on-deploy execution into deploy attempts and block activation on failed or unavailable smoke. Covers: AC-F0026-09, AC-F0026-11, AC-F0026-17.
- **T-F0026-08** (`SL-F0026-03`): Add automatic rollback using the precomputed rollback plan and record rollback execution or critical rollback-failure evidence. Covers: AC-F0026-09, AC-F0026-10.
- **T-F0026-09** (`SL-F0026-04`): Add protected Operator API contracts/routes for release request, deploy attempt inspection/action and rollback inspection/action. Covers: AC-F0026-07, AC-F0026-08.
- **T-F0026-10** (`SL-F0026-04`): Add `F-0024` caller admission/RBAC classification and negative API tests for unauthenticated, unauthorized and unavailable owner paths. Covers: AC-F0026-08, AC-F0026-13.
- **T-F0026-11** (`SL-F0026-05`): Add owner-boundary and evidence-linkage audits proving no direct writes to governor, lifecycle, reporting, model-serving or smoke-harness owner surfaces. Covers: AC-F0026-12, AC-F0026-14, AC-F0026-15, AC-F0026-16.
- **T-F0026-12** (`SL-F0026-05`): Update docs/config/coverage map and run root quality gates plus `pnpm test` and `pnpm smoke:cell` before implementation closure. Covers: AC-F0026-01 through AC-F0026-17.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0026-01 | `packages/contracts/test/release-automation.contract.test.ts`; `packages/db/test/release-automation-store.integration.test.ts`; `apps/core/test/platform/release-owner-boundary.contract.test.ts` | implemented |
| AC-F0026-02 | `packages/contracts/test/release-automation.contract.test.ts`; `test/release-cell.command.test.ts`; `apps/core/test/platform/operator-release-automation.integration.test.ts` | implemented |
| AC-F0026-03 | `packages/db/test/release-automation-store.integration.test.ts`; `apps/core/test/platform/release-automation-service.contract.test.ts` | implemented |
| AC-F0026-04 | `apps/core/test/platform/release-preflight.integration.test.ts`; `apps/core/test/platform/release-automation-service.contract.test.ts` | implemented |
| AC-F0026-05 | `apps/core/test/platform/release-evidence-bundle.contract.test.ts`; `packages/db/test/release-automation-store.integration.test.ts` | implemented |
| AC-F0026-06 | `packages/db/test/release-automation-store.integration.test.ts`; `apps/core/test/platform/release-evidence-bundle.contract.test.ts` | implemented |
| AC-F0026-07 | `test/release-cell.command.test.ts`; `apps/core/test/platform/operator-release-automation.integration.test.ts`; `apps/core/test/platform/release-automation-usage-audit.integration.test.ts` | implemented |
| AC-F0026-08 | `apps/core/test/platform/operator-release-automation.integration.test.ts`; `apps/core/test/platform/operator-auth-rbac.integration.test.ts`; `packages/contracts/test/operator-auth.contract.test.ts` | implemented |
| AC-F0026-09 | `apps/core/test/platform/release-smoke-rollback.integration.test.ts`; `infra/docker/test/release-cell-smoke.test.ts` | implemented |
| AC-F0026-10 | `apps/core/test/platform/release-smoke-rollback.integration.test.ts`; `apps/core/test/platform/release-rollback-failure.contract.test.ts` | implemented |
| AC-F0026-11 | `apps/core/test/platform/release-preflight.integration.test.ts`; `apps/core/test/platform/release-automation-service.contract.test.ts`; `apps/core/test/platform/operator-release-automation.integration.test.ts` | implemented |
| AC-F0026-12 | `apps/core/test/platform/release-owner-boundary.contract.test.ts`; `infra/docker/test/compose-config.test.ts`; `infra/docker/test/release-cell-smoke.test.ts` | implemented |
| AC-F0026-13 | `test/release-cell.command.test.ts`; `apps/core/test/platform/operator-release-automation.integration.test.ts`; `apps/core/test/platform/release-evidence-bundle.contract.test.ts` | implemented |
| AC-F0026-14 | `apps/core/test/platform/release-owner-boundary.contract.test.ts`; `apps/core/test/platform/release-preflight.integration.test.ts` | implemented |
| AC-F0026-15 | `apps/core/test/platform/release-owner-boundary.contract.test.ts`; `apps/core/test/platform/release-smoke-rollback.integration.test.ts` | implemented |
| AC-F0026-16 | `apps/core/test/platform/release-owner-boundary.contract.test.ts`; `apps/core/test/platform/release-automation-usage-audit.integration.test.ts`; `apps/core/test/runtime/reporting-service.integration.test.ts` | implemented |
| AC-F0026-17 | root `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test`; `pnpm smoke:cell`; `infra/docker/test/release-cell-smoke.test.ts` | implemented |

## 9. Decision log (ADR blocks)

### 2026-04-24: Plan mode assessment

- Decision: Plan mode was required and used before this `spec-compact`.
- Rationale: `CF-025` had several user-visible policy choices that affected environment vocabulary, evidence storage, rollback authority and release control surface. The operator selected `local + release cell`, `PostgreSQL + files`, automatic rollback on failed smoke, `CLI + API`, and feature-local ADR scope.
- ADR impact: feature-local decision; repo-level ADR remains deferred unless implementation changes shared deployment/startup contracts.

### 2026-04-24: Plan-slice Plan mode assessment

- Decision: Plan mode was not required before this `plan-slice`.
- Rationale: `spec-compact` already fixed the user-visible policy choices and owner boundary. The remaining work is implementation sequencing over one accepted release-automation surface, with no new repo-level ADR, no competing deployment topology and no open backlog attention.
- ADR impact: feature-local planning decision; normal dossier artifacts and independent review remain required.

### 2026-04-24: Release owner module

- Decision: first implementation plans one `release-automation` owner module across contracts, DB store, platform service, CLI and protected Operator API.
- Rationale: a single owner module keeps CLI/API parity testable and prevents release facts from splitting between scripts, API handlers and smoke harness code.
- ADR impact: feature-local decision; repo-level ADR still required if implementation introduces a second orchestration substrate or changes shared deployment-cell startup behavior.

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

### 2026-04-24: Host executor boundary

- Decision: host-only smoke/rollback executors are wired explicitly into the CLI path and are not implicit defaults for the container Operator API runtime.
- Rationale: the canonical deployment-cell `core` container has no Docker socket or host `docker compose` control surface. Wiring host commands into that runtime would advertise deploy/rollback capability that cannot execute safely there.
- ADR impact: feature-local implementation realignment; a repo-level ADR or follow-up dossier is required only if a future slice introduces a shared host executor service or changes deployment-cell startup/orchestration contracts.

## 10. Progress & links

- Backlog item key: CF-025
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Current stage: `implementation closure`
- Issue:
- PRs:

## 11. Change log

- 2026-04-24: Initial dossier created from backlog item `CF-025` at backlog delivery state `defined`.
- 2026-04-24: [spec-compact] Expanded `CF-025` into a shaped deploy/release/rollback spec with `local` + `release_cell` environments, PostgreSQL plus file evidence, automatic rollback on failed smoke-on-deploy, and CLI plus protected Operator API control surfaces.
- 2026-04-24: [verification realignment] Deferred coverage gate for `spec-compact`; strict executable AC coverage is expected during implementation once tests can reference `AC-F0026-*`.
- 2026-04-24: [plan-slice] [dependency realignment] Planned implementation slices across release contracts/store, CLI evidence path, smoke-on-deploy plus automatic rollback, protected Operator API and owner-boundary/reporting closure, with backlog lifecycle target `planned`.
- 2026-04-24: [implementation] Added release automation contracts, PostgreSQL state/store, shared release service, root `pnpm release:cell` CLI, protected Operator API/RBAC, deterministic smoke reset coverage and linked evidence-root configuration without adding a second deployment stack.
- 2026-04-24: [implementation] [runtime realignment] Made host-only smoke/rollback executors explicit on the CLI path and fail-closed by default in the container Operator API runtime; added release-control audit migration coverage and terminal fail-closed rollback/evidence behavior for post-start deploy failures.
