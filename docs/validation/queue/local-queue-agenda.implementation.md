# Локальная приёмка реализации queue

- Document ID: `queue.validation.implementation`
- Дата: 2026-09-30. Ветка: `codex/queue-agenda`.
- Исходное требование: прямое решение оператора `queue-creation.agenda.v3@60d0022b`; [queue.spec](../../modules/queue/specification.md), [queue.plan](../../modules/queue/implementation-plan.md).
- Статус исходного этапа: **локальная приёмка Q1–Q4 завершена**. Concept claims PASS на `3461cb2`; Spec/Security delta PASS на `29a3ec3203990687a511960c2429e84dc0371eee`. Исходные FAIL сохранены ниже. Последующая интеграция и обнаруженное CI-ограничение описаны отдельно ниже.

## Реализованный контур и evidence

`packages/queue` предоставляет нейтральное ядро и portable contracts/ports; Agenda 6.2.6 подключена только technical adapter. Drizzle owner mapping/SQL migrations работают через публичный state. Нет изменений кода/API state, отдельного DB driver, private fork/patch или собственного production scheduler. Root явно migrate → queue start/stop → state close. Все данные тестов синтетические, БД — task-owned временные файлы; `.env` не читался.

| Критерий | Production-export evidence |
| --- | --- |
| AC1–2 | `durable.test.ts`: реальный FULL/WAL, enqueue/duplicate/conflict, canonical hash, namespaces, lost enqueue/start/result acknowledgement и reopen |
| AC3–4 | `recovery.test.ts`: SIGKILL reserved/started/handled/completed × budgets 1/3, повторные process deaths и restart, notBefore; corpus `experiments/queue/scenarios.json` общий с probe. `lifecycle.test.ts`: real competing consumers плюс **дополнительные core-only** claim/begin/fencing tests. `adapter-regression.test.ts`: настоящий Repository Agenda, старые touch/terminal save/single/bulk unlock после замены lease; отдельно unstarted reservations и sealed callbacks |
| AC5 | `lifecycle.test.ts`: реальные callbacks, deadline/window/stop/cancel, heartbeat и отказ продления, watchdog → held final write, initial-save failure, bounded stop; `durable.test.ts`: held terminal save. `adapter-regression.test.ts`: finite CPU handler и overdue window timer; отдельный `shutdown-child.ts`: отсутствие живых timers и естественный exit после stop/close для delayed/completed jobs, затем reopen/recovery |
| AC6–7 | `durable.test.ts`: input/codecs/JSON, registry, corrupt record/hash, storage/unknown_commit, safe errors, retained result и receipt/tombstone. `lifecycle.test.ts`: failed final write без false success |
| AC8 | `packaging.test.ts`: одинаковый consumer/core/state при смене только adapter; `contracts.types.ts`, `import-child.ts`, negative import probes в `scripts/check-boundary.ts` |
| AC9 | `packaging.test.ts`: dist SQL fresh/repeat/failed migration; state запрещает работу до готовой chain. `recovery.test.ts`: stop/close, отключённый модуль с прежней DB, повторное включение без enqueue. Начальная schema; upgrade неприменим до её следующей версии |
| Потребитель | `guide.test.ts` и `examples/usage.ts`: сохранение → reopen pending → Agenda → durable result → owner cleanup/tombstone |

Синхронизация crash/slow-write/handler — IPC и promises на публичных границах, не sleep-based assertions. Polling — внутри Agenda; пример потребителя опрашивает публичный durable status до проверенного результата и ограниченного deadline. Технические таймауты тестов не назначают рабочие бюджеты E2.

## Проверки и исправления при self-check

Версии baseline: Node 24.21.0, pnpm 10.34.5, TypeScript 7.0.2, Agenda 6.2.6, Drizzle ORM 0.45.3 / Kit 0.31.11, Zod 4.6.5. Root toolchain не обновлялся. Первичный audit показал GHSA-67mh-4wv8-2f99 в legacy esbuild от Drizzle Kit; применён ранее проверенный в `experiments/state` узкий override `@esbuild-kit/core-utils>esbuild: 0.25.12`. Frozen install выполнен; `pnpm audit` после override: 0 известных advisories. Это не доказательство отсутствия уязвимостей.

Self-check выявил и исправил: неверный minimum для backoff=0; тест pending schema, пытавшийся читать её до готовой chain; слишком короткие тестовые lease/window под параллельной нагрузкой; неверное ожидание adapter onError для ошибки, принадлежащей core. Последнее заменено барьером инъекции и проверкой durable state/lifecycle после stop. Общая тестовая lease приведена к 2000 ms (как probe), а watchdog проверяется отдельно удержанием реального heartbeat. Test harness больше не молчит при dispatch error до ожидаемого commit. Прогоны с timeout/failure не считаются PASS.

Первичный root-прогон на `3461cb2`: frozen install, format:check, lint/Biome/ESLint/boundary, typecheck, build, test и отдельный queue example — PASS. `core-types` type/import checks, `state` 53/53, `queue` 33/33: 0 failed/cancelled/skipped. Проверены portable declarations, все exports, no import I/O в заявленном smoke-контуре и отсутствие private imports. Scoped diff и `git diff --check` — PASS. Этот прогон не обнаружил последующие audit findings и не заменяет их исправление.

Отрицательные probe/plan отчёты сохранены рядом; новые mandatory findings потребуют собственного отчёта и remediation commit.

После выделения общего crash corpus исходная standalone проба повторена: format, lint, typecheck/build и **21/21 tests PASS**, 0 failed/cancelled/skipped. Исторические результаты в README пробы не переписаны.

## Независимые аудиты и исправления

Snapshot `3461cb29833b471585c108502a63795514eca36d`, base `fbf0de9fa7e4fda63bac3bb6c0578bd6bb4ee4ce`:

- Concept delta `/root/audit_queue_roadmap`, `gpt-6-astra/high`: `assessable`, `fake-risk: low`, `proceed`, `capability-demonstrated` в локальном API / **PASS**. Проверены architecture/ADR/spec metadata/AGENTS и прямой README/evidence context; независимо 15/15 guide/recovery/packaging и 4/4 selected lifecycle/durable tests. Full root suite этим аудитором не повторялся.
- Spec `/root/audit_queue_plan`, `gpt-6-astra/xhigh`: `non-compliant` / **FAIL**; [SPEC-F1/F2](local-queue-agenda.code-spec.1.md). Security `/root/audit_queue_storage_boundary`, `gpt-6-astra/high`: **FAIL**; [SEC-Q-001](local-queue-agenda.code-security.1.md). Оба независимо выполнили исходные 33/33 tests; дополнительные witnesses выявили пробелы набора.

Remediation: абсолютный deadline проверяется после handler/codec до принятия result; admission проверяет window даже при задержанной доставке timer. Repository резервирует только уже due jobs: notBefore остаётся в state до следующего poll. Проверка соседнего resource path выявила также watchdog tail Agenda; stop ждёт не более оставшегося одного интервала после последнего terminal/failed-initial save и возвращает stop_incomplete при недостаточном budget. Public lifecycle и pinned Agenda 6.2.6 позволяют ограничить этот хвост без private handles/patch и собственного scheduler; guide описывает влияние на shutdown budget.

Production regressions вызывают настоящий публичный `Agenda.db`/JobRepository; наблюдение public define/save не подменяет реализацию. Барьеры задерживают begin/heartbeat до замены lease вторым реальным consumer. Проверены begun, unstarted, отсутствующие entries и sealed пути single/bulk unlock, stale touch/finalize. Core-only test более не выдаётся за полное cross-layer evidence.

После remediation полный root-прогон повторён: `pnpm install --frozen-lockfile --store-dir .pnpm-store`, format:check, lint/boundary, typecheck, build, test, отдельный queue example — **PASS**. `state` 53/53, `queue` **40/40**, 0 failed/cancelled/skipped; core-types type/import checks PASS. Использован прежний task-local store без переустановки/смены dependency baseline. Повторный scoped diff --check PASS. Новые 7 regressions дополняют, а не заменяют исходный набор.

Повторный независимый audit snapshot: `29a3ec3203990687a511960c2429e84dc0371eee`, base `3461cb29833b471585c108502a63795514eca36d`:

- Spec delta, прежний `/root/audit_queue_plan`, `gpt-6-astra/xhigh`: `compliant` / **PASS**; SPEC-F1/F2 CLOSED, новых mandatory findings нет. Самостоятельно 7/7 новых regressions и 6/6 прежних shutdown/watchdog/held-write/initial-failure сценариев, scoped diff --check PASS. Проверены direct blast radius deadline/window и guide/evidence. Не повторялись неизменённые root/state/probe/D0.
- Security delta, прежний `/root/audit_queue_storage_boundary`, `gpt-6-astra/high`: `PASS (scoped)` / **PASS**; SEC-Q-001 CLOSED, новых mandatory findings нет. Самостоятельно 17/17 adapter-regression/lifecycle и дополнительный 1/1 witness медленного result codec, scoped diff --check PASS. Рассмотрены resource tail и fencing; неизменённые SQL/dependency/root/state/probe не повторялись.

Оба аудитора использовали стабильную сборку и read-only scoped snapshot, не меняли tracked files, завершили проверки и удалили свои временные witnesses. Принятый предел — pinned Agenda 6.2.6 и локальный public API. Финальная запись результатов не меняет audited code/schema/contracts. Все помощники завершены; API их закрытия недоступен. Сохранены task-worktree, `.env` symlink и ignored dependencies/build outputs для дальнейшей работы; основная ветка `develop` не изменена.

## Пределы и поставка

Гарантия локального модуля — durable at-least-once jobs. Lease не отзывает внешний эффект; handler обязан быть повторобезопасным и соблюдать signal. Namespace не ACL, receipt — заявление доверенного owner, не проверка его отдельной БД. Stop timeout не убивает callback и не разрешает close.

Не заявляются physiology/runtime, canonical owner outbox/receipts, полный E3, exactly-once effects, hardware power-loss, sandbox и mobile/cloud. Remote CI принимается только по обязательным checks соответствующего snapshot. Rollback означает сохранить DB/tombstones/jobs при отключении модуля; destructive down/restore старого snapshot не выполняются.

Исходный этап был только локальным, без публикации и удаления worktree. Последующее прямое решение оператора «доведи изменения до интеграции» разрешило delivery в `develop`; оно не разрешает `master`, release или tags.

## Интеграция: устранение наложенных scans Agenda

На исходном head `a4496c814525fb8064738dc0826416ed689300de` создан [PR #41](https://github.com/kostysh/yaagi/pull/41). Первый [Workspace CI](https://github.com/kostysh/yaagi/actions/runs/36643820751) — **FAIL**: queue 24 PASS, 10 FAIL, 6 cancelled; state 53/53 и остальные gates до queue прошли. Локальная приёмка не обнаружила эту зависимость от скорости исполнения. Отдельный полный повтор на двух CPU с последовательными файлами тоже дал FAIL: 33 PASS, 4 FAIL, 3 cancelled. Одного ограничения file concurrency недостаточно.

Причина: Agenda 6.2.6 вызывает `getNextJobToRun` при следующем poll, не дожидаясь предыдущего. Repository пропускал каждый scan в state, чьи реальные SQLite-транзакции создают scoped workers; при медленном исполнении незавершённые scans накапливались и задерживали heartbeat/commit. Это дефект adapter admission, а не основание ослабить durable, fencing или restart assertions.

Исправление допускает только один незавершённый scan каждого разрешённого типа. Повторный overlapping вызов не обращается к storage; после завершения (включая отказ) scan освобождается в `finally`. Действительная операция остаётся в существующем pending-учёте stop. Polling и dispatch остаются в Agenda; нет новых timers, scheduler, private API, изменений state/API/schema/dependencies.

Новый `adapter-regression.test.ts` удерживает первую reservation на public seam и вызывает настоящий Agenda JobRepository ещё восемь раз. На прежнем production-коде наблюдалось 9 reservation вместо 1 — **FAIL**; после исправления только одна, затем реальный handler и durable result — **PASS**. Исходный failing witness двух Agenda consumers на двух CPU тоже прошёл. Полный compiled production набор на двух CPU с `--test-concurrency=2 --test-timeout=45000`: **41/41 PASS**, 0 failed/cancelled/skipped. Существующие таймауты, leases, assertions и test scripts не изменены; предварительная standalone проба не включена в root CI и не повторяется для этого production delta.

После исправления обычные корневые `pnpm install --frozen-lockfile --store-dir .pnpm-store`, `format:check`, `lint`, `typecheck`, `build`, `test` и отдельный queue `example` — **PASS**: state 53/53, queue 41/41, core-types type/import checks; 0 failed/cancelled/skipped. Scoped diff и `git diff --check` — PASS. Новая дельта требует независимых Spec/Security-аудитов и нового GitHub CI до merge; прежние PASS не распространяются на неё автоматически.

## Повторная проверка всего модуля

Последующий post-merge CI `36866452116` на `0a47c5fbdbcd62473bab8c0acddf2fbe1efa4a72` снова выявил проблему deadline oracle. По поручению оператора проведён полный независимый Spec audit: прежние 41/41 tests прошли, дополнительные сценарии выявили production нарушения на границах codec/deadline и finish/heartbeat. Исторические результаты выше сохраняются; актуальные findings, исправления и границы доказательства находятся в [hardening evidence](local-queue-hardening.implementation.md) и [исходном FAIL](local-queue-hardening.code-spec.1.md).
