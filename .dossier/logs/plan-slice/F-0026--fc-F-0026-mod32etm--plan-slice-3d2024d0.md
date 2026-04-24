---
version: 1
stage: plan-slice
feature_id: F-0026
feature_cycle_id: fc-F-0026-mod32etm
cycle_id: plan-slice-3d2024d0
backlog_item_key: CF-025
primary_feature_id: F-0026
primary_backlog_item_key: CF-025
phase_scope: plan-slice for CF-025 deploy release automation and rollback orchestration
stage_state: ready_for_close
start_ts: 2026-04-24T17:05:20.598Z
entered_ts: 2026-04-24T17:05:20.598Z
ready_for_close_ts: 2026-04-24T17:09:21.027Z
transition_events:
  - kind: entered
    at: 2026-04-24T17:05:20.598Z
  - kind: resumed
    at: 2026-04-24T17:09:16.511Z
  - kind: ready_for_close
    at: 2026-04-24T17:09:21.027Z
backlog_followup_required: false
backlog_followup_kind: null
backlog_followup_resolved: false
backlog_lifecycle_target: planned
backlog_lifecycle_current: planned
backlog_lifecycle_reconciled: true
backlog_actualization_artifacts: []
backlog_actualization_verdict: current_state_satisfies_target
review_artifacts: []
verification_artifacts: []
required_audit_classes:
  - spec-conformance-reviewer
executed_audit_classes: []
required_external_review_pending: true
review_events: []
reviewer_skills: []
reviewer_agent_ids: []
review_trace_commits: []
degraded_review_present: false
invalidated_review_present: false
stale_review_present: false
skills_used:
  - unified-dossier-engineer
skill_issues: []
skill_followups: []
process_misses: []
session_id: dad12ca3-6a08-4a60-bd93-827425582d16
trace_runtime: codex
trace_locator_kind: session_id
final_delivery_commit: d17934223b2f812982059232d5c61a8fe57546b1
final_closure_commit: null
step_artifact: null
---

## Scope

- Этап `plan-slice` для `F-0026 / CF-025`.
- Цель: подготовить implementation-ready handoff для release/deploy/rollback owner surface: contracts, PostgreSQL store, release service, CLI path, protected Operator API, smoke-on-deploy, automatic rollback and owner-boundary closure.
- Код на этом этапе не менялся; менялись только dossier, backlog and process artifacts.
- Plan mode assessment: Plan mode не требуется. `spec-compact` уже зафиксировал выбор сред, хранилища evidence, automatic rollback и CLI/API control surface; оставшаяся работа является feature-local sequencing без новой развилки ownership, repo-level ADR или deployment topology.

## Inputs actually used

- `AGENTS.md`: repo overlay, Plan mode gate для `plan-slice`, canonical runtime requirement, operator-language logs.
- `README.md`: canonical stack, root quality commands, local secret/runtime notes and smoke command.
- `docs/architecture/system.md`: canonical deployment cell, Hono/operator boundary, governor/lifecycle/reporting owner matrix, release/rollback context.
- Repo ADRs: `ADR-2026-03-19-canonical-runtime-toolchain`, `ADR-2026-03-19-phase0-deployment-cell`, `ADR-2026-03-19-quality-gate-sequence`, `ADR-2026-03-23-plan-mode-decision-gate`.
- Backlog card: `dossier-engineer items --item-keys CF-019,CF-026,CF-025`.
- Backlog attention: `dossier-engineer attention`.
- Shaped dossier: `docs/ssot/features/F-0026-deploy-release-automation-rollback-orchestration.md`.
- Adjacent delivered owner dossiers and source surfaces: `F-0002`, `F-0007`, `F-0016`, `F-0019`, `F-0020`, `F-0023`, `F-0024`.
- Existing repo seams used for implementation planning: `packages/contracts/src`, `packages/db/src`, `infra/migrations`, `apps/core/src/platform`, `apps/core/src/runtime`, `apps/core/src/security`, `infra/docker`, `scripts`, and matching test directories.

## Decisions / reclassifications

### Spec gap decisions

- `F-0026` moves from compact design to an implementation plan with one new owner surface named `release-automation`.
- First implementation order is contracts/store, CLI evidence path, smoke-on-deploy plus automatic rollback, protected Operator API, then owner-boundary/reporting closure.
- `release_cell` remains a production-like contour over the existing deployment-cell contract; no second Compose stack or orchestration substrate is planned.
- Operator API work must stay under the delivered `F-0013` Hono namespace and use `F-0024` caller admission/RBAC before invoking release behavior.
- Runtime/startup/deployment-affecting implementation closure must include root quality gates and `pnpm smoke:cell`.

### Implementation freedom decisions

- Exact table names may vary, but semantic surfaces must stay separate: release requests, deploy attempts, release evidence, rollback plans and rollback executions.
- The implementation may place the main owner service under `apps/core/src/platform/release-automation.ts`; a split layout is allowed only if CLI/API still call the same service.
- File evidence layout is implementation freedom if PostgreSQL rows remain authoritative for decisions/state and file artifacts are only linked evidence.
- CLI command shape may vary, but the supported command surface must be root `pnpm` over repo-local TypeScript, not a hidden local wrapper.

### Temporary assumptions

- Delivered `F-0002`, `F-0007`, `F-0016`, `F-0019`, `F-0020`, `F-0023` and `F-0024` expose enough evidence/read APIs for tests or bounded adapters without owner realignment.
- Existing migration numbering can advance to `022_release_automation.sql`.
- If a neighbouring evidence source is unavailable in implementation, the release path returns structured refusal/unavailable rather than fabricating proxy evidence.

## Operator feedback

- User asked to execute `plan-slice`.
- Earlier user constraint remains active: backlog must not retain `attention` entries.

## Review events

none

## Backlog follow-up

- Required: yes.
- Kind: backlog-lifecycle-actualization.
- Reason: `CF-025` delivery state must move from `specified` to `planned` after implementation-ready slicing is materialized.
- Applied patch: `.dossier/backlog/patches/0478b46727c8--2026-04-24-052-f0026-plan-slice-actualization.patch.json`.
- Result: `CF-025` delivery state is `planned`.
- The lifecycle patch created dependency-change review TODOs for `CF-019` and `CF-026`; both were reviewed as no-op because `F-0026` still does not own specialist rollout/retirement or support/incident discipline.
- Applied dependent review closeout patch: `.dossier/backlog/patches/5f3f989f1ba8--2026-04-24-053-cf025-plan-dependent-review-closeout.patch.json`.
- Result: `dossier-engineer attention` returns an empty data array.

## Process misses

none

## Transition events

- 2026-04-24T17:05:20.598Z: entered
- 2026-04-24T17:09:16.511Z: resumed
- 2026-04-24T17:09:21.027Z: ready_for_close

## Close-out

- Pending until baseline commit, verification, external `spec-conformance-reviewer` audit and `dossier-step-close` complete.
