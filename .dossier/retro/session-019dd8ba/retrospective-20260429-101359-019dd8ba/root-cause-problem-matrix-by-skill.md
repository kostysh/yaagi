# Матрица корневых причин по скилам: implementation session F-0028

Статус: пересмотрено после operator feedback о чрезмерной сложности workflow и сопоставлено с текущими инструкциями скилов.

## Принцип пересмотра

Документ должен быть полезен агенту без доступа к контексту текущей сессии. Поэтому каждая строка формулирует решение как конкретное действие: где править, что добавить или уточнить, и каким тестом или проверкой подтвердить внедрение.

Новая версия оставляет только actionable cases:

- в skill есть правильная идея, но инструкция недостаточно явно направляет агента к нужному действию, поэтому нужен точечный текстовый патч;
- проблема лучше решается существующим CLI/tooling gate, поэтому действие состоит в расширении этого gate.

Правило зависимости скилов: `unified-dossier-engineer` и `retrospective-phase-analysis` могут содержать orchestration/workflow fixes. Остальные скилы считаются независимыми; их строки содержат только self-contained skill fix.

После пересмотра non-actionable rows исключаются из матрицы. Они не создают работу для skill backlog.

Граница анализа: завершенная implementation phase `F-0028` для `CF-026`, до последующей работы по F-0029.

## Приоритеты

1. Уточнить reviewer-owned accounting path для external review artifacts.
2. Добавить completeness profile в существующий `dossier-verify`.
3. Разместить dossier-specific trigger повторного audit FAIL в `unified-dossier-engineer`.
4. Сохранить независимый характер `implementation-discipline`.
5. Исправить retro scan heuristic как CLI/tooling fix.

## `unified-dossier-engineer`

| ID | Кейс | Как skill обрабатывает сейчас | Что сделать | Проверка внедрения |
|---|---|---|---|---|
| UDE-RCA-001 | Parent agent записал FAIL review artifact вместо независимого аудитора. | `SKILL.md` уже требует external review без `fork_context`/full-history inheritance. `references/audit-policy.md` уже описывает `review-artifact` как сохранение уже полученного audit result. `references/audit-handoff-recipes.md` уже говорит reviewer'у после PASS/FAIL записать verdict через `dossier-engineer review-artifact`. Gap: authoring/parent flow имеет неявный путь выполнить accounting write за reviewer'а. | В `skills/unified-dossier-engineer/references/audit-handoff-recipes.md` в блоках `Read-only audit analysis` и `Review artifact accounting` добавить правило: для blocking external audit команду `review-artifact` выполняет reviewer execution. Authoring flow при отсутствии reviewer-written artifact выбирает один из двух путей: relaunch reviewer или structured process miss. В `references/audit-policy.md` в разделе helper-owned accounting добавить closure rule: parent-authored external review artifact is invalid for closure. Если runtime может определить authoring session, добавить guard в `review-artifact`, который помечает такой artifact invalid for closure. | Static/contract check skill docs: handoff recipe содержит reviewer-owned accounting path. Runtime fixture, если guard реализован: parent flow artifact получает invalid-for-closure state. |
| UDE-RCA-002 | Spec review обнаружил, что managed verification artifact был неполным. | `dossier-verify` уже существует как closure-evidence verifier. `delivery-workflow-layer.md` уже требует local verification и final verification перед `dossier-step-close`. Gap: completeness profile для code-bearing protected-route / side-effect implementation остается ручной дисциплиной агента. | В установленном runtime `dossier-engineer dossier-verify` добавить implementation profile для code-bearing protected route or side-effect path. Profile требует evidence для root gates: `pnpm format`, `pnpm typecheck`, `pnpm lint`, focused tests по touched behavior, `pnpm test`, `pnpm smoke:cell`. В `skills/unified-dossier-engineer/SKILL.md` summary для `dossier-verify` или `references/delivery-workflow-layer.md` implementation close-out section добавить описание этого profile как части existing verification gate. | Fixture для `dossier-verify`: verification artifact без `pnpm smoke:cell` или root gate evidence для protected side-effect change fail-ится до external review handoff с понятной причиной. |
| UDE-RCA-003 | Implementation repair loop несколько раз получал blocking audit findings в близких replay / side-effect / terminal-state risk families. | `unified-dossier-engineer` уже управляет mutating-stage audit policy, rerun requirements и implementation close-out order. Gap: dossier workflow описывает stale/invalid audit handling; repair guidance после повторного blocking FAIL в том же dossier risk family отсутствует. | В `skills/unified-dossier-engineer/references/delivery-workflow-layer.md` implementation repair guidance или `references/audit-handoff-recipes.md` remediation note добавить правило: после второго blocking review artifact в одном declared/proven risk family authoring agent перед следующим rerun расширяет repair на adjacent scenarios и regression evidence. Формулировка использует dossier-specific термины: `blocking review artifact`, `implementation stage`, `rerun`. | При будущем dossier implementation с двумя FAIL одного risk family stage guidance требует adjacent regression evidence before rerun; trigger применяется к dossier implementation flow. |

## `implementation-discipline`

| ID | Кейс | Как skill обрабатывает сейчас | Что сделать | Проверка внедрения |
|---|---|---|---|---|
| IMPL-RCA-001 | Implementation несколько раз чинил близкие дефекты точечно. | `SKILL.md` уже требует smallest sufficient change, narrowest meaningful checks и подтверждение, что fixed bug covered or resolved. Skill применяется в разных окружениях: одиночная правка, локальная отладка, review-driven repair, CI failure repair, продуктовый workflow. | В `skills/implementation-discipline/SKILL.md` в `Workflow stage: Verify and report with evidence` добавить portable heuristic: когда повторные независимые validation signals указывают на один класс дефекта, расширь проверку с конкретного симптома на соседние observable cases before reporting done. Validation signals перечислить generic terms: failing tests, reviewer feedback, runtime failure, user-reported repro, CI failure. Guidance остается artifact-free и environment-neutral. | Standalone skill wording uses only generic validation terms and adjacent observable cases. Проверка внедрения ищет эти terms в `implementation-discipline/SKILL.md`. |

## `retrospective-phase-analysis`

| ID | Кейс | Как skill обрабатывает сейчас | Что сделать | Проверка внедрения |
|---|---|---|---|---|
| RPA-RCA-001 | Initial retro scan завысил количество trace-derived non-PASS review signals, хотя validated stage state имел complete review history. | `SKILL.md` уже говорит включать stage logs только если trace links them as created/changed, а included stage log/stage state review artifacts are stronger evidence than broad trace mentions. Gap: CLI/procedure lacks suppression for trace-only duplicate signals when bounded stage state already proves complete review history. | В `skills/retrospective-phase-analysis/scripts/retro-cli.mjs scan` добавить classification: если bounded included stage state or included stage log has matching feature/stage/session and `review_history_quality: complete`, duplicate trace-only non-PASS review mentions classify as historical/superseded instead of unresolved. В `retrospective-phase-analysis/SKILL.md` в `Procedure -> Scope the retrospective` добавить scan guidance: если trace references a stage log and inclusion needs manual evidence, output instructs rerun with explicit `--stage-log ... --artifact-evidence ...` before final report. | Regression fixture: same session with complete dossier-backed review history classifies earlier trace mentions as historical/superseded. |

## Итоговый минимальный набор действий

1. `unified-dossier-engineer`: уточнить audit handoff/policy так, что external review artifact пишет reviewer execution; parent-authored artifact получает invalid-for-closure state.
2. `dossier-engineer dossier-verify`: machine-check completeness root gates для code-bearing protected/side-effect implementation.
3. `unified-dossier-engineer`: добавить dossier-specific remediation note после второго blocking audit FAIL в одном risk family.
4. `implementation-discipline`: сохранить independent scope; при изменении skill использовать только generic repeated-validation heuristic.
5. `retrospective-phase-analysis`: исправить scan heuristic для trace-only duplicate review signals при наличии complete bounded stage state.
