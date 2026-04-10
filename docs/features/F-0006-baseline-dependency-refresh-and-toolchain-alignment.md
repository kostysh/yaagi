---
id: F-0006
title: Актуализация базовых зависимостей и выравнивание инструментального стека
status: done
coverage_gate: strict
owners: ["@codex"]
area: platform
depends_on: [F-0001, F-0002, F-0003, F-0004, F-0005]
impacts: [runtime, infra, toolchain, dependencies]
created: 2026-03-23
updated: 2026-03-25
links:
  issue: ""
  pr: []
  docs:
    - "docs/architecture/system.md"
    - "README.md"
    - "docs/features/F-0002-canonical-monorepo-deployment-cell.md"
    - "docs/adr/ADR-2026-03-19-canonical-runtime-toolchain.md"
    - "docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md"
---

# F-0006 Актуализация базовых зависимостей и выравнивание инструментального стека

## 1. Контекст и цель

- **Проблема пользователя:** С момента начала реализации базового контура платформы и исполнения версии части зависимостей во всех рабочих пакетах ушли вперёд. Без явного владельца такого потока актуализации репозиторий начинает жить на зафиксированном, но устаревающем наборе зависимостей, а следующие циклы поставки наследуют скрытый дрейф совместимости между состоянием реестра пакетов, `pnpm-lock.yaml` и каноническим контрактом исполнения и инструментального стека.
- **Цель (что считается успехом):** Репозиторий получает один явно пересмотренный базовый набор зависимостей для `root/apps/packages`: все прямые `dependencies` и `devDependencies` проверяются против актуального состояния реестра пакетов, целевые версии фиксируются и внедряются без отхода от канонического пути `Node 22 + pnpm + TypeScript + node --experimental-strip-types + Docker Compose`, а approved repo-level migration от `Mastra` к `AI SDK` становится частью canonical dependency baseline. Связка проверок исполнения, тестов и контейнерного пути `pnpm smoke:cell` должна остаться зелёной уже на новом наборе версий и пакетов.
- **Что не входит в цель:** Введение нового менеджера пакетов, второго штатного контура исполнения, смена архитектурного стека, переразметка уровня фич под видом обновления зависимостей, а также произвольное добавление новых библиотек вне необходимости, вызванной работой по совместимости при обновлении версий, не входят в область этого досье.

## 2. Область

### Входит в область

- Проверка всех прямых зависимостей `dependencies` и `devDependencies`, управляемых через реестр пакетов, в корневом `package.json`, `apps/*/package.json` и `packages/*/package.json`.
- Обновление версий в файлах манифестов и `pnpm-lock.yaml` до нового согласованного базового набора, включая общие библиотеки, используемые в нескольких рабочих пакетах.
- Необходимые правки в коде, конфигурации, тестах и инфраструктуре, без которых мажорные и минорные обновления не проходят на каноническом контуре исполнения.
- Повторная проверка корневого набора проверок качества, быстрых тестов и контейнерного пути `pnpm smoke:cell` на обновлённом наборе зависимостей.
- Выравнивание предпосылок в досье, ADR и README, если новые версии меняют контракты уровня репозитория или ожидания по верификации.

### Вне области

- Замена `pnpm`, `node:test`, `Hono`, Docker Compose или `node --experimental-strip-types` на иной канонический стек без отдельного архитектурного решения, а также любой дальнейший runtime-substrate pivot beyond already accepted move from `Mastra` to `AI SDK`.
- Ручное курирование всего дерева транзитивных зависимостей сверх того, что естественным образом даёт обновление файла блокировок зависимостей.
- Внедрение новых фичевых швов, перенос поведения бизнес- и доменного слоя или рефакторинг, не вызванный совместимостью с обновлёнными версиями.
- Отдельный плановый трек по укреплению безопасности поверх самого обновления версий.

### Ограничения

- Текущий базовый этап для этого шага: `F-0001`–`F-0005` уже поставлены, а поток актуализации должен сохранять их поведение в исполнении и развёртывании как целевую совместимость, а не скрыто переопределять его.
- Канонический контракт уровня репозитория из `F-0002`, `README.md`, `ADR-2026-03-19-canonical-runtime-toolchain.md` и `ADR-2026-03-25-ai-sdk-runtime-substrate.md` сохраняется: `Node.js 22`, `pnpm`, `TypeScript`, `node:test`, `node --experimental-strip-types`, `AI SDK + Hono` как runtime/model substrate, корневая поверхность команд `pnpm` и канонический путь `pnpm smoke:cell`.
- Общие зависимости, используемые в нескольких рабочих пакетах, не должны оставаться в расхождении версий без явной причины и явной записи в досье или ADR.
- Если последняя опубликованная версия требует архитектурного разветвления, несовместимого базового контура исполнения или нарушает уже поставленные контракты фич, блокирующее условие должно быть зафиксировано явно до закрытия фичи, а не маскироваться частичным обновлением.
- Фича должна идти через один согласованный поток работ, а не через несвязанные пакетные апдейты без общего вердикта по совместимости.

## 3. Требования и критерии приёмки (SSoT)

- **AC-F0006-01:** Все прямые зависимости `dependencies` и `devDependencies`, управляемые через реестр пакетов, в `root/apps/packages` проверяются против его актуального состояния, а целевой набор версий для каждой такой зависимости становится явным и трассируемым внутри потока работ.
- **AC-F0006-02:** Версии в файлах манифестов и `pnpm-lock.yaml` обновляются до нового согласованного базового набора так, чтобы общие зависимости не оставались в скрытом дрейфе версий между рабочими пакетами без явного обоснования.
- **AC-F0006-03:** Все изменения в коде, конфигурации, тестах и инфраструктуре, необходимые для совместимости с обновлёнными версиями, внедряются в том же потоке работ без ввода альтернативного контура исполнения, менеджера пакетов или пути автоматизации.
- **AC-F0006-04:** После обновления канонический набор проверок `pnpm quality:fix`, `pnpm test` и `pnpm smoke:cell` проходит на обновлённом наборе зависимостей.
- **AC-F0006-05:** Документы уровня репозитория и предпосылки в досье или ADR, затронутые обновлением зависимостей, выравниваются в том же потоке работ; скрытого дрейфа контрактов после обновления не остаётся.
- **AC-F0006-06:** Если часть зависимостей не может перейти на последнюю опубликованную версию без нарушения канонического базового контура репозитория или уже поставленных контрактов фич, блокирующая причина и принятая целевая версия фиксируются явно до закрытия фичи.

## 4. Нефункциональные требования (NFR)

- **Совместимость:** Новый базовый набор зависимостей должен сохранять работоспособность канонической среды исполнения `Node 22` и текущей ячейки развёртывания.
- **Детерминированность:** Обновление должно оставлять один воспроизводимый файл блокировок зависимостей и одну корневую поверхность команд без особых пакетных исключений.
- **Аудируемость:** Все сохранённые старые версии и вынужденные исключения должны быть объяснены явно, а не потеряться в разнице `pnpm-lock.yaml`.
- **Дисциплина области:** Обновление зависимостей не должно скрыто превращаться в архитектурную миграцию или замаскированную переразметку фичи.
- **Строгость верификации:** Любой апгрейд, затрагивающий поведение исполнения, запуска или развёртывания, должен быть подтверждён не только быстрыми проверками, но и контейнерным путём `pnpm smoke:cell`.

## 5. Design (compact)

### 5.1 Runtime and deployment surface

- `F-0006` не вводит новые сервисы, процессы или runtime path: обновление зависимостей обязано уложиться в уже принятый стек `Node 22 + pnpm + TypeScript + node --experimental-strip-types + node:test + Docker Compose`.
- Область владения фичи:
  - root `package.json` и `pnpm-lock.yaml`;
  - все `package.json` в `apps/*` и `packages/*`;
  - совместимые code/config/test/infra-правки, без которых latest-версии не проходят канонический verification bundle.
- Политика latest-by-default фиксируется как часть shaped-решения:
  - latest published version для каждой прямой зависимости является обязательным target по умолчанию;
  - сохранение не-latest версии допустимо только как явное blocker-решение внутри `F-0006`, а не как молчаливое исключение.
- Политика shared surfaces:
  - одна и та же библиотека в нескольких workspace packages должна иметь один согласованный target version;
  - version split допустим только при явно записанном blocker reason и follow-up.
- В direct-dependency matrix этой фичи входят только registry-managed внешние пакеты; `workspace:*` ссылки на внутренние `@yaagi/*` packages в матрицу не включаются, потому что ими владеет сам монорепозиторий, а не внешний реестр пакетов.

### 5.2 Compatibility matrix and high-risk surfaces

- Полный inventory direct registry-managed dependency surfaces на этапе shaping:

| Пакет | Scope | Current | Latest | Target | Risk | Compatibility owner surface |
| --- | --- | --- | --- | --- | --- | --- |
| `@biomejs/biome` | root devDependency | `2.4.9` | `2.4.9` | `2.4.9` | low | root formatting/lint toolchain |
| `@eslint/js` | root devDependency | `10.0.1` | `10.0.1` | `10.0.1` | low | root ESLint config |
| `@types/node` | root devDependency | `25.5.0` | `25.5.0` | `25.5.0` | medium | root typecheck surface и Node runtime typings |
| `@types/pg` | root devDependency | `8.20.0` | `8.20.0` | `8.20.0` | low | `packages/db` typings |
| `@typescript-eslint/eslint-plugin` | root devDependency | `8.57.2` | `8.57.2` | `8.57.2` | low | root ESLint config |
| `@typescript-eslint/parser` | root devDependency | `8.57.2` | `8.57.2` | `8.57.2` | low | root ESLint config |
| `eslint` | root devDependency | `10.1.0` | `10.1.0` | `10.1.0` | low | root ESLint config |
| `globals` | root devDependency | `17.4.0` | `17.4.0` | `17.4.0` | low | root ESLint config |
| `typescript` | root devDependency | `5.9.3` | `6.0.2` | `5.9.3` | medium | root `tsconfig*` / typecheck toolchain |
| `@mastra/core` | historical `apps/core` dependency | `removed` | `1.15.0` | `removed` | high | `apps/core/src/platform/phase0-ai.ts`, `apps/core/src/runtime/runtime-lifecycle.ts` |
| `ai` | `apps/core` dependency | `6.0.138` | `6.0.138` | `6.0.138` | medium | `apps/core/src/platform/phase0-ai.ts`, `apps/core/test/platform/phase0-ai.integration.test.ts` |
| `@ai-sdk/openai-compatible` | `apps/core` dependency | `2.0.37` | `2.0.37` | `2.0.37` | medium | `apps/core/src/platform/phase0-ai.ts`, `apps/core/src/runtime/runtime-lifecycle.ts` |
| `chokidar` | `apps/core` dependency | `5.0.0` | `5.0.0` | `5.0.0` | high | `apps/core/src/perception/filesystem-adapter.ts` |
| `hono` | `apps/core` dependency | `4.12.9` | `4.12.9` | `4.12.9` | low | `apps/core/src/platform/core-runtime.ts` |
| `zod` | `apps/core`, `packages/contracts` dependency | `4.3.6` | `4.3.6` | `4.3.6` | high | `packages/contracts/src/perception.ts`, `apps/core/src/platform/core-config.ts`, `apps/core/src/platform/core-runtime.ts` |
| `pg` | `packages/db` dependency | `8.20.0` | `8.20.0` | `8.20.0` | low | `packages/db` PostgreSQL driver surface |
| `pg-boss` | `packages/db` dependency | `12.14.0` | `12.14.0` | `12.14.0` | medium | `packages/db` bootstrap/runtime queue surface |

- `zod 4` считается обязательной целевой версией с высоким риском совместимости.
  - Подтверждённые owner surfaces:
    - `packages/contracts/src/perception.ts`
    - `apps/core/src/platform/core-config.ts`
    - `apps/core/src/platform/core-runtime.ts`
  - Shaped expectation: если `zod 4` требует кодовых правок, они выполняются в том же workstream; удержание `zod 3` без blocker record запрещено.
- `chokidar 5` считается обязательной целевой версией с высоким риском совместимости.
  - Подтверждённый owner surface:
    - `apps/core/src/perception/filesystem-adapter.ts`
  - Shaped expectation: проверяется import/runtime behavior watcher-а и lifecycle-совместимость без расширения scope perception feature.
- `@mastra/core 1.15.0` больше не является допустимым target dependency.
  - Подтверждённые owner surfaces:
    - `apps/core/src/platform/phase0-ai.ts`
    - `apps/core/src/runtime/runtime-lifecycle.ts`
  - Implemented verdict: пакет удалён из canonical dependency set вместе с historical bootstrap boundary; transitional exception path не используется.
- `ai 6.0.138` считается обязательной целевой версией со средним риском.
  - Подтверждённые owner surfaces:
    - `apps/core/src/platform/phase0-ai.ts`
    - `apps/core/test/platform/phase0-ai.integration.test.ts`
  - Implemented verdict: structured-generation/runtime contracts и schema-validated output parsing подтверждены на delivered phase-0 boundary.
- `@ai-sdk/openai-compatible 2.0.37` считается обязательной целевой версией со средним риском.
  - Подтверждённые owner surfaces:
    - `apps/core/src/platform/phase0-ai.ts`
    - `apps/core/src/runtime/runtime-lifecycle.ts`
  - Implemented verdict: local OpenAI-compatible provider wiring against `vllm-fast` and the selected-profile runtime contract is now the canonical delivered path.
- `typescript 6.0.2` зафиксирован как explicit blocker record.
  - Подтверждённые owner surfaces:
    - `package.json`
    - `tsconfig.typecheck.json`
    - `eslint.config.js`
  - Reason: latest `@typescript-eslint/eslint-plugin` / `@typescript-eslint/parser` line (`8.57.2`) still declares `typescript@>=4.8.4 <6.0.0`, so adopting `typescript 6.0.2` would reintroduce a peer-incompatible toolchain.
  - Accepted target version: `5.9.3`.
  - Next unblock condition: upgrade to an officially compatible `@typescript-eslint` release that supports TypeScript 6 without breaking the canonical `pnpm quality:fix` gate.
- `hono`, `eslint`, `@types/node`, `@types/pg` относятся к low/medium-risk refresh, но всё равно проходят полный canonical verification bundle.

### 5.3 Exception policy and blocker handling

- Допустимы только два исхода для каждой прямой зависимости:
  - обновлена до latest published version;
  - временно удержана не на latest с явно записанными `reason`, `accepted_target_version` и `next_unblock_condition`.
- Блокером считается только одно из следующего:
  - latest требует отклонения от канонического runtime/toolchain baseline;
  - latest ломает delivered feature contracts, и совместимая правка выходит за scope `F-0006`;
  - latest требует новой архитектурной развилки или нового repo-level ADR.
- Не считаются достаточным blocker reason:
  - “слишком большой diff”;
  - “надо ещё посмотреть”;
  - “minor/patch безопаснее”.

### 5.4 Verification surface

- Обязательный verification bundle для закрытия фичи:
  - `pnpm quality:fix`
  - `pnpm test`
  - `pnpm smoke:cell`
- Дополнительные compatibility expectations по high-risk пакетам:
  - `zod`: contracts/env parsing продолжают валидироваться на том же wire/config contract;
  - `chokidar`: filesystem watcher продолжает стартовать, эмитить события и корректно закрываться;
  - `ai` / `@ai-sdk/openai-compatible`: phase-0 runtime и bounded cognition harness продолжают поднимать structured-generation/provider wiring без type/runtime regressions.
- Docs realignment входит в verification surface: если latest-версии меняют repo-level assumptions, README/dossier/ADR должны быть обновлены в том же workstream.

### 5.5 Edge cases

- Latest published version существует, но тянет несовместимое изменение, которое ломает only one workspace package while shared version policy requires repo-wide alignment.
- `zod 4` проходит typecheck локально, но меняет parsing behavior в env/runtime contract.
- `chokidar 5` проходит fast checks, но ломает containerized file-watching behavior inside `pnpm smoke:cell`.
- `AI SDK` packages compile, но provider wiring or structured-generation behavior may drift relative to the historical Mastra implementation.
- Обновление devDependency меняет lint/type surface и вскрывает скрытый drift в уже delivered code; это не считается поводом откладывать realignment.
- Lockfile refresh обновляет транзитивные версии так, что smoke path падает без изменения direct manifests; это всё равно остаётся в scope `F-0006`.

## 6. Definition of Done

- Для каждой прямой registry-managed зависимости из root/apps/packages зафиксированы `current`, `latest`, `target`, `risk tier` и `compatibility owner surface`.
- Политика latest-by-default и policy исключений больше не остаются неявными.
- Любая удержанная не-latest версия имеет явный blocker record внутри `F-0006`.
- Shared dependency surfaces не остаются в скрытом version split между workspace packages.
- Полный canonical verification bundle проходит на обновлённом dependency set.
- Документы уровня репозитория, затронутые refresh, выровнены в том же workstream.
- `docs/ssot/index.md` синхронизирован, dossier lint проходит без ошибок, а warnings сведены к допустимым для текущего статуса.

## 7. Slicing plan (2–6 increments)

### Slice SL-F0006-01: Полный dependency verdict и root toolchain refresh
Delivers: explicit repo-wide verdict по всем прямым registry-managed зависимостям и обновление root toolchain surfaces, которые уже отстают от latest.
Covers: AC-F0006-01, AC-F0006-02, AC-F0006-06
Verification: `audit`, `typecheck`
Exit criteria:
- Все root `devDependencies` имеют explicit `current/latest/target` verdict в рамках workstream.
- `@types/node`, `@types/pg` и `eslint` обновлены до target version либо имеют явный blocker record.
- Already-current root packages (`@biomejs/biome`, `@eslint/js`, `@typescript-eslint/*`, `globals`, `typescript`) подтверждены как `current = latest = target` и не требуют скрытых follow-up decisions.
Tasks:
- **T-F0006-01:** Обновить root `devDependencies`, которые реально отстают от latest, и зафиксировать итоговый target set без скрытого drift. Covers: AC-F0006-01, AC-F0006-02.
- **T-F0006-02:** Явно подтвердить no-op verdict для already-current root toolchain packages и исключить повторное принятие этих решений на implementation шаге. Covers: AC-F0006-01, AC-F0006-06.

### Slice SL-F0006-02: Миграция contracts/config на `zod 4`
Delivers: единый `zod 4` baseline для `apps/core` и `packages/contracts` вместе со всеми compatibility fixes на contract/config/runtime surfaces.
Covers: AC-F0006-01, AC-F0006-02, AC-F0006-03, AC-F0006-04
Verification: `integration`, `typecheck`
Exit criteria:
- `zod` обновлён до `4.3.6` во всех shared dependency surfaces без version split.
- Contract schemas, env parsing и runtime validation paths продолжают работать на том же canonical wire/config contract.
- Удержание `zod 3` исключено либо оформлено как явный blocker согласно `AC-F0006-06`.
Tasks:
- **T-F0006-03:** Обновить `zod` в `apps/core` и `packages/contracts` до общего target version и пересобрать shared dependency surface без split. Covers: AC-F0006-01, AC-F0006-02.
- **T-F0006-04:** Выровнять contract schemas, env parsing и runtime validation code под `zod 4` без изменения delivered feature behavior. Covers: AC-F0006-03, AC-F0006-04.

### Slice SL-F0006-03: Migrate the phase-0 runtime substrate to AI SDK
Delivers: актуализированный `apps/core` runtime library set вокруг `ai`, `@ai-sdk/openai-compatible` и `hono` без отклонения от канонического phase-0 bootstrap path.
Covers: AC-F0006-02, AC-F0006-03, AC-F0006-04
Verification: `integration`, `runtime`
Exit criteria:
- `ai`, `@ai-sdk/openai-compatible` и `hono` приведены к target versions.
- Historical Mastra bootstrap removed from the canonical runtime path, while `GET /health` continues to work without type/runtime regressions.
- Никакой новый runtime path, второй runner или framework-specific workaround не introduced.
Tasks:
- **T-F0006-05:** Добавить `ai@6.0.138` и выровнять bounded structured-generation usage под canonical cognition/runtime contracts. Covers: AC-F0006-02, AC-F0006-03.
- **T-F0006-06:** Добавить `@ai-sdk/openai-compatible@2.0.37`, убрать `@mastra/core` и подтвердить совместимость health/runtime boundary на target versions. Covers: AC-F0006-02, AC-F0006-03, AC-F0006-04.

### Slice SL-F0006-04: Refresh `chokidar 5` и runtime filesystem compatibility
Delivers: актуализированный filesystem-watching surface без regressions в perception runtime и containerized execution path.
Covers: AC-F0006-02, AC-F0006-03, AC-F0006-04
Verification: `integration`, `smoke`
Exit criteria:
- `chokidar` обновлён до `5.0.0`.
- `filesystem-adapter` сохраняет корректный import/runtime/lifecycle behavior.
- Containerized verification не выявляет regressions в file-watching surface.
Tasks:
- **T-F0006-07:** Обновить `chokidar` в `apps/core` и выровнять `filesystem-adapter` под его target runtime contract. Covers: AC-F0006-02, AC-F0006-03.
- **T-F0006-08:** Подтвердить file-watching compatibility в fast tests и smoke path, не добавляя новый infra/runtime fork. Covers: AC-F0006-04.

### Slice SL-F0006-05: Lockfile closure, blocker recording, docs realignment и acceptance
Delivers: один финальный `pnpm-lock.yaml`, explicit blocker records при необходимости, repo-level doc realignment и полный canonical verification closure.
Covers: AC-F0006-01, AC-F0006-02, AC-F0006-03, AC-F0006-04, AC-F0006-05, AC-F0006-06
Verification: `audit`, `integration`, `smoke`
Exit criteria:
- Один итоговый `pnpm-lock.yaml` отражает согласованный direct dependency baseline без скрытых package-local exceptions.
- Все retained non-latest packages, если они останутся, имеют blocker record с `reason`, `accepted_target_version`, `next_unblock_condition`.
- `README.md`, dossier и ADR realignment завершены там, где latest refresh реально меняет repo-level assumptions.
- `pnpm quality:fix`, `pnpm test`, `pnpm smoke:cell` проходят на итоговом dependency set.
Tasks:
- **T-F0006-09:** Финализировать `pnpm-lock.yaml` и исключить скрытый version split по shared dependency surfaces. Covers: AC-F0006-02.
- **T-F0006-10:** Зафиксировать blocker records для каждого retained non-latest package или явно отметить, что исключений не осталось. Covers: AC-F0006-06.
- **T-F0006-11:** Выполнить и задокументировать repo-level doc realignment там, где refresh меняет assumptions или verification notes. Covers: AC-F0006-05.
- **T-F0006-12:** Закрыть feature через полный canonical verification bundle и AC-linked evidence. Covers: AC-F0006-04.

## 8. Test plan & Coverage map

| AC ID | Verification reference | Status |
| --- | --- | --- |
| AC-F0006-01 | `pnpm outdated -r --format json` и полный direct registry-managed version matrix в разделе `5.2` | done |
| AC-F0006-02 | [package.json](/code/projects/yaagi/package.json), [apps/core/package.json](/code/projects/yaagi/apps/core/package.json), [packages/contracts/package.json](/code/projects/yaagi/packages/contracts/package.json) и `pnpm-lock.yaml` обновлены до target versions без hidden direct version split | done |
| AC-F0006-03 | [perception.ts](/code/projects/yaagi/packages/contracts/src/perception.ts) адаптирован под `zod 4`; compatibility surfaces для `zod`, `ai`, `@ai-sdk/openai-compatible`, `chokidar` подтверждены командами `pnpm typecheck`, `pnpm test`, `pnpm smoke:cell`; [phase0-ai.integration.test.ts](/code/projects/yaagi/apps/core/test/platform/phase0-ai.integration.test.ts) подтверждает delivered AI SDK provider wiring и refusal semantics | done |
| AC-F0006-04 | `pnpm quality:fix`, `pnpm test`, `pnpm smoke:cell` | done |
| AC-F0006-05 | [README.md](/code/projects/yaagi/README.md), [ADR-2026-03-19-canonical-runtime-toolchain.md](/code/projects/yaagi/docs/adr/ADR-2026-03-19-canonical-runtime-toolchain.md) и [ADR-2026-03-25-ai-sdk-runtime-substrate.md](/code/projects/yaagi/docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md) выровнены по новому repo-level runtime contract | done |
| AC-F0006-06 | Explicit blocker record: `typescript@5.9.3` retained against `latest = 6.0.2` because latest `@typescript-eslint 8.57.2` peer range still caps at `<6.0.0`; no other direct-dependency exceptions remain | done |

## 9. Decision log (ADR blocks)

### ADR-F0006-01 Latest-by-default refresh policy

- **Context:** Пользовательский intent для `F-0006` зафиксирован как обновление зависимостей “до самых свежих”, а не selective safe refresh.
- **Decision:** Для всех прямых `dependencies` и `devDependencies` latest published version становится обязательным target по умолчанию.
- **Consequences:** Implementation не может тихо удержать старую версию ради удобства; любое исключение требует явного blocker record.

### ADR-F0006-02 Canonical verification gate

- **Context:** Dependency refresh влияет одновременно на toolchain, runtime, tests и container smoke.
- **Decision:** Единственный достаточный completion gate для `F-0006` — `pnpm quality:fix`, `pnpm test`, `pnpm smoke:cell`.
- **Consequences:** Частичные “зелёные” fast checks не закрывают фичу, если containerized smoke path остаётся сломанным.

### ADR-F0006-03 High-risk compatibility ownership

- **Context:** Не все latest upgrades несут одинаковый риск; без shaped ownership high-risk пакеты начнут обрабатываться ad hoc.
- **Decision:** `zod`, `chokidar`, `ai` и `@ai-sdk/openai-compatible` фиксируются как пакеты с явным compatibility ownership и обязательной code-level проверкой на подтверждённых owner surfaces.
- **Consequences:** Workstream нельзя будет размыть до одного lockfile diff без точечных compatibility fixes там, где они реально нужны.

### ADR-F0006-04 Runtime substrate migration is part of the dependency baseline, not a follow-up exception

- **Context:** После принятия ADR `2026-03-25` сохранение `@mastra/core` как "временной" зависимости перестало быть допустимым neutral state: это уже скрытый drift относительно canonical runtime substrate.
- **Decision:** `F-0006` обязан закрыть migration на dependency level полностью: direct dependency set for `apps/core` must move from `@mastra/core` to `ai` + `@ai-sdk/openai-compatible`, without treating the old framework as a tolerated transitional exception.
- **Consequences:** Пока dependency set не мигрирован, `F-0006` не может считаться `done`, even if the historical latest-refresh workstream had previously closed successfully.

## 10. Progress & links

- Статус: `done` -> `planned` -> `done`
- Задача: -
- PRs:
  - -
- Code:
  - `package.json`
  - `apps/core/package.json`
  - `docs/adr/ADR-2026-03-25-ai-sdk-runtime-substrate.md`
  - `apps/core/src/platform/phase0-ai.ts`
  - `apps/core/src/runtime/runtime-lifecycle.ts`
  - `apps/core/test/platform/phase0-ai.integration.test.ts`
  - `infra/docker/vllm-fast/server.py`
  - `packages/contracts/package.json`
  - `packages/contracts/src/perception.ts`
  - `infra/docker/compose.yaml`
  - `infra/docker/deployment-cell.smoke.ts`
  - `test/platform/dependency-refresh.test.ts`
  - `pnpm-lock.yaml`
- Verification:
  - `pnpm outdated -r --format json`
  - `pnpm quality:fix`
  - `pnpm test`
  - `pnpm smoke:cell`
  - `dossier-engineer sync-index`
  - `dossier-engineer lint-dossiers`
  - `dossier-engineer coverage-audit`
  - `dossier-engineer debt-audit --changed-only`

## 11. Журнал изменений (Change log)

- **v1.0 (2026-03-23):** Создано исходное досье, чтобы закрепить владельца за общерепозиторным потоком актуализации зависимостей после аудита реестра пакетов, показавшего, что несколько прямых зависимостей уже ушли вперёд относительно текущего поставленного базового контура.
- **v1.1 (2026-03-23):** Выполнен `spec-compact`: зафиксированы latest-by-default policy, exception policy, compatibility ownership для high-risk пакетов, canonical verification gate и AC-linked coverage map.
- **v1.2 (2026-03-23):** Выполнен `plan-slice`: работа разложена на 5 delivery slices с явными exit criteria, task IDs и acceptance closure path без скрытого сужения scope.
- **v1.3 (2026-03-23):** Выполнен `implementation`: все direct registry-managed зависимости обновлены до latest published versions, `zod 4`-совместимость зафиксирована в коде, Telegram/container smoke укреплён через параметризуемый `core` host-port и детерминированный cleanup compose-ресурсов между тестами, canonical verification bundle пройден, а внешний transitive peer-warning seam под `@mastra/core 1.15.0` вынесен в явное решение вместо скрытого install noise.
- **v1.4 (2026-03-25):** `change-proposal`: после принятия repo-level ADR о переходе на `AI SDK` feature reopened. `F-0006` теперь включает обязательную замену `@mastra/core` на `ai@6.0.138` и `@ai-sdk/openai-compatible@2.0.37`, обновляет compatibility matrix под новый substrate и возвращается в `planned` до полного dependency/runtime refactor closure.
- **v1.5 (2026-03-25):** Completed the dependency/runtime migration: `apps/core` now depends on `ai@6.0.138` and `@ai-sdk/openai-compatible@2.0.37`, the historical `@mastra/core` dependency is removed, the phase-0 runtime invokes selected-profile endpoints through the repo-owned AI SDK adapter, the local `vllm-fast` stub speaks AI SDK JSON response negotiation, root tooling refresh reaches `@biomejs/biome 2.4.9` and `@typescript-eslint 8.57.2`, and the only retained non-latest direct dependency is an explicit `typescript 5.9.3` blocker caused by the latest `@typescript-eslint` peer range still capping at `<6.0.0`.
