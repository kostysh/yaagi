# Использовать state со своим владельцем данных

Для разработчика owner adapter и composition root. Проверяемая платформа SQLite adapter — Linux x64, Node 24.21.0. Полный [исполняемый пример](../examples/usage.ts), [Drizzle/Zod bindings](../examples/owners.ts), [backend-neutral consumer](../test/m1-consumer.ts).

```bash
pnpm --filter @polyphony/state example
```

Команда компилирует TypeScript 7 и проверяет общий commit, vector query, rollback, backup и reopen во временном приватном каталоге. Ожидаемый вывод: `state guide: commit, vector query, rollback, backup and reopen passed`. Пример входит в package/root tests.

## Открыть и связать

```ts
import { createState } from '@polyphony/state';
import { createSqliteAdapter } from '@polyphony/state/adapters/sqlite';

const opened = await createSqliteAdapter({ path, migrations }, limits);
if (!opened.ok) return opened;
const adapter = opened.value;
const state = createState(adapter, bindOwners);
try {
  const migrated = await state.migrate(limits);
  if (!migrated.ok) return migrated;
  // state.readSnapshot(owners => ..., limits)
  // state.transact(owners => ..., limits)
} finally {
  await state.close();
}
```

Это фрагмент композиции; определённые config/bindings/limits — в исполняемом примере. Корневой `createState` — нейтральное исполняемое ядро; типы `StoragePort<O>`, `StorageAdapter<S>`, `StorageSession<S>` — в `/contracts`. Backend фабрика, `SqlScope`, `SqlMigration` и SQLite backup — только в `/adapters/sqlite`. Старых `/node`, `/sqlite`, `openSqlite` нет. Импорт любого export не открывает файл и не загружает Node/native adapter.

Composition root выбирает файл и заранее создаёт приватный каталог 0700. Новый файл БД создаётся при явном `createSqliteAdapter`, существующий открывается; потеря файла после открытия не приводит к его пересозданию. DB/WAL/SHM/backup — 0600 и текущий principal; symlink файла запрещён. Не открывайте/закрывайте активные DB/WAL/SHM обычным файловым API: это способно снять POSIX locks SQLite. Для backup используйте adapter.

Обычно root создаёт один state и передаёт владельцам общий доступ через bindings. Разные adapters одного файла тоже допустимы; у них должна быть согласованная migration chain. Разные файлы — разные транзакционные границы: общий атомарный commit между ними не обещается. Путь, `:memory:` (не поддерживается), Node и platform policy не входят в нейтральные contracts.

`checkSchema(limits)` возвращает `{ applied, pending }`. Pending запрещает рабочие scopes; сначала явно примените `migrate(limits)`. Миграций при импорте нет.

## Владельцы и заменяемый adapter

Владелец определяет таблицы, запросы, row mapping, доменные revisions и Zod DTO. Drizzle table schema не является доменным контрактом. `bindOwners(scope)` связывает технический scope с owner-портами; доменный consumer получает только их. Технический consumer может использовать identity-binding `scope => scope`, как компактный SQL-пример.

В [ownerDb](../examples/owners.ts) Drizzle 0.45.3 `sqlite-proxy` вызывает и **await**-ит `scope.run/all` без HTTP. Proxy `get` получает одну positional row; BLOB остаётся байтами. Владелец получает select/insert/update/delete, не native connection/transaction/commit. Его Drizzle package dependency остаётся у владельца.

[Усиленный M1](../test/m1.test.ts) вызывает тот же production `createState` с SQLite adapter + SQL bindings и с test-only memory adapter + memory bindings. Consumer и общие fixtures не меняются. При смене СУБД SQL/DDL bindings могут измениться; нейтральное ядро и доменный consumer — нет. Memory double не доказывает durability, native concurrency или другую платформу.

## Snapshot, общий commit и конкурентность

`readSnapshot(async owners => dto, limits)` держит согласованное read-only чтение через await; возвращайте DTO. `transact(async owners => result, limits)` держит общий write transaction. Drizzle и raw vector SQL получают **тот же scope**, соединение и транзакцию.

Независимые операции одного state или нескольких adapters одного файла запускаются независимо. SQLite координирует writers; synchronous DatabaseSync ждёт native lock в отдельном worker, не блокируя callback в главном потоке. Readers могут читать одновременно и сохраняют snapshot во время commit writer. Собственных очередей, pool, scheduler, replay, искусственного busy или cutoff 40 ms нет. На операцию создаётся worker/connection: есть накладные расходы и конечные ресурсы, throughput не обещается.

Не ожидайте отдельную вложенную write-транзакцию, удерживая нужный ей writer: для общего commit используйте существующий scope. Не ожидайте `close()` из его собственного callback. Это логическая взаимозависимость, не независимая конкуренция. `close` прекращает новые операции, ждёт принятые, освобождает ресурсы; повтор безопасен.

`{ ok: true, value }` подтверждает commit. `{ ok: false, error }` откатывает владельцев и возвращает `{ kind: 'owner', error }` без изменения ошибки. Expected revision/conflict проверяет owner внутри commit. Throw даёт `callback_failed`; первая storage/SQL failure сохраняется даже после catch и запрещает продолжение/commit. После finish scope отозван (`scope_ended`); уже отправленный SQL завершается до cleanup/возврата. Всегда await-ите SQL: scope не становится долгоживущим ORM client.

Model/network-работа выполняется после snapshot; пакет не выбирает доменную политику актуальности DTO.

## Векторы и migrations

[Пример](../examples/owners.ts) пишет `vec0` параметризованным SQL в том же commit, что Drizzle. `Uint8Array` переносится через structured clone, не JSON. Number связывается как REAL, bigint — INTEGER; vec0 rowid/k требуют bigint. Safe INTEGER возвращается number, остальные — bigint; NaN/Infinity и bigint вне int64 отвергаются. Размерность/метрика/retrieval/provenance/freshness — у владельца.

Composition root собирает одну immutable цепочку `{ id, sql }` на файл. [Generated SQL](../test/migrations/0000_initial.sql) получен Drizzle Kit в [S1](../../../experiments/state/README.md); [custom artifact](../test/migrations/0002_vectors_and_transform.sql) добавляет vec0 и data transform. Kit не нужен в runtime. Не изменяйте применённые units и не отдавайте virtual/shadow tables неподтверждённому auto-diff.

Pending batch и journal применяются атомарно. Проверяются exact prefix ID/position/SHA-256, форма журнала и fingerprint actual schema, включая virtual/shadow tables. Несовместимость даёт `incompatible`, не очистку. Transaction/savepoint/attach/detach/pragma в artifacts запрещает native authorizer (включая END-as-COMMIT); literals, comments, CASE и trigger syntax допустимы. VACUUM вне общей транзакции здесь не поддерживается. Обновление SQLite/extension требует повторной проверки fingerprint/ABI.

## Ошибки, budgets и backup

Storage failure — только `{ kind: 'storage', code }`: busy, closed, unavailable, corrupt, incompatible, full, write_failed, cancelled, deadline, scope_ended, operation_failed, callback_failed. Нет SQL, raw driver errors, путей или cancellation reason. Fatal corrupt/unavailable/write_failed закрывает adapter для новых операций; текущие scopes завершают cleanup.

`limits = { signal, timeoutMs }` обязателен кроме close. Signal живой и совместим с abort events стандартного AbortSignal (aborted + add/removeEventListener), не boolean snapshot; budget конечный, неотрицательный, отсчитывается с начала вызова, включая startup/native wait. Значение 5000 в примере — только его политика. Pre-abort/нулевой budget не вызывает I/O/callback. Native wait использует оставшийся budget; его исчерпание даёт deadline.

`busy` — безопасное отображение оставшегося нативного `SQLITE_BUSY`/`SQLITE_LOCKED`, а не отказ «state уже занят». Обычная конкуренция независимых scopes не требует очередей или повторов у владельцев. SQLite [не гарантирует вызов busy handler во всех случаях](https://www.sqlite.org/c3ref/busy_handler.html) и описывает [особые WAL-конфликты при cleanup/recovery](https://www.sqlite.org/wal.html#sometimes_queries_return_sqlite_busy_in_wal_mode). Наличие кода в union не доказывает достижимость каждого такого случая через этот adapter; тесты проверяют обычные read/read, read/write, write/write, ожидание до deadline и штатный cleanup. Абсолютное отсутствие нативных lock failures не обещается. Не добавляйте автоматический replay callback: неожиданный busy в обычном сценарии требует диагностики adapter/БД, а не новой логики конкурентности у модуля.

Отмена cooperative: главный поток остаётся отзывчивым, но timer/AbortSignal **не прерывает** уже исполняющийся синхронный SQL. Проверки до/после SQL и перед commit; после обнаруженного отказа — rollback, без позднего commit. Начавшийся успешный commit не превращается в вымышленный rollback из-за поздней отмены. Cleanup не отменяется; зависший callback не получает hard termination.

Если worker аварийно завершился до подтверждения commit, возвращается unavailable, не успех. Commit мог целиком произойти до потери ответа: это неопределённый исход, не гарантия rollback. Переоткройте БД и сверьте owner revision/данные; автоматического replay нет. [Fault tests](../test/process.test.ts) проверяют разрыв до и после COMMIT.

`adapter.backupTo(newPath, limits)` делает согласованный SQLite backup в отдельный приватный файл с атомарной no-replace публикацией. Отмена ждёт cleanup, partial target не публикуется. Завершённый backup можно скопировать в изолированное место, открыть с той же chain и сверить данные, сохранив источник. Это не recovery state+queue, power-loss гарантия или управление identity.

Все adapters, owners, SQL и release artifacts — доверенный код одного principal; package/worker boundary не sandbox. Agent lifecycle, exclusivity и управление процессами вне state.

Полный контракт: [state.spec](../../../docs/modules/state/specification.md), приёмка: [state.plan](../../../docs/modules/state/implementation-plan.md), команды: [README](../README.md).
