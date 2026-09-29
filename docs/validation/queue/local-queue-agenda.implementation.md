# Локальная приёмка реализации queue

- Document ID: `queue.validation.implementation`
- Дата: 2026-09-30. Ветка: `codex/queue-agenda`.
- Исходное требование: прямое решение оператора `queue-creation.agenda.v3@60d0022b`; [queue.spec](../../modules/queue/specification.md), [queue.plan](../../modules/queue/implementation-plan.md).
- Статус: implementation verification; independent code/claim audits pending. Итоговый снимок передаётся аудиторам после self-check; этот документ не объявляет gate закрытым заранее.

## Реализованный контур и evidence

`packages/queue` предоставляет нейтральное ядро и portable contracts/ports; Agenda 6.2.6 подключена только technical adapter. Drizzle owner mapping/SQL migrations работают через публичный state. Нет изменений кода/API state, отдельного DB driver, private fork/patch или собственного production scheduler. Root явно migrate → queue start/stop → state close. Все данные тестов синтетические, БД — task-owned временные файлы; `.env` не читался.

| Критерий | Production-export evidence |
| --- | --- |
| AC1–2 | `durable.test.ts`: реальный FULL/WAL, enqueue/duplicate/conflict, canonical hash, namespaces, lost enqueue/start/result acknowledgement и reopen |
| AC3–4 | `recovery.test.ts`: SIGKILL reserved/started/handled/completed × budgets 1/3, повторные process deaths и restart, notBefore; corpus `experiments/queue/scenarios.json` общий с probe. `lifecycle.test.ts`: competing claims/consumers, idempotent begin, stale finalize/touch/release |
| AC5 | `lifecycle.test.ts`: реальные callbacks, deadline/window/stop/cancel, heartbeat и отказ продления, watchdog → held final write, initial-save failure, bounded stop; `durable.test.ts`: held terminal save |
| AC6–7 | `durable.test.ts`: input/codecs/JSON, registry, corrupt record/hash, storage/unknown_commit, safe errors, retained result и receipt/tombstone. `lifecycle.test.ts`: failed final write без false success |
| AC8 | `packaging.test.ts`: одинаковый consumer/core/state при смене только adapter; `contracts.types.ts`, `import-child.ts`, negative import probes в `scripts/check-boundary.ts` |
| AC9 | `packaging.test.ts`: dist SQL fresh/repeat/failed migration; state запрещает работу до готовой chain. `recovery.test.ts`: stop/close, отключённый модуль с прежней DB, повторное включение без enqueue. Начальная schema; upgrade неприменим до её следующей версии |
| Потребитель | `guide.test.ts` и `examples/usage.ts`: сохранение → reopen pending → Agenda → durable result → owner cleanup/tombstone |

Синхронизация crash/slow-write/handler — IPC и promises на публичных границах, не sleep-based assertions. Polling — внутри Agenda; пример потребителя опрашивает публичный durable status до проверенного результата и ограниченного deadline. Технические таймауты тестов не назначают рабочие бюджеты E2.

## Проверки и исправления при self-check

Версии baseline: Node 24.21.0, pnpm 10.34.5, TypeScript 7.0.2, Agenda 6.2.6, Drizzle ORM 0.45.3 / Kit 0.31.11, Zod 4.6.5. Root toolchain не обновлялся. Первичный audit показал GHSA-67mh-4wv8-2f99 в legacy esbuild от Drizzle Kit; применён ранее проверенный в `experiments/state` узкий override `@esbuild-kit/core-utils>esbuild: 0.25.12`. Frozen install выполнен; `pnpm audit` после override: 0 известных advisories. Это не доказательство отсутствия уязвимостей.

Self-check выявил и исправил: неверный minimum для backoff=0; тест pending schema, пытавшийся читать её до готовой chain; слишком короткие тестовые lease/window под параллельной нагрузкой; неверное ожидание adapter onError для ошибки, принадлежащей core. Последнее заменено барьером инъекции и проверкой durable state/lifecycle после stop. Общая тестовая lease приведена к 2000 ms (как probe), а watchdog проверяется отдельно удержанием реального heartbeat. Test harness больше не молчит при dispatch error до ожидаемого commit. Прогоны с timeout/failure не считаются PASS.

Итоговый root-прогон: frozen install, format:check, lint/Biome/ESLint/boundary, typecheck, build, test и отдельный queue example — PASS. `core-types` type/import checks, `state` 53/53, `queue` 33/33: 0 failed/cancelled/skipped. Проверены portable declarations, все exports, no import I/O в заявленном smoke-контуре и отсутствие private imports. Scoped diff и `git diff --check` — PASS. Независимые code/claim-аудиты ещё не объявляются PASS до результата.

Отрицательные probe/plan отчёты сохранены рядом; новые mandatory findings потребуют собственного отчёта и remediation commit.

После выделения общего crash corpus исходная standalone проба повторена: format, lint, typecheck/build и **21/21 tests PASS**, 0 failed/cancelled/skipped. Исторические результаты в README пробы не переписаны.

## Пределы и поставка

Гарантия локального модуля — durable at-least-once jobs. Lease не отзывает внешний эффект; handler обязан быть повторобезопасным и соблюдать signal. Namespace не ACL, receipt — заявление доверенного owner, не проверка его отдельной БД. Stop timeout не убивает callback и не разрешает close.

Не заявляются physiology/runtime, canonical owner outbox/receipts, полный E3, exactly-once effects, hardware power-loss, sandbox, mobile/cloud и remote CI. Rollback означает сохранить DB/tombstones/jobs при отключении модуля; destructive down/restore старого snapshot не выполняются.

Поставка только локальная: task-worktree сохраняется, разрешены audit/remediation commits. Push/PR/merge/tag, Issues и удаление worktree не выполняются.
