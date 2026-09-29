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
