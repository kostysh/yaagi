# Спецификация модуля: `state`, первый инкремент

- Document ID: `state.spec`
- Module ID: `state`
- Статус: draft; спайки и реализация остановлены оператором; production coding blocked до CP1.
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

Exports: side-effect-free `./contracts`; отдельный технический `./sqlite` с нормализованными SQL/BLOB операциями для owners; отдельный Node entrypoint для `better-sqlite3` и локальных файлов БД. Точные signatures, error shape и migration unit намеренно draft до CP1. Ни один исполнитель production-кода не выбирает их самостоятельно.

Drizzle принят оператором независимо от vector probe. Исследуется локальный `drizzle-orm/sqlite-proxy` callback без HTTP. Векторный raw SQL обходит только ORM, а не scope/connection/transaction. В `state` Zod 4 проверяет реально необходимые config/technical metadata; DTO и их Zod-валидация принадлежат владельцу, а не универсальному валидатору `state`. Таблица не является автоматически доменным DTO. Нужные общие примитивы добавляются в `core-types` только после согласования реального потребителя; сейчас используется существующий `Result`.

Первая платформа — Linux x64, Node 24.21.0, pnpm 10.34.5; CI Ubuntu 24.04. Точные зависимости/SQLite ABI закрепляются по S1/S2. Производные ошибки драйвера не выдаются в общем контракте; секреты, SQL payload и локальные данные не попадают в публичную диагностику.

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

Отмена синхронного SQL не доказывается `Promise.race`. S2 измеряет проверяемую cooperative семантику; недостижимое требование возвращается на CP1, не превращается в скрытый worker/scheduler. Успех транзакции имеет одну точку commit; поздняя отмена не должна выдумывать rollback уже подтверждённого commit. Точный порядок и классификация ошибок фиксируются после evidence.

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

Сейчас выполняется только исправление документов: спайки и реализация остановлены оператором. Возобновление S1/S2 требует явной команды продолжить и применимых Concept/Spec/Security аудитов исправленного снимка. Факты спайков возвращаются в архитектуру и эту спецификацию. Открыты: точные signatures, migration unit/history verification, cancel/error semantics и ограниченный M1 contour. CP1 сохраняется: evidence, auditable proposal и явное approval оператора; production-код не начинается до этого.

Аудит: Concept Conformance для spec; Security для trust/data boundaries. Снимки и результаты фиксируются в плане/CP1 evidence; наличие этого документа не означает прохождения аудита или спайков.
