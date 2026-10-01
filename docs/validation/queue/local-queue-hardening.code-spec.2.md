# Повторный отрицательный аудит `queue`: обратный порядок ACK

## Паспорт

- Дата: 2026-10-01
- Document ID: `queue.validation.local-queue-hardening.code-spec.2`
- Module ID: `queue`
- Task ID: `local-queue-hardening`
- Scope ID: `code-spec`
- Объект: дельта production core/Agenda и прямой blast radius SPEC-H1–H3, R15; дельта Q5 плана оценивалась отдельно
- Audit commit: `553bf1e6aa4761a58b6028b198fec05c27fcd217`
- Base commit: `0a47c5fbdbcd62473bab8c0acddf2fbe1efa4a72`
- Вид аудита / skill: `spec-conformance-reviewer`
- Аудитор: тот же `/root/queue_hardening_spec`, GPT-6 Astra / `xhigh`, read-only
- Номер попытки: 2
- Нормализованный статус кода: **FAIL**
- Исходный verdict кода: **non-compliant**
- Отдельный verdict Q5 плана: **compliant / PASS**, completion Q5 не подтверждён
- PR / Issue: локальное исправление блокера; PR пока не опубликован
- Предыдущий отчёт: [исходный FAIL](local-queue-hardening.code-spec.1.md)

## Итог и finding

Источники и пределы исходного аудита сохраняются. **SPEC-H2/H3 CLOSED**. R15 budget recheck и один публичный Agenda stop корректны в проверенных путях. **SPEC-H1 OPEN**, major, R9/R12/AC4–6: подтверждение результата по-прежнему зависит от локального Promise lifetime, который короче уже принятого heartbeat/ACK/readback.

Локаторы snapshot: `store.ts:292–306` — readback требует token в `finishing`; `store.ts:395–396` — он удаляется при settlement finish; `agenda.ts:174` — после execute безопасным считается conflict, но unknown_commit останавливает queue. `hardening.test.ts:310` проверяет лишь противоположный порядок ACK.

Независимый witness: настоящие Agenda/state/SQLite, maxAttempts 2, lease 2000. Renewal COMMIT → удержанный ответ touch → первая попытка handler_failed → finish COMMIT pending → сначала finish ACK и фактический settlement input.execute → затем потерянный touch ACK. Readback видит собственную законченную последнюю попытку без lease, но локальный Set уже очищен. Touch возвращает unknown_commit; настоящий adapter onError переводит queue в stopping **до test cleanup/stop**. После stop: calls 1, pending, attemptsUsed 1/maxAttempts 2, idle/error unknown_commit. Требуемый retry не выполняется.

## Доказательства и пределы

- Самостоятельный scoped suite hardening/adapter-regression/lifecycle: **28/28 PASS**, 23.3 s. Он пропускает описанный порядок.
- Обратный ACK witness и его TypeScript check подтверждают оставшееся нарушение: `/tmp/yaagi-queue-hardening-spec-delta-ack/witness.ts`, `result.log`.
- Независимый replay исходного real-clock codec witness: 1500 ms синхронный decode при timeout 1000 теперь даёт calls 0, failed/timeout/noresult — H2 закрыт; `codec-replay.log`.
- Genuine renewal error, replacement fencing, codec/window, cancellation, watchdog, bounded stop и natural subprocess exit проходят; новых обязательных findings там нет. Неизменённые полные root/state/probe gates самостоятельно не повторялись; предоставленные root/двухпроцессорные журналы согласуются с заявленными результатами.
- Отдельный независимый Security Reviewer на том же snapshot: **PASS (scoped) / PASS**, 36/36 targeted tests и 3/3 дополнительных typed witnesses отмены, interrupted recovery и SQL-shaped identifiers. Это не закрывает Spec finding и не означает PASS будущей дельты.

## Remediation

Первопричина уточнена: локальная фаза finish не является durable границей поколения. Следующее исправление должно подтверждать только последнюю законченную попытку этого token без lease/cancellation/interruption, независимо от порядка ACK; подтверждение ничего не записывает и не утверждает конкретный renewal commit. Не подавлять все conflict/unknown_commit и не добавлять registry/refcounts только ради продления ошибочной локальной границы. Оба порядка должны сохранять retry без restart; replacement/cancel/interruption и genuine storage failure остаются fail-closed.

Новый remediation commit и результат ограниченного повторного Spec/Security audit будут добавлены после проверок. Исходный snapshot, finding и verdict этого отчёта неизменны.
