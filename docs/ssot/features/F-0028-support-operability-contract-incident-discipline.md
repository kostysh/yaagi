---
id: F-0028
title: Support / operability contract и incident discipline
status: done
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
    - "docs/support/runbooks/_template.md"
    - "docs/support/runbooks/runtime_availability.md"
    - "docs/support/runbooks/operator_access.md"
    - "docs/support/runbooks/reporting_freshness.md"
    - "docs/support/runbooks/release_or_rollback.md"
    - "docs/support/runbooks/model_readiness.md"
    - "docs/support/runbooks/governance_or_safety_escalation.md"
    - "docs/support/runbooks/support_process_gap.md"
    - "docs/polyphony_concept.md"
    - "docs/notes/backlog-legacy/feature-candidates.md"
    - "docs/notes/backlog-legacy/working-system-roadmap-matrix-2026-03-26.md"
    - "docs/adr/ADR-2026-03-23-plan-mode-decision-gate.md"
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

- None after `spec-compact`.
- Resolved by `spec-compact`: first incident classes are `runtime_availability`, `operator_access`, `reporting_freshness`, `release_or_rollback`, `model_readiness`, `governance_or_safety_escalation`, and `support_process_gap`.
- Resolved by `spec-compact`: recovery actions are either `human_only` or `owner_routed`; support procedures may never perform privileged control by direct DB writes, raw shell, hidden credentials or bypassing `F-0013` / `F-0024` / `F-0026` owner gates.
- Resolved by `spec-compact`: support evidence is a reference ledger over canonical owner evidence, report runs, release evidence and operator-auth provenance; it is not a replacement source of truth for those owners.

## 3. Requirements & Acceptance Criteria (SSoT)

### Terms & thresholds

- `support contract`: the canonical operational promise for how an operator detects, triages, escalates, evidences and closes system incidents without relying on tribal knowledge.
- `runbook`: a bounded procedure for one incident class. It names detection signals, triage reads, allowed actions, forbidden shortcuts, escalation owner, evidence to collect and closure criteria.
- `incident class`: a stable category used by support procedures and evidence bundles. The first required classes are:
  - `runtime_availability`
  - `operator_access`
  - `reporting_freshness`
  - `release_or_rollback`
  - `model_readiness`
  - `governance_or_safety_escalation`
  - `support_process_gap`
- `incident severity`: `warning` or `critical` for the first implementation. `warning` requires operator attention and bounded evidence; `critical` requires explicit escalation and cannot be closed without an owner-routed or human-only disposition.
- `support evidence bundle`: a durable support-owned record that links one incident/support event to canonical source refs, report-run refs, operator-auth evidence refs, release/rollback evidence refs, actions taken, escalation refs and closure notes.
- `owner-routed action`: a recovery or escalation action requested through an existing canonical owner seam, such as `F-0013` operator API protected by `F-0024`, `F-0026` release/rollback service, `F-0016` governor gates or later explicit owners.
- `human-only action`: an action that the support contract may document and require human decision/evidence for, but must not automate in this feature.
- `operational closure`: an incident/support event is closed only when the runbook closure criteria and support evidence bundle are complete, not merely because a command stopped failing.

### Policy decisions

- **PD-F0028-01:** `F-0028` owns support contracts, incident taxonomy, runbook boundaries and support evidence bundles only. It does not own runtime, reporting, auth, release, governor, lifecycle or perimeter source truth.
- **PD-F0028-02:** Support evidence bundles store references to canonical evidence and bounded operator notes. They may not duplicate release state, reporting state, lifecycle facts, auth decisions or governor decisions as a second source of truth.
- **PD-F0028-03:** All privileged recovery actions are classified as either `owner_routed` or `human_only`. `F-0028` may document and request actions, but it may not bypass the route owner, caller admission, release service, governor gate or future perimeter owner.
- **PD-F0028-04:** The first support contract consumes `F-0023` report surfaces and `F-0026` release evidence read-only for support closure. Raw foreign table reads, unlinked shell logs and operator memory are not sufficient closure evidence.
- **PD-F0028-05:** A repo-level ADR is not required for this spec because no shared runtime/startup/deployment contract changes during shaping. A repo-level ADR or change-proposal becomes required if implementation introduces a new support control plane, new deployment/executor authority or cross-feature write ownership.

### Acceptance criteria

- **AC-F0028-01:** `F-0028` is the only canonical owner for the support / operability contract, first incident taxonomy, runbook boundary and support evidence bundle shape for `CF-026`.
- **AC-F0028-02:** `F-0028` does not create a second gateway, control plane, release executor, reporting source, auth source or governor/perimeter decision ledger.
- **AC-F0028-03:** The first incident taxonomy includes `runtime_availability`, `operator_access`, `reporting_freshness`, `release_or_rollback`, `model_readiness`, `governance_or_safety_escalation` and `support_process_gap`.
- **AC-F0028-04:** Every runbook must name detection signals, triage reads, allowed actions, forbidden shortcuts, escalation owner, evidence requirements and closure criteria.
- **AC-F0028-05:** Runbooks consume `F-0013` operator API and `F-0024` caller-admission evidence through bounded route/read contracts; they must not require direct database reads, unauthenticated operator calls or secret-bearing manual shortcuts as normal operation.
- **AC-F0028-06:** Runbooks consume `F-0023` report surfaces and report-run evidence read-only for health, freshness and diagnostic support closure; support procedures must not use raw owner tables as a substitute reporting surface.
- **AC-F0028-07:** Runbooks consume `F-0026` release/deploy/rollback evidence read-only for release incidents; they must not execute rollback or mutate release state outside the `F-0026` service.
- **AC-F0028-08:** Support evidence bundles record incident class, severity, source refs, report-run refs when applicable, release/rollback refs when applicable, operator principal/session/evidence refs when applicable, action attempts, escalation refs, closure criteria and timestamped operator notes.
- **AC-F0028-09:** Support evidence must redact plaintext credentials, bearer tokens, local secret values and reusable operator secrets from runbooks, logs, notes, report payloads and test snapshots.
- **AC-F0028-10:** Recovery and escalation actions are explicitly classified as `owner_routed` or `human_only`; no action may be treated as executable by support tooling unless the target owner seam admits it.
- **AC-F0028-11:** Critical incidents cannot be closed without either owner-routed evidence showing terminal resolution or a human-only disposition with explicit residual risk and next owner.
- **AC-F0028-12:** Missing, stale or unavailable canonical evidence blocks or degrades support closure explicitly; support tooling must not silently relabel stale reports, failed releases or unavailable auth evidence as healthy.
- **AC-F0028-13:** Support procedures must preserve neighboring ownership: no direct writes to runtime identity, reporting, auth, release, governor, lifecycle, model-serving or perimeter source tables.
- **AC-F0028-14:** The feature defines a downstream usage audit proving support consumers use canonical `F-0013`, `F-0023`, `F-0024` and `F-0026` surfaces instead of raw foreign reads or ad hoc logs.
- **AC-F0028-15:** If implementation changes runtime/startup/deployment behavior, public operator routes or protected side-effect paths, closure must include root quality gates and `pnpm smoke:cell`.

## 4. Non-functional requirements (NFR)

- **Evidence completeness:** `100%` of closed support evidence bundles include incident class, severity, source refs, action/escalation refs and closure criteria.
- **Owner-boundary safety:** direct support-owned writes to runtime identity, reporting, auth, release, governor, lifecycle, model-serving or perimeter source surfaces budget: `0`.
- **Runbook coverage:** every first-phase incident class has at least one runbook before implementation closure.
- **Secret hygiene:** plaintext credential or reusable secret observations in support evidence, runbooks, logs, reports or tests budget: `0`.
- **Closure safety:** critical incidents closed without terminal owner-routed evidence or explicit human-only residual-risk disposition budget: `0`.
- **Freshness signaling:** stale or unavailable report/release/auth evidence must surface as degraded or blocked support closure, not as healthy support state.
- **Operator ergonomics:** runbooks must be executable by an operator using canonical commands/routes and linked artifacts without reconstructing hidden context from chat history.

## 5. Design (compact)

### 5.1 API surface

- `F-0028` does not own a new public API framework or gateway.
- First implementation may expose support evidence and runbook reads through one of these routes, but only inside the existing `F-0013` Hono namespace and behind `F-0024` caller admission:
  - `GET /support/runbooks`
  - `GET /support/incidents`
  - `POST /support/incidents`
  - `PATCH /support/incidents/:id`
- If support APIs are deferred, the first implementation may use repo-owned runbook documents plus internal support evidence storage/CLI, but it must preserve the same contracts and not create a hidden operational source.
- Support API/write behavior, if delivered, is limited to support-owned evidence rows and operator notes. It may only link to foreign owner refs; it must not mutate release, reporting, auth, governor, lifecycle or runtime state.

```ts
type IncidentClass =
  | "runtime_availability"
  | "operator_access"
  | "reporting_freshness"
  | "release_or_rollback"
  | "model_readiness"
  | "governance_or_safety_escalation"
  | "support_process_gap";

type IncidentSeverity = "warning" | "critical";

type SupportActionMode = "owner_routed" | "human_only";

type SupportEvidenceBundle = {
  supportIncidentId: string;
  incidentClass: IncidentClass;
  severity: IncidentSeverity;
  sourceRefs: string[];
  reportRunRefs: string[];
  releaseRefs: string[];
  operatorEvidenceRefs: string[];
  actionRefs: Array<{ mode: SupportActionMode; owner: string; ref: string }>;
  escalationRefs: string[];
  closureStatus: "open" | "blocked" | "resolved" | "transferred";
  residualRisk: string | null;
  createdAt: string;
  closedAt: string | null;
};
```

### 5.2 Runtime / deployment surface

- Support evidence lives on the canonical repository runtime path: `Node.js 22 + TypeScript + Hono + PostgreSQL`, or as bounded repo-local artifacts if the first slice is docs-only.
- No second scheduler, support daemon, sidecar, shell wrapper control plane or deployment runtime is introduced by this feature.
- If support evidence storage is implemented, it may own support-specific rows only:
  - `support_incidents`
  - `support_evidence_refs`
  - `support_action_records`
  - `support_runbook_versions`
- Support actions that request effects must call owner seams:
  - operator reads/control through `F-0013` and `F-0024`;
  - release/rollback actions through `F-0026`;
  - governor actions through `F-0016` when available;
  - perimeter/human-override actions only through future explicit owner seams.
- Runtime/startup/deployment-affecting changes trigger the canonical quality gate order and container smoke path before implementation closure.

### 5.3 Data model changes

- Support-owned data is derivative and procedural:
  - incident class/severity;
  - runbook version;
  - linked canonical evidence refs;
  - action/escalation refs;
  - operator notes with secret redaction;
  - closure status and residual risk.
- Foreign owner refs must remain refs:
  - report run ids from `F-0023`;
  - release/deploy/rollback ids from `F-0026`;
  - trusted ingress/auth evidence refs from `F-0024`;
  - operator route/action refs from `F-0013`;
  - governor/lifecycle/perimeter refs only when those owners expose them.
- Support storage must not denormalize foreign source state as authoritative operational truth. A cached display summary is allowed only when it carries source ref, freshness and non-authoritative status.

### 5.4 Edge cases and failure modes

- Report evidence is stale or unavailable during support closure.
- Release evidence shows failed smoke, failed rollback or missing rollback plan.
- Auth evidence is missing, denied, expired or unavailable for a protected operator action.
- Operator has runbook instructions but the target owner seam refuses or is unavailable.
- A critical incident requires a human-only action and cannot be fully resolved by current owner seams.
- Support evidence storage fails after an owner-routed action succeeds.
- A runbook step would require direct SQL/shell/secret access; this must be represented as a forbidden shortcut or human-only emergency path, not normal procedure.
- A support process gap is discovered because no runbook covers an incident class; this becomes its own incident class and backlog/source-review input if the gap changes backlog truth.

### 5.5 Verification surface / initial verification plan

- Contract tests for incident class, severity, support evidence and action-mode vocabulary.
- Runbook lint/contract tests proving every first-phase incident class has detection, triage, action, escalation, evidence and closure sections.
- Boundary tests proving support code writes only support-owned evidence rows/artifacts and never mutates reporting, auth, release, governor, lifecycle, model-serving or runtime owner surfaces.
- Integration tests proving support closure consumes `F-0023` report refs and `F-0026` release refs read-only.
- Auth/RBAC integration tests if support routes are exposed through `F-0013`, proving `F-0024` caller admission before support evidence writes.
- Negative tests for stale reports, missing release evidence, unauthorized operator actions and critical incidents without terminal closure evidence.
- Dossier verification during `spec-compact`: `dossier-engineer dossier-verify --step spec-compact --dossier docs/ssot/features/F-0028-support-operability-contract-incident-discipline.md`.
- Implementation verification must include root quality gates and `pnpm smoke:cell` if runtime/startup/deployment or protected side-effect behavior changes.

### 5.6 Representation upgrades (triggered only when needed)

#### Boundary operations

| Operation | Success behavior | Invalid / dependency failure | Duplicate / retry behavior |
|---|---|---|---|
| Open support incident | Creates one support-owned evidence bundle with class, severity and canonical source refs. | Fails or remains blocked when class/severity/source refs are missing. | Equivalent request id reuses the same incident record. |
| Attach canonical evidence | Adds report/release/auth/operator refs without copying foreign source truth. | Marks support evidence blocked/degraded when the ref is stale, missing or unavailable. | Reattaching the same ref is idempotent. |
| Record owner-routed action | Stores a ref to the owner-seam request/result. | Refuses direct action recording when no owner seam admits the action. | Replayed action refs do not create duplicate effects. |
| Close incident | Records closure criteria, terminal evidence or human-only residual-risk disposition. | Critical incidents without terminal evidence or residual-risk disposition remain open/blocked. | Closure replay returns existing terminal state. |

#### Owner / consumer matrix

| Concern | Canonical owner | `F-0028` relation |
|---|---|---|
| Operator HTTP boundary and bounded route contracts | `F-0013` | Consumes routes/read contracts; may expose support routes only inside this boundary. |
| Report families and report-run evidence | `F-0023` | Consumes read-only for support diagnosis and closure. |
| Caller admission, RBAC and trusted ingress evidence | `F-0024` | Consumes for operator identity/action provenance; never treats RBAC as approval authority. |
| Release/deploy/rollback facts and evidence | `F-0026` | Consumes read-only and routes release/rollback actions through the release owner. |
| Governor actions and decisions | `F-0016` | Consumes owner decisions/refs when available; does not write governor truth. |
| Lifecycle/rollback history | `F-0019` / `F-0026` evidence refs | Consumes summaries/refs; does not invent lifecycle history. |
| Perimeter and human override policy | `F-0018` / future explicit seams | Human-only or owner-routed; support does not become perimeter owner. |
| Support runbooks and incident evidence | `F-0028` | Owns taxonomy, procedures and support evidence references. |

### 5.7 Definition of Done

- `F-0028` owns a canonical support contract with first incident taxonomy and runbook boundaries.
- Every first-phase incident class has a runbook with detection, triage, action, escalation, evidence and closure criteria.
- Support evidence bundles link canonical report, release, auth/operator and owner-action refs without duplicating foreign source truth.
- Critical incident closure requires terminal owner-routed evidence or explicit human-only residual-risk disposition.
- Boundary tests prove support code does not write neighboring source surfaces.
- Dossier/index/backlog truth remains aligned, and `CF-026` is actualized through the current workflow stage.

### 5.8 Rollout / activation note (triggered only when needed)

- First activation should be read-mostly: publish runbooks, incident taxonomy and support evidence contract before adding any support-write API.
- Support evidence writes may activate after auth/RBAC admission is available and tests prove foreign owner surfaces remain read-only.
- Owner-routed actions must stay disabled/unavailable until the target owner seam exposes a supported route/service and caller admission passes.
- Emergency human-only steps may be documented, but they are not automated and must carry residual-risk/evidence requirements.
- If implementation introduces support API routes or changes protected operator exposure, root gates plus container smoke are required before implementation closure.

## 6. Slicing plan (2–6 increments)

### Spec-compact decisions

- **SD-F0028-01:** `F-0028` owns support evidence references and runbook procedure truth, not the underlying operational source state.
- **SD-F0028-02:** First incident taxonomy is fixed at seven classes: runtime availability, operator access, reporting freshness, release/rollback, model readiness, governance/safety escalation and support process gap.
- **SD-F0028-03:** Recovery actions are never implicit support authority. They are either owner-routed through an existing seam or human-only with explicit residual-risk evidence.
- **SD-F0028-04:** No repo-level ADR is required at spec time; future implementation must escalate to change-proposal/ADR if it creates a support control plane or changes shared runtime/deployment ownership.

### Plan-slice decisions

- **PL-F0028-01:** Plan mode was assessed before `plan-slice` and is not required. The spec already fixes the read-mostly-first support seam, canonical upstream owners, support evidence as refs, owner-routed/human-only actions and the no-control-plane boundary.
- **PL-F0028-02:** The first implementation target is one complete support/operability seam, not a docs-only placeholder: taxonomy, runbook contract, first runbooks, support evidence bundle contract/storage or artifact persistence, canonical surface consumption, action boundary handling and negative evidence gates.
- **PL-F0028-03:** Implementation order is contract first, evidence substrate second, canonical surface consumption third, action boundary fourth, and operational docs/closure evidence last. Runtime/API activation is allowed only after the contract and negative evidence gates exist.
- **PL-F0028-04:** A repo-level ADR is still not required for the planned path. Change-proposal or ADR becomes required before implementation continues if the work introduces a support control plane, shared executor authority, deployment ownership change or cross-feature write authority.
- **PL-F0028-05:** Support APIs, if implemented, remain inside the existing `F-0013` Hono operator boundary and behind `F-0024` caller admission. `F-0028` must not introduce a second gateway, scheduler or privileged support runtime.
- **PL-F0028-06:** Policy/admission risk is applicable for implementation planning. Declared families are `admission`, `replay`, `evidence` and `runtime-gating`; `release-policy` is excluded because `F-0028` consumes and routes release evidence/actions through `F-0026` but does not own release policy.

### Execution target

Implementation must deliver a complete `F-0028` support/operability seam:

- incident taxonomy, severity vocabulary and runbook schema;
- runbooks for all first-phase incident classes;
- support evidence bundle contract plus support-owned storage or artifact persistence;
- redaction, blocked/degraded closure and critical-incident closure semantics;
- read-only consumption of canonical `F-0013`, `F-0023`, `F-0024` and `F-0026` surfaces;
- owner-routed/human-only recovery action classification and fail-closed action routing;
- downstream usage audit and negative evidence proving no raw foreign reads/writes or hidden operator shortcuts.

Completion is recognized only when acceptance criteria are covered by tests, runbooks, usage-audit evidence and dossier closure artifacts. If implementation changes runtime/startup/deployment behavior, public operator routes or protected side-effect paths, closure must include the root gates and `pnpm smoke:cell`.

### Implementation boundaries

- Do not create a second gateway, support control plane, scheduler, sidecar or shell-wrapper runtime.
- Do not make direct database reads, raw shell access, hidden credentials or unauthenticated operator calls part of normal support operation.
- Do not mutate release, reporting, auth, governor, lifecycle, model-serving, runtime or perimeter source truth.
- Do not execute rollback/release actions outside `F-0026`.
- Do not mark owner-routed actions successful unless the target owner seam admits the action and returns durable evidence.

### Dependency visibility

- **Depends on `F-0013`:** operator route namespace and bounded route contract. Unblock condition: support routes, if implemented, are added inside the existing Hono operator API boundary instead of a new gateway.
- **Depends on `F-0023`:** report families and report-run evidence. Unblock condition: support closure reads report refs/read models only and records stale/unavailable report evidence as degraded or blocked.
- **Depends on `F-0024`:** caller admission, RBAC and trusted ingress evidence. Unblock condition: every support write or protected action path proves caller admission before mutation.
- **Depends on `F-0026`:** release/deploy/rollback facts and rollback orchestration. Unblock condition: support runbooks consume release evidence read-only and route release/rollback actions through the release owner.

### SL-F0028-01: Support taxonomy and runbook contract

- **Result:** incident class/severity taxonomy, runbook schema, owner/consumer matrix and first runbook skeletons.
- Depends on: `F-0013`, `F-0023`, `F-0024`, `F-0026` as named upstream owners in the runbook owner/consumer matrix; unblocks when every runbook names which owner seam supplies detection, triage, action or evidence.
- **Primary files:** `packages/contracts/src/support.ts`, `packages/contracts/src/index.ts`, `docs/support/runbooks/_template.md`, `docs/support/runbooks/*.md`.
- **Covers:** AC-F0028-01, AC-F0028-03, AC-F0028-04, AC-F0028-10.
- **Verification:** `packages/contracts/test/support.contract.test.ts`, runbook required-section lint/contract coverage for every first-phase incident class.

### SL-F0028-02: Support evidence bundle substrate

- **Result:** support evidence bundle contract, support-owned persistence rows or artifact format, source/action refs, closure states and secret redaction.
- Depends on: `F-0023`, `F-0024`, `F-0026` ref vocabularies; unblocks when support persistence can store refs/freshness without copying foreign source truth.
- **Primary files:** `packages/db/src/support.ts`, `infra/migrations/028_support_incidents.sql`, `apps/core/src/support/support-evidence.ts`.
- **Covers:** AC-F0028-02, AC-F0028-08, AC-F0028-09, AC-F0028-11, AC-F0028-12, AC-F0028-13.
- **Verification:** `packages/db/test/support-store.integration.test.ts`, `apps/core/test/support/support-evidence.contract.test.ts`, redaction and blocked/critical closure negative tests.

### SL-F0028-03: Canonical surface consumption

- **Result:** support procedures and usage audit over `F-0013`, `F-0023`, `F-0024` and `F-0026` without raw foreign reads.
- Depends on: delivered read contracts from `F-0013`, `F-0023`, `F-0024` and `F-0026`; unblocks when integration tests prove support consumes canonical refs read-only.
- **Primary files:** `apps/core/src/support/support-evidence.ts`, `apps/core/src/support/support-canonical-refs.ts`, support docs and usage-audit evidence.
- **Covers:** AC-F0028-05, AC-F0028-06, AC-F0028-07, AC-F0028-14.
- **Verification:** `apps/core/test/support/support-canonical-refs.integration.test.ts`, `apps/core/test/support/support-usage-audit.contract.test.ts`, read-only report/release/auth/operator ref assertions.

### SL-F0028-04: Escalation and recovery boundaries

- **Result:** owner-routed/human-only action handling, critical incident closure rules and forbidden-shortcut coverage.
- Depends on: `F-0013` and `F-0024` for admitted operator action requests, `F-0026` for release/rollback requests, and `F-0016` where governor actions are available; unblocks when unavailable or refusing owner seams keep support actions non-executable.
- **Primary files:** `apps/core/src/platform/operator-api.ts`, `packages/contracts/src/operator-api.ts`, `apps/core/src/support/support-actions.ts`, `docs/support/runbooks/*.md`.
- **Covers:** AC-F0028-05, AC-F0028-10, AC-F0028-11, AC-F0028-12, AC-F0028-13.
- **Verification:** `apps/core/test/platform/operator-support.integration.test.ts`, `apps/core/test/support/support-action-boundary.contract.test.ts`, negative tests for unauthorized actions, direct writes, unavailable owner seams and unresolved critical closure.

### SL-F0028-05: Operational docs, coverage and closure evidence

- **Result:** final runbook set, support usage audit, coverage map updates, docs/config notes and required runtime/smoke gates if support APIs or protected side effects are introduced.
- Depends on: completion evidence from `SL-F0028-01` through `SL-F0028-04`; unblocks when all AC coverage, policy/admission negative rows and triggered root/smoke gates are present.
- **Primary files:** `README.md`, `docs/architecture/system.md`, `docs/support/runbooks/*.md`, `docs/ssot/features/F-0028-support-operability-contract-incident-discipline.md`.
- **Covers:** AC-F0028-01 through AC-F0028-15.
- **Verification:** dossier verification, debt/coverage audits, `pnpm format`, `pnpm typecheck`, `pnpm lint`, focused tests, and `pnpm smoke:cell` when runtime/startup/deployment or protected side-effect behavior changes.

## 7. Task list (implementation units)

- **T-F0028-01** (`SL-F0028-01`): Define incident class/severity taxonomy, runbook schema and owner/consumer matrix. Covers: AC-F0028-01, AC-F0028-03, AC-F0028-04.
- **T-F0028-02** (`SL-F0028-01`): Add first runbook skeletons for all first-phase incident classes. Covers: AC-F0028-03, AC-F0028-04.
- **T-F0028-03** (`SL-F0028-02`): Define support evidence bundle contract, secret-redaction rules and blocked/critical closure states. Covers: AC-F0028-08, AC-F0028-09, AC-F0028-11, AC-F0028-12.
- **T-F0028-04** (`SL-F0028-02`): Add support-owned storage or artifact persistence for incident evidence without foreign source writes. Covers: AC-F0028-02, AC-F0028-08, AC-F0028-13.
- **T-F0028-05** (`SL-F0028-03`): Wire read-only consumption of `F-0023` report refs and `F-0026` release/rollback refs for support closure. Covers: AC-F0028-06, AC-F0028-07, AC-F0028-14.
- **T-F0028-06** (`SL-F0028-03`): Add `F-0013` / `F-0024` operator provenance consumption for support actions and evidence. Covers: AC-F0028-05, AC-F0028-09, AC-F0028-14.
- **T-F0028-07** (`SL-F0028-04`): Implement owner-routed/human-only action classification and negative coverage for forbidden direct recovery shortcuts. Covers: AC-F0028-10, AC-F0028-13.
- **T-F0028-08** (`SL-F0028-04`): Add critical incident closure rules requiring terminal owner evidence or human-only residual-risk disposition. Covers: AC-F0028-11, AC-F0028-12.
- **T-F0028-09** (`SL-F0028-05`): Finalize support docs, coverage map, usage audit and required quality/smoke verification if runtime/API behavior changed. Covers: AC-F0028-01 through AC-F0028-15.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0028-01 | `packages/contracts/test/support.contract.test.ts`; `docs/support/runbooks/**` | implemented |
| AC-F0028-02 | `packages/db/test/support-store.integration.test.ts`; `apps/core/test/support/support-usage-audit.contract.test.ts` | implemented |
| AC-F0028-03 | `packages/contracts/test/support.contract.test.ts` | implemented |
| AC-F0028-04 | `packages/contracts/test/support.contract.test.ts`; `docs/support/runbooks/*.md` | implemented |
| AC-F0028-05 | `apps/core/test/platform/operator-support.integration.test.ts` | implemented |
| AC-F0028-06 | `apps/core/test/support/support-canonical-refs.integration.test.ts` | implemented |
| AC-F0028-07 | `apps/core/test/support/support-canonical-refs.integration.test.ts` | implemented |
| AC-F0028-08 | `apps/core/test/support/support-evidence.contract.test.ts`; `packages/db/test/support-store.integration.test.ts` | implemented |
| AC-F0028-09 | `apps/core/test/support/support-evidence.contract.test.ts`; `packages/contracts/test/support.contract.test.ts` | implemented |
| AC-F0028-10 | `apps/core/test/support/support-action-boundary.contract.test.ts` | implemented |
| AC-F0028-11 | `apps/core/test/support/support-evidence.contract.test.ts`; `packages/contracts/test/support.contract.test.ts` | implemented |
| AC-F0028-12 | `apps/core/test/support/support-canonical-refs.integration.test.ts`; `packages/contracts/test/support.contract.test.ts` | implemented |
| AC-F0028-13 | `apps/core/test/support/support-action-boundary.contract.test.ts`; `packages/db/test/support-store.integration.test.ts`; `apps/core/test/support/support-usage-audit.contract.test.ts` | implemented |
| AC-F0028-14 | `apps/core/test/support/support-usage-audit.contract.test.ts` | implemented |
| AC-F0028-15 | `pnpm format`; `pnpm typecheck`; `pnpm lint`; targeted support tests; `pnpm test`; `pnpm smoke:cell` | implemented |

## 9. Decision log (ADR blocks)

### 2026-04-29: Plan mode assessment

- Decision: Plan mode was assessed and not required before this `spec-compact`.
- Rationale: `CF-026` has a fixed single-item boundary from intake and source materials. The spec has no competing ownership split after `F-0013`, `F-0023`, `F-0024` and `F-0026` are treated as canonical upstream owners; the remaining shaping work is requirement extraction, evidence boundaries and runbook taxonomy rather than a user-facing product fork or repo-level ADR.
- ADR impact: no repo-level ADR required at spec time. Change-proposal or ADR is required later only if implementation changes shared runtime/deployment ownership, introduces a new support control plane or changes cross-feature write authority.

### 2026-04-29: Support evidence is a reference ledger

- Decision: support evidence bundles store references and support-owned notes, not copied source truth.
- Rationale: support needs durable closure evidence, but reporting, release, auth, governor, lifecycle and runtime owners must remain authoritative for their domains.
- Alternatives: Store full operational snapshots in support records; require operators to inspect raw foreign tables.
- Consequences: support closure is auditable without creating a shadow operational state source.

### 2026-04-29: Recovery actions are routed or human-only

- Decision: every recovery/escalation action is classified as `owner_routed` or `human_only`.
- Rationale: support discipline should make action authority explicit and prevent runbooks from becoming a bypass around auth, release, governor or perimeter owners.
- Alternatives: Let support tooling run direct shell/SQL recovery commands as a convenience.
- Consequences: implementation must prove forbidden shortcuts are not the normal operational path.

### 2026-04-29: Plan-slice policy/admission classification

- Decision: policy/admission risk profile is `applicable` for implementation planning.
- Declared risk families: `admission`, `replay`, `evidence`, `runtime-gating`.
- Rationale: planned support evidence writes and optional support operator routes require caller admission; incident/evidence operations must be idempotent under retry; incident closure depends on durable evidence/freshness; owner-routed recovery actions must fail closed when owner seams deny or are unavailable.
- Excluded family: `release-policy`, because `F-0028` does not control rollout, deployment gates, rollback policy or operator release approvals. Release and rollback actions stay routed through `F-0026`.

| AC | Risk | Negative test | Production path | Evidence |
|---|---|---|---|---|
| AC-F0028-05 | admission | Unauthenticated or unauthorized support evidence write is denied before handler mutation. | `F-0013` support route guarded by `F-0024` caller admission. | `apps/core/test/platform/operator-support.integration.test.ts` |
| AC-F0028-08 | replay | Duplicate incident open or evidence attach with the same request/ref is idempotent and conflicting replay is rejected. | Support incident/evidence write path. | `apps/core/test/support/support-evidence.contract.test.ts` |
| AC-F0028-11 | evidence | Critical incident close without terminal owner evidence or human-only residual-risk disposition remains blocked. | Support incident close path. | `apps/core/test/support/support-evidence.contract.test.ts` |
| AC-F0028-10 | runtime-gating | Owner-routed recovery action is unavailable when the target owner seam refuses or lacks capability. | Support action routing to `F-0013`, `F-0026` and `F-0016` owner seams. | `apps/core/test/support/support-action-boundary.contract.test.ts` |
| AC-F0028-12 | evidence | Stale or missing report/release/auth evidence blocks or degrades support closure. | Support closure evidence validation. | `apps/core/test/support/support-canonical-refs.integration.test.ts` |

## 10. Progress & links

- Backlog item key: CF-026
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Issue:
- PRs:

## 11. Change log

- 2026-04-29: Initial dossier created from backlog item `CF-026` at backlog delivery state `defined`.
- 2026-04-29: [spec-compact] [scope realignment] Shaped `CF-026` into a support/operability contract with first incident taxonomy, support evidence bundle semantics, runbook boundaries, owner-routed/human-only recovery action classification and explicit read-only consumption of operator/reporting/auth/release surfaces.
- 2026-04-29: [plan-slice] [dependency realignment] Planned implementation order, execution target, slice ownership, dependency visibility, verification map and applicable policy/admission negative matrix for `admission`, `replay`, `evidence` and `runtime-gating`.
- 2026-04-29: [implementation] Delivered support contracts, runbooks, support-owned PostgreSQL incident storage, protected support operator routes, canonical ref evaluation, action boundary handling, usage audit coverage and negative evidence gates.
