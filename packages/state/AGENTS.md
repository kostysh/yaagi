# Инструкция агенту: использовать `state`

Начните с [быстрого старта](docs/usage.md#быстрый-старт), затем выберите рецепт ниже.
Полный контракт — [спецификация](../../docs/modules/state/specification.md),
приёмка и статус — [план](../../docs/modules/state/implementation-plan.md).
Не требуется читать private реализацию, чтобы подключить нового владельца.

## Маршрут работы

1. Найдите composition root и владельца данных. Уточните, используется общий файл
   или отдельный: разные файлы не имеют общего атомарного commit. Не создавайте
   собственную БД модулю только потому, что его adapter лежит рядом с ним.
2. Настройте [путь и приватный каталог](docs/usage.md#путь-к-базе-данных) в root.
   У state нет default path/env-переменной; относительный path зависит от cwd.
   Для теста — новый `mkdtempSync` и реальный файл, не рабочая БД и не `:memory:`.
3. Опишите owner-prefixed таблицы, доменные DTO/Zod и запросы у владельца.
   [Drizzle binding](examples/owners.ts) показывает локальный `sqlite-proxy`;
   это пример для адаптации, не production export. Consumer получает owner-порт.
4. При изменении схемы следуйте [рецепту миграций](docs/usage.md#миграции): общий
   Drizzle Kit config → generated/custom SQL → review → immutable release chain.
   Kit генерирует, **state.migrate применяет**. Не запускайте Kit push/migrate
   или ORM migrator поверх этой БД, не редактируйте journal/применённые SQL.
   Проверьте доставку `.sql`: `tsc` их не копирует.
5. Соберите `createState(adapter, bindOwners)`, явно check/migrate до рабочей
   нагрузки. Для общего commit передавайте владельцам один callback scope;
   не открывайте независимую транзакцию внутри owner-метода.
6. Добавьте [SQL-тесты](docs/usage.md#sql-тесты) в пакет владельца. Начальный
   шаблон — [consumer-sql.test.ts](test/consumer-sql.test.ts): public exports,
   временная БД, точные assertions, rollback и reopen. Подставьте **свои реальные
   release artifacts**. Для schema delta проверьте fresh/upgrade/repeat/failure.
7. Выполните проверки пакета-владельца. При изменении state или его примеров —
   [весь список package checks](README.md#проверки) и затронутые root gates.
   В отчёте различайте проверенный SQL boundary и ещё не проверенный domain flow.

## Границы, которые нельзя потерять

- Public imports потребителя: `@polyphony/state` (`createState`), `/contracts`,
  `/adapters/sqlite`; не `src`/`dist`/test helpers другого пакета. Общие contracts
  и ядро без SQL/Node/native API. Backend выбирает composition root.
- `readSnapshot` возвращает DTO, `transact` — `Result`. SQL только параметризован,
  все вызовы awaited. Handles действуют только внутри callback. SQL failure
  отравляет scope даже после catch; не продолжайте записи и не выносите ORM client.
- Перед каждым open/check/migrate/backup/read/transact передавайте живой signal
  и оставшийся budget. `close` не отменяется и должен завершиться до удаления
  временной БД. Не ждите close или отдельный nested writer из своего callback.
- Параллельные независимые операции координирует БД; owner queue/replay не нужны.
  `busy` не означает «state уже занят» — [диагностика](docs/usage.md#ошибки-и-диагностика).
  SQLite синхронна внутри worker; Promise не даёт hard interrupt.
- Таблицы, revisions/conflicts, Zod validation и vector semantics — у владельца.
  Model/network работа — после snapshot. Agent lifecycle, exclusivity/process
  locks и универсальный repository в state не добавляются.
- Для [backup](docs/usage.md#backup-и-восстановление) используйте adapter,
  не файловую копию живой БД. Пакетная/worker граница доверенного кода — не sandbox.
- Исходники, скрипты и executable configs — TypeScript, не `.mjs`/JS.
  Прямой запуск `.ts` требует `node --experimental-strip-types`; типы отдельно
  проверяет TypeScript 7. Biome форматирует одинарными кавычками; lint включает
  Biome + ESLint + boundary.

Продвинутые рецепты: [vector SQL/BLOB, budgets, backup, смена adapter](docs/usage.md#продвинутые-сценарии).
[M1](test/m1.test.ts) проверяет неизменный consumer с двумя adapters и одним core,
но не заменяет реальные SQLite tests и не доказывает durability тестового двойника.
