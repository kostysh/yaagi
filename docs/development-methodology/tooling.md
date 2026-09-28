# Локальные инструменты

- Document ID: `project.methodology.tooling`

Минимальная среда использует baseline [архитектуры, §2.1](../architecture.md#21-проверенный-технологический-baseline). Первый пакет `@polyphony/core-types` реализует только compile-time контракт `Result<T, E>`; runtime Полифонии и продуктовых тестов пока нет. SQLite adapters, векторное расширение, очереди, модели, AI SDK и CI будут подготовлены отдельными последующими задачами по [roadmap](../roadmap.md).

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

`pnpm-workspace.yaml` включает только `packages/*`. Пакет создаётся после подготовки своей спецификации и плана; текущий `packages/core-types` следует [спецификации инкремента](../modules/core-types/specification.md).

- Имя пакета — `@polyphony/<module-id>`, `type` — `module`. Соседние пакеты подключаются через `workspace:*` и публичные exports, а не через private source paths.
- Собственный `tsconfig.json` наследует корневой `tsconfig.base.json`. Пакет сам задаёт `include`, `rootDir`, `outDir` и границы тестов. Общая база не выбирает файлы пакетов и не заменяет их typecheck.
- База включает `strict`, `NodeNext`, `verbatimModuleSyntax`, emit declarations и запрет emit при ошибках. Компилируется TypeScript; Node запускает полученный ESM. Относительные импорты должны разрешаться в итоговые JS-файлы. Node/DOM и другие дополнительные типы подключает нуждающийся в них пакет.
- Собственный `biome.json` задаёт `root: false` и `extends: ["../../biome.json"]`, наследуя корневые formatting/lint настройки через явный относительный путь. Проверяются исходники своего пакета; generated output игнорируется согласно Git ignore. Основание: [Biome в монорепозитории](https://biomejs.dev/guides/big-projects/).
- `format` и `format:check` выполняет только Biome. `lint` каждого TypeScript-пакета обязательно запускает Biome, ESLint и проверку package boundary; один инструмент не заменяет остальные.
- Каждый пакет кода предоставляет `format`, `format:check`, `lint`, `typecheck`, `build`, `test`; для adapter добавляется `test:integration` по §4.4 архитектуры. Выбор конкретных тестов относится к спецификации и плану пакета.

Общий `eslint.config.mjs` использует syntax-only recommended rules. Для текущего import-free `core-types` он дополнительно запрещает в `src` static и dynamic imports, import types, TypeScript import assignments, `require` и re-exports. Узкий package-local boundary script проверяет отсутствие dependency-полей и ровно один корневой export на JS и declarations. Это проверка текущей границы уровня 0, а не универсальный dependency graph framework.

NodeNext и Node emit — профиль текущей desktop-сборки. Общие contracts и доменная логика не получают зависимость от Node-only API/types; native SQLite/queue adapters отделяются exports по §2.3 архитектуры. Expo/Metro, mobile adapters и сборки сейчас не устанавливаются и не проверяются.

Корневые команды одноимённы и рекурсивно вызывают scripts пакетов. Они не содержат копий package-level логики. Ошибка команды пакета должна завершать корневую команду ошибкой.

## Проверка bootstrap и первого пакета

Установка должна повторяться с `--frozen-lockfile`. Bootstrap ранее проверен на временном некоммитимом workspace-пакете: наследование конфигураций, форматирование, lint, typecheck, сборка JS/declarations, выполнение результата через Node и передача ошибок корневой команде. Временный пакет удалён, а lockfile содержит только реальный состав workspace.

`core-types` отдельно проверяет положительные и отрицательные compile-time fixtures через публичный package export, declarations, ESM import-smoke и package boundary. Эти проверки доказывают только контракт `Result<T, E>` и разрешение пакета, но не runtime-возможность агента. Результаты bootstrap фиксируются в [Issue #16](https://github.com/kostysh/yaagi/issues/16), текущего инкремента — в [Issue #23](https://github.com/kostysh/yaagi/issues/23). CI остаётся отдельной обязательной задачей до merge или поставки первого модуля по [политике качества](quality.md); E1–E3 ещё не запускались.
