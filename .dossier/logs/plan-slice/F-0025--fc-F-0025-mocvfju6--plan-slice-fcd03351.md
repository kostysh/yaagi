---
version: 1
stage: plan-slice
feature_id: F-0025
feature_cycle_id: fc-F-0025-mocvfju6
cycle_id: plan-slice-fcd03351
backlog_item_key: CF-027
primary_feature_id: F-0025
primary_backlog_item_key: CF-027
phase_scope: plan-slice for CF-027 mature phase-6 governance closure
stage_state: ready_for_close
start_ts: 2026-04-24T13:06:38.460Z
entered_ts: 2026-04-24T13:06:38.460Z
ready_for_close_ts: 2026-04-24T13:10:35.745Z
transition_events:
  - kind: entered
    at: 2026-04-24T13:06:38.460Z
  - kind: ready_for_close
    at: 2026-04-24T13:10:21.931Z
  - kind: ready_for_close
    at: 2026-04-24T13:10:35.745Z
backlog_followup_required: false
backlog_followup_kind: null
backlog_followup_resolved: true
backlog_lifecycle_target: planned
backlog_lifecycle_current: planned
backlog_lifecycle_reconciled: true
backlog_actualization_artifacts: []
backlog_actualization_verdict: current_state_satisfies_target
review_artifacts:
  - .dossier/reviews/F-0025/plan-slice-review-pass.json
verification_artifacts:
  - .dossier/verification/F-0025/plan-slice-verify.json
required_audit_classes:
  - spec-conformance-reviewer
executed_audit_classes:
  - spec-conformance-reviewer
required_external_review_pending: false
review_events:
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0025/plan-slice-review-pass.json
    audit_class: spec-conformance-reviewer
    event_commit: 581beb0cfcf611d7426f37902d6b98cbdcdc9e8f
    implementation_scope: null
    invalidated: false
    must_fix_count: 0
    recorded_at: 2026-04-24T13:13:56.687Z
    review_mode: external
    reviewer: external-plan-slice-review-agent
    reviewer_agent_id: null
    reviewer_skill: spec-conformance-reviewer
    reviewer_thread_id: 019dbf9e-4d12-7950-baf4-19c12da6e315
    security_trigger_reason: null
    stale: false
    verdict: PASS
reviewer_skills:
  - spec-conformance-reviewer
reviewer_agent_ids: []
review_trace_commits:
  - 581beb0cfcf611d7426f37902d6b98cbdcdc9e8f
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
final_delivery_commit: 4b57fce4d5b48202003f17a672ac3838a6192c8b
final_closure_commit: 581beb0cfcf611d7426f37902d6b98cbdcdc9e8f
step_artifact: .dossier/steps/F-0025/plan-slice.json
stage_entry_commit: null
implementation_review_scope: null
required_security_review: false
security_trigger_reasons: []
step_close_ts: 2026-04-24T13:14:21.437Z
process_complete_ts: 2026-04-24T13:14:21.437Z
intake_process_complete_ts: null
local_gates_green_ts: null
first_review_agent_started_ts: 2026-04-24T13:13:56.687Z
final_pass_ts: 2026-04-24T13:13:56.687Z
verification_trace_commit: 581beb0cfcf611d7426f37902d6b98cbdcdc9e8f
---

## Scope

- Этап `plan-slice` для `F-0025 / CF-027`.
- Цель планирования: подготовить implementation-ready handoff для mature phase-6 governance seam: policy profiles, activation decisions, consultant admission, perception-policy enforcement and bounded governance evidence.
- Код на этом этапе не менялся; менялись только dossier/backlog/process artifacts.
- Plan mode assessment: Plan mode не требуется, потому что `spec-compact` уже зафиксировал границу owner-ship, policy decisions and five slices; оставшаяся работа является feature-local implementation sequencing без нового repo-level ADR или альтернативной runtime/deployment стратегии.

## Inputs actually used

- `AGENTS.md`: repo overlay, Plan mode gate для `plan-slice`, canonical runtime requirement, operator-language logs.
- `README.md`: canonical stack and root quality commands.
- `docs/architecture/system.md`: phase-6 mature governance context, model-router selection/admission invariant, identity-bearing write authority matrix, canonical `stimulus_inbox` / `StimulusEnvelope`, operator/governor/perimeter/reporting boundaries.
- `docs/polyphony_concept.md`: phase-6 policy profiles, optional external consultants and governance framing.
- `docs/notes/backlog-legacy/feature-candidates.md`: `CF-027` source seam, dependencies and watchpoints.
- `docs/notes/backlog-legacy/working-system-roadmap-matrix-2026-03-26.md`: phase-6 roadmap positioning.
- `docs/adr/ADR-2026-03-23-plan-mode-decision-gate.md`: pre-step Plan mode decision rule.
- `docs/adr/ADR-2026-03-23-perception-intake-contract.md`: canonical perception intake constraints.
- `docs/ssot/features/F-0025-policy-profiles-consultant-admission-phase-6-governance-closure.md`: shaped spec, ACs, NFRs and compact slices.
- Adjacent delivered owner dossiers: `F-0005`, `F-0008`, `F-0016`, `F-0018`, `F-0023`, `F-0024`.
- Existing repo seams used for implementation planning: `packages/contracts/src`, `packages/db/src`, `infra/migrations`, `apps/core/src/runtime`, `apps/core/src/perception`, `apps/core/src/platform`, `apps/core/src/security`, and matching test directories.

## Decisions / reclassifications

### Spec gap decisions

- `F-0025` moves from compact design to an implementation plan with one new contract/store/runtime owner surface named `policy-governance`.
- First implementation must include a conservative baseline policy profile with external consultant execution disabled, so phase-6 governance can be active without widening autonomy.
- Operator-facing activation routes are not required by the plan-slice. If implementation adds them later, they must stay under the existing `F-0013` Hono operator namespace, protected by `F-0024`, and high-risk activation must compose with `F-0016`.
- Because policy decisions affect runtime execution and PostgreSQL persistence, implementation closure must include root quality gates and `pnpm smoke:cell`.

### Implementation freedom decisions

- Exact table/column names may vary, but the semantic surfaces from spec-compact must remain separate: profiles, activations, consultant admission decisions, perception-policy decisions and phase-6 governance events.
- The implementation may choose a module layout under `apps/core/src/runtime/policy-governance.ts` or split submodules if the owner boundary remains clear.
- The first consultant client may be a bounded interface plus test adapter; actual external endpoint configuration remains optional and cannot be boot-critical.
- Perception-policy enforcement may be wired before or after canonical intake persistence, but durable policy decisions must reference canonical `StimulusEnvelope` / `stimulus_inbox` evidence and must not create a second raw-event store.

### Temporary assumptions

- Existing `F-0024`, `F-0016`, `F-0018`, `F-0023`, `F-0008` and `F-0005` seams expose enough evidence/read APIs for tests or bounded adapters without requiring owner realignment.
- Existing migration numbering can advance to `021_policy_governance.sql`.
- If a neighbouring evidence source is unavailable in implementation, the affected policy/admission path returns structured refusal rather than fabricating proxy evidence.

## Operator feedback

- User explicitly instructed to proceed with `plan-slice`.
- Earlier user constraint remains active: backlog must stay free of `attention`; `CF-027` is being used to close this branch cleanly.

## Review events

none

## Backlog follow-up

- Required: yes.
- Kind: backlog-lifecycle-actualization.
- Reason: `CF-027` delivery state must move from `specified` to `planned` after implementation-ready slicing is materialized.
- Expected patch: `.dossier/backlog/patches/2026-04-24-048-f0025-plan-slice-actualization.patch.json`.
- Applied patch: `.dossier/backlog/patches/6f2ed5560c68--2026-04-24-048-f0025-plan-slice-actualization.patch.json`.
- Result: `CF-027` delivery state is `planned`.

## Process misses

none

## Transition events

- 2026-04-24T13:06:38.460Z: entered
- 2026-04-24T13:10:21.931Z: ready_for_close
- 2026-04-24T13:10:35.745Z: ready_for_close

## Close-out

- Pending until baseline commit, verification, external `spec-conformance-reviewer` audit and `dossier-step-close` complete.
