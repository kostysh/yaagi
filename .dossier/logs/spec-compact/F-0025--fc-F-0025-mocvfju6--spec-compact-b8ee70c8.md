---
version: 1
stage: spec-compact
feature_id: F-0025
feature_cycle_id: fc-F-0025-mocvfju6
cycle_id: spec-compact-b8ee70c8
backlog_item_key: CF-027
primary_feature_id: F-0025
primary_backlog_item_key: CF-027
phase_scope: spec-compact for CF-027 mature phase-6 governance closure
stage_state: ready_for_close
start_ts: 2026-04-24T12:37:56.064Z
entered_ts: 2026-04-24T12:37:56.064Z
ready_for_close_ts: 2026-04-24T12:42:40.589Z
transition_events:
  - kind: entered
    at: 2026-04-24T12:37:56.064Z
  - kind: ready_for_close
    at: 2026-04-24T12:41:30.157Z
  - kind: ready_for_close
    at: 2026-04-24T12:42:40.589Z
backlog_followup_required: false
backlog_followup_kind: null
backlog_followup_resolved: true
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
session_id: 019dbf3f-4287-7722-9adb-c3ec2482111e
trace_runtime: codex
trace_locator_kind: session_id
final_delivery_commit: 80117500ef9a1d121d0547f8db515291ac4f3ca1
final_closure_commit: null
step_artifact: null
---

## Scope

- Shaped `F-0025` from intake skeleton into a compact specification for backlog item `CF-027`.
- Scope is limited to mature phase-6 governance policy facts: policy profiles, policy activation, consultant admission, richer perception-policy decisions and phase-6 governance decision evidence.
- No source code or tests were changed in this pass.

## Inputs actually used

- Plan mode assessment: not required. Reason: intake already fixed the `CF-027` owner boundary, no competing scope split remained, no repo-level ADR was required, and the step could proceed as feature-local shaping.
- Backlog item card: `dossier-engineer items --item-keys CF-027`.
- Architecture sources: `README.md`, `docs/architecture/system.md`, `docs/polyphony_concept.md`.
- Backlog migration sources: `docs/notes/backlog-legacy/feature-candidates.md`, `docs/notes/backlog-legacy/working-system-roadmap-matrix-2026-03-26.md`.
- Repo ADRs: `ADR-2026-03-23-plan-mode-decision-gate`, `ADR-2026-03-23-perception-intake-contract`.
- Adjacent dossiers: `F-0005`, `F-0008`, `F-0016`, `F-0018`, `F-0023`, `F-0024`.

## Decisions / reclassifications

### Spec gap decisions

- `F-0025` is the mature phase-6 policy/admission owner; it is not a model-profile, governor, perimeter, auth, reporting, deployment or support owner.
- Policy profiles are governance policy profiles, not router/model profiles.
- Consultant admission is explicit and fail-closed; missing, ambiguous, stale, unsupported or unhealthy consultant paths produce structured refusal before invocation.
- Perception policies extend the canonical `StimulusEnvelope` / `stimulus_inbox` intake contract without a second durable intake layer.
- No repo-level ADR is required at spec time; feature-local ADR blocks capture the policy/admission/refusal decisions.

### Implementation freedom decisions

- `plan-slice` may choose exact table/module names if it preserves the semantic surfaces named in the compact design.
- `plan-slice` may decide whether operator-facing profile activation endpoints are needed; any endpoint must stay inside the existing `F-0013` / `F-0024` boundary and high-risk activation must compose with `F-0016`.
- External consultant endpoint configuration format is left to implementation planning, but external consultant paths remain optional and never boot-critical.

### Temporary assumptions

- Existing delivered dependencies are sufficient for shaping: `F-0005`, `F-0008`, `F-0016`, `F-0018`, `F-0023` and `F-0024`.
- `CF-027` does not require backlog split during spec-compact; any future cross-owner write authority discovery must return through backlog/change-proposal.
- Initial implementation should activate a conservative baseline policy profile with external consultants disabled.

## Operator feedback

- Operator asked to proceed directly from canonical feature-intake into `spec-compact`.

## Review events

none

## Backlog follow-up

- Initial ready-for-close detected required backlog lifecycle actualization from `defined` to `specified`.
- Applied canonical backlog patch `.dossier/backlog/patches/f5e2be69d14c--2026-04-24-047-f0025-spec-compact-actualization.patch.json`.
- Re-ran `spec-compact --ready-for-close --backlog-followup-resolved`; stage state now records `backlog_lifecycle_current: specified`, `backlog_lifecycle_reconciled: true`, `backlog_followup_required: false`.

## Process misses

none

## Transition events

- 2026-04-24T12:37:56.064Z: entered
- 2026-04-24T12:41:30.157Z: ready_for_close
- 2026-04-24T12:42:40.589Z: ready_for_close

## Close-out

- Stage is ready for verification and external `spec-conformance-reviewer` review.
- Truthful closure still requires `dossier-verify`, external PASS review artifact and `dossier-step-close`.
