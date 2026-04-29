---
id: F-0028
title: Support / operability contract и incident discipline
status: proposed
coverage_gate: deferred
backlog_item_key: CF-026
owners: ["@codex"]
area: operations
depends_on: ["F-0013", "F-0023", "F-0024", "F-0026"]
impacts: ["operations", "support", "incident-response", "observability", "release"]
created: 2026-04-29
updated: 2026-04-29
links:
  issue: ""
  pr: []
  docs:
    - "README.md"
    - "docs/architecture/system.md"
    - "docs/polyphony_concept.md"
    - "docs/notes/backlog-legacy/feature-candidates.md"
    - "docs/notes/backlog-legacy/working-system-roadmap-matrix-2026-03-26.md"
    - "docs/ssot/features/F-0013-operator-http-api-and-introspection.md"
    - "docs/ssot/features/F-0023-observability-and-diagnostic-reporting.md"
    - "docs/ssot/features/F-0024-authentication-authorization-operator-rbac.md"
    - "docs/ssot/features/F-0026-deploy-release-automation-rollback-orchestration.md"
---

## 1. Context & Goal

- **Backlog handoff:**
  - Backlog item key: CF-026
  - Backlog delivery state at intake: defined
  - Source traceability:
    - docs/architecture/system.md
    - docs/polyphony_concept.md
    - docs/notes/backlog-legacy/feature-candidates.md
    - docs/notes/backlog-legacy/working-system-roadmap-matrix-2026-03-26.md
  - Known blockers at intake:
    - none recorded
  - Known dependencies at intake:
    - CF-009
    - CF-015
    - CF-024
    - CF-025
- **User problem:** The working-system roadmap now has delivered operator API, observability/reporting, operator auth/RBAC and deploy/release/rollback automation owners, but supportability is still only implicit. Without `CF-026`, runbooks, incident taxonomy, escalation discipline, support evidence and operational ownership remain tribal knowledge around technical surfaces, so the system can be technically assembled without being operationally supportable.
- **Goal:** Open one canonical feature owner for the support / operability contract and incident discipline seam. The feature must shape how support runbooks consume canonical owner surfaces from operator API, observability reports, auth/RBAC and release automation; how incidents are classified and evidenced; which recovery or escalation actions stay human-only; and which actions route through existing canonical control seams.
- **Non-goals:** This feature does not reimplement operator routes (`F-0013`), observability/report materialization (`F-0023`), auth/RBAC (`F-0024`) or release/rollback orchestration (`F-0026`). It does not create shadow operational state, duplicate governor/perimeter ownership, bypass incident evidence, or implement runtime code during intake.
- **Current substrate / baseline:** `F-0013` owns bounded operator API and introspection, `F-0023` owns read-only diagnostic/report evidence, `F-0024` owns operator identity and RBAC, and `F-0026` owns deploy/release/rollback orchestration facts. Architecture and roadmap sources require `CF-026` to stay a consumer of those canonical surfaces rather than a parallel control layer.

## 2. Scope

### In scope

- Durable intake of `CF-026` as `F-0028` and preservation of the single backlog-item handoff.
- Initial owner boundary for support runbooks, incident taxonomy, on-call/operator procedures, support evidence and operational ownership.
- Explicit consumer relationship to canonical operator API, reporting, auth/RBAC and deploy/release/rollback owners.
- Shaping input for recovery and escalation boundaries, including which actions are human-only and which must route through existing owner seams.

### Out of scope

- Changing backlog truth beyond the intake lifecycle actualization from `defined` to `intaken`.
- Creating a shadow control plane, support-specific source of operational truth, or direct write path into governor, perimeter, release or reporting surfaces.
- Reowning `F-0013`, `F-0023`, `F-0024` or `F-0026` behavior.
- Implementing code, migrations, CI changes, runtime startup behavior, support tooling or incident automation during intake.

### Constraints

- Preserve `one feature = one backlog item`: `F-0028` maps only to `CF-026`.
- Keep support/operability as a consumer of canonical owner surfaces from boot/runtime, reporting, operator API, auth and deployment automation.
- Future shaping must explicitly define incident classes, escalation paths, runbook boundaries, support evidence sources and recovery-action ownership.
- Any future runtime/startup/deployment behavior change must follow the root quality gate order and the containerized smoke path when applicable.
- Before entering `spec-compact` or `plan-slice`, perform the repo-required Plan mode assessment from `ADR-2026-03-23-plan-mode-decision-gate.md`.

### Assumptions (optional)

- `CF-009`, `CF-015`, `CF-024` and `CF-025` are sufficiently delivered for intake because their canonical feature owners exist and `CF-026` is downstream of their surfaces.
- `feature-intake` records the owner boundary only; requirements, ACs, runbook taxonomy and verification obligations remain deferred to `spec-compact`.

### Open questions (optional)

- Which first incident classes are mandatory for the initial support contract.
- Which recovery actions must remain human-only versus owner-routed through operator/release/governor seams.
- Which support evidence bundle is sufficient for close-out without raw foreign table reads or ad hoc logs.

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

- Backlog item key: CF-026
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Issue:
- PRs:

## 11. Change log

- 2026-04-29: Initial dossier created from backlog item `CF-026` at backlog delivery state `defined`.
