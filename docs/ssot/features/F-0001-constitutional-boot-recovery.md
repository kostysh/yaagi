---
id: F-0001
title: Конституционный контур запуска и восстановления
status: done
coverage_gate: strict
owners: ["@codex"]
area: runtime
depends_on: [F-0002]
impacts: [runtime, db, models, storage]
created: 2026-03-19
updated: 2026-03-25
links:
  issue: ""
  pr: []
  docs:
    - "docs/architecture/system.md"
    - "docs/ssot/features/F-0002-canonical-monorepo-deployment-cell.md"
    - "docs/ssot/features/F-0004-subject-state-kernel-and-memory-model.md"
---

# F-0001 Конституционный контур запуска и восстановления

## 1. Context & Goal

- **User problem:** Без выделенного boot/recovery-контура агент может стартовать из повреждённого состояния, смешивать проверку инвариантов с mutable runtime и терять безопасный путь отката после неудачного promotion или деградации зависимостей.
- **Goal (what success means):** Система до запуска scheduler и tick engine загружает constitutional shell, проверяет схему и критические зависимости, выбирает режим старта `normal` / `degraded` / `recovery`, а при необходимости откатывается к последнему валидному stable snapshot и фиксирует это в lifecycle/timeline-событиях.
- **Non-goals:** Реализация самого tick loop, загрузка полного субъектного состояния, production workflow для создания stable snapshot и операторское HTTP API не входят в этот intake.

## 2. Scope

### In scope

- Предстартовый constitutional boot layer до передачи управления scheduler и tick engine.
- Проверки schema version, целостности volumes и health критических зависимостей рантайма.
- Выбор режима старта `normal` / `degraded` / `recovery` на основе preflight-сигналов.
- Вход в recovery-путь с freeze developmental changes и откатом на последний stable snapshot.
- Публикация boot/recovery-событий и фиксация итогового lifecycle-состояния старта.

### Out of scope

- Обработка тиков, context building, decision harness и action execution.
- Создание, promotion и inventory stable snapshot как отдельный governance/workshop-процесс.
- Детальная оркестрация organ registry, model routing и policy для external consultants.
- Operator-facing HTTP endpoints и UI-интроспекция.
- Прямые записи в `psm_json`, `goals`, `beliefs`, `entities`, `relationships`, narrative/memetic surfaces и governance proposal tables вне boot/recovery continuity boundary.

### Constraints

- Boot/recovery не должен зависеть от mutable agent runtime-state.
- Rollback targetом считается только stable snapshot, а не отдельный commit или model adapter.
- При невозможности безопасного восстановления система должна fail-closed и не запускать новые тики.
- Набор реально проверяемых зависимостей должен определяться текущим platform substrate/constitution manifest, а не предположением о наличии органов, которые ещё не поставлены.
- Cross-cutting ownership для identity-bearing writes задаётся architecture matrix в `docs/architecture/system.md`: `F-0001` владеет только boot/recovery continuity writes и не получает общего права мутировать subject-state, narrative/memetic или governance surfaces.
- Совместимость с versioned subject-state contract проверяется, но не мигрируется этим seam: boot/recovery обязан реагировать на unsupported `subject_state_schema_version`, не становясь owner-ом schema evolution or backfill.

## 3. Requirements & Acceptance Criteria (SSoT)

- **AC-F0001-01:** Boot sequence загружает `constitution.yaml` из read-only `seed` boundary, валидирует schema version и проверяет целостность both tracked `seed/*` inputs and materialized writable runtime volumes до инициализации scheduler, tick engine или sensor adapters; при провале любой из этих проверок переход к активному runtime запрещён.
- **AC-F0001-02:** Boot sequence выполняет health checks PostgreSQL и model services, объявленных текущим platform substrate/constitution manifest, вычисляет startup mode по policy-таблице (`normal`, `degraded`, `recovery`) и записывает boot event в timeline с полями `mode`, `dependency_results`, `schema_version` и `snapshot_id|null`.
- **AC-F0001-03:** Если policy требует `recovery`, runtime до старта новых тиков выставляет developmental freeze, восстанавливает `git_tag` и `model_profile_map_json` из последнего валидного `stable_snapshots` entry, фиксирует использованный snapshot pointer и публикует recovery result event с итогом `recovered`; `schema_version` в snapshot manifest остаётся compatibility metadata for validation, not a boot-owned write target.
- **AC-F0001-04:** Если recovery обязателен, но подходящий stable snapshot отсутствует, не проходит manifest validation или rollback завершается ошибкой, runtime остаётся в неактивном lifecycle-state, не запускает scheduler/tick engine и публикует recovery result event с итогом `failed`.
- **AC-F0001-05:** При режиме `degraded` runtime может продолжить старт только если PostgreSQL доступен, schema/version/volumes валидны и policy явно разрешает отсутствие части model services без rollback; в boot event и текущем lifecycle state фиксируется список деградировавших зависимостей.
- **AC-F0001-06:** До handoff в активный runtime boot/recovery читает canonical `subjectStateSchemaVersion` from the bounded subject-state contract owned by `F-0004` and validates it as `supported` / `unsupported`; unsupported version must either trigger the documented recovery path against a compatible snapshot or keep startup fail-closed without partial activation.

## 4. Non-functional requirements (NFR)

- **Safety:** Нельзя допускать запуск активного рантайма после неуспешного recovery.
- **Reliability:** Один и тот же preflight-набор должен детерминированно приводить к одному режиму старта.
- **Observability:** Boot mode, причина recovery и результат rollback должны быть видны в системных событиях и логах.
- **Idempotency:** Повтор boot на одном и том же stable snapshot не должен дополнительно мутировать body/state beyond the intended rollback target.

## 5. Design (compact)

### 5.1 API surface

- Внешняя HTTP API-поверхность в этот scope не входит; контракт задаётся внутренними интерфейсами bootstrap boundary в `polyphony-core`.
- Предлагаемый entrypoint:

```ts
type StartupMode = "normal" | "degraded" | "recovery";

type DependencyCheckResult = {
  dependency: "postgres" | "model-fast" | "model-deep" | "model-pool";
  ok: boolean;
  requiredForNormal: boolean;
  detail?: string;
};

type BootPreflightResult = {
  constitutionVersion: string;
  schemaVersion: string;
  requiredVolumesOk: boolean;
  dependencyResults: DependencyCheckResult[];
  selectedMode: StartupMode;
  degradedDependencies: string[];
  rollbackSnapshotId: string | null;
};

type RecoveryResult = {
  attempted: boolean;
  snapshotId: string | null;
  outcome: "skipped" | "recovered" | "failed";
  detail?: string;
};

interface ConstitutionalBootService {
  preflight(): Promise<BootPreflightResult>;
  recover(input: BootPreflightResult): Promise<RecoveryResult>;
  activate(input: BootPreflightResult, recovery: RecoveryResult): Promise<void>;
}
```

- Реально исполняемый dependency set определяется `constitution.yaml` через `requiredDependencies`.
- После `F-0002` baseline phase-0 substrate объявляет только `postgres` и `model-fast` как обязательные preflight dependencies; `model-deep` и `model-pool` остаются частью расширяемого контракта для следующих feature seams, но не считаются delivered предпосылкой текущей deployment cell.
- Cross-cutting owner map для identity-bearing writes задаётся subsection `Identity-bearing write authority` в `docs/architecture/system.md`: boot/recovery пишет только свои continuity fields (`agent_state.mode`, rollback/snapshot refs и incident metadata), а все остальные identity-bearing surfaces читает либо валидирует без прямого write ownership.
- Subject-state compatibility policy comes from subsection `Subject State Schema and Evolution` in `docs/architecture/system.md`: boot/recovery validates `subject_state_schema_version` before active handoff, but migrations/backfills remain owned by `F-0004`.

- Boot publishes two system events into the timeline/event sink:
  - `system.boot.completed`
  - `system.recovery.completed`
- `system.boot.completed` payload:

```json
{
  "mode": "normal",
  "schemaVersion": "2026-03-19",
  "dependencyResults": [
    { "dependency": "postgres", "ok": true, "requiredForNormal": true }
  ],
  "degradedDependencies": [],
  "snapshotId": null
}
```

- `system.recovery.completed` payload:

```json
{
  "attempted": true,
  "snapshotId": "snapshot-41",
  "outcome": "recovered",
  "detail": "rollback to stable snapshot completed"
}
```

### 5.2 Data model changes

- Чтение:
  - `stable_snapshots` как единственный источник rollback target (`snapshot_id`, `git_tag`, `model_profile_map_json`, `schema_version`, `health_summary_json`, `created_at`).
  - `model_registry.health_json` для health-статуса обязательных model services.
  - `agent_state.last_stable_snapshot_id` как быстрый указатель на preferred rollback target.
  - versioned subject-state compatibility metadata (`subject_state_schema_version` through the canonical schema metadata contract owned by `F-0004`) для решения `supported` / `unsupported` до handoff в активный runtime.
- Запись:
  - timeline/event sink для `system.boot.completed` и `system.recovery.completed`.
  - `development_ledger` при recovery incidents с `entry_kind` из rollback/code/model incident family.
  - `agent_state.mode`, `agent_state.current_model_profile_id` и `agent_state.last_stable_snapshot_id` после успешного boot/recovery.
- Forbidden writes:
  - `psm_json`, `goals`, `beliefs`, `entities`, `relationships`, narrative/memetic tables и future governor-owned proposal surfaces не входят в boot/recovery write authority и не могут мутироваться этим seam напрямую.
- Compatibility rule:
  - supported `subject_state_schema_version` lets boot/recovery continue with the delivered handoff policy;
  - unsupported `subject_state_schema_version` forces recovery or fail-closed startup according to the architecture contract, but `F-0001` still does not own schema migration or backfill.
- Миграции в рамках фичи не требуются, если перечисленные таблицы уже вводятся базовым schema bootstrap. Если к моменту реализации их ещё нет, эта фича должна зависеть от минимального schema slice, но не расширять доменную модель сверх перечисленных полей.

### 5.3 UI changes (if any)

- Не применимо.

### 5.4 Edge cases

- Несовместимая schema version при валидных остальных зависимостях.
- Частичная деградация model services с разрешённым переходом только в `degraded`.
- Повреждённый или устаревший stable snapshot, который нельзя использовать как rollback target.
- Recovery после недавнего promotion, когда snapshot существует, но ссылается на отсутствующий `git_tag` или artifact.
- Повторный boot после неуспешного recovery, когда system events уже содержат предыдущее `failed` состояние.

## 6. Definition of Done

- Все AC-F0001-* покрыты автоматическими тестами с явными ссылками на AC IDs.
- Boot state machine детерминированно различает `normal`, `degraded` и `recovery` по зафиксированной policy-таблице.
- Recovery path либо приводит runtime к валидному stable snapshot, либо оставляет систему в fail-closed state без старта scheduler/tick engine.
- Timeline/events и development ledger позволяют восстановить причину выбора режима старта и результат recovery.
- `docs/ssot/index.md` синхронизирован, dossier lint проходит без ошибок и предупреждений.

## 7. Slicing plan (2–6 increments)

### Slice SL-F0001-01: Constitutional preflight skeleton
Delivers: отдельный preflight-pass, который загружает constitution и блокирует активацию runtime при нарушении базовых инвариантов.
Covers: AC-F0001-01
Exit criteria:
- `preflight()` можно вызвать из boot harness без старта scheduler/tick engine.
- Ошибки constitution/schema/volume возвращаются как fail-closed результат preflight.
Tasks:
- **T-F0001-01:** Выделить boot state machine и orchestration boundary для `preflight()` без side effects запуска runtime. Covers: AC-F0001-01.
- **T-F0001-02:** Реализовать загрузку `constitution.yaml`, schema/version validation и volume integrity checks с единым fail-closed результатом. Covers: AC-F0001-01.

### Slice SL-F0001-02: Dependency probes and startup mode policy
Delivers: детерминированный выбор `normal` / `degraded` / `recovery` на основе health probes и policy-матрицы.
Covers: AC-F0001-02, AC-F0001-05
Exit criteria:
- Для фиксированного набора probe results mode selection всегда выдаёт один и тот же результат.
- Degraded boot разрешается только для policy-approved потери model services.
Tasks:
- **T-F0001-03:** Добавить probes для PostgreSQL и обязательных model services с нормализованным `DependencyCheckResult`. Covers: AC-F0001-02, AC-F0001-05.
- **T-F0001-04:** Зафиксировать policy-матрицу выбора startup mode и вычисление `degradedDependencies`. Covers: AC-F0001-02, AC-F0001-05.

### Slice SL-F0001-03: Boot event publication and activation handoff
Delivers: наблюдаемый завершённый boot для `normal` и policy-approved `degraded` mode до handoff в runtime.
Covers: AC-F0001-02, AC-F0001-05
Exit criteria:
- `system.boot.completed` публикуется до запуска scheduler/tick engine.
- Lifecycle state и agent state отражают выбранный mode и список degraded dependencies.
Tasks:
- **T-F0001-05:** Реализовать публикацию `system.boot.completed` в timeline/event sink с `mode`, `dependencyResults`, `schemaVersion` и `snapshotId`. Covers: AC-F0001-02.
- **T-F0001-06:** Реализовать `activate()` так, чтобы handoff в scheduler/tick engine происходил только после успешного boot event и только в `normal` или разрешённом `degraded`. Covers: AC-F0001-02, AC-F0001-05.

### Slice SL-F0001-04: Recovery rollback and fail-closed startup
Delivers: recovery-path с rollback на stable snapshot и жёстким запретом запуска при любой неуспешной попытке восстановления.
Covers: AC-F0001-03, AC-F0001-04
Exit criteria:
- Успешный recovery восстанавливает snapshot refs и публикует `system.recovery.completed` с `outcome = recovered`.
- Неуспешный recovery оставляет runtime inactive и не запускает scheduler/tick engine.
Tasks:
- **T-F0001-07:** Реализовать выбор последнего валидного `stable_snapshots` entry и manifest validation для `git_tag`, `model_profile_map_json` и `schema_version`. Covers: AC-F0001-03, AC-F0001-04.
- **T-F0001-08:** Реализовать `recover()` с developmental freeze, rollback на snapshot refs и публикацией `system.recovery.completed`. Covers: AC-F0001-03.
- **T-F0001-09:** Добавить fail-closed guard и incident logging в `development_ledger` для missing/invalid snapshot и rollback failure. Covers: AC-F0001-04.

### Slice SL-F0001-05: Subject-state compatibility gate before active handoff
Delivers: explicit preflight/recovery validation of the versioned bounded subject-state contract before boot hands control to the active runtime.
Covers: AC-F0001-06
Verification: `integration`, `smoke`
Exit criteria:
- Boot/recovery reads canonical subject-state compatibility metadata before runtime activation.
- Unsupported `subjectStateSchemaVersion` never reaches active handoff or partial runtime activation.
- Compatible versions continue through the delivered startup/recovery policy without changing schema ownership.
Dependencies:
- This slice depends on `SL-F0004-06` surfacing `subjectStateSchemaVersion` in the bounded snapshot contract.
Tasks:
- **T-F0001-10:** Extend preflight/recovery validation to consume canonical `subjectStateSchemaVersion` and classify it as `supported` / `unsupported` before active handoff. Covers: AC-F0001-06.
- **T-F0001-11:** Add AC-linked integration and containerized startup verification for supported versus unsupported `subjectStateSchemaVersion`, including fail-closed startup when no compatible recovery target exists. Covers: AC-F0001-06.

## 8. Suggested issue titles

- `F-0001 / SL-F0001-01 Constitutional preflight skeleton` → [SL-F0001-01](#slice-sl-f0001-01-constitutional-preflight-skeleton)
- `F-0001 / SL-F0001-02 Dependency probes and startup mode policy` → [SL-F0001-02](#slice-sl-f0001-02-dependency-probes-and-startup-mode-policy)
- `F-0001 / SL-F0001-03 Boot event publication and activation handoff` → [SL-F0001-03](#slice-sl-f0001-03-boot-event-publication-and-activation-handoff)
- `F-0001 / SL-F0001-04 Recovery rollback and fail-closed startup` → [SL-F0001-04](#slice-sl-f0001-04-recovery-rollback-and-fail-closed-startup)
- `F-0001 / SL-F0001-05 Subject-state compatibility gate before active handoff` → [SL-F0001-05](#slice-sl-f0001-05-subject-state-compatibility-gate-before-active-handoff)

## 9. Test plan & Coverage map

| AC ID | Test reference | Status |
|---|---|---|
| AC-F0001-01 | `apps/core/test/runtime/boot.integration.test.ts` → `test("AC-F0001-01 blocks runtime activation until constitution, schema and volume checks pass")` | done |
| AC-F0001-02 | `apps/core/test/runtime/boot.integration.test.ts` → `test("AC-F0001-02 emits boot event with selected startup mode and dependency results")`; supplemental platform realignment in `apps/core/test/platform/containerized-boot.integration.test.ts` and `infra/docker/deployment-cell.smoke.ts` | done |
| AC-F0001-03 | `apps/core/test/runtime/recovery.integration.test.ts` → `test("AC-F0001-03 restores git and model pointers from the last valid stable snapshot before activation")` | done |
| AC-F0001-04 | `apps/core/test/runtime/recovery.integration.test.ts` → `test("AC-F0001-04 leaves runtime inactive when recovery target is missing or invalid")` | done |
| AC-F0001-05 | `apps/core/test/runtime/boot.integration.test.ts` → `test("AC-F0001-05 allows degraded boot only for policy-approved dependency loss")` | done |
| AC-F0001-06 | `apps/core/test/runtime/boot.integration.test.ts` → `test("AC-F0001-06 refuses activation when subject-state schema version is unsupported")`; `apps/core/test/runtime/recovery.integration.test.ts` → `test("AC-F0001-06 keeps runtime fail-closed when subject-state compatibility cannot be restored by boot recovery alone")`; `apps/core/test/platform/containerized-boot.integration.test.ts` → `test("AC-F0001-06 preserves boot fail-closed behavior for unsupported subject-state schema version inside the containerized startup path")`; shared startup fail-closed smoke proof in `infra/docker/deployment-cell.smoke.ts` | done |

План тестов:

- Интеграционные тесты через in-memory boot harness и подмену dependency probes.
- Отдельные fixtures для `constitution.yaml`, corrupted volumes manifest и `stable_snapshots` entries.
- Явные assertions на отсутствие вызова `scheduler.start()` и `tickEngine.start()` в fail-closed ветках.
- Supplemental platform verification через containerized boot/smoke path подтверждает boot assumptions against `seed -> materialized runtime` substrate, а не только against local in-memory fixtures.
- Consumed cross-cutting invariants:
  - `Identity-bearing write authority` из `docs/architecture/system.md` ограничивает `F-0001` boot/recovery continuity writes и запрещает трактовать boot boundary как generic writer для других identity-bearing surfaces.
  - `Subject State Schema and Evolution` в `docs/architecture/system.md` задаёт policy для `subject_state_schema_version`: `F-0001` only validates compatibility and reacts to mismatch, while schema ownership remains in `F-0004`.

## 10. Decision log (ADR blocks)

### ADR-F0001-01: `degraded` разрешается только для потери model services, но не PostgreSQL или schema/volume invariants
- Status: Accepted
- Context: Архитектура требует три startup mode (`normal`, `degraded`, `recovery`), но без policy-границы деградация может размыть fail-closed поведение и допустить старт из повреждённого состояния.
- Decision: `degraded` допустим только когда доступны PostgreSQL, constitutional shell, schema/version checks и required volumes, а деградировала лишь подмножество model services, которое policy помечает как temporarily non-blocking. Потеря PostgreSQL, несовместимая schema version, нарушение целостности volumes и невалидный rollback target всегда ведут в `recovery` или неактивный fail-closed state.
- Alternatives: Разрешать `degraded` для любых неполадок кроме полного падения процесса; всегда переводить любую потерю model service в `recovery`.
- Consequences: Startup policy остаётся жёсткой и предсказуемой; degraded mode полезен для ограниченной работоспособности, но не подменяет recovery.

## 11. Progress & links

- Status: `done` → `shaped` → `done`
- Issue: -
- PRs:
  - -
- Follow-up:
  - Closed on 2026-03-24 by `AC-F0001-06` / `SL-F0001-05` implementation and verification.
- Code:
  - `apps/core/src/boot/constitutional-boot-service.ts`
  - `apps/core/src/boot/constitution-loader.ts`
  - `apps/core/src/runtime/runtime-lifecycle.ts`
  - `apps/core/testing/boot-harness.ts`
  - `apps/core/test/runtime/boot.integration.test.ts`
  - `apps/core/test/runtime/recovery.integration.test.ts`
  - `apps/core/test/platform/containerized-boot.integration.test.ts`
  - `infra/docker/deployment-cell.smoke.ts`
  - `seed/constitution/constitution.yaml`

## 12. Change log

- **v1.0 (2026-03-19):** Initial dossier created from candidate `CF-001` via feature intake.
- **v1.1 (2026-03-19):** Expanded dossier into compact spec with testable AC, internal boot/recovery contracts, DoD, coverage plan and startup-mode ADR.
- **v1.2 (2026-03-19):** Added execution-ready slice plan with per-slice tasks, exit criteria and suggested issue titles; status advanced to `planned`.
- **v1.3 (2026-03-19):** Implemented pnpm monorepo scaffold, constitutional boot service and AC-linked integration tests; status advanced to `done`.
- **v1.4 (2026-03-19):** Aligned runtime scaffold with the canonical TypeScript stack by converting `apps/core` and shared contracts to strict TypeScript and adding monorepo tsconfig/typecheck tooling.
- **v1.5 (2026-03-19):** Removed `tsx` from test execution and switched the repo to native `node --experimental-strip-types` with `.ts` import specifiers.
- **v1.6 (2026-03-19):** Realigned boot assumptions to `F-0002`: `depends_on` now points to delivered platform substrate, constitution manifests declare the active dependency set, and supplemental containerized verification covers the phase-0 deployment cell path (`postgres + model-fast`).
- **v1.7 (2026-03-22):** Realigned the constitutional boot contract to the delivered `seed -> materialized runtime` platform boundary: the constitution manifest now lives under `seed/constitution`, required volume checks cover both tracked seed inputs and writable runtime volumes, and the verification plan explicitly includes the containerized seed/materialization startup path.
- **v1.8 (2026-03-24):** `change-proposal`: aligned `F-0001` with the repo-level identity-bearing write-authority matrix so boot/recovery now states its narrow ownership explicitly: it writes only startup continuity fields and recovery incidents, while subject-state, router-owned profile continuity and future cognition/governance surfaces remain outside boot write authority.
- **v1.9 (2026-03-24):** `change-proposal`: aligned boot/recovery with the versioned subject-state contract. `F-0001` now states explicitly that it validates `subject_state_schema_version` compatibility during preflight/recovery and reacts with recovery or fail-closed startup on mismatch, while schema migration/backfill ownership remains in `F-0004`.
- **v1.10 (2026-03-24):** User-approved follow-up after debt audit: the compatibility gate promised in `v1.9` is not implemented yet. `F-0001` now carries explicit acceptance criterion `AC-F0001-06`, follow-up slice `SL-F0001-05`, AC-linked planned verification and returns to `shaped` until boot/recovery enforces versioned subject-state compatibility before active handoff.
- **v1.11 (2026-03-24):** Implemented `SL-F0001-05`: boot preflight now reads the canonical bounded `subjectStateSchemaVersion`, unsupported versions stay fail-closed before active handoff unless a future canonical subject-state restore/backfill contract exists, and AC-linked boot/recovery/containerized-boot plus deployment-cell smoke verification closes `AC-F0001-06`; status advanced back to `done`.
