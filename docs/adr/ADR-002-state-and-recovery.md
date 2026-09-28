# ADR-002: Единая история, commit points и восстановление

- Статус: accepted для SQLite, outbox и переносимого контракта очередей по решению оператора 2026-09-28; desktop backend Liteque — candidate до проверки §8 архитектуры. Recovery требует реального evidence E3.
- Дата: 2026-09-28.
- Основание: [концепция](../polyphony_concept.md), §§4.5–4.9, 6.9, 8.7, 10–12, 13.7, 14.1, 16.8, 17; решение оператора о локальной SQLite, векторном расширении, замене BullMQ и будущей совместимости с Expo без требования мобильного запуска.
- Связанный документ: [архитектура, §§2–6 и 8–10](../architecture.md).

## Контекст

Независимые пакеты поддерживают одну биографию. Сбой между обновлением PSM, фиксацией действия и результатом не должен создавать частичное субъективное состояние или повторный необратимый эффект. При этом два серверных хранилища и Docker из решения 2026-09-25 больше не соответствуют требуемой простоте локального deployment.

Обычная DB-транзакция не включает внешний мир. Наличие action log, lock или mock-теста само по себе не доказывает сохранность. Совместимость контракта с будущим mobile runtime не означает постоянного background worker на телефоне.

## Решение

SQLite в `state` — каноническое хранилище состояния и истории; отдельная локальная SQLite БД `queue` хранит технические jobs. Доменные adapters участвуют в одном transaction-scoped handle `state`, таблицы и миграции принадлежат владельцам. PostgreSQL schemas/advisory locks не переносятся буквально: используются owner-prefix таблиц и отдельная lifecycle exclusivity. Две БД не имеют общего atomic commit, даже при одинаковом SQL engine. Полный протокол нормативно задан в §5 архитектуры.

Desktop driver `state` — `better-sqlite3`; будущий Expo adapter использует `expo-sqlite`. Общий async порт и технические SQL-операции не содержат driver types; синхронный desktop API не становится требованием потребителя. Короткий consistent read snapshot закрывается до reasoning; decision и outcome сохраняются отдельными атомарными транзакциями с проверкой revisions. Факты истории не переписываются, full event sourcing и replay LLM не нужны.

`sqlite-vec` — выбранное расширение для хранения/поиска векторов. `state` отвечает за доверенную загрузку и совместимость, доменный владелец — за retrieval, актуальность индекса и provenance. Индексы восстанавливаемы из источников, связаны с revision и embedding model/version/dimension; embeddings производит `model-organs` при включении соответствующей способности. Векторная БД не является готовым RAG и не заменяет каноническую биографию. [SQLite-vec](https://alexgarcia.xyz/sqlite-vec/), [поддержка Expo](https://docs.expo.dev/versions/latest/sdk/sqlite/).

Перед внешним вызовом durable action переходит в `dispatching`. Crash после этой точки создаёт `unknown`, даже если вызов ещё не успел уйти. Без конкретных receipt/idempotency semantics запрещены повтор старого решения и слепой resend. Operator outbox и доставка клиенту остаются отдельными от решения.

Один runtime/effect dispatcher удерживает OS lifecycle lock на canonical directory/agentId. SQLite writer lock сериализует записи, но не запрещает второму процессу внешний effect. При потере storage/exclusivity новые dispatch прекращаются; replacement ждёт подтверждённой остановки прежней process group. TTL/heartbeat/PID-файл не разрешают takeover; multi-host failover не входит в baseline. Будущий platform lifecycle adapter должен сохранить это условие.

Когда job связана с state commit, владелец сохраняет intent/outbox в той же транзакции `state`; доверенный relay после commit публикует её через `queue` с устойчивым ID/hash. Rollback не публикуется, разрыв commit/enqueue закрывает outbox. `published` не закрывает intent: owner хранит его до принятого результата/отказа/отмены и восстанавливает по очереди и receipts. Самостоятельная техническая job может ставиться прямо в `queue`. [Протокол повторов и очистки](../architecture.md#54-устойчивая-очередь-и-согласование-с-состоянием).

Общий `queue` предоставляет durable enqueue/status/result, ограниченные retries/backoff, отмену и обработку в заданном execution window. At-least-once требует повторобезопасных handlers и атомарного приёма результата владельцем. Поздняя попытка не завершает новую lease; cleanup не удаляет непринятый результат и не сбрасывает бюджет. `notBefore` — самое раннее допустимое время, не обещание deadline запуска. Библиотечный retry никогда не разрешает повтор `unknown` action.

Desktop использует постоянный consumer, пока работает host. Будущий Expo adapter — `expo-sqlite` и разрешённые ОС окна через `expo-background-task`/`expo-task-manager`. OS registration не заменяет сохранённую очередь; запуск/интервал не гарантированы, возможны suspension и force-quit. Постоянный daemon/точный cron не входят в общий контракт. Мобильная реализация и device tests сейчас отложены. [Expo BackgroundTask](https://docs.expo.dev/versions/latest/sdk/background-task/).

`infrastructure` исключён: локальные БД не требуют серверов/Compose. WAL + `synchronous=FULL`, короткие транзакции, ограниченное ожидание writer, сохранение файлов при остановке и backup/restore — обязанности соответствующих adapters и runtime по §2.2. Нельзя подменять аппаратный restart обычным закрытием connection в тесте.

## Desktop backend очереди: выбор кандидата

Проверка 2026-09-28 ограничена manifests и исходниками; библиотеки не установлены и recovery не исполнен. Предпочтительный кандидат — **Liteque `0.9.1`**: TypeScript, SQLite через `better-sqlite3`, именованные очереди, retries/delay и idempotency key. При claim/finalize используется allocation token, что подходит для отклонения поздней попытки. Однако completed rows удаляются, default durability — `NORMAL`; нужны сохранённые result/status, сверка conflicting payload и bounded stop на уровне `queue`. [Manifest](https://registry.npmjs.org/liteque/0.9.1), [queue source, снимок `8ce63c8`](https://github.com/karakeep-app/liteque/blob/8ce63c873f83b759efcf05a6db0cf97695628670/src/queue.ts), [runner](https://github.com/karakeep-app/liteque/blob/8ce63c873f83b759efcf05a6db0cf97695628670/src/runner.ts), [настройки БД](https://github.com/karakeep-app/liteque/blob/8ce63c873f83b759efcf05a6db0cf97695628670/src/db.ts).

| Вариант | Вывод для текущей локальной cell |
| --- | --- |
| Liteque | Узкая основа; кандидат до bounded probe из §8. Не обещаем весь контракт YAAGI как свойство библиотеки |
| [Workmatic](https://github.com/litepacks/workmatic) | Активный SQLite-проект с retries, но [проверенный worker](https://github.com/litepacks/workmatic/blob/51355fb495a2d661b7e13ce47098f50a485ef845/src/worker.ts) завершает job по ID без generation check после истечения lease; для нашего stale-attempt контракта требуется дополнительное решение |
| [Sidequest](https://github.com/sidequestjs/sidequest) | Более широкий Node job framework; сам проект не рекомендует свой SQLite backend для production. Для этого локального baseline не выбран |
| [Plainjob](https://github.com/justplainstuff/plainjob) | Небольшая SQLite-очередь; опубликованный stable `0.0.14` датирован 2024-10-13 ([registry](https://registry.npmjs.org/plainjob)), свежий source не доказывает свойства поставляемого пакета. Не основной кандидат |
| Собственная очередь целиком | Сейчас не выбирается: пришлось бы самостоятельно поддерживать claim/retry/recovery вместо узкой обёртки. Вернуться к сравнению, если кандидат не удерживает контракт без форка internals |

До принятия backend `node-engineer` выполняет probe и возвращает `architecture-engineer` evidence: durable enqueue/reopen, kill после claim, bounded retries/stop, stale completion, ID/hash conflict, result до cleanup и эффективный `FULL`. Если нужен новый полноценный scheduler поверх Liteque, выбор пересматривается. Общий контракт не ослабляется ради библиотеки; `core-types` и `state` могут разрабатываться независимо. Точные версии SQLite engine/driver/extension/queue и security updates фиксируются при реализации, перед установкой.

## Другие рассмотренные варианты

- PostgreSQL + BullMQ/Redis: заменены текущим решением оператора; `pg-boss` не возвращается в baseline.
- Одна DB-транзакция на весь тик, включая модель/tools: удерживает writer и всё равно не делает внешний effect атомарным.
- Независимые owner commits: дают частичное субъективное состояние; сохраняется общий decision commit.
- Прямой enqueue до/после state commit без outbox: исполняет откатившееся намерение либо теряет его при crash между операциями.
- Exactly-once эффекты или takeover по истечению lease: queue lease не останавливает старый effect, необходимы owner receipts и executive/reconcile.
- Единый Node worker API для desktop и Expo: требует недоступного постоянного фонового процесса; объединяем семантику, а не platform mechanics.

## Последствия, миграции и rollback

Серверы и их эксплуатация исчезают, но остаются локальные файлы, native extension и конкуренция за единственного SQLite writer. Короткие commit boundaries, WAL/checkpoint и нагрузка проверяются на реальном профиле; SQL storage adapters меняются, публичные доменные DTO сохраняются.

Persisted контракты имеют schemaVersion/release manifest. Rollback body/model/skill сохраняет новую биографию и требует совместимой схемы; восстановление старого DB snapshot — отдельный disaster recovery с явным интервалом потери и reconcile effects. Backup должен охватывать согласованное состояние обеих БД и принятые самостоятельные jobs. Реального PostgreSQL/Redis state ещё нет, поэтому перенос существующих данных сейчас не выполняется.

Протокол вправе временно останавливать новые действия после отказа, сохраняя честное состояние. Мобильный запуск, UI, синхронизация устройств и перенос native DB-файлов между платформами не включаются этим решением.

## Проверка и пересмотр

E3 и R1–R4: два процесса одной cell, недоступное storage/lost lifecycle lock, kill в commit/effect windows, worker/runtime/host restart, оба окна outbox, потерянная queue record/result, исчерпание попыток, cleanup, cancellation и stale input/attempt. Проверяются persisted state, техническая очередь **и** реальный effect/receipt. Vector probe в `state` проверяет load/insert/query/reopen; актуальность и качество retrieval — у владельца при его включении. Mobile port проверяется отдельно только после решения о поставке.

Пересмотр: провал probe/E3, неподдерживаемая extension/ABI, недостаточная производительность writer, новый неидемпотентный adapter, изменение ownership или multi-host/mobile topology. До evidence это архитектурные обязательства, не испытанная отказоустойчивость.

## Аудит

Reviewer: `concept-conformance-reviewer`, `security-reviewer`. Снимок и результат — [общая запись комплекта](../architecture.md#11-решения-и-аудит). Runtime evidence пока отсутствует.
