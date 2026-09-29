# Спецификация модуля: `state`, первый инкремент

- Document ID: `state.spec`
- Module ID: `state`
- Статус: первый инкремент интегрирован; корректировка адаптеров/конкурентности по решению оператора 2026-09-29. Worker probe подтверждён локально; новая реализация проходит committed-snapshot приёмку по #30.
- Дата: 2026-09-29.
- Источники: [концепция §§4.5–4.9, 12, 14.1, 16–17](../../polyphony_concept.md), [архитектура §§2–6, 7.3, 8–10](../../architecture.md), [ADR-001](../../adr/ADR-001-module-boundaries.md), [ADR-002](../../adr/ADR-002-state-and-recovery.md); принятый оператором `state-first-increment.v3` с последующим решением 2026-09-29: жизненный цикл и единственность инстанса агента принадлежат будущему `runtime`, не `state`.
- Исходная рамочная Issue: [#26](https://github.com/kostysh/yaagi/issues/26); корректировка: [#30](https://github.com/kostysh/yaagi/issues/30). [План](implementation-plan.md).
- Риск: high — persistent data, native code, атомарность и миграции.
- Consumer: разработчик owner adapter и composition root; исполнитель корректировки.

## Назначение и границы

При явном открытии исправного локального хранилища доверенным composition root `state` предоставляет согласованное чтение и общий атомарный commit владельцев. После повторного открытия подтверждённые изменения читаются, откатившиеся отсутствуют. Это сохраняет основу единой биографии будущего runtime, не реализует сам организм.

Capability — наблюдаемые гарантии хранения через публичный порт. Substrate — спецификация, пакет, tooling и guide. Anti-claims: нет memory/timeline/RAG, queue, runtime, универсального repository, vector helpers, полноценных I1/E3, multi-host/mobile или гарантии сохранности при физической потере носителя. Тестовая совместимость M1 не доказывает другую платформу или durability тестовой альтернативы.

`state` владеет открытием/закрытием соединений БД, snapshot/transaction scopes, техническими migrations и загрузкой extension. Owner adapter владеет таблицами с owner-prefix, Drizzle schema, запросами, row mapping, Zod DTO, доменными revisions и data transforms; vector dimension/metric/retrieval/provenance/freshness остаются у него. Composition root связывает owners и единую цепочку миграций. Owner-local означает расположение кода, не отдельную БД.

`state` не управляет жизненным циклом агента, числом его инстансов, identity, процессами или допуском внешних действий. Он не принимает `agentId` для блокировки запуска и не предоставляет exclusivity port, OS lock, `flock` или `fs-ext`. Единственность инстанса будет обеспечиваться при разработке `runtime`; механизм сейчас не выбирается. Транзакционная конкуренция БД остаётся задачей хранения и не задаёт политику запуска агентов.

Термины: **scope** — ограниченное время доступа callback к одному snapshot/transaction; **owner** — владелец данных, не пользователь ACL; **reopen** — закрытие и новое открытие реального файла, не аппаратный restart; **CP1** — явное согласование результатов спайков и точного контракта оператором.

## Публичный контракт и зависимости

Обязательные операции общего async порта: `readSnapshot`, `transact`, `checkSchema`. Входы — доверенная конфигурация, ожидаемая schema, callbacks владельцев и ограничение операции отменой/deadline. Выходы — результаты callbacks владельцев и `Result<T,E>`; SQL/driver/native types в общий порт не входят. Владелец проверяет свою expectedRevision внутри общего commit; универсальный revision carrier или доменный протокол конфликтов в `state` не вводится.

Exports: нейтральные корневой API и `./contracts`; весь SQLite API только в `./adapters/sqlite`. Node/worker API остаётся внутри адаптера. Ниже новая целевая граница по решению оператора 2026-09-29.

Drizzle принят оператором независимо от vector probe. Способ подключения к `DatabaseSync` уточняет существующий S1; исходный механизм — локальный `drizzle-orm/sqlite-proxy` callback без HTTP. Векторный raw SQL обходит только ORM, а не scope/connection/transaction. В `state` Zod 4 проверяет реально необходимые config/technical metadata; DTO и их Zod-валидация принадлежат владельцу, а не универсальному валидатору `state`. Таблица не является автоматически доменным DTO. Нужные общие примитивы добавляются в `core-types` только после согласования реального потребителя; сейчас используется существующий `Result`.

Первая платформа — Linux x64, Node 24.21.0, pnpm 10.34.5; CI Ubuntu 24.04. Точные зависимости/SQLite ABI закрепляются по S1/S2. Производные ошибки драйвера не выдаются в общем контракте; секреты, SQL payload и локальные данные не попадают в публичную диагностику.

S1/S2 реально проверили Node `24.21.0` / SQLite `3.53.4` / `sqlite-vec 0.1.9` на Linux x64: load, mixed ORM/vector commit/rollback, BLOB, backup и reopen. [Код, команды, результаты и ограничения](../../../experiments/state/README.md). Это не remote CI или evidence production-пакета. Блокирующей несовместимости этой связки не обнаружено; другой драйвер не возвращается без решения оператора.

## Контракт после уточнения адаптеров и конкурентности

Исходный CP1 принят 2026-09-29. Последующее решение оператора того же дня отменяет искусственный busy и требует внедряемого backend в неизменное ядро. Workers внутри SQLite adapter разрешены при подтверждении корректности. Этот раздел заменяет signatures/механизм CP1; историческая версия — Git `586814fb01fe3ed24b9cffaa05d48ea45ebf3ea7`.

`@polyphony/state/contracts` содержит только нейтральные типы; Result принадлежит core-types:

```ts
type StorageCode = 'busy' | 'closed' | 'unavailable' | 'corrupt'
  | 'incompatible' | 'full' | 'write_failed' | 'cancelled' | 'deadline'
  | 'scope_ended' | 'operation_failed' | 'callback_failed';
type StorageFailure = { readonly kind: 'storage'; readonly code: StorageCode };
type OwnerFailure<E> = { readonly kind: 'owner'; readonly error: E };
type OperationOptions = {
  readonly signal: {
    readonly aborted: boolean;
    addEventListener(type: 'abort', listener: () => void, options?: { once?: boolean }): void;
    removeEventListener(type: 'abort', listener: () => void): void;
  };
  readonly timeoutMs: number;
};
type SchemaStatus = { readonly applied: number; readonly pending: number };
interface StorageSession<S> {
  readonly scope: S;
  readonly failure: StorageFailure | undefined;
  finish(outcome: 'commit' | 'rollback'): Promise<Result<void, StorageFailure>>;
}
interface StorageAdapter<S> {
  begin(mode: 'snapshot' | 'transaction', options: OperationOptions):
    Promise<Result<StorageSession<S>, StorageFailure>>;
  checkSchema(options: OperationOptions): Promise<Result<SchemaStatus, StorageFailure>>;
  migrate(options: OperationOptions): Promise<Result<void, StorageFailure>>;
  close(): Promise<Result<void, StorageFailure>>;
}
interface StoragePort<S> {
  readSnapshot<T>(read: (scope: S) => Promise<T>, options: OperationOptions):
    Promise<Result<T, StorageFailure>>;
  transact<T, E>(write: (scope: S) => Promise<Result<T, E>>, options: OperationOptions):
    Promise<Result<T, StorageFailure | OwnerFailure<E>>>;
  checkSchema(options: OperationOptions): Promise<Result<SchemaStatus, StorageFailure>>;
  migrate(options: OperationOptions): Promise<Result<void, StorageFailure>>;
  close(): Promise<Result<void, StorageFailure>>;
}
```

Корневой `@polyphony/state` экспортирует `createState<S, O>(adapter: StorageAdapter<S>, bind: (scope: S) => O): StoragePort<O>`. Bind принадлежит composition root и создаёт owner-порты; consumer получает только O. Для технического consumer bind может быть identity. Ядро не выбирает backend и не импортирует adapter: проверяет budgets, ведёт callback/Result, общий begin/finish, не повторяет callback, прекращает приём при close и ждёт принятые операции. Операции стартуют независимо, без FIFO/очереди/pool/scheduler/registry.

StorageSession доступна ядру, не доменному consumer: commit/rollback не входят в его scope. Adapter гарантирует реальную атомарность, read-only snapshot, окончание доступа при finish, первую storage failure даже после catch и обязательный rollback/cleanup при штатно обнаруженном отказе finish. При аварийной потере adapter/worker до подтверждения commit результат unavailable не подтверждает commit, но его исход может быть неизвестен: полностью committed либо rollback. Нельзя обещать rollback уже committed данных; требуется reopen/readback владельца, без автоматического replay. Finish сначала инвалидирует scope, затем завершает начатые SQL и транзакцию; после возврата live resource не остаётся. Driver errors отображает только adapter. Произвольный throw consumer → callback_failed, не анализируется по его code/errcode; сохранённый storage poison имеет приоритет.

`@polyphony/state/adapters/sqlite` — единственный backend entrypoint:

```ts
type SqlValue = null | string | number | bigint | Uint8Array;
interface SqlScope {
  all(sql: string, params?: readonly SqlValue[]): Promise<SqlValue[][]>;
  run(sql: string, params?: readonly SqlValue[]):
    Promise<{ changes: number; lastInsertRowid: bigint }>;
}
type SqlMigration = { readonly id: string; readonly sql: string };
interface SqliteAdapter extends StorageAdapter<SqlScope> {
  backupTo(path: string, options: OperationOptions): Promise<Result<void, StorageFailure>>;
}
function createSqliteAdapter(config: {
  readonly path: string;
  readonly migrations: readonly SqlMigration[];
}, options: OperationOptions): Promise<Result<SqliteAdapter, StorageFailure>>;
```

Прежние ./node, ./sqlite, openSqlite, SqliteState удаляются; sql_failed заменяется нейтральным operation_failed. Это breaking private 0.0.0 API, без compatibility aliases. Все imports остаются без I/O/native load; backend загружается при явном create adapter. Ни новый production backend, ни universal repository не добавляются. SQL/DDL bindings владельцев могут требовать адаптации при смене СУБД, но core/доменный consumer остаются прежними.

Сохраняемая и изменённая семантика:

- Независимые snapshot/transaction/check/migrate/backup используют отдельные SQLite connections/worker threads. Синхронный SQL выполняется в потоке, callback и другие scopes продолжаются независимо. Drizzle sqlite-proxy и raw vector SQL внутри scope используют одно connection/transaction; каждый SQL теперь awaited. Владелец не получает native connection/commit.
- Read/read, read/write и write/write одного state или разных adapters одного файла не отклоняются только из-за пересечения, если работа укладывается в budgets. Writer координирует SQLite; нет callback replay, app mutex/очереди или 40 мс cutoff. FIFO не обещается. Реальный storage failure, non-waitable native lock или исчерпание budget не становятся успехом. Взаимозависимая nested write использует существующий scope: нельзя ожидать отдельную транзакцию, удерживая нужный ей writer.
- Snapshot фиксируется первым чтением, read-only. Transaction держит BEGIN IMMEDIATE до awaited callback. Owner Result с ошибкой откатывает всех; throw/poison/cancel/deadline не оставляет partial commit. DTO/validation/revisions принадлежат owner.
- Signal обязателен и остаётся живым; используется переносимая abort-event форма (aborted + add/removeEventListener), совместимая со стандартным AbortSignal, без Node types. Один boolean snapshot не передаёт отмену в другой поток и отклоняется; timeout — конечное неотрицательное число, monotonic отсчёт с начала вызова, включая запуск потока/native ожидание. Некорректные limits → incompatible; pre-abort/нулевой budget — без I/O/callback. Отмена cooperative, без Promise.race-декларации остановленного SQL. После обнаружения отказа до начала commit новый commit не происходит; уже начавшийся успешный commit возвращает успех при поздней отмене. Cleanup/rollback/close не отменяются. Зависший callback не получает обещания hard termination.
- Close прекращает новые операции, ждёт принятые и освобождает worker/connection resources; повтор безопасен. Нельзя ожидать close из собственного callback. Это DB resources, не agent lifecycle.
- BLOB bytes сохраняются через structured clone, без JSON; number связывается как REAL, bigint как INTEGER; vec0 rowid/k — bigint. INTEGER safe range читается number, вне его bigint; nonfinite/int64 overflow отвергаются. changes — safe integer, lastInsertRowid — bigint.
- Одна immutable migration chain на файл: exact applied prefix position/ID/SHA256, структура журнала и actual schema fingerprint включая virtual/shadow tables. Pending не даёт рабочую readiness. Все pending + journal атомарны; changed/truncated/reordered history/unknown schema/drift отвергаются. Generated/custom SQL принадлежит owners; transaction/savepoint/attach/detach/pragma в artifacts запрещены native authorizer. Нет auto-diff shadow tables и миграций при импорте.
- Path задаёт только SQLite config, private directory уже существует. DB/WAL/SHM/backup 0600, directory 0700, доверенный principal. Потеря файла после create adapter не создаёт его заново. Проверки метаданных существующих DB/WAL/SHM не открывают/закрывают отдельный fd: это способно снять POSIX locks SQLite в процессе. Extension только pin sqlite-vec; load отключается после init, effective WAL/FULL/FK проверяются на каждом connection.
- Backup — SQLite backup, атомарная no-replace публикация target; cancel ждёт native cleanup и не публикует partial. Restore — isolated copy завершённого backup + open/readback с сохранением source. Journal/fingerprint/worker boundary не являются sandbox от доверенного владельца файлов/кода.

**M1:** один production createState, неизменный consumer StoragePort<FixtureOwners>, одинаковые public fixtures. SQLite adapter + SQL owner bindings заменяются test-only adapter + memory bindings; core и consumer не копируются. Oracle: consistent read, общий commit/rollback, owner conflict, expired scope, Result/falsy, budgets и close. Test-only adapter не доказывает durability, native concurrency или другую production СУБД.

## Требования и проверка

Нормы explicit из принятого плана/архитектуры и последующего решения оператора 2026-09-29; новая граница выше заменяет механизм CP1, не ослабляя сохранность. MUST означает обязательное поведение. Идентификаторы R/AC локальны этому документу.

| ID | Требование | Источник / falsifier и проверка |
| --- | --- | --- |
| R1 | `state` MUST удерживать все writes общего commit на одном connection и transaction до завершения awaited callback | Арх. §5.1; S1: смешанный Drizzle/SQL/vector commit и readback после reopen |
| R2 | При throw, error/conflict Result, принятой отмене/deadline или SQL failure scope MUST откатить изменения | План S1; частичная запись после reopen опровергает гарантию |
| R3 | После SQL auto-rollback или иной фатальной ошибки scope MUST запретить дальнейшие SQL даже если callback перехватил ошибку | План S1; принудительный rollback + catch + попытка второй записи |
| R4 | Scoped handle MUST отклонять запрос после завершения scope | Арх. §5.1; сохранённый handle используется после callback |
| R5 | `state` MUST исключать посторонние запросы из текущего scope | Арх. §5.1; два конкурентных callback с барьерами, без sleep-based oracle |
| R6 | Owner API MUST NOT предоставлять независимый commit/nested transaction или автоматический replay callback | План S1; negative contract/probe; trusted-code discipline, не SQL sandbox |
| R7 | `readSnapshot` MUST возвращать согласованную проекцию владельцев при конкурентной записи | Арх. §§2.4, 5.1; writer между двумя чтениями не создаёт смешанный snapshot |
| R8 | Fixture owner MUST отклонять stale expectedRevision внутри общего commit | Арх. §4.1; конфликт одного owner откатывает обоих; проверяется участие owner-логики, а не общий revision API `state` |
| R9 | `readSnapshot` MUST завершать snapshot до возврата результата вызывающему коду | Арх. §5.1; consumer fixture получает owner DTO; R4 запрещает дальнейший SQL через сохранённый handle |
| R10 | `state` MUST явно проверять/применять одну согласованную immutable migration chain до рабочей нагрузки | Арх. §§2.2, 5.1; fresh/upgrade/repeat/incompatible/failure с проверкой исходных данных |
| R11 | Импорт любого export MUST NOT открывать/мигрировать БД | Арх. §3.1; import smoke без файлов и native load для contracts |
| R12 | SQLite adapter MUST подтверждать WAL/FULL/FK и bounded busy после инициализации каждого соединения | Арх. §2.2; S2 проверяет effective PRAGMAs и real competing writer |
| R14 | Закрытое или непригодное соединение `state` MUST отклонять дальнейшие операции с ошибкой хранения | Арх. §§2.2, 5.3; S2 storage failure и закрытые handles; решение об остановке или восстановлении агента остаётся у runtime |
| R15 | Adapter MUST загружать только доверенный фиксированный extension на нужных connections с проверкой совместимости | Арх. §§6, 7.3; S1 insert/query/reopen, S2 unavailable/ABI failure без fallback на успех |
| R16 | Adapter MUST ограничивать доступ к data directory, DB, WAL/SHM и backup доверенным principal | Арх. §§2.2, 7.3; S2 реальные mode/ownership; нет заявления о sandbox против этого principal |
| R17 | Backup/restore MUST давать согласованный читаемый результат в отдельном target без изменения источника | План S2, арх. §2.2; SQLite backup, новый target, authoritative readback; active .db copy недостаточна |
| R18 | Ошибка записи MUST NOT подтверждать commit | Арх. §2.2; S2 fault cases, no false success |
| R19 | Общие contracts MUST оставаться без SQL/vendor/Node/Expo types и native side effects | Арх. §§2.3–2.4, 3.1; declarations, import и negative boundary fixtures |
| R20 | Публичные ошибки MUST безопасно различать причины busy/full/corrupt/incompatible/cancel | Арх. §2.2; S2 no raw vendor payload; точная форма после CP1 |
| R22 | Пересечение независимых вызовов MUST NOT само по себе приводить к отказу; координация writers принадлежит БД, без собственной очереди/replay | Решение оператора; AC6: readers проходят общий барьер, awaited writers оба сохранены |
| R23 | Замена внедрённого adapter MUST сохранять production core, доменный consumer и общие fixtures | Решение оператора; усиленный M1 через один createState, не подмена StoragePort |
| R21 | Вызывающий код MUST передать policy-derived signal и конечный budget для open/check/migrate/backup/readSnapshot/transact; `state` MUST отклонить отсутствие/невалидную форму до I/O и callback | Арх. §4.1; после CP1 negative type/runtime fixtures без options/полей и с NaN/Infinity/отрицательным timeout, pre-aborted/нулевой budget; нет записи или вызова callback. Проверка budget не означает hard interruption |

R13 снят решением оператора: управление единственностью инстанса не входит в `state`; остальные ID сохранены. Порядок «получить DTO → завершить snapshot → выполнить model/external work» соблюдает потребитель/runtime. `state` не анализирует DTO и не контролирует чужие model/network calls.

`DatabaseSync` выполняет SQL синхронно; обёртка Promise этого не меняет. Отмена синхронного SQL не доказывается `Promise.race`. S2 сохраняет проверяемую cooperative семантику; worker разрешён оператором при положительной проверке. Scheduler/hard interruption не добавляются. Успех транзакции имеет одну точку commit; поздняя отмена не должна выдумывать rollback уже подтверждённого commit. Порядок и ошибки заданы текущим контрактом; real worker-before/after-COMMIT tests различают rollback и неопределённый исход без ложного success.

## Сценарии приёмки

- **AC1, R1–R9:** даны два fixture owners с Zod DTO; когда consumer выполняет общую Drizzle/raw-vector операцию, тогда public readback и reopen показывают согласованный результат. Throw/error/conflict/cancel, истёкший handle, чужой scope или caught auto-rollback не оставляют частичного commit. Fixture-таблицы не задают модель будущей памяти.
- **AC2, R10–R11:** дана предыдущая fixture-схема с данными; когда применяются generated SQL, custom `vec0` DDL и data transform, тогда цепочка обновляется согласованно и повтор безвреден. Changed history, несовместимая схема или failure не допускают рабочую нагрузку и сохраняют исходные данные. Запуск при импорте запрещён.
- **AC3, R12, R14–R18, R20:** даны реальные временные файлы и child processes; когда происходят конкуренция writers, прерывание процесса записи, storage/extension failure и backup/restore, тогда получены различимые исходы, закрыты непригодные handles и сохранены подтверждённые данные. Это проверки SQLite, не запуска агентов; reopen не заменяет аппаратный restart.
- **AC4, R19, R23 / M1:** неизменные production core и consumer проходят одинаковые public fixtures при подстановке SQLite adapter и test-only adapter. Отдельно проверяются exports/declarations и запреты зависимостей; реальная SQLite-приёмка не закрывается двойником.
- **AC5, R21 / план §4–5:** package/root gates и guide example через публичные exports проходят; README/AGENTS пакета ведут к компактному русскому guide. Пример передаёт policy limits; negative fixtures R21 отвергают безлимитный вызов до I/O, а cleanup остаётся возможным после отмены. Это developer-facing evidence, не работа организма.

- **AC6, R5, R7, R22:** на одном state и двух adapters того же файла reader/reader проходят барьер до завершения друг друга; writer коммитит, пока snapshot сохраняет старую проекцию; два writers с await завершаются успешно, данные подтверждает reopen. Первый writer может rollback/ошибиться/отмениться, второй после native ожидания всё равно сохраняется. Budget exhaustion не оставляет late writes; close ждёт принятые операции и завершает workers. Нет sleep-based oracle порядка или повторов callbacks.

Сквозная проверка хранения: fixture input → owner Zod/mapping → общий SQL/vector commit → DTO projection → reopen. Проверяются обе ветви Result, нулевые/falsy payload и BLOB bytes; physical storage принадлежит adapter, схема/интерпретация — fixture owner. Маппер без реального файла не закрывает AC1–AC3.

## High-risk readback

Матрица не вводит новые обязанности: строки ограничены принятым планом и архитектурой. Owner решения — оператор/architecture; исполнитель и владелец evidence — `node-engineer` с `typescript-test-engineer`; исходные contracts приняты оператором на CP1, текущая граница уточнена по его последующему решению. Новый production handoff зависит от проверки worker-механизма; поставка требует новых аудитов и актуального remote CI.

| Строка | Применимость, контракт и negative oracle |
| --- | --- |
| HRB-01 | Applicable к migration journal/repeat (R10); доменный ledger/idempotency outbox вне state. Повтор apply не меняет данные, изменённая история отвергается |
| HRB-02 | Applicable R1–R8: общий commit при конкурентных запросах, никакого partial winner; S1/S2 |
| HRB-03 | Applicable к filesystem principal R16; серверные ACL/RLS отсутствуют по арх. §2.2. Реальные file modes вместо фиктивного tenant ACL |
| HRB-04 | Not applicable: авторизация сессий/tenant/roles и допуска агента не входят в `state` по решению оператора и арх. §2.4. File permissions покрыты R16, непригодные handles — R4/R14 |
| HRB-05 | Applicable R2–R3, R18: ошибка SQL безопасно отображается, callback не повторяется; auto-rollback/catch/full/busy probes |
| HRB-06 | Applicable R4, R10, R14, R18: expired handle, unavailable storage, corrupt/incompatible и cancel не объединяются с успехом/пустыми данными; S1/S2 |
| HRB-07 | Applicable только техническим SQL/BLOB значениям: байты не превращаются в JSON, numeric range/type задан в текущем контракте и проверяется round trip; денег/валют нет |
| HRB-08 | Not applicable: нет HTTP, cookie credentials или внешнего provider request; только доверенный локальный adapter, арх. §2.4 |
| HRB-09 | Applicable к ограниченным error/evidence без payload leakage R18; новый runtime audit-log не требуется. S2 safe error projections |
| HRB-10 | Applicable open/scope/commit/rollback/close/reopen/backup R1–R12, R14–R18; после отказа terminal handle не пишет, источник restore сохраняется |
| HRB-11 | Applicable общий commit/revision/schema R1–R10; fixture-инвариант двух owners, не новая domain schema |
| HRB-12 | Applicable R19: Result принадлежит core-types, прочие точные symbols фиксирует текущий контракт state.spec; consumers импортируют exports, не shadow aliases |

## Проверки и следующий handoff

TypeScript 7 проверяет/собирает ESM и declarations; Biome форматирует, lint включает Biome + ESLint + package boundary. Package `test` вызывает `test:integration`; существующий root/CI остаётся рекурсивным. Временные спайки имеют собственные точные зависимости и воспроизводимые команды, но не входят в production exports.

Исторические S1/S2/CP1 и первый production snapshot не доказывают R22/R23. Новый worker-механизм проверен в существующем S1/S2 контуре; production реализует новый контракт, усиленный M1 и real SQLite/AC6 regression. Следующий handoff — scoped audits и актуальные checks новой корректировки, не повтор старого CP1. При несовместимости остановить зависимую реализацию с конкретным результатом, без смены драйвера.

Аудит: Concept Conformance для spec; Security для trust/data boundaries. Снимки и результаты фиксируются в плане/CP1 evidence; наличие этого документа не означает прохождения аудита или спайков.
