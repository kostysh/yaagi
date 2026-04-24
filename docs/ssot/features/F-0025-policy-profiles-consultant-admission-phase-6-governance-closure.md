---
id: F-0025
title: Policy profiles, consultant admission и phase-6 governance closure
status: done
coverage_gate: strict
backlog_item_key: CF-027
owners: ["@codex"]
area: governance
depends_on: ["F-0005", "F-0008", "F-0016", "F-0018", "F-0023", "F-0024"]
impacts: ["governance", "policy", "runtime", "perception", "models"]
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
  - Backlog item key: CF-027
  - Backlog delivery state at intake: defined
  - Source traceability:
    - docs/architecture/system.md
    - docs/polyphony_concept.md
    - docs/notes/backlog-legacy/feature-candidates.md
    - docs/notes/backlog-legacy/working-system-roadmap-matrix-2026-03-26.md
  - Known blockers at intake:
    - none recorded
  - Known dependencies at intake:
    - CF-004
    - CF-006
    - CF-014
    - CF-015
    - CF-016
    - CF-024
- **User problem:** Phase 6 promises policy profiles, optional external consultants, richer perception policies, stronger human gates and mature managed autonomy. Without `CF-027`, those late-governance surfaces stay spread across the minimal governor, perimeter hardening, router, perception and observability owners, so the system has no single place to decide consultant admission, policy-profile activation, perception-policy boundaries or structured refusal for mature autonomy.
- **Goal:** Open one canonical feature owner for `CF-027` that will shape mature phase-6 governance orchestration without reopening earlier runtime ownership. The feature must preserve explicit admission and structured refusal semantics for consultant/perception paths, define how policy profiles consume existing governor/perimeter/auth/router/perception evidence, and keep hidden remaps, silent consultant fallback and side-channel routing out of scope.
- **Non-goals:** This feature does not reimplement the minimal development governor (`CF-016` / `F-0016`), mature perimeter hardening (`CF-014` / `F-0018`), baseline router internals (`CF-006` / `F-0008`), perception-buffer implementation (`CF-004` / `F-0005`), observability reports (`CF-015` / `F-0023`), operator auth/RBAC (`CF-024` / `F-0024`), deploy/release automation (`CF-025`) or support/incident discipline (`CF-026`). It does not introduce runtime code during intake.
- **Current substrate / baseline:** `F-0005` owns delivered perception buffer and sensor-adapter baseline, `F-0008` owns delivered model-router/profile invariants and explicit selection/admission separation, `F-0016` owns delivered development-governor gates, `F-0018` owns delivered security/perimeter hardening, `F-0023` owns delivered observability/diagnostic evidence, and `F-0024` owns delivered operator caller admission/RBAC.

## 2. Scope

### In scope

- Durable intake of `CF-027` as `F-0025` and preservation of the single backlog-item handoff.
- Initial mature-governance boundary for policy profiles, consultant admission, richer perception policies and remaining phase-6 governance closure.
- Explicit separation from the minimal governor, perimeter hardening and router internals that already have delivered owners.
- Shaping input for consultant/perception admission and refusal semantics: every consultant path must be explicitly admitted or rejected, never reached by silent fallback, hidden remap or side-channel routing.
- Shaping input for policy-profile consumption of existing evidence from governor, perimeter, operator auth, router, perception and observability owners.
- Identification of open decisions that may need ADR or backlog actualization during later `spec-compact` / change-proposal work.

### Out of scope

- Changing backlog truth during intake; `CF-027` has no recorded blockers and no intake follow-up is required.
- Reowning `F-0016` development ledger, freeze/proposal state, owner gates or governor writes.
- Reowning `F-0018` safety kernel, secret hygiene, restricted shell, egress controls or general perimeter decisions.
- Replacing `F-0008` routing internals, model health registry, organ selection logic or fallback implementation.
- Implementing new sensor adapters, perception buffers, observability reports or diagnostic endpoints owned by `F-0005` and `F-0023`.
- Changing `F-0024` principal, credential, role or route-permission contracts.
- Delivering deploy/release/rollback automation (`CF-025`) or support/incident runbooks (`CF-026`).

### Constraints

- Preserve `one feature = one backlog item`: `F-0025` maps only to `CF-027`.
- Keep policy-profile and consultant-admission shaping on top of delivered owner surfaces instead of duplicating their state machines.
- Preserve explicit admission/refusal for external consultant and perception-policy paths.
- Before entering `spec-compact` or `plan-slice`, perform the repo-required Plan mode assessment from `ADR-2026-03-23-plan-mode-decision-gate.md`.
- If shaping changes backlog truth or introduces a new owner need, return through the unified backlog/change-proposal path instead of editing scope silently.

### Assumptions (optional)

- The listed prerequisites are delivered enough for intake: `CF-004`, `CF-006`, `CF-014`, `CF-015`, `CF-016` and `CF-024` are `implemented` in backlog state.

### Open questions (optional)

- What is the minimal policy-profile vocabulary for phase-6 governance?
- Which runtime/config/API surface should expose consultant admission decisions?
- Which perception-policy controls belong in `CF-027` versus remaining implementation detail under `F-0005`?
- Does consultant admission or policy-profile activation require a new ADR during `spec-compact`?
- What evidence from `F-0016`, `F-0018`, `F-0023` and `F-0024` is sufficient for stronger human gates?

## 3. Requirements & Acceptance Criteria (SSoT)

### Terms & thresholds

- `policy profile`: versioned governance posture that selects named policy rules for consultant admission, perception-policy enforcement, stronger human gates and phase-6 autonomy limits. It is not a model profile and does not select an organ directly.
- `policy activation`: append-only decision to make one policy-profile version active for a bounded scope. Activation is a governance decision, not a router decision.
- `consultant admission`: explicit allow/deny decision for any external consultant path before model/router invocation. An absent, ambiguous, stale or degraded decision is a structured refusal.
- `perception policy`: rules over canonical `StimulusEnvelope` / `stimulus_inbox` inputs that decide whether a source, priority, immediate-tick request or richer adapter path is accepted, degraded or refused.
- `structured refusal`: machine-readable refusal with reason code, source policy/profile version, evidence refs and target path. A fallback without an explicit refusal or admission event is a bug.

### Policy decisions

- **PD-F0025-01:** `F-0025` owns mature phase-6 policy orchestration facts only: policy profiles, activation decisions, consultant admission decisions, perception-policy decisions and phase-6 governance readiness evidence.
- **PD-F0025-02:** `F-0025` consumes delivered evidence from `F-0005`, `F-0008`, `F-0016`, `F-0018`, `F-0023` and `F-0024`; it does not write their source tables, route handlers, router internals, perimeter policy or governor decisions.
- **PD-F0025-03:** External consultant paths are opt-in. Missing policy profile, missing admission decision, unavailable audit persistence, unavailable caller-admission evidence or unavailable human-gate evidence must refuse the path before invocation.
- **PD-F0025-04:** Perception-policy enforcement extends the canonical perception intake contract; it must not create a second durable raw-event store, shadow perception buffer or adapter-specific long-lived storage.
- **PD-F0025-05:** A feature-local ADR is sufficient for this spec. A repo-level ADR is required only if implementation later changes cross-feature write ownership, boot dependencies or the canonical perception/router contracts.

### Acceptance criteria

- **AC-F0025-01:** `F-0025` is the only canonical owner for phase-6 policy-profile definitions, policy activation decisions, consultant admission decisions and richer perception-policy decisions.
- **AC-F0025-02:** Every active policy profile is versioned, has an explicit status (`draft`, `active`, `retired`, `blocked`), names its governed scopes and records the evidence required for activation.
- **AC-F0025-03:** Policy activation is append-only and records actor/evidence refs, target profile version, scope, decision, reason code and activation/deactivation timestamps.
- **AC-F0025-04:** Any external consultant invocation must pass an explicit consultant-admission decision before router/model invocation.
- **AC-F0025-05:** Consultant admission denial, missing admission state, unsupported consultant kind, unhealthy consultant path or unavailable audit storage produces a structured refusal and no consultant call.
- **AC-F0025-06:** Consultant admission preserves `F-0008` selection/admission separation: router selection may identify an eligible profile/path, but `F-0025` policy admission decides whether the phase-6 path may execute.
- **AC-F0025-07:** No implementation path may silently remap a consultant/perception request to a different model profile, local organ or side-channel route without a recorded admission or refusal event.
- **AC-F0025-08:** Perception policies apply to canonical `StimulusEnvelope` / `stimulus_inbox` inputs and may classify accepted, degraded, refused or human-gated intake without introducing a second durable intake layer.
- **AC-F0025-09:** Stronger human-gate checks consume `F-0024` caller-admission/RBAC evidence and `F-0016` governor evidence; missing or insufficient evidence refuses activation or execution without direct governor writes.
- **AC-F0025-10:** Perimeter/security evidence is consumed read-only from `F-0018`; `F-0025` must not implement safety-kernel, restricted-shell, egress or secret-hygiene policy.
- **AC-F0025-11:** Observability/reporting consumers can read bounded phase-6 governance evidence, but `F-0023` remains the report-materialization owner and `F-0025` remains the decision-fact owner.
- **AC-F0025-12:** `F-0025` introduces no new boot-critical service, model-serving dependency, gateway, release path or support/runbook owner.
- **AC-F0025-13:** The implementation must include negative coverage proving no consultant path executes on missing policy profile, missing admission, unsupported consultant kind, unhealthy consultant path, stale evidence or unavailable audit persistence.
- **AC-F0025-14:** The implementation must include integration coverage proving policy activation and consultant/perception refusal decisions are auditable and consume existing owner evidence without writing neighbouring owner surfaces.

## 4. Non-functional requirements (NFR)

- **Fail-closed policy determinism:** ambiguous policy-profile, consultant-admission or perception-policy decisions budget: `0`.
- **No hidden routing:** silent consultant fallback, hidden profile remap and side-channel routing budget: `0`.
- **Audit completeness:** `100%` of policy activation, consultant admission and perception-policy enforcement decisions must write a durable decision event or return a structured unavailable/refusal result before side effects.
- **Owner-boundary preservation:** `F-0025` code must not write to governor, perimeter, auth, router, perception source, report source or deployment/release tables owned by neighbouring features.
- **Operational degradation:** if an upstream evidence source is unavailable, only the affected policy/admission decision degrades; the runtime must not fabricate proxy evidence or silently reuse stale facts.

## 5. Design (compact)

### 5.1 API surface

- Primary API surface is internal service/module APIs consumed by runtime/router/perception/governor integration points.
- If operator-facing endpoints are required, they must live under the existing `F-0013` Hono operator namespace, be protected by `F-0024` caller admission/RBAC and delegate high-risk activation through `F-0016` owner gates.
- No new gateway, public consultant endpoint or direct route around `F-0013` / `F-0024` is allowed.

### 5.2 Runtime / deployment surface

- Runs inside the existing `apps/core` runtime on the canonical `Node.js 22 + TypeScript + Hono + PostgreSQL` deployment cell.
- Uses PostgreSQL for durable policy/admission facts.
- Adds no new container, network, boot dependency, model server or release/deploy path.
- External consultant endpoints, when configured, are optional phase-6 resources and never become boot-critical.

### 5.3 Data model changes

- Exact names are planning/implementation choices, but the implementation must preserve these semantic surfaces:
  - `policy_profiles`: versioned profile identity, status, governed scopes and activation requirements.
  - `policy_profile_activations`: append-only activation/deactivation decisions with actor/evidence refs and reason codes.
  - `consultant_admission_decisions`: explicit allow/deny/refusal decisions for consultant paths, including consultant kind, target scope, profile version, health/evidence refs and refusal reason.
  - `perception_policy_decisions`: accepted/degraded/refused/human-gated decisions over canonical `StimulusEnvelope` / `stimulus_inbox` references.
  - `phase6_governance_events`: bounded decision facts that observability/reporting can consume without becoming a writer.
- These surfaces are source truth for `F-0025` only; neighbouring features may consume them read-only through bounded APIs or reports.

### 5.4 Edge cases and failure modes

- Missing active policy profile: structured refusal for governed phase-6 path.
- Multiple active profiles for the same exclusive scope: fail closed and require operator/governor resolution.
- Unavailable consultant health or endpoint: structured refusal; no fallback to another consultant or local organ unless an explicit policy permits and records it.
- Unavailable audit persistence: refuse policy activation and consultant execution before side effects.
- Stale `F-0024`, `F-0016`, `F-0018` or `F-0023` evidence: degrade/refuse the affected decision, not the whole runtime.
- Unsupported perception source/policy: preserve canonical `stimulus_inbox` intake truth and record policy refusal/degraded classification rather than dropping or rewriting input silently.

### 5.5 Verification surface / initial verification plan

- Unit tests for policy-profile resolution, activation exclusivity, status transitions and fail-closed ambiguity handling.
- Contract tests for consultant admission allow/deny/refusal, including no call on missing profile, missing admission, unhealthy path, unsupported consultant kind and unavailable audit persistence.
- Integration tests proving `F-0008` selection/admission separation is preserved and hidden remaps/fallbacks are rejected.
- Integration tests proving perception policies reference canonical `StimulusEnvelope` / `stimulus_inbox` inputs without a second durable intake layer.
- Boundary tests proving `F-0025` does not write neighbouring owner surfaces (`F-0005`, `F-0008`, `F-0016`, `F-0018`, `F-0023`, `F-0024`).
- Dossier verification: `dossier-engineer dossier-verify --step spec-compact --dossier docs/ssot/features/F-0025-policy-profiles-consultant-admission-phase-6-governance-closure.md`.

### 5.6 Representation upgrades (triggered only when needed)

- Feature-local ADR blocks are sufficient for the policy/admission/refusal boundary in this dossier.
- A repo-level ADR is triggered only if implementation proposes new cross-feature write authority, new boot-critical dependencies, a new public gateway, a second perception intake store or a change to baseline router selection/admission invariants.

### 5.7 Definition of Done

- Policy profile, activation, consultant admission and perception-policy decision semantics are implemented on the canonical runtime path.
- External consultant execution is impossible without explicit admission and durable decision evidence.
- Structured refusal covers missing, ambiguous, stale, unhealthy and unsupported policy paths.
- Existing owner boundaries are preserved and proven by tests.
- `dossier-verify`, required external `spec-conformance-reviewer`, implementation review stack and local quality gates are green for the relevant stage.

### 5.8 Rollout / activation note (triggered only when needed)

- First activation should ship a conservative baseline policy profile with external consultant execution disabled.
- Next activation may enable audit-only/dry-run consultant admission decisions without executing consultant calls.
- Enforcement activation should require `F-0024` caller admission, `F-0016` governor evidence and `F-0018` perimeter evidence before any high-risk policy profile can become active.
- Rollback is profile deactivation to the previous active policy version; rollback must not delete decision history.

## 6. Slicing plan (2-6 increments)

### Execution target

The implementation agent must deliver one complete phase-6 governance policy seam inside the existing `apps/core` runtime. A successful implementation means policy profiles and activations are durable, consultant execution cannot happen without explicit admission, perception-policy decisions are recorded against canonical intake references, and neighbouring owners are consumed only through read-only evidence or bounded service contracts.

### Completion recognition

Implementation is complete when:

- `F-0025` owns new policy-governance contracts, PostgreSQL tables/stores and runtime service APIs for policy profiles, activations, consultant admission, perception-policy decisions and phase-6 governance events;
- a conservative baseline policy profile exists with external consultant execution disabled by default;
- policy activation is append-only, exclusive per governed scope and refuses ambiguous or unavailable evidence before changing active posture;
- consultant-admission checks run before any consultant client invocation and produce structured refusal on missing profile, missing admission, unsupported consultant kind, unhealthy consultant path, stale evidence or unavailable audit persistence;
- perception-policy enforcement records accepted/degraded/refused/human-gated decisions against canonical `StimulusEnvelope` / `stimulus_inbox` references without creating a shadow durable intake layer;
- read-only evidence from `F-0024`, `F-0016`, `F-0018`, `F-0023`, `F-0008` and `F-0005` is composed without direct writes to neighbouring owner surfaces;
- no new boot-critical service, gateway, container, model-serving dependency, release path or support/runbook owner is introduced;
- root `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm smoke:cell` are green before implementation closure because this feature changes runtime decision behavior and persistence.

### Implementation boundaries

- Do not put policy profiles into `model_registry` or make `F-0008` router selection own policy activation.
- Do not add a second gateway, public consultant endpoint or HTTP namespace outside the existing `F-0013` operator boundary.
- Do not add operator-facing activation routes unless they are protected by `F-0024` caller admission and delegate high-risk activation checks through `F-0016`.
- Do not make external consultant configuration boot-critical; unavailable consultants must degrade to structured refusal.
- Do not persist raw consultant prompts, credentials, bearer tokens or reusable external endpoint secrets in governance events.
- Do not write `stimulus_inbox` replacement tables, shadow perception buffers or adapter-specific durable raw-event stores.
- Do not write governor, perimeter, auth/RBAC, router, perception-source, reporting, deployment/release or support/incident source tables directly from `F-0025` code.
- Do not let policy-profile activation imply router admission, governor approval, perimeter clearance or operator authorization by itself.

### SL-F0025-01: Contracts, migration and policy-profile store

- **Result:** shared policy-governance contracts, migration-owned tables, DB store and conservative baseline profile seed for profiles, activations, consultant admission decisions, perception-policy decisions and phase-6 governance events.
- **Primary files:** `packages/contracts/src/policy-governance.ts`, `packages/contracts/src/index.ts`, `packages/db/src/policy-governance.ts`, `packages/db/src/index.ts`, `infra/migrations/021_policy_governance.sql`.
- **Tests:** `packages/contracts/test/policy-governance.contract.test.ts`, `packages/db/test/policy-governance-store.integration.test.ts`.
- **Covers:** AC-F0025-01, AC-F0025-02, AC-F0025-03, AC-F0025-11, AC-F0025-12.
- Depends on: delivered `F-0016`, `F-0018`, `F-0024` evidence vocabulary and existing PostgreSQL migration path; owner `@codex`; unblock condition: policy tables can be added without mutating neighbouring owner tables.
- **Unblock condition:** contract/store tests prove status vocabulary, versioning, append-only activation and exclusive active scope behavior before runtime service wiring starts.

### SL-F0025-02: Runtime policy activation and evidence gate service

- **Result:** `PolicyGovernanceService` that resolves active profiles, records activation/deactivation decisions, enforces evidence requirements, refuses ambiguity/unavailable audit storage and exposes bounded read APIs for later consultant/perception slices.
- **Primary files:** `apps/core/src/runtime/policy-governance.ts`, `apps/core/src/platform/core-runtime.ts`, `apps/core/src/platform/core-config.ts`, `packages/contracts/src/policy-governance.ts`.
- **Tests:** `apps/core/test/runtime/policy-governance-service.contract.test.ts`, `apps/core/test/platform/policy-governance-config.contract.test.ts`.
- **Covers:** AC-F0025-02, AC-F0025-03, AC-F0025-09, AC-F0025-10, AC-F0025-12.
- Depends on: `SL-F0025-01`, `F-0024` caller evidence, `F-0016` governor evidence and `F-0018` perimeter evidence; owner `@codex`; unblock condition: profile activation can be evaluated from read-only evidence without new public routes.
- **Unblock condition:** missing profile, duplicate active profile, missing evidence, stale evidence and unavailable audit persistence all fail closed before changing active policy state.

### SL-F0025-03: Consultant admission and router-boundary no-remap guarantees

- **Result:** consultant-admission service and router-boundary adapter that require explicit allow/deny/refusal before any optional consultant client call, while preserving `F-0008` selection/admission separation and forbidding silent local/remapped fallback.
- **Primary files:** `apps/core/src/runtime/policy-governance.ts`, `apps/core/src/runtime/model-router.ts`, `packages/contracts/src/models.ts`, `packages/contracts/src/policy-governance.ts`.
- **Tests:** `apps/core/test/models/consultant-admission.integration.test.ts`, `apps/core/test/models/consultant-no-remap.contract.test.ts`, `apps/core/test/models/model-router.contract.test.ts`.
- **Covers:** AC-F0025-04, AC-F0025-05, AC-F0025-06, AC-F0025-07, AC-F0025-13.
- Depends on: `SL-F0025-02` and delivered `F-0008`; owner `@codex`; unblock condition: router can ask policy governance for admission without becoming the writer of policy decisions.
- **Unblock condition:** tests prove no consultant client is invoked when profile, admission, consultant kind, health, evidence or audit storage is missing/unavailable.

### SL-F0025-04: Perception-policy enforcement over canonical intake

- **Result:** perception-policy decision flow that classifies canonical `StimulusEnvelope` / `stimulus_inbox` references as accepted, degraded, refused or human-gated, while preserving `F-0005` intake ownership and avoiding a second durable raw-event layer.
- **Primary files:** `apps/core/src/perception/controller.ts`, `apps/core/src/perception/index.ts`, `packages/contracts/src/perception.ts`, `packages/contracts/src/policy-governance.ts`, `packages/db/src/policy-governance.ts`.
- **Tests:** `apps/core/test/perception/perception-policy.integration.test.ts`, `apps/core/test/perception/perception-policy-boundary.contract.test.ts`, `packages/db/test/perception-store.integration.test.ts`.
- **Covers:** AC-F0025-08, AC-F0025-11, AC-F0025-14.
- Depends on: `SL-F0025-02` and delivered `F-0005`; owner `@codex`; unblock condition: policy decisions can reference existing intake identifiers without writing a replacement intake surface.
- **Unblock condition:** unsupported source/policy and human-gated/degraded decisions are auditable, and `stimulus_inbox` remains the canonical durable intake source.

### SL-F0025-05: Owner-boundary hardening, reporting projection and activation closure

- **Result:** boundary/static tests, bounded phase-6 governance event projections for `F-0023` consumers, conservative activation/deactivation rollback checks, docs/config updates and final smoke evidence.
- **Primary files:** `apps/core/src/runtime/policy-governance.ts`, `apps/core/src/runtime/reporting.ts`, `packages/contracts/src/reporting.ts`, `README.md`, `docs/ssot/features/F-0025-policy-profiles-consultant-admission-phase-6-governance-closure.md`.
- **Tests:** `apps/core/test/runtime/policy-governance-boundary.contract.test.ts`, `apps/core/test/runtime/phase6-governance-events.integration.test.ts`, `apps/core/test/runtime/reporting-service.integration.test.ts`.
- **Covers:** AC-F0025-09, AC-F0025-10, AC-F0025-11, AC-F0025-12, AC-F0025-14.
- Depends on: all prior slices plus delivered `F-0023`; owner `@codex`; unblock condition: source facts exist and can be consumed by reporting without giving reporting write authority.
- **Unblock condition:** root quality gates and `pnpm smoke:cell` pass, or a truthful blocker is recorded before implementation closure.

### Plan-slice commitments

- **PL-F0025-01:** `SL-F0025-01` lands first so policy/admission/refusal vocabulary is shared and persistence is explicit before runtime code starts.
- **PL-F0025-02:** `SL-F0025-02` lands before consultant or perception wiring because both depend on active profile resolution, evidence checks and durable decision audit.
- **PL-F0025-03:** `SL-F0025-03` is isolated from perception work because it composes with `F-0008` and must prove router selection does not become policy admission.
- **PL-F0025-04:** `SL-F0025-04` is isolated because it touches `F-0005` intake boundaries and must prove no second durable intake layer appears.
- **PL-F0025-05:** `SL-F0025-05` is last because reporting projection, boundary scans, docs, rollback evidence and smoke are only truthful after all decision surfaces exist.

### Planned implementation order

1. Add policy-governance contracts, migration, DB store and conservative baseline profile seed.
2. Add runtime policy-governance service with activation/evidence/refusal semantics.
3. Add consultant-admission checks at the router boundary and no-remap/no-call negative coverage.
4. Add perception-policy classification over canonical intake references.
5. Add boundary/reporting projection checks, docs, final coverage references and smoke evidence.

## 7. Task list (implementation units)

- **T-F0025-01** (`SL-F0025-01`): Add `policy-governance` contract types for profile status, governed scope, activation decision, refusal reason, consultant admission, perception-policy decision and governance event payloads. Covers: AC-F0025-01, AC-F0025-02, AC-F0025-05, AC-F0025-08.
- **T-F0025-02** (`SL-F0025-01`): Add migration/store for policy profiles, activations, consultant admission decisions, perception-policy decisions and phase-6 governance events. Covers: AC-F0025-01, AC-F0025-02, AC-F0025-03, AC-F0025-11.
- **T-F0025-03** (`SL-F0025-01`): Seed or bootstrap one conservative baseline policy profile with consultant execution disabled and explicit governed scopes. Covers: AC-F0025-02, AC-F0025-12.
- **T-F0025-04** (`SL-F0025-02`): Implement runtime profile resolution, activation/deactivation, exclusive-scope checks and structured refusal for ambiguity/unavailable audit storage. Covers: AC-F0025-03, AC-F0025-09, AC-F0025-10.
- **T-F0025-05** (`SL-F0025-02`): Add read-only evidence adapters for `F-0024`, `F-0016`, `F-0018` and `F-0023` without direct neighbouring writes. Covers: AC-F0025-09, AC-F0025-10, AC-F0025-11, AC-F0025-14.
- **T-F0025-06** (`SL-F0025-03`): Implement consultant-admission service with explicit allow/deny/refusal, health/evidence refs and audit persistence. Covers: AC-F0025-04, AC-F0025-05, AC-F0025-13.
- **T-F0025-07** (`SL-F0025-03`): Wire consultant admission at the router boundary while preserving router selection/admission separation. Covers: AC-F0025-06, AC-F0025-07.
- **T-F0025-08** (`SL-F0025-04`): Implement perception-policy decisions over canonical `StimulusEnvelope` / `stimulus_inbox` refs. Covers: AC-F0025-08, AC-F0025-14.
- **T-F0025-09** (`SL-F0025-04`): Add refusal/degraded/human-gated perception-policy tests that prove no shadow intake store is introduced. Covers: AC-F0025-08, AC-F0025-11.
- **T-F0025-10** (`SL-F0025-05`): Add governance event projection and reporting consumption contracts without reporting write authority. Covers: AC-F0025-11, AC-F0025-14.
- **T-F0025-11** (`SL-F0025-05`): Add boundary/static checks for no writes to governor, perimeter, auth, router, perception source, reporting, deployment or support owner surfaces. Covers: AC-F0025-09, AC-F0025-10, AC-F0025-12, AC-F0025-14.
- **T-F0025-12** (`SL-F0025-05`): Update docs/coverage map and run root gates plus `pnpm smoke:cell` before implementation closure. Covers: AC-F0025-12, AC-F0025-13, AC-F0025-14.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0025-01 | `packages/contracts/test/policy-governance.contract.test.ts`; `packages/db/test/policy-governance-store.integration.test.ts` | implemented |
| AC-F0025-02 | `packages/contracts/test/policy-governance.contract.test.ts`; `apps/core/test/runtime/policy-governance-service.contract.test.ts` | implemented |
| AC-F0025-03 | `packages/db/test/policy-governance-store.integration.test.ts`; `apps/core/test/runtime/policy-governance-service.contract.test.ts` | implemented |
| AC-F0025-04 | `apps/core/test/models/consultant-admission.integration.test.ts`; `apps/core/test/runtime/policy-governance-service.contract.test.ts` | implemented |
| AC-F0025-05 | `apps/core/test/models/consultant-admission.integration.test.ts`; `apps/core/test/models/consultant-no-remap.contract.test.ts` | implemented |
| AC-F0025-06 | `apps/core/test/models/consultant-no-remap.contract.test.ts`; `apps/core/test/models/model-router.contract.test.ts` | implemented |
| AC-F0025-07 | `apps/core/test/models/consultant-no-remap.contract.test.ts`; `apps/core/test/models/consultant-admission.integration.test.ts` | implemented |
| AC-F0025-08 | `apps/core/test/perception/perception-policy.integration.test.ts`; `apps/core/test/perception/perception-policy-boundary.contract.test.ts` | implemented |
| AC-F0025-09 | `apps/core/test/runtime/policy-governance-service.contract.test.ts`; `apps/core/test/runtime/policy-governance-boundary.contract.test.ts` | implemented |
| AC-F0025-10 | `apps/core/test/runtime/policy-governance-boundary.contract.test.ts`; `apps/core/test/runtime/policy-governance-service.contract.test.ts` | implemented |
| AC-F0025-11 | `apps/core/test/runtime/phase6-governance-events.integration.test.ts`; `packages/contracts/test/reporting.contract.test.ts`; `packages/db/test/policy-governance-store.integration.test.ts` | implemented |
| AC-F0025-12 | `apps/core/test/platform/policy-governance-config.contract.test.ts`; `apps/core/test/runtime/policy-governance-boundary.contract.test.ts`; `pnpm smoke:cell` | implemented |
| AC-F0025-13 | `apps/core/test/models/consultant-admission.integration.test.ts`; `apps/core/test/models/consultant-no-remap.contract.test.ts` | implemented |
| AC-F0025-14 | `apps/core/test/runtime/policy-governance-boundary.contract.test.ts`; `apps/core/test/perception/perception-policy-boundary.contract.test.ts`; `packages/db/test/policy-governance-store.integration.test.ts` | implemented |

## 9. Decision log (ADR blocks)

### ADR-F0025-01: Policy profiles are governance policy, not model profiles

- Context: Architecture names policy profiles next to model profiles and optional consultants. Without separation, implementation could mutate router/model-profile ownership from this feature.
- Decision: `F-0025` policy profiles govern admission and execution conditions; `F-0008` / `F-0014` remain owners of model profile/registry source state.
- Alternatives: Store policy profile state inside `model_registry`; make router own policy activation.
- Consequences: Consultant/perception policy can mature without reopening delivered router invariants.

### ADR-F0025-02: Consultant admission is explicit and fail-closed

- Context: Phase-6 optional consultants are useful only if admission is observable and reversible. Silent fallback would hide autonomy expansion.
- Decision: Every consultant path requires explicit admission or structured refusal before invocation.
- Alternatives: Treat consultants as another router fallback; route to local organs when consultants are unavailable.
- Consequences: Unavailable consultants degrade as refusal, not as hidden remap.

### ADR-F0025-03: Perception policies extend canonical intake rather than creating a second intake layer

- Context: `ADR-2026-03-23-perception-intake-contract` makes `stimulus_inbox` the durable intake layer.
- Decision: `F-0025` perception policies classify/enforce over canonical `StimulusEnvelope` / `stimulus_inbox` references.
- Alternatives: Add a policy-specific raw-event journal or durable shadow buffer.
- Consequences: Richer phase-6 perception policy preserves `F-0005` ownership and downstream compatibility.

## 10. Progress & links

- Backlog item key: CF-027
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Current stage: `implementation`
- Issue:
- PRs:

## 11. Change log

- 2026-04-24: Initial dossier created from backlog item `CF-027` at backlog delivery state `defined`.
- 2026-04-24 [spec-compact] [scope realignment]: Shaped `F-0025` as the mature phase-6 policy/admission owner without reowning governor, perimeter, router, perception, observability, auth, release or support seams.
- 2026-04-24 [plan-slice] [dependency realignment]: Planned implementation slices across contracts, DB store, runtime policy service, consultant admission, perception-policy enforcement and owner-boundary/reporting closure, with backlog lifecycle target `planned`.
- 2026-04-24 [implementation] Delivered policy-governance contracts, PostgreSQL decision-fact tables/store, conservative baseline profile seeding, activation evidence gates, consultant admission-before-invocation, perception-policy classification over canonical intake and owner-boundary/reporting evidence tests without adding a boot-critical consultant dependency or new gateway.
