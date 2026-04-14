# Skill audit for session `019d7490-46d0-7811-b43f-056bb617a7ab`

## Summary

- `backlog-engineer`: `confirmed_used`
- `dossier-engineer`: `confirmed_used`
- `spec-conformance-reviewer`, `code-reviewer`, `security-reviewer`: `probably_used` through external audit stack and persisted review artifacts
- Главный вывод: проблема сессии была не в отсутствии skill-ов, а в том, что их границы и обязательные ветки workflow не были достаточно жёстко заданы в начале фазы.

## `backlog-engineer`

### Evidence of use

- Migration commit `fe5ab18`
- Backlog actualization trails for `CF-016` and `CF-012`
- Skill issue docs:
- `/home/kostysh/.codex/skills/custom/skills/backlog-engineer/docs/issues/2026-04-10-refresh-todo-remove-replay-bug.ru.md`
- `/home/kostysh/.codex/skills/custom/skills/backlog-engineer/docs/issues/2026-04-10-post-commit-workflow-freshness-and-rebuild-confusion.ru.md`

### Where it helped

- Перевёл backlog в directory-root workflow и закрепил канонический backlog root.
- Дал рабочие actualization primitives для `specified`, `planned`, `implemented`.
- После фиксов стал намного безопаснее объяснять mutation/query contract.

### Where it hindered

- В начале сессии skill/CLI допускал опасный сценарий: `refresh`-generated todo можно было удалить через `patch-item remove_todo`, а сломанный replay обнаруживался только позже на query path.
- Query commands маскировали rebuild semantics; operator видел проблему как "после коммита сломалось".
- Граница между runtime metadata и canonical history была недостаточно явной для оператора и агента.

### Skill-level assessment

- Это реальный defect skill/runtime, не просто operator preference.
- Исправление было правильным: `BE_TODO_REFRESH_MANAGED`, fail-closed mutation path, recovery для legacy bad history.

### Recommended follow-ups

1. Держать `managed_by` semantics в top-level workflow guidance, а не только в bug-report / deep references.
2. Делать query errors явно rebuild-oriented: какой patch, какая operation, какой item/todo.
3. Отдельно документировать разницу между `drafts/`, `patches/` и `.backlog/applied.json`, чтобы хвостовые аудиты вроде draft `013` не требовали отдельного расследования.

## `dossier-engineer`

### Evidence of use

- Feature-intake / spec-compact / plan-slice / implementation artifacts for `F-0016` and `F-0017`
- Stage logs under `.dossier/logs/F-0016` and `.dossier/logs/F-0017`
- Skill issue doc:
- `/home/kostysh/.codex/skills/custom/skills/dossier-engineer/docs/issues/2026-04-10-spec-and-planning-log-policy-gap.ru.md`

### Where it helped

- Дал сильный closure discipline: verification, review, step-close, coverage audit, debt audit.
- В implementation stage обеспечил высококачественные package logs и хороший evidence trail.
- После policy updates расширил logging contract на `spec-compact` и `plan-slice`, что резко улучшило наблюдаемость `F-0017`.

### Where it hindered

- На старте сессии logging policy для `spec-compact`/`plan-slice` отсутствовала, из-за чего ранние решения реконструируются хуже.
- В workflow существовала путаница вокруг commit freshness: commit SHA использовался слишком близко к validity semantics.
- Требование запускать внешний audit stack без отдельного operator approval оказалось недостаточно "fail-closed"; оператору пришлось напоминать это на `SL-F0016-02`.
- Правило про язык и layout stage logs стало explicit только после operator correction.

### Skill-level assessment

- Часть проблем была системной и позже была исправлена прямо в skill-е.
- Наиболее важный gap оказался не в реализации dossiers, а в orchestration policy вокруг review/logging/freshness.

### Recommended follow-ups

1. Оставить `event_commit` только как trace metadata и не допускать возврата SHA-bound freshness.
2. Сделать requirement по external audit явным closure precondition или machine-checkable checklist item.
3. Поддерживать единый stage-log contract для `spec-compact`, `plan-slice`, `implementation`, включая язык оператора и canonical naming.

## Review skill stack

### Evidence of use

- `/code/projects/yaagi/.dossier/reviews/F-0016/implementation-6fd8816c2177.json`
- `/code/projects/yaagi/.dossier/reviews/F-0017/spec-compact-4b45c0da826e.json`
- `/code/projects/yaagi/.dossier/reviews/F-0017/plan-slice-bc65f238785d.json`
- `/code/projects/yaagi/.dossier/reviews/F-0017/implementation-495d9db08c4c.json`
- `/code/projects/yaagi/.dossier/reviews/F-0017/implementation-c05ce744f188.json`
- `/code/projects/yaagi/.dossier/reviews/F-0017/implementation-3a66b9ef5064.json`

### Where they helped

- Поймали реальные defects, а не косметику:
- lifecycle transition bug и row-lock race в `F-0016`
- boundary guard omission, target integrity risk и replay bug в `F-0016`/`F-0017`
- stale wording and authority ambiguity in `F-0017` spec
- Когда review stack запускался вовремя, он реально повышал качество before close-out.

### Where the stack hurt

- В trace виден retry storm: 53 `spawn_agent` вызова за сессию, несколько подряд попыток аудита в коротком окне, начальный выбор `gpt-5.4-mini` для normative audit, operator complaint на качество/скорость и API instability.
- Это не столько defect review skills, сколько defect review orchestration и model policy.

### Recommended follow-ups

1. Для normative audits задать явный default model policy; `mini` должен быть исключением, а не молчаливым default.
2. Логировать `review_requested_ts`, `first_agent_started_ts`, `retry_count`, `model_used`, `final_pass_ts`.
3. Явно различать "review skill defect" и "transport/runtime instability", чтобы ретро не смешивало качество reviewer prompt и проблемы инфраструктуры.

## Non-material or low-signal skills

- `git-engineer`, `documentation`, `node-engineer` и прочие навыки не дают отдельного material signal в этой сессии.
- Они могли быть контекстно релевантны, но trace и stage logs не показывают, что именно они создали заметный churn или, наоборот, сняли крупный риск.

## Net verdict

- `backlog-engineer` и `dossier-engineer` в этой сессии были одновременно источником пользы и источником process friction.
- Важно, что friction не остался латентным: он был превращён в explicit issue docs, repo overlay updates и skill fixes прямо в ходе сессии.
- Самая ценная эволюция по итогам сессии: переход от implicit workflow assumptions к fail-closed, operator-visible rules.
