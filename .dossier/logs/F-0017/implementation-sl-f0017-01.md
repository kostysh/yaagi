```yaml
feature_id: F-0017
backlog_item_key: CF-012
stage: implementation
cycle_id: sl-f0017-01
package_id: SL-F0017-01
session_id: 019d7490-46d0-7811-b43f-056bb617a7ab
start_ts: 2026-04-10T20:49:59+02:00
ready_for_review_ts: 2026-04-11T00:20:28+02:00
final_pass_ts: 2026-04-11T00:38:20+02:00
source_inputs:
  - AGENTS.md
  - README.md
  - docs/ssot/index.md
  - docs/architecture/system.md#7.2-code_change_proposals
  - docs/architecture/system.md#7.3
  - docs/architecture/system.md#11.2
  - docs/architecture/system.md#11.3
  - docs/architecture/system.md#11.4
  - docs/architecture/system.md#11.5
  - docs/architecture/system.md#13.3
  - docs/architecture/system.md#14.5
  - docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md
  - docs/adr/ADR-2026-03-19-quality-gate-sequence.md
  - docs/features/F-0017-git-managed-body-evolution-and-stable-snapshots.md
  - docs/features/F-0001-constitutional-boot-recovery.md
  - docs/features/F-0002-canonical-monorepo-deployment-cell.md
  - docs/features/F-0010-executive-center-and-bounded-action-layer.md
  - docs/features/F-0015-workshop-datasets-training-eval-and-promotion.md
  - docs/features/F-0016-development-governor-and-change-management.md
repo_overlays:
  - AGENTS.md
log_required: true
log_required_reason:
  - package_based_implementation
  - executable_code_change
  - external_audit
  - retrospective_process_telemetry
backlog_actualized: false
verification_artifact: .dossier/verification/F-0017/implementation-495d9db08c4c.json
review_artifact: .dossier/reviews/F-0017/implementation-c05ce744f188.json
step_artifact: .dossier/steps/F-0017/implementation.json
metrics:
  scope_paths_count: 14
  spec_review_rounds_total: 2
  code_review_rounds_total: 2
  security_review_rounds_total: 2
  debt_items_found_total: 0
  debt_items_resolved_total: 0
  review_findings_total: 5
  process_misses_total: 0
  backlog_actualization_count: 0
  commit_recorded: false
```

# Журнал имплементации: F-0017 / SL-F0017-01

## Scope

Реализован первый пакет `SL-F0017-01`: internal body-change contract, source module и DB-backed store/service для request normalization, authority validation, proposal/event persistence и fail-closed body boundary guards.

Публичные routes, deploy activation, stable snapshot promotion, actual Git worktree mutation и candidate commit execution не входят в этот пакет. Эти части остаются в следующих slices.

## Inputs actually used

- Repo overlay: `AGENTS.md`.
- Canonical stack/runtime: `README.md`.
- Навигация и статус: `docs/ssot/index.md`.
- Target dossier: `docs/features/F-0017-git-managed-body-evolution-and-stable-snapshots.md`.
- Архитектура: PostgreSQL `code_change_proposals`, файловые области `/seed/body` и `/workspace/body`, canonical code-change flow, Git refs/worktrees, review policy, stable snapshots, restricted shell policy и volume policy.
- ADRs: AI SDK runtime substrate и quality gate sequence.
- Зависимые delivered dossiers: `F-0001`, `F-0002`, `F-0010`, `F-0015`, `F-0016`.

## Decisions / reclassifications

- `SL-F0017-01` создаёт только внутренний безопасный seam. Operator/public API и полный deploy pipeline не добавлялись.
- Governor authority сделана инъекционной: без `verifyGovernorApproval` governor path fail-closed, human override path требует `ownerOverrideEvidenceRef`.
- Body proposal surfaces принадлежат `F-0017`: `packages/contracts/src/body-evolution.ts`, `packages/db/src/body-evolution.ts`, `apps/core/src/body/body-evolution.ts`.
- Worktree в этом slice ещё не создаётся физически; сервис вычисляет и сохраняет intended worktree path строго под materialized writable body root.
- Boundary guards отклоняют direct writes в `/seed/body`, symlink/path escape и unverifiable filesystem boundary до persistence.
- Smoke path не запускался: slice не меняет startup/deployment behavior и не активирует runtime/public route.

## Operator feedback

- Оператор попросил приступить к имплементации после закрытого `plan-slice`.
- Repo overlay требует писать stage logs на языке оператора; журнал ведётся на русском.

## Review events

- 2026-04-10T21:04:58+02:00 local completeness review: найден риск в DB store `this` binding и риск throw при unverifiable filesystem boundary.
- 2026-04-10T21:09:09+02:00 follow-up applied: DB store переведён на closure helpers; filesystem boundary errors теперь fail-closed как `worktree_escape_rejected`; добавлен regression test.
- 2026-04-11T00:20:28+02:00 follow-up applied: proposal store hardened against concurrent `request_id` insert race через `on conflict do nothing + reload existing row`; добавлены regression tests для deduplicated/conflict replay after race.
- 2026-04-11T00:20:28+02:00 follow-up applied: `AC-F0017-06` clarified to distinguish worktree path resolution in `SL-F0017-01` from actual worktree creation in `SL-F0017-02`.
- 2026-04-11T00:20:28+02:00 external audit round 1 findings:
  - `spec-conformance`: major overclaim around `AC-F0017-06`; minor traceability payload gap.
  - `code-reviewer`: blocking worktree-root symlink escape and blocking `worktreePath` collision risk.
  - `security-reviewer`: medium `worktree_path` collision risk.
- 2026-04-11T00:32:41+02:00 follow-up applied: `worktreePath` made collision-resistant with normalized-hash suffix; DB schema now enforces unique `worktree_path`; worktree root now passes the same fail-closed boundary guard as target paths; proposal event payload stores actor/source plus explicit nulls for unavailable lifecycle fields; regression tests added for worktree-root symlink escape and path collision resistance.
- 2026-04-11T00:38:14+02:00 independent review PASS persisted in `.dossier/reviews/F-0017/implementation-c05ce744f188.json` after spec/code/security rerun PASS.
- 2026-04-11T00:38:20+02:00 implementation step closed with `process_complete: true`; next workflow stage remains `implementation` for `SL-F0017-02`.

## Checks

- `pnpm format` — pass.
- `pnpm typecheck` — pass.
- `pnpm lint` — pass.
- `pnpm test` — pass, 220 tests.
- `dossier-verify --dossier docs/features/F-0017-git-managed-body-evolution-and-stable-snapshots.md --step implementation --extra "pnpm format:check" --extra "pnpm typecheck" --extra "pnpm lint" --extra "pnpm test"` — pass.
- `git diff --check` — pass.

## Debt review

- Manual changed-scope review: no unresolved stubs, placeholders, hidden deferred behavior, or production debt markers found.
- `dossier-engineer debt-audit --changed-only` — pass; 36 files scanned; no unresolved debt markers.
- Test harness `throw new Error` usages are expected assertions for unsupported query shapes and are not production debt.

## Backlog actualization

- `backlog-engineer status`: 27 total items, 0 gaps, 0 needs_attention, 0 open todo.
- `CF-012` remains `planned`, ready for next step, no gaps/todo.
- No backlog patch was applied because `SL-F0017-01` is partial delivery of `F-0017`; strongest evidence does not yet support `delivery_state = implemented` for the whole backlog item.

## Process misses

- None recorded.

## Close-out

- Verification artifact: `.dossier/verification/F-0017/implementation-495d9db08c4c.json`.
- Review artifact: `.dossier/reviews/F-0017/implementation-c05ce744f188.json`.
- Step artifact: `.dossier/steps/F-0017/implementation.json`.
- Process complete: yes.
- Blocking items: none for `SL-F0017-01`; feature-wide next work remains `SL-F0017-02`.
