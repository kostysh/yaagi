# `@polyphony/state`

Приватный ESM-пакет хранения: согласованный snapshot, атомарный commit нескольких владельцев, проверка/применение миграций и SQLite backup. Первый проверяемый профиль: Linux x64, Node 24.21.0, SQLite 3.53.4, `sqlite-vec` 0.1.9.

Начните с [руководства использования](docs/usage.md) и его [исполняемого примера](examples/usage.ts). Контракт и приёмка — [спецификация](../../docs/modules/state/specification.md), порядок поставки — [план](../../docs/modules/state/implementation-plan.md).

Exports: `@polyphony/state` (`createState` с внедряемым adapter), `/contracts` (нейтральные ports/session), `/adapters/sqlite` (`createSqliteAdapter`, async SQL/BLOB scope и SQLite migrations/backup). Независимые операции координирует SQLite; ожидание выполняется в worker без своей очереди/replay. Импорт не открывает БД и не загружает native SQLite; `core-types` по-прежнему нужен только для `Result`.

Из корня workspace:

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

`test` включает реальные SQLite-проверки, отдельные процессы, M1 с неизменными production core и consumer и guide. Тестовый memory-adapter не production backend. Доменная схема, векторы и политика budgets принадлежат потребителю; runtime/lifecycle агента, единственность инстанса, I1/E3, физическое отключение питания и другие платформы не реализованы этим пакетом.
