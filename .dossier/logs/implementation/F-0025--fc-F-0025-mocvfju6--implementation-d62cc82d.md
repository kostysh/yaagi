---
version: 1
stage: implementation
feature_id: F-0025
feature_cycle_id: fc-F-0025-mocvfju6
cycle_id: implementation-d62cc82d
backlog_item_key: CF-027
primary_feature_id: F-0025
primary_backlog_item_key: CF-027
phase_scope: implementation for CF-027 phase-6 policy governance closure
stage_state: in_progress
start_ts: 2026-04-24T13:19:56.070Z
entered_ts: 2026-04-24T13:19:56.070Z
ready_for_close_ts: null
transition_events:
  - kind: entered
    at: 2026-04-24T13:19:56.070Z
  - kind: resumed
    at: 2026-04-24T13:52:48.578Z
backlog_followup_required: true
backlog_followup_kind: backlog-lifecycle-actualization
backlog_followup_resolved: true
backlog_lifecycle_target: implemented
backlog_lifecycle_current: implemented
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
  - implementation-discipline
  - typescript-engineer
  - typescript-test-engineer
  - node-engineer
skill_issues: []
skill_followups: []
process_misses: []
session_id: 019dbf3f-4287-7722-9adb-c3ec2482111e
trace_runtime: codex
trace_locator_kind: session_id
final_delivery_commit: null
final_closure_commit: null
implementation_review_scope: null
stage_entry_commit: 1380bf76d88bddc269901e65db0eaa64f0c8b1e8
required_security_review: false
security_trigger_reasons: []
step_artifact: null
---

## Scope

- Реализован полный `F-0025 / CF-027` seam для phase-6 policy governance в существующем `apps/core` runtime.
- Добавлены owned decision-fact contracts, PostgreSQL migration/store и tests для `policy_profiles`, `policy_profile_activations`, `consultant_admission_decisions`, `perception_policy_decisions`, `phase6_governance_events`.
- Добавлен runtime `PolicyGovernanceService`: conservative baseline profile, activation evidence gates, consultant admission-before-invocation, perception-policy classification over canonical intake, bounded governance event read model.
- Runtime/perception integration оставлен внутри существующего deployment cell: без нового gateway, boot-critical consultant service, model-serving dependency или operator route family.

## Inputs actually used

- `docs/ssot/features/F-0025-policy-profiles-consultant-admission-phase-6-governance-closure.md`
- `docs/architecture/system.md`
- `README.md`
- `AGENTS.md`
- Delivered owner surfaces: `F-0005`, `F-0008`, `F-0016`, `F-0018`, `F-0023`, `F-0024`.
- Explorer outputs:
  - DB/migration/store pattern review: `019dbfa5-c218-7e20-a092-ecc660a526d4`
  - runtime/router/perception seam review: `019dbfa5-c250-7643-8086-9738cfb5a978`

## Decisions / reclassifications

### Spec gap decisions

- No repo-level ADR was needed: implementation did not add cross-feature write authority, a public gateway, a second perception intake layer, a new boot-critical service, or a router contract mutation.

### Implementation freedom decisions

- Policy activation remains an append-only decision fact. Exclusive active-scope behavior is enforced by the `F-0025` store/service resolution path and covered by tests rather than by writing neighbouring owner tables.
- `policyDecision` is exposed on `/ingest` only when policy governance actually returns a decision; existing HTTP response contracts do not receive `policyDecision: null`.
- External consultant execution is represented only through an admission-first internal service path. No public consultant route or configured external endpoint was introduced.
- `REPORT_SOURCE_OWNER.PHASE6_POLICY_GOVERNANCE` was added so `F-0023` can cite `F-0025` evidence while remaining the report-materialization owner.

### Temporary assumptions

- First shipped policy posture is conservative: external consultant execution disabled by default; future enabling requires explicit policy profile activation and admission evidence.

## Operator feedback

- User requested immediate canonical implementation after `plan-slice` completion and explicitly allowed subagent use in this session.

## Review events

- External `spec-conformance-reviewer` review is still pending at this point and must be recorded before step closure.

## Backlog follow-up

- Resolved backlog lifecycle actualization: `CF-027` moved from `planned` to `implemented` via `.dossier/backlog/patches/2026-04-24-049-f0025-implementation-closeout.patch.json`; canonical replay artifact: `.dossier/backlog/patches/e2ca0a405108--2026-04-24-049-f0025-implementation-closeout.patch.json`.

## Process misses

none

## Transition events

- 2026-04-24T13:19:56.070Z: entered
- 2026-04-24T13:52:48.578Z: resumed

## Close-out

- Local gates completed before ready-for-close:
  - `pnpm format`: PASS
  - `pnpm typecheck`: PASS
  - `pnpm lint`: PASS
  - `pnpm test`: PASS, 404/404
  - `pnpm smoke:cell`: PASS, 21/21
- Initial full `pnpm test` in the sandbox failed on localhost `listen EPERM`; rerun outside sandbox passed. This was an execution-permission issue, not an implementation regression.
