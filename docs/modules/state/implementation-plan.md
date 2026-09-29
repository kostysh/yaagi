# План имплементации модуля: `state`

- Document ID: `state.plan`
- Module ID: `state`
- Дата: 2026-09-29.
- Статус: ready for проверка механизма; production-корректировка после evidence и source-аудитов.
- Источники: [spec](specification.md), [архитектура §2.4](../../architecture.md#24-адаптеры-state-и-queue), [ADR-001](../../adr/ADR-001-module-boundaries.md), [ADR-002](../../adr/ADR-002-state-and-recovery.md); прямое решение оператора о реальном adapter boundary, отсутствии искусственного busy/своих очередей, разрешении workers при подтверждении корректности.
- Baseline: develop `586814fb01fe3ed24b9cffaa05d48ea45ebf3ea7`; первый инкремент доставлен [PR #29](https://github.com/kostysh/yaagi/pull/29), прежние [#26](https://github.com/kostysh/yaagi/issues/26)–[#28](https://github.com/kostysh/yaagi/issues/28) закрыты. CP1 принят; новый permission gate не создаётся.
- Работа: `.worktree/state-adapters`, `codex/state-adapters` от origin/develop. Read-only .env symlink; roadmap-bootstrap, master и теги не затрагиваются.

## Результат и дельта

Разработчик получает нейтральное исполняемое ядро с внедряемым adapter. Одновременные независимые операции не отклоняются флагом занятости и не требуют app queue/replay. SQLite сама координирует writers. SQL/bindings остаются в backend/owner.

Scope delta — mixed, только прямо запрошенная корректировка:

| Дельта / источник | Последствие |
| --- | --- |
| Внедрение adapter, оператор / R19/R23 | Root createState/нейтральный контракт; SQLite только ./adapters/sqlite. Breaking private 0.0.0 API, все примеры/tests меняются вместе, DB-формат прежний |
| Удаление искусственного busy/своей координации, оператор / R22 | Независимые connections/scopes, native ожидание в caller budget, без очереди/replay/pool/40 ms cutoff |
| Условно разрешённые workers, оператор / R22 | Проверка DatabaseSync вне главного JS-потока; SQL async, cleanup/cancel сохраняются, hard interrupt не обещается |
| Усиленный M1, оператор / R23 | Те же core/consumer/oracle с двумя adapters; подмена всего StoragePort не закрывает M1 |

Неавторизованных добавлений нет. Не добавляются production backend, packages, runtime, agent lifecycle/exclusivity/process policy, universal repository, domain models, vector helpers, scheduler или экспериментальный framework. Drizzle/sqlite-vec/node:sqlite сохраняются; при несовместимости — конкретный результат оператору. I1/E3/power-loss/mobile не закрываются. Риск high: persistent data, concurrency, public API.

## Выполнение

| Шаг | Результат / источник | Зависимость и владелец evidence |
| --- | --- | --- |
| D1 | Architecture/ADR/spec/plan отражают R22/R23 и область переносимости | Self-check → commit → независимые Concept, Spec плана, Security trust/data delta; architecture/spec/planning skills |
| S1/S2 delta | В существующем experiment контуре воспроизведён main-thread блок; workers проверены на native wait/read/read/read/write/write/write, rollback, BLOB/vec, cancel и cleanup | start: D1 audits; node/typescript/test skills, временные БД. Результат возвращается в sources; нет нового spike/framework |
| D2 | Нейтральное ядро работает с SQLite и test-only adapter | start: механизм подтверждён; implementation-discipline + node/typescript/test skills; R1–R23/AC1–AC6 и real migrations/backup/reopen |
| D3 | Guide/README/AGENTS и исполняемый пример показывают injection/bindings/concurrency | start: D2 контракт стабилен; documentation; только затронутые root README/roadmap/tooling claims |
| D4 | Корректировка проверена на стабильном snapshot | acceptance: D2/D3 вместе; package/root gates; Concept sources, Spec code/plan/README/roadmap/guide, Security code/config/data boundaries |

Прежние S1/S2 fixtures/миграции сохраняют происхождение, все real SQLite негативные сценарии — регрессии. AC6 требует детерминированные барьеры/сообщения, no partial/late commit и no replay. M1 меняет adapter/bindings, не consumer/core. Одних declarations, mock или docs недостаточно.

Совместная acceptance D2/D3: input → owner validation → mixed Drizzle/vector commit → DTO readback → reopen, в том числе с другим scope. M1 не доказывает durability memory double. Failure/no-leakage/permissions/immutable migrations/backup guards не ослабляются. Source API rollback — возврат к baseline вместе с consumers; файл/журнал не требуют обратной migration.

## Проверки и поставка

TypeScript-only, прямой TS только с --experimental-strip-types. Node24.21.0 / TS7 / pnpm / Biome single quotes / ESLint сохраняются. Package scripts обязательны, root/CI рекурсивно делегируют. Выполнить pnpm format, frozen install, package/root format:check, dual lint/boundary, typecheck, build, test/test:integration, guide example и git diff --check. Проверить declarations/exports, negative private/native imports, нейтральный root без native/Node imports и запрет legacy exports.

Аудиты по [политике](../../development-methodology/audits.md), профили/независимость — [agent policy](../../development-methodology/agent-policy.md). Committed snapshots с явным покрытием; старые PASS не закрывают новую границу. Negative reports сохраняются, remediation — новый commit/delta того же пригодного reviewer; после трёх FAIL расследовать первопричину.

Прежняя поставка завершена. Новую корректировку сначала довести до проверенного локального результата; публикация — при применимом разрешении оператора, новый PR/matching-SHA CI/readback develop. Прежний CI #29 не доказывает новую версию. До завершения сохранить worktree/ветку и сообщить Git/CI/tracking state; завершить helpers/resources. При провале worker probe остановить только зависимую production-корректировку и представить evidence/варианты, без молчаливого fallback.

Текущее evidence: первый инкремент исторически доставлен; новый механизм/M1/production boundary ещё не выполнены. Следующее действие — D1 self-check/commit/audits, затем S1/S2 delta.
