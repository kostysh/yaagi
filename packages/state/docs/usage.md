# Сохранить и прочитать данные нескольких владельцев

Для разработчика owner adapter и composition root. Требуются workspace install, Linux x64 и Node 24.21.0. Проверяемый путь целиком находится в [examples/usage.ts](../examples/usage.ts), ORM/DTO — в [examples/owners.ts](../examples/owners.ts). Из корня репозитория:

```bash
pnpm --filter @polyphony/state example
```

Команда компилирует пример TypeScript 7, выполняет общий commit, vector query, rollback, backup и reopen во временном каталоге и удаляет только этот каталог. Ожидается `state guide: commit, vector query, rollback, backup and reopen passed`. Тот же пример включён в `pnpm test` и CI.

## 1. Открыть, проверить схему, мигрировать

Composition root заранее выбирает путь и создаёт приватный каталог `0700`; существующие DB/WAL/SHM должны принадлежать текущему principal и не быть доступны группе/остальным (`0600`). `openSqlite({ path, migrations }, limits)` не создаёт каталог и не управляет агентом. `:memory:` и другие платформы не поддерживаются этим адаптером.

`limits` обязателен для всех операций, кроме `close`: `{ signal, timeoutMs }`, где signal совместим с `AbortSignal`, а timeout — оставшийся конечный неотрицательный бюджет вызывающего кода. Пять секунд в примере — только его тестовая политика, не default пакета.

`openSqlite` возвращает `Result<SqliteState, StorageFailure>`. `checkSchema(limits)` возвращает `{ applied, pending }`; при pending соединение ещё не готово к snapshot/transaction. Явно вызовите `migrate(limits)`, прежде чем запускать нагрузку. При импорте exports ничего не открывается/мигрируется. `close()` вызывайте в `finally`; повторное закрытие успешно, закрытие во время активной операции вернёт `busy`.

## 2. Подключить свой Drizzle/Zod adapter

Владельцу принадлежат table schema, запросы, row mapping и Zod DTO — таблица Drizzle не является доменным контрактом. Установите Drizzle в пакет владельца. `state` не экспортирует ORM или repository.

В [ownerDb](../examples/owners.ts) `drizzle-orm/sqlite-proxy` работает локально, без HTTP: `run` вызывает `scope.run`, остальные методы — `scope.all`. Результат `get` — одна positional row, а не массив строк; отсутствие строки проверяется integration-тестом. Адаптер отдаёт владельцу select/insert/update/delete, не transaction/commit/native client. Пример учитывает конкретный API Drizzle 0.45.3.

Общий `StoragePort<S>` импортируется из `/contracts`, технический `SqlScope`/`SqlMigration` — из `/sqlite`, `openSqlite` — из `/node`. Consumer может зависеть только от `StoragePort<OwnerPorts>`; composition root связывает owner ports с SQL scope. [M1 consumer](../test/m1-consumer.ts) один и тот же для SQLite и test-only memory-port.

## 3. Прочитать snapshot и выполнить общий commit

`readSnapshot(async scope => dto, limits)` удерживает один read transaction через `await`; возвращайте самостоятельный DTO. `transact(async scope => result, limits)` удерживает `BEGIN IMMEDIATE` до завершения callback. Два owner adapters и raw vector SQL получают **тот же scope**. Другая операция на этом экземпляре сразу получает `busy`; SQLite writer contention ограничено оставшимся budget и максимумом 40 ms. Автоматической очереди и повторного исполнения callback нет.

Возврат `{ ok: true, value }` подтверждает commit, `{ ok: false, error }` откатывает всё и возвращает `{ kind: 'owner', error }` без изменения доменной ошибки. Expected revision и conflict проверяет owner внутри общего commit. Throw возвращает безопасный `callback_failed`; первая SQL-ошибка отравляет scope даже после `catch`, включая автоматический rollback SQLite. Истёкший scope больше не выполняет SQL (`scope_ended`). Snapshot защищён `query_only`; owner не может управлять transaction/connection командами.

За пределами callback работайте только с DTO. Model/network-вызовы выполняйте после snapshot; если данные устарели, owner проверяет revision в следующем commit. Пакет не выбирает эту доменную политику.

## 4. Векторы и миграции

Пример пишет `vec0` напрямую параметризованным SQL в том же commit, что Drizzle. BLOB boundary — `Uint8Array`, `number` передаётся как REAL, `bigint` как INTEGER; поэтому `vec0.rowid` и `k` в примере — `1n`. Безопасные INTEGER читаются как number, остальные — bigint; NaN/Infinity и bigint вне int64 запрещены. Размерность/метрика/retrieval/provenance/freshness — решение владельца, не `state`.

Composition root собирает **одну неизменяемую цепочку** `{ id, sql }` на физическую БД. [Первые два SQL artifacts](../test/migrations/0000_initial.sql) получены Drizzle Kit в [S1](../../../experiments/state/README.md); [третий](../test/migrations/0002_vectors_and_transform.sql) — проверенный custom SQL для `vec0` и data transform. Владелец генерирует и проверяет новые SQL, фиксирует их в release и не изменяет уже применённые. Kit не нужен во время работы пакета. Не отдавайте virtual/shadow tables автоматическому diff; не включайте управление соединением/транзакцией в SQL миграции. На время artifact SQL authorizer SQLite запрещает операции transaction/savepoint/attach/detach/pragma, включая `END` как commit; слова в строках/комментариях и `CASE`/trigger syntax не являются такими операциями. `VACUUM` также нельзя выполнять внутри общей транзакции. Это защита принятой атомарной границы, не sandbox недоверенного SQL.

Весь pending batch и журнал применяются атомарно. Проверяются exact prefix ID/position/SHA-256 SQL, техническая форма журнала и fingerprint действительной схемы, включая virtual/shadow tables. Изменённая/усечённая/переставленная история, неизвестная схема или drift дают `incompatible`, не автоматическое исправление/очистку. Fingerprint проверен для закреплённой SQLite/extension; обновление native-связки требует отдельной проверки совместимости.

## 5. Ошибки, отмена и backup

Storage failure содержит только `{ kind: 'storage', code }`. Коды: `busy`, `closed`, `unavailable`, `corrupt`, `incompatible`, `full`, `write_failed`, `cancelled`, `deadline`, `scope_ended`, `sql_failed`, `callback_failed`. Не извлекайте из пакета raw vendor errors, SQL, пути или cancellation reason. При `corrupt`/`unavailable`/`write_failed` во время операции соединение закрывается; решать дальнейшую recovery-политику должен вызывающий код.

Отмена **cooperative**: проверки до/после SQL и перед commit. Синхронный `DatabaseSync` блокирует поток; JS timer не прерывает SQL, а callback обязан завершиться сам. После обнаружения отмены/истёкшего бюджета — rollback; после уже успешного commit поздняя отмена не меняет успех на ложный rollback. Ни `Promise.race`, ни обёртка Promise не дают hard deadline. Cleanup не отменяется.

`backupTo(newPath, limits)` делает согласованный SQLite backup (включая committed WAL) в новый приватный файл, не перезаписывает существующий. При отмене завершение native backup дожидается cleanup, неполный файл не публикуется. Для проверки восстановления скопируйте завершённый backup в отдельное изолированное место, откройте с той же цепочкой и сверьте данные; источник не изменяйте. [Integration test](../test/storage.test.ts) воспроизводит это. Это backup одного хранилища, не recovery `state`+`queue`, не аппаратная гарантия power-loss и не управление identity агента.

Пакет предполагает доверенные owner-код, SQL и release artifacts. Private directory и scoped API — не sandbox против кода того же процесса/principal. Runtime, agent lifecycle и единственность инстанса не относятся к `state`.

Полный контракт: [state.spec](../../../docs/modules/state/specification.md), приёмка/поставка: [state.plan](../../../docs/modules/state/implementation-plan.md), команды: [README](../README.md).
