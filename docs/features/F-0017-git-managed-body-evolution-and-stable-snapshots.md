---
id: F-0017
title: Git-управляемая эволюция тела и стабильные снапшоты
status: proposed
coverage_gate: deferred
owners: ["@codex"]
area: body
depends_on: ["F-0001", "F-0002", "F-0010", "F-0015", "F-0016"]
impacts: ["runtime", "db", "governance", "workspace", "tooling", "recovery"]
created: 2026-04-10
updated: 2026-04-10
links:
  issue: ""
  pr: []
  docs:
    - "docs/architecture/system.md"
    - "docs/polyphony_concept.md"
    - "docs/backlog/feature-candidates.md"
    - "docs/backlog/working-system-roadmap-matrix-2026-03-26.md"
    - "docs/features/F-0001-constitutional-boot-recovery.md"
    - "docs/features/F-0002-canonical-monorepo-deployment-cell.md"
    - "docs/features/F-0010-executive-center-and-bounded-action-layer.md"
    - "docs/features/F-0015-workshop-datasets-training-eval-and-promotion.md"
    - "docs/features/F-0016-development-governor-and-change-management.md"
---

# F-0017 Git-управляемая эволюция тела и стабильные снапшоты

## 1. Context & Goal

- **Backlog handoff:**
  - Backlog item key: CF-012
  - Backlog delivery state at intake: defined
  - Source traceability:
    - docs/architecture/system.md
    - docs/polyphony_concept.md
    - docs/backlog/feature-candidates.md
    - docs/backlog/working-system-roadmap-matrix-2026-03-26.md
  - Known blockers at intake:
    - none recorded
  - Known dependencies at intake:
    - CF-001
    - CF-007
    - CF-011
    - CF-016
- **User problem:** После delivery `F-0016` у системы есть governor approval/outcome surface, но все еще нет отдельного owner seam, который безопасно исполняет body/code evolution. Без такого seam self-modification рискует мутировать live body или tracked `/seed`, обходить governor gates, производить code proposals без body eval suites и оставлять boot/recovery без надежной stable snapshot точки возврата.
- **Goal:** Зафиксировать один dossier-owner для Git-governed body evolution: заметные body changes идут через isolated worktrees поверх materialized writable body, проходят bounded proposal/eval/review flow, могут выпускать stable snapshot manifests/tags и возвращают governor-compatible execution/rollback evidence без захвата ownership у boot, workshop, governor, reporting или deploy/release seams.
- **Non-goals:** Этот intake не реализует public auth/RBAC (`CF-024`), deploy/release automation (`CF-025`), mature perimeter hardening (`CF-014`), read-only reporting/stable-snapshot inventories (`CF-015`), workshop candidate lifecycle (`F-0015`) или governor source tables/decision policy (`F-0016`). `CF-024` and `CF-025` remain required later for the full public/operator-controlled and deployable mechanism; they are not erased from the final architecture.
- **Current substrate / baseline:** `F-0001` уже владеет boot/recovery boundary и last-stable rollback refs; `F-0002` поставляет canonical monorepo/deployment cell и materialized runtime/workspace paths; `F-0010` владеет bounded action layer и Git/tool wrappers; `F-0015` поставляет workshop evidence/promotion-package handoff; `F-0016` поставляет freeze/proposal/decision/execution-outcome governor gates. Architecture and concept sources additionally require Git worktrees, stable tags/snapshots, eval/review gates and rollback as body-governance discipline.

## 2. Scope

### In scope

- Intake-level ownership for code/body change proposals, isolated worktree orchestration, body eval suite handoff, stable snapshot manifest/tag production and rollback evidence handoff.
- Explicit boundary that worktree automation operates only on the materialized writable body derived from immutable `/seed/body`; tracked seed remains canonical input, not a mutation target.
- Integration contract with `F-0016`: body evolution may consume approvals and emit bounded execution/rollback evidence through governor-owned gates, but does not own governor proposal, decision or ledger source surfaces.
- Integration contract with `F-0001`: stable snapshot outputs and rollback refs must be consumable by boot/recovery without letting body evolution back-write boot continuity state directly.
- Initial classification of what belongs to this seam versus future `CF-014`, `CF-015`, `CF-024` and `CF-025`.

### Out of scope

- Direct mutation of tracked `/seed` sources or live runtime body outside isolated worktree flow.
- Direct writes into governor tables, boot/recovery continuity fields, workshop lifecycle rows or read-only reporting surfaces.
- Public operator authentication/authorization, stronger human gates and perimeter hardening.
- Environment promotion, release orchestration, smoke-on-deploy and production rollback automation.
- Full compact specification, acceptance criteria and implementation slices; those belong to `spec-compact` and `plan-slice`.

### Constraints

- `/seed/body` is immutable tracked source for this seam; all automated body changes must target a materialized writable body/worktree.
- Serious body changes require branch/worktree isolation, structural diff analysis, tests/eval suite evidence, review gate and rollback availability.
- Stable snapshot is the rollback unit: it must bind at least git tag, schema version, active model profiles, critical configuration hash and eval summary when the compact spec confirms the exact contract.
- Runtime/startup/deployment behavior changes must follow repo gates from `AGENTS.md`, including source-level verification and `pnpm smoke:cell` when applicable.
- Governor approval/outcome semantics remain owner-routed through `F-0016`; body evolution must not create a parallel governance regime.

### Assumptions

- Current backlog truth marks `CF-012` as `defined`, ready for the next dossier step, with no gaps or blockers.
- Delivered prerequisites listed in frontmatter are sufficient for intake and specification. Operator decision during intake classifies legacy roadmap references to `CF-024` and `CF-025` as later capability constraints, not hard blockers for the internal `CF-012` owner seam.
- Body-evolution implementation can start from repository-local Git/workspace mechanics and does not require changing the installed skill automation paths.

### Open questions

- **OQ-F0017-01:** Resolved during intake: `CF-024` auth/RBAC and `CF-025` deploy/release automation are not hard blockers for the internal safe body-evolution mechanism in `CF-012`. They are required later to expose a full public/operator-controlled mechanism and complete deploy/release/rollback automation. `spec-compact` must preserve this cap explicitly rather than turning the internal mechanism into final maturity.
- **OQ-F0017-02:** What is the minimal stable snapshot manifest for this project: architecture lists git tag, schema version, active model profiles, critical config hash and eval summary, but the compact spec must decide whether body-evolution owns all fields or only writes a body-owned projection for `F-0001`/`CF-015` consumers. Owner: dossier operator. Needed by: `before_planned`.
- **OQ-F0017-03:** Which body eval suite is mandatory for a code/body proposal before governor execution evidence can be recorded: existing repo quality gates only, targeted body evals, or both? Owner: dossier operator. Needed by: `before_planned`.

## 3. Requirements & Acceptance Criteria (SSoT)

Acceptance criteria intentionally remain unset at intake. They must be authored during `spec-compact` after the open dependency and snapshot-contract questions are resolved.

## 4. Non-functional requirements (NFR)

Normative NFRs intentionally remain unset at intake. `spec-compact` must add measurable safety, recoverability and observability constraints if they are required for `done`.

## 5. Design (compact)

### 5.1 API surface

Pending `spec-compact`. Likely boundaries: internal body proposal commands, governor execution-outcome handoff and stable snapshot inventory handoff.

### 5.2 Runtime / deployment surface

Pending `spec-compact`. Intake assumption: work runs inside the canonical repo/workspace path, not through ad hoc shell access or mutation of tracked seed.

### 5.3 Data model changes

Pending `spec-compact`. Source architecture already names `code_proposals` and `stable_snapshots`; ownership and migration details are not yet specified here.

### 5.4 Edge cases and failure modes

Pending `spec-compact`. Known high-risk categories: dirty worktree, failed eval suite, governor approval drift, snapshot manifest mismatch, rollback evidence missing, and accidental seed mutation.

### 5.5 Verification surface / initial verification plan

Pending `spec-compact`. Expected proof types include contract tests for proposal/snapshot schemas, integration tests for isolated worktree/eval flow, boundary tests against seed/governor direct writes, and smoke if boot/recovery behavior changes.

### 5.6 Representation upgrades (triggered only when needed)

Triggered for `spec-compact`: this feature needs at least a state/transition table for body proposal lifecycle and a schema sketch for stable snapshot manifest/evidence payloads.

### 5.7 Definition of Done

Pending `spec-compact`. Done must not be claimed until stable snapshot rollback semantics, governor evidence handoff and worktree isolation are covered by executable proofs.

### 5.8 Rollout / activation note (triggered only when needed)

Triggered for `spec-compact`: body evolution changes rollback and recovery posture, so activation order and rollback limits must be explicit before planning.

## 6. Slicing plan (2–6 increments)

Pending `plan-slice`.

## 7. Task list (implementation units)

Pending `plan-slice`.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| _pending_ | ACs are not authored yet; coverage map starts during `spec-compact`. | deferred |

## 9. Decision log (ADR blocks)

- **PD-F0017-01 [normative now]:** Intake proceeds from current backlog truth: `CF-012` is ready for `feature-intake` with dependencies `CF-001`, `CF-007`, `CF-011` and `CF-016`. Operator decision: current `CF-012` scope should deliver an internal safe body-evolution mechanism without public RBAC and without the full deploy pipeline; later `CF-024` and `CF-025` must extend that into the full public/operator-controlled and deployable mechanism.

## 10. Progress & links

- Backlog item key: CF-012
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Issue:
- PRs:
- Current workflow stage: `feature-intake` complete enough for review; next stage should be `spec-compact` if intake closes.

## 11. Change log

- 2026-04-10: Initial dossier created from backlog item `CF-012` at backlog delivery state `defined`.
- 2026-04-10: Intake context expanded with body/worktree ownership, immutable seed constraint, governor/boot boundaries and open dependency classification questions.
- 2026-04-10: [clarification] Operator resolved `CF-024`/`CF-025` classification: they are later full-mechanism capabilities, not hard blockers for the internal safe `CF-012` body-evolution seam.
