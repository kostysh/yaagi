# Ретроспектива: реализация и закрытие F-0018

## 1. Краткий вывод

- Фаза: `F-0018` от `feature-intake`, `spec-compact` и `plan-slice` до полного закрытия `implementation`.
- Целевая сессия: `019d8db3-3b85-7153-ae96-2aed5f70c721`.
- Trace: `<session-trace:019d8db3>`.
- Project root: `<project-root>`.
- Итог: feature была доведена до `status: done`, `process_complete=true`, с финальными коммитами `1b42da5` и `9e3e6e6`.
- Главная проблема процесса: агент остановился после частичного инкремента реализации `93307e0`, хотя команда оператора предполагала выполнение всего плана реализации.
- Главная сильная сторона процесса: dossier/backlog workflow и внешние ревью поймали реальные проблемы границ ответственности и security posture до финального закрытия.
- Уверенность: средняя. Trace и stage logs доступны, но CLI scan не смог автоматически связать stage logs с сессией; часть анализа опирается на ручную проверку trace-фрагментов и dossier artifacts.

## 2. Манифест доказательств

| Путь | Тип | Зачем использовался |
|---|---|---|
| `<session-trace:019d8db3>` | session trace | Основной источник таймлайна, сообщений оператора, spawn events, tool calls и финального close-out. |
| `.dossier/logs/F-0018/spec-compact-security-perimeter.md` | stage log | Доказательство reround по spec-review, исправлений границ ответственности и backlog actualization на `spec-compact`. |
| `.dossier/logs/F-0018/plan-slice-perimeter-hardening.md` | stage log | Доказательство slicing plan и перехода к implementation. |
| `.dossier/logs/F-0018/implementation-sl-f0018-01.md` | stage log | Доказательство incident с partial stop после `93307e0` и последующего закрытия `SL-F0018-01`. |
| `.dossier/logs/F-0018/implementation-sl-f0018-02.md` | stage log | Доказательство secret hygiene и slice по усилению bounded execution. |
| `.dossier/logs/F-0018/implementation-sl-f0018-03.md` | stage log | Доказательство rollback/network integration, исправления schema drift и восстановления целостности backlog patch. |
| `.dossier/verification/F-0018/implementation-1b42da50618e.json` | verification artifact | Финальная implementation verification: `index-refresh`, `lint-dossiers`, `coverage-audit`, `debt-audit`, `git diff --check`. |
| `.dossier/reviews/F-0018/implementation-1b42da50618e.json` | review artifact | Durable record внешнего review verdict после spec/security/code passes. |
| `.dossier/steps/F-0018/implementation.json` | step-close artifact | Доказательство формального закрытия implementation step. |
| `docs/features/F-0018-security-and-isolation-profile.md` | Feature Dossier | Canonical truth по scope, AC, coverage map, status и change log. |
| `docs/backlog/.backlog/applied.json` | backlog utility state | Доказательство ссылок на canonical hashed patch artifacts. |
| `docs/backlog/patches/611b80d4e305--2026-04-15-f-0018-implemented.template.json` | backlog patch | Восстановленный canonical patch artifact для `CF-014 -> implemented`. |
| `docs/backlog/patches/025927bfeea9--2026-04-15-f-0018-review-todos-clear.template.json` | backlog patch | Восстановленный canonical patch artifact для снятия review TODO. |
| `AGENTS.md` | repo overlay | Проверка правил canonical skill scripts, quality gate order, smoke path, stage log language. |
| `<skills-root>/dossier-engineer/references/workflow-stage-implementation.md` | skill reference | Нормативный implementation workflow. |
| `<skills-root>/dossier-engineer/references/implementation-audit-policy.md` | skill reference | Нормативный порядок external audits: `spec-conformance`, `code`, `security`, independent review artifact. |
| `<skills-root>/dossier-engineer/references/workflow-stage-logging.md` | skill reference | Нормативный logging contract и обязательные telemetry fields. |

## 3. Краткий таймлайн

- 2026-04-14T20:37:32Z: оператор поручил закоммитить текущие изменения и выполнить intake для `CF-014`.
- 2026-04-14T20:44:53Z: intake выполнен, но formal close-out был остановлен до разрешения на independent review.
- 2026-04-14T20:48Z: independent intake reviews вернули один `PASS` и один `FAIL`; после правок boundary issues и backlog actualization step был закрыт.
- 2026-04-14T20:56:49Z: оператор поручил закоммитить intake и выполнить `spec-compact`.
- 2026-04-14T21:09Z: `spec-compact` review вернул must-fix findings по human-override source of truth, ingress contract и secret AC atomicity.
- 2026-04-14T21:13-21:14Z: reround review подтвердил закрытие must-fix issues; `spec-compact` был закрыт.
- 2026-04-14T21:16:36Z: оператор поручил закоммитить и перейти к `plan-slice`.
- 2026-04-14T21:30Z: `plan-slice` закрыт, создан план из трёх implementation slices.
- 2026-04-14T21:46:37Z: оператор поручил закоммитить и приступить к implementation.
- 2026-04-14T22:13:15Z: агент остановился после partial implementation commit `93307e0`, прямо указав, что `implementation` stage ещё не закрыт.
- 2026-04-14T23:17:39Z: оператор указал, что останавливаться было нельзя.
- 2026-04-14T23:19:37Z: оператор явно потребовал выполнить весь plan по `F-0018` полностью.
- 2026-04-15T00:25:26Z: durable review/step-close phase начата после зелёных проверок и внешних audit passes.
- 2026-04-15T00:27:19+02:00: основной implementation bundle зафиксирован коммитом `1b42da50618ed85ca651f21bcfe4180392f2de4a`.
- 2026-04-15T00:29:04+02:00: trace-only closure metadata backfill зафиксирован коммитом `9e3e6e6729c7772fa9467b150a683d4129e9dee2`.

## 4. Основные инциденты

### Incident R-01: Преждевременная остановка после частичного инкремента реализации

- Серьёзность: high.
- Стадия: implementation.
- Первое наблюдение: 2026-04-14T22:13:15Z.
- Доказательства: trace lines с финальным сообщением после `93307e0`; `.dossier/logs/F-0018/implementation-sl-f0018-01.md`; commit `93307e0`.
- Симптом: агент завершил ответ после foundation package, хотя сам сообщил, что `SL-F0018-01` не закрыт и впереди остаются `SL-F0018-02` и `SL-F0018-03`.
- Вероятная причина: команда "Комить и приступай к имплементации" была ошибочно интерпретирована как "сделать первый чистый implementation increment", а не как "выполнить implementation plan".
- Сопутствующие факторы: привычка останавливаться на зелёном инкременте; отсутствие явного правила уровня стадии "не завершать turn до completion criteria или real blocker" в локальной execution heuristic; желание не симулировать closure.
- Восстановление: оператор указал на ошибку; агент продолжил и закрыл все slices.
- Остаточный риск: при длинных планах агент может снова принять промежуточный чистый checkpoint за допустимую точку остановки.
- Профилактика: добавить в implementation workflow явное правило: если пользователь дал команду выполнять plan, turn завершается только при полном plan completion, real blocker или явном operator pause.

### Incident R-02: Нарушение целостности backlog patch artifacts

- Серьёзность: high.
- Стадия: backlog actualization / closure.
- Первое наблюдение: 2026-04-15T00:16-00:23Z, во время финальных проверок закрытия.
- Доказательства: `.dossier/logs/F-0018/implementation-sl-f0018-03.md`; `docs/backlog/.backlog/applied.json` ссылается на `patches/611b80d4e305--2026-04-15-f-0018-implemented.template.json` и `patches/025927bfeea9--2026-04-15-f-0018-review-todos-clear.template.json`.
- Симптом: backlog rebuild зависел от hashed canonical patch files, которые были удалены или отсутствовали, пока `.backlog/applied.json` всё ещё ссылался на них.
- Вероятная причина: смешение human-authored patch templates и canonical hashed patch artifacts, которыми владеет backlog utility.
- Сопутствующие факторы: `backlog-engineer` state хранит canonical file references; сгенерированные patch copies выглядят как дубликаты, если workflow не подчёркивает правило их сохранения.
- Восстановление: hashed patch files были восстановлены без ручной мутации `.backlog/state.json` или `.backlog/applied.json`.
- Остаточный риск: будущая cleanup-операция может снова удалить canonical hashed artifacts.
- Профилактика: добавить validation guard перед commit: каждый `.backlog/applied.json[*].canonical_path` должен существовать на диске.

### Incident R-03: Позднее security realignment в реализации

- Серьёзность: high.
- Стадия: implementation / security review.
- Первое наблюдение: во время финального hardening реализации и external security review.
- Доказательства: `apps/core/src/platform/operator-api.ts`; `apps/core/src/perimeter/service.ts`; `apps/core/src/runtime/development-governor.ts`; `docs/features/F-0013-operator-http-api-and-introspection.md`; `docs/features/F-0016-development-governor-and-change-management.md`; `docs/features/F-0018-security-and-isolation-profile.md`.
- Симптом: public high-risk operator routes должны были остаться explicit-unavailable до `CF-024`; для `trusted_ingress` требовалось fail-closed разделение между public `F-0013` и internal `F-0016` flows.
- Вероятная причина: начальное давление реализации вокруг wiring governor/operator paths размыло различие между резервированием public route и владением caller admission.
- Сопутствующие факторы: adjacent dossiers пересекались в формулировках route/gate; `trusted_ingress` было слишком легко трактовать как общий pass-through.
- Восстановление: public high-risk routes были возвращены к `501` explicit-unavailable posture; для `F-0013` добавлен отказ `trusted_ingress_missing`; external/internal proposal ingress paths были разделены.
- Остаточный риск: будущая implementation `CF-024` должна явно открыть эти routes, а не выводить enablement из `F-0018`.
- Профилактика: добавить пункт security-review checklist для каждого public route, затронутого security feature: "is this route reserved, admitted, or executable?"

### Incident R-04: Согласование closure artifacts и churn из-за backfill

- Серьёзность: medium.
- Стадия: closure.
- Первое наблюдение: 2026-04-15T00:25-00:29Z.
- Доказательства: `.dossier/reviews/F-0018/implementation-93307e0aaf00.json`; `.dossier/reviews/F-0018/implementation-1b42da50618e.json`; `.dossier/verification/F-0018/implementation-93307e0aaf00.json`; `.dossier/verification/F-0018/implementation-1b42da50618e.json`; `.dossier/logs/F-0018/implementation-sl-f0018-*.md`; commits `1b42da5` and `9e3e6e6`.
- Симптом: первоначальные closure artifacts ссылались на pre-final commit identity; после final commit потребовались второй verification/review artifact и trace-only metadata commit.
- Вероятная причина: closure была начата, когда final commit ещё не был записан, но stage logs также требовали точные commit metadata.
- Сопутствующие факторы: `dossier-step-close` и `review-artifact` создают artifacts; они могут устареть, когда commit metadata добавляются позже.
- Восстановление: финальные artifacts были пересозданы как `implementation-1b42da50618e.*`; commit metadata были backfilled в `9e3e6e6` без amend.
- Остаточный риск: duplicate artifacts остаются и требуют от оператора понимать, какой artifact является canonical.
- Профилактика: использовать closure sequence checklist: final code/doc tree -> final verify -> external review -> review artifact -> step close -> commit -> optional trace-only backfill with explicit note.

### Incident R-05: External review orchestration сработал, но telemetry была сжата

- Серьёзность: medium.
- Стадия: review.
- Первое наблюдение: на протяжении review cycles для intake/spec/plan/implementation.
- Доказательства: trace `collab_agent_spawn_end` events для McClintock, Boyle, James, Bernoulli, Averroes, Sagan, Fermat, Boole, Popper, Jason, Parfit; `.dossier/logs/F-0018/*`.
- Симптом: external review поймал важные issues, но implementation logs свернули несколько audit passes в один timestamp и не сохранили per-agent latency или подробные retry causes.
- Вероятная причина: durable review artifact записывает final verdict, а review orchestration telemetry поддерживается вручную в stage logs.
- Сопутствующие факторы: subagent notifications приходят асинхронно; stage log schema содержит поля для review metrics, но не требует per-agent event IDs.
- Восстановление: final review artifact сохранил consolidated `PASS`; implementation logs упоминают spec/security/code passes.
- Остаточный риск: retrospective не может точно вычислить wait time, first verdict latency или transport-vs-findings cost для implementation reviews.
- Профилактика: добавить machine-readable массив `review_events` с `agent_id`, `role`, `requested_ts`, `started_ts`, `verdict_ts`, `verdict`, `rerun_reason`.

## 5. Анализ по стадиям

### Спецификация

- Сильные стороны: `spec-compact` review поймал реальную неоднозначность границ до implementation: владение human override, rollback/network ingress, atomicity для secret AC.
- Слабые стороны: ранний текст спецификации всё ещё допускал слишком много интерпретаций вокруг `trusted_ingress` и public high-risk routes.
- Доказательства: `.dossier/logs/F-0018/spec-compact-security-perimeter.md`; `.dossier/reviews/F-0018/spec-compact-2c0afcee7249.json`.
- Рекомендация: сделать route-admission status отдельной обязательной колонкой таблицы в будущих security dossiers.

### Планирование

- Сильные стороны: `plan-slice` создал ясный план из трёх slices: `SL-F0018-01`, `SL-F0018-02`, `SL-F0018-03`.
- Слабые стороны: handoff в implementation не принуждал к правилу "завершить все slices до остановки".
- Доказательства: `docs/features/F-0018-security-and-isolation-profile.md`; trace-вопрос о том, являются ли slices ровно диапазоном `SL-F0018-01` - `SL-F0018-03`.
- Рекомендация: включать в slice plans явные `allowed_stop_points`.

### Реализация

- Сильные стороны: quality gates были полными: targeted tests, `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm smoke:cell`.
- Слабые стороны: implementation один раз остановилась на зелёном partial checkpoint; security realignment пришёл поздно.
- Доказательства: trace final answer после `93307e0`; финальный `implementation-sl-f0018-03.md`.
- Рекомендация: добавить журнал progress для implementation с `slice_status` и блокировать final response, пока любой planned slice остаётся incomplete.

### Ревью

- Сильные стороны: external reviews были полезны и поймали реальные issues в intake/spec и финальном security posture.
- Слабые стороны: implementation review telemetry была слишком сильно сжата; agent identities и per-pass timing недостаточно durable.
- Доказательства: trace `collab_agent_spawn_end`; `.dossier/reviews/F-0018/implementation-1b42da50618e.json`.
- Рекомендация: external review orchestration должен автоматически создавать sidecar event log.

### Актуализация backlog и закрытие

- Сильные стороны: backlog завершился согласованным: `CF-014` implemented, no gaps, no attention, no open TODOs.
- Слабые стороны: canonical hashed patch files временно отсутствовали, пока `.backlog/applied.json` ссылался на них.
- Доказательства: `docs/backlog/.backlog/applied.json`; восстановленные hashed patch files в `docs/backlog/patches/`.
- Рекомендация: добавить pre-closure check `backlog-artifact-integrity`.

## 6. Сводка аудита skill-ов

| Skill | Где помог | Наблюдаемая проблема | Доказательство | Улучшение |
|---|---|---|---|---|
| `dossier-engineer` | Дал структуру stage gates, verification, review, step-close и stage logs. | Не предотвратил остановку на partial implementation increment. | `workflow-stage-implementation.md`; trace после `93307e0`. | Явно запретить завершать turn после partial increment, если пользователь поручил выполнить весь plan. |
| `backlog-engineer` | Сохранил backlog truth через patch/state model. | Retention rule для canonical hashed patch artifacts оказался неочевидным. | `.backlog/applied.json`; восстановленные patch files. | Добавить check "all canonical_path files exist". |
| `security-reviewer` | Подтвердил fail-closed public route posture и `trusted_ingress` split. | Сработал поздно, после реализации значимой части wiring. | `implementation-1b42da50618e.json`; `apps/core/src/platform/operator-api.ts`. | Запускать narrow security audit сразу после первого public-route/gate wiring. |
| `code-reviewer` | Финально подтвердил отсутствие blocker-level regressions. | Code review telemetry хранится как consolidated prose, не как structured per-agent record. | stage logs и review artifact. | Автоматизировать per-review event capture. |
| `retrospective-phase-analysis` | Помог выявить trace-driven scope и data-quality limits. | CLI scan не смог связать stage logs с trace, а процесс не закрепил созданный session-based run directory как canonical для последующих outputs. | `scan-summary.json`; временный второй semantic bundle. | Добавить явный `run_dir` contract: первый `scan` выбирает canonical каталог, а следующие команды пишут только туда через `--run-dir`. |

## 7. Основные поглотители времени

| Активность | Примерная цена | Почему заняло время | Необходимо или избегаемо | Рекомендация |
|---|---|---|---|---|
| Восстановление после partial stop | Высокая | Нужно было вернуться от чистого checkpoint к выполнению полного плана. | Избегаемо. | Stage plan должен иметь explicit completion guard. |
| Rerounds по spec review | Средняя | Ревью поймало реальные boundary gaps. | Необходимо. | Сохранять, но лучше использовать pre-review checklist. |
| Security realignment | Средняя | Public route posture и `trusted_ingress` split были уточнены поздно. | Частично избегаемо. | Ранний security pass по route exposure. |
| Восстановление целостности backlog patch | Средняя | Canonical hashed artifacts отсутствовали при ссылках из applied state. | Избегаемо. | Pre-commit integrity check. |
| Backfill closure artifacts | Низкая/средняя | Commit metadata появилась после artifact generation. | Частично избегаемо. | Явный close-out sequence. |

## 8. Эффективность контрольных механизмов

| Контроль | Что поймал | Когда сработал | Своевременно? | Улучшение |
|---|---|---|---|---|
| Intake independent review | `CF-024` boundary и неоднозначность rollback/network ownership. | Рано. | Да. | Сохранить двухагентный intake review для boundary-heavy work. |
| Spec independent review | Human override SSoT, ingress contract, secret AC atomicity. | На `spec-compact`. | Да. | Добавить checklist до review, чтобы снизить reround cost. |
| Полные tests и smoke | Schema drift вокруг `trusted_ingress`. | Implementation. | Да, но поздно. | Добавить migration/schema contract test раньше. |
| Security review | Public high-risk route fail-closed posture. | Поздняя implementation. | Частично. | Запускать раньше после route/gate changes. |
| Backlog actualization | Финальное `CF-014 -> implemented`. | Closure. | Да. | Добавить artifact integrity check. |
| Dossier step close | Формально закрыл `implementation`. | Final closure. | Да. | Уточнить canonical artifact alignment после final commit. |

## 9. Пробелы логирования и наблюдаемости

- Пробел: CLI scan не распознал F-0018 stage logs как `stageLogs analyzed`, хотя trace и touched paths содержали эти файлы.
- Влияние на уверенность: automatic metrics занизили review rounds, process misses и backlog actualization.
- Рекомендация: stage logs должны включать trace event IDs, либо CLI должен принимать explicit `--stage-log` paths.

- Пробел: implementation review events были сжаты в один timestamp `2026-04-15T02:25:26+02:00`.
- Влияние на уверенность: невозможно точно вычислить latency to first verdict и reround cost.
- Рекомендация: записывать per-agent review events.

- Пробел: process miss по partial stop был записан, но не связан с исходной operator command как structured evidence.
- Влияние на уверенность: причина восстанавливается из trace, а не из stage log.
- Рекомендация: добавить `operator_command_ref` или `trace_line_ref` в process misses.

- Пробел: closure artifact regeneration оставил несколько implementation artifacts, которые выглядят валидными.
- Влияние на уверенность: нужно вручную определить canonical `implementation-1b42da50618e.*`.
- Рекомендация: step-close artifact должен включать `supersedes` или `canonical_for_commit`.

## 10. Приоритетные улучшения

### Немедленные

1. Добавить правило implementation execution: "если оператор поручил выполнить plan, нельзя завершать turn после partial increment без blocker или явного pause".
2. Добавить backlog integrity check: каждый `.backlog/applied.json[*].canonical_path` должен существовать.
3. Добавить closure checklist для artifact freshness: verify/review/step-close должны соответствовать final intended commit или явно объявлять trace-only backfill.
4. Для `retro-cli scan` запретить первый запуск с одним `--out-root`, если ещё не выбран semantic scope slug; требовать explicit `--out .dossier/retro/<scope>/<run>/scan-summary.json` или новый `--run-dir`.
5. В `retrospective-phase-analysis` добавить обязательное правило locale: final reports создаются на языке оператора текущей сессии; английский допустим только для цитат, команд, путей, identifiers, JSON keys и имён tools/skills.

### Ближайшие

1. Добавить в stage logs structured `review_events`.
2. Добавить explicit `allowed_stop_points` в slicing plan.
3. Добавить security pre-check для public route exposure changes.
4. Добавить в CLI параметр `--locale` / `--language` и сохранять выбранный язык в `scan-summary.json` как metadata, чтобы `report`, `skill-audit` и `logging-review` наследовали его автоматически.

### Системные

1. Расширить `retrospective-phase-analysis` CLI параметрами `--scope-slug`, `--run-slug`, `--run-dir`, `--stage-log`, `--locale`.
2. Сделать stage-log parser tolerant к trace-linked touched paths.
3. Автоматизировать per-agent review telemetry capture.
4. Добавить CLI validation: если сгенерированный Markdown report не соответствует session/operator locale, команда должна завершаться non-zero и не помечать bundle как final.

## 11. Ограничения качества данных

- Trace содержит и последующий запрос на ретроспективу; анализ ограничен фазой до final `F-0018` close-out и исключает собственные retro-события.
- CLI `scan` сообщил `Stage logs analyzed: 0`, поэтому stage-log metrics из CLI недостоверны для этой сессии.
- В stage logs часть timestamps является consolidated timestamp, а не фактическим временем каждого review verdict.
- Некоторые evidence pointers являются file-level, потому что trace excerpts и сгенерированные artifacts не дают стабильных line numbers для всех событий.
- Canonical retro bundle находится в `.dossier/retro/session-019d8db3/retrospective-20260414-203415-019d8db3/`. Ранее созданный semantic folder `.dossier/retro/f-0018-implementation-closure/session-019d8db3-20260415T0811Z/` был ошибочным вторым bundle и после переноса результата больше не используется.
