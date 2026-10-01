# Отрицательный аудит исходной реализации `queue`

## Паспорт

- Дата: 2026-10-01
- Document ID: `queue.validation.local-queue-hardening.code-spec.1`
- Module ID: `queue`
- Task ID: `local-queue-hardening`
- Scope ID: `code-spec`
- Объект: `packages/queue/src`, тесты, package exports и документы подключения; связанные public contracts `state` и установленная Agenda 6.2.6
- Audit commit: `0a47c5fbdbcd62473bab8c0acddf2fbe1efa4a72`
- Вид аудита / skill: `spec-conformance-reviewer`
- Аудитор: `/root/queue_hardening_spec`, GPT-6 Astra / `xhigh`, независимый read-only запуск без истории координатора
- Номер попытки: 1
- Нормализованный статус: **FAIL**
- Исходный verdict: **non-compliant**
- PR / Issue: локальное исправление блокера без новой Issue; ссылка на PR добавляется после публикации
- Предыдущий отчёт: нет для этой задачи; исторические аудиты `local-queue-agenda` сохраняются отдельно

## Контекст и итог

Источники: поручение оператора проверить и исправить весь модуль → архитектура, системный дизайн и ADR-002 → accepted [queue.spec](../../modules/queue/specification.md), R1–17/AC1–9 → план. Проверяется локальный сквозной путь consumer → production core → Agenda → public state → SQLite → handler → durable outcome/reopen. Runtime/physiology, E3, exactly-once, multi-host и аппаратный power-loss не входят.

Исходный package suite прошёл **41/41**, однако дополнительные реальные сценарии установили два нарушения production-поведения и неверный oracle регрессии deadline. Зелёный исходный suite не закрывает findings.

## Findings

| ID | Приоритет | Место исходного snapshot | Недостаток / нарушенный критерий | Требуемое исправление |
| --- | --- | --- | --- | --- |
| SPEC-H1 | major | `src/adapters/agenda.ts:170–194`, `src/internal/store.ts:269` | Finish commit снимает lease, но acknowledgement ещё ожидается; heartbeat получает conflict и глобально останавливает очередь. Требуемый retry не продолжается без explicit restart. R9/R12, AC4–6 | Различать подтверждённое завершение своей попытки и потерю lease по durable состоянию, сохранив fail-closed при cancellation, replacement и настоящем storage failure |
| SPEC-H2 | major | `src/index.ts:60`, `src/index.ts:178–187` | Payload codec исполняется после вычисления Context; handler может войти после deadline с `aborted=false` и устаревшим timeout. R11/AC5 | После decode проверять signal и фактический остаток; при expiry не вызывать handler, сохранять timeout; сохранять transform/validation semantics codec |
| SPEC-H3 | major | `test/adapter-regression.test.ts:116` | Тест требует входа handler внутри 200 ms от durable begin. Медленный ACK/readback корректно исчерпывает срок до handler, но oracle падает на undefined signal. AC5 и запрет flaky quality gate | Раздельно доказать expiry до handler и expiry после фактического входа; не ослаблять assertion и не маскировать retry CI |

## Независимые доказательства

- SPEC-H1: реальные Agenda/state/SQLite; `maxAttempts=2`, первая попытка бросает, afterCommit удерживает acknowledgement её failed→pending outcome. Настоящий heartbeat даёт conflict. До release: `calls=1`, `status=pending`, `attemptsUsed=1`, `lifecycle=stopping/error=conflict`. После release и stop второй вызов отсутствует; только explicit restart заканчивает job второй попыткой.
- SPEC-H2: policy timeout 1000 ms, lease 5000 ms; только второй payload decode внутри production execute (typed bridge после Store.read/validate) делает 1500 ms конечной CPU-работы. Handler вошёл на 565 ms позже deadline, с `aborted=false`, `timeoutMs=935`. Поздний durable result был отклонён правильно; контекст входа уже неверен.
- SPEC-H3: acknowledgement running commit задержан на 350 ms при policy timeout 200 ms. Получено `failed/timeout/no result`, handler calls 0. Это соответствует [post-merge CI 36866452116](https://github.com/kostysh/yaagi/actions/runs/36866452116): terminal assertions проходят, assertion signal падает.
- Проверка pending reservation при stop: первоначальный `stop_incomplete`, после release — idle, pending, attempts 0, calls 0.
- Положительная проверка heartbeat: два настоящих consumers, lease 1000 ms, 6 продлений, последнее через 2316 ms от начала, один handler, без lifecycle error. Существующий тест останавливает handler после первого heartbeat и не доказывает работу после исходного lease expiry.

Временные TypeScript witnesses прошли `tsc --noEmit`. DB/процессы аудитора закрыты и удалены. Локаторы исходных журналов: `/tmp/yaagi-queue-hardening-spec-suite/result.log`, `/tmp/yaagi-queue-hardening-spec-witness/{witness.ts,result.log,finish-ack.log,heartbeat.log}`. Для воспроизводимости исправленные сценарии входят в постоянные package tests; эти временные файлы не являются требуемым артефактом потребителя.

R1–8, R10 и R13–17 выполнены в проверенном локальном контуре; R9/R12 частично выполнены из-за SPEC-H1; R11 нарушен SPEC-H2. Потеря durable result, превышение callback concurrency и storage I/O после успешного stop не установлены. Полные root/state gates и remote CI этим исходным аудитом не повторялись.

## Remediation и повторный аудит

Исходные findings выше неизменны. Исправление, новый commit, проверки и результат delta audit будут добавлены после выполнения Q5; до этого **PASS не заявляется**.

Первый remediation snapshot `553bf1e6aa4761a58b6028b198fec05c27fcd217`: H2/H3 закрыты, H1 остаётся при обратном порядке ACK. Code delta **non-compliant / FAIL**, Q5 plan **compliant / PASS**, независимый Security **PASS (scoped) / PASS**. [Отдельный отрицательный результат №2](local-queue-hardening.code-spec.2.md) сохраняет новый witness и уточнение причины; это не окончательная приёмка.

Финальный remediation snapshot `42fbc0643abc721ee4a0e1b38c6c60428e49ce04`: тот же Spec-аудитор — **compliant / PASS**, SPEC-H1–H3 CLOSED; Q5 отдельно **compliant / PASS**. Независимый Security delta — **PASS (scoped) / PASS**. Покрытие, дополнительные negative witnesses и границы результата — в [evidence](local-queue-hardening.implementation.md). Исходный FAIL и findings этого отчёта сохранены.
