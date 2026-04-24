---
id: F-0025
title: Policy profiles, consultant admission и phase-6 governance closure
status: shaped
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

## 6. Slicing plan (2–6 increments)

- **SL-F0025-01: Policy profile store and activation contract**
  - Depends on: delivered `F-0016`, `F-0018`, `F-0024`; owner `@codex`; unblock condition: append-only profile activation can fail closed without changing neighbouring owners.
  - Result: versioned profiles, activation decisions, exclusivity checks and structured ambiguity refusal.
- **SL-F0025-02: Consultant admission and structured refusal**
  - Depends on: `SL-F0025-01`, delivered `F-0008`; owner `@codex`; unblock condition: consultant path cannot execute without policy admission and audit persistence.
  - Result: explicit allow/deny/refusal decisions, health/evidence refs and no silent remap/fallback coverage.
- **SL-F0025-03: Perception policy enforcement**
  - Depends on: `SL-F0025-01`, delivered `F-0005`; owner `@codex`; unblock condition: policy decisions reference canonical `StimulusEnvelope` / `stimulus_inbox`.
  - Result: accepted/degraded/refused/human-gated perception-policy decisions without a second intake layer.
- **SL-F0025-04: Owner-boundary and evidence composition**
  - Depends on: delivered `F-0016`, `F-0018`, `F-0023`, `F-0024`; owner `@codex`; unblock condition: read-only evidence consumption and reportable governance decision facts are stable.
  - Result: boundary tests, bounded phase-6 governance events and observability consumption contracts.
- **SL-F0025-05: Activation hardening and rollback**
  - Depends on: all prior slices; owner `@codex`; unblock condition: activation/deactivation is auditable and rollback preserves history.
  - Result: conservative activation path, rollback semantics and end-to-end negative coverage.

## 7. Task list (implementation units)

- **T-F0025-01** (`SL-F0025-01`): Define policy-profile domain types, persistence and activation exclusivity checks. Covers: AC-F0025-01, AC-F0025-02, AC-F0025-03.
- **T-F0025-02** (`SL-F0025-02`): Implement consultant admission service with explicit allow/deny/refusal and audit persistence. Covers: AC-F0025-04, AC-F0025-05, AC-F0025-13.
- **T-F0025-03** (`SL-F0025-02`): Wire admission to router boundary without changing router ownership. Covers: AC-F0025-06, AC-F0025-07.
- **T-F0025-04** (`SL-F0025-03`): Implement perception-policy decisions over canonical `StimulusEnvelope` / `stimulus_inbox` refs. Covers: AC-F0025-08.
- **T-F0025-05** (`SL-F0025-04`): Compose read-only evidence from `F-0024`, `F-0016`, `F-0018`, `F-0023`, `F-0008` and `F-0005`. Covers: AC-F0025-09, AC-F0025-10, AC-F0025-11, AC-F0025-14.
- **T-F0025-06** (`SL-F0025-05`): Add conservative rollout/rollback controls and no-new-dependency checks. Covers: AC-F0025-12.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0025-01 | Policy profile ownership/domain contract tests | planned |
| AC-F0025-02 | Policy profile version/status tests | planned |
| AC-F0025-03 | Policy activation append-only/exclusivity tests | planned |
| AC-F0025-04 | Consultant admission pre-invocation contract tests | planned |
| AC-F0025-05 | Consultant refusal/no-call negative tests | planned |
| AC-F0025-06 | Router selection/admission separation integration tests | planned |
| AC-F0025-07 | No silent remap/fallback contract tests | planned |
| AC-F0025-08 | Perception policy canonical intake integration tests | planned |
| AC-F0025-09 | Human-gate evidence composition tests | planned |
| AC-F0025-10 | Perimeter evidence read-only boundary tests | planned |
| AC-F0025-11 | Governance event/report consumption tests | planned |
| AC-F0025-12 | No new boot/deploy dependency tests or static checks | planned |
| AC-F0025-13 | Consultant failure-mode negative coverage | planned |
| AC-F0025-14 | Owner-boundary integration/static tests | planned |

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
- Status progression: `proposed -> shaped`
- Issue:
- PRs:

## 11. Change log

- 2026-04-24: Initial dossier created from backlog item `CF-027` at backlog delivery state `defined`.
- 2026-04-24 [spec-compact] [scope realignment]: Shaped `F-0025` as the mature phase-6 policy/admission owner without reowning governor, perimeter, router, perception, observability, auth, release or support seams.
