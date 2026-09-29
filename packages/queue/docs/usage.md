# Использование очереди

- Document ID: `queue.guide`
- Для автора доверенного TypeScript consumer и composition root.
- API и инварианты: [queue.spec](../../../docs/modules/queue/specification.md). Полный компилируемый пример: [usage.ts](../examples/usage.ts).

## Быстрый старт

Из установленного workspace с Node 24.21.0 и pnpm 10.34.5 запустите `pnpm --filter @polyphony/queue example`. Пример создаёт собственную временную БД, сохраняет задание, закрывает/reopen storage, запускает Agenda **без повторного enqueue**, проверяет durable result и явно подтверждённую очистку. В конце удаляется только временный каталог примера. Реальный root должен сохранять постоянный путь БД между запусками.

Подключение состоит из четырёх частей:

1. `loadQueueMigrations()` читает SQL из dist. Root передаёт chain в `createSqliteAdapter` модуля state, затем `createState(adapter, bindQueueScope)` и явно `storage.migrate(options)`.
2. `defineJob` связывает имя/версию, payload/result codecs и доверенный handler. Codec возвращает существующий `Result`; пример показывает связку с Zod. Только JSON-данные; Date, BigInt, undefined, NaN, cycles и функции недопустимы.
3. `createAgendaAdapter({pollIntervalMs, leaseMs})` создаёт сменный adapter; `createQueue({namespace, registrations, storage, adapter})` — ядро. Передавайте именно `registration.type`, а не новый объект с таким же именем.
4. `enqueue(type, {id, payload, policy, notBefore?}, options)` сохраняет задание. `start({concurrency, windowMs?, shutdownMs}, options)` включает обработку; `get` читает durable status/result. Все операции проверяйте по `Result.ok`.

Нет implicit default storage, скрытого `migrate`, собственного DB driver или автозапуска при import. Один processing adapter принадлежит одному queue instance. Одинаковые name/version registrations внутри экземпляра запрещены. Namespace разделяет доверенные owner данные, но **не является авторизацией**.

## Идентичность и повтор

Стабильный ID выбирает потребитель. Hash включает name/version, нормализованный payload, policy и первоначальный notBefore; порядок ключей object не влияет. Повтор того же ID/hash возвращает `duplicate: true` и не сбрасывает бюджет или результат. Иной запрос даёт `conflict`. Не меняйте ID после неоднозначной ошибки.

`unknown_commit` означает, что подтверждение потеряно и readback не установил факт. Повторите тот же запрос или прочитайте тот же ID. Не считайте это rollback. `get` различает `not_found`, `corrupt`, `storage` и terminal statuses; библиотечные events не являются свидетельством сохранения результата.

Публичные состояния: `pending` (ready/delayed/retryable), `running`, `completed`, `failed` (исчерпан бюджет), `cancelled`. `attemptsUsed` и история сохраняются. Reservation ещё не попытка; commit начала списывает её до handler, и crash не возвращает бюджет. После истечения lease прерванная попытка фиксируется как failed/interrupted; если бюджет остался, задание автоматически возвращается к обработке с backoff. Completed/cancelled/exhausted failed не запускаются снова.

Сохранённый `notBefore` соблюдается после restart. Backoff задаётся в миллисекундах между неудачной попыткой и новым запуском; это локальная политика, не измеренный рабочий бюджет E2. Concurrency ограничивает **реально незавершённые callbacks одного экземпляра**, а не всех consumers вместе.

## Handler, время и отмена

Handler выполняется вне storage transaction. Его context содержит ID/namespace, номер попытки, живой `signal` и оставшийся `timeoutMs` от durable начала, ограниченный текущим window. Передавайте их внешней операции и проверяйте abort; не запускайте неучтённые fire-and-forget эффекты. Невалидный result или exception записывает безопасную причину без stack, SQL, paths и содержимого исключения.

Handler должен быть повторобезопасным: process может погибнуть после внешнего эффекта и до commit результата. Lease fencing защищает запись очереди, но не отменяет внешний эффект. `cancel(id)` сохраняет terminal cancelled и отменяет локальный callback; после завершённого/исчерпанного задания возвращает conflict. Cancel не откатывает уже выполненное действие. Другой consumer замечает потерю lease при heartbeat/finalize.

Выбирайте lease с запасом на задержки storage/event loop; adapter продлевает её heartbeat. Ошибка продления останавливает новые запуски и видна в `lifecycle().error`. Малые численные настройки примера/тестов не являются production defaults. Встроенные storage-переходы обработки имеют технический timeout 5 секунд; storage failure прекращает dispatch, а не бесконечно повторяет запись.

## Правильная остановка

Сначала прекратите приём новых запросов потребителя и дождитесь его API-операций. Затем вызовите `queue.stop(options)` и проверьте Result. Успех означает завершение callbacks и принятых adapter storage-вызовов, после чего root может `storage.close()`.

`stop_incomplete` означает: очередь остаётся stopping, **storage оставить открытым**, дождаться реального завершения callbacks и повторить stop с новым budget. `Promise.race` ограничивает ожидание, не останавливает JavaScript. Stop и конец window не равны terminal cancel: уже начатая попытка расходуется, остаток допускает restart. После успешного stop можно явно start тот же экземпляр; после ошибки сначала завершите stop и выясните её причину.

`shutdownMs` ограничивает автоматическую остановку по window/error; явный stop использует переданные `options.timeoutMs` и signal. Queue не закрывает state и не владеет файлами.

## Результат, receipt и очистка

Result хранится без автоматического TTL до явного `cleanup({id, hash, attemptsUsed}, options)`. Передайте receipt только после принятия terminal outcome собственным состоянием owner. Этот trusted in-process API **не проверяет чужую БД**; будущая интеграция owner/outbox/receipts сохранит отдельные commits двух БД.

Cleanup удаляет payload/result, но сохраняет tombstone: ID/hash, terminal status и бюджет. Поэтому старый enqueue остаётся duplicate и не запускает новую работу. Прежний completed после cleanup возвращает `result.available: false`, `cleaned: true`; это не потеря неподтверждённого результата. Повтор совпадающего cleanup идемпотентен, преждевременный/несовпадающий — conflict.

## Миграции, backup и откат

Исходник owner schema — `src/storage/schema.ts`; `pnpm --filter @polyphony/queue generate --name NAME` создаёт новый SQL/metadata через pinned Drizzle Kit. Не изменяйте опубликованную SQL chain; новая версия требует нового migration ID, добавления файла в build/loader и fresh/repeat/failure/upgrade проверки. Начальная версия содержит `queue_0000`, upgrade из предыдущей queue schema пока неприменим.

Backup делает SQLite adapter state по [руководству state](../../state/docs/usage.md#продвинутые-сценарии), а не Agenda. Путь/права/сохранность DB, WAL/SHM и backup принадлежат root. Для отката к приложению без queue: успешно stop, close, сохранить отдельную БД без destructive down и без восстановления устаревшего snapshot. При повторном включении совместимой версии открыть прежнюю БД, проверить chain и start; pending продолжится без enqueue. Несовместимая schema требует отдельного решения, не удаления jobs.

## Что проверено и что нет

Проверки пакета используют production exports, реальную Agenda и state/SQLite. Recovery fixture повторяет corpus предварительной пробы; отдельные процессы убиваются на commit-границах. Тестовая M1 альтернатива меняет только `QueueAdapter`, сохраняя core/consumer/storage. Это не второй production scheduler.

Не заявляются runtime/physiology, полный E3, exactly-once внешних эффектов, аппаратный power-loss, multi-host failover, sandbox или mobile/cloud. Политика безопасного повторения конкретного внешнего действия остаётся у его владельца.
