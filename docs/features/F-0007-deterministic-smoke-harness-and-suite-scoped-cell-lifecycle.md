---
id: F-0007
title: Детерминированный smoke harness и suite-scoped lifecycle deployment cell
status: done
owners: ["@codex"]
area: platform
depends_on: [F-0002, F-0003, F-0004, F-0005, F-0006]
impacts: [runtime, infra, verification, smoke]
created: 2026-03-23
updated: 2026-03-23
links:
  issue: ""
  pr: []
  docs:
    - "docs/architecture/system.md"
    - "README.md"
    - "docs/features/F-0002-canonical-monorepo-deployment-cell.md"
    - "docs/features/F-0006-baseline-dependency-refresh-and-toolchain-alignment.md"
---

# F-0007 Детерминированный smoke harness и suite-scoped lifecycle deployment cell

## 1. Контекст и цель

- **Проблема пользователя:** `pnpm smoke:cell` уже ловит реальные регрессии в deployment cell, но текущий harness делает это слишком дорого и хрупко: почти каждый smoke-тест заново поднимает весь Docker Compose cell, а синхронизация readiness и cleanup завязана на polling/timeouts поверх асинхронного поведения сервисов. Это раздувает время прогона, создаёт nondeterministic race conditions на teardown/startup и делает container smoke менее надёжным, чем он должен быть как канонический verification path.
- **Цель (что считается успехом):** Репозиторий получает детерминированный и заметно более быстрый `smoke:cell`, который сохраняет канонический containerized verification path, но больше не реализует тестовую изоляцию через repeated full `compose down/up` для всего suite. Вместо этого suite использует один управляемый lifecycle deployment cell, явные readiness/reset barriers и предсказуемый cleanup без скрытых Docker resource races.
- **Что не входит в цель:** Удаление `pnpm smoke:cell`, ослабление покрытия containerized regressions, перевод smoke suite в purely mocked/in-memory path, смена Docker Compose на другой orchestrator, а также переразметка доменной логики runtime/features под видом ускорения harness не входят в scope этой фичи.

## 2. Область

### Входит в область

- Анализ и фиксация canonical suite lifecycle для `infra/docker/deployment-cell.smoke.ts`.
- Устранение repeated full cell restarts между smoke-тестами там, где они не нужны для покрытия acceptance semantics.
- Введение явных deterministic reset/readiness barriers для compose-managed container suite.
- Сохранение и при необходимости переразметка smoke coverage по уже delivered AC, если это нужно для более узкого и честного smoke contract.
- Обновление dossier/README/index, если verification ownership или smoke contract уточняются.

### Вне области

- Изменение бизнес-логики delivered feature seams без доказанной необходимости, вызванной именно smoke harness redesign.
- Замена fast integration tests container smoke suite или наоборот.
- Новый CI/pipeline substrate beyond the existing root command contract.
- Полная оптимизация всех тестов репозитория; scope ограничен именно `pnpm smoke:cell`.

### Ограничения

- `pnpm smoke:cell` остаётся каноническим containerized verification path из `F-0002` и `F-0006`; фича не может тихо отменить его или понизить его статус.
- Coverage semantics для boot, recovery, ingest и Telegram-path не должны исчезнуть без явного и проверяемого replacement path.
- Suite должен завершаться без оставшихся `yaagi-phase0*` Docker resources после успешного или неуспешного прогона.
- Фича должна устранять именно orchestration/test-harness nondeterminism, а не маскировать её увеличением timeout values.

## 3. Требования и критерии приёмки (SSoT)

- **AC-F0007-01:** `pnpm smoke:cell` использует suite-scoped lifecycle deployment cell вместо repeated full `compose down/up` на каждый smoke-тест, кроме явно обоснованных restart-specific scenarios.
- **AC-F0007-02:** Межтестовая изоляция достигается через deterministic reset/readiness barriers, а не через generic sleep/timeout orchestration поверх асинхронного teardown/startup Docker resources.
- **AC-F0007-03:** Containerized smoke coverage для уже delivered boot/recovery/ingest/Telegram scenarios сохраняется либо переразмечается без потери проверяемого ownership.
- **AC-F0007-04:** Время выполнения `pnpm smoke:cell` становится materially lower относительно текущего baseline repeated-restart harness и фиксируется как проверяемый outcome этой фичи.
- **AC-F0007-05:** После завершения `pnpm smoke:cell` не остаётся orphaned `yaagi-phase0*` containers/networks/volumes.
- **AC-F0007-06:** Repo-level verification contract и соответствующие dossier references выровнены с новым smoke harness ownership и execution model.

## 4. Нефункциональные требования (NFR)

- **Детерминированность:** Один и тот же smoke suite должен проходить без race-зависимого поведения между соседними тестами.
- **Операбельность:** Harness должен по-прежнему запускаться одной root-командой `pnpm smoke:cell`.
- **Наблюдаемость:** Readiness/reset barriers должны быть выражены через явные проверяемые conditions, а не через необъяснимые sleeps.
- **Дисциплина области:** Ускорение smoke suite не должно quietly ослабить containerized verification semantics.

## 5. Baseline intake notes

- Подтверждённый baseline root cause на момент intake:
  - suite почти в каждом тесте делает `resetSmokeProjects()` и затем `compose(['up', '-d', '--build'])`;
  - readiness/cleanup завязаны на polling helpers (`waitForHttp`, `waitForPostgresValue`, `waitForAdapterStatus`, `waitForPortToClose`);
  - compose healthchecks сами по себе несут `start_period`/`interval` windows;
  - основная стоимость прогона приходит от repeated full deployment-cell lifecycle, а не от одного-двух точечных sleeps.
- Предварительная продуктовая гипотеза:
  - один boot suite lifecycle;
  - targeted state reset between tests;
  - explicit domain barriers;
  - smaller but still authoritative smoke scope.

## 6. Design (compact)

### 6.1 Каноническая execution model smoke suite

- `pnpm smoke:cell` остаётся одним root-level containerized verification path, но lifecycle cell фиксируется на уровне suite/scenario-family, а не на уровне каждого отдельного smoke-теста.
- Допустимая execution model после shaping:
  - один базовый live project `yaagi-phase0` для non-Telegram smoke scenarios;
  - один отдельный live project `yaagi-phase0-telegram` только для Telegram-specific smoke family;
  - full `docker compose up -d --build --wait` допускается один раз на каждую такую scenario family, а не перед каждым тестом;
  - explicit `compose restart core` остаётся допустимым только для restart-specific scenarios, где AC действительно требует доказать поведение после process restart.
- Полный `compose down -v --remove-orphans` между соседними обычными smoke-тестами перестаёт быть канонической моделью изоляции.

### 6.2 Reset и readiness barriers

- Межтестовая изоляция больше не должна выражаться через repeated full teardown/startup cell. Вместо этого `F-0007` обязан ввести deterministic reset contract для mutable runtime state.
- Канонический inter-test reset mechanism после shaping фиксируется так:
  - для базового smoke project и для Telegram project baseline восстанавливается через один и тот же основной механизм: deterministic runtime DB reset до clean post-bootstrap state plus targeted `core` restart, когда следующему сценарию нужен новый process lifecycle;
  - reset mutable runtime DB state является primary isolation primitive, а не одной из нескольких альтернатив;
  - fixture-specific cleanup допустим только как подчинённое дополнение для внешних тестовых fixtures, которые не живут в runtime DB (например, очередь fake Telegram API), и не заменяет runtime baseline reset;
  - generic cleanup runtime-generated files не становится отдельной свободной веткой дизайна: file cleanup допускается только если конкретный smoke scenario сам создаёт временный артефакт вне canonical runtime DB reset.
- Shaped contract для readiness:
  - старт suite/scenario family использует Docker-level readiness barrier (`docker compose ... up --wait` или эквивалентный deterministic service-health barrier);
  - после старта suite использует domain barriers, а не generic sleeps:
    - `core` readiness через `GET /health`;
    - DB-side assertions через deterministic SQL conditions;
    - adapter-specific readiness через explicit status contract;
    - fake Telegram fixture reset через явный adapter/test-fixture API, а не через implicit timeout behavior;
- Polling helpers допустимы только как bounded waiting wrappers around explicit domain conditions; они не должны оставаться primary orchestration model для suite lifecycle.

### 6.3 Канонический smoke scope после realignment

- В smoke suite должны остаться только сценарии, где containerized cell реально добавляет verification value поверх fast integration path.
- После shaping фиксируется такой target smoke scope:
  - readiness и bootstrap deployment cell из `F-0002`, включая `seed -> materialized runtime` handoff, `/seed` read-only boundary, materialized runtime surfaces и bootstrap schemas;
  - mandatory wake tick после constitutional activation из `F-0003`;
  - stale tick reclaim после `core` restart из `F-0003`;
  - subject-state reload после `core` restart из `F-0004`;
  - HTTP ingest inside deployment cell из `F-0005`;
  - Telegram ingest через fake Bot API inside deployment cell из `F-0005`.
- Lease-discipline smoke probe из `F-0003` после shaping выводится из container smoke suite и закрепляется за fast integration path, потому что его main value лежит в DB/runtime semantics, а не в long-lived container cell. `F-0007` implementation обязан удалить этот probe из `deployment-cell.smoke.ts` и сохранить coverage ownership через explicit realignment на fast integration surface, а не оставлять implementer-у выбор.
- Restart-safe perception smoke probe из `F-0005` после shaping тоже выводится из container smoke suite и закрепляется за fast integration path: его main value лежит в claim/release and restart-safe DB/runtime semantics, а не в deployment-cell substrate. `F-0007` implementation обязан явно realign-ить `F-0005`, а не оставлять скрытую двусмысленность между kept smoke ingest scenarios и restart-safe intake verification.

### 6.4 Performance outcome и baseline measurement

- `F-0007` не использует hardware-agnostic absolute timeout target как единственный success signal, потому что wall-clock duration зависит от среды.
- Вместо этого shaped measurement contract такой:
  - перед implementation фиксируется baseline single-run duration текущего repeated-restart harness на чистом окружении без конкурирующих Docker workloads;
  - после implementation сравнение делается на той же машине и том же repo state class;
  - `AC-F0007-04` считается закрытым только если новый suite materially faster and structurally leaner:
    - заметно меньше full `compose up/down` cycles;
    - single-run wall-clock duration materially lower относительно baseline;
    - ускорение достигается не за счёт потери kept smoke coverage.
- Для этого workstream “materially lower” трактуется как измеримое сокращение времени не менее чем на ~35% относительно зафиксированного baseline repeated-restart harness на той же машине, если не всплывёт более строгий environment-backed evidence в implementation.

### 6.5 Границы изменения и недопустимые shortcuts

- `F-0007` не может “ускорить” smoke suite через:
  - простое увеличение timeout values;
  - перевод container smoke на mocked/in-memory path;
  - скрытое удаление restart-specific scenarios без dossier realignment;
  - расползание platform smoke harness в полноценный CI orchestration framework.
- Если в ходе implementation выяснится, что какой-то smoke scenario нельзя держать в suite-scoped model без непропорциональной сложности, это должно быть оформлено как explicit coverage realignment, а не как молчаливое выпадение test ownership.

### 6.6 Edge cases

- После упавшего smoke-теста suite cleanup всё равно должен гарантированно удалять `yaagi-phase0*` containers/networks/volumes.
- Telegram-specific scenario не должен конфликтовать с основным suite project по host ports и residual Docker resources.
- Restart-specific tests не должны зависеть от случайного residue от предыдущего smoke scenario.
- Если `core` readiness проходит, но domain barrier ещё не выполнен (например, adapter status или DB-side condition), harness должен ждать именно domain condition, а не вставлять fixed sleep.

## 7. Definition of Done

- У `F-0007` есть shaped/implemented owner для smoke harness redesign.
- `pnpm smoke:cell` больше не зависит от repeated full restart cell между обычными smoke-тестами.
- Cleanup/readiness races между соседними smoke-тестами устранены.
- Coverage ownership для kept/moved smoke scenarios остаётся явным в dossier/test references.
- Repo-level docs и index синхронизированы.

## 8. Slicing plan (2–6 increments)

### Slice SL-F0007-01: Baseline measurement и suite-scoped lifecycle substrate
Delivers: зафиксированный baseline repeated-restart harness, scenario-family project layout и базовый lifecycle substrate без per-test full compose boot.
Covers: AC-F0007-01, AC-F0007-04, AC-F0007-05
Verification: `smoke`, `audit`
Exit criteria:
- Зафиксирован before baseline для `pnpm smoke:cell`: wall-clock duration, число full `compose up/down` cycles и текущие polling points.
- Harness умеет поднимать `yaagi-phase0` и `yaagi-phase0-telegram` не чаще одного раза на scenario family.
- Per-test full `compose down -v --remove-orphans` перестаёт быть default suite orchestration path.
Tasks:
- **T-F0007-01:** Зафиксировать baseline repeated-restart harness и оформить measurement evidence, на который будет ссылаться `AC-F0007-04`. Covers: AC-F0007-04.
- **T-F0007-02:** Вынести scenario-family project lifecycle helpers для `yaagi-phase0` и `yaagi-phase0-telegram` в canonical smoke harness substrate. Covers: AC-F0007-01, AC-F0007-05.
- **T-F0007-03:** Реорганизовать suite bootstrap так, чтобы обычные smoke scenarios больше не стартовали весь compose stack заново перед каждым тестом. Covers: AC-F0007-01.

### Slice SL-F0007-02: Deterministic reset и readiness barriers
Delivers: единый inter-test reset contract, deterministic readiness barriers и отказ от orchestration sleeps как primary synchronization model.
Covers: AC-F0007-02, AC-F0007-05
Verification: `smoke`, `integration`
Exit criteria:
- Между соседними smoke scenarios baseline восстанавливается через deterministic runtime DB reset plus targeted `core` restart only when needed.
- Docker-level startup readiness и domain barriers выражены через explicit helper contract, а не через ad hoc fixed waits.
- После failed или successful scenario cleanup остаётся предсказуемым и не оставляет `yaagi-phase0*` residue.
Tasks:
- **T-F0007-04:** Реализовать canonical runtime DB reset helper до clean post-bootstrap state и подчинённые fixture cleanup hooks для non-DB fixtures. Covers: AC-F0007-02, AC-F0007-05.
- **T-F0007-05:** Выровнять readiness helpers вокруг `compose ... up --wait`, `GET /health`, DB-side assertions и adapter/test-fixture barriers. Covers: AC-F0007-02.
- **T-F0007-06:** Усилить post-test и post-suite cleanup auditing для контейнеров, сетей и volume-ресурсов с префиксом `yaagi-phase0`. Covers: AC-F0007-05.

### Slice SL-F0007-03: Realignment kept smoke scenarios и перенос lease-discipline probe
Delivers: migrated base smoke scenarios under the new lifecycle model and explicit ownership transfer for the removed lease-discipline/perception restart-safety probes.
Covers: AC-F0007-01, AC-F0007-02, AC-F0007-03, AC-F0007-06
Verification: `smoke`, `integration`, `audit`
Exit criteria:
- Boot/readiness, `seed -> materialized runtime` handoff, mandatory wake tick, stale tick reclaim и subject-state reload продолжают проверяться внутри container smoke без per-test full compose boot.
- Lease-discipline probe и restart-safe perception probe удалены из `deployment-cell.smoke.ts` и перепривязаны к fast integration surface с явным AC ownership.
- `F-0002`, `F-0003`, `F-0004`, `F-0005` и `F-0007` синхронизированы по coverage ownership.
Tasks:
- **T-F0007-07:** Переписать base smoke scenarios под suite-scoped lifecycle и deterministic reset/readiness helpers. Covers: AC-F0007-01, AC-F0007-02, AC-F0007-03.
- **T-F0007-08:** Удалить lease-discipline probe из container smoke и добавить/выровнять fast integration ownership для этой проверки. Covers: AC-F0007-03.
- **T-F0007-09:** Удалить restart-safe perception probe из container smoke и перепривязать его к fast integration ownership без потери AC-linked verification. Covers: AC-F0007-03.
- **T-F0007-10:** Выполнить dossier realignment для `F-0002`, `F-0003`, `F-0004`, `F-0005` и `F-0007`, чтобы coverage ownership больше не расходился с фактическим test surface. Covers: AC-F0007-06.

### Slice SL-F0007-04: Telegram scenario family и ingest smoke closure
Delivers: отдельная Telegram-specific scenario family на том же harness substrate, без портовых конфликтов и без возврата к repeated full suite restarts.
Covers: AC-F0007-01, AC-F0007-02, AC-F0007-03, AC-F0007-05
Verification: `smoke`
Exit criteria:
- HTTP ingest и fake-Bot-API-backed Telegram ingest проходят внутри новой suite/scenario-family execution model.
- Telegram-specific family не конфликтует с base family по host ports, project names и residual Docker resources.
- Fake Telegram fixture reset встроен в canonical reset contract как subordinate fixture cleanup, а не как произвольный timeout path.
Tasks:
- **T-F0007-11:** Перевести HTTP ingest и Telegram ingest smoke scenarios на scenario-family lifecycle с общими reset/readiness barriers. Covers: AC-F0007-01, AC-F0007-02, AC-F0007-03.
- **T-F0007-12:** Выровнять fake Telegram fixture reset и Telegram-specific compose orchestration без host-port collisions и residual resources. Covers: AC-F0007-02, AC-F0007-05.

### Slice SL-F0007-05: Acceptance closure, performance evidence и repo-level realignment
Delivers: итоговый materially-faster smoke suite, зафиксированное before/after evidence и синхронизированный repo-level verification contract.
Covers: AC-F0007-04, AC-F0007-05, AC-F0007-06
Verification: `smoke`, `audit`
Exit criteria:
- На той же машине и на том же repo state class зафиксировано materially lower single-run duration относительно baseline repeated-restart harness.
- `pnpm smoke:cell` проходит на финальном harness без orphaned `yaagi-phase0*` resources.
- `README.md`, `F-0002`, `F-0003`, `F-0004`, `F-0005`, `F-0007` и `docs/ssot/index.md` выровнены там, где меняется verification ownership или smoke execution model.
Tasks:
- **T-F0007-13:** Зафиксировать before/after performance evidence и явно доказать сокращение full compose lifecycle cycles без hidden scope loss. Covers: AC-F0007-04.
- **T-F0007-14:** Завершить repo-level doc realignment для smoke execution model и verification ownership. Covers: AC-F0007-06.
- **T-F0007-15:** Закрыть feature через финальный `pnpm smoke:cell` и post-suite Docker resource audit. Covers: AC-F0007-05.

## 9. Test plan & Coverage map

| AC ID | Verification reference | Status |
| --- | --- | --- |
| AC-F0007-01 | `infra/docker/deployment-cell.smoke.ts` → `test("AC-F0007-01 reuses suite-scoped compose families instead of per-test full deployment-cell restarts")`; `test/platform/smoke-harness.contract.test.ts` → `test("AC-F0007-01 keeps the deployment-cell harness on one base family boot and one Telegram family boot")` | done |
| AC-F0007-02 | `infra/docker/deployment-cell.smoke.ts` → `test("AC-F0007-02 restores clean post-bootstrap runtime state through deterministic resets between suite-scoped smoke scenarios")`; `test/platform/smoke-harness.contract.test.ts` → `test("AC-F0007-02 restores clean post-bootstrap runtime state through deterministic reset and readiness helpers")` | done |
| AC-F0007-03 | `test/platform/smoke-harness.contract.test.ts` → `test("AC-F0007-03 retains F-0002 startup smoke ownership and removes lease plus perception restart probes from container smoke")`; [F-0003](./F-0003-tick-runtime-scheduler-episodic-timeline.md); [F-0005](./F-0005-perception-buffer-and-sensor-adapters.md) | done |
| AC-F0007-04 | `test/platform/smoke-harness.contract.test.ts` → `test("AC-F0007-04 records before and after smoke timings with a materially faster post-implementation result")`; before: `/usr/bin/time -p pnpm smoke:cell` → `real 133.47`; after: `/usr/bin/time -p pnpm smoke:cell` → `real 57.13` | done |
| AC-F0007-05 | `infra/docker/deployment-cell.smoke.ts` → `test("AC-F0007-05 tears down suite-scoped smoke projects without orphaned docker resources")`; `test/platform/smoke-harness.contract.test.ts` → `test("AC-F0007-05 keeps an explicit teardown audit for both smoke projects and their host ports")` | done |
| AC-F0007-06 | `test/platform/smoke-harness.contract.test.ts` → `test("AC-F0007-06 realigns README and dossier references to the delivered smoke execution model")`; [README.md](/code/projects/yaagi/README.md); [F-0003](./F-0003-tick-runtime-scheduler-episodic-timeline.md); [F-0005](./F-0005-perception-buffer-and-sensor-adapters.md); `docs/ssot/index.md` | done |

План проверки:

- зафиксировать текущий suite baseline (`compose up/down` frequency, readiness polling points, wall-clock duration);
- доказать новый suite-scoped lifecycle и deterministic reset path на smoke evidence, а не только на локальных helper tests;
- сохранить явную AC ownership для сценариев, которые останутся в smoke, и документировать перенос тех сценариев, которые уйдут в fast integration path.

## 10. Decision log (ADR blocks)

### ADR-F0007-01 Suite-scoped lifecycle beats per-test full cell restarts

- **Context:** Current smoke harness spends most of its time on repeated full `compose down/up` cycles and inherits teardown/startup races between tests.
- **Decision:** `F-0007` adopts suite/scenario-family scoped deployment-cell lifecycle as the canonical smoke execution model; full cell restarts stop being the default isolation mechanism.
- **Consequences:** Implementation must introduce deterministic reset helpers and cannot keep repeated full compose boots as the hidden default.

### ADR-F0007-02 Smoke coverage stays container-specific and may shrink only by explicit realignment

- **Context:** Not every delivered AC gets extra value from a long-lived container smoke path; some checks mostly exercise DB/runtime semantics already covered by fast integration tests.
- **Decision:** Smoke scope remains authoritative only for scenarios with real deployment-cell value; the `F-0002` bootstrap/materialization proof stays in container smoke as a startup-only scenario family, while the current lease-discipline probe and the `F-0005` restart-safe perception probe leave `deployment-cell.smoke.ts` and must be preserved through explicit fast-integration ownership paths.
- **Consequences:** Speed improvements are allowed, but only with preserved ownership and no silent coverage loss; `plan-slice` no longer has to decide the fate of those probes or the `F-0002` startup boundary.

### ADR-F0007-03 Performance is measured relatively against the repeated-restart baseline

- **Context:** Absolute wall-clock targets are environment-sensitive, but the current repeated-restart harness already provides a concrete local baseline.
- **Decision:** `F-0007` measures success by comparing pre/post single-run duration on the same machine and by reducing full compose lifecycle cycles, with a shaped expectation of a material reduction around 35% or better.
- **Consequences:** Implementation must capture before/after evidence and cannot claim success only from anecdotal “feels faster” observations.

## 11. Progress & links

- Статус: `done`
- Intake source: user-approved follow-up after `F-0006`
- PRs:
  - -
- Code:
  - `infra/docker/deployment-cell.smoke.ts`
  - `infra/docker/helpers.ts`
  - `infra/docker/fake-telegram-api/server.py`
  - `README.md`
  - `docs/features/F-0003-tick-runtime-scheduler-episodic-timeline.md`
  - `docs/features/F-0005-perception-buffer-and-sensor-adapters.md`
- Verification:
  - `/usr/bin/time -p pnpm smoke:cell` before → `real 133.47`
  - `/usr/bin/time -p pnpm smoke:cell` after → `real 57.13`
  - `node --experimental-strip-types --test infra/docker/deployment-cell.smoke.ts`

## 12. Журнал изменений (Change log)

- **v1.0 (2026-03-23):** Выполнен intake отдельного workstream на детерминизацию и ускорение `pnpm smoke:cell` после подтверждения, что текущий harness тратит основное время на repeated full deployment-cell lifecycle и readiness polling.
- **v1.1 (2026-03-23):** Выполнен `spec-compact`: зафиксированы suite-scoped lifecycle model, deterministic reset/readiness contract, canonical smoke scope, relative performance-measurement contract и explicit ADR decisions по coverage realignment.
- **v1.2 (2026-03-23):** Выполнен `plan-slice`: работа разложена на 5 delivery slices с явными exit criteria, task IDs, coverage realignment steps и отдельным acceptance closure path для performance evidence и repo-level smoke contract.
- **v1.3 (2026-03-23):** Выполнен `implementation`: `deployment-cell.smoke.ts` переведён на scenario-family scoped lifecycle, full compose boots сокращены до двух на весь suite, межсценарная изоляция заменена на deterministic runtime DB reset + `core` stop/start barriers, fake Telegram API получил explicit reset endpoint, ownership был realigned в `F-0003` и `F-0005`, а measured single-run `pnpm smoke:cell` improved from `133.47s` to `57.13s`.
