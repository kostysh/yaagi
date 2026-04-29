---
version: 1
stage: plan-slice
feature_id: F-0028
feature_cycle_id: fc-F-0028-mojwnhzd
cycle_id: plan-slice-aa15d831
backlog_item_key: CF-026
primary_feature_id: F-0028
primary_backlog_item_key: CF-026
phase_scope: plan-slice для F-0028 support/operability contract и incident discipline
stage_state: ready_for_close
start_ts: 2026-04-29T10:44:10.581Z
entered_ts: 2026-04-29T10:44:10.581Z
ready_for_close_ts: 2026-04-29T10:46:34.248Z
transition_events:
  - kind: entered
    at: 2026-04-29T10:44:10.581Z
  - kind: ready_for_close
    at: 2026-04-29T10:46:34.248Z
backlog_followup_required: false
backlog_followup_kind: null
backlog_followup_resolved: false
backlog_lifecycle_target: planned
backlog_lifecycle_current: planned
backlog_lifecycle_reconciled: true
backlog_actualization_artifacts:
  - .dossier/backlog/patches/9566c639ed46--2026-04-29-061-f0028-plan-slice-actualization.patch.json
backlog_actualization_verdict: actualized_by_backlog_artifact
review_artifacts:
  - .dossier/reviews/F-0028/plan-slice--spec-conformance-reviewer--r01--pass--d8a1f6051c3e.json
verification_artifacts:
  - .dossier/verification/F-0028/plan-slice-d8a1f6051c3e.json
required_audit_classes:
  - spec-conformance-reviewer
executed_audit_classes:
  - spec-conformance-reviewer
required_external_review_pending: false
review_events:
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0028/plan-slice--spec-conformance-reviewer--r01--pass--d8a1f6051c3e.json
    audit_class: spec-conformance-reviewer
    evidence_count: 3
    event_commit: d8a1f6051c3e49370ab524bdf222ce18fc36c754
    implementation_scope: null
    invalidated: false
    latest_copy_path: .dossier/reviews/F-0028/plan-slice--spec-conformance-reviewer--latest.json
    must_fix_count: 0
    recorded_at: 2026-04-29T10:50:03.513Z
    review_mode: external
    review_attempt_id: plan-slice--spec-conformance-reviewer--r01
    review_round_id: r01
    review_round_number: 1
    reviewer: external-agent-codex
    reviewer_agent_id: null
    reviewer_skill: spec-conformance-reviewer
    reviewer_thread_id: 019dd8da-e05a-79e0-ae65-c2e5dcb8a8a1
    security_trigger_reason: null
    stale: false
    verdict: PASS
reviewer_skills:
  - spec-conformance-reviewer
reviewer_agent_ids: []
review_trace_commits:
  - d8a1f6051c3e49370ab524bdf222ce18fc36c754
degraded_review_present: false
invalidated_review_present: false
stale_review_present: false
skills_used:
  - unified-dossier-engineer
skill_issues: []
skill_followups: []
process_misses: []
session_id: 7f14e92d-039b-4291-a402-c68f7060420b
trace_runtime: codex
trace_locator_kind: session_id
final_delivery_commit: 785b4827022b28c82b5b85e12197b9d969b4db51
final_closure_commit: d8a1f6051c3e49370ab524bdf222ce18fc36c754
policy_admission_risk_profile: applicable
policy_admission_risk_rationale: F-0028 implementation will admit support
  evidence writes and optional support operator routes, replay incident/evidence
  operations, close incidents from durable evidence, and gate owner-routed
  recovery actions through existing runtime/operator owner seams.
policy_admission_risk_families:
  - admission
  - replay
  - evidence
  - runtime-gating
policy_admission_negative_matrix:
  - ac: AC-F0028-05
    risk: admission
    negative_test: unauthenticated or unauthorized support evidence write is denied
      before handler mutation
    production_path: F-0013 support route guarded by F-0024 caller admission
    evidence: apps/core/test/platform/operator-support.integration.test.ts
  - ac: AC-F0028-08
    risk: replay
    negative_test: duplicate incident open or evidence attach with same request/ref
      is idempotent and conflicting replay is rejected
    production_path: support incident/evidence write path
    evidence: apps/core/test/support/support-evidence.contract.test.ts
  - ac: AC-F0028-11
    risk: evidence
    negative_test: critical incident close without terminal owner evidence or
      human-only residual-risk disposition remains blocked
    production_path: support incident close path
    evidence: apps/core/test/support/support-evidence.contract.test.ts
  - ac: AC-F0028-10
    risk: runtime-gating
    negative_test: owner-routed recovery action is unavailable when target owner
      seam refuses or lacks capability
    production_path: support action routing to F-0013/F-0026/F-0016 owner seams
    evidence: apps/core/test/support/support-action-boundary.contract.test.ts
  - ac: AC-F0028-12
    risk: evidence
    negative_test: stale or missing report/release/auth evidence blocks or degrades
      support closure
    production_path: support closure evidence validation
    evidence: apps/core/test/support/support-canonical-refs.integration.test.ts
policy_admission_matrix_status: complete
policy_admission_matrix_blockers: []
step_artifact: .dossier/steps/F-0028/plan-slice.json
closure_bundle_id: plan-slice--bundle-a9fcda324f33--r01--d8a1f6051c3e
closure_bundle_round: 1
closure_bundle_rounds_by_audit_class:
  spec-conformance-reviewer: 1
selected_review_artifacts:
  - .dossier/reviews/F-0028/plan-slice--spec-conformance-reviewer--r01--pass--d8a1f6051c3e.json
selected_verification_artifact: .dossier/verification/F-0028/plan-slice-d8a1f6051c3e.json
selected_step_artifact: .dossier/steps/F-0028/plan-slice.json
selected_closure_ts: 2026-04-29T10:51:03.012Z
rpa_source_identity:
  schema_version: 1
  feature_id: F-0028
  backlog_item_key: CF-026
  feature_cycle_id: fc-F-0028-mojwnhzd
  cycle_id: plan-slice-aa15d831
  stage: plan-slice
  dossier: docs/ssot/features/F-0028-support-operability-contract-incident-discipline.md
  stage_log: .dossier/logs/plan-slice/F-0028--fc-F-0028-mojwnhzd--plan-slice-aa15d831.md
  stage_state_path: .dossier/stages/F-0028/plan-slice.json
  step_artifact: .dossier/steps/F-0028/plan-slice.json
  event_commit: d8a1f6051c3e49370ab524bdf222ce18fc36c754
  session_id: 7f14e92d-039b-4291-a402-c68f7060420b
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
step_close_ts: 2026-04-29T10:51:03.033Z
process_complete_ts: 2026-04-29T10:51:03.033Z
intake_process_complete_ts: null
local_gates_green_ts: null
first_review_agent_started_ts: 2026-04-29T10:50:03.513Z
final_pass_ts: 2026-04-29T10:50:03.513Z
verification_trace_commit: d8a1f6051c3e49370ab524bdf222ce18fc36c754
---

## Scope

Запланирован `plan-slice` для `F-0028` / `CF-026`: support/operability contract, incident discipline, runbook taxonomy, support evidence bundle, owner-routed/human-only recovery boundaries and canonical consumption of `F-0013`, `F-0023`, `F-0024`, `F-0026`.

## Inputs actually used

- `AGENTS.md` repo overlay, including Plan mode assessment and canonical `dossier-engineer` runtime requirement.
- `docs/ssot/features/F-0028-support-operability-contract-incident-discipline.md`.
- `docs/architecture/system.md`, `README.md`, `docs/polyphony_concept.md` and linked upstream feature dossiers from the `F-0028` frontmatter.
- `docs/adr/ADR-2026-03-23-plan-mode-decision-gate.md`.
- `unified-dossier-engineer` references: status/scope, audit policy and policy/admission risk families.
- Backlog item `CF-026`, currently `specified` before plan-slice actualization.

## Decisions / reclassifications

### Spec gap decisions

- Plan mode is not required before this `plan-slice`: the `spec-compact` result already fixed the support ownership boundary, upstream owner seams, evidence-as-refs model and no-control-plane constraint.
- Implementation target is one complete support/operability seam, not a docs-only placeholder.
- Planned order is: contract/taxonomy/runbooks, support evidence substrate, canonical surface consumption, action boundary handling, docs/coverage/closure gates.
- No repo-level ADR is required for the planned path. Change-proposal or ADR is required if implementation introduces a support control plane, shared executor authority, deployment ownership change or cross-feature write authority.

### Implementation freedom decisions

- Support APIs may be implemented only inside the existing `F-0013` Hono operator boundary and behind `F-0024` caller admission.
- Support evidence persistence may write only support-owned rows or artifacts and may link to foreign owner evidence only by refs.
- Owner-routed recovery actions must fail closed when the target owner seam refuses, is unavailable or lacks the requested capability.

### Temporary assumptions

- Planned test filenames may be adjusted during implementation to match local module layout, but the AC coverage, risk-family coverage and no-foreign-write semantics are not optional.
- `release-policy` risk is not declared because `F-0028` routes release/rollback concerns through `F-0026` and does not own rollout or rollback policy.

## Operator feedback

none

## Review events

none

## Backlog follow-up

- Required: actualize `CF-026` from `specified` to `planned`.
- Planned artifact: `.dossier/backlog/patches/2026-04-29-061-f0028-plan-slice-actualization.patch.json`.
- Closure must reference the canonical applied/hash artifact produced by `dossier-engineer patch-item`.

## Process misses

none

## Transition events

- 2026-04-29T10:44:10.581Z: entered
- 2026-04-29T10:46:34.248Z: ready_for_close

## Close-out

none
