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
backlog_actualization_artifacts:
  - .dossier/backlog/patches/7211128a2049--2026-04-29-060-f0028-spec-compact-actualization.patch.json
backlog_actualization_verdict: actualized_by_backlog_artifact
review_artifacts:
  - .dossier/reviews/F-0028/spec-compact--spec-conformance-reviewer--r01--pass--739cb04f5683.json
verification_artifacts:
  - .dossier/verification/F-0028/spec-compact-739cb04f5683.json
required_audit_classes:
  - spec-conformance-reviewer
executed_audit_classes:
  - spec-conformance-reviewer
required_external_review_pending: false
review_events:
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0028/spec-compact--spec-conformance-reviewer--r01--pass--739cb04f5683.json
    audit_class: spec-conformance-reviewer
    evidence_count: 0
    event_commit: 739cb04f56836dea53a479b5cce1a69029487cc6
    implementation_scope: null
    invalidated: false
    latest_copy_path: .dossier/reviews/F-0028/spec-compact--spec-conformance-reviewer--latest.json
    must_fix_count: 0
    recorded_at: 2026-04-29T10:39:57.475Z
    review_mode: external
    review_attempt_id: spec-compact--spec-conformance-reviewer--r01
    review_round_id: r01
    review_round_number: 1
    reviewer: external-agent-codex
    reviewer_agent_id: 019dd8d0-c9eb-7372-8850-a09be760e595
    reviewer_skill: spec-conformance-reviewer
    reviewer_thread_id: 019dd8d0-c9eb-7372-8850-a09be760e595
    security_trigger_reason: null
    stale: false
    verdict: PASS
reviewer_skills:
  - spec-conformance-reviewer
reviewer_agent_ids:
  - 019dd8d0-c9eb-7372-8850-a09be760e595
review_trace_commits:
  - 739cb04f56836dea53a479b5cce1a69029487cc6
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
final_closure_commit: 739cb04f56836dea53a479b5cce1a69029487cc6
step_artifact: .dossier/steps/F-0028/spec-compact.json
closure_bundle_id: spec-compact--bundle-4587cd46d432--r01--739cb04f5683
closure_bundle_round: 1
closure_bundle_rounds_by_audit_class:
  spec-conformance-reviewer: 1
selected_review_artifacts:
  - .dossier/reviews/F-0028/spec-compact--spec-conformance-reviewer--r01--pass--739cb04f5683.json
selected_verification_artifact: .dossier/verification/F-0028/spec-compact-739cb04f5683.json
selected_step_artifact: .dossier/steps/F-0028/spec-compact.json
selected_closure_ts: 2026-04-29T10:40:32.601Z
rpa_source_identity:
  schema_version: 1
  feature_id: F-0028
  backlog_item_key: CF-026
  feature_cycle_id: fc-F-0028-mojwnhzd
  cycle_id: spec-compact-d7f1b5de
  stage: spec-compact
  dossier: docs/ssot/features/F-0028-support-operability-contract-incident-discipline.md
  stage_log: .dossier/logs/spec-compact/F-0028--fc-F-0028-mojwnhzd--spec-compact-d7f1b5de.md
  stage_state_path: .dossier/stages/F-0028/spec-compact.json
  step_artifact: .dossier/steps/F-0028/spec-compact.json
  event_commit: 739cb04f56836dea53a479b5cce1a69029487cc6
  session_id: 27fc3a19-9029-43bc-b188-ef2548a2eda8
  trace_runtime: codex
rpa_source_quality:
  schema_version: 1
  review_history_quality: complete
  selected_bundle_quality: complete
  missing_fail_artifact_count: 0
  trace_only_fail_count: 0
  same_thread_rejected_count: 0
  invalid_launch_mode_process_miss_count: 0
  unrecoverable_historical_fail_present: false
  limitations: []
non_pass_review_events: []
stage_entry_commit: null
implementation_review_scope: null
required_security_review: false
security_trigger_reasons: []
step_close_ts: 2026-04-29T10:40:32.622Z
process_complete_ts: 2026-04-29T10:40:32.622Z
intake_process_complete_ts: null
local_gates_green_ts: null
first_review_agent_started_ts: 2026-04-29T10:39:57.475Z
final_pass_ts: 2026-04-29T10:39:57.475Z
verification_trace_commit: 739cb04f56836dea53a479b5cce1a69029487cc6
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
