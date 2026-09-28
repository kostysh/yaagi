# План имплементации модуля: `state`, первый инкремент

- Document ID: `state.plan`
- Module ID: `state`
- Дата: 2026-09-29.
- Статус: draft; S1/S2 blocked до начальных аудитов; production coding blocked до CP1.
- Спецификация: [state.spec](specification.md).
- Источники: [архитектура §§2–6, 7.3, 8–10](../../architecture.md), [ADR-001](../../adr/ADR-001-module-boundaries.md), [ADR-002](../../adr/ADR-002-state-and-recovery.md); принятый оператором `state-first-increment.v3`.
- Рамочная Issue: [#26](https://github.com/kostysh/yaagi/issues/26); поведение snapshot/transaction/migration — [#27](https://github.com/kostysh/yaagi/issues/27), exclusivity/durability — [#28](https://github.com/kostysh/yaagi/issues/28).
- Scope delta: unchanged; новых доменных требований нет. Риск: high — persistent data, native code и атомарность.

## Результат и границы

Разработчик owner adapter и composition root получает проверенные `readSnapshot`, `transact`, `checkSchema` и lifecycle/exclusivity: согласованное чтение и общий commit нескольких владельцев сохраняются после reopen. Реальные SQLite/BLOB/vector проверки проходят через публичные exports. Самый прямой путь — один пакет с общими контрактами, техническим SQLite export и отдельным Node adapter; фикстуры не требуют реализации соседних модулей.

Capability — наблюдаемое поведение из AC1–AC5 спецификации. Substrate — документы, пакет, tooling и guide. Anti-claims: не реализуются runtime, memory/timeline/RAG, queue, универсальный repository, vector helpers или новые доменные схемы; I1/E3, двухбазовое recovery, physical power-loss и другие платформы не закрываются. M1 доказывает только проверенное контрактное поведение, не durability тестовой альтернативы или эквивалентность платформ.

Приняты `better-sqlite3`, Drizzle и `sqlite-vec`; проверяется Linux x64 локально и Ubuntu 24.04 CI. Raw vector SQL обходит только ORM и остаётся операцией owner/fixture на том же scope/connection/transaction. Ownership схем, DTO, transformations и retrieval задан спецификацией и не переносится в `state`.

Работа ведётся в `.worktree/state-sqlite`, `codex/state-sqlite`, исходный commit `6e341a889c3dceddf813b5dab867544e18d27c9f`. `roadmap-bootstrap` сохраняется. `.env` — read-only symlink; проверяются только его метаданные. Development prose и package README/AGENTS — русские; root README и repository-wide AGENTS — английские.

## Задачи и порядок интеграции

| ID | Проверяемый результат и источник | Готовность / зависимость | Следующий владелец / проверка | Tracking |
| --- | --- | --- | --- | --- |
| T0 | Architecture/ADR delta, `state.spec` и этот план задают разрешённые S1/S2, сохраняя production draft | ready for authors/reviewers по принятому v3; применимые gates и локальный commit до аудита | `architecture-engineer`, `spec-engineer`, `delivery-planner`; независимые Concept/Spec/Security по предмету | #26 |
| S1 | Evidence общего async scope и migration chain, AC1–AC2 / R1–R11, R15, R19 | `start`: T0 PASS; до этого blocked | `node-engineer` + TypeScript/test skills; brief ниже | #27 |
| S2 | Evidence lifecycle, ошибок, сохранности и native-связки, AC3 / R12–R18, R20 | `start`: T0 PASS; до этого blocked | `node-engineer` + TypeScript/test skills; brief ниже | #28 |
| CP1 | Evidence возвращено в sources; точные contracts и acceptance предложены оператору | `start`: S1/S2 terminal evidence и применимые аудиты нового committed snapshot | Авторы sources и независимые reviewers; затем hard stop | #26 |
| T3 | Принятые storage/lifecycle guarantees реализованы в `@polyphony/state` | blocked; `start`: явное approval CP1 и принятая спецификация | Coding с `implementation-discipline`, `node-engineer`, `typescript-engineer`, `typescript-test-engineer`; AC1–AC3 | #27, #28 |
| T4 | Отдельный M1 replacement prototype и исполняемый guide доступны потребителю | blocked; `start`: CP1 и публичные exports T3 | Coding/test skills, `documentation`; AC4–AC5 | #26 |
| T5 | Проверенные пакет и документы интегрированы в `develop` | `merge`: T3/T4, PASS аудитов и актуальный CI | Координатор, `git-engineer`, `gh-utility`; refs/CI readback | #26 |

Общие contracts, dependency choices, lockfiles и migration artifacts меняются последовательно. S1/S2 используют согласованную native-связку; искусственного параллелизма на общей границе нет. Общая `acceptance` T3/T4 — real SQLite integration и неизменный consumer через exports; M1 имеет отдельный oracle ниже. `future-owner`: настоящий runtime связывает owners в I1 и проверяет state/queue/effect recovery в E3; эти результаты не входят в закрытие текущего инкремента, их точки подключения сохраняются в roadmap.

## Ограниченные спайки и CP1

Оба спайка используют `experiments/state/`: изолированные TypeScript-прототипы с собственными private manifest/lockfile, вне workspace `packages/*`, и временные каталоги БД. Новый workspace-пакет, production export, runtime scaffold или framework до CP1 не создаются. Точные dependency/SQLite ABI версии проверяются перед установкой по первичным источникам и фиксируются в evidence; native scripts допускаются узким `allowBuilds` для pnpm 10.34.5, не allow-all. Выбрать поддерживаемый lock binding по S2, не заранее. Исполнитель применяет `implementation-discipline`, `node-engineer`, `typescript-engineer`, `typescript-test-engineer`.

### S1 — async transaction, ORM/SQL и миграции

Вопрос: удерживает ли локальный `drizzle-orm/sqlite-proxy` bridge без HTTP требования R1–R11 при синхронном driver и mixed Drizzle/raw SQL? Drizzle уже принят; probe выбирает механизм интеграции, не ORM.

Метод: два недоменных fixture owners, BLOB round trip и fixed-vector insert/query/reopen. Через барьеры проверить awaited callback, посторонний запрос, consistent snapshot, stale revision, expired handle, запрет nested/owner commit и автоматического replay. Throw, error/conflict Result, принятая отмена/deadline и caught SQL auto-rollback не должны оставлять частичные writes; после фатального отказа scope не пишет, исходная ошибка безопасно отображается. Отдельная callback success/error проверка охватывает falsy payload. Подробные oracle — AC1 и R1–R9; fixture tables не задают будущую память.

На одной композиционной цепочке проверить Drizzle Kit generated SQL, custom `vec0` DDL и persisted data transform: fresh/upgrade/repeat/reopen, изменённую историю, incompatibility и failure без потери исходных данных (AC2). Применение явно предшествует нагрузке, импорт ничего не запускает. Не считать ORM migrator доказательством atomicity/history check; не передавать shadow tables неподтверждённому auto-diff. Журнал остаётся техническим, без универсального migration framework.

Успех — воспроизводимый совместный commit/rollback и совместимая цепочка после authoritative readback/reopen. Частичные writes, смешанный snapshot, потеря BLOB bytes, изменение истории или поздний SQL — failure механизма. Output: код/команды, точные версии, observations, falsifiers и ограничения. Evidence возвращается `architecture-engineer`/`spec-engineer` для CP1; при failure production остаётся blocked, Drizzle не исключается молча.

### S2 — lifecycle, сохранность и native-поставка

Вопрос: обеспечивает ли выбранная Linux-связка R12–R18, R20 и какие границы отмены/deadline подтверждены? Метод: реальные временные SQLite-файлы и child processes; effective WAL/FULL/FK после инициализации, competing writer/bounded busy, distinct safe errors busy/full/corrupt/incompatible/unavailable/cancel.

Проверить canonical directory/agentId и OS lock: два запуска, relative/symlink aliases, удержание lifecycle, kill/reacquire после остановки владельца, потерю storage/exclusivity и закрытие handles. PID/TTL/writer lock не разрешают takeover. Проверить реальные права directory/DB/WAL/SHM/backup/lock, trusted fixed extension load/version/ABI и отказ без fallback на успех. Это доверенный host-контур, не sandbox от доверенного principal и не проверка внешнего effect/process-group fencing runtime.

Для синхронного SQL измерить cooperative cancellation/deadline: `Promise.race` не доказывает остановку записи. После объявленной отмены позднего commit быть не должно; поздняя отмена не выдумывает rollback уже подтверждённого commit. Недостижимый предел возвращается на CP1 как named mechanism decision, без скрытого worker/scheduler.

Выполнить согласованный SQLite backup и restore в отдельный target с readback, сохранив источник. Обычное close ничего не удаляет. Не копировать только активный `.db` при WAL; это package-boundary recovery, не body rollback и не live snapshot двух БД. Проверить воспроизводимую native-установку локально и подготовить тот же контур для Ubuntu 24.04. Удалённый CI до разрешённого push/PR не заявляется выполненным.

Успех — один lifecycle owner, сохранённые данные и честные bounded/error outcomes AC3. Второй owner, ложный commit, небезопасная extension или неподтверждённый cancel — failure. Output: версии/ABI, команды и process/filesystem evidence, восстановленный target/readback, наблюдаемые ограничения. Возврат — архитектура/спецификация и CP1; physical power-loss и другие платформы не наследуют локальный успех.

### CP1 — hard stop перед production

Сохранить результаты спайков, полезные regression cases и evidence limits; уточнить architecture/ADR, spec и план. Предложить точные signatures/exports `readSnapshot`, `transact`, `checkSchema` и exclusivity: side-effect/native-free `./contracts`, нормализованный SQL/BLOB `./sqlite`, отдельный Node entrypoint. Зафиксировать migration unit/journal compatibility, revision carrier, Result/error/cancel semantics, lock binding и ограниченный M1 contour с тестовой альтернативой. Эти решения принимает оператор на CP1, не implementation-агент после него; новый production backend/driver/platform не выбирается.

После self-check и применимых gates сделать локальный commit и независимые аудиты изменённых sources и сохраняемого экспериментального кода. Дождаться помощников, проверить их terminal status и task-owned ресурсы. CP1 report содержит выполненный scope, Capability/Substrate/Anti-claims, `accepted now`, `not accepted`, `blocking decision`, checks/evidence и пропуски с причинами, ключевые решения с основаниями/последствиями либо их явное отсутствие, deviations и вопросы. Compact recovery ledger: время, task/source/artifact locators, repo/worktree/branch/full HEAD/base/upstream, ahead/behind и staged/unstaged/untracked status, tracking/publication/CI, последний принятый checkpoint/commit и evidence.

`next autonomous action: none` до явного согласования оператором контрактов и продолжения. До этого запрещены production-пакет, push ветки и PR; навигационные Issues уже разрешены. Других плановых операторских остановок нет; material blocker или failed gate останавливает только зависимую работу.

## Реализация, документация и общая проверка после CP1

T3 создаёт private ESM `@polyphony/state@0.0.0` с JS/declaration exports, реализует принятые scope/lifecycle/migration guarantees и воспроизводит AC1–AC3 через exports. Zod 4 проверяет реальные config/technical metadata и owner DTO; table schema не становится доменным контрактом автоматически. Общие primitives заранее не добавляются: только необходимая принятая зависимость расширяет `core-types` вместе с узкой spec/plan delta и аудитом; весь модуль этим не завершается.

- Общая проверка данных: consumer input → owner Zod/mapping → SQL/vector persistence → public DTO/readback → reopen, включая отрицательные S1/S2 и backup/restore. Моки не закрывают real SQLite evidence.
- **Отдельная приёмка M1 (AC4):** одинаковые public fixtures и неизменный consumer проходят при переключении SQLite-реализации на согласованную тестовую альтернативу через прежний порт, без private consumer changes. Это не co-commit двух owners; evidence не доказывает durability альтернативы, новую платформу или production backend. Реальные native/SQLite проверки остаются обязательными.
- Developer usage (AC5): одно `packages/state/docs/usage.md` с полным компилируемым и исполняемым примером через exports: open/migrate/close, snapshot, общая transaction, Result/cancel/deadline, свой Drizzle+Zod adapter, raw vector SQL/custom migration. Без snippet-extraction framework. Package README/AGENTS ссылаются на guide/spec/plan и команды, поясняя ownership и отсутствие sandbox-гарантии.

Переиспользовать tooling: Biome-only `format`/`format:check`; `lint` = Biome + ESLint + boundary checks; TypeScript 7 — единственный typecheck/emit, TS6 alias — только syntax-only ESLint API. Все обязательные package scripts присутствуют; `test` вызывает `test:integration`, чтобы root CI не пропускал SQLite. Проверить declarations/exports, импорт contracts без native side effects и отрицательные boundary cases. Локально выполнить `pnpm format`, frozen install, package/root `format:check`, `lint`, `typecheck`, `build`, `test`, scoped diff и `git diff --check`.

Обновить только затронутые roadmap/tooling/README и статус root AGENTS: при появлении `state` уточнить отсутствие именно agent runtime/domain modules, не менять методологию. Production guide выполняет `documentation`; source deltas — соответствующие architecture/spec/planning skills. Не превращать результаты в заявление о готовности I1/E3.

## Аудиты, поставка и открытые вопросы

Следовать [аудитам](../../development-methodology/audits.md), [agent policy](../../development-methodology/agent-policy.md), [качеству](../../development-methodology/quality.md) и [Git workflow](../../development-methodology/git-and-github.md). Независимые reviewers читают committed scoped snapshots без fork context, с явными model/reasoning по политике; каждый файл имеет указанный предмет покрытия:

- Concept — architecture/ADR/spec и изменённые tooling/root AGENTS.
- Spec — module plan, код, roadmap/README и соответствие usage docs контрактам.
- Security — код/config, включая сохраняемые probes, и документы с trust/data boundaries.

T0 audits предшествуют probes; CP1 audits проверяют evidence и предложенные contracts; после реализации проверяется её новый snapshot. Self-review и зелёный CI не заменяют аудит. Отрицательные отчёты сохраняются по установленным ID/путям; remediation — новый commit и delta того же пригодного reviewer. После трёх FAIL одного документа исследуется первопричина, а не повторяется точечная правка.

После approval CP1 уже согласованная поставка выполняется без нового permission gate: `git-engineer`/`gh-utility`, task push → PR в `develop` → обязательный актуальный CI на кандидате → merge → отдельный readback refs и послемержевого CI. `master` и теги не меняются. GitHub mutations подтверждаются отдельным чтением. Затем закрываются tracking и task-owned ресурсы; после проверки refs выполняется безопасная очистка завершённых task-ветки/worktree, `roadmap-bootstrap` сохраняется. Финал сообщает verified results/limits, PR/CI, branch/HEAD и оставленные ресурсы.

Открыты только вопросы механизмов S1/S2: async bridge/BLOB, migration compatibility/unit, cancel/error semantics и native ABI/lock binding; owner — оператор/architecture, условие закрытия — evidence и approval CP1. Production handoff до этого blocked. Native/runtime evidence пока отсутствует; создание плана его не заменяет.
