---
version: 1
stage: spec-compact
feature_id: F-0024
feature_cycle_id: fc-F-0024-mobf0hcx
cycle_id: spec-compact-86525703
backlog_item_key: CF-024
stage_state: ready_for_close
start_ts: 2026-04-23T12:02:32.358Z
entered_ts: 2026-04-23T12:02:32.358Z
ready_for_close_ts: 2026-04-23T12:07:25.237Z
transition_events:
  - kind: entered
    at: 2026-04-23T12:02:32.358Z
  - kind: ready_for_close
    at: 2026-04-23T12:06:58.790Z
  - kind: ready_for_close
    at: 2026-04-23T12:07:25.237Z
backlog_followup_required: false
backlog_followup_kind: null
backlog_followup_resolved: true
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
session_id: null
trace_runtime: codex
trace_locator_kind: session_id
---

## Scope

- Shaped `F-0024` from intake skeleton into an implementation-grade compact spec for backlog item `CF-024`.
- Scope is limited to caller admission, authN/authZ, route-level RBAC, rate limiting, trusted ingress evidence and auth audit evidence for the existing `F-0013` Hono operator route family.
- No source code, tests or backlog truth artifacts were intentionally changed in this pass.

## Inputs actually used

- Plan mode assessment: not required. Reason: one selected backlog item, stable owner boundary from `F-0013`/`F-0018`, no competing scope split and no new repo-level ADR expected.
- Backlog item card: `dossier-engineer items --item-keys CF-024`.
- Architecture sources: `README.md`, `docs/architecture/system.md`, `docs/polyphony_concept.md`.
- Backlog migration sources: `docs/notes/backlog-legacy/feature-candidates.md`, `docs/notes/backlog-legacy/working-system-roadmap-matrix-2026-03-26.md`.
- Repo ADRs: `ADR-2026-03-25-ai-sdk-runtime-substrate`, `ADR-2026-03-23-plan-mode-decision-gate`.
- Adjacent dossiers: `F-0013` operator HTTP API, `F-0018` security/perimeter hardening.

## Decisions / reclassifications

### Spec gap decisions

- `F-0024` is the caller-admission/auth/RBAC owner; it wraps the existing `F-0013` Hono boundary rather than creating a second gateway.
- Caller admission is not approval authority: downstream governor/perimeter/human-override decisions remain with `F-0016`, `F-0018` and later owner seams.
- High-risk operator routes require both successful caller admission and downstream owner availability; auth alone must not make them execute.
- Missing auth configuration, corrupt auth state or unavailable auth store fail closed for protected routes.

### Implementation freedom decisions

- `plan-slice` may choose static secret-file, PostgreSQL-backed or hybrid principal/session storage if it preserves the same principal/session/permission/audit semantics.
- Concrete token format, revocation storage and admin bootstrap path are deferred to planning, not treated as spec ambiguity.

### Temporary assumptions

- First implementation may preserve local-only route binding while adding auth; it cannot claim external safety until route protection and smoke evidence are green.
- No backlog actualization is required because `CF-024` already owns this seam and dependencies remain `CF-020`, `CF-009`.

## Operator feedback

none

## Review events

none

## Backlog follow-up

- `backlog_followup_required: false`.
- `backlog_followup_kind: null`.
- `backlog_followup_resolved: true`.

## Process misses

none

## Transition events

- 2026-04-23T12:02:32.358Z: entered
- 2026-04-23T12:06:58.790Z: ready_for_close
- 2026-04-23T12:07:25.237Z: ready_for_close

## Close-out

none
