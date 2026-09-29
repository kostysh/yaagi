# `@polyphony/state`

Приватный ESM-пакет хранения: согласованный snapshot, атомарный commit нескольких владельцев, проверка/применение миграций и SQLite backup. Первый проверяемый профиль: Linux x64, Node 24.21.0, SQLite 3.53.4, `sqlite-vec` 0.1.9.

Начните с [быстрого старта](docs/usage.md#быстрый-старт): `pnpm --filter @polyphony/state example` из корня установленного workspace запускает безопасный пример на временной БД. Для агента — [рабочая инструкция](AGENTS.md).

В едином [руководстве](docs/usage.md):

- [Путь к файлу, каталог и права](docs/usage.md#путь-к-базе-данных).
- [Создание SQL, release chain и применение миграций](docs/usage.md#миграции).
- [Открытие, чтение и запись](docs/usage.md#открытие-и-обычный-sql), [свои Drizzle/Zod bindings и общий commit](docs/usage.md#владельцы-и-scopes).
- [Как писать SQL-тесты](docs/usage.md#sql-тесты) и [самодостаточный тест для копирования](test/consumer-sql.test.ts).
- [Векторы, budgets, backup и замена backend](docs/usage.md#продвинутые-сценарии), [диагностика ошибок](docs/usage.md#ошибки-и-диагностика).

Полный Drizzle/vector [пример](examples/usage.ts) и [owner bindings](examples/owners.ts) компилируются и выполняются в tests. Контракт — [спецификация](../../docs/modules/state/specification.md), порядок поставки и приёмка — [план](../../docs/modules/state/implementation-plan.md).

Exports: `@polyphony/state` (`createState` с внедряемым adapter), `/contracts` (нейтральные ports/session), `/adapters/sqlite` (`createSqliteAdapter`, async SQL/BLOB scope и SQLite migrations/backup). Независимые операции координирует SQLite; ожидание выполняется в worker без своей очереди/replay. Импорт не открывает БД и не загружает native SQLite; `core-types` по-прежнему нужен только для `Result`.

## Проверки

Из корня workspace (Node/pnpm из корневых `.nvmrc` и `package.json`, сначала `pnpm install --frozen-lockfile`):

```bash
pnpm --filter @polyphony/state format
pnpm --filter @polyphony/state format:check
pnpm --filter @polyphony/state lint
pnpm --filter @polyphony/state typecheck
pnpm --filter @polyphony/state build
pnpm --filter @polyphony/state test
pnpm --filter @polyphony/state test:integration
pnpm --filter @polyphony/state example
```

`test` включает `test:integration`: реальные SQLite-проверки, отдельные процессы, M1 с неизменными production core и consumer, guide и SQL-рецепт. Root-команды рекурсивно вызывают package scripts. Форматирование — только Biome; `lint` — Biome + ESLint + boundary. TypeScript 7 проверяет и собирает код отдельно от Node type stripping.

Тестовый memory-adapter не production backend. Доменная схема, векторы и политика budgets принадлежат потребителю; runtime/lifecycle агента, единственность инстанса, I1/E3, физическое отключение питания и другие платформы не реализованы этим пакетом.
