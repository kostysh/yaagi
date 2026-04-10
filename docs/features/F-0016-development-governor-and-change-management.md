---
id: F-0016
title: Development Governor и управление изменениями
status: shaped
coverage_gate: deferred
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
    - "docs/features/F-0004-subject-state-kernel-and-memory-model.md"
    - "docs/features/F-0011-narrative-and-memetic-reasoning-loop.md"
    - "docs/features/F-0012-homeostat-and-operational-guardrails.md"
    - "docs/features/F-0013-operator-http-api-and-introspection.md"
    - "docs/features/F-0014-expanded-model-ecology-and-registry-health.md"
    - "docs/features/F-0015-workshop-datasets-training-eval-and-promotion.md"
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
    - docs/backlog/feature-candidates.md
    - docs/backlog/working-system-roadmap-matrix-2026-03-26.md
  - Known blockers at intake:
    - none recorded
  - Known dependencies at intake:
    - CF-003
    - CF-005
    - CF-008
- **User problem:** После поставки `F-0004`, `F-0011`, `F-0012`, `F-0013` и `F-0015` система уже умеет хранить identity-bearing state, публиковать advisory homeostat signals, держать bounded operator control routes и вести workshop candidate lifecycle, но у неё всё ещё нет одного канонического owner-а для development governance. Без такого seam-а freeze decisions, proposal intake, approval evidence и rollback-linked governance truth начинают расползаться между runtime, operator API, workshop и ad hoc helper writes.
- **Goal:** Зафиксировать один canonical dossier-owner для `Development Governor`, который владеет governor-side writable surfaces, operator-facing proposal/freeze handoff, bounded internal evidence/proposal gates, durable approval records и rollback-linked governance evidence, но не забирает ownership над workshop lifecycle, operator HTTP framework boundary, richer model source state, reporting read models, release orchestration или body-evolution execution.
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

- `F-0013` continues to expose the operator HTTP namespace and can change the two bounded control routes from `future_owned` placeholders to governor-backed handoff once this seam is implemented.
- `F-0015` continues to expose canonical candidate/package evidence and does not require governor to infer workshop truth from raw artifacts.
- Downstream execution seams (`CF-012`, `CF-019`, `CF-025`) will later emit bounded execution-outcome evidence that governor can consume without becoming the executor.

### Open questions

- `OQ-F0016-01` (owner `F-0016`, target `2026-04-12`, needed_by `before_implementation`): choose the initial numeric/default policy thresholds that trigger `auto-freeze`, using `F-0012` signal semantics as the upstream anchor. Next decision path: resolve during `plan-slice`.
- `OQ-F0016-02` (owner `F-0016`, target `2026-04-12`, needed_by `before_implementation`): choose the first bounded execution-outcome intake path for approved code/model proposals before `CF-012` and `CF-025` are delivered. Next decision path: resolve during `plan-slice` with adjacent-seam review.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0016-01:** `F-0016` is the only canonical writer for `development_ledger`, governor-side proposal records, governor-side decision records and development-freeze state.
- **AC-F0016-02:** Runtime, recovery, workshop, homeostat and human override may reach governor-owned writable surfaces only through bounded governor gates; direct helper writes remain forbidden.
- **AC-F0016-03:** `F-0012` may publish advisory freeze requests and consume governor evidence for `development_proposal_rate`, but it may not execute freeze state or persist proposal rows.
- **AC-F0016-04:** The bounded operator-facing governor surface in this phase consists of exactly two submission routes: `POST /control/freeze-development` and `POST /control/development-proposals`.
- **AC-F0016-05:** External proposal submission is operator-only in this phase; non-operator subsystem submission remains internal-first and owner-routed.
- **AC-F0016-06:** Every accepted external or internal governor write carries durable provenance, evidence refs and an idempotency key or request identity.
- **AC-F0016-07:** Governor supports exactly four canonical proposal classes in this phase: `model_adapter`, `specialist_model`, `code_change` and `policy_change`.
- **AC-F0016-08:** Governor may auto-freeze development according to policy, and every freeze decision is durable, attributable and replayable from PostgreSQL evidence.
- **AC-F0016-09:** Governor approval is advisory in this phase: `approved` authorizes downstream execution, but it does not directly mutate active model pointers, workshop lifecycle truth, deploy state or writable body state.
- **AC-F0016-10:** Governor consumes workshop candidate lifecycle evidence and downstream execution evidence without introducing a second rollout or activation state machine beside `F-0015`, `F-0014`, `CF-019` or `CF-025`.

## 4. Non-functional requirements (NFR)

- **Auditability:** A governor write is invalid unless the persisted record contains `origin_surface`, `request_id`, `evidence_refs_json`, `created_at`, and for approval-bearing proposal classes a rollback-plan or rollback-link field.
- **Idempotency:** Replaying the same normalized request with the same `requestId` must return the same canonical `freeze_id` or `proposal_id`; replaying a different normalized payload on the same `requestId` must return a conflict result and create no new durable row.
- **Recoverability:** A restart/reclaim verification must be able to reconstruct the same active freeze state and the same proposal/decision state from governor-owned PostgreSQL rows only, without process-local caches.
- **Boundary safety:** Verification must prove that non-governor code paths cannot insert or update governor-owned writable surfaces through route handlers, runtime helpers or workshop helpers.

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

- Public operator surface:
  - `POST /control/freeze-development`
  - `POST /control/development-proposals`
- No public `GET` governor routes are introduced in this phase.
- Common write semantics:
  - `POST /control/development-proposals` is exposed only through the `F-0013`-owned Hono boundary; no other seam may publish a parallel HTTP surface for the same action;
  - every write request must carry `requestId`;
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
  - `decision_origin`
  - `rationale`
  - `evidence_refs_json`
  - `created_at`
- `development_freezes`
  - `freeze_id`
  - `state`
  - `trigger_kind`
  - `request_id`
  - `reason`
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

- Numeric/default auto-freeze thresholds are deferred to `plan-slice`.
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
- Freeze and proposal lifecycles are shaped well enough for `plan-slice` without leaving hidden execution ambiguity.
- `F-0012`, `F-0013`, `F-0015`, `CF-012`, `CF-019` and `CF-025` boundaries remain explicit in dossier and backlog truth.

## 7. Slicing plan (2–6 increments)

Forecast only; real slice commitments belong to `plan-slice`.

### Slice SL-F0016-01: Governor-owned source surfaces and write guards

Delivers: canonical governor persistence surfaces, provenance/idempotency rules and explicit write-authority guards.
Covers: AC-F0016-01, AC-F0016-02, AC-F0016-06
Depends on: delivered `F-0004`, `F-0011`, `F-0012`
Verification: `contract`, `db`

### Slice SL-F0016-02: Freeze state and freeze-route handoff

Delivers: bounded `freeze-development` route handoff, policy-backed auto-freeze and durable active-freeze state.
Covers: AC-F0016-03, AC-F0016-04, AC-F0016-08
Depends on: `SL-F0016-01`, delivered `F-0012`, delivered `F-0013`
Verification: `contract`, `integration`, `db`

### Slice SL-F0016-03: Proposal submission and decision lifecycle

Delivers: public proposal submission, internal proposal/evidence gates and canonical proposal-state transitions.
Covers: AC-F0016-04, AC-F0016-05, AC-F0016-07, AC-F0016-09
Depends on: `SL-F0016-01`, delivered `F-0013`
Verification: `contract`, `integration`

### Slice SL-F0016-04: Workshop/downstream handoff evidence

Delivers: workshop-candidate evidence intake, downstream execution-outcome intake and explicit non-execution boundary with release/body/specialist seams.
Covers: AC-F0016-09, AC-F0016-10
Depends on: `SL-F0016-03`, delivered `F-0015`
Verification: `integration`, `db`

## 8. Task list (implementation units)

- To be defined during `plan-slice` after slice sequencing and open-question resolution.

## 9. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0016-01 | Schema/owner-boundary verification for canonical governor writable surfaces. | planned |
| AC-F0016-02 | Boundary tests proving foreign seams cannot write governor rows directly. | planned |
| AC-F0016-03 | Integration coverage for `F-0012` advisory freeze requests staying non-executing until governor acts. | planned |
| AC-F0016-04 | Contract coverage for `POST /control/freeze-development` and `POST /control/development-proposals`. | planned |
| AC-F0016-05 | Contract coverage proving non-operator external submission is unsupported in this phase. | planned |
| AC-F0016-06 | Replay/idempotency coverage for external and internal governor writes. | planned |
| AC-F0016-07 | Contract/state coverage for the four canonical proposal classes. | planned |
| AC-F0016-08 | Persistence/recovery coverage for durable auto-freeze and operator-triggered freeze evidence. | planned |
| AC-F0016-09 | Boundary and integration coverage proving approval stays advisory and does not execute foreign mutations directly. | planned |
| AC-F0016-10 | Integration coverage proving workshop/downstream evidence is consumed without a second rollout state machine. | planned |

## 10. Decision log (ADR blocks)

- No new ADR at `spec-compact` time. The cross-cutting invariant "all development-governance writes are governor-owned and evidence-linked" is currently captured in this dossier plus `docs/architecture/system.md` without requiring a repo-level ADR split.

## 11. Progress & links

- Backlog item key: CF-016
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Issue:
- PRs:

## 12. Rollout / activation note

- Activation order matters:
  - governor-owned persistence and internal gates must exist before operator routes stop returning future-owned placeholders;
  - `freeze-development` becomes executable at the same time as governor freeze state exists;
  - proposal submission may land before any downstream execution seam consumes approvals, but approvals remain advisory until that downstream owner exists.
- This phase intentionally does not introduce a public thaw route or a public governor read API.

## 13. Change log

- 2026-04-10: [intake] Initial dossier created from backlog item `CF-016` at backlog delivery state `defined`.
- 2026-04-10: [spec-compact] Expanded `CF-016` into a shaped first-governor spec with explicit operator routes, internal evidence gates, freeze/proposal lifecycles, advisory-approval boundary and backlog-actualization target `specified`.
