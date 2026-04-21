---
id: F-0010
title: Исполнительный центр и ограниченный слой действий
status: done
coverage_gate: strict
owners: ["@codex"]
area: actions
depends_on: [F-0002, F-0003, F-0005, F-0008, F-0009]
impacts: [runtime, db, tools, jobs, workspace, network]
created: 2026-03-24
updated: 2026-03-25
links:
  issue: ""
  pr: []
  docs:
    - "docs/architecture/system.md"
    - "docs/ssot/features/F-0002-canonical-monorepo-deployment-cell.md"
    - "docs/ssot/features/F-0003-tick-runtime-scheduler-episodic-timeline.md"
    - "docs/ssot/features/F-0004-subject-state-kernel-and-memory-model.md"
    - "docs/ssot/features/F-0005-perception-buffer-and-sensor-adapters.md"
    - "docs/ssot/features/F-0008-baseline-model-router-and-organ-profiles.md"
    - "docs/ssot/features/F-0009-context-builder-and-structured-decision-harness.md"
    - "docs/adr/ADR-2026-03-19-canonical-runtime-toolchain.md"
    - "docs/adr/ADR-2026-03-19-phase0-runtime-boundary.md"
---

# F-0010 Исполнительный центр и ограниченный слой действий

## 1. Context & Goal

- **User problem:** После `F-0009` у системы уже есть validated `TickDecisionV1`, но всё ещё нет canonical owner-а для превращения этого декларативного решения в безопасное действие, постановку job, review request или осознанное бездействие. Без отдельного executive seam runtime/cognition начнут либо исполнять tools напрямую, либо quietly размажут ownership между decision harness, runtime convenience layers и будущим governor/tooling.
- **Goal (what success means):** В репозитории появляется явный owner для action interface: один bounded `Executive Center` принимает validated decision payload, пропускает его через `Tool Gateway`, фиксирует append-only audit в `action_log` и возвращает downstream runtime только bounded execution/result surface без захвата ownership над tick admission, subject-state writes, model routing или governor policy.
- **Current phase baseline:** На момент intake уже delivered `F-0001`-`F-0009`; end-to-end cognition остаётся reactive-first, `TickDecisionV1.action` уже machine-validated, а platform/runtime/deployment cell считаются обязательным substrate. Operator API, governor policy profiles, body evolution, narrative/memetic consequences и mature safety perimeter ещё не delivered и не могут silently прилипнуть к этому seam.
- **Non-goals:** Narrative/memetic reasoning, subject-state writes в обход canonical owners, operator-facing approval UI, workshop/model promotion, mature body evolution, richer governor policy, expanded observability/reporting и specialist-organ execution policy не входят в этот intake.

## 2. Scope

### In scope

- Канонический `Executive Center`, который принимает validated `TickDecisionV1.action` и решает: выполнить bounded tool invocation, поставить job, инициировать review request или подтвердить осознанное бездействие.
- Канонический `Tool Gateway`, который оборачивает allowlisted file/volume, Git, bounded HTTP, restricted shell и job wrappers в единый безопасный execution boundary.
- Append-only `action_log` с `boundary_check_json`, post-action result recording и явной связью с owning `tick_id`.
- Reactive-first runtime wiring между `F-0009` и executive seam внутри existing `core` monolith без нового public API.
- Явная write-authority discipline: state effects передаются только через canonical owners, а не direct SQL writes из executive/tool boundary.

### Out of scope

- Tick admission, lease discipline, episode commit и active-tick lifecycle; этим остаётся владеть `F-0003`.
- Model routing, profile continuity и organ selection; этим остаётся владеть `F-0008`.
- Context assembly и structured decision validation; этим уже владеет `F-0009`.
- Direct writes в `psm_json`, `goals`, `beliefs`, `entities`, `relationships`, а также durable narrative/memetic surfaces.
- Human-facing review UI, policy profiles, promotion/rollback governance и body/worktree evolution beyond bounded Git wrappers.

### Constraints

- Никаких действий вне action interface: runtime/cognition не получают прямой raw shell, raw Git, raw HTTP или volume access.
- `Tool Gateway` может работать только через allowlisted wrappers, approved paths/worktrees, bounded timeouts и policy-checked network/command profiles.
- `action_log` остаётся append-only audit surface; runtime-пользователь не получает `UPDATE`/`DELETE` права на него.
- Feature не расширяет public API surface и не меняет canonical deployment topology `core + postgres + local model service`.
- Reactive-first boundary сохраняется: первая delivered версия обязана интегрироваться с `reactive` path, но не должна silently расширять runtime admission matrix beyond already delivered `F-0003`.
- Executive/tool seam не становится backdoor writer в identity-bearing tables; любые stateful consequences должны идти через canonical owner contracts или review/governor path.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0010-01:** В runtime существует один canonical `ExecutiveCenter.handleDecisionAction(...)` boundary, который принимает already-validated `TickDecisionV1.action` вместе с active-tick metadata и детерминированно нормализует его в ровно один executive verdict: `none -> conscious_inaction`, `reflect -> review_request`, `tool_call -> tool_call`, `schedule_job -> schedule_job`; runtime lifecycle, context builder и decision harness не исполняют tools/jobs и не переопределяют этот mapping напрямую.
- **AC-F0010-02:** `Tool Gateway` оборачивает первую delivered allowlist execution profiles (`safe_data`, `git_body`, `network_http`, `restricted_shell`, `job_enqueue`) в allowlisted wrappers с явным `boundaryCheck`, approved execution profile, bounded timeout и path/network/worktree restrictions; raw shell/Git/HTTP/volume access не выдаётся decision/runtime layers напрямую, а world/state mutation tools не входят в first-wave allowlist и должны деградировать в refusal or review until explicit canonical owner adapters exist.
- **AC-F0010-03:** Каждая attempted or completed executive verdict append-only пишет ровно одну canonical `action_log` row с как минимум `action_id`, `tick_id`, `action_kind`, `tool_name`, `parameters_json`, `boundary_check_json`, `result_json`, `success` и `created_at`; `boundary_check_json` и `result_json` обязаны быть достаточными, чтобы различить accepted execution, explicit review request, conscious inaction и refused execution without resorting to process-local logs, а runtime/recovery paths не получают права update/delete этого audit trail.
- **AC-F0010-04:** Первая delivered версия executive seam остаётся reactive-first bounded seam: validated reactive decision from `F-0009` может привести не более чем к одному bounded executive verdict for the owning tick, without widening public API surface, bypassing `F-0003` tick lifecycle or silently enabling end-to-end deliberative/contemplative execution or a second parallel action loop.
- **AC-F0010-05:** Unsupported action type, unsupported tool name, boundary violation, execution-profile mismatch, timeout, queue/transport unavailability, network/path denial or high-risk action that requires review завершаются explicit structured executive refusal/result (`unsupported_action_type`, `unsupported_tool`, `boundary_denied`, `execution_timeout`, `execution_failed` или `review_required`) before unauthorized external side effects, while preserving canonical `action_log` evidence and without direct writes to subject-state, router continuity, boot state or other foreign surfaces.
- **AC-F0010-06:** State-affecting or body-affecting requests do not become backdoor writers: body mutations may proceed only through bounded Git/worktree wrappers inside the materialized writable runtime body from `F-0002`, may not mutate `/seed`, and any world/state/developmental consequence outside `action_log` must flow through canonical owner interfaces or explicit review/governor gates rather than direct SQL writes or unrestricted filesystem/shell access from the executive seam.

## 4. Non-functional requirements (NFR)

- **Safety:** allowlists, execution profiles, path/network restrictions and timeout discipline must be enforceable before any external side effect.
- **Auditability:** every attempted action must leave durable evidence sufficient for post-tick audit, recovery analysis and later reporting.
- **Determinism:** given the same validated decision and the same boundary policy, the executive verdict shape must be reproducible.
- **Recoverability:** partial or failed actions must not corrupt foreign canonical surfaces; result/audit evidence must remain available after restart/reclaim.
- **Scope discipline:** the seam must stay an action boundary, not a hidden replacement for runtime admission, subject-state ownership, governor policy or operator API.

## 5. Design (compact)

### 5.1 Runtime and deployment surface

- `F-0010` sits directly after validated decision handoff from `F-0009` and before episode/state/governor consequences.
- Ownership boundaries for the delivered phase:
  - `F-0003` remains owner of tick lifecycle, terminal commit and continuity cleanup.
  - `F-0004` remains owner of identity-bearing subject-state writes.
  - `F-0008` remains owner of profile/router continuity.
  - `F-0009` remains owner of context assembly and structured decision validation.
  - `F-0010` becomes owner only of action approval/execution boundary, action audit and bounded execution wrappers.
- First delivered runtime shape is internal only:
  - no new public HTTP route;
  - no sidecar/service outside the existing `core` monolith;
  - no direct exposure of raw tool implementations to decision/runtime seams.
- Compact internal contract for the shaped scope:

```ts
type DecisionActionInput = {
  tickId: string;
  decisionMode: "reactive" | "deliberative" | "contemplative";
  selectedModelProfileId: string;
  action: TickDecisionAction;
};

type ExecutiveVerdictKind =
  | "tool_call"
  | "schedule_job"
  | "review_request"
  | "conscious_inaction";

type BoundaryCheck = {
  allowed: boolean;
  reason: string;
  executionProfile?:
    | "safe_data"
    | "git_body"
    | "network_http"
    | "restricted_shell"
    | "job_enqueue";
  deniedBy?: string;
};

type ExecutiveVerdict =
  | {
      accepted: true;
      actionId: string;
      verdictKind: ExecutiveVerdictKind;
      boundaryCheck: BoundaryCheck;
      resultJson: Record<string, unknown>;
    }
  | {
      accepted: false;
      actionId: string;
      verdictKind: ExecutiveVerdictKind;
      boundaryCheck: BoundaryCheck;
      refusalReason:
        | "unsupported_action_type"
        | "unsupported_tool"
        | "boundary_denied"
        | "execution_timeout"
        | "execution_failed"
        | "review_required";
      detail: string;
    };

type ToolInvocationRequest = {
  tickId: string;
  toolName?: string;
  verdictKind: Extract<ExecutiveVerdictKind, "tool_call" | "schedule_job">;
  parametersJson: Record<string, unknown>;
};

interface ExecutiveCenter {
  handleDecisionAction(input: DecisionActionInput): Promise<ExecutiveVerdict>;
}

interface ToolGateway {
  execute(input: ToolInvocationRequest): Promise<ExecutiveVerdict>;
}
```

- `TickDecisionV1.action` stays declarative at the handoff boundary:
  - `none` is not a silent drop; it becomes explicit `conscious_inaction` with audit evidence;
  - `reflect` is not free-form runtime prose; it becomes explicit `review_request`;
  - `tool_call` and `schedule_job` require an explicit executive verdict before any execution happens;
  - unsupported/high-risk actions degrade to `review_request` or structured refusal, not silent fallback.

### 5.2 Delivery boundaries by action kind

- Reactive-first delivery is the canonical shaped plan for the first implementation:
  - end-to-end runtime wiring is required only for `reactive` ticks already admitted by `F-0003`;
  - `deliberative` / `contemplative` may reuse the same executive contract in fast tests or future slices, but may not silently become runtime-admissible through this dossier.
- First-wave verdict handling:
  - `conscious_inaction` must still append `action_log` evidence and return a bounded result payload;
  - `review_request` must remain an audited outcome inside `action_log` and `result_json`, without inventing a separate permanent review queue table in this feature;
  - `tool_call` may execute only through allowlisted `ToolGateway` wrappers;
  - `schedule_job` may enqueue only allowlisted job names on the already delivered PostgreSQL/`pg-boss` substrate and does not create a new worker topology or hidden queue family in this dossier.
- First-wave tool boundary is intentionally narrower than the architecture's eventual tool universe:
  - `safe_data`, `git_body`, `network_http`, `restricted_shell` and `job_enqueue` wrappers are in scope;
  - world/state mutation tools remain outside the first-wave allowlist until their canonical owner adapters are explicit;
  - body-affecting Git flows must stay inside the materialized writable runtime body/worktree contract from `F-0002`.

### 5.3 Data model changes

- `F-0010` becomes the canonical owner of materializing and writing `action_log` if it is not already delivered.
- Minimal shaped `action_log` slice:
  - `action_id text primary key`
  - `tick_id text not null references polyphony_runtime.ticks(tick_id) on delete cascade`
  - `action_kind text not null`
  - `tool_name text`
  - `parameters_json jsonb not null default '{}'::jsonb`
  - `boundary_check_json jsonb not null default '{}'::jsonb`
  - `result_json jsonb not null default '{}'::jsonb`
  - `success boolean not null`
  - `created_at timestamptz not null default now()`
- Required first-wave indexes:
  - `(tick_id, created_at desc)`
  - `(action_kind, created_at desc)`
- First delivered version does **not** require a separate permanent `review_requests`, `tool_invocations` or shadow execution-history table; if review-oriented outcomes are needed, they must leave canonical evidence through `action_log` and explicit result payloads instead of inventing a second audit surface.
- Outside `action_log`, this feature does not become a new durable state owner:
  - no direct writes to `psm_json`, `goals`, `beliefs`, `entities`, `relationships`;
  - no new durable body/governor/proposal table inside this dossier;
  - neighbouring seams may later attach richer consequences through their own canonical write paths.

### 5.4 UI changes (if any)

- Не применимо.

### 5.5 Edge cases

- Decision asks for a tool name that is not in the delivered allowlist.
- Decision action type is outside the delivered `none | tool_call | reflect | schedule_job` contract.
- Git/body wrapper is requested outside the materialized writable body or outside the approved worktree/path.
- Git/body request attempts to mutate tracked `/seed` content or an unmaterialized body path.
- HTTP request targets a non-allowlisted host or attempts an unsupported method/payload shape.
- Restricted shell wrapper passes boundary checks but exceeds timeout or returns a failing exit status.
- `schedule_job` is requested for a queue/job family that is not part of the delivered allowlist or while runtime/governor policy requires review instead of immediate enqueue.
- Reactive tick ends with explicit conscious inaction; this still requires audit evidence instead of disappearing as an implicit no-op.

### 5.6 Failure modes and refusal boundaries

- Boundary denial occurs before any external side effect and still appends durable audit evidence.
- Execution crash/failure after an allowed start must return bounded failure result without mutating foreign canonical surfaces directly.
- Runtime restart/reclaim may observe `action_log` evidence for the owning tick, but may not rewrite or delete it as part of recovery convenience logic.
- Queue/enqueue substrate failure must return structured executive failure instead of creating a hidden retry loop or second queueing path.
- High-risk body/system-changing intents must degrade to review-governed outcomes rather than being executed directly from the first delivered executive seam.

### 5.7 Verification surface

- Fast path:
  - contract tests for decision-action normalization into executive verdicts and boundary-check normalization;
  - contract/integration tests for allowlisted wrappers, denied wrappers, job-enqueue refusals and append-only `action_log` behavior;
  - runtime integration test for reactive decision handoff from `F-0009` into one bounded executive verdict;
  - regression tests proving no direct writes to foreign canonical owners and no `/seed` mutation from the executive/tool boundary.
- Containerized smoke path:
  - mandatory because runtime behavior changes inside the canonical deployment cell;
  - smoke should prove one bounded reactive executive outcome can be audited in `action_log` without opening new public API surface or second execution topology.
- Manual/operator surface:
  - implementation may rely on `GET /health`, logs and database inspection of `action_log`, but user-facing approval UI remains out of scope for this dossier.

## 6. Definition of Done

- `F-0010` is delivered with explicit ownership boundaries against `F-0003`, `F-0004`, `F-0008` and `F-0009`, and without hidden admission/state/governor ownership grab.
- Runtime now normalizes declarative `TickDecisionV1.action` through one canonical executive seam, persists `action_log` append-only audit evidence and writes `ticks.action_id` only through the runtime continuity boundary.
- First-wave allowlist execution profiles (`safe_data`, `git_body`, `network_http`, `restricted_shell`, `job_enqueue`) are bounded by explicit boundary checks, refusal taxonomy and write-authority regressions proving no backdoor writes into foreign canonical owners or `/seed`.
- Fast contract/integration suites and the required deployment-cell smoke path are green, and `docs/ssot/index.md` plus the architecture coverage map stay aligned on this feature’s delivered status.

## 7. Slicing plan (2–6 increments)

### Slice SL-F0010-01: Executive contract and append-only action audit substrate
Delivers: canonical executive contract module plus the minimal `action_log` schema/store boundary.
Covers: AC-F0010-01, AC-F0010-03
Verification: `contract`, `integration`
Exit criteria:
- `TickDecisionV1.action` is normalized only through the canonical executive contract, not ad hoc in runtime lifecycle code.
- Minimal `action_log` schema/store exists and writes one append-only row per executive verdict.
- Conscious inaction and review-oriented outcomes leave the same canonical audit trail instead of disappearing as implicit no-ops.
Tasks:
- **T-F0010-01:** Materialize the canonical executive contract types for decision-action normalization, executive verdicts and refusal reasons at the runtime boundary. Covers: AC-F0010-01, AC-F0010-05.
- **T-F0010-02:** Add or align the minimal `action_log` schema/store contract with append-only writes and the planned indexes. Covers: AC-F0010-03.
- **T-F0010-03:** Add AC-linked contract/integration tests proving one `action_log` row is written for accepted, refused, review and conscious-inaction verdicts. Covers: AC-F0010-01, AC-F0010-03.

### Slice SL-F0010-02: Bounded Tool Gateway and refusal semantics
Delivers: first-wave allowlisted `Tool Gateway` wrappers with explicit boundary checks and refusal taxonomy.
Covers: AC-F0010-02, AC-F0010-05, AC-F0010-06
Verification: `contract`, `integration`
Exit criteria:
- Only the first-wave execution profiles (`safe_data`, `git_body`, `network_http`, `restricted_shell`, `job_enqueue`) are reachable through the delivered gateway.
- Unsupported tool names, boundary violations, timeout/failure paths and out-of-scope world/state mutation requests return structured refusals before unauthorized side effects.
- Git/body requests stay inside the materialized writable runtime body and cannot mutate `/seed`.
Tasks:
- **T-F0010-04:** Implement the bounded `ToolGateway.execute(...)` surface with explicit execution-profile resolution and boundary-check normalization. Covers: AC-F0010-02, AC-F0010-05.
- **T-F0010-05:** Wire first-wave allowlisted wrappers for safe-data, Git/body, bounded HTTP, restricted shell and allowlisted job enqueue, while refusing out-of-scope world/state mutation tools. Covers: AC-F0010-02, AC-F0010-06.
- **T-F0010-06:** Add AC-linked contract/integration coverage for boundary-denied, unsupported-tool, timeout/failure and `/seed`-mutation refusal paths. Covers: AC-F0010-02, AC-F0010-05, AC-F0010-06.

### Slice SL-F0010-03: Reactive runtime handoff and continuity integration
Delivers: end-to-end reactive handoff from `F-0009` into one bounded executive verdict, with explicit continuity wiring and `F-0003` realignment before mutating delivered tick assumptions.
Covers: AC-F0010-01, AC-F0010-04
Verification: `integration`
Exit criteria:
- Reactive ticks hand validated `TickDecisionV1.action` into the executive seam and produce at most one bounded verdict for the owning tick.
- Runtime does not execute tools/jobs outside the executive seam and does not open a second action loop.
- Any mutation of `ticks.action_id` or adjacent active-tick continuity assumptions is preceded by an explicit dossier realignment for `F-0003`.
Tasks:
- **T-F0010-07:** Wire reactive runtime handoff so validated decision actions reach the canonical executive seam and return one bounded verdict/result payload for the active tick. Covers: AC-F0010-01, AC-F0010-04.
- **T-F0010-08:** Apply a `change-proposal` to `F-0003`, replacing the delivered assumption that `ticks.action_id` remains `null` before executive integration lands. Covers: SL-F0010-03.
- **T-F0010-09:** Add runtime integration tests proving reactive ticks stay single-outcome and executive-owned without widening deliberative/contemplative admission. Covers: AC-F0010-04.

### Slice SL-F0010-04: Deployment-cell verification and write-authority closure
Delivers: final verification proving the bounded reactive executive path in the canonical deployment cell and closing write-authority regressions against neighbouring seams.
Covers: AC-F0010-03, AC-F0010-04, AC-F0010-05, AC-F0010-06
Verification: `integration`, `smoke`
Exit criteria:
- Deployment-cell smoke proves one bounded reactive executive outcome can be audited in `action_log` without new public API surface or hidden execution topology.
- Regression coverage proves the executive/tool seam does not back-write subject-state, router continuity, boot state or tracked `/seed`.
- All AC-linked fast suites and the required smoke path exist so the dossier can close after implementation.
Tasks:
- **T-F0010-10:** Add deployment-cell smoke coverage for one bounded reactive executive outcome with `action_log` audit evidence and no new public API surface. Covers: AC-F0010-04.
- **T-F0010-11:** Add write-authority regression coverage proving the executive/tool seam cannot directly mutate foreign owner surfaces or tracked `/seed`. Covers: AC-F0010-05, AC-F0010-06.
- **T-F0010-12:** Close the remaining AC-linked fast verification surface for executive normalization, gateway refusals, append-only audit semantics and runtime handoff in the final implementation snapshot. Covers: AC-F0010-01, AC-F0010-02, AC-F0010-03, AC-F0010-04, AC-F0010-05, AC-F0010-06.

## 8. Suggested issue titles

- `F-0010 / SL-F0010-01 Executive contract and append-only action audit substrate` -> [SL-F0010-01](#slice-sl-f0010-01-executive-contract-and-append-only-action-audit-substrate)
- `F-0010 / SL-F0010-02 Bounded Tool Gateway and refusal semantics` -> [SL-F0010-02](#slice-sl-f0010-02-bounded-tool-gateway-and-refusal-semantics)
- `F-0010 / SL-F0010-03 Reactive runtime handoff and continuity integration` -> [SL-F0010-03](#slice-sl-f0010-03-reactive-runtime-handoff-and-continuity-integration)
- `F-0010 / SL-F0010-04 Deployment-cell verification and write-authority closure` -> [SL-F0010-04](#slice-sl-f0010-04-deployment-cell-verification-and-write-authority-closure)

## 9. Task list

- **T-F0010-01:** Materialize the canonical executive contract types for decision-action normalization, executive verdicts and refusal reasons at the runtime boundary. Covers: AC-F0010-01, AC-F0010-05.
- **T-F0010-02:** Add or align the minimal `action_log` schema/store contract with append-only writes and the planned indexes. Covers: AC-F0010-03.
- **T-F0010-03:** Add AC-linked contract/integration tests proving one `action_log` row is written for accepted, refused, review and conscious-inaction verdicts. Covers: AC-F0010-01, AC-F0010-03.
- **T-F0010-04:** Implement the bounded `ToolGateway.execute(...)` surface with explicit execution-profile resolution and boundary-check normalization. Covers: AC-F0010-02, AC-F0010-05.
- **T-F0010-05:** Wire first-wave allowlisted wrappers for safe-data, Git/body, bounded HTTP, restricted shell and allowlisted job enqueue, while refusing out-of-scope world/state mutation tools. Covers: AC-F0010-02, AC-F0010-06.
- **T-F0010-06:** Add AC-linked contract/integration coverage for boundary-denied, unsupported-tool, timeout/failure and `/seed`-mutation refusal paths. Covers: AC-F0010-02, AC-F0010-05, AC-F0010-06.
- **T-F0010-07:** Wire reactive runtime handoff so validated decision actions reach the canonical executive seam and return one bounded verdict/result payload for the active tick. Covers: AC-F0010-01, AC-F0010-04.
- **T-F0010-08:** Apply a `change-proposal` to `F-0003`, replacing the delivered assumption that `ticks.action_id` remains `null` before executive integration lands. Covers: SL-F0010-03.
- **T-F0010-09:** Add runtime integration tests proving reactive ticks stay single-outcome and executive-owned without widening deliberative/contemplative admission. Covers: AC-F0010-04.
- **T-F0010-10:** Add deployment-cell smoke coverage for one bounded reactive executive outcome with `action_log` audit evidence and no new public API surface. Covers: AC-F0010-04.
- **T-F0010-11:** Add write-authority regression coverage proving the executive/tool seam cannot directly mutate foreign owner surfaces or tracked `/seed`. Covers: AC-F0010-05, AC-F0010-06.
- **T-F0010-12:** Close the remaining AC-linked fast verification surface for executive normalization, gateway refusals, append-only audit semantics and runtime handoff in the final implementation snapshot. Covers: AC-F0010-01, AC-F0010-02, AC-F0010-03, AC-F0010-04, AC-F0010-05, AC-F0010-06.

## 10. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0010-01 | `apps/core/test/actions/executive-center.contract.test.ts` -> `test("AC-F0010-01 normalizes a validated TickDecisionV1 action through the canonical executive interface")`; `apps/core/test/runtime/reactive-action-handoff.integration.test.ts` -> `test("AC-F0010-04 keeps the executive seam reactive-first and single-outcome for the owning tick")` | done |
| AC-F0010-02 | `apps/core/test/actions/tool-gateway.contract.test.ts` -> `test("AC-F0010-02 enforces allowlisted execution profiles and boundary checks before any side effect")`; `apps/core/test/actions/tool-gateway.contract.test.ts` -> `test("AC-F0010-02 returns execution_timeout before a delayed git_body parent inspection can reach any write side effect")`; `apps/core/test/actions/tool-gateway.contract.test.ts` -> `test("AC-F0010-02 prevents a late schedule_job enqueue from surfacing after the bounded timeout window")`; `apps/core/test/actions/tool-gateway.integration.test.ts` -> `test("AC-F0010-02 refuses out-of-scope world/state mutation tools until canonical owner adapters exist")` | done |
| AC-F0010-03 | `packages/db/test/action-log.integration.test.ts` -> `test("AC-F0010-03 writes one append-only action_log row for each accepted, refused and review-oriented executive verdict")`; `apps/core/test/actions/executive-center.contract.test.ts` -> `test("AC-F0010-03 appends one action_log row for conscious inaction, review, accepted tools and structured refusals")` | done |
| AC-F0010-04 | `apps/core/test/runtime/reactive-action-handoff.integration.test.ts` -> `test("AC-F0010-04 keeps the executive seam reactive-first and single-outcome for the owning tick")`; `infra/docker/deployment-cell.smoke.ts` -> `test("AC-F0010-04 audits one bounded reactive executive outcome inside the deployment cell without new public API surface")` | done |
| AC-F0010-05 | `apps/core/test/actions/executive-refusal.integration.test.ts` -> `test("AC-F0010-05 returns structured refusal and action_log evidence before boundary-denied side effects")` | done |
| AC-F0010-06 | `apps/core/test/actions/executive-write-authority.contract.test.ts` -> `test("AC-F0010-06 routes body or state consequences through bounded canonical owners instead of direct foreign writes")`; `apps/core/test/actions/tool-gateway.contract.test.ts` -> `test("AC-F0010-02 enforces allowlisted execution profiles and boundary checks before any side effect")` | done |

План верификации:

- Fast path обязателен для action normalization, tool-gateway boundary checks, append-only audit semantics and write-authority discipline.
- Runtime integration обязателен для reactive decision handoff inside the existing tick lifecycle from `F-0003` and `F-0009`.
- Containerized smoke обязателен на implementation step, потому что feature меняет runtime behavior inside the canonical deployment cell.
- AC-linked fast and smoke coverage are now delivered; no informational gaps remain for this dossier in the final implementation snapshot.

## 11. Decision log (ADR blocks)

### ADR-F0010-01: The executive seam owns action approval and audit, but not foreign state writes
- Status: Accepted
- Context: Architecture requires an explicit executive/tool boundary, but neighbouring seams already own tick lifecycle, subject-state, model routing and future governor policy. Without an explicit fork decision, the first executive implementation could quietly become a backdoor writer into identity-bearing tables or bypass review/governor gates under the pretext of "just executing the action".
- Decision: `F-0010` owns only action approval/execution, boundary checks, append-only action audit and bounded execution wrappers. Any stateful consequence outside `action_log` must flow through canonical owner interfaces or explicit review/governor paths; the executive seam does not inherit generic write authority over subject-state, router continuity, boot state or developmental proposal surfaces.
- Alternatives: Let runtime/cognition execute tools directly; let executive write foreign state opportunistically; postpone all action execution until a later governor/operator UI seam exists.
- Consequences: The first delivered action layer can be useful in phase 0/1 without collapsing architectural ownership. Later features may enrich approval policy and consequence handling, but only through explicit follow-on work.

### ADR-F0010-02: First delivered executive behavior normalizes declarative decision actions into audited verdicts and keeps the first-wave allowlist narrow
- Status: Accepted
- Context: `F-0009` now returns a validated declarative `TickDecisionV1.action` with values `none | tool_call | reflect | schedule_job`, but architecture does not want runtime convenience code to silently decide whether `none` means a dropped action, whether `reflect` means free-form prose, or whether any future tool name can execute immediately. Without an explicit shaped fork, implementation would almost certainly spread these semantics across runtime lifecycle, tool wrappers and recovery code.
- Decision: `F-0010` fixes one canonical normalization rule: `none -> conscious_inaction`, `reflect -> review_request`, `tool_call -> tool_call`, `schedule_job -> schedule_job`. The first delivered allowlist is intentionally narrow: only `safe_data`, `git_body`, `network_http`, `restricted_shell` and `job_enqueue` wrappers are in scope, while world/state mutation tools remain out of the first-wave allowlist until canonical owner adapters exist. `action_log` remains the sole durable audit surface of this seam; no permanent review queue or shadow execution-history table is introduced here.
- Alternatives: Treat `none` as an implicit no-op with no audit evidence; let runtime lifecycle interpret `reflect` ad hoc; expose the full future tool universe already in the first implementation; create separate durable tables for review requests and tool execution history.
- Consequences: Implementation can stay bounded and testable on top of delivered runtime/cognition seams. Later features may expand review/governor policy or allowlisted tool families, but only through explicit follow-on work.

## 12. Progress & links

- Status: `proposed` -> `shaped` -> `done`
- Issue: -
- PRs:
  - -
- Code:
  - `packages/contracts/src/actions.ts`
  - `packages/db/src/action-log.ts`
  - `packages/db/src/jobs.ts`
  - `packages/db/src/runtime.ts`
  - `apps/core/src/actions/executive-center.ts`
  - `apps/core/src/actions/tool-gateway.ts`
  - `apps/core/src/runtime/runtime-lifecycle.ts`
  - `infra/migrations/006_action_log.sql`
- Verification:
  - `pnpm format`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm smoke:cell`
  - `dossier-engineer sync-index`
  - `dossier-engineer lint-dossiers`
  - `dossier-engineer coverage-audit --dossier docs/ssot/features/F-0010-executive-center-and-bounded-action-layer.md`
  - `dossier-engineer debt-audit --changed-only`
  - `dossier-engineer debt-audit`
  - `git diff --check`

## 13. Change log

- **v1.0 (2026-03-24):** Initial dossier created from candidate `CF-007`; intake fixed the executive/tool seam as a bounded action boundary on top of delivered platform/runtime/perception/router/decision prerequisites, made `action_log` and `boundary_check_json` explicit in scope, and prohibited backdoor writes into identity-bearing tables from the action layer.
- **v1.1 (2026-03-24):** `spec-compact` completed: the dossier advanced to `shaped`, fixed the normalization contract from declarative `TickDecisionV1.action` to executive verdicts, narrowed the first-wave allowlist and refusal taxonomy, made `action_log` the sole durable audit surface of the seam, and pinned the planned fast/smoke verification map for the future implementation.
- **v1.2 (2026-03-24):** `plan-slice` completed: the dossier now carries a four-slice delivery order covering executive audit substrate, bounded gateway refusals, reactive runtime handoff and deployment-cell/write-authority verification. Frontmatter intentionally remains `shaped` as a justified alternative because the repo coverage policy treats `planned` dossiers as blocking until AC-linked tests exist.
- **v1.3 (2026-03-24):** Implementation completed: delivered shared executive/action contracts, append-only `action_log`, bounded `ToolGateway`, reactive runtime handoff with `ticks.action_id`, the required `F-0003` continuity realignment, AC-linked fast suites and deployment-cell smoke. Status advanced to `done`.
- **v1.4 (2026-03-24):** Review hardening closed symlink-based workspace escape, reserved `ticks.action_id` before bounded execution, added rollback-aware audit failure handling for mutable wrappers, and bounded `job_enqueue` latency with explicit timeout coverage.
- **v1.5 (2026-03-24):** Final review hardening made timeout handling cancellation-safe on the delivered executive substrate: `job_enqueue.phase0_followup` now uses deterministic job ids plus abort-aware cleanup so late enqueue completion cannot survive a timeout refusal, while `git_body.write_file` now normalizes delayed parent inspection into canonical `execution_timeout` refusals before any write side effect.
