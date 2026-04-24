---
version: 1
command: feature-intake
stage: feature-intake
feature_id: F-0025
feature_cycle_id: fc-F-0025-mocvfju6
cycle_id: intake-ca5c5da9
backlog_item_key: CF-027
primary_feature_id: F-0025
primary_backlog_item_key: CF-027
phase_scope: feature-intake for CF-027 mature phase-6 governance branch
start_ts: 2026-04-24T12:12:53.934Z
entered_ts: 2026-04-24T12:12:53.934Z
ready_for_close_ts: 2026-04-24T12:12:53.934Z
stage_state: ready_for_close
backlog_followup_required: false
backlog_followup_kind: null
backlog_followup_resolved: true
review_artifacts:
  - .dossier/reviews/F-0025/feature-intake-review-fail.json
  - .dossier/reviews/F-0025/feature-intake-review-pass.json
verification_artifacts:
  - .dossier/verification/F-0025/feature-intake-verify.json
required_audit_classes:
  - spec-conformance-reviewer
executed_audit_classes:
  - spec-conformance-reviewer
required_external_review_pending: false
review_events:
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0025/feature-intake-review-fail.json
    audit_class: spec-conformance-reviewer
    event_commit: 2dd54dcef2a76b57151105a9fc56dd7b16d7175e
    implementation_scope: null
    invalidated: false
    must_fix_count: 2
    recorded_at: 2026-04-24T12:24:11.398Z
    review_mode: external
    reviewer: external-codex-exec
    reviewer_agent_id: 019dbf6b-7272-7602-b548-7961ca2a63dd
    reviewer_skill: spec-conformance-reviewer
    reviewer_thread_id: 019dbf3f-4287-7722-9adb-c3ec2482111e
    security_trigger_reason: null
    stale: false
    verdict: FAIL
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0025/feature-intake-review-pass.json
    audit_class: spec-conformance-reviewer
    event_commit: 74cd8ce64d3d93f4b3a00efc934611a2b355cdf8
    implementation_scope: null
    invalidated: false
    must_fix_count: 0
    recorded_at: 2026-04-24T12:35:57.282Z
    review_mode: external
    reviewer: codex-gpt5-independent-reviewer
    reviewer_agent_id: codex-gpt5-2026-04-24-f0025-review
    reviewer_skill: spec-conformance-reviewer
    reviewer_thread_id: 019dbf7b-cc94-7a72-8e5d-315fe467bd73
    security_trigger_reason: null
    stale: false
    verdict: PASS
reviewer_skills:
  - spec-conformance-reviewer
reviewer_agent_ids:
  - codex-gpt5-2026-04-24-f0025-review
review_trace_commits:
  - 74cd8ce64d3d93f4b3a00efc934611a2b355cdf8
degraded_review_present: false
invalidated_review_present: false
stale_review_present: false
skills_used:
  - unified-dossier-engineer
skill_issues: []
skill_followups: []
process_misses: []
transition_events:
  - kind: entered
    at: 2026-04-24T12:12:53.934Z
  - kind: ready_for_close
    at: 2026-04-24T12:12:53.934Z
session_id: 019dbf3f-4287-7722-9adb-c3ec2482111e
trace_runtime: codex
trace_locator_kind: session_id
final_delivery_commit: 2dd54dcef2a76b57151105a9fc56dd7b16d7175e
final_closure_commit: 74cd8ce64d3d93f4b3a00efc934611a2b355cdf8
step_artifact: .dossier/steps/F-0025/feature-intake-close.json
stage_entry_commit: null
implementation_review_scope: null
required_security_review: false
security_trigger_reasons: []
step_close_ts: 2026-04-24T12:36:28.494Z
process_complete_ts: 2026-04-24T12:36:28.494Z
intake_process_complete_ts: 2026-04-24T12:36:28.494Z
local_gates_green_ts: null
first_review_agent_started_ts: 2026-04-24T12:24:11.398Z
final_pass_ts: 2026-04-24T12:35:57.282Z
verification_trace_commit: 74cd8ce64d3d93f4b3a00efc934611a2b355cdf8
---

## Scope

- Opened one feature cycle for backlog item `CF-027`.
- Created dossier `docs/ssot/features/F-0025-policy-profiles-consultant-admission-phase-6-governance-closure.md` with `status: proposed`.
- Preserved the phase-6 governance branch as a separate owner seam for policy profiles, consultant admission, richer perception policies and mature governance closure.
- No backlog truth mutation was performed by `feature-intake`.

## Inputs actually used

- Backlog item key: `CF-027`.
- Backlog delivery state at intake: `defined`.
- Backlog sources: `docs/architecture/system.md`, `docs/polyphony_concept.md`, `docs/notes/backlog-legacy/feature-candidates.md`, `docs/notes/backlog-legacy/working-system-roadmap-matrix-2026-03-26.md`.
- Backlog dependencies: `CF-004`, `CF-006`, `CF-014`, `CF-015`, `CF-016`, `CF-024`.
- Delivered prerequisite dossiers recorded in frontmatter: `F-0005`, `F-0008`, `F-0016`, `F-0018`, `F-0023`, `F-0024`.
- Current operator session id supplied to the runtime: `019dbf3f-4287-7722-9adb-c3ec2482111e`.

## Backlog handoff decisions

- One backlog item maps to one feature dossier: `CF-027` -> `F-0025`.
- Area selected from the backlog source taxonomy: `governance`.
- Owners: `@codex`.
- Impacts: `governance`, `policy`, `runtime`, `perception`, `models`.
- Known blockers at intake: none recorded.
- Backlog follow-up at intake: not required.
- Scope boundary at intake: `F-0025` must complete mature policy orchestration without reowning minimal governor, perimeter hardening, baseline router internals, perception-buffer implementation, observability reports or operator auth/RBAC.

## Intake findings

- `CF-027` exists to prevent phase-6 governance surfaces from remaining spread across adjacent owners.
- `CF-027` shaping watchpoints require explicit separation from `CF-016` / `F-0016` and `CF-014` / `F-0018`.
- Consultant/perception shaping must preserve explicit admission and structured refusal semantics; silent consultant fallback, hidden remap and side-channel routing are out of scope.
- Missing AC and coverage-map warnings are acceptable while `F-0025` remains in proposed intake state; they must be resolved before leaving the proposed state.

## Operator feedback

- Operator asked to start `feature-intake` for `CF-027` after cleaning the worktree.
- Operator later authorized normal agent spawning for this session.
- Operator asked to proceed directly to `spec-compact` after canonical `feature-intake` completion.

## Index refresh

- `feature-intake` refreshed `docs/ssot/index.md`.
- Generated index now includes `F-0025` in the feature table and dependency graph.
- Generated red flags currently warn that `F-0025` has no acceptance criteria IDs and recommends coverage-map rows; both are expected while the dossier remains proposed.

## Backlog follow-up

- `backlog_followup_required: false`.
- `backlog_followup_kind: null`.
- `backlog_followup_resolved: true`.

## Process misses

none

Unstructured notes:

- No structured `process_misses` are recorded in `.dossier/stages/F-0025/feature-intake.json`.
- External review `019dbf6b-7272-7602-b548-7961ca2a63dd` returned `FAIL`; the remediation is tracked through `.dossier/reviews/F-0025/feature-intake-review-fail.json` and the close-out notes below.

## Transition events

- 2026-04-24T12:12:53.934Z: entered
- 2026-04-24T12:12:53.934Z: ready_for_close

## Close-out

- Recorded failed review artifact: `.dossier/reviews/F-0025/feature-intake-review-fail.json`.
- Remediation filled the intake boundary in the dossier and replaced placeholder narrative sections with factual stage inputs, handoff decisions and index-refresh evidence.
- A fresh external `spec-conformance-reviewer` PASS and verification artifact are required on a clean committed baseline before truthful feature-intake closure.

## Notes

- Feature cycle opened by feature-intake.
