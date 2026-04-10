---
id: F-0017
title: Git-управляемая эволюция тела и стабильные снапшоты
status: in_progress
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
- **User problem:** После delivery `F-0016` у системы есть governor approval/outcome surface, но нет owner seam, который безопасно исполняет body/code evolution. Без такого seam self-modification может мутировать live body или tracked `/seed`, обходить governor gates, производить code proposals без body eval suites и оставлять boot/recovery без надежной stable snapshot точки возврата.
- **Goal:** Зафиксировать внутренний Git-governed body-evolution path: заметные body changes идут через isolated worktrees поверх materialized writable body, проходят bounded proposal/eval/review flow, выпускают stable snapshot manifests/tags и возвращают governor-compatible execution/rollback evidence без захвата ownership у boot, workshop, governor, reporting или deploy/release seams.
- **Non-goals:** Этот dossier не реализует public auth/RBAC (`CF-024`), deploy/release automation (`CF-025`), mature perimeter hardening (`CF-014`), read-only reporting/stable-snapshot inventories (`CF-015`), workshop candidate lifecycle (`F-0015`) или governor source tables/decision policy (`F-0016`). `CF-024` и `CF-025` остаются будущими обязательными capabilities для полного public/operator-controlled и deployable механизма.
- **Current substrate / baseline:** `F-0001` уже владеет boot/recovery boundary и last-stable rollback refs; `F-0002` поставляет canonical monorepo/deployment cell и materialized runtime/workspace paths; `F-0010` владеет bounded action layer и Git/tool wrappers; `F-0015` поставляет workshop evidence/promotion-package handoff; `F-0016` поставляет freeze/proposal/decision/execution-outcome governor gates. Architecture and concept sources require Git worktrees, stable tags/snapshots, eval/review gates and rollback as body-governance discipline.

### Terms & thresholds

- `materialized writable body`: runtime/workspace copy of body code derived from immutable `/seed/body`; all automated body edits target this copy, not tracked seed.
- `body change proposal`: body-owned execution record for an approved code/body change request, linked to governor approval and local worktree/eval evidence.
- `stable snapshot`: validated rollback unit tying together git tag, schema version, active model profile map, critical configuration hash and eval summary.
- `internal safe mechanism`: non-public owner path for preparing, evaluating and snapshotting body changes; it is not a public operator execution API.
- `full mechanism`: later public/operator RBAC plus deploy/release/rollback automation delivered by `CF-024` and `CF-025`.

## 2. Scope

### In scope

- Body-owned code change proposal records and lifecycle states for approved internal body changes.
- Isolated branch/worktree orchestration inside materialized writable body.
- Explicit read-only consumption of governor approvals and bounded write-back of execution/rollback evidence through `F-0016` owner gates.
- Proposal-specific eval suite execution plus canonical repository quality gates before candidate commits and stable snapshots.
- Stable snapshot manifest/tag production for body-owned rollback units.
- Rollback evidence handoff that boot/recovery and future reporting can consume without granting body evolution ownership over their source surfaces.
- Operator-facing documentation of the current cap: internal safe body evolution now, public RBAC and full deploy pipeline later.

### Out of scope

- Direct mutation of tracked `/seed` sources or live runtime body outside isolated worktree flow.
- Direct writes into governor tables, boot/recovery continuity fields, workshop lifecycle rows or read-only reporting surfaces.
- Public operator authentication/authorization, role checks and stronger human gates.
- Environment promotion, release orchestration, smoke-on-deploy and production rollback automation.
- Specialist rollout/retirement, model candidate lifecycle and workshop dataset/training/eval ownership.

### Constraints

- `/seed/body` is immutable tracked source for this seam; body-evolution automation must fail closed if a requested write targets `/seed/body`.
- Every non-trivial body change must use an isolated branch/worktree under materialized writable body.
- Symlink traversal must not allow writes outside the materialized writable body root.
- Candidate commit creation requires passing canonical repository quality gates and the proposal-declared eval suite.
- Runtime, startup or deployment contract changes require `pnpm smoke:cell` before the proposal can reach `candidate_committed`.
- Stable snapshot creation requires a validated manifest containing git tag, schema version, active model profile map, critical configuration hash and eval summary.
- Governor approval/outcome semantics remain owner-routed through `F-0016`; this dossier may call owner gates but must not write governor source tables directly.

### Assumptions

- Current backlog truth marks `CF-012` as `defined`, ready for specification, with no gaps or blockers.
- Delivered prerequisites listed in frontmatter are sufficient for the internal safe mechanism.
- Body-evolution implementation starts from repository-local Git/workspace mechanics and uses installed skill runtimes directly when dossier/backlog automation is needed.
- `CF-024` and `CF-025` are later capability constraints, not blockers for the internal owner seam.

### Open questions

- None after `spec-compact`. Dependency classification, stable snapshot ownership and mandatory eval expectations are fixed in the decision log below.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0017-01:** Запрос body change допускается в lifecycle при ссылке на approved governor proposal.
- **AC-F0017-02:** Запрос body change допускается в lifecycle при явно записанном owner-approved override evidence ref.
- **AC-F0017-03:** Запрос body change без approved governor proposal и без owner-approved override evidence ref отклоняется до создания worktree.
- **AC-F0017-04:** Повтор body change request с тем же normalized request hash возвращает существующий body change proposal.
- **AC-F0017-05:** Повтор body change request с тем же request id при другом normalized request hash отклоняется как conflict.
- **AC-F0017-06:** Persisted worktree path resolution for future worktree creation размещает proposal worktree под materialized writable body root.
- **AC-F0017-07:** Попытка записи в tracked `/seed/body` отклоняется до file mutation.
- **AC-F0017-08:** Symlink traversal escape за materialized writable body root отклоняется до file mutation.
- **AC-F0017-09:** Body change proposal record содержит proposal id.
- **AC-F0017-10:** Body change proposal record содержит governor ref.
- **AC-F0017-11:** Body change proposal record содержит branch name.
- **AC-F0017-12:** Body change proposal record содержит worktree path.
- **AC-F0017-13:** Body change proposal record содержит lifecycle status.
- **AC-F0017-14:** Body change proposal record содержит required eval suite.
- **AC-F0017-15:** Body change proposal record содержит provenance evidence refs.
- **AC-F0017-16:** Candidate commit creation блокируется до прохождения canonical repository quality gates.
- **AC-F0017-17:** Candidate commit creation блокируется до прохождения proposal-declared eval suite.
- **AC-F0017-18:** Runtime/startup/deployment contract change не достигает `candidate_committed` без успешного `pnpm smoke:cell`.
- **AC-F0017-19:** Stable snapshot creation валидирует git tag.
- **AC-F0017-20:** Stable snapshot record содержит schema version.
- **AC-F0017-21:** Stable snapshot record содержит active model profile map.
- **AC-F0017-22:** Stable snapshot record содержит critical configuration hash.
- **AC-F0017-23:** Stable snapshot record содержит eval summary.
- **AC-F0017-24:** Stable snapshot publication не обновляет boot/recovery continuity fields напрямую.
- **AC-F0017-25:** Rollback evidence содержит proposal id.
- **AC-F0017-26:** Rollback evidence содержит snapshot id.
- **AC-F0017-27:** Rollback evidence содержит rollback reason.
- **AC-F0017-28:** Rollback evidence содержит verification result.
- **AC-F0017-29:** Execution outcome evidence отправляется только через `F-0016` owner gate.
- **AC-F0017-30:** Rollback outcome evidence отправляется только через `F-0016` owner gate.
- **AC-F0017-31:** F-0017 не предоставляет public/operator execution route до `CF-024`.
- **AC-F0017-32:** F-0017 не выполняет environment promotion до `CF-025`.
- **AC-F0017-33:** F-0017 не выполняет release activation до `CF-025`.

## 4. Non-functional requirements (NFR)

- **Safety:** Observable signal: boundary tests include 0 successful `/seed/body` writes and 0 successful worktree-root escapes.
- **Recoverability:** Observable signal: `snapshot_ready` transition is covered by a manifest validation event plus rollback-evidence creation for the same proposal id.
- **Traceability:** Observable signal: each lifecycle transition event stores proposal id, governor ref, branch/worktree path, candidate commit or snapshot id, eval result, actor/source, where unavailable fields are recorded explicitly as `null`.
- **Determinism:** Observable signal: repeated normalized request hashing across process restarts yields the same hash in the idempotency test.
- **Operational proof:** Observable signal: any runtime/startup/deployment-affecting closure bundle includes `pnpm smoke:cell` evidence.

## 5. Design (compact)

### 5.1 API surface

F-0017 exposes internal service/command surfaces, not a public HTTP route.

```ts
type BodyChangeAuthority =
  | {
      requestedByOwner: "governor";
      governorProposalId: string;
      governorDecisionRef: string;
      ownerOverrideEvidenceRef?: never;
    }
  | {
      requestedByOwner: "human_override";
      ownerOverrideEvidenceRef: string;
      governorProposalId?: never;
      governorDecisionRef?: never;
    };

type BodyChangeRequest = BodyChangeAuthority & {
  requestId: string;
  scopeKind: "code" | "config" | "body_manifest";
  rationale: string;
  requiredEvalSuite: string;
  targetPaths: string[];
  rollbackPlanRef: string;
  evidenceRefs: string[];
};

type BodyChangeProposal = {
  proposalId: string;
  requestId: string;
  normalizedRequestHash: string;
  requestedByOwner: "governor" | "human_override";
  governorProposalId?: string;
  governorDecisionRef?: string;
  ownerOverrideEvidenceRef?: string;
  branchName: string;
  worktreePath: string;
  candidateCommitSha?: string;
  stableSnapshotId?: string;
  status: BodyChangeStatus;
  evidenceRefs: string[];
};
```

Error model:

- `governor_not_approved`: missing approved governor ref for governor-sourced requests.
- `override_not_recorded`: missing owner-approved override evidence for human-override requests.
- `request_hash_conflict`: same request id with different normalized payload.
- `seed_write_rejected`: target path resolves under `/seed/body`.
- `worktree_escape_rejected`: target path or symlink resolves outside writable body root.
- `eval_failed`: required quality/eval suite did not pass.
- `smoke_required`: runtime/startup/deployment change lacks `pnpm smoke:cell` evidence.
- `snapshot_manifest_invalid`: stable snapshot manifest is incomplete or inconsistent.

Retry/idempotency:

- same `requestId + normalizedRequestHash` returns the existing proposal;
- same `requestId` with different hash rejects fail-closed;
- snapshot publication is idempotent only when the manifest hash matches the existing snapshot record.

### 5.2 Runtime / deployment surface

- Runs inside the canonical repo/workspace path from `README.md`.
- Uses Git operations through the bounded action/tool layer, not through unrestricted shell writes.
- Creates worktrees only under materialized writable body.
- Does not publish public operator routes in this feature.
- Does not perform environment promotion or release activation in this feature.

### 5.3 Data model changes

F-0017 owns the body-evolution source surfaces:

- `code_change_proposals`: proposal id, governor ref, request hash, branch/worktree path, candidate commit, required eval suite, status and provenance refs.
- `body_change_events`: append-only lifecycle events for proposal transitions, eval results, snapshot publication and rollback evidence.
- `stable_snapshots`: snapshot id, git tag, schema version, active model profile map, critical config hash, eval summary and manifest hash.

Ownership limits:

- `agent_state.last_stable_snapshot_id` and boot/recovery continuity remain `F-0001` owned.
- `development_ledger`, governor proposal/decision/outcome tables remain `F-0016` owned.
- reporting inventories remain future `CF-015` read-only projections.

### 5.4 Edge cases and failure modes

- Dirty existing worktree: reject or require a new proposal/worktree; do not reuse implicitly.
- Missing governor approval: reject before worktree creation.
- Active freeze after approval: call governor owner gate and follow its result; do not bypass freeze locally.
- Eval failure: preserve evidence, mark proposal as failed/rejected, do not create candidate commit or snapshot.
- Snapshot manifest mismatch: reject publication and keep proposal below `snapshot_ready`.
- Rollback failure: emit failed rollback evidence; do not claim governor execution outcome success.
- Duplicate request replay: return existing record only when normalized hash matches.
- Symlink/path escape: reject before write.

### 5.5 Verification surface / initial verification plan

- AC-F0017-01, AC-F0017-02, AC-F0017-03: contract/integration tests for governor approval intake plus owner override intake.
- AC-F0017-04, AC-F0017-05: idempotency/replay conflict tests for request hash replay.
- AC-F0017-06, AC-F0017-07, AC-F0017-08: boundary tests for collision-resistant worktree root placement, seed immutability, worktree-root symlink escape and target-path symlink escape.
- AC-F0017-09, AC-F0017-10, AC-F0017-11, AC-F0017-12, AC-F0017-13, AC-F0017-14, AC-F0017-15: persistence/contract tests for proposal record fields.
- AC-F0017-16, AC-F0017-17, AC-F0017-18: integration tests for quality/eval/smoke gate enforcement.
- AC-F0017-19, AC-F0017-20, AC-F0017-21, AC-F0017-22, AC-F0017-23, AC-F0017-24: snapshot manifest tests plus boot/recovery boundary test.
- AC-F0017-25, AC-F0017-26, AC-F0017-27, AC-F0017-28: rollback evidence contract tests.
- AC-F0017-29, AC-F0017-30: governor owner-gate outcome tests.
- AC-F0017-31, AC-F0017-32, AC-F0017-33: route/surface tests plus deployment-boundary tests proving the full public/deploy mechanism remains absent.

### 5.6 Representation upgrades

#### Body change status

| Status | Meaning | Terminal |
|---|---|---|
| `requested` | Approved request accepted and persisted. | no |
| `worktree_ready` | Isolated branch/worktree exists under writable body root. | no |
| `evaluating` | Required quality/eval suite is running or recorded. | no |
| `evaluation_failed` | Required proof failed; no candidate commit or snapshot may be created. | yes |
| `candidate_committed` | Candidate commit exists after required proofs passed. | no |
| `snapshot_ready` | Stable snapshot manifest/tag validated and recorded. | no |
| `rolled_back` | Rollback evidence recorded for a proposal/snapshot. | yes |
| `rejected` | Request rejected before candidate commit. | yes |

#### Gate decision list

| Condition | Result |
|---|---|
| `requestedByOwner = "governor"` without approved governor ref | reject `governor_not_approved` |
| `requestedByOwner = "human_override"` without owner override evidence | reject `override_not_recorded` |
| Same request id plus same normalized hash exists | return existing proposal |
| Same request id with different normalized hash exists | reject `request_hash_conflict` |
| Target resolves under `/seed/body` | reject `seed_write_rejected` |
| Target escapes writable body root through symlink/path resolution | reject `worktree_escape_rejected` |
| Required quality/eval suite fails | set `evaluation_failed` |
| Runtime/startup/deployment change lacks `pnpm smoke:cell` evidence | reject `smoke_required` |
| Stable snapshot manifest is incomplete | reject `snapshot_manifest_invalid` |

### 5.7 Definition of Done

- All ACs have executable proof references in the coverage map.
- Boundary tests prove seed immutability and worktree root confinement.
- Governor handoff tests prove F-0017 consumes approvals and emits outcomes only through owner gates.
- Snapshot tests prove manifest validation and rollback evidence.
- Public route and deploy activation tests prove `CF-024`/`CF-025` scope is not accidentally implemented here.
- Dossier verification, independent review and step closure pass for implementation.
- Backlog state is actualized through `backlog-engineer` at each truth-changing stage.

### 5.8 Rollout / activation note

Activation order:

1. Implement internal body-evolution source surfaces and path guards.
2. Enable isolated worktree/eval/candidate commit flow for internal owner calls only.
3. Enable stable snapshot manifest/tag production.
4. Enable bounded governor execution/rollback evidence handoff.
5. Leave public/operator execution blocked until `CF-024`.
6. Leave environment promotion/release activation blocked until `CF-025`.

Rollback limits:

- F-0017 rollback restores body state through stable snapshot evidence and local Git refs.
- F-0017 rollback is not a production release rollback; that belongs to `CF-025`.

## 6. Slicing plan (2–6 increments)

Forecast policy: slices below are implementation forecast, not separate product commitments. Commitment remains in ACs, Definition of Done, verification gates and rollout constraints.

### Dependency visibility

- Depends on: `F-0001`; owner: `@codex`; unblock condition: delivered boot/recovery continuity fields remain read-only for F-0017 and stable snapshot outputs are consumable without back-writing those fields.
- Depends on: `F-0002`; owner: `@codex`; unblock condition: delivered canonical monorepo/deployment cell and materialized writable body paths remain the runtime substrate for worktree operations.
- Depends on: `F-0010`; owner: `@codex`; unblock condition: delivered bounded action/tool layer remains the only path for Git and filesystem mutation.
- Depends on: `F-0015`; owner: `@codex`; unblock condition: delivered workshop evidence/promotion package remains read-only input and is not re-owned by body evolution.
- Depends on: `F-0016`; owner: `@codex`; unblock condition: delivered governor approval/outcome owner gates remain the only authority path for proposal decisions and execution/rollback evidence.

### Contract risks to kill before implementation close-out

- Authority ambiguity: `governor` and `human_override` must stay mutually exclusive request authority paths.
- Root/path ambiguity: every write path must resolve under materialized writable body and never under tracked `/seed/body`.
- Retry ambiguity: request replay must be idempotent only for the same normalized hash.
- Gate ambiguity: candidate commit must not exist before repo gates and proposal eval suite pass.
- Ownership ambiguity: F-0017 must not write governor, boot/recovery, workshop, reporting, public auth or deploy/release source surfaces.

### SL-F0017-01 — Proposal authority, persistence and body boundary guards

Deliverable:

- Internal body-change service/source module with request normalization, authority validation, proposal/event persistence and fail-closed path guards.
- Collision-resistant worktree-root resolver that accepts only materialized writable body paths for future worktree creation.
- Boundary guards rejecting tracked `/seed/body` targets and symlink/path escapes before file mutation.

AC coverage:

- AC-F0017-01, AC-F0017-02, AC-F0017-03, AC-F0017-04, AC-F0017-05
- AC-F0017-06, AC-F0017-07, AC-F0017-08
- AC-F0017-09, AC-F0017-10, AC-F0017-11, AC-F0017-12, AC-F0017-13, AC-F0017-14, AC-F0017-15

Verification artifacts:

- Contract tests for `BodyChangeAuthority`, idempotent replay and conflict rejection.
- Persistence tests for proposal/event fields.
- Boundary tests for worktree root placement, worktree-root symlink escape, `/seed/body` rejection and symlink/path escape rejection.
- Changed-source gate: `pnpm format`, `pnpm typecheck`, `pnpm lint`.

Depends on:

- `F-0002`; owner: `@codex`; unblock condition: materialized writable body path contract is available.
- `F-0010`; owner: `@codex`; unblock condition: bounded tool/Git execution remains the write path.
- `F-0016`; owner: `@codex`; unblock condition: governor approval/override evidence can be consumed read-only.

Assumes:

- Runtime path configuration can expose both immutable seed and materialized writable body roots to the body-evolution service.

Fallback:

- If runtime path configuration is incomplete, stop after persistence/authority tests and add an explicit implementation blocker rather than deriving paths ad hoc.

Approval / decision path:

- No ADR expected if implementation stays within existing path/root and owner-boundary contracts.
- Architecture or ADR update required if a new writable root, new public route or new owner surface appears.

### SL-F0017-02 — Eval-gated worktree execution and candidate commits

Deliverable:

- Internal worktree execution flow that creates isolated proposal branches/worktrees under materialized writable body.
- Proposal lifecycle transitions through `worktree_ready`, `evaluating`, `evaluation_failed` and `candidate_committed`.
- Gate adapter that requires canonical repo quality gates plus proposal-declared eval suite before candidate commit.
- Runtime/startup/deployment detector that requires `pnpm smoke:cell` evidence before `candidate_committed`.

AC coverage:

- AC-F0017-16, AC-F0017-17, AC-F0017-18
- Regression coverage for AC-F0017-04, AC-F0017-05, AC-F0017-06, AC-F0017-07, AC-F0017-08

Verification artifacts:

- Integration tests for gate pass/fail paths and lifecycle transitions.
- Test fixture proving failed eval records evidence and does not create candidate commit.
- Test fixture proving runtime/startup/deployment changes are blocked without `pnpm smoke:cell` evidence.
- Changed-source gate: `pnpm format`, `pnpm typecheck`, `pnpm lint`.
- Runtime/deployment gate when touched: `pnpm test` and `pnpm smoke:cell`.

Depends on:

- `SL-F0017-01`; owner: `@codex`; unblock condition: proposal persistence, authority validation and path guards are merged.
- `F-0010`; owner: `@codex`; unblock condition: Git/worktree operations can be executed through bounded action/tool layer.

Assumes:

- Proposal eval suite can be represented as a named local command/evidence contract without adding public deploy orchestration.

Fallback:

- If eval suite naming is not yet stable, keep candidate commits blocked and add a narrow follow-up blocker before implementation closure.

Approval / decision path:

- Repo ADR update required only if quality gate order changes from `format -> typecheck -> lint` or if smoke semantics change.

### SL-F0017-03 — Stable snapshots, rollback evidence, owner-gated outcomes and usage audit

Deliverable:

- Stable snapshot manifest/tag creation for body-owned rollback units.
- Rollback evidence creation linked to proposal id, snapshot id, rollback reason and verification result.
- Governor-compatible execution/rollback outcome evidence emitted only through `F-0016` owner gates.
- Negative surface checks proving no public/operator execution route and no deploy/release activation.
- Real usage audit of the internal flow, with corrective findings pre-classified before close-out.

AC coverage:

- AC-F0017-19, AC-F0017-20, AC-F0017-21, AC-F0017-22, AC-F0017-23, AC-F0017-24
- AC-F0017-25, AC-F0017-26, AC-F0017-27, AC-F0017-28
- AC-F0017-29, AC-F0017-30, AC-F0017-31, AC-F0017-32, AC-F0017-33

Verification artifacts:

- Manifest validation tests for git tag, schema version, active model profile map, critical config hash and eval summary.
- Boot/recovery boundary test proving stable snapshot publication does not update continuity fields directly.
- Rollback evidence contract tests.
- Governor owner-gate integration tests for execution and rollback outcomes.
- Route/surface/deploy-boundary tests proving public execution and release activation are absent.
- Real usage audit log with findings classified as `docs-only`, `runtime`, `schema/help`, `cross-skill` or `audit-only`.
- Changed-source gate: `pnpm format`, `pnpm typecheck`, `pnpm lint`.
- Runtime/deployment gate when touched: `pnpm test` and `pnpm smoke:cell`.

Depends on:

- `SL-F0017-02`; owner: `@codex`; unblock condition: candidate commit and eval evidence flow exists.
- `F-0001`; owner: `@codex`; unblock condition: boot/recovery continuity remains read-only and consumes rollback refs through its own boundary.
- `F-0016`; owner: `@codex`; unblock condition: owner-gated outcome evidence submission remains available.

Assumes:

- Stable snapshot tags can be produced in the local Git context without production release activation.

Fallback:

- If tag creation conflicts with repo release rules, store manifest/evidence first and block `snapshot_ready` until the tag policy is clarified.

Approval / decision path:

- Architecture update required if stable snapshot manifest fields or ownership boundaries change.
- Future backlog handoff remains `CF-024` for public/operator RBAC and `CF-025` for deploy/release automation.

### Drift guard and real usage audit

- Drift guard: each implementation slice must re-check `F-0017`, `F-0016`, `F-0001`, `F-0010`, `README.md` and relevant ADRs before source edits.
- Drift guard: if implementation adds a route, release activation, boot continuity write, governor table write, workshop lifecycle write or reporting source write, stop and realign scope before continuing.
- Real usage audit: after `SL-F0017-03`, exercise the internal body-change flow once in a non-public/local mode and classify findings as `docs-only`, `runtime`, `schema/help`, `cross-skill` or `audit-only`.
- Expected corrective categories: `runtime` for path/eval edge cases, `schema/help` for manifest or internal command output mismatch, `cross-skill` for governor/backlog/dossier handoff ambiguity, `docs-only` for operator-facing explanation gaps, `audit-only` for observations that do not change behavior.

### Rollout / activation plan

1. Merge `SL-F0017-01` with internal APIs still unreachable from public/operator routes.
2. Merge `SL-F0017-02` with candidate commits blocked unless repo gates and proposal eval pass.
3. Merge `SL-F0017-03` with stable snapshot/rollback evidence enabled for internal owner calls only.
4. Keep public/operator execution disabled until `CF-024`.
5. Keep environment promotion and release activation disabled until `CF-025`.

Rollback limits:

- Roll back each implementation slice through normal Git revert if source behavior regresses.
- Runtime body rollback inside F-0017 is limited to stable snapshot evidence and local Git refs.
- Production release rollback remains out of scope and belongs to `CF-025`.

## 7. Task list (implementation units)

- **T-F0017-01:** Implement `SL-F0017-01`. — implemented
- **T-F0017-02:** Implement `SL-F0017-02`.
- **T-F0017-03:** Implement `SL-F0017-03`.
- **T-F0017-04:** Run `SL-F0017-03` real usage audit and classify corrective findings as `docs-only`, `runtime`, `schema/help`, `cross-skill` or `audit-only`.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0017-01 | `packages/contracts/test/body-evolution/body-change-contract.test.ts`; `apps/core/test/body/body-evolution-service.contract.test.ts` | implemented for `SL-F0017-01` authority intake |
| AC-F0017-02 | `packages/contracts/test/body-evolution/body-change-contract.test.ts`; `apps/core/test/body/body-evolution-service.contract.test.ts` | implemented for `SL-F0017-01` owner override intake |
| AC-F0017-03 | `packages/contracts/test/body-evolution/body-change-contract.test.ts`; `apps/core/test/body/body-evolution-service.contract.test.ts` | implemented for `SL-F0017-01` fail-closed authority rejection before persistence/worktree planning |
| AC-F0017-04 | `packages/db/test/body-evolution-store.integration.test.ts`; `apps/core/test/body/body-evolution-service.contract.test.ts` | implemented for `SL-F0017-01` same-hash replay idempotency |
| AC-F0017-05 | `packages/db/test/body-evolution-store.integration.test.ts`; `apps/core/test/body/body-evolution-service.contract.test.ts` | implemented for `SL-F0017-01` changed-hash replay conflict rejection |
| AC-F0017-06 | `apps/core/test/body/body-evolution-service.contract.test.ts` | implemented for `SL-F0017-01` collision-resistant persisted worktree path invariant under materialized writable body |
| AC-F0017-07 | `apps/core/test/body/body-evolution-service.contract.test.ts` | implemented for `SL-F0017-01` tracked `/seed/body` write rejection before persistence |
| AC-F0017-08 | `apps/core/test/body/body-evolution-service.contract.test.ts` | implemented for `SL-F0017-01` symlink/path escape rejection before persistence |
| AC-F0017-09 | `packages/contracts/test/body-evolution/body-change-contract.test.ts`; `packages/db/test/body-evolution-store.integration.test.ts`; `apps/core/test/body/body-evolution-service.contract.test.ts` | implemented for `SL-F0017-01` proposal id persistence |
| AC-F0017-10 | `packages/contracts/test/body-evolution/body-change-contract.test.ts`; `packages/db/test/body-evolution-store.integration.test.ts`; `apps/core/test/body/body-evolution-service.contract.test.ts` | implemented for `SL-F0017-01` governor/override authority refs |
| AC-F0017-11 | `packages/contracts/test/body-evolution/body-change-contract.test.ts`; `packages/db/test/body-evolution-store.integration.test.ts`; `apps/core/test/body/body-evolution-service.contract.test.ts` | implemented for `SL-F0017-01` branch name persistence |
| AC-F0017-12 | `packages/contracts/test/body-evolution/body-change-contract.test.ts`; `packages/db/test/body-evolution-store.integration.test.ts`; `apps/core/test/body/body-evolution-service.contract.test.ts` | implemented for `SL-F0017-01` worktree path persistence |
| AC-F0017-13 | `packages/contracts/test/body-evolution/body-change-contract.test.ts`; `packages/db/test/body-evolution-store.integration.test.ts`; `apps/core/test/body/body-evolution-service.contract.test.ts` | implemented for `SL-F0017-01` lifecycle status persistence |
| AC-F0017-14 | `packages/contracts/test/body-evolution/body-change-contract.test.ts`; `packages/db/test/body-evolution-store.integration.test.ts`; `apps/core/test/body/body-evolution-service.contract.test.ts` | implemented for `SL-F0017-01` required eval suite persistence |
| AC-F0017-15 | `packages/contracts/test/body-evolution/body-change-contract.test.ts`; `packages/db/test/body-evolution-store.integration.test.ts`; `apps/core/test/body/body-evolution-service.contract.test.ts` | implemented for `SL-F0017-01` provenance evidence refs |
| AC-F0017-16 | `SL-F0017-02` repository quality gate integration test | planned |
| AC-F0017-17 | `SL-F0017-02` proposal eval suite gate integration test | planned |
| AC-F0017-18 | `SL-F0017-02` smoke-required gate test for runtime/startup/deployment changes | planned |
| AC-F0017-19 | `SL-F0017-03` stable snapshot git tag validation test | planned |
| AC-F0017-20 | `SL-F0017-03` stable snapshot schema version persistence test | planned |
| AC-F0017-21 | `SL-F0017-03` stable snapshot model profile map persistence test | planned |
| AC-F0017-22 | `SL-F0017-03` stable snapshot config hash persistence test | planned |
| AC-F0017-23 | `SL-F0017-03` stable snapshot eval summary persistence test | planned |
| AC-F0017-24 | `SL-F0017-03` boot/recovery back-write boundary test | planned |
| AC-F0017-25 | `SL-F0017-03` rollback proposal id evidence test | planned |
| AC-F0017-26 | `SL-F0017-03` rollback snapshot id evidence test | planned |
| AC-F0017-27 | `SL-F0017-03` rollback reason evidence test | planned |
| AC-F0017-28 | `SL-F0017-03` rollback verification result evidence test | planned |
| AC-F0017-29 | `SL-F0017-03` execution outcome owner-gate integration test | planned |
| AC-F0017-30 | `SL-F0017-03` rollback outcome owner-gate integration test | planned |
| AC-F0017-31 | `SL-F0017-03` public route absence test | planned |
| AC-F0017-32 | `SL-F0017-03` environment promotion absence test | planned |
| AC-F0017-33 | `SL-F0017-03` release activation absence test | planned |

## 9. Decision log (ADR blocks)

- **PD-F0017-01 [normative now]:** Current `CF-012` scope delivers an internal safe body-evolution mechanism without public RBAC and without the full deploy pipeline. Later `CF-024` and `CF-025` must extend it into the full public/operator-controlled and deployable mechanism.
- **PD-F0017-02 [normative now]:** F-0017 owns stable snapshot record/tag production for body changes, but it does not own boot/recovery continuity pointers or reporting inventories.
- **PD-F0017-03 [normative now]:** Candidate commit creation requires both canonical repo gates and the proposal-declared eval suite; runtime/startup/deployment changes additionally require `pnpm smoke:cell`.
- **PD-F0017-04 [normative now]:** Worktree automation must target materialized writable body only; tracked `/seed/body` is read-only canonical input.
- **PD-F0017-05 [normative now]:** `human_override` is an alternative authority path with `ownerOverrideEvidenceRef`; it does not also require governor proposal ids.

## 10. Progress & links

- Backlog item key: CF-012
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Issue:
- PRs:
- Current workflow stage: `implementation`; current package `SL-F0017-01` implemented and awaiting implementation audits/closure. Next package after closure: `SL-F0017-02`.

## 11. Change log

- 2026-04-10: Initial dossier created from backlog item `CF-012` at backlog delivery state `defined`.
- 2026-04-10: [clarification] Intake context expanded with body/worktree ownership, immutable seed constraint, governor/boot boundaries and open dependency classification questions.
- 2026-04-10: [clarification] Operator resolved `CF-024`/`CF-025` classification: they are later full-mechanism capabilities, not hard blockers for the internal safe `CF-012` body-evolution seam.
- 2026-04-10: [scope realignment] `spec-compact` completed: ACs, NFRs, compact design, state/gate representations, verification surface and rollout cap are defined for the internal safe body-evolution mechanism.
- 2026-04-10: [scope realignment] `plan-slice` drafted: three coherent implementation slices cover authority/path guards, eval-gated candidate commits, and stable snapshot/rollback/outcome handoff without public RBAC or deploy activation.
- 2026-04-10: [scope realignment] `plan-slice` closed after verification, independent review and backlog actualization of `CF-012` to `planned`.
- 2026-04-10: [implementation] `SL-F0017-01` implemented the internal body-evolution authority/persistence/path-guard seam: contracts, DB source surfaces, store, core service, deterministic request hash replay including concurrent request-id race recovery, collision-resistant persisted worktree path resolver under materialized writable body, self-describing proposal lifecycle event payloads, `/seed/body` rejection and symlink/path escape rejection.
- 2026-04-11: [clarification] `AC-F0017-06` was narrowed from implicit immediate worktree creation to explicit worktree path resolution plus later creation, matching the approved slice split between `SL-F0017-01` and `SL-F0017-02`.
