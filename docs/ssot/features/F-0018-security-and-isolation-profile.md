---
id: F-0018
title: Профиль безопасности и изоляции
status: done
coverage_gate: strict
owners: ["@codex"]
area: safety
depends_on: ["F-0002", "F-0010", "F-0013", "F-0016", "F-0017"]
impacts: ["runtime", "infra", "governance", "api", "workspace", "network", "safety"]
created: 2026-04-14
updated: 2026-04-15
links:
  issue: ""
  pr: []
  docs:
    - "docs/architecture/system.md"
    - "docs/polyphony_concept.md"
    - "docs/notes/backlog-legacy/feature-candidates.md"
    - "docs/notes/backlog-legacy/working-system-roadmap-matrix-2026-03-26.md"
    - "docs/ssot/features/F-0002-canonical-monorepo-deployment-cell.md"
    - "docs/ssot/features/F-0010-executive-center-and-bounded-action-layer.md"
    - "docs/ssot/features/F-0013-operator-http-api-and-introspection.md"
    - "docs/ssot/features/F-0016-development-governor-and-change-management.md"
    - "docs/ssot/features/F-0017-git-managed-body-evolution-and-stable-snapshots.md"
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
    - docs/notes/backlog-legacy/feature-candidates.md
    - docs/notes/backlog-legacy/working-system-roadmap-matrix-2026-03-26.md
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

- None before `plan-slice`.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0018-01:** `F-0018` owns one canonical mature perimeter-hardening seam over already-trusted control paths and internal owner-routed execution paths; it does not create, publish or imply a safe external operator-exposure path before `CF-024` delivers auth/authz/RBAC.
- **AC-F0018-02:** `F-0018` defines one separately reviewable `safety kernel` that covers exactly four rule families in this phase: forbidden actions, network/egress rules, promotion/change gates and budget ceilings.
- **AC-F0018-03:** Every high-risk action class in scope (`freeze development`, `force rollback`, `disable external network`, promotion/code-change paths that require human review) is evaluated to exactly one perimeter verdict before side effect: `allow`, `deny`, or `require_human_review`.
- **AC-F0018-04:** Missing trusted-path admission, missing human-override provenance, stale adjacent evidence or unsupported action class fail closed before side effect and return an explicit refusal outcome instead of falling back to best-effort execution.
- **AC-F0018-05:** For `force rollback` and `disable external network`, `F-0018` owns only gate policy, approval conditions and refusal semantics; rollback execution, network-actuation and release orchestration remain downstream-owner responsibilities.
- **AC-F0018-06:** `F-0018` requires durable provenance and evidence refs for every accepted high-risk approval verdict, and it rejects unverifiable authority claims before side effect.
- **AC-F0018-07:** `F-0018` does not introduce a second human-approval source surface: governor- or `human_override`-backed flows reuse adjacent owner evidence (`F-0016` governor decision/freeze evidence or owner-routed `human_override` evidence such as the `F-0017` body-change authority contract) and validate those refs read-only before issuing a perimeter verdict, while pre-approval request-creation paths may use `trusted_ingress` only as an admission marker for an already-admitted adjacent owner seam and canonical request evidence, never as a new approval fact.
- **AC-F0018-08:** Secrets do not persist in dossier prose, narrative/episode state, datasets, reports or generated artifacts as plaintext runtime payload.
- **AC-F0018-09:** Secret-bearing exports require mandatory redaction or fail closed before publication.
- **AC-F0018-10:** Production/runtime secret material is sourced through Docker secrets or an equivalent external secret source, not from repo-tracked content, feature dossiers, or narrative state.
- **AC-F0018-11:** Restricted-shell, bounded HTTP, Git/body and workspace execution paths may proceed only through the bounded owner seams from `F-0010` and `F-0017`, with fail-closed denial on sandbox escape, `/seed` mutation, unauthorized network egress, privilege escalation or path traversal outside approved writable roots.
- **AC-F0018-12:** `F-0018` may strengthen the delivered deployment posture, but it may not redefine the baseline service topology, volume policy, network ownership or startup substrate already owned by `F-0002`.
- **AC-F0018-13:** The authority split between `F-0018`, `F-0016`, `CF-024`, `CF-025` and `CF-027` is explicit and non-overlapping in the dossier, so later stages do not need to infer whether a concern belongs to perimeter policy, route admission, governor decision/evidence, execution/orchestration or late policy-profile shaping.

## 4. Non-functional requirements (NFR)

- **Boundary safety:** `perimeter_boundary_violation_count` budget: `0` direct raw shell/raw Git/raw network/raw governor writes that bypass the canonical owner seams in boundary audit and integration tests.
- **Auditability:** `perimeter_policy_audit_coverage` threshold: `100%` of accepted high-risk approvals and explicit refusals persist request identity, origin surface and evidence refs in a canonical owner-owned audit surface.
- **Secret hygiene:** `secret_redaction_coverage` threshold: `100%` of dataset/report/artifact export paths in scope either prove redaction or fail closed before export.
- **Recoverability:** restart/reclaim verification reconstructs the active perimeter-policy configuration and the latest approval/refusal evidence from repo-owned policy source plus durable owner evidence, with `0` reliance on process-local cache for final verdict interpretation.
- **Verification discipline:** any implementation that changes runtime, startup or deployment behavior must pass `pnpm format`, `pnpm typecheck`, `pnpm lint`, and `pnpm smoke:cell`; no weaker verification path counts toward closure.

## 5. Design (compact)

### 5.1 API surface

- No new public API surface is committed at intake time.
- The seam is expected to harden existing control surfaces from `F-0013` / `F-0016` and may require bounded owner-routed controls for network disable or mandatory human review, but public auth/RBAC stays outside this dossier.
- Any route-level hardening in this dossier applies only after the caller has already been admitted by the auth/RBAC owner seam; `CF-014` does not authenticate, authorize or expose a safe external control path by itself.

```ts
type PerimeterAuthorityRef =
  | {
      authorityOwner: "trusted_ingress";
      governorProposalId?: never;
      governorDecisionRef?: never;
      humanOverrideEvidenceRef?: never;
    }
  | {
      authorityOwner: "governor";
      governorProposalId: string;
      governorDecisionRef: string;
      humanOverrideEvidenceRef?: never;
    }
  | {
      authorityOwner: "human_override";
      humanOverrideEvidenceRef: string;
      governorProposalId?: never;
      governorDecisionRef?: never;
    };

type PerimeterControlRequest = PerimeterAuthorityRef & {
  requestId: string;
  ingressOwner: "F-0013" | "F-0016" | "F-0017" | "CF-025" | "platform-runtime";
  actionClass:
    | "freeze_development"
    | "force_rollback"
    | "disable_external_network"
    | "code_or_promotion_change";
  targetRef?: string;
  evidenceRefs: string[];
};
```

- `F-0018` validates this envelope and records the perimeter verdict, but it does not mint a second approval ledger.
- `trusted_ingress` is valid only for pre-approval request-creation paths that are already inside a bounded adjacent owner seam such as `F-0013 -> F-0016` freeze/proposal intake or internal governor/runtime ingress; it is not a substitute for later governor or `human_override` evidence on downstream execution-backed flows.
- `governorDecisionRef` / `governorProposalId` stay owned by `F-0016`.
- `humanOverrideEvidenceRef` stays owned by the adjacent owner seam that already exposes `human_override` authority, such as `F-0017` body-evolution authority or the downstream platform/runtime control seam.

### 5.1 Boundary operations

| Operation | Success behavior | Invalid / dependency failure | Duplicate / retry behavior |
|---|---|---|---|
| Trusted high-risk control request | Returns one perimeter verdict (`allow`, `deny`, `require_human_review`) before side effect and forwards only `allow` to the downstream owner seam. | Rejects missing trusted-path admission, stale evidence, missing provenance or unsupported action class with explicit refusal. | Reuses the owner seam's canonical request identity semantics; `F-0018` must not reinterpret duplicate owner requests as new approvals. |
| Human-override evidence intake | Accepts one explicit override evidence package only when it was already issued by an adjacent owner seam and its provenance/refs are durable and valid. | Rejects unverifiable override source, missing evidence refs or stale target refs. | Replayed override evidence reuses the same owner-routed identity/evidence rather than minting a second approval. |
| Secret-bearing export or artifact publication | Proceeds only after mandatory redaction succeeds or the payload is proven secret-free. | Fails closed when redaction cannot be proven or the payload contains unresolved secret material. | Retried export repeats the same redaction gate; no unsafe fallback export path is allowed. |
| Restricted shell/body execution request | Delegates to `F-0010` / `F-0017` only after perimeter policy allows the execution profile and approved writable roots. | Denies sandbox escape, `/seed` mutation, privilege escalation, unauthorized egress or path traversal before execution starts. | Retries preserve the same policy verdict; `F-0018` does not silently widen the execution profile on retry. |
| Rollback / network kill-switch request | Emits gate decision and durable evidence, then leaves actuation to the downstream execution owner. | Rejects unsupported target owner, missing actuation owner ref or missing high-risk approval proof. | Duplicate requests reuse the same owner-routed decision identity; `F-0018` does not perform the actuation itself. |

### 5.2 Runtime / deployment surface

- The seam may affect runtime policy evaluation, secrets delivery, bounded shell/tool execution, egress restrictions and materialized workspace handling.
- Baseline container topology, service naming, mounts and networks remain owned by `F-0002`.
- No new service is introduced. Policy evaluation lives inside the existing repo-owned runtime/governance substrate (`AI SDK + Hono + PostgreSQL`) and composes with the delivered deployment cell.
- Secrets delivery stays externalized through Docker secrets or equivalent secret injection; repo-tracked config remains shape-only and non-secret.

### 5.3 Data model changes

- Repo-owned policy/config source is required for the `safety kernel`, secrets policy and trusted-path hardening rules.
- `F-0018` owns only the perimeter-policy source and perimeter decision audit facts (`allow` / `deny` / `require_human_review`) with request identity and provenance refs.
- Governor-owned decision/freeze records remain in `F-0016`; owner-routed `human_override` authority evidence remains with the adjacent owner seam that issued it; late policy-profile source remains `CF-027`; route admission state remains `CF-024`.
- Rollback and network-disable execution requests and execution evidence stay downstream-owned and read-only to this seam.

### 5.4 Edge cases and failure modes

- Missing or malformed secret material.
- Attempted sandbox, network or `/seed` escape through bounded execution paths.
- High-risk request arriving through a path that is not yet protected by `CF-024`.
- High-risk action submitted without the required human gate.
- Stale or unverifiable human-override evidence.
- Downstream actuation owner unavailable after perimeter policy already returned `allow`.
- Kill-switch or network-disable activation during in-flight body/deploy/recovery activity; `F-0018` may deny or require review, but downstream owner must report actuation success/failure explicitly.

### 5.5 Verification surface / initial verification plan

- `AC-F0018-01`, `AC-F0018-05`, `AC-F0018-12`, `AC-F0018-13`: spec review, integration, smoke when runtime/deployment behavior changes.
- `AC-F0018-02`, `AC-F0018-03`, `AC-F0018-04`, `AC-F0018-06`, `AC-F0018-07`: unit, integration.
- `AC-F0018-08`, `AC-F0018-09`, `AC-F0018-10`: unit, integration.
- `AC-F0018-11`: unit, integration, smoke when container/network/egress posture changes.

### 5.6 Representation upgrades (triggered only when needed)

#### Authority split matrix

| Concern | Canonical owner | Explicitly not owned by `F-0018` |
|---|---|---|
| Baseline deployment cell, topology, mounts, startup substrate | `F-0002` | `F-0018` may strengthen posture but not redefine baseline topology or ownership |
| Public auth/authz/RBAC and caller admission | `CF-024` | `F-0018` does not establish safe external operator exposure |
| Governor proposal/freeze writes and decision/evidence semantics | `F-0016` | `F-0018` does not write governor rows or replace governor decision lifecycle |
| Rollback execution, release rollback orchestration, network actuation | `F-0017`, `CF-025`, platform/runtime owners | `F-0018` owns only gate policy, approval conditions and refusals |
| Late policy profiles, consultant admission, richer phase-6 governance | `CF-027` | `F-0018` does not become the owner of all mature governance policy |

#### High-risk action policy table

| Action class | Canonical ingress owner | Authority source of truth | Perimeter verdicts | Execution owner after `allow` |
|---|---|---|---|---|
| `freeze_development` | Internal `platform-runtime` path is live now; public `F-0013` `POST /control/freeze-development` remains explicit unavailable until `CF-024` caller admission exists | `trusted_ingress` for already-admitted internal request-creation paths; any later execution-backed flow still reuses `F-0016` governor/freeze evidence or explicit `human_override` evidence read-only | `allow` / `deny` / `require_human_review` | `F-0016` |
| `force_rollback` | Adjacent rollback request gate owned by `F-0017` / `CF-025`; `F-0018` introduces no new public route | Existing `governorDecisionRef` or owner-routed `humanOverrideEvidenceRef` already defined by the downstream rollback authority contract | `allow` / `deny` / `require_human_review` | `F-0017` / `CF-025` / downstream runtime owner |
| `disable_external_network` | No named ingress owner is allocated in the current backlog; until one exists, `F-0018` supports only explicit-unavailable refusal semantics and introduces no new public route | Existing governor or `human_override` evidence may be validated, but no actuation handoff is allowed until a named owner seam exists | `deny` / `require_human_review` / explicit unavailable refusal | no actuation owner in this dossier; future seam required before enablement |
| `code_or_promotion_change` | Internal `F-0016` proposal/approval gate plus adjacent workshop/body execution owner flow; public `F-0013` proposal route remains explicit unavailable until `CF-024` caller admission exists | `trusted_ingress` for already-admitted internal proposal request creation inside the `F-0016` seam; `F-0016` proposal/decision evidence plus adjacent owner evidence packages for downstream execution-backed flows | `allow` / `deny` / `require_human_review` | `F-0010` / `F-0017` / `F-0016` adjacent owner flow |

#### Decision classification

- **Normative now:** trusted-path-only perimeter ownership; one verdict before side effect for each in-scope high-risk action; gate-policy-only ownership for rollback/network kill-switch request classes; fail-closed secret-redaction and restricted-shell posture.
- **Implementation freedom:** concrete storage schema for policy/evidence, internal evaluator composition, and exact integration points inside `F-0010` / `F-0016` / `F-0017`, provided the ACs, authority split and NFR budgets remain unchanged.
- **Temporary assumption:** no additional temporary assumptions are required before `plan-slice`.

### 5.7 Definition of Done

- One canonical owner contract exists for mature perimeter hardening.
- Safety kernel, secrets policy, restricted shell hardening and stronger human gates are specified without reopening platform/auth/governor ownership.
- The dossier states explicitly that `CF-014` hardens only already-trusted control paths and does not claim externally safe operator exposure before `CF-024`.
- The dossier states explicitly that rollback execution and network-actuation mechanics remain downstream-owner responsibilities.
- The authority split between `F-0018`, `CF-024`, `F-0016`, `F-0017`, `CF-025` and `CF-027` is explicit enough that `plan-slice` can sequence work without new intake-time ambiguity.
- Verification expectations are explicit for the canonical root verification flow and the required containerized smoke path when runtime/deployment behavior changes.

### 5.8 Rollout / activation note (triggered only when needed)

- Hardening changes must be introduced in a fail-closed but reversible order.
- Network-disable and mandatory-human-review gates must not strand boot/recovery or already approved rollback paths.
- Activation order must preserve existing trusted-path owners first (`CF-024` caller admission, then `F-0013` public exposure, `F-0016`, `F-0010`, `F-0017`) and only then tighten perimeter policies on top of them.

## 6. Slicing plan (2–6 increments)

Forecast policy: slices below are implementation forecast, not separate product commitments. Commitment remains in ACs, Definition of Done, verification gates and rollout constraints.

### Dependency visibility

- Depends on: `F-0002`; owner: `@codex`; unblock condition: delivered deployment-cell topology, writable runtime roots and Docker-secret path remain the canonical substrate for perimeter policy attachment.
- Depends on: `F-0010`; owner: `@codex`; unblock condition: bounded shell/tool execution remains the only write-capable execution path for workspace and egress-sensitive actions.
- Depends on: `F-0013`; owner: `@codex`; unblock condition: existing control-route boundary remains the only operator-facing ingress for freeze and adjacent control delegation.
- Depends on: `F-0016`; owner: `@codex`; unblock condition: governor decision/freeze evidence remains the canonical approval source for perimeter checks.
- Depends on: `F-0017`; owner: `@codex`; unblock condition: body-evolution authority contracts continue exposing bounded `human_override` evidence and rollback-adjacent owner flow.
- Depends on: `CF-015`; owner: `@codex`; unblock condition: report/export publication surfaces either expose bounded redaction hooks or remain explicit unavailable to this seam.
- Depends on: `CF-024`; owner: `@codex`; unblock condition: trusted caller admission and route permissions exist for any operator-reachable high-risk control path.
- Depends on: `CF-025`; owner: `@codex`; unblock condition: rollback request owners expose stable bounded ingress/target refs for perimeter gating.

### Contract risks to kill before implementation close-out

- Approval-source ambiguity: perimeter must validate adjacent governor / `human_override` evidence read-only and must not mint a second approval ledger.
- Ingress ambiguity: each high-risk action must keep one canonical ingress owner and one canonical downstream executor.
- Secret leakage ambiguity: artifact/report/dataset/export paths must prove redaction or fail closed.
- Escape ambiguity: bounded shell, Git/body and workspace flows must reject `/seed` writes, path traversal, unauthorized egress and privilege escalation before side effect.
- Activation ambiguity: fail-closed rollout must not strand rollback, recovery or already trusted owner flows while adjacent ingress seams are still partial.

### SL-F0018-01 — Safety kernel, authority intake and perimeter decision ledger

Deliverable:

- Canonical perimeter contracts, `safety kernel` policy source and decision service for trusted high-risk actions.
- Read-only authority validation against adjacent governor / `human_override` evidence without a second approval ledger.
- Perimeter decision audit facts with one verdict per request before side effect.

AC coverage:

- AC-F0018-01, AC-F0018-02, AC-F0018-06, AC-F0018-07, AC-F0018-13
- AC-F0018-03, AC-F0018-04 for `freeze_development` and `code_or_promotion_change`

Verification artifacts:

- Contract tests for `PerimeterControlRequest`, authority-source exclusivity and verdict mapping.
- Integration tests proving read-only reuse of `F-0016` and adjacent `human_override` evidence.
- Negative boundary tests proving no second approval/evidence surface is created.
- Changed-source gate: `pnpm format`, `pnpm typecheck`, `pnpm lint`.

Depends on:

- `F-0013`; owner: `@codex`; unblock condition: freeze-control ingress remains delegated through the existing control boundary.
- `F-0016`; owner: `@codex`; unblock condition: governor decision/freeze refs remain stable and readable.
- `F-0017`; owner: `@codex`; unblock condition: adjacent `human_override` evidence contract stays stable.

Assumes:

- Early implementation can ship against already-trusted internal or owner-routed ingress even if `CF-024` has not yet exposed the final caller-admission path.

Fallback:

- If trusted caller admission is not yet available for an operator-reachable path, keep that path explicit unavailable and ship the decision engine only for internal/adjacent owner flows.

Approval / decision path:

- Architecture/ADR realignment required if implementation needs a new approval ledger, a new writable owner surface, or a new public control route.

### SL-F0018-02 — Secret hygiene and bounded execution hardening

Deliverable:

- Secret-source enforcement and redaction/fail-closed publication gates for runtime-local generated artifacts plus bounded workshop/report publication hooks where adjacent owners expose them.
- Bounded execution policy layer for shell, workspace, Git/body and egress-sensitive actions over the delivered `F-0010` / `F-0017` seams.
- Runtime/deployment-sensitive verification hooks that escalate to `pnpm smoke:cell` when perimeter changes affect startup, deployment, container or network posture.

AC coverage:

- AC-F0018-08, AC-F0018-09, AC-F0018-10
- AC-F0018-11, AC-F0018-12

Verification artifacts:

- Unit/integration tests for plaintext-secret non-persistence and secret-bearing export refusal/redaction.
- Boundary tests for `/seed` rejection, path traversal rejection, unauthorized egress denial and privilege-escalation denial.
- Smoke verification when runtime/startup/deployment or network posture changes.
- Changed-source gate: `pnpm format`, `pnpm typecheck`, `pnpm lint`.

Depends on:

- `F-0002`; owner: `@codex`; unblock condition: Docker-secret and deployment-cell substrate remain the canonical secret/runtime path.
- `F-0010`; owner: `@codex`; unblock condition: bounded tool execution remains the only shell/tool mutation path.
- `F-0015`; owner: `@codex`; unblock condition: workshop artifact publication remains behind bounded repo-owned service hooks.
- `F-0017`; owner: `@codex`; unblock condition: body/workspace authority contracts remain bounded and internal.
- `CF-015`; owner: `@codex`; unblock condition: report/export publication surfaces expose bounded redaction interception hooks or remain explicit unavailable.

Assumes:

- Runtime-local and workshop/report publication surfaces in scope can be intercepted through repo-owned service boundaries rather than ad hoc per-caller hooks.

Fallback:

- If a workshop or report publication surface does not yet expose a bounded redaction hook, keep that surface explicit unavailable and ship only the already interceptable runtime-local publication paths.

Approval / decision path:

- Adjacent owner review from `F-0015` and `CF-015` is required when implementation touches workshop/report publication hooks.
- Architecture/ADR realignment required if a new writable root or non-canonical secret source becomes necessary.

### SL-F0018-03 — Adjacent rollback/network gate integration, activation proof and usage audit

Deliverable:

- Perimeter gating integrated with adjacent rollback request owners without introducing a new public route or a second actuation plane.
- `disable_external_network` remains explicit unavailable in this dossier until a named ingress/actuation owner is created through future backlog realignment; this slice hardens only the refusal semantics for that class.
- Activation-order proof showing fail-closed rollout over `F-0013` / `F-0016` / `F-0010` / `F-0017` and explicit refusal while downstream gates are unavailable.
- Real usage audit over one non-public/local end-to-end high-risk control flow, with corrective findings triaged.

AC coverage:

- AC-F0018-03, AC-F0018-04, AC-F0018-05 for `force_rollback` and `disable_external_network`
- AC-F0018-06, AC-F0018-07, AC-F0018-11, AC-F0018-12, AC-F0018-13

Verification artifacts:

- Integration tests for adjacent rollback ingress owners and explicit `unavailable` / refusal semantics when the downstream gate is absent.
- Negative tests proving `disable_external_network` stays explicit unavailable until a named ingress owner exists.
- Negative boundary tests proving no new public control route or actuation owner is created by `F-0018`.
- Usage-audit integration run and corrective classification record.
- Changed-source gate: `pnpm format`, `pnpm typecheck`, `pnpm lint`; add `pnpm smoke:cell` when runtime/deployment behavior changes.

Depends on:

- `SL-F0018-01`; owner: `@codex`; unblock condition: decision engine and authority validation are merged.
- `SL-F0018-02`; owner: `@codex`; unblock condition: secret/bounded-execution hardening exists for the same perimeter flow.
- `CF-024`; owner: `@codex`; unblock condition: trusted caller admission exists for any operator-facing high-risk path.
- `CF-025`; owner: `@codex`; unblock condition: bounded rollback request contracts expose stable target/authority refs.

Assumes:

- Adjacent rollback owners can expose bounded request contracts without transferring execution ownership to `F-0018`.

Fallback:

- Keep rollback perimeter integration internal-only until the bounded rollback request contract exists; keep `disable_external_network` explicit unavailable and do not create a stopgap public route.

Approval / decision path:

- Cross-cutting owner approval from the adjacent `F-0013` / `F-0016` / `F-0017` / `CF-025` seams is required if implementation changes rollback ingress ownership, refusal semantics or activation order.
- Any future enablement of `disable_external_network` requires backlog/dossier realignment first, because no named ingress owner exists in the current seam map.

### Drift guard and usage audit

- Drift guard: before each implementation slice, re-read `F-0018`, `F-0010`, `F-0013`, `F-0016`, `F-0017`, `README.md` and the applicable ADRs to ensure no second ledger, no new public control path and no substrate re-ownership slip in.
- Real usage audit: after `SL-F0018-03`, exercise one non-public/local high-risk control flow and classify findings as `docs-only`, `runtime`, `schema/help`, `cross-skill` or `audit-only`.
- Activation proof target:
  1. merge `SL-F0018-01` with trusted/internal owner paths only;
  2. merge `SL-F0018-02` with secret/export and bounded execution hardening fail-closed by default;
  3. merge `SL-F0018-03` only after adjacent rollback/network ingress owners exist or remain explicit unavailable.

## 7. Task list (implementation units)

- **T-F0018-01** (`SL-F0018-01`): add perimeter contracts, safety-kernel config, authority-source validation and verdict persistence. Covers AC-F0018-01, AC-F0018-02, AC-F0018-03, AC-F0018-06, AC-F0018-07.
- **T-F0018-02** (`SL-F0018-01`): wire trusted freeze/code-promotion ingress through adjacent `F-0013` / `F-0016` seams and add no-second-ledger boundary tests. Covers AC-F0018-03, AC-F0018-04, AC-F0018-13 for `freeze_development` and `code_or_promotion_change`.
- **T-F0018-03** (`SL-F0018-02`): implement plaintext-secret non-persistence rules plus secret-bearing export redaction/fail-closed publication gates for runtime-local paths and adjacent workshop/report hooks when available. Covers AC-F0018-08, AC-F0018-09, AC-F0018-10.
- **T-F0018-04** (`SL-F0018-02`): implement bounded execution hardening over `F-0010` / `F-0017`, including `/seed`, path, privilege and egress denial plus smoke escalation hook. Covers AC-F0018-11, AC-F0018-12.
- **T-F0018-05** (`SL-F0018-03`): integrate adjacent rollback ingress owners and keep `disable_external_network` explicit unavailable until future realignment, without adding a new public route or actuation owner. Covers AC-F0018-03, AC-F0018-04, AC-F0018-05, AC-F0018-13 for `force_rollback` and `disable_external_network`.
- **T-F0018-06** (`SL-F0018-03`): run usage audit, docs/runtime parity checks, drift guards and activation-proof verification. Covers DoD plus AC-F0018-06 through AC-F0018-13.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0018-01 | `implemented perimeter owner seam over trusted governor/body/runtime paths via safety kernel + decision service wiring in development-governor and body-evolution, while keeping public high-risk operator routes explicit unavailable until CF-024 caller admission exists` | implemented |
| AC-F0018-02 | `implemented separately reviewable safety-kernel policy source with explicit rule families and policy version audit` | implemented |
| AC-F0018-03 | `implemented one durable perimeter verdict per in-scope high-risk request across governor intake, body-change ingress and rollback handoff; explicit-unavailable refusal remains the canonical disable_external_network behavior` | implemented |
| AC-F0018-04 | `implemented fail-closed denial for missing trusted ingress, stale adjacent authority evidence, conflicting request replay, unsupported action classes and unavailable downstream activation owners` | implemented |
| AC-F0018-05 | `implemented rollback gate integration through the adjacent F-0017 body-evolution seam while keeping disable_external_network gate-only and explicit unavailable with no new actuation plane` | implemented |
| AC-F0018-06 | `implemented durable perimeter-decision audit with request identity, evidence refs, policy version and read-only authority validation` | implemented |
| AC-F0018-07 | `implemented no-second-ledger boundary: trusted_ingress is limited to already-admitted internal adjacent request-creation seams, while governor and human_override execution-backed flows reuse existing adjacent evidence stores read-only and public operator high-risk routes stay explicit unavailable until CF-024` | implemented |
| AC-F0018-08 | `implemented plaintext-secret non-persistence guard for runtime-local and workshop artifact writes through secret-hygiene interception` | implemented |
| AC-F0018-09 | `implemented secret-bearing export fail-closed refusal before artifact publication when configured secret material or secret-bearing keys are detected` | implemented |
| AC-F0018-10 | `implemented external secret-source contract for Telegram runtime credentials through mounted secret-file support and non-repo-tracked delivery paths` | implemented |
| AC-F0018-11 | `implemented bounded execution hardening verification for restricted_shell and network_http egress allowlists plus existing seed/path escape guards on F-0010/F-0017 seams` | implemented |
| AC-F0018-12 | `implemented no-topology-reownership discipline: delivery stays inside the canonical deployment cell and verifies through full root quality gates plus container smoke` | implemented |
| AC-F0018-13 | `implemented explicit authority split in code and dossier: perimeter policy vs route admission vs governor evidence vs rollback execution/orchestration remain non-overlapping` | implemented |

## 9. Decision log (ADR blocks)

### ADR-F0018-01: `CF-014` hardens only trusted control paths
- Status: Accepted
- Date: 2026-04-14
- Context: The architecture backlog already separates safe external operator exposure (`CF-024`) from mature perimeter hardening (`CF-014`). Without an explicit split, this dossier could be misread as sufficient for public control safety on its own.
- Decision: `F-0018` hardens only already-trusted control paths and internal owner-routed execution paths. Caller admission, route permissions and externally safe operator exposure remain `CF-024`.
- Alternatives: Let `CF-014` absorb route admission semantics; keep the split implicit in prose only.
- Consequences: Perimeter policy stays fail-closed, and later implementation cannot claim externally safe control exposure before `CF-024`.

### ADR-F0018-02: Rollback and network kill-switch ownership stays split
- Status: Accepted
- Date: 2026-04-14
- Context: Security/perimeter policy needs to gate `force rollback` and `disable external network`, but execution ownership already belongs to downstream body/release/platform seams.
- Decision: `F-0018` owns only gate policy, approval conditions and refusal semantics for rollback/network kill-switch request classes. Execution/orchestration stays with `F-0017`, `CF-025` and relevant platform/runtime owners.
- Alternatives: Let `CF-014` execute kill-switch operations directly; leave the split implicit until implementation.
- Consequences: The system avoids a second rollback/control plane and keeps side-effect ownership with the existing execution seams.

### ADR-F0018-03: Safety kernel is narrower than governor policy and later policy profiles
- Status: Accepted
- Date: 2026-04-14
- Context: Architecture section 14 requires a separately reviewable safety kernel, while `F-0016` already owns governor decisions/evidence and `CF-027` remains the future owner of broader phase-6 policy profiles.
- Decision: In this seam, `safety kernel` is limited to forbidden actions, network/egress rules, promotion/change gates and budget ceilings. Governor decision lifecycle stays in `F-0016`; late policy profiles and consultant admission stay in `CF-027`.
- Alternatives: Put all mature policy source into the safety kernel; defer the split entirely to implementation.
- Consequences: `plan-slice` can sequence perimeter hardening without reopening governor ownership or phase-6 governance scope.

## 10. Progress & links

- Backlog item key: CF-014
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Implementation status: `SL-F0018-01`, `SL-F0018-02` and `SL-F0018-03` delivered.
- Delivered code surfaces:
  - trusted-ingress perimeter contracts, safety-kernel policy source, durable decision ledger and `db`-backed read-only authority validation;
  - fail-closed public operator high-risk route posture that keeps `/control/freeze-development` and `/control/development-proposals` explicit unavailable until `CF-024` caller admission exists;
  - real ingress wiring for governor proposal/freeze paths and body-evolution proposal/rollback handoff without a second approval ledger;
  - runtime/workshop secret-hygiene guard, external secret-file contract for Telegram credentials, and bounded execution regression coverage for restricted shell/network egress;
  - rollback gating activation proof in the canonical deployment cell plus corrective migration `017_perimeter_trusted_ingress.sql` for persisted trusted-ingress decisions.
- Verification status: `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm smoke:cell` passed on the delivered tree.
- Issue:
- PRs:

## 11. Change log

- 2026-04-14: Initial dossier created from backlog item `CF-014` at backlog delivery state `defined`.
- 2026-04-14 [clarification]: `spec-compact` completed; authority split with `CF-024`, `F-0016`, `F-0017`, `CF-025` and `CF-027` is now explicit, ACs/NFRs are grounded, and the dossier is ready for planning.
- 2026-04-14 [plan-slice]: implementation plan closed with three slices, explicit `CF-015` reporting-hook dependency, reround review `PASS`, and next step `implementation`.
- 2026-04-14 [implementation-start]: started `SL-F0018-01` with perimeter contracts, safety-kernel policy source, durable perimeter-decision ledger, `db`-backed read-only authority lookup for governor / `human_override`, and refusal-only semantics for rollback/network classes without a new public route or second approval ledger.
- 2026-04-15 [implementation-close]: completed `SL-F0018-01` by wiring trusted ingress through `F-0016` and `F-0017`, closing the no-second-ledger boundary with contract/runtime coverage, and adding the corrective trusted-ingress SQL migration for durable perimeter persistence.
- 2026-04-15 [clarification]: clarified the normative `trusted_ingress` contract for `freeze_development` and proposal-intake paths so dossier truth matches delivered behavior: admission marker for already-admitted adjacent owner seams, not a second approval fact.
- 2026-04-15 [security realignment]: public `F-0013` high-risk routes were returned to explicit unavailable until `CF-024` caller admission exists, and perimeter trusted-ingress validation now fail-closes external operator paths instead of auto-accepting them.
- 2026-04-15 [implementation-close]: completed `SL-F0018-02` with runtime/workshop secret-hygiene fail-closed guards, external secret-file loading for Telegram runtime credentials, and bounded execution regression coverage for restricted shell and bounded HTTP egress.
- 2026-04-15 [implementation-close]: completed `SL-F0018-03` with rollback perimeter gating over the adjacent body-evolution owner seam, explicit-unavailable `disable_external_network` posture, usage-audit proof, and green root quality/smoke verification on the canonical deployment cell.
