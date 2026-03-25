---
id: F-0008
title: Базовый маршрутизатор моделей и профили органов
status: done
coverage_gate: strict
owners: ["@codex"]
area: models
depends_on: [F-0002, F-0003]
impacts: [runtime, db, models, cognition]
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
    - "docs/adr/ADR-2026-03-19-boot-dependency-contract.md"
    - "docs/adr/ADR-2026-03-19-phase0-runtime-boundary.md"
---

# F-0008 Базовый маршрутизатор моделей и профили органов

## 1. Context & Goal

- **User problem:** После `F-0002` и `F-0003` у системы есть канонический runtime и первый локальный model dependency, но всё ещё нет явного владельца для organ/profile selection. Если этот seam не оформить отдельно, phase-1 различие `reactive` / `deliberative` / `contemplative` либо скатится в hardcoded model strings внутри runtime, либо начнёт неявно жить внутри будущего Context Builder или decision harness, что противоречит архитектуре.
- **Goal (what success means):** В репозитории появляется канонический owner для baseline model routing: profiles `reflex`, `deliberation` и `reflection` получают явный локальный runtime contract, router детерминированно выбирает их по bounded input hints, а active tick continuity фиксирует выбранный `model_profile_id` без раннего втягивания phase-2 model ecology и operator API.
- **Current phase baseline:** На момент `spec-compact` уже delivered `F-0001`-`F-0007`; boot required dependency set по ADR остаётся `postgres + model-fast`, а `F-0003` по-прежнему допускает end-to-end только `wake` и `reactive` ticks. В этой фазе `F-0008` shaped как routing/continuity seam для baseline organs, а не как полная поставка deliberative/contemplative execution path.
- **Non-goals:** Полный `model_registry` phase 2 с `code` / `embedding` / `reranker` / `classifier` / `safety`, external consultants, `/models` operator API, Context Builder, Mastra Decision Agent, training/eval/promotion pipeline и workshop governance не входят в этот intake.

## 2. Scope

### In scope

- Канонический runtime boundary для baseline organ profiles `reflex`, `deliberation` и `reflection`.
- Minimal `model_registry` / profile-store slice, достаточный для локально зарегистрированных baseline profiles и их routing metadata.
- Детерминированный `ModelRouter` contract, который принимает bounded hints (`tick mode`, `task kind`, `latency budget`, `risk`, `context size`, `required capabilities`, `organ health`, `last eval score`) и выбирает baseline profile либо возвращает structured refusal.
- Явная policy для `reflection`: либо отдельный active profile, либо explicit adapter-over-deliberation path, зафиксированный в registry/selection contract.
- Интеграция routing result с текущим tick/runtime continuity contract: запись `selected_model_profile_id` в tick lifecycle и синхронизация `agent_state.current_model_profile_id` для active tick.
- Baseline diagnostics/eligibility surface для локальных profiles через internal runtime contract и существующий health payload без открытия нового operator API.

### Out of scope

- Расширенная local model ecology (`vllm-deep`, `vllm-pool`, embeddings, reranking, classifier/safety, richer health checks organs); этим владеет `CF-010`.
- Context Builder, Mastra Decision Agent, structured decision validation и end-to-end deliberative/contemplative cognition; этим владеет `CF-017` и последующие cognitive seams.
- Executive/tool gateway, review requests, action execution и job dispatch.
- Operator-facing `/models`, control routes, richer introspection API и human-governed consultant policies.
- Training/eval/dataset/promotion flow и любые workshop/governance decisions поверх model profiles.
- Изменение tick admission matrix из `F-0003`: router shape не должен сам по себе превращать недоставленные tick kinds в end-to-end исполняемый runtime path.
- Generic cognition ownership or direct writes into `psm_json`, goals/beliefs, narrative/memetic surfaces or governor-owned proposal tables.

### Constraints

- Реализация должна оставаться на canonical phase-0/1 substrate `TypeScript + Mastra + Hono + PostgreSQL + local model services`; никакой альтернативный routing runtime или отдельный model broker не допускается.
- `constitution.yaml` и boot preflight остаются единственным источником истины для required startup dependencies; `F-0008` не имеет права молча сделать `model-deep` или `model-pool` обязательным до отдельных platform/model seams.
- Router selection должна быть детерминированной и объяснимой; скрытые fallback paths запрещены, кроме явно зафиксированного reflection-as-adapter-over-deliberation варианта.
- Unsupported roles и unavailable/unhealthy profiles должны давать explicit structured refusal, а не remap в другой organ "по умолчанию".
- Seam не должен quietly втянуть в себя ownership над Context Builder, narrative/memetic reasoning или operator API под предлогом "чтобы роутинг работал".
- Identity-bearing write authority matrix в `docs/architecture/system.md` ограничивает `F-0008` baseline profile and continuity surfaces: router may register profiles and commit active-profile continuity only through the `F-0003` transaction boundary, but it may not bypass runtime admission or mutate subject-state/core identity tables.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0008-01:** В runtime существует один канонический profile-store/router contract для baseline local organs, а код тикового runtime и cognition seams больше не выбирает модели через hardcoded endpoint/model string; baseline registry slice хранит для каждого delivered profile как минимум `model_profile_id`, `role`, `endpoint`, `base_model`, `adapter_of|null`, `capabilities_json`, `health_json` и `status`.
- **AC-F0008-02:** Delivered baseline profile set включает как минимум один active `reflex` profile и один active `deliberation` profile; `reflection` реализован либо как отдельный active profile, либо как explicit `adapter-over-deliberation` mapping, зафиксированный в profile-store так, чтобы contemplative routing path не зависел от неявного fallback.
- **AC-F0008-03:** `ModelRouter.selectProfile(...)` принимает bounded routing input для canonical modes `reactive`, `deliberative` и `contemplative`, детерминированно учитывает `task_kind`, `latency_budget`, `risk_level`, `context_size`, `required_capabilities`, baseline `organ_health` и optional `last_eval_score`, и возвращает selection result с `model_profile_id`, `role` и `selection_reason`; router contract не расширяет сам по себе tick admission matrix из `F-0003`.
- **AC-F0008-04:** Когда runtime или bounded cognitive harness запрашивает organ selection для активного тика, выбранный `model_profile_id` сохраняется в owning tick row и синхронизируется в `agent_state.current_model_profile_id` на время active tick, так что restart/reclaim path может восстановить, какой baseline organ был выбран последним.
- **AC-F0008-05:** Запрос роли вне delivered baseline set (`code`, `embedding`, `reranker`, `classifier`, `safety`, `external_consultant`) или выбор unavailable/unhealthy profile завершается structured refusal (`unsupported_role`, `profile_unavailable` или `profile_unhealthy`) без silent remap; единственное допустимое исключение из этого правила описано в `AC-F0008-02` для explicit reflection adapter path.
- **AC-F0008-06:** Baseline model routing surface публикует internal diagnostics и обогащает существующий health payload данными о локально зарегистрированных baseline profiles (`model_profile_id`, `role`, `status`, `eligibility/health summary`), не открывая отдельный `/models` API и не меняя required boot dependencies beyond constitution manifest.

## 4. Non-functional requirements (NFR)

- **Determinism:** Один и тот же routing input и одинаковое состояние baseline profiles должны приводить к одному и тому же selection result.
- **Phase discipline:** Baseline router не должен маскировать недоставленную phase-2 model ecology, workshop pipeline или operator API.
- **Recoverability:** После restart/reclaim runtime должен иметь durable след о выбранном `model_profile_id`, а не полагаться на process-local state.
- **Observability:** По health/diagnostic surface должно быть видно, какие baseline organs зарегистрированы, доступны и почему router их выбрал или отклонил.
- **Extensibility:** Baseline contract должен расширяться до richer `model_registry`/health/eval semantics без переписывания уже delivered runtime boundary.

## 5. Design (compact)

### 5.1 Runtime surface

- Публичная HTTP surface этой фичи не расширяется; допускается только enrichment существующего `GET /health`, а не новый operator-facing `/models`.
- `F-0002` остаётся владельцем delivered local model substrate и env/deployment contract.
- `F-0003` остаётся владельцем tick lifecycle, lease discipline и terminal cleanup; `F-0008` даёт ему только organ/profile selection boundary и continuity metadata.
- `CF-017` позже станет главным caller-ом router contract для full cognitive harness, но baseline runtime должен уметь вызывать router и без зрелого Context Builder.
- Cross-cutting owner map for identity-bearing writes lives in `docs/architecture/system.md`: `F-0008` owns baseline profile registration plus profile-specific continuity metadata, while runtime admission stays in `F-0003`, platform health stays in `F-0002`, and subject-state ownership remains in `F-0004`.
- Repo-level router invariants now live in subsection `Baseline Router Invariants` in `docs/architecture/system.md`. They elevate only the delivered baseline facts: roles `reflex` / `deliberation` / `reflection`, explicit-only reflection path, separation of selection from admission, structured refusal and health-surface enrichment.
- Current shaped runtime boundary deliberately separates `selection` from `admission`:
  - `reactive` is the first end-to-end caller in the early runtime;
  - `deliberative` / `contemplative` selection must be callable and testable now, but their full tick execution path remains gated by later cognition seams and by explicit realignment of `F-0003`.
- Compact internal contract:

```ts
type BaselineTickMode = "reactive" | "deliberative" | "contemplative";

type BaselineModelRole = "reflex" | "deliberation" | "reflection";

type RoutingInput = {
  tickMode: BaselineTickMode;
  taskKind: string;
  latencyBudget: "tight" | "normal" | "extended";
  riskLevel: "low" | "medium" | "high";
  contextSize: number;
  requiredCapabilities?: string[];
  lastEvalScore?: number | null;
};

type BaselineProfile = {
  modelProfileId: string;
  role: BaselineModelRole;
  endpoint: string;
  baseModel: string;
  adapterOf: string | null;
  capabilities: string[];
  status: "active" | "degraded" | "disabled";
  healthSummary: {
    healthy: boolean;
    detail?: string;
  };
};

type RoutingSelection =
  | {
      accepted: true;
      modelProfileId: string;
      role: BaselineModelRole;
      endpoint: string;
      adapterOf: string | null;
      selectionReason: {
        tickMode: BaselineTickMode;
        taskKind: string;
        latencyBudget: string;
        riskLevel: string;
        requiredCapabilities: string[];
      };
    }
  | {
      accepted: false;
      reason:
        | "unsupported_role"
        | "profile_unavailable"
        | "profile_unhealthy";
      detail: string;
    };

interface ModelRouter {
  ensureBaselineProfiles(): Promise<void>;
  selectProfile(input: RoutingInput): Promise<RoutingSelection>;
  getBaselineDiagnostics(): Promise<BaselineProfile[]>;
}
```

- Baseline routing expectations for the first implementation:
  - `reactive` routes to `reflex`;
  - `deliberative` routes to `deliberation`;
  - `contemplative` routes to `reflection` or to an explicit adapter-over-deliberation profile, if and only if such mapping is recorded in the profile store.
- Repo-level vs feature-local contract:
  - repo-level: baseline roles, explicit reflection rule, structured refusal, separation `selection != admission`, router diagnostics enrich the existing health surface;
  - feature-local: deterministic selection matrix details, continuity persistence mechanics, health-summary reuse rules and the exact fast/smoke verification map for the delivered baseline router.
- Router input может обогащаться по мере появления `CF-017`, `CF-005` и `CF-010`, но baseline contract не должен ломать already persisted routing evidence.

### 5.2 Data model changes

- Feature берёт ownership над minimal runtime use of `model_registry` из архитектуры; если baseline bootstrap ещё не materialize-ит эту таблицу, `F-0008` должен ввести минимальный schema slice для:
  - `model_profile_id text primary key`;
  - `role text not null check (role in ('reflex', 'deliberation', 'reflection', 'code', 'embedding', 'reranker', 'classifier', 'safety'))`;
  - `endpoint text not null`;
  - `artifact_uri text`;
  - `base_model text not null`;
  - `adapter_of text references polyphony_runtime.model_registry(model_profile_id) on delete set null`;
  - `capabilities_json jsonb not null default '[]'::jsonb`;
  - `cost_json jsonb not null default '{}'::jsonb`;
  - `health_json jsonb not null default '{}'::jsonb`;
  - `status text not null default 'active'`.
- Required baseline indexes:
  - `model_registry_role_status_idx` on `(role, status)`;
  - `model_registry_status_idx` on `(status, model_profile_id)`.
- `ticks.selected_model_profile_id` перестаёт быть всегда `null` и начинает заполняться после успешного router selection.
- `agent_state.current_model_profile_id` остаётся canonical active pointer для текущего тика и обновляется через тот же transactional boundary, в котором runtime фиксирует active tick ownership.
- Permitted writes for this seam are limited to baseline profile registration (`model_registry`) and model-profile continuity metadata (`ticks.selected_model_profile_id`, `agent_state.current_model_profile_id`) committed through the runtime continuity boundary.
- Forbidden writes for this seam:
  - tick admission, lease ownership and terminal lifecycle fields outside the `F-0003` runtime boundary;
  - `psm_json`, goals/beliefs, entities/relationships and future narrative/memetic surfaces;
  - governor- or executive-owned proposal and action surfaces.
- Если structured selection reason нужно сохранять durably, baseline implementation должна использовать существующее tick continuity payload/metadata поле, а не вводить operator-facing shadow store.

### 5.3 UI changes (if any)

- Не применимо.

### 5.4 Edge cases

- `reflection` requested, но отдельного reflection profile нет: допустим только explicit adapter-over-deliberation path.
- `reflex` и `deliberation` используют один и тот же underlying endpoint, но разные profiles/adapters и разные routing limits.
- Profile помечен `active`, но `health_json` говорит, что endpoint временно unhealthy.
- Caller пытается запросить `code` или `embedding` role до `CF-010`.
- Runtime работает в degraded startup mode, где baseline `reflex` жив, а `deliberation` временно unavailable.

### 5.5 Failure modes and recovery boundaries

- Missing baseline profile seed: `ensureBaselineProfiles()` завершается fail-fast ошибкой и не оставляет runtime в состоянии "роутинг как-нибудь выберет что-то сам".
- Unhealthy profile drift: router не должен возвращать selection для profile, который health/status contract считает ineligible.
- Crash after selection, before terminal tick outcome: durable `selected_model_profile_id` в tick row и `agent_state.current_model_profile_id` должны позволить `F-0003` reclaim path восстановить, что именно было выбрано перед аварией.
- Dependency drift: если boot constitution не считает новый local model dependency delivered, baseline router не имеет права silently требовать его availability на старте.
- Unsupported role pressure: попытки использовать late-phase roles должны surface-иться как explicit refusal и backlog/dossier alignment signal, а не как implicit expansion of scope.

### 5.6 Verification surface

- Fast path:
  - integration tests для baseline profile seeding/registry load;
  - contract tests для deterministic selection matrix `reactive -> reflex`, `deliberative -> deliberation`, `contemplative -> reflection|explicit-adapter`;
  - integration tests для structured refusal on unsupported/unhealthy/unavailable profiles;
  - integration tests для persistence of `selected_model_profile_id` and `agent_state.current_model_profile_id`;
  - boot/runtime integration tests, подтверждающие, что required dependency set не расширяется beyond constitution manifest.
- Containerized smoke path:
  - canonical local deployment cell должен стартовать с baseline routing surface внутри `core + postgres + local model service`;
  - smoke должен подтверждать, что `GET /health` показывает baseline profile diagnostics без нового `/models` API;
  - smoke должен подтверждать, что runtime может сделать baseline `reflex` selection against delivered local model substrate без drift between in-memory and container paths.
- Manual/operator surface:
  - inspection через `GET /health`, logs и `model_registry` rows достаточна до поставки `CF-009`.

## 6. Definition of Done

- Новый dossier явно фиксирует ownership boundaries между `F-0008`, `F-0002`, `F-0003`, `CF-017` и `CF-010`.
- AC-F0008-* покрывают baseline profiles, explicit reflection path, deterministic selection, continuity persistence, refusal semantics и diagnostics without API/dependency creep.
- Backlog candidate `CF-006` переведён в `intaken`, а `docs/ssot/index.md` синхронизирован с новым dossier.
- Implementation plan для этой фичи обязан включать и fast verification path, и containerized smoke path, потому что seam меняет runtime/dependency behavior.
- Intake явно фиксирует, что `code` / `embedding` / `reranker` / `classifier` / `safety` и external consultants остаются вне scope до отдельных feature lines.
- До реализации continuity write-path должен быть оформлен явный `change-proposal` / dossier realignment для `F-0003`, потому что текущий done-dossier ещё фиксирует `selected_model_profile_id` как `null` в delivered baseline.

## 7. Slicing plan (2–6 increments)

### Slice SL-F0008-01: Baseline profile store and seed contract
Delivers: minimal `model_registry` slice and delivered baseline local profiles for `reflex`, `deliberation` and `reflection|adapter`.
Covers: AC-F0008-01, AC-F0008-02
Verification: `integration`
Exit criteria:
- Runtime can ensure and load baseline profiles without hardcoded model strings in callers.
- Reflection path is explicit in registry data, not implicit in selection code.
Tasks:
- **T-F0008-01:** Materialize the minimal baseline `model_registry` slice or align existing schema to the canonical runtime contract. Covers: AC-F0008-01.
- **T-F0008-02:** Seed and validate baseline `reflex`, `deliberation` and `reflection|adapter` profiles. Covers: AC-F0008-02.

### Slice SL-F0008-02: Deterministic baseline router
Delivers: `ModelRouter.selectProfile(...)` with explicit selection matrix and refusal reasons.
Covers: AC-F0008-03, AC-F0008-05
Verification: `contract`, `integration`
Exit criteria:
- `reactive`, `deliberative` and `contemplative` inputs produce deterministic baseline routing decisions.
- Unsupported or unavailable roles fail explicitly without hidden remap.
Tasks:
- **T-F0008-03:** Implement deterministic baseline routing inputs and selection reason output. Covers: AC-F0008-03.
- **T-F0008-04:** Implement structured refusal semantics for unsupported/unhealthy/unavailable roles. Covers: AC-F0008-05.

### Slice SL-F0008-03: Runtime continuity integration
Delivers: persistence of selected profile into tick/runtime continuity surfaces.
Covers: AC-F0008-04
Verification: `integration`
Exit criteria:
- Active tick stores the chosen `model_profile_id`.
- `agent_state.current_model_profile_id` tracks the active selection and survives restart/reclaim inspection.
- Required realignment of `F-0003` is explicit before implementation mutates delivered continuity assumptions.
Tasks:
- **T-F0008-05:** Wire router selection into active tick lifecycle and persist `ticks.selected_model_profile_id`. Covers: AC-F0008-04.
- **T-F0008-06:** Synchronize `agent_state.current_model_profile_id` with active tick ownership and reclaim semantics. Covers: AC-F0008-04.
- **T-F0008-07:** Apply a `change-proposal` to `F-0003`, replacing the delivered assumption that `selected_model_profile_id` always stays `null` before router integration lands. Covers: SL-F0008-03.

### Slice SL-F0008-04: Diagnostics and phase-boundary verification
Delivers: baseline diagnostics surface and verification that routing seam does not expand startup/API boundaries.
Covers: AC-F0008-06
Verification: `integration`, `smoke`
Exit criteria:
- Existing health payload surfaces baseline profile diagnostics.
- Containerized runtime proves the baseline routing seam against the canonical local model substrate without new public API.
Tasks:
- **T-F0008-08:** Add baseline routing diagnostics to the existing health/internal diagnostics surface. Covers: AC-F0008-06.
- **T-F0008-09:** Add fast and smoke verification proving no boot dependency creep and no `/models` API expansion. Covers: AC-F0008-06.

## 8. Suggested issue titles

- `F-0008 / SL-F0008-01 Baseline profile store and seed contract` -> [SL-F0008-01](#slice-sl-f0008-01-baseline-profile-store-and-seed-contract)
- `F-0008 / SL-F0008-02 Deterministic baseline router` -> [SL-F0008-02](#slice-sl-f0008-02-deterministic-baseline-router)
- `F-0008 / SL-F0008-03 Runtime continuity integration` -> [SL-F0008-03](#slice-sl-f0008-03-runtime-continuity-integration)
- `F-0008 / SL-F0008-04 Diagnostics and phase-boundary verification` -> [SL-F0008-04](#slice-sl-f0008-04-diagnostics-and-phase-boundary-verification)

## 9. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0008-01 | `apps/core/test/models/model-router.integration.test.ts` -> `test("AC-F0008-01 loads baseline profiles from the canonical profile store")`; `test("AC-F0008-01 rolls back baseline profile seeding on partial failure")` | done |
| AC-F0008-02 | `apps/core/test/models/model-router.integration.test.ts` -> `test("AC-F0008-02 keeps reflection as an explicit profile or adapter-over-deliberation mapping")` | done |
| AC-F0008-03 | `apps/core/test/models/model-router.contract.test.ts` -> `test("AC-F0008-03 selects baseline profiles deterministically for reactive, deliberative and contemplative modes")` | done |
| AC-F0008-04 | `apps/core/test/runtime/tick-model-selection.integration.test.ts` -> `test("AC-F0008-04 persists selected_model_profile_id and current_model_profile_id for the active tick")` | done |
| AC-F0008-05 | `apps/core/test/models/model-router.contract.test.ts` -> `test("AC-F0008-05 rejects unsupported or unavailable roles without silent fallback")` | done |
| AC-F0008-06 | `apps/core/test/models/model-router.contract.test.ts` -> `test("AC-F0008-06 reuses caller-provided health summaries without re-probing baseline dependencies")`; `apps/core/test/runtime/health.integration.test.ts` -> `test("AC-F0008-06 surfaces baseline profile diagnostics without opening a models API")`; supplemental deployment check in `infra/docker/deployment-cell.smoke.ts` -> `test("AC-F0008-06 surfaces baseline model-routing diagnostics without opening a /models API in the deployment cell")` | done |

План тестов:

- Contract tests для baseline routing matrix и refusal reasons.
- Integration tests для registry seed/load, active tick continuity и health diagnostics.
- Boot/runtime regression tests, подтверждающие отсутствие расширения required dependency set beyond constitution manifest.
- Containerized smoke path against the canonical local deployment cell, чтобы проверить router/profile seam на реальном substrate, а не только в in-memory harness.
- Cross-cutting ownership dependencies:
  - `F-0008` consumes the `F-0003` runtime continuity boundary to persist `selected_model_profile_id` and `current_model_profile_id` without inheriting runtime admission ownership.
  - `F-0008` consumes the platform health surface from `F-0002` and only enriches it with router diagnostics; it does not become the owner of `GET /health`.
  - `Baseline Router Invariants` in `docs/architecture/system.md` now carry the minimal repo-level contract, while the detailed routing policy and proofs remain feature-local to `F-0008`.

## 10. Decision log (ADR blocks)

### ADR-F0008-01: `reflection` может быть отдельным profile или explicit adapter-over-deliberation, но не скрытым fallback
- Status: Accepted
- Context: Архитектура допускает `reflection` как отдельный profile или как adapter-over-deliberation. Без явной границы реализация почти наверняка превратит contemplative path в неявный remap на `deliberation`, и этот drift будет трудно отличить от осознанной политики.
- Decision: `reflection` считается delivered только в одном из двух явно описанных видов: отдельный active profile в profile store либо explicit adapter-over-deliberation entry с собственным `model_profile_id` и `adapter_of`. Hidden fallback from `contemplative` to plain `deliberation` без такой записи запрещён.
- Alternatives: Всегда требовать отдельный reflection profile; всегда silently reuse `deliberation`.
- Consequences: Contemplative routing получает предсказуемую и наблюдаемую semantics уже в baseline phase; позднее можно заменить adapter path на отдельный profile без переписывания caller contracts.

### ADR-F0008-02: Baseline routing seam не расширяет boot dependency set и не открывает `/models` API
- Status: Accepted
- Context: После `F-0002` и `F-0003` легко сделать router "настоящим" за счёт преждевременного требования `model-deep`/`model-pool` или открытия operator `/models`, но это нарушает текущие phase-0 ADR boundaries.
- Decision: `F-0008` работает только поверх уже delivered local model substrate и constitution-driven boot dependencies; он может enrich-ить существующий `GET /health`, но не вводит новый operator-facing API. Расширение dependency set и public model management surface остаётся за `CF-009`/`CF-010`.
- Alternatives: Сразу добавить `/models` и richer local ecology; оставить router полностью внутренним без diagnostics.
- Consequences: Intake остаётся совместимым с текущим deployment cell и не ломает порядок backbone delivery, но всё ещё даёт оператору минимальную наблюдаемость за baseline organs.

## 11. Progress & links

- Status: `proposed` -> `shaped` -> `done`
- Issue: -
- PRs:
  - -
- Code:
  - `apps/core/src/platform/core-runtime.ts`
  - `apps/core/src/runtime/index.ts`
  - `apps/core/src/runtime/model-router.ts`
  - `apps/core/src/runtime/runtime-lifecycle.ts`
  - `apps/core/test/models/model-router.contract.test.ts`
  - `apps/core/test/models/model-router.integration.test.ts`
  - `apps/core/test/runtime/health.integration.test.ts`
  - `apps/core/test/runtime/tick-model-selection.integration.test.ts`
  - `infra/docker/deployment-cell.smoke.ts`
  - `infra/migrations/005_model_registry.sql`
  - `packages/db/src/index.ts`
  - `packages/db/src/model-routing.ts`
  - `packages/db/src/runtime.ts`
  - `packages/db/test/subject-state-restart.integration.test.ts`
  - `packages/db/testing/subject-state-db-harness.ts`
- Verification:
  - `pnpm format`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm smoke:cell`
  - `node scripts/sync-index.mjs`
  - `node scripts/lint-dossiers.mjs`
  - `node scripts/coverage-audit.mjs --dossier docs/features/F-0008-baseline-model-router-and-organ-profiles.md`
  - `pnpm debt:audit:changed`
  - `pnpm debt:audit`

## 12. Change log

- **v1.0 (2026-03-23):** Initial dossier created from `CF-006` intake with explicit baseline scope for `reflex` / `deliberation` / `reflection`, runtime continuity hooks and phase-boundary constraints.
- **v1.1 (2026-03-23):** Promoted dossier to `shaped`, made the current phase baseline explicit, accepted the local ADR forks, and added required `F-0003` realignment before continuity integration.
- **v1.2 (2026-03-24):** Closed the `plan-slice` step with a justified alternative status: the dossier now carries the validated four-slice delivery order, explicit verification artifacts and the required `F-0003` realignment task, while frontmatter stays `shaped` because repo coverage policy treats `planned` dossiers as blocking until AC-linked tests exist.
- **v1.3 (2026-03-24):** Completed `implementation`: added the baseline `model_registry` schema/store, seeded `reflex` / `deliberation` / explicit `reflection` adapter profiles, introduced deterministic phase-0 model routing with structured refusals, persisted `selected_model_profile_id` plus active `current_model_profile_id` through the tick continuity boundary, enriched `GET /health` with baseline routing diagnostics without opening `/models`, and closed both fast-path and containerized verification.
- **v1.4 (2026-03-24):** Tightened the same implementation step after independent review: baseline profile seeding is now transactional, and `AC-F0008-01` additionally proves rollback on partial seed failure so bootstrap cannot leave a partial baseline registry behind.
- **v1.5 (2026-03-24):** Eliminated the remaining review-derived health-path debt inside the same implementation step: `GET /health` now reuses the already-computed `model-fast` verdict when assembling routing diagnostics instead of probing the same dependency twice per request.
- **v1.6 (2026-03-24):** Final review tightening: `ModelRouter` no longer resolves baseline health when the caller already provided the needed organ-health override, and `AC-F0008-06` now pins that no-reprobe invariant directly in fast-path tests.
- **v1.7 (2026-03-24):** `change-proposal`: aligned the dossier with the repo-level identity-bearing write-authority matrix. `F-0008` now states explicitly that router ownership is limited to baseline profile registration plus model-profile continuity metadata, while runtime admission, subject-state writes and future cognition/governor surfaces remain outside the router write boundary.
- **v1.8 (2026-03-24):** `change-proposal`: aligned `F-0008` with the new architecture-level baseline router invariants. The architecture now carries only the minimal delivered router contract, while deterministic selection details, continuity persistence and fast/smoke proofs remain explicitly feature-local to this dossier.
