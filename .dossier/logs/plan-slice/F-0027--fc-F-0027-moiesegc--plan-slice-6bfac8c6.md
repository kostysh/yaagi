---
version: 1
stage: plan-slice
feature_id: F-0027
feature_cycle_id: fc-F-0027-moiesegc
cycle_id: plan-slice-6bfac8c6
backlog_item_key: CF-019
primary_feature_id: F-0027
primary_backlog_item_key: CF-019
phase_scope: plan-slice для CF-019 specialist organ rollout and retirement policy
stage_state: ready_for_close
start_ts: 2026-04-28T10:29:15.913Z
entered_ts: 2026-04-28T10:29:15.913Z
ready_for_close_ts: 2026-04-28T10:35:13.351Z
transition_events:
  - kind: entered
    at: 2026-04-28T10:29:15.913Z
  - kind: ready_for_close
    at: 2026-04-28T10:35:13.351Z
backlog_followup_required: false
backlog_followup_kind: null
backlog_followup_resolved: true
backlog_lifecycle_target: planned
backlog_lifecycle_current: planned
backlog_lifecycle_reconciled: true
backlog_actualization_artifacts:
  - .dossier/backlog/patches/e4edf260a68f--f0027-plan-slice-actualization.patch.json
backlog_actualization_verdict: actualized_by_backlog_artifact
review_artifacts:
  - .dossier/reviews/F-0027/plan-slice--spec-conformance-reviewer--r01--pass--666019cc25b1.json
verification_artifacts:
  - .dossier/verification/F-0027/plan-slice-6f5faf4769dd.json
  - .dossier/verification/F-0027/plan-slice-666019cc25b1.json
required_audit_classes:
  - spec-conformance-reviewer
executed_audit_classes:
  - spec-conformance-reviewer
required_external_review_pending: false
review_events:
  - allowed_by_policy: true
    artifact_path: .dossier/reviews/F-0027/plan-slice--spec-conformance-reviewer--r01--pass--666019cc25b1.json
    audit_class: spec-conformance-reviewer
    event_commit: 666019cc25b1c82f6b7f212deaab704d2e282c70
    implementation_scope: null
    invalidated: false
    latest_copy_path: .dossier/reviews/F-0027/plan-slice--spec-conformance-reviewer--latest.json
    must_fix_count: 0
    recorded_at: 2026-04-28T10:40:16.250Z
    review_mode: external
    review_attempt_id: plan-slice--spec-conformance-reviewer--r01
    review_round_id: r01
    review_round_number: 1
    reviewer: external-plan-slice-review-agent
    reviewer_agent_id: 019dd3a9-d044-76d1-9950-185dc346210b
    reviewer_skill: spec-conformance-reviewer
    reviewer_thread_id: 019dd3a9-d044-76d1-9950-185dc346210b
    security_trigger_reason: null
    stale: false
    verdict: PASS
reviewer_skills:
  - spec-conformance-reviewer
reviewer_agent_ids:
  - 019dd3a9-d044-76d1-9950-185dc346210b
review_trace_commits:
  - 666019cc25b1c82f6b7f212deaab704d2e282c70
degraded_review_present: false
invalidated_review_present: false
stale_review_present: false
skills_used:
  - unified-dossier-engineer
skill_issues: []
skill_followups: []
process_misses: []
session_id: 6b5d6205-96df-4f26-9b26-17be5702bd65
trace_runtime: codex
trace_locator_kind: session_id
final_delivery_commit: 6f5faf4769dd328b2f11c6952fa1d7669cf4f099
final_closure_commit: 666019cc25b1c82f6b7f212deaab704d2e282c70
step_artifact: .dossier/steps/F-0027/plan-slice.json
stage_entry_commit: null
implementation_review_scope: null
required_security_review: false
security_trigger_reasons: []
step_close_ts: 2026-04-28T10:40:46.593Z
process_complete_ts: 2026-04-28T10:40:46.593Z
intake_process_complete_ts: null
local_gates_green_ts: null
first_review_agent_started_ts: 2026-04-28T10:40:16.250Z
final_pass_ts: 2026-04-28T10:40:16.250Z
verification_trace_commit: 666019cc25b1c82f6b7f212deaab704d2e282c70
---

## Scope

- Сформирован `plan-slice` для `F-0027` / `CF-019`.
- План ограничен доставкой одного `specialist-policy` owner surface в существующем `apps/core` runtime и PostgreSQL state kernel.
- Source/test/runtime код в этой стадии не менялся.

## Inputs actually used

- Repo overlay: `AGENTS.md`.
- Plan mode assessment: Plan mode не потребовался, потому что `spec-compact` уже зафиксировал owner boundary, зависимости и non-goals; оставшаяся работа является sequencing одного принятого `specialist-policy` surface без открытого operator choice, repo-level ADR trigger или конкурирующей deployment/serving topology.
- Backlog card: `dossier-engineer items --item-keys CF-019`.
- Architecture/runtime context: `README.md`, `docs/architecture/system.md`, `docs/polyphony_concept.md`.
- Legacy backlog sources: `docs/notes/backlog-legacy/feature-candidates.md`, `docs/notes/backlog-legacy/working-system-roadmap-matrix-2026-03-26.md`.
- Existing implementation surfaces inspected for concrete paths: `packages/contracts/src/models.ts`, `packages/contracts/src/workshop.ts`, `packages/contracts/src/governor.ts`, `packages/contracts/src/release-automation.ts`, `packages/db/src/model-routing.ts`, `packages/db/src/model-ecology.ts`, `packages/db/src/workshop.ts`, `apps/core/src/runtime/model-router.ts`, `apps/core/src/runtime/model-ecology.ts`, `apps/core/src/workshop/service.ts`.
- Repo ADRs: `ADR-2026-03-23-plan-mode-decision-gate`, `ADR-2026-03-25-ai-sdk-runtime-substrate`, `ADR-2026-03-19-phase0-deployment-cell`.

## Decisions / reclassifications

### Spec gap decisions

- `F-0027` first implementation target is one `specialist-policy` seam across contracts, DB store and core runtime service.
- Contracts/store land before runtime admission wiring.
- Policy service owns admission/refusal/retirement decisions after router selection; router selection remains separate from admission.
- Operator-facing routes are optional for the first implementation. If added, they must stay inside the existing protected Operator API and delegate to the same policy service.
- Repo-level ADR is not required before implementation. It becomes required only if implementation changes shared router invariants outside the feature-local admission gate, introduces a new serving/deployment stack or changes cross-feature write ownership.

### Implementation freedom decisions

- Exact table names and module exports may change from the planned paths only if the semantic owner boundary, coverage map and single policy-service call path remain intact.
- Implementation may choose the internal shape of evidence adapters, but they must be read-only with respect to `F-0014`, `F-0015`, `F-0016`, `F-0020` and `F-0026` owner surfaces.
- Operator routes are not part of the minimum implementation target.
- `active` and `stable` rollout semantics may be represented as policy state in the first implementation, but live admission still fails closed without current evidence, health and rollback target.

### Temporary assumptions

- Existing `F-0014`, `F-0015`, `F-0016`, `F-0020` and `F-0026` surfaces are delivered enough to consume as read-only evidence during implementation.
- First implementation should avoid broad live specialist activation; `shadow` and tightly bounded `limited-active` are the safest first runtime paths.
- `pnpm smoke:cell` is applicable before implementation closure if runtime admission or deployment-affecting behavior changes.

## Operator feedback

- Operator asked to continue after `spec-compact` and execute `plan-slice`.

## Review events

- Independent `spec-conformance-reviewer` audit recorded PASS in `.dossier/reviews/F-0027/plan-slice--spec-conformance-reviewer--r01--pass--666019cc25b1.json`.

## Backlog follow-up

- `plan-slice` required backlog lifecycle actualization: `CF-019` moved from `specified` to `planned`.
- Applied canonical backlog patch `.dossier/backlog/patches/e4edf260a68f--f0027-plan-slice-actualization.patch.json`.
- Re-ran `plan-slice --ready-for-close --backlog-followup-resolved`; current stage state records `backlog_lifecycle_current: planned`, `backlog_lifecycle_reconciled: true`, and `backlog_followup_required: false`.

## Process misses

none

## Transition events

- 2026-04-28T10:29:15.913Z: entered
- 2026-04-28T10:35:13.351Z: ready_for_close

## Close-out

- `dossier-verify` passed with `.dossier/verification/F-0027/plan-slice-666019cc25b1.json`.
- Independent `spec-conformance-reviewer` audit PASS was recorded in `.dossier/reviews/F-0027/plan-slice--spec-conformance-reviewer--r01--pass--666019cc25b1.json`.
- `dossier-step-close` wrote `.dossier/steps/F-0027/plan-slice.json` with `process_complete=yes`.
- Next workflow stage is `implementation`.
