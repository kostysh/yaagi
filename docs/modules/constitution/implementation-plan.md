# План имплементации модуля: `constitution`

- Document ID: `constitution.plan`
- Module ID: `constitution`
- Статус: draft — checkpoint 1, ожидаются независимые аудиты и принятие оператором; код не разрешён этим статусом.
- Спецификация: [constitution.spec](specification.md), текущий инкремент C1; точные DTO и требования C1-R1–R11 остаются в спецификации.
- Архитектура: [модуль и зависимости](../../architecture.md#3-модули-состояние-и-публичные-операции), [контракты](../../architecture.md#4-контракты-обмена), [boot](../../architecture.md#53-ошибки-единственный-исполнитель-и-восстановление), [границы полномочий](../../architecture.md#7-развитие-физиология-и-границы-доверия); ADR-001/003 по ссылкам спецификации.
- Системный дизайн: [F1–F4/F7–F8](../../system-design.md#3-сквозные-потоки), [I1–I4](../../system-design.md#5-поэтапная-сборка).
- Рамочная Issue: [#46](https://github.com/kostysh/yaagi/issues/46).
- Основание checkpoints: принятый `constitution-46.plan.v1.3@5f48c206` в истории задачи; точные документы ещё требуют принятия.

## Целевой результат и границы

**Capability C1:** доверенный root получает синхронный допуск либо отказ boot через `createConstitution`/`checkBoot` и существующий `Result`. Actual manifest/schema поступают независимо от разрешённого manifest в immutable policy; изменение существенного факта при прежней policy должно дать отказ. Сохранённые схемы БД затем отдельно проверяет `state`.

**Substrate:** пакет, contracts, выполняемый guide, evidence. **Anti-claims:** runtime, OS authentication, action admission и вся I1 не доказаны. Чистый модуль не получает БД, сервис, DSL, clock, grant-журнал или заглушки C2/C3. Высокий риск допуска требует отрицательных проверок. Scope — unchanged; неразрешённых добавлений нет.

## Задачи C1

Работа последовательна из-за одной меняющейся публичной границы. Новые Issues и отдельные алгоритмические документы не требуются.

| ID | Проверяемый результат | Зависит от | Параллельная группа | Проверка | Sub-issue |
| --- | --- | --- | --- | --- | --- |
| T1 | Проверенные spec/plan/roadmap для принятия | Принятые owning sources; сейчас draft | — | Checkpoint 1 | — |
| T2 | Production C1-R1–R11, consumer/M1 и guide | `start`: принятие T1; существующий `Result` | — | Checkpoint 2 | — |
| T3 | Интегрированный C1 с точным evidence | `start`: checkpoint 2 и разрешение публикации; `merge`: gates и разрешение merge | — | Checkpoint 3 | — |

## Checkpoints и навыки

`implementation-discipline` применяется сквозным образом; остальные skills читаются непосредственно перед соответствующей работой. Независимость, профиль и завершение помощников — по [agent policy](../../development-methodology/agent-policy.md). Изменения выполняются только в task-ветке/worktree с read-only `.env` symlink по [Git workflow](../../development-methodology/git-and-github.md).

### Checkpoint 1 — принятие документов

- **Результат:** T1, draft до принятия. Skills: `spec-engineer`, `delivery-planner`, `documentation`, `git-engineer`, `gh-utility`.
- **Проверки:** синхронизировать затронутые документы, выполнить применимые проверки документов и `git diff --check`, затем локальный audit commit без push. Независимые `concept-conformance-reviewer` — спецификация; `spec-conformance-reviewer` — план и roadmap; `security-reviewer` — документы о доверии и полномочиях.
- **Принятие:** положительные verdict и принятие оператором точных документов; аудит не разрешает код.
- **Следующее действие:** до принятия — `none`; после readiness — `Ready`, затем T2 с `In progress`. До этого #46 — `Backlog`.

### Checkpoint 2 — готовность реализации к публикации

- **Результат:** T2: TypeScript/ESM, side-effect-free `./contracts`, существующая валидация, main/error/recovery guide и `docs/validation/constitution/`. Skills: `typescript-engineer`, `typescript-test-engineer`, `documentation`, `git-engineer`, `gh-utility`.
- **Проверки:** общий gate ниже; синхронизировать документы **до финального audit commit**. Spec-аудит — код/план/roadmap/guide/README/evidence по owning sources; Security — код/trust-документы; Concept — изменённая спецификация. Указать покрытие всех изменённых файлов в этих routes, без лишнего отдельного аудита.
- **Принятие:** успешные проверки/аудиты commit и принятие готовности оператором. Отрицательные отчёты сохраняются; исправления проходят delta-аудит по [политике](../../development-methodology/audits.md).
- **Следующее действие:** публикация при применимом разрешении, без повторного вопроса; иначе `none`. Разрешения чужих задач не переносятся.

### Checkpoint 3 — итоговая сдача C1

- **Результат:** T3; PR в `develop`, нейтральная ссылка #46 без `Closes`, `In review`. Skills: `git-engineer`, `gh-utility`, `documentation`; исправления CI — `typescript-test-engineer` и затронутые инженерные/reviewer skills.
- **Проверки:** exact PR head, актуальные аудиты/CI, полный pre-merge gate; merge в пределах разрешения. Затем integrated commit/refs, полный post-merge CI и безопасный cleanup. GitHub mutations подтверждать отдельным чтением.
- **Принятие:** оператор принимает C1/evidence, не всю #46. Post-merge подтверждение — в Issue/отчёте, без неаудированной правки roadmap.
- **Следующее действие:** `none`. #46 — `Backlog`, пока следующий инкремент не готов; `Ready` требует его принятых документов и зависимостей. `Blocked` — конкретная внешняя блокировка с условием снятия, не очередь. `Done` — весь scope принят.

Каждый checkpoint заканчивается отчётом и остановкой до применимого подтверждения оператора. В одном сообщении по `Checkpoint Execution Contract` глобального `PLANS.md` указать scope/результат/evidence, Capability/Substrate/Anti-claims, `accepted now`/`not accepted`, `blocking decision` с owner/locator/условием снятия, решения с основаниями и последствиями, deviations/ограничения/пропущенные проверки, `next autonomous action`. Там же compact recovery ledger: timestamp, Issue/source, repo/branch/worktree, exact HEAD/base/upstream, ahead/behind, staged/unstaged/untracked, последний принятый checkpoint/commit, publication/CI/tracking/evidence locators и следующий шаг. Отдельный отчётный реестр не создаётся. Перед отчётом проверить помощников и task-ресурсы; при возобновлении перепроверить перечисленные mutable surfaces.

## Порядок интеграции и дальнейшие инкременты

C1 не требует новых примитивов [#45](https://github.com/kostysh/yaagi/issues/45). Позднейший минимальный поднабор уточняется с потребителем и блокирует `start` только соответствующего кода. Доменные DTO остаются в constitution.

- **C1 → I1, `acceptance` сборки:** [#50](https://github.com/kostysh/yaagi/issues/50) объединяет реальные state/constitution/timeline/memory/root для boot/commit/reload; эта проверка не заменяется изолированной приёмкой C1. Действия требуют E3 соответствующей сборки.
- **C2 / I2, `future-owner`:** до управления/действий уточнить `authorize`/`ControlRequest`: отказ без прав, чужому principal/stale policy, отсутствие control authority у `SendMessage`. Constitution владеет правилами; [#49](https://github.com/kostysh/yaagi/issues/49)/[#62](https://github.com/kostysh/yaagi/issues/62)/[#64](https://github.com/kostysh/yaagi/issues/64) — transport/S3.
- **C3 / I4, `future-owner`:** до development уточнить `validateApproval` для exact scope/version/hash. Canonical evidence, trusted time, grant-consumption, CAS/исполнение — development/executive/root; совместная проверка — [#68](https://github.com/kostysh/yaagi/issues/68)/[#69](https://github.com/kostysh/yaagi/issues/69).

C2/C3 пока не ready for coding: spec-engineer уточняет, оператор принимает те же spec/plan при названных triggers. Read-only лимиты/окна даёт constitution; executive/physiology исполняют и учитывают, homeostasis регулирует, E2 определяет рабочие числа. Будущие DTO сейчас не проектируются.

## Общая проверка модуля

- **Поведение:** production exports проверяют C1-R1–R11, Result/types, success/denied/retry, immutability и безопасные ошибки. Allowed/actual manifest и registered schemas задаются независимо; schema-only тестов недостаточно.
- **M1/границы:** неизменный consumer, одинаковые сценарии production-порта и совместимого double; graph/exports/dependencies, отсутствие private imports и Node/native/I/O в contracts. Double не заменяет production evidence.
- **Gates:** package/затронутые consumer tests, выполняемый guide, `format:check`, `lint`, `typecheck`, `build`, `git diff --check`; полный набор при merge по [quality](../../development-methodology/quality.md). Невыполненное не считать успешным.
- **Документы:** spec/plan, guide, evidence, затронутый roadmap; README при изменении claims. Язык русский, root README английский. До merge инкремент roadmap — «На приёмке»; «Интегрирован» — при следующем обновлении после сверки merge по [правилу](../../development-methodology/documentation.md#минимальная-синхронизация).

## Открытые вопросы

Материальных вопросов к основаниям C1 нет. Контракт/план остаются draft до checkpoint 1. C2/C3 сохраняют полный scope #46, не блокируя отдельную поставку C1.
