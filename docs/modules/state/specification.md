# Спецификация модуля: `state`, первый инкремент

- Document ID: `state.spec`
- Module ID: `state`
- Статус: CP1 proposal; локальные S1/S2 выполнены, production contract ожидает согласования; production coding blocked до CP1 approval.
- Дата: 2026-09-29.
- Источники: [концепция §§4.5–4.9, 12, 14.1, 16–17](../../polyphony_concept.md), [архитектура §§2–6, 7.3, 8–10](../../architecture.md), [ADR-001](../../adr/ADR-001-module-boundaries.md), [ADR-002](../../adr/ADR-002-state-and-recovery.md); принятый оператором `state-first-increment.v3` с последующим решением 2026-09-29: жизненный цикл и единственность инстанса агента принадлежат будущему `runtime`, не `state`.
- Рамочная Issue: [#26](https://github.com/kostysh/yaagi/issues/26). [План](implementation-plan.md).
- Риск: high — persistent data, native code, атомарность и миграции.
- Consumer: разработчик owner adapter и composition root; до CP1 — исполнитель ограниченных спайков.

## Назначение и границы

При явном открытии исправного локального хранилища доверенным composition root `state` предоставляет согласованное чтение и общий атомарный commit владельцев. После повторного открытия подтверждённые изменения читаются, откатившиеся отсутствуют. Это сохраняет основу единой биографии будущего runtime, не реализует сам организм.

Capability — наблюдаемые гарантии хранения через публичный порт. Substrate — спецификация, пакет, tooling и guide. Anti-claims: нет memory/timeline/RAG, queue, runtime, универсального repository, vector helpers, полноценных I1/E3, multi-host/mobile или гарантии сохранности при физической потере носителя. Тестовая совместимость M1 не доказывает другую платформу или durability тестовой альтернативы.

`state` владеет открытием/закрытием соединений БД, snapshot/transaction scopes, техническими migrations и загрузкой extension. Owner adapter владеет таблицами с owner-prefix, Drizzle schema, запросами, row mapping, Zod DTO, доменными revisions и data transforms; vector dimension/metric/retrieval/provenance/freshness остаются у него. Composition root связывает owners и единую цепочку миграций. Owner-local означает расположение кода, не отдельную БД.

`state` не управляет жизненным циклом агента, числом его инстансов, identity, процессами или допуском внешних действий. Он не принимает `agentId` для блокировки запуска и не предоставляет exclusivity port, OS lock, `flock` или `fs-ext`. Единственность инстанса будет обеспечиваться при разработке `runtime`; механизм сейчас не выбирается. Транзакционная конкуренция БД остаётся задачей хранения и не задаёт политику запуска агентов.

Термины: **scope** — ограниченное время доступа callback к одному snapshot/transaction; **owner** — владелец данных, не пользователь ACL; **reopen** — закрытие и новое открытие реального файла, не аппаратный restart; **CP1** — явное согласование результатов спайков и точного контракта оператором.

## Публичный контракт и зависимости

Обязательные операции общего async порта: `readSnapshot`, `transact`, `checkSchema`. Входы — доверенная конфигурация, ожидаемая schema, callbacks владельцев и ограничение операции отменой/deadline. Выходы — результаты callbacks владельцев и `Result<T,E>`; SQL/driver/native types в общий порт не входят. Владелец проверяет свою expectedRevision внутри общего commit; универсальный revision carrier или доменный протокол конфликтов в `state` не вводится.

Exports: side-effect-free `./contracts`; отдельный технический `./sqlite` с нормализованными SQL/BLOB операциями для owners; отдельный Node entrypoint для встроенного `node:sqlite` (`DatabaseSync`) и локальных файлов БД. Замена `better-sqlite3` принята оператором 2026-09-29, это не сравнение кандидатов. Node API остаётся внутри адаптера. Точные signatures, error shape и migration unit намеренно draft до CP1. Ни один исполнитель production-кода не выбирает их самостоятельно.

Drizzle принят оператором независимо от vector probe. Способ подключения к `DatabaseSync` уточняет существующий S1; исходный механизм — локальный `drizzle-orm/sqlite-proxy` callback без HTTP. Векторный raw SQL обходит только ORM, а не scope/connection/transaction. В `state` Zod 4 проверяет реально необходимые config/technical metadata; DTO и их Zod-валидация принадлежат владельцу, а не универсальному валидатору `state`. Таблица не является автоматически доменным DTO. Нужные общие примитивы добавляются в `core-types` только после согласования реального потребителя; сейчас используется существующий `Result`.

Первая платформа — Linux x64, Node 24.21.0, pnpm 10.34.5; CI Ubuntu 24.04. Точные зависимости/SQLite ABI закрепляются по S1/S2. Производные ошибки драйвера не выдаются в общем контракте; секреты, SQL payload и локальные данные не попадают в публичную диагностику.

S1/S2 реально проверили Node `24.21.0` / SQLite `3.53.4` / `sqlite-vec 0.1.9` на Linux x64: load, mixed ORM/vector commit/rollback, BLOB, backup и reopen. [Код, команды, результаты и ограничения](../../../experiments/state/README.md). Это не remote CI или evidence production-пакета. Блокирующей несовместимости этой связки не обнаружено; другой драйвер не возвращается без решения оператора.

## Предложение контракта на CP1

Ниже **предложение**, не уже принятые production exports. Оно опирается на S1/S2 и сохраняет R/AC. `Result` импортируется из `@polyphony/core-types`; дополнительных общих примитивов туда не требуется.

`@polyphony/state/contracts` — только типы, без runtime/native side effects:

```ts
type StorageCode = "busy" | "closed" | "unavailable" | "corrupt"
  | "incompatible" | "full" | "write_failed" | "cancelled" | "deadline"
  | "scope_ended" | "sql_failed" | "callback_failed";
type StorageFailure = { readonly kind: "storage"; readonly code: StorageCode };
type OwnerFailure<E> = { readonly kind: "owner"; readonly error: E };
type OperationOptions = {
  readonly signal?: { readonly aborted: boolean };
  readonly timeoutMs?: number;
};
type SchemaStatus = { readonly applied: number; readonly pending: number };
interface StoragePort<S> {
  readSnapshot<T>(read: (scope: S) => Promise<T>, options?: OperationOptions):
    Promise<Result<T, StorageFailure>>;
  transact<T, E>(write: (scope: S) => Promise<Result<T, E>>, options?: OperationOptions):
    Promise<Result<T, StorageFailure | OwnerFailure<E>>>;
  checkSchema(): Promise<Result<SchemaStatus, StorageFailure>>;
  close(): Promise<Result<void, StorageFailure>>;
}
```

`S` — capability адаптера, не SQL в общем контракте. Структурный `signal` совместим с `AbortSignal`, но не требует Node/DOM declarations. `timeoutMs` — конечное неотрицательное число, отсчёт monotonic с начала вызова; отсутствие значения не задаёт общего deadline. Некорректная техническая конфигурация отклоняется как `incompatible`; owner input/DTO ошибки не маскируются этим кодом.

`@polyphony/state/sqlite` — технические типы без Node/native imports:

```ts
type SqlValue = null | string | number | bigint | Uint8Array;
interface SqlScope {
  all(sql: string, params?: readonly SqlValue[]): SqlValue[][];
  run(sql: string, params?: readonly SqlValue[]): {
    changes: number; lastInsertRowid: bigint;
  };
}
type SqlMigration = { readonly id: string; readonly sql: string };
```

SQL-методы этого Node-механизма **синхронны**. SQL параметризуется; `number` связывается как REAL, `bigint` как INTEGER, `Uint8Array` как BLOB без JSON. Для vec0 integer ID/`k` передаётся bigint; размерность и метрика остаются у владельца. При чтении INTEGER в safe range возвращается number, вне него bigint; нечисловые/не конечные параметры и выход за int64 отвергаются. `lastInsertRowid` всегда bigint; `changes` проверяется на safe integer. Это предложение нормализации, не перенос Node types в контракт.

`@polyphony/state/node` — явное открытие адаптера; native load только при вызове `openSqlite`, не при импорте:

```ts
interface SqliteState extends StoragePort<SqlScope> {
  migrate(): Promise<Result<void, StorageFailure>>;
  backupTo(path: string): Promise<Result<void, StorageFailure>>;
}
function openSqlite(options: {
  readonly path: string;
  readonly migrations: readonly SqlMigration[];
}): Promise<Result<SqliteState, StorageFailure>>;
```

Других exports/драйверов/registry нет; отдельный root export не нужен. Native connection, пути расширения и vendor errors владельцу не передаются. Drizzle остаётся в owner adapter: проверенный локальный `sqlite-proxy` callback вызывает этот же `SqlScope`, без HTTP и собственного transaction helper. Отдельный публичный Drizzle/vector helper в `state` не нужен.

Семантика, предлагаемая к согласованию:

- Одно соединение на открытый экземпляр `SqliteState`; параллельная операция того же экземпляра получает `busy`, без очереди/replay. Это конкуренция операций БД, не запрет нескольких агентов или соединений. SQLite writer busy имеет baseline 40 мс, ограничиваемый остатком `timeoutMs`; это не latency SLA и не настройка E2.
- `readSnapshot` начинает read-only transaction, snapshot фиксируется первым чтением; callback возвращает DTO владельца. `transact` удерживает `BEGIN IMMEDIATE` до завершения callback. Возврат `{ok:false,error:E}` откатывает всех владельцев и сохраняет E под `kind:owner`. Любая SQL-ошибка отравляет scope; её первая безопасная категория сохраняется даже после catch. Throw callback без SQL-ошибки → `callback_failed`; сообщение/stack/reason/SQL/path не выходят наружу. Живые handles не являются DTO; после выхода они отвергают SQL с `scope_ended`.
- **Отмена cooperative.** Проверки перед/после SQL и перед commit, rollback после обнаружения отмены/deadline. Синхронный SQL и зависший callback не прерываются, JS timer может опоздать; wall-clock upper bound не обещается. Если commit уже начался и успешно завершился, возвращается успех, даже если время истекло во время самого commit. После уже объявленного отказа commit не происходит. Для hard interruption нужен отдельный разрешённый механизм, он сейчас не добавляется.
- Миграции — одна immutable цепочка `{id,sql}` на БД; все pending artifacts + журнал атомарны одним вызовом. Проверяется exact applied prefix (position/ID/SHA-256 SQL), техническая валидность журнала и совпадение фактической схемы с сохранённым fingerprint. Changed/truncated/reordered history, неизвестная исходная схема и drift отклоняются; pending — не успех готовности. Production open/check/apply связывают этот результат с готовностью соединения: до полной совместимой схемы допустимы check/migrate/close, не рабочие snapshot/transact. Эта связка ещё не production-реализована; в S1 миграционные функции вызываются явно до `ProbeStore`.
- Journal/fingerprint — технические метаданные, не доменная модель или криптографическая защита от доверенного владельца файлов. Fingerprint включает virtual/shadow schema, но не auto-diff; перенос между версиями SQLite/extension требует нового evidence. Артефакты не содержат управления транзакциями/подключениями. Схемы и transforms принадлежат owners; композиция и порядок — root.
- Доверенная конфигурация задаёт заранее созданный private directory (0700). DB/WAL/SHM/backup — 0600, тот же principal; чужие/широкие права отклоняются. Расширение только из pin `sqlite-vec`, load отключается после инициализации. Никаких agentId, canonical agent directory lock или управления запуском.
- `backupTo` использует SQLite backup; target новый, не перезаписывает существующий файл, source сохраняется. Restore — явное копирование завершённого backup в другой изолированный target и open/readback; отдельный restore framework/API не нужен. `close` закрывает DB, не удаляет файлы, повтор безопасен; при активной операции возвращается `busy`. Непригодное соединение не допускает дальнейший SQL.

**Предлагаемый M1 после CP1:** сначала зафиксировать consumer `StoragePort<FixtureOwners>` и одинаковые public fixtures. Composition root SQLite-варианта связывает `SqlScope` с owner-local Drizzle/Zod adapters; consumer не импортирует SQL/Node. Затем подставить test-only in-memory snapshot/copy-on-write реализацию прежнего порта, не меняя consumer/private code. Одинаковые oracle: атомарность двух owners, read consistency, owner conflict, scope expiry, Result/falsy, cooperative cancel и закрытие. Никакого production alternative backend или generic repository; этот тест не доказывает durability, SQLite faults или платформенную эквивалентность. Такие проверки остаются за real SQLite.

## Требования и проверка

Нормы ниже explicit из принятого плана и указанных архитектурных разделов; CP1 уточняет механизм и wire/type shape, не ослабляет гарантии. MUST означает обязательное поведение. Идентификаторы R/AC локальны этому документу.

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

R13 снят решением оператора: управление единственностью инстанса не входит в `state`; остальные ID сохранены. Порядок «получить DTO → завершить snapshot → выполнить model/external work» соблюдает потребитель/runtime. `state` не анализирует DTO и не контролирует чужие model/network calls.

`DatabaseSync` выполняет SQL синхронно; обёртка Promise этого не меняет. Отмена синхронного SQL не доказывается `Promise.race`. S2 измеряет проверяемую cooperative семантику; недостижимое требование возвращается на CP1, не превращается в скрытый worker/scheduler. Успех транзакции имеет одну точку commit; поздняя отмена не должна выдумывать rollback уже подтверждённого commit. Точный порядок и классификация ошибок фиксируются после evidence.

## Сценарии приёмки

- **AC1, R1–R9:** даны два fixture owners с Zod DTO; когда consumer выполняет общую Drizzle/raw-vector операцию, тогда public readback и reopen показывают согласованный результат. Throw/error/conflict/cancel, истёкший handle, чужой scope или caught auto-rollback не оставляют частичного commit. Fixture-таблицы не задают модель будущей памяти.
- **AC2, R10–R11:** дана предыдущая fixture-схема с данными; когда применяются generated SQL, custom `vec0` DDL и data transform, тогда цепочка обновляется согласованно и повтор безвреден. Changed history, несовместимая схема или failure не допускают рабочую нагрузку и сохраняют исходные данные. Запуск при импорте запрещён.
- **AC3, R12, R14–R18, R20:** даны реальные временные файлы и child processes; когда происходят конкуренция writers, прерывание процесса записи, storage/extension failure и backup/restore, тогда получены различимые исходы, закрыты непригодные handles и сохранены подтверждённые данные. Это проверки SQLite, не запуска агентов; reopen не заменяет аппаратный restart.
- **AC4, R19 / M1:** после CP1 неизменный consumer проходит одинаковые public contract fixtures при подстановке SQLite и согласованной тестовой альтернативы. Отдельно проверяются exports/declarations и запреты зависимостей; реальная SQLite-приёмка не закрывается двойником.
- **AC5, план §4–5:** package/root gates и guide example через публичные exports проходят; README/AGENTS пакета ведут к компактному русскому guide. Это developer-facing evidence, не работа организма.

Сквозная проверка хранения: fixture input → owner Zod/mapping → общий SQL/vector commit → DTO projection → reopen. Проверяются обе ветви Result, нулевые/falsy payload и BLOB bytes; physical storage принадлежит adapter, схема/интерпретация — fixture owner. Маппер без реального файла не закрывает AC1–AC3.

## High-risk readback

Матрица не вводит новые обязанности: строки ограничены принятым планом и архитектурой. Owner решения — оператор/architecture; исполнитель и владелец evidence — `node-engineer` с `typescript-test-engineer`; точные contracts готовит `spec-engineer`. Production handoff всех applicable строк blocked до CP1.

| Строка | Применимость, контракт и negative oracle |
| --- | --- |
| HRB-01 | Applicable к migration journal/repeat (R10); доменный ledger/idempotency outbox вне state. Повтор apply не меняет данные, изменённая история отвергается |
| HRB-02 | Applicable R1–R8: общий commit при конкурентных запросах, никакого partial winner; S1/S2 |
| HRB-03 | Applicable к filesystem principal R16; серверные ACL/RLS отсутствуют по арх. §2.2. Реальные file modes вместо фиктивного tenant ACL |
| HRB-04 | Not applicable: авторизация сессий/tenant/roles и допуска агента не входят в `state` по решению оператора и арх. §2.4. File permissions покрыты R16, непригодные handles — R4/R14 |
| HRB-05 | Applicable R2–R3, R18: ошибка SQL безопасно отображается, callback не повторяется; auto-rollback/catch/full/busy probes |
| HRB-06 | Applicable R4, R10, R14, R18: expired handle, unavailable storage, corrupt/incompatible и cancel не объединяются с успехом/пустыми данными; S1/S2 |
| HRB-07 | Applicable только техническим SQL/BLOB значениям: байты не превращаются в JSON, numeric range/type уточняется на CP1 и проверяется round trip; денег/валют нет |
| HRB-08 | Not applicable: нет HTTP, cookie credentials или внешнего provider request; только доверенный локальный adapter, арх. §2.4 |
| HRB-09 | Applicable к ограниченным error/evidence без payload leakage R18; новый runtime audit-log не требуется. S2 safe error projections |
| HRB-10 | Applicable open/scope/commit/rollback/close/reopen/backup R1–R12, R14–R18; после отказа terminal handle не пишет, источник restore сохраняется |
| HRB-11 | Applicable общий commit/revision/schema R1–R10; fixture-инвариант двух owners, не новая domain schema |
| HRB-12 | Applicable R19: Result принадлежит core-types, прочие точные symbols фиксирует state.spec на CP1; consumers импортируют exports, не shadow aliases |

## Проверки и следующий handoff

TypeScript 7 проверяет/собирает ESM и declarations; Biome форматирует, lint включает Biome + ESLint + package boundary. Package `test` вызывает `test:integration`; существующий root/CI остаётся рекурсивным. Временные спайки имеют собственные точные зависимости и воспроизводимые команды, но не входят в production exports.

Результаты S1/S2 возвращены в архитектуру и эту спецификацию; источники смены драйвера прошли Concept/Spec/Security на `48430efcaa86873e47dfaf913d8dcdeb4293c66e`. Новый CP1 snapshot с evidence, кодом и предложением контракта проходит отдельные применимые аудиты. Открыто решение оператора о signatures, migration semantics и cooperative cancellation из предложения выше. Production handoff и M1 остаются blocked до CP1 approval. `next autonomous action: none` после checkpoint report.

Аудит: Concept Conformance для spec; Security для trust/data boundaries. Снимки и результаты фиксируются в плане/CP1 evidence; наличие этого документа не означает прохождения аудита или спайков.
