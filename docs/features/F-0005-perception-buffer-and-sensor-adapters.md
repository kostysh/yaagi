---
id: F-0005
title: Буфер восприятия и сенсорные адаптеры
status: done
coverage_gate: strict
owners: ["@codex"]
area: perception
depends_on: [F-0001, F-0002, F-0003]
impacts: [runtime, db, ingress, perception]
created: 2026-03-23
updated: 2026-03-25
links:
  issue: ""
  pr: []
  docs:
    - "docs/architecture/system.md"
    - "docs/features/F-0001-constitutional-boot-recovery.md"
    - "docs/features/F-0002-canonical-monorepo-deployment-cell.md"
    - "docs/features/F-0003-tick-runtime-scheduler-episodic-timeline.md"
    - "docs/features/F-0004-subject-state-kernel-and-memory-model.md"
    - "docs/adr/ADR-2026-03-23-perception-intake-contract.md"
    - "docs/adr/ADR-2026-03-19-canonical-runtime-toolchain.md"
    - "docs/adr/ADR-2026-03-19-phase0-runtime-boundary.md"
    - "docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md"
---

# F-0005 Буфер восприятия и сенсорные адаптеры

## 1. Context & Goal

- **User problem:** После `F-0001`, `F-0002` и `F-0003` у системы есть boot gate, deployment cell и канонический tick runtime, но всё ещё нет явного владельца входного слоя между внешними/внутренними сигналами и decision loop. Сейчас runtime умеет принимать только узкие tick requests, а архитектура уже требует unified sensor adapters, perception buffer и нормализованный intake contract; без этого следующий этап либо начнёт подавать raw events напрямую в когнитивный цикл, либо размазывать ingress по ad hoc hooks.
- **Goal (what success means):** Появляется канонический owner для perception ingress: нормализованные сигналы из `http`, `file`, `scheduler`, `resource`, `system` и рабочего `telegram` sensor-а проходят через единый adapter contract, bounded perception buffer и durable `stimulus_inbox`, а urgent signals могут законно инициировать `reactive` tick через уже delivered runtime path из `F-0003`.
- **Non-goals:** Context Builder, AI SDK-backed decision harness, organ selection, narrative/memetic interpretation, operator-facing introspection API, action execution и full homeostat semantics не входят в этот intake. Эта фича также не берёт ownership над субъектной memory-моделью из `F-0004`, кроме стыка с perception aggregates и runtime handoff.

## 2. Scope

### In scope

- Канонический contract для `SensorSignal` / `StimulusEnvelope` / `SensorAdapter` и первого delivered набора perception sources: `http`, `file`, `scheduler`, `resource`, `system`, `telegram`.
- Fixed-size perception buffer и durable intake surface вокруг `stimulus_inbox`, которые отделяют raw adapter output от decision loop.
- Нормализация входящего потока, дедупликация, suppression noise, burst coalescing, deterministic queue ordering и вычисление perception-level aggregates вроде `urgency`, `novelty`, `resourcePressure`.
- Minimal ingress boundary для `POST /ingest`, которая заводит stimuli в perception layer, не открывая полный operator API.
- Интеграция perception layer с already delivered `reactive` tick path из `F-0003`, включая urgent/`requiresImmediateTick` handoff без overlap active ticks и bounded claim/release semantics для stimuli, уже включённых в текущий tick.
- Lifecycle start/stop/health для sensor adapters внутри canonical `core` runtime и deployment cell.

### Out of scope

- Полная сборка `PerceptualContext` из memory/narrative/memetic layers; этим владеет следующий cognitive seam.
- Operator-facing routes `GET /state`, `GET /timeline`, `GET /episodes`, `GET /models` и расширенный control/introspection API; это остаётся отдельным API seam.
- Structured decision validation, model profile selection и execution/action semantics.
- Semantic entity resolution против `F-0004` subject-state surfaces; `entityRefs` в этой фазе остаются opaque refs, а не full memory join contract.
- Memetic arena, narrative spine, field journal и deeper interpretation of stimuli beyond normalized perception intake.
- Phase-2+ channel-specific behavior вроде rich Telegram session semantics, advanced filesystem workflows или mature resource-governor policy.

### Constraints

- Current phase baseline for this intake: `F-0001`, `F-0002` и `F-0003` уже delivered; perception layer должна интегрироваться в уже зафиксированный `core + postgres + vllm-fast` runtime path и использовать canonical tick admission из `F-0003`, а не альтернативный event loop или message broker.
- Sensor adapters не могут стартовать в обход `F-0001` boot/recovery gate; fail-closed startup не должен оставлять активные watchers/pollers.
- Raw signals не подаются прямо в decision loop; perception buffer остаётся обязательным normalization boundary.
- Perception data не становится новой скрытой biography surface: `stimulus_inbox` должен оставаться purgeable technical intake layer согласно архитектурной retention policy.
- `stimulus_inbox` остаётся единственным durable intake layer; bounded perception buffer не может quietly эволюционировать во вторую permanent history table рядом с ним.
- Эта фича не должна quietly втянуть в себя ownership над Context Builder, subject-state updates, operator API или homeostat decisions под предлогом "чтобы perception работал полностью".
- Mutable runtime artifacts perception layer должны жить в canonical runtime areas и не могут мутировать tracked `/seed/**`.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0005-01:** После успешного `F-0001` boot activation runtime стартует sensor adapters только под lifecycle control внутри `core`; fail-closed startup, runtime stop и restart/recovery не оставляют активные watchers/pollers или dangling adapter handlers вне этого lifecycle.
- **AC-F0005-02:** `POST /ingest` и delivered internal adapter sources (`http`, `file`, `scheduler`, `resource`, `system`, `telegram`) нормализуют каждый принятый сигнал в canonical `StimulusEnvelope` и durable-пишут ровно одну `stimulus_inbox` entry со stable `source_kind`, `normalized_json` и `status = queued`; raw adapter payload не может подаваться прямо в tick/context path.
- **AC-F0005-03:** Bounded perception buffer собирается детерминированно из `stimulus_inbox` ready queue, применяет deduplication, noise suppression и burst coalescing до tick handoff и возвращает stimuli в порядке `requires_immediate_tick DESC`, `priority DESC`, `occurred_at ASC`, `stimulus_id ASC`; noisy or duplicate source не приводит к unbounded ready backlog.
- **AC-F0005-04:** Signal с `requiresImmediateTick = true` или `priority = critical` может инициировать `reactive` tick только через canonical `requestTick(...)` path из `F-0003`; если admission отклонён как `boot_inactive` или `lease_busy`, signal остаётся queued/claimable и не создаёт side-channel tick path.
- **AC-F0005-05:** Отказ отдельного adapter source surface-ится через adapter health/diagnostic path и остаётся source-local degradation: `core` не падает из-за одного failing adapter, другие healthy sources продолжают ingest path, а `telegram` adapter входит в first-wave delivery, использует explicit config activation и при `YAAGI_TELEGRAM_ENABLED=true` без обязательных secrets/allowlist fail-closed валидирует startup вместо silent disable.
- **AC-F0005-06:** После claim в конкретный tick perception layer может либо `mark consumed`, либо `release` stimuli обратно в queue; только terminal `consumed` / `dropped` entries становятся purge-eligible, так что `stimulus_inbox` остаётся purgeable technical layer и не заменяет biographical memory/timeline.

## 4. Non-functional requirements (NFR)

- **Boundedness:** Perception intake должен иметь фиксированные bounds и предсказуемую overflow policy.
- **Determinism:** Queue ordering, dedupe semantics и urgent handoff должны быть одинаковыми после restart и между runtime instances на одном PostgreSQL state kernel.
- **Reliability:** Ошибка одного adapter-а не должна ронять `core`, corrupt queued stimuli других sources или создавать неосвобождённые claimed entries после crash/reclaim.
- **Observability:** Должны существовать signals/health surfaces, по которым можно понять состояние adapters, perception backlog и urgent-tick handoff outcome.
- **Scope discipline:** Perception intake не должен подменять собой Context Builder, subject memory или operator API.

## 5. Design (compact)

### 5.1 Runtime and deployment surface

- Публичная surface этой фичи ограничивается write-ingress route `POST /ingest` и расширением read-only health payload perception diagnostics; read APIs и broader control routes остаются за отдельным API seam.
- Новых сервисов deployment cell фича не вводит: perception layer живёт внутри already delivered `core` container и использует existing `postgres` + `pg-boss` + `vllm-fast` topology из `F-0002`.
- Обязательный delivered adapter set для первой реализации:
  - `system-adapter`
  - `scheduler-adapter`
  - `http-ingress-adapter`
  - `filesystem-adapter`
  - `resource-adapter`
  - `telegram-adapter`
- `telegram-adapter` в первой delivered реализации использует Telegram Bot API long polling, а не webhook callback: это сохраняет canonical local/deployment-cell topology без отдельного public ingress endpoint.
- Telegram local secret/config contract:
  - checked-in shape хранится в repo-root `.env.example`;
  - реальные локальные secrets хранятся в repo-root `.env.local`, который уже git-ignored;
  - application code продолжает читать только `process.env`; canonical local-secret launch paths фиксируются как `pnpm cell:up:local` и `pnpm smoke:cell:local`, а не через in-process secret parser;
  - при `YAAGI_TELEGRAM_ENABLED=true` обязательны `YAAGI_TELEGRAM_BOT_TOKEN` и `YAAGI_TELEGRAM_ALLOWED_CHAT_IDS`;
  - `YAAGI_TELEGRAM_API_BASE_URL` остаётся test/smoke override для fake Bot API server и по умолчанию указывает на canonical Telegram Bot API.
- Runtime ownership boundaries:
  - `apps/core/src/perception` владеет adapter lifecycle controller, ingress normalization, queue/buffer policy и batch claim/release semantics;
  - `packages/db` владеет `stimulus_inbox` persistence и queue queries;
  - `apps/core/src/runtime` остаётся владельцем tick admission/lifecycle и получает от perception только canonical `requestTick(...)` calls plus future batch claim hooks.
- `scheduler-adapter` первой delivered реализации не invent-ит собственный polling/heartbeat topology: он переводит существующие runtime scheduler hooks в canonical scheduler stimuli, а в phase-0 использует lifecycle/activation seam планировщика.
- Startup order для этой фичи фиксируется так:
  1. `F-0001` завершает boot activation;
  2. `F-0003` runtime initializes and reclaims stale ticks;
  3. perception controller starts adapters;
  4. adapters may enqueue stimuli and request `reactive` ticks through `F-0003`.
- Compact internal contract:

```ts
type SensorSource = 'http' | 'file' | 'telegram' | 'scheduler' | 'resource' | 'system';

type StimulusEnvelope = {
  id: string;
  source: SensorSource;
  occurredAt: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  threadId?: string;
  entityRefs?: readonly string[];
  requiresImmediateTick: boolean;
  payload: Record<string, unknown>;
  reliability: number;
};

type StimulusStatus = 'queued' | 'claimed' | 'consumed' | 'dropped';

type PerceptionBatch = {
  tickId: string;
  stimuli: StimulusEnvelope[];
  summary: string;
  urgency: number;
  novelty: number;
  resourcePressure: number;
};

interface PerceptionIngress {
  ingest(signal: SensorSignal): Promise<{
    stimulusId: string;
    immediateTickRequested: boolean;
  }>;
  buildPerceptionBatch(input: { tickId: string; limit: number }): Promise<PerceptionBatch>;
  markBatchConsumed(input: { tickId: string; episodeId: string }): Promise<number>;
  releaseClaimedStimuli(input: { tickId: string }): Promise<number>;
}
```

- `POST /ingest` принимает canonical HTTP-ingest payload (`signalType`, optional priority/thread metadata, `payload`, optional `dedupeKey` / `aggregateHints`) и приводит его к тому же canonical normalized contract, что и internal adapters.
- `entityRefs` в этом phase остаются opaque references; perception layer не обязана разрешать их против `F-0004` entities before queueing or claiming.

### 5.2 Data model changes

- `F-0005` берёт ownership над `stimulus_inbox` как canonical durable intake layer.
- `stimulus_inbox` schema для shaped implementation:
  - `stimulus_id text primary key`
  - `source_kind text not null check (source_kind in ('http', 'file', 'telegram', 'scheduler', 'resource', 'system'))`
  - `thread_id text`
  - `occurred_at timestamptz not null`
  - `priority text not null check (priority in ('low', 'normal', 'high', 'critical'))`
  - `priority_rank smallint not null check (priority_rank between 0 and 3)`
  - `requires_immediate_tick boolean not null default false`
  - `payload_json jsonb not null default '{}'::jsonb`
  - `normalized_json jsonb not null default '{}'::jsonb`
  - `dedupe_key text`
  - `claim_tick_id text references polyphony_runtime.ticks(tick_id) on delete set null`
  - `status text not null check (status in ('queued', 'claimed', 'consumed', 'dropped'))`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
- Required indexes for bounded queue and restart-safe recovery:
  - `stimulus_inbox_ready_idx` on `(status, requires_immediate_tick desc, priority_rank desc, occurred_at asc, stimulus_id asc)`
  - `stimulus_inbox_dedupe_idx` on `(source_kind, dedupe_key, occurred_at desc) where dedupe_key is not null`
  - `stimulus_inbox_claim_idx` on `(claim_tick_id, status, updated_at desc)`
- Shaped storage semantics:
  - `normalized_json` stores the canonical `StimulusEnvelope` plus normalization metadata needed for burst coalescing and aggregate hints;
  - perception buffer is derived from `stimulus_inbox` rows in `queued` / `claimed` states and is not represented by a second permanent table;
  - `priority_rank` is a storage/performance helper only; the canonical API/runtime contract keeps the label form of priority.

### 5.3 UI changes (if any)

- Не применимо.

### 5.4 Edge cases

- Duplicate или burst stimuli от noisy file/resource sources должны схлопываться по `dedupe_key`, не теряя stronger priority among merged events.
- Telegram update retry или poll replay не должен создавать вторую queued entry для того же `update_id`; `dedupe_key` должен быть совместим с restart-safe Telegram offset semantics.
- Urgent signal приходит во время already active tick; он остаётся queued until next admissible `reactive` request path instead of being dropped or executed out of band.
- `filesystem-adapter` не должен реагировать на mutable runtime outputs outside allowlisted watched areas, иначе perception layer попадёт в self-feedback loop.
- `resource-adapter` может публиковать sustained pressure spikes; burst coalescing and queue bounds должны предотвращать flooding.
- Telegram update из chat/thread вне `YAAGI_TELEGRAM_ALLOWED_CHAT_IDS` не должен materialize-иться в `stimulus_inbox`.
- Restart происходит при наличии claimed, но ещё не consumed stimuli.

### 5.5 Failure modes and recovery boundaries

- Crash after claim, before terminal tick outcome: если `claim_tick_id` указывает на failed/reclaimed tick, `releaseClaimedStimuli(...)` возвращает rows обратно в `queued` before the next batch build.
- Invalid external ingest payload: `POST /ingest` возвращает validation failure и не создаёт `stimulus_inbox` row.
- Adapter-local failure: source помечается degraded/failed in health diagnostics, но runtime process остаётся живым и intake from healthy sources continues.
- Telegram config failure: если `YAAGI_TELEGRAM_ENABLED=true`, но отсутствует bot token или allowlist chat IDs, startup завершается config error before adapter start.
- Telegram upstream failure: long-poll request к Bot API может временно деградировать source health, но не должен corrupt already persisted stimuli или блокировать другие adapters.
- Urgent handoff rejection: если `requestTick(...)` возвращает `boot_inactive` или `lease_busy`, normalized stimulus остаётся persisted and claimable; perception layer не превращает rejection в data loss.
- Purge safety: только `consumed` / `dropped` entries могут удаляться retention job; `queued` / `claimed` entries никогда не должны silently исчезать под retention policy.

### 5.6 Verification surface

- Fast path:
  - integration tests для adapter lifecycle start/stop under runtime control;
  - integration tests для `POST /ingest` validation + normalization into `stimulus_inbox`;
  - integration tests для `telegram-adapter` long polling against a fake Bot API server, включая allowlist filtering, `update_id` dedupe и restart-safe offset replay;
  - integration tests для bounded queue ordering, dedupe, burst coalescing and claim/release semantics;
  - integration tests для urgent `reactive` handoff through `F-0003` request path;
  - integration tests для source-local adapter degradation, Telegram config validation и upstream Bot API failure behavior.
- Containerized smoke path:
  - `pnpm smoke:cell` должен подтвердить, что `core` стартует с perception subsystem внутри canonical deployment cell;
  - smoke должен подтвердить, что `POST /ingest` принимает canonical payload и может инициировать не более одного `reactive` tick через existing runtime path;
  - Telegram-specific smoke использует smoke-only compose override, который добавляет `fake-telegram-api` test service и прокидывает `YAAGI_TELEGRAM_API_BASE_URL=http://fake-telegram-api:8081` в `core`; этот override не меняет delivered deployment-cell baseline, reuse-ит тот же suite-scoped `vllm-fast` runtime и не требует live Telegram;
  - smoke должен подтвердить, что `core`, запущенный против `fake-telegram-api` и test token, ingest-ит Telegram update в `stimulus_inbox` без отдельного webhook ingress;
  - restart-safe behavior для queued/consumed stimuli остаётся обязательным, но доказывается fast integration path, а не container smoke, потому что его main value лежит в claim/release and stale-reclaim DB/runtime semantics.
- Manual/operator surface:
  - достаточно inspection через `GET /health`, logs и `stimulus_inbox` rows during implementation;
  - manual live check использует реальный bot token в `.env.local`: allowlisted operator chat отправляет message, после чего в `stimulus_inbox` появляется `source_kind = 'telegram'`.
  - richer operator introspection API остаётся вне scope.

## 6. Definition of Done

- AC-F0005-* уточнены до тестируемого perception/runtime contract и покрыты planned AC-linked tests.
- Canonical mapping between `SensorSignal`, `StimulusEnvelope`, `stimulus_inbox` and bounded perception buffer больше не остаётся implicit и не противоречит архитектуре.
- First delivered adapter set включает working `telegram` sensor, а его transport/config/secrets contract зафиксирован без webhook-only assumptions.
- Urgent signal handoff reused only the canonical `F-0003` reactive tick admission path; отдельный event loop или hidden scheduler path не introduced.
- `stimulus_inbox` и purge/claim semantics остаются technical intake layer, а не вторым biography/memory seam.
- Для runtime-affecting поведения запланированы и fast integration verification, и containerized smoke verification.
- `docs/ssot/index.md` синхронизирован, dossier lint проходит без ошибок и предупреждений, а cross-cutting perception-intake decision вынесен в repo-level ADR.

## 7. Slicing plan (2–6 increments)

### Slice SL-F0005-01: Contracts, config, and storage substrate
Delivers: canonical perception contracts, runtime config/health extension, `stimulus_inbox` migration and a dedicated SQL-backed perception store.
Covers: AC-F0005-02, AC-F0005-03, AC-F0005-05, AC-F0005-06
Verification: `integration`, `contract`
Exit criteria:
- `stimulus_inbox` and its indexes exist with deterministic ready/claim query support.
- `CoreRuntimeConfig` validates the Telegram/env contract and `GET /health` can expose an empty perception subsection.
- Perception-driven reactive ticks keep `trigger = system`; source provenance stays in `stimulus_inbox` and the claimed-batch payload.
Tasks:
- **T-F0005-01:** Add `@yaagi/contracts/perception` for `SensorSignal`, `StimulusEnvelope`, adapter health/status and perception-store I/O types. Covers: AC-F0005-02, AC-F0005-05.
- **T-F0005-02:** Add the migration that creates `polyphony_runtime.stimulus_inbox` with the planned constraints and indexes. Covers: AC-F0005-02, AC-F0005-03, AC-F0005-06.
- **T-F0005-03:** Add a dedicated perception store in `packages/db` with enqueue, ready-batch query, claim, consume, release and backlog-count APIs. Covers: AC-F0005-02, AC-F0005-03, AC-F0005-06.
- **T-F0005-04:** Extend runtime config and health payload for `YAAGI_TELEGRAM_*` plus minimal perception diagnostics. Covers: AC-F0005-05.

### Slice SL-F0005-02: Perception kernel, lifecycle control, and HTTP/system ingress
Delivers: the generic perception service/controller, `POST /ingest`, deterministic normalization/order/claim semantics and a perception-aware reactive execution hook.
Covers: AC-F0005-01, AC-F0005-02, AC-F0005-03, AC-F0005-04, AC-F0005-06
Verification: `integration`
Exit criteria:
- Adapters start and stop only through the existing constitutional boot/runtime lifecycle.
- HTTP and system signals persist into `stimulus_inbox`, build a bounded ready set and can trigger reactive ticks through the existing `F-0003` request path.
- Claimed stimuli are consumed on successful completion and released on non-terminal or rejected handoff paths.
Tasks:
- **T-F0005-05:** Add `apps/core/src/perception` with the controller/service boundary, normalization rules, queue ordering and claim/release semantics. Covers: AC-F0005-01, AC-F0005-03, AC-F0005-06.
- **T-F0005-06:** Extend the Hono runtime with `POST /ingest` and system-signal ingestion through the same canonical normalized contract. Covers: AC-F0005-02.
- **T-F0005-07:** Realign the phase-0 reactive execution path so it builds the claimed perception batch after tick admission and before terminal completion, without introducing a side-channel event loop. Covers: AC-F0005-04, AC-F0005-06.

### Slice SL-F0005-03: Telegram-first operator milestone
Delivers: the long-poll Telegram adapter, explicit config gating, allowlist filtering, update replay safety and the first operator-usable perception path.
Covers: AC-F0005-01, AC-F0005-02, AC-F0005-05
Verification: `integration`, `manual`
Exit criteria:
- `telegram-adapter` long-polls only when explicitly enabled and never requires webhook ingress.
- Missing token or allowlist fails startup before adapter start when Telegram is enabled.
- Allowlisted Telegram messages ingest into `stimulus_inbox` and duplicate `update_id` replay does not create duplicate queued rows.
Tasks:
- **T-F0005-08:** Implement the Telegram adapter with long polling, explicit config activation and allowlist filtering. Covers: AC-F0005-01, AC-F0005-02, AC-F0005-05.
- **T-F0005-09:** Add fake-Bot-API-backed integration coverage plus the manual live-check contract for a real bot token in `.env.local`. Covers: AC-F0005-02, AC-F0005-05.

### Slice SL-F0005-04: Scheduler, filesystem, and resource adapters
Delivers: the remaining first-wave internal sources on top of the same perception kernel and source-local health/degradation behavior.
Covers: AC-F0005-01, AC-F0005-02, AC-F0005-03, AC-F0005-05
Verification: `integration`
Exit criteria:
- Scheduler, filesystem and resource signals all ingest through the same normalized path.
- The default filesystem allowlist is fixed to `workspace/body`, `workspace/skills`, `data/datasets`, `data/reports` and `data/snapshots`.
- Resource/file bursts are collapsed before tick handoff and a single failing adapter never crashes `core`.
Tasks:
- **T-F0005-10:** Implement the in-process scheduler adapter against existing runtime/scheduler hooks, not a new jobs topology. Covers: AC-F0005-02, AC-F0005-05.
- **T-F0005-11:** Implement the filesystem adapter with the fixed broad runtime allowlist and self-feedback protection. Covers: AC-F0005-02, AC-F0005-03.
- **T-F0005-12:** Implement the resource adapter as a coarse pressure-source adapter with bounded sampling and source-local health. Covers: AC-F0005-02, AC-F0005-03, AC-F0005-05.

### Slice SL-F0005-05: Recovery, replay safety, and purge semantics
Delivers: restart-safe claim release, replay-safe dedupe and the full terminal status model required for a purgeable technical intake layer.
Covers: AC-F0005-03, AC-F0005-05, AC-F0005-06
Verification: `integration`
Exit criteria:
- Stale-tick reclaim releases claimed stimuli before the next batch build.
- Telegram poll replay and noisy source retries remain deduplicated after restart.
- Only `consumed` and `dropped` rows become purge-eligible; `queued` and `claimed` rows stay protected.
Tasks:
- **T-F0005-13:** Wire stale-tick reclaim and runtime restart paths to `releaseClaimedStimuli(...)` before the next batch build. Covers: AC-F0005-06.
- **T-F0005-14:** Finalize replay-safe dedupe and terminal status transitions for Telegram/file/resource bursts and rejection paths. Covers: AC-F0005-03, AC-F0005-05, AC-F0005-06.

### Slice SL-F0005-06: Deployment-cell smoke and acceptance consolidation
Delivers: deployment-cell proof for HTTP ingress, Telegram ingress and canonical reactive handoff, plus final AC-linked verification closure.
Covers: AC-F0005-02, AC-F0005-04, AC-F0005-05, AC-F0005-06
Verification: `smoke`, `integration`
Exit criteria:
- `pnpm smoke:cell` proves HTTP ingest, fake-Bot-API-backed Telegram ingest and reactive handoff inside the delivered deployment cell shape.
- The Telegram smoke path uses a smoke-only compose override and does not add a permanent service to the delivered baseline cell.
- All planned AC-linked test suites exist and the dossier can move from `planned` to `done`.
Tasks:
- **T-F0005-15:** Add the smoke-only compose override for `fake-telegram-api` and wire the containerized Telegram smoke path. Covers: AC-F0005-02, AC-F0005-05.
- **T-F0005-16:** Add or complete the AC-linked integration and smoke suites needed to close `F-0005`. Covers: AC-F0005-01, AC-F0005-02, AC-F0005-03, AC-F0005-04, AC-F0005-05, AC-F0005-06.

## 8. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0005-01 | `apps/core/test/perception/lifecycle.integration.test.ts` → `test("AC-F0005-01 starts, stops and restarts real sensor adapters only under runtime lifecycle control")` | done |
| AC-F0005-02 | `apps/core/test/perception/ingest.integration.test.ts` → `test("AC-F0005-02 normalizes ingest and adapter signals into the canonical perception intake layer")`; `apps/core/test/perception/adapter-paths.integration.test.ts` → `test("AC-F0005-02 normalizes filesystem adapter events into the canonical perception intake layer")`; `apps/core/test/perception/adapter-paths.integration.test.ts` → `test("AC-F0005-02 normalizes scheduler runtime-hook signals into the canonical perception intake layer")`; `apps/core/test/perception/adapter-paths.integration.test.ts` → `test("AC-F0005-02 normalizes resource adapter pressure signals into the canonical perception intake layer")`; `apps/core/test/perception/telegram-adapter.integration.test.ts` → `test("AC-F0005-02 normalizes Telegram long-poll updates into the canonical perception intake layer")`; `apps/core/test/platform/core-runtime.test.ts` → `test("AC-F0005-02 exposes POST /ingest through the runtime boundary and returns canonical admission metadata")`; smoke in `infra/docker/deployment-cell.smoke.ts` → `test("AC-F0005-02 accepts POST /ingest inside the deployment cell and reuses the canonical reactive handoff")`; smoke in `infra/docker/deployment-cell.smoke.ts` → `test("AC-F0005-02 ingests a Telegram update from a fake Bot API inside the deployment cell")` | done |
| AC-F0005-03 | `apps/core/test/perception/batching.integration.test.ts` → `test("AC-F0005-03 builds a bounded deterministic perception batch with coalescing and claim semantics")`; `packages/db/test/perception-store.integration.test.ts` → `test("AC-F0005-03 stores and orders queued stimuli deterministically inside stimulus_inbox")` | done |
| AC-F0005-04 | `apps/core/test/perception/batching.integration.test.ts` → `test("AC-F0005-04 reuses only the canonical reactive requestTick path for urgent stimuli")`; `apps/core/test/perception/batching.integration.test.ts` → `test("AC-F0005-04 requests a reactive tick when a queued duplicate is upgraded to urgent")` | done |
| AC-F0005-05 | `apps/core/test/perception/adapter-failure.integration.test.ts` → `test("AC-F0005-05 degrades failing adapter sources without crashing core")`; `apps/core/test/perception/telegram-config.integration.test.ts` → `test("AC-F0005-05 validates Telegram secrets and allowlist before enabling the adapter")`; `infra/docker/test/perception-local-secrets.contract.test.ts` → `test("AC-F0005-05 forwards YAAGI_TELEGRAM_* variables through the canonical local compose path")` | done |
| AC-F0005-06 | `packages/db/test/perception-store.integration.test.ts` → `test("AC-F0005-06 consumes or releases claimed stimuli atomically with tick finalization and stale reclaim")` | done |

План верификации:

- Fast path: integration coverage around lifecycle control, normalization, queue policy, urgent handoff, restart-safe claim/release and adapter degradation.
- Smoke path: containerized `POST /ingest`, fake-Bot-API-backed Telegram ingress and urgent `reactive` handoff inside the canonical deployment cell.
- Supplemental verification: architecture/ADR alignment for the canonical perception intake contract and existing runtime boundary.

## 9. Decision log (ADR blocks)

### ADR-F0005-01: Telegram belongs to the first delivered adapter set but stays config-gated
- Status: Accepted
- Context: Telegram является важным операторским каналом связи с Polyphony; оставлять его follow-on extension означало бы, что первая perception implementation wave не покрывает один из practically important ingress paths.
- Decision: Первая delivered implementation wave обязана покрыть `system`, `scheduler`, `http`, `file`, `resource` и working `telegram` adapter; при этом Telegram activation остаётся явным config choice, а не unconditional startup prerequisite для каждого локального окружения.
- Alternatives: Оставить `telegram` optional follow-on source; сделать Telegram always-on без explicit activation.
- Consequences: Plan-slice обязан включить Telegram adapter, config contract и verification; локальные и CI-like окружения без bot token могут запускать `core` только при явном `YAAGI_TELEGRAM_ENABLED=false`, но отсутствие реализации Telegram уже не считается допустимым first-wave gap.

### ADR-F0005-02: Telegram sensor uses long polling and repo-root `.env.local` secret injection
- Status: Accepted
- Context: Canonical deployment cell не предполагает отдельный public webhook ingress, а CI/smoke path не должен зависеть от live Telegram Bot API или реального bot token.
- Decision: `telegram-adapter` первой реализации использует Bot API long polling; repo-root `.env.local` становится canonical local secret file для `YAAGI_TELEGRAM_*`, checked-in shape живёт в `.env.example`, canonical local-secret launch paths фиксируются как `pnpm cell:up:local` и `pnpm smoke:cell:local`, application code продолжает читать `process.env`, а fake Bot API testing uses a smoke-only compose override service plus `YAAGI_TELEGRAM_API_BASE_URL` override.
- Alternatives: Строить первую реализацию на webhook callbacks; читать `.env.local` через framework-specific in-process loader; тестировать только против живого Telegram.
- Consequences: Telegram sensor остаётся совместимым с local/dev deployment cell without public ingress, tests stay deterministic, а implementation обязана поддержать injectable Bot API base URL, allowlist filtering, offset-safe polling и smoke-only compose override for the fake Bot API path.

## 10. Progress & links

- Status: `proposed` → `shaped` → `planned` → `done`
- Issue: -
- PRs:
  - -
- Code:
  - `packages/contracts/src/perception.ts`
  - `packages/db/src/perception.ts`
  - `packages/db/src/runtime.ts`
  - `infra/migrations/004_perception_intake.sql`
  - `apps/core/src/perception/*`
  - `apps/core/src/runtime/runtime-lifecycle.ts`
  - `apps/core/src/platform/core-config.ts`
  - `apps/core/src/platform/core-runtime.ts`
  - `infra/docker/compose.smoke-telegram.yaml`
  - `infra/docker/fake-telegram-api/server.py`
  - `infra/docker/deployment-cell.smoke.ts`

## 11. Change log

- **v1.0 (2026-03-23):** Initial dossier created from candidate `CF-004`; intake fixed ownership for unified sensor adapters, the bounded perception buffer and canonical stimulus intake, while keeping Context Builder, operator API and cognition/execution seams explicitly out of scope.
- **v1.1 (2026-03-23):** `spec-compact` refined the perception/runtime contract: fixed the first delivered adapter set, aligned `SensorSignal` ↔ `StimulusEnvelope` through a repo-level ADR, specified `stimulus_inbox` + bounded buffer semantics, added claim/release recovery rules, and reserved smoke verification for ingest/reactive-handoff behavior in the canonical deployment cell.
- **v1.2 (2026-03-23):** `spec-compact` realignment moved Telegram from optional taxonomy-only source into the required first delivered adapter set, fixed long-poll testing and fake-Bot-API smoke strategy, and bound local Telegram secrets to repo-root `.env.local` / `.env.example` without introducing an in-process secret loader.
- **v1.3 (2026-03-23):** `plan-slice` decomposed `F-0005` into six delivery slices covering the perception contracts/storage substrate, the generic kernel and HTTP/system ingress, the Telegram-first operator milestone, the remaining internal adapters, replay/recovery hardening and deployment-cell smoke closure.
- **v1.4 (2026-03-23):** Реализация закрыла все slices `F-0005`: добавлены `@yaagi/contracts/perception`, миграция `stimulus_inbox`, SQL-backed perception store, lifecycle-managed controller/adapters, `POST /ingest`, Telegram long polling с allowlist/dedupe, filesystem/resource/scheduler adapters, terminal consume/release semantics, fake-Bot-API-backed smoke override и AC-linked fast/smoke verification.
- **v1.5 (2026-03-23):** После полного независимого ревью verification surface был усилен без сужения scope: добавлены реальные adapter-path tests для `filesystem`, `scheduler` и `resource`, lifecycle-тест теперь доказывает stop/restart без dangling watchers/pollers, а `resource-adapter` сбрасывает internal severity state на stop/restart для корректного recovery поведения.
- **v1.6 (2026-03-23):** После повторного full-scope review устранены скрытые implementation gaps: queued urgent duplicate теперь повторно использует canonical reactive handoff, local `.env.local` Telegram contract реально прокинут в compose-based runtime path, а `scheduler-adapter` переведён с synthetic heartbeat на existing runtime scheduler hook seam.
- **v1.7 (2026-03-23):** `F-0007` realigned verification ownership: container smoke retained только HTTP/Telegram ingest and reactive handoff inside the deployment cell, а restart-safe queued/claimed stimulus behavior был явно закреплён за fast integration surface (`packages/db/test/perception-store.integration.test.ts`).
- **v1.8 (2026-03-25):** `change-proposal`: aligned the perception dossier with the repo-level AI SDK substrate by replacing the old Mastra-specific cognition reference in scope boundaries. `F-0005` remains `done`, because its ingress/buffer ownership and verification surface are otherwise unchanged.
