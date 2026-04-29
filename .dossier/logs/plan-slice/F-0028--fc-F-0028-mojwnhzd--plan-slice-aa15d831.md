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
session_id: 7f14e92d-039b-4291-a402-c68f7060420b
trace_runtime: codex
trace_locator_kind: session_id
final_delivery_commit: 785b4827022b28c82b5b85e12197b9d969b4db51
final_closure_commit: null
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
