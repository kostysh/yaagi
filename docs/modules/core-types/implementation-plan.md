# План имплементации модуля: `core-types`

- Document ID: `core-types.plan`
- Module ID: `core-types`
- Статус: документы поднабора для timeline T1 приняты в CP1 на `2aa09af2a27cac31998d26ad8d05642c7e972fdc`; локальная реализация к приёмке CP2. Принятый инкремент `Result` сохраняется.
- Спецификация: [core-types.spec](specification.md); точные типы, signatures, ошибки и правила входов принадлежат ей.
- Архитектура: [модули и зависимости](../../architecture.md#3-модули-состояние-и-публичные-операции), [контракты](../../architecture.md#4-контракты-обмена), [M1](../../architecture.md#10-приёмочные-сценарии-и-evidence).
- Системный дизайн: [F1/F3/F4/F8](../../system-design.md#3-сквозные-потоки), [I1](../../system-design.md#5-поэтапная-сборка); потребитель — [timeline T1](../timeline/specification.md).
- Рамочная Issue: [#45](https://github.com/kostysh/yaagi/issues/45); история Result — [#23](https://github.com/kostysh/yaagi/issues/23), [#24](https://github.com/kostysh/yaagi/issues/24), [PR #25](https://github.com/kostysh/yaagi/pull/25).
- Основание: принятый оператором `core-types-45.plan.v1.2@dc312c0`, затем принятие CP1 и разрешение реализации CP2; публикация и merge пока не разрешены.

## Целевой результат и границы

**Capability:** потребитель проверяет и различает общие значения через production API, сохраняя их точное представление и прежний `Result`. **Substrate:** примитивы, проверки, guide и evidence для timeline T1. **Anti-claims:** это не timeline/runtime, не проверка существования foreign records и не приёмка общей атомарности I1.

Scope расширяет Result-only инкремент только запросом принятого timeline T1: `AgentId`, `TickId`, `ActionId`, opaque `Revision`, `EvidenceRef`, различные `WallTimeMs`/`ElapsedMs` и чистая валидация. Существующие Result-потребители state/queue/constitution и контракт C1 не меняются. Примитивы не создают ID/время, не нормализуют значения и не интерпретируют revisions/hashes. Доменные DTO, локальный `TickRevision`, clock, persistence и runtime mapping остаются у владельцев.

Прямое решение — небольшой TypeScript-набор в текущем `src/index.ts`, brands и синхронные parsers через `Result`; точный контракт не копируется в план. Сохраняются private ESM-пакет, portable root export, отсутствие imports/re-exports, зависимостей и deep exports. Новый `./contracts`, production-порт, registry, validator framework и harness не нужны. Риск ограничен правильностью публичной валидации и совместимостью; хранения и миграций здесь нет.

## Сохранённая история Result

Прежние T1–T3 ниже — история поставки #23/#24, а не новые задачи или код timeline T1. Гарантии discriminant/narrowing, unconstrained payload, falsy/undefined, статического readonly и пределы structural typing сохраняются по спецификации; runtime helpers у самого `Result` не появляются.

| ID | Поставленный результат | Порядок | Проверка |
| --- | --- | --- | --- |
| T1 | TypeScript 7 как `tsc`, TypeScript 6 API для syntax-only ESLint, Biome + ESLint | Принятые документы → toolchain | Exact versions, frozen install, обе lint-команды |
| T2 | Private ESM-пакет с единственным type export `Result`, без imports/dependencies | T1 → package | Declarations, manifest boundary check, ESM import-smoke |
| T3 | Consumer fixtures и честный частичный статус в README/roadmap | T2 → fixtures → статус | Positive/negative compile checks, lint probes, package/root gates |

Tooling delta 2026-09-29: scripts/config переведены в TypeScript; прямой Node-запуск использует `--experimental-strip-types`, tooling имеет no-emit typecheck, source сохраняет `types: []`. Этот поднабор не переоткрывает toolchain или lockfile без конкретной необходимости. Историческое требование нулевых runtime exports заменяется только точным allowlist принятых parsers; manifest и import/re-export запреты остаются.

## Задачи и checkpoints

Работа последовательна: принятие контракта → реализация с публичными проверками → разрешённая поставка. Общая граница одна; искусственных параллельных потоков, новых Issues и отдельного описания очевидного алгоритма нет.

`implementation-discipline` применяется сквозным образом; остальные skills читаются перед соответствующей работой. Изменения идут в task-ветке/worktree с read-only `.env` symlink по [Git workflow](../../development-methodology/git-and-github.md). Выбор модели/reasoning, независимость аудиторов и lifecycle помощников — по [agent policy](../../development-methodology/agent-policy.md).

### CP1 — принятие документов

- **Результат:** расширенные существующие spec/plan определяют только нужный T1 поднабор, совместимость с C1 и точные публичные проверки. Узкая синхронизация roadmap и фактических статусов/ссылок принятых timeline-документов; требования соседей не меняются. Skills: `spec-engineer`, `delivery-planner`, `documentation`, `git-engineer`, `gh-utility`.
- **Проверки:** self-check источников, scope, ссылок, языка, контрактного mapping и синхронизации; scoped diff и `git diff --check`; локальный audit commit без push. Применимые независимые аудиты — по покрытию ниже. Код, guide и implementation evidence ещё не создаются; code checks относятся к CP2.
- **Принятие:** PASS всех применимых проверок/аудитов на точном предъявленном commit и принятие документов оператором. Принятие operator-facing плана не заменяет эту приёмку и не разрешает публикацию.
- **Следующее действие:** `none` до принятия. При принятых документах и доступных зависимостях — `Ready`; старт CP2 — `In progress`. CP1 принят на `2aa09af`; эти переходы подтверждены в Project, текущая работа — реализация CP2.

### CP2 — реализация и готовность к публикации

- **Результат:** production API спецификации и проверки ниже; неизменный Result и регрессии его потребителей. Guide — `packages/core-types/docs/usage.md`, implementation evidence — `docs/validation/core-types/`. Skills: `typescript-engineer`, `typescript-test-engineer`, `documentation`, `git-engineer`, `gh-utility`.
- **Проверки:** package и root `format:check`, `lint`, `typecheck`, `build`, `test`, включая затронутые state/queue/constitution; `git diff --check`. Не заменять production-проверки двойником. До финального стабильного audit commit синхронизировать весь фактический PR diff: spec/plan, roadmap поднабора «На приёмке», guide/README/AGENTS/evidence и затронутые документы соседей.
- **Принятие:** PASS всех применимых проверок/аудитов на точном предъявленном commit и принятие реализации оператором. Предъявить полный diff к `develop`, включая пакет из восьми унаследованных документов timeline CP1 и изменения #45. Отдельно согласовать его публикацию.
- **Следующее действие:** `none` до принятия и применимого разрешения публикации #45; затем CP3. Уже выданное применимое согласие повторно не запрашивается; разрешения #46/#47 не переносятся автоматически.

### CP3 — итоговая сдача поднабора

- **Результат:** PR в `develop`, нейтральная ссылка #45 без `Closes`, статус `In review`. Публикация и merge требуют соответствующих разрешений; одно не подразумевает другое. Skills: `git-engineer`, `gh-utility`, `documentation`; исправления CI — соответствующие инженерные/reviewer skills.
- **Проверки:** точный HEAD PR, актуальные аудиты, PASS полного обязательного CI на merge-кандидате до merge; после разрешённого merge — integrated refs и полный postmerge CI на merge SHA. Каждую операцию записи GitHub подтвердить отдельным чтением. Только merge commit, без squash/rebase; дальнейшие FF и cleanup — по порядку интеграции ниже.
- **Принятие:** оператор принимает интегрированный поднабор и evidence, не всю #45. Postmerge evidence — в Issue/отчёте; roadmap становится «Интегрирован» при следующем штатном проверенном обновлении, без неревьюированной postmerge правки.
- **Следующее действие:** `none`; код timeline T1 автоматически не начинается. #45 остаётся открытой и возвращается в `Backlog` для остатка; `Done` требует отдельной приёмки полного scope Issue.

## Порядок интеграции и зависимости

- **База поставки:** `.worktree/core-types-t1`, `codex/core-types-t1`, принятый локальный `acef6a2b89dcefe5bc534537785422479f8d8393`; интеграционная база — `dc312c0e611184f0181a61633ae2527e7c31eb6f`. Унаследованный пакет восьми timeline CP1 документов входит в будущий PR, но ещё не опубликован. Это обеспечивает доступные ссылки без копирования документов или зависимости от реализации timeline.
- **CP1 → CP2, `start`:** оператор принимает точные spec/plan, владелец #45 проверяет канонический контракт и совместимость с запросом T1. Несовместимость возвращается владельцам документов до зависимого кода, а не скрывается локальными alias или изменением C1.
- **#45 → #47, `start`:** принятый, реализованный, доступный и окончательно принятый поднабор снимает эту блокировку кода T1; закрытия всей #45 ждать не нужно. До этого #47 — `Blocked` с указанным условием снятия. #46 — `Backlog` для C2/C3 при принятом C1.
- **#49/#50, отдельные владельцы:** runtime согласует реальный mapping; I1 принимает совместный commit/recovery соседей. Их отсутствие не блокирует изолированную приёмку примитивов #45, а её evidence не закрывает эти интеграционные обязательства.
- **После merge:** merge commit сохраняет ancestry `acef6a2`; после проверки refs/CI fast-forward сохранённой timeline-ветки к `develop` без переписывания истории. Проверить чистоту и принадлежность ресурсов; безопасно убрать только завершённые ветку/worktree #45, timeline-worktree сохранить.
- **Следующие типы:** уточнять в этих же spec/plan только по реальному запросу следующего потребителя. Новые DTO, общие виды источников, hash/ID generators и будущие API сейчас не планируются.

## Общая проверка модуля и аудиты

- **Поведение:** production exports → parsing → точный branded result или bounded failure без raw input. Проверить допустимые/недопустимые строки и числа, distinct brands, wall/elapsed границы, signed zero, EvidenceRef/immutability и отсутствие мутации входа по спецификации. Сохранить positive/negative Result fixtures, falsy/undefined и readonly/narrowing.
- **Узкий falsifier:** parser принимает запрещённый вход, меняет допустимое значение либо типы допускают путаницу ID/времени. Для refs отдельно проверяется форма и копирование, не истинность/наличие источника; валидация не объявляется sandbox для враждебного JavaScript.
- **M1:** один T1-shaped consumer и те же сценарии с production API и ограниченным совместимым test-only double; внедрение только в тесте, без production-порта. Полный набор прямых проверок production parsers сохраняется. Fixture не реализует timeline и не доказывает I1.
- **Граница:** declarations/export resolution, точный allowlist runtime parsers, ESM import-smoke без I/O/side effects, source без Node/native API; прежние manifest/export check, ESLint import/re-export запреты и отрицательные lint-пробы сохраняются. Guide выполняется через публичный export: успех, отказ и повтор после исправления входа; root regressions покрывают существующих потребителей.
- **Покрытие аудитов:** `concept-conformance-reviewer` — core-types.spec и изменённые specifications/design/AGENTS; `spec-conformance-reviewer` — core-types.plan, код, plans соседей, roadmap, README, guide/evidence; `security-reviewer` — код, validation/error/immutability/trust положения core-types.spec и применимые trust-документы. В audit packet явно перечислить все затронутые файлы, группируя связанные области без отдельного аудита каждого файла.
- **Стабильность:** для унаследованного пакета восьми документов приложить прежние PASS и принятый commit; неизменённые проверенные части не аудировать заново. Изменения имён/статусов timeline проходят delta-аудит соответствующего предмета. Финальный стабильный commit включает все scoped изменения и их актуальное покрытие. Отрицательные отчёты сохранять; remediation/delta и три последовательных FAIL — по [политике аудитов](../../development-methodology/audits.md).
- **Пределы:** CP1 подтверждает только документы. CP2 — поведение примитивов и ограниченный M1; CP3 — поставку этого поднабора. Полный обязательный merge-набор сохраняется по [quality](../../development-methodology/quality.md); пропущенные проверки не считаются PASS.

## Отчёт и восстановление

Каждый CP завершается одним полным отчётом и остановкой по `Checkpoint Execution Contract` глобального `PLANS.md`, указанного окружением. Принятые checkpoint-обязательства действуют после выхода из режима планирования; отдельный реестр не создаётся.

- **Отчёт:** scope/result; Capability/Substrate/Anti-claims; `accepted now`/`not accepted`; проверки/evidence и пропуски с причиной; решения с основаниями и downstream последствиями либо явное отсутствие решений; deviations/вопросы; `blocking decision` с owner/locator/условием снятия; `next autonomous action` (`none` до принятия/снятия блокировки).
- **Recovery ledger в том же сообщении:** timestamp, Issue/artifact/owning source, repo/workspace/branch/worktree, exact HEAD/base/upstream, ahead/behind, staged/unstaged/untracked, tracking/publication/CI states и locators, последний принятый CP/commit, evidence и следующий разрешённый шаг.
- **Продолжение:** проверить перечисленные изменяемые состояния и объяснить расхождения до новых изменений. Перед отчётом проверить помощников и task-ресурсы; оставленное и ограничения cleanup явно перечислить.

## Открытые вопросы и readiness

Блокирующих предметных вопросов нет. CP1 принят на `2aa09af`; реализация, проверки, guide и evidence подготовлены для CP2. Приёмка CP2 и разрешение публикации полного diff остаются за оператором; Project #45 — `In progress` для реализации. #47 ждёт принятой доступной поставки, не закрытия всей #45. Результаты — в [локальном evidence](../../validation/core-types/gh-45.t1.implementation.md); изменение readiness и внешних статусов подтверждается отдельным live readback.
