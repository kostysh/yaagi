# План имплементации модуля: `timeline`

- Document ID: `timeline.plan`
- Module ID: `timeline`
- Статус: draft T1, к принятию в CP1; текущая работа ограничена документами.
- Спецификация: [timeline.spec](specification.md), требования T1-R1–R14; точные DTO и операции принадлежат спецификации.
- Архитектура: [модуль и зависимости](../../architecture.md#3-модули-состояние-и-публичные-операции), [контракты](../../architecture.md#4-контракты-обмена), [состояние и recovery](../../architecture.md#5-единство-состояния-и-полный-тик), [M1](../../architecture.md#10-приёмочные-сценарии-и-evidence); ADR-001–003 по ссылкам спецификации.
- Системный дизайн: [F1/F3/F4/F8](../../system-design.md#3-сквозные-потоки), [I1–I3](../../system-design.md#5-поэтапная-сборка).
- Рамочная Issue: [#47](https://github.com/kostysh/yaagi/issues/47).
- Основание checkpoints: принятый оператором `timeline-47.plan.v1.1@dc312c0`; исходная база — `dc312c0e611184f0181a61633ae2527e7c31eb6f`.

## Целевой результат и границы

**Capability T1:** доверенный consumer через публичный порт резервирует тик, сохраняет допустимые фазы и после reopen читает прежние frame/refs, interrupted attempt и монотонную последовательность. **Substrate:** пакет, owner migrations, contracts, guide и evidence. **Anti-claims:** T1 не доказывает runtime, существование foreign records, совместную атомарность I1 или recovery E3.

Scope — unchanged; полный объём #47 остаётся в тех же spec/plan. Инкрементность разрешена §5 системного дизайна. Прямое решение — scoped owner binding через готовый `state`, общая каноническая SQLite и локальные схемы/Drizzle mapping. Отдельные БД, clock/scheduler, runtime, generic repository или verification harness не добавляются. Риск высокий: переходы, миграции и recovery могут исказить историю.

## Задачи T1

Работа последовательна: общая граница ещё согласуется. Новые Issues, реестры и отдельный документ очевидного алгоритма не нужны.

| ID | Проверяемый результат | Зависит от | Параллельная группа | Проверка | Sub-issue |
| --- | --- | --- | --- | --- | --- |
| P1 | Проверенные spec/plan и согласованные статусные документы | Принятые owning sources | — | CP1 | — |
| P2 | Production T1-R1–R14, SQLite round trip, M1 и guide | `start`: принятие P1 и доступный нужный поднабор #45; готовый state #30 | — | CP2 | — |
| P3 | Интегрированный T1 с точным evidence | `start`: принятие P2 и разрешение публикации; `merge`: gates и разрешение merge | — | CP3 | — |

## Checkpoints и навыки

`implementation-discipline` применяется сквозным образом; остальные skills читаются перед соответствующей работой. Изменения — только в task-ветке/worktree с read-only `.env` symlink по [Git workflow](../../development-methodology/git-and-github.md). Независимость, модель, reasoning и завершение помощников — по [agent policy](../../development-methodology/agent-policy.md).

### CP1 — принятие документов

- **Результат:** P1; spec/plan остаются draft до принятия. Зафиксировать потребность #45 и границу совместного mapping #49. Узко синхронизировать roadmap, README/AGENTS baseline, навигацию system-design и фактический статус принятого C1 в constitution.spec/constitution.plan, не меняя их требований. Skills: `spec-engineer`, `delivery-planner`, `documentation`, `git-engineer`, `gh-utility`.
- **Проверки:** self-check источников, scope, ссылок, языка и синхронизации; `git diff --check`; локальный audit commit без push. Код не меняется, code checks относятся к CP2. `concept-conformance-reviewer` — timeline.spec, изменённые system-design/AGENTS и статус constitution.spec; `spec-conformance-reviewer` — timeline.plan/roadmap/README и статус constitution.plan; `security-reviewer` — trust/persisted границы timeline.spec. Покрытие всех изменённых документов явно указать в audit packet, группируя связанные файлы без отдельного аудита на каждый.
- **Принятие:** PASS всех применимых checks/audits на точном предъявленном commit и принятие документов оператором. Это не принятие кода или публикации.
- **Следующее действие:** `none` до принятия; P2 начинается только после готовности его start-зависимостей. До readiness #47 остаётся `Backlog`; затем `Ready → In progress`. Подготовка документов не объявляет код готовым к реализации.

### CP2 — готовность T1 к публикации

- **Результат:** P2: TypeScript/ESM, portable side-effect-free `./contracts` без SQL/Node/native/I/O, domain DTO у timeline и отдельный SQLite entrypoint. Публичный consumer использует один переданный scope, без nested transaction; durable результат подтверждает внешний state Result. Guide — `packages/timeline/docs/usage.md`, evidence — `docs/validation/timeline/`. Skills: `typescript-engineer`, `node-engineer`, `typescript-test-engineer`, `documentation`, `git-engineer`, `gh-utility`.
- **Проверки:** общий gate ниже. Синхронизировать документы **до финального стабильного audit commit**: spec/plan, roadmap со статусом T1 «На приёмке», guide/README/evidence и остальные изменённые файлы. `spec-conformance-reviewer` покрывает код/план/roadmap/guide/README/evidence и затронутый статус constitution.plan; `concept-conformance-reviewer` — изменённые spec/design/AGENTS, включая constitution.spec при изменении; `security-reviewer` — код и применимые trust-документы. Неизменённый ранее проверенный scope не аудировать заново.
- **Принятие:** PASS всех применимых checks/audits на точном предъявленном commit и принятие T1 оператором. Отрицательные отчёты сохранять; remediation и material delta проверять по [политике аудитов](../../development-methodology/audits.md).
- **Следующее действие:** до принятия — `none`; после него публикация при применимом разрешении #47, иначе `none`. Разрешения #46 не переносятся; уже выданное применимое согласие #47 повторно не запрашивается.

### CP3 — итоговая сдача T1

- **Результат:** P3; PR в `develop` с нейтральной ссылкой #47 без `Closes`, статус `In review`. Публикация и merge требуют соответствующих разрешений; одно не подразумевает другое. Skills: `git-engineer`, `gh-utility`, `documentation`; исправления CI — затронутые инженерные/reviewer skills.
- **Проверки:** exact PR head, актуальные аудиты/CI и полный pre-merge gate; разрешённый merge, сверка integrated commit/refs, полный post-merge CI на merge SHA. Каждую GitHub mutation подтвердить отдельным чтением. После проверки refs удалить только завершённые task-worktree/ветку; незавершённое или явно сохраняемое перечислить в отчёте.
- **Принятие:** оператор принимает интегрированный T1/evidence, не всю #47. Post-merge evidence — в Issue/отчёте; roadmap становится «Интегрирован» при следующем штатном проверенном обновлении, без неревьюированной post-merge правки.
- **Следующее действие:** `none`. #47 остаётся открытой и возвращается в `Backlog` для остальных инкрементов; `Ready` требует их принятых документов и входов. `Blocked` — конкретное внешнее препятствие с условием снятия, `Done` — принятие всего scope.

Каждый CP завершается одним отчётом и hard stop по `Checkpoint Execution Contract` глобального `PLANS.md`: scope/result, Capability/Substrate/Anti-claims, `accepted now`/`not accepted`, checks/evidence и пропуски с причиной, решения с основаниями и downstream последствиями, deviations/вопросы, `blocking decision` с owner/locator/условием снятия, `next autonomous action`. При отсутствии решений написать это явно. Recovery ledger в том же сообщении: timestamp, Issue/artifact/source, repo/workspace/branch/worktree, exact HEAD/base/upstream, ahead/behind, staged/unstaged/untracked, tracking/publication/CI states и locators, последний принятый CP/commit, evidence и следующий разрешённый шаг. Перед отчётом проверить помощников/task-ресурсы; при продолжении перечитать перечисленные mutable surfaces и объяснить расхождения. Отдельный реестр не создаётся.

## Порядок интеграции и дальнейшие инкременты

- **#45 → P2, `start`:** запрос T1 — `AgentId`, `TickId`, `ActionId`, opaque `Revision`, `EvidenceRef`, различимые wall time/elapsed duration в миллисекундах. Точные definitions/validators и имена exports принадлежат [core-types](../core-types/specification.md), сейчас доступен только `Result`. Сначала владелец #45 принимает и реализует нужный поднабор; timeline проверяет канонический контракт и его доступность, не создаёт shadow primitives. Реализация #45 не включена автоматически в #47; закрытия всей #45 ждать не нужно. Несовместимость возвращается на согласование до зависимого кода.
- **#49 → совместный mapping, `start`:** runtime владеет согласованием policy/snapshot/foreign refs и commit/reconcile projections. Его отсутствие не блокирует P1 или независимое поведение T1, но запрещает объявлять общий mapping готовым. Runtime API или implementation внутри timeline не создаются.
- **T1 → I1 #50, `acceptance` сборки:** реальные state/constitution/timeline/memory #48/root #49 проверяют общий commit/rollback и restart на одной канонической БД. Технические refs и consumer T1 этого не доказывают; результат возвращается в #47 и #50 как evidence именно проверенного состава.
- **I2/E3, `future-owner`:** при подключении реальных решений/действий runtime #49 и executive согласуют mapping и recovery, а #63/#64 проверяют persisted фазы, commit/effect windows, unknown и отсутствие replay. До допуска действий требуется E3 соответствующего состава. Timeline сохраняет свои фазы и readback, не получает OS lock или dispatch.
- **I3, `future-owner`:** при подключении homeostasis #65 и сборки #66 уточнить в тех же spec/plan вход Regulation и согласованное применение режима root. Самостоятельный scheduler, новые operational thresholds или будущие DTO сейчас не проектируются.

## Общая проверка модуля

- **Поведение:** T1-R1–R14 через production exports; вход → validation → owner mapping → реальная SQLite через state → public readback → detached DTO → reopen. Конкурирующие reservation, повтор/неверный переход/stale revision, rollback, interrupted/decided recovery, invalid persisted data, точные refs/time/tokens и immutability. Owner success внутри callback не подменяет внешний commit; неоднозначность разрешается readback без replay.
- **Хранение:** реальные immutable release SQL artifacts; fresh/repeat/failure, upgrade при реальном schema delta; загрузка из собранного entrypoint без зависимости от cwd. Параметризованный SQL, общий scope, close до cleanup. Проверить совместимость body rollback без стирания истории; не переоткрывать state без конкретной несовместимости.
- **M1 и gates:** неизменный consumer и одинаковые scenarios production-порта/совместимого test-only double; graph/exports/declarations/negative type fixtures, выполняемый main/error/recovery guide. Double не заменяет реальную БД. Package/consumer `format:check`, `lint`, `typecheck`, `build`, `test`, `test:integration`, `git diff --check`; полный root/merge набор по [quality](../../development-methodology/quality.md). Пропущенное не считать PASS.
- **Документы:** русский язык разработки, английские root README/AGENTS; синхронизация и статусы по [правилам документации](../../development-methodology/documentation.md#минимальная-синхронизация). Guide и evidence сообщают границы T1, а не готовность I1/E3.

## Открытые вопросы и readiness

CP1 ещё не принят. Код T1 блокируют принятие документов и принятый доступный поднабор #45; владелец #45 возвращает exact contract/implementation evidence. Общий mapping остаётся у #49 до реальной интеграции #50. Эти зависимости не являются разрешением изменить C1, расширить runtime или начать CP2. Будущие инкременты уточняются при названных triggers с сохранением полного scope #47.
