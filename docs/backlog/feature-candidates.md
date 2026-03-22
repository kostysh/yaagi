# Бэклог кандидатов в фичи

> Non-SSOT артефакт планирования, выведенный из `docs/architecture/system.md`.
> Здесь нельзя размещать текст критериев приёмки.
> В `docs/ssot/index.md` перечисляются только реальные досье, а не кандидаты `CF-*`.

## Рамка дискавери

- Дата дискавери: `2026-03-18`
- Дата архитектурного аудита: `2026-03-19`
- Источник истины для дискавери: `docs/architecture/system.md`
- Эвристика дискавери: кандидаты сгруппированы по швам поставки и фазам реализации, а не по каждой внутренней таблице или классу; после аудита `2026-03-19` backlog дополнительно закрывает platform/toolchain/deployment seams, которые архитектура считает обязательными с самого старта.
- Workflow-статусы сохранены в виде protocol tokens: `candidate`, `confirmed`, `intaken`, `discarded`.
- Рекомендуемый backbone для архитектурно корректного старта: `CF-020 -> CF-001 -> CF-002 -> CF-003 -> CF-004 -> CF-006 -> CF-017 -> CF-007`, затем `CF-005 -> CF-008 -> CF-018` как завершение phase 1.

## Кандидаты

| CF ID | Название | Область | Статус | Зависит от | Почему это отдельная фича | Досье |
|---|---|---|---|---|---|---|
| CF-001 | Конституционный контур запуска и восстановления | рантайм | intaken | - | Выбор режима старта, проверки здоровья зависимостей, откат к стабильному снапшоту и вход в recovery образуют один шов поставки (`4.2.1`, `9.1`, `9.5`). | [F-0001](../features/F-0001-constitutional-boot-recovery.md) |
| CF-002 | Тиковый runtime, scheduler и эпизодическая линия времени | рантайм | intaken | CF-001, CF-020 | Система становится "живой" только тогда, когда существуют тики, scheduler/lease discipline, эпизоды и одна субъективная линия времени (`3.1`, `3.2.A`, `4.2.2`, `9.2`, Phase 0). | [F-0003](../features/F-0003-tick-runtime-scheduler-episodic-timeline.md) |
| CF-003 | Ядро субъектного состояния и модель памяти | память | candidate | CF-001, CF-002 | PSM, goals, beliefs, entities, relationships и долговременное хранилище состояния образуют цельную capability ядра, а не набор разрозненных таблиц (`2.1`, `4.2.5`, `7.1`, `7.2`). | - |
| CF-004 | Буфер восприятия и сенсорные адаптеры | восприятие | candidate | CF-001, CF-002 | Нормализация входящего потока, буфер восприятия и первый набор адаптеров (`http`, `file`, `scheduler`, `resource`, `system`, опционально `telegram`) образуют отдельную входную подсистему (`4.2.3`, `8.1`, `9.2`). | - |
| CF-005 | Нарративный и меметический контур рассуждения | когниция | candidate | CF-002, CF-003, CF-004 | Memetic units, coalitions, narrative spine и field journal задают внутренний цикл конкуренции и непрерывности системы (`4.2.4`, `4.2.6`, `7.2`, Phase 1). | - |
| CF-006 | Базовый маршрутизатор моделей и профили органов | модели | candidate | CF-002, CF-020 | Базовая маршрутизация organ/profile и первый `reflex`/`deliberation` seam нужны уже на раннем runtime; external consultants остаются поздним policy-controlled расширением того же routing seam (`4.2.7`, `10.2`, `10.3`, Phases 0-1/6). | - |
| CF-007 | Исполнительный центр и ограниченный слой действий | действия | candidate | CF-004, CF-006, CF-017, CF-020 | Финальное утверждение действий, basic tools phase 0, постановка jobs и безопасные обёртки вокруг volumes, Git, HTTP и shell образуют одну операционную границу (`4.2.9`, `4.2.10`, `13.1`, `13.2`, `13.3`, Phase 0). | - |
| CF-008 | Гомеостат и операционные guardrails | управление | candidate | CF-003, CF-005, CF-007 | Мониторинг oscillation risk, continuity risk, development churn и автоматические реакции должны появиться как ранняя safety-capability, а не как часть позднего self-development scope (`4.2.11`, `15.4`, Phase 1). | - |
| CF-009 | HTTP API управления и интроспекции | API | candidate | CF-001, CF-002, CF-003, CF-004, CF-006, CF-010 | Operator-facing API для `state`, `timeline`, `episodes`, `models`, control routes и расширенной health/introspection отделяется от минимального ingress/health, который нужен раньше в platform/runtime backbone (`8.1`, `4.2.3`, `10.2`). | - |
| CF-010 | Расширенная модельная экология и здоровье реестра | модели | candidate | CF-006, CF-020 | Полный registry of organs, `vllm-deep`, `vllm-pool`, embeddings/reranking и health checks образуют отдельную phase-2 платформенную фичу; базовый `vllm-fast` и first profile принадлежат `CF-020`/`CF-006` (`3.2`, `10.1`, `10.2`, Phase 2). | - |
| CF-011 | Контур workshop для датасетов, обучения, оценки и promotion | workshop | candidate | CF-010 | Построение datasets, LoRA/QLoRA training, eval suites, регистрация кандидатов, promotion и rollback образуют один сквозной контур развития (`3.2.F`, `8.3`, `10.4`, `10.8`, Phase 3). | - |
| CF-012 | Git-управляемая эволюция тела и стабильные снапшоты | тело | candidate | CF-001, CF-007, CF-011, CF-016 | Автоматизация worktree, code change proposals, body eval suites, stable snapshots и boot rollback образуют один контролируемый поток самомодификации, который явно опирается на boot/recovery и governance контур; при этом worktree automation должна работать поверх materialized writable body, производного от immutable `seed`, а не мутировать tracked seed напрямую (`11.2`-`11.5`, Phase 5). | - |
| CF-013 | Слой skills и процедур | skills | candidate | CF-007 | Повторяемое know-how, packaging skills и procedural capabilities явно моделируются как отдельный слой и не должны быть спрятаны внутри generic tools; versioned skill seeds должны жить отдельно от runtime-generated skill outputs (`12.1`-`12.4`, Phase 2). | - |
| CF-014 | Профиль безопасности и изоляции | безопасность | candidate | CF-020, CF-007, CF-012, CF-016 | Safety kernel, secrets policy, restricted shell hardening, human override и stronger human gates формируют отдельный mature safety perimeter; базовая container/cell substrate вынесена в `CF-020` (`13.3`, `14.1`-`14.8`, Phase 6). | - |
| CF-015 | Наблюдаемость и диагностические отчёты | наблюдаемость | candidate | CF-002, CF-003, CF-007, CF-011, CF-018 | Метрики, логи, трассировки, отчёты о непрерывности идентичности и автоматические реакции формируют отдельную операторскую и recovery capability, зависящую от lifecycle/event backbone (`15.1`-`15.4`, Phase 6). | - |
| CF-016 | Development Governor и управление изменениями | управление | candidate | CF-006, CF-008, CF-011 | Improvement hypotheses, model adaptation proposals, specialist model birth proposals, code change proposals, rollout/rollback policy, freeze conditions и policy profiles образуют поздний governance seam, который логически предшествует автоматизированной body evolution, а не зависит от неё (`4.2.12`, `9.4`, `14.7`, Phases 3-6). | - |
| CF-017 | Context Builder и structured decision harness | когниция | candidate | CF-003, CF-004, CF-006 | Ранний Context Builder, Mastra Decision Agent и валидация структурированного решения образуют центральный cognitive harness основного тика уже в phase 0/1; этот seam должен идти после базового organ selection/router, а narrative и memetic inputs позже его расширяют (`4.2.3`, `4.2.8`, `9.2`, Phase 0). | - |
| CF-018 | Консолидация, event envelope и graceful shutdown | жизненный цикл | candidate | CF-002, CF-003, CF-005 | Consolidation cycle, retention/compaction policy, dataset/eval candidate preparation, единый event envelope и корректный graceful shutdown удерживают биографию, auditability и lifecycle consistency как отдельный seam (`7.5`, `8.6`, `9.3`, `9.6`). | - |
| CF-019 | Специализированные органы и политика вывода из эксплуатации | модели | candidate | CF-010, CF-011, CF-016 | Specialist model birth, organ registry expansion, staged rollout и retirement policy образуют phase-4 capability, отличную и от базовой model ecology, и от workshop pipeline (`10.6`, `10.7`, `10.8`, Phase 4). | - |
| CF-020 | Канонический scaffold монорепы и deployment cell | платформа | intaken | - | `pnpm` monorepo, `TypeScript + Mastra` scaffold, Docker Compose deployment cell, PostgreSQL + `pg-boss`, baseline volume/network policy, immutable `seed` initialization boundary, materialized writable runtime volumes, первый `vllm-fast` и выравнивание уже intaken boot/recovery dossier с реальным runtime substrate должны иметь явного раннего владельца; иначе стек, среда запуска и boot assumptions расползаются между несвязанными фичами (`3.1`, `3.2`, `5.1`, `6`, `14.2`-`14.5`, Phase 0). | [F-0002](../features/F-0002-canonical-monorepo-deployment-cell.md) |

## Архитектурный аудит покрытия (`2026-03-19`)

- Разделы `3.1`, `5.1`, `6`, `14.2`-`14.5` раньше не имели явного владельца в backlog; этот gap закрыт новым `CF-020`.
- Phase 0 теперь покрывается backbone `CF-020 -> CF-001 -> CF-002 -> CF-003 -> CF-004 -> CF-006 -> CF-017 -> CF-007`, а не только boot/tick/memory seams.
- `CF-006` перенастроен на ранний baseline organ routing; late external consultants остаются его phase-6 расширением, а не скрытым prerequisite.
- `CF-010` сужен до phase-2 local model ecology; базовый `vllm-fast` и первый organ profile больше не размазаны между несколькими поздними фичами.
- `CF-014` сужен до hardening/perimeter scope; базовая container/volume/network substrate больше не спрятана внутри поздней security-фичи.
- Volume policy больше не должна смешивать tracked seeds и runtime-generated state: архитектурный baseline теперь предполагает immutable `seed` и materialized writable runtime volumes.
- `CF-017` теперь явно следует после `CF-006`, потому что `9.2` требует `select model organs` до вызова `Mastra Decision Agent`.
- `CF-009` интерпретируется как operator-facing API поверх минимального ingress/health, чтобы HTTP surface не конфликтовал с ранним runtime backbone.
- `CF-018` подтверждён как владелец retention/event/graceful shutdown seam и точки стыка с dataset/eval candidate generation.
- После этой ревизии все обязательные архитектурные области из разделов `3`-`16` имеют явных владельцев среди `CF-*`; дальнейшее дробление должно происходить уже на `feature-intake`, а не из-за пропущенных seams.

## Рабочие решения после ревью

- `CF-005` на уровне discovery остаётся единым кандидатом; дробление memetics/narrative возможно позже на этапе shaping, если досье начнёт расползаться.
- `CF-014` остаётся отдельной cross-cutting фичей, но теперь покрывает именно hardening/perimeter, а не baseline deployment substrate.
- `CF-020` становится обязательным ранним владельцем platform scaffold/deployment cell; без него canonical stack и runtime environment начинают размываться уже на первом implementation cycle.
- Архитектурно корректный backbone phase 0/1: `CF-020 -> CF-001 -> CF-002 -> CF-003 -> CF-004 -> CF-006 -> CF-017 -> CF-007 -> CF-005 -> CF-008 -> CF-018`.

## Intake watchpoints

- `CF-005`: при `feature-intake` явно решить, остаются ли `memetics + narrative + field journal` в одном dossier, или их нужно разделить до `shaped`.
- `CF-006`: при `feature-intake` зафиксировать baseline `reflex`/`deliberation` scope и не втянуть внешних consultants раньше mature-governance phase.
- `CF-012`: при `feature-intake` явно закрепить, что body evolution и worktree automation работают против materialized writable body, а `/seed` остаётся immutable tracked source.
- `CF-013`: при `feature-intake` отделить versioned skill seeds от runtime-generated skill outputs и не складывать generated artifacts обратно в tracked seed tree.
- `CF-014`: при `feature-intake` держать hardening/perimeter scope отдельно от `CF-020`, где уже живут container/cell/networks/volumes baseline.
- `CF-020`: при `feature-intake` явно отделить уже существующий repo scaffold от недостающих частей deployment cell (`compose`, `postgres`, `pg-boss`, `vllm-fast`, seed/materialized volume policy), чтобы не дублировать уже выполненную работу.
- `CF-020`: в scope должен входить controlled `change-proposal` для `F-0001`, который перепривяжет boot/recovery к реальному dependency set, deployment cell и containerized startup path после реализации platform substrate, не превращая `CF-020` в переписывание boot logic с нуля.
- Для любого кандидата из этого списка intake считается завершённым только после явных секций `Scope` и `Out of scope` в новом dossier, а при архитектурной развилке — после ADR/shaping decision.

## Открытые вопросы

- Пока нет. Missing seams из текущего ревью переведены в явных владельцев `CF-*`; дальнейшее дробление имеет смысл решать уже на этапе `feature-intake` и `shaping`.
