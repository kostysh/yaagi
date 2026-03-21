---
id: F-0003
title: Тиковый runtime, scheduler и эпизодическая линия времени
status: done
owners: ["@codex"]
area: runtime
depends_on: [F-0001, F-0002]
impacts: [runtime, db, timeline, jobs]
created: 2026-03-21
updated: 2026-03-21
links:
  issue: ""
  pr: []
  docs:
    - "docs/architecture/system.md"
    - "docs/features/F-0001-constitutional-boot-recovery.md"
    - "docs/features/F-0002-canonical-monorepo-deployment-cell.md"
    - "docs/adr/ADR-2026-03-19-boot-dependency-contract.md"
    - "docs/adr/ADR-2026-03-19-canonical-runtime-toolchain.md"
    - "docs/adr/ADR-2026-03-19-phase0-deployment-cell.md"
    - "docs/adr/ADR-2026-03-19-phase0-runtime-boundary.md"
---

# F-0003 Тиковый runtime, scheduler и эпизодическая линия времени

## 1. Context & Goal

- **User problem:** После `F-0001` и `F-0002` система умеет безопасно стартовать в реальной phase-0 deployment cell, но у неё ещё нет канонического owner для жизни после boot handoff: отсутствуют durable ticks, DB-backed scheduler/lease discipline, episodic biography и единая субъективная линия времени. Пока этого нет, runtime либо остаётся "живым" только на уровне health boundary, либо скатывается в неканонические in-memory loops, которые архитектура прямо запрещает.
- **Goal (what success means):** После успешного constitutional handoff runtime запускает tick engine и scheduler на canonical Postgres/`pg-boss` substrate, создаёт не-overlapping ticks, фиксирует их lifecycle в state kernel и пишет связанные episodes/timeline records так, чтобы у агента появилась одна субъективная линия времени уже до поставки следующих memory/perception/cognition seams.
- **Non-goals:** Полный perception buffer и sensor adapters, PSM/goals/beliefs model, Context Builder, organ routing, Mastra Decision Agent, executive actions, а также полный consolidation/developmental/graceful-shutdown lifecycle beyond the baseline tick backbone не входят в этот intake.

## 2. Scope

### In scope

- Tick engine boundary и transaction lifecycle, которые начинаются только после успешного `F-0001` boot activation.
- Scheduler/lease discipline на DB-backed phase-0 substrate, уже доставленном `F-0002`, включая использование PostgreSQL/`pg-boss` как canonical scheduling foundation.
- Узкий runtime bridge к существующему singleton `agent_state`, достаточный для handoff после boot и атомарного ведения `current_tick` без захвата ownership над полным субъектным состоянием.
- Минимальный internal tick request contract, достаточный для старта субъективных тиков из `boot` / `scheduler` / `system` источников до появления полного perception stack.
- Durable persistence для `ticks`, `episodes` и связанных timeline/event records, достаточная для одной субъективной линии времени и auditability.
- Failure handling для failed/cancelled ticks с корректным release scheduler lease и сохранением порядка событий.

### Out of scope

- Perception buffer, noise suppression, deduplication и внешний ingress через `http` / `file` / `telegram` / resource adapters; ими владеет следующий perception seam.
- Полный ownership над `agent_state` как субъектной memory-моделью, а также `psm_json`, goals, beliefs, entities и relationships; вне этой фичи остаётся всё, кроме узкого runtime pointer-а для `current_tick` и handoff после boot.
- Context Builder, narrative/memetic arena, organ selection, structured decision validation и другие когнитивные стадии основного тика.
- Executive center, bounded tools, action execution и side effects outside runtime bookkeeping.
- Полноценные consolidation/developmental cycles, retention/compaction policy, shutdown episode и graceful shutdown biography.

### Constraints

- Tick runtime не имеет права стартовать, если `F-0001` оставил систему в fail-closed состоянии; boot/recovery остаётся единственным gate входа в активный runtime.
- Реализация должна идти по уже зафиксированному каноническому пути `Node 22 + TypeScript + Mastra + Hono + pnpm + PostgreSQL + pg-boss + Docker Compose`, без альтернативного scheduler/runtime path.
- One-subject invariant обязателен: в каждый момент времени у агента может быть не более одного активного tick lease и не более одного executing tick.
- Источником истины для tick/episode/timeline state остаётся PostgreSQL state kernel; логи, Mastra memory и process-local queues не могут подменять durable state.
- `F-0003` обязан явно определить и держать только узкий runtime bridge к уже существующему `agent_state`: чтение singleton row после boot handoff, ведение `current_tick` во время активного тика и освобождение этого pointer-а на terminal transition; richer subject-state semantics остаются за следующим memory seam.
- Реализация этого shaped scope не должна протаскивать в себя ownership соседних seams под предлогом "завершения тика"; любое расширение за пределы зафиксированного bridge к `agent_state`, baseline `wake/reactive` и runtime bookkeeping должно оформляться как follow-on shaping against the next memory/perception/cognition seams.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0003-01:** После `F-0001` activation в режиме `normal` или policy-approved `degraded` runtime загружает существующий singleton `agent_state`, запускает scheduler/tick engine и создаёт обязательный baseline `wake` tick с `trigger_kind = boot`, записывая в PostgreSQL `tick_id`, `tick_kind`, `trigger_kind`, `started_at` и `status`; если boot неактивен или fail-closed, новый tick не создаётся.
- **AC-F0003-02:** Scheduler использует DB-backed lease discipline на canonical phase-0 substrate и гарантирует, что конкурентные попытки старта не создают overlapping active ticks или конфликтующие значения `agent_state.current_tick` для одного агента.
- **AC-F0003-03:** Tick engine фиксирует lifecycle transitions `started`, `completed`, `failed` и `cancelled`, публикует соответствующие timeline/event records в том же субъективном порядке, в котором коммитятся terminal outcomes тиков, и атомарно обновляет narrow runtime pointer `agent_state.current_tick` при входе и выходе из active tick.
- **AC-F0003-04:** При успешном завершении тика runtime создаёт `episodes` row, связанный с `tick_id`, с минимальным summary/result payload и коммитит этот episode atomically вместе с terminal tick status, так что биография не содержит episode без owning tick.
- **AC-F0003-05:** Если тик завершился ошибкой или bounded cancel, runtime помечает его terminal state, освобождает активный lease, записывает failure context в timeline/event sink и оставляет scheduler способным поставить следующий eligible tick без ручного ремонта БД.
- **AC-F0003-06:** Runtime фиксирует канонический contract для tick kinds `reactive`, `deliberative`, `contemplative`, `consolidation`, `developmental` и `wake`; в scope этой фичи минимально delivered set обязателен как `wake` после boot handoff и `reactive` для явных `system` / `scheduler` requests, а запрос любого другого kind до поставки его prerequisite seam должен завершаться явным `unsupported_tick_kind` результатом без создания active tick или episode.
- **AC-F0003-07:** Если `core` падает после lease acquisition или после записи `started`, но до terminal outcome, runtime при следующем старте выполняет bounded stale-tick reclaim pass: переводит такой tick в terminal failure state, очищает `agent_state.current_tick`, пишет failure event envelope и разблокирует постановку следующего eligible tick без ручного вмешательства.

## 4. Non-functional requirements (NFR)

- **Serializability:** Tick ordering и lease ownership должны быть детерминированными на реальном PostgreSQL substrate, а не только в single-process harness.
- **Reliability:** Process crash между `started` и terminal outcome не должен оставлять вечный active lease или неразрешимый "подвешенный" tick.
- **Auditability:** По `ticks`, `episodes` и timeline/event records оператор должен восстановить, какой tick был запущен, чем закончился и какой episode ему соответствует.
- **Scope discipline:** Ранний tick backbone не должен маскировать недоставленные perception/memory/cognition seams под "частичную" реализацию полного тика.

## 5. Design (compact)

### 5.1 Runtime surface

- Публичная operator API этой фичей не открывается; контракт остаётся внутренним runtime boundary поверх уже delivered `Mastra + Hono` substrate.
- В phase 0 scheduler поставляется как in-process worker внутри `core`, но использует только DB-backed primitives (`pg-boss`, advisory locks / row locks, PostgreSQL transactions). Отдельный `jobs` service остаётся дальнейшим расширением topology, а не prerequisite этого shaped scope.
- Предлагаемый internal contract:

```ts
type TickKind =
  | "reactive"
  | "deliberative"
  | "contemplative"
  | "consolidation"
  | "developmental"
  | "wake";

type TickTrigger = "boot" | "scheduler" | "system";

type TickStatus = "started" | "completed" | "failed" | "cancelled";

type TickRequest = {
  requestId: string;
  kind: TickKind;
  trigger: TickTrigger;
  requestedAt: string;
  payload: Record<string, unknown>;
};

type TickRequestResult =
  | { accepted: true; tickId: string }
  | {
      accepted: false;
      reason: "boot_inactive" | "lease_busy" | "unsupported_tick_kind";
    };

interface TickRuntime {
  start(): Promise<void>;
  stop(): Promise<void>;
  requestTick(input: TickRequest): Promise<TickRequestResult>;
  reclaimStaleTicks(): Promise<number>;
}
```

- `F-0001` остаётся владельцем handoff в `TickRuntime.start()`.
- `F-0002` остаётся владельцем process/container substrate, env contract и `pg-boss` readiness.
- Baseline support этой фичи фиксируется явно:
  - обязательный первый tick после успешного boot handoff: `wake` с `trigger = boot`;
  - первый scheduler-admissible post-boot path: `reactive` через явный `system` или `scheduler` request;
  - `deliberative`, `contemplative`, `consolidation` и `developmental` остаются частью canonical taxonomy, но должны отклоняться как `unsupported_tick_kind`, пока не delivered их соседние seams.
- Минимальная runtime/deployment contract для shaped scope:
  - `TickRuntime.start()` вызывается только после успешного `ConstitutionalBootService.activate()`;
  - `TickRuntime.start()` выполняет `reclaimStaleTicks()` до приёма новых requests;
  - `requestTick()` никогда не создаёт второй active tick, если lease уже удерживается;
  - phase-0 worker живёт внутри `core` container и не требует новой публичной HTTP surface beyond existing health boundary.

### 5.2 Data model changes

- Этот shaped scope закрепляет ownership над durable `ticks` и `episodes` lifecycle boundary из раздела `7.2` архитектуры.
- Для `ticks` в scope этой фичи обязательны поля `tick_id`, `tick_kind`, `trigger_kind`, `started_at`, `ended_at`, `status` и `continuity_flags_json`; `selected_coalition_id`, `selected_model_profile_id` и `action_id` на этой фазе остаются `null`.
- Для `episodes` в scope этой фичи обязательны `episode_id`, `tick_id`, `summary`, `result_json` и `created_at`; richer fields (`importance`, `valence`, `participants_json`, `internal_tension_json`, `evidence_refs_json`) допускаются пустыми или значениями по умолчанию до следующих seams.
- Этот shaped scope также закрепляет узкий bridge к уже существующему `agent_state`: runtime загружает singleton row после boot handoff, выставляет `current_tick` при активации тика и очищает или заменяет его на terminal transition, не изменяя `psm_json`, goals или beliefs.
- Timeline/event sink переиспользуется как существующий lifecycle/audit surface для `tick.started`, `tick.completed`, `tick.failed` и `tick.cancelled`, используя единый event envelope с `eventId`, `eventType`, `occurredAt`, `subjectRef = tick_id` и structured `payload`.
- Scheduler foundation должен опираться на PostgreSQL/`pg-boss` и/или узкий DB-backed lease layer, а не на in-memory timers как canonical source of truth.
- Ownership полного `agent_state`, `psm_json`, goals и beliefs остаётся вне этой фичи и будет уточняться в следующем dossier memory seam.

### 5.3 UI changes (if any)

- Не применимо.

### 5.4 Edge cases

- Процесс падает после записи `ticks.started`, но до terminal outcome или episode commit.
- Два worker/process restart одновременно пытаются взять право на следующий тик.
- Tick request приходит в момент, когда boot уже завершил activation, но runtime ещё останавливает scheduler.
- Запрошен canonical tick kind, чьи prerequisite seams ещё не delivered.
- Episode encoding нужен даже для actionless tick, но result payload частично пуст.

### 5.5 Failure modes and recovery boundaries

- Crash-before-terminal-state: stale-tick reclaim pass на старте переводит незавершённый tick в `failed`, очищает `agent_state.current_tick` и выпускает failure event.
- Duplicate request replay: повторный `requestId` не должен создавать второй active tick или второй episode; shaped implementation должна либо дедуплицировать request, либо детерминированно отклонять duplicate.
- Lease starvation: expired/stale lease должен иметь bounded reclaim policy; runtime не может зависнуть навсегда в состоянии "tick active, но owner исчез".
- Boot/runtime race: пока `F-0001` не завершил activation, `requestTick()` возвращает `boot_inactive`; wake tick создаётся только после handoff.
- Unsupported kind drift: scheduler не имеет права silently remap unsupported kinds в `wake`/`reactive`.

### 5.6 Verification surface

- Fast path:
  - integration tests для boot handoff, `wake` start, `reactive` scheduling, no-overlap execution и `agent_state.current_tick`;
  - contract tests для canonical tick-kind matrix и duplicate request handling;
  - failure-path integration tests для stale-tick reclaim и episode atomicity.
- Containerized smoke path:
  - `pnpm smoke:cell` должен подтверждать boot-to-wake startup внутри deployment cell;
  - smoke должен подтверждать, что `core` не запускает overlapping ticks после forced restart / reclaim scenario;
  - smoke должен оставаться в рамках phase-0 topology `core + postgres + vllm-fast`, без отдельного `jobs` container.
- Manual/operator surface:
  - достаточно inspection через health/logs/timeline rows; richer operator API остаётся вне scope.

## 6. Definition of Done

- Новый dossier явно фиксирует, что `F-0003` зависит от уже delivered `F-0001` и `F-0002`, но не берёт ownership соседних seams.
- Shaped ACs покрывают boot handoff, narrow `agent_state` bridge, no-overlap execution, mandatory baseline tick path, durable tick lifecycle, episode linkage, explicit unsupported-kind behavior и stale-tick reclaim semantics.
- Backlog candidate `CF-002` переведён в `intaken`, а `docs/ssot/index.md` синхронизирован с новым dossier.
- Так как фича меняет runtime/startup behavior, план верификации при реализации обязан включать и быстрый test path, и containerized smoke path внутри deployment cell.
- Phase-0 scheduler topology (`in-process core worker + DB-backed leases`) закреплена явно и не конфликтует с уже delivered `F-0002`.
- Dossier lint и coverage audit проходят без ошибок после реализации, а `docs/ssot/index.md` отражает статус `done`.

## 7. Slicing plan (2–6 increments)

### Slice SL-F0003-01: Boot handoff and mandatory wake tick
Delivers: handoff from `F-0001` into `TickRuntime.start()`, singleton `agent_state` load and the first mandatory `wake` tick after successful activation.
Covers: AC-F0003-01
Verification: `integration`
Exit criteria:
- `TickRuntime.start()` can run only after successful constitutional activation.
- Startup creates exactly one baseline `wake` tick with `trigger = boot` and never creates it in fail-closed or boot-inactive mode.
Tasks:
- **T-F0003-01:** Wire `TickRuntime.start()` to the post-boot activation boundary and reject startup when boot remains inactive. Covers: AC-F0003-01.
- **T-F0003-02:** Load the singleton `agent_state` row and persist the baseline `wake` tick on successful startup handoff. Covers: AC-F0003-01.

### Slice SL-F0003-02: Lease discipline and supported tick matrix
Delivers: DB-backed no-overlap execution, explicit supported kind matrix for phase 0 and deterministic rejection of unsupported requests.
Covers: AC-F0003-02, AC-F0003-06
Verification: `integration`, `contract`
Exit criteria:
- Concurrent requests cannot create two active ticks or conflicting `agent_state.current_tick` values.
- Phase-0 delivered set is fixed to `wake` and `reactive`; all other canonical kinds fail with `unsupported_tick_kind`.
Tasks:
- **T-F0003-03:** Implement PostgreSQL/`pg-boss` lease acquisition and release rules for single-active-tick execution. Covers: AC-F0003-02.
- **T-F0003-04:** Implement the phase-0 tick-kind matrix and explicit rejection semantics for unsupported kinds. Covers: AC-F0003-06.
- **T-F0003-05:** Add duplicate `requestId` guardrails as part of `SL-F0003-02` request admission logic. Covers: SL-F0003-02.

### Slice SL-F0003-03: Tick lifecycle events and `agent_state` pointer
Delivers: transactional tick lifecycle transitions, event-envelope publication and atomic maintenance of the narrow `agent_state.current_tick` bridge.
Covers: AC-F0003-03
Verification: `integration`
Exit criteria:
- `started`, `completed`, `failed` and `cancelled` transitions are persisted in subjective order.
- `agent_state.current_tick` is set on active tick entry and cleared or replaced on terminal transition in the same transactional boundary.
Tasks:
- **T-F0003-06:** Implement transactional lifecycle transitions and terminal status persistence for active ticks. Covers: AC-F0003-03.
- **T-F0003-07:** Publish `tick.*` event envelopes and atomically update `agent_state.current_tick` around active and terminal transitions. Covers: AC-F0003-03.

### Slice SL-F0003-04: Episode commit and terminal failure path
Delivers: atomic success-path episode creation plus failure/cancel handling that releases leases and preserves schedulability.
Covers: AC-F0003-04, AC-F0003-05
Verification: `integration`
Exit criteria:
- Successful terminal ticks always commit their owning episode in the same transaction.
- Failed or cancelled ticks release the active lease, record failure context and leave the scheduler able to admit the next eligible tick.
Tasks:
- **T-F0003-08:** Implement minimal episode encoding and same-transaction commit with successful terminal tick status. Covers: AC-F0003-04.
- **T-F0003-09:** Implement failure/cancel terminal path with lease release and failure context publication. Covers: AC-F0003-05.

### Slice SL-F0003-05: Stale-tick reclaim and containerized smoke
Delivers: startup reclaim for crashed active ticks and runtime/deployment smoke coverage for boot-to-wake and restart scenarios inside the phase-0 cell.
Covers: AC-F0003-07
Verification: `integration`, `smoke`
Exit criteria:
- Startup runs bounded stale-tick reclaim before accepting new requests.
- Containerized smoke proves boot-to-wake startup and restart/reclaim behavior in the delivered deployment cell.
Tasks:
- **T-F0003-10:** Implement `reclaimStaleTicks()` to fail unfinished ticks, clear `agent_state.current_tick` and release blocked admission after restart. Covers: AC-F0003-07.
- **T-F0003-11:** Add deployment-cell smoke scenarios for boot-to-wake startup and stale-tick reclaim after forced restart. Covers: AC-F0003-07.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0003-01 | `apps/core/test/runtime/tick-engine.integration.test.ts` → `test("AC-F0003-01 starts the mandatory wake tick only after constitutional activation")`; smoke in `infra/docker/deployment-cell.smoke.ts` → `test("AC-F0003-01 starts the mandatory wake tick only after constitutional activation")` | done |
| AC-F0003-02 | `apps/core/test/runtime/tick-scheduler.integration.test.ts` → `test("AC-F0003-02 prevents overlapping active ticks through DB-backed lease discipline")`; smoke in `infra/docker/deployment-cell.smoke.ts` → `test("AC-F0003-02 prevents overlapping active ticks through DB-backed lease discipline")` | done |
| AC-F0003-03 | `apps/core/test/runtime/agent-state-handoff.integration.test.ts` → `test("AC-F0003-03 maintains agent_state.current_tick atomically across active and terminal tick transitions")` | done |
| AC-F0003-04 | `apps/core/test/runtime/episode-encoder.integration.test.ts` → `test("AC-F0003-04 commits the episode atomically with its owning tick")` | done |
| AC-F0003-05 | `apps/core/test/runtime/tick-failure.integration.test.ts` → `test("AC-F0003-05 releases the active lease and records failure context after a failed tick")` | done |
| AC-F0003-06 | `apps/core/test/runtime/tick-kinds.contract.test.ts` → `test("AC-F0003-06 delivers wake and reactive as the phase-0 supported tick kinds and rejects the rest explicitly")` | done |
| AC-F0003-07 | `apps/core/test/runtime/stale-tick-reclaim.integration.test.ts` → `test("AC-F0003-07 reclaims stale active ticks after restart and clears agent_state.current_tick")`; smoke in `infra/docker/deployment-cell.smoke.ts` → `test("AC-F0003-07 reclaims stale active ticks after restart and clears agent_state.current_tick")` | done |

План верификации:

- Быстрый путь реализации: `pnpm test`.
- Containerized smoke path для runtime/startup seam: `pnpm smoke:cell`.

## 9. Decision log (ADR blocks)

### ADR-F0003-01: Tick taxonomy stays architecture-complete, but scheduling support is gated by delivered seams
- Status: Accepted
- Context: Архитектура уже фиксирует шесть канонических tick kinds, но текущий backbone доставил только boot/platform substrate. Если попытаться "сразу поддержать всё", ранний runtime quietly втянет perception, cognition и governance seams, которые ещё не intaken or delivered.
- Decision: `F-0003` фиксирует полный canonical tick-kind contract уже на intake, но scheduler может активировать только те kinds, чьи prerequisite seams явно delivered и задокументированы. Любой другой kind должен завершаться явным `unsupported_tick_kind` результатом до lease acquisition и без side effects в биографии.
- Alternatives: Временно сократить enum до одного-двух kinds; silently remap unsupported kinds в `wake` или `reactive`.
- Consequences: Таксономия тиков остаётся стабильной с самого начала, но phase delivery остаётся честной и не маскирует недоставленные seams.

### ADR-F0003-02: Phase-0 scheduler runs inside `core`, but only on DB-backed lease primitives
- Status: Accepted
- Context: Каноническая зрелая topology архитектуры предусматривает отдельные job workers, но delivered phase-0 cell из `F-0002` состоит только из `core`, `postgres` и `vllm-fast`. Блокировать tick backbone до появления отдельного `jobs` service нельзя, а in-memory scheduler противоречит архитектурным lease/state contracts.
- Decision: В рамках `F-0003` scheduler и stale-tick reclaim выполняются как in-process worker внутри `core`, используя `pg-boss`, advisory/row locks и PostgreSQL transactions. Выделение отдельного `jobs` service допускается только как follow-on evolution, сохраняющая те же queue/lease/event contracts.
- Alternatives: Ждать отдельного `jobs` service перед поставкой тиков; использовать process-local timers и память как временный scheduler.
- Consequences: Phase-0 остаётся implementable на уже delivered cell; future topology split остаётся эволюционным, а не переписыванием tick semantics.

## 10. Progress & links

- Status: `proposed` → `shaped` → `planned` → `done`
- Issue: -
- PRs:
  - -
- Code:
  - `apps/core/src/platform/core-runtime.ts`
  - `apps/core/src/runtime/index.ts`
  - `apps/core/src/runtime/runtime-lifecycle.ts`
  - `apps/core/src/runtime/tick-runtime.ts`
  - `apps/core/test/platform/core-runtime.test.ts`
  - `apps/core/test/runtime/agent-state-handoff.integration.test.ts`
  - `apps/core/test/runtime/episode-encoder.integration.test.ts`
  - `apps/core/test/runtime/stale-tick-reclaim.integration.test.ts`
  - `apps/core/test/runtime/tick-engine.integration.test.ts`
  - `apps/core/test/runtime/tick-failure.integration.test.ts`
  - `apps/core/test/runtime/tick-kinds.contract.test.ts`
  - `apps/core/test/runtime/tick-scheduler.integration.test.ts`
  - `apps/core/testing/tick-runtime-harness.ts`
  - `infra/docker/deployment-cell.smoke.ts`
  - `infra/migrations/002_tick_runtime_store.sql`
  - `packages/contracts/package.json`
  - `packages/contracts/src/runtime.ts`
  - `packages/db/src/cli/bootstrap.ts`
  - `packages/db/src/index.ts`
  - `packages/db/src/runtime.ts`

## 11. Change log

- **v1.0 (2026-03-21):** Initial dossier created from `CF-002`; baseline assumptions fixed to `F-0001` + `F-0002`, and tick/scheduler/episode ownership was separated from memory, perception and cognition seams.
- **v1.1 (2026-03-21):** Intake tightened after independent review: added explicit narrow `agent_state` bridge, fixed mandatory baseline tick support (`wake` + `reactive`) and reserved containerized smoke verification alongside fast tests.
- **v1.2 (2026-03-21):** `spec-compact` completed: status raised to `shaped`, phase-0 scheduler topology fixed, stale-tick reclaim semantics added, data/event contracts tightened and verification surface expanded.
- **v1.3 (2026-03-21):** `plan-slice` completed: dossier moved to `planned` and decomposed into delivery slices covering boot handoff, lease discipline, lifecycle transitions, episode commit and stale-tick reclaim.
- **v1.4 (2026-03-21):** Implementation completed: added the `polyphony_runtime` PostgreSQL substrate and runtime contracts, wired `core` through constitutional boot into a DB-backed phase-0 tick lifecycle, delivered AC-linked integration tests plus deployment-cell smoke for wake/reclaim, and fixed boot-specific seams around authoritative DB `tick_id`, dependency probes, container volume root resolution and per-boot wake request deduplication.
