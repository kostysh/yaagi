---
id: F-0027
title: Специализированные органы и политика вывода из эксплуатации
status: shaped
coverage_gate: deferred
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

- None after `spec-compact`.

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
- Dossier verification during this step: `dossier-engineer dossier-verify --step spec-compact --dossier docs/ssot/features/F-0027-specialist-organs-rollout-retirement-policy.md`.

### 5.6 Representation upgrades (triggered only when needed)

- Feature-local ADR blocks in this dossier are enough for the policy overlay boundary.
- Repo-level ADR is triggered if implementation changes router selection/admission invariants, creates a second model lifecycle state machine, promotes a new boot-critical service, introduces a new public route family, changes release/deployment contracts or grants `F-0027` direct write authority over neighbouring owner surfaces.
- Backlog actualization is expected for `CF-019` from `defined` to `specified` when this `spec-compact` closes.

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

- Deferred to `plan-slice`.
- Required planning output:
  - one execution target for the first specialist policy seam;
  - 2-6 increments with primary files, tests, covered AC IDs, owner and unblock conditions;
  - explicit sequencing for contracts/store before runtime/router admission;
  - protected side-effect preset if implementation touches release, rollback, external executor, host/container boundary or caller-controlled input;
  - root quality gate and smoke obligations for runtime/deployment-affecting changes.

## 7. Task list (implementation units)

- Deferred to `plan-slice`.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0027-01 | Deferred to `plan-slice`; rollout owner-boundary tests must map this AC. | planned |
| AC-F0027-02 | Deferred to `plan-slice`; admission owner-boundary tests must map this AC. | planned |
| AC-F0027-03 | Deferred to `plan-slice`; retirement owner-boundary tests must map this AC. | planned |
| AC-F0027-04 | Deferred to `plan-slice`; governor-approval negative tests must map this AC. | planned |
| AC-F0027-05 | Deferred to `plan-slice`; serving-readiness negative tests must map this AC. | planned |
| AC-F0027-06 | Deferred to `plan-slice`; release-evidence negative tests must map this AC. | planned |
| AC-F0027-07 | Deferred to `plan-slice`; shadow-stage tests must map this AC. | planned |
| AC-F0027-08 | Deferred to `plan-slice`; limited-active boundary tests must map this AC. | planned |
| AC-F0027-09 | Deferred to `plan-slice`; health-evidence tests must map this AC. | planned |
| AC-F0027-10 | Deferred to `plan-slice`; rollback-target tests must map this AC. | planned |
| AC-F0027-11 | Deferred to `plan-slice`; retired-specialist tests must map this AC. | planned |
| AC-F0027-12 | Deferred to `plan-slice`; silent-remap tests must map this AC. | planned |
| AC-F0027-13 | Deferred to `plan-slice`; shadow-registry tests must map this AC. | planned |
| AC-F0027-14 | Deferred to `plan-slice`; `F-0015` boundary tests must map this AC. | planned |
| AC-F0027-15 | Deferred to `plan-slice`; `F-0016` boundary tests must map this AC. | planned |
| AC-F0027-16 | Deferred to `plan-slice`; `F-0026` boundary tests must map this AC. | planned |
| AC-F0027-17 | Deferred to `plan-slice`; upstream-evidence refusal tests must map this AC. | planned |
| AC-F0027-18 | Deferred to `plan-slice`; deployment-stack boundary tests must map this AC. | planned |
| AC-F0027-19 | Deferred to `plan-slice`; specialist-registry boundary tests must map this AC. | planned |

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

## 10. Progress & links

- Backlog item key: CF-019
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Issue:
- PRs:

## 11. Change log

- 2026-04-28: Initial dossier created from backlog item `CF-019` at backlog delivery state `defined`.
- 2026-04-28: `spec-compact` shaped specialist rollout/retirement as a policy overlay over workshop, governor, real-serving and release evidence; backlog actualization to `specified` is required before truthful step closure.
