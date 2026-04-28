---
id: F-0027
title: Специализированные органы и политика вывода из эксплуатации
status: done
coverage_gate: strict
backlog_item_key: CF-019
owners: ["@codex"]
area: models
depends_on: ["F-0014", "F-0015", "F-0016", "F-0020", "F-0026"]
impacts: ["models", "runtime", "workshop", "governance", "release"]
created: 2026-04-28
updated: 2026-04-28
links:
  issue: ""
  pr: []
  docs:
    - "README.md"
    - "docs/architecture/system.md"
    - "docs/polyphony_concept.md"
    - "docs/notes/backlog-legacy/feature-candidates.md"
    - "docs/notes/backlog-legacy/working-system-roadmap-matrix-2026-03-26.md"
    - "docs/ssot/features/F-0014-expanded-model-ecology-and-registry-health.md"
    - "docs/ssot/features/F-0015-workshop-datasets-training-eval-and-promotion.md"
    - "docs/ssot/features/F-0016-development-governor-and-change-management.md"
    - "docs/ssot/features/F-0020-real-vllm-serving-and-promotion-model-dependencies.md"
    - "docs/ssot/features/F-0026-deploy-release-automation-rollback-orchestration.md"
    - "docs/adr/ADR-2026-03-23-plan-mode-decision-gate.md"
    - "docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md"
    - "docs/adr/ADR-2026-03-19-phase0-deployment-cell.md"
---

## 1. Context & Goal

- **Backlog handoff:**
  - Backlog item key: CF-019
  - Backlog delivery state at intake: defined
  - Source traceability:
    - docs/architecture/system.md
    - docs/polyphony_concept.md
    - docs/notes/backlog-legacy/feature-candidates.md
    - docs/notes/backlog-legacy/working-system-roadmap-matrix-2026-03-26.md
  - Known blockers at intake:
    - none recorded
  - Known dependencies at intake:
    - CF-010
    - CF-011
    - CF-016
    - CF-023
    - CF-025
- **User problem:** After richer model ecology, workshop candidate lifecycle, real `vLLM` serving, governor gates and release automation are delivered, the repository still lacks one canonical owner for specialist-organ admission into live use and later retirement. Without `CF-019`, specialist candidates can be confused with ordinary richer profiles, workshop stages can be misread as live rollout authority, and degraded specialists can drift into hidden fallback, stale traffic or ad hoc retirement.
- **Goal:** Define the canonical `F-0027` owner for specialist-organ rollout and retirement policy. The feature must turn specialist candidates prepared by `F-0015` into explicitly admitted, staged, rollback-ready organ usage through `F-0016` governor evidence, `F-0020` real-serving readiness, `F-0014` registry/health source state and `F-0026` release evidence. It must also define durable retirement decisions that preserve history and route away from degraded, stale or unproven specialists.
- **Non-goals:** This feature does not build datasets, training runs, eval runs or promotion packages (`F-0015`); does not replace real-serving readiness or artifact materialization (`F-0020`); does not reopen baseline router selection/admission invariants or richer registry ownership (`F-0008` / `F-0014`); does not execute governor approval (`F-0016`); does not deploy releases or rollbacks (`F-0026`); does not introduce a second model-serving stack, second specialist-only promotion state machine, hidden model registry or public unauthenticated route.
- **Current substrate / baseline:** `F-0014` owns richer model registry/health/fallback source surfaces; `F-0015` owns workshop datasets, training/eval, candidate lifecycle and promotion-package projection; `F-0016` owns governor proposal/decision/freeze evidence; `F-0020` owns real-serving readiness and promoted serving dependencies; `F-0026` owns release/deploy/rollback orchestration. `F-0027` is the missing policy overlay that composes those seams for specialist rollout and retirement.

## 2. Scope

### In scope

- Canonical owner for specialist-organ rollout and retirement policy facts for `CF-019`.
- Specialist-specific admission policy over workshop `specialist_candidate` evidence, governor approval, serving readiness, release evidence, health state and rollback target.
- Staged rollout policy that extends the existing workshop lifecycle semantics instead of replacing them:
  - `candidate`
  - `shadow`
  - `limited-active`
  - `active`
  - `stable`
  - `retiring`
  - `retired`
- Specialist organ identity and policy metadata needed for live admission:
  - task signature / governed scope
  - specialist role or capability
  - linked workshop candidate / promotion package
  - linked model profile / serving dependency
  - predecessor and rollback target
  - rollout stage and traffic limit
  - admission, health and retirement evidence refs
- Retirement decisions for degraded, stale, cost-ineffective, unsafe, rollback-triggered or no-longer-useful specialist organs.
- Explicit fallback/refusal semantics for specialist selection and admission, preserving the delivered `selection != admission` invariant.
- Bounded read-only consumption of neighbouring owner evidence from `F-0014`, `F-0015`, `F-0016`, `F-0020` and `F-0026`.
- Verification requirements that prove no specialist path can become live without required evidence, no hidden fallback/remap is introduced and retired specialists cannot keep receiving traffic.

### Out of scope

- Creating or changing workshop datasets, training runs, eval runs, candidate lifecycle source rows or promotion-package generation. Those remain `F-0015`.
- Replacing or mutating richer model registry/health/fallback ownership outside the `F-0014` owner boundary.
- Reopening baseline model router selection semantics, baseline continuity pointers or the delivered separation between model selection and runtime admission.
- Replacing the real-serving path, artifact materialization, readiness probe or promoted-serving dependency rules from `F-0020`.
- Executing governor approvals, freeze/thaw behavior, proposal lifecycle or public governor route semantics from `F-0016`.
- Deploying releases, executing rollback, defining release environments or storing release state from `F-0026`.
- Introducing a second Compose stack, specialist-only serving runtime, shadow model registry, shadow workshop lifecycle or filesystem-only live-state file.
- Treating a specialist organ as personality, identity-bearing state or a second subject.

### Constraints

- Preserve `one feature = one backlog item`: `F-0027` maps only to `CF-019`.
- Specialist models are cognitive organs, not subjects. They may never own identity continuity, memory truth, biography, governor authority or release authority.
- No specialist may receive live traffic unless the current admission evidence includes:
  - a workshop promotion package or equivalent `F-0015` candidate evidence;
  - a positive `F-0016` governor decision for the target scope;
  - `F-0020` real-serving readiness for the referenced service/artifact identity;
  - `F-0026` release evidence for the deployed runtime path when rollout changes live behavior;
  - an explicit predecessor or rollback target.
- `shadow` execution has no decision authority over user/runtime outcomes. It may collect comparison evidence only.
- `limited-active` execution must be bounded by an explicit traffic or task-scope limit.
- Fallback must be explicit and auditable. Missing, unhealthy, retired or policy-forbidden specialist paths return structured refusal or route to a declared fallback; silent remap is forbidden.
- Retirement must be durable and non-destructive: history, evidence and rollback refs stay queryable after the organ stops being eligible.
- Any future runtime/startup/deployment effect must run the repo quality gates and applicable container smoke path before implementation closure.
- If specification or planning reveals a missing prerequisite owner or cross-feature write authority, use the unified backlog/change-proposal path before continuing.

### Assumptions (optional)

- The dependencies recorded for `F-0027` are delivered enough for specification: `F-0014`, `F-0015`, `F-0016`, `F-0020` and `F-0026` are already `done` in the SSOT index.
- `F-0015` already preserves generic candidate lifecycle semantics for future specialist candidates; `F-0027` adds specialist rollout/retirement policy rather than a new training pipeline.
- Specialist profile creation can use existing richer model profile and serving-dependency identities through owner-bounded adapters. Exact table names and module names remain plan-slice decisions.
- Operator-facing inspection or action routes are optional. If added later, they must stay inside the existing protected operator boundary and delegate semantics to owner services.

### Open questions (optional)

- None after `plan-slice`.
- Resolved by `plan-slice`: first implementation uses one `specialist-policy` owner surface across contracts, DB store and core runtime service.
- Resolved by `plan-slice`: repo-level ADR is still not required before implementation; one is required only if implementation changes router selection/admission invariants outside the feature-local policy gate, introduces a new deployment/model-serving stack or changes cross-feature write ownership.
- Resolved by `plan-slice`: protected side-effect preset applies to live specialist admission and retirement planning because implementation gates runtime use, consumes release/rollback evidence and accepts caller-controlled policy commands, even though `F-0027` does not execute deploy or rollback itself.

## 3. Requirements & Acceptance Criteria (SSoT)

### Terms & thresholds

- `specialist organ`: a non-identity-bearing model/profile/service capability admitted for a narrow task signature because it is measurably better, cheaper, safer or more stable for that task than the general organ path.
- `specialist candidate`: a workshop-prepared candidate whose dataset, training/eval evidence, artifact URI, predecessor and rollback target are owned by `F-0015`.
- `specialist admission`: the runtime decision that a specialist may be used for one governed task scope at the current rollout stage. Admission is separate from router selection.
- `rollout policy`: durable policy that names allowed stage, task signature, traffic limit, health/eval thresholds, fallback and required evidence.
- `retirement decision`: durable decision that removes a specialist from eligible routing/admission while preserving the evidence and historical lineage.
- `fallback target`: explicit predecessor or stable organ/profile used when a specialist is unavailable, degraded, retired or policy-forbidden.

### Policy decisions

- **PD-F0027-01:** `F-0027` owns specialist rollout/admission/retirement policy facts only. It composes neighbouring owner evidence but does not seize workshop, registry, serving, governor or release source ownership.
- **PD-F0027-02:** Specialist rollout extends the `F-0015` candidate lifecycle. It must not create a second specialist-only promotion state machine or reinterpret workshop `active`/`stable` evidence as live traffic authority by itself.
- **PD-F0027-03:** Live specialist usage requires explicit admission after router selection. A selected specialist is not executable until the policy service confirms stage, evidence, health, rollout limit and fallback readiness.
- **PD-F0027-04:** `shadow` specialists may run only for comparison/evaluation and cannot determine runtime outcomes.
- **PD-F0027-05:** `limited-active`, `active` and `stable` specialists require a current rollback target and current health/readiness evidence. Missing evidence fails closed before live use.
- **PD-F0027-06:** Retirement is an append-only policy decision, not deletion. Retired specialists remain visible in lineage, reports and rollback analysis but are not eligible for normal selection/admission.
- **PD-F0027-07:** A feature-local decision log is sufficient for this spec. A repo-level ADR is required only if implementation changes router selection/admission invariants, creates a new model lifecycle state machine, changes boot-critical dependency policy or grants `F-0027` write authority over neighbouring owner surfaces.

### Acceptance criteria

- **AC-F0027-01:** `F-0027` is the only canonical owner for specialist-organ rollout policy facts.
- **AC-F0027-02:** `F-0027` is the only canonical owner for specialist admission decision facts.
- **AC-F0027-03:** `F-0027` is the only canonical owner for specialist retirement decision facts.
- **AC-F0027-04:** A specialist cannot receive live traffic without a positive `F-0016` governor decision for the target scope.
- **AC-F0027-05:** A specialist cannot receive live traffic unless `F-0020` reports real-serving readiness for the referenced service/artifact identity.
- **AC-F0027-06:** A rollout change that affects live runtime behavior requires linked `F-0026` release evidence.
- **AC-F0027-07:** `shadow` specialists have zero live decision authority.
- **AC-F0027-08:** `limited-active` specialists are refused after the declared traffic limit.
- **AC-F0027-09:** Live specialist admission requires current health evidence.
- **AC-F0027-10:** Live specialist admission requires an explicit rollback target.
- **AC-F0027-11:** Retired specialists are ineligible for normal admission.
- **AC-F0027-12:** Silent specialist remap is forbidden.
- **AC-F0027-13:** `F-0027` must not create a shadow model registry.
- **AC-F0027-14:** `F-0027` must not mutate `F-0015` workshop source truth.
- **AC-F0027-15:** `F-0027` must not mutate `F-0016` governor source truth.
- **AC-F0027-16:** `F-0027` must not mutate `F-0026` release source truth.
- **AC-F0027-17:** Implementation tests prove refusal when required upstream evidence is missing.
- **AC-F0027-18:** Implementation introduces no second deployment stack.
- **AC-F0027-19:** Implementation introduces no specialist-only registry.

## 4. Non-functional requirements (NFR)

- **Admission safety:** Unauthorized live specialist calls budget: `0`.
- **Rollback preparedness:** Live specialist admissions without predecessor or rollback target budget: `0`.
- **Hidden fallback budget:** Silent specialist remap or undeclared fallback budget: `0`.
- **Retirement completeness:** `100%` of retirement decisions preserve trigger, evidence refs, previous rollout stage, replacement/fallback target and decision timestamp.
- **Owner-boundary safety:** Direct writes from `F-0027` implementation into workshop, governor, release, model-serving readiness or unrelated registry owner tables budget: `0`.
- **Observability:** Every live admission, refusal and retirement decision is reconstructable from PostgreSQL state plus linked evidence refs without relying on operator memory or raw logs.
- **Operational degradation:** Missing or stale upstream evidence degrades/refuses only the affected specialist path; it must not fabricate readiness or block unrelated baseline organs.

## 5. Design (compact)

### 5.1 API surface

- Primary surface is an internal specialist policy service used by model routing/admission and rollout automation:
  - evaluate specialist eligibility for a task signature;
  - record rollout-stage decision;
  - record specialist admission/refusal decision;
  - record retirement decision;
  - inspect current specialist lineage and fallback.
- If operator-facing endpoints are introduced later, they must live under the existing protected operator namespace, require caller admission/RBAC, and delegate to the same specialist policy service.
- No public unauthenticated specialist activation, retirement, registry mutation or deployment route is allowed.

### 5.2 Runtime / deployment surface

- The first implementation stays inside the existing `apps/core` runtime and PostgreSQL state kernel.
- Specialist serving uses existing local model services and promoted serving-dependency rules from `F-0020`; this feature does not add a new serving stack.
- Specialist rollout may change runtime admission behavior, so implementation closure must include root quality gates and applicable smoke evidence.
- Model router selection remains separate from specialist admission. Router may propose a specialist candidate, but `F-0027` policy decides whether it may execute.
- Release/deploy effects are routed through `F-0026`; `F-0027` records policy/admission/retirement facts and evidence links, not deployment execution.

### 5.3 Data model changes

Exact table/module names are planning choices, but implementation must preserve these semantic surfaces:

- `specialist_organs`: specialist identity, task signature, capability, linked model profile/serving dependency, linked workshop candidate, predecessor, rollback target, current stage and status reason.
- `specialist_rollout_policies`: governed scope, allowed stage, traffic/task limit, required evidence classes, health/eval thresholds and fallback target.
- `specialist_rollout_events`: append-only stage transitions with actor/source, governor evidence, workshop evidence, serving readiness, release evidence and reason codes.
- `specialist_admission_decisions`: per-request or per-window allow/deny/refusal records with task signature, selected specialist, stage, evidence refs and refusal/fallback reason.
- `specialist_retirement_decisions`: append-only retirement records with trigger kind, prior stage, replacement/fallback target, evidence refs and decision timestamp.

These surfaces are specialist policy truth only. Workshop lifecycle truth, richer registry source state, serving readiness, governor decisions and release state remain with their owners.

### 5.4 Edge cases and failure modes

- Workshop candidate exists but required eval evidence is absent.
- Governor proposal is missing, denied, stale or unavailable.
- Serving dependency is unavailable, degraded, transport-only or artifact-mismatched.
- Release evidence is missing for a rollout that changes live behavior.
- Specialist has no predecessor or rollback target.
- Specialist is selected by router but admission policy refuses it.
- `limited-active` traffic or task-scope limit is exceeded.
- Specialist health regresses while in `limited-active`, `active` or `stable`.
- Retirement decision is recorded while in-flight requests still reference the specialist.
- Fallback target is missing, unhealthy, retired or policy-forbidden.
- Duplicate rollout or retirement request is replayed.
- Concurrent rollout and retirement requests target the same specialist.
- Operator-facing action is attempted without caller admission or required role.

### 5.5 Verification surface / initial verification plan

- Contract tests for specialist organ, rollout policy, rollout event, admission decision and retirement decision shapes.
- DB integration tests for append-only rollout/retirement history, idempotent replay, conflicting replay and concurrent transition handling.
- Runtime/admission tests proving selection does not imply admission.
- Negative tests for missing workshop evidence, missing governor approval, missing serving readiness, missing release evidence, missing rollback target, unhealthy specialist and retired specialist.
- Router/fallback tests proving no silent remap and structured refusal when no declared fallback is eligible.
- Boundary tests proving no direct writes to `F-0015`, `F-0016`, `F-0020`, `F-0026` source surfaces and no shadow registry.
- Smoke coverage when implementation materially changes runtime admission, release activation or deployment behavior.
- Dossier verification during `plan-slice`: `dossier-engineer dossier-verify --step plan-slice --dossier docs/ssot/features/F-0027-specialist-organs-rollout-retirement-policy.md`.
- Dossier verification during `implementation`: `dossier-engineer dossier-verify --step implementation --dossier docs/ssot/features/F-0027-specialist-organs-rollout-retirement-policy.md`.

### 5.6 Representation upgrades (triggered only when needed)

- Feature-local ADR blocks in this dossier are enough for the policy overlay boundary.
- Repo-level ADR is triggered if implementation changes router selection/admission invariants, creates a second model lifecycle state machine, promotes a new boot-critical service, introduces a new public route family, changes release/deployment contracts or grants `F-0027` direct write authority over neighbouring owner surfaces.
- Backlog actualization is expected for `CF-019` from `specified` to `planned` when this `plan-slice` closes.

### 5.7 Definition of Done

- `F-0027` owns durable specialist rollout/admission/retirement policy facts.
- Specialist live use is impossible without workshop evidence, governor approval, real-serving readiness, release evidence when live rollout changes, current health and explicit rollback target.
- `shadow`, `limited-active`, `active`, `stable`, `retiring` and `retired` semantics are implemented without replacing `F-0015` candidate lifecycle truth.
- Retired specialists are no longer eligible for normal selection/admission, while lineage and evidence remain queryable.
- Fallback/refusal behavior is explicit, audited and tested.
- Owner-boundary tests prove neighbouring source surfaces remain read-only or owner-adapted.
- `dossier-verify`, required external `spec-conformance-reviewer`, implementation review stack and local quality/smoke gates are green for the relevant stage.

### 5.8 Rollout / activation note (triggered only when needed)

- First activation should support `shadow` specialists only, collecting comparison evidence without affecting runtime outcomes.
- Next activation may allow a tightly bounded `limited-active` policy for one narrow task signature.
- `active` and `stable` rollout require current health/eval evidence, rollback target and release evidence.
- Retirement rollout starts by refusing new admissions, then drains in-flight use, records replacement/fallback target and keeps historical evidence.
- Any emergency rollback must use the explicit predecessor/rollback target; ad hoc fallback selection during failure handling is forbidden.

## 6. Slicing plan (2–6 increments)

### Implementation boundary for plan-slice

- **Execution target:** deliver one production-ready `specialist-policy` seam that persists specialist rollout/admission/retirement policy facts, evaluates specialist admission after router selection, refuses missing or stale upstream evidence, and records append-only retirement decisions without adding a second model registry, serving stack, workshop lifecycle or release executor.
- The first implementation lives inside the existing `apps/core` runtime and PostgreSQL state kernel. It may add new contracts, DB tables/store, a runtime service and tests, but it must not create a second deployment stack or a specialist-only serving runtime.
- The implementation agent must land contracts and store before runtime/router admission wiring. Runtime admission may consume read-only evidence from `F-0014`, `F-0015`, `F-0016`, `F-0020` and `F-0026`; writes to those owner surfaces remain forbidden.
- Operator-facing routes are not required for the first implementation. If the implementer adds them, they must stay inside the existing protected Operator API namespace, use `F-0024` caller admission/RBAC and delegate to the same `specialist-policy` service.
- Exact file names may change only if the semantic owner boundary, coverage map and single policy-service call path remain intact.

### Protected side-effect preset

This plan declares the protected side-effect preset because specialist admission changes live runtime eligibility, retirement can stop future live use, and policy commands contain caller-controlled scope/evidence refs.

- **Reservation before side effect:** rollout/admission/retirement records must be persisted before any live specialist execution is considered admitted. `F-0027` must never execute release, deploy or rollback actions directly.
- **Idempotent replay behavior:** rollout, admission and retirement commands use stable request ids or deterministic decision keys; equivalent replay returns the existing decision and conflicting replay is rejected before writing a new terminal fact.
- **Terminal CAS / no terminal overwrite:** terminal retirement and refusal facts are append-only. A retired specialist cannot be silently overwritten back to `active` or `stable`; any future reactivation requires a new governed rollout decision with fresh evidence.
- **Strict caller input:** task signatures, stages, traffic limits, evidence refs, fallback refs and specialist ids must be schema-validated and bounded. No raw SQL, filesystem path, environment variable or deployment command may be caller-controlled through this feature.
- **Live-vs-stale running behavior:** admission checks current health/readiness/governor/release evidence at decision time. In-flight work records the decision snapshot; new admissions after retirement or stale evidence must refuse or use an explicitly declared fallback.

### SL-F0027-01: Specialist contracts and policy store

- **Result:** shared specialist policy contracts, PostgreSQL migration/store and append-only data surfaces for specialist organs, rollout policies, rollout events, admission decisions and retirement decisions.
- **Primary files:** `packages/contracts/src/specialists.ts`, `packages/contracts/package.json`, `packages/db/src/specialists.ts`, `packages/db/src/index.ts`, `infra/migrations/027_specialist_policy.sql`.
- **Tests:** `packages/contracts/test/specialists.contract.test.ts`, `packages/db/test/specialists/specialist-policy-store.integration.test.ts`.
- **Coverage map:** section 8 rows list the planned AC-to-test references for this slice.
- Depends on: delivered `F-0014` model registry identity vocabulary, delivered `F-0015` specialist candidate/promotion-package vocabulary and delivered PostgreSQL migration substrate; owner `@codex`; unblock condition: contracts/store tests prove append-only policy truth, request replay semantics and terminal retirement constraints before runtime admission wiring starts.
- **Unblock condition:** contract and DB tests prove the policy store can persist/query rollout, admission and retirement facts without writing workshop, governor, release or model-serving owner tables.

### SL-F0027-02: Policy service and upstream evidence gates

- **Result:** core `specialist-policy` service that evaluates workshop promotion evidence, governor approval evidence, serving readiness, health state, release evidence and fallback/rollback target before returning allow/refuse decisions.
- **Primary files:** `apps/core/src/runtime/specialist-policy.ts`, `apps/core/src/runtime/index.ts`, `apps/core/src/platform/core-runtime.ts`, `apps/core/src/runtime/model-ecology.ts`, `apps/core/src/workshop/service.ts`, `apps/core/src/runtime/development-governor.ts`, `apps/core/src/platform/release-automation.ts`.
- **Tests:** `apps/core/test/runtime/specialist-policy-service.contract.test.ts`, `apps/core/test/models/specialist-upstream-evidence.integration.test.ts`, `apps/core/test/models/specialist-missing-evidence.contract.test.ts`.
- **Coverage map:** section 8 rows list the planned AC-to-test references for this slice.
- Depends on: `SL-F0027-01`, delivered `F-0015` promotion package refs, delivered `F-0016` proposal/decision refs, delivered `F-0020` serving dependency state and delivered `F-0026` release evidence refs; owner `@codex`; unblock condition: read-only evidence adapters can classify required evidence as present/current or missing/stale without foreign writes.
- **Unblock condition:** service tests prove all required upstream evidence gates fail closed and record structured refusal reasons before router integration starts.

### SL-F0027-03: Router admission integration and no-remap behavior

- **Result:** specialist admission hook after model-router selection, preserving `selection != admission`, enforcing `shadow`/`limited-active` semantics and preventing silent fallback/remap.
- **Primary files:** `apps/core/src/runtime/model-router.ts`, `apps/core/src/runtime/tick-runtime.ts`, `apps/core/src/cognition/decision-harness.ts`, `apps/core/src/runtime/specialist-policy.ts`, `apps/core/testing/tick-runtime-harness.ts`.
- **Tests:** `apps/core/test/models/specialist-admission.integration.test.ts`, `apps/core/test/models/specialist-no-remap.contract.test.ts`, `apps/core/test/runtime/tick-specialist-admission.integration.test.ts`.
- **Coverage map:** section 8 rows list the planned AC-to-test references for this slice.
- Depends on: `SL-F0027-01`, `SL-F0027-02` and delivered baseline router invariants from `F-0008`; owner `@codex`; unblock condition: the router can propose a specialist while the policy service remains the only authority that admits or refuses execution.
- **Unblock condition:** runtime tests prove `shadow` specialists have zero live decision authority, `limited-active` traffic/task limits are enforced and no hidden fallback occurs when admission refuses.

### SL-F0027-04: Retirement, concurrency and lineage

- **Result:** retirement decision path that refuses new admissions, preserves lineage/evidence, handles replay/conflict/concurrency and keeps retired specialists queryable but ineligible.
- **Primary files:** `packages/contracts/src/specialists.ts`, `packages/db/src/specialists.ts`, `apps/core/src/runtime/specialist-policy.ts`, `apps/core/src/runtime/model-router.ts`.
- **Tests:** `apps/core/test/models/specialist-retirement.integration.test.ts`, `apps/core/test/models/specialist-lineage.contract.test.ts`, `packages/db/test/specialists/specialist-policy-store.integration.test.ts`.
- **Coverage map:** section 8 rows list the planned AC-to-test references for this slice.
- Depends on: `SL-F0027-01` through `SL-F0027-03`; owner `@codex`; unblock condition: retirement can be recorded without deleting policy, candidate, registry, release or governor evidence.
- **Unblock condition:** tests prove retired specialists are ineligible for new admissions, replay is idempotent, conflicting concurrent transition fails closed and lineage remains queryable.

### SL-F0027-05: Owner-boundary hardening, docs and final verification

- **Result:** owner-boundary tests, deployment-stack boundary tests, documentation/config updates when needed, final AC coverage, root quality gates and container smoke proof for runtime-affecting changes.
- **Primary files:** `apps/core/src/runtime/specialist-policy.ts`, `apps/core/src/runtime/model-router.ts`, `apps/core/src/platform/operator-api.ts` if routes are added, `README.md`, `.env.example`, `docs/ssot/features/F-0027-specialist-organs-rollout-retirement-policy.md`.
- **Tests:** `apps/core/test/models/specialist-owner-boundary.contract.test.ts`, `apps/core/test/models/specialist-deployment-boundary.contract.test.ts`, `apps/core/test/models/specialist-registry-boundary.contract.test.ts`.
- **Coverage map:** section 8 rows list the planned AC-to-test references for this slice.
- Depends on: `SL-F0027-01` through `SL-F0027-04`; owner `@codex`; unblock condition: all source/test/runtime changes are visible and owner-boundary audit tests can assert no shadow registry, second deployment stack or foreign source writes.
- **Unblock condition:** root `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test` and applicable `pnpm smoke:cell` pass, or a truthful blocker is recorded before implementation closure.

### Plan-slice commitments

- **PL-F0027-01:** `SL-F0027-01` lands first so policy facts, append-only semantics, idempotency and terminal retirement constraints are explicit before runtime behavior changes.
- **PL-F0027-02:** `SL-F0027-02` lands before router admission so missing/stale upstream evidence fails closed in one service instead of being distributed across router branches.
- **PL-F0027-03:** `SL-F0027-03` may not blur selection/admission. The model router may nominate a specialist, but policy service admission is the only live-use gate.
- **PL-F0027-04:** `SL-F0027-04` records retirement as append-only policy truth and never deletes or rewrites workshop, registry, governor, serving or release evidence.
- **PL-F0027-05:** `SL-F0027-05` is last because owner-boundary proof, docs and smoke are only truthful after contracts, store, service, admission and retirement behavior exist.

### Planned implementation order

1. Add specialist policy contracts, package export, migration and DB store.
2. Add the specialist policy service and read-only upstream evidence gates.
3. Wire policy admission after router selection and prove no-remap behavior.
4. Add retirement, replay/conflict/concurrency handling and lineage queries.
5. Add owner-boundary/deployment-boundary hardening, docs, final coverage refs, root quality gates and smoke proof.

## 7. Task list (implementation units)

- **T-F0027-01** (`SL-F0027-01`): Add `@yaagi/contracts/specialists` stage, policy, admission and retirement schemas.
- **T-F0027-02** (`SL-F0027-01`): Add PostgreSQL migration/store for specialist organs, rollout policies, rollout events, admission decisions and retirement decisions.
- **T-F0027-03** (`SL-F0027-01`): Add request replay/conflict handling and append-only terminal retirement constraints in the store.
- **T-F0027-04** (`SL-F0027-02`): Add specialist policy service evidence adapters for workshop promotion package, governor approval, serving readiness, release evidence and health.
- **T-F0027-05** (`SL-F0027-02`): Add structured refusal records for missing, stale, denied, unhealthy or rollback-target-missing evidence.
- **T-F0027-06** (`SL-F0027-03`): Wire specialist admission after router selection without making selection itself an execution grant.
- **T-F0027-07** (`SL-F0027-03`): Enforce `shadow` zero-authority and `limited-active` traffic/task limits.
- **T-F0027-08** (`SL-F0027-03`): Add explicit fallback/refusal behavior and tests proving no silent remap.
- **T-F0027-09** (`SL-F0027-04`): Add retirement command/decision path that refuses future admission while preserving prior evidence and lineage.
- **T-F0027-10** (`SL-F0027-04`): Add concurrent rollout/retirement and conflicting replay tests.
- **T-F0027-11** (`SL-F0027-05`): Add owner-boundary tests proving no direct writes to `F-0015`, `F-0016`, `F-0020`, `F-0026` source surfaces and no shadow registry.
- **T-F0027-12** (`SL-F0027-05`): Update docs/config/coverage map and run root quality gates plus `pnpm test` and applicable `pnpm smoke:cell` before implementation closure.

Implementation status: all tasks above were delivered during the `implementation` step.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0027-01 | `packages/contracts/test/specialists.contract.test.ts`; `packages/db/test/specialists/specialist-policy-store.integration.test.ts`; `apps/core/test/models/specialist-owner-boundary.contract.test.ts` | covered |
| AC-F0027-02 | `apps/core/test/runtime/specialist-policy-service.contract.test.ts`; `apps/core/test/models/specialist-admission.integration.test.ts` | covered |
| AC-F0027-03 | `packages/db/test/specialists/specialist-policy-store.integration.test.ts`; `apps/core/test/models/specialist-retirement.integration.test.ts` | covered |
| AC-F0027-04 | `apps/core/test/models/specialist-upstream-evidence.integration.test.ts`; `apps/core/test/models/specialist-missing-evidence.contract.test.ts` | covered |
| AC-F0027-05 | `apps/core/test/models/specialist-upstream-evidence.integration.test.ts`; `apps/core/test/runtime/specialist-policy-service.contract.test.ts` | covered |
| AC-F0027-06 | `apps/core/test/models/specialist-upstream-evidence.integration.test.ts`; `apps/core/test/models/specialist-missing-evidence.contract.test.ts` | covered |
| AC-F0027-07 | `apps/core/test/models/specialist-admission.integration.test.ts`; `apps/core/test/runtime/tick-specialist-admission.integration.test.ts` | covered |
| AC-F0027-08 | `apps/core/test/models/specialist-admission.integration.test.ts`; `apps/core/test/runtime/tick-specialist-admission.integration.test.ts` | covered |
| AC-F0027-09 | `apps/core/test/runtime/specialist-policy-service.contract.test.ts`; `apps/core/test/models/specialist-missing-evidence.contract.test.ts` | covered |
| AC-F0027-10 | `packages/contracts/test/specialists.contract.test.ts`; `apps/core/test/models/specialist-admission.integration.test.ts`; `apps/core/test/models/specialist-retirement.integration.test.ts` | covered |
| AC-F0027-11 | `packages/db/test/specialists/specialist-policy-store.integration.test.ts`; `apps/core/test/models/specialist-retirement.integration.test.ts` | covered |
| AC-F0027-12 | `apps/core/test/models/specialist-no-remap.contract.test.ts`; `apps/core/test/models/specialist-admission.integration.test.ts` | covered |
| AC-F0027-13 | `apps/core/test/models/specialist-registry-boundary.contract.test.ts`; `apps/core/test/models/specialist-owner-boundary.contract.test.ts` | covered |
| AC-F0027-14 | `apps/core/test/models/specialist-owner-boundary.contract.test.ts`; `apps/core/test/models/specialist-upstream-evidence.integration.test.ts` | covered |
| AC-F0027-15 | `apps/core/test/models/specialist-owner-boundary.contract.test.ts`; `apps/core/test/models/specialist-upstream-evidence.integration.test.ts` | covered |
| AC-F0027-16 | `apps/core/test/models/specialist-owner-boundary.contract.test.ts`; `apps/core/test/models/specialist-upstream-evidence.integration.test.ts` | covered |
| AC-F0027-17 | `apps/core/test/models/specialist-missing-evidence.contract.test.ts`; `apps/core/test/runtime/specialist-policy-service.contract.test.ts` | covered |
| AC-F0027-18 | `apps/core/test/models/specialist-deployment-boundary.contract.test.ts`; applicable `pnpm smoke:cell` implementation evidence | covered |
| AC-F0027-19 | `apps/core/test/models/specialist-registry-boundary.contract.test.ts`; `apps/core/test/models/specialist-owner-boundary.contract.test.ts` | covered |

## 9. Decision log (ADR blocks)

### ADR-F0027-01: Specialist rollout is a policy overlay, not a second workshop lifecycle

- Date: 2026-04-28
- Status: Accepted for this dossier
- Context: `F-0015` already owns candidate lifecycle, stage events and promotion-package projection, including future specialist candidates.
- Decision: `F-0027` owns live specialist rollout/admission/retirement policy over that evidence. It does not clone dataset/training/eval/candidate source truth or create a specialist-only state machine beside `F-0015`.
- Consequence: Implementation must link to workshop evidence and preserve `F-0015` as source owner; rollout/retirement state stays a policy overlay with explicit evidence refs.

### ADR-F0027-02: Specialist selection remains separate from admission

- Date: 2026-04-28
- Status: Accepted for this dossier
- Context: Baseline and richer model routing already require explicit fallback/refusal and separation between model selection and runtime admission.
- Decision: A router-selected specialist is only a candidate for execution. `F-0027` admission must verify stage, evidence, health, rollout limit and fallback before live use.
- Consequence: Missing, stale, retired or policy-forbidden specialist paths fail closed with structured refusal or declared fallback; silent remap remains forbidden.

### 2026-04-28: Plan-slice Plan mode assessment

- Decision: Plan mode was not required before this `plan-slice`.
- Rationale: `spec-compact` already fixed the owner boundary, dependencies and non-goals. The remaining decision is implementation sequencing over one accepted `specialist-policy` surface, with no open operator choice, no repo-level ADR trigger and no competing deployment or serving topology.
- ADR impact: feature-local planning decision; normal dossier verification, backlog actualization and independent review remain required.

### 2026-04-28: Specialist policy owner module

- Decision: first implementation plans one `specialist-policy` owner module across contracts, DB store and core runtime service.
- Rationale: one owner module keeps rollout/admission/retirement facts testable and prevents specialist policy from splitting between router branches, workshop lifecycle rows and release evidence.
- ADR impact: feature-local decision; repo-level ADR remains required only if implementation changes shared router invariants outside the feature-local admission gate or changes cross-feature write ownership.

### 2026-04-28: Protected side-effect preset

- Decision: protected side-effect preset applies to implementation planning for live specialist admission and retirement.
- Rationale: even without executing deploy/rollback, `F-0027` gates live model use, consumes release/rollback evidence and accepts caller-controlled policy/evidence refs.
- ADR impact: feature-local implementation discipline; no repo-level ADR unless implementation introduces a new executor, serving stack or release/deployment authority.

## 10. Progress & links

- Backlog item key: CF-019
- Status progression: `proposed -> shaped -> planned -> implemented -> done`
- Current stage: `implementation closure`
- Issue:
- PRs:

## 11. Change log

- 2026-04-28: Initial dossier created from backlog item `CF-019` at backlog delivery state `defined`.
- 2026-04-28: `spec-compact` shaped specialist rollout/retirement as a policy overlay over workshop, governor, real-serving and release evidence; backlog actualization to `specified` is required before truthful step closure.
- 2026-04-28: [plan-slice] [dependency realignment] Planned implementation slices across specialist contracts/store, upstream evidence gates, router admission integration, retirement/lineage and owner-boundary/smoke closure, with backlog lifecycle target `planned`.
- 2026-04-28: [implementation] Delivered specialist policy contracts, PostgreSQL policy store/migration, admission and retirement runtime service, router admission hook, fail-closed upstream evidence gates, append-only lineage/replay behavior and owner/deployment/registry boundary tests without adding a second serving stack or hidden registry.
