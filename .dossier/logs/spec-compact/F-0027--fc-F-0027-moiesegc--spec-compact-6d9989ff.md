---
version: 1
stage: spec-compact
feature_id: F-0027
feature_cycle_id: fc-F-0027-moiesegc
cycle_id: spec-compact-6d9989ff
backlog_item_key: CF-019
primary_feature_id: F-0027
primary_backlog_item_key: CF-019
phase_scope: spec-compact для CF-019 specialist organ rollout and retirement policy
stage_state: ready_for_close
start_ts: 2026-04-28T10:05:37.112Z
entered_ts: 2026-04-28T10:05:37.112Z
ready_for_close_ts: 2026-04-28T10:09:23.886Z
transition_events:
  - kind: entered
    at: 2026-04-28T10:05:37.112Z
  - kind: ready_for_close
    at: 2026-04-28T10:09:23.886Z
backlog_followup_required: false
backlog_followup_kind: null
backlog_followup_resolved: true
backlog_lifecycle_target: specified
backlog_lifecycle_current: specified
backlog_lifecycle_reconciled: true
backlog_actualization_artifacts:
  - .dossier/backlog/patches/a144ff6136e4--2026-04-28-056-f0027-spec-compact-actualization.patch.json
backlog_actualization_verdict: actualized_by_backlog_artifact
review_artifacts:
  - .dossier/reviews/F-0027/spec-compact--spec-conformance-reviewer--r01--pass--288184de05c4.json
verification_artifacts:
  - .dossier/verification/F-0027/spec-compact-bc802a20ae5e.json
  - .dossier/verification/F-0027/spec-compact-288184de05c4.json
required_audit_classes:
  - spec-conformance-reviewer
executed_audit_classes:
  - spec-conformance-reviewer
required_external_review_pending: false
review_events:
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0027/spec-compact--spec-conformance-reviewer--r01--pass--288184de05c4.json
    audit_class: spec-conformance-reviewer
    event_commit: 288184de05c40b416856b0b1ef6b01e1236de5c1
    implementation_scope: null
    invalidated: false
    latest_copy_path: .dossier/reviews/F-0027/spec-compact--spec-conformance-reviewer--latest.json
    must_fix_count: 0
    recorded_at: 2026-04-28T10:15:36.602Z
    review_mode: external
    review_attempt_id: spec-compact--spec-conformance-reviewer--r01
    review_round_id: r01
    review_round_number: 1
    reviewer: external-spec-review-agent
    reviewer_agent_id: 019dd394-a93c-7383-a581-826e50525b56
    reviewer_skill: spec-conformance-reviewer
    reviewer_thread_id: 019dd394-a93c-7383-a581-826e50525b56
    security_trigger_reason: null
    stale: false
    verdict: PASS
reviewer_skills:
  - spec-conformance-reviewer
reviewer_agent_ids:
  - 019dd394-a93c-7383-a581-826e50525b56
review_trace_commits:
  - 288184de05c40b416856b0b1ef6b01e1236de5c1
degraded_review_present: false
invalidated_review_present: false
stale_review_present: false
skills_used:
  - unified-dossier-engineer
skill_issues: []
skill_followups: []
process_misses: []
session_id: 019dd354-e429-7961-a9f5-a93d47eaaf96
trace_runtime: codex
trace_locator_kind: session_id
final_delivery_commit: bc802a20ae5eeb9c65f5d02763e3d8b0de7d88bf
final_closure_commit: 288184de05c40b416856b0b1ef6b01e1236de5c1
step_artifact: .dossier/steps/F-0027/spec-compact.json
stage_entry_commit: null
implementation_review_scope: null
required_security_review: false
security_trigger_reasons: []
step_close_ts: 2026-04-28T10:16:17.312Z
process_complete_ts: 2026-04-28T10:16:17.312Z
intake_process_complete_ts: null
local_gates_green_ts: null
first_review_agent_started_ts: 2026-04-28T10:15:36.602Z
final_pass_ts: 2026-04-28T10:15:36.602Z
verification_trace_commit: 288184de05c40b416856b0b1ef6b01e1236de5c1
---

## Scope

- Сформирована compact specification для `F-0027` / `CF-019`.
- Область ограничена specialist organ rollout/admission/retirement policy поверх уже доставленных `F-0014`, `F-0015`, `F-0016`, `F-0020` и `F-0026`.
- Source/test/runtime код в этой стадии не менялся.

## Inputs actually used

- Repo overlay: `AGENTS.md`.
- Plan mode assessment: Plan mode не потребовался, потому что граница CF-019 уже задана как policy overlay для specialist organs поверх delivered prerequisites; новые repo-level ADR или альтернативная ownership-модель на этом шаге не нужны.
- Backlog card: `dossier-engineer items --item-keys CF-019`.
- Architecture/runtime context: `README.md`, `docs/architecture/system.md`, `docs/polyphony_concept.md`.
- Legacy backlog sources: `docs/notes/backlog-legacy/feature-candidates.md`, `docs/notes/backlog-legacy/working-system-roadmap-matrix-2026-03-26.md`.
- Dependency dossiers: `F-0014`, `F-0015`, `F-0016`, `F-0020`, `F-0026`.
- Repo ADRs: `ADR-2026-03-23-plan-mode-decision-gate`, `ADR-2026-03-25-ai-sdk-runtime-substrate`, `ADR-2026-03-19-phase0-deployment-cell`.

## Decisions / reclassifications

### Spec gap decisions

- `F-0027` owns specialist rollout policies, admission decisions and retirement decisions.
- `F-0027` does not own workshop datasets/training/eval/candidate source truth, richer registry source ownership, real-serving readiness, governor approval or release/deploy execution.
- Specialist rollout extends the `F-0015` candidate lifecycle instead of creating a second specialist-only promotion state machine.
- Router selection remains separate from specialist admission. A selected specialist may execute only after `F-0027` policy validates stage, evidence, health, traffic limit and fallback.
- Retirement is append-only policy truth, not deletion; retired specialists preserve evidence and lineage while becoming ineligible for normal routing/admission.
- Repo-level ADR is not required for this spec. It becomes required only if implementation changes router invariants, boot-critical dependency policy, deployment contracts or cross-feature write ownership.

### Implementation freedom decisions

- Exact table names, service/module names and route names remain `plan-slice` decisions.
- Implementation may choose whether specialist policy state is modelled as separate tables or as owner-scoped modules over existing DB infrastructure, as long as the semantic surfaces in section 5.3 are preserved.
- Operator-facing routes are optional. If introduced, they must stay inside the existing protected operator namespace and delegate to the same specialist policy service.

### Temporary assumptions

- `F-0014`, `F-0015`, `F-0016`, `F-0020` and `F-0026` are delivered enough for `spec-compact`.
- Specialist profile creation can use existing richer model profile and serving-dependency identities through owner-bounded adapters.
- First implementation should begin with shadow-only or tightly bounded limited-active semantics rather than broad live specialist activation.

## Operator feedback

- Operator asked to continue after `feature-intake` and execute `spec-compact`.

## Review events

none

## Backlog follow-up

- `spec-compact` required backlog lifecycle actualization: `CF-019` needed to move from `defined` to `specified`.
- Applied canonical backlog patch `.dossier/backlog/patches/a144ff6136e4--2026-04-28-056-f0027-spec-compact-actualization.patch.json`.
- Re-ran `spec-compact --ready-for-close --backlog-followup-resolved`; current stage state records `backlog_lifecycle_current: specified`, `backlog_lifecycle_reconciled: true`, and `backlog_followup_required: false`.

## Process misses

none

## Transition events

- 2026-04-28T10:05:37.112Z: entered
- 2026-04-28T10:09:23.886Z: ready_for_close

## Close-out

- `dossier-verify` passed with `.dossier/verification/F-0027/spec-compact-288184de05c4.json`.
- Independent `spec-conformance-reviewer` audit PASS was recorded in `.dossier/reviews/F-0027/spec-compact--spec-conformance-reviewer--r01--pass--288184de05c4.json`.
- `dossier-step-close` wrote `.dossier/steps/F-0027/spec-compact.json` with `process_complete=yes`.
- Next workflow stage is `plan-slice`.
