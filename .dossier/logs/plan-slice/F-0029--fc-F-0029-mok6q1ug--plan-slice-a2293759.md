---
version: 1
stage: plan-slice
feature_id: F-0029
feature_cycle_id: fc-F-0029-mok6q1ug
cycle_id: plan-slice-a2293759
backlog_item_key: CF-029
primary_feature_id: F-0029
primary_backlog_item_key: CF-029
phase_scope: plan-slice
stage_state: ready_for_close
start_ts: 2026-04-29T17:15:23.610Z
entered_ts: 2026-04-29T17:15:23.610Z
ready_for_close_ts: 2026-04-29T17:24:03.936Z
transition_events:
  - kind: entered
    at: 2026-04-29T17:15:23.610Z
  - kind: resumed
    at: 2026-04-29T17:19:10.698Z
  - kind: ready_for_close
    at: 2026-04-29T17:19:37.290Z
  - kind: ready_for_close
    at: 2026-04-29T17:24:03.936Z
backlog_followup_required: false
backlog_followup_kind: null
backlog_followup_resolved: false
backlog_lifecycle_target: planned
backlog_lifecycle_current: planned
backlog_lifecycle_reconciled: true
backlog_actualization_artifacts: []
backlog_actualization_verdict: current_state_satisfies_target
review_artifacts: []
verification_artifacts:
  - .dossier/verification/F-0029/plan-slice-de422330af09.json
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
session_id: 99a34b4b-962c-4511-b255-83a5915b567d
trace_runtime: codex
trace_locator_kind: session_id
final_delivery_commit: de422330af09dcb6e5d69c7edcc0d45444edd64c
final_closure_commit: null
policy_admission_risk_profile: applicable
policy_admission_risk_rationale: F-0029 contains operator-only admission,
  fail-closed egress enablement, refusal-before-send, idempotency/replay and
  evidence requirements that must be represented in the plan-slice negative
  matrix.
policy_admission_risk_families:
  - admission
  - replay
  - evidence
  - runtime-gating
policy_admission_negative_matrix:
  - ac: AC-F0029-26
    risk: runtime-gating
    negative_test: disabled egress action attempt
    production_path: telegram.sendMessage gateway admission
    evidence: Gateway tests prove pre-transport refusal
  - ac: AC-F0029-03
    risk: runtime-gating
    negative_test: YAAGI_TELEGRAM_EGRESS_ENABLED true without operator chat id
    production_path: loadCoreRuntimeConfig
    evidence: Config tests prove fail-closed startup config behavior
  - ac: AC-F0029-04
    risk: admission
    negative_test: operator chat id not in allowlist
    production_path: config validation
    evidence: Config tests prove fail-closed startup config behavior
  - ac: AC-F0029-07
    risk: admission
    negative_test: action correlated to non-operator Telegram stimulus
    production_path: stimulus lookup plus tool gateway recipient guard
    evidence: Tests prove pre-transport refusal with durable refusal evidence
  - ac: AC-F0029-08
    risk: admission
    negative_test: Telegram group supergroup channel context reaches action execution
    production_path: stimulus payload chatType plus tool gateway context guard
    evidence: Tests prove refusal before Bot API side effect
  - ac: AC-F0029-05
    risk: admission
    negative_test: caller supplies recipient chat id
    production_path: action schema plus tool gateway payload validation
    evidence: Contract tests prove arbitrary-recipient messages are impossible
  - ac: AC-F0029-27
    risk: admission
    negative_test: caller supplies over-bound text
    production_path: action schema plus tool gateway payload validation
    evidence: Contract tests prove bounded text before transport
  - ac: AC-F0029-13
    risk: replay
    negative_test: restart replays a sent action
    production_path: telegram_egress_messages unique action_id plus outbox retry selection
    evidence: Store integration tests prove no visible duplicate
  - ac: AC-F0029-18
    risk: evidence
    negative_test: egress decision lacks durable evidence
    production_path: action log plus egress outbox
    evidence: Evidence tests prove complete decision records
  - ac: AC-F0029-20
    risk: evidence
    negative_test: bot token appears in persisted logged evidence
    production_path: outbox evidence plus logging snapshots
    evidence: Evidence tests prove token-free rows log snapshots
  - ac: AC-F0029-09
    risk: runtime-gating
    negative_test: perception adapter sends a Telegram reply directly
    production_path: import static boundary tests
    evidence: Boundary tests prove executive gateway ownership
  - ac: AC-F0029-25
    risk: runtime-gating
    negative_test: Telegram smoke starts a second model runtime stack
    production_path: infra docker deployment-cell smoke plus compose overlay
    evidence: Smoke asserts shared model container identity plus one operator-only
      egress attempt
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
stage_entry_commit: null
implementation_review_scope: null
required_security_review: null
security_trigger_reasons: []
step_close_ts: null
process_complete_ts: null
intake_process_complete_ts: null
local_gates_green_ts: null
first_review_agent_started_ts: null
final_pass_ts: null
verification_trace_commit: de422330af09dcb6e5d69c7edcc0d45444edd64c
---

## Scope

- Выполнен `plan-slice` для `F-0029` без изменений runtime-кода.
- Dossier переведен в planned shape: определены implementation slices, task list, dependency visibility, AC coverage map и policy/admission negative matrix.
- План охватывает contract/config, durable outbox, fake Bot API, executive tool gateway, runtime reply loop, reporting/support refs, docs и deployment-cell smoke.
- Stage готов к закрытию после verification artifact и обязательного external `spec-conformance-reviewer` review.

## Inputs actually used

- `AGENTS.md`
- `README.md`
- `docs/architecture/system.md`
- `docs/adr/ADR-2026-03-19-canonical-runtime-toolchain.md`
- `docs/adr/ADR-2026-03-19-quality-gate-sequence.md`
- `docs/ssot/features/F-0029-operator-only-telegram-conversational-egress-reply-loop.md`
- `docs/ssot/features/F-0005-perception-buffer-and-sensor-adapters.md`
- `docs/ssot/features/F-0010-executive-center-and-bounded-action-layer.md`
- `docs/ssot/features/F-0018-security-and-isolation-profile.md`
- `docs/ssot/features/F-0023-observability-and-diagnostic-reporting.md`
- `docs/ssot/features/F-0024-authentication-authorization-operator-rbac.md`
- `docs/ssot/features/F-0028-support-operability-contract-incident-discipline.md`
- Runtime/source scan over Telegram ingress, core config, tool gateway, action contracts, action log, perception store, fake Telegram API and deployment-cell smoke files.

## Decisions / reclassifications

### Spec gap decisions

- Новых spec gaps не обнаружено.
- План не требует change-proposal или repo-level ADR при сохранении текущих ограничений: no public bot, no webhook ingress, no second worker topology, no cross-owner write authority.
- Если implementation потребует публичного бота, webhook ingress, отдельный egress worker/service или cross-owner writes, работа должна остановиться для change-proposal/ADR realignment.

### Implementation freedom decisions

- Delivery может быть синхронной внутри tool gateway или использовать существующий job mechanism только если сохраняются одинаковые outbox state machine, `action_id` idempotency и retry guarantees.
- Новый raw recipient chat id не допускается в action schema; implementation обязан разрешать получателя из `YAAGI_TELEGRAM_OPERATOR_CHAT_ID`.
- `telegram_egress_messages` является owner-local outbox; `action_log` остается `F-0010` source truth для executive action evidence.
- Reporting/support consumers могут получать только read-only refs на egress evidence.
- Финальная implementation closure должна включить root gates и `pnpm smoke:cell`, потому что feature меняет runtime/startup/deployment behavior and Telegram side-effect path.

### Temporary assumptions

- Первый implementation slice сможет добавить новый `infra/migrations/029_telegram_egress_messages.sql` без изменения уже доставленных owner tables.
- Fake Telegram API can be extended with deterministic `sendMessage` capture/failure endpoints without changing ingress behavior.
- Runtime reply-loop integration can reuse existing reactive tick/executive handoff; no second bot persona or separate model stack is needed.

## Operator feedback

- Оператор ранее уточнил, что Telegram bot должен быть доступен только оператору.
- План сохраняет это как hard boundary: only configured operator direct Telegram chat.

## Review events

none

## Backlog follow-up

- Lifecycle actualization выполнена: `CF-029` переведен из `specified` в `planned`.
- Patch artifact: `.dossier/backlog/patches/2026-04-29-066-f0029-plan-slice-actualization.patch.json`.
- Canonical replay artifact: `.dossier/backlog/patches/2c0bded8abf1--2026-04-29-066-f0029-plan-slice-actualization.patch.json`.
- Повторный `plan-slice --ready-for-close` подтвердил `backlog_lifecycle_current: planned` и `backlog_lifecycle_reconciled: true`.

## Process misses

none

## Transition events

- 2026-04-29T17:15:23.610Z: entered
- 2026-04-29T17:19:10.698Z: resumed
- 2026-04-29T17:19:37.290Z: ready_for_close
- 2026-04-29T17:24:03.936Z: ready_for_close

## Close-out

- `plan-slice` переведен в `ready_for_close`.
- Policy/admission matrix complete для `admission`, `replay`, `evidence` и `runtime-gating`.
- Требуется `dossier-verify`, independent external review и `dossier-step-close`.
