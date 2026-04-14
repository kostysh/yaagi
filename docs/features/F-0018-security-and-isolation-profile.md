---
id: F-0018
title: Профиль безопасности и изоляции
status: proposed
coverage_gate: deferred
owners: ["@codex"]
area: safety
depends_on: ["F-0002", "F-0010", "F-0013", "F-0016", "F-0017"]
impacts: ["runtime", "infra", "governance", "api", "workspace", "network", "safety"]
created: 2026-04-14
updated: 2026-04-14
links:
  issue: ""
  pr: []
  docs:
    - "docs/architecture/system.md"
    - "docs/polyphony_concept.md"
    - "docs/backlog/feature-candidates.md"
    - "docs/backlog/working-system-roadmap-matrix-2026-03-26.md"
    - "docs/features/F-0002-canonical-monorepo-deployment-cell.md"
    - "docs/features/F-0010-executive-center-and-bounded-action-layer.md"
    - "docs/features/F-0013-operator-http-api-and-introspection.md"
    - "docs/features/F-0016-development-governor-and-change-management.md"
    - "docs/features/F-0017-git-managed-body-evolution-and-stable-snapshots.md"
    - "docs/adr/ADR-2026-03-19-phase0-deployment-cell.md"
    - "docs/adr/ADR-2026-03-19-canonical-runtime-toolchain.md"
    - "docs/adr/ADR-2026-03-19-quality-gate-sequence.md"
    - "docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md"
---

## 1. Context & Goal

- **Backlog handoff:**
  - Backlog item key: CF-014
  - Backlog delivery state at intake: defined
  - Source traceability:
    - docs/architecture/system.md
    - docs/polyphony_concept.md
    - docs/backlog/feature-candidates.md
    - docs/backlog/working-system-roadmap-matrix-2026-03-26.md
  - Known blockers at intake:
    - none recorded
  - Known dependencies at intake:
    - CF-020
    - CF-007
    - CF-012
    - CF-016
    - CF-024
- **User problem:** После delivery `F-0002`, `F-0010`, `F-0013`, `F-0016` и `F-0017` у системы уже есть baseline deployment cell, bounded action/body-evolution path, operator control routes и owner-routed governor evidence, но mature perimeter hardening остаётся распределённым между архитектурными заметками, частичными guardrails и backlog comments. Secrets policy, separately reviewable safety kernel, stronger human gates и restricted shell posture пока не имеют одного feature-owner-а, поэтому phase-6 security posture нельзя считать delivered, а высокорисковые действия всё ещё защищены в основном baseline-ограничениями.
- **Goal:** Зафиксировать один canonical dossier-owner для mature security/perimeter hardening, который владеет safety kernel, secrets policy, restricted shell hardening, stronger human gates и fail-closed perimeter rules поверх уже delivered runtime/governor/body seams, не переоткрывая ownership над platform substrate, auth/RBAC, release automation или late policy profiles. Этот seam hardens already-trusted control paths, but does not by itself make external operator exposure safe before `CF-024`.
- **Non-goals:** Этот dossier не переопределяет baseline deployment cell, networks, volumes и container posture из `F-0002` / `CF-020`; не реализует public authN/authZ / RBAC (`CF-024`); не забирает ownership у governor proposal lifecycle и broader policy-profile orchestration (`F-0016` / `CF-027`); не реализует deploy/release automation (`CF-025`), reporting ownership (`CF-015`) или body-evolution execution mechanics beyond their security boundaries (`F-0017`).
- **Current substrate / baseline:** `F-0002` already fixes the canonical `AI SDK + Hono + PostgreSQL` deployment cell with baseline container posture and volume/network policy; `F-0010` already owns bounded action/tool execution and escape-resistant workspace wrappers; `F-0013` already owns the operator-facing Hono route family; `F-0016` already owns freeze/proposal/evidence gates; `F-0017` already owns the Git/worktree body-evolution path and stable rollback evidence. `CF-014` must harden this delivered substrate instead of recreating it.

### Terms & thresholds

- `safety kernel`: отдельно ревьюируемый policy surface для forbidden actions, network rules, promotion gates и budget ceilings.
- `stronger human gate`: fail-closed контроль, который требует явного human approval для high-risk operations даже при наличии owner-routed execution seam.
- `perimeter hardening`: зрелые ограничения над operator/control surfaces, secrets handling, bounded shell/tool execution и network exposure без перехвата ownership у platform baseline.
- `trusted control path`: owner-routed control surface, которая уже прошла auth/RBAC and caller-identity checks in its own owner seam; `CF-014` may harden such a path, but may not replace `CF-024`.

## 2. Scope

### In scope

- Canonical owner for mature perimeter controls after the delivered phase-0 baseline:
  - safety kernel
  - secrets policy
  - restricted shell hardening
  - stronger human gates
- Fail-closed gate rules for already-trusted owner-routed control paths and internal high-risk actions, связанных с:
  - freeze development
  - force rollback
  - disable external network
  - require human review for promotions or equivalent high-risk changes
- Approval conditions and refusal semantics for rollback/network kill-switch request classes without taking ownership of rollback execution or network-actuation mechanics.
- Hardening contract для bounded execution и body-evolution surfaces, чтобы `F-0010` и `F-0017` исполняли high-risk actions только в рамках explicit mature safety policy, а не ad hoc guard checks.
- Secrets-handling and redaction rules across runtime, workshop, datasets, reports and generated artifacts.
- Explicit owner boundary between platform baseline posture and late perimeter/security work so future shaping does not reopen `F-0002`.

### Out of scope

- Baseline deployment cell, service topology, mounts, networks and default container posture already delivered by `F-0002` / `CF-020`.
- Public authN/authZ and operator RBAC, which remain `CF-024`.
- Policy profiles, consultant admission and remaining mature-governance orchestration, which remain `CF-027`.
- Deploy/release automation and rollback orchestration, which remain `CF-025`.
- Read-only observability/reporting ownership, which remains `CF-015`.
- Workshop lifecycle, governor proposal tables/decision semantics and body-evolution execution mechanics beyond their security/perimeter boundaries.
- Safe external operator exposure claims before `CF-024` is delivered.
- Rollback execution and network-actuation ownership, which remain downstream-owner responsibilities.

### Constraints

- `CF-014` must stay separate from `F-0002` platform substrate ownership and may strengthen, but not redefine, the canonical deployment cell.
- The seam must preserve the repo-level substrate contract from `ADR-2026-03-25`: `AI SDK + Hono` for repo-owned runtime/governance, with no shadow API gateway or framework-owned security control plane.
- Human-override and safety decisions must extend owner-routed control semantics from `F-0013` and `F-0016`; direct writes into foreign state/governor surfaces remain forbidden.
- `CF-014` hardens only already-trusted control paths. Externally safe operator exposure, caller identity and route permissions remain blocked on `CF-024` and must not be implied by this dossier.
- Restricted-shell and workspace rules must compose with `F-0010` and `F-0017`, stay fail-closed on sandbox or `/seed` escape, and avoid duplicating unrelated execution ownership.
- For `force rollback` and `disable external network`, `CF-014` owns only gate policy, approval conditions and fail-closed refusal semantics. Rollback execution, release rollback orchestration and network-actuation mechanics remain with downstream owners such as `F-0017`, `CF-025` and platform/runtime surfaces.
- Any later implementation that changes runtime, startup or deployment behavior must pass the canonical root verification flow (`pnpm format`, `pnpm typecheck`, `pnpm lint`) and `pnpm smoke:cell`.

### Assumptions (optional)

- Delivered `F-0002`, `F-0010`, `F-0013`, `F-0016` and `F-0017` are sufficient substrate for shaping mature perimeter controls without reopening early backbone seams.
- `CF-024` remains the owner of operator identity/auth/RBAC. `CF-014` defines what privileged controls may do and how they are gated, not who the operator is.
- `CF-025` remains the owner of deploy/release automation and rollback orchestration. `CF-014` may deny or require approvals for those actions, but it does not execute them.
- Architecture section 14 already fixes the baseline obligations for networks, mounts, secrets, safety kernel and human override; `spec-compact` will translate those obligations into one feature-local owner contract.

### Open questions (optional)

- `OQ-F0018-01`: Which rule families belong to the `safety kernel` versus `F-0016` governor decision/evidence versus late `CF-027` policy profiles? owner: `@codex`; date: `2026-04-14`; needed_by: `before_planned`; next decision path: capture an explicit authority matrix in `spec-compact`.

## 3. Requirements & Acceptance Criteria (SSoT)

## 4. Non-functional requirements (NFR)

## 5. Design (compact)

### 5.1 API surface

- No new public API surface is committed at intake time.
- The seam is expected to harden existing control surfaces from `F-0013` / `F-0016` and may require bounded owner-routed controls for network disable or mandatory human review, but public auth/RBAC stays outside this dossier.
- Any route-level hardening in this dossier applies only after the caller has already been admitted by the auth/RBAC owner seam; `CF-014` does not authenticate, authorize or expose a safe external control path by itself.

### 5.2 Runtime / deployment surface

- The seam may affect runtime policy evaluation, secrets delivery, bounded shell/tool execution, egress restrictions and materialized workspace handling.
- Baseline container topology, service naming, mounts and networks remain owned by `F-0002`.

### 5.3 Data model changes

- Expected changes are policy/config/evidence surfaces around safety kernel, secrets handling and human-override provenance.
- The exact durable owner split between perimeter policy records, governor-owned decision records and late policy-profile sources is intentionally deferred to `spec-compact`.
- Rollback and network-disable execution evidence are expected to stay downstream-owned and read-only to this seam.

### 5.4 Edge cases and failure modes

- Missing or malformed secret material.
- Attempted sandbox, network or `/seed` escape through bounded execution paths.
- High-risk action submitted without the required human gate.
- Stale or unverifiable human-override evidence.
- Kill-switch or network-disable activation during in-flight body/deploy/recovery activity.

### 5.5 Verification surface / initial verification plan

- Unit: policy evaluation, secrets redaction, restricted-shell decisions.
- Integration: owner-routed control flows, execution hardening and human-gate enforcement.
- Smoke: required whenever the implementation changes runtime/startup/deployment or container/network posture.

### 5.6 Representation upgrades (triggered only when needed)

- Likely requires a decision table for action class vs required human gate.
- Likely requires an authority table for `platform baseline` vs `perimeter hardening` vs `auth/RBAC` vs `governor policy`.

### 5.7 Definition of Done

- One canonical owner contract exists for mature perimeter hardening.
- Safety kernel, secrets policy, restricted shell hardening and stronger human gates are specified without reopening platform/auth/governor ownership.
- The dossier states explicitly that `CF-014` hardens only already-trusted control paths and does not claim externally safe operator exposure before `CF-024`.
- The dossier states explicitly that rollback execution and network-actuation mechanics remain downstream-owner responsibilities.
- Verification expectations are explicit for the canonical root verification flow and the required containerized smoke path when runtime/deployment behavior changes.

### 5.8 Rollout / activation note (triggered only when needed)

- Hardening changes must be introduced in a fail-closed but reversible order.
- Network-disable and mandatory-human-review gates must not strand boot/recovery or already approved rollback paths.

## 6. Slicing plan (2–6 increments)

## 7. Task list (implementation units)

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|

## 9. Decision log (ADR blocks)

## 10. Progress & links

- Backlog item key: CF-014
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Issue:
- PRs:

## 11. Change log

- 2026-04-14: Initial dossier created from backlog item `CF-014` at backlog delivery state `defined`.
