---
id: F-0016
title: Development Governor и управление изменениями
status: proposed
coverage_gate: deferred
owners: ["@codex"]
area: governance
depends_on: ["F-0004", "F-0011", "F-0012"]
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
- **User problem:** После поставки `F-0004`, `F-0011` и `F-0012` система уже умеет хранить identity-bearing state, вести narrative/memetic continuity и публиковать advisory homeostat reactions, но у неё всё ещё нет канонического owner-а для developmental governance. Без отдельного governor seam improvement hypotheses, model/code proposals, freeze decisions и rollback-linked policy changes начинают расползаться между runtime, workshop, operator API и ad hoc helper writes. В таком состоянии development control либо превращается в ручной процесс без durable evidence, либо начинает обходить owner boundaries, которые уже закреплены в архитектуре и delivered dossiers.
- **Goal:** Зафиксировать один canonical dossier-owner для `Development Governor`, который владеет `development_ledger`, policy-gated proposal intake, freeze decisions и bounded approval surfaces для model/code/policy changes, не захватывая ownership над workshop lifecycle, richer model-registry source state, operator HTTP contracts, reporting или body-evolution execution.
- **Non-goals:** Реализация body/code evolution (`CF-012`), observability/report materialization (`CF-015`), specialist rollout/retirement policy (`CF-019`), deploy/release orchestration (`CF-025`), operator auth/RBAC (`CF-024`) и final governance closure/policy profiles (`CF-027`) не входят в этот intake. Эта фича также не должна подменять собой homeostat, workshop или router owners под видом "единого контура управления".
- **Current substrate / baseline:** Delivered prerequisites already exist as `F-0004` subject-state kernel, `F-0011` narrative/memetic seam and `F-0012` homeostat snapshots plus typed reaction requests. Adjacent delivered seams also already fix the main neighbouring boundaries: `F-0013` keeps `POST /control/freeze-development` explicitly unavailable until this seam exists, `F-0014` owns richer model-registry source state, and `F-0015` owns workshop candidate lifecycle and promotion-package evidence without final governance approval.

## 2. Scope

### In scope
- Canonical owner for `Development Governor` as the developmental policy and proposal gate over the existing runtime/workshop/operator substrate.
- Ownership over governor-side source surfaces such as `development_ledger`, freeze/development evidence, and durable proposal records for model, code/body and policy changes.
- Bounded intake paths through which runtime, recovery, workshop, homeostat and human override may submit evidence, incidents or proposal candidates without writing governor tables directly.
- Freeze-policy and approval semantics that consume canonical evidence and preserve provenance plus rollback links instead of ad hoc side effects.
- Explicit ownership realignment against neighbouring seams so later `CF-012`, `CF-015`, `CF-019`, `CF-025` and `CF-027` can extend the system without introducing a second governance path.

### Out of scope
- Body/code mutation execution, writable worktree orchestration and stable snapshot production; those remain with `CF-012`.
- Read-only reporting projections, diagnostics dashboards and observability materialization; those remain with `CF-015`.
- Specialist admission, staged rollout, fallback and retirement overlays; those remain with `CF-019`.
- Release-path execution, deploy automation, rollback orchestration and environment rollout machinery; those remain with `CF-025`.
- Operator-facing route ownership or auth/RBAC policy; `F-0013` and `CF-024` remain responsible for the HTTP boundary and access control.

### Constraints
- `CF-016` must own policy execution and freeze state, but it must not become a generic writer into `psm_json`, goals/beliefs, narrative/memetic surfaces, richer model-registry source rows, workshop lifecycle tables or reporting snapshots.
- `POST /control/freeze-development` stays `F-0013`-owned as an HTTP contract and only becomes executable once this seam provides the underlying governor surface; this feature must not invent hidden backdoors outside the bounded operator/API path.
- `F-0012` may publish advisory `homeostat.reaction-request` items and request a freeze, but only `CF-016` may turn those signals into durable freeze/policy state.
- Workshop may submit candidate evidence or promotion packages, but it does not own final governance approval; the governor consumes bounded workshop evidence instead of inheriting workshop lifecycle ownership.
- Proposal and ledger writes must preserve provenance, policy gating and rollback linkage as required by `docs/architecture/system.md`; helper writes from runtime/router/state/reporting code are forbidden.
- The delivered implementation must stay on the canonical repo substrate `Node.js 22 + TypeScript + AI SDK + Hono + PostgreSQL`, with repo-local quality gates and no framework-owned governance abstraction.

### Assumptions (optional)
- `F-0013` will keep the public control route bounded and attribution-safe, so this seam can focus on underlying governor state and policy execution rather than route ownership.
- `F-0014` and `F-0015` remain the canonical sources for richer model health/fallback state and workshop candidate lifecycle evidence respectively.
- `CF-012`, `CF-015`, `CF-019`, `CF-025` and `CF-027` will later extend the governor ecosystem, but this intake must establish one stable owner boundary before those seams are shaped further.

### Open questions (optional)
- None at intake time. `spec-compact` must still make the minimum executable governor surface explicit before the dossier can move to `planned`.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0016-01:** `F-0016` establishes one canonical dossier-owner for `Development Governor`, `development_ledger` and governor-side proposal/freeze evidence, so neighbouring seams no longer need to infer who owns developmental policy execution.
- **AC-F0016-02:** Ownership boundaries remain explicit after intake: `F-0012` may publish advisory freeze requests but may not execute freeze state, `F-0013` keeps the HTTP contract for `POST /control/freeze-development`, `F-0014` keeps richer model-registry source state, and `F-0015` keeps workshop candidate lifecycle truth.
- **AC-F0016-03:** Runtime, recovery, workshop and human override inputs may reach governor-owned surfaces only through bounded governor gates with provenance and rollback linkage; direct helper writes into governor tables from foreign seams remain forbidden.
- **AC-F0016-04:** This intake keeps downstream ownership explicit instead of absorbing it: body/code evolution stays with `CF-012`, reporting and diagnostics stay with `CF-015`, specialist rollout/retirement stays with `CF-019`, and deploy/release execution stays with `CF-025`.

These ACs fix the intake contract and owner boundaries only. `spec-compact` must still turn them into a full executable governor contract with concrete state machines, DTOs and verification commitments.

## 4. Non-functional requirements (NFR)

- **Auditability:** Every governor-visible proposal, freeze decision or rejection path must be attributable to canonical evidence and durable ledger records rather than chat-only reasoning or process-local logs.
- **Ownership discipline:** The seam must centralize developmental policy without collapsing workshop, operator API, reporting, router or body-evolution ownership into one module.
- **Recoverability:** Freeze and proposal decisions must remain reconstructable after restart/reclaim from canonical PostgreSQL evidence.
- **Policy clarity:** Unsupported or insufficiently evidenced proposals must fail closed with explicit refusal/review semantics instead of silent mutation of foreign surfaces.

## 5. Design (compact)

### 5.1 API surface
- Expected bounded public control surface is currently the future-owned `POST /control/freeze-development` path already reserved by `F-0013`.
- Additional governor proposal submission surfaces, if any, should default to internal/runtime-owned interfaces first; this intake does not yet bless a wider public API.
- `spec-compact` must decide which governor actions are HTTP-exposed versus internal-only owner gates.

### 5.2 Runtime / deployment surface
- First delivered shape should remain inside the existing `core` monolith on the PostgreSQL/`pg-boss` substrate rather than introducing a separate governance service.
- The governor consumes bounded evidence from homeostat, workshop, runtime/recovery incidents and human override inputs through explicit owner gates.
- Policy execution remains separate from route ownership, reporting materialization and release-path execution.

### 5.3 Data model changes
- Introduce or finalize governor-owned source surfaces around `development_ledger`, proposal records and freeze/development evidence.
- Preserve provenance anchors, decision attribution and rollback linkage for every durable proposal or policy transition.
- Avoid second-source mirrors for workshop candidates, richer model health or body snapshots; governor records should reference canonical neighbouring sources instead of duplicating their truth.

### 5.4 Edge cases and failure modes
- Duplicate or replayed proposal submissions must not create contradictory governor truth.
- Homeostat may request a freeze while richer evidence is degraded; governor must keep the final decision path explicit and attributable.
- Workshop evidence may be present without sufficient release or rollout substrate; governor must refuse or park such proposals without inventing missing downstream capability.
- Operator/human override must not bypass durable ledger recording or provenance requirements.

### 5.5 Verification surface / initial verification plan
- Contract tests for the transition of `POST /control/freeze-development` from explicit `501 future_owned` to bounded governor-backed behavior.
- Integration tests proving that homeostat requests remain advisory until governor policy executes them.
- Ownership-boundary tests proving runtime, workshop, router and reporting code cannot write governor-owned proposal surfaces directly.
- Persistence/recovery tests proving proposal and freeze evidence survive restart/reclaim without hidden in-memory state.

### 5.6 Representation upgrades (triggered only when needed)
- `spec-compact` will likely need a proposal-state list and a freeze-decision table once the minimum executable governor contract is fixed.

### 5.7 Definition of Done
- Deferred to `spec-compact` and later stages.
- At intake time the only completed claim is that `CF-016` now has one canonical dossier owner and explicit neighbouring seams.

### 5.8 Rollout / activation note (triggered only when needed)
- The first rollout-sensitive question is the activation of real `freeze-development` behavior behind the already delivered operator contract.
- Release/rollback orchestration for broader policy actions remains downstream work for `CF-025`.

## 6. Slicing plan (2–6 increments)

Forecast only; real slice commitments belong to `plan-slice`.

- Slice 1: governor-owned source surfaces, evidence intake and ownership guards.
- Slice 2: freeze-policy decision path plus bounded operator/control integration.
- Slice 3: model/workshop/code proposal approval flow with explicit neighbouring handoffs.

## 7. Task list (implementation units)

- To be defined during `plan-slice` after acceptance criteria and slice boundaries are fixed.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0016-01 | `spec-compact` must assign owner-boundary verification for governor source surfaces and dossier/index consistency. | planned |
| AC-F0016-02 | `spec-compact` must assign contract coverage for homeostat/operator/workshop adjacency boundaries around governor ownership. | planned |
| AC-F0016-03 | `spec-compact` must assign integration or contract coverage for bounded governor evidence intake and forbidden foreign writes. | planned |
| AC-F0016-04 | `spec-compact` must assign ownership-boundary coverage for downstream seams `CF-012`, `CF-015`, `CF-019` and `CF-025`. | planned |

## 9. Decision log (ADR blocks)

- None at intake time.

## 10. Progress & links

- Backlog item key: CF-016
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Issue:
- PRs:

## 11. Change log

- 2026-04-10: Initial dossier created from backlog item `CF-016` at backlog delivery state `defined`.
