# Logging review for session `019d7490-46d0-7811-b43f-056bb617a7ab`

## Summary

- Auto-detected logs by CLI: `0`
- Manually confirmed relevant stage logs: `7`
- Explicitly logged implementation findings: `13` from implementation logs alone
- Explicitly logged process misses: `3`
- Main conclusion: логирование внутри dossier workflow к концу сессии стало хорошим, но ранняя часть сессии и cross-skill migration work по-прежнему наблюдаются хуже, чем поздние dossier stages.

## Logs inspected manually

- `/code/projects/yaagi/.dossier/logs/F-0016/implementation-SL-F0016-01.md`
- `/code/projects/yaagi/.dossier/logs/F-0016/implementation-SL-F0016-02.md`
- `/code/projects/yaagi/.dossier/logs/F-0016/implementation-SL-F0016-03.md`
- `/code/projects/yaagi/.dossier/logs/F-0017/spec-compact-internal-body-evolution.md`
- `/code/projects/yaagi/.dossier/logs/F-0017/plan-slice-body-evolution.md`
- `/code/projects/yaagi/.dossier/logs/F-0017/implementation-sl-f0017-01.md`
- `/code/projects/yaagi/.dossier/logs/F-0017/implementation-sl-f0017-02.md`

## Observed strengths

- Поздние logs содержат полезный YAML header: `feature_id`, `backlog_item_key`, `stage`, `session_id`, timestamps, source inputs, artifact links.
- Implementation logs хорошо фиксируют review rerounds, operator feedback, checks, backlog actualization и close-out.
- После operator correction logs ведутся на языке оператора, что повышает пригодность для последующего ретро.
- Spec/planning logging был введён прямо в этой сессии и сразу дал лучшую реконструируемость для `F-0017`, чем у ранних стадий `F-0016`.

## Observed gaps

### G-01. Retrospective tooling не распознаёт реальный логовый след

- `scan-summary.json` автодетектировал `Stage logs analyzed: 0`, хотя в trace-linked scope и на диске есть как минимум 7 релевантных логов.
- Это означает, что проблема не в отсутствии данных, а в несовпадении naming/layout heuristics retrospective CLI с реальным репозиторием.

### G-02. Ранняя часть сессии не имеет stage-level telemetry

- Migration backlog workflow, operator stops around wrappers, replay bug investigation и ранний `F-0016` intake/spec/plan восстанавливаются в основном по trace/history/commits.
- Это хуже, чем поздние dossier stages, где уже есть полноценные logs.

### G-03. Naming/layout был неустойчив и потребовал поздней миграции

- В trace видны и mixed-case, и canonicalized варианты путей.
- Коммит `7c1acaa` отдельно мигрировал process logs в канонический layout.
- Такая миграция сама по себе полезна, но она показывает, что log discovery rules не были стабильны с самого начала.

### G-04. Commit metadata иногда приходилось backfill-ить отдельно

- Для `F-0017` есть отдельный commit `c05ce74` с backfill log commit metadata.
- Значит логовый контракт ещё не был достаточно удобным, чтобы фиксировать commit data естественно в том же operational flow, где закрывается пакет.

### G-05. Нет машинно-читаемого следа review orchestration

- Logs содержат narrative про review события, но не содержат полного набора полей для анализа retry storm:
- какая модель использовалась;
- сколько было retry;
- сколько времени ушло на ожидание reviewer agent;
- какой именно rerun был вызван transport/runtime instability.

### G-06. Нет session-level cross-skill ops log

- Backlog migration и repair work не живут естественно внутри одного dossier stage.
- В результате самые важные process lessons ранней части сессии оказываются размазаны между trace, history, issue docs и commits.

## Recommendations

1. Добавить log discovery manifest или index для retrospective tooling.
- Минимум: per-run manifest с явным списком stage-log путей.
- Иначе ретро-CLI продолжит выдавать ложный `0 logs analyzed`.

2. Зафиксировать канонический naming contract.
- `stage`, `cycle_id`, `feature_id` и filename должны совпадать по одному шаблону.
- Retro tooling должен тестироваться на mixed-case и aggregated-cycle logs вроде `sl-f0017-02-03`.

3. Логировать review orchestration как данные, а не только как prose.
- Рекомендуемые поля:
- `review_agents`
- `review_models`
- `review_retry_count`
- `review_wait_minutes`
- `transport_failures_total`

4. Добавить cross-skill/session-level ops log для workflow migration и repair incidents.
- Он нужен для эпизодов, которые затрагивают одновременно backlog, dossier, AGENTS overlay и skill docs.
- Это снимет зависимость ретро от `history.jsonl`.

5. Сделать commit metadata явным этапом close-out.
- Если commit SHA ещё не известен в момент подготовки log, log должен хранить `commit_recorded=false` плюс `commit_pending_reason`.
- После коммита нужен понятный single-step backfill, а не ad hoc docs commit.

6. Сохранять trace anchors и operator intervention counters.
- Рекомендуемые поля:
- `first_trace_event_ts`
- `review_request_event_ids`
- `operator_interventions_total`
- `process_rule_changes_total`
- `issue_followups`

## Validation ideas

- Warn, если trace-linked stage log существует на диске, но не попал в retrospective scan summary.
- Warn, если stage close-out есть, а log отсутствует или не содержит artifact links.
- Warn, если log содержит review reround prose, но отсутствуют machine-readable `review_retry_count` и `review_models`.
- Warn, если implementation log переводился/переименовывался поздним cleanup commit: это хороший сигнал, что naming/layout drift произошёл в ходе фазы.

## Net verdict

- Качество логирования улучшилось прямо во время этой сессии и к `F-0017` стало уже полезным для ретроспектив.
- Основной открытый gap теперь не в dossier stage logs как таковых, а в связке `trace -> log discovery -> cross-skill ops telemetry`.
