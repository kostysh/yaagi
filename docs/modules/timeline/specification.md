# Спецификация модуля: `timeline`

- Document ID: `timeline.spec`
- Module ID: `timeline`
- Статус: T1 accepted в CP1 на `acef6a2b89dcefe5bc534537785422479f8d8393` решением оператора 2026-10-16; код ещё не реализован.
- Передача: start реализации заблокирован принятием и доступностью нужного поднабора #45; текущая синхронизация не объявляет его готовым.
- Потребитель: доверенный composition root; сначала технический consumer T1, затем реальные участники I1.
- Концепция: [§4.1](../../polyphony_concept.md#41-время--не-параметр-а-среда-существования), [§11](../../polyphony_concept.md#11-темпоральность-физиология-и-режимы-работы), §§12/14.
- Архитектура: [§§3–4](../../architecture.md#3-модули-состояние-и-публичные-операции), [§5](../../architecture.md#5-единство-состояния-и-полный-тик), [M1](../../architecture.md#10-приёмочные-сценарии-и-evidence); [ADR-001](../../adr/ADR-001-module-boundaries.md), [ADR-002](../../adr/ADR-002-state-and-recovery.md), [ADR-003](../../adr/ADR-003-action-and-development-boundaries.md).
- Системный дизайн: [карта модулей](../../system-design.md#карта-всех-модулей), F1/F3/F4/F8, [I1–I3](../../system-design.md#5-поэтапная-сборка).
- Рамочная Issue: [#47](https://github.com/kostysh/yaagi/issues/47); порядок исполнения — [timeline.plan](implementation-plan.md).

## Назначение и границы

При исправном подготовленном `state` доверенный root через публичный порт резервирует один тик агента, сохраняет допустимые переходы и после повторного открытия той же БД читает прежнюю последовательность. Незавершённая reservation сохраняется как техническая interrupted attempt, без выдуманного решения или эпизода. Это вклад в непрерывность одной истории, а не самостоятельный субъективный цикл.

**Capability T1:** reserve/decide/settle, recovery-проекция и монотонный sequence на реальном хранении. **Substrate:** пакет, переносимые contracts, owner schema/migrations, consumer tests и guide. **Anti-claims:** T1 не доказывает работу runtime, совместную атомарность I1, существование чужих action/outcome records или recovery E3.

Полный scope #47 остаётся в этой спецификации: последовательность, фазы, elapsed time, режим, связи с решением, восстановление. T1 реализует собственную границу; реальный общий commit/reconcile уточняется с #49/#50, согласованная Regulation — при подключении homeostasis в I3. Будущая интеграция может потребовать версионированного изменения тех же spec/plan, а не разрешающей заглушки.

В T1 нет часов, таймеров, scheduler, OS lock, модели, исполнения действий или отдельной БД. Root владеет exclusivity, epoch, triggers, измерением времени, policy/snapshot projections и lifecycle `state`. Timeline хранит свой режим; его выбор и ограничения действий принадлежат root/homeostasis/executive. Риск высокий: неправильный переход или миграция может исказить историю; поэтому нужны реальные rollback/reopen и отрицательные сценарии.

## Публичный контракт T1

### Общие примитивы и владельцы

`Result` уже доступен из `core-types`. Следующий набор является **запросом потребителя в [#45](https://github.com/kostysh/yaagi/issues/45), а не объявлением существующих exports**: `AgentId`, `TickId`, `ActionId`, opaque `Revision`, `EvidenceRef`, различимые wall time и elapsed duration в миллисекундах. Канонические declarations/validators принимает владелец `core-types`; timeline не создаёт их локальные копии. Зависимый код не начинается до принятия и доступности этого поднабора. Закрытие всей #45 не требуется.

- IDs различимы и непрозрачны; один `TickId` принадлежит одному `AgentId`.
- `Revision` для policy/snapshot сохраняет точный строковый token без численного порядка, coercion или нормализации. Это совместимо с `BootAdmission.policyRevision` C1: root валидирует свою проекцию, не меняя контракт constitution.
- Wall time — целые UTC milliseconds в safe integer range; движение wall clock назад допустимо. Elapsed — отдельно измеренная неотрицательная safe integer duration. Timeline не вычисляет её вычитанием wall times.
- `EvidenceRef` сохраняет вид источника, stable id и revision/hash по архитектуре §4.1. `outcomeRef` использует эту форму; ссылка не доказывает истинность или существование исхода.

В проекте [контракта #45](../core-types/specification.md#общие-значения-поднабора-t1) для двух time exports выбраны `WallTimeMs`/`ElapsedMs`; это те же symbols владельца, а не локальные aliases timeline. Контракт #45 пока к принятию CP1 и не реализован. Он сохраняет принятые здесь смысл и диапазоны; несовместимое изменение возвращается на согласование до кода. Новый `EpochService`, `SequenceId`, `OutcomeId` или общий `AgentState` не требуется.

### DTO владельца

Все поля readonly. `TickFrame` содержит весь обязательный состав архитектуры §4.2:

| Поле | Тип / смысл |
| --- | --- |
| `agentId`, `tickId` | Общие `AgentId` / `TickId` |
| `sequence` | Положительный safe integer; вычисляется timeline из сохранённой истории |
| `previousCompleteTick` | `TickId` последнего `settled` тика того же агента либо `null` |
| `epoch` | Непустой точный строковый token запуска, заданный root; не lease или право исполнения |
| `wallTime`, `elapsed` | Общие wall time / elapsed duration; сохраняются раздельно |
| `mode` | `REACTIVE`, `DELIBERATIVE`, `CONTEMPLATIVE`, `CONSOLIDATION`, `DEVELOPMENTAL` или `DORMANT` |
| `policyRevision`, `snapshotRevision` | Общие opaque `Revision`, поступившие от root |

T1 не утверждает, что root projection `snapshotRevision` уже соответствует реальному consistent snapshot. Его mapping, проверка authority и существования foreign refs в общем commit — контракт #49 и приёмка #50, а не проверка произвольных таблиц из timeline.

`ReserveTickInput` — узкая проекция trigger: `tickId`, `epoch`, `wallTime`, `elapsed`, `mode`, `policyRevision`, `snapshotRevision`. `agentId` задан при binding порта; sequence/previousCompleteTick не принимаются от caller. Отдельный trigger journal или новая таксономия stimulus не вводятся.

`TickRecord` содержит `schemaVersion: 1`, `frame: TickFrame` и один вариант:

| `phase` | Локальный `revision` | Дополнительные поля |
| --- | --- | --- |
| `reserved` | `0` | — |
| `decided` | `1` | `actionRef: ActionId` |
| `settled` | `2` | тот же `actionRef`, `outcomeRef: EvidenceRef` |
| `interrupted` | `1` | — |

`TickRevision = 0 | 1 | 2` — локальная версия перехода, а не общий opaque `Revision`. Optional action/outcome поля вне своего варианта запрещены. Frame после reserve не переписывается. `settled` означает завершение технического перехода, включая ссылку на явно unknown outcome; это не заявление об успешном внешнем эффекте.

`TimelineHead` содержит `lastSequence` (изначально `0`), `previousCompleteTick` (`null` в пустой истории) и `lastTick` (последний `TickRecord` либо `null`). Активность определяется фазой последнего тика; после resume видна и interrupted attempt. Это detached readback, не новый mutable service.

### Порт и storage scope

`TimelinePort` привязан к одному агенту и одному callback scope. Все операции асинхронны и возвращают существующий `Result<T, TimelineFailure>`:

| Операция | Вход | Результат |
| --- | --- | --- |
| `reserveTick` | `ReserveTickInput` | Новый `TickRecord` в `reserved` |
| `decide` | `{ tickId, expectedRevision: 0, actionRef }` | Тот же тик в `decided` |
| `settle` | `{ tickId, expectedRevision: 1, actionRef, outcomeRef }` | Тот же тик в `settled`; actionRef обязан совпадать с решением |
| `resume` | Без аргументов; root уже обеспечил отсутствие прежнего исполнителя/незавершённой работы | `TimelineHead` после recovery-перехода |
| `readTick` | Ровно один ключ: `{ tickId: TickId }` либо `{ sequence: number }` | `TickRecord` либо `null`, если тика этого агента нет; sequence — положительный safe integer |
| `readHead` | Без аргументов | `TimelineHead` |

`TimelineFailure` — только `{ code: 'invalid_input' | 'conflict' | 'incompatible' }`. Невалидный вход даёт `invalid_input`; отсутствующая/неподходящая запись при write, повтор, stale revision или несовпадение actionRef — `conflict`; невалидные persisted данные/версия — `incompatible`. Чтение отсутствующей записи возвращает `ok(null)`. Чтение по sequence позволяет восстановить всю техническую историю до `lastSequence`, включая interrupted attempts и допустимые пропуски, без сохранённого в RAM списка IDs. Ошибки не содержат вход, SQL, path, stack или чужие данные.

Production SQLite entrypoint `@polyphony/timeline/sqlite` предоставляет `bindTimeline(scope, agentId): TimelinePort`, где `scope` — публичный `SqlScope` из `state/adapters/sqlite`. Это технический owner binding по архитектуре §3.1; SQL/Drizzle и row mapping остаются там. `./contracts` содержит DTO/validators без SQL/Node/native/I/O и импортов доменных соседей. Внутренняя структура функций/классов не специфицируется.

Root собирает bindings через `createState(adapter, bindOwners)`. Read-операции вызываются в `readSnapshot`, изменяющие — в `transact`; вложенных транзакций нет. Результат owner-метода внутри callback предварительный: сохранность подтверждается только успешным **внешним** Result `state.transact`. Root возвращает owner failure из callback, чтобы весь набор записей откатился. SQL failure не маскируется доменной ошибкой: он выходит к `state`, отравляет scope и вызывает rollback. StorageFailure, cancellation и budget принадлежат внешнему `state`; timeline не создаёт второй budget или retry loop. Порты/handles не выходят за callback, наружу возвращаются только detached DTO.

## Требования и инварианты T1

Все требования новые. MUST/MUST NOT обозначают обязательность. В таблице указаны принятое основание, применимая граница и опровергающий исход; derived уточнения нужны для сохранения принятого инварианта, а не для расширения системы.

| ID | Нормативное поведение и основание | Опровергающая проверка |
| --- | --- | --- |
| T1-R1 | На входной/persisted границе timeline MUST проверить объявленную форму и диапазоны. Explicit: архитектура §4.1; discriminated DTO — derived из различимых фаз §5.2 | Missing/null/лишние поля, NaN/дробь/unsafe integer, неверный mode/ref или повреждённый record не проходят |
| T1-R2 | Успешный reserve MUST создать следующий sequence больше любого сохранённого sequence этого агента. Explicit: архитектура §4.1; derived: первая запись `1`, далее `lastSequence + 1` | После settled/interrupted/reopen sequence повторяется или уменьшается; при переполнении возвращается `conflict` без записи |
| T1-R3 | Timeline MUST допускать не более одного активного `reserved`/`decided` тика агента. Derived из одной последовательности и отказа второй reservation (§3.2, F3) | Два concurrent reserve оба подтверждены внешним commit как активные |
| T1-R4 | Повтор уже сохранённого `tickId` MUST дать `conflict` без замены прошлого. Derived из принадлежности TickId и запрета повторного sequence/перехода (§§3.2/4.1) | Тот же ID в том же или другом agent binding создаёт новое прошлое либо меняет frame |
| T1-R5 | Decide MUST примениться только к `reserved` с ожидаемой revision и сохранить один actionRef. Explicit: §5.2 decision commit; CAS — §4.1 | Decide повторно/после interrupted/с чужим tickId или stale revision меняет историю |
| T1-R6 | Settle MUST примениться только к `decided` с ожидаемой revision и тем же actionRef. Explicit: §5.2 outcome commit; derived: проверка связи с прежним решением | Settle до decide, с другим actionRef или повторный settle создаёт/подменяет outcome |
| T1-R7 | `previousCompleteTick` MUST ссылаться на последний `settled` тик этого агента, включая settled с unknown outcome. Derived из §4.2 и раздельности факта/успеха F4/F8 | Interrupted становится complete, unknown стирается либо ссылка указывает на другого агента |
| T1-R8 | Resume MUST перевести только сохранённый `reserved` в `interrupted` с revision `1`. Explicit: §5.2/F8; отсутствие решения сохраняется | Recovery создаёт action/outcome/episode или теряет interrupted attempt |
| T1-R9 | Resume MUST сохранить `decided`, `settled` и `interrupted` без нового перехода. Derived из запрета model replay и неизменности фактов (§5.2/F8) | Повтор resume меняет terminal record, sequence или выдаёт незавершённый decided за settled |
| T1-R10 | Все изменения timeline MUST участвовать в одном переданном scope `state`. Explicit: §5.1/ADR-002 | Owner открывает свой commit либо rollback внешней транзакции оставляет часть timeline writes |
| T1-R11 | После успешного внешнего commit чтение/reopen MUST вернуть сохранённые frame, phase, revision и refs. Explicit: roadmap шаг 5, F1/F8/I1; claim здесь ограничен T1 | Только in-memory consumer видит успех; реальный файл после reopen не содержит тот же record |
| T1-R12 | Timeline MUST сохранять раздельно переданные root wall time, elapsed, epoch, mode и policy/snapshot tokens. Explicit: §4.2; сохранение exact значений — derived из provenance | Clock rollback меняет sequence/elapsed, token нормализуется или смена mode/epoch стирает историю |
| T1-R13 | Входы и результаты MUST NOT позволять изменить сохранённое состояние или ранее выданный DTO. Explicit: immutable DTO §4.1 | Мутация входа/результата после вызова меняет readback либо ранее прочитанный frame после decide |
| T1-R14 | Невалидное persisted состояние MUST давать `incompatible` с сохранением данных. Explicit: §4.1/§5.3 | Повреждение, неподдерживаемый schemaVersion, несогласованная фаза/head или orphan собственных timeline refs принимаются либо сбрасывают историю; существование foreign refs здесь не проверяется |

Переходы: `reserved → decided → settled` либо `reserved → interrupted`. `settled`/`interrupted` терминальны. Guard, запись и обновление head выполняются в одной write-транзакции; конкуренцию разрешает SQLite через `state`, без owner lock/queue. Откат не расходует durable sequence. Пропуски допустимы архитектурой, но T1 не создаёт фиктивные тики, чтобы их заполнить.

Если root потерял ответ commit, он сначала делает authoritative `readTick`/`readHead` через исправный заново открытый state. Сохранённая фаза определяет дальнейшее действие; отсутствие записи устанавливается чтением, а не предположением из ошибки. Timeline не повторяет callback, reasoning или dispatch. До разрешения неоднозначности root блокирует зависимую работу. Decided требует согласованного reconcile владельцев #49; timeline самостоятельно не сочиняет исход.

## Сценарии, проверки и evidence

- **Основной путь:** root задаёт технические входы, резервирует тик, коммитит decide и settle, закрывает state и открывает тот же реальный файл. Consumer читает точные record/refs; следующий тик получает следующий sequence и previousCompleteTick.
- **Конфликт:** две независимые транзакции резервируют тик одного агента. Только одна создаёт активный тик; другая получает conflict. Тот же набор проверяет stale revision, повтор/неверный порядок и чужой actionRef.
- **Откат:** callback меняет timeline, затем возвращает owner failure; все изменения отсутствуют при публичном readback/reopen. Отдельно проверяется SQL failure/отмена внешнего state без частичного commit.
- **Восстановление:** после сохранённого reserve root прекращает прежнюю работу, reopen/resume сохраняет interrupted, не создавая решение. Для decided resume возвращает тот же actionRef и незавершённую фазу; последующее settle выполняет явный root. Повторный resume не меняет terminal records.

Обязательный путь evidence: `root input → общая/domain validation → owner mapping → реальная canonical SQLite через state → публичный readback → detached DTO consumer → reopen`. Изменяемые измерения: agent/tick/action/ref, phase/revision, wall clock/elapsed/epoch/mode, commit/rollback/recovery. Отдельные schema/mapper tests и double не закрывают эту цепочку. В T1 refs являются явно заданными техническими fixtures; настоящие memory/action/snapshot/authority mappings и общий commit нескольких реальных owners проверяет #50.

M1: один неизменный consumer и одни contract scenarios с production TimelinePort и совместимым test-only double; private код соседей не меняется. Double не доказывает durability. Проверяются production exports, declaration/type fixtures, все поля TickFrame и варианты TickRecord, dependency graph и отсутствие Node/native/I/O в contracts. Guide даёт выполняемые main/error/recovery примеры; нового runner/harness нет.

## Хранение, совместимость и критические границы

Таблицы имеют owner-prefix `timeline`; схемы, Drizzle mapping и reviewed SQL принадлежат timeline, физическая БД общая каноническая. Root собирает release migration chain, `state` проверяет/применяет её до нагрузки. Нет чтения/записи таблиц соседей и собственной connection. Проверки используют временный реальный файл, production SQL artifacts из собранного entrypoint независимо от cwd, fresh/repeat/failure и upgrade при реальном schema delta; close завершается до cleanup. Применённые SQL не редактируются. Body rollback не стирает новую историю и допустим только при совместимой схеме; иначе boot отклоняется, данные сохраняются для разрешённого восстановления.

| Граница | Применимость, владелец и минимальная проверка |
| --- | --- |
| HRB-01/02 | Timeline владеет tick uniqueness/CAS, SQLite разрешает writers; R2–R6/R10: один победитель и rollback. Action idempotency/OS exclusivity принадлежат executive/root, не timeline |
| HRB-03/04 | Root/исполняемый adapter доверены; timeline связывает agentId и не выдаёт права исполнения. Чужой binding/tick не меняет запись (R4–R6). Нет нового ACL/RLS/transport; реальные проверки authority — #49/I2/E3 |
| HRB-05/06 | Invalid input/conflict/incompatible различимы; `null` означает только отсутствие readTick. SQL/storage failures остаются у state. R1/R8–R11/R14 и readback отличают interrupted/decided/settled и неоднозначный commit |
| HRB-07 | Sequence, локальная revision и time ranges проверяются на DB/domain boundary; safe integer, без money или неявного bigint/string coercion. R1/R2/R12 проверяют границы и clock rollback |
| HRB-08 | Не применима к T1: нет HTTP/подписанных запросов/credential transport. Input root — локальная проекция по §3.1, не новый публичный endpoint |
| HRB-09/10 | Persisted record хранит только frame, phase, revision и точные refs. Нет raw thought, model output, secret/config values, stack или SQL в DTO/error. Потребитель — root recovery/context. R8–R14 и canary fixtures проверяют lifecycle и bounded errors; отдельного audit-журнала/cleanup истории нет |
| HRB-11/12 | Единственный owner DTO — timeline/contracts; общие primitives — #45. R1–R14, type fixtures и M1 проверяют state/ref invariants; readback чужой записи не заменяет принятый owner contract |

Точный schemaVersion/expectedRevision и весь TickFrame проверяются на production round trip. Root хранит только проверенные узкие projections; пакетная граница доверенного кода не является sandbox. Performance SLA, архивирование и production backup policy этим инкрементом не вводятся.

## Приёмка и остающиеся зависимости

- До CP1: self-check, проверка ссылок/языка/синхронизации, `git diff --check`, local audit commit; Concept для spec и затронутых design/AGENTS, Spec для plan/roadmap/status docs, Security для trust/persisted границ. Точные SHA/verdict фиксируются в checkpoint report.
- До принятия T1: R1–R14 через production порт и реальный state, M1, schema/recovery/immutability, package и consumer checks; `format:check`, `lint`, `typecheck`, `build`, `test`, `test:integration`, `git diff --check`; Spec/Security на стабильном итоговом commit. Evidence — `docs/validation/timeline/`.
- Общая атомарность реальных timeline/memory/root и consistent context не доказаны этими документами или T1: это #49/#50. Реальные действия требуют E3 соответствующего состава.
- CP1 этих документов принят на `acef6a2`; блокер старта кода — принятие и доступность минимальных общих primitives #45. #49 блокирует только зависимый совместный mapping; его отсутствие не выдаётся за готовую интеграцию и не требует реализации runtime внутри #47.

Принятие CP1 не является принятием кода, публикации или всей #47. По мере готовности следующих потребителей уточняются те же spec/plan; рамочная Issue остаётся открытой до принятия всего её scope.
