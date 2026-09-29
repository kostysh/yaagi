# S1/S2: `state` на встроенном SQLite

Этот каталог — сохраняемый эксперимент до CP1, **не** workspace-пакет или production API. Он даёт локальное evidence для [state.spec](../../docs/modules/state/specification.md) и [state.plan](../../docs/modules/state/implementation-plan.md). Здесь нет управления агентом, OS lock, `flock`, `fs-ext`, worker или scheduler.

## Воспроизведение

Из task-worktree, Linux x64, Node **24.21.0**, pnpm **10.34.5**:

```bash
pnpm install --frozen-lockfile --store-dir .pnpm-store --cache-dir .cache/pnpm
pnpm --filter @polyphony/core-types build
cd experiments/state
pnpm install --frozen-lockfile
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm audit
```

Тесты создают только собственные временные каталоги `yaagi-state-*`, удаляют их и завершают только собственные child processes. Рабочая БД и `.env` не используются. Lockfile, локальные store/cache, точные зависимости и узкий `allowBuilds` обеспечивают воспроизводимость установки без сборки отдельного SQLite addon. Эти же команды подготовлены для Ubuntu 24.04; remote CI **не запускался**, эксперимент не входит в root recursive CI. После CP1 package `test` будет включать `test:integration` и прежние root-команды подхватят пакет.

Исходники, child probes и ESLint config — TypeScript. Тесты и child probes запускаются из compiler output; Node-процесс ESLint использует `--experimental-strip-types` и native TS-config flag. Прямой запуск любого `.ts` разрешён только с `node --experimental-strip-types`; это не замена `pnpm typecheck`.

## Проверенный снимок среды и результаты

Локально 2026-09-29: `node:sqlite DatabaseSync`, SQLite **3.53.4**, `sqlite-vec` **0.1.9** (`vec_version() = v0.1.9`), Drizzle ORM **0.45.3**, Drizzle Kit **0.31.11**, Zod **4.6.5**, `@types/node` **24.19.0**. Общий toolchain: TypeScript **7.0.2** как `tsc`, TS6 alias **6.0.2** для syntax-only ESLint, ESLint **10.11.0**, typescript-eslint **8.71.0**, Biome **2.5.14**. Это реальный load/insert/query/rollback/reopen, не вывод только из документации.

На исходном зелёном прогоне 26 тестов, 0 failed/skipped. Имена тестов являются locators для повторного прогона:

| Evidence | Где проверяется | Граница вывода |
| --- | --- | --- |
| Два owner adapters через Drizzle + vector SQL; byte-exact BLOB, DTO через Zod, commit/reopen | `s1.test.ts`, `fixture.ts`, `owners/` | Только технические fixtures, не memory/RAG |
| `await`, competing call `busy`, expired handle, отсутствие owner transaction API/replay | `s1.test.ts` | Один `ProbeStore` на connection; не политика числа агентов |
| Throw, owner Result/conflict, caught constraint, SQLite auto-rollback, запрещённый owner commit | `s1.test.ts` | Все обычные/vector writes откатываются, сохраняется первая безопасная категория ошибки |
| WAL snapshot при записи другим connection; read scope не пишет | `s1.test.ts` | Snapshot фиксируется первым чтением и закрывается до возврата DTO |
| Generated + custom migration: fresh/upgrade/repeat/reopen, history/schema mismatch, общий rollback pending batch | `migrations.ts`, `migrations/`, `s1.test.ts` | Журнал проверяется явно; ORM migrator не используется как oracle |
| Реальные FULL/WAL/FK/busy, permissions 0700/0600, fixed extension load и отказ missing/invalid binary | `s2.test.ts` | Доверенный local filesystem/principal, Linux x64 |
| Другой процесс держит writer; bounded busy; SIGKILL после/до commit и reopen | `s2.test.ts`, `writer-child.ts` | Процессный crash, не аппаратный power-loss и не runtime recovery |
| Full, corrupt, unavailable, readonly, closed; отмена и deadline | `s2.test.ts` | Full — реальный `max_page_count`, readonly — реальный read-only connection; физическое отключение носителя не воспроизводилось |
| SQLite backup активной WAL-БД → отдельный restore target → data/vector/schema readback | `s2.test.ts` | Байты DB/WAL источника не меняются; не согласованный backup двух БД |
| Pure contracts, declarations, negative import lint | `boundary.test.ts`, `tsconfig.contracts.json` | Прототипные файлы, не будущий package export map/M1 |

## Выводы для CP1

1. Локальный `drizzle-orm/sqlite-proxy` bridge без HTTP работает с тем же scoped executor, что raw vector SQL. У owner wrapper только `select/insert/update/delete`; нет driver handle, `transaction`, `batch` или `$client`. Общая транзакция явно удерживается через `await`; сам SQL остаётся синхронным. Это причина bridge, а не смена принятого ORM/драйвера.
2. Параметры: `Uint8Array` копируется без JSON; `number` связывается как REAL, `bigint` — INTEGER. Для `vec0.rowid` и параметра `k` нужен `1n`, не `1`. Первоначальный probe с `1` реально получил ошибку `Only integers are allows for primary key values`; исправлен binding, не драйвер. Чтение INTEGER использует bigint; безопасные целые нормализуются в number, большие остаются bigint. Int64 overflow/non-finite rejected. Drizzle integer-колонки используют SQLite affinity; owner отвечает за свой numeric/DTO контракт.
3. Proxy `get` в установленном Drizzle ожидает одну позиционную строку, а для отсутствующей — `undefined`, хотя тип callback объявляет `rows: any[]`. В `bridge.ts` один локальный assertion ограничен этим upstream расхождением; `.get()` с результатом и без него проверены. BLOB mapper получает `Uint8Array`.
4. Отмена cooperative: проверки перед SQL, после SQL и перед commit. В прогоне запрос занял примерно **207 мс** при `timeoutMs: 20`; JS timer не исполнился во время SQL, после SQL получен `deadline` и rollback. Это не hard deadline, не interrupt и не неблокирующий SQL. Незавершившийся callback также не прерывается автоматически. Принятая отмена не приводит к позднему commit; отмена после успешного commit его не отменяет. На CP1 предлагается принять именно эту границу, без worker/scheduler.
5. Миграционная единица — immutable `{id, sql}` в одной ordered chain. Применяются все pending SQL и журнал в одном `BEGIN IMMEDIATE`/commit. Журнал хранит позиции, ID, SHA-256 SQL и schema fingerprint; проверяется точный applied prefix и фактическая схема. Fingerprint использует текущий `sqlite_schema`, включая vec shadow schema: это drift-check выбранной версии, не auto-diff или обещание переносимости fingerprint между engine/extension upgrades. Такое обновление требует отдельного regression evidence.
6. Прототип отдаёт `busy` конкурирующему вызову одного connection без очереди и replay. При SQL failure scope становится непригодным даже после catch; после callback handle истекает. Storage errors безопасно отображаются в фиксированные коды без SQL/path/payload; error Result владельца остаётся его ответственностью. Owner prefix и запрет transaction SQL — дисциплина доверенного кода, не SQL sandbox.

Generated artifacts получены командами `pnpm generate --name initial`, затем добавлением `tag` к owner schema и `pnpm generate --name tag`; `pnpm generate --custom --name vectors_and_transform` создал третий SQL для `vec0` и преобразования существующих fixture-данных. Воспроизведение тестов применяет сохранённые SQL, не генерирует новые. `meta/` — snapshots обычных owner tables, виртуальные таблицы туда не передавались.

## Установка и supply-chain ограничения

До замены драйвера была неудачная установка `better-sqlite3`: сперва недоступный default node-gyp cache, затем отсутствующий `make`. Это не SQLite compatibility result. Зависимость, её `@types`, native build-разрешение и установленный driver удалены. В lockfile остались только объявления optional peers самого Drizzle, не установленные зависимости. Переключение выполнено по прямому решению оператора, fallback не предусмотрен.

У Drizzle Kit остаются upstream deprecated `@esbuild-kit/core-utils` и `@esbuild-kit/esm-loader`. Его транзитивный esbuild 0.18.20 попадал под [GHSA-67mh-4wv8-2f99](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99); узкий override `@esbuild-kit/core-utils>esbuild: 0.25.12` убрал advisory, генерация реально проверена. `pnpm audit` после override: 0 известных advisories; это не доказательство отсутствия всех уязвимостей. Drizzle 0.45.3 новее исправления 0.45.2 из [GHSA-gpj5-g38j-94v9](https://github.com/drizzle-team/drizzle-orm/security/advisories/GHSA-gpj5-g38j-94v9). Разрешены только esbuild scripts точных версий, blanket allow-all нет.

Первичные API sources: [Node 24.21.0](https://github.com/nodejs/node/blob/v24.21.0/doc/api/sqlite.md), [sqlite-vec Node binding](https://alexgarcia.xyz/sqlite-vec/js.html), [Drizzle proxy](https://github.com/drizzle-team/drizzle-orm/tree/main/drizzle-orm/src/sqlite-proxy), [custom migrations](https://orm.drizzle.team/docs/drizzle-kit-generate#custom-migrations). Исполненные local versions, их typings и runtime probes важнее предположений по latest docs.

Предыдущие разделы фиксируют исторический snapshot до CP1, принятый оператором 2026-09-29. Его busy/40 ms/no-worker механизм не является текущим production контрактом. Текущая граница и evidence — в [state.spec](../../docs/modules/state/specification.md); E2, I1/E3, другие платформы и аппаратная сохранность здесь не подтверждаются.

## S1/S2 delta: workers и native concurrency, 2026-09-29

По решению оператора workers разрешены только после подтверждения корректности; собственная очередь/pool/scheduler и callback replay запрещены. Дополнение существующего контура: `concurrency.test.ts` и `concurrency-worker.ts`, временная БД, без нового workspace-пакета/framework/dependencies.

`pnpm build && node --experimental-strip-types --test --test-timeout=15000 dist/concurrency.test.js` проверяет: native BEGIN wait другого worker, продолжение первого через await, readers/read-write snapshot, Drizzle + BLOB + fixed-vector SQL, commit/rollback, ограниченное native ожидание, cooperative cancel после реально выполнявшегося SQL, закрытие всех connections и reopen. Node 24.21.0, SQLite 3.53.4 и vec v0.1.9 подтверждены запросом. SQL внутри worker по-прежнему синхронен.

Первая попытка тестового cleanup зависла: port закрывался до отправки terminal reply. Reply перенесён перед close; три изолированных прогона подряд PASS (~0.6 s process duration каждый), без открытых workers. Полный standalone contour: format/check, dual lint/boundary, typecheck/build и **27 tests PASS**, включая 26 исторических. Исторические tests не подменяют новые production AC6.

При переносе в пакет межпроцессный тест выявил снятие POSIX locks сторонним open/close fd в проверке permissions. Production исправлен на lstat metadata checks и exclusive creation только нового inode; native locks повторно проверены реальными child processes. См. [новое evidence #30](../../docs/validation/state/gh-30.adapters.1.md). Это не собственный lock/exclusivity механизм.

Механизм принят по положительному probe; performance/throughput и hard interruption не заявляются. Новые public exports, unchanged-core M1, migrations/backup regressions и worker-failure tests проверяются в `packages/state`, отдельно от данного прототипа и remote CI.
