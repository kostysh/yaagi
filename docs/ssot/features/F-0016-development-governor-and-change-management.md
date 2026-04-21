---
id: F-0016
title: Development Governor и управление изменениями
status: done
coverage_gate: strict
owners: ["@codex"]
area: governance
depends_on: ["F-0004", "F-0011", "F-0012", "F-0013", "F-0015"]
impacts: ["runtime", "db", "governance", "api", "models", "workspace", "workshop"]
created: 2026-04-10
updated: 2026-04-10
links:
  issue: ""
  pr: []
  docs:
    - "docs/architecture/system.md"
    - "docs/ssot/features/F-0004-subject-state-kernel-and-memory-model.md"
    - "docs/ssot/features/F-0011-narrative-and-memetic-reasoning-loop.md"
    - "docs/ssot/features/F-0012-homeostat-and-operational-guardrails.md"
    - "docs/ssot/features/F-0013-operator-http-api-and-introspection.md"
    - "docs/ssot/features/F-0014-expanded-model-ecology-and-registry-health.md"
    - "docs/ssot/features/F-0015-workshop-datasets-training-eval-and-promotion.md"
    - "docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md"
---

# F-0016 Development Governor и управление изменениями

## 1. Context & Goal

- **Backlog handoff:**
  - Backlog item key: CF-016
  - Backlog delivery state at intake: defined
  - Source traceability:
    - docs/architecture/system.md
    - docs/polyphony_concept.md
    - docs/notes/backlog-legacy/feature-candidates.md
    - docs/notes/backlog-legacy/working-system-roadmap-matrix-2026-03-26.md
  - Known blockers at intake:
    - none recorded
  - Known dependencies at intake:
    - CF-003
    - CF-005
    - CF-008
- **User problem:** После поставки `F-0004`, `F-0011`, `F-0012`, `F-0013` и `F-0015` система уже умеет хранить identity-bearing state, публиковать advisory homeostat signals, держать bounded operator control routes и вести workshop candidate lifecycle, но у неё всё ещё нет одного канонического owner-а для development governance. Без такого seam-а freeze decisions, proposal intake, approval evidence и rollback-linked governance truth начинают расползаться между runtime, operator API, workshop и ad hoc helper writes.
- **Goal:** Зафиксировать один canonical dossier-owner для `Development Governor`, который владеет governor-side writable surfaces, bounded operator-route handoff contracts, bounded internal evidence/proposal gates, durable approval records и rollback-linked governance evidence, но не забирает ownership над workshop lifecycle, operator HTTP framework boundary, caller admission/RBAC, richer model source state, reporting read models, release orchestration или body-evolution execution.
- **Non-goals:** Эта фича не реализует body/code mutation execution (`CF-012`), read-only reporting materialization (`CF-015`), specialist rollout/retirement policy (`CF-019`), deploy/release execution (`CF-025`), public auth/RBAC (`CF-024`) или mature policy-profile completion (`CF-027`). Она также не должна создавать второй rollout regime рядом с router, workshop или release seams.
- **Current substrate / baseline:** Delivered prerequisites already exist as `F-0004` subject-state kernel, `F-0011` narrative/memetic seam, `F-0012` advisory homeostat requests, `F-0013` bounded operator control routes and `F-0015` workshop candidate lifecycle truth. The repo-level runtime substrate is already fixed by `ADR-2026-03-25`: `AI SDK + Hono + repo-owned runtime/governance`, so governor behavior must stay repo-owned rather than framework-owned.

## 2. Scope

### In scope

- Canonical owner for governor-side writable surfaces:
  - `development_ledger`
  - durable proposal records
  - durable proposal-decision records
  - durable development-freeze records and current freeze state
- Bounded operator-facing submission surfaces for:
  - `POST /control/freeze-development`
  - `POST /control/development-proposals`
- Bounded internal governor gates through which runtime, recovery, workshop, homeostat and human override submit evidence, incidents, proposal requests or downstream execution outcomes without writing governor tables directly.
- Canonical proposal classes and proposal-state lifecycle for:
  - model adaptation
  - specialist model birth/promotion
  - code/body change
  - policy change
- Auto-freeze policy execution with durable provenance and evidence.
- Advisory approval semantics with explicit separation between `governor approves` and `downstream owner executes`.
- Canonical governor evidence for `F-0012` `development_proposal_rate` and freeze-policy consumption.

### Out of scope

- Direct execution of approved code/body changes, writable worktree orchestration or stable snapshot production; those remain `CF-012`.
- Direct live activation of model candidates, active profile pointer mutation or richer model-registry writes; those remain with `F-0008`, `F-0014`, `F-0015` and later `CF-019`.
- Release promotion, deploy orchestration, environment rollout and rollback execution; those remain `CF-025`.
- Public governor read/introspection API beyond the two bounded submission routes above.
- Public thaw/unfreeze route in this phase.
- Operator authN/authZ or route-level RBAC; those remain `CF-024`.

### Constraints

- Only `F-0016` may write governor-owned proposal, decision, ledger or freeze surfaces.
- `F-0013` remains the owner of the HTTP boundary and route contracts; `F-0016` owns the underlying governor semantics and durable writes behind those routes.
- `F-0012` may publish advisory freeze requests and read governor evidence, but it may not execute freeze state or write proposal rows directly.
- `F-0015` remains the canonical owner of workshop candidate lifecycle truth. Governor consumes candidate rows, stage events and promotion-package evidence; it must not clone that lifecycle into a second rollout state machine.
- `F-0016` approvals are advisory in this phase. Approval may authorize downstream execution, but it may not directly mutate foreign execution surfaces.
- All external and internal write paths must preserve provenance, evidence refs, idempotency and rollback linkage where applicable.
- The seam must stay inside the canonical repo substrate `Node.js 22 + TypeScript + AI SDK + Hono + PostgreSQL`; framework-owned governance abstractions are forbidden.

### Assumptions

- `F-0013` continues to expose the operator HTTP namespace and may delegate the two bounded control routes to the governor gate only after `CF-024` delivers caller admission for those high-risk public paths.
- `F-0015` continues to expose canonical candidate/package evidence and does not require governor to infer workshop truth from raw artifacts.
- Downstream execution seams (`CF-012`, `CF-019`, `CF-025`) will later emit bounded execution-outcome evidence that governor can consume without becoming the executor.

### Open questions

- None before implementation.

### Plan-slice decisions

- `PD-F0016-01` resolves `OQ-F0016-01`: `F-0016` uses the existing `F-0012` `development_proposal_rate` semantics as the first policy anchor instead of inventing a second threshold scale. `warning >= 3` remains advisory evidence only and never freezes development by itself. `critical >= 6` plus a valid `FREEZE_DEVELOPMENT_PROPOSALS` requested action may create a `policy_auto` freeze through the governor write gate when provenance/evidence is present and no active freeze already exists.
- `PD-F0016-02` resolves `OQ-F0016-02`: before `CF-012`, `CF-019` and `CF-025` deliver their execution seams, execution-outcome intake is limited to governor-owned evidence records from `human_override` and future owner-routed seams. It may move a governor proposal to `executed` or `rolled_back` only when the evidence contains stable `proposalId`, target refs and evidence refs. Governor still does not execute code, activate models, mutate release state or mutate body/worktree state.
- Planning-mode assessment: Codex Plan mode was not required for this `plan-slice` because `F-0016` was already shaped, no `before_planned` open question remained unresolved after the two decisions above, and this stage produces a forecast implementation plan rather than code execution.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0016-01:** `F-0016` is the only canonical writer for `development_ledger`, governor-side proposal records, governor-side decision records and development-freeze state.
- **AC-F0016-02:** Runtime, recovery, workshop, homeostat and human override may reach governor-owned writable surfaces only through bounded governor gates; direct helper writes remain forbidden.
- **AC-F0016-03:** `F-0012` may publish advisory freeze requests and consume governor evidence for `development_proposal_rate`, but it may not execute freeze state or persist proposal rows.
- **AC-F0016-04:** The bounded operator-facing governor surface in this phase is reserved to exactly two submission routes: `POST /control/freeze-development` and `POST /control/development-proposals`; without `CF-024` caller admission those public routes remain explicit unavailable while the governor-owned internal gates stay live.
- **AC-F0016-05:** External proposal submission, once caller admission exists, is operator-only in this phase; until then, non-operator subsystem submission remains internal-first and owner-routed.
- **AC-F0016-06:** Every accepted external or internal governor write carries durable provenance, evidence refs and an idempotency key or request identity.
- **AC-F0016-07:** Governor supports exactly four canonical proposal classes in this phase: `model_adapter`, `specialist_model`, `code_change` and `policy_change`.
- **AC-F0016-08:** Governor may auto-freeze development according to policy, and every freeze decision is durable, attributable and replayable from PostgreSQL evidence.
- **AC-F0016-09:** Governor approval is advisory in this phase: `approved` authorizes downstream execution, but it does not directly mutate active model pointers, workshop lifecycle truth, deploy state or writable body state.
- **AC-F0016-10:** Governor consumes workshop candidate lifecycle evidence and downstream execution evidence without introducing a second rollout or activation state machine beside `F-0015`, `F-0014`, `CF-019` or `CF-025`.

## 4. Non-functional requirements (NFR)

Observable NFR signals and budgets:

- `governor_write_audit_coverage` threshold: 100% of accepted writes contain the required audit fields below.
- `governor_idempotency_duplicate_rows` budget: 0 duplicate durable rows for the same normalized `requestId`.
- `governor_boundary_violation_count` budget: 0 non-governor write call sites in boundary audit.

- **Auditability:** 100% of accepted governor writes persist `origin_surface`, `request_id`, `evidence_refs_json`, `created_at`, and for approval-bearing proposal classes a rollback-plan or rollback-link field; missing fields reject the write.
- **Idempotency:** Replaying the same normalized request with the same `requestId` returns exactly one canonical `freeze_id` or `proposal_id`; replaying a different normalized payload on the same `requestId` returns one conflict result and creates zero new durable rows.
- **Recoverability:** Restart/reclaim verification reconstructs the active freeze state and proposal/decision state from governor-owned PostgreSQL rows only, with zero process-local cache dependency.
- **Boundary safety:** Boundary tests and audit must find zero non-governor call sites that insert or update governor-owned writable surfaces through route handlers, runtime helpers or workshop helpers.

## 5. Design (compact)

### 5.1 Terms & thresholds

- `development freeze`: governor-owned durable state that blocks new development-change admission on the public submission surface until a later explicit lift path exists.
- `proposal class`: one of `model_adapter`, `specialist_model`, `code_change`, `policy_change`.
- `advisory approval`: governor decision `approved` that authorizes a downstream seam to execute, but is not itself the execution.
- `external submitter`: only the operator HTTP namespace in this phase.

### 5.2 Boundary operations

| Operation | Success behavior | Invalid / dependency failure | Duplicate / retry behavior |
|---|---|---|---|
| Operator freeze request | Creates or reuses one durable active freeze record and appends ledger evidence. | Rejects requests without provenance/evidence or when downstream persistence is unavailable. | Same `requestId` + same payload returns the same freeze record; same `requestId` + different payload fails conflict-closed. |
| Operator proposal submission | Creates one durable proposal in `submitted` state and appends ledger evidence. | Rejects unsupported `proposalKind`, missing rollback/evidence requirements, or submission while development is frozen. | Same `requestId` + same payload returns the same proposal record; conflicting replay fails. |
| Internal proposal request | Accepts bounded owner-routed proposal requests from runtime, recovery, workshop or human override and normalizes them into the same proposal lifecycle. | Rejects unknown source owner, missing provenance, or unavailable adjacent evidence needed for normalization. | Same idempotency key reuses the same normalized proposal record. |
| Internal evidence intake | Records incidents, freeze requests, candidate evidence, and execution outcomes without opening direct table-write authority to the caller. | Rejects unknown evidence kind, stale foreign refs, or missing provenance. | Replayed evidence with the same key deduplicates to one ledger/evidence record. |

### 5.3 API and internal contract surface

- Public operator surface (reserved at the `F-0013` boundary, explicit unavailable until `CF-024` caller admission exists):
  - `POST /control/freeze-development`
  - `POST /control/development-proposals`
- No public `GET` governor routes are introduced in this phase.
- Common write semantics:
  - `POST /control/development-proposals` is exposed only through the `F-0013`-owned Hono boundary; no other seam may publish a parallel HTTP surface for the same action;
  - every accepted write request must carry `requestId`;
  - idempotent replay returns the same canonical record;
  - conflicting replay on the same `requestId` fails closed;
  - route handlers may not write governor rows directly outside the governor owner gate.

Compact route contracts:

```ts
type FreezeDevelopmentRequest = {
  requestId: string;
  reason: string;
  evidenceRefs: string[];
  requestedBy: string;
};

type FreezeDevelopmentResponse =
  | {
      accepted: true;
      freezeId: string;
      state: "frozen";
      deduplicated: boolean;
      decisionOrigin: "operator" | "policy_auto";
    }
  | {
      accepted: false;
      reason:
        | "invalid_request"
        | "conflicting_request_id"
        | "persistence_unavailable";
    };

type DevelopmentProposalRequest = {
  requestId: string;
  proposalKind: "model_adapter" | "specialist_model" | "code_change" | "policy_change";
  problemSignature: string;
  summary: string;
  evidenceRefs: string[];
  rollbackPlanRef: string | null;
  targetRef: string | null;
};

type DevelopmentProposalResponse =
  | {
      accepted: true;
      proposalId: string;
      state: "submitted";
      deduplicated: boolean;
    }
  | {
      accepted: false;
      reason:
        | "invalid_request"
        | "unsupported_proposal_kind"
        | "development_frozen"
        | "insufficient_evidence"
        | "conflicting_request_id"
        | "persistence_unavailable";
    };
```

Compact internal gate contracts:

```ts
type GovernorInternalProposalRequest = {
  requestId: string;
  sourceOwner: "runtime" | "recovery" | "F-0015" | "human_override";
  proposalKind: DevelopmentProposalRequest["proposalKind"];
  evidenceRefs: string[];
  payload: Record<string, unknown>;
};

type GovernorEvidenceIntakeRequest = {
  requestId: string;
  sourceOwner: "runtime" | "recovery" | "F-0012" | "F-0015" | "human_override";
  evidenceKind:
    | "incident"
    | "freeze_request"
    | "candidate_package"
    | "execution_outcome"
    | "policy_signal";
  proposalId: string | null;
  evidenceRefs: string[];
  payload: Record<string, unknown>;
};
```

### 5.4 Runtime / deployment surface

- First delivered governor shape lives inside the existing `core` monolith.
- Persistence remains on PostgreSQL; asynchronous evaluation or normalization may reuse the existing `pg-boss` substrate, but this seam must not introduce a second orchestration stack.
- `F-0013` routes hand off into governor-owned write gates.
- `F-0012` publishes advisory freeze signals into governor-owned evidence gates.
- `F-0015` publishes candidate/package evidence and stage transitions into governor-owned evidence/proposal gates.
- `F-0016` does not own model selection, candidate activation, release rollout or worktree execution.

### 5.5 Data model changes

Canonical governor-owned durable surfaces:

- `development_ledger`
- `development_proposals`
- `development_proposal_decisions`
- `development_proposal_execution_outcomes`
- `development_freezes`

Minimal durable field set:

- `development_ledger`
  - `ledger_id`
  - `entry_kind`
  - `origin_surface`
  - `request_id`
  - `proposal_id`
  - `freeze_id`
  - `evidence_refs_json`
  - `payload_json`
  - `created_at`
- `development_proposals`
  - `proposal_id`
  - `proposal_kind`
  - `request_id`
  - `normalized_request_hash`
  - `origin_surface`
  - `submitter_owner`
  - `problem_signature`
  - `summary`
  - `state`
  - `rollback_plan_ref`
  - `target_ref`
  - `evidence_refs_json`
  - `created_at`
  - `updated_at`
- `development_proposal_decisions`
  - `decision_id`
  - `proposal_id`
  - `decision_kind`
  - `origin_surface`
  - `request_id`
  - `normalized_request_hash`
  - `decision_origin`
  - `rationale`
  - `evidence_refs_json`
  - `created_at`
- `development_proposal_execution_outcomes`
  - `outcome_id`
  - `proposal_id`
  - `outcome_kind`
  - `origin_surface`
  - `request_id`
  - `normalized_request_hash`
  - `outcome_origin`
  - `target_ref`
  - `evidence_refs_json`
  - `payload_json`
  - `created_at`
- `development_freezes`
  - `freeze_id`
  - `state`
  - `trigger_kind`
  - `origin_surface`
  - `request_id`
  - `normalized_request_hash`
  - `reason`
  - `requested_by`
  - `evidence_refs_json`
  - `created_at`

Invariants:

- governor append-only evidence lives in `development_ledger`;
- active freeze state is derived only from governor-owned freeze records;
- foreign surfaces are referenced by stable IDs, not duplicated as shadow truth;
- approval and execution evidence are separate records.

### 5.6 Decision tables and state model

Freeze decision table:

| Trigger | Guard | Governor outcome | Notes |
|---|---|---|---|
| Operator `POST /control/freeze-development` | Valid request and durable evidence refs | Create or reuse active freeze record | Idempotent by `requestId` |
| `F-0012` advisory freeze request | Policy threshold satisfied and provenance present | Auto-create active freeze record | `F-0012` remains advisory only |
| Proposal submission while frozen | Active freeze exists | Reject external proposal submission with `development_frozen` | Evidence intake may still continue |
| Evidence intake while frozen | Valid bounded evidence gate | Record ledger/evidence only | No automatic thaw path in this phase |

Canonical proposal states:

| State | Meaning | Allowed next states |
|---|---|---|
| `submitted` | Proposal accepted into governor lifecycle and awaiting evaluation | `approved`, `rejected`, `deferred`, `superseded` |
| `approved` | Governor authorized downstream execution | `executed`, `rolled_back`, `superseded` |
| `rejected` | Governor closed the proposal negatively | none |
| `deferred` | Proposal accepted but blocked by policy, freeze or missing prerequisite evidence | `approved`, `rejected`, `superseded` |
| `superseded` | Proposal replaced by a newer canonical proposal | none |
| `executed` | Downstream owner confirmed execution through bounded evidence intake | `rolled_back` |
| `rolled_back` | Downstream owner confirmed rollback of a previously executed proposal | none |

### 5.7 Edge cases and failure modes

- Reused `requestId` with a materially different payload must fail closed and must not create a second canonical row.
- New development proposals must not be accepted through the public submit route while an active development freeze exists.
- Missing rollback plan or missing evidence on proposal classes that require them must fail submission instead of creating under-specified approvals.
- Workshop candidate evidence may exist before release-path readiness exists; governor may record or defer such proposals, but may not invent execution readiness.
- Stale or missing adjacent evidence from workshop, homeostat or downstream execution seams must surface as explicit `deferred` or refusal semantics, not silent acceptance.
- No public thaw route exists in this phase; implementers must not create a hidden backdoor to clear freeze state.

### 5.8 Decision triage

Normative now:

- Only governor writes governor-owned writable surfaces.
- External submitters are operator-only.
- `auto-freeze` is allowed.
- Proposal approvals remain advisory and execution-separated.
- No public thaw route exists in this phase.

Implementation freedom:

- Internal transport for governor gates may be synchronous service calls or `pg-boss` jobs, as long as provenance and idempotency are preserved.
- Physical table decomposition beyond the canonical durable surfaces above is flexible if the same invariants and audit fields remain explicit.

Temporary assumptions:

- Numeric/default auto-freeze thresholds follow `PD-F0016-01` until a later policy-profile feature makes them configurable.
- First implementation stays inside the existing `core` monolith and does not split out a separate governor service.

### 5.9 Verification surface / initial verification plan

- Contract tests for both operator submission routes, including error reasons and idempotent replay behavior.
- Integration tests for `F-0012` advisory freeze requests reaching governor-owned freeze state without direct homeostat writes.
- Integration tests for workshop evidence normalization into governor proposal lifecycle without workshop-owned activation.
- Persistence/recovery tests for reconstructing active freeze state and proposal/decision history from PostgreSQL only.
- Boundary tests proving route handlers, runtime helpers and workshop helpers cannot write governor surfaces directly.

## 6. Definition of Done

- `F-0016` is the canonical owner of governor-side writable surfaces and no adjacent seam needs to infer or invent that ownership.
- The two bounded operator submission routes have explicit contracts, error semantics and idempotency rules.
- Internal evidence/proposal gates are explicit for homeostat, workshop, runtime, recovery and human override.
- Freeze and proposal lifecycles are planned enough for implementation without leaving hidden execution ambiguity.
- `F-0012`, `F-0013`, `F-0015`, `CF-012`, `CF-019` and `CF-025` boundaries remain explicit in dossier and backlog truth.

## 7. Slicing plan (2–6 increments)

Forecast only. Commitment remains in the ACs, DoD, verification gates and rollout constraints.

### Slice SL-F0016-01: Governor core and freeze control

Delivers: canonical contract types, PostgreSQL surfaces, governor write gate, owner-boundary guards, `POST /control/freeze-development`, durable active-freeze recovery and `F-0012` critical-policy auto-freeze.
Covers: AC-F0016-01, AC-F0016-02, AC-F0016-03, AC-F0016-04, AC-F0016-06, AC-F0016-08
Depends on: delivered `F-0004`, `F-0011`, `F-0012`, `F-0013`; unblock condition is stable PostgreSQL/test harness and the current operator route boundary.
Assumes: governor surfaces can be added as repo-owned `packages/contracts`, `packages/db` and `apps/core` seams without a new service process; current `development_proposal_rate` thresholds (`warning >= 3`, `critical >= 6`) remain the first default policy source.
Fallback: if automatic reaction wiring is unsafe in the first implementation bundle, keep the governor write gate and operator freeze live, but leave `policy_auto` freeze disabled until evidence mapping tests pass.
Approval path: architecture owner review through this dossier plus adjacent owner review for `F-0012` signal semantics and `F-0013` route contracts.
Verification: `packages/contracts/test/governor/governor-contract.test.ts`, `packages/db/test/development-governor-store.integration.test.ts`, `packages/db/test/development-governor-recovery.integration.test.ts`, `apps/core/test/runtime/development-governor-boundary.test.ts`, `apps/core/test/platform/operator-governor-control.integration.test.ts`, `apps/core/test/runtime/homeostat-governor-freeze.integration.test.ts`.

### Slice SL-F0016-02: Proposal lifecycle and advisory decisions

Delivers: `POST /control/development-proposals`, proposal schemas, idempotent submission, freeze-time rejection, four canonical proposal classes, advisory decision transitions and non-execution approval semantics.
Covers: AC-F0016-04, AC-F0016-05, AC-F0016-06, AC-F0016-07, AC-F0016-09
Depends on: `SL-F0016-01`, delivered `F-0013`; unblock condition is a tested active-freeze read path.
Assumes: external submission remains operator-only until `CF-024` changes public auth/RBAC semantics.
Fallback: if decision lifecycle creates too much review surface, keep the single slice boundary but land the commit series as "submission/frozen rejection" followed by "decision transitions" before requesting slice review.
Approval path: operator API contract review because this slice introduces a new machine-facing route and error set.
Verification: `packages/contracts/test/governor/proposal-contract.test.ts`, `apps/core/test/platform/operator-development-proposals.integration.test.ts`, `packages/db/test/development-proposal-lifecycle.integration.test.ts`.

### Slice SL-F0016-03: Evidence handoff, drift audit and activation proof

Delivers: internal evidence/proposal gates for workshop candidate/package evidence, bounded execution-outcome evidence intake, usage audit across docs/contracts/runtime call sites, drift guards and final quality/smoke proof.
Covers: AC-F0016-02, AC-F0016-06, AC-F0016-09, AC-F0016-10, plus DoD as regression guard
Depends on: `SL-F0016-02`, delivered `F-0015`; unblock condition is stable candidate/package evidence identifiers from workshop.
Assumes: before `CF-012`, `CF-019` and `CF-025`, execution outcomes arrive only as `human_override` or owner-routed future evidence with stable target refs; route behavior changes are runtime-impacting and require both source-level verification and container smoke.
Fallback: if workshop evidence shape is not stable enough, accept only explicit operator/manual evidence refs and record the owner-routed workshop normalization as follow-up without changing governor execution boundaries.
Approval path: adjacent owner review for `F-0015` lifecycle, future owner notes for `CF-012`, `CF-019`, `CF-025`, repo-level implementation review and dossier independent review before `implementation` close-out.
Verification: `apps/core/test/workshop/governor-evidence-handoff.integration.test.ts`, `apps/core/test/runtime/development-governor-execution-evidence.test.ts`, `packages/db/test/development-governor-evidence.integration.test.ts`, `pnpm quality:check`, `pnpm test`, `pnpm smoke:cell`, `dossier-engineer debt-audit --changed-only`.

## 8. Task list (implementation units)

- `T-F0016-01` (`SL-F0016-01`): add governor contracts, DB surfaces, service write gate, owner-boundary tests and freeze/idempotency persistence. Covers AC-F0016-01, AC-F0016-02, AC-F0016-04, AC-F0016-06, AC-F0016-08.
- `T-F0016-02` (`SL-F0016-01`): wire operator freeze and `F-0012` critical advisory auto-freeze through the governor gate. Covers AC-F0016-03, AC-F0016-04, AC-F0016-08.
- `T-F0016-03` (`SL-F0016-02`): implement operator proposal submission, frozen rejection, proposal classes and idempotent conflict behavior. Covers AC-F0016-04, AC-F0016-05, AC-F0016-06, AC-F0016-07.
- `T-F0016-04` (`SL-F0016-02`): implement proposal decision lifecycle and advisory approval records without execution-side mutations. Covers AC-F0016-07, AC-F0016-09.
- `T-F0016-05` (`SL-F0016-03`): add workshop candidate/package evidence and downstream/manual execution-outcome evidence intake without cloning foreign lifecycle truth. Covers AC-F0016-02, AC-F0016-06, AC-F0016-09, AC-F0016-10.
- `T-F0016-06` (`SL-F0016-03`): run usage audit, docs/runtime parity checks, route drift guards, quality gates and smoke verification. Covers DoD and AC-F0016-01 through AC-F0016-10.

## 9. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0016-01 | `apps/core/test/runtime/development-governor-boundary.test.ts`; `packages/db/test/development-governor-store.integration.test.ts`; `packages/contracts/test/governor/freeze-contract.contract.test.ts` | implemented for `SL-F0016-01` freeze path |
| AC-F0016-02 | `apps/core/test/runtime/development-governor-boundary.test.ts`; `apps/core/test/workshop/governor-evidence-handoff.integration.test.ts`; `packages/db/test/development-proposal-lifecycle.integration.test.ts` | implemented for freeze, proposal, workshop handoff and execution-outcome governor gates |
| AC-F0016-03 | `apps/core/test/runtime/homeostat-governor-freeze.integration.test.ts` | implemented for critical auto-freeze; warning remains advisory |
| AC-F0016-04 | `apps/core/test/platform/operator-governor-gating.contract.test.ts`; `apps/core/test/platform/operator-development-proposals.integration.test.ts`; `apps/core/test/runtime/development-governor-perimeter.contract.test.ts` | implemented as reserved public route surface plus live internal governor gates, with public exposure fail-closed until `CF-024` caller admission exists |
| AC-F0016-05 | `apps/core/test/platform/operator-development-proposals.integration.test.ts`; `apps/core/test/runtime/development-governor-perimeter.contract.test.ts` | implemented as operator-only public route reservation plus internal-first owner-routed submission until external caller admission exists |
| AC-F0016-06 | `packages/contracts/test/governor/freeze-contract.contract.test.ts`; `packages/db/test/development-governor-store.integration.test.ts`; `packages/contracts/test/governor/proposal-contract.test.ts`; `packages/db/test/development-proposal-lifecycle.integration.test.ts` | implemented for freeze, proposal, proposal-decision and execution-outcome writes |
| AC-F0016-07 | `packages/contracts/test/governor/proposal-contract.test.ts`; `packages/db/test/development-proposal-lifecycle.integration.test.ts` | implemented for the four canonical proposal classes and decision states |
| AC-F0016-08 | `infra/docker/deployment-cell.smoke.ts`; `apps/core/test/runtime/homeostat-governor-freeze.integration.test.ts`; `packages/db/test/development-governor-store.integration.test.ts` | implemented for freeze creation, auto-freeze handoff and active-freeze recovery |
| AC-F0016-09 | `packages/db/test/development-proposal-lifecycle.integration.test.ts`; `apps/core/test/runtime/development-governor-execution-evidence.test.ts`; `packages/contracts/test/governor/proposal-contract.test.ts` | implemented for advisory proposal decisions and bounded execution-outcome evidence intake without downstream execution mutation |
| AC-F0016-10 | `apps/core/test/workshop/governor-evidence-handoff.integration.test.ts`; `packages/db/test/development-proposal-lifecycle.integration.test.ts`; `apps/core/test/runtime/development-governor-boundary.test.ts` | implemented for workshop promotion-package handoff, deferred internal proposal recording during freeze and owner-boundary drift guard |

## 10. Contract risks and mitigations

- Route ownership drift: `F-0013` owns the Hono boundary, while `F-0016` owns governor semantics and durable writes. Mitigation: route handlers delegate to governor service and route contract tests assert the two allowed submission routes.
- Hidden freeze policy: `F-0012` thresholds could accidentally become a second governor policy. Mitigation: `F-0016` consumes only critical `FREEZE_DEVELOPMENT_PROPOSALS` evidence for auto-freeze and records `policy_auto` provenance.
- Approval mistaken for execution: approved proposals could be treated as live mutations. Mitigation: separate decision records from execution-outcome evidence and forbid governor writes to model pointers, release state or body/worktree state.
- Workshop handoff becomes a second rollout machine: governor could duplicate candidate lifecycle truth. Mitigation: store evidence refs and proposal state only; `F-0015` remains the lifecycle owner.
- Direct DB writes from adjacent code: route/runtime/workshop helpers could bypass the owner seam. Mitigation: store APIs are not exported as generic helpers and boundary tests inspect allowed write call paths.
- No public thaw path: operational freeze may persist until a later feature provides explicit lift semantics. Mitigation: document this as intentional and do not create hidden clear-state helpers.

## 11. Drift guard and usage audit

- Before implementation close-out, compare `docs/architecture/system.md`, `docs/ssot/features/F-0012-homeostat-and-operational-guardrails.md`, `docs/ssot/features/F-0013-operator-http-api-and-introspection.md`, `docs/ssot/features/F-0015-workshop-datasets-training-eval-and-promotion.md` and this dossier for route, owner and policy drift.
- Inspect `packages/contracts` exports, `apps/core/src/platform/operator-api.ts`, governor service call sites and DB store exports for contract/runtime parity.
- Classify audit findings as `docs-only`, `runtime`, `schema/help`, `cross-skill` or `audit-only`; only runtime/schema findings block implementation close-out.
- Actualize backlog `CF-016` when dossier stage evidence changes delivery state, dependencies, blockers or context.

## 12. Decision log (ADR blocks)

- No new ADR at `plan-slice` time. The cross-cutting invariant "all development-governance writes are governor-owned and evidence-linked" is currently captured in this dossier plus `docs/architecture/system.md` without requiring a repo-level ADR split.

## 13. Progress & links

- Backlog item key: CF-016
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Current implementation package: `SL-F0016-03` delivered; backlog `CF-016` is actualized to `implemented`, all ACs have test references, the internal governor seam is live, and high-risk public routes stay fail-closed until `CF-024`.
- Issue:
- PRs:

## 14. Rollout / activation note

- Activation order matters:
  - contracts, DB schema/store and governor service write gate land before any public route stops returning explicit unavailable;
  - `POST /control/freeze-development` and `POST /control/development-proposals` may become live only after `CF-024` caller admission exists and persistence/idempotency/rejection coverage is already green;
  - homeostat auto-freeze activates only after explicit `development_proposal_rate` critical-policy mapping tests pass;
  - workshop and execution-evidence intake activates after proposal lifecycle exists;
  - no public thaw route or public governor read API is introduced in this phase.

## 15. Change log

- 2026-04-10: [intake] Initial dossier created from backlog item `CF-016` at backlog delivery state `defined`.
- 2026-04-10: [spec-compact] Expanded `CF-016` into a shaped first-governor spec with explicit operator routes, internal evidence gates, freeze/proposal lifecycles, advisory-approval boundary and backlog-actualization target `specified`.
- 2026-04-10: [plan-slice] [scope realignment] Resolved planning questions, set dossier status to `planned`, sequenced three implementation slices and defined task/test/drift-guard coverage for backlog actualization target `planned`.
- 2026-04-15: [security realignment] `F-0018` implementation proved the public high-risk operator paths still lack `CF-024` caller admission, so the governor surface remains live only through internal owner-routed gates while `/control/freeze-development` and `/control/development-proposals` return explicit unavailable at the public `F-0013` boundary.
- 2026-04-10: [implementation] Started `SL-F0016-01` and implemented the governor freeze path: contracts, PostgreSQL surfaces, store/service write gate, operator freeze route, homeostat critical auto-freeze handoff, active-freeze recovery and boundary/smoke tests.
- 2026-04-10: [implementation] Implemented `SL-F0016-02` proposal lifecycle: live operator proposal submission route, proposal contracts, idempotent proposal persistence, active-freeze rejection, proposal decision records and advisory-only approval semantics without downstream execution mutation.
- 2026-04-10: [implementation] Completed `SL-F0016-03` evidence handoff and feature closure: workshop promotion packages map into governor-owned proposal gates without cloning workshop lifecycle truth, internal workshop proposals defer under active freeze, bounded execution-outcome evidence can move approved proposals to `executed` or `rolled_back` without executing downstream mutations, post-lock replay idempotency is guarded, targetless execution outcomes are rejected, and backlog `CF-016` is actualized to `implemented`.
