# Использовать state: руководство для разработчика и агента

- Document ID: `state.guide.usage`

Цель: подключить хранилище своего модуля, не изучая private-код `state`.
Проверенный профиль: Linux x64, Node 24.21.0, pnpm 10.34.5, SQLite 3.53.4,
`sqlite-vec` 0.1.9. Пакет приватный, используется внутри этого workspace.

| Задача | Куда идти |
| --- | --- |
| Увидеть работающий пример | [Быстрый старт](#быстрый-старт) |
| Выбрать каталог и имя файла | [Путь к базе данных](#путь-к-базе-данных) |
| Создать, доставить и применить DDL | [Миграции](#миграции) |
| Читать и записывать данные | [Открытие и обычный SQL](#открытие-и-обычный-sql) |
| Подключить свой Drizzle/Zod adapter, общий commit | [Владельцы и scopes](#владельцы-и-scopes) |
| Написать тест своего SQL или обновления схемы | [SQL-тесты](#sql-тесты) |
| Векторы, отмена, backup, замена backend | [Продвинутые сценарии](#продвинутые-сценарии) |
| Разобраться с отказом | [Ошибки и диагностика](#ошибки-и-диагностика) |

Полный нормативный контракт — [state.spec](../../../docs/modules/state/specification.md),
приёмка — [state.plan](../../../docs/modules/state/implementation-plan.md).
Здесь — рецепты использования; они не добавляют API.

## Быстрый старт

Из **корня репозитория**, с версиями из `.nvmrc` и `package.json`:

```bash
pnpm install --frozen-lockfile
pnpm --filter @polyphony/state example
```

[Исполняемый пример](../examples/usage.ts) сам создаёт временный приватный каталог,
применяет миграции, пишет двух владельцев через Drizzle и raw vector SQL,
проверяет rollback, backup и reopen, закрывает БД и удаляет только свой каталог.
Ожидаемый вывод:
`state guide: commit, vector query, rollback, backup and reopen passed`.
Рабочая БД и `.env` не используются.

Для самого короткого SQL-рецепта откройте [consumer-sql.test.ts](../test/consumer-sql.test.ts).
Он самодостаточен: только public imports, свой временный файл, понятные assertions.
Оба примера входят в обычный `pnpm --filter @polyphony/state test`.

При подключении в **существующий пакет-потребитель** объявите
`@polyphony/state: workspace:*`; `@polyphony/core-types: workspace:*` нужен,
если импортируете `Result`. Drizzle/Zod для owner-кода — прямые зависимости
потребителя (`drizzle-orm 0.45.3`, `zod 4.6.5` в проверенном примере), а
`drizzle-kit 0.31.11` нужен только как devDependency пакета, генерирующего миграции.
Не рассчитывайте на транзитивную доступность библиотек. Сначала соберите
`state`: public exports указывают на скомпилированный `dist`.

Разделение кода:

- **Composition root** выбирает backend, файл, budgets, цепочку миграций и общий commit.
- **Владелец данных** держит свои таблицы, запросы, Zod DTO и преобразования рядом с собой.
- **Доменный consumer** получает owner-порт, а не путь, соединение или Drizzle client.

## Путь к базе данных

Единственное место настройки — `createSqliteAdapter({ path, migrations }, options)`.
У пакета нет default path, настройки `agentId`, встроенной env-переменной или
автоматического чтения `.env`. CLI/env/application config разбирает composition root.

Пример настройки **нового учебного** каталога; для приложения замените значение
на путь из его доверенной конфигурации:

```ts
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const directory = resolve('var/local-state');
mkdirSync(directory, { recursive: true, mode: 0o700 });
const path = join(directory, 'state.db');
```

- `path` — имя **файла**, не каталога. Относительный путь разрешается относительно
  `process.cwd()` при открытии, не относительно пакета. При `pnpm --filter ...`
  cwd может быть каталогом выбранного пакета; абсолютный путь убирает неоднозначность.
- Родительский каталог должен существовать, принадлежать текущему UID и не быть
  доступным группе/остальным; обычный режим — 0700. `mode` при `mkdir` не меняет
  права уже существующего каталога. При отказе проверьте конфигурацию/права, не
  исправляйте чужой каталог рекурсивным `chmod`.
- Новый файл создаётся при явном открытии adapter; существующий проверяется и
  открывается, не обнуляется. DB/WAL/SHM/backup должны оставаться приватными
  (обычно 0600); symlink самого файла запрещён. Потеря файла после открытия не
  приводит к его автоматическому пересозданию.
- `:memory:` не поддерживается. Для тестов используйте `mkdtempSync` и реальный
  файл: независимые scopes работают на отдельных worker connections.
- Обычно root открывает один state для нескольких владельцев. Несколько adapters
  одного файла допустимы при согласованной migration chain. Разные файлы — разные
  атомарные границы; общего commit между файлами нет.
- Не читайте, не копируйте и не открывайте/закрывайте активные DB/WAL/SHM обычным
  файловым API: это может снять POSIX locks SQLite в процессе. Для снимка файла
  используйте [backup](#backup-и-восстановление).

Каталог и файл принадлежат приложению. `state` не выбирает политику запуска агента,
не обеспечивает единственность инстанса и не управляет его lifecycle.

## Миграции

### Создать SQL из Drizzle-схем

Одна физическая БД имеет **одну упорядоченную цепочку**, даже если схемами владеют
несколько модулей. Владельцы экспортируют свои таблицы с owner-prefix;
composition root собирает их в конфигурации генерации.

Минимальный пример для каталога пакета-компоновщика с установленными
`drizzle-orm 0.45.3` и `drizzle-kit 0.31.11`:

```ts
// owners/notes.ts — учебная схема владельца, не схема самого state
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const notes = sqliteTable('example_notes', {
  id: text().primaryKey(),
  body: text().notNull(),
});
```

```ts
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './owners/*.ts', // Либо явный список schema-файлов нескольких owners.
  out: './migrations',
});
```

Запускайте из каталога этого пакета, не из корня workspace:

```bash
pnpm exec drizzle-kit generate --config drizzle.config.ts --name notes
```

На Kit 0.31.11 новая история создаёт `migrations/0000_notes.sql` и `migrations/meta/`.
Для следующего изменения добавьте `tag: text(),` в схему `notes` и выполните:

```bash
pnpm exec drizzle-kit generate --config drizzle.config.ts --name tag
pnpm exec drizzle-kit generate --config drizzle.config.ts --custom --name vectors_and_transform
```

Первое действие создаёт `0001_tag.sql`. Второе создаёт пустой
`0002_vectors_and_transform.sql`; заполните его проверенным custom SQL:

```sql
CREATE VIRTUAL TABLE example_vectors USING vec0(embedding float[3]);
UPDATE example_notes SET tag = 'imported:' || body;
```

`vec0` и его shadow tables не описывайте фиктивными Drizzle tables для auto-diff.
Дальнейшие изменения vector DDL делайте custom artifacts. Размерность 3 здесь
учебная, её выбирает владелец. Генерация читает schema/meta, а не рабочую БД;
`generate` и [custom migrations](https://orm.drizzle.team/docs/drizzle-kit-generate#custom-migrations)
— возможности Kit, **не механизм применения state**. Его TS-конфигурацию загружает
сам Kit; собственные TS-скрипты, запускаемые напрямую через Node, требуют
`--experimental-strip-types`.

Перед принятием SQL проверьте diff, порядок FK/DDL, преобразования старых данных
и отсутствие потери данных. **Не любой generated SQL совместим без проверки**:
артефакты `state` не могут управлять транзакцией, savepoints, ATTACH/DETACH или
PRAGMA; некоторые SQLite table rebuilds, сгенерированные Kit, содержат PRAGMA.
Для них подготовьте совместимый SQL и проверьте обновление populated fixture,
а не удаляйте запрет вслепую. `VACUUM` внутри migration transaction не поддерживается.
Комментарии `--> statement-breakpoint`, literals, CASE и trigger BEGIN/END допустимы.

### Собрать release chain и доставить файлы

Храните reviewed SQL и `meta/` под Git. Применённые ID, порядок и **байты SQL**
не меняйте, не переформатируйте: даже изменение комментария меняет SHA-256.
Исправление уже поставленной миграции — новый unit; не правка старого.
При конфликте двух веток согласуйте общий порядок до поставки.

Например, в `src/migrations.ts` пакета-компоновщика:

```ts
import { readFileSync } from 'node:fs';
import type { SqlMigration } from '@polyphony/state/adapters/sqlite';

const directory = new URL('../migrations/', import.meta.url);
export const migrations: readonly SqlMigration[] = [
  '0000_notes',
  '0001_tag',
  '0002_vectors_and_transform',
].map((id) => ({
  id,
  sql: readFileSync(new URL(`${id}.sql`, directory), 'utf8'),
}));
```

Здесь `src/migrations.ts → dist/migrations.js`, а SQL остаётся в соседнем с
`dist` каталоге `migrations`. Если ваш emit layout другой — измените URL.
`tsc` **не копирует SQL**: включите каталог в фактическую поставку приложения и
проверьте загрузку из собранного entrypoint, без зависимости от cwd.
`meta/` нужен для будущей генерации Kit; runtime `state` получает только массив
`{ id, sql }`, не читает `_journal.json` Kit и не сканирует каталог сам.
Не делите SQL по `;`: triggers и literals могут содержать эту пунктуацию.

### Применить или обновить

1. Подготовьте нужную release chain **до** `createSqliteAdapter`. Для обновления
   откройте adapter с прежней цепочкой плюс новые units; уже открытый adapter
   не подхватывает отредактированные файлы.
2. `state.checkSchema(options)` возвращает `{ applied, pending }`. При pending
   рабочие scopes ещё недоступны: сначала явно вызовите `state.migrate(options)`.
3. `migrate` применяет **весь pending batch и журнал атомарно**. Повтор с той же
   цепочкой безопасен; после успеха ожидается `pending: 0`.
4. Сверьте реальные данные через public чтение и reopen. Для поставки проверьте
   и пустую БД, и БД предыдущей версии с данными — [рецепт теста ниже](#sql-тесты).

Не запускайте `drizzle-kit push`, `drizzle-kit migrate`, ORM migrator или ручной
DDL поверх БД, которой управляет `state`: у неё свой `_state_migrations` и
fingerprint actual schema. Миграций при импорте нет. Чужая схема без журнала,
changed/truncated/reordered history или schema drift дают `incompatible`,
а не автоматическое принятие/очистку БД. Не редактируйте технический журнал.

После ошибки pending batch проверьте исходные данные с прежней совместимой
цепочкой, как в тесте. Нет публичного `down()`: откат версии требует совместимости
старого приложения со схемой, новой компенсирующей миграции либо отдельного
проверенного восстановления backup; произвольное усечение цепочки — не rollback.

## Открытие и обычный SQL

Следующий фрагмент использует `path` из раздела настройки и `migrations` из
release loader выше. В приложении они передаются composition root явно.

```ts
import { createState } from '@polyphony/state';
import { createSqliteAdapter } from '@polyphony/state/adapters/sqlite';
import { migrations } from './migrations.js';

const controller = new AbortController();
const options = () => ({ signal: controller.signal, timeoutMs: 5_000 });
const opened = await createSqliteAdapter({ path, migrations }, options());
if (!opened.ok) throw new Error(`Storage: ${opened.error.code}`);
const adapter = opened.value;
const state = createState(adapter, (scope) => scope);
try {
  const migrated = await state.migrate(options());
  if (!migrated.ok) throw new Error(`Storage: ${migrated.error.code}`);

  const written = await state.transact(async (sql) => {
    await sql.run(
      'INSERT INTO example_notes(id, body) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET body = excluded.body',
      ['n1', 'hello'],
    );
    return { ok: true, value: undefined };
  }, options());
  if (!written.ok) throw new Error('Write failed');

  const read = await state.readSnapshot(
    (sql) => sql.all('SELECT id, body FROM example_notes WHERE id = ?', ['n1']),
    options(),
  );
  if (!read.ok) throw new Error(`Storage: ${read.error.code}`);
  console.log(read.value); // [['n1', 'hello']] — detached data, не live handle.
} finally {
  const closed = await state.close(); // Не требует options и работает после abort.
  if (!closed.ok) throw new Error(`Storage close: ${closed.error.code}`);
}
```

Это технический пример с identity-binding `scope => scope`. В настоящем модуле
замените его owner-binding из следующего раздела. В `readSnapshot` callback
возвращает DTO; в `transact` — `Result`. `ok: true` подтверждает commit,
`ok: false` откатывает все writes и возвращается как
`{ kind: 'owner', error: исходнаяОшибка }`. Throw отображается в `callback_failed`.

`SqlScope.all` возвращает **массив positional rows**, не объекты по именам колонок:
`SELECT id, body` → `[[id, body]]`, отсутствие строк → `[]`.
`run` возвращает `{ changes: number, lastInsertRowid: bigint }`.
Значения связывайте через `?`/params, а не интерполяцию; имя таблицы/колонки
параметром не становится — используйте доверенную статическую схему/allowlist.
DDL — в миграциях; owner scope предназначен для SELECT/INSERT/UPDATE/DELETE/WITH,
не для своего COMMIT, PRAGMA или nested transaction.

## Владельцы и scopes

[owners.ts](../examples/owners.ts) — рабочий образец таблиц, Zod DTO и
`ownerDb(scope)`. Drizzle 0.45.3 подключается локальным `sqlite-proxy` callback,
без HTTP. Proxy обязательно await-ит `scope.run/all`; `get` получает одну
positional row или отсутствие результата, BLOB сохраняется байтами.
Это код потребителя, не ещё один API `state`; не импортируйте файл примера
в production — создайте свой узкий binding.

Связывайте owner-методы с переданным scope: например,
`createState(adapter, scope => ({ notes: bindNotes(scope), marks: bindMarks(scope) }))`.
`bindNotes/bindMarks` здесь обозначают функции вашего модуля, не exports state.
В общем `transact` вызывайте оба owner-порта одного callback. Так Drizzle и raw SQL
участвуют в одной транзакции; отдельный `state.transact` внутри owner-метода
разорвёт эту композицию.

Таблицы не заменяют доменные контракты: валидируйте вход и row→DTO своим Zod,
определяйте not-found, expectedRevision/conflict, vector dimension/metric у владельца.
Проверку expectedRevision делайте **внутри** общего write callback.

- Всегда await-ите SQL. Любая SQL failure отравляет scope даже после catch;
  продолжать записи или подтверждать commit после неё нельзя.
- Возвращайте только detached DTO, не scope/ORM client/итератор. После callback
  handle отозван (`scope_ended`). Network/model работу выполняйте после snapshot.
- Независимые read/read, read/write и write/write допустимы. Native WAL/SQLite
  координирует writers; синхронный `DatabaseSync` ждёт в worker, не блокируя
  главный callback. Своей очереди, pool, scheduler или replay callbacks нет.
- Не ожидайте новый отдельный writer, удерживая нужный ему write scope, и не
  ожидайте `close()` из собственного callback. Это взаимозависимость операций,
  а не независимая конкуренция. `close` прекращает новые вызовы, ждёт принятые,
  освобождает ресурсы; повтор безопасен.

## SQL-тесты

Тест SQL владельца — TypeScript `node:test` с настоящим временным SQLite-файлом,
не строковый snapshot SQL и не mock ORM. Храните такие тесты **в пакете владельца**.
Для применения внутри этого репозитория скопируйте структуру
[consumer-sql.test.ts](../test/consumer-sql.test.ts), замените учебные таблицы,
chain и assertions своими. Не импортируйте `state/src`, `dist` или его private
test helpers.

Самодостаточный рецепт запускается из корня workspace:

```bash
pnpm --filter @polyphony/state build
node --experimental-strip-types --test packages/state/test/consumer-sql.test.ts
pnpm --filter @polyphony/state typecheck
```

Ожидаются два успешных теста. Прямой запуск здесь возможен, потому что у файла
нет относительных imports на ещё не скомпилированные `.js`.
Остальные примеры/тесты с такими imports запускайте package scripts:
они собирают TS в `.test-dist`. Stripping не заменяет typecheck.
Node [не читает tsconfig при type stripping](https://nodejs.org/docs/latest-v24.x/api/typescript.html#type-stripping).

Для нового теста:

1. Создайте отдельный `mkdtempSync(join(tmpdir(), 'owner-test-'))` и путь
   `join(directory, 'state.db')`. Зарегистрируйте cleanup до первого открытия.
2. Откройте public adapter с **реальной release chain владельца**, выполните
   `migrate`. В учебном рецепте SQL inline только для самодостаточности.
3. Подайте вход через owner validation/mapping, выполните параметризованные
   запросы через обычный public callback. Проверьте конкретные DTO/значения,
   число затронутых строк, not-found и используемые типы, включая BLOB.
4. Проверьте отказ: owner conflict/constraint/ошибка второго владельца должна
   оставить прежние данные. Одного `result.ok === false` недостаточно.
5. Закройте state, откройте **тот же файл** и проверьте сохранённый commit и
   отсутствие откатившихся изменений. В cleanup дождитесь close всех открытых
   stores и только затем удалите **свой** temporary directory.

Для изменения схемы нужны fresh install всей chain, upgrade заполненной старой
БД, повтор migrate, изменённая история и отказ посередине pending batch с
readback исходных данных. Второй тест рецепта показывает upgrade/repeat/failure;
[storage.test.ts](../test/storage.test.ts) — дополнительные negative cases.
Не обновляйте expected values автоматически по получившимся данным.

Параллельность тестируйте барьерами/сообщениями, не `sleep` как доказательством
порядка — [concurrency.test.ts](../test/concurrency.test.ts). Тесты с raw SQL
доказывают SQL boundary; доменный flow дополнительно проходит owner mapping,
как [Drizzle/vector пример](../examples/usage.ts). M1-двойник не заменяет реальную БД.
Свои package `test`/quality scripts подключайте к существующему рекурсивному
контуру, не создавайте отдельный runner/framework.

## Продвинутые сценарии

### Векторы и BLOB

Используйте тот же scope, что и Drizzle, как в `writeOwners` из
[owners.ts](../examples/owners.ts):

```ts
const bytes = new Uint8Array(new Float32Array([1, 2, 3]).buffer);
await scope.run('INSERT INTO example_vectors(rowid, embedding) VALUES (?, ?)', [1n, bytes]);
const nearest = await scope.all(
  'SELECT rowid, distance FROM example_vectors WHERE embedding MATCH ? AND k = ?',
  [bytes, 1n],
);
```

Фрагмент выполняется внутри write callback; query отдельно допустим в snapshot.
`number` связывается как REAL, `bigint` как INTEGER: vec0 rowid/k требуют bigint.
Safe INTEGER читается как number, вне safe range — bigint; NaN/Infinity и bigint
вне int64 отвергаются. `Uint8Array` передаётся через structured clone, не JSON.
Расширение грузит adapter из фиксированной поставки; пользовательский путь к
extension не принимается. Retrieval/provenance/freshness — решения владельца.

### Budgets и отмена

Каждая open/check/migrate/backup/read/transact операция требует
`{ signal, timeoutMs }`; только close без options. Используйте живой
`AbortSignal`, не копию `{ aborted }`. Timeout конечный, неотрицательный,
отсчитывается с начала вызова, включая worker startup и native lock wait.
5000 ms в примерах — учебная политика, **не default пакета**.
Для общего deadline передавайте оставшийся бюджет, а не новый полный timeout
на каждом шаге. Уже aborted signal/нулевой budget не запускает I/O/callback.

Отмена cooperative: AbortSignal/timer не прерывают выполняющийся синхронный SQL.
Проверки до/после SQL и до начала commit дают rollback после обнаруженного отказа.
Уже начавшийся успешный commit не превращается в rollback от поздней отмены.
Cleanup не отменяется; `Promise.race` не доказывает остановку SQL или callback.

### Backup и восстановление

В [usage.ts](../examples/usage.ts) сохранён backend adapter, чтобы вызвать
`adapter.backupTo(newPath, options)`. Это SQLite-only операция, не метод
нейтрального `StoragePort`. Родитель target должен быть приватным и существовать;
target должен быть новым. Backup согласован, публикуется атомарно без overwrite;
при отмене partial target не публикуется.

Для проверки восстановления: дождитесь успешного backup, скопируйте **завершённый
backup** в новый изолированный private directory без overwrite, откройте копию
с той же chain, выполните checkSchema/public readback, закройте её.
Не заменяйте активный файл БД и не копируйте live `.db` отдельно от WAL.
Готовый проверенный маршрут — [backup/restore tests](../test/storage.test.ts).
Это не recovery state+queue, управление identity или power-loss гарантия.

### Заменить backend

Корневой `createState(adapter, bind)` — исполняемое нейтральное ядро.
`/contracts` содержит `StoragePort<O>`, `StorageAdapter<S>`, `StorageSession<S>`;
SQL, пути, Node и native types туда не входят. Backend-specific API находится
только в `/adapters/sqlite`. Импорт exports не открывает и не мигрирует БД,
не загружает native adapter; старых `/node`, `/sqlite`, `openSqlite` нет.

[M1](../test/m1.test.ts) показывает неизменный [доменный consumer](../test/m1-consumer.ts)
с двумя adapters/bindings и одним production core. При смене СУБД изменятся SQL/DDL
и bindings, не доменный consumer. Memory implementation там только тестовая:
не доказывает durability, native concurrency или готовность другой СУБД.

## Ошибки и диагностика

Внешний Result различает `error.kind === 'owner'` и `'storage'`.
Storage failure содержит только `{ kind: 'storage', code }`, без SQL,
driver payload, путей и cancellation reason. Ошибки owner сохраняются как есть:
за отсутствие секретов в них отвечает сам владелец.

| Code | Действие вызывающего кода |
| --- | --- |
| `incompatible` | Проверить config/limits, pending migrations, release chain и схему. Не удалять БД/журнал. |
| `unavailable`, `corrupt`, `write_failed` | Остановить новые обращения к этому adapter; проверить путь/права/носитель/читаемость. Непригодный adapter закрывается для новых операций. |
| `full` | Не подтверждать сохранение; устранить нехватку места по политике приложения. |
| `deadline`, `cancelled` | Обработать как отказ текущей операции; дождаться cleanup. Не имитировать успех или hard interruption. |
| `closed`, `scope_ended` | Исправить время владения state/scope: запрос после close или callback недопустим. |
| `operation_failed`, `callback_failed` | Проверить SQL/types/constraints либо код callback на временной fixture; не пытаться продолжить отравленный scope. |
| `busy` | Это остаточный native lock failure, не «state уже занят». Для неожиданного busy в обычной конкуренции диагностировать adapter/БД, не добавлять owner queue/replay. |

SQLite [может не вызвать busy handler](https://www.sqlite.org/c3ref/busy_handler.html);
есть [особые WAL cleanup/recovery conflicts](https://www.sqlite.org/wal.html#sometimes_queries_return_sqlite_busy_in_wal_mode).
Обычные независимые scopes проверены read/read, read/write, write/write и ожиданием
до deadline. Наличие `busy` в union не доказывает достижимость каждого native
случая через adapter. На операцию создаётся worker/connection: есть накладные
расходы и конечные ресурсы; throughput и абсолютное отсутствие native отказов
не обещаются.

При потере worker до подтверждения commit `unavailable` означает **неопределённый
исход**, а не доказанный rollback: commit мог целиком пройти до потери ответа.
Откройте БД заново и сверьте owner revision/данные, не переигрывайте callback
автоматически. [Fault tests](../test/process.test.ts) различают разрыв до/после COMMIT.

Все adapters, owner bindings, SQL и release artifacts — доверенный код одного
principal. Пакетная/worker граница не sandbox. Команды проверок и навигация:
[README](../README.md), краткая инструкция агенту: [AGENTS](../AGENTS.md).
