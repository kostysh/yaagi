---
id: F-0029
title: Operator-only Telegram conversational egress and reply loop
status: proposed
coverage_gate: deferred
backlog_item_key: CF-029
owners: ["@codex"]
area: communication
depends_on: ["F-0005", "F-0010", "F-0018", "F-0023", "F-0024"]
impacts: ["communication", "telegram", "runtime", "actions", "observability", "security"]
created: 2026-04-29
updated: 2026-04-29
links:
  issue: ""
  pr: []
  docs:
    - "docs/polyphony_concept.md"
    - "docs/architecture/system.md"
    - "README.md"
    - "docs/ssot/features/F-0005-perception-buffer-and-sensor-adapters.md"
    - "docs/ssot/features/F-0010-executive-center-and-bounded-action-layer.md"
    - "docs/ssot/features/F-0018-security-and-isolation-profile.md"
    - "docs/ssot/features/F-0023-observability-and-diagnostic-reporting.md"
    - "docs/ssot/features/F-0024-authentication-authorization-operator-rbac.md"
    - "docs/ssot/features/F-0028-support-operability-contract-incident-discipline.md"
---

## 1. Context & Goal

- **Backlog handoff:**
  - Backlog item key: CF-029
  - Backlog delivery state at intake: defined
  - Source traceability:
    - docs/polyphony_concept.md
    - docs/architecture/system.md
    - README.md
    - docs/ssot/features/F-0005-perception-buffer-and-sensor-adapters.md
    - docs/ssot/features/F-0010-executive-center-and-bounded-action-layer.md
    - docs/ssot/features/F-0018-security-and-isolation-profile.md
    - docs/ssot/features/F-0023-observability-and-diagnostic-reporting.md
    - docs/ssot/features/F-0024-authentication-authorization-operator-rbac.md
    - docs/ssot/features/F-0028-support-operability-contract-incident-discipline.md
  - Known blockers at intake:
    - none recorded
  - Known dependencies at intake:
    - CF-004
    - CF-007
    - CF-014
    - CF-015
    - CF-024
- **User problem:** Telegram ingress is delivered, so Polyphony can hear an operator message through the configured bot, but there is no canonical egress/reply owner. As a result, the bot can receive operator input but cannot answer through the same channel as the organism, and any ad hoc `sendMessage` wiring would bypass executive/action discipline, evidence, retry and operator-only admission boundaries.
- **Goal:** Open one canonical feature owner for an operator-only Telegram conversational egress and reply loop. The feature must let the identity-bearing Polyphony runtime answer the configured operator's direct Telegram chat through the normal tick/cognition/executive path, using a bounded `telegram.sendMessage` action, durable idempotent send evidence and explicit failure/degradation handling.
- **Non-goals:** This feature does not make the Telegram bot public, does not support group chats, broadcasts, operator command/control verbs, rich media, inline keyboards, Markdown/HTML formatting, webhook ingress, a second chatbot persona, or direct Bot API calls from cognition/runtime code outside the executive action boundary. It does not reopen `F-0005` Telegram ingress ownership or implement runtime code during intake.
- **Current substrate / baseline:** `F-0005` owns Telegram long-poll ingress, config gating, allowed-chat filtering, update dedupe and fake Bot API smoke coverage. `F-0010` owns bounded executive actions and `action_log`. `F-0018` owns security/perimeter constraints. `F-0023` owns observability/reporting consumption. `F-0024` owns operator identity/RBAC. `F-0028` owns support/operability evidence. None of these owners currently provides a Telegram egress action, durable outbox or operator reply loop.

## 2. Scope

### In scope

- Operator-only direct Telegram reply capability for the configured operator identity/chat.
- A bounded `telegram.sendMessage` executive action contract that can be selected only by the normal tick/cognition/decision path.
- Durable idempotent outbound-send tracking so retry/restart cannot duplicate replies for the same accepted action.
- Plain text Telegram replies for the first version.
- Bounded storage of outgoing text and inbound correlation evidence with redaction/retention constraints.
- Fake Bot API verification for ingress-to-tick-to-egress behavior without live Telegram.
- Observability/support evidence for sent, retried, refused and failed Telegram egress attempts.

### Out of scope

- Public or semi-public bot behavior.
- Telegram group/supergroup/channel support.
- Operator command/control verbs over Telegram.
- Broadcasts, multi-recipient messaging, subscriptions or notification fan-out.
- Rich media, attachments, inline keyboards, Markdown/HTML formatting or bot UI flows.
- A separate "chatbot agent" that answers outside the identity-bearing runtime.
- Direct Bot API side effects from perception, cognition, runtime lifecycle or tests that bypass the executive/tool boundary.

### Constraints

- V1 access is limited to the operator's configured direct Telegram chat. Existing allowlist mechanics are a substrate, not a public access model; `spec-compact` must bind the chat identity to the operator-only boundary.
- Replies must be produced by the organism's normal reactive path: Telegram ingress creates a stimulus, the tick/cognition layer decides whether to answer, and only then the executive layer may execute `telegram.sendMessage`.
- The bot token remains a secret and must never be stored in action/outbox evidence, logs, support notes or test snapshots.
- Egress failure must not crash the core runtime. It must become bounded retry evidence and then a degraded/failed outcome.
- If implementation changes runtime/startup/deployment behavior, public operator surfaces or side-effect paths, closure must include the root quality gates and the containerized smoke path.
- Before `spec-compact` or `plan-slice`, the repo-required Codex Plan mode assessment still applies.

### Assumptions (optional)

- The operator has already configured a Telegram bot token and can configure the operator direct chat id locally.
- The first implementation can reuse the existing Bot API base URL override and fake Telegram API service, but it must extend fake API support for `sendMessage`.
- Reply language should normally follow the incoming operator message language unless future policy says otherwise.

### Open questions (optional)

- Exact config shape for binding Telegram direct chat identity to the operator principal.
- Whether the existing `YAAGI_TELEGRAM_ALLOWED_CHAT_IDS` remains the egress admission field or is narrowed/renamed during `spec-compact`.
- Outbox retention period and exact text redaction/truncation thresholds.
- Final `telegram.sendMessage` action schema and result/error vocabulary.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0029-01:** `F-0029` is the only canonical owner for Telegram conversational egress and reply-loop behavior; `F-0005` remains the owner of Telegram ingress.
- **AC-F0029-02:** Telegram replies are operator-only: messages may be sent only to the configured operator's direct Telegram chat, and non-operator chats, groups, channels or unbound chat identities are refused or ignored before any Bot API side effect.
- **AC-F0029-03:** The organism, not a separate bot persona, chooses replies through the normal tick/cognition/decision path; runtime/perception code must not template or auto-send replies outside that path.
- **AC-F0029-04:** Telegram send side effects are available only through a bounded executive action, initially shaped as `telegram.sendMessage`, and must leave action/audit evidence.
- **AC-F0029-05:** Outbound Telegram sends are durable and idempotent across retry/restart, so the same accepted action cannot produce duplicate operator-visible replies.
- **AC-F0029-06:** V1 egress is plain text only and must not include media, files, buttons, rich formatting or command/control semantics.
- **AC-F0029-07:** Bot tokens and reusable operator secrets are never persisted in outbox rows, action logs, support evidence, reports, application logs or test snapshots.
- **AC-F0029-08:** Telegram API failures, timeouts and rate-limit-like responses produce bounded retry/degraded/failed evidence and do not crash the core runtime.
- **AC-F0029-09:** Observability/support consumers can inspect sent/refused/failed Telegram egress evidence without gaining write authority over action, perception, auth or support owner surfaces.
- **AC-F0029-10:** Container smoke or an equivalent deployment-cell path proves fake-Bot-API-backed ingress-to-tick-to-egress behavior before implementation closure.

## 4. Non-functional requirements (NFR)

- **Access control:** public Telegram availability budget is `0`; accepted egress recipients must be limited to the configured operator direct chat.
- **Duplicate prevention:** duplicate visible replies for one accepted action across retry/restart budget is `0`.
- **Secret hygiene:** persisted Telegram bot token observations budget is `0`.
- **Runtime resilience:** Telegram egress failure must degrade the egress attempt, not the whole core runtime.
- **Auditability:** every accepted, refused, retried and failed send attempt must have durable evidence sufficient for support diagnosis.

## 5. Design (compact)

### 5.1 API surface

- No new public HTTP API is required at intake.
- The future implementation should add an internal executive/tool action surface rather than a public Telegram route.
- Candidate action shape for `spec-compact`:

```ts
type TelegramSendMessageAction = {
  toolName: "telegram.sendMessage";
  parametersJson: {
    chatId: string;
    text: string;
    correlationId: string;
    replyToStimulusId?: string;
  };
};
```

### 5.2 Runtime / deployment surface

- Ingress remains long polling through `F-0005`.
- Egress should use the configured Telegram Bot API base URL so fake Bot API smoke can verify `sendMessage`.
- No second model service, bot worker, webhook endpoint or sidecar is introduced by intake.
- The implementation must decide whether the sender runs synchronously inside the tool gateway, through a durable outbox worker, or through an existing job mechanism; whichever path is chosen must preserve idempotency and action evidence.

### 5.3 Data model changes

- Candidate storage for `spec-compact`:
  - support for outbound Telegram message intents/results;
  - action/outbox correlation by action id, stimulus id and Telegram update id;
  - terminal status values for sent/refused/failed/degraded attempts;
  - bounded text payload storage with redaction/truncation policy.
- No foreign owner tables may be used as a shadow Telegram outbox.

### 5.4 Edge cases and failure modes

- Incoming Telegram update from a non-operator chat.
- Incoming Telegram update from a group/supergroup/channel.
- Runtime decides not to answer.
- Runtime selects an unsupported Telegram action or non-text payload.
- Bot API timeout, failure response, invalid token, blocked bot, or rate-limit-like response.
- Restart after action acceptance but before/after Bot API response.
- Duplicate Telegram ingress update replay.
- Support/reporting reads stale egress evidence.

### 5.5 Verification surface / initial verification plan

- Contract tests for `telegram.sendMessage` action schema and refusal vocabulary.
- Tool gateway tests proving non-operator/group recipients are denied before Bot API side effects.
- Store/outbox tests proving idempotency across retry/restart.
- Runtime integration test proving Telegram stimulus can lead to one bounded executive egress attempt.
- Fake Bot API tests proving successful `sendMessage`, failure handling and no token leakage.
- Deployment-cell smoke proving the full fake Telegram ingress-to-tick-to-egress path.

### 5.6 Representation upgrades (triggered only when needed)

- A change-proposal becomes required if shaping needs to change already delivered `F-0005`, `F-0010`, `F-0018`, `F-0023`, `F-0024` or `F-0028` ownership contracts instead of consuming them.
- A repo-level ADR becomes required if implementation introduces new deployment topology, webhook/public ingress, a new sidecar/worker family, or a cross-feature write authority change.

### 5.7 Definition of Done

- `CF-029` is registered and lifecycle-actualized through the dossier workflow.
- `spec-compact`, `plan-slice` and `implementation` complete with required external review artifacts before any done claim.
- The final implementation proves operator-only egress, idempotent send evidence, secret hygiene, bounded failure handling and fake-Bot-API smoke coverage.

### 5.8 Rollout / activation note (triggered only when needed)

- Activation must be explicit and fail closed when Telegram egress is enabled without a bot token or operator chat binding.
- Rollback must be able to disable egress without disabling already delivered Telegram ingress.

## 6. Slicing plan (2–6 increments)

- Candidate `SL-F0029-01`: contract/spec slice for operator-chat binding, `telegram.sendMessage` action schema, refusal vocabulary and evidence boundaries.
- Candidate `SL-F0029-02`: durable outbox/store and fake Bot API `sendMessage` support.
- Candidate `SL-F0029-03`: executive/tool gateway integration with operator-only recipient checks and idempotent send execution.
- Candidate `SL-F0029-04`: runtime wiring, observability/support evidence, docs/config updates and deployment-cell smoke closure.

## 7. Task list (implementation units)

- Deferred to `plan-slice`.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0029-01 | Future ownership/static boundary tests | deferred |
| AC-F0029-02 | Future recipient-admission and group-refusal tests | deferred |
| AC-F0029-03 | Future runtime decision-path integration tests | deferred |
| AC-F0029-04 | Future action/tool-gateway contract tests | deferred |
| AC-F0029-05 | Future outbox idempotency tests | deferred |
| AC-F0029-06 | Future schema/refusal tests for non-text payloads | deferred |
| AC-F0029-07 | Future secret-hygiene regression tests | deferred |
| AC-F0029-08 | Future failure/retry/degradation tests | deferred |
| AC-F0029-09 | Future observability/support consumer tests | deferred |
| AC-F0029-10 | Future fake-Bot-API deployment-cell smoke | deferred |

## 9. Decision log (ADR blocks)

### ADR-F0029-01: Telegram conversational egress is operator-only

- Context: The operator explicitly requires the Telegram bot to be available only to the operator, not to the public.
- Decision: V1 Telegram egress may send replies only to the configured operator's direct chat. Public chats, groups, channels and arbitrary allowlisted users remain out of scope.
- Consequences: `spec-compact` must bind Telegram chat identity to the operator-only boundary and must prove refusal before Bot API side effects for any non-operator recipient.

### ADR-F0029-02: Replies are organism actions, not bot templates

- Context: A direct bot reply shortcut would make Telegram a second behavioral subject or a runtime convenience path outside cognition/action discipline.
- Decision: Replies are selected by the normal tick/cognition/decision path and executed only through a bounded executive action.
- Consequences: Implementation must not send automatic template replies from perception, adapter or runtime lifecycle code.

### ADR-F0029-03: V1 uses plain text with durable idempotent egress evidence

- Context: Rich Telegram behavior would broaden the first delivery surface before the core reply loop is proven.
- Decision: V1 is plain text only and requires durable idempotent send tracking.
- Consequences: Media, buttons, formatting, commands and broadcasts require later explicit shaping.

## 10. Progress & links

- Backlog item key: CF-029
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Issue:
- PRs:

## 11. Change log

- 2026-04-29: Initial dossier created from backlog item `CF-029` at backlog delivery state `defined`.
- 2026-04-29 [intake clarification]: Recorded operator-only Telegram direct-chat boundary, normal organism decision path, bounded `telegram.sendMessage` action expectation, text-only V1, durable idempotent egress evidence and deferred implementation slices.
