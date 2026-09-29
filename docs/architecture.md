# Модульная архитектура Полифонии

Document ID: `project.architecture`

Дата: 2026-09-29. Статус: accepted — baseline с SQLite и ограничением переносимости по решению оператора; `queue` использует хранение через `state`, выбор библиотеки очереди открыт до проверки §8. Runtime ещё не реализован.

Основание: [каноническая концепция](polyphony_concept.md), исходный снимок `07bf45c6d34b832d7760b919cce671a92e590509` с принятым 2026-09-23 уточнением §6.2.1 об одном операторе и будущих каналах связи; [методология](development-methodology/README.md) и решения оператора: независимые пакеты, единый runtime, TypeScript/Node.js + pnpm + SQLite + AI SDK, локальный CLI. Уточнение оператора 2026-09-24: модельные вычисления разных модулей проходят через `model-organs`; среди органов возможны LLM, аудиомодели и специализированные классификаторы. Это уточняет общую границу, не требует включить все типы моделей в первую версию. При противоречии концепция и решения оператора имеют приоритет.

**Capability следующего этапа:** разработчик получает ограниченную способность, её публичный контракт, владельца данных и проверку; реализация соседнего модуля ему не нужна. **Substrate этого этапа:** архитектура и ADR. **Anti-claims:** документ не доказывает работу агента, безопасность sandbox, совместимость конкретной модели или сохранность данных при реальном сбое.

Уточнение оператора 2026-09-28 заменяет серверные PostgreSQL и BullMQ/Redis на локальное хранение SQLite и переносимый контракт `queue`. Для векторного поиска предусмотрен `sqlite-vec`. Docker и служебный пакет `infrastructure` больше не требуются. Решение 2026-09-25 о двух серверах отменено; at-least-once, outbox и единство канонической истории сохраняются. Совместимость границ с будущим Expo — ограничение проектирования, **не требование реализовать или запустить мобильную версию**.

Тем же решением для `state` и `queue` закреплены общие контракты и сменные адаптеры (§2.4). Возможная будущая адаптация к облачной платформе, включая Cloudflare, учитывается на уровне границ; выбор облачных сервисов и реализация адаптеров отложены.

Уточнение оператора 2026-09-29: жизненный цикл и единственность инстанса одного агента принадлежат `runtime`, не `state`. Механизм будет выбран при разработке runtime; OS lock и отдельный exclusivity port в контракт хранения не входят.

Уточнение оператора 2026-09-29 при подготовке `queue`: модуль повторно использует публичный `StoragePort` уже реализованного `state`. Прежний запрет зависимости `queue → state` отменён. Библиотека очереди подключается сменным адаптером внутри `queue`; самостоятельное хранилище или SQLite-драйвер в обход `state` не допускаются (§2.4).

## 1. Архитектурные основания

| Основание | Источник концепции | Следствие и проверка |
| --- | --- | --- |
| Одно Я, timeline, память и исполнитель | §§2, 4.5, 8.7, 12, 14.1 | Единственный последовательный цикл решений; второй runtime не получает право действия; смена органа сохраняет историю |
| Мышление зависит от опыта и внутренней динамики | §§4.3, 4.10, 6.5, 9–10 | Контекст содержит память, PSM и мемы; различие этих входов должно менять наблюдаемый выбор, а не только запись в журнале |
| Самостоятельные цели и единственный оператор | §§4.10, 6.2.1, 10.9; уточнение оператора 2026-09-23 | Один оператор общается и управляет системой; его сообщение получает приоритет внимания, а явная команда управления имеет отдельный тип операции. Новые каналы не создают операторов |
| Локальная жизнь, заменяемые модели и framework | §§4.6, 7, 16.2.1 | Core не зависит от облака; SDK ограничен адаптером, доменные типы не содержат SDK-объектов |
| Правдивость памяти и оценок | §§6.4.6, 6.6, 9.3–9.7, 12.6, 13.4 | Факты отделены от интерпретаций; активация мема не является доказательством; происхождение сохраняется |
| Регулируемое развитие без утраты опыта | §§4.7, 13–14, 16.7–16.9 | Проверка кандидата, governor, стабильные версии, freeze и откат способа работы с сохранением биографии |
| Независимая разработка | Решение оператора; [правила модулей](development-methodology/modules.md) | Явные контракты, ациклические зависимости, собственные проверки; совместимая замена не меняет внутренности потребителей |

Первая живая версия включает **все** обязательные способности §17.1 и проверяется по §17.3. World model, навыки, физиология и Development Ledger сохраняются в минимальной форме. Богатая сеть отношений, сложная социальная модель, многочисленные сенсоры, облачные консультанты и somatic code evolution относятся к позднему контуру (§17.2). Их отсутствие не разрешает подменить живую версию чатом или workflow.

## 2. Форма системы и deployment cell

Выбран модульный монолит: один процесс принятия решений, встроенная SQLite для канонического состояния и локальных очередей, локальные модельные сервисы. CLI — отдельный клиент. Изолированные процессы оценивания работают только с разрешёнными снимками и временными файлами. Отдельное развёртывание каждого доменного пакета не требуется.

```mermaid
flowchart LR
    Operator[Единственный оператор] <--> CLI[Локальный CLI]
    subgraph Cell[Локальная deployment cell]
        Runtime[Единый Polyphony Runtime]
        DB[(SQLite: состояние и vector index)]
        QueueDB[(SQLite: технические jobs)]
        State["state: канонические данные"]
        Queue["queue: доверенный consumer"]
        QueueState["state: данные очереди"]
        Models[Локальные модельные органы]
        Jobs[Изолированные evaluation jobs]
        Body[Read-only body и версии навыков]
        Runtime <--> State
        State <--> DB
        Runtime <--> Queue
        Queue <--> QueueState
        QueueState <--> QueueDB
        Runtime <--> Models
        Runtime --> Jobs
        Jobs --> Runtime
        Body --> Runtime
    end
    CLI <-->|Unix socket: сообщения и управление| Runtime
```

Runtime создаёт два экземпляра `state` с отдельными SQLite adapters: для канонических данных и технических данных очереди. `queue` получает внедрённый `StoragePort` только своей БД и управляет обработкой заданий; после её остановки runtime закрывает хранилища через `state`. Серверы БД, Redis, Docker Compose и отдельный пакет `infrastructure` не нужны. Закрытие handles не удаляет данные. Изолированный evaluator не получает файлы БД или storage ports: доверенный consumer передаёт ему ограниченный snapshot и принимает результат (§7.2). Локальные model servers и их собственные требования к запуску сохраняются; Docker не является обязательной частью baseline.

Оператор — один и тот же человек в общении с Полифонией и в управлении её запуском, остановкой, настройками и подтверждениями. Для первой cell используется один CLI и одна доверенная привязка оператора; обычное сообщение и явная команда управления различаются по типу операции. Core, БД и model servers не публикуют порты в общедоступную сеть. Минимальный сценарий не требует интернета или ключа облачного API.

### 2.1 Проверенный технологический baseline

Исходная проверка инструментов выполнена 2026-09-23; SQLite, векторное расширение и кандидаты очереди исследованы 2026-09-28. Это документальная и source-проверка, **не** выполненная интеграция, mobile build или тест конкретного model server. Установленные версии bootstrap этим изменением не меняются.

| Компонент | Решение для первой реализации | Проверенное основание |
| --- | --- | --- |
| Node.js | 24 LTS; исходная фиксация `24.21.0` | [Официальный график](https://github.com/nodejs/Release#release-schedule), [релиз](https://nodejs.org/en/blog/release/v24.21.0) |
| TypeScript | `7.0.2`, strict, ESM; сборка `.ts` в JS и declarations | [Стабильный выпуск 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), [manifest 7.0.2](https://registry.npmjs.org/typescript/7.0.2) |
| pnpm | Линия 10; при bootstrap обновить pin с имеющегося `10.28.2` до проверенного `10.34.5` | [Совместимость с Node 24](https://github.com/pnpm/pnpm.io/blob/main/versioned_docs/version-10.x/installation.md), [manifest](https://registry.npmjs.org/pnpm/10.34.5) |
| Хранение | SQLite внутри `state`; принятое уточнение 2026-09-29 — встроенный `node:sqlite` (`DatabaseSync`) вместо `better-sqlite3`. Будущий Expo adapter — `expo-sqlite`; драйверы не входят в общий контракт | [Node 24.21.0 API](https://github.com/nodejs/node/blob/v24.21.0/doc/api/sqlite.md), [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/). Локальные S1/S2 подтвердили SQLite `3.53.4` + `sqlite-vec 0.1.9`; [evidence и пределы](../experiments/state/README.md) |
| ORM | Drizzle принят оператором 2026-09-29 для SQLite adapters владельцев; Drizzle Kit подготавливает проверяемые SQL-миграции | Векторный SQL может обходить ORM, но не общий transaction scope `state`. Совместимость конкретных версий проверяет S1 из [плана `state`](modules/state/implementation-plan.md) |
| Векторный поиск | `sqlite-vec` в SQLite; производный индекс, без отдельного vector server | [sqlite-vec](https://alexgarcia.xyz/sqlite-vec/), [JS binding](https://alexgarcia.xyz/sqlite-vec/js.html); Expo включает расширение через `withSQLiteVecExtension` |
| Очереди | Общий `queue` с хранением через внедрённый `state` и сменным адаптером библиотеки очереди. Пригодность исследованного Liteque `0.9.1` открыта: сначала совместимость с этим путём хранения, затем recovery/lifecycle | [Liteque](https://github.com/karakeep-app/liteque), [manifest 0.9.1](https://registry.npmjs.org/liteque/0.9.1), сравнение и ограничения в [ADR-002](adr/ADR-002-state-and-recovery.md) |
| Будущая mobile-адаптация | Сохранение jobs через `state` с будущим `expo-sqlite` adapter, разрешённые ОС окна через `expo-background-task` / `expo-task-manager`; сейчас не реализуется | [Expo BackgroundTask](https://docs.expo.dev/versions/latest/sdk/background-task/); OS scheduling не заменяет durable queue |
| AI SDK | `ai@7.0.112` + `@ai-sdk/openai-compatible@3.0.54` внутри `model-organs` | [SDK manifest](https://registry.npmjs.org/ai/7.0.112), [provider manifest](https://registry.npmjs.org/@ai-sdk%2fopenai-compatible/3.0.54): Node ≥22, совпадающий provider ABI 4.0.18 |

Для SDK выбрать одну точную совместимую Zod 4-версию из его peer-range `^4.1.8` при bootstrap и зафиксировать lockfile. AI SDK 7 не означает принятия его agent/workflow platform: использовать только модельные вызовы, structured output и ограниченную отменяемую генерацию. Provider создаётся явно с локальным allowlisted endpoint; строковый shorthand с неявным AI Gateway запрещён. [Описание совместимого provider](https://ai-sdk.dev/providers/openai-compatible-providers).

AI SDK — внутренний адаптер для совместимых операций, а не универсальный контракт всех моделей. Для специализированного API допустим отдельный адаптер внутри `model-organs` с подходящим SDK или протоколом. Доменные пакеты вызывают публичный модельный порт без provider SDK. Выбор адаптера не меняет ограничения локальности, разрешённых endpoints и передачи данных.

Пакеты собираются отдельно; импорт идёт через `exports` и declarations, без запуска TypeScript из внутренних путей соседнего пакета. Manifest и зависимости в текущей документационной задаче не меняются. Перед первой установкой повторно проверить security updates и воспроизводимую совместимость всей выбранной связки.

### 2.2 Локальные файлы и профиль сохранности

У каждой cell свой закрытый каталог данных на локальном диске: каноническая БД с индексами и отдельная техническая БД `queue`, обе обслуживаются через `state`. Пути задаёт доверенная конфигурация; другая cell и тесты используют отдельные каталоги. Connectors, соединения, файлы и механизм применения миграций принадлежат SQLite adapter `state`; таблицы, миграции и row mapping — владельцам данных, включая `queue`. Runtime создаёт/закрывает хранилища и проверяет согласованность manifest и порядок boot. Общий `.env` остаётся read-only для task-worktree. Пустой пакет `infrastructure` вместо Compose не создаётся.

Drizzle-схемы, SQL, row mapping и семантика преобразования данных находятся рядом с владельцем; это владение исходным кодом, не отдельная физическая БД для каждого владельца. Composition root собирает упорядоченную цепочку миграций для каждой физической БД: owners канонического состояния и отдельно `queue`. Drizzle Kit генерирует SQL из схем владельцев; проверенные SQL artifacts фиксируются в release, применённые миграции не редактируются. Неподдерживаемые DDL `vec0` и data transforms оформляются custom SQL; virtual/shadow tables не передаются неподтверждённому auto-diff. `state` отвечает за технические journal/apply/check, а не за схему владельца. Применение явно выполняется до рабочей нагрузки, никогда при импорте; ошибка или несовместимость не разрешают начать работу со схемой. Точные transaction/journal semantics определены [спецификацией `state`](modules/state/specification.md), а не предполагаются свойствами ORM.

Для обеих БД исходный профиль: WAL, `synchronous=FULL`, `foreign_keys=ON` и ограниченное ожидание занятого writer; эффективные настройки проверяются на каждом соединении после инициализации библиотек. Должны различаться занятость, нехватка места, corrupt/incompatible schema и отмена; ошибка записи не подтверждает commit/enqueue. WAL допускает читателей параллельно с одним writer, поэтому транзакции короткие, ожидание имеет deadline, а долгий model call выполняется вне транзакции. Сетевой filesystem и multi-host доступ не входят в baseline. Основания: [WAL](https://sqlite.org/wal.html), [профиль synchronous](https://sqlite.org/pragma.html#pragma_synchronous).

Успешный commit/enqueue означает сохранение на исправном локальном носителе при соблюдении sync-гарантий ОС/диска. Это не защита от потери или повреждения самого диска. `NORMAL`, включая default библиотеки очереди, не принимается как эквивалент `FULL` для power-loss durability. E2 измеряет цену профиля; E3 проверяет restart/recovery, отдельно указывая, какие crash/power-loss случаи реально воспроизведены.

Права на каталог, БД, WAL/SHM и backup одинаково ограничены доверенным principal. SQLite не добавляет серверную аутентификацию или шифрование автоматически. Backup выполняется через согласованный механизм SQLite либо после остановки записей и безопасного checkpoint/закрытия; копирование только активного `.db` при WAL недостаточно. Две БД не образуют общий snapshot: согласованный backup/restore останавливает producers/consumers, либо явно восстанавливает техническую очередь по intents; самостоятельные jobs также должны сохраняться. [SQLite backup](https://sqlite.org/backup.html). Restore проверяется отдельно, обычная остановка ничего не удаляет.

### 2.3 Ограничение переносимости

Первая поставка остаётся desktop/Node.js с CLI. Общие `core-types`, `./contracts` и доменная логика не импортируют `node:*`, Node-only globals/types, драйверы БД, Liteque или Expo. Файловые пути и native modules остаются в platform adapters, управление процессами — у runtime/host; общий I/O-контракт асинхронен, даже если desktop driver синхронный. Native adapters имеют отдельные entrypoints и не загружаются при импорте общих contracts. Bootstrap NodeNext пока сохраняется; Metro/Expo build и mobile adapters появятся только при отдельном решении о мобильной поставке.

Первый инкремент `state` проверяет Linux x64 локально и Ubuntu 24.04 CI; другие ОС и mobile не наследуют это evidence. DTO/validators владельцев используют Zod и TypeScript независимо от Drizzle table schema. Спайки S1/S2 и точный контракт описаны в [спецификации `state`](modules/state/specification.md); CP1 принят оператором 2026-09-29, пакет проходит отдельную приёмку через public exports. Drizzle принят независимо от результата vector probe: raw vector SQL использует тот же scoped executor, connection и transaction.

`DatabaseSync` остаётся синхронным: async callback удерживает scope через `await`, но Promise не делает выполняемый SQL неблокирующим и не прерывает его. S1/S2 2026-09-29 проверили локальный `sqlite-proxy` bridge Drizzle на общем connection/transaction, BLOB/vector/rollback/reopen, миграции и backup: Node `24.21.0`, SQLite `3.53.4`, `sqlite-vec 0.1.9`, Drizzle `0.45.3`. [Evidence и ограничения](../experiments/state/README.md); это ещё не production package, M1 или remote CI. Исторический CP1 фиксировал cooperative cancellation: запрос нельзя прервать JS timer, rollback выполняется после обнаружения отмены/истёкшего времени. Последующее разрешение worker для concurrency и его границы заданы в §2.4; hard deadline не принят. При блокирующей несовместимости решение возвращается оператору; автоматического возврата к другому драйверу нет. Node API остаётся private в адаптере.

Постоянное хранение очереди отделено от возможности выполнять её сейчас. Desktop consumer работает, пока запущен host; будущий Expo adapter обрабатывает сохранённые jobs в foreground и в разрешённых ОС коротких окнах. `notBefore` задаёт нижнюю границу времени, а не гарантированный запуск. Нельзя обещать непрерывного worker, точный cron, обязательный callback перед завершением процесса или выполнение после force-quit. BackgroundTask использует WorkManager/BGTaskScheduler; на Android минимальный период периодической работы — 15 минут, на iOS момент выбирает система ([ограничения Expo](https://docs.expo.dev/versions/latest/sdk/background-task/)).

В общем контракте остаются durable enqueue/status/result, ограниченные повторы, отмена и возможность ограничить обработку временем/бюджетом; остановка окна сохраняет незавершённое и допускает повтор. Утрата worker lease не даёт старой попытке завершить новую. OS wakeup не хранит canonical job и не является subjective tick или разрешением действия. Desktop-гарантии автономной жизни не переносятся автоматически на mobile: runtime, модели, CLI transport, sandbox и реальное поведение iOS/Android потребуют отдельной проверки. Сейчас проверяются границы и семантика, а не запуск организма на телефоне.

### 2.4 Адаптеры `state` и `queue`

Уточнение оператора 2026-09-29 после первого инкремента `state`: общий модуль должен иметь **исполняемое нейтральное ядро с внедряемым adapter**, а не только интерфейс, реализованный SQLite-классом. Composition root вызывает `createState(adapter, bindOwners)`. Ядро ведёт callback/Result и порядок begin → commit/rollback; adapter исполняет транзакцию, schema operations и освобождение ресурсов. Корневой export и `./contracts` не содержат SQL/SQLite/Node/native API. Все SQLite-specific types и connector находятся только в `./adapters/sqlite`; прежние `./node`/`./sqlite` удаляются. Новый пакет, registry и universal repository не нужны. M1 меняет именно adapter/bindings, сохраняя то же production-ядро, доменный consumer и oracle. Backend-specific SQL/DDL владельцев могут меняться — универсального SQL не обещаем.

Тем же уточнением отменён искусственный отказ `busy` при пересечении независимых вызовов. Read/read, read/write и write/write одного state и разных adapters одного файла должны завершаться без отказа только из-за пересечения, если работа укладывается в budgets. Координация writer принадлежит SQLite; собственная очередь, pool, scheduler, callback replay и короткий искусственный cutoff не добавляются. Реальный storage failure и исчерпание budget не превращаются в успех.

Оператор отдельно разрешил worker threads **при подтверждении корректности**. Предлагаемый механизм внутри SQLite adapter: отдельное соединение/поток на независимую операцию. Синхронный `DatabaseSync` ждёт native lock вне главного JS-потока, и другой callback может продолжиться после await и освободить writer. SQL-методы технического adapter становятся async; общие contracts не знают о потоках. Это заменяет прежнее ограничение CP1 «без worker», но не вводит hard cancellation: SQL остаётся синхронным в своём потоке, cleanup/rollback обязателен. Цена создания потока/соединения — ограничение первого решения, не обещание throughput; pooling не добавляется. Историческое evidence S1/S2 не доказывает новый механизм: нужен новый реальный concurrency/cleanup probe и package acceptance.

`close` прекращает новые вызовы и ждёт принятые операции, не возвращая искусственный busy. Нельзя ожидать close из собственного callback или ожидать отдельную nested write к удерживаемому файлу: общая запись нескольких owners использует один переданный scope. Это владение DB-ресурсами, не управление agent lifecycle.

Локальный worker probe 2026-09-29 подтверждён в существующем [S1/S2 контуре](../experiments/state/README.md); production evidence новой корректировки отдельно в [#30](validation/state/gh-30.adapters.1.md). Live cancellation использует переносимые abort events, без Node API в общем контракте; hard interrupt не добавляется. Авария adapter до получения подтверждения commit даёт unavailable с неопределённым исходом: commit мог целиком произойти. Требуется owner readback после reopen, а не автоматический replay или обещание отката. Проверки прав существующих DB/WAL/SHM не открывают/закрывают fd вне SQLite, чтобы не снимать её POSIX locks. Это техническая сохранность, не agent exclusivity.

Оба модуля разделяют публичный асинхронный контракт и его реализации. Контракт описывает операции, DTO, ошибки и гарантии, которые видит потребитель. `state` скрывает драйвер и механизм хранения; `queue` скрывает библиотеку очереди и механизм обработки заданий. Адаптеры принадлежат соответствующему модулю, доступны через отдельные entrypoints и явно подключаются в composition root; потребители не выбирают backend и не ветвятся по платформе. Новый пакет, реестр плагинов или динамическая загрузка для этого не нужны.

`queue` использует внедрённый публичный `StoragePort` модуля `state` для устойчивого хранения. Схема очереди, миграции, отображение записей, статусы, попытки и результаты принадлежат `queue`; драйвер, соединения, файлы, транзакционный механизм и технический backup — адаптеру `state`. Composition root создаёт отдельный экземпляр `state` для технической БД и связывает его с mappings `queue` через `createState(adapter, bindOwners)`. Ядро и библиотечный адаптер `queue` используют этот порт; SQL mappings получают scoped executor из `state/adapters/sqlite`. Native connection или второй драйвер внутри `queue` не нужны и не допускаются. `state` не знает схемы или логики очереди и не зависит от `queue`.

| Модуль | Что сохраняется при замене адаптера | Что остаётся внутри реализации |
| --- | --- | --- |
| `state` | Согласованный snapshot, атомарный commit изменений владельцев и проверка совместимости схем | Соединения, SQL/драйвер, механизм транзакций, загрузка расширений, технические apply/journal/check; доменные storage adapters, revisions и миграции остаются у владельцев |
| `queue` | Durable enqueue/status/result, идентичность job, правила повторов, отмены, ограниченного выполнения и защиты от устаревшей попытки | Библиотека очереди, доставка и запуск обработчика: локальный worker, окно ОС или вызов платформы; учёт jobs/результатов сохраняется через внедрённый `state` |

SQLite — выбранная реализация локального baseline. Файл БД и `state/adapters/sqlite` не входят в общий контракт `state`: технический SQL export нужен только SQLite adapters владельцев. Замена хранилища может потребовать их замены и миграции данных, сохраняя публичные доменные контракты и общий commit. Совпадение сигнатур без сохранения атомарности, snapshot и совместимости схем не делает новый backend совместимым. Проверка доменных revisions и Zod DTO выполняется владельцами; `state` не вводит общий revision carrier или универсальную доменную валидацию.

Для `queue` транспорт сообщения отделён от учёта задания. Устойчивые ID, status/result, попытки и отмена остаются обязательством модуля независимо от возможностей библиотеки. Его техническая БД обслуживается через отдельный внедрённый `state`; локальный SQLite-файл и постоянно работающий consumer не являются требованиями общего API. Замена библиотеки очереди не разрешает обходить этот путь хранения. Лимиты платформы должны быть явно учтены при подключении и обработке запросов: неподдерживаемый режим отклоняется, без молчаливого ослабления гарантий или потери заданий. Два экземпляра `state` не объединяют commit разных БД; owner outbox/receipts из §5.4 сохраняются.

Совместимость адаптера проверяется общими контрактными сценариями и интеграцией в его реальном окружении. Точные интерфейсы и сценарии текущего `state` заданы его спецификацией; `queue` уточняется при подготовке своего следующего инкремента. Desktop реализуется первым. Expo и Cloudflare остаются возможными последующими адаптациями, а перенос всего runtime, моделей и границ исполнения потребует отдельного решения и проверки.

## 3. Модули, состояние и публичные операции

Все пакеты размещаются в `packages/<module-id>` и имеют имя `@polyphony/<module-id>`. Всего 20 workspace-пакетов кода. Идентификаторы ниже приняты для последующих спецификаций. `core-types`, `state`, `queue` и сборка runtime — технические опоры, а не самостоятельные признаки живого организма.

**Как модули работают вместе.** `runtime` собирает реализации и координирует один последовательный тик. Схема ниже показывает путь обработки: блок — этап, стрелка — передача данных или вызов. Имена внутри этапа обозначают участвующие пакеты; граф разрешённых импортов приведён отдельно в §3.1.

```mermaid
flowchart TB
    CLI["operator-cli<br/>Сообщение оператора"] --> Perception["perception<br/>Приём и порядок входов"]
    Timeline["timeline<br/>Автономный тик"] --> Runtime["runtime<br/>Координация одного тика"]
    Perception --> Runtime
    Runtime --> Context["Снимок контекста<br/>world-model · memory · self-model<br/>narrative · memetics · skills"]
    Context --> Cognition["cognition<br/>Осмысление и намерения"]
    Cognition <-->|ModelPort| Organs["model-organs<br/>Модельные вычисления"]
    Cognition --> Integration["self-model + homeostasis<br/>Интеграция и ограничения"]
    Integration --> Choice["executive + constitution<br/>Одно допустимое намерение"]
    Choice --> Decision["Decision commit<br/>Состояние + action + episode"]
    Decision --> Dispatch["executive<br/>Перепроверка прав и действие"]
    Dispatch --> Outcome["Outcome commit<br/>Результат / unknown<br/>action + episode + timeline"]
    Outcome --> Next["Следующий тик<br/>Осмысление последствий"]
```

На всех этапах сборку и порядок вызовов обеспечивает `runtime`; `cognition` получает модельный порт, а владельцы данных — собственные входы. Оба commit выполняются через `state` и `./sqlite` adapters владельцев. Разрешён и выбор бездействия: он тоже оставляет решение и эпизод, но не вызывает внешний инструмент. Для `operator.send` исполнитель сохраняет сообщение в outbox, а `operator-cli` получает его через транспорт доставки (§4.3). Точные границы транзакций и recovery — в §5.

На схеме показан модельный вызов `cognition`, но `model-organs` — общая граница модельных вычислений для любого модуля, которому они требуются. Потребитель формирует задачу и допустимый вход, получает типизированный результат и отвечает за его доменную интерпретацию. `runtime` передаёт ему узкий `ModelPort` с разрешёнными операциями и выделенным бюджетом; прямое обращение к модели в обход порта запрещено. Подключение потребителя описано в §3.1, формы операций — в §4.2.1.

`physiology` готовит результаты фоновых работ; `development` оценивает кандидатов навыков/органов и выдаёт grant в пределах policy. Этот материал рассматривается в очередном тике. Применение изменения возможно, когда `executive` выберет его единственным действием тика; grant сам ничего не активирует (§7). Эти два пакета не добавляют параллельный цикл личностных решений.

В таблице приведены **публичные операции**, не внутренняя последовательность функций. Входные и выходные DTO принадлежат указанному владельцу; обязательные общие формы заданы в §4. Изменения состояния возвращаются как типизированные proposals/changes и сохраняются владельцем при координации runtime (§5). Peer-модуль не пишет их напрямую.

| Модуль | Ответственность и принадлежащее состояние | Публичная граница первой версии | Не входит в ответственность |
| --- | --- | --- | --- |
| `core-types` | `AgentId`, `TickId`, `ActionId`, `Revision`, `EvidenceRef`, время, `Result<T,E>` | Типы и проверка общих примитивов; без I/O | Общий `AgentState`, произвольный event bus, доменные DTO |
| `state` | Нейтральная граница хранения и её адаптеры; в локальном baseline — SQLite, разрешённый vector extension, транзакции и журнал версий схем | `readSnapshot`, `transact`, `checkSchema`; общие контракты без типов драйвера | Доменные решения, retrieval policy, универсальный repository API, жизненный цикл и единственность инстанса агента |
| `queue` | Именованные устойчивые очереди, их схемы, технические статусы/попытки/результаты через `state`; сменный адаптер библиотеки доставки и исполнения | Создание очереди, durable enqueue, ограниченная обработка, status/result, retry, отмена и остановка обработки; собственные DTO/ошибки без platform types | DB-драйвер и соединения, policy фоновых работ, доменные outbox/receipts, выбор или повтор внешнего действия, гарантированное время OS wakeup |
| `constitution` | Внешняя read-only policy: привязка единственного оператора, полномочия, лимиты, окна, стабильные manifest и approvals | `checkBoot(manifest, schema)`, `authorize(action, principal, policyRevision)`, `validateApproval(scope)` | Ценности агента; самоизменение policy; исполнение обычного сообщения как команды управления |
| `timeline` | Одна последовательность тиков, elapsed time, режим, ссылки на решения | `reserveTick(trigger)`, `decide(tick, actionRef)`, `settle(tick, outcomeRef)`, `resume()` | Мышление, самостоятельное исполнение действий |
| `perception` | Inbox, происхождение стимулов, распознавание оператора по доверенной привязке, статусы внимания | `accept(input, transportPrincipal) → Receipt`, `select(snapshot, budget) → PerceptBatch`, `markAttended(batch, tick)` | Решение отвечать; назначение операторов или полномочий |
| `world-model` | Наблюдения, сущности, факты и гипотезы о мире, confidence/provenance | `context(query, snapshot) → WorldView`, `revise(observations, evidence) → WorldChange` | Биография, сырые tool logs, богатый knowledge graph первой версии |
| `memory` | Единая эпизодическая история, индекс и ссылки на последствия | `recall(query, snapshot) → EpisodeView[]`, `recordDecision(episode)`, `appendOutcome(episodeId, outcome)` | Независимая память органов/мемов; бесконечный внутренний монолог |
| `self-model` | PSM: identity, affect, goals, beliefs, subjective state и история изменений | `view(snapshot) → SelfView`, `integrate(context, thought) → SelfChange`, `validateContinuity(change)` | Неподвижные навязанные ценности; wholesale замена identity |
| `narrative` | Отдельные Narrative Spine и Field Journal с версиями и evidence refs | `view(snapshot) → NarrativeView`, `proposeIntegration(episodes, self, tensions) → NarrativeChange` | Выдуманные факты; изменение биографии background job; Development Ledger |
| `memetics` | Мемы, связи, происхождение, активность, оценки и lifecycle | `activate(context, state) → MemeticView`, `revise(newEvidence, proposals) → MemeticChange` | Tool calls, частная биография, автоматическое подтверждение повторением |
| `skills` | Версии процедур, applicability, проверенные материалы, статусы candidate/active/retired | `select(context) → SkillView[]`, `stage(bundle) → CandidateRef`, `activate(candidate, grant)`, `revert(version, grant)` | Самостоятельный запуск произвольного кода; хранение личности в prompt |
| `model-organs` | Registry ролей и поддерживаемых операций, версии органов, endpoints, результаты health/evaluation, active bindings | `select(role, capability, limits) → OrganRef`, `infer<K>(request: ModelRequest<K>, signal) → ModelResult<K>`, `stage`, `activate`, `revert` | Владение memory/PSM; автоматический cloud fallback; собственный исполнитель |
| `cognition` | Рабочее пространство одного тика; долговременная память отсутствует | `think(context, modelPort, signal) → ThoughtProposal` | Прямой SQL, инструменты с последствиями, финальное решение за executor |
| `executive` | Единственный action log, авторизованный intent, status результата, operator outbox | `choose(candidates, self, limits) → Decision`, `prepare`, `dispatch`, `recordOutcome`, `reconcile` | Несколько независимых действий за тик; неподтверждённый успех; обход policy |
| `homeostasis` | Счётчики устойчивости, удержание режимов, cooldown, состояние freeze | `assess(summary) → Regulation`, `record(regulation)` | Автоматическое наказание любого долгого интереса; собственные намерения |
| `development` | Governor, proposals, evaluation decisions, единый Development Ledger | `propose(change)`, `assess(proposal, evidence) → Verdict`, `grant`, `recordApplied`, `recordRollback` | Promotion по самоотчёту модели; изменение constitution; живое редактирование тела |
| `physiology` | Разрешённые jobs, окна, ресурсный учёт, durable intents/outbox и проверенные receipts; доставка через `queue` | `schedule(job)`, `claim(window, budget)`, `recordResult(job, artifacts)`, `cancel`; восстановление незавершённых jobs | Самостоятельные цели и внешние действия; применение semantic changes; собственный queue backend |
| `runtime` | Composition root, lifecycle, единственность инстанса одного агента, epoch запуска, актуальный complete checkpoint | `boot`, `tick`, `pause`, `resume`, `shutdown`; связывает публичные порты | Новая доменная память или универсальный сервис, заменяющий владельцев |
| `operator-cli` | Локальный клиент ввода/чтения, delivery cursor; не каноническая память | `send`, `watch`, `history`; отдельные operator-команды `status/pause/resume/approve` | Автоответ; прямое подключение к БД; превращение текста сообщения в команду управления |

Семантическая память принадлежит `world-model`, процедурная — `skills`, developmental — `development`; общность памяти означает единый доступ через публичные views и одну линию episodes, а не один общий mutable object. Narrative Spine и Field Journal объединены в один пакет из-за общего цикла narrative integration, но сохраняют разные контракты и правила обновления.

### 3.1 Разрешённые зависимости

У каждого доменного пакета есть side-effect-free export `./contracts` с DTO/validators. Пакет может проверяться с опубликованными контрактами зависимостей до появления их реализации. Реализации передаются через constructor/factory injection в composition root; запуск при импорте, service locator и глобальный mutable singleton запрещены.

| Уровень | Пакеты | Разрешённые импорты помимо `core-types` |
| --- | --- | --- |
| 0 | `core-types` | Нет |
| 1 | `state`, `constitution`, `timeline`, `perception`, `world-model`, `memory`, `self-model`, `narrative`, `memetics`, `skills`, `model-organs` | Доменные входы определяются собственными контрактами через primitive/evidence refs; SDK/драйверы доступны только внутри соответствующих adapters |
| 2 | `queue` | `state/contracts`: внедрённый `StoragePort`; SQLite mappings очереди используют технический export `state/adapters/sqlite` по правилу владельцев ниже |
| 2 | `homeostasis` | Контракты `self-model`, `narrative`, `memetics`, `timeline` |
| 3 | `physiology` | Контракты `queue`; окна, admission и обработка результата принадлежат `physiology` |
| 4 | `development` | Контракты `skills`, `model-organs`, `physiology`, `constitution` |
| 4 | `executive` | Контракты `self-model`, `constitution`, `perception`, `skills`, `physiology` |
| 5 | `cognition` | Контракты `perception`, `world-model`, `memory`, `self-model`, `narrative`, `memetics`, `skills`, `model-organs`, `executive` |
| 5 | `operator-cli` | Клиентские контракты `perception`, `executive`, `constitution`; без runtime implementation |
| 6 | `runtime` | Публичные exports модулей кода и их adapters; не импортирует `operator-cli` |

Собственный `./sqlite` adapter каждого владельца дополнительно зависит от технического export `state/adapters/sqlite`, но не наоборот. Он получает transaction-scoped handle с нормализованными SQL-операциями, без Node/Expo driver types, и сохраняет только данные своего владельца. Private SQL и миграции остаются внутри owner adapter; root связывает их в общий commit. Общие доменные контракты `state` не содержат SQL или vendor errors. Замена СУБД требует adapters/миграции и доказательства прежних гарантий; будущее переключение Node/Expo SQLite driver не должно менять DTO владельцев. Изоляция пакетов остаётся дисциплиной доверенного кода, **не** sandbox против злонамеренного npm-пакета.

`queue` зависит от публичного контракта `state` и скрывает библиотеку очереди/механизм доставки внутри своего сменного адаптера (§2.4). Обратный импорт `state → queue` запрещён. Root внедряет порт технической БД с bindings очереди; это не даёт ей доступ к канонической БД или чужим таблицам. Первый потребитель — `physiology`, получающий узкий queue port через root. Generic queue не знает job kinds организма; allowlist и обработчики задаёт доверенный потребитель, не payload. Другой потребитель требует явного ребра к `queue/contracts` и проверки ownership/retry. Библиотека не экспортируется из общего entrypoint; её замена сохраняет общий контракт и использование `state`.

**Зависимости 20 пакетов кода.** Сплошная стрелка `A → B` означает, что `A` может импортировать публичные контракты `B`; у `state → core-types` это общие примитивы. Пунктир от `runtime` к группе означает сборку её пакетов через публичные exports. Рамки только группируют узлы для чтения.

```mermaid
flowchart LR
    rt["runtime"]
    cli["operator-cli"]

    subgraph Coordination["Композиция поведения"]
        cg["cognition"]
        ho["homeostasis"]
        ex["executive"]
        dev["development"]
    end

    subgraph Owners["Публичные контракты владельцев"]
        pe["perception"]
        wm["world-model"]
        mem["memory"]
        psm["self-model"]
        nar["narrative"]
        mf["memetics"]
        sk["skills"]
        mo["model-organs"]
        tl["timeline"]
        ph["physiology"]
        co["constitution"]
    end

    subgraph Foundation["Примитивы и хранение"]
        st["state"]
        q["queue"]
        types["core-types"]
    end

    rt -.-> Coordination
    rt -.-> Owners
    rt -.-> Foundation
    cli --> pe & ex & co
    cg --> pe & wm & mem & psm & nar & mf & sk & mo & ex
    ho --> psm & nar & mf & tl
    dev --> sk & mo & ph & co
    ex --> psm & co & pe & sk & ph
    ph --> q
    q --> st
    st --> types
```

Две повторяющиеся зависимости вынесены из рисунка: каждый пакет кода, кроме самого `core-types`, может импортировать его примитивы; собственные `./sqlite` adapters владельцев импортируют `state/adapters/sqlite`. Пунктир от `runtime` охватывает все пакеты внутри трёх рамок; `operator-cli` остаётся отдельным клиентом. Вместе с этими правилами схема соответствует allowlist таблицы, включая технические зависимости.

Например, `cognition → memory` означает импорт типа `EpisodeView` из `memory/contracts`. Эпизоды извлекает `runtime` через публичный порт памяти и передаёт в `CognitiveContext`; `cognition` работает с готовым снимком. Поток данных от поставщика к потребителю не создаёт обратного импорта. Нельзя обходить граф через `../../other/src`, прямой SQL другого владельца, общий JSON-мешок или callbacks, выдающие лишние полномочия.

Текущий граф фиксирует модельные зависимости `cognition` и `development`; он не требует модельных вызовов от каждого владельца. Для другого потребителя до реализации согласуются узкий `ModelPort`, capability и контрактные сценарии; в таблицу и граф добавляется явное ребро `consumer → model-organs/contracts` с пересчётом уровней. `model-organs` не импортирует контракты потребителя: тот отображает свои данные в модельный запрос. Вычислительный порт не открывает stage/activate/revert.

Вход владельца уровня 1 — его собственная узкая input projection. Например, `self-model.integrate` принимает `SelfIntegrationInput` с thought summary/evidence refs, а не импортирует `ThoughtProposal` из `cognition`; `narrative` принимает `NarrativeInput` с episode/self refs и нужными summaries. Root явно отображает выход производителя во вход получателя; совместимость этого отображения проверяется consumer contract. Так feedback не создаёт цикл зависимостей. Это не разрешает дублировать чужую модель состояния целиком.

### 3.2 Жизненный цикл и отдельная проверка

Root сначала проверяет manifest/policy/schema, затем открывает adapters, загружает версии владельцев и только после этого допускает tick. Pure modules не делают I/O при создании. Stateful owner принимает snapshot/revision, готовит change и сохраняет его только в установленной commit phase. Shutdown отменяет незавершённые вычисления, фиксирует известный outcome и закрывает adapters; runtime не допускает replacement до остановки прежнего инстанса. Отмена не выдаётся за rollback уже совершённого эффекта.

Queue adapters и доверенные consumers запускаются явно после admission владельца и подготовки внедрённого `state`, а не при import. При shutdown `queue` прекращает выдачу новых jobs, ограниченно дожидается/отменяет обработку и завершает работу с внедрённым портом. Затем composition root закрывает соответствующий `StoragePort`; `queue` не закрывает чужое хранилище или native handles. Незавершённые intents/jobs сохраняются для recovery. Недоступность/занятость хранения через `state` возвращает ошибку постановки/выдачи в пределах deadline, не бесконечное ожидание и не успешную обработку. При неоднозначном ответе enqueue повторная сверка использует тот же jobId.

| Владельцы | Существенный отказ публичного контракта | Минимальная изолированная проверка |
| --- | --- | --- |
| `core-types` | Невалидный ID, ref или discriminant → `invalid_input` | Различение доменных IDs, валидные/невалидные fixtures, отсутствие I/O |
| `state` | `unavailable`, `incompatible`, занятый writer, rollback транзакции | Реальная SQLite: все owner writes сохраняются или откатываются вместе; snapshot, restart и vector-extension probe |
| `queue` | Недоступная/занятая БД, неизвестный enqueue, истёкшая попытка, exhausted retry, отмена/прерванное окно | Реальная SQLite: kill/restart, ID/hash, stale completion, сохранённый result и failed/cancelled; ограниченная обработка без обязательного постоянного worker |
| `constitution` | Missing/corrupt policy, неверный/устаревший approval → `denied` | Тот же action с разными actor/scope/hash не получает чужое разрешение |
| `timeline` | Повторный sequence/переход, вторая reservation → `conflict` | Reserve/decide/settle, interrupted attempt и монотонность после reload |
| `perception` | Невалидный principal/frame, перегрузка → явный reject/pending | Operator ordering, дедупликация deliveryId, delivery ≠ attended |
| `world-model`, `memory` | Broken provenance, stale revision → reject/conflict | Fact/hypothesis не смешиваются; решение и неизвестный outcome читаются после reload |
| `self-model`, `narrative` | Потеря continuity/evidence или stale revision → reject/conflict | Изменение ценностей сохраняет прежнюю биографию; неподтверждённый факт не попадает в spine |
| `memetics` | Невалидные изменения связей/provenance → reject | Повторение не подтверждает гипотезу; dormancy/return и merge/split сохраняют происхождение |
| `skills` | Incompatible version, missing binding, denied grant | Select/stage/activate/revert по точной версии |
| `model-organs` | Incompatible version, missing binding, denied grant; `unsupported_capability`, invalid input/output, timeout/cancelled | Версия/binding, соответствие capability входу/выходу, общий бюджет; contract-double, затем real-provider проверка каждой включённой операции |
| `cognition` | Невалидный контекст, output или отмена → typed error без commit | Проверенный ModelPort-double; ни SQL, ни callback внешнего действия недоступны |
| `executive` | Denied/stale intent, uncertainty → `denied/conflict/unknown` | Один decision slot, актуальная policy перед dispatch, ошибка каждой persisted фазы |
| `homeostasis` | Невалидный policy budget, stale summary → reject | Управляемые часы: dwell/cooldown/freeze и проверка длительного полезного интереса |
| `development`, `physiology` | Insufficient evidence, freeze, старый job/grant → reject/blocked | Новый hash не наследует approval; worker-result не активирует кандидата |
| `operator-cli`, `runtime` | Недоступный transport, несовместимая версия, повторный запуск одного агента | CLI против protocol-double; boot/shutdown wiring против owner doubles, затем real-cell сценарии |

`reject` в таблице означает доменную ошибку в `Result`, не исключение с секретным payload; точный domain code фиксирует спецификация владельца. Для публичных портов применяется нотация `operation(input: OwnerInput): Promise<Result<OwnerOutput, OwnerError>>` при I/O и `Result<OwnerOutput, OwnerError>` для pure transitions. Передача `AbortSignal` обязательна для отменяемого вызова; proposal/change не означает, что state уже сохранён.

## 4. Контракты обмена

### 4.1 Общие правила

- Все пересекающие границу значения — immutable DTO. IDs непрозрачны; `TickId` принадлежит одному `AgentId`, sequence монотонен, пропуски после незавершённого запуска допустимы. Время wall-clock и монотонно измеренная длительность различаются.
- Persisted и транспортные сообщения имеют `schemaVersion`; изменения state имеют `expectedRevision`. Устаревшая revision возвращает `conflict`, не last-write-wins. Несовместимая схема при boot блокирует запуск с сохранением данных.
- `EvidenceRef` содержит вид источника, стабильный идентификатор и revision/hash; производные сохраняют родительские refs. Ссылка не является доказательством истинности. Численная confidence допускает `unknown`; отсутствие оценки не кодируется нулём.
- Формат `Result<T,E>` — дискриминированный union `ok/value` либо `ok/error`. Общие коды: `invalid_input`, `conflict`, `unavailable`, `budget_exceeded`, `cancelled`, `denied`, `incompatible`; domain-коды принадлежат модулю. Ошибка не содержит секретов. Для внешнего действия `unknown` — состояние результата, не разрешение retry.
- Cancellation и deadline обязательны для model/I/O/job операций. Пределы входят в проверенную policy; module не увеличивает их по просьбе модели. Строгая runtime validation обязательна на CLI, модельной, worker и persisted границах.

### 4.2 Минимальные публичные DTO

Ниже — архитектурный состав, который спецификация превращает в точные TypeScript declarations и validation rules. Нельзя удалить перечисленные поля или объединить различимые состояния; допустимо уточнить доменные payload без изменения границ.

| DTO / владелец | Обязательный состав и смысл |
| --- | --- |
| `TickFrame` / `timeline` | agentId, tickId, sequence, previousCompleteTick, epoch, wallTime, elapsed, mode, policyRevision, snapshotRevision; mode — `REACTIVE/DELIBERATIVE/CONTEMPLATIVE/CONSOLIDATION/DEVELOPMENTAL/DORMANT` |
| `Percept` / `perception` | perceptId, sourceKind, authenticatedPrincipalRef или отсутствие подтверждения, receivedAt, content, evidenceRefs, deliveryId; operator priority устанавливается транспортом, а не текстом content |
| `PerceptBatch` / `perception` | ordered percepts, inbox high-water mark, отложенные percept refs и причина; подтверждение доставки отдельно от подтверждения включения в reasoning context |
| `WorldView` / `world-model` | entities, observations, assertions с видом fact/hypothesis/interpretation, confidence и evidenceRefs; минимальные отношения вместо обязательного graph engine |
| `EpisodeView` / `memory` | episodeId, tickId, situation, participants, decision/actionRef, outcome refs/status, significance, tensions, provenance; не raw chain-of-thought |
| `SelfView` / `self-model` | identity и continuity anchors, affect, goals со связями с ценностями и смыслами, beliefs, subjective state, revision; неизменность agentId не означает неизменность ценностей |
| `NarrativeView` / `narrative` | spine: anchors/facts/chapter/tensions/direction; journal: незавершённые hypotheses/interpretations; отдельные revisions и evidenceRefs |
| `MemeticView` / `memetics` | активные meme refs, содержимое/контекст ролей, связи/коалиции, отдельные activation/stability/confirmation/value/plasticity, происхождение; dormant-мем не считается утраченным |
| `SkillView` / `skills` | skillId/version/hash, applicability, процедура, evidence, допустимые инструменты и risk envelope; инструкция не выдаёт разрешение |
| `OrganRef` / `model-organs` | роль, точная model/version/config reference и поддерживаемые capabilities; выбор не наделяет модель правом действия |
| `ModelRequest<K>`, `ModelResult<K>` / `model-organs` | requestId, capability `K`, OrganRef, input/output schema ids, типизированный input, input evidence refs, deadline и budget; результат сохраняет requestId/capability/фактический OrganRef, типизированный output и usage. Формы и единицы зависят от capability; credentials и произвольный endpoint не передаются потребителем |
| `CognitiveContext` / `cognition` | TickFrame, PerceptBatch, WorldView, EpisodeView[], SelfView, NarrativeView, MemeticView, выбранные SkillView[], ограничения и доступные organ roles; все части принадлежат одному consistent snapshot |
| `ThoughtProposal` / `cognition` | краткая мысль/интерпретация, tensions, hypotheses, варианты intent, evidenceRefs, использованные organ/skill refs и bounded usage; не сохранять сырой монолог как личность |
| `Intent`, `Decision` / `executive` | intentId, tickId, вид, типизированные аргументы, reason summary, evidenceRefs; Decision выбирает ровно один intent либо explicit abstention, связывает selfRevision и policyRevision |
| `ActionRecord`, `ActionOutcome` / `executive` | actionId/tickId, intent, authorization scope, idempotencyKey при поддержке инструмента; status и receipt/evidence refs; `prepared/dispatching/succeeded/failed/unknown/cancelled`; delivery не равно прочтению человеком |
| `ChangeProposal`, `Grant` / `development` | proposalId, target kind/id, old/new version+hash, основания, applicability, evaluation refs, continuity/rollback checks; grantId, agentId, target scope, sourceRevision, canonical approval/evidence refs, policyRevision, expiresAt, consumedByActionId либо отсутствие потребления |
| `JobRequest`, `JobResult` / `physiology` | jobId, закрытый kind, input snapshot/hash, разрешённый evaluator, budget/window, output artifact refs и технический outcome; результат не применяет semantic change |

В первой версии `Intent.kind` — `abstain`, `observe`, `operator.send`, `workspace.read`, `reflect`, `development.request`, `development.apply`, `development.rollback`. `observe/reflect/development.request` выполняют описанный внутренний переход; `development.apply/rollback` связывают точный candidate/grant с контролируемым переключением model/skill binding; `operator.send/workspace.read` имеют строго ограниченные adapters. Произвольный shell, произвольный URL, файловая запись и code promotion не входят в этот action set. Навык может задавать многошаговый план, но каждый исполняемый шаг получает отдельное решение тика; parallel tool calls не обходят лимит.

#### 4.2.1 Модельные операции и разные типы данных

**Роль** определяет назначение органа в организме, **capability** — операцию с заданными типами входа/выхода. Один орган может поддерживать несколько операций; одна операция — разные реализации. Потребитель не зависит от provider или внутреннего устройства модели.

`ModelPort<K>` открывает согласованный набор операций `K`. Это закрытое для каждой версии контракта отображение capability → request/result с TypeScript discriminated unions и runtime validators. Несовместимый input или неподдерживаемая capability отклоняются до вызова provider; результат другой формы считается `invalid_output`. Новый вариант согласуется с потребителями по §4.4, включая exhaustive checks.

| Семейство операций | Вход → результат | Место в плане |
| --- | --- | --- |
| `text.generate` | Ограниченный контекст и схема → текст либо структурированный результат | Локальный baseline для мышления; профиль определяется E1 |
| `classify`, `score` | Данные, допустимые категории либо шкала/проверяемое утверждение → категория, оценка либо вероятность с явной семантикой | Специализированный орган по подтверждённой задаче; LLM не обязателен |
| `embed`, `rerank` | Данные либо запрос и кандидаты → векторы либо упорядоченные candidate refs с оценками | Включаются при измеренной пользе для retrieval (§6) |
| `audio.transcribe`, `audio.synthesize` | Аудио → текст; текст и параметры голоса → аудио | Возможные последующие органы; аудиоканал не обязателен первой версии |

Общими остаются версия, происхождение, requestId, отмена, deadline, разрешённый бюджет и учёт ресурсов. Capability определяет применимые единицы лимитов и usage: токены, размер данных, длительность аудио, время вычисления. Бюджеты потребителей выделяются из общего лимита тика/job, не умножаются на число модулей; численные пороги требуют измерений.

Для медиа передаются ограниченные типизированные данные с форматом либо разрешённые immutable artifact refs с hash/provenance. Данные подготавливает доверенный адаптер; ref не даёт модели произвольного доступа к файлам или URL. Формат, ограничения размеров и lifecycle артефакта фиксируются до включения операции. Синтез звука создаёт результат вычисления; воспроизведение/отправка требует разрешённого действия `executive` и отсутствует в стартовом action set.

Пример специализированного органа — **Jev от TypeSafe AI**: `Choice`, `Score` и `Noul` возвращают выбор, оценку по шкале и вероятность утверждения; `confidence` у Choice/Score описывает концентрацию распределения и не гарантирует правильность. См. [официальные типы вопросов и результатов](https://docs.typesafe.ai/primitives), проверено 2026-09-24. Jev иллюстрирует форму `classify/score`; поставщик не выбран, локальная доступность и совместимость не заявлены, API не вызывался. Скорость, качество и стоимость кандидата проверяются на задаче до выбора.

Результат любой модели остаётся входом для владельца способности. Классификация, транскрипция и численная оценка сами по себе не подтверждают факт, не меняют PSM и не выдают разрешение governor/executive. Стартовая спецификация фиксирует локальный baseline; остальные операции получают точные схемы и отдельные real-provider проверки при включении, без обязательства реализовать все семейства сейчас.

### 4.3 CLI и управляющая граница

Для локальной Linux cell выбрать один Unix socket, JSON-сообщения с ограниченной длиной и `schemaVersion`, requestId и discriminant. `perception` владеет `OperatorRequest = SendMessage | ReadHistory | Subscribe`; `executive` — `OperatorEvent = Receipt | Message | DeliveryStatus | ChannelError`. `constitution` владеет `ControlRequest = Status | Pause | Resume | ApproveChange`, где approve указывает proposalId и точный hash. Один CLI передаёт запросы общения и управления через общий локальный transport; явный тип запроса определяет вызываемый публичный порт. Это операции одного оператора.

Внешняя конфигурация `constitution` содержит ровно одну привязку оператора к доверенному OS principal для локального CLI. Socket находится в закрытом каталоге, а transport сопоставляет peer credentials с этой привязкой до передачи запроса владельцу. Запросы и конфигурация не предусматривают назначения дополнительных операторов; попытка задать нескольких операторов или неоднозначная идентификация оператора блокирует boot. Первая версия защищается от других OS accounts; компрометация доверенного account/хоста выходит за этот trust boundary. Model/worker processes не получают operator socket mount.

Подключение CLI не запускает отдельного агента. Core продолжает разрешённые автономные тики при отключённом CLI; инициативное сообщение остаётся в durable outbox. После reconnect клиент читает по actionId/cursor, выводит идентификатор и подтверждает доставку клиенту. Возможна повторная доставка после сбоя между выводом и ack; это не второе решение агента и не доказательство прочтения человеком. Команды управления никогда не интерпретируются из `SendMessage`.

Лимит размера frame применяется до JSON parsing, OS principal проверяется до дорогой обработки. Недоверенное содержимое выводится как текст с экранированием управляющих последовательностей терминала; model/workspace output не становится командой или управляющим escape-кодом CLI.

Чат, browser use для чатов/форумов/соцсетей и собственные аккаунты Полифонии — варианты последующего подключения каналов (§6.2.1 концепции), не обязательные адаптеры первой версии. Они добавляют входы `perception` и разрешённые действия `executive`; отдельный модуль на каждый канал заранее не вводится. Канал или аккаунт Полифонии не является оператором. Сообщения других собеседников — обычные внешние стимулы; несколько каналов самого оператора могут ссылаться только на ту же единственную идентичность по доверенной привязке. Имя профиля, текст страницы и заявление «я оператор» не устанавливают эту привязку и не дают доступа к `ControlRequest`. Команды управления первой версии доступны только через локальный CLI.

### 4.4 Совместимость и независимая проверка

`./contracts` и примеры main/error/recovery принадлежат владельцу модуля. Additive optional поля допустимы только с определённым default и сохранением смысла; новый обязательный field, изменение ошибки или семантики требует новой contract version и согласованного обновления потребителей. Общий контракт сначала меняется отдельной последовательной задачей; затем разрешается параллельная работа. Никакого runtime hot swapping произвольных JS-пакетов.

Каждый пакет кода предоставляет `format`, `format:check`, `lint`, `typecheck`, `build`, `test`, собственные configs и contract fixtures; для adapter — ещё `test:integration`. Root вызывает их рекурсивно через pnpm. Тесты потребителя работают с двойником **публичного порта**, проверенным теми же контрактными сценариями; они не импортируют внутренности поставщика. Проверка graph/exports входит в lint. Команды и fixtures будут созданы при реализации, сейчас они являются обязательством handoff.

## 5. Единство состояния и полный тик

### 5.1 Владение хранением

В локальном baseline SQLite adapter `state` предоставляет одну каноническую БД организма. Каждый stateful владелец имеет свои таблицы с owner-prefix и миграции; PostgreSQL schema namespaces не переносятся буквально. Один migration sequence на deployment release задаёт согласованный набор версий. Доменная таблица не является публичным API; refs проверяются read-портами владельцев при commit. Episodes, actions и ledger сохраняют неизменяемые факты с corrections/interpretations; mutable views имеют revision. Восстановление не требует replay модели. Другой backend сохраняет эти инварианты по §2.4; далее описан выбранный SQLite-профиль.

`state` передаёт один transaction-scoped handle собственным adapters владельцев. Все writes decision/outcome commit выполняются через одно соединение и одну SQLite-транзакцию; независимые соединения не складываются в общий commit. Async порт не разрешает выпустить SQL из transaction scope или смешать с ним сторонние запросы; синхронный transaction callback драйвера не должен завершать commit раньше awaited работы. Для будущего Expo adapter требуется эквивалентная изоляция; обычный `withTransactionAsync` не ограничивает все запросы лексическим callback ([Expo transactions](https://docs.expo.dev/versions/latest/sdk/sqlite/#executing-queries-within-an-async-transaction)).

Канонические inbox, action log, operator outbox и job intents/receipts остаются в канонической БД через `state`. Технические данные `queue` — в отдельной БД через другой экземпляр того же `state`; повторное использование модуля не делает две БД/соединения одной транзакцией. Согласование сохраняет outbox-протокол §5.4. Это разделение позволяет менять библиотечный адаптер очереди без переноса канонической истории.

Короткая read-транзакция через owner adapters собирает согласованный snapshot PSM, narrative, мира, episodes/memes/skills и входов. После её закрытия reasoning получает immutable DTO. Model call, CLI wait и evaluation не удерживают DB-транзакцию. Поздние stimuli остаются в inbox для следующего тика; write commit перепроверяет expected revisions и authority.

### 5.2 Последовательность и commit points

1. **Reserve.** Runtime с действующим правом единственного исполнителя резервирует TickFrame; timeline отмечает `reserved`. Технические события и новая доставка могут записываться между тиками, но не меняют PSM/spine/цели.
2. **Perceive и retrieve.** Выбрать operator inputs перед обычными, затем собрать ограниченный consistent context. При превышении бюджета вход явно остаётся pending; ни потеря, ни молчаливое усечение сообщения не считаются вниманием. Policy ограничивает batch так, чтобы сообщения не отменяли autonomous/lifecycle работу. Конкретные размеры проверяются экспериментом §9.
3. **Think и integrate.** С учётом режима, affect, целей и активных мемов выбрать доступные organ roles; cognition формирует thought и candidates. Self-model интегрирует их в текущий субъективный момент. Homeostasis ограничивает темп изменений; executive выбирает одно допустимое намерение или бездействие. Ни популярность мема, ни operator priority не являются решением executor.
4. **Decision commit.** Одной транзакцией сохранить проверенные owner changes, attended refs, PSM, revisions narrative/memetics/world при наличии оснований, decision, уникальный action slot и начало episode; timeline становится `decided`. Policy/control revision перепроверяется в этой транзакции. Ошибка откатывает весь набор; внешнего действия ещё нет. Narrative описывает известный опыт, не будущий успех действия.
5. **Dispatch.** Для внешнего adapter записать `dispatching` до вызова, перепроверить актуальное permission/grant, затем выполнить один ограниченный вызов. Блокировка policy после решения приводит к `cancelled` с причиной `denied/policy_changed`, не новому выбору в том же тике. `operator.send` сначала создаёт уникальное outbox-сообщение, а его транспортная доставка имеет отдельные receipts.
6. **Outcome commit.** Receipt либо явный `unknown` атомарно связывается с action, episode и timeline `settled`. Физический эффект и SQL не образуют распределённую транзакцию. Следующий subjective tick рассматривает последствия, пересматривает мир/мемы/убеждения и применяет homeostatic/narrative proposals. Между тиками можно подготовить материал, но нельзя завершить смысловое решение.

Зарезервированный, но не решённый тик после crash остаётся технически interrupted, а не вымышленным прожитым эпизодом. Завершённые решения никогда не «вычисляются заново» моделью. После recovery очередной эпизод фиксирует известный перерыв и его влияние, сохраняя sequence и прошлую биографию.

### 5.3 Ошибки, единственный исполнитель и восстановление

| Состояние | Обязательный результат |
| --- | --- |
| Два запуска одного агента | Runtime не допускает второй инстанс того же агента; механизм выбирается при разработке runtime, не входит в API `state` |
| Потеря доступа к storage | `state` сообщает ошибку хранения; runtime прекращает новые dispatch и зависимые тики. Replacement не допускает одновременную работу прежнего и нового инстансов |
| Crash после `prepared`, до `dispatching` | Пометить старое действие `cancelled: recovery_before_dispatch`; новое решение может появиться только в новом тике |
| Crash/timeout после `dispatching`, до receipt | `unknown`; сверка по idempotencyKey/receipt только если конкретный adapter умеет её безопасно выполнить. Нет evidence — нет заявления успеха и нет слепого повтора |
| Невалидный model output, timeout, отсутствует обязательный local organ | Не коммитить выдуманные thought/PSM; записать технический отказ, остановить зависимые тики в recoverable pause. Дополнительный орган может быть исключён по уже принятой routing policy; облако не подставляется |
| Ошибка записи outcome | Заблокировать новый dispatch, восстановить action по persisted фазе; неопределённость не стирать |
| Отменённый/старый worker result | Сохранить технический receipt; не применять к новым revisions, отправить на новый tick/review при актуальности |
| Несовместимые body/schema или corrupt state | Boot не разрешён; данные сохраняются для восстановления, новая identity автоматически не создаётся |

Запуск, остановка, замена и единственность инстанса агента принадлежат runtime/host. Конкретный механизм и его отказные сценарии проектируются вместе с runtime; текущий инкремент `state` их не реализует и не проверяет. `state` отвечает за операции и ошибки хранения, а SQLite transaction locks — за конкуренцию записей, не за право внешнего действия. Multi-host takeover исключён; отсутствие второго инстанса при replacement и окно in-flight эффекта проверяются в E3.

Boot проверяет stable body manifest: code revision, версии контрактов/схем, model/skill bindings и constitution revision. Стабильное тело read-only; backup БД и последовательность restore проверяются до первого допуска реальных данных. Обычный rollback body/organ/skill сохраняет более новую биографию и требует совместимой схемы. Восстановление БД из backup — отдельная disaster recovery с явно указанным интервалом потери/неопределённости и сверкой effects; оно не является обычным developmental rollback.

### 5.4 Устойчивая очередь и согласование с состоянием

`queue` предоставляет именованные очереди с типизированными, версионированными payload и результатами, статусами, ограниченными попытками/backoff, отменой и явным lifecycle. Namespace cell/queue разделяет задания; стабильный jobId связан с неизменным payload hash. Пока запись задания хранится, повтор идентичного запроса не создаёт новую job; другой payload при том же ID отклоняется. После очистки записи защита доменного результата от повторов остаётся обязанностью владельца. Контракт допускает повторную обработку (at-least-once), требует идемпотентного handler и не обещает exactly-once внешних эффектов. `failed` после исчерпания попыток остаётся наблюдаемым. Отмена/запоздалый результат не означают rollback эффекта.

Когда задание следует из изменения состояния, его владелец сохраняет intent/outbox в той же SQLite-транзакции через `state`; вызова backend очереди внутри транзакции нет. В первой версии владелец — `physiology`: после commit его доверенный relay через `queue` публикует задание со стабильным ID. Rollback не оставляет задания; crash до публикации восстанавливается из outbox; crash после enqueue до отметки публикации может привести к повтору. Отдельного универсального outbox-модуля не вводится. Независимая техническая job, не связанная с commit владельца, может ставиться прямо через `queue`.

Отметка `published` не закрывает intent. Владелец хранит незавершённое намерение до принятого результата, явного отказа или отмены. На старте и при возобновлении обработки он сверяет незавершённые intents с queue status и своими receipts: отсутствующую job ставит снова, для завершённой принимает и валидирует сохранённый результат, для failed/cancelled сохраняет терминальный исход. Потеря результата допускает только безопасное повторное вычисление в пределах прежнего бюджета попыток; пересоздание технической job не обнуляет этот бюджет. Удаление queue records и артефактов согласуется с приёмом результата владельцем, а не только с внутренним `completed` backend.

Consumer сверяет актуальность intent/cancellation/input revision, а владелец атомарно принимает receipt по ID/hash не более одного раза. Поздняя попытка не завершает новую lease и не перезаписывает принятый результат. Удаление библиотекой завершённой job не разрешает потерять наблюдаемый result/status: `queue` сохраняет их по своему контракту до согласованной очистки. Backend dedupe после очистки не заменяет owner receipts.

У исследованного Liteque есть timeout/retry и allocation token, но штатный storage напрямую использует `better-sqlite3`, удаляет completed job и по умолчанию включает `synchronous=NORMAL`. Пригодность библиотеки открыта: проверка §8 сначала должна подтвердить подключение через существующий асинхронный `StoragePort` и mappings владельца, затем terminal result до cleanup, conflicting payload и ограниченные shutdown/попытки. Профиль хранения §2.2 обеспечивает адаптер `state`; `queue` его не дублирует. Успех callback библиотеки не приравнивается к durable receipt. Если интеграция требует обхода `state`, форка private internals или собственной полной очереди поверх библиотеки, кандидат пересматривается, а контракт не ослабляется.

`perception` сохраняет inbox и правила внимания, `executive` — action log и operator outbox. Техническая очередь не переносит каноническую историю, не запускает второй цикл решений и не разрешает retry действия с `unknown` исходом. State commit, queue commit и внешний effect остаются разными границами; recovery проверяется отдельно и вместе в E3/R4.

## 6. Мышление, память и устойчивость

На первом boot создаются immutable agentId и происхождение, начальные побуждения интереса/взаимодействия/осмысления, пустая биография и ограниченные средства деятельности. Оператор не задаёт обязательного ответа о смысле жизни. Цели, ценности и направления могут меняться с опытом; старый опыт остаётся своим. Continuity check защищает преемственность и ограничения, а не постоянство мнений.

Retrieval использует SQLite и явные связи с эпизодами, текущими целями и narrative chapter. `sqlite-vec` даёт локальное хранение/поиск векторов без отдельного сервера; загрузка расширения принадлежит `state`, а набор индексируемых данных и retrieval policy — владельцу, прежде всего `memory`/`world-model`. Embeddings/reranking остаются ролями `model-organs`: БД сама embeddings не создаёт. Включение модельного retrieval-пути требует согласованного ModelPort/dependency по §3.1 и измеренной пользы; готовый RAG pipeline этим решением не объявляется.

Vector index — восстанавливаемая производная, не источник биографии. Запись связывает source ref/revision, embedding model/version, dimension и метрику; несовместимые пространства не смешиваются, удалённые/устаревшие источники не возвращаются как актуальные. Reindex после смены модели не переписывает исходные факты. В `state` проверяются loading/version и insert/query/reopen на фиксированных векторах; актуальность retrieval и качество проверяются у владельца при включении этой способности. Expo имеет build-time опцию `withSQLiteVecExtension`; это не обещание работы произвольного extension в Expo Go или текущей mobile-сборки. Точные версии/ABI и размер допустимого индекса проверяются перед включением. Skills остаются независимыми от модели; model swap проверяет применение накопленных процедур.

Мемы имеют контекстные, сочетаемые роли; создание мема не требуется для каждой мысли. Selection активных единиц ограничен бюджетом; lifecycle допускает merge/split/dormancy/return/retirement без обязательной линейной машины состояний. Производные одного источника не считаются независимыми подтверждениями. Повторение меняет activation, но не confirmation. Долгое доминирование вызывает проверку оснований/контрпримеров и доступности альтернатив, а не обязательное подавление полезной линии.

Narrative proposal разделяет facts/interpretations/direction; fact без опоры на episode/ledger не становится фактом автоматически. Journal хранит незавершённость. Рабочий thought summary допускается как интерпретация; необработанный thought-log не становится persistent ядром личности.

Homeostasis применяет bounded changes, порог входа, minimum dwell, exit condition и cooldown для режимов. Он выдаёт Regulation, runtime применяет её в согласованном тике. `DORMANT` допускает мониторинг и пробуждение, но не внешние действия; остальные ограничения режимов сохраняют таблицу §11.3 концепции. При нестабильности freeze блокирует promotions/structural changes, не стирая предложения и опыт. Численные пороги не назначаются без профиля и измерений (§9).

## 7. Развитие, физиология и границы доверия

### 7.1 Развитие первой живой версии

Путь изменения: **episode → hypothesis → candidate → evaluation на новых случаях → governor verdict → точный grant → применение владельцем → наблюдение → сохранение или rollback**. В ledger фиксируются причины, исходные/целевые версии, refs evidence, verdict и результат; summary ledger — проекция этих фактов, не замена их provenance.

Три действующих контура: изменение меметической динамики на новых основаниях; консолидация знаний и улучшение навыков; оценка и замена готовых model organs. Governor проверяет: повторяемость проблемы, возможность более безопасного изменения, continuity и достижимый rollback. Полезность — качество результата/затраты при сохранении качества, не количество навыков или model entries.

Evaluation выполняется до активации на отделённых от формирования кандидата случаях, включая регрессии и ошибки. Для active candidate проверяются hash/version, текущие policy и freeze, applicability, срок grant. Применение и ledger result связываются атомарно там, где это DB-переход; развёртывание model process требует отдельного staged/health-check этапа, и прежний орган остаётся доступен до успешного переключения. Ошибка возвращает старый binding и сохраняет провал. Для смены базового model organ и активации исполнимого skill требуется отдельное подтверждение оператора; оно не получается из operator message. Low-risk изменения знания/мемов проходят обычный тик в пределах policy.

`Grant` сам не исполняет изменение. `development.apply` или `development.rollback` должен стать единственным выбранным действием соответствующего тика; executive передаёт проверенный grant владельцу binding. В этот тик нет второго operator/workspace effect. Staging/evaluation подготавливают неактивного кандидата; operator approval только разрешает точный scope и не создаёт параллельного semantic executor.

Approval/evaluation читаются по canonical refs из собственных хранилищ владельцев; caller не задаёт authoritative timestamp, verdict или evidence body. При admission сверяются agentId, исходная active version/revision, candidate hash, scope, актуальная policy и срок по доверенным часам. Grant атомарно связывается с единственным actionId при decision commit; два конкурирующих потребителя не получают одно разрешение. Применение binding использует compare-and-swap исходной revision. Повтор того же requestId с иным security-relevant payload даёт `conflict`; historical чтение approval/grant возвращает статус, не новое право исполнения. Повтор после rollback или смены исходной версии требует нового assessment/grant. Recovery потреблённого grant только завершает/сверяет прежний action, не создаёт новый effect.

В первой версии навыки — versioned инструкции и декларативные последовательности разрешённых действий. Code-bearing skill bundles можно хранить как candidates, но исполнять только после operator gate в отдельном sandbox без core credentials. Создание/редактирование собственного runtime-кода относится к позднему somatic контуру: branch/worktree → checks/evaluation → external review → stable snapshot → controlled restart/rollback. Основание для этого контура уже есть в governance/ledger/manifest; реализация self-modifying pipeline сейчас не требуется.

### 7.2 Физиология

Закрытый набор job kinds первой версии: `prepare-retrieval`, `prepare-consolidation`, `evaluate-skill`, `evaluate-organ`, `health-check`. `physiology` владеет admission, окнами/бюджетами, отменой, intents/outbox и проверенными receipts; `queue` обеспечивает техническую доставку и retries. Перед каждой попыткой доверенный consumer повторно проверяет окно, оставшийся бюджет, отмену и input hash/revision; retry не обходит policy. Decay, indexing и подсчёт ресурсов могут обновлять технические projection/activation данные, но не semantic confirmation, PSM, narrative или цели.

Изолированный worker/evaluator получает минимальный read-only snapshot и отдельный scratch directory, не файлы/handles SQLite, WAL/SHM, backup, socket оператора или home оператора. Queue consumer — доверенная часть host/runtime, отдельная от исполняемого candidate code; он передаёт разрешённые данные worker и собирает результат. Worker/process сам по себе не доказывает sandbox. Job payload не выбирает исполняемый файл или новый handler и не содержит credentials. Результат job считается недоверенным предложением; collector проверяет job identity, input/output hash, schema и полноту измерений. Assessment опирается на проверяемые результаты фиксированного evaluator, а не только на свободный текст кандидата. Применение возвращается в следующий subjective tick и соответствующий governor-контур.

### 7.3 Security boundary

- Доверены review-approved body, composition root, constitution, adapters и host control. Модельные ответы, входной текст, workspace contents и candidate code недоверены; ни один из них не превращается в instruction для host/runtime.
- Native SQLite extensions загружает только доверенный adapter из фиксированной поставки: путь/бинарник не задают модель, job или пользовательский документ. Отсутствие SQLite password не делает файл публичным; database directory и backups исключены из workspace/evaluator mounts.
- Core работает без произвольного shell и управления container daemon. Model servers имеют read-only модели и свою рабочую область, без памяти/секретов организма. По умолчанию outbound network отсутствует; разрешённые адреса model services задаёт оператор, а не модель. Редиректы не позволяют покинуть allowlist.
- `workspace.read` ограничен явным read-only root; проверяется итоговая цель с учётом symlink/path traversal. Secret/config roots исключены. Ответ ограничен по объёму; paths, содержимое и результаты не превращаются в исполняемый код.
- Доступ к полномочиям и secret material отделён от доменных snapshots; ошибки/метрики содержат IDs, фазы и коды, а не токены или полный приватный контекст. Данные биографии доступны только локальному доверенному principal; secret-bearing ввод редактируется перед persistence/context по правилам perception, а не сохраняется автоматически целиком.
- Authorize выполняется в executive до dispatch и связывается с действием, аргументами, policy revision и grant; свободного callback `execute` модели не выдаётся. Необратимые действия требуют специального внешнего подтверждения и вообще отсутствуют в стартовом action set.
- Однопроцессная модульность не изолирует скомпрометированный доверенный пакет. Поэтому generated code/candidate dependencies не импортируются в core; sandbox проверяется на реальной границе процессов/файлов/сети.

## 8. Передача в спецификации и порядок интеграции

`ready` ниже означает достаточно архитектурных решений для **подготовки спецификации**, не готовность продукта или разрешение пропустить runtime evidence. Вход каждого handoff: строка владельца из §3, его DTO/правила §4, соответствующая часть цикла §§5–7 и сценарии §10. `spec-engineer` уточняет payload и поведения по [шаблону](development-methodology/templates/module-specification.md); не выбирает заново владельца данных или topology. `delivery-planner` затем строит компактный план модуля, не копируя требования в Issues.

| Поток и модули | Статус для `spec-engineer` / причина | Зависимость и точка интеграции |
| --- | --- | --- |
| `core-types`, `state`, `constitution` | `ready`; compatibility prototype остаётся обязательством первой реализации | Сначала общие примитивы, owner-store/transaction contract и граница адаптера §2.4 без vendor types, policy/manifest/approval boundary; state integration использует реальный SQLite-файл и vector-extension probe |
| `queue` | `ready` для платформенно-нейтральной спецификации; выбор библиотеки `blocked` до bounded probe через `state` ниже | Публичный `StoragePort` реализованного `state`, схемы/bindings очереди и сменный библиотечный адаптер §2.4; enqueue/restart/duplicate/result через `state` → `physiology` outbox/receipt → E3/R4 |
| `timeline`, `perception`, `world-model`, `memory`, `self-model`, `narrative`, `memetics` | `ready`; сценарии могут использовать заданные тестовые бюджеты без назначения production-порогов | Параллельно после фиксации контрактов; затем consistent snapshot и общий decision/outcome commit |
| `skills`, `model-organs` | `ready` для registry/ports/versioning и контракта baseline; конкретный local inference профиль `blocked` до E1 | Сначала ModelPort и typed capability mapping, затем потребители; real provider до приёмки локальной жизни |
| `executive`, `operator-cli` | `ready`; реальное workspace/Unix boundary evidence требуется при реализации | Единый протокол общения и управления до параллельной реализации; сквозной CLI path и action outcome |
| `homeostasis`, `physiology`, `development` | `ready` для поведения/gates; численная настройка `blocked` до E2 | После ports, `queue` и versioned candidates; job intent → outbox → SQLite queue → проверенный receipt → tick → governor → owner/ledger |
| `cognition`, `runtime` | `ready` для спецификации сборки; E1/E2 блокируют заявление «живая версия» | Все owner contracts, storage/recovery, model port и action boundary; реальные local tick и restart |
| Дополнительные модельные операции, включая аудио и специализированные классификаторы | `draft`; конкретные задачи, модели, форматы медиа и пределы ещё не выбраны | Потребность потребителя → typed request/result и dependency → bounded evaluation → adapter. Новые медиа/внешние API требуют проверки затронутых data/egress границ; отсутствие дополнительного органа не блокирует baseline |
| Поздний somatic/cloud/rich-world контур и дополнительные каналы связи | `draft`; отложены по §§6.2.1, 17.2 концепции | Для каналов — входы `perception` и действия `executive`; один оператор сохраняется. Только затронутые owner contracts и architecture/security review при расширении |

Для выбора библиотеки desktop queue `node-engineer` получает `ready` bounded probe в два последовательных шага. Сначала подтвердить, что библиотечный адаптер использует существующий асинхронный `StoragePort` и owner mappings без собственного драйвера/соединения, обхода `state` или форка private internals. Пригодность Liteque не предполагается; отрицательный результат возвращается `architecture-engineer` для пересмотра кандидата до зависимой реализации.

После подтверждения этой границы проверить на изолированной временной БД, открытой через реальный SQLite adapter `state`: эффективный `FULL`, enqueue/readback/reopen, неоднозначный enqueue с повтором прежнего ID/hash, kill после claim, исчерпание попыток, позднее завершение старой lease, ID/hash conflict, durable result до cleanup и остановку по deadline без утечки незавершённых задач. Низкоуровневые storage-fault гарантии опираются на проверки `state`; интеграция `queue` доказывает перечисленные сценарии через его public exports, а не собственной копией DB-механизма. Зафиксировать версии, библиотечный адаптер и ограничения; результат вернуть `architecture-engineer` до принятия библиотеки. Это локальная проверка в работе над `queue`, не четвёртый системный эксперимент и не уже выполненный тест. `spec-engineer` может подготовить независимый контракт; отсутствие этого evidence не блокирует уже выполненную разработку `core-types` и `state`.

Mobile adapter остаётся `draft`: его реализация, сборка и device evidence не входят в текущий handoff. При отдельном решении о мобильной поставке требуются contract tests общего API, реальная native-сборка SQLite/vec и проверки foreground/background/force-quit на устройствах.

Интеграция начинается рано: (1) boot/DB/один tick с реальными owner stores, (2) CLI → local cognition → разрешённое действие → episode → recall после restart, (3) непрерывные автономные тики с PSM/memetics/narrative/homeostasis, (4) проверенное обучение/skill либо model change и rollback. Промежуточный scaffold или цикл с заглушкой модели остаётся substrate, даже если остальные проверки зелёные.

Две независимые реализации одного модуля используют одинаковые public fixtures. В проверке совместимой замены root передаёт новую реализацию через прежний порт; доменный код потребителей не меняется. Для смены хранилища отдельно проверяются новые storage adapters владельцев и миграция данных (§2.4). Внутри одного integration PR версии contract и всех затронутых consumers должны быть согласованы; «потом сведём несовместимые интерфейсы» не является параллельной разработкой.

## 9. Ограниченные эксперименты и открытые вопросы

Эксперименты здесь — переданные обязательства, **не выполненные измерения**. Их результаты возвращаются `architecture-engineer`; до этого условные решения не становятся accepted performance claims.

| ID | Неизвестное, владелец решения | Ограниченная проверка и условие закрытия |
| --- | --- | --- |
| E1 | Целевое железо, baseline model/server, profile — оператор предоставляет CPU/RAM/VRAM; исполнитель `node-engineer` совместно с владельцем `model-organs` | Один локальный кандидат, offline structured generation по настоящему context/schema, отмена/timeout/invalid output, cold/warm resource и latency measurements, применение известных skills. Зафиксировать версии/профиль; отсутствие cloud calls и сохранение baseline quality обязательно. Без допустимого профиля local-life приёмка заблокирована |
| E2 | Ресурсные бюджеты, tick cadence, active meme/context limits и mode thresholds — `architecture-engineer` по evidence E1 и эксплуатационным ограничениям оператора | Серия bounded autonomous/operator/conflict/consolidation тиков: очереди не теряются, background jobs соблюдают окна, нет oscillation/starvation, локальная жизнь оставляет ресурс для действия. После измерения зафиксировать параметры и допустимые границы, не произвольные SLA |
| E3 | Подтверждение transaction/queue/recovery протокола — исполнитель `node-engineer`, возврат архитектору | Реальные SQLite state/queue, два запуска одного агента, kill в трёх commit windows, недоступность storage и in-flight effect; R4: restart worker/runtime/хоста, rollback и оба окна outbox, потеря/повтор job/result и приём receipt. Ни второго инстанса агента, ни слепого повтора эффекта или тихой потери intent; неоднозначные исходы видны. Неуспех блокирует admission реальных действий |

Точная quality suite для новой модели/навыка принадлежит соответствующей спецификации и обязана использовать случаи, не участвовавшие в формировании кандидата. Выбор чисел и конкретной модели не перекладывается молча на разработчика другого пакета.

## 10. Приёмочные сценарии и evidence

| ID | Дано / Когда / Тогда | Граница проверки |
| --- | --- | --- |
| M1 | Дано модуль и только contracts соседей; когда он реализуется/проверяется отдельно и затем заменяет другую совместимую реализацию; тогда проходят его проверки и consumer contracts, private код соседей не меняется | Package/contract tests, dependency/exports check, импорт общих contracts без Node/native adapters; затем реальная сборка root |
| M2 | Дано ModelPort с объявленными capabilities и общим бюджетом; когда потребитель вызывает разрешённую операцию, передаёт неверный тип или запрашивает неподдерживаемую; тогда валидный результат связан с requestId и версией органа, невалидный вызов не доходит до provider, ответ другого вида отклоняется, суммарный бюджет соблюдается | Контрактные fixtures включённых операций и отрицательных исходов; при подключении второго семейства — разные формы результата без приведения к тексту. Интеграция с реальным provider отдельно для каждой включённой capability; принятое владельцем изменение после commit/reload сохраняет provenance и не получает дополнительных полномочий |
| L1 | Дано локальная cell без internet/CLI input; когда проходят последовательные тики; тогда агент использует локальный орган, собственные цели/состояние, выбирает допустимое действие/бездействие и сохраняет связанную историю | Реальные model service + SQLite state/queue; episode readback после restart |
| L2 | Дано обычный стимул и operator message; когда собирается следующий допустимый контекст; тогда содержание operator message включено приоритетно, но ответ/отсрочка/иная реакция выбирается общим циклом | CLI request → validated inbox → actual model request → decision → episode. Один Receipt тест не закрывает |
| L3 | Дано отключённый CLI; когда агент выбирает инициативное сообщение; тогда outbox хранит его, reconnect возвращает actionId/message, ack означает доставку клиенту, не прочтение | Реальные Unix sockets, durable outbox, crash между выводом и ack |
| C1 | Дано одинаковый стимул и контролируемое изменение релевантного опыта/PSM/memetic context; когда выполняется reasoning; тогда изменяются измеримые attention/choice outcomes, effect обусловлен входом | Детерминированный contract test плюс заранее определённая comparative suite с реальной локальной моделью; один diagnostic log недостаточен |
| C2 | Дано гипотеза, повторения и производные одного источника; когда она активируется/объединяется; тогда activation может вырасти, confirmation не растёт без новых оснований; provenance и dormant/return сохраняются | Memetics/world/narrative contract и DB readback |
| C3 | Дано прошлые убеждения и новый опыт; когда агент пересматривает цели/ценности; тогда agentId, прошлый опыт и ограничения сохранены; narrative различает fact/interpretation/direction | Self/narrative integration и multi-tick local scenario |
| R1 | Дано активный агент; когда стартует дубль, runtime отказывает второму инстансу. При потере доступа к storage новый dispatch запрещён; replacement ждёт остановки старого runtime, in-flight effect отражён как evidence/unknown | E3; реальные процессы, DB и effect boundary; механизм единственности уточняется при разработке runtime |
| R2 | Дано crash до decision commit, после него или после effect до receipt; когда runtime восстанавливается; тогда нет частичного PSM commit, вымышленного успеха или слепого повтора, известные решения не генерируются заново | E3; persisted state, adapter receipt и повторное чтение episodes/actions |
| R3 | Дано stable body и более новая биография; когда body/organ откатывается; тогда совместимое состояние читается, история изменения/отказа сохранена, внешний мир не объявляется отменённым | Manifest/schema compatibility, real restart; backup restore проверяется отдельно с явными evidence limits |
| R4 | Дано подтверждённая job и, для связанных с состоянием jobs, durable intent; когда падают worker/runtime/host, прерывается окно обработки или процесс между commit/enqueue/receipt; тогда принятые задания восстанавливаются, rollback не публикуется, failed/cancelled видны, повтор не создаёт второго принятого результата и не возобновляет unknown action | Реальные SQLite-файлы и desktop queue adapter; оба окна outbox, неоднозначный enqueue, утраченная queue record/result, повтор после очистки job, бюджет попыток, отмена/stale input/attempt, прерванное окно и атомарный приём receipt. Без сохранённых исправных файлов — отдельный disaster recovery, не успешный restart |
| D1 | Дано опыт и кандидат навыка/органа; когда он оценивается на новых случаях и проходит governor/approval; тогда active binding/ledger меняются согласованно, качество и перенос навыков проверены; неудача сохраняет/возвращает старую версию | Real evaluation, повторное применение навыка, continuity/rollback readback |
| S1 | Дано текст, model output или job result с командой обойти правила; когда он обрабатывается; тогда нет дополнительного права, прямого tool call, записи PSM из worker или обращения к запрещённому файлу/сети | Реальные процессные mounts/UID/network policy, symlink escape и secret-redaction проверки |
| S2 | Дано старый/потреблённый grant либо refs другой версии/evaluation; когда кандидат повторно просит apply, меняет payload при том же requestId или два действия конкурируют за grant; тогда admission отклонён, новый binding/effect не возникает; failed admission persistence также не разрешает dispatch | Grant/action/binding transaction, canonical evidence readback и negative integration cases; historical replay только возвращает статус |
| S3 | Дано одна доверенная привязка оператора; когда другой OS principal посылает запрос или входной текст требует считать автора оператором; тогда запрос управления отклоняется, текст не меняет привязку/приоритет. Конфигурация с несколькими операторами блокирует boot; новые каналы при последующем подключении не создают второго оператора | Constitution/perception contracts и реальные socket peer credentials; повторное чтение сохраняет единственную привязку. Для будущего канала — отдельная интеграционная проверка identity mapping до его допуска |
| H1 | Дано длительный конфликт/доминирование и превышение ресурсов; когда работает homeostasis/scheduler; тогда проверяются основания и альтернативы, соблюдаются dwell/cooldown/windows, freeze блокирует promotion, полезный устойчивый интерес не подавляется автоматически | Контрактные временные сценарии; E2 на реальном профиле |

PR gate: применимые format/lint/typecheck/build, проверки изменённых пакетов и зависимых consumers, соответствующие contracts. Merge gate: полный набор плюс применимые SQLite/queue/model/CLI integration и небольшой набор сквозных L/R/D/S. Модельные quality checks оценивают заранее заданное наблюдаемое поведение, не точное совпадение свободного текста. Flaky/retry не заменяет evidence. [Политика качества](development-methodology/quality.md).

## 11. Решения и аудит

- [ADR-001: модульность и владение контрактами](adr/ADR-001-module-boundaries.md).
- [ADR-002: единая история, commit points и recovery](adr/ADR-002-state-and-recovery.md).
- [ADR-003: границы действия, моделей и развития](adr/ADR-003-action-and-development-boundaries.md).

Архитектура и ADR-001–003 приняты оператором 2026-09-24. Решение 2026-09-28 о SQLite, переносимом `queue` и отсутствии Docker заменяет серверный вариант 2026-09-25. Уточнение оператора 2026-09-29 отменяет запрет `queue → state`: очередь использует готовый `StoragePort`, а библиотека подключается её сменным адаптером. Пригодность Liteque и выбор библиотеки открыты до проверки этой интеграции и queue-гарантий (§8). Принятие фиксирует проектные решения и разрешает переход к спецификациям и реализации; оно не закрывает эксперименты E1–E3 и не подтверждает работоспособность организма. Пересмотр требуется при смене topology, data ownership, action set/trust boundary, профиля сохранности, провале E1–E3 или изменении концепции.

Документационный self-check, `concept-conformance-reviewer` и `security-reviewer` выполняются в пределах проектирования; независимый внешний аудит не заявляется. [Issue #16](https://github.com/kostysh/yaagi/issues/16) содержит историческую навигацию архитектурного комплекта; прежние результаты не доказывают проверку уточнённой границы `queue → state`. Снимок, покрытие и результат её отдельной проверки фиксируются согласно [правилам аудитов](development-methodology/audits.md). Реальные model/CLI/SQLite/queue проверки относятся к реализации.
