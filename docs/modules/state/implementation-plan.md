# План имплементации модуля: `state`, первый инкремент

- Document ID: `state.plan`
- Module ID: `state`
- Дата: 2026-09-29.
- Статус: CP1 proposal; S1/S2 completed locally, CP1 pending approval; production coding blocked до явного согласования.
- Спецификация: [state.spec](specification.md); [локальное evidence S1/S2](../../../experiments/state/README.md).
- Источники: [архитектура §§2–6, 7.3, 8–10](../../architecture.md), [ADR-001](../../adr/ADR-001-module-boundaries.md), [ADR-002](../../adr/ADR-002-state-and-recovery.md); `state-first-increment.v3` с прямыми решениями оператора 2026-09-29 ограничить `state` хранением, принять встроенный `node:sqlite` и продолжить S1/S2.
- Рамочная Issue: [#26](https://github.com/kostysh/yaagi/issues/26); поведение snapshot/transaction/migration — [#27](https://github.com/kostysh/yaagi/issues/27), безопасность и сохранность SQLite — [#28](https://github.com/kostysh/yaagi/issues/28).
- Scope delta: narrowed относительно v3 — управление агентом исключено; общие доменные revisions/DTO не вводятся. Внутри этой границы оператор заменил драйвер на `node:sqlite DatabaseSync`; последствия — адаптация S1/S2 без отдельной сборки addon-драйвера. Текущая CP1 delta не меняет scope: фиксирует evidence и готовность, не принимает предложенные contracts. Новых обязанностей нет. Риск: high — persistent data, native extension и атомарность.

## Результат и границы

Цель T3/T4 после CP1: разработчик owner adapter и composition root получает проверенные `readSnapshot`, `transact`, `checkSchema` и открытие/закрытие соединений БД; согласованное чтение и общий commit нескольких владельцев сохраняются после reopen. Реальные SQLite/BLOB/vector проверки должны пройти через публичные exports. Самый прямой путь — один пакет с общими контрактами, техническим SQLite export и отдельным Node adapter для драйвера и файлов БД; фикстуры не требуют реализации соседних модулей. Сейчас выполнен локальный эксперимент, не этот production-пакет.

Capability — наблюдаемое поведение из AC1–AC5 спецификации. Substrate — документы, пакет, tooling и guide. Anti-claims: не реализуются runtime, memory/timeline/RAG, queue, универсальный repository, vector helpers или новые доменные схемы; I1/E3, двухбазовое recovery, physical power-loss и другие платформы не закрываются. M1 доказывает только проверенное контрактное поведение, не durability тестовой альтернативы или эквивалентность платформ.

Приняты встроенный `node:sqlite DatabaseSync`, Drizzle и `sqlite-vec`. Локально на Linux x64 проверены Node 24.21.0 / SQLite 3.53.4 / `sqlite-vec` 0.1.9 / Drizzle 0.45.3 / Drizzle Kit 0.31.11: зафиксированный прогон S1/S2 — 26 PASS, 0 failed/skipped. Ubuntu 24.04 remote CI ещё не запускался. Node API остаётся private частью Node adapter. Raw vector SQL обходит только ORM и остаётся операцией owner/fixture на том же scope/connection/transaction. Схемы, доменные revisions, DTO/validation/mapping, transformations и retrieval принадлежат владельцам. Fixture-owner проверяет свой конфликт, а `state` обеспечивает общий rollback; универсальных domain tokens/helpers не создаётся. Решения о тиках, model/network work и внешних действиях принимает вызывающий код/runtime.

Работа ведётся в `.worktree/state-sqlite`, `codex/state-sqlite`, исходный commit `6e341a889c3dceddf813b5dab867544e18d27c9f`. `roadmap-bootstrap` сохраняется. `.env` — read-only symlink; проверяются только его метаданные. Development prose и package README/AGENTS — русские; root README и repository-wide AGENTS — английские.

## Задачи и порядок интеграции

| ID | Проверяемый результат и источник | Готовность / зависимость | Следующий владелец / проверка | Tracking |
| --- | --- | --- | --- | --- |
| T0 | Architecture/ADR, `state.spec` и этот план согласованы с принятым `node:sqlite` в границах хранения | completed; Concept/Spec/Security PASS на `48430efcaa86873e47dfaf913d8dcdeb4293c66e` | Авторы sources и reviewers; новая CP1 delta аудируется отдельно | #26 |
| S1 | Evidence общего async scope и migration chain, AC1–AC2 / R1–R11, R15, R19 | completed locally после T0 PASS; production exports и schema-readiness wiring ещё не реализованы | `node-engineer` + TypeScript/test skills → авторы sources/CP1; evidence ниже | #27 |
| S2 | Evidence ошибок хранения, сохранности и native-связки, AC3 / R12, R14–R18, R20 | completed locally после T0 PASS; remote CI не выполнен | `node-engineer` + TypeScript/test skills → авторы sources/CP1; evidence ниже | #28 |
| CP1 | Evidence возвращено в sources; точные contracts и acceptance предложены оператору | pending approval; `start`: S1/S2 evidence получено, применимые аудиты нового committed snapshot ещё требуются | Авторы sources и независимые reviewers; затем оператор и hard stop | #26 |
| T3 | Принятые гарантии хранения реализованы в `@polyphony/state` | blocked; `start`: явное approval CP1 и принятая спецификация | Coding с `implementation-discipline`, `node-engineer`, `typescript-engineer`, `typescript-test-engineer`; AC1–AC3 | #27, #28 |
| T4 | Отдельный M1 replacement prototype и исполняемый guide доступны потребителю | blocked; `start`: CP1 и публичные exports T3 | Coding/test skills, `documentation`; AC4–AC5 | #26 |
| T5 | Проверенные пакет и документы интегрированы в `develop` | `merge`: T3/T4, PASS аудитов и актуальный CI | Координатор, `git-engineer`, `gh-utility`; refs/CI readback | #26 |

Общие contracts, dependency choices, lockfiles и migration artifacts меняются последовательно. S1/S2 используют согласованную native-связку; искусственного параллелизма на общей границе нет. Общая `acceptance` T3/T4 — real SQLite integration и неизменный consumer через exports; M1 имеет отдельный oracle ниже. `future-owner`: будущий runtime отвечает за единственность своего инстанса, связывает owners в I1 и проверяет state/queue/effect recovery в E3. Механизм управления агентом сейчас не выбирается; эти результаты не входят в закрытие `state`, точки интеграции сохраняются в roadmap.

## Ограниченные спайки и CP1

S1/S2 выполнены после T0 PASS в прежнем `experiments/state/`: изолированные TypeScript-прототипы с собственными private manifest/lockfile, вне workspace `packages/*`, и временные каталоги БД. Новый спайк, workspace-пакет, production export, runtime scaffold или framework до CP1 не создаются. Точные версии, команды и ограничения сохранены в evidence. `node:sqlite` входит в Node; отдельные addon-драйвер и его native build не добавляются. Проверен фиксированный prebuilt `sqlite-vec`; для оставшихся build scripts Drizzle Kit сохранён узкий `allowBuilds` только точных esbuild-версий, без blanket-разрешения. Исполнитель применяет `implementation-discipline`, `node-engineer`, `typescript-engineer`, `typescript-test-engineer`. Следующие briefs сохраняют проверенные oracle для регрессии, а не назначают новые спайки.

### S1 — async transaction, ORM/SQL и миграции

Вопрос подключения Drizzle к синхронному `node:sqlite DatabaseSync` проверен локальным `drizzle-orm/sqlite-proxy` bridge без HTTP: mixed Drizzle/raw SQL использует один scope/connection/transaction через awaited callback. Выбор ORM и драйвера уже принят; проверенный механизм и точный контракт предложены на CP1. BLOB round trip сохраняет байты; `number` связывается как REAL, `bigint` как INTEGER — для `vec0.rowid`/`k` нужен bigint. Numeric/DTO mapping остаётся у owner; нормализация технического SQL boundary предложена в spec. Node API не выходит в общий контракт.

Метод: два недоменных fixture owners, BLOB round trip и fixed-vector insert/query/reopen. Через барьеры проверить awaited callback, посторонний запрос, consistent snapshot, конфликт revision в fixture-owner, expired handle, запрет nested/owner commit и автоматического replay. Throw, error/conflict Result, принятая отмена/deadline и caught SQL auto-rollback не должны оставлять частичные writes; после фатального отказа scope не пишет, исходная ошибка безопасно отображается. Snapshot завершается до возврата результата callback вызывающему коду; DTO mapping остаётся у fixture-owner, последующая работа — у потребителя. Отдельная callback success/error проверка охватывает falsy payload. Подробные oracle — AC1 и R1–R9; fixture tables не задают будущую память.

На одной композиционной цепочке проверить Drizzle Kit generated SQL, custom `vec0` DDL и persisted data transform: fresh/upgrade/repeat/reopen, изменённую историю, incompatibility и failure без потери исходных данных (AC2). Применение явно предшествует нагрузке, импорт ничего не запускает. Не считать ORM migrator доказательством atomicity/history check; не передавать shadow tables неподтверждённому auto-diff. Журнал остаётся техническим, без универсального migration framework.

Локальный результат: совместный commit/rollback, consistent snapshot и совместимая цепочка подтверждены authoritative readback/reopen; код/команды и ограничения возвращены `architecture-engineer`/`spec-engineer` для CP1. Частичные writes, смешанный snapshot, потеря BLOB bytes, изменение истории или поздний SQL остаются falsifiers. Миграции прототип вызывает явно до `ProbeStore`; production open/check/apply readiness и import/export map ещё проверяются в T3, поэтому весь AC1–AC2/R19 не объявляется закрытым экспериментом.

### S2 — безопасность хранения, сохранность и native-поставка

Вопрос: обеспечивает ли принятая связка Node/SQLite с prebuilt extension на Linux R12, R14–R18, R20 и какие границы отмены/deadline подтверждены? Метод: реальные временные SQLite-файлы и child processes только для конкуренции writers и прерывания процесса записи; effective WAL/FULL/FK после инициализации, bounded busy, distinct safe errors busy/full/corrupt/incompatible/unavailable/cancel.

Проверить закрытие соединений и отказ дальнейших операций на непригодном/закрытом connection, сохранность подтверждённых записей после сбоя и reopen. Проверить реальные права directory/DB/WAL/SHM/backup, trusted fixed extension load/version/ABI и отказ без fallback на успех. Это проверки хранения на доверенном host, не политика запуска агентов и не sandbox от доверенного principal. По ошибке хранения решение о дальнейшей работе принимает вызывающий код.

Promise-обёртка не делает SQL `DatabaseSync` асинхронным или неблокирующим; `Promise.race` не доказывает остановку записи. Измерена cooperative cancellation: в зафиксированном прогоне SQL занял около 207 мс при `timeoutMs: 20`, затем обнаружен deadline и выполнен rollback до commit. JS timer не прерывает SQL; зависший callback также не прерывается автоматически. После объявленной отмены позднего commit быть не должно; поздняя отмена не выдумывает rollback уже успешного commit. Эта граница, а не hard deadline, предложена на CP1; worker/scheduler не добавляется.

Выполнить согласованный SQLite backup и restore в отдельный target с readback, сохранив источник. Обычное close ничего не удаляет. Не копировать только активный `.db` при WAL; это package-boundary recovery, не body rollback и не live snapshot двух БД. Проверить воспроизводимую установку зависимостей и загрузку prebuilt extension в принятом Node локально и подготовить тот же контур для Ubuntu 24.04. Удалённый CI до разрешённого push/PR не заявляется выполненным.

Локальный результат: проверены storage faults, конкуренция writers, process crash/reopen, права, extension load/failure и backup/restore с сохранением источника; evidence возвращено в архитектуру/спецификацию и CP1. Потеря подтверждённой записи, ложный commit, запись через непригодное соединение, небезопасная extension или неподтверждённый cancel остаются falsifiers. Это не remote CI, production-приёмка, physical power-loss или evidence других платформ.

### CP1 — hard stop перед production

Результаты спайков, полезные regression cases и evidence limits сохранены; architecture/ADR, spec и план уточнены. [Точное предложение CP1](specification.md#предложение-контракта-на-cp1) содержит signatures/exports `readSnapshot`, `transact`, `checkSchema` и операций соединения БД: side-effect/native-free `./contracts`, нормализованный SQL/BLOB `./sqlite`, отдельный Node entrypoint для драйвера/файлов. Там же предложены migration unit/journal compatibility, Result/error/cancel semantics и ограниченный M1 contour с test-only альтернативой. Общий domain revision API и валидация owner DTO в контракт `state` не входят. Предложение не принято: эти решения принимает оператор на CP1, не implementation-агент после него; новый production backend/driver/platform не выбирается.

После self-check и применимых gates сделать локальный commit и независимые аудиты изменённых sources и сохраняемого экспериментального кода. Дождаться помощников, проверить их terminal status и task-owned ресурсы. CP1 report содержит выполненный scope, Capability/Substrate/Anti-claims, `accepted now`, `not accepted`, `blocking decision`, checks/evidence и пропуски с причинами, ключевые решения с основаниями/последствиями либо их явное отсутствие, deviations и вопросы. Compact recovery ledger: время, task/source/artifact locators, repo/worktree/branch/full HEAD/base/upstream, ahead/behind и staged/unstaged/untracked status, tracking/publication/CI, последний принятый checkpoint/commit и evidence.

На CP1 `next autonomous action: none` до явного согласования оператором контрактов и продолжения. До этого запрещены production-пакет, push ветки и PR. Разрешение «Продолжай» относилось к выполненным S1/S2 и не отменяет CP1. Material blocker или failed gate останавливает только зависимую работу.

## Реализация, документация и общая проверка после CP1

T3 создаёт private ESM `@polyphony/state@0.0.0` с JS/declaration exports, реализует принятые connection/scope/migration guarantees и воспроизводит AC1–AC3 через exports. В `state` Zod 4 проверяет реально необходимые config/technical metadata; owner DTO и их validation/mapping остаются в fixture-owner. Table schema не становится доменным контрактом автоматически. Общие primitives заранее не добавляются: только необходимая принятая зависимость расширяет `core-types` вместе с узкой spec/plan delta и аудитом; весь модуль этим не завершается.

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

T0 delta audits смены драйвера завершены PASS на указанном snapshot. Неизменённые принятые границы хранения повторно не проектируются; этот PASS не покрывает новую CP1 delta. CP1 audits проверяют evidence, сохраняемый экспериментальный код и предложенные contracts; после реализации проверяется её новый snapshot. Self-review и зелёный CI не заменяют аудит. Отрицательные отчёты сохраняются по установленным ID/путям; remediation — новый commit и delta того же пригодного reviewer. После трёх FAIL одного документа исследуется первопричина, а не повторяется точечная правка.

После approval CP1 уже согласованная поставка выполняется без нового permission gate: `git-engineer`/`gh-utility`, task push → PR в `develop` → обязательный актуальный CI на кандидате → merge → отдельный readback refs и послемержевого CI. `master` и теги не меняются. GitHub mutations подтверждаются отдельным чтением. Затем закрываются tracking и task-owned ресурсы; после проверки refs выполняется безопасная очистка завершённых task-ветки/worktree, `roadmap-bootstrap` сохраняется. Финал сообщает verified results/limits, PR/CI, branch/HEAD и оставленные ресурсы.

Открыто согласование оператором предложенных signatures, SQL/BLOB/numeric normalization, migration compatibility/unit, error/cooperative cancellation semantics и ограниченного M1 contour; механизм опирается на выполненные S1/S2, не на непроверенную совместимость драйвера/extension. После применимых аудитов CP1 production handoff остаётся blocked до явного approval. M1, публичный production-пакет и его schema-readiness wiring, исполняемый guide и remote Ubuntu CI ещё не выполнены; локальный эксперимент их не заменяет.
