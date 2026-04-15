# Аудит skill-ов: закрытие implementation для F-0018

## Сводка

- Фаза: `F-0018` intake/spec/plan/implementation/closure.
- Проверенные skills: `dossier-engineer`, `backlog-engineer`, `security-reviewer`, `code-reviewer`, `spec-conformance-reviewer`, `retrospective-phase-analysis`.
- Уверенность: средняя. Прямые trace/stage-log доказательства есть для `dossier-engineer` и `backlog-engineer`; review skills подтверждаются через spawn prompts, subagent notifications и durable review artifacts.
- Английские имена сохранены для skill names и tool names, потому что это технические идентификаторы.

## Находки по skill-ам

### Skill: `dossier-engineer`

- Назначение в фазе: вести workflow от `feature-intake` до `implementation` closure через dossier, stage logs, verification, independent review и step-close.
- Где помог: обеспечил понятную структуру stage gates; потребовал external review; сформировал verification/review/step artifacts; вынудил поддерживать `docs/ssot/index.md` и coverage map.
- Где создал friction: workflow допускает, что агент остановится на зелёном implementation increment, если не отличает "increment checkpoint" от "plan completion".
- Неоднозначные или неполные инструкции: `workflow-stage-implementation.md` говорит доставлять implementation и закрывать backlog actualization, но не формулирует явный запрет на final response после partial slice, когда пользователь приказал выполнить весь план.
- Доказательства: trace final response после `93307e0`; `.dossier/logs/F-0018/implementation-sl-f0018-01.md`; `<skills-root>/dossier-engineer/references/workflow-stage-implementation.md`.
- Вероятное влияние на время или качество: качество итоговой feature не пострадало, но оператору пришлось вмешаться и перезапустить full-plan execution.
- Рекомендуемые изменения: добавить правило: "для команды implement/execute plan final answer разрешён только после complete всех planned slices, задокументированного real blocker или явной operator pause".

### Skill: `backlog-engineer`

- Назначение в фазе: lifecycle actualization для `CF-014`, dependency truth, review TODO cleanup и backlog consistency.
- Где помог: обеспечил durable patch-based actualization; финальный backlog пришёл к `CF-014` в `implemented`, `gaps=0`, `needs_attention=0`, `open_todo=0`.
- Где создал friction: canonical hashed patch artifacts выглядят как дубликаты human-readable patch files, но `.backlog/applied.json` зависит от них.
- Неоднозначные или неполные инструкции: retention rule для `patches/<hash>--*.json` не был достаточно явным для cleanup/commit hygiene.
- Доказательства: `docs/backlog/.backlog/applied.json`; `docs/backlog/patches/611b80d4e305--2026-04-15-f-0018-implemented.template.json`; `docs/backlog/patches/025927bfeea9--2026-04-15-f-0018-review-todos-clear.template.json`; `.dossier/logs/F-0018/implementation-sl-f0018-03.md`.
- Вероятное влияние на время или качество: вызвал rebuild integrity repair во время close-out.
- Рекомендуемые изменения: добавить автоматический check `applied-canonical-paths-exist`; в skill docs явно сказать, что hashed patch artifacts являются canonical state evidence и не удаляются как дубликаты.

### Skill: `spec-conformance-reviewer`

- Назначение в фазе: проверить соответствие реализации dossier truth, AC, repo overlays и adjacent contracts.
- Где помог: подтвердил финальное соответствие perimeter authority split, public route fail-closed posture и no-second-ledger boundary.
- Где создал friction: существенной friction не выявлено.
- Неоднозначные или неполные инструкции: не обнаружено по этой сессии; проблема была скорее в orchestration telemetry, а не в skill.
- Доказательства: `.dossier/reviews/F-0018/implementation-1b42da50618e.json`; trace spawn/review notifications для `Popper`.
- Вероятное влияние на время или качество: повысил confidence перед final closure.
- Рекомендуемые изменения: durable review artifact должен фиксировать точное соответствие reviewer role: `spec-conformance`, `code`, `security`, `holistic`.

### Skill: `security-reviewer`

- Назначение в фазе: проверить trust boundaries, auth/authz, public operator routes, secret handling и exploitability.
- Где помог: подтвердил, что public high-risk routes остались explicit-unavailable до `CF-024`; `trusted_ingress` fail-closed для `F-0013`; secret-bearing artifact failures больше не выглядят как successful `file://` exports.
- Где создал friction: security review сработал поздно относительно объёма уже сделанного wiring.
- Неоднозначные или неполные инструкции: сам skill не был проблемой; orchestration policy не требует раннего narrow security pass при первом изменении public route/gate seam.
- Доказательства: `.dossier/reviews/F-0018/implementation-1b42da50618e.json`; `apps/core/src/platform/operator-api.ts`; `apps/core/src/perimeter/service.ts`; `apps/core/src/workshop/service.ts`; trace notification для `Jason`.
- Вероятное влияние на время или качество: поймал/подтвердил критичный security posture перед closure.
- Рекомендуемые изменения: для security-heavy features запускать preliminary `security-reviewer` сразу после первого route exposure или authority gate change.

### Skill: `code-reviewer`

- Назначение в фазе: проверить correctness, lifecycle handling, maintainability и merge risk в финальном diff.
- Где помог: holistic/code pass подтвердил отсутствие blocker-level regressions после final realignment.
- Где создал friction: прямой friction не найден.
- Неоднозначные или неполные инструкции: проблема не в skill content, а в том, что итоговый stage log не сохраняет detailed per-agent code review event.
- Доказательства: `.dossier/reviews/F-0018/implementation-1b42da50618e.json`; trace notification для `Parfit`.
- Вероятное влияние на время или качество: повысил confidence для final implementation closure.
- Рекомендуемые изменения: review orchestration должен сохранять per-agent result snippets или artifact references, а не только consolidated verdict prose.

### Skill: `git-engineer`

- Назначение в фазе: commit hygiene и Conventional Commits.
- Где помог: delivery была разделена на meaningful commits: `93307e0`, `1b42da5`, `9e3e6e6`.
- Где создал friction: commit metadata потребовал trace-only backfill, потому что точный `commit_sha` нельзя знать до commit.
- Неоднозначные или неполные инструкции: нет явного cross-skill pattern для "commit then update stage log with commit sha without amend".
- Доказательства: commits `1b42da5` и `9e3e6e6`; `.dossier/logs/F-0018/implementation-sl-f0018-*.md`.
- Вероятное влияние на время или качество: дополнительный docs-only commit был корректным, но увеличил closure churn.
- Рекомендуемые изменения: формализовать "post-commit metadata backfill" как accepted pattern для dossier-driven implementation closures.

### Skill: `retrospective-phase-analysis`

- Назначение в фазе: реконструировать execution quality, incidents, skill friction и logging gaps.
- Где помог: потребовал trace-first scope, evidence manifest и data-quality limits.
- Где создал friction: CLI создал правильный session-based `.dossier/retro/session-019d8db3/...` run, но процесс не зафиксировал этот каталог как canonical, и последующая ручная сборка создала второй semantic bundle; `scan` также не обнаружил stage logs как analyzed, хотя touched paths ссылались на них.
- Неоднозначные или неполные инструкции: CLI reference говорит, что `--out-root` создаёт durable bundle, но не требует использовать выбранный CLI каталог как единственный `run_dir` для следующих commands.
- Доказательства: `scan-summary.json`; canonical folder `.dossier/retro/session-019d8db3/retrospective-20260414-203415-019d8db3/`; временный semantic folder `.dossier/retro/f-0018-implementation-closure/session-019d8db3-20260415T0811Z/`, который был признан ошибочным и больше не используется.
- Вероятное влияние на время или качество: появилась лишняя cleanup/clarification question от оператора.
- Рекомендуемые изменения: после первого `scan` сохранять выбранный canonical `run_dir` в `scan-summary.json` и использовать его для всех последующих commands; если нужен semantic override, задавать его до первого `scan`, а не создавать второй bundle.
- Рекомендуемые изменения для языка: добавить CLI option `--locale` / `--language`, сохранять выбранный язык в `scan-summary.json` и наследовать его в `report`, `skill-audit`, `logging-review`; skill должен запрещать final Markdown reports не на языке оператора текущей сессии, кроме цитат, команд, путей, identifiers, JSON keys и имён tools/skills.

## Сквозные паттерны между skill-ами

- Повторяющаяся неоднозначность: durable artifacts и git commits имеют разную freshness semantics; workflows нужен явный marker "canonical artifact for final commit".
- Недостающее правило принятия решений: "green partial increment" не является допустимой точкой остановки для user-requested full implementation plan.
- Устаревшая предпосылка: auto-generated CLI output считался useful draft, но в этом запуске занизил stage logs и чрезмерно расширил skill scope.
- Избыточная ручная интерпретация: reviewer results, stage logs и trace events пришлось вручную согласовывать, чтобы получить coherent retrospective timeline.
- Предлагаемая стандартизация: ввести общую schema `process_event` для stage logs, review agents, backlog actualization и commit metadata.
- Предлагаемая стандартизация для retro bundles: первый filesystem write определяет canonical `run_dir`; все последующие outputs должны использовать этот же каталог, если оператор явно не запросил новый run.
- Предлагаемая стандартизация для языка: каждый skill/CLI, создающий человекочитаемые отчёты, должен определять `operator_locale` из session context или явного `--locale`; если язык не определён, команда должна запросить выбор или завершиться с actionable error, а не генерировать финальные отчёты на английском по умолчанию.
