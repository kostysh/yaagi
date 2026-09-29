# Спецификация модуля `queue`

- Document ID: `queue.spec`
- Module ID: `queue`
- Статус: accepted. Probe и независимые Concept/Security проверки документов PASS; отдельная приёмка реализации — в [evidence](../../validation/queue/local-queue-agenda.implementation.md).
- Источники: прямое решение оператора `queue-creation.agenda.v3@60d0022b` → [концепция](../../polyphony_concept.md), §§6.9, 10–12 → [архитектура](../../architecture.md), §§2.4, 5.4, 8 → [ADR-002](../../adr/ADR-002-state-and-recovery.md).
- Риск: high — потеря заданий, повторные внешние эффекты, ошибочное признание результата, утечка callbacks при shutdown.
- Текущий потребитель: автор доверенного TypeScript consumer и исполняемого примера. Первый будущий доменный потребитель — `physiology`; он не реализуется здесь.

## Назначение и граница

Потребитель сохраняет типизированное задание и получает durable статус/результат. После перезапуска обработчик автоматически продолжает незавершённую работу без повторного enqueue, сохраняя общий бюджет попыток. Это самостоятельная способность на публичном API, поддерживающая будущие ограниченные фоновые работы Polyphony; не готовая физиология или агент.

R1. `queue` MUST использовать внедрённый публичный `StoragePort` отдельного `state`; владеет схемой, миграциями, mapping и job semantics. Драйвер, соединения, транзакции, файлы и backup MUST оставаться в `state`. Root явно мигрирует storage до использования и закрывает только после успешного `stop`. Источник: архитектура §2.4, решение оператора §1.

R2. Исполняемое ядро `queue` MUST сохраняться при замене библиотечного адаптера. Agenda/SQL/Node types MUST NOT выходить в общий контракт; публичные технические entrypoints изолированы. Первый adapter — Agenda 6.2.6 после принятия пробы. Источник: архитектура §2.4/M1, решение оператора §§1–3.

Не входят: runtime, `physiology`, canonical outbox/receipts, произвольный/недоверенный код, cron, приоритеты, UI, sandbox, mobile/cloud, multi-host failover, exactly-once effects, аппаратный power-loss и полный E3. Собственный scheduler, private patch/fork Agenda, отдельный DB driver и изменение API `state` ради библиотеки запрещены. Namespace разделяет доверенных владельцев, но не является механизмом авторизации или SQL sandbox.

## Термины и публичный контракт

Задание — неизменные namespace, ID, тип/версия, payload и политика исполнения. Reservation — временное удержание, ещё не попытка. Попытка начинается durable commit до handler. Lease token различает поколения reservation; не является разрешением внешнего действия. Receipt владельца — подтверждение, что terminal outcome принят его собственным состоянием; очередь не проверяет чужую БД.

Общие данные — JSON: null, boolean, конечное number, string, массив, plain object с такими значениями. Undefined, BigInt, Date, NaN/Infinity, cycles и executable values отклоняются. Timestamp — целое Unix time в миллисекундах от 0 до 8 640 000 000 000 000; duration — целые миллисекунды до 2 147 483 647. Числа задают валидность API, не рабочие лимиты E2.

Публичные entrypoints: `@polyphony/queue` (core/factories), `./contracts` (переносимые типы), `./ports` (контракт сменного adapter и owner scope), `./adapters/agenda` и `./storage/sqlite` (техническое подключение и migrations).

```ts
type Codec<T> = (value: unknown) => Result<T, { code: 'invalid' }>;
type JobType<P, R> = { readonly name: string; readonly version: number;
  readonly payload: Codec<P>; readonly result: Codec<R> };
type JobPolicy = { readonly maxAttempts: number; readonly backoffMs: number;
  readonly timeoutMs: number };
type Context = { readonly id: string; readonly namespace: string;
  readonly attempt: number; readonly signal: OperationOptions['signal'];
  readonly timeoutMs: number };
// defineJob связывает typed codecs и доверенный handler в registration.
// createQueue принимает namespace, registrations, StoragePort<QueueScope>, QueueAdapter.
// Каждый метод возвращает Promise<Result<..., QueueFailure>>.
interface Queue {
  enqueue<P, R>(type: JobType<P, R>, input: {
    id: string; payload: P; policy: JobPolicy; notBefore?: number;
  }, options: OperationOptions): Promise<Result<Enqueued, QueueFailure>>;
  get<P, R>(type: JobType<P, R>, id: string,
    options: OperationOptions): Promise<Result<JobStatus<R>, QueueFailure>>;
  cancel(id: string, options: OperationOptions): Promise<Result<void, QueueFailure>>;
  cleanup(receipt: { id: string; hash: string; attemptsUsed: number },
    options: OperationOptions): Promise<Result<void, QueueFailure>>;
  start(input: { concurrency: number; windowMs?: number; shutdownMs: number },
    options: OperationOptions): Promise<Result<void, QueueFailure>>;
  stop(options: OperationOptions): Promise<Result<void, QueueFailure>>;
  lifecycle(): { state: 'idle' | 'running' | 'stopping'; error?: QueueFailure };
}
```

`Result` — существующий `@polyphony/core-types`; `OperationOptions` — существующие живой abort signal и общий timeout из `state/contracts`. `defineJob` принимает `(payload: P, context: Context) => Promise<R>`; throw означает безопасный `handler_failed`, без сохранения текста исключения. `createQueue`/`defineJob` синхронны, валидируют configuration и не открывают resources. Все registrations задаются доверенным root до start; type, которого нет в них, не допускается. Одинаковые name/version в одном registry запрещены.

`Enqueued`: `{ id, hash, duplicate }`. `JobStatus<R>`: id, namespace, name/version, hash, status (`pending | running | completed | failed | cancelled`), attemptsUsed/maxAttempts, notBefore, история начатых попыток, `result: { available: true; value: R } | { available: false }`, `cleaned: boolean`. Попытка: number, start/finish timestamp, status (`running | completed | failed`), безопасная причина при отказе (`handler_failed | invalid_result | interrupted | timeout | stopped | cancelled | lease_lost`). Reservation и токены наружу не выдаются. Pending охватывает ready/delayed/retryable; completed после cleanup остаётся completed, но result.available = false.

`QueueFailure` — только фиксированный code: `invalid | unknown_job | not_found | conflict | corrupt | storage | unknown_commit | cancelled | deadline | already_running | stopping | stop_incomplete | adapter`. Ошибки не содержат SQL, paths, payload/result, stack и исходные исключения. Storage failure не становится domain not_found. API не бросает ожидаемые input/storage/lifecycle ошибки.

### Подключение core, owner scope и adapter

Точные factory signatures; возвращаемые registrations сохраняют связь typed codecs, но вызываемый backend bridge принимает unknown, валидируемый перед handler:

```ts
interface Registration<P, R> {
  readonly type: JobType<P, R>;
  readonly invoke: (payload: unknown, context: Context) => Promise<unknown>;
}
function defineJob<P, R>(input: JobType<P, R> & {
  handler: (payload: P, context: Context) => Promise<R>;
}): Result<Registration<P, R>, QueueFailure>;
function createQueue(input: {
  namespace: string;
  registrations: readonly Registration<unknown, unknown>[];
  storage: StoragePort<QueueScope>;
  adapter: QueueAdapter;
}): Result<Queue, QueueFailure>;
function createAgendaAdapter(input: {
  pollIntervalMs: number; leaseMs: number;
}): Result<QueueAdapter, QueueFailure>;
```

Enqueue/get принимают именно `registration.type` текущего registry; произвольный объект с теми же name/version не подменяет codecs. `Registration.invoke` — доверенная функция, не вход из БД. Instance QueueAdapter принадлежит одному экземпляру queue; повторное start допускается только после успешного stop. Локальный лимит concurrency не выдаётся за глобальный лимит всех consumers.

`./ports` фиксирует минимальную seam обработки (не ещё один scheduler):

```ts
type Delivery = { readonly id: string; readonly name: string; readonly version: number;
  readonly token: string; readonly notBefore: number; readonly lockedAt: number };
interface ProcessingStore {
  reserve(name: string, version: number, through: number, lockDeadline: number):
    Promise<Result<Delivery | undefined, QueueFailure>>;
  begin(delivery: Delivery): Promise<Result<void, QueueFailure>>;
  touch(delivery: Delivery, lockedAt: number): Promise<Result<void, QueueFailure>>;
  release(delivery: Delivery): Promise<Result<void, QueueFailure>>;
}
interface QueueAdapter {
  start(input: {
    types: readonly { name: string; version: number }[]; concurrency: number;
    store: ProcessingStore;
    execute: (delivery: Delivery, signal: OperationOptions['signal']) => Promise<void>;
    onError: (failure: QueueFailure) => void;
  }): Promise<Result<void, QueueFailure>>;
  stop(options: OperationOptions): Promise<Result<void, QueueFailure>>;
}
interface QueueScope {
  get(namespace: string, id: string): Promise<unknown | undefined>;
  put(job: StoredJob): Promise<void>;
  candidate(namespace: string, name: string, version: number,
    through: number, lockDeadline: number): Promise<unknown | undefined>;
}
```

Scope существует только внутри state callback; `candidate` возвращает одну pending due либо expired running/reserved job, без terminal. `put` заменяет одну owner record внутри уже открытой transaction, не открывает новую. Core проверяет неизвестные persisted данные до использования. `StoredJob` — технический JSON envelope с полями `schemaVersion: 1`, namespace/id/name/version/hash/status/policy/notBefore, неизменным `requestedNotBefore` для проверки исходного hash после retry, payload (после cleanup — null), result availability/value, cleaned, attempts и nullable lease `{token, lockedAt}`. Каждая попытка содержит `number`, `startedAt`, nullable `finishedAt`, status, nullable reason и token. Счётчик выводится из массива attempts; null payload после cleanup не означает новое задание с JSON-null payload. Core владеет проверками и переходами этой записи, adapter — polling/dispatch/heartbeat и учётом своих callbacks.

Reserve не списывает budget; begin списывает и подтверждает его до execute. Execute всегда вне TX; durable outcome пишет core. Touch и release проверяют delivery token; release снимает только не начавшуюся reservation, никогда running чужой/старой попытки. Failed/complete финальный callback adapter не переписывает уже сохранённый outcome. Adapter MUST исполнять R7/R10/R13/R15 даже если библиотека потеряла running bookkeeping. Его ошибки возвращаются кодом и через onError, не сырыми event exceptions. Поздний вызов после успешного stop не обращается к storage. Test adapter в M1 заменяет только эту seam, не core или owner binding.

`./storage/sqlite` экспортирует `bindQueueScope(scope: SqlScope): QueueScope` и `loadQueueMigrations(): Promise<readonly SqlMigration[]>`. Последняя функция явно читает immutable SQL artifacts из dist; импорт сам ничего не читает. Root вызывает её, создаёт SQLite adapter `state`, `createState(adapter, bindQueueScope)` и явно migrate. Это owner-local mapping/SQL, не DB driver; другой state backend может заменить только binding/migrations при прежнем QueueScope/core.

## Поведение и инварианты

### Сохранение, чтение, идентичность

R3. Enqueue MUST валидировать envelope, payload через codec и JSON до записи. ID/namespace/name непустые, version и maxAttempts — положительные safe integers, backoffMs неотрицателен, timeoutMs положителен. Некорректные поля MUST давать `invalid` без handler или частичной записи. Источник: решение оператора §3.

R4. Namespace+ID MUST задавать единственное задание. Hash MUST вычисляться по каноническому JSON неизменных name/version, payload, policy и notBefore (отсутствие = 0); порядок ключей object не влияет. Тот же запрос MUST возвращать duplicate без изменения статуса, результата, бюджета или расписания. Иной hash MUST давать conflict, включая после очистки. Источник: архитектура §5.4, решение оператора §3.

R5. Успешный enqueue MUST означать durable commit. При неоднозначном ответе записи core MUST сверить прежний ID/hash чтением; если факт не установлен — вернуть unknown_commit, не false success/rollback. Потребитель повторяет только прежний запрос. Источник: архитектура §5.4, решение оператора §2.

R6. Get MUST читать durable данные и валидировать envelope, payload/result и числовые инварианты. Повреждённые данные MUST давать corrupt, не успешно декодированную job и не not_found. Потребитель видит отсутствие, pending, running и terminal исходы различимо. Источник: решение оператора §§3–4.

### Обработка и восстановление

R7. Start MUST запускать только разрешённые registrations с не более заданного concurrency реально незавершённых callbacks в одном экземпляре. Уже running/stopping экземпляр MUST отклонять новый start. Ошибка storage/adapter MUST прекращать новые запуски и быть видна в lifecycle, не бесконечно подавляться. Источник: решение оператора §§1–4, ADR-002.

R8. Reservation MUST NOT расходовать attempts. Начало попытки MUST атомарно увеличить сохранённый счётчик и создать running attempt до первого вызова handler. Неоднозначный commit MUST проверяться по тому же token без повторного списания; crash MUST NOT возвращать бюджет. Источник: прямое решение оператора §2.

R9. После start очередь MUST без повторного enqueue рассматривать сохранённые pending/delayed/retryable и просроченные interrupted reservations/attempts. Pending MUST NOT входить в handler раньше notBefore. Прерванная начатая попытка MUST становиться failed/interrupted; при остатке бюджета job возвращается в pending с backoff, иначе в terminal failed. Исчерпанный бюджет MUST сохраняться через любые рестарты. Источник: решение оператора §4 и требование пользователя о перезагрузках.

R10. Completed, cancelled и exhausted failed MUST NOT автоматически исполняться. Lease fencing MUST отклонять старые completion, heartbeat/touch и одиночный/групповой unlock при новом token. Живой handler вне storage TX; истечение lease не останавливает уже произведённый effect. Источник: архитектура §5.4, решение оператора §§2–4.

R11. Handler MUST получать живой signal и остаток timeout от durable начала попытки, ограниченный текущим execution window. При timeout/window end/stop сигнал MUST переходить в aborted. Поздний result после отмены/потери lease MUST NOT завершать новую попытку. Promise.race не считается прекращением callback. Источник: решение оператора §3.

R12. Валидный result MUST фиксироваться атомарно с completed/attempt outcome при совпадении token. Success/complete events библиотеки MUST NOT заменять durable запись. Ошибка handler/невалидный result MUST фиксировать failed attempt и ограниченный retry после backoff; exhausted budget — terminal failed. Неизвестная запись outcome MUST сверяться; до её подтверждения success не заявляется. Источник: решение оператора §§2–4.

R13. Heartbeat MUST продлевать только текущую lease. Ошибка продления MUST отменять локальный callback и прекращать новый dispatch до явного restart экземпляра. Уже незавершённые callbacks MUST оставаться в учёте даже если библиотека считает их законченными. Источник: stale lease/ограниченная обработка и shutdown из решения оператора §§2–4; удаление правила допускает неконтролируемую конкуренцию после watchdog timeout.

### Отмена, остановка, очистка

R14. Cancel MUST сохранять terminal cancelled для pending/running и подавать отмену локальному running callback после подтверждённого commit. Повтор cancelled идемпотентен; completed/failed дают conflict. Отмена MUST NOT объявлять откат внешнего эффекта. Другой consumer замечает потерю права продолжать при heartbeat/finalize. Источник: архитектура §5.4, решение оператора §§3–4.

R15. Stop и окончание window MUST прекратить новые reservation/attempt starts. Успешный stop MUST означать завершение callbacks и всех уже принятых обращений adapter к storage, без поздних записей. Если caller budget/abort истёк раньше — stop_incomplete, lifecycle stopping, storage остаётся открытым; caller ждёт реальные callbacks и повторяет stop. Stop/window end MUST NOT означать terminal cancel: незавершённая попытка сохраняет бюджет и возможность retry при его остатке. Источник: решение оператора §§2–4.

R16. Cleanup MUST допускаться только для terminal job и совпадающих id/hash/attemptsUsed после явного подтверждения доверенного owner, что outcome принят. Она удаляет payload/result, но MUST сохранять tombstone с hash, terminal status и бюджетом: старый повтор enqueue не создаёт новую работу. До cleanup result MUST оставаться читаемым через reopen. Повтор того же cleanup идемпотентен; несовпадение — conflict. Источник: архитектура §5.4, решение оператора §§2–3. Receipt чужой БД не проверяется и не подделывается этим модулем.

R17. Schema migrations MUST поставляться immutable SQL artifacts, применяться root через state и быть доступны из сборки. Импорт пакета MUST NOT открывать storage, timers, workers или polling. Откат к версии без queue MUST сохранять её DB/tombstones/jobs; повторное включение совместимой версии продолжает pending работу. Источник: архитектура/ADR-002, решение оператора §5.

## Приёмка и проверяемые сценарии

Все критерии проходят через production exports, реальные Agenda/state и SQLite; тестовая альтернатива используется дополнительно для M1, не вместо настоящего пути. `node-engineer`/`typescript-test-engineer` владеют executable evidence; аудиторы независимо проверяют committed snapshot.

| Критерий | Наблюдаемый сценарий и отрицательный oracle | Требования |
| --- | --- | --- |
| AC1 | Consumer → durable enqueue → Agenda → handler → durable result → reopen. Фальсификатор: результат только в event/in-memory. WAL/FULL читаются из настоящего scoped connection | R1–R6, R12 |
| AC2 | Конкурирующие enqueue same ID; иной payload/policy conflict; namespaces независимы; lost commit reply → readback/retry без второй job/attempt | R3–R5, R8 |
| AC3 | IPC-barrier SIGKILL после reservation, commit attempt до handler, handler до result, commit result до ответа; last attempt и повторные рестарты. После start нет повторного enqueue. Фальсификатор: потеря pending, сброс budget или повтор completed | R8–R10, R12 |
| AC4 | Delayed/retry сохраняют notBefore, handler failure и interrupted расходуют общий бюджет; competing claim, stale completion/touch/unlock. Фальсификатор: ранний запуск или изменение новой lease старым token | R7–R13 |
| AC5 | Deadline/cancel/window/stop, живой signal; cooperative и игнорирующий signal handler; медленный final save и watchdog. Фальсификатор: false stopped, поздняя запись после успешного stop или реально незавершённых callbacks больше concurrency | R7, R11–R15 |
| AC6 | Invalid input/result, corrupt persisted envelope, закрытый/недоступный state, lost result acknowledgement; отсутствие false success и утечки payload/SQL в ошибки | R3, R6–R7, R12 |
| AC7 | Result переживает reopen до receipt; premature/stale cleanup отклонён; valid cleanup оставляет tombstone, duplicate не сбрасывает attempts и не запускает handler | R4, R16 |
| AC8 | M1: прежние production core, consumer и fixtures при замене только QueueAdapter тестовой альтернативой. Portable declarations, exports, no private imports и no import I/O | R1–R2, R17 |
| AC9 | Fresh/repeat/failure migrations из dist; upgrade при изменении схемы. Остановить очередь, сохранить DB без запуска queue, открыть совместимой сборкой и продолжить прежнюю job; без destructive down/restore старого snapshot | R17 |

### High-risk readback

Владелец исходных требований — оператор/архитектура; downstream owner всех applicable строк — исполнитель `node-engineer` с TypeScript/test skills. Источники указаны в связанных R; контракт принят после D0, реализация проверяется AC1–9. Матрица не создаёт новых требований.

| Строка | Применимость, контракт и минимальный отрицательный oracle |
| --- | --- |
| HRB-01 | Applicable: R4–5/8/16, queue владеет ID/hash/budget. AC2/7 отвергают вторую работу при replay/cleanup |
| HRB-02 | Applicable: R1/8/10, одна короткая state transaction на переход одной job, нет nested lock/чужой БД. AC3/4 отвергают двух владельцев live reservation и partial attempt |
| HRB-03 | Not applicable: по архитектуре §2.4/§6 доверенные root и consumer, не SQL/RPC service; DB ACL/RLS/tenant principals и sandbox не вводятся |
| HRB-04 | Applicable только к dispatch authority: R7/10/14, name/version allowlist и token проверяются на start/touch/finalize; AC4/6 запрещают исполнение незарегистрированного handler и старую lease. User sessions отсутствуют |
| HRB-05 | Applicable: R5–7/12 и QueueFailure; AC6 отличает storage от not_found/handler failure и отвергает утечку SQL/payload |
| HRB-06 | Applicable: R5–6/9–10/14, отсутствующая job, unavailable result после cleanup, lease expiry, cancel и unknown commit различимы. AC2/3/6/7 отвергают false success и автоматический повтор terminal |
| HRB-07 | Applicable: R3 и JSON/duration/timestamp контракт, AC6 отвергает NaN, BigInt, нецелые/небезопасные budgets и некорректные persisted counters; money отсутствуют |
| HRB-08 | Not applicable: прямой trusted in-process API, нет HTTP credentials, Origin/CSRF или signed webhook bytes; архитектура §2.4, non-goals выше |
| HRB-09 | Applicable: R8/12/16, bounded attempt history без exception text, durable outcome и owner receipt. AC3/6/7 отвергают event-only result и premature cleanup; отдельный audit/event bus не создаётся |
| HRB-10 | Applicable: R7–17, create/read/replay → reservation → attempt → terminal → receipt/tombstone. AC3–7/9 проверяют каждый переход; unknown commit только readback/same-ID retry, stop_incomplete только keep-open/wait/retry, corrupt/storage прекращают dispatch, not_found не лечится созданием иной job |
| HRB-11 | Applicable: R4/8–10/12/16, attemptsUsed = число начатых attempts ≤ maxAttempts, terminal не возвращается в pending, only current token finalizes. AC2–4/7 отвергают нарушение |
| HRB-12 | Applicable: эта queue.spec владеет DTO/Queue symbols; `Result` и `OperationOptions` переиспользуются от своих модулей. AC8 проверяет public declarations, отсутствие SQL/Agenda/Node leakage и private imports |

Package readback: `core-types` владеет `Result`; `state/contracts` — `StoragePort`/`OperationOptions`; `state/adapters/sqlite` — `SqlScope`/driver. Queue root принимает уже подготовленный `StoragePort<QueueScope>`, а `queue/storage/sqlite` предоставляет owner binding и SQL chain. Agenda — прямая pinned dependency только технического `queue/adapters/agenda`; Drizzle/Zod — прямые зависимости owner mapping/validation, не случайные транзитивные импорты. Общие consumers ссылаются на queue/contracts, не дублируют aliases. Public contract tests покрывают все статусы/ошибки, M1 — неизменный core/consumer; нарушенный import/export блокирует AC8. Chain composition двух БД и business receipts проверит будущая `physiology`/E3, не этот scope.

Предварительная проба получила Spec/Security PASS после remediation `8ce5d18020b2437cff06358a4d8155ad37a562b1`; [исходный FAIL сохранён](../../validation/queue/local-queue-agenda.probe-spec.1.md). Concept/Security docs PASS на `3604ae1`, Concept/Spec delta PASS на `fbf0de9` закрыли D0 до production. [Evidence реализации](../../validation/queue/local-queue-agenda.implementation.md) фиксирует AC1–9 и code-аудиты отдельно от приёмки артефактов; нового operator checkpoint нет. Runtime/E3 не выводятся из package acceptance.
