---
feature_id: F-0019
backlog_item_key: CF-018
stage: implementation
cycle_id: c01
session_id: 019d919b-5b39-7992-b92a-a4b3c75fdfc8
start_ts: 2026-04-15T18:32:29+02:00
source_inputs:
  - AGENTS.md
  - docs/AGENTS.md
  - README.md
  - docs/ssot/index.md
  - docs/architecture/system.md
  - docs/features/F-0019-consolidation-event-envelope-graceful-shutdown.md
  - docs/features/F-0003-tick-runtime-scheduler-episodic-timeline.md
  - docs/features/F-0004-subject-state-kernel-and-memory-model.md
  - docs/features/F-0011-narrative-and-memetic-reasoning-loop.md
  - docs/features/F-0012-homeostat-and-operational-guardrails.md
  - docs/features/F-0015-workshop-datasets-training-eval-and-promotion.md
  - docs/features/F-0016-development-governor-and-change-management.md
  - docs/features/F-0017-git-managed-body-evolution-and-stable-snapshots.md
  - docs/adr/ADR-2026-03-19-canonical-runtime-toolchain.md
  - docs/adr/ADR-2026-03-19-quality-gate-sequence.md
  - docs/adr/ADR-2026-03-19-phase0-deployment-cell.md
  - docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md
repo_overlays:
  - AGENTS.md
  - docs/AGENTS.md
log_required: true
log_required_reason:
  - multi_slice_implementation
  - source_and_test_changes
  - backlog_actualization_expected
  - external_audits_required
backlog_actualized: true
backlog_artifact_integrity: pass
planned_slices:
  - SL-F0019-01
  - SL-F0019-02
  - SL-F0019-03
  - SL-F0019-04
  - SL-F0019-05
slice_status:
  SL-F0019-01: complete
  SL-F0019-02: complete
  SL-F0019-03: complete
  SL-F0019-04: complete
  SL-F0019-05: complete
current_checkpoint: dossier_step_closed
completion_decision: full_scope_complete
canonical_for_commit: true
generated_after_commit: false
freshness_basis: current_worktree_after_race_fixes
operator_command_refs:
  - cmd-001: "закомить отчеты; затем, приступай к implementation для F-0019"
process_miss_refs:
  - pm-001
  - pm-002
  - pm-003
  - pm-004
review_events:
  - rv-001
  - rv-002
  - rv-003
  - rv-004
  - rv-005
  - rv-006
  - rv-007
---

# implementation c01

## Scope

Implementation для `F-0019`: durable lifecycle/consolidation/event-envelope/graceful-shutdown seam внутри существующего `core` runtime и PostgreSQL substrate, с тестами, dossier realignment, backlog actualization и external audits.

## Inputs actually used

- Repo overlays требуют canonical `pnpm` commands, installed skill runtimes и русский язык для `.dossier/logs/`.
- `F-0019` стартовал из состояния `planned`; backlog `CF-018` стартовал в `planned`.
- Plan-slice определил пять implementation slices и allowed stop points после `SL-F0019-01`, `SL-F0019-03`, `SL-F0019-04`, `SL-F0019-05`.
- Runtime contract: existing `Node.js 22 + TypeScript + AI SDK + Hono + PostgreSQL`; новые service/container topology не вводятся.

## Delivered slices

- `SL-F0019-01`: добавлены lifecycle contracts, PostgreSQL store, required envelope fields, replay-safe idempotency, concurrent replay/conflict handling и foreign-owner write guard.
- `SL-F0019-02`: добавлены first-phase consolidation transition allowlist, rejected/accepted transition evidence, memetic promotion provenance guard и bounded dataset-candidate projection evidence.
- `SL-F0019-03`: добавлена retention/compaction evidence surface с permanence, derivative-trace и subject-state schema-version guards.
- `SL-F0019-04`: добавлена graceful-shutdown sequence: public admission close, tick-runtime admission barrier before snapshot, `shutting_down` evidence, terminal evidence after workers/runtime stop.
- `SL-F0019-05`: добавлен read-only rollback-frequency source для Homeostat и deployment-cell usage audit на real lifecycle evidence records.

## Verification

- `node --experimental-strip-types --experimental-test-module-mocks --test packages/db/test/lifecycle-store.integration.test.ts apps/core/test/runtime/graceful-shutdown-sequence.integration.test.ts`: pass, 8 focused F-0019 tests after race fixes.
- `pnpm format`: pass.
- `pnpm typecheck`: pass.
- `pnpm lint`: pass.
- `pnpm test`: pass, 281 tests.
- `pnpm smoke:cell`: pass, 19 smoke tests, including `AC-F0019-16 AC-F0019-17` real lifecycle evidence usage audit.
- `dossier-engineer debt-audit --changed-only`: pass, 47 files scanned, no unresolved debt markers.
- `dossier-engineer dossier-verify --step implementation --dossier docs/features/F-0019-consolidation-event-envelope-graceful-shutdown.md`: pass, artifact `.dossier/verification/F-0019/implementation-553147628a51.json`.
- `dossier-engineer review-artifact --dossier docs/features/F-0019-consolidation-event-envelope-graceful-shutdown.md --step implementation --verdict PASS`: pass, artifact `.dossier/reviews/F-0019/implementation-553147628a51.json`.
- `dossier-engineer dossier-step-close --dossier docs/features/F-0019-consolidation-event-envelope-graceful-shutdown.md --step implementation --verify-artifact .dossier/verification/F-0019/implementation-553147628a51.json --review-artifact .dossier/reviews/F-0019/implementation-553147628a51.json --allow-dirty`: pass, artifact `.dossier/steps/F-0019/implementation.json`, `process_complete=yes`.

## Backlog actualization

- Registered `docs/features/F-0019-consolidation-event-envelope-graceful-shutdown.md` as implementation/test source: `97f90f65-393f-455c-b7ea-9ec09da09343`.
- Applied implementation patch: `docs/backlog/patches/9dbc09d02b06--2026-04-15-027-f-0019-implemented.template.json`.
- Applied self-review cleanup patch for mutation-managed todo: `docs/backlog/patches/42a1615abba1--2026-04-15-028-f-0019-clear-self-review-todos.template.json`.
- Re-ran scoped `refresh --item-key CF-018`; refresh-managed todo for `CF-018` cleared by utility.
- `CF-018`: `delivery_state=implemented`, implementation/test source ids present, gaps none, todo none, artifact integrity pass.
- Remaining backlog attention is on downstream/future items (`CF-014`, `CF-015`, `CF-019`, `CF-025`, `CF-026`, `CF-027`) because they must review `CF-018`/architecture changes in their own future work.

## Review events

- `rv-001`: initial external spec-conformance audit found two major gaps: missing CF-018 backlog actualization and missing real usage audit for `SL-F0019-05`.
- `rv-002`: after backlog actualization and smoke usage audit, repeated spec-conformance audit on `gpt-5.4` confirmed those two findings resolved, but kept DoD at FAIL because review/step-close artifacts were not yet complete.
- `rv-003`: security review on `gpt-5.4` found no confirmed vulnerabilities; residual risks were DB-level grants/RLS assumptions and shutdown fail-closed availability behavior.
- `rv-004`: code review on `gpt-5.4` found two blocking code races and one stale-log issue. Fixes applied in current worktree:
  - lifecycle event insert now handles concurrent idempotency replay/conflict through `ON CONFLICT (idempotency_key) DO NOTHING`, reload and payload-hash compare;
  - tick runtime now exposes `closeAdmission()` and graceful shutdown awaits in-progress admission writes before active-work snapshot;
  - this log was updated from stale checkpoint state.
- `rv-005`: fresh code review on `gpt-5.4` after race fixes returned PASS / no findings. It confirmed concurrent lifecycle idempotency, shutdown admission barrier and stage-log issues are closed.
- `rv-006`: fresh security review on `gpt-5.4` after race fixes returned PASS / no confirmed vulnerabilities. Residual risks remain DB privilege/RLS assumptions, structural-not-referential provenance anchors and shutdown fail-closed availability behavior.
- `rv-007`: final spec-conformance review on `gpt-5.4` after review artifact and step-close returned PASS / no confirmed spec findings. Residual risks remain DB-level ACL/RLS visibility and privileged raw-SQL bypass if future code writes around the lifecycle service contract.

## Process misses

- `pm-001`: bad `dossier-verify` invocation used mutually exclusive `--dossier` and `--changed-only`; corrected by rerunning dossier-scoped verification.
- `pm-002`: first coverage audit failed because AC-F0019-01 was not explicit in test references; corrected by naming AC-F0019-01 in lifecycle-store test coverage.
- `pm-003`: initial external audit agents were incorrectly spawned on `gpt-5.4-mini`; their results were invalidated, agents were closed, and audits were restarted on `gpt-5.4` with `xhigh` reasoning.
- `pm-004`: initial implementation missed two race cases found by `gpt-5.4` code review; both were fixed before commit.

## Close-out

- Implementation step closure is complete: verification artifact, review artifact, step-close artifact and final `gpt-5.4` spec-conformance audit all pass.
- Pending before commit: final git status review and commit.
