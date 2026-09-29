# Аудит реализации queue: Spec, попытка 1

- Document ID: `queue.validation.local-queue-agenda.code-spec.1`
- Дата: 2026-09-30; Module ID: `queue`; Task ID: `local-queue-agenda`; Scope ID: `code-spec`.
- Audit commit: `3461cb29833b471585c108502a63795514eca36d`; base: `fbf0de9fa7e4fda63bac3bb6c0578bd6bb4ee4ce`.
- Аудитор: `/root/audit_queue_plan`, `gpt-6-astra` / `xhigh`, независимый read-only, `spec-conformance-reviewer`.
- Исходный verdict: `non-compliant`; нормализованный: **FAIL**.
- Источники: прямой план оператора → architecture/ADR → `queue.spec` R1–17/AC1–9 → `queue.plan`.
- Предыдущего отчёта этого scope нет. Локальный этап без PR/Issue.

## Обязательные findings

**SPEC-F1, major — успешный stop оставляет referenced timer Agenda.** `packages/queue/src/adapters/agenda.ts:256` резервирует future job до scan horizon. Agenda 6.2.6 (`dist/JobProcessor.js:394`) создаёт отложенный timer; stop на `agenda.ts:201` его не учитывает. Нарушены R15/AC5 и bounded resource shutdown принятого плана. Независимый subprocess witness: реальные production Agenda/state, poll 8000 ms, lease 20000 ms, notBefore = now + 4321; барьер — регистрация library timer. Stop с budget 1000 и state.close успешны, lifecycle idle, `timerStillReferenced=true`, calls=0. Процесс естественно завершается только через 4109 ms после stop (`capturedDelay=4106`). Поздний handler/I/O или потеря данных не установлены. Требуется исключить future-timer путь через публичный repository seam и проверить естественный exit/последующее recovery без private patch.

**SPEC-F2, major — отсутствует production evidence stale single/bulk unlock.** `packages/queue/test/lifecycle.test.ts:225–291` проверяет core через `captured()`; «bulk» — Promise.all отдельных store.release. Это не исполняет настоящий Repository.unlockJob/unlockJobs (`agenda.ts:329`), его ID-only lookup и entries/begun/sealed. Нарушено обязательное покрытие R10/AC4, queue.spec:162 и queue.plan:27–28. Статическая защита присутствует; durable fencing defect не утверждается. Нужен regression через реальный production adapter либо доказательство недостижимости на его фактическом публичном lifecycle; core-only evidence должно быть обозначено отдельно.

Отдельный [Security finding](local-queue-agenda.code-security.1.md) о deadline затрагивает R11/AC5; его witness не принадлежит Spec-аудитору и им не повторялся.

## Покрытие и пределы

Прочитаны production core/contracts/ports/adapter/storage/SQL, все package tests/fixtures/scripts/example/guide, root tooling/lockfile delta, roadmap/README/plan/evidence и requestedNotBefore delta спецификации. Самостоятельно выполнены package tests **33/33**, typecheck, Biome/ESLint/boundary, format:check и scoped diff --check — PASS; отдельный resource witness подтвердил SPEC-F1. Полный root/state suite, probe и security scan не повторялись. E3, power-loss, physiology и remote delivery не оценивались. HEAD/worktree не менялись; временные witness/DB удалены.

## Remediation

Первопричины: stop учитывал DB/callback lifecycle, но не библиотечный delayed timer; core-level fencing test ошибочно представлялся полным cross-layer AC4. Исправления и новый committed delta требуют повторного независимого аудита. Исходный FAIL остаётся историческим результатом.

Подготовленное исправление: reserve только due jobs; учёт остаточного watchdog delay после последнего terminal/failed-initial save. `adapter-regression.test.ts` и `shutdown-child.ts` проверяют натуральный subprocess exit, отсутствие Timeout после close и последующее delayed recovery. Настоящий Agenda.db проверен для stale touch/terminal/single/bulk unlock, begun и unstarted entries, missing/sealed путей. Guide уточняет polling и shutdown budget. Root gates и 40/40 queue tests PASS; независимый committed delta пока pending.

## Повторная проверка

- Remediation commit: `29a3ec3203990687a511960c2429e84dc0371eee`; base — исходный audit commit.
- Прежний независимый аудитор `/root/audit_queue_plan`, `gpt-6-astra/xhigh`; исходный verdict `compliant`, нормализованный **PASS**.
- SPEC-F1 и SPEC-F2 **CLOSED**, новых mandatory findings в delta нет. Проверены due-only reservation, watchdog quiescence, реальные Repository stale paths, deadline/window blast radius, guide и честное разделение core-only/production evidence.
- Самостоятельно 7/7 новых и 6/6 выбранных прежних lifecycle/held-write tests PASS; scoped diff --check PASS. Без rebuild/install и повторения неизменённых root/state/probe/D0. Read-only snapshot сохранился чистым; процессы завершены, дополнительных ресурсов не оставлено.
- Этот delta PASS не заменяет отдельный Security verdict и не заявляет E3/power-loss/runtime. Исторический FAIL выше не отменён и не переписан.
