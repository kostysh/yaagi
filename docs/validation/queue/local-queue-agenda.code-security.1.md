# Аудит реализации queue: Security, попытка 1

- Document ID: `queue.validation.local-queue-agenda.code-security.1`
- Дата: 2026-09-30; Module ID: `queue`; Task ID: `local-queue-agenda`; Scope ID: `code-security`.
- Audit commit: `3461cb29833b471585c108502a63795514eca36d`; base: `fbf0de9fa7e4fda63bac3bb6c0578bd6bb4ee4ce`.
- Аудитор: `/root/audit_queue_storage_boundary`, `gpt-6-astra` / `high`, независимый read-only, `security-reviewer`.
- Исходный verdict: **FAIL**; нормализованный: **FAIL**.
- Источники: прямой план оператора, архитектурная trust boundary, `queue.spec` и `queue.plan`.
- Предыдущего отчёта этого scope нет. Локальный этап без PR/Issue.

## SEC-Q-001 — Medium, HIGH confidence

**Истёкший deadline не проверяется при принятии результата.** `packages/queue/src/index.ts:174,192,206`: после invoke проверяется только signal.aborted. Конечная синхронная работа handler задерживает timer callback; просроченный timer затем очищается, result сохраняется как completed. Нарушена integrity/lifecycle boundary R11/AC5, а не sandbox/preemption: handler/root доверенные.

Независимый witness использует настоящие Agenda → публичный state → SQLite. При timeoutMs=200, maxAttempts=1 handler выполняет конечный цикл 500 ms и возвращает 42. Два запуска дали durable completed/result.available=true и persisted attempt duration 658/663 ms; во втором signal.aborted=false непосредственно перед возвратом. Assertion ожидаемого failed воспроизводимо упал.

Требуется проверять абсолютный deadline/window после invoke и перед принятием result, при истечении abort и timeout outcome. Admission execution window тоже не должен зависеть только от своевременности timer callback. Regression — конечный CPU-bound handler без обещания принудительного прерывания.

## Покрытие и пределы

Проверены все production sources, public types, SQL/schema/migration, связанные tests/guide/example/scripts, dependency/lock/ESLint delta и evidence. Рассмотрены SQL parameterization/namespace, fencing/budget/recovery/tombstone, corrupt persisted data, safe errors/ambiguity readback, callbacks/heartbeat/final saves/sealing и ownership ресурсов. Других подтверждённых findings в этом scope нет.

Самостоятельно выполнены production integration tests **33/33 PASS** через существующую сборку, SQL-shaped namespace/ID witness PASS, deadline witness FAIL дважды, diff --check PASS. Полный root build/lint/typecheck, dependency audit и state/probe не повторялись. Не проверялись внешние эффекты, malicious trusted plugins, auth/network service, physiology/E3, power-loss, cloud/mobile, sandbox. Worktree чист и HEAD неизменен; witness/временные БД удалены.

## Remediation

Первопричина: факт доставки timer ошибочно использовался как единственный источник истечения абсолютного бюджета. Исправление и новый committed delta требуют runtime-воспроизведения и повторного независимого аудита. Исходный FAIL сохраняется.

Подготовленное исправление: проверка абсолютного deadline после invoke и codec, admission сверяет windowEnd. Production regressions воспроизводят finite CPU-bound handler и задержанную доставку window timer внутри реального candidate callback; последняя проверяет отсутствие даже reservation, не только handler. Root gates и 40/40 queue tests PASS. Независимый committed delta пока pending.

## Повторная проверка

- Remediation commit: `29a3ec3203990687a511960c2429e84dc0371eee`; base — исходный audit commit.
- Прежний независимый аудитор `/root/audit_queue_storage_boundary`, `gpt-6-astra/high`; исходный verdict `PASS (scoped)`, нормализованный **PASS**.
- SEC-Q-001 **CLOSED**, новых mandatory findings нет. Исходный 500/200 ms witness теперь даёт failed/timeout без result; самостоятельный slow-result-codec witness также PASS. Проверены overdue window admission, resource tail по исходнику pinned Agenda 6.2.6, production fencing и guide/evidence.
- Самостоятельно adapter-regression + lifecycle **17/17 PASS**, отдельный codec witness **1/1 PASS**, diff --check PASS. Stable existing build; неизменённые SQL/dependency/root/state/probe не повторялись. HEAD/worktree не изменены, собственный witness удалён, временные БД и процессы закрыты.
- PASS ограничен remediation delta и не утверждает preemption/sandbox, безопасность внешних эффектов или всей системы, E3. Исторический FAIL выше сохранён.
