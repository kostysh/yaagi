# Бэклог кандидатов в фичи

> Non-SSOT артефакт планирования, выведенный из `docs/architecture/system.md`.
> Здесь нельзя размещать текст критериев приёмки.
> В `docs/ssot/index.md` перечисляются только реальные досье, а не кандидаты `CF-*`.

## Рамка дискавери

- Дата дискавери: `2026-03-18`
- Источник истины для дискавери: `docs/architecture/system.md`
- Эвристика дискавери: кандидаты сгруппированы по швам поставки и фазам реализации, а не по каждой внутренней таблице или классу.
- Workflow-статусы сохранены в виде protocol tokens: `candidate`, `confirmed`, `intaken`, `discarded`.
- Рекомендуемый backbone для первого intake: `CF-001 -> CF-002 -> CF-003 -> CF-004 -> CF-017`, затем остальные фичи фазы 1.

## Кандидаты

| CF ID | Название | Область | Статус | Зависит от | Почему это отдельная фича | Досье |
|---|---|---|---|---|---|---|
| CF-001 | Конституционный контур запуска и восстановления | рантайм | candidate | - | Выбор режима старта, проверки здоровья зависимостей, откат к стабильному снапшоту и вход в recovery образуют один шов поставки (`4.2.1`, `9.1`, `9.5`). | - |
| CF-002 | Тиковый runtime и эпизодическая линия времени | рантайм | candidate | CF-001 | Система становится "живой" только тогда, когда существуют тики, эпизоды и одна субъективная линия времени (`3.2.A`, `4.2.2`, `9.2`, Phase 0). | - |
| CF-003 | Ядро субъектного состояния и модель памяти | память | candidate | CF-001, CF-002 | PSM, goals, beliefs, entities, relationships и долговременное хранилище состояния образуют цельную capability ядра, а не набор разрозненных таблиц (`2.1`, `4.2.5`, `7.1`, `7.2`). | - |
| CF-004 | Буфер восприятия и сенсорные адаптеры | восприятие | candidate | CF-001, CF-002 | Нормализация входящего потока, буфер восприятия и первый набор адаптеров (`http`, `file`, `scheduler`, `resource`, `system`, опционально `telegram`) образуют отдельную входную подсистему (`4.2.3`, `8.1`, `9.2`). | - |
| CF-005 | Нарративный и меметический контур рассуждения | когниция | candidate | CF-002, CF-003, CF-004 | Memetic units, coalitions, narrative spine и field journal задают внутренний цикл конкуренции и непрерывности системы (`4.2.4`, `4.2.6`, `7.2`, Phase 1). | - |
| CF-006 | Маршрутизатор моделей, профили органов и внешние консультанты | модели | candidate | CF-002 | Базовая маршрутизация organ/profile нужна уже на раннем runtime, а policy-controlled допуск внешнего consultant является поздним расширением того же routing seam, а не отдельной базовой фазой (`4.2.7`, `10.2`, `10.3`, Phase 6). | - |
| CF-007 | Исполнительный центр и ограниченный слой действий | действия | candidate | CF-004, CF-006, CF-017 | Финальное утверждение действий, вызовы инструментов, постановка jobs и безопасные обёртки вокруг volumes, Git, HTTP и shell образуют одну операционную границу (`4.2.9`, `4.2.10`, `13.1`, `13.2`, `13.3`). | - |
| CF-008 | Гомеостат и операционные guardrails | управление | candidate | CF-003, CF-005, CF-007 | Мониторинг oscillation risk, continuity risk, development churn и автоматические реакции должны появиться как ранняя safety-capability, а не как часть позднего self-development scope (`4.2.11`, `15.4`, Phase 1). | - |
| CF-009 | HTTP API управления и интроспекции | API | candidate | CF-001, CF-002, CF-003, CF-004, CF-010 | Внешняя API-поверхность для `ingest`, `state`, `timeline`, `episodes`, `models` и health-эндпоинтов опирается и на perception layer, и на model registry/organ health, поэтому это отдельная operator-facing boundary со своими зависимостями (`8.1`, `4.2.3`, `7.2`, `10.2`). | - |
| CF-010 | Локальная модельная экология и здоровье реестра | модели | candidate | CF-006 | Запуск `vllm-fast`, `vllm-deep`, `vllm-pool`, реестра профилей и health checks органов образует отдельную платформенную фичу, отличную от верхнеуровневой когниции (`3.2`, `10.1`, `10.2`, Phase 2). | - |
| CF-011 | Контур workshop для датасетов, обучения, оценки и promotion | workshop | candidate | CF-010 | Построение datasets, LoRA/QLoRA training, eval suites, регистрация кандидатов, promotion и rollback образуют один сквозной контур развития (`3.2.F`, `8.3`, `10.4`, `10.8`, Phase 3). | - |
| CF-012 | Git-управляемая эволюция тела и стабильные снапшоты | тело | candidate | CF-001, CF-007, CF-011, CF-016 | Автоматизация worktree, code change proposals, body eval suites, stable snapshots и boot rollback образуют один контролируемый поток самомодификации, который явно опирается на boot/recovery и governance контур (`11.2`-`11.5`, Phase 5). | - |
| CF-013 | Слой skills и процедур | skills | candidate | CF-007 | Повторяемое know-how, packaging skills и procedural capabilities явно моделируются как отдельный слой и не должны быть спрятаны внутри generic tools (`12.1`-`12.4`, Phase 2). | - |
| CF-014 | Профиль безопасности и изоляции | безопасность | candidate | CF-001, CF-007 | Контейнерные лимиты, политика для volumes, обращение с secret'ами, restricted shell, human override и поздние stronger human gates формируют отдельный cross-cutting safety perimeter (`13.3`, `14.1`-`14.8`, Phase 6). | - |
| CF-015 | Наблюдаемость и диагностические отчёты | наблюдаемость | candidate | CF-002, CF-003, CF-007, CF-011, CF-018 | Метрики, логи, трассировки, отчёты о непрерывности идентичности и автоматические реакции формируют отдельную операторскую и recovery capability, зависящую от lifecycle/event backbone (`15.1`-`15.4`, Phase 6). | - |
| CF-016 | Development Governor и управление изменениями | управление | candidate | CF-006, CF-008, CF-011 | Improvement hypotheses, model adaptation proposals, specialist model birth proposals, code change proposals, rollout/rollback policy, freeze conditions и policy profiles образуют поздний governance seam, который логически предшествует автоматизированной body evolution, а не зависит от неё (`4.2.12`, `9.4`, `14.7`, Phases 3-6). | - |
| CF-017 | Context Builder и structured decision harness | когниция | candidate | CF-003, CF-004 | Ранний Context Builder, Mastra Decision Agent и валидация структурированного решения образуют центральный cognitive harness основного тика уже в phase 0/1; narrative, memetic inputs и model router позже расширяют этот же seam, но не являются prerequisite для первого intake (`4.2.3`, `4.2.8`, `9.2`, Phase 0). | - |
| CF-018 | Консолидация, event envelope и graceful shutdown | жизненный цикл | candidate | CF-002, CF-003, CF-005 | Consolidation cycle, retention/compaction policy, единый event envelope и корректный graceful shutdown удерживают биографию, auditability и lifecycle consistency как отдельный seam (`7.5`, `8.6`, `9.3`, `9.6`). | - |
| CF-019 | Специализированные органы и политика вывода из эксплуатации | модели | candidate | CF-010, CF-011, CF-016 | Specialist model birth, organ registry expansion, staged rollout и retirement policy образуют phase-4 capability, отличную и от базовой model ecology, и от workshop pipeline (`10.6`, `10.7`, `10.8`, Phase 4). | - |

## Рабочие решения после ревью

- `CF-005` на уровне discovery остаётся единым кандидатом; дробление memetics/narrative возможно позже на этапе shaping, если досье начнёт расползаться.
- `CF-014` остаётся отдельной cross-cutting фичей, а не распыляется по runtime/action/workshop как набор несвязанных NFR.
- Первый intake рекомендуется вести по фазовому backbone core-а: `CF-001 -> CF-002 -> CF-003 -> CF-004 -> CF-017`, а не от операторского API.

## Intake watchpoints

- `CF-005`: при `feature-intake` явно решить, остаются ли `memetics + narrative + field journal` в одном dossier, или их нужно разделить до `shaped`.
- `CF-006`: при `feature-intake` зафиксировать, что базовый model routing входит в первый dossier, а external consultants остаются поздним расширением, если не выбраны в явный scope.
- `CF-014`: при `feature-intake` отделить собственный scope safety perimeter от ссылочных NFR и зависимостей других фич.
- Для любого кандидата из этого списка intake считается завершённым только после явных секций `Scope` и `Out of scope` в новом dossier, а при архитектурной развилке — после ADR/shaping decision.

## Открытые вопросы

- Пока нет. Missing seams из текущего ревью переведены в явных владельцев `CF-*`; дальнейшее дробление имеет смысл решать уже на этапе `feature-intake` и `shaping`.
