# Матрица выявленных проблем с корнями и точками правки

Статус: follow-up документ, подготовленный агентом

## Область анализа

Документ дополняет ретроспективу сессии `019dd8e7-0a47-7093-af99-12cfa514ab67`.

Цель документа: дать будущему агенту самодостаточный список проблем, причин и точек исправления в skills/runtime-инструкциях. Агенту не нужен контекст этой сессии: здесь указаны ID проблемы, затронутый skill, корень проблемы, причина появления, предлагаемое решение, конкретное место изменения и критерий приемки.

Этот документ сам не меняет skills. Он фиксирует, что именно нужно изменить в следующих итерациях.

Основные источники:

- `.dossier/retro/session-019dd8e7/retrospective-20260429-110443-019dd8e7/retrospective-report.md`
- `.dossier/retro/session-019dd8e7/retrospective-20260429-110443-019dd8e7/skill-audit.md`
- `.dossier/retro/session-019dd8e7/retrospective-20260429-110443-019dd8e7/logging-review.md`
- `.dossier/retro/session-019dd8e7/retrospective-20260429-110443-019dd8e7/problem-matrix-by-skill.md`
- `.dossier/steps/F-0029/implementation.json`
- `.dossier/verification/F-0029/implementation-post-close-backlog-hygiene.json`

## Соглашение об ID

- `RCM-UDE-*`: `unified-dossier-engineer`
- `RCM-ID-*`: `implementation-discipline`
- `RCM-SCR-*`: `spec-conformance-reviewer`
- `RCM-CR-*`: `code-reviewer`
- `RCM-SR-*`: `security-reviewer`
- `RCM-TT-*`: `typescript-test-engineer`
- `RCM-RPA-*`: `retrospective-phase-analysis`
- `RCM-GIT-*`: `git-engineer`

## unified-dossier-engineer

### RCM-UDE-002: Post-close hygiene была отдельной от функционального закрытия

Проблема:
`F-0029` была функционально реализована и закрыта, но backlog стал нормальным только после отдельного hygiene-прохода. До него оставались post-close/source-review состояния, которые требовали нормализации.

Корень:
В skill уже есть требование делать post-close backlog hygiene явной, но агентское поведение все еще может воспринимать "implementation closed" как "вся сессия завершена".

Причина появления:
Закрытие implementation и чистота backlog находятся в разных слоях процесса. Без жесткой формулировки агент может закончить отчет после closure artifact, не дождавшись чистых `status`, `queue`, `attention` и post-close hygiene.

Проверенное текущее правило:
`unified-dossier-engineer/SKILL.md`, `Workflow stage: Maintain the model`, пункт 4: нужно держать post-close backlog hygiene evidence explicit после closure и до branch-complete reporting / next-intake recommendation.

Решение:
Усилить правило: нельзя сообщать, что branch/session завершена, пока hygiene-команды не чистые.

Где менять:
`<skills-root>/unified-dossier-engineer/SKILL.md`

Раздел:
`Workflow stage: Maintain the model`

Что заменить:
Заменить текущий пункт 4 на правило со смыслом:

```md
После любого implementation closure агент должен выполнить или проверить post-close hygiene result. Нельзя сообщать, что branch/session завершена, если `status`, `queue`, `attention`, source-review, lifecycle drift или post-close hygiene blockers остаются нерешенными.
```

Доработка runtime:
Если меняется runtime, обновить completion output в `<skills-root>/unified-dossier-engineer/scripts/dossier-engineer.mjs` для `implementation` или `dossier-step-close`, чтобы при required/stale hygiene он печатал прямое следующее действие.

Критерий приемки:
После закрытия implementation агент либо пишет "post-close hygiene clean", либо называет конкретный blocker и следующую команду.

### RCM-UDE-003: Причины review reround не были машиночитаемыми

Проблема:
В сессии было несколько review rerounds, но durable logs не фиксировали компактно, почему каждый review class запускался повторно.

Корень:
Stage artifact model хранит review artifacts и verdicts, но не требует маленького структурного поля причины запуска: `spec-risk`, `security-risk`, `code-risk`, `hygiene-only`, `operator-requested`.

Причина появления:
Без такого поля будущий ретро-анализ вынужден восстанавливать мотивы reround из chat trace и review prompts, что дорого и ненадежно.

Проверенное текущее правило:
`unified-dossier-engineer/SKILL.md` говорит, что stage log frontmatter зеркалит bounded fields, включая review attempt events и process misses. Но review launch reason там не обязателен.

Решение:
Добавить bounded optional/required field для повторных review attempts.

Где менять:
`<skills-root>/unified-dossier-engineer/SKILL.md`

Раздел:
`Overview`, абзац про machine-complete stage artifacts.

Что добавить:

```md
Для каждого review reround после первой попытки того же audit class фиксировать bounded `review_launch_reason`: `spec-risk`, `security-risk`, `code-risk`, `runtime-test-risk`, `hygiene-only` или `operator-requested`. Причина должна объяснять, почему последнее изменение может затронуть этот audit class, либо явно фиксировать, что риска нет и review пропущен.
```

Доработка runtime:
Обновить review-event schema и stage-log writer в `<skills-root>/unified-dossier-engineer/scripts/dossier-engineer.mjs`, чтобы сохранять `review_launch_reason`.

Критерий приемки:
Будущая ретроспектива может сгруппировать review rerounds по причинам без чтения всего chat trace.

### RCM-UDE-003: Spec audits запускались без явной классификации spec-risk

Проблема:
Оператор справедливо указал: если правка не влияет на соответствие спецификации, spec audit не нужен и только увеличивает задержку.

Корень:
Skill хорошо описывает, когда он применим, но не требует перед rerun явно классифицировать последнюю правку как `spec-risk` или `no-spec-risk`.

Причина появления:
После implementation fixes или hygiene-only edits агент может запускать spec-conformance review по инерции, без проверки, изменился ли normative surface.

Проверенное текущее правило:
`spec-conformance-reviewer/SKILL.md`, `When NOT to use this skill`, исключает general merge-risk/security/style reviews. `Non-Negotiables` требуют проверять implementation against normative requirements. Но нет отдельного rerun gate.

Решение:
Добавить rerun gate для post-fix и hygiene-only contexts.

Где менять:
`<skills-root>/spec-conformance-reviewer/SKILL.md`

Раздел:
`When NOT to use this skill`

Что добавить:

```md
Не использовать skill для чистой backlog/dossier/logging/formatting/closure hygiene, если она не меняет normative requirements, implementation behavior, tests used as requirement evidence, contracts, ADRs или acceptance criteria. В таком случае выполнять workflow/backlog verification, принадлежащую соответствующему skill.
```

Раздел:
`Fast Workflow`

Что добавить как шаг 0:

```md
Перед любым rerun после implementation fixes или hygiene changes классифицировать последнее изменение как `spec-risk` или `no-spec-risk`. Запускать этот skill только при `spec-risk`; при пропуске фиксировать `no-spec-risk` как причину.
```

Критерий приемки:
Каждый будущий spec audit rerun можно обосновать одной фразой, привязанной к изменившемуся normative surface.

### RCM-UDE-004: Code review rerounds были дорогими из-за отсутствия обязательного delta handoff

Проблема:
Для `F-0029` потребовалось несколько code-review rounds до final PASS. Review loop был полезен, но каждый reround стоил больше, чем должен был.

Корень:
`code-reviewer` требует читать full diff и подтверждать findings, но не требует от автора компактного handoff "что изменилось с прошлого review".

Причина появления:
Reviewer вынужден заново восстанавливать контекст вместо focused validation предыдущих findings и новых changed files.

Проверенное текущее правило:
`code-reviewer/SKILL.md`, `Fast Workflow`, требует собрать контекст, прочитать full diff и маршрутизировать риск. Но reround prompt не обязан содержать previous finding IDs, fixed files и remaining risk.

Решение:
Добавить обязательный reround handoff.

Где менять:
`<skills-root>/code-reviewer/SKILL.md`

Раздел:
`Fast Workflow`

Что добавить:
После шага 1 добавить:

```md
Для reround после предыдущего review требовать компактный reround handoff: IDs/verdicts предыдущих findings, changed files since previous attempt, intended fixes, уже выполненные команды и intentionally unresolved risk. Если handoff отсутствует, reviewer должен восстановить его из diff и отметить отсутствие handoff как process issue.
```

Критерий приемки:
По prompt или persisted artifact понятно, reviewer делает first-pass review или проверяет исправления после предыдущего review.

## security-reviewer

### RCM-SR-001: Security review trigger должен отличать security-sensitive changes от hygiene

Проблема:
Security review был необходим для operator-only Telegram access, tokens и allowlists. Но для чистой backlog sanitation он не нужен.

Корень:
`security-reviewer` уже имеет правила применимости, но агент может запускать его рефлекторно после каждой implementation-adjacent правки.

Причина появления:
В skill нет явного rerun gate `security-risk` / `no-security-risk` для ситуации после fixes или hygiene edits.

Проверенное текущее правило:
`security-reviewer/SKILL.md`, `When to use this skill`, включает auth, tokens, secrets, permissions, webhooks и sensitive flows. `When NOT to use this skill` исключает general non-security code quality review.

Решение:
Добавить явное hygiene exclusion и rerun trigger.

Где менять:
`<skills-root>/security-reviewer/SKILL.md`

Раздел:
`When NOT to Use`

Что добавить:

```md
Не использовать skill для чистой dossier/backlog/retro/logging/closure hygiene, если она не меняет authn/authz, tokens, secrets, permissions, webhook behavior, operator allowlists, CI secret handling или sensitive input-to-sink flow.
```

Раздел:
`Fast Workflow`

Что добавить как шаг 0:

```md
Для reruns после fixes или hygiene edits классифицировать последнее изменение как `security-risk` или `no-security-risk`. Запускать этот skill только при `security-risk`; при пропуске фиксировать `no-security-risk` как причину.
```

Критерий приемки:
Будущий агент запускает security review для bot auth/allowlist changes, но не запускает его для documentation-only backlog cleanup, если cleanup не меняет security requirement.

## typescript-test-engineer

### RCM-TT-001: Runtime/test evidence хуже видна в ретроспективе, чем dossier evidence

Проблема:
Ретроспектива легко перечислила dossier verification checks, но runtime/test evidence по implementation пришлось восстанавливать менее компактно.

Корень:
`typescript-test-engineer` требует запускать relevant tests и reporting checks, но `unified-dossier-engineer` stage logs не требуют отдельного compact runtime/test gate summary.

Причина появления:
Проверки кода и тестов существуют в процессе, но не становятся таким же структурным evidence block, как dossier artifacts.

Проверенное текущее правило:
`typescript-test-engineer/SKILL.md`, `Quick workflow`, шаги 9-12 требуют запускать tests, смотреть warnings, делать coverage checkpoints и final relevant tests. Само правило корректное; слабое место в bridge к dossier logs.

Решение:
Не менять core testing rule. Добавить cross-skill logging instruction.

Где менять:
`<skills-root>/typescript-test-engineer/SKILL.md`

Раздел:
`Quick workflow`

Что добавить:
После шага 12 добавить:

```md
Если работа выполняется внутри dossier-managed implementation stage, записывать compact runtime/test gate summary в stage log или closure artifact: exact commands, pass/fail status, warnings/stderr status, coverage status when applicable, and skipped checks with reason.
```

Дополнительно где менять:
`<skills-root>/unified-dossier-engineer/SKILL.md`

Раздел:
`Overview`, абзац про stage log frontmatter.

Что добавить:
Добавить `runtime_test_gate_summary` к примерам bounded machine fields.

Критерий приемки:
Ретроспектива может увидеть и dossier checks, и runtime/test checks без реконструкции из chat trace.

## retrospective-phase-analysis

### RCM-RPA-001: Retrospective scan переоценил trace-derived review signals

Проблема:
Сгенерированный draft сообщил много trace-derived non-PASS review signals без matching immutable artifacts, хотя `.dossier/steps/F-0029/implementation.json` содержал complete non-PASS review history с artifact paths.

Корень:
Scanner дал слишком большой вес trace-derived review mentions и недостаточно приоритизировал structured step-artifact review history.

Причина появления:
Evidence hierarchy в skill описана, но runtime применяет ее недостаточно строго именно для review signals.

Проверенное текущее правило:
`retrospective-phase-analysis/SKILL.md` говорит, что linked stage artifacts и review/verification/step artifacts сильнее broad trace mentions. Но нужен более конкретный rule для structured step review history.

Решение:
Сделать structured step artifacts первичным источником review history.

Где менять:
`<skills-root>/retrospective-phase-analysis/SKILL.md`

Раздел:
`Procedure`, scope/evidence rules.

Что добавить:

```md
Если included step artifact содержит structured `non_pass_review_events`, `selected_review_artifacts` или `rpa_source_quality.review_history_quality`, считать эту structured step history primary review-history source. Trace-derived review mentions использовать только для заполнения gaps. Не считать trace-only mentions missing immutable artifacts, если step artifact уже фиксирует complete review history.
```

Доработка runtime:
Обновить `<skills-root>/retrospective-phase-analysis/scripts/retro-cli.mjs`, чтобы `scan` suppress/downgrade trace-derived missing-review warnings, когда included step artifacts имеют `review_history_quality: "complete"` и `missing_fail_artifact_count: 0`.

Критерий приемки:
`retro-cli scan` на этой сессии не должен создавать матрицу, где доминируют дублирующиеся строки "missing non-PASS artifact", если complete step review history существует.

### RCM-RPA-002: Для same-session evidence потребовались manual artifact overrides

Проблема:
Первый retrospective scan оставил важные same-session stage/review/verification artifacts как referenced-only. Пришлось запускать второй scan с явным manual inclusion.

Корень:
Skill сознательно ограничивает broad inclusion ради безопасности, но runtime пока недостаточно хорошо продвигает immutable artifacts, прямо связанные included stage logs.

Причина появления:
Scanner смешал mutable `latest` pointers, trace references и immutable stage-linked artifacts, поэтому часть надежных артефактов не вошла автоматически.

Проверенное текущее правило:
`retrospective-phase-analysis/SKILL.md` говорит, что included stage logs могут продвигать linked review, verification и step artifacts, если они существуют, находятся внутри project root и совпадают по scope.

Решение:
Уточнить и реализовать правила promotion для same-session stage-linked artifacts.

Где менять:
`<skills-root>/retrospective-phase-analysis/SKILL.md`

Раздел:
`Procedure`, scope rules around included stage logs.

Что заменить:
Текущую широкую формулировку:

```md
when an included stage log or bounded stage state declares `review_artifact(s)`, `verification_artifact(s)`, or `step_artifact(s)`, treat those links as stronger evidence than broad trace mentions only if the target path exists inside the confirmed project root and matches the artifact scope.
```

Заменить на смысл:

```md
Когда included stage log или bounded stage state объявляет `review_artifact(s)`, `verification_artifact(s)` или `step_artifact(s)`, автоматически включать эти linked artifacts, если target path существует внутри confirmed project root, совпадает с тем же feature/stage scope и не является mutable `latest` pointer. Mutable `latest` pointers считать navigation hints, а не required immutable evidence.
```

Доработка runtime:
Обновить artifact candidate inclusion logic в `<skills-root>/retrospective-phase-analysis/scripts/retro-cli.mjs`:

1. автоматически включать immutable stage-linked artifacts;
2. исключать `latest.json` pointers из missing-artifact counts;
3. сохранять отдельное предупреждение только для реально отсутствующих immutable artifacts.

Критерий приемки:
Scanner по-прежнему избегает broad repo reads, но не требует manual overrides для immutable artifacts, прямо связанных included stage log.

## git-engineer

### RCM-GIT-001: Структура commits была корректной, изменений не требуется

Проблема:
Негативной проблемы не выявлено. Сессия разделила feature implementation, closure, backlog hygiene и retrospective на отдельные commits.

Корень:
Правила `git-engineer` для Conventional Commits и docs-only workflow достаточно ясны для такого случая.

Проверенное текущее правило:
`git-engineer/SKILL.md`, `Docs-only commit workflow`, требует explicit docs paths, staged-file verification, `docs:` commit type и clean status.

Решение:
Изменений не требуется. Сохранить текущий pattern как positive control.

Критерий приемки:
Будущие агенты продолжают делать один commit на один связный concern и используют `docs:` для retrospective artifacts.

## Приоритет изменений

1. `RCM-SCR-001`, `RCM-SR-001` и `RCM-CR-001` идут первыми, потому что напрямую уменьшают лишнюю задержку от review rerounds без ослабления review quality.
2. `RCM-RPA-001` и `RCM-RPA-002` идут следующими, потому что уменьшают false-positive noise в ретроспективе.
3. `RCM-UDE-002` и `RCM-TT-001` лучше делать вместе: они улучшают closure observability.
4. `RCM-ID-001` важен перед следующей сессией с параллельными агентами.
5. `RCM-UDE-001` улучшает discovery будущих operator-facing channels.

## Инструкции для будущего агента

- Не применять все изменения одним большим commit, если реально редактируются skills. Делить по skill или по тесно связанному runtime behavior.
- Для изменений в `<skills-root>/retrospective-phase-analysis/scripts/retro-cli.mjs` добавить или обновить CLI tests, если в skill есть test harness.
- Для изменений в `<skills-root>/unified-dossier-engineer/scripts/dossier-engineer.mjs` использовать `implementation-discipline`, потому что это runtime code.
- После изменения skill source запускать собственный compile/check flow skill, если он использует `skill-source-compiler`.
- Сохранять portability: не упоминать путь этого репозитория или эту сессию в самих skill-инструкциях, кроме случаев тестов/fixtures для точного ретро-кейса.
