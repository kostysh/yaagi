# Локальные инструменты

- Document ID: `project.methodology.tooling`

Минимальная среда использует baseline [архитектуры, §2.1](../architecture.md#21-проверенный-технологический-baseline). `@polyphony/core-types` реализует только compile-time контракт `Result<T, E>`; runtime Полифонии и продуктовых тестов пока нет. После принятого CP1 пакет [`@polyphony/state`](../../packages/state/README.md) добавляет SQLite snapshots/transactions, миграции и backup; Drizzle/vec0, M1 и guide проверяются через public exports. [Локальные S1/S2](../../experiments/state/README.md) сохранены как отдельное evidence. Очереди, модели и AI SDK остаются последующими задачами по [roadmap](../roadmap.md).

## Установка

В корне task-worktree, при активном Node.js `24.21.0`:

```bash
nvm use # если Node управляется через nvm
npm install --global pnpm@10.34.5
pnpm --version
pnpm install --frozen-lockfile
```

`pnpm` устанавливается через `npm -g` для активного Node.js. Поле `packageManager` и workspace-настройки проверяют точную версию; автоматическое скачивание/переключение package manager отключено. `.nvmrc` фиксирует Node. При переходе на другой Node установка глобального pnpm для него проверяется отдельно.

Корневые devDependencies фиксируют Biome `2.5.14`, ESLint `10.11.0` и `typescript-eslint` `8.71.0`. TypeScript установлен в переходной side-by-side конфигурации:

- `@typescript/native` указывает на `typescript@7.0.2` и предоставляет исполняемый `tsc`; только он выполняет semantic typecheck и emit проекта;
- `typescript` указывает на `@typescript/typescript6@6.0.2` и предоставляет совместимый compiler API для syntax-only правил `typescript-eslint`;
- ESLint не использует type-aware configuration, project service или TypeScript 6 для проверки типов.

Такое разделение следует [рекомендации TypeScript 7 для side-by-side запуска](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-60) и учитывает [границы совместимости typescript-eslint](https://typescript-eslint.io/users/dependency-versions/). Lockfile фиксирует разрешённые версии и integrity зависимостей. Необходимое обновление сначала сверяется с архитектурой и проверяется; произвольная смена baseline не является частью установки.

## Граница пакета

Весь авторский исполняемый код, включая tooling scripts и конфигурацию, пишется на TypeScript, без `.mjs`/JavaScript-исходников. Прямой запуск `.ts` через Node всегда содержит явный `--experimental-strip-types`; type stripping не заменяет отдельный TypeScript typecheck. Сгенерированный JS и код сторонних зависимостей не переписываются. Для directly-run scripts используется erasable syntax; package source по-прежнему компилируется в ESM.

`pnpm-workspace.yaml` включает только `packages/*`. Пакет создаётся после подготовки своей спецификации и плана; текущий `packages/core-types` следует [спецификации инкремента](../modules/core-types/specification.md).

- Имя пакета — `@polyphony/<module-id>`, `type` — `module`. Соседние пакеты подключаются через `workspace:*` и публичные exports, а не через private source paths.
- Собственный `tsconfig.json` наследует корневой `tsconfig.base.json`. Пакет сам задаёт `include`, `rootDir`, `outDir` и границы тестов. Общая база не выбирает файлы пакетов и не заменяет их typecheck.
- База включает `strict`, `NodeNext`, `verbatimModuleSyntax`, emit declarations и запрет emit при ошибках. Компилируется TypeScript; Node запускает полученный ESM. Относительные импорты должны разрешаться в итоговые JS-файлы. Node/DOM и другие дополнительные типы подключает нуждающийся в них пакет.
- Собственный `biome.json` задаёт `root: false` и `extends: ["../../biome.json"]`, наследуя корневые formatting/lint настройки через явный относительный путь. Проверяются исходники своего пакета; generated output игнорируется согласно Git ignore. Основание: [Biome в монорепозитории](https://biomejs.dev/guides/big-projects/).
- `format` и `format:check` выполняет только Biome. `lint` каждого TypeScript-пакета обязательно запускает Biome, ESLint и проверку package boundary; один инструмент не заменяет остальные.
- Корневые `javascript.formatter.quoteStyle: "single"` и `jsxQuoteStyle: "single"` задают одинарные кавычки для TypeScript/JSX; package configs и эксперимент наследуют их без overrides. JSON сохраняет обязательные для своего синтаксиса двойные кавычки.
- Каждый пакет кода предоставляет `format`, `format:check`, `lint`, `typecheck`, `build`, `test`; для adapter добавляется `test:integration` по §4.4 архитектуры. Выбор конкретных тестов относится к спецификации и плану пакета.

Общий `eslint.config.ts` использует syntax-only recommended rules. ESLint запускается через Node с `--experimental-strip-types` и `--flag unstable_native_nodejs_ts_config`: конфигурация загружается нативно, без дополнительного loader. Это [режим ESLint для TS-конфигурации](https://eslint.org/docs/latest/use/configure/configuration-files#native-typescript-support). Для текущего import-free `core-types` он дополнительно запрещает в `src` static и dynamic imports, import types, TypeScript import assignments, `require` и re-exports. Узкий package-local TypeScript boundary script проверяет отсутствие dependency-полей и ровно один корневой export на JS и declarations. Это проверка текущей границы уровня 0, а не универсальный dependency graph framework. Отдельный `tsconfig.tools.json` проверяет Node-скрипты и общий ESLint config через TypeScript 7; root devDependency `@types/node@24.19.0` обслуживает только tooling, а source/test configs `core-types` сохраняют `types: []`.

`state` предоставляет root (`createState`), `/contracts` и `/adapters/sqlite` (`createSqliteAdapter` и technical SQL/BLOB types). Core исполняет общий callback/Result protocol с внедряемым adapter; M1 использует именно этот core с двумя adapters, не две копии всего порта. Boundary script проверяет exports/dependencies и отрицательные ESLint cases для Node/native/backend imports в core/contracts и private imports соседнего пакета. Contracts/core отдельно проверяются с `types: []` и стандартной Web-lib для monotonic performance, без Node types; runtime import-probe запрещает Node/native-загрузку при импорте каждого export. SQLite adapter lazily создаёт worker/connection на операцию; synchronous native wait не блокирует главный поток, собственной очереди/pool/replay нет. Drizzle и raw vector SQL внутри scope используют один connection/transaction. Для чистой установки state перед typecheck/build собирает публичную зависимость core-types. Drizzle остаётся devDependency owner fixtures/guide, SQLitevec и Zod — runtime dependencies; addon-драйвер или native build scripts в workspace не нужны. Drizzle Kit и его узкие build-разрешения остаются только в standalone S1. Worker/fault/native concurrency regressions входят в package/root test; standalone worker probe сохраняется отдельно и не подменяет CI.

NodeNext и Node emit — профиль текущей desktop-сборки. Общие contracts и доменная логика не получают зависимость от Node-only API/types; native SQLite/queue adapters отделяются exports по §2.3 архитектуры. Expo/Metro, mobile adapters и сборки сейчас не устанавливаются и не проверяются.

Корневые команды одноимённы и рекурсивно вызывают scripts пакетов. Они не содержат копий package-level логики. Ошибка команды пакета должна завершать корневую команду ошибкой.

## Проверка bootstrap и первого пакета

Установка должна повторяться с `--frozen-lockfile`. Bootstrap ранее проверен на временном некоммитимом workspace-пакете: наследование конфигураций, форматирование, lint, typecheck, сборка JS/declarations, выполнение результата через Node и передача ошибок корневой команде. Временный пакет удалён, а lockfile содержит только реальный состав workspace.

`core-types` отдельно проверяет положительные и отрицательные compile-time fixtures через публичный package export, declarations, ESM import-smoke и package boundary. Эти проверки доказывают только контракт `Result<T, E>` и разрешение пакета, но не runtime-возможность агента. Результаты bootstrap фиксируются в [Issue #16](https://github.com/kostysh/yaagi/issues/16), текущего инкремента — в [Issue #23](https://github.com/kostysh/yaagi/issues/23).

GitHub Actions workflow `.github/workflows/ci.yml` запускает те же корневые `format:check`, `lint`, `typecheck`, `build` и `test` для pull request и последующего push в `develop` или `master`. Корневые команды через рекурсивный `pnpm run` выполняют одноимённый script в каждом workspace-пакете, где он определён; отсутствие обязательного script в TypeScript-пакете остаётся нарушением package contract. Workflow использует зафиксированные Node/pnpm и frozen lockfile, read-only `contents` permission и immutable action revisions. Наличие workflow не заменяет успешный GitHub run перед merge и не доказывает runtime-возможность агента; E1–E3 ещё не запускались.
