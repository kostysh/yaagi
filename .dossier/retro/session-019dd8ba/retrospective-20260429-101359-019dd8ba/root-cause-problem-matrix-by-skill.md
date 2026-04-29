# Матрица корневых причин по скилам: implementation session F-0028

Статус: проверено; документ предназначен для оператора

## Скоуп

Эта матрица разбирает проблемы, найденные во время implementation session `F-0028` для `CF-026`.
Граница фазы: завершенное закрытие implementation для F-0028 до последующей работы по F-0029.

Использованные доказательства:

- Session trace `<session-trace:019dd8ba>`.
- Stage log `.dossier/logs/implementation/F-0028--fc-F-0028-mojwnhzd--implementation-861e0d58.md`.
- Stage state `.dossier/stages/F-0028/implementation.json`.
- Step artifact `.dossier/steps/F-0028/implementation.json`.
- Final verification `.dossier/verification/F-0028/implementation-78652ba50b17.json`.
- Key review artifacts under `.dossier/reviews/F-0028/`.
- Существующие retrospective reports в этой run directory.

Термины:

- Симптом: что было видно во время сессии.
- Корневая причина: процессный, skill-level, logging или implementation-control gap, который сделал симптом возможным.
- Лучшее решение: рекомендуемое durable изменение, сформулированное как конкретная инструкция для агента без доступа к контексту этой сессии.
- Проверка внедрения: конкретное доказательство, что решение внедрено.

## Приоритеты

1. Обеспечить enforceable writer provenance для review artifacts.
2. Требовать stateful side-effect negative matrix до первого внешнего implementation audit.
3. Сделать full verification evidence обязательным review-entry requirement.
4. Добавить adjacent-invariant regression discipline для lifecycle fixes.
5. Улучшить retrospective и logging tooling, чтобы будущие сессии было проще аудировать.

## `unified-dossier-engineer`

| ID | Проблема | Корневая причина | Лучшее решение | Проверка внедрения |
|---|---|---|---|---|
| UDE-RCA-001 | FAIL review artifact был записан parent agent вместо независимого аудитора. Поздние PASS artifacts были auditor-authored, но workflow допустил нарушение. | `review-artifact` и `dossier-step-close` проверяют заявленные reviewer metadata, review freshness, commit freshness и verdict state, но не доказывают command actor или writer thread. Правило independent review зависит от дисциплины оператора, а не от enforceable artifact provenance. | Расширить schema review artifact полями writer provenance: `artifact_writer_thread_id`, `artifact_writer_role`, `artifact_writer_runtime`, `artifact_writer_recorded_at` и `writer_provenance_level`. `review-artifact` должен читать runtime thread id из agent environment, когда это доступно. `dossier-step-close` должен отклонять selected external review artifacts, если `artifact_writer_thread_id` отличается от `reviewer_thread_id`, кроме случая явно записанного и принятого degraded-review exception. | Тест создает один review artifact с совпадающими writer/reviewer ids и один с несовпадающими ids. Совпадающий artifact допускается к closure; несовпадающий artifact блокирует `dossier-step-close` с понятной provenance error. |
| UDE-RCA-002 | Superseded или остановленные review agents не были кратко отражены в финальном stage log. | Stage log делает акцент на selected final review artifacts и final closure bundle. В нем нет first-class модели для audit attempts, которые были запущены, но остановлены из-за fail в более раннем обязательном audit или из-за stale target commit. | Добавить секцию `audit_interruptions` в stage logs и stage state. Каждая запись должна включать `audit_class`, `reviewer_agent_id`, `target_commit`, `interrupted_at`, `reason` и `replacement_round`. Записывать interruption, когда audit отменен, superseded или намеренно остановлен, чтобы не писать stale artifact. | Stage с failed spec review и остановленными code/security audits записывает interruption entries, а `dossier-step-close` сохраняет их в closure metadata. |
| UDE-RCA-003 | Post-close hygiene в итоге был clean, но rationale для no-op source-review/hygiene decisions был слишком тонким. | Existing hygiene artifacts хорошо записывают status и blockers, но не сохраняют короткое объяснение оператора, почему более ранние source-review или affected-feature items не требуют backlog change. | Добавить optional `post_close_hygiene_notes` в implementation step artifact и stage log. Каждая note должна включать `affected_feature_id`, `source_review_id` при наличии, `decision` и `reason`. | Closure, который закрывает source-review или affected-feature hygiene без backlog patch, содержит machine-readable notes с объяснением, почему дальнейшее backlog change не требуется. |
| UDE-RCA-004 | Финальный narrative требовал читать commits, review artifacts и process misses вместе, чтобы понять, почему существовало много review-fix commits. | Closure bundle записывает final selected artifacts, но не содержит compact mapping от каждого blocking review finding к resolving commit и regression test. | Добавить секцию `review_fix_map`, когда stage имеет больше двух blocking review rounds. Каждая строка должна включать `finding_artifact`, `finding_id_or_summary`, `resolving_commit`, `verification_artifact` и `test_refs`. | F-0028-style closure можно понять из одной таблицы без открытия каждого historical review artifact. |

## `implementation-discipline`

| ID | Проблема | Корневая причина | Лучшее решение | Проверка внедрения |
|---|---|---|---|---|
| IMPL-RCA-001 | Implementation ушел во внешний review до того, как support incident state machine была достаточно смоделирована. Аудиторы многократно находили replay, conflict, side-effect ordering, terminal-state и evidence-readiness bugs. | Review readiness трактовался как "local checks pass и очевидный scope implemented". Для stateful support flows этого недостаточно: implementation нуждался в negative matrix до review, а не после reviewer failures. | Требовать `review_readiness_matrix` до первого external implementation audit для кода, который мутирует durable state или запускает side effects. Matrix должна включать минимум: duplicate request, conflicting request, wrong target id, owner seam throws before persist, owner seam throws after persist, canonical reader unavailable, rejected request replay, terminal-state update и cross-owner action attempt. Каждая строка должна назвать expected outcome и test reference или явную причину non-applicability. | Первый external audit launch блокируется, пока matrix не существует и каждая applicable строка не имеет test reference. |
| IMPL-RCA-002 | Fixes применялись по одному reviewer finding за раз, из-за чего adjacent invariants оставались непроверенными. Пример: terminal closure immutability была исправлена раньше, чем canonical evidence readiness для preserved terminal state. | Repair loop оптимизировал immediate finding, но не расширял анализ от finding к соседним invariants. Lifecycle state changes часто затрагивают несколько invariants сразу, но процесс не заставлял делать это расширение. | Добавить шаг "adjacent invariant expansion" после каждого blocking review finding, который затрагивает lifecycle state, replay, authorization, evidence readiness или side effects. Агент должен записать: affected invariant, adjacent invariants, combined failure scenario и regression tests. | Fix для lifecycle bug включает хотя бы один regression, который объединяет original failure с adjacent invariant, например terminal status preservation plus newly attached stale/missing evidence. |
| IMPL-RCA-003 | CF-029 material кратко попал в F-0028 working context до того, как был определен как out of scope. | Scope control зависел от последующего backlog dry-run и cleanup, а не от upfront "material scope" boundary до implementation edits. | Перед стартом implementation записывать short material-scope guard в stage log: allowed feature id, allowed backlog key, allowed canonical docs и явно excluded packets/items, обнаруженные во время intake. Любой последующий out-of-scope packet считать отдельной backlog task, если operator явно не расширил scope. | Stage log содержит `excluded_material_scope` list, а попытки включить excluded packets требуют explicit scope-change note. |

## `typescript-test-engineer`

| ID | Проблема | Корневая причина | Лучшее решение | Проверка внедрения |
|---|---|---|---|---|
| TEST-RCA-001 | Regression tests добавлялись реактивно после audit failures, а не предотвращали эти failures. | Test planning не был напрямую выведен из dossier acceptance criteria плюс risk families до review. Финальный test suite был сильным, но появился через reviewer-driven discovery. | Добавить `pre_review_test_inventory` artifact для implementation stages. Для каждого AC и risk family перечислять positive path, negative path, test file и command, который его запускает. Для F-0028-like support work risk families должны включать admission, replay, evidence, redaction, terminal lifecycle и runtime-gating. | Reviewer может открыть один inventory и увидеть все applicable risk families, сопоставленные с конкретными tests до старта review. |
| TEST-RCA-002 | Full verification evidence был неполным в более раннем managed artifact, поэтому spec review заблокировал closure. | Test execution и verification packaging рассматривались как разные concerns. Passing some automation checks не доказывал, что AC-mandated root gates и smoke evidence присутствуют в managed verification artifact. | Сделать так, чтобы verification artifact объявлял `required_command_matrix` до выполнения commands. Для protected operator routes или side-effect paths required commands должны включать `pnpm format`, `pnpm typecheck`, `pnpm lint`, focused tests, `pnpm test` и `pnpm smoke:cell`. Artifact должен быть `fail`, если любой required command отсутствует, даже когда выполненные commands passed. | Verification artifact с missing required commands fails validation с `missing_required_command` entries. Complete artifact перечисляет каждый required command со status и output summary. |
| TEST-RCA-003 | Environment-sensitive failures усложняли отделение code test failures от shell/sandbox failures. | Verification записывает command pass/fail output, но не имеет достаточно normalized failure classification для environment/tooling issues вроде PATH resolution, permissions или sandbox restrictions. | Добавить `failure_classification` в failed verification checks. Allowed values: `test_failure`, `tool_not_installed`, `path_resolution`, `sandbox_permission`, `network`, `unknown_environment`. Требовать короткий `classification_reason`. | Failed verification из-за missing PATH или sandbox permission не репортится как code regression; он несет правильную classification и remediation hint. |

## `spec-conformance-reviewer`

| ID | Проблема | Корневая причина | Лучшее решение | Проверка внедрения |
|---|---|---|---|---|
| SPEC-RCA-001 | Spec review пришлось ловить missing root gates и smoke evidence вместо того, чтобы получить review-ready evidence bundle. | Spec-review intake contract не требовал current verification artifact, который явно покрывает каждый AC-mandated command. Reviewer правильно заблокировал issue, но блок случился поздно. | Добавить spec-review preflight checklist. До spawn spec reviewer parent должен передать: dossier path, target commit, current verification artifact, required command matrix и explicit AC-to-evidence mapping. Spec reviewer должен fail fast, если любое поле отсутствует. | Spec reviewer может отклонить review до deep analysis одним finding "missing review input", когда verification bundle неполный. |
| SPEC-RCA-002 | Terminal-closure fix сначала пропустил spec requirement, что newly attached canonical evidence все равно должна evaluated against terminal closure semantics. | Implementation интерпретировал spec requirement как "preserve terminal status", а не как "preserve terminal status and still apply evidence readiness to new refs". Spec text был enforceable, но implementer-side extraction coupled obligations был слабым. | Для specs с lifecycle и evidence coupling добавить `coupled_obligations` checklist во время plan-slice или implementation entry. Каждая строка должна назвать две obligations, которые должны выполняться вместе, и минимум один combined test. | Plan или stage log содержит строку уровня "terminal closure remains immutable while new missing/stale canonical refs still block/degrade readiness" с test references. |

## `code-reviewer`

| ID | Проблема | Корневая причина | Лучшее решение | Проверка внедрения |
|---|---|---|---|---|
| CODE-RCA-001 | Code review многократно находил state-machine defects в support incident open/update flows. | Generic code review эффективно находил issues, но review prompt и skill не давали reusable checklist для durable request/side-effect state machines. Каждый раунд обнаруживал следующий missing case. | Добавить "durable side-effect state machine" checklist в code-review prompts для implementations, которые persist request ids или вызывают owner seams. Checklist должен проверять claim-before-side-effect, replay-before-reader-call, conflict identity, failed-claim recovery, side-effect persistence, scalar merge safety и terminal-state mutation. | Code review output явно помечает каждый checklist item как pass/fail/not applicable до verdict. |
| CODE-RCA-002 | Route/service boundaries не были reviewed как один end-to-end failure contract до поздних rounds. | Implementation разделял store logic, service logic и Hono route mapping, тогда как bugs пересекали эти boundaries. | Требовать от code review один "boundary trace" для каждого write route: HTTP input -> admission -> service validation -> durable claim -> owner seam -> store mutation -> HTTP status mapping -> replay response. | Review artifact содержит boundary traces для каждого protected write route и flags mismatches между service result states и HTTP responses. |

## `security-reviewer`

| ID | Проблема | Корневая причина | Лучшее решение | Проверка внедрения |
|---|---|---|---|---|
| SEC-RCA-001 | Security review нашел owner-action forgery, replay/conflict protection и redaction gaps. | Implementation не стартовал с threat model для support-operator writes. Он добавил privileged support behavior до явного моделирования, кто может trigger owner-routed actions, какие данные redacted и как replay bounded. | Требовать compact threat model до первого security review для любого operator-facing write surface. Модель должна определить actors, privileges, protected assets, trust boundaries, abuse cases и required controls для replay, owner action routing, redaction и audit evidence. | Security review input включает threat model; reviewer verdict явно сопоставляет findings с threat-model controls. |
| SEC-RCA-002 | Redaction coverage отставал от новых support free-text fields. | Redaction не рассматривался как schema-wide invariant. Новые поля вроде requested actions, closure criteria, residual risk и support refs могли появиться без automatic coverage в redaction tests. | Добавить schema-driven redaction tests: каждое persisted или hashed free-text support field должно быть перечислено в redaction inventory, а test должен fail, когда новое free-text field не имеет redaction case. | Добавление нового support free-text field без обновления redaction inventory ломает focused support test suite. |

## `hono-engineer`

| ID | Проблема | Корневая причина | Лучшее решение | Проверка внедрения |
|---|---|---|---|---|
| HONO-RCA-001 | Route-level service failures в ранних rounds mapped incorrectly; first-attempt support service exceptions могли вернуть неправильный HTTP contract. | Tests и review фокусировались на service/store behavior до того, как полностью проверили HTTP boundary для thrown failures after durable claims. Hono route mapping не был first-class contract. | Для каждого Hono route, который wraps durable write service, добавить route-level tests для: validation failure, admission failure, service `accepted:false`, service throw before durable claim, service throw after durable claim и replay of a failed request. | Route test suite доказывает intended HTTP status и response body для каждого service failure class. |

## `node-engineer` / `typescript-engineer`

| ID | Проблема | Корневая причина | Лучшее решение | Проверка внедрения |
|---|---|---|---|---|
| NODE-RCA-001 | Объяснение доступности `pnpm` было неточным, что вызвало operator confusion и лишнюю remediation work. | Агент смешал три разных состояния в одном сообщении: package manager not installed, package manager not in current shell PATH и command blocked by environment/sandbox permissions. | Использовать стандартную package-manager diagnostic до reinstall advice: выполнить `command -v pnpm`, `pnpm --version`, проверить `PATH`, проверить `corepack pnpm --version` when relevant и классифицировать failures как install, PATH или sandbox/permission. Рекомендовать `npm install -g pnpm` только после доказанного install absence. | Будущие отчеты говорят ровно одно из: "pnpm is not installed", "pnpm exists but is not in this shell PATH" или "pnpm is available but this command is blocked by environment permissions". |

## `retrospective-phase-analysis`

| ID | Проблема | Корневая причина | Лучшее решение | Проверка внедрения |
|---|---|---|---|---|
| RPA-RCA-001 | Initial retrospective scan завысил количество trace-derived non-PASS review signals, хотя final stage state имел complete review history. | Scan не подключал same-session stage logs автоматически. Он трактовал trace mentions как candidates, хотя validated stage log и `rpa_source_quality` имели stronger evidence. | Обновить scan workflow так, чтобы stage log с matching `session_id`, `feature_id` и `stage` был auto-included или явно requested before report generation. Когда included stage state говорит `review_history_quality: complete`, suppress duplicate trace-only non-PASS signals. | Запуск scan на той же session должен показывать analyzed stage logs и не создавать duplicate trace-only non-PASS review rows, когда dossier artifacts complete. |
| RPA-RCA-002 | CLI validation обновил `scan-summary.json`, но generated Markdown files все еще требовали manual status cleanup. | `validate` command stamps structured JSON metadata, но не обновляет generated Markdown report status sections или validation metadata blocks. | Сделать так, чтобы `retro-cli validate` либо обновлял generated Markdown validation sections в run directory, либо писал `validation.md` sidecar, на который ссылается каждый generated report. | После validation ни один generated Markdown в run directory не содержит `draft`, `pending`, `not validated` или `requires agent validation`, если validation фактически не failed. |

## `git-engineer`

| ID | Проблема | Корневая причина | Лучшее решение | Проверка внедрения |
|---|---|---|---|---|
| GIT-RCA-001 | Commit sequence сам по себе не объяснял многочисленные audit-fix loops. | Commit messages называли fixes, но не review artifact, blocker и test evidence, которые мотивировали каждый fix. Durable explanation жил в нескольких dossier files. | Когда implementation stage имеет больше двух review-fix commits, требовать closure table в stage log: `commit`, `review_artifact`, `blocker_summary`, `changed_surfaces` и `regression_tests`. | Другой агент может восстановить, зачем существует каждый review-fix commit, из stage log без поиска по всему trace. |
| GIT-RCA-002 | Поздние uncommitted F-0029 artifacts появились после F-0028 closure, создавая риск смешать phase outputs при будущих commits. | Session продолжилась в новую backlog work после F-0028 closure. Git status является единственным immediate boundary marker, если phase-specific commit discipline не enforced. | Перед commit retrospective или follow-up artifacts использовать pathspec-scoped `git add`, ограниченный retro run directory или intended feature. Не делать broad `.dossier` staging, когда есть unrelated feature artifacts. | `git status --short` перед commit показывает unrelated dirty paths, а commit command stages only intended retro path. |

## Межскилловый синтез

| Семейство корневых причин | Affected IDs | Сводка | Лучшее следующее действие |
|---|---|---|---|
| Missing enforceable provenance | UDE-RCA-001, LOG-related findings from prior report | Process rules существовали, но artifacts не могли доказать command actor identity. | Внедрить writer provenance и closure rejection для mismatched external review artifacts. |
| Premature review readiness | IMPL-RCA-001, TEST-RCA-001, SPEC-RCA-001, CODE-RCA-001, SEC-RCA-001 | Reviewers использовались как discovery engines для cases, которые должны были быть в pre-review matrices. | Добавить обязательные review-entry packets: negative matrix, test inventory, threat model и verification command matrix. |
| Coupled invariant blind spots | IMPL-RCA-002, SPEC-RCA-002, CODE-RCA-002 | Fixes были нацелены на individual symptoms без расширения на adjacent lifecycle/evidence invariants. | Требовать adjacent-invariant expansion для lifecycle, replay, evidence и side-effect fixes. |
| Incomplete evidence packaging | TEST-RCA-002, SPEC-RCA-001, RPA-RCA-001 | Strong evidence в итоге существовал, но tooling не требовал и не ingest его в правильный момент. | Сделать evidence completeness machine-checkable до review и до retrospective report generation. |
| Environment ambiguity | TEST-RCA-003, NODE-RCA-001 | Tooling failures не были classified достаточно точно. | Добавить standard package-manager diagnostics и verification failure classifications. |

## Рекомендуемый порядок внедрения

1. Сначала внедрить `UDE-RCA-001`. Это защищает independent-review rule, на которое operator явно указал.
2. Внедрить `IMPL-RCA-001`, `TEST-RCA-001` и `SEC-RCA-001` вместе как minimum review-entry packet.
3. Внедрить `TEST-RCA-002` и `SPEC-RCA-001` вместе, чтобы spec review никогда не стартовал с incomplete verification evidence.
4. Внедрить `IMPL-RCA-002` и `SPEC-RCA-002` как adjacent-invariant checklist для lifecycle fixes.
5. Внедрить `RPA-RCA-001` и `RPA-RCA-002`, чтобы уменьшить noise в будущих retro reports.
6. Внедрить `GIT-RCA-001` и `GIT-RCA-002` как closure hygiene improvements для long audit-loop phases.
