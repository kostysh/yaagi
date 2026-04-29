---
id: F-0029
title: Operator-only Telegram conversational egress and reply loop
status: planned
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

- V1 access is limited to the operator's configured direct Telegram chat. Existing allowlist mechanics are the ingress substrate, not a public access model.
- Replies must be produced by the organism's normal reactive path: Telegram ingress creates a stimulus, the tick/cognition layer decides whether to answer, and only then the executive layer may execute `telegram.sendMessage`.
- The bot token remains a secret and must never be stored in action/outbox evidence, logs, support notes or test snapshots.
- Egress failure must not crash the core runtime. It must become bounded retry evidence and then a degraded/failed outcome.
- If implementation changes runtime/startup/deployment behavior, public operator surfaces or side-effect paths, closure must include the root quality gates and the containerized smoke path.
- Before `plan-slice`, the repo-required Codex Plan mode assessment still applies.

### Assumptions

- The operator has already configured a Telegram bot token and can configure the operator direct chat id locally.
- The first implementation reuses the existing Telegram Bot API base URL override and extends the fake Telegram API service with `sendMessage`.
- Reply language normally follows the incoming operator message language unless future policy says otherwise.

### Open questions

- None after `spec-compact`.
- Resolved by `spec-compact`: `YAAGI_TELEGRAM_OPERATOR_CHAT_ID` is the single V1 recipient binding for egress and must be present when Telegram egress is enabled.
- Resolved by `spec-compact`: the existing `YAAGI_TELEGRAM_ALLOWED_CHAT_IDS` remains the ingress allowlist; `YAAGI_TELEGRAM_OPERATOR_CHAT_ID` must be included in that allowlist when both ingress and egress are enabled.
- Resolved by `spec-compact`: the model/tool action may request `telegram.sendMessage` with bounded text and correlation refs only; the recipient is resolved server-side from config, not supplied by cognition.

## 3. Requirements & Acceptance Criteria (SSoT)

### Terms & thresholds

- `operator Telegram chat`: the one Telegram private chat id configured by `YAAGI_TELEGRAM_OPERATOR_CHAT_ID`.
- `Telegram egress`: a Bot API `sendMessage` side effect issued by the core runtime to the operator Telegram chat.
- `reply loop`: the bounded path from a delivered Telegram stimulus through a reactive tick, structured decision, executive action and Telegram send result.
- `telegram.sendMessage`: the only V1 Telegram egress tool name admitted by `F-0029`.
- `Telegram egress outbox`: support table or equivalent owner surface that stores outbound message intent, delivery status, retry metadata and evidence refs.
- `visible duplicate`: more than one operator-visible Telegram message caused by the same accepted `action_id`.
- V1 text limit: `3500` Unicode scalar values before transport. Longer candidate text must be refused or truncated by an explicit bounded policy during implementation, not silently sent.
- V1 retry budget: at most `3` send attempts per accepted action before terminal `failed`.

### Policy decisions

- **PD-F0029-01:** `F-0029` owns Telegram egress and reply-loop behavior only. `F-0005` remains the Telegram ingress owner.
- **PD-F0029-02:** Telegram egress is operator-only in V1. The system must never send to arbitrary allowlisted users, groups, channels or public chats.
- **PD-F0029-03:** Cognition may request `telegram.sendMessage`, but may not provide a raw recipient chat id. The server resolves the recipient from `YAAGI_TELEGRAM_OPERATOR_CHAT_ID`.
- **PD-F0029-04:** Replies are organism actions. Perception adapters, runtime lifecycle hooks and tests must not send automatic template replies outside the executive path.
- **PD-F0029-05:** V1 supports plain text only. Rich formatting, media, files, buttons, commands and broadcasts require later explicit shaping.
- **PD-F0029-06:** A repo-level ADR is not required for this spec because the feature consumes existing runtime, action, security, auth and reporting owners without changing cross-repo architecture. A change-proposal or ADR becomes required if implementation needs webhook ingress, a public bot, a new worker topology or changed owner write authority.

### Acceptance criteria

- **AC-F0029-01:** `F-0029` is the only canonical owner for Telegram egress behavior.
- **AC-F0029-02:** `F-0005` remains the only canonical owner for Telegram ingress behavior.
- **AC-F0029-03:** Telegram egress enablement fails closed when `YAAGI_TELEGRAM_OPERATOR_CHAT_ID` is missing.
- **AC-F0029-04:** Telegram egress enablement fails closed when `YAAGI_TELEGRAM_OPERATOR_CHAT_ID` is not included in `YAAGI_TELEGRAM_ALLOWED_CHAT_IDS`.
- **AC-F0029-05:** The `telegram.sendMessage` action schema does not accept a caller-supplied recipient chat id.
- **AC-F0029-06:** The `telegram.sendMessage` action schema accepts plain text only.
- **AC-F0029-07:** Non-operator Telegram chats are refused before any Bot API send side effect.
- **AC-F0029-08:** Non-private Telegram chat contexts are refused before any Bot API send side effect.
- **AC-F0029-09:** Perception adapters do not send Telegram replies directly.
- **AC-F0029-10:** Runtime lifecycle code does not send Telegram replies directly.
- **AC-F0029-11:** Each accepted Telegram send action writes one durable outbox intent before attempting Bot API delivery.
- **AC-F0029-12:** Each accepted Telegram send action has one stable idempotency key based on `action_id`.
- **AC-F0029-13:** Restart after a successful send does not resend the same `action_id`.
- **AC-F0029-14:** Restart before a terminal send result resumes through the outbox without creating a second intent for the same `action_id`.
- **AC-F0029-15:** Telegram send attempts stop after the configured V1 retry budget.
- **AC-F0029-16:** Telegram send failure records terminal failed evidence after the retry budget is exhausted.
- **AC-F0029-17:** Telegram egress failures do not crash the core runtime.
- **AC-F0029-18:** Every Telegram egress decision leaves durable action/outbox evidence.
- **AC-F0029-19:** Telegram bot tokens are never persisted in outbox rows.
- **AC-F0029-20:** Telegram bot tokens are never emitted outside dedicated secret-loading boundaries.
- **AC-F0029-21:** Observability/reporting consumers read Telegram egress evidence read-only.
- **AC-F0029-22:** Support consumers may link Telegram egress refs without mutating source tables outside support ownership.
- **AC-F0029-23:** The fake Telegram API supports deterministic `sendMessage` success/failure scenarios for tests.
- **AC-F0029-24:** Container smoke proves one fake-Bot-API-backed Telegram ingress can lead to one operator-only Telegram egress attempt.
- **AC-F0029-25:** Container smoke proves the Telegram overlay reuses the existing deployment-cell runtime rather than introducing a second model stack.
- **AC-F0029-26:** Disabled Telegram egress refuses before any Bot API send side effect.
- **AC-F0029-27:** Text over the V1 bound never reaches Bot API transport unbounded.

## 4. Non-functional requirements (NFR)

- **Access control:** accepted egress recipient count outside `YAAGI_TELEGRAM_OPERATOR_CHAT_ID` budget is `0`.
- **Duplicate prevention:** visible duplicate count per accepted `action_id` budget is `0`.
- **Secret hygiene:** persisted or logged Telegram bot token observation budget is `0`.
- **Runtime resilience:** Telegram egress failure must terminate the send attempt as `retry_scheduled` or `failed`, never as a core process crash.
- **Auditability:** `100%` of accepted, refused, sent and terminal failed egress decisions have action/outbox evidence.
- **Transport bound:** V1 message text length is bounded to `3500` Unicode scalar values before Bot API transport.
- **Retry bound:** V1 send attempts per action are bounded to `3`.

## 5. Design (compact)

### 5.1 API surface

- No new public HTTP API is required at intake.
- The implementation adds an internal executive/tool action surface rather than a public Telegram route.
- `telegram.sendMessage` is a first-class tool name under the `F-0010` action boundary.
- Cognition supplies text and correlation refs only; the recipient is resolved by the tool gateway from config.
- Shaped action contract:

```ts
type TelegramSendMessageAction = {
  toolName: "telegram.sendMessage";
  parametersJson: {
    text: string;
    correlationId: string;
    replyToStimulusId: string;
    replyToTelegramUpdateId?: number;
  };
};

type TelegramSendMessageResult =
  | {
      status: "sent";
      actionId: string;
      egressMessageId: string;
      telegramMessageId: number;
      attemptCount: number;
    }
  | {
      status: "refused";
      actionId: string;
      reason:
        | "telegram_egress_disabled"
        | "operator_chat_not_configured"
        | "operator_chat_not_allowed"
        | "non_operator_recipient"
        | "group_or_channel_context"
        | "non_text_payload"
        | "text_too_long";
    }
  | {
      status: "failed";
      actionId: string;
      egressMessageId: string;
      reason:
        | "telegram_api_timeout"
        | "telegram_api_error"
        | "telegram_rate_limited"
        | "telegram_bot_blocked"
        | "telegram_invalid_token"
        | "retry_budget_exhausted";
      attemptCount: number;
    };
```

### 5.2 Runtime / deployment surface

- Ingress remains long polling through `F-0005`.
- Egress uses the same configured Telegram Bot API base URL so fake Bot API smoke can verify `sendMessage`.
- No second model service, bot worker, webhook endpoint or sidecar is introduced by this feature.
- Telegram egress runs inside the existing `core` runtime boundary.
- The tool gateway writes the durable outbox intent before any Bot API side effect.
- Delivery may run synchronously in the tool gateway or through an existing job mechanism, but both paths must preserve the same outbox state machine and idempotency guarantees.
- Config contract:
  - `YAAGI_TELEGRAM_EGRESS_ENABLED` defaults to `false`;
  - `YAAGI_TELEGRAM_OPERATOR_CHAT_ID` is required when `YAAGI_TELEGRAM_EGRESS_ENABLED=true`;
  - `YAAGI_TELEGRAM_OPERATOR_CHAT_ID` must be present in `YAAGI_TELEGRAM_ALLOWED_CHAT_IDS` when both ingress and egress are enabled;
  - `YAAGI_TELEGRAM_BOT_TOKEN` / `YAAGI_TELEGRAM_BOT_TOKEN_FILE` remain owned by the existing Telegram config contract;
  - `YAAGI_TELEGRAM_API_BASE_URL` remains the Bot API test/smoke override.
- Startup/config validation is fail-closed for egress only. Disabling egress must not disable the already delivered ingress path.

### 5.3 Data model changes

- `F-0029` owns the Telegram egress outbox surface.
- Candidate table: `telegram_egress_messages`.
- Minimal columns:
  - `egress_message_id text primary key`
  - `action_id text not null unique`
  - `tick_id text not null`
  - `reply_to_stimulus_id text not null`
  - `reply_to_telegram_update_id bigint`
  - `recipient_kind text not null check (recipient_kind = 'operator_direct_chat')`
  - `recipient_chat_id_hash text not null`
  - `text_json jsonb not null`
  - `idempotency_key text not null unique`
  - `status text not null check (status in ('pending', 'sending', 'sent', 'retry_scheduled', 'failed', 'refused'))`
  - `attempt_count integer not null default 0`
  - `next_attempt_at timestamptz`
  - `telegram_message_id bigint`
  - `last_error_code text`
  - `last_error_json jsonb not null default '{}'::jsonb`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
  - `sent_at timestamptz`
- `text_json` stores bounded text and text metadata only. It must not store bot tokens, bearer tokens or reusable secrets.
- `recipient_chat_id_hash` is evidence only. The sender resolves the current raw operator chat id from config when sending.
- Required indexes:
  - `(status, next_attempt_at, created_at)` for pending retry selection;
  - `(reply_to_stimulus_id, created_at desc)` for support/report lookup;
  - `(tick_id, created_at desc)` for tick/action correlation.
- No foreign owner tables may be used as a shadow Telegram outbox.
- `action_log` remains `F-0010`-owned. `F-0029` may write action result details only through the existing executive/action contract.

### 5.4 Edge cases and failure modes

- Incoming Telegram update from a non-operator chat: ingress may drop it under `F-0005`; egress must refuse any send attempt derived from it.
- Incoming Telegram update from a group/supergroup/channel: egress refuses before Bot API send.
- Runtime decides not to answer: `F-0010` records conscious inaction or no `telegram.sendMessage` action; no outbox row is created.
- Runtime selects an unsupported Telegram action: executive refusal is recorded; no outbox row is created unless the refusal evidence needs an owner-local record.
- Runtime selects non-text payload: refusal before Bot API send.
- Runtime selects text longer than the V1 bound: refusal or explicit bounded truncation policy must be implemented; silent unbounded send is forbidden.
- Bot API timeout: attempt count increments and retry is scheduled until budget exhaustion.
- Bot API invalid token: terminal failure is recorded without logging the token.
- Bot blocked by operator: terminal failure is recorded and support evidence can link it.
- Rate-limit-like response: retry scheduling is bounded by retry budget and response metadata.
- Restart after action acceptance before send: outbox resumes from `pending` or `retry_scheduled`.
- Restart after successful send before final action result propagation: outbox `sent` status prevents duplicate Bot API send.
- Duplicate Telegram ingress update replay: existing `F-0005` dedupe prevents duplicate stimuli, while outbox `action_id` uniqueness prevents duplicate egress for a replayed decision.
- Support/reporting reads stale egress evidence: consumers surface stale/degraded evidence rather than fabricating a healthy send state.

### 5.5 Verification surface / initial verification plan

- Contract tests for `telegram.sendMessage` action schema and refusal vocabulary.
- Tool gateway tests proving non-operator/group recipients are denied before Bot API side effects.
- Config tests proving fail-closed egress enablement without operator chat binding.
- Store/outbox tests proving idempotency across retry/restart.
- Runtime integration test proving Telegram stimulus can lead to one bounded executive egress attempt.
- Fake Bot API tests proving successful `sendMessage`, failure handling and no token leakage.
- Deployment-cell smoke proving the full fake Telegram ingress-to-tick-to-egress path.

### 5.6 Representation upgrades (triggered only when needed)

- A change-proposal becomes required if shaping needs to change already delivered `F-0005`, `F-0010`, `F-0018`, `F-0023`, `F-0024` or `F-0028` ownership contracts instead of consuming them.
- A repo-level ADR becomes required if implementation introduces new deployment topology, webhook/public ingress, a new sidecar/worker family, or a cross-feature write authority change.

### 5.7 Definition of Done

- `CF-029` is lifecycle-actualized through the dossier workflow.
- `spec-compact`, `plan-slice` and `implementation` complete with required verification and external review artifacts before any done claim.
- The final implementation proves operator-only egress, idempotent send evidence, secret hygiene, bounded failure handling and fake-Bot-API smoke coverage.
- `docs/ssot/index.md` and architecture coverage references remain aligned with the delivered state.

### 5.8 Rollout / activation note (triggered only when needed)

- Activation must be explicit and fail closed when Telegram egress is enabled without a bot token or operator chat binding.
- Rollback must be able to disable egress without disabling already delivered Telegram ingress.

## 6. Slicing plan (2–6 increments)

### Spec-compact decisions

- **SD-F0029-01:** `F-0029` owns Telegram egress and reply-loop behavior only. `F-0005` remains the Telegram ingress owner.
- **SD-F0029-02:** Telegram egress is operator-only in V1. Cognition never supplies a raw recipient chat id.
- **SD-F0029-03:** Replies are organism actions. Perception adapters and runtime lifecycle hooks must not send automatic Telegram replies.
- **SD-F0029-04:** V1 is plain text only and must enforce the `3500` Unicode scalar text bound before Bot API transport.
- **SD-F0029-05:** Durable owner outbox keyed by `action_id` is required before any Bot API side effect so retry/restart cannot create visible duplicates.
- **SD-F0029-06:** No repo-level ADR is required for the planned path. Change-proposal or ADR becomes required if implementation introduces webhook/public bot behavior, a second worker topology, a public route, or cross-feature write authority changes.

### Plan-slice decisions

- **PL-F0029-01:** Plan Mode was assessed before `plan-slice` and is not required. The spec already fixes the operator-only boundary, action schema, outbox requirement, retry budget and no-second-persona constraint; this step only orders implementation and verification.
- **PL-F0029-02:** The first implementation target is one complete operator-only Telegram reply seam: config, action contract, outbox, fake Bot API, executive gateway execution, runtime handoff, read-only support/report refs and deployment-cell smoke.
- **PL-F0029-03:** Implementation order is contract/config first, durable outbox second, gateway execution third, runtime/support/report wiring fourth, smoke/docs closure last.
- **PL-F0029-04:** `YAAGI_TELEGRAM_EGRESS_ENABLED` remains off by default. Enabling egress without `YAAGI_TELEGRAM_OPERATOR_CHAT_ID`, without the operator in `YAAGI_TELEGRAM_ALLOWED_CHAT_IDS`, or without the existing bot token must fail closed for egress.
- **PL-F0029-05:** The sender resolves the raw operator chat id at execution time from config. Outbox evidence stores only hashed recipient evidence and canonical refs.
- **PL-F0029-06:** Policy/admission risk is applicable. Declared families are `admission`, `replay`, `evidence` and `runtime-gating`; `release-policy` is excluded because this feature does not alter release/deploy/rollback decisions.

### Execution target

Implementation must deliver a complete operator-only Telegram conversational egress path:

- config-gated `telegram.sendMessage` action with server-side recipient resolution;
- explicit refusal vocabulary for disabled egress, missing/misaligned operator chat config, non-operator source, non-private chat context, non-text payload and over-bound text;
- durable `telegram_egress_messages` outbox with `action_id` uniqueness, retry state and token-free evidence;
- fake Telegram Bot API `sendMessage` success/failure support;
- executive/tool gateway execution that writes outbox intent before Bot API transport;
- runtime reply-loop integration from Telegram stimulus through reactive tick and executive action;
- read-only reporting/support evidence refs without foreign owner writes;
- deployment-cell smoke proving one fake Telegram ingress can lead to one operator-only egress attempt while reusing the existing runtime/model stack.

Completion is recognized only when acceptance criteria have focused tests, root quality gates pass, and `pnpm smoke:cell` covers the Telegram egress overlay. If implementation discovers a need for public bot behavior, webhook ingress, a separate egress worker service or cross-owner writes, work must stop for change-proposal/ADR realignment.

### Dependency visibility

- **Depends on `F-0005`:** Telegram ingress, allowed-chat filtering, stimulus payload shape, update dedupe and fake Bot API smoke overlay. Unblock condition: egress consumes `stimulus_inbox` / perception refs read-only and does not change ingress ownership.
- **Depends on `F-0010`:** executive center, tool gateway, action id reservation and `action_log`. Unblock condition: `telegram.sendMessage` is a bounded tool under the existing executive action boundary and records action results through the existing action contract.
- **Depends on `F-0018`:** perimeter and secret hygiene constraints. Unblock condition: no bot token persistence/logging and no direct side-effect path outside the bounded tool gateway.
- **Depends on `F-0023`:** diagnostic/report consumers. Unblock condition: reporting reads egress evidence read-only or surfaces unavailable/degraded evidence without mutating egress source truth.
- **Depends on `F-0024`:** operator identity/RBAC and protected operator surfaces. Unblock condition: Telegram direct chat binding remains a local operator-only recipient binding; public/group bot behavior remains denied.
- **Depends on `F-0028`:** support evidence and incident discipline. Unblock condition: support links egress refs without mutating action, perception, auth or egress source tables.

### Policy/admission negative matrix

| Row ID | Risk | AC basis | Negative case | Production path | Required evidence |
|---|---|---|---|---|---|
| NEG-F0029-01 | runtime-gating | AC-F0029-26 | disabled egress action attempt | `telegram.sendMessage` gateway admission | Gateway tests prove pre-transport refusal |
| NEG-F0029-02 | runtime-gating | AC-F0029-03 | `YAAGI_TELEGRAM_EGRESS_ENABLED=true` without operator chat id | `loadCoreRuntimeConfig` | Config tests prove fail-closed startup/config behavior |
| NEG-F0029-03 | admission | AC-F0029-04 | operator chat id not in allowlist | config validation | Config tests prove fail-closed startup/config behavior |
| NEG-F0029-04 | admission | AC-F0029-07 | action correlated to non-operator Telegram stimulus | stimulus lookup; tool gateway recipient guard | Tests prove pre-transport refusal with durable refusal evidence |
| NEG-F0029-05 | admission | AC-F0029-08 | Telegram group/supergroup/channel context reaches action execution | stimulus payload `chatType`; tool gateway context guard | Tests prove refusal before Bot API side effect |
| NEG-F0029-06 | admission | AC-F0029-05 | caller supplies recipient chat id | action schema; tool gateway payload validation | Contract tests prove arbitrary-recipient messages are impossible |
| NEG-F0029-07 | admission | AC-F0029-27 | caller supplies over-bound text | action schema; tool gateway payload validation | Contract tests prove unbounded text never reaches transport |
| NEG-F0029-08 | replay | AC-F0029-13 | restart replays a sent action | `telegram_egress_messages` unique `action_id`; outbox retry selection | Store/integration tests prove no visible duplicate |
| NEG-F0029-09 | evidence | AC-F0029-18 | egress decision lacks durable evidence | action log / egress outbox | Evidence tests prove complete decision records |
| NEG-F0029-10 | evidence | AC-F0029-20 | bot token appears in persisted/logged evidence | outbox evidence / logging snapshots | Evidence tests prove token-free rows/log snapshots |
| NEG-F0029-11 | runtime-gating | AC-F0029-09 | perception adapter sends a Telegram reply directly | import/static boundary tests | Boundary tests prove only the executive gateway owns Bot API `sendMessage` |
| NEG-F0029-12 | runtime-gating | AC-F0029-25 | Telegram smoke starts a second model/runtime stack | `infra/docker/deployment-cell.smoke.ts`; compose overlay | Smoke asserts shared model container identity plus one operator-only egress attempt |

### SL-F0029-01: Contracts, config and admission vocabulary

- **Result:** `telegram.sendMessage` action contract, typed refusal vocabulary, egress config fields and fail-closed validation.
- Depends on: `F-0005` allowed-chat config, `F-0010` action contract and `F-0018` secret config rules.
- **Primary files:** `packages/contracts/src/actions.ts`, optional `packages/contracts/src/telegram-egress.ts`, `apps/core/src/platform/core-config.ts`, `apps/core/testing/action-test-config.ts`, `.env.example`, `README.md`.
- **Coverage:** see the Section 8 coverage map.
- **Verification:** `packages/contracts/test/actions.contract.test.ts` or a new `telegram-egress.contract.test.ts`; `apps/core/test/platform/core-config.contract.test.ts`; `apps/core/test/actions/tool-gateway.contract.test.ts`.

### SL-F0029-02: Durable outbox and fake Bot API send support

- **Result:** owner outbox table/store, idempotency and retry state machine, token-free evidence, fake Bot API `sendMessage` success/failure scenarios.
- Depends on: `F-0010` `action_id` semantics, `F-0005` fake Telegram API harness and `F-0028` support ref conventions.
- **Primary files:** `infra/migrations/029_telegram_egress_messages.sql`, `packages/db/src/telegram-egress.ts`, `packages/db/src/index.ts`, `packages/db/test/telegram-egress-store.integration.test.ts`, `infra/docker/fake-telegram-api/server.py`.
- **Coverage:** see the Section 8 coverage map.
- **Verification:** outbox store integration tests for durable intent, `action_id` uniqueness, retry budget, sent terminal state and token-free rows; fake API tests for `sendMessage` success/failure.

### SL-F0029-03: Executive tool gateway egress execution

- **Result:** `telegram.sendMessage` gateway execution that resolves operator recipient server-side, checks stimulus context, writes outbox intent before transport, performs bounded Bot API send and records action verdicts.
- Depends on: `F-0010` tool gateway/action log, `F-0005` stimulus payload refs and `F-0018` bounded side-effect rules.
- **Primary files:** `apps/core/src/actions/tool-gateway.ts`, optional `apps/core/src/actions/telegram-egress.ts`, `packages/db/src/perception.ts` for read-only stimulus lookup, `apps/core/test/actions/telegram-egress-tool.contract.test.ts`, `apps/core/test/actions/telegram-egress-tool.integration.test.ts`.
- **Coverage:** see the Section 8 coverage map.
- **Verification:** gateway tests for disabled egress, missing/misaligned operator chat config, non-operator stimulus, non-private chat context, caller-supplied recipient denial, over-bound text denial, outbox-before-transport ordering, Bot API failure and no core crash.

### SL-F0029-04: Runtime reply loop, reporting and support refs

- **Result:** Telegram stimulus can lead to one bounded executive egress attempt through the normal reactive tick; report/support consumers can link/read egress refs without owning egress state.
- Depends on: `F-0005` reactive stimulus intake, `F-0010` executive handoff, `F-0023` reporting read conventions and `F-0028` support evidence refs.
- **Primary files:** `apps/core/src/runtime/index.ts`, `apps/core/test/runtime/reactive-action-handoff.integration.test.ts`, `apps/core/src/runtime/reporting.ts`, `packages/db/src/reporting.ts`, `apps/core/src/support/support-canonical-refs.ts`, `apps/core/test/runtime/telegram-reply-loop.integration.test.ts`, `apps/core/test/support/support-canonical-refs.integration.test.ts`.
- **Coverage:** see the Section 8 coverage map.
- **Verification:** runtime integration tests for Telegram stimulus -> decision -> executive action; reporting/support tests proving read-only egress refs and no foreign owner writes.

### SL-F0029-05: Deployment smoke, docs and closure gates

- **Result:** Telegram egress overlay is documented and smoke-proven in the canonical deployment cell with shared runtime/model stack.
- Depends on: `SL-F0029-01` through `SL-F0029-04`.
- **Primary files:** `infra/docker/compose.smoke-telegram.yaml`, `infra/docker/deployment-cell.smoke.ts`, `infra/docker/test/compose-config.test.ts`, `README.md`, `docs/architecture/system.md`, `docs/ssot/features/F-0029-operator-only-telegram-conversational-egress-reply-loop.md`.
- **Coverage:** see the Section 8 coverage map.
- **Verification:** root gates `pnpm format`, `pnpm typecheck`, `pnpm lint`; focused tests; `pnpm test`; `pnpm smoke:cell`; dossier verification and external review closure.

## 7. Task list (implementation units)

- **T-F0029-01** (`SL-F0029-01`): Add Telegram egress config fields, fail-closed validation and `.env.example` / README configuration notes.
- **T-F0029-02** (`SL-F0029-01`): Add `telegram.sendMessage` contract, parameters/result/refusal vocabulary and tests forbidding caller-supplied recipient chat ids and non-text payloads.
- **T-F0029-03** (`SL-F0029-02`): Add `telegram_egress_messages` migration, typed store, `action_id` idempotency and retry state transitions.
- **T-F0029-04** (`SL-F0029-02`): Extend fake Telegram API with deterministic `sendMessage` success/failure capture and reset endpoints.
- **T-F0029-05** (`SL-F0029-03`): Implement gateway-side operator recipient resolution, stimulus context lookup and admission guards for disabled/non-operator/non-private/invalid payload cases.
- **T-F0029-06** (`SL-F0029-03`): Implement outbox-before-send ordering, bounded Bot API delivery, failure mapping, retry scheduling and action verdict evidence.
- **T-F0029-07** (`SL-F0029-04`): Wire the runtime reply loop through the existing reactive tick and executive handoff without perception/lifecycle direct sends.
- **T-F0029-08** (`SL-F0029-04`): Add read-only reporting/support canonical refs for Telegram egress evidence.
- **T-F0029-09** (`SL-F0029-05`): Update smoke overlay, deployment-cell smoke assertions, docs, coverage map and closure evidence.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0029-01 | `apps/core/test/actions/telegram-egress-boundary.contract.test.ts` | planned |
| AC-F0029-02 | `apps/core/test/perception/telegram-adapter.integration.test.ts`; `apps/core/test/actions/telegram-egress-boundary.contract.test.ts` | planned |
| AC-F0029-03 | `apps/core/test/platform/core-config.contract.test.ts`; `apps/core/test/actions/telegram-egress-tool.contract.test.ts` | planned |
| AC-F0029-04 | `apps/core/test/platform/core-config.contract.test.ts` | planned |
| AC-F0029-05 | `packages/contracts/test/telegram-egress.contract.test.ts`; `apps/core/test/actions/telegram-egress-tool.contract.test.ts` | planned |
| AC-F0029-06 | `packages/contracts/test/telegram-egress.contract.test.ts` | planned |
| AC-F0029-07 | `apps/core/test/actions/telegram-egress-tool.integration.test.ts` | planned |
| AC-F0029-08 | `apps/core/test/actions/telegram-egress-tool.integration.test.ts` | planned |
| AC-F0029-09 | `apps/core/test/actions/telegram-egress-boundary.contract.test.ts`; `apps/core/test/perception/telegram-adapter.integration.test.ts` | planned |
| AC-F0029-10 | `apps/core/test/actions/telegram-egress-boundary.contract.test.ts`; `apps/core/test/runtime/telegram-reply-loop.integration.test.ts` | planned |
| AC-F0029-11 | `packages/db/test/telegram-egress-store.integration.test.ts`; `apps/core/test/actions/telegram-egress-tool.integration.test.ts` | planned |
| AC-F0029-12 | `packages/db/test/telegram-egress-store.integration.test.ts` | planned |
| AC-F0029-13 | `packages/db/test/telegram-egress-store.integration.test.ts` | planned |
| AC-F0029-14 | `packages/db/test/telegram-egress-store.integration.test.ts` | planned |
| AC-F0029-15 | `packages/db/test/telegram-egress-store.integration.test.ts`; `apps/core/test/actions/telegram-egress-tool.integration.test.ts` | planned |
| AC-F0029-16 | `packages/db/test/telegram-egress-store.integration.test.ts`; `apps/core/test/actions/telegram-egress-tool.integration.test.ts` | planned |
| AC-F0029-17 | `apps/core/test/actions/telegram-egress-tool.integration.test.ts`; `apps/core/test/runtime/telegram-reply-loop.integration.test.ts` | planned |
| AC-F0029-18 | `packages/db/test/telegram-egress-store.integration.test.ts` | planned |
| AC-F0029-19 | `packages/db/test/telegram-egress-store.integration.test.ts`; `apps/core/test/actions/telegram-egress-tool.contract.test.ts` | planned |
| AC-F0029-20 | `apps/core/test/actions/telegram-egress-tool.contract.test.ts` | planned |
| AC-F0029-21 | `apps/core/test/runtime/reporting-service.integration.test.ts`; `packages/db/test/reporting-store.integration.test.ts` | planned |
| AC-F0029-22 | `apps/core/test/support/support-canonical-refs.integration.test.ts`; `apps/core/test/support/support-usage-audit.contract.test.ts` | planned |
| AC-F0029-23 | `infra/docker/fake-telegram-api/server.py`; `infra/docker/test/compose-config.test.ts`; focused fake API smoke probe | planned |
| AC-F0029-24 | `infra/docker/deployment-cell.smoke.ts`; `pnpm smoke:cell` | planned |
| AC-F0029-25 | `infra/docker/deployment-cell.smoke.ts`; `pnpm smoke:cell` | planned |
| AC-F0029-26 | `apps/core/test/actions/telegram-egress-tool.contract.test.ts` | planned |
| AC-F0029-27 | `packages/contracts/test/telegram-egress.contract.test.ts`; `apps/core/test/actions/telegram-egress-tool.contract.test.ts` | planned |

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

### ADR-F0029-04: Recipient is resolved server-side from operator config

- Context: Letting cognition pass a raw `chatId` would make every generated action a potential recipient-selection decision.
- Decision: `telegram.sendMessage` accepts text and correlation refs only. The tool gateway resolves the recipient from `YAAGI_TELEGRAM_OPERATOR_CHAT_ID`.
- Consequences: Operator-only enforcement is deterministic and testable before Bot API side effects.

### ADR-F0029-05: Use an owner outbox instead of direct best-effort sends

- Context: Direct `sendMessage` calls cannot prove no visible duplicate across retry/restart.
- Decision: `F-0029` owns a durable Telegram egress outbox keyed by `action_id`.
- Consequences: Implementation must write durable intent before transport and must treat `sent` as a terminal duplicate-prevention state.

## 10. Progress & links

- Backlog item key: CF-029
- Status progression: `proposed -> shaped -> planned -> in_progress -> done`
- Issue:
- PRs:

## 11. Change log

- 2026-04-29: Initial dossier created from backlog item `CF-029` at backlog delivery state `defined`.
- 2026-04-29 [intake clarification]: Recorded operator-only Telegram direct-chat boundary, normal organism decision path, bounded `telegram.sendMessage` action expectation, text-only V1, durable idempotent egress evidence and deferred implementation slices.
- 2026-04-29 [spec-compact] [scope realignment]: Shaped `F-0029` as the operator-only Telegram egress owner with server-side recipient resolution, plain-text `telegram.sendMessage`, durable action-id-keyed outbox, bounded retry, fake Bot API verification, and no public bot or second reply persona.
- 2026-04-29 [plan-slice] [dependency realignment]: Planned contract/config, outbox/fake API, executive gateway, runtime/support/reporting and deployment-smoke slices with explicit dependency visibility, policy/admission negative matrix and implementation task coverage for the full acceptance set.
