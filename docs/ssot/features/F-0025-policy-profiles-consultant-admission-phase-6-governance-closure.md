---
id: F-0025
title: Policy profiles, consultant admission и phase-6 governance closure
status: proposed
coverage_gate: deferred
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

- Backlog item key: CF-027
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Issue:
- PRs:

## 11. Change log

- 2026-04-24: Initial dossier created from backlog item `CF-027` at backlog delivery state `defined`.
