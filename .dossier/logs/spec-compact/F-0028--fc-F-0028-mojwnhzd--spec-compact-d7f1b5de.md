---
version: 1
stage: spec-compact
feature_id: F-0028
feature_cycle_id: fc-F-0028-mojwnhzd
cycle_id: spec-compact-d7f1b5de
backlog_item_key: CF-026
primary_feature_id: F-0028
primary_backlog_item_key: CF-026
phase_scope: spec-compact для F-0028 support/operability contract и incident discipline
stage_state: ready_for_close
start_ts: 2026-04-29T10:33:07.235Z
entered_ts: 2026-04-29T10:33:07.235Z
ready_for_close_ts: 2026-04-29T10:36:18.469Z
transition_events:
  - kind: entered
    at: 2026-04-29T10:33:07.235Z
  - kind: ready_for_close
    at: 2026-04-29T10:36:18.469Z
backlog_followup_required: false
backlog_followup_kind: null
backlog_followup_resolved: false
backlog_lifecycle_target: specified
backlog_lifecycle_current: specified
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
session_id: 27fc3a19-9029-43bc-b188-ef2548a2eda8
trace_runtime: codex
trace_locator_kind: session_id
final_delivery_commit: b2b10ecd62172b5583dc3b277efbc136e481e602
final_closure_commit: null
step_artifact: null
closure_bundle_id: null
closure_bundle_round: null
closure_bundle_rounds_by_audit_class: {}
selected_review_artifacts: []
selected_verification_artifact: null
selected_step_artifact: null
selected_closure_ts: null
rpa_source_identity: null
rpa_source_quality: null
non_pass_review_events: []
---

## Scope

`spec-compact` shaped `CF-026` / `F-0028` from intake boundary into a compact support/operability spec. Scope covered incident taxonomy, runbook boundary, support evidence bundle semantics, owner-routed versus human-only recovery actions, read-only consumption of `F-0013` / `F-0023` / `F-0024` / `F-0026`, and proof obligations for later implementation.

## Inputs actually used

- `docs/ssot/features/F-0028-support-operability-contract-incident-discipline.md`
- `docs/notes/backlog-legacy/feature-candidates.md`
- `docs/notes/backlog-legacy/working-system-roadmap-matrix-2026-03-26.md`
- `docs/architecture/system.md`
- `docs/polyphony_concept.md`
- `docs/ssot/features/F-0013-operator-http-api-and-introspection.md`
- `docs/ssot/features/F-0023-observability-and-diagnostic-reporting.md`
- `docs/ssot/features/F-0024-authentication-authorization-operator-rbac.md`
- `docs/ssot/features/F-0026-deploy-release-automation-rollback-orchestration.md`
- `docs/adr/ADR-2026-03-23-plan-mode-decision-gate.md`

## Decisions / reclassifications

### Spec gap decisions

- Plan mode assessment: not required. `CF-026` has a fixed single-item boundary and no unresolved repo-level ADR or competing ownership split after treating `F-0013`, `F-0023`, `F-0024` and `F-0026` as upstream canonical owners.
- First incident taxonomy fixed for this spec: `runtime_availability`, `operator_access`, `reporting_freshness`, `release_or_rollback`, `model_readiness`, `governance_or_safety_escalation`, `support_process_gap`.
- Support evidence bundles are reference ledgers over canonical owner evidence plus support-owned notes; they are not copied source truth.
- Recovery/escalation actions are classified as `owner_routed` or `human_only`; support procedures may not bypass owner seams.
- No repo-level ADR is required at spec time. A future change-proposal/ADR is required only if implementation introduces a support control plane or changes shared runtime/deployment/write ownership.

### Implementation freedom decisions

- Implementation may start with runbook docs plus support evidence artifacts or add support-owned PostgreSQL rows, provided the same evidence contract and owner-boundary rules hold.
- If support API routes are introduced, they must live inside the existing `F-0013` Hono namespace and behind `F-0024` caller admission.
- Runtime/startup/deployment-affecting work or protected side-effect route changes trigger root quality gates and `pnpm smoke:cell`.

### Temporary assumptions

- Delivered `F-0013`, `F-0023`, `F-0024` and `F-0026` surfaces are sufficient upstream owners for support shaping.
- `spec-compact` changes backlog lifecycle only from `intaken` to `specified`; no dependency/source mutation is required.

## Operator feedback

Operator requested proceeding from `feature-intake` into `spec-compact`.

## Review events

none

## Backlog follow-up

Backlog lifecycle actualization is required before truthful close: `CF-026` must advance from `intaken` to at least `specified`.

## Process misses

none

## Transition events

- 2026-04-29T10:33:07.235Z: entered
- 2026-04-29T10:36:18.469Z: ready_for_close

## Close-out

Stage remains open until backlog lifecycle actualization, material commit freeze, external `spec-conformance-reviewer` PASS, `dossier-verify --step spec-compact`, and `dossier-step-close`.
