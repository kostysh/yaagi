# Аудит предварительной пробы Agenda: попытка 1

- Document ID: `queue.validation.local-queue-agenda.probe-spec.1`
- Дата: 2026-09-29
- Module ID: `queue`; Task ID: `local-queue-agenda`; Scope ID: `probe-spec`
- Audit commit: `b82a055739e5e47acc8cdd63a93d42a33beecf18`
- Base commit: `3aa1be497e42b5d1bd4b1ab9d76fb8683264b2b2`
- Вид: Spec Conformance; `spec-conformance-reviewer` + `implementation-discipline`.
- Аудитор: `/root/audit_queue_plan`, `gpt-6-astra` / `xhigh`, read-only, без наследованного авторского контекста.
- Исходный verdict: `non-compliant`; нормализованный: **FAIL**.
- PR/Issue: локальный непубликуемый этап; Issue ради имени отчёта не создавалась.
- Предыдущий отчёт: нет.

## Контекст и итог

Scope — все десять committed файлов `experiments/queue/`. Источники: прямой план оператора `queue-creation.agenda.v3@60d0022b`, затем [архитектура §§2.4/5.4/8](../../architecture.md), ADR-002 и public state API. Проверяется bounded probe до принятия Agenda, не production queue, E3, mobile или cleanup protocol. 19 штатных тестов PASS не закрыли обязательную гарантию bounded stop.

| ID | Приоритет | Место в audit commit | Недостаток | Основание | Исправление |
| --- | --- | --- | --- | --- | --- |
| F1 | major | `experiments/queue/fixture.ts:79,114–116`; `README.md:54` | Stop возвращает fulfilled после watchdog expiry, пока поздний terminal save ещё удерживается; текущие active/pending snapshots пропускают асинхронный промежуток | План §2 и architecture §8: callbacks/repository calls закончены до storage close | Учитывать полный lifecycle попытки независимо от Agenda running list; закрыть future I/O после успешного stop; добавить combined watchdog/late-save regression |

Witness аудитора: enqueue с budget 3; handler ждёт abort; terminal `saveJobState` удерживается Promise-барьером; дождаться реального Agenda error `execution took more than 2000ms`; вызвать stop без освобождения final-save. Фактически: `stop outcome while terminal callback is held fulfilled`, `terminal callback settled before successful stop false`. Root получил ложное разрешение закрыть state.

Проверены также public state API и lifecycle исходники установленной Agenda. `pnpm test`: 19/19 PASS; дополнительный witness воспроизвёл F1; `git diff --check` PASS. Независимый Security audit того же snapshot дал scoped PASS; это не отменяет данного finding. Файлы аудитором не менялись, собственные временные ресурсы очищены.

## Remediation

Первопричина: `active` закончился до `Job.run` finally; watchdog уже освободил running bookkeeping, а новый terminal repository call ещё не вошёл в `pending`. Это пробел модели жизненного цикла, не недостаток таймаута.

Исправление: lifecycle tracking от первого публичного `saveJobState` до завершения terminal save; успешный stop ждёт его вместе с реальными callbacks и принятыми repository calls, затем закрывает admission future I/O. Прямой blast radius: `fixture.ts`, регрессионный тест и README evidence. Нельзя лечить дефект одним увеличением lease или объявлением production-only gap.

Доказательство: после исправления полный прогон 20/20 PASS; отдельно добавлен отказ первого save до Agenda try/finally и повторён затронутый shutdown-контур — 5/5 PASS. Format, dual lint, typecheck/build, diff-check PASS. Независимый delta verdict ещё не получен.

## Повторный аудит

- Remediation commit: ещё не создан.
- Передаваемая дельта: исправление F1, новый тест `watchdog expiry cannot make stop succeed…`, связанные shutdown-пути и точность evidence.
- Результат: ожидается.
